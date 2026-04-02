import 'dotenv/config';
import { config } from './config';
import { log } from './logger';
import { query } from './db/connection';
import { runMigrations } from './db/migrate';
import { runSeeds } from './db/seeds/initial-data';
import { loadAllZones } from './game/world/zone-loader';
import { startWebSocketServer } from './websocket/server';
import { registerHandler } from './websocket/dispatcher';
import { handleAuthRegister } from './auth/register-handler';
import { handleAuthLogin } from './auth/login-handler';
import { handleCharacterCreate } from './game/world/character-create-handler';
import { handlePlayerMove } from './game/world/movement-handler';
import { handleChatSend } from './game/chat/chat-handler';
import { handleCityMove } from './game/world/city-movement-handler';
import { handleBuildingAction } from './game/world/building-action-handler';
import { handleInventoryDeleteItem } from './game/inventory/inventory-delete-handler';
import { handleExpeditionDispatch, handleExpeditionCollect } from './game/expedition/expedition-handler';
import { handleEquipmentEquip, handleEquipmentUnequip } from './game/equipment/equipment-handler';
import { handleCombatTriggerActive, handleLoadoutRequest, handleLoadoutUpdate } from './game/combat/combat-handlers';
import { registerCraftingHandlers } from './game/crafting/crafting-handler';
import { registerQuestHandlers } from './game/quest/quest-handler';
import { registerMarketplaceHandlers } from './game/marketplace/marketplace-handler';
import { handleGatheringStart, handleGatheringCancel } from './game/gathering/gathering-handler';
import { handleSquireRoster } from './game/squire/squire-grant-service';
import { handleSquireDismissList, handleSquireDismissConfirm } from './game/squire/squire-dismiss-handler';
import { registerFishingHandlers } from './game/fishing/fishing-handler';
import { registerDisassemblyHandlers } from './game/disassembly/disassembly-handler';
import { handleRankingsGet } from './game/rankings/rankings-handler';
import { startRankingsService } from './game/rankings/rankings-service';
import { sendWorldState, setZonePlayersGetter } from './websocket/handlers/world-state-handler';
import { getZonePlayers } from './game/world/zone-registry';
import { loadCityMaps } from './game/world/city-map-loader';
import * as bossInstanceManager from './game/boss/boss-instance-manager';
import { handleBossChallenge, handleBossCombatTriggerActive } from './game/boss/boss-combat-handler';
import { registerArenaHandlers } from './game/arena/arena-handler';
import { loadFromDb as loadArenaState } from './game/arena/arena-state-manager';

async function bootstrap(): Promise<void> {
  log('info', 'bootstrap', 'starting', { env: config.nodeEnv, port: config.wsPort });

  // Verify DB connection
  await query('SELECT 1');
  log('info', 'bootstrap', 'db_connected');

  // Run migrations
  await runMigrations();

  // Seed reference data (idempotent)
  await runSeeds();

  // Load zone maps into memory
  await loadAllZones();

  // Load city map data (nodes, edges, buildings, adjacency lists)
  await loadCityMaps();

  // Wire world-state handler with live registries
  setZonePlayersGetter((zoneId) =>
    getZonePlayers(zoneId).map((p) => ({
      characterId: p.characterId,
      name: p.name,
      classId: p.classId,
      level: p.level,
      posX: p.posX,
      posY: p.posY,
      currentNodeId: p.currentNodeId,
    })),
  );

  // Initialize boss instances
  await bossInstanceManager.initialize();
  setInterval(() => bossInstanceManager.checkRespawns(), 30_000);

  // Initialize arena state from DB (recover participants after restart)
  await loadArenaState();

  // Start periodic rankings computation
  startRankingsService();

  // Register all message handlers
  registerHandler('auth.register', handleAuthRegister);
  registerHandler('auth.login', handleAuthLogin);
  registerHandler('character.create', handleCharacterCreate);
  registerHandler('player.move', handlePlayerMove);
  registerHandler('chat.send', handleChatSend);
  registerHandler('city.move', handleCityMove);
  registerHandler('city.building_action', handleBuildingAction);
  registerHandler('inventory.delete_item', handleInventoryDeleteItem);
  registerHandler('expedition.dispatch', handleExpeditionDispatch);
  registerHandler('expedition.collect', handleExpeditionCollect);
  registerHandler('equipment.equip', handleEquipmentEquip);
  registerHandler('equipment.unequip', handleEquipmentUnequip);
  registerHandler('combat:trigger_active', handleCombatTriggerActive);
  registerHandler('loadout:request', handleLoadoutRequest);
  registerHandler('loadout:update', handleLoadoutUpdate);
  registerCraftingHandlers();
  registerQuestHandlers();
  registerMarketplaceHandlers();
  registerHandler('gathering.start', handleGatheringStart);
  registerHandler('gathering.cancel', handleGatheringCancel);
  registerFishingHandlers();
  registerDisassemblyHandlers();
  registerHandler('rankings.get', handleRankingsGet);
  registerHandler('squire.roster', handleSquireRoster);
  registerHandler('squire.dismiss_list', handleSquireDismissList);
  registerHandler('squire.dismiss_confirm', handleSquireDismissConfirm);
  registerHandler('boss:challenge', handleBossChallenge);
  registerHandler('boss:combat_trigger_active', handleBossCombatTriggerActive);
  registerArenaHandlers();

  // Start WebSocket server (also sends world.state on connect)
  startWebSocketServer();

  void sendWorldState;

  log('info', 'bootstrap', 'complete');
}

bootstrap().catch((err: unknown) => {
  log('error', 'bootstrap', 'fatal_error', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
