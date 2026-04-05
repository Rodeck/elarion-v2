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
  rod_upgrade_points: number;
  attr_constitution: number;
  attr_strength: number;
  attr_intelligence: number;
  attr_dexterity: number;
  attr_toughness: number;
  stat_points_unspent: number;
  armor_penetration: number;
  additional_attacks: number;
  gear_crit_chance: number;
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

export interface FishingBuildingActionDto {
  id: number;
  action_type: 'fishing';
  label: string;
  config: {
    min_rod_tier?: number;
  };
}

export interface ArenaBuildingActionDto {
  id: number;
  action_type: 'arena';
  sort_order: number;
  arena_id: number;
  arena_name: string;
}

export type BuildingActionDto = TravelBuildingActionDto | ExploreBuildingActionDto | ExpeditionBuildingActionDto | GatherBuildingActionDto | MarketplaceBuildingActionDto | FishingBuildingActionDto | ArenaBuildingActionDto;

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
  is_disassembler: boolean;
  is_trainer: boolean;
  trainer_stat: string | null;
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
  action_type: 'travel' | 'explore' | 'gather' | 'marketplace' | 'fishing' | 'arena';
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
  bosses?: BossDto[];
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
  stat_points_gained: number;
  stat_points_unspent: number;
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
  | MarketplaceRejectedMessage
  | ArenaEnteredMessage
  | ArenaEnterRejectedMessage
  | ArenaLeftMessage
  | ArenaLeaveRejectedMessage
  | ArenaPlayerEnteredMessage
  | ArenaPlayerLeftMessage
  | ArenaChallengeRejectedMessage
  | ArenaCombatStartMessage
  | ArenaCombatActiveWindowMessage
  | ArenaCombatTurnResultMessage
  | ArenaCombatEndMessage
  | ArenaParticipantUpdatedMessage
  | ArenaKickedMessage;

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
  | MarketplaceCollectItemsMessage
  | StatTrainingOpenMessage
  | StatTrainingAttemptMessage;

// ---------------------------------------------------------------------------
// Inventory: shared sub-types
// ---------------------------------------------------------------------------

export type ItemCategory =
  | 'resource' | 'food' | 'heal' | 'weapon'
  | 'boots' | 'shield' | 'greaves' | 'bracer' | 'tool'
  | 'helmet' | 'chestplate'
  | 'ring' | 'amulet'
  | 'skill_book';

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
  // Weapon attributes
  armor_penetration: number;
  additional_attacks: number;
  // Tool-specific (null for non-tools)
  tool_type: string | null;
  max_durability: number | null;
  power: number | null;
  // Skill book link (null for non-skill-books)
  ability_id: number | null;
}

// Quality tier for item variation (1=Poor, 2=Common, 3=Fine, 4=Superior)
export type QualityTier = 1 | 2 | 3 | 4;

export const QUALITY_LABELS: Record<QualityTier, string> = {
  1: 'Poor',
  2: 'Common',
  3: 'Fine',
  4: 'Superior',
};

export const QUALITY_COLORS: Record<QualityTier, string> = {
  1: '#888888',
  2: '#cccccc',
  3: '#44cc44',
  4: '#f0c060',
};

