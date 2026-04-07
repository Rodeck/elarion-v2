import { registerHandler } from '../../websocket/dispatcher';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import { getAllSpellProgress } from '../../db/queries/spell-progress';
import { getActiveBuffs } from '../../db/queries/spell-buffs';
import { getSpellById, getSpellLevelStats, getSpellCosts, buildSpellIconUrl } from '../../db/queries/spells';
import { config } from '../../config';
import type { OwnedSpellDto, ActiveSpellBuffDto, SpellLevelStatsDto, SpellItemCostDto } from '../../../../shared/protocol';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_SPELL_LEVEL = 5;
const POINTS_TO_LEVEL = 100;

// ---------------------------------------------------------------------------
// Build DTOs
// ---------------------------------------------------------------------------

function buildItemIconUrl(filename: string | null | undefined): string | null {
  return filename ? `${config.adminBaseUrl}/item-icons/${filename}` : null;
}

async function buildLevelStats(spellId: number, level: number): Promise<SpellLevelStatsDto | null> {
  const stats = await getSpellLevelStats(spellId, level);
  if (!stats) return null;

  const costs = await getSpellCosts(spellId, level);
  const itemCosts: SpellItemCostDto[] = costs.map(c => ({
    item_def_id: c.item_def_id,
    item_name: c.item_name ?? 'Unknown',
    item_icon_url: buildItemIconUrl(c.item_icon_filename),
    quantity: c.quantity,
  }));

  return {
    level: stats.level,
    effect_value: stats.effect_value,
    duration_seconds: stats.duration_seconds,
    gold_cost: stats.gold_cost,
    item_costs: itemCosts,
  };
}

// ---------------------------------------------------------------------------
// Send spell state
// ---------------------------------------------------------------------------

export async function sendSpellState(session: AuthenticatedSession, characterId: string): Promise<void> {
  const [progressRows, buffRows] = await Promise.all([
    getAllSpellProgress(characterId),
    getActiveBuffs(characterId),
  ]);

  // Build OwnedSpellDto[]
  const spells: OwnedSpellDto[] = [];
  for (const p of progressRows) {
    const spell = await getSpellById(p.spell_id);
    if (!spell) continue;

    const currentLevelStats = await buildLevelStats(spell.id, p.current_level);
    const nextLevelStats = p.current_level < MAX_SPELL_LEVEL
      ? await buildLevelStats(spell.id, p.current_level + 1)
      : null;

    spells.push({
      id: spell.id,
      name: spell.name,
      icon_url: buildSpellIconUrl(spell.icon_filename),
      description: spell.description,
      effect_type: spell.effect_type,
      effect_value: currentLevelStats?.effect_value ?? spell.effect_value,
      duration_seconds: currentLevelStats?.duration_seconds ?? spell.duration_seconds,
      level: p.current_level,
      points: p.current_points,
      points_to_next: p.current_level < MAX_SPELL_LEVEL ? POINTS_TO_LEVEL - p.current_points : null,
      cooldown_until: p.last_book_used_at
        ? new Date(new Date(p.last_book_used_at).getTime() + 6 * 60 * 60 * 1000).toISOString()
        : null,
      current_level_stats: currentLevelStats,
      next_level_stats: nextLevelStats,
    });
  }

  // Build ActiveSpellBuffDto[]
  const active_buffs: ActiveSpellBuffDto[] = buffRows.map(b => {
    const totalDuration = Math.round((b.expires_at.getTime() - b.created_at.getTime()) / 1000);
    return {
      spell_id: b.spell_id,
      spell_name: b.spell_name ?? 'Unknown',
      icon_url: buildSpellIconUrl(b.spell_icon_filename ?? null),
      level: b.level,
      effect_type: b.effect_type,
      effect_value: b.effect_value,
      duration_seconds: totalDuration,
      expires_at: b.expires_at.toISOString(),
      caster_name: b.caster_name ?? 'Unknown',
    };
  });

  sendToSession(session, 'spell:state', { spells, active_buffs });
}

// ---------------------------------------------------------------------------
// Handler: spell.request_state
// ---------------------------------------------------------------------------

async function handleSpellRequestState(session: AuthenticatedSession, _payload: unknown): Promise<void> {
  if (!session.characterId) return;
  await sendSpellState(session, session.characterId);
}

// ---------------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------------

export function registerSpellStateHandlers(): void {
  registerHandler('spell.request_state', handleSpellRequestState);
}
