import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { log } from '../../logger';
import { findByAccountId, findClassById, updateCharacter } from '../../db/queries/characters';
import { getNpcById } from '../../db/queries/npcs';
import { query } from '../../db/connection';
import { computeCombatStats } from '../combat/combat-stats-service';
import type {
  TrainingOpenPayload,
  TrainingAllocatePayload,
  TrainingAttributesDto,
  TrainingDescriptionsDto,
} from '../../../../shared/protocol/index';

const STAT_POINTS_PER_LEVEL = 7;
const MAX_POINTS_PER_STAT_PER_LEVEL = 10;

const ATTR_DESCRIPTIONS: TrainingDescriptionsDto = {
  constitution: '+4 HP, +1 Attack per point',
  strength: '+2 Attack, +0.3% Crit Damage per point',
  intelligence: '+8 Mana per point',
  dexterity: '+0.1% Crit Chance, +0.1% Evasion per point',
  toughness: '+1 Defence per point',
};

function sendError(session: AuthenticatedSession, message: string): void {
  sendToSession(session, 'training.error', { message });
}

// ---------------------------------------------------------------------------
// training.open
// ---------------------------------------------------------------------------

async function handleTrainingOpen(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id } = payload as TrainingOpenPayload;
  const characterId = session.characterId;
  if (!characterId) { sendError(session, 'No character.'); return; }

  const npc = await getNpcById(npc_id);
  if (!npc || !npc.is_trainer) {
    sendError(session, 'This NPC does not offer training.');
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) { sendError(session, 'Character not found.'); return; }

  if (character.in_combat) {
    sendError(session, 'Cannot train while in combat.');
    return;
  }

  const cls = await findClassById(character.class_id);
  if (!cls) { sendError(session, 'Class data not found.'); return; }

  const perStatCap = MAX_POINTS_PER_STAT_PER_LEVEL * (character.level - 1);

  // Compute derived stats for display
  const derivedMaxHp = cls.base_hp + character.attr_constitution * 4;
  const derivedAttack = cls.base_attack + character.attr_constitution * 1 + character.attr_strength * 2;
  const derivedDefence = cls.base_defence + character.attr_toughness * 1;
  const derivedMaxMana = 100 + character.attr_intelligence * 8;
  const derivedCritChance = character.attr_dexterity * 0.1;
  const derivedCritDamage = 150 + character.attr_strength * 0.3;
  const derivedDodgeChance = character.attr_dexterity * 0.1;

  // Get equipment stats for breakdown
  const equipResult = await query<{
    attack: number | null; defence: number | null;
    max_mana: number; crit_chance: number; crit_damage: number; dodge_chance: number;
  }>(
    `SELECT id.attack, id.defence, id.max_mana, id.crit_chance, id.crit_damage, id.dodge_chance
     FROM inventory_items ii
     JOIN item_definitions id ON id.id = ii.item_def_id
     WHERE ii.character_id = $1 AND ii.equipped_slot IS NOT NULL`,
    [characterId],
  );

  let eqAttack = 0, eqDefence = 0, eqMaxMana = 0, eqCritChance = 0, eqCritDamage = 0, eqDodgeChance = 0;
  for (const item of equipResult.rows) {
    eqAttack += item.attack ?? 0;
    eqDefence += item.defence ?? 0;
    eqMaxMana += item.max_mana;
    eqCritChance += item.crit_chance;
    // crit_damage uses override logic (not additive) — only count bonus above base 150%
    if (item.crit_damage > 150) {
      eqCritDamage = Math.max(eqCritDamage, item.crit_damage - 150);
    }
    eqDodgeChance += item.dodge_chance;
  }

  log('debug', 'training', 'training_open', { characterId, npcId: npc_id, unspent: character.stat_points_unspent });

  sendToSession(session, 'training.state', {
    attributes: {
      constitution: character.attr_constitution,
      strength: character.attr_strength,
      intelligence: character.attr_intelligence,
      dexterity: character.attr_dexterity,
      toughness: character.attr_toughness,
    },
    unspent_points: character.stat_points_unspent,
    per_stat_cap: perStatCap,
    level: character.level,
    derived_stats: {
      max_hp: derivedMaxHp,
      attack_power: derivedAttack,
      defence: derivedDefence,
      max_mana: derivedMaxMana,
      crit_chance: derivedCritChance,
      crit_damage: derivedCritDamage,
      dodge_chance: derivedDodgeChance,
    },
    descriptions: ATTR_DESCRIPTIONS,
    base_stats: {
      hp: cls.base_hp,
      attack: cls.base_attack,
      defence: cls.base_defence,
    },
    equipment_stats: {
      attack: eqAttack,
      defence: eqDefence,
      max_mana: eqMaxMana,
      crit_chance: eqCritChance,
      crit_damage: eqCritDamage,
      dodge_chance: eqDodgeChance,
    },
  });
}

