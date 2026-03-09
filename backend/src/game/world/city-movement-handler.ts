import { findPath } from './city-pathfinding';
import { getCityMapCache } from './city-map-loader';
import { broadcastToZone } from './zone-broadcasts';
import { movePlayerToNode } from './zone-registry';
import { findByAccountId, updateCharacter } from '../../db/queries/characters';
import { getBuildingActions } from '../../db/queries/city-maps';
import type { ExploreActionConfig } from '../../db/queries/city-maps';
import {
  getSquiresForCharacter,
  getActiveExpeditionForSquire,
} from '../../db/queries/squires';
import type { ExpeditionActionConfig } from '../../db/queries/squires';
import { buildExpeditionStateDto } from '../expedition/expedition-service';
import { rollNightEncounter } from './night-encounter-service';
import { query } from '../../db/connection';
import { log } from '../../logger';
import { sendToSession } from '../../websocket/server';
import type { AuthenticatedSession } from '../../websocket/server';
import type { CityMovePayload, CityMapBuilding, ExpeditionStateDto } from '@elarion/protocol';

// ---------------------------------------------------------------------------
// Movement cancellation — track active movement timers per character
// ---------------------------------------------------------------------------

interface ActiveMovement {
  timers: ReturnType<typeof setTimeout>[];
  cancelled: boolean;
}

const activeMovements = new Map<string, ActiveMovement>();

function cancelActiveMovement(characterId: string): void {
  const active = activeMovements.get(characterId);
  if (active) {
    active.cancelled = true;
    for (const timer of active.timers) {
      clearTimeout(timer);
    }
    activeMovements.delete(characterId);
    log('debug', 'city-movement', 'movement_cancelled', { characterId });
  }
}

// ---------------------------------------------------------------------------
// Rate limiting — max 5 city.move per second per player
// ---------------------------------------------------------------------------

interface RateWindow {
  count: number;
  windowStart: number;
}

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 1000;
const rateWindows = new Map<string, RateWindow>();

