export interface MonsterInstance {
  instanceId: string;
  templateId: number;
  name: string;
  zoneId: number;
  maxHp: number;
  currentHp: number;
  attackPower: number;
  defence: number;
  xpReward: number;
  lootTable: LootEntry[];
  posX: number;
  posY: number;
  inCombat: boolean;
  participants: Set<string>; // characterIds that have dealt damage
}

export interface LootEntry {
  item_id: number;
  drop_chance_pct: number;
  quantity: number;
}

// zoneId → (instanceId → MonsterInstance)
const registry = new Map<number, Map<string, MonsterInstance>>();

function ensureZone(zoneId: number): Map<string, MonsterInstance> {
  if (!registry.has(zoneId)) registry.set(zoneId, new Map());
  return registry.get(zoneId)!;
}

export function spawnInstance(zoneId: number, instance: Omit<MonsterInstance, 'participants'>): MonsterInstance {
  const full: MonsterInstance = { ...instance, participants: new Set() };
  ensureZone(zoneId).set(instance.instanceId, full);
  return full;
}

export function getInstance(instanceId: string): MonsterInstance | undefined {
  for (const zone of registry.values()) {
    const inst = zone.get(instanceId);
    if (inst) return inst;
  }
  return undefined;
}

export function getZoneMonsters(zoneId: number): MonsterInstance[] {
  return Array.from(registry.get(zoneId)?.values() ?? []);
}

export function killInstance(instanceId: string): void {
  for (const zone of registry.values()) {
    if (zone.has(instanceId)) {
      zone.delete(instanceId);
      return;
    }
  }
}

export function addParticipant(instanceId: string, characterId: string): void {
  const inst = getInstance(instanceId);
  inst?.participants.add(characterId);
}

export function getParticipants(instanceId: string): string[] {
  return Array.from(getInstance(instanceId)?.participants ?? []);
}

export function setInCombat(instanceId: string, value: boolean): void {
  const inst = getInstance(instanceId);
  if (inst) inst.inCombat = value;
}
