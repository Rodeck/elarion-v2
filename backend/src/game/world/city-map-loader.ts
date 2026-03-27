import {
  CityMapData,
  CityMapNode,
  CityMapEdge,
  CityMapBuilding,
  BuildingActionDto,
  type ExpeditionBuildingActionDto,
  type GatherBuildingActionDto,
} from '@elarion/protocol';
import {
  getMapsByType,
  getMapById,
  getNodesForZone,
  getEdgesForZone,
  getBuildingsForZone,
  getBuildingActionsForZone,
  getSpawnNodeForZone,
  type MapZoneWithCounts,
  type PathNode,
  type PathEdge,
  type Building,
  type BuildingAction,
  type TravelActionConfig,
  type ExploreActionConfig,
} from '../../db/queries/city-maps';
import { getNpcsForZone, type ZoneNpcRow } from '../../db/queries/npcs';
import { config } from '../../config';
import { log } from '../../logger';

// ─── Cache ──────────────────────────────────────────────────────────────────

export interface CityMapCache {
  mapData: CityMapData;
  adjacencyList: Map<number, number[]>;
  imageFilename: string | null;
  imageWidth: number;
  imageHeight: number;
}

const cache = new Map<number, CityMapCache>();

// ─── Transform helpers ──────────────────────────────────────────────────────

function toProtocolNode(node: PathNode): CityMapNode {
  return { id: node.id, x: node.x, y: node.y };
}

function toProtocolEdge(edge: PathEdge): CityMapEdge {
  return { from_node_id: edge.from_node_id, to_node_id: edge.to_node_id };
}

function toProtocolBuilding(
  b: Building,
  actions: BuildingAction[],
  zoneNameMap: Map<number, string>,
  npcsByBuilding: Map<number, ZoneNpcRow[]>,
): CityMapBuilding {
  const protocolActions: BuildingActionDto[] = actions
    .filter((a) => a.building_id === b.id)
    .map((a): BuildingActionDto => {
      if (a.action_type === 'explore') {
        const cfg = a.config as ExploreActionConfig;
        return {
          id: a.id,
          action_type: 'explore',
          label: 'Explore',
          config: { encounter_chance: cfg.encounter_chance },
        };
      }
      if ((a.action_type as string) === 'expedition') {
        const expCfg = a.config as unknown as { name?: string };
        const dto: ExpeditionBuildingActionDto = {
          id: a.id,
          action_type: 'expedition',
          label: expCfg.name || 'Expedition',
        };
        return dto;
      }
      if (a.action_type === 'gather') {
        const cfg = a.config as Record<string, unknown>;
        const dto: GatherBuildingActionDto = {
          id: a.id,
          action_type: 'gather',
          label: `Gather (${cfg['required_tool_type']})`,
          config: {
            required_tool_type: String(cfg['required_tool_type'] ?? ''),
            durability_per_second: Number(cfg['durability_per_second'] ?? 0),
            min_seconds: Number(cfg['min_seconds'] ?? 0),
            max_seconds: Number(cfg['max_seconds'] ?? 0),
          },
        };
        return dto;
      }
      if ((a.action_type as string) === 'marketplace') {
        const cfg = a.config as Record<string, unknown>;
        return {
          id: a.id,
          action_type: 'marketplace',
          label: 'Browse Marketplace',
          config: {
            listing_fee: Number(cfg['listing_fee'] ?? 10),
            max_listings: Number(cfg['max_listings'] ?? 10),
            listing_duration_days: Number(cfg['listing_duration_days'] ?? 5),
          },
        } as unknown as BuildingActionDto;
      }
      if ((a.action_type as string) === 'fishing') {
        const cfg = a.config as Record<string, unknown>;
        return {
          id: a.id,
          action_type: 'fishing',
          label: 'Fish',
          config: {
            min_rod_tier: cfg['min_rod_tier'] ?? undefined,
          },
        } as unknown as BuildingActionDto;
      }
      // travel
      const cfg = a.config as TravelActionConfig;
      const targetZoneName = zoneNameMap.get(cfg.target_zone_id) ?? `Zone ${cfg.target_zone_id}`;
      return {
        id: a.id,
        action_type: 'travel',
        label: `Travel to ${targetZoneName}`,
        config: {
          target_zone_id: cfg.target_zone_id,
          target_zone_name: targetZoneName,
          target_node_id: cfg.target_node_id,
        },
      };
    });

  const buildingNpcs = (npcsByBuilding.get(b.id) ?? []).map((n) => ({
    id: n.npc_id,
    name: n.npc_name,
    description: n.npc_description,
    icon_url: `${config.adminBaseUrl}/npc-icons/${n.icon_filename}`,
    is_crafter: n.is_crafter ?? false,
    is_quest_giver: n.is_quest_giver ?? false,
    is_squire_dismisser: n.is_squire_dismisser ?? false,
    is_disassembler: n.is_disassembler ?? false,
  }));

  const result: CityMapBuilding = {
    id: b.id,
    name: b.name,
    description: b.description ?? '',
    node_id: b.node_id,
    label_x: b.label_offset_x ?? 0,
    label_y: b.label_offset_y ?? 0,
    actions: protocolActions,
    npcs: buildingNpcs,
  };

  if (b.hotspot_type === 'rect' || b.hotspot_type === 'circle') {
    result.hotspot = {
      type: b.hotspot_type,
      x: b.hotspot_x ?? 0,
      y: b.hotspot_y ?? 0,
      ...(b.hotspot_type === 'rect'
        ? { w: b.hotspot_w ?? 0, h: b.hotspot_h ?? 0 }
        : { r: b.hotspot_r ?? 0 }),
    };
  }

  return result;
}