/** A single occupied inventory slot as sent to the client. */
export interface InventorySlotDto {
  slot_id: number;             // inventory_items.id — used for deletion
  item_def_id: number;
  quantity: number;
  current_durability?: number | null;  // present for tool items
  is_disassemblable?: boolean;         // true if item has disassembly recipes
  definition: ItemDefinitionDto;
  // Per-instance stat overrides (null/undefined = use definition value)
  instance_attack?: number | null;
  instance_defence?: number | null;
  instance_crit_chance?: number | null;
  instance_additional_attacks?: number | null;
  instance_armor_penetration?: number | null;
  instance_max_mana?: number | null;
  instance_mana_on_hit?: number | null;
  instance_mana_regen?: number | null;
  quality_tier?: QualityTier | null;
  quality_label?: string | null;
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
  | 'boots'
  | 'ring'
  | 'amulet';

export interface EquipmentSlotsDto {
  helmet:     InventorySlotDto | null;
  chestplate: InventorySlotDto | null;
  left_arm:   InventorySlotDto | null;
  right_arm:  InventorySlotDto | null;
  greaves:    InventorySlotDto | null;
  bracer:     InventorySlotDto | null;
  boots:      InventorySlotDto | null;
  ring:       InventorySlotDto | null;
  amulet:     InventorySlotDto | null;
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

export interface AbilityLevelStatsDto {
  level: number;
  effect_value: number;
  mana_cost: number;
  duration_turns: number;
  cooldown_turns: number;
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
  // Skill progress fields (populated when skill system is active)
  level: number;                                   // current skill level (1-5), default 1
  points: number;                                  // points toward next level (0-99), default 0
  points_to_next: number | null;                   // always 100 when not at max, null at level 5
  cooldown_until: string | null;                   // ISO 8601 timestamp or null if no cooldown
  current_level_stats: AbilityLevelStatsDto | null; // stats at current level, null if no level data
  next_level_stats: AbilityLevelStatsDto | null;   // stats at next level, null if at max or undefined
}

// ---------------------------------------------------------------------------
// Active effect DTO (sent with turn results for UI buff/debuff indicators)
// ---------------------------------------------------------------------------

export interface ActiveEffectDto {
  id: string;
  source: 'player' | 'enemy';
  target: 'player' | 'enemy';
  effect_type: 'buff' | 'debuff' | 'dot' | 'reflect' | 'shield';
  stat?: 'attack' | 'defence';
  value: number;
  turns_remaining: number;
  ability_name: string;
  icon_url?: string | null;
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
  active_effects: ActiveEffectDto[];
  initial_enemy_hp?: number;
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
  active_effects: ActiveEffectDto[];
}

export interface CombatActiveWindowPayload {
  combat_id: string;
  timer_ms: number;
  ability: CombatAbilityStateDto | null;
}

export interface CombatEndPayload {
  combat_id: string;
  outcome: 'win' | 'loss';
  current_hp: number;
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
export type RewardType = 'item' | 'xp' | 'crowns' | 'squire' | 'rod_upgrade_points';

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

// ---------------------------------------------------------------------------
// Fishing System
// ---------------------------------------------------------------------------

// Fishing: Pull pattern types
export interface PullSegmentDto {
  duration_ms: number;
  speed: number;
  direction: 'up' | 'down';
  pause_ms: number;
}

export interface PullPatternDto {
  type: 'aggressive' | 'erratic' | 'steady';
  segments: PullSegmentDto[];
  green_zone_width: number;
}

export interface CatchWindowDto {
  window_start_ms: number;
  window_duration_ms: number;
}

// Fishing: Client → Server payloads
export interface FishingCastPayload {
  building_id: number;
  action_id: number;
}

export interface FishingCompletePayload {
  session_id: string;
  input_timestamps: number[];
  reel_timestamp: number;
}

export interface FishingCancelPayload {
  session_id: string;
}

export interface FishingUpgradeRodPayload {
  npc_id: number;
}

export interface FishingRepairRodPayload {
  npc_id: number;
}

// Fishing: Server → Client payloads
export interface FishingSessionStartPayload {
  session_id: string;
  bite_delay_ms: number;
  pull_pattern: PullPatternDto;
  catch_window: CatchWindowDto;
  fish_silhouette: string;
}

export interface FishingLootDto {
  slot_id: number;
  item_def_id: number;
  item_name: string;
  icon_url: string;
  quantity: number;
  category: string;
}

export interface FishingResultPayload {
  success: boolean;
  fish_name: string | null;
  fish_icon_url: string | null;
  items_received: FishingLootDto[];
  rod_durability_remaining: number;
  rod_locked: boolean;
  snap_check_failed: boolean;
}

export type FishingRejectionReason =
  | 'NO_ROD_EQUIPPED'
  | 'ROD_LOCKED'
  | 'NOT_AT_FISHING_SPOT'
  | 'IN_COMBAT'
  | 'ALREADY_FISHING'
  | 'ALREADY_GATHERING'
  | 'INVALID_SESSION'
  | 'SESSION_EXPIRED'
  | 'INVENTORY_FULL';

export interface FishingRejectedPayload {
  action: 'cast' | 'complete' | 'cancel';
  reason: FishingRejectionReason;
  message: string;
}

export interface FishingUpgradeResultPayload {
  success: boolean;
  new_tier: number;
  new_max_durability: number;
  new_durability: number;
  points_remaining: number;
  reason?: string;
  updated_slots: InventorySlotDto[];
}

export interface FishingRepairResultPayload {
  success: boolean;
  new_durability: number;
  crowns_remaining: number;
  reason?: string;
  updated_slots: InventorySlotDto[];
}

// Fishing: Message type aliases
export type FishingCastMessage           = WsMessage<FishingCastPayload>;
export type FishingCompleteMessage       = WsMessage<FishingCompletePayload>;
export type FishingCancelMessage         = WsMessage<FishingCancelPayload>;
export type FishingSessionStartMessage   = WsMessage<FishingSessionStartPayload>;
export type FishingResultMessage         = WsMessage<FishingResultPayload>;
export type FishingRejectedMessage       = WsMessage<FishingRejectedPayload>;
export type FishingUpgradeRodMessage     = WsMessage<FishingUpgradeRodPayload>;
export type FishingUpgradeResultMessage  = WsMessage<FishingUpgradeResultPayload>;
export type FishingRepairRodMessage      = WsMessage<FishingRepairRodPayload>;
export type FishingRepairResultMessage   = WsMessage<FishingRepairResultPayload>;

// ---------------------------------------------------------------------------
// Disassembly: shared sub-types
// ---------------------------------------------------------------------------

export interface DisassemblyOutputPreview {
  item_def_id: number;
  item_name: string;
  icon_url: string | null;
  min_quantity: number;
  max_quantity: number;
}

export interface DisassemblyReceivedItem {
  item_def_id: number;
  item_name: string;
  icon_url: string | null;
  quantity: number;
}

export type DisassemblyRejectionReason =
  | 'NO_CHARACTER'
  | 'NPC_NOT_FOUND'
  | 'NPC_NOT_DISASSEMBLER'
  | 'NOT_AT_BUILDING'
  | 'IN_COMBAT'
  | 'NO_KILN'
  | 'INSUFFICIENT_KILN_DURABILITY'
  | 'INSUFFICIENT_CROWNS'
  | 'INSUFFICIENT_INVENTORY_SPACE'
  | 'ITEM_NOT_DISASSEMBLABLE'
  | 'INVALID_ITEM'
  | 'GRID_EMPTY';

// ---------------------------------------------------------------------------
// Disassembly: Client → Server payloads
// ---------------------------------------------------------------------------

export interface DisassemblyOpenPayload {
  npc_id: number;
}

export interface DisassemblyPreviewPayload {
  npc_id: number;
  slot_ids: number[];
  kiln_slot_id: number;
}

export interface DisassemblyExecutePayload {
  npc_id: number;
  slot_ids: number[];
  kiln_slot_id: number;
}

// ---------------------------------------------------------------------------
// Disassembly: Server → Client payloads
// ---------------------------------------------------------------------------

export interface DisassemblyStatePayload {
  npc_id: number;
}

export interface DisassemblyPreviewResultPayload {
  possible_outputs: DisassemblyOutputPreview[];
  total_cost: number;
  total_item_count: number;
  max_output_slots: number;
}

export interface DisassemblyResultPayload {
  received_items: DisassemblyReceivedItem[];
  new_crowns: number;
  updated_slots: InventorySlotDto[];
  removed_slot_ids: number[];
  kiln_slot: InventorySlotDto | null;
}

export interface DisassemblyRejectedPayload {
  action: 'open' | 'preview' | 'execute';
  reason: DisassemblyRejectionReason;
  details?: string;
}

// Disassembly: Message type aliases
export type DisassemblyOpenMessage          = WsMessage<DisassemblyOpenPayload>;
export type DisassemblyPreviewMessage       = WsMessage<DisassemblyPreviewPayload>;
export type DisassemblyExecuteMessage       = WsMessage<DisassemblyExecutePayload>;
export type DisassemblyStateMessage         = WsMessage<DisassemblyStatePayload>;
export type DisassemblyPreviewResultMessage = WsMessage<DisassemblyPreviewResultPayload>;
export type DisassemblyResultMessage        = WsMessage<DisassemblyResultPayload>;
export type DisassemblyRejectedMessage      = WsMessage<DisassemblyRejectedPayload>;

// ---------------------------------------------------------------------------
// Rankings: Shared sub-types
// ---------------------------------------------------------------------------

export interface LeaderboardEntryDto {
  rank: number;
  character_id: string;
  character_name: string;
  class_id: number;
  class_name: string;
  value: number;
}

export interface MapPopulationDto {
  zone_id: number;
  zone_name: string;
  player_count: number;
}

// ---------------------------------------------------------------------------
// Rankings: Server → Client payloads
// ---------------------------------------------------------------------------

export interface RankingsDataPayload {
  updated_at: string;
  total_players: number;
  top_level: LeaderboardEntryDto[];
  top_fighters: LeaderboardEntryDto[];
  top_crafters: LeaderboardEntryDto[];
  top_questers: LeaderboardEntryDto[];
  top_arena: LeaderboardEntryDto[];
  map_population: MapPopulationDto[];
  my_ranks: {
    level: { rank: number; value: number };
    fighters: { rank: number; value: number };
    crafters: { rank: number; value: number };
    questers: { rank: number; value: number };
    arena: { rank: number; value: number };
  };
}

// ---------------------------------------------------------------------------
// Boss System: Shared sub-types
// ---------------------------------------------------------------------------

export type BossHpBracket = 'full' | 'high' | 'medium' | 'low' | 'critical';

export interface BossDto {
  id: number;
  name: string;
  description: string | null;
  icon_url: string | null;
  sprite_url: string | null;
  building_id: number;
  status: 'alive' | 'in_combat' | 'defeated' | 'inactive';
  fighting_character_name: string | null;
  total_attempts: number;
  respawn_at: string | null; // ISO 8601
}

export interface BossCombatDto {
  id: number;
  name: string;
  icon_url: string | null;
  attack: number;
  defense: number;
  hp_bracket: BossHpBracket;
  abilities: { name: string; icon_url: string | null }[];
}

// ---------------------------------------------------------------------------
// Boss System: Server → Client payloads
// ---------------------------------------------------------------------------

export interface BossCombatStartPayload {
  combat_id: string;
  boss: BossCombatDto;
  player: PlayerCombatStateDto;
  loadout: {
    slots: CombatAbilityStateDto[];
  };
  turn_timer_ms: number;
  active_effects: ActiveEffectDto[];
}

export interface BossCombatTurnResultPayload {
  combat_id: string;
  turn: number;
  phase: 'player' | 'enemy';
  events: CombatEventDto[];
  player_hp: number;
  player_mana: number;
  enemy_hp_bracket: BossHpBracket;
  ability_states: CombatAbilityStateDto[];
  active_effects: ActiveEffectDto[];
}

export interface BossCombatActiveWindowPayload {
  combat_id: string;
  timer_ms: number;
  ability: CombatAbilityStateDto | null;
}

export interface BossCombatEndPayload {
  combat_id: string;
  outcome: 'win' | 'loss';
  current_hp: number;
  boss_name: string;
  boss_icon_url: string | null;
  enemy_hp_bracket: BossHpBracket;
  xp_gained: number;
  crowns_gained: number;
  items_dropped: ItemDroppedDto[];
}

export interface BossStatePayload {
  boss_id: number;
  building_id: number;
  status: 'alive' | 'in_combat' | 'defeated';
  fighting_character_name: string | null;
  total_attempts: number;
  respawn_at: string | null;
}

export interface BossAnnouncementPayload {
  type: 'defeated' | 'respawned';
  boss_name: string;
  boss_icon_url: string | null;
  building_name: string | null;
  defeated_by?: string; // character name, only for 'defeated'
  total_attempts?: number; // how many attempts this instance took
}

export interface BossChallengeRejectedPayload {
  reason: 'no_token' | 'in_combat' | 'defeated' | 'inactive' | 'already_in_combat' | 'not_found';
  message: string;
  respawn_at?: string | null;
}

// ---------------------------------------------------------------------------
// Boss System: Client → Server payloads
// ---------------------------------------------------------------------------

export interface BossChallengePayload {
  boss_id: number;
}

export interface BossCombatTriggerActivePayload {
  combat_id: string;
}

// ---------------------------------------------------------------------------
// Boss System: message type aliases
// ---------------------------------------------------------------------------

export type BossCombatStartMessage         = WsMessage<BossCombatStartPayload>;
export type BossCombatTurnResultMessage    = WsMessage<BossCombatTurnResultPayload>;
export type BossCombatActiveWindowMessage  = WsMessage<BossCombatActiveWindowPayload>;
export type BossCombatEndMessage           = WsMessage<BossCombatEndPayload>;
export type BossStateMessage              = WsMessage<BossStatePayload>;
export type BossChallengeRejectedMessage  = WsMessage<BossChallengeRejectedPayload>;
export type BossChallengeMessage          = WsMessage<BossChallengePayload>;
export type BossCombatTriggerActiveMessage = WsMessage<BossCombatTriggerActivePayload>;
export type BossAnnouncementMessage       = WsMessage<BossAnnouncementPayload>;

// ---------------------------------------------------------------------------
// Arena System
// ---------------------------------------------------------------------------

export interface ArenaDto {
  id: number;
  name: string;
  building_id: number;
  min_stay_seconds: number;
  reentry_cooldown_seconds: number;
  level_bracket: number;
}

export interface ArenaParticipantDto {
  character_id: string;
  name: string;
  class_id: number;
  level: number;
  in_combat: boolean;
  entered_at: string;
  current_streak: number;
  arena_pvp_wins: number;
}

export interface ArenaCombatantDto {
  character_id: string;
  name: string;
  class_id: number;
  level: number;
  max_hp: number;
  current_hp: number;
  attack: number;
  defence: number;
  icon_url: string | null;
}

// --- Arena Server → Client Payloads ---

export interface ArenaEnteredPayload {
  arena: ArenaDto;
  participants: ArenaParticipantDto[];
  monsters: MonsterCombatDto[];
  can_leave_at: string;
  current_hp: number;
  max_hp: number;
}

export interface ArenaEnterRejectedPayload {
  reason: 'cooldown' | 'in_combat' | 'in_gathering' | 'already_in_arena' | 'inactive' | 'not_found';
  message: string;
  cooldown_until?: string;
}

export interface ArenaLeftPayload {
  arena_id: number;
  cooldown_until: string;
}

export interface ArenaLeaveRejectedPayload {
  reason: 'too_early' | 'in_combat';
  message: string;
  can_leave_at: string;
}

export interface ArenaPlayerEnteredPayload {
  participant: ArenaParticipantDto;
}

export interface ArenaPlayerLeftPayload {
  character_id: string;
}

export interface ArenaChallengeRejectedPayload {
  reason: 'not_in_arena' | 'target_not_found' | 'target_in_combat' | 'self_in_combat' | 'level_bracket' | 'no_token' | 'monster_not_found';
  message: string;
}

export interface ArenaCombatStartPayload {
  combat_id: string;
  opponent: ArenaCombatantDto;
  player: PlayerCombatStateDto;
  loadout: { slots: CombatAbilityStateDto[] };
  is_pvp: boolean;
  turn_timer_ms: number;
}

export interface ArenaCombatActiveWindowPayload {
  combat_id: string;
  timer_ms: number;
  ability: CombatAbilityStateDto | null;
}

export interface ArenaCombatTurnResultPayload {
  combat_id: string;
  turn: number;
  phase: 'player' | 'enemy';
  events: CombatEventDto[];
  player_hp: number;
  player_mana: number;
  opponent_hp: number;
  ability_states: CombatAbilityStateDto[];
  active_effects: ActiveEffectDto[];
}

export interface ArenaCombatEndPayload {
  combat_id: string;
  outcome: 'victory' | 'defeat';
  current_hp: number;
  xp_gained: number;
  crowns_gained: number;
  opponent_name: string;
  is_pvp: boolean;
}

export interface ArenaParticipantUpdatedPayload {
  character_id: string;
  in_combat: boolean;
  current_streak?: number;
  arena_pvp_wins?: number;
}

export interface ArenaKickedPayload {
  reason: 'defeat' | 'admin' | 'arena_closed';
  message: string;
  cooldown_until: string;
}

// --- Arena Client → Server Payloads ---

export interface ArenaEnterPayload {
  action_id: number;
}

export interface ArenaLeavePayload {
  arena_id: number;
}

export interface ArenaChallengePlayerPayload {
  target_character_id: string;
}

export interface ArenaChallengeNpcPayload {
  monster_id: number;
}

export interface ArenaCombatTriggerActivePayload {
  combat_id: string;
}

// --- Arena Message Types ---

export type ArenaEnteredMessage            = WsMessage<ArenaEnteredPayload>;
export type ArenaEnterRejectedMessage      = WsMessage<ArenaEnterRejectedPayload>;
export type ArenaLeftMessage               = WsMessage<ArenaLeftPayload>;
export type ArenaLeaveRejectedMessage      = WsMessage<ArenaLeaveRejectedPayload>;
export type ArenaPlayerEnteredMessage      = WsMessage<ArenaPlayerEnteredPayload>;
export type ArenaPlayerLeftMessage         = WsMessage<ArenaPlayerLeftPayload>;
export type ArenaChallengeRejectedMessage  = WsMessage<ArenaChallengeRejectedPayload>;
export type ArenaCombatStartMessage        = WsMessage<ArenaCombatStartPayload>;
export type ArenaCombatActiveWindowMessage = WsMessage<ArenaCombatActiveWindowPayload>;
export type ArenaCombatTurnResultMessage   = WsMessage<ArenaCombatTurnResultPayload>;
export type ArenaCombatEndMessage          = WsMessage<ArenaCombatEndPayload>;
export type ArenaParticipantUpdatedMessage = WsMessage<ArenaParticipantUpdatedPayload>;
export type ArenaKickedMessage             = WsMessage<ArenaKickedPayload>;
export type ArenaEnterMessage              = WsMessage<ArenaEnterPayload>;
export type ArenaLeaveMessage              = WsMessage<ArenaLeavePayload>;
export type ArenaChallengePlayerMessage    = WsMessage<ArenaChallengePlayerPayload>;
export type ArenaChallengeNpcMessage       = WsMessage<ArenaChallengeNpcPayload>;
export type ArenaCombatTriggerActiveMessage = WsMessage<ArenaCombatTriggerActivePayload>;

// ---------------------------------------------------------------------------
// Training (Stat Allocation): payloads
// ---------------------------------------------------------------------------

export interface TrainingOpenPayload {
  npc_id: number;
}

export interface TrainingAttributesDto {
  constitution: number;
  strength: number;
  intelligence: number;
  dexterity: number;
  toughness: number;
}

export interface TrainingDerivedStatsDto {
  max_hp: number;
  attack_power: number;
  defence: number;
  max_mana: number;
  crit_chance: number;
  crit_damage: number;
  dodge_chance: number;
}

export interface TrainingDescriptionsDto {
  constitution: string;
  strength: string;
  intelligence: string;
  dexterity: string;
  toughness: string;
}

export interface TrainingBaseStatsDto {
  hp: number;
  attack: number;
  defence: number;
}

export interface TrainingEquipmentStatsDto {
  attack: number;
  defence: number;
  max_mana: number;
  crit_chance: number;
  crit_damage: number;
  dodge_chance: number;
}

export interface TrainingStatePayload {
  attributes: TrainingAttributesDto;
  unspent_points: number;
  per_stat_cap: number;
  level: number;
  derived_stats: TrainingDerivedStatsDto;
  descriptions: TrainingDescriptionsDto;
  base_stats: TrainingBaseStatsDto;
  equipment_stats: TrainingEquipmentStatsDto;
}

export interface TrainingAllocatePayload {
  npc_id: number;
  increments: TrainingAttributesDto;
}

export interface TrainingResultPayload {
  attributes: TrainingAttributesDto;
  unspent_points: number;
  new_max_hp: number;
  new_attack_power: number;
  new_defence: number;
  new_max_mana: number;
  new_crit_chance: number;
  new_crit_damage: number;
  new_dodge_chance: number;
}

export interface TrainingErrorPayload {
  message: string;
}

// Training: message types
export type TrainingOpenMessage     = WsMessage<TrainingOpenPayload>;
export type TrainingStateMessage    = WsMessage<TrainingStatePayload>;
export type TrainingAllocateMessage = WsMessage<TrainingAllocatePayload>;
export type TrainingResultMessage   = WsMessage<TrainingResultPayload>;
export type TrainingErrorMessage    = WsMessage<TrainingErrorPayload>;

// ---------------------------------------------------------------------------
// Stat Training (consumable-item-based stat training via NPCs)
// ---------------------------------------------------------------------------

export interface StatTrainingOpenPayload {
  npc_id: number;
}

export interface StatTrainingAttemptPayload {
  npc_id: number;
  item_def_id: number;
}

export interface StatTrainingItemDto {
  item_def_id: number;
  name: string;
  icon_url: string | null;
  tier: number;
  success_chance: number;
  owned_quantity: number;
}

export interface StatTrainingStatePayload {
  stat_name: string;
  current_value: number;
  per_stat_cap: number;
  level: number;
  items: StatTrainingItemDto[];
}

export interface StatTrainingResultPayload {
  success: boolean;
  stat_name: string;
  new_value: number;
  message: string;
}

export interface StatTrainingErrorPayload {
  message: string;
}

// Stat Training: message types
export type StatTrainingOpenMessage    = WsMessage<StatTrainingOpenPayload>;
export type StatTrainingAttemptMessage = WsMessage<StatTrainingAttemptPayload>;
export type StatTrainingStateMessage   = WsMessage<StatTrainingStatePayload>;
export type StatTrainingResultMessage  = WsMessage<StatTrainingResultPayload>;
export type StatTrainingErrorMessage   = WsMessage<StatTrainingErrorPayload>;

// ---------------------------------------------------------------------------
// Skill Book System
// ---------------------------------------------------------------------------

// Client → Server
export interface SkillBookUsePayload {
  slot_id: number;
}

// Server → Client
export interface SkillBookResultPayload {
  ability_id: number;
  ability_name: string;
  points_gained: number;
  new_points: number;
  new_level: number;
  leveled_up: boolean;
  cooldown_until: string;
}

export interface SkillBookErrorPayload {
  message: string;
}

// Skill Book: message types
export type SkillBookUseMessage    = WsMessage<SkillBookUsePayload>;
export type SkillBookResultMessage = WsMessage<SkillBookResultPayload>;
export type SkillBookErrorMessage  = WsMessage<SkillBookErrorPayload>;
