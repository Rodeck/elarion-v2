// Elarion WebSocket Protocol v1
// Single source of truth for all message types shared between backend and frontend.

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface WsMessage<T> {
  type: string;
  v: 1;
  payload: T;
}

// ---------------------------------------------------------------------------
// Shared sub-types
// ---------------------------------------------------------------------------

export interface CharacterData {
  id: string;
  name: string;
  class_id: number;
  class_name: string;
  level: number;
  experience: number;
  max_hp: number;
  current_hp: number;
  attack_power: number;
  defence: number;
  zone_id: number;
  pos_x: number;
  pos_y: number;
  current_node_id: number | null;
}

export interface PlayerSummary {
  id: string;
  name: string;
  class_id: number;
  level: number;
  pos_x: number;
  pos_y: number;
  current_node_id?: number | null;
}

export interface MonsterInstance {
  instance_id: string;
  template_id: number;
  name: string;
  max_hp: number;
  current_hp: number;
  pos_x: number;
  pos_y: number;
  in_combat: boolean;
}

export interface ItemGained {
  item_id: number;
  name: string;
  type: string;
  quantity: number;
}

export interface CityMapNode {
  id: number;
  x: number;
  y: number;
}

export interface CityMapEdge {
  from_node_id: number;
  to_node_id: number;
}

export interface TravelActionDto {
  target_zone_id: number;
  target_zone_name: string;
  target_node_id: number;
}

export interface BuildingActionDto {
  id: number;
  action_type: 'travel';
  label: string;
  config: TravelActionDto;
}

export interface CityMapBuilding {
  id: number;
  name: string;
  description: string;
  node_id: number;
  label_x: number;
  label_y: number;
  actions: BuildingActionDto[];
  hotspot?: {
    type: 'rect' | 'circle';
    x: number;
    y: number;
    w?: number;
    h?: number;
    r?: number;
  };
}

export interface CityMapData {
  image_url: string;
  image_width: number;
  image_height: number;
  nodes: CityMapNode[];
  edges: CityMapEdge[];
  buildings: CityMapBuilding[];
  spawn_node_id: number;
}

// ---------------------------------------------------------------------------
// Client → Server payloads
// ---------------------------------------------------------------------------

export interface AuthRegisterPayload {
  username: string;
  password: string;
}

export interface AuthLoginPayload {
  username: string;
  password: string;
}

export interface CharacterCreatePayload {
  name: string;
  class_id: number;
}

export interface PlayerMovePayload {
  direction: 'n' | 's' | 'e' | 'w';
}

export interface CombatStartPayload {
  monster_instance_id: string;
}

export interface ChatSendPayload {
  channel: 'local' | 'global';
  message: string;
}

export interface CityMovePayload {
  target_node_id: number;
}

export interface CityBuildingActionPayload {
  building_id: number;
  action_id: number;
  action_type: 'travel';
}

// ---------------------------------------------------------------------------
// Client → Server message types
// ---------------------------------------------------------------------------

export type AuthRegisterMessage      = WsMessage<AuthRegisterPayload>;
export type AuthLoginMessage         = WsMessage<AuthLoginPayload>;
export type CharacterCreateMessage   = WsMessage<CharacterCreatePayload>;
export type PlayerMoveMessage        = WsMessage<PlayerMovePayload>;
export type CombatStartMessage       = WsMessage<CombatStartPayload>;
export type ChatSendMessage          = WsMessage<ChatSendPayload>;
export type CityMoveMessage          = WsMessage<CityMovePayload>;
export type CityBuildingActionMessage = WsMessage<CityBuildingActionPayload>;

// ---------------------------------------------------------------------------
// Server → Client payloads
// ---------------------------------------------------------------------------

export interface AuthSuccessPayload {
  token: string;
  has_character: boolean;
}

export interface AuthErrorPayload {
  code: 'USERNAME_TAKEN' | 'INVALID_CREDENTIALS' | 'USERNAME_INVALID' | 'PASSWORD_TOO_SHORT';
  message: string;
}

export interface AuthSessionInfoPayload {
  has_character: boolean;
}

export interface CharacterCreatedPayload {
  character: CharacterData;
}

export interface WorldStatePayload {
  zone_id: number;
  zone_name: string;
  my_character: CharacterData;
  players: PlayerSummary[];
  monsters: MonsterInstance[];
  map_type: 'tile' | 'city';
  city_map?: CityMapData;
}

export interface PlayerMovedPayload {
  character_id: string;
  pos_x: number;
  pos_y: number;
}

export interface PlayerMoveRejectedPayload {
  pos_x: number;
  pos_y: number;
  reason: 'BLOCKED_TILE' | 'ZONE_BOUNDARY' | 'IN_COMBAT' | 'RATE_LIMITED';
}

export interface PlayerEnteredZonePayload {
  character: PlayerSummary;
}

export interface PlayerLeftZonePayload {
  character_id: string;
}

export interface CombatStartedPayload {
  combat_id: string;
  monster: {
    instance_id: string;
    name: string;
    max_hp: number;
    current_hp: number;
    attack_power: number;
    defence: number;
  };
}

export interface CombatRoundPayload {
  combat_id: string;
  round_number: number;
  attacker: 'player' | 'monster';
  attacker_name: string;
  action: 'attack' | 'critical' | 'miss';
  damage: number;
  player_hp_after: number;
  monster_hp_after: number;
}

