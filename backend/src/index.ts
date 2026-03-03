import 'dotenv/config';
import { config } from './config';
import { log } from './logger';
import { query } from './db/connection';
import { runMigrations } from './db/migrate';
import { runSeeds } from './db/seeds/initial-data';
import { loadAllZones } from './game/world/zone-loader';
import { spawnAllMonsters } from './game/world/monster-spawner';
import { startWebSocketServer } from './websocket/server';
import { registerHandler } from './websocket/dispatcher';
import { handleAuthRegister } from './auth/register-handler';
import { handleAuthLogin } from './auth/login-handler';
import { handleCharacterCreate } from './game/world/character-create-handler';
import { handlePlayerMove } from './game/world/movement-handler';
import { handleCombatStart } from './game/combat/combat-controller';
import { handleChatSend } from './game/chat/chat-handler';
import { handleCityMove } from './game/world/city-movement-handler';
import { sendWorldState, setZonePlayersGetter, setZoneMonstersGetter } from './websocket/handlers/world-state-handler';
import { getZonePlayers } from './game/world/zone-registry';
import { getZoneMonsters } from './game/world/monster-registry';
import { loadCityMaps } from './game/world/city-map-loader';

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

  // Spawn monster instances
  await spawnAllMonsters();

  // Wire world-state handler with live registries
  setZonePlayersGetter((zoneId) =>
    getZonePlayers(zoneId).map((p) => ({
      characterId: p.characterId,
      name: p.name,
      classId: p.classId,
      level: p.level,
      posX: p.posX,
      posY: p.posY,
    })),
  );
  setZoneMonstersGetter((zoneId) =>
    getZoneMonsters(zoneId).map((m) => ({
      instance_id: m.instanceId,
      template_id: m.templateId,
      name: m.name,
      max_hp: m.maxHp,
      current_hp: m.currentHp,
      pos_x: m.posX,
      pos_y: m.posY,
      in_combat: m.inCombat,
    })),
  );

  // Register all message handlers
  registerHandler('auth.register', handleAuthRegister);
  registerHandler('auth.login', handleAuthLogin);
  registerHandler('character.create', handleCharacterCreate);
  registerHandler('player.move', handlePlayerMove);
  registerHandler('combat.start', handleCombatStart);
  registerHandler('chat.send', handleChatSend);
  registerHandler('city.move', handleCityMove);

  // Start WebSocket server (also sends world.state on connect)
  startWebSocketServer();

  // Wire world-state dispatch on connection
  // This is called from server.ts after upgrade — expose as callback
  // The server calls sendWorldState directly via the handler registered above
  void sendWorldState;

  log('info', 'bootstrap', 'complete');
}

bootstrap().catch((err: unknown) => {
  log('error', 'bootstrap', 'fatal_error', {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