// ---------------------------------------------------------------------------
// training.allocate
// ---------------------------------------------------------------------------

async function handleTrainingAllocate(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { npc_id, increments } = payload as TrainingAllocatePayload;
  const characterId = session.characterId;
  if (!characterId) { sendError(session, 'No character.'); return; }

  const npc = await getNpcById(npc_id);
  if (!npc || !npc.is_trainer) {
    sendError(session, 'This NPC does not offer training.');
    return;
  }

  const character = await findByAccountId(session.accountId);
  if (!character) { sendError(session, 'Character not found.'); return; }

  if (character.in_combat) {
    sendError(session, 'Cannot train while in combat.');
    return;
  }

  // Validate increments
  const attrs: (keyof TrainingAttributesDto)[] = ['constitution', 'strength', 'intelligence', 'dexterity', 'toughness'];
  const attrDbFields = {
    constitution: 'attr_constitution',
    strength: 'attr_strength',
    intelligence: 'attr_intelligence',
    dexterity: 'attr_dexterity',
    toughness: 'attr_toughness',
  } as const;

  let totalSpend = 0;
  const perStatCap = MAX_POINTS_PER_STAT_PER_LEVEL * (character.level - 1);

  for (const attr of attrs) {
    const inc = increments[attr];
    if (typeof inc !== 'number' || inc < 0 || !Number.isInteger(inc)) {
      sendError(session, `Invalid increment for ${attr}.`);
      return;
    }
    totalSpend += inc;

    const currentVal = character[attrDbFields[attr]];
    if (currentVal + inc > perStatCap) {
      sendError(session, `${attr} would exceed cap of ${perStatCap}.`);
      return;
    }
  }

  if (totalSpend === 0) {
    sendError(session, 'No points to allocate.');
    return;
  }

  if (totalSpend > character.stat_points_unspent) {
    sendError(session, 'Not enough stat points.');
    return;
  }

  // Apply allocation
  const cls = await findClassById(character.class_id);
  if (!cls) { sendError(session, 'Class data not found.'); return; }

  const newConst = character.attr_constitution + increments.constitution;
  const newStr = character.attr_strength + increments.strength;
  const newInt = character.attr_intelligence + increments.intelligence;
  const newDex = character.attr_dexterity + increments.dexterity;
  const newTou = character.attr_toughness + increments.toughness;
  const newUnspent = character.stat_points_unspent - totalSpend;

  // Derive new base stats
  const newMaxHp = cls.base_hp + newConst * 4;
  const newAttack = cls.base_attack + newConst * 1 + newStr * 2;
  const newDefence = cls.base_defence + newTou * 1;

  await updateCharacter(characterId, {
    attr_constitution: newConst,
    attr_strength: newStr,
    attr_intelligence: newInt,
    attr_dexterity: newDex,
    attr_toughness: newTou,
    stat_points_unspent: newUnspent,
    max_hp: newMaxHp,
    attack_power: newAttack,
    defence: newDefence,
  });

  const newMaxMana = 100 + newInt * 8;
  const newCritChance = newDex * 0.1;
  const newCritDamage = 150 + newStr * 0.3;
  const newDodgeChance = newDex * 0.1;

  log('info', 'training', 'stat_allocation', {
    characterId,
    npcId: npc_id,
    increments,
    totalSpend,
    newUnspent,
  });

  sendToSession(session, 'training.result', {
    attributes: {
      constitution: newConst,
      strength: newStr,
      intelligence: newInt,
      dexterity: newDex,
      toughness: newTou,
    },
    unspent_points: newUnspent,
    new_max_hp: newMaxHp,
    new_attack_power: newAttack,
    new_defence: newDefence,
    new_max_mana: newMaxMana,
    new_crit_chance: newCritChance,
    new_crit_damage: newCritDamage,
    new_dodge_chance: newDodgeChance,
  });
}

// ---------------------------------------------------------------------------
// Register handlers
// ---------------------------------------------------------------------------

export function registerTrainingHandlers(): void {
  registerHandler('training.open', handleTrainingOpen);
  registerHandler('training.allocate', handleTrainingAllocate);
}