export interface CombatEndedPayload {
  combat_id: string;
  outcome: 'victory' | 'defeat';
  xp_gained: number;
  items_gained: ItemGained[];
}

export interface CharacterLevelledUpPayload {
  new_level: number;
  new_max_hp: number;
  new_attack_power: number;
  new_defence: number;
  new_experience: number;
}

export interface MonsterSpawnedPayload {
  instance_id: string;
  template_id: number;
  name: string;
  max_hp: number;
  pos_x: number;
  pos_y: number;
}

export interface MonsterDespawnedPayload {
  instance_id: string;
}

export interface ChatMessagePayload {
  channel: 'local' | 'global';
  sender_name: string;
  message: string;
  timestamp: string;
}

export interface CityPlayerMovedPayload {
  character_id: string;
  node_id: number;
  x: number;
  y: number;
}

export interface CityBuildingArrivedPayload {
  building_id: number;
  building_name: string;
  node_id: number;
}

export interface CityMoveRejectedPayload {
  current_node_id: number;
  reason: 'NO_PATH' | 'INVALID_NODE' | 'IN_COMBAT' | 'NOT_CITY_MAP' | 'RATE_LIMITED';
}

export interface CityBuildingActionRejectedPayload {
  reason:
    | 'NOT_AT_BUILDING'
    | 'INVALID_ACTION'
    | 'INVALID_DESTINATION'
    | 'IN_COMBAT'
    | 'NOT_CITY_MAP';
}

export interface ServerRateLimitedPayload {
  action: 'player.move' | 'chat.send' | 'combat.start' | 'city.move';
  retry_after_ms: number;
}

export interface ServerErrorPayload {
  code:
    | 'PROTOCOL_VERSION'
    | 'NOT_AUTHENTICATED'
    | 'CHARACTER_EXISTS'
    | 'CHARACTER_REQUIRED'
    | 'MONSTER_NOT_FOUND'
    | 'MONSTER_NOT_ADJACENT'
    | 'ALREADY_IN_COMBAT'
    | 'DUPLICATE_COMBAT'
    | 'INTERNAL_ERROR';
  message: string;
}

// ---------------------------------------------------------------------------
// Server → Client message types
// ---------------------------------------------------------------------------

export type AuthSuccessMessage         = WsMessage<AuthSuccessPayload>;
export type AuthErrorMessage           = WsMessage<AuthErrorPayload>;
export type AuthSessionInfoMessage     = WsMessage<AuthSessionInfoPayload>;
export type CharacterCreatedMessage    = WsMessage<CharacterCreatedPayload>;
export type WorldStateMessage          = WsMessage<WorldStatePayload>;
export type PlayerMovedMessage         = WsMessage<PlayerMovedPayload>;
export type PlayerMoveRejectedMessage  = WsMessage<PlayerMoveRejectedPayload>;
export type PlayerEnteredZoneMessage   = WsMessage<PlayerEnteredZonePayload>;
export type PlayerLeftZoneMessage      = WsMessage<PlayerLeftZonePayload>;
export type CombatStartedMessage       = WsMessage<CombatStartedPayload>;
export type CombatRoundMessage         = WsMessage<CombatRoundPayload>;
export type CombatEndedMessage         = WsMessage<CombatEndedPayload>;
export type CharacterLevelledUpMessage = WsMessage<CharacterLevelledUpPayload>;
export type MonsterSpawnedMessage      = WsMessage<MonsterSpawnedPayload>;
export type MonsterDespawnedMessage    = WsMessage<MonsterDespawnedPayload>;
export type ChatMessageMessage         = WsMessage<ChatMessagePayload>;
export type ServerRateLimitedMessage   = WsMessage<ServerRateLimitedPayload>;
export type ServerErrorMessage         = WsMessage<ServerErrorPayload>;
export type CityPlayerMovedMessage              = WsMessage<CityPlayerMovedPayload>;
export type CityBuildingArrivedMessage          = WsMessage<CityBuildingArrivedPayload>;
export type CityMoveRejectedMessage             = WsMessage<CityMoveRejectedPayload>;
export type CityBuildingActionRejectedMessage   = WsMessage<CityBuildingActionRejectedPayload>;

// ---------------------------------------------------------------------------
// Discriminated union helpers (useful for switch-based dispatch)
// ---------------------------------------------------------------------------

export type AnyServerMessage =
  | AuthSuccessMessage
  | AuthErrorMessage
  | AuthSessionInfoMessage
  | CharacterCreatedMessage
  | WorldStateMessage
  | PlayerMovedMessage
  | PlayerMoveRejectedMessage
  | PlayerEnteredZoneMessage
  | PlayerLeftZoneMessage
  | CombatStartedMessage
  | CombatRoundMessage
  | CombatEndedMessage
  | CharacterLevelledUpMessage
  | MonsterSpawnedMessage
  | MonsterDespawnedMessage
  | ChatMessageMessage
  | ServerRateLimitedMessage
  | ServerErrorMessage
  | CityPlayerMovedMessage
  | CityBuildingArrivedMessage
  | CityMoveRejectedMessage
  | CityBuildingActionRejectedMessage;

export type AnyClientMessage =
  | AuthRegisterMessage
  | AuthLoginMessage
  | CharacterCreateMessage
  | PlayerMoveMessage
  | CombatStartMessage
  | ChatSendMessage
  | CityMoveMessage
  | CityBuildingActionMessage;
