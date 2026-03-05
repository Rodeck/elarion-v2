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

export interface ExploreActionDto {
  encounter_chance: number; // 0–100, informational only
}

export interface TravelBuildingActionDto {
  id: number;
  action_type: 'travel';
  label: string;
  config: TravelActionDto;
}

export interface ExploreBuildingActionDto {
  id: number;
  action_type: 'explore';
  label: string;
  config: ExploreActionDto;
}

export type BuildingActionDto = TravelBuildingActionDto | ExploreBuildingActionDto;

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

export interface CombatRoundRecord {
  round: number;
  player_attack: number;    // damage dealt by player to monster
  monster_attack: number;   // damage dealt by monster to player (0 if monster died first)
  player_hp_after: number;
  monster_hp_after: number;
}

export interface ItemDroppedDto {
  item_def_id: number;
  name: string;
  quantity: number;
  icon_url: string | null;
}

export interface BuildingExploreResultPayload {
  action_id: number;
  outcome: 'no_encounter' | 'combat';

  // Only present when outcome === 'combat':
  monster?: {
    id: number;
    name: string;
    icon_url: string | null;
    max_hp: number;
    attack: number;
    defense: number;
  };
  rounds?: CombatRoundRecord[];
  combat_result?: 'win' | 'loss';
  xp_gained?: number;               // only when combat_result === 'win'
  items_dropped?: ItemDroppedDto[]; // only when combat_result === 'win', may be empty
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
  action_type: 'travel' | 'explore';
}

// ---------------------------------------------------------------------------
// Client → Server message types
// ---------------------------------------------------------------------------

export type AuthRegisterMessage      = WsMessage<AuthRegisterPayload>;
export type AuthLoginMessage         = WsMessage<AuthLoginPayload>;
export type CharacterCreateMessage   = WsMessage<CharacterCreatePayload>;
export type PlayerMoveMessage        = WsMessage<PlayerMovePayload>;
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

export interface CharacterLevelledUpPayload {
  new_level: number;
  new_max_hp: number;
  new_attack_power: number;
  new_defence: number;
  new_experience: number;
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
    | 'NOT_CITY_MAP'
    | 'EXPLORE_FAILED';
}

export interface ServerRateLimitedPayload {
  action: 'player.move' | 'chat.send' | 'city.move';
  retry_after_ms: number;
}

export interface ServerErrorPayload {
  code:
    | 'PROTOCOL_VERSION'
    | 'NOT_AUTHENTICATED'
    | 'CHARACTER_EXISTS'
    | 'CHARACTER_REQUIRED'
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
export type CharacterLevelledUpMessage = WsMessage<CharacterLevelledUpPayload>;
export type ChatMessageMessage         = WsMessage<ChatMessagePayload>;
export type ServerRateLimitedMessage   = WsMessage<ServerRateLimitedPayload>;
export type ServerErrorMessage         = WsMessage<ServerErrorPayload>;
export type CityPlayerMovedMessage              = WsMessage<CityPlayerMovedPayload>;
export type CityBuildingArrivedMessage          = WsMessage<CityBuildingArrivedPayload>;
export type CityMoveRejectedMessage             = WsMessage<CityMoveRejectedPayload>;
export type CityBuildingActionRejectedMessage   = WsMessage<CityBuildingActionRejectedPayload>;
export type BuildingExploreResultMessage        = WsMessage<BuildingExploreResultPayload>;

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
  | CharacterLevelledUpMessage
  | ChatMessageMessage
  | ServerRateLimitedMessage
  | ServerErrorMessage
  | CityPlayerMovedMessage
  | CityBuildingArrivedMessage
  | CityMoveRejectedMessage
  | CityBuildingActionRejectedMessage
  | BuildingExploreResultMessage
  | InventoryStateMessage
  | InventoryItemReceivedMessage
  | InventoryFullMessage
  | InventoryItemDeletedMessage
  | InventoryDeleteRejectedMessage;

export type AnyClientMessage =
  | AuthRegisterMessage
  | AuthLoginMessage
  | CharacterCreateMessage
  | PlayerMoveMessage
  | ChatSendMessage
  | CityMoveMessage
  | CityBuildingActionMessage
  | InventoryDeleteItemMessage;

// ---------------------------------------------------------------------------
// Inventory: shared sub-types
// ---------------------------------------------------------------------------

export type ItemCategory =
  | 'resource' | 'food' | 'heal' | 'weapon'
  | 'boots' | 'shield' | 'greaves' | 'bracer' | 'tool';

export type WeaponSubtype =
  | 'one_handed' | 'two_handed' | 'dagger' | 'wand' | 'staff' | 'bow';

/** A single resolved item definition as sent to the client. */
export interface ItemDefinitionDto {
  id: number;
  name: string;
  description: string;         // empty string if null in DB
  category: ItemCategory;
  weapon_subtype: WeaponSubtype | null;  // non-null only for 'weapon'
  attack: number | null;
  defence: number | null;
  heal_power: number | null;
  food_power: number | null;
  stack_size: number | null;   // null = not stackable
  icon_url: string | null;     // absolute URL or null (use placeholder)
}

/** A single occupied inventory slot as sent to the client. */
export interface InventorySlotDto {
  slot_id: number;             // inventory_items.id — used for deletion
  item_def_id: number;
  quantity: number;
  definition: ItemDefinitionDto;
}

// ---------------------------------------------------------------------------
// Inventory: Client → Server payloads
// ---------------------------------------------------------------------------

export interface InventoryDeleteItemPayload {
  slot_id: number;             // inventory_items.id to delete
}

// ---------------------------------------------------------------------------
// Inventory: Server → Client payloads
// ---------------------------------------------------------------------------

export interface InventoryStatePayload {
  slots: InventorySlotDto[];   // ordered by created_at ASC; max 20 entries
  capacity: number;            // always 20 for now
}

export interface InventoryItemReceivedPayload {
  slot: InventorySlotDto;      // full slot (new or updated)
  stacked: boolean;            // true if quantity was incremented on existing slot
}

export interface InventoryFullPayload {
  item_name: string;           // name of the item that couldn't be added
}

export interface InventoryItemDeletedPayload {
  slot_id: number;             // the slot that was removed
}

export interface InventoryDeleteRejectedPayload {
  slot_id: number;
  reason: 'NOT_FOUND' | 'NOT_OWNER';
}

// ---------------------------------------------------------------------------
// Inventory: message type aliases
// ---------------------------------------------------------------------------

export type InventoryDeleteItemMessage     = WsMessage<InventoryDeleteItemPayload>;
export type InventoryStateMessage          = WsMessage<InventoryStatePayload>;
export type InventoryItemReceivedMessage   = WsMessage<InventoryItemReceivedPayload>;
export type InventoryFullMessage           = WsMessage<InventoryFullPayload>;
export type InventoryItemDeletedMessage    = WsMessage<InventoryItemDeletedPayload>;
export type InventoryDeleteRejectedMessage = WsMessage<InventoryDeleteRejectedPayload>;