function checkCityMoveRateLimit(characterId: string): { allowed: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const existing = rateWindows.get(characterId);

  if (!existing || now - existing.windowStart >= RATE_WINDOW_MS) {
    rateWindows.set(characterId, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (existing.count < RATE_LIMIT) {
    existing.count++;
    return { allowed: true };
  }

  const retryAfterMs = RATE_WINDOW_MS - (now - existing.windowStart);
  return { allowed: false, retryAfterMs };
}

// ---------------------------------------------------------------------------
// Step delay between nodes (ms)
// ---------------------------------------------------------------------------

const STEP_DELAY_MS = 300;

// ---------------------------------------------------------------------------
// Expedition state lookup for building_arrived
// ---------------------------------------------------------------------------

async function getExpeditionStateForBuilding(
  characterId: string,
  building: CityMapBuilding,
): Promise<ExpeditionStateDto | undefined> {
  const expeditionActionDto = building.actions.find((a) => a.action_type === 'expedition');
  if (!expeditionActionDto) return undefined;

  const allActions = await getBuildingActions(building.id);
  const dbAction = allActions.find((a) => a.id === expeditionActionDto.id && (a.action_type as string) === 'expedition');
  if (!dbAction) return undefined;

  const squires = await getSquiresForCharacter(characterId);
  const squire = squires[0];
  if (!squire) return undefined;

  const expedition = await getActiveExpeditionForSquire(squire.id);
  return buildExpeditionStateDto(squire, dbAction.id, dbAction.config as unknown as ExpeditionActionConfig, expedition);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleCityMove(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { target_node_id } = payload as CityMovePayload;

  // ── Must have a character ──────────────────────────────────────────────
  if (!session.characterId) {
    sendToSession(session, 'server.error', {
      code: 'CHARACTER_REQUIRED',
      message: 'You need a character to move.',
    });
    log('warn', 'city-movement', 'no_character', { accountId: session.accountId });
    return;
  }

  const characterId = session.characterId;

  // ── Rate limit ─────────────────────────────────────────────────────────
  const rateCheck = checkCityMoveRateLimit(characterId);
  if (!rateCheck.allowed) {
    sendToSession(session, 'city.move_rejected', {
      current_node_id: 0,
      reason: 'RATE_LIMITED',
    });
    sendToSession(session, 'server.rate_limited', {
      action: 'city.move',
      retry_after_ms: rateCheck.retryAfterMs ?? 200,
    });
    log('debug', 'city-movement', 'rate_limited', { characterId });
    return;
  }

  // ── Fetch character from DB for authoritative state ────────────────────
  const character = await findByAccountId(session.accountId);
  if (!character) {
    sendToSession(session, 'server.error', { code: 'INTERNAL_ERROR', message: 'Character not found.' });
    log('warn', 'city-movement', 'character_not_found', { accountId: session.accountId });
    return;
  }

  // ── In-combat check ────────────────────────────────────────────────────
  if (character.in_combat) {
    sendToSession(session, 'city.move_rejected', {
      current_node_id: (character as unknown as { current_node_id: number | null }).current_node_id ?? 0,
      reason: 'IN_COMBAT',
    });
    log('debug', 'city-movement', 'rejected_in_combat', { characterId });
    return;
  }

  const zoneId = character.zone_id;

  // ── City-type map check ────────────────────────────────────────────────
  const cityCache = getCityMapCache(zoneId);
  if (!cityCache) {
    sendToSession(session, 'city.move_rejected', {
      current_node_id: 0,
      reason: 'NOT_CITY_MAP',
    });
    log('debug', 'city-movement', 'rejected_not_city_map', { characterId, zoneId });
    return;
  }

  // ── Current node check ─────────────────────────────────────────────────
  // The character's current_node_id comes from the DB column added by migration 008
  const currentNodeId = (character as unknown as { current_node_id: number | null }).current_node_id;
  if (currentNodeId == null) {
    sendToSession(session, 'city.move_rejected', {
      current_node_id: 0,
      reason: 'INVALID_NODE',
    });
    log('warn', 'city-movement', 'no_current_node', { characterId, zoneId });
    return;
  }

  // ── Target node existence check ────────────────────────────────────────
  const nodeExists = cityCache.mapData.nodes.some((n) => n.id === target_node_id);
  if (!nodeExists) {
    sendToSession(session, 'city.move_rejected', {
      current_node_id: currentNodeId,
      reason: 'INVALID_NODE',
    });
    log('debug', 'city-movement', 'rejected_invalid_target', {
      characterId,
      target_node_id,
      zoneId,
    });
    return;
  }

  // ── BFS pathfinding ────────────────────────────────────────────────────
  const path = findPath(cityCache.adjacencyList, currentNodeId, target_node_id);
  if (!path) {
    sendToSession(session, 'city.move_rejected', {
      current_node_id: currentNodeId,
      reason: 'NO_PATH',
    });
    log('debug', 'city-movement', 'rejected_no_path', {
      characterId,
      from_node: currentNodeId,
      to_node: target_node_id,
      zoneId,
    });
    return;
  }

  // ── Cancel any in-flight movement ──────────────────────────────────────
  cancelActiveMovement(characterId);

  log('info', 'city-movement', 'movement_started', {
    characterId,
    from_node: currentNodeId,
    to_node: target_node_id,
    path_length: path.length,
    zoneId,
  });

  // ── Build a node lookup for coordinate resolution ──────────────────────
  const nodeMap = new Map(cityCache.mapData.nodes.map((n) => [n.id, n]));

  // ── Build building lookup by node_id ───────────────────────────────────
  const buildingByNode = new Map(
    cityCache.mapData.buildings.map((b) => [b.node_id, b]),
  );

  // ── Schedule step-by-step movement ─────────────────────────────────────
  // path[0] is the current node; we walk from path[1] onward
  const movement: ActiveMovement = { timers: [], cancelled: false };
  activeMovements.set(characterId, movement);

  for (let i = 1; i < path.length; i++) {
    const stepNodeId = path[i]!;
    const delay = STEP_DELAY_MS * i;

    const timer = setTimeout(() => {
      // If movement was cancelled, do nothing
      if (movement.cancelled) return;

      const node = nodeMap.get(stepNodeId);
      if (!node) return;

      // Update character position in DB (fire-and-forget with error logging)
      updateCharacter(characterId, {
        pos_x: node.x,
        pos_y: node.y,
      }).catch((err: unknown) => {
        log('error', 'city-movement', 'db_persist_pos_failed', {
          characterId,
          node_id: stepNodeId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      // Persist current_node_id via raw query since it's not in the typed updateCharacter fields
      query(
        'UPDATE characters SET current_node_id = $1, updated_at = now() WHERE id = $2',
        [stepNodeId, characterId],
      ).catch((err: unknown) => {
        log('error', 'city-movement', 'db_persist_node_failed', {
          characterId,
          node_id: stepNodeId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      // Update in-memory registry so late-joining players see the correct position
      movePlayerToNode(characterId, stepNodeId, node.x, node.y);

      // Broadcast city.player_moved to all players in the zone
      broadcastToZone(zoneId, 'city.player_moved', {
        character_id: characterId,
        node_id: stepNodeId,
        x: node.x,
        y: node.y,
      });

      log('debug', 'city-movement', 'step', {
        characterId,
        node_id: stepNodeId,
        step: i,
        total_steps: path.length - 1,
      });

      // Night encounter roll — cancel remaining movement on encounter
      void rollNightEncounter(session, character, zoneId).then((encountered) => {
        if (encountered && !movement.cancelled) {
          cancelActiveMovement(characterId);
        }
      }).catch((err: unknown) => {
        log('error', 'city-movement', 'night_encounter_error', {
          characterId,
          error: err instanceof Error ? err.message : String(err),
        });
      });

      // If the arrived node has a building, notify the moving player only
      const building = buildingByNode.get(stepNodeId);
      if (building) {
        void (async () => {
          const expedition_state = await getExpeditionStateForBuilding(characterId, building).catch(() => undefined);
          sendToSession(session, 'city.building_arrived', {
            building_id: building.id,
            building_name: building.name,
            node_id: stepNodeId,
            ...(expedition_state !== undefined ? { expedition_state } : {}),
          });
          log('debug', 'city-movement', 'building_arrived', {
            characterId,
            node_id: stepNodeId,
            building_id: building.id,
            building_name: building.name,
          });
        })();
      }

      // If this is the last step, clean up the active movement
      if (i === path.length - 1) {
        activeMovements.delete(characterId);
        log('info', 'city-movement', 'movement_completed', {
          characterId,
          final_node: stepNodeId,
          zoneId,
        });
      }
    }, delay);

    movement.timers.push(timer);
  }

  // Edge case: path is just the current node (same-node move), clean up immediately
  if (path.length <= 1) {
    activeMovements.delete(characterId);
  }
}

// ---------------------------------------------------------------------------
// Cleanup on disconnect — export for use in disconnect handler
// ---------------------------------------------------------------------------

export function cancelCityMovement(characterId: string): void {
  cancelActiveMovement(characterId);
}