function buildAdjacencyList(edges: PathEdge[]): Map<number, number[]> {
  const adj = new Map<number, number[]>();

  for (const edge of edges) {
    // from → to
    let fromList = adj.get(edge.from_node_id);
    if (!fromList) {
      fromList = [];
      adj.set(edge.from_node_id, fromList);
    }
    fromList.push(edge.to_node_id);

    // to → from (bidirectional)
    let toList = adj.get(edge.to_node_id);
    if (!toList) {
      toList = [];
      adj.set(edge.to_node_id, toList);
    }
    toList.push(edge.from_node_id);
  }

  return adj;
}

// ─── Single-zone loader ─────────────────────────────────────────────────────

async function loadSingleZone(zone: MapZoneWithCounts): Promise<void> {
  const [nodes, edges, buildings, buildingActions, spawnNode, zoneNpcs] = await Promise.all([
    getNodesForZone(zone.id),
    getEdgesForZone(zone.id),
    getBuildingsForZone(zone.id),
    getBuildingActionsForZone(zone.id),
    getSpawnNodeForZone(zone.id),
    getNpcsForZone(zone.id),
  ]);

  const npcsByBuilding = new Map<number, ZoneNpcRow[]>();
  for (const row of zoneNpcs) {
    let list = npcsByBuilding.get(row.building_id);
    if (!list) { list = []; npcsByBuilding.set(row.building_id, list); }
    list.push(row);
  }

  // Resolve target zone names for travel action labels
  const targetZoneIds = [
    ...new Set(
      buildingActions
        .filter((a) => a.action_type === 'travel')
        .map((a) => (a.config as TravelActionConfig).target_zone_id),
    ),
  ];
  const zoneNameMap = new Map<number, string>();
  await Promise.all(
    targetZoneIds.map(async (zid) => {
      const z = await getMapById(zid);
      if (z) zoneNameMap.set(zid, z.name);
    }),
  );

  const mapData: CityMapData = {
    image_url: zone.image_filename ? `/assets/maps/${zone.image_filename}` : '',
    image_width: zone.image_width_px ?? 0,
    image_height: zone.image_height_px ?? 0,
    nodes: nodes.map(toProtocolNode),
    edges: edges.map(toProtocolEdge),
    buildings: buildings.map((b) => toProtocolBuilding(b, buildingActions, zoneNameMap, npcsByBuilding)),
    spawn_node_id: spawnNode?.id ?? 0,
  };

  const adjacencyList = buildAdjacencyList(edges);

  cache.set(zone.id, {
    mapData,
    adjacencyList,
    imageFilename: zone.image_filename,
    imageWidth: zone.image_width_px ?? 0,
    imageHeight: zone.image_height_px ?? 0,
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function loadCityMaps(): Promise<void> {
  const zones = await getMapsByType('city');

  await Promise.all(zones.map((zone) => loadSingleZone(zone)));

  log('info', 'city-map-loader', 'city_maps_loaded', {
    count: zones.length,
    zone_ids: zones.map((z) => z.id),
  });
}

export function getCityMapData(zoneId: number): CityMapData | null {
  return cache.get(zoneId)?.mapData ?? null;
}

export function getCityMapCache(zoneId: number): CityMapCache | null {
  return cache.get(zoneId) ?? null;
}

export function getAdjacencyList(zoneId: number): Map<number, number[]> | null {
  return cache.get(zoneId)?.adjacencyList ?? null;
}

export async function reloadCityMap(zoneId: number): Promise<void> {
  const zones = await getMapsByType('city');
  const zone = zones.find((z) => z.id === zoneId);

  if (!zone) {
    log('warn', 'city-map-loader', 'reload_zone_not_found', { zone_id: zoneId });
    cache.delete(zoneId);
    return;
  }

  await loadSingleZone(zone);
  log('info', 'city-map-loader', 'city_map_reloaded', { zone_id: zoneId });
}
