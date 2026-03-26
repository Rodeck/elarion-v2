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
  crowns: number;
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

export interface ExpeditionBuildingActionDto {
  id: number;
  action_type: 'expedition';
  label: string;
}

export interface GatherBuildingActionDto {
  id: number;
  action_type: 'gather';
  label: string;
  config: {
    required_tool_type: string;
    durability_per_second: number;
    min_seconds: number;
    max_seconds: number;
  };
}

export interface MarketplaceBuildingActionDto {
  id: number;
  action_type: 'marketplace';
  label: string;
  config: MarketplaceActionConfig;
}

export interface MarketplaceActionConfig {
  listing_fee: number;
  max_listings: number;
  listing_duration_days: number;
}

export type BuildingActionDto = TravelBuildingActionDto | ExploreBuildingActionDto | ExpeditionBuildingActionDto | GatherBuildingActionDto | MarketplaceBuildingActionDto;

// ---------------------------------------------------------------------------
// Expedition sub-types
// ---------------------------------------------------------------------------

export type SquireStatus = 'idle' | 'exploring' | 'ready';

export interface ExpeditionDurationOption {
  duration_hours: 1 | 3 | 6;
  est_gold: number;
  est_exp: number;
  items: { name: string; quantity: number }[];
}

export interface CollectableRewards {
  gold: number;
  exp: number;
  items: { name: string; quantity: number }[];
}

export interface ExpeditionStateDto {
  action_id: number;
  squire_name: string;
  squire_status: SquireStatus;
  expedition_id?: number;
  started_at?: string;             // ISO 8601 — present when exploring
  completes_at?: string;           // ISO 8601 — present when exploring
  collectable_rewards?: CollectableRewards; // present when ready
  duration_options?: ExpeditionDurationOption[]; // present when idle
  available_squires?: CharacterSquireDto[];     // present when no active expedition
  active_squire?: CharacterSquireDto;           // present when expedition in progress
}

export interface NpcDto {
  id: number;
  name: string;
  description: string;
  icon_url: string;
  is_crafter: boolean;
  is_quest_giver: boolean;
  is_squire_dismisser: boolean;
}

export interface CityMapBuilding {
  id: number;
  name: string;
  description: string;
  node_id: number;
  label_x: number;
  label_y: number;
  actions: BuildingActionDto[];
  npcs: NpcDto[];
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
  outcome: 'no_encounter' | 'combat' | 'combat_started';

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
  crowns_gained?: number;           // only when combat_result === 'win' and amount > 0
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
  action_type: 'travel' | 'explore' | 'gather' | 'marketplace';
}

// ---------------------------------------------------------------------------
// Gathering: Client → Server payloads
// ---------------------------------------------------------------------------

export interface GatheringStartPayload {
  building_id: number;
  action_id: number;
  duration: number;        // seconds, must be within [min_seconds, max_seconds]
}

export interface GatheringCancelPayload {}

export interface ExpeditionDispatchPayload {
  building_id: number;
  action_id: number;
  duration_hours: 1 | 3 | 6;
  squire_id: number;
}

export interface ExpeditionCollectPayload {
  expedition_id: number;
}

// ---------------------------------------------------------------------------
// Client → Server message types
// ---------------------------------------------------------------------------

export type AuthRegisterMessage        = WsMessage<AuthRegisterPayload>;
export type AuthLoginMessage           = WsMessage<AuthLoginPayload>;
export type CharacterCreateMessage     = WsMessage<CharacterCreatePayload>;
export type PlayerMoveMessage          = WsMessage<PlayerMovePayload>;
export type ChatSendMessage            = WsMessage<ChatSendPayload>;
export type CityMoveMessage            = WsMessage<CityMovePayload>;
export type CityBuildingActionMessage  = WsMessage<CityBuildingActionPayload>;
export type ExpeditionDispatchMessage  = WsMessage<ExpeditionDispatchPayload>;
export type ExpeditionCollectMessage   = WsMessage<ExpeditionCollectPayload>;
export type GatheringStartMessage      = WsMessage<GatheringStartPayload>;
export type GatheringCancelMessage     = WsMessage<GatheringCancelPayload>;

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

// ---------------------------------------------------------------------------
// Day/Night Cycle: shared sub-type
// ---------------------------------------------------------------------------

export interface DayNightStateDto {
  phase: 'day' | 'night';
  phase_started_at: number;   // Unix ms — when this phase began (server clock)
  day_duration_ms: number;    // 2_700_000 (45 min)
  night_duration_ms: number;  // 900_000  (15 min)
}

