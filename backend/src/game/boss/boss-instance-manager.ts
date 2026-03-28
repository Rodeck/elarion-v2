import { log } from '../../logger';
import {
  getAllBosses,
  getBossInstance,
  createBossInstance,
  lockBossInstance,
  unlockBossInstance,
  updateBossInstanceHp,
  defeatBossInstance as dbDefeatBossInstance,
  deleteBossInstance,
  getDefeatedInstancesReadyToRespawn,
  getBossAbilities,
  getBossLoot,
  type Boss,
  type BossInstance,
  type BossAbility,
  type BossLootEntry,
} from '../../db/queries/bosses';
import { getBuildingById } from '../../db/queries/city-maps';
import { broadcastToZone } from '../world/zone-broadcasts';
import type { BossDto, BossHpBracket, BossStatePayload, BossAnnouncementPayload } from '../../../../shared/protocol';

// ---------------------------------------------------------------------------
// In-memory boss state
// ---------------------------------------------------------------------------

interface LiveBoss {
  boss: Boss;
  instance: BossInstance | null;
  zoneId: number;
  buildingName: string | null;
}

function randRange(min: number, max: number): number {
  if (min >= max) return max;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function rollBossStats(boss: Boss): { hp: number; attack: number; defense: number } {
  return {
    hp: randRange(boss.min_hp ?? boss.max_hp, boss.max_hp),
    attack: randRange(boss.min_attack ?? boss.attack, boss.attack),
    defense: randRange(boss.min_defense ?? boss.defense, boss.defense),
  };
}

const liveBosses = new Map<number, LiveBoss>(); // bossId → LiveBoss

// ---------------------------------------------------------------------------
// HP bracket helper
// ---------------------------------------------------------------------------

export function hpToBracket(currentHp: number, maxHp: number): BossHpBracket {
  const ratio = currentHp / maxHp;
  if (ratio > 0.8) return 'full';
  if (ratio > 0.6) return 'high';
  if (ratio > 0.4) return 'medium';
  if (ratio > 0.2) return 'low';
  return 'critical';
}

// ---------------------------------------------------------------------------
// Initialize — load all active bosses and their instances from DB
// ---------------------------------------------------------------------------

export async function initialize(): Promise<void> {
  const bosses = await getAllBosses();
  for (const boss of bosses) {
    if (!boss.is_active || !boss.building_id) continue;

    const building = await getBuildingById(boss.building_id);
    if (!building) continue;

    let instance = await getBossInstance(boss.id);

    // If no instance exists, spawn one with randomized stats
    if (!instance || instance.status === 'defeated') {
      if (instance && instance.respawn_at && new Date(instance.respawn_at) <= new Date()) {
        await deleteBossInstance(boss.id);
        const stats = rollBossStats(boss);
        instance = await createBossInstance(boss.id, stats.hp, stats.attack, stats.defense);
        log('info', 'boss', 'respawn_on_init', { boss_id: boss.id, boss_name: boss.name, ...stats });
      } else if (!instance) {
        const stats = rollBossStats(boss);
        instance = await createBossInstance(boss.id, stats.hp, stats.attack, stats.defense);
        log('info', 'boss', 'spawn_on_init', { boss_id: boss.id, boss_name: boss.name, ...stats });
      }
    }

    // If instance was in_combat on startup (server crash), reset to alive
    if (instance && instance.status === 'in_combat') {
      await unlockBossInstance(instance.id);
      instance = { ...instance, status: 'alive', fighting_character_id: null };
      log('info', 'boss', 'reset_combat_on_init', { boss_id: boss.id, instance_id: instance.id });
    }

    liveBosses.set(boss.id, { boss, instance, zoneId: building.zone_id, buildingName: building.name });
  }

  log('info', 'boss', 'initialized', { boss_count: liveBosses.size });
}

// ---------------------------------------------------------------------------
// Query methods
// ---------------------------------------------------------------------------

export function isBossBlocking(buildingId: number): boolean {
  for (const live of liveBosses.values()) {
    if (live.boss.building_id === buildingId && live.instance) {
      if (live.instance.status === 'alive' || live.instance.status === 'in_combat') {
        return true;
      }
    }
  }
  return false;
}

export function getBossesForZone(zoneId: number): BossDto[] {
  const result: BossDto[] = [];
  for (const live of liveBosses.values()) {
    if (live.zoneId !== zoneId) continue;
    result.push(liveBossToDto(live));
  }
  return result;
}

export function getLiveBoss(bossId: number): LiveBoss | undefined {
  return liveBosses.get(bossId);
}

/** Get the effective combat stats for a boss instance (rolled or fallback to definition). */
export function getInstanceCombatStats(bossId: number): { attack: number; defense: number } {
  const live = liveBosses.get(bossId);
  if (!live) return { attack: 0, defense: 0 };
  return {
    attack: live.instance?.actual_attack ?? live.boss.attack,
    defense: live.instance?.actual_defense ?? live.boss.defense,
  };
}

export async function getBossAbilitiesForCombat(bossId: number): Promise<BossAbility[]> {
  return getBossAbilities(bossId);
}

export async function getBossLootForCombat(bossId: number): Promise<BossLootEntry[]> {
  return getBossLoot(bossId);
}

// ---------------------------------------------------------------------------
// Challenge — atomically lock boss for combat
// ---------------------------------------------------------------------------

export async function challengeBoss(
  bossId: number,
  characterId: string,
): Promise<{ success: true; instance: BossInstance; boss: Boss } | { success: false; reason: string; respawnAt?: string | null }> {
  const live = liveBosses.get(bossId);
  if (!live) return { success: false, reason: 'not_found' };
  if (!live.boss.is_active) return { success: false, reason: 'inactive' };
  if (!live.instance) return { success: false, reason: 'not_found' };

  if (live.instance.status === 'defeated') {
    return {
      success: false,
      reason: 'defeated',
      respawnAt: live.instance.respawn_at?.toISOString() ?? null,
    };
  }

  if (live.instance.status === 'in_combat') {
    return { success: false, reason: 'in_combat' };
  }

  // Atomic DB lock
  const locked = await lockBossInstance(live.instance.id, characterId);
  if (!locked) {
    // Someone else got it first
    return { success: false, reason: 'in_combat' };
  }

  // Update in-memory state
  live.instance = locked;

  log('info', 'boss', 'challenge_started', {
    boss_id: bossId,
    boss_name: live.boss.name,
    character_id: characterId,
    instance_id: locked.id,
  });

  return { success: true, instance: locked, boss: live.boss };
}

// ---------------------------------------------------------------------------
// Combat state updates
// ---------------------------------------------------------------------------

export async function updateHp(bossId: number, hp: number): Promise<void> {
  const live = liveBosses.get(bossId);
  if (!live?.instance) return;
  live.instance = { ...live.instance, current_hp: hp };
  await updateBossInstanceHp(live.instance.id, hp);
}

export async function defeatBoss(bossId: number, defeatedByName?: string): Promise<void> {
  const live = liveBosses.get(bossId);
  if (!live?.instance) return;

  const totalAttempts = live.instance.total_attempts;
  const min = live.boss.respawn_min_seconds;
  const max = live.boss.respawn_max_seconds;
  const delaySec = Math.floor(Math.random() * (max - min + 1)) + min;
  const respawnAt = new Date(Date.now() + delaySec * 1000);

  await dbDefeatBossInstance(live.instance.id, respawnAt);
  live.instance = {
    ...live.instance,
    status: 'defeated',
    fighting_character_id: null,
    defeated_at: new Date(),
    respawn_at: respawnAt,
  };

  log('info', 'boss', 'defeated', {
    boss_id: bossId,
    boss_name: live.boss.name,
    defeated_by: defeatedByName,
    respawn_at: respawnAt.toISOString(),
  });

  broadcastBossState(bossId);

  // Broadcast prominent defeat announcement
  const announcement: BossAnnouncementPayload = {
    type: 'defeated',
    boss_name: live.boss.name,
    boss_icon_url: live.boss.icon_filename ? `/assets/bosses/icons/${live.boss.icon_filename}` : null,
    building_name: live.buildingName,
    defeated_by: defeatedByName ?? 'Unknown',
    total_attempts: totalAttempts,
  };
  broadcastToZone(live.zoneId, 'boss:announcement', announcement);
}

export async function releaseBoss(bossId: number): Promise<void> {
  const live = liveBosses.get(bossId);
  if (!live?.instance) return;

  await unlockBossInstance(live.instance.id);
  live.instance = {
    ...live.instance,
    status: 'alive',
    fighting_character_id: null,
  };

  log('info', 'boss', 'released', {
    boss_id: bossId,
    boss_name: live.boss.name,
    current_hp: live.instance.current_hp,
  });

  broadcastBossState(bossId);
}

// ---------------------------------------------------------------------------
// Respawn check — called on interval
// ---------------------------------------------------------------------------

export async function checkRespawns(): Promise<void> {
  // 1. Handle natural respawns for defeated instances
  const ready = await getDefeatedInstancesReadyToRespawn();
  for (const old of ready) {
    const live = liveBosses.get(old.boss_id);
    if (!live) continue;

    await deleteBossInstance(old.boss_id);
    const stats = rollBossStats(live.boss);
    const fresh = await createBossInstance(old.boss_id, stats.hp, stats.attack, stats.defense);
    live.instance = fresh;

    log('info', 'boss', 'respawned', {
      boss_id: old.boss_id,
      boss_name: live.boss.name,
      new_instance_id: fresh.id,
      ...stats,
    });

    broadcastBossState(old.boss_id);

    const announcement: BossAnnouncementPayload = {
      type: 'respawned',
      boss_name: live.boss.name,
      boss_icon_url: live.boss.icon_filename ? `/assets/bosses/icons/${live.boss.icon_filename}` : null,
      building_name: live.buildingName,
    };
    broadcastToZone(live.zoneId, 'boss:announcement', announcement);
  }

  // 2. Sync with DB — detect admin changes (new bosses, removed bosses, force-respawns)
  await syncWithDatabase();
}

async function syncWithDatabase(): Promise<void> {
  const allBosses = await getAllBosses();
  const dbBossIds = new Set<number>();

  for (const boss of allBosses) {
    dbBossIds.add(boss.id);

    if (!boss.is_active || !boss.building_id) {
      // Boss deactivated or unassigned — remove from memory
      if (liveBosses.has(boss.id)) {
        liveBosses.delete(boss.id);
        // Can't broadcast (no zone info), but building check will stop blocking
      }
      continue;
    }

    const existing = liveBosses.get(boss.id);
    const dbInstance = await getBossInstance(boss.id);

    if (!existing) {
      // New boss added via admin — load it
      const building = await getBuildingById(boss.building_id);
      if (!building) continue;

      let instance = dbInstance;
      if (!instance) {
        const stats = rollBossStats(boss);
        instance = await createBossInstance(boss.id, stats.hp, stats.attack, stats.defense);
      }

      liveBosses.set(boss.id, { boss, instance, zoneId: building.zone_id, buildingName: building.name });
      broadcastBossState(boss.id);

      log('info', 'boss', 'synced_new', { boss_id: boss.id, boss_name: boss.name });

      // Announce if alive
      if (instance.status === 'alive') {
        const announcement: BossAnnouncementPayload = {
          type: 'respawned',
          boss_name: boss.name,
          boss_icon_url: boss.icon_filename ? `/assets/bosses/icons/${boss.icon_filename}` : null,
          building_name: building.name,
        };
        broadcastToZone(building.zone_id, 'boss:announcement', announcement);
      }
      continue;
    }

    // Existing boss — check if instance changed (admin force-respawn creates new DB instance)
    if (dbInstance && existing.instance) {
      if (dbInstance.id !== existing.instance.id || dbInstance.status !== existing.instance.status) {
        const oldStatus = existing.instance.status;
        existing.instance = dbInstance;
        existing.boss = boss;
        broadcastBossState(boss.id);

        if (dbInstance.status === 'alive' && oldStatus !== 'alive') {
          const announcement: BossAnnouncementPayload = {
            type: 'respawned',
            boss_name: boss.name,
            boss_icon_url: boss.icon_filename ? `/assets/bosses/icons/${boss.icon_filename}` : null,
            building_name: existing.buildingName,
          };
          broadcastToZone(existing.zoneId, 'boss:announcement', announcement);
        }

        log('info', 'boss', 'synced_instance_change', { boss_id: boss.id, old_status: oldStatus, new_status: dbInstance.status });
      }
    } else if (dbInstance && !existing.instance) {
      // Instance appeared (admin created one)
      existing.instance = dbInstance;
      existing.boss = boss;
      broadcastBossState(boss.id);
    } else if (!dbInstance && existing.instance) {
      // Instance deleted (admin deleted it) — spawn a new one
      const stats = rollBossStats(boss);
      const fresh = await createBossInstance(boss.id, stats.hp, stats.attack, stats.defense);
      existing.instance = fresh;
      existing.boss = boss;
      broadcastBossState(boss.id);
    }
  }

  // Remove bosses no longer in DB
  for (const bossId of liveBosses.keys()) {
    if (!dbBossIds.has(bossId)) {
      liveBosses.delete(bossId);
    }
  }
}

// ---------------------------------------------------------------------------
// Broadcast helper
// ---------------------------------------------------------------------------

export function broadcastBossState(bossId: number): void {
  const live = liveBosses.get(bossId);
  if (!live) return;

  const payload: BossStatePayload = {
    boss_id: bossId,
    building_id: live.boss.building_id!,
    status: live.instance?.status ?? 'defeated',
    fighting_character_name: null, // will be resolved by frontend from zone player list
    total_attempts: live.instance?.total_attempts ?? 0,
    respawn_at: null, // hidden from players — only visible in admin panel
  };

  broadcastToZone(live.zoneId, 'boss:state', payload);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function liveBossToDto(live: LiveBoss): BossDto {
  const b = live.boss;
  const i = live.instance;
  const iconBase = '/assets/bosses/icons/';
  const spriteBase = '/assets/bosses/sprites/';

  let status: BossDto['status'] = 'inactive';
  if (b.is_active && i) {
    status = i.status;
  }

  return {
    id: b.id,
    name: b.name,
    description: b.description,
    icon_url: b.icon_filename ? `${iconBase}${b.icon_filename}` : null,
    sprite_url: b.sprite_filename ? `${spriteBase}${b.sprite_filename}` : null,
    building_id: b.building_id!,
    status,
    fighting_character_name: null, // resolved client-side or by join query
    total_attempts: i?.total_attempts ?? 0,
    respawn_at: null, // hidden from players — only visible in admin panel
  };
}

// ---------------------------------------------------------------------------
// Admin: reload a boss definition (after admin creates/updates)
// ---------------------------------------------------------------------------

export async function reloadBoss(bossId: number): Promise<void> {
  const { getBossById } = await import('../../db/queries/bosses');
  const boss = await getBossById(bossId);
  if (!boss || !boss.is_active || !boss.building_id) {
    liveBosses.delete(bossId);
    return;
  }

  const building = await getBuildingById(boss.building_id);
  if (!building) return;

  let instance = await getBossInstance(boss.id);
  if (!instance) {
    const stats = rollBossStats(boss);
    instance = await createBossInstance(boss.id, stats.hp, stats.attack, stats.defense);
  }

  liveBosses.set(bossId, { boss, instance, zoneId: building.zone_id, buildingName: building.name });
  broadcastBossState(bossId);

  // Broadcast respawn announcement if instance is alive (admin force-respawn)
  if (instance.status === 'alive') {
    const announcement: BossAnnouncementPayload = {
      type: 'respawned',
      boss_name: boss.name,
      boss_icon_url: boss.icon_filename ? `/assets/bosses/icons/${boss.icon_filename}` : null,
      building_name: building.name,
    };
    broadcastToZone(building.zone_id, 'boss:announcement', announcement);
  }
}

export async function removeBoss(bossId: number): Promise<void> {
  const live = liveBosses.get(bossId);
  liveBosses.delete(bossId);
  if (live) {
    broadcastBossState(bossId);
  }
}
