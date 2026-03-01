import { randomUUID } from 'crypto';
import { query } from '../../db/connection';
import { getZone, isPassable } from './zone-loader';
import { spawnInstance, killInstance, getZoneMonsters } from './monster-registry';
import { broadcastToZone } from './zone-broadcasts';
import { log } from '../../logger';

interface MonsterTemplate {
  id: number;
  name: string;
  zone_id: number;
  max_hp: number;
  attack_power: number;
  defence: number;
  xp_reward: number;
  loot_table: Array<{ item_id: number; drop_chance_pct: number; quantity: number }>;
  respawn_seconds: number;
}

const SPAWN_COUNT_PER_TEMPLATE = 3;

function randomPassableTile(zoneId: number): { x: number; y: number } | null {
  const zone = getZone(zoneId);
  if (!zone) return null;

  for (let attempt = 0; attempt < 100; attempt++) {
    const x = Math.floor(Math.random() * zone.widthTiles);
    const y = Math.floor(Math.random() * zone.heightTiles);
    if (isPassable(zoneId, x, y)) return { x, y };
  }
  return null;
}

function spawnOne(template: MonsterTemplate): void {
  const pos = randomPassableTile(template.zone_id);
  if (!pos) {
    log('warn', 'spawner', 'no_passable_tile', { template_id: template.id });
    return;
  }

  const instance = spawnInstance(template.zone_id, {
    instanceId: randomUUID(),
    templateId: template.id,
    name: template.name,
    zoneId: template.zone_id,
    maxHp: template.max_hp,
    currentHp: template.max_hp,
    attackPower: template.attack_power,
    defence: template.defence,
    xpReward: template.xp_reward,
    lootTable: template.loot_table,
    posX: pos.x,
    posY: pos.y,
    inCombat: false,
  });

  log('debug', 'spawner', 'spawned', { instanceId: instance.instanceId, name: instance.name, zoneId: instance.zoneId });
}

function scheduleRespawn(template: MonsterTemplate): void {
  setTimeout(() => {
    const pos = randomPassableTile(template.zone_id);
    if (!pos) return;

    const instance = spawnInstance(template.zone_id, {
      instanceId: randomUUID(),
      templateId: template.id,
      name: template.name,
      zoneId: template.zone_id,
      maxHp: template.max_hp,
      currentHp: template.max_hp,
      attackPower: template.attack_power,
      defence: template.defence,
      xpReward: template.xp_reward,
      lootTable: template.loot_table,
      posX: pos.x,
      posY: pos.y,
      inCombat: false,
    });

    broadcastToZone(template.zone_id, 'monster.spawned', {
      instance_id: instance.instanceId,
      template_id: instance.templateId,
      name: instance.name,
      max_hp: instance.maxHp,
      pos_x: instance.posX,
      pos_y: instance.posY,
    });

    log('info', 'spawner', 'respawned', { instanceId: instance.instanceId, name: instance.name });
  }, template.respawn_seconds * 1000);
}

export function scheduleMonsterRespawn(template: MonsterTemplate): void {
  scheduleRespawn(template);
}

export async function spawnAllMonsters(): Promise<void> {
  const result = await query<MonsterTemplate>(
    `SELECT id, name, zone_id, max_hp, attack_power, defence, xp_reward, loot_table, respawn_seconds
     FROM monsters`,
  );

  for (const template of result.rows) {
    for (let i = 0; i < SPAWN_COUNT_PER_TEMPLATE; i++) {
      spawnOne(template);
    }
    log('info', 'spawner', 'template_initialized', {
      template_id: template.id,
      name: template.name,
      count: SPAWN_COUNT_PER_TEMPLATE,
    });
  }
}

export { killInstance, getZoneMonsters, scheduleRespawn as respawnTemplate };