export interface WorldStatePayload {
  zone_id: number;
  zone_name: string;
  my_character: CharacterData;
  players: PlayerSummary[];
  map_type: 'tile' | 'city';
  city_map?: CityMapData;
  day_night_state: DayNightStateDto;
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
  expedition_state?: ExpeditionStateDto;
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
    | 'IN_GATHERING'
    | 'HP_ZERO'
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
  | InventoryDeleteRejectedMessage
  | ExpeditionDispatchedMessage
  | ExpeditionDispatchRejectedMessage
  | ExpeditionCompletedMessage
  | ExpeditionCollectResultMessage
  | ExpeditionCollectRejectedMessage
  | EquipmentStateMessage
  | EquipmentChangedMessage
  | EquipmentEquipRejectedMessage
  | EquipmentUnequipRejectedMessage
  | WorldDayNightChangedMessage
  | NightEncounterResultMessage
  | AdminCommandResultMessage
  | CharacterCrownsChangedMessage
  | CombatStartMessage
  | CombatTurnResultMessage
  | CombatActiveWindowMessage
  | CombatEndMessage
  | LoadoutStateMessage
  | LoadoutUpdatedMessage
  | LoadoutUpdateRejectedMessage
  | CraftingStateMessage
  | CraftingStartedMessage
  | CraftingCancelledMessage
  | CraftingCollectedMessage
  | CraftingRejectedMessage
  | CraftingSessionsUpdatedMessage
  | GatheringStartedMessage
  | GatheringTickMessage
  | GatheringCombatPauseMessage
  | GatheringCombatResumeMessage
  | GatheringEndedMessage
  | GatheringRejectedMessage
  | SquireRosterUpdateMessage
  | SquireAcquiredMessage
  | SquireAcquisitionFailedMessage
  | SquireDismissListResultMessage
  | SquireDismissedMessage
  | SquireDismissRejectedMessage
  | MarketplaceBrowseResultMessage
  | MarketplaceItemListingsResultMessage
  | MarketplaceBuyResultMessage
  | MarketplaceListItemResultMessage
  | MarketplaceCancelResultMessage
  | MarketplaceMyListingsResultMessage
  | MarketplaceCollectCrownsResultMessage
  | MarketplaceCollectItemsResultMessage
  | MarketplaceRejectedMessage;

export type AnyClientMessage =
  | AuthRegisterMessage
  | AuthLoginMessage
  | CharacterCreateMessage
  | PlayerMoveMessage
  | ChatSendMessage
  | CityMoveMessage
  | CityBuildingActionMessage
  | InventoryDeleteItemMessage
  | ExpeditionDispatchMessage
  | ExpeditionCollectMessage
  | EquipmentEquipMessage
  | EquipmentUnequipMessage
  | CombatTriggerActiveMessage
  | LoadoutUpdateMessage
  | LoadoutRequestMessage
  | CraftingOpenMessage
  | CraftingStartMessage
  | CraftingCancelMessage
  | CraftingCollectMessage
  | GatheringStartMessage
  | GatheringCancelMessage
  | SquireDismissListMessage
  | SquireDismissConfirmMessage
  | MarketplaceBrowseMessage
  | MarketplaceItemListingsMessage
  | MarketplaceBuyMessage
  | MarketplaceListItemMessage
  | MarketplaceCancelListingMessage
  | MarketplaceMyListingsMessage
  | MarketplaceCollectCrownsMessage
  | MarketplaceCollectItemsMessage;

// ---------------------------------------------------------------------------
// Inventory: shared sub-types
// ---------------------------------------------------------------------------

export type ItemCategory =
  | 'resource' | 'food' | 'heal' | 'weapon'
  | 'boots' | 'shield' | 'greaves' | 'bracer' | 'tool'
  | 'helmet' | 'chestplate';

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
  // Mana / combat stats (default 0, non-zero only on magic items)
  max_mana: number;
  mana_on_hit: number;
  mana_on_damage_taken: number;
  mana_regen: number;
  dodge_chance: number;
  crit_chance: number;
  crit_damage: number;
  // Tool-specific (null for non-tools)
  tool_type: string | null;
  max_durability: number | null;
  power: number | null;
}

/** A single occupied inventory slot as sent to the client. */
export interface InventorySlotDto {
  slot_id: number;             // inventory_items.id — used for deletion
  item_def_id: number;
  quantity: number;
  current_durability?: number | null;  // present for tool items
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
// Expedition: Server → Client payloads
// ---------------------------------------------------------------------------

export interface ExpeditionDispatchedPayload {
  expedition_id: number;
  squire_name: string;
  building_name: string;
  duration_hours: 1 | 3 | 6;
  completes_at: string; // ISO 8601
}

export interface ExpeditionDispatchRejectedPayload {
  reason:
    | 'NO_SQUIRE_AVAILABLE'
    | 'INVALID_DURATION'
    | 'NOT_AT_BUILDING'
    | 'NO_EXPEDITION_CONFIG'
    | 'IN_COMBAT'
    | 'NOT_CITY_MAP'
    | 'SQUIRE_NOT_IDLE'
    | 'SQUIRE_NOT_FOUND';
}

export interface ExpeditionCompletedPayload {
  expedition_id: number;
  squire_name: string;
  building_name: string;
}

export interface ExpeditionCollectResultPayload {
  squire_name: string;
  rewards: {
    gold: number;
    exp: number;
    items: { item_def_id: number; name: string; quantity: number }[];
  };
  items_skipped: boolean;
}

export interface ExpeditionCollectRejectedPayload {
  expedition_id: number;
  reason: 'NOT_FOUND' | 'NOT_OWNER' | 'NOT_COMPLETE' | 'ALREADY_COLLECTED';
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

// ---------------------------------------------------------------------------
// Expedition: message type aliases
// ---------------------------------------------------------------------------

export type ExpeditionDispatchedMessage        = WsMessage<ExpeditionDispatchedPayload>;
export type ExpeditionDispatchRejectedMessage  = WsMessage<ExpeditionDispatchRejectedPayload>;
export type ExpeditionCompletedMessage         = WsMessage<ExpeditionCompletedPayload>;
export type ExpeditionCollectResultMessage     = WsMessage<ExpeditionCollectResultPayload>;
export type ExpeditionCollectRejectedMessage   = WsMessage<ExpeditionCollectRejectedPayload>;

// ---------------------------------------------------------------------------
// Equipment: shared sub-types
// ---------------------------------------------------------------------------

export type EquipSlot =
  | 'helmet'
  | 'chestplate'
  | 'left_arm'
  | 'right_arm'
  | 'greaves'
  | 'bracer'
  | 'boots';

export interface EquipmentSlotsDto {
  helmet:     InventorySlotDto | null;
  chestplate: InventorySlotDto | null;
  left_arm:   InventorySlotDto | null;
  right_arm:  InventorySlotDto | null;
  greaves:    InventorySlotDto | null;
  bracer:     InventorySlotDto | null;
  boots:      InventorySlotDto | null;
}

// Equipment: Client → Server payloads
export interface EquipmentEquipPayload {
  slot_id:   number;
  slot_name: EquipSlot;
}

export interface EquipmentUnequipPayload {
  slot_name: EquipSlot;
}

// Equipment: Server → Client payloads
export interface EquipmentStatePayload {
  slots: EquipmentSlotsDto;
}

export interface EquipmentChangedPayload {
  slots:             EquipmentSlotsDto;
  effective_attack:  number;
  effective_defence: number;
  inventory_added:   InventorySlotDto[];
  inventory_removed: number[];
}

export type EquipRejectReason =
  | 'ITEM_NOT_FOUND'
  | 'WRONG_SLOT_TYPE'
  | 'TWO_HANDED_BLOCKS'
  | 'INVENTORY_FULL'
  | 'NOT_AUTHENTICATED';

export interface EquipmentEquipRejectedPayload {
  slot_id:   number;
  slot_name: EquipSlot;
  reason:    EquipRejectReason;
}

export type UnequipRejectReason =
  | 'SLOT_EMPTY'
  | 'INVENTORY_FULL'
  | 'NOT_AUTHENTICATED';

export interface EquipmentUnequipRejectedPayload {
  slot_name: EquipSlot;
  reason:    UnequipRejectReason;
}

// Equipment: message type aliases
export type EquipmentEquipMessage           = WsMessage<EquipmentEquipPayload>;
export type EquipmentUnequipMessage         = WsMessage<EquipmentUnequipPayload>;
export type EquipmentStateMessage           = WsMessage<EquipmentStatePayload>;
export type EquipmentChangedMessage         = WsMessage<EquipmentChangedPayload>;
export type EquipmentEquipRejectedMessage   = WsMessage<EquipmentEquipRejectedPayload>;
export type EquipmentUnequipRejectedMessage = WsMessage<EquipmentUnequipRejectedPayload>;

// ---------------------------------------------------------------------------
// Day/Night Cycle: Server → Client payloads
// ---------------------------------------------------------------------------

/** Broadcast to all clients on phase transition (and same shape used in world.state). */
export type WorldDayNightChangedPayload = DayNightStateDto;

/** Result of a random night travel encounter (city node step or tile move). */
export interface NightEncounterResultPayload {
  outcome: 'combat';  // only sent when combat actually triggered

  monster: {
    id: number;
    name: string;
    icon_url: string | null;
    max_hp: number;    // includes 1.1× night bonus
    attack: number;    // includes 1.1× night bonus
    defense: number;   // includes 1.1× night bonus
  };
  rounds: CombatRoundRecord[];
  combat_result: 'win' | 'loss';
  xp_gained?: number;               // only when combat_result === 'win'
  items_dropped?: ItemDroppedDto[]; // only when combat_result === 'win', may be empty
  crowns_gained?: number;           // only when combat_result === 'win' and amount > 0
}

// ---------------------------------------------------------------------------
// Admin Commands: Server → Client payloads
// ---------------------------------------------------------------------------

export interface AdminCommandResultPayload {
  success: boolean;
  message: string;
}

export type AdminCommandResultMessage = WsMessage<AdminCommandResultPayload>;

// ---------------------------------------------------------------------------
// Currency: Server → Client payloads
// ---------------------------------------------------------------------------

/** Sent to a player when their Crown balance changes via an admin command. */
export interface CharacterCrownsChangedPayload {
  crowns: number;
}

export type CharacterCrownsChangedMessage = WsMessage<CharacterCrownsChangedPayload>;

// ---------------------------------------------------------------------------
// Day/Night Cycle: message type aliases
// ---------------------------------------------------------------------------

export type WorldDayNightChangedMessage = WsMessage<WorldDayNightChangedPayload>;
export type NightEncounterResultMessage = WsMessage<NightEncounterResultPayload>;

// ---------------------------------------------------------------------------
// Combat System: shared sub-types
// ---------------------------------------------------------------------------

export type CombatEventKind =
  | 'auto_attack'
  | 'ability_fired'
  | 'mana_gained'
  | 'mana_spent'
  | 'dodge'
  | 'crit'
  | 'effect_applied'
  | 'effect_tick'
  | 'effect_expired';

export interface CombatEventDto {
  kind: CombatEventKind;
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  value?: number;
  ability_name?: string;
  effect_name?: string;
  is_crit?: boolean;
}

export interface CombatAbilityStateDto {
  slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
  ability_id: number;
  name: string;
  description: string;
  mana_cost: number;
  icon_url: string | null;
  status: 'ready' | 'cooldown' | 'insufficient_mana';
  cooldown_turns_remaining: number;
}

export interface MonsterCombatDto {
  id: number;
  name: string;
  icon_url: string | null;
  max_hp: number;
  attack: number;
  defence: number;
}

export interface PlayerCombatStateDto {
  max_hp: number;
  current_hp: number;
  max_mana: number;
  current_mana: number;
  attack: number;
  defence: number;
}

export interface AbilityDroppedDto {
  ability_id: number;
  name: string;
  icon_url: string | null;
}

export interface OwnedAbilityDto {
  id: number;
  name: string;
  icon_url: string | null;
  description: string;
  effect_type: string;
  mana_cost: number;
  effect_value: number;
  duration_turns: number;
  cooldown_turns: number;
  priority_default: number;
  slot_type: 'auto' | 'active' | 'both';
}

// ---------------------------------------------------------------------------
// Combat System: Server → Client payloads
// ---------------------------------------------------------------------------

export interface CombatStartPayload {
  combat_id: string;
  monster: MonsterCombatDto;
  player: PlayerCombatStateDto;
  loadout: {
    slots: CombatAbilityStateDto[];
  };
  turn_timer_ms: number;
}

export interface CombatTurnResultPayload {
  combat_id: string;
  turn: number;
  phase: 'player' | 'enemy';
  events: CombatEventDto[];
  player_hp: number;
  player_mana: number;
  enemy_hp: number;
  ability_states: CombatAbilityStateDto[];
}

export interface CombatActiveWindowPayload {
  combat_id: string;
  timer_ms: number;
  ability: CombatAbilityStateDto | null;
}

export interface CombatEndPayload {
  combat_id: string;
  outcome: 'win' | 'loss';
  monster_name: string;
  monster_icon_url: string | null;
  xp_gained: number;
  crowns_gained: number;
  items_dropped: ItemDroppedDto[];
  ability_drops: AbilityDroppedDto[];
  squires_dropped?: SquireDroppedDto[];
}

export interface LoadoutSlotDto {
  slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
  ability_id: number | null;
  priority: number;
  ability?: OwnedAbilityDto;
}

export interface LoadoutStatePayload {
  slots: LoadoutSlotDto[];
  owned_abilities: OwnedAbilityDto[];
}

export interface LoadoutUpdatedPayload {
  slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
  ability_id: number | null;
  priority: number;
}

export interface LoadoutUpdateRejectedPayload {
  slot_name: string;
  reason: 'in_combat' | 'ability_not_owned' | 'slot_type_mismatch';
  message: string;
}

// ---------------------------------------------------------------------------
// Combat System: Client → Server payloads
// ---------------------------------------------------------------------------

export interface CombatTriggerActivePayload {
  combat_id: string;
}

export interface LoadoutUpdatePayload {
  slot_name: 'auto_1' | 'auto_2' | 'auto_3' | 'active';
  ability_id: number | null;
  priority?: number;
}

export interface LoadoutRequestPayload {}

// ---------------------------------------------------------------------------
// Combat System: message type aliases
// ---------------------------------------------------------------------------

export type CombatStartMessage              = WsMessage<CombatStartPayload>;
export type CombatTurnResultMessage         = WsMessage<CombatTurnResultPayload>;
export type CombatActiveWindowMessage       = WsMessage<CombatActiveWindowPayload>;
export type CombatEndMessage                = WsMessage<CombatEndPayload>;
export type LoadoutStateMessage             = WsMessage<LoadoutStatePayload>;
export type LoadoutUpdatedMessage           = WsMessage<LoadoutUpdatedPayload>;
export type LoadoutUpdateRejectedMessage    = WsMessage<LoadoutUpdateRejectedPayload>;
export type CombatTriggerActiveMessage      = WsMessage<CombatTriggerActivePayload>;
export type LoadoutUpdateMessage            = WsMessage<LoadoutUpdatePayload>;
export type LoadoutRequestMessage           = WsMessage<LoadoutRequestPayload>;

// ---------------------------------------------------------------------------
// Gathering System: Server → Client payloads
// ---------------------------------------------------------------------------

export interface GatheringStartedPayload {
  action_id: number;
  building_id: number;
  duration: number;
  durability_cost: number;
  tool_slot_ids: number[];
  started_at: string; // ISO 8601
}

export interface GatheringTickEvent {
  type: 'resource' | 'gold' | 'monster' | 'accident' | 'nothing' | 'squire';
  message?: string;
  item_name?: string;
  item_icon_url?: string;
  quantity?: number;
  crowns?: number;
  hp_damage?: number;
  monster_name?: string;
  monster_icon_url?: string;
  squire_name?: string;         // for 'squire' type
  squire_icon_url?: string;     // for 'squire' type
  squire_rank?: string;         // for 'squire' type
}

export interface GatheringTickPayload {
  tick: number;
  total_ticks: number;
  event: GatheringTickEvent;
  current_hp: number;
  tool_durability: number;
}

export interface GatheringCombatPausePayload {
  tick: number;
  monster_name: string;
  monster_icon_url?: string | null;
}

export interface GatheringCombatResumePayload {
  tick: number;
  remaining_ticks: number;
  combat_result: 'win' | 'loss';
  current_hp: number;
}

export interface GatheringSummary {
  resources_gained: { item_name: string; quantity: number; icon_url?: string }[];
  crowns_gained: number;
  combats_fought: number;
  combats_won: number;
  accidents: number;
  total_hp_lost: number;
}

export interface GatheringEndedPayload {
  reason: 'completed' | 'cancelled' | 'death';
  ticks_completed: number;
  total_ticks: number;
  summary: GatheringSummary;
  tool_destroyed: boolean;
  tool_remaining_durability: number | null;
}

export type GatheringRejectionReason =
  | 'NOT_AT_BUILDING'
  | 'IN_COMBAT'
  | 'IN_GATHERING'
  | 'HP_ZERO'
  | 'INVALID_ACTION'
  | 'INVALID_DURATION'
  | 'NO_TOOL'
  | 'WRONG_TOOL_TYPE'
  | 'INSUFFICIENT_DURABILITY';

export interface GatheringRejectedPayload {
  reason: GatheringRejectionReason;
  message: string;
}

// ---------------------------------------------------------------------------
// Gathering System: message type aliases
// ---------------------------------------------------------------------------

export type GatheringStartedMessage       = WsMessage<GatheringStartedPayload>;
export type GatheringTickMessage          = WsMessage<GatheringTickPayload>;
export type GatheringCombatPauseMessage   = WsMessage<GatheringCombatPausePayload>;
export type GatheringCombatResumeMessage  = WsMessage<GatheringCombatResumePayload>;
export type GatheringEndedMessage         = WsMessage<GatheringEndedPayload>;
export type GatheringRejectedMessage      = WsMessage<GatheringRejectedPayload>;

// ---------------------------------------------------------------------------
// Crafting System: shared sub-types
// ---------------------------------------------------------------------------

export interface CraftingIngredientDto {
  item_def_id: number;
  item_name: string;
  item_icon_url: string | null;
  quantity: number;          // Per 1x craft
}

export interface CraftingRecipeDto {
  id: number;
  npc_id: number;
  name: string;
  description: string | null;
  output_item: ItemDefinitionDto;
  output_quantity: number;
  cost_crowns: number;
  craft_time_seconds: number;
  ingredients: CraftingIngredientDto[];
}

export interface CraftingSessionDto {
  id: number;
  recipe_id: number;
  npc_id: number;
  quantity: number;
  started_at: string;         // ISO 8601 timestamp
  total_duration_seconds: number;
  status: 'in_progress' | 'completed';
  progress_percent: number;   // 0–100, computed server-side
  remaining_seconds: number;  // 0 if completed, computed server-side
}

export type CraftingRejectionReason =
  | 'NOT_AT_NPC'
  | 'NPC_NOT_CRAFTER'
  | 'RECIPE_NOT_FOUND'
  | 'INSUFFICIENT_MATERIALS'
  | 'INSUFFICIENT_CROWNS'
  | 'ALREADY_CRAFTING'
  | 'INVALID_QUANTITY'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_NOT_IN_PROGRESS'
  | 'SESSION_NOT_COMPLETED'
  | 'INVENTORY_FULL'
  | 'ITEM_DEF_NOT_FOUND';

// ---------------------------------------------------------------------------
// Crafting System: Client → Server payloads
// ---------------------------------------------------------------------------

export interface CraftingOpenPayload {
  npc_id: number;
}

export interface CraftingStartPayload {
  npc_id: number;
  recipe_id: number;
  quantity: number;
}

export interface CraftingCancelPayload {
  session_id: number;
}

export interface CraftingCollectPayload {
  session_id: number;
}

// ---------------------------------------------------------------------------
// Crafting System: Server → Client payloads
// ---------------------------------------------------------------------------

export interface CraftingStatePayload {
  npc_id: number;
  recipes: CraftingRecipeDto[];
  active_sessions: CraftingSessionDto[];
}

export interface CraftingStartedPayload {
  session: CraftingSessionDto;
  new_crowns: number;
  updated_slots: InventorySlotDto[];
}

export interface CraftingCancelledPayload {
  session_id: number;
  refunded_crowns: number;
  refunded_items: { item_def_id: number; quantity: number }[];
  new_crowns: number;
  updated_slots: InventorySlotDto[];
}

export interface CraftingCollectedPayload {
  session_id: number;
  items_received: { item_def_id: number; quantity: number }[];
  updated_slots: InventorySlotDto[];
}

export interface CraftingRejectedPayload {
  action: 'open' | 'start' | 'cancel' | 'collect';
  reason: CraftingRejectionReason;
  details?: string;
}

export interface CraftingSessionsUpdatedPayload {
  finished_count: number;
  message: string;
}

// ---------------------------------------------------------------------------
// Crafting System: message type aliases
// ---------------------------------------------------------------------------

export type CraftingOpenMessage             = WsMessage<CraftingOpenPayload>;
export type CraftingStartMessage            = WsMessage<CraftingStartPayload>;
export type CraftingCancelMessage           = WsMessage<CraftingCancelPayload>;
export type CraftingCollectMessage          = WsMessage<CraftingCollectPayload>;
export type CraftingStateMessage            = WsMessage<CraftingStatePayload>;
export type CraftingStartedMessage          = WsMessage<CraftingStartedPayload>;
export type CraftingCancelledMessage        = WsMessage<CraftingCancelledPayload>;
export type CraftingCollectedMessage        = WsMessage<CraftingCollectedPayload>;
export type CraftingRejectedMessage         = WsMessage<CraftingRejectedPayload>;
export type CraftingSessionsUpdatedMessage  = WsMessage<CraftingSessionsUpdatedPayload>;

// ---------------------------------------------------------------------------
// Quest System: enums
// ---------------------------------------------------------------------------

export type QuestType = 'main' | 'side' | 'daily' | 'weekly' | 'monthly' | 'repeatable';
export type QuestStatus = 'active' | 'completed' | 'failed' | 'abandoned';
export type ObjectiveType =
  | 'kill_monster'
  | 'collect_item'
  | 'craft_item'
  | 'spend_crowns'
  | 'gather_resource'
  | 'reach_level'
  | 'visit_location'
  | 'talk_to_npc';
export type PrereqType = 'min_level' | 'has_item' | 'completed_quest' | 'class_required';
export type RewardType = 'item' | 'xp' | 'crowns' | 'squire';

// ---------------------------------------------------------------------------
// Squire System: constants
// ---------------------------------------------------------------------------

export const SQUIRE_RANKS: readonly string[] = [
  'Peasant',        // Level 1
  'Commoner',       // Level 2
  'Servant',        // Level 3
  'Page',           // Level 4
  'Yeoman',         // Level 5
  'Footman',        // Level 6
  'Squire',         // Level 7
  'Sergeant',       // Level 8
  'Man-at-Arms',    // Level 9
  'Knight-Errant',  // Level 10
  'Knight',         // Level 11
  'Knight-Captain', // Level 12
  'Baron',          // Level 13
  'Viscount',       // Level 14
  'Count',          // Level 15
  'Earl',           // Level 16
  'Marquess',       // Level 17
  'Duke',           // Level 18
  'Prince',         // Level 19
  'Sovereign',      // Level 20
] as const;

export const MAX_SQUIRE_SLOTS = 5;
export const DEFAULT_UNLOCKED_SLOTS = 2;
export const MAX_SQUIRE_LEVEL = 20;
export const MAX_POWER_LEVEL = 100;

export function getSquireRank(level: number): string {
  return SQUIRE_RANKS[Math.max(0, Math.min(level - 1, SQUIRE_RANKS.length - 1))] ?? 'Peasant';
}

// ---------------------------------------------------------------------------
// Squire System: shared sub-types
// ---------------------------------------------------------------------------

/** Squire definition as seen by admin/client. */
export interface SquireDefinitionDto {
  id: number;
  name: string;
  icon_url: string | null;
  power_level: number;       // 0–100
  is_active: boolean;
}

/** Player-owned squire instance. */
export interface CharacterSquireDto {
  id: number;                 // character_squires.id
  squire_def_id: number;
  name: string;               // from squire_definitions.name
  icon_url: string | null;
  level: number;              // 1–20
  rank: string;               // resolved from SQUIRE_RANKS[level-1]
  power_level: number;        // from squire_definitions.power_level
  status: 'idle' | 'on_expedition';
  /** Present only when status === 'on_expedition' */
  expedition?: {
    building_name: string;
    started_at: string;       // ISO 8601
    completes_at: string;     // ISO 8601
  };
}

/** Squire roster (full list for a character). */
export interface SquireRosterDto {
  squires: CharacterSquireDto[];
  slots_unlocked: number;     // currently unlocked (e.g. 2)
  slots_total: number;        // max possible (5)
}

/** Squire dropped from combat or gathering. */
export interface SquireDroppedDto {
  squire_def_id: number;
  name: string;
  level: number;
  rank: string;
  icon_url: string | null;
}

// ---------------------------------------------------------------------------
// Quest System: shared sub-types
// ---------------------------------------------------------------------------

export interface QuestObjectiveDto {
  id: number;
  objective_type: ObjectiveType;
  target_id: number | null;
  target_name: string | null;
  target_icon_url: string | null;
  target_quantity: number;
  target_duration: number | null;
  description: string | null;
  dialog_prompt: string | null;
  dialog_response: string | null;
  current_progress: number;
  is_complete: boolean;
}

export interface QuestRewardDto {
  reward_type: RewardType;
  target_id: number | null;
  target_name: string | null;
  target_icon_url: string | null;
  quantity: number;
}

export interface QuestPrerequisiteDto {
  prereq_type: PrereqType;
  target_id: number | null;
  target_value: number;
  description: string;
}

export interface QuestDefinitionDto {
  id: number;
  name: string;
  description: string;
  quest_type: QuestType;
  chain_id: string | null;
  chain_step: number | null;
  objectives: QuestObjectiveDto[];
  rewards: QuestRewardDto[];
  prerequisites: QuestPrerequisiteDto[];
}

export interface CharacterQuestDto {
  character_quest_id: number;
  quest: QuestDefinitionDto;
  status: QuestStatus;
  accepted_at: string;
  completed_at: string | null;
  objectives: QuestObjectiveDto[];
}

export type QuestRejectionReason =
  | 'NOT_AT_NPC'
  | 'QUEST_NOT_FOUND'
  | 'PREREQUISITES_NOT_MET'
  | 'QUEST_ALREADY_ACTIVE'
  | 'QUEST_LOG_FULL'
  | 'QUEST_NOT_COMPLETABLE'
  | 'INVENTORY_FULL'
  | 'INVALID_REQUEST';

// ---------------------------------------------------------------------------
// Quest System: Client → Server payloads
// ---------------------------------------------------------------------------

export interface QuestListAvailablePayload {
  npc_id: number;
}

export interface QuestAcceptPayload {
  npc_id: number;
  quest_id: number;
}

export interface QuestCompletePayload {
  character_quest_id: number;
}

export interface QuestAbandonPayload {
  character_quest_id: number;
}

export interface QuestLogRequestPayload {}

export interface QuestNpcDialogsPayload {
  npc_id: number;
}

export interface QuestTalkCompletePayload {
  npc_id: number;
  character_quest_id: number;
  objective_id: number;
}

// ---------------------------------------------------------------------------
// Quest System: Server → Client payloads
// ---------------------------------------------------------------------------

export interface QuestAvailableListPayload {
  npc_id: number;
  available_quests: QuestDefinitionDto[];
  active_quests: CharacterQuestDto[];
  completable_quests: CharacterQuestDto[];
}

export interface QuestAcceptedPayload {
  quest: CharacterQuestDto;
}

export interface QuestProgressPayload {
  character_quest_id: number;
  objective_id: number;
  current_progress: number;
  target_quantity: number;
  is_complete: boolean;
  quest_complete: boolean;
}

export interface QuestCompletedPayload {
  character_quest_id: number;
  rewards_granted: QuestRewardDto[];
  new_crowns: number;
  updated_slots: InventorySlotDto[];
}

export interface QuestAbandonedPayload {
  character_quest_id: number;
}

export interface QuestLogPayload {
  active_quests: CharacterQuestDto[];
}

export interface QuestNpcDialogDto {
  character_quest_id: number;
  quest_name: string;
  objective_id: number;
  dialog_prompt: string;
  dialog_response: string;
}

export interface QuestNpcDialogsResponsePayload {
  npc_id: number;
  dialogs: QuestNpcDialogDto[];
}

export interface QuestTalkCompletedPayload {
  character_quest_id: number;
  objective_id: number;
  dialog_response: string;
  quest_complete: boolean;
}

export interface QuestRejectedPayload {
  action: string;
  reason: QuestRejectionReason;
  details?: string;
}

// ---------------------------------------------------------------------------
// Quest System: message type aliases
// ---------------------------------------------------------------------------

export type QuestListAvailableMessage   = WsMessage<QuestListAvailablePayload>;
export type QuestAcceptMessage          = WsMessage<QuestAcceptPayload>;
export type QuestCompleteMessage        = WsMessage<QuestCompletePayload>;
export type QuestAbandonMessage         = WsMessage<QuestAbandonPayload>;
export type QuestLogRequestMessage      = WsMessage<QuestLogRequestPayload>;
export type QuestAvailableListMessage   = WsMessage<QuestAvailableListPayload>;
export type QuestAcceptedMessage        = WsMessage<QuestAcceptedPayload>;
export type QuestProgressMessage        = WsMessage<QuestProgressPayload>;
export type QuestCompletedMessage       = WsMessage<QuestCompletedPayload>;
export type QuestAbandonedMessage       = WsMessage<QuestAbandonedPayload>;
export type QuestLogMessage             = WsMessage<QuestLogPayload>;
export type QuestRejectedMessage            = WsMessage<QuestRejectedPayload>;
export type QuestNpcDialogsMessage          = WsMessage<QuestNpcDialogsPayload>;
export type QuestTalkCompleteMessage        = WsMessage<QuestTalkCompletePayload>;
export type QuestNpcDialogsResponseMessage  = WsMessage<QuestNpcDialogsResponsePayload>;
export type QuestTalkCompletedMessage       = WsMessage<QuestTalkCompletedPayload>;

// ---------------------------------------------------------------------------
// Squire System: Client → Server payloads
// ---------------------------------------------------------------------------

export interface SquireDismissListPayload {
  npc_id: number;
}

export interface SquireDismissConfirmPayload {
  squire_id: number;
}

// ---------------------------------------------------------------------------
// Squire System: Server → Client payloads
// ---------------------------------------------------------------------------

export interface SquireAcquiredPayload {
  squire: CharacterSquireDto;
  source: 'combat' | 'quest' | 'gathering' | 'exploration';
  updated_roster: SquireRosterDto;
}

export interface SquireAcquisitionFailedPayload {
  reason: 'ROSTER_FULL';
  squire_name: string;
}

export interface SquireDismissListResultPayload {
  squires: CharacterSquireDto[];
}

export interface SquireDismissedPayload {
  squire_id: number;
  squire_name: string;
  updated_roster: SquireRosterDto;
}

export interface SquireDismissRejectedPayload {
  reason: 'NOT_FOUND' | 'ON_EXPEDITION' | 'NOT_AT_NPC' | 'NPC_NOT_DISMISSER';
}

// ---------------------------------------------------------------------------
// Squire System: message type aliases
// ---------------------------------------------------------------------------

export type SquireDismissListMessage          = WsMessage<SquireDismissListPayload>;
export type SquireDismissConfirmMessage       = WsMessage<SquireDismissConfirmPayload>;
export type SquireRosterUpdateMessage         = WsMessage<SquireRosterDto>;
export type SquireAcquiredMessage             = WsMessage<SquireAcquiredPayload>;
export type SquireAcquisitionFailedMessage    = WsMessage<SquireAcquisitionFailedPayload>;
export type SquireDismissListResultMessage    = WsMessage<SquireDismissListResultPayload>;
export type SquireDismissedMessage            = WsMessage<SquireDismissedPayload>;
export type SquireDismissRejectedMessage      = WsMessage<SquireDismissRejectedPayload>;

// ---------------------------------------------------------------------------
// Marketplace: Client → Server payloads
// ---------------------------------------------------------------------------

export interface MarketplaceBrowsePayload {
  building_id: number;
  page: number;
  category?: string;
  search?: string;
}

export interface MarketplaceItemListingsPayload {
  building_id: number;
  item_def_id: number;
}

export interface MarketplaceBuyPayload {
  listing_id: number;
}

export interface MarketplaceListItemPayload {
  building_id: number;
  slot_id: number;
  quantity: number;
  price_per_item: number;
}

export interface MarketplaceCancelListingPayload {
  listing_id: number;
}

export interface MarketplaceMyListingsPayload {
  building_id: number;
}

export interface MarketplaceCollectCrownsPayload {
  building_id: number;
}

export interface MarketplaceCollectItemsPayload {
  listing_id: number;
}

// ---------------------------------------------------------------------------
// Marketplace: Server → Client payloads
// ---------------------------------------------------------------------------

export interface MarketplaceItemSummary {
  item_def_id: number;
  name: string;
  category: string;
  icon_url: string;
  total_quantity: number;
  listing_count: number;
  min_price_per_item: number;
  max_price_per_item: number;
}

export interface MarketplaceBrowseResultPayload {
  building_id: number;
  items: MarketplaceItemSummary[];
  page: number;
  total_pages: number;
  total_items: number;
}

export interface MarketplaceListingDto {
  listing_id: number;
  seller_name: string;
  quantity: number;
  price_per_item: number;
  total_price: number;
  current_durability?: number | null;
  max_durability?: number | null;
  created_at: string;
}

export interface MarketplaceItemListingsResultPayload {
  item_def_id: number;
  listings: MarketplaceListingDto[];
}

export interface MarketplaceBuyResultPayload {
  success: boolean;
  listing_id: number;
  new_crowns?: number;
  item?: InventorySlotDto;
  reason?: string;
}

export interface MarketplaceListItemResultPayload {
  success: boolean;
  new_crowns?: number;
  listing_id?: number;
  listings_used?: number;
  listings_max?: number;
  reason?: string;
}

export interface MarketplaceCancelResultPayload {
  success: boolean;
  listing_id: number;
  returned_item?: InventorySlotDto;
  reason?: string;
}

export interface MyListingDto {
  listing_id: number;
  item_def_id: number;
  item_name: string;
  icon_url: string;
  quantity: number;
  price_per_item: number;
  status: 'active' | 'sold' | 'expired';
  created_at: string;
  expires_at: string;
  current_durability?: number | null;
}

export interface MarketplaceMyListingsResultPayload {
  building_id: number;
  listings: MyListingDto[];
  pending_crowns: number;
  listings_used: number;
  listings_max: number;
}

export interface MarketplaceCollectCrownsResultPayload {
  success: boolean;
  crowns_collected: number;
  new_crowns: number;
}

export interface MarketplaceCollectItemsResultPayload {
  success: boolean;
  listing_id: number;
  returned_item?: InventorySlotDto;
  reason?: string;
}

export interface MarketplaceRejectedPayload {
  action: string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Marketplace: message type aliases
// ---------------------------------------------------------------------------

export type MarketplaceBrowseMessage           = WsMessage<MarketplaceBrowsePayload>;
export type MarketplaceItemListingsMessage      = WsMessage<MarketplaceItemListingsPayload>;
export type MarketplaceBuyMessage              = WsMessage<MarketplaceBuyPayload>;
export type MarketplaceListItemMessage         = WsMessage<MarketplaceListItemPayload>;
export type MarketplaceCancelListingMessage    = WsMessage<MarketplaceCancelListingPayload>;
export type MarketplaceMyListingsMessage       = WsMessage<MarketplaceMyListingsPayload>;
export type MarketplaceCollectCrownsMessage    = WsMessage<MarketplaceCollectCrownsPayload>;
export type MarketplaceCollectItemsMessage     = WsMessage<MarketplaceCollectItemsPayload>;
export type MarketplaceBrowseResultMessage     = WsMessage<MarketplaceBrowseResultPayload>;
export type MarketplaceItemListingsResultMessage = WsMessage<MarketplaceItemListingsResultPayload>;
export type MarketplaceBuyResultMessage        = WsMessage<MarketplaceBuyResultPayload>;
export type MarketplaceListItemResultMessage   = WsMessage<MarketplaceListItemResultPayload>;
export type MarketplaceCancelResultMessage     = WsMessage<MarketplaceCancelResultPayload>;
export type MarketplaceMyListingsResultMessage = WsMessage<MarketplaceMyListingsResultPayload>;
export type MarketplaceCollectCrownsResultMessage = WsMessage<MarketplaceCollectCrownsResultPayload>;
export type MarketplaceCollectItemsResultMessage = WsMessage<MarketplaceCollectItemsResultPayload>;
export type MarketplaceRejectedMessage         = WsMessage<MarketplaceRejectedPayload>;
