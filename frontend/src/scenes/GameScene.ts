import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import { StatsBar } from '../ui/StatsBar';
import { ChatBox } from '../ui/ChatBox';
import { CombatLog } from '../ui/CombatLog';
import { BuildingPanel } from '../ui/BuildingPanel';
import { LogoutButton } from '../ui/LogoutButton';
import { DayNightBar } from '../ui/DayNightBar';
import { LeftPanel } from '../ui/LeftPanel';
import { CombatScreen } from '../ui/CombatScreen';
import { QuestPanel } from '../ui/QuestPanel';
import { QuestLog } from '../ui/QuestLog';
import { QuestTracker } from '../ui/QuestTracker';
import { setUiIcons } from '../ui/ui-icons';
import { SessionStore } from '../auth/SessionStore';
import { AnimatedSprite } from '../entities/AnimatedSprite';
import { getSprite } from '../entities/SpriteRegistry';
import { DIR4_TO_DIR8 } from '../types/sprite';
import type { Direction4, Direction8 } from '../types/sprite';
import type {
  WorldStatePayload,
  CharacterData,
  DayNightStateDto,
  NightEncounterResultPayload,
  PlayerMovedPayload,
  PlayerEnteredZonePayload,
  PlayerLeftZonePayload,
  PlayerMoveRejectedPayload,
  CharacterLevelledUpPayload,
  ChatMessagePayload,
  CityPlayerMovedPayload,
  CityMoveRejectedPayload,
  CityBuildingArrivedPayload,
  CityBuildingActionRejectedPayload,
  BuildingExploreResultPayload,
  CityMapData,
  CityMapNode,
  CityMapBuilding,
  InventoryStatePayload,
  InventoryItemReceivedPayload,
  InventoryItemDeletedPayload,
  InventoryDeleteRejectedPayload,
  InventoryFullPayload,
  ExpeditionStateDto,
  ExpeditionDispatchedPayload,
  ExpeditionDispatchRejectedPayload,
  ExpeditionCompletedPayload,
  ExpeditionCollectResultPayload,
  ExpeditionCollectRejectedPayload,
  EquipmentStatePayload,
  EquipmentChangedPayload,
  EquipmentEquipRejectedPayload,
  EquipmentUnequipRejectedPayload,
  AdminCommandResultPayload,
  CharacterCrownsChangedPayload,
  PlayerSummary,
  CombatStartPayload,
  CombatTurnResultPayload,
  CombatActiveWindowPayload,
  CombatEndPayload,
  LoadoutStatePayload,
  LoadoutUpdatedPayload,
  LoadoutUpdateRejectedPayload,
  CraftingStatePayload,
  CraftingStartedPayload,
  CraftingCancelledPayload,
  CraftingCollectedPayload,
  CraftingRejectedPayload,
  CraftingSessionsUpdatedPayload,
  GatheringStartedPayload,
  GatheringTickPayload,
  GatheringEndedPayload,
  GatheringRejectedPayload,
  GatheringCombatPausePayload,
  GatheringCombatResumePayload,
  QuestAvailableListPayload,
  QuestAcceptedPayload,
  QuestCompletedPayload,
  QuestProgressPayload,
  QuestRejectedPayload,
  QuestAbandonedPayload,
  QuestLogPayload,
  QuestNpcDialogsResponsePayload,
  QuestTalkCompletedPayload,
  SquireRosterDto,
  SquireAcquiredPayload,
  SquireAcquisitionFailedPayload,
  SquireDismissListResultPayload,
  SquireDismissedPayload,
  SquireDismissRejectedPayload,
  MarketplaceBrowseResultPayload,
  MarketplaceItemListingsResultPayload,
  MarketplaceBuyResultPayload,
  MarketplaceListItemResultPayload,
  MarketplaceCancelResultPayload,
  MarketplaceMyListingsResultPayload,
  MarketplaceCollectCrownsResultPayload,
  MarketplaceCollectItemsResultPayload,
  MarketplaceRejectedPayload,
  FishingSessionStartPayload,
  FishingResultPayload,
  FishingRejectedPayload,
  FishingUpgradeResultPayload,
  FishingRepairResultPayload,
  DisassemblyStatePayload,
  DisassemblyPreviewResultPayload,
  DisassemblyResultPayload,
  DisassemblyRejectedPayload,
  RankingsDataPayload,
  BossDto,
  BossStatePayload,
  BossChallengeRejectedPayload,
  BossCombatStartPayload,
  BossCombatTurnResultPayload,
  BossCombatActiveWindowPayload,
  BossCombatEndPayload,
  ArenaEnteredPayload,
  ArenaEnterRejectedPayload,
  ArenaLeftPayload,
  ArenaLeaveRejectedPayload,
  ArenaPlayerEnteredPayload,
  ArenaPlayerLeftPayload,
  ArenaParticipantUpdatedPayload,
  ArenaKickedPayload,
  ArenaChallengeRejectedPayload,
  ArenaCombatStartPayload,
  ArenaCombatTurnResultPayload,
  ArenaCombatActiveWindowPayload,
  ArenaCombatEndPayload,
  TrainingStatePayload,
  TrainingResultPayload,
  TrainingErrorPayload,
  StatTrainingStatePayload,
  StatTrainingResultPayload,
  StatTrainingErrorPayload,
  WarehouseStatePayload,
  WarehouseRejectedPayload,
  WarehouseBulkResultPayload,
  WarehouseBuySlotResultPayload,
} from '@elarion/protocol';
import { TrainingModal } from '../ui/TrainingModal';
import { StatTrainingModal } from '../ui/StatTrainingModal';
import { FishingMinigame } from '../ui/fishing-minigame';
import { DisassemblyModal } from '../ui/DisassemblyModal';
import { RankingsPanel } from '../ui/RankingsPanel';
import { BossSprite } from '../entities/BossSprite';
import { BossInfoPanel } from '../ui/BossInfoPanel';
import { BossAnnouncementBanner } from '../ui/BossAnnouncementBanner';
import { ArenaPanel } from '../ui/ArenaPanel';

const TILE_SIZE = 32;
const XP_THRESHOLDS = [100, 250, 500, 900, 1400];

export class GameScene extends Phaser.Scene {
  private client!: WSClient;
  private token = '';
  private myCharacter!: CharacterData;
  private playerAnimSprite!: AnimatedSprite;
  private statsBar!: StatsBar;
  private logoutButton!: LogoutButton;
  private chatBox!: ChatBox;
  private combatLog!: CombatLog;
  private buildingPanel!: BuildingPanel;
  private leftPanel!: LeftPanel;
  private dayNightBar: DayNightBar | null = null;
  private combatScreen: CombatScreen | null = null;
  private questPanel!: QuestPanel;
  private questLog!: QuestLog;
  private questTracker!: QuestTracker;
  private rankingsPanel!: RankingsPanel;
  // squire roster is now in leftPanel tab — no separate field needed

  // Remote players: characterId → sprite
  private remotePlayers = new Map<string, Phaser.GameObjects.Container>();

  // Movement throttle
  private lastMoveSent = 0;
  private readonly MOVE_INTERVAL_MS = 100; // max 10/sec

  // Counts active movement tweens on the player sprite; used to detect when the
  // last hop in a multi-hop path completes so we can switch back to idle.
  private movingTweenCount = 0;

  // Travel transition state
  private awaitingTravelWorldState = false;
  // True from initial connect until first world.state, and again during travel.
  // Gates the player.entered_zone buffer so events that arrive before world.state
  // are replayed once the map is ready.
  private awaitingWorldState = true;
  private pendingEnteredZone: PlayerEnteredZonePayload[] = [];

  // Expedition state cache: building_id → last known expedition state
  private expeditionStateByBuilding = new Map<number, ExpeditionStateDto>();

  // Building open when combat started — restored when combat screen closes
  private buildingBeforeCombat: CityMapBuilding | null = null;
  // True while combat is happening during a gathering session
  private gatheringCombatActive = false;
  // Fishing mini-game overlay
  private fishingMinigame: FishingMinigame | null = null;
  private disassemblyModal!: DisassemblyModal;

  // City map state
  private isCityMap = false;
  private cityMapData: CityMapData | null = null;
  private cityAdjacency = new Map<number, number[]>();
  private pathPreviewGraphics: Phaser.GameObjects.Graphics | null = null;
  private pendingBuildingId: number | null = null;
  private cityBuildingLabels: Phaser.GameObjects.Text[] = [];
  private cityHotspotGraphics: Phaser.GameObjects.Graphics | null = null;
  private cityNodeMarkers: Phaser.GameObjects.Arc[] = [];
  private cityBgSprite: Phaser.GameObjects.Sprite | null = null;

  // Arena system
  private arenaPanel: ArenaPanel | null = null;
  private trainingModal!: TrainingModal;
  private statTrainingModal!: StatTrainingModal;
  private inArenaCombat = false;
  private pendingArenaPayload: ArenaEnteredPayload | null = null;

  // Boss system
  private bossSprites = new Map<number, BossSprite>();
  private bossInfoPanel!: BossInfoPanel;
  private bossAnnouncementBanner!: BossAnnouncementBanner;
  private currentBosses: BossDto[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { token: string; character?: CharacterData }): void {
    this.token = data.token;
  }

  create(): void {
    const wsHost = import.meta.env['VITE_WS_HOST'] ?? 'localhost:4000';
    this.client = new WSClient(`ws://${wsHost}/game?token=${this.token}`);

    const bottomBar = document.getElementById('bottom-bar')!;
    this.chatBox   = new ChatBox(this.client, bottomBar);
    this.combatLog = new CombatLog(bottomBar);

    const inventoryEl = document.getElementById('inventory-panel')!;
    inventoryEl.style.display = 'flex';
    this.leftPanel = new LeftPanel(
      inventoryEl,
      (slotId, slotName) => {
        this.client.send('equipment.equip', { slot_id: slotId, slot_name: slotName });
      },
      (slotName) => {
        this.client.send('equipment.unequip', { slot_name: slotName });
      },
      (slotId) => {
        this.client.send('inventory.delete_item', { slot_id: slotId });
      },
      (slotName, abilityId, priority) => {
        this.client.send('loadout:update', { slot_name: slotName, ability_id: abilityId, priority });
      },
    );
    this.leftPanel.setOnUseSkillBook((slotId) => {
      this.client.send('skill-book.use', { slot_id: slotId });
    });

    const buildingSlot = document.getElementById('building-panel-slot')!;
    this.buildingPanel = new BuildingPanel(buildingSlot, (payload) => {
      if (payload.action_type === 'travel') {
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.awaitingTravelWorldState = true;
        this.awaitingWorldState = true;
      }
      this.client.send('city.building_action', payload);
    });
    this.buildingPanel.setOnExpeditionDispatch((buildingId, actionId, durationHours, squireId) => {
      this.client.send('expedition.dispatch', { building_id: buildingId, action_id: actionId, duration_hours: durationHours, squire_id: squireId });
    });
    this.buildingPanel.setOnExpeditionCollect((expeditionId) => {
      this.client.send('expedition.collect', { expedition_id: expeditionId });
    });
    this.buildingPanel.setOnCraftingOpen((npcId) => {
      this.buildingPanel.getCraftingModal().open(npcId);
      this.client.send('crafting.open', { npc_id: npcId });
    });
    this.questPanel = new QuestPanel(document.getElementById('game')!);
    this.questPanel.setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    this.buildingPanel.setOnQuestOpen((npcId) => {
      this.questPanel.open(npcId);
      this.client.send('quest.list_available', { npc_id: npcId });
    });
    this.buildingPanel.setOnNpcDialogsRequest((npcId) => {
      this.client.send('quest.npc_dialogs', { npc_id: npcId });
    });
    this.buildingPanel.setOnQuestTalkComplete((npcId, charQuestId, objectiveId) => {
      this.client.send('quest.talk_complete', { npc_id: npcId, character_quest_id: charQuestId, objective_id: objectiveId });
    });
    this.buildingPanel.setOnSquireDismissList((npcId) => {
      this.client.send('squire.dismiss_list', { npc_id: npcId });
    });
    this.buildingPanel.setOnSquireDismissConfirm((squireId) => {
      this.client.send('squire.dismiss_confirm', { squire_id: squireId });
    });
    this.disassemblyModal = new DisassemblyModal();
    this.disassemblyModal.setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    this.disassemblyModal.setInventorySlotsGetter(() => this.leftPanel.getInventorySlots());
    this.buildingPanel.setOnDisassemblyOpen((npcId) => {
      this.disassemblyModal.open(npcId);
      this.client.send('disassembly.open', { npc_id: npcId });
      // Raise inventory panel above the overlay so drag-and-drop works
      inventoryEl.style.zIndex = '260';
      inventoryEl.style.position = 'relative';
      this.leftPanel.showTab('inventory');
      this.leftPanel.setDragEnabled(true);
    });
    this.disassemblyModal.setOnClose(() => {
      inventoryEl.style.zIndex = '';
      inventoryEl.style.position = '';
      this.leftPanel.setDragEnabled(false);
    });
    this.trainingModal = new TrainingModal(document.getElementById('game')!);
    this.trainingModal.setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    this.buildingPanel.setOnTrainingOpen((npcId) => {
      this.trainingModal.open(npcId);
      this.client.send('training.open', { npc_id: npcId });
    });
    this.statTrainingModal = new StatTrainingModal(document.getElementById('game')!);
    this.statTrainingModal.setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    this.buildingPanel.setOnStatTrainingOpen((npcId, _stat) => {
      this.statTrainingModal.open(npcId);
      this.client.send('stat-training.open', { npc_id: npcId });
    });
    this.buildingPanel.setOnBossChallenge((boss) => {
      this.bossInfoPanel.show(boss, this.getBossTokenCount());
    });
    this.questLog = new QuestLog(document.getElementById('game')!);
    this.questLog.setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    this.questTracker = new QuestTracker(document.getElementById('game')!);
    this.rankingsPanel = new RankingsPanel(document.getElementById('game')!);
    this.rankingsPanel.setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    this.bossInfoPanel = new BossInfoPanel(document.getElementById('game')!);
    this.bossAnnouncementBanner = new BossAnnouncementBanner(document.getElementById('game')!);
    this.bossInfoPanel.onChallenge = (bossId) => {
      this.client.send('boss:challenge', { boss_id: bossId });
    };
    this.buildingPanel.getCraftingModal().setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    this.buildingPanel.getMarketplaceModal().setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    this.buildingPanel.getMarketplaceModal().setInventorySlotsGetter(() => this.leftPanel.getInventorySlots());
    this.buildingPanel.getMarketplaceModal().setOnOpen(() => {
      // Raise inventory panel above the overlay so drag-and-drop works
      inventoryEl.style.zIndex = '260';
      inventoryEl.style.position = 'relative';
      this.leftPanel.showTab('inventory');
      this.leftPanel.setDragEnabled(true);
    });
    this.buildingPanel.getMarketplaceModal().setOnClose(() => {
      inventoryEl.style.zIndex = '';
      inventoryEl.style.position = '';
      this.leftPanel.setDragEnabled(false);
    });
    // Warehouse modal wiring
    const whModal = this.buildingPanel.getWarehouseModal();
    whModal.setSendFn((type, payload) => {
      this.client.send(type, payload);
    });
    // Drop handler on inventory panel for warehouse→inventory withdrawals
    let whDropHandler: ((e: DragEvent) => void) | null = null;
    let whDragOverHandler: ((e: DragEvent) => void) | null = null;
    whModal.setOnOpen(() => {
      inventoryEl.style.zIndex = '260';
      inventoryEl.style.position = 'relative';
      this.leftPanel.showTab('inventory');
      this.leftPanel.setDragEnabled(true);
      // Accept warehouse item drops on inventory panel
      whDragOverHandler = (e: DragEvent) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; };
      whDropHandler = (e: DragEvent) => {
        e.preventDefault();
        const raw = e.dataTransfer?.getData('text/plain');
        if (!raw) return;
        try {
          const data = JSON.parse(raw);
          if (data.warehouse_slot_id !== undefined) {
            const totalQty = data.quantity ?? 1;
            if (data.shift && totalQty > 1) {
              whModal.showQuantityPicker(totalQty, (qty) => {
                this.client.send('warehouse.withdraw', {
                  building_id: whModal.getBuildingId(),
                  warehouse_slot_id: data.warehouse_slot_id,
                  quantity: qty,
                });
              });
            } else {
              this.client.send('warehouse.withdraw', {
                building_id: whModal.getBuildingId(),
                warehouse_slot_id: data.warehouse_slot_id,
                quantity: totalQty,
              });
            }
          }
        } catch { /* ignore */ }
      };
      inventoryEl.addEventListener('dragover', whDragOverHandler);
      inventoryEl.addEventListener('drop', whDropHandler);
    });
    whModal.setOnClose(() => {
      inventoryEl.style.zIndex = '';
      inventoryEl.style.position = '';
      this.leftPanel.setDragEnabled(false);
      if (whDragOverHandler) inventoryEl.removeEventListener('dragover', whDragOverHandler);
      if (whDropHandler) inventoryEl.removeEventListener('drop', whDropHandler);
      whDragOverHandler = null;
      whDropHandler = null;
    });
    this.buildingPanel.setInventorySlotsGetter(() => this.leftPanel.getInventorySlots());
    this.buildingPanel.setOnGatheringStart((payload) => {
      this.client.send('gathering.start', payload);
    });
    this.buildingPanel.setOnGatheringCancel(() => {
      this.client.send('gathering.cancel', {});
    });
    this.buildingPanel.setOnFishingCast((buildingId, actionId) => {
      this.client.send('fishing.cast', { building_id: buildingId, action_id: actionId });
    });
    this.buildingPanel.setOnFishingUpgrade((npcId) => {
      this.client.send('fishing.upgrade_rod', { npc_id: npcId });
    });
    this.buildingPanel.setOnFishingRepair((npcId) => {
      this.client.send('fishing.repair_rod', { npc_id: npcId });
    });

    this.combatScreen = new CombatScreen(() => {
      const combatId = this.combatScreen?.getCombatId();
      if (combatId) {
        let msgType: string;
        if (this.combatScreen?.getVariant() === 'boss') {
          msgType = 'boss:combat_trigger_active';
        } else if (this.inArenaCombat) {
          msgType = 'arena:combat_trigger_active';
        } else {
          msgType = 'combat:trigger_active';
        }
        this.client.send(msgType, { combat_id: combatId });
      }
    });
    this.combatScreen.setOnClose(() => {
      if (this.inArenaCombat || this.arenaPanel?.isOpen()) {
        // Arena combat — don't reopen building panel.
        // If player lost, arena:kicked already hid the panel.
        // If player won, they return to arena lobby.
        return;
      }
      if (this.buildingBeforeCombat) {
        this.buildingPanel.show(
          this.buildingBeforeCombat,
          this.expeditionStateByBuilding.get(this.buildingBeforeCombat.id),
        );
        this.buildingBeforeCombat = null;
      }
    });

    void this.client.connect().then(() => {
      this.registerHandlers();
      // Request loadout state on init (server also pushes it on login, this is a fallback)
      this.client.send('loadout:request', {});
    });

    // Camera and world bounds set after world.state arrives
    this.cameras.main.setBackgroundColor('#1a1814');
  }

  private registerHandlers(): void {
    this.client.on<WorldStatePayload>('world.state', (payload) => {
      const isTravelArrival = this.awaitingTravelWorldState;
      this.awaitingTravelWorldState = false;
      this.awaitingWorldState = false;

      // Load UI icons from world state
      const uiIcons = (payload as any).ui_icons;
      if (uiIcons) {
        setUiIcons(uiIcons.xp_icon_url ?? null, uiIcons.crowns_icon_url ?? null, uiIcons.rod_upgrade_points_icon_url ?? null);
      }

      this.myCharacter = payload.my_character;
      this.rankingsPanel.setMyCharacterId(payload.my_character.id);

      if (isTravelArrival) {
        // Teardown old city map objects before rebuilding
        this.cityBgSprite?.destroy();
        this.cityBgSprite = null;
        this.cityBuildingLabels.forEach((l) => l.destroy());
        this.cityBuildingLabels = [];
        this.cityHotspotGraphics?.destroy();
        this.cityHotspotGraphics = null;
        this.setMapVignette(false);
        this.cityNodeMarkers.forEach((m) => m.destroy());
        this.cityNodeMarkers = [];
        this.pathPreviewGraphics?.destroy();
        this.pathPreviewGraphics = null;
        this.remotePlayers.forEach((c) => c.destroy());
        this.remotePlayers.clear();
        this.clearBossSprites();
        this.bossInfoPanel.hide();
        this.buildingPanel.hide();
      }

      if (payload.map_type === 'city' && payload.city_map) {
        this.isCityMap = true;
        this.cityMapData = payload.city_map;
        this.buildCityAdjacency();
        if (isTravelArrival) {
          this.buildCityMapWithFadeIn(payload);
        } else {
          this.buildCityMap(payload);
        }
      } else {
        this.isCityMap = false;
        this.cityMapData = null;
        this.buildMap(payload.zone_id);
        this.setupInput();
      }

      this.placeMyCharacter();
      this.buildStatsBar();

      // If an arena:entered payload was deferred (reconnect), show it now
      if (this.pendingArenaPayload) {
        const p = this.pendingArenaPayload;
        this.pendingArenaPayload = null;
        this.openArenaPanel(p);
      }

      // Place other players
      for (const p of payload.players) {
        this.spawnRemotePlayer(p);
      }

      // Flush any player.entered_zone events that arrived before this world.state
      this.pendingEnteredZone.splice(0).forEach((ev) => this.spawnRemotePlayer(ev.character));

      // Spawn boss sprites on city maps
      this.clearBossSprites();
      if (this.isCityMap && payload.bosses) {
        this.currentBosses = payload.bosses;
        this.spawnBossSprites(payload.bosses);
        this.buildingPanel.setBossBlockers(payload.bosses);
      } else {
        this.currentBosses = [];
        this.buildingPanel.setBossBlockers([]);
      }

      // Mount / update DayNightBar
      const gameEl = document.getElementById('canvas-area') ?? document.getElementById('game')!;
      if (!this.dayNightBar) {
        this.dayNightBar = new DayNightBar(gameEl);
      }
      this.dayNightBar.update(payload.day_night_state);
    });

    this.client.on<PlayerMovedPayload>('player.moved', (payload) => {
      if (this.isCityMap) return; // City maps use city.player_moved

      if (payload.character_id === this.myCharacter?.id) {
        this.myCharacter.pos_x = payload.pos_x;
        this.myCharacter.pos_y = payload.pos_y;
        this.playerAnimSprite.setPosition(
          payload.pos_x * TILE_SIZE + TILE_SIZE / 2,
          payload.pos_y * TILE_SIZE + TILE_SIZE / 2,
        );
      } else {
        const container = this.remotePlayers.get(payload.character_id);
        container?.setPosition(
          payload.pos_x * TILE_SIZE + TILE_SIZE / 2,
          payload.pos_y * TILE_SIZE + TILE_SIZE / 2,
        );
      }
    });

    this.client.on<PlayerMoveRejectedPayload>('player.move_rejected', (payload) => {
      if (this.isCityMap) return; // City maps use city.move_rejected

      // Roll back predicted position — direction intentionally NOT reset.
      // The player expressed intent to move that way; only position reverts.
      this.myCharacter.pos_x = payload.pos_x;
      this.myCharacter.pos_y = payload.pos_y;
      this.playerAnimSprite.setPosition(
        payload.pos_x * TILE_SIZE + TILE_SIZE / 2,
        payload.pos_y * TILE_SIZE + TILE_SIZE / 2,
      );
      // Visual shake indicator
      this.cameras.main.shake(80, 0.004);
    });

    this.client.on<PlayerEnteredZonePayload>('player.entered_zone', (payload) => {
      if (this.awaitingWorldState) {
        // world.state hasn't arrived yet (initial login or travel) — buffer and replay after
        this.pendingEnteredZone.push(payload);
        return;
      }
      this.spawnRemotePlayer(payload.character);
    });

    this.client.on<PlayerLeftZonePayload>('player.left_zone', (payload) => {
      this.removeRemotePlayer(payload.character_id);
    });

    this.client.on<{ code: string; message: string }>('server.error', (payload) => {
      this.combatLog.appendError(payload.message);
    });

    this.client.on<{ current_hp: number; max_hp: number }>('character.hp_changed', (payload) => {
      if (this.myCharacter) {
        this.myCharacter.current_hp = payload.current_hp;
        this.myCharacter.max_hp = payload.max_hp;
        this.statsBar?.setHp(payload.current_hp, payload.max_hp);
        this.syncExpandedStats();
      }
    });

    this.client.on<CharacterLevelledUpPayload>('character.levelled_up', (payload) => {
      if (this.myCharacter) {
        this.myCharacter.level = payload.new_level;
        this.myCharacter.experience = payload.new_experience;
        this.myCharacter.stat_points_unspent = payload.stat_points_unspent;
        this.statsBar.setLevel(payload.new_level);
        const nextThreshold = XP_THRESHOLDS[payload.new_level] ?? 9999;
        this.statsBar.setXp(payload.new_experience, nextThreshold);
        this.statsBar.setUnspentPoints(payload.stat_points_unspent);
        this.syncExpandedStats();
        this.chatBox.addSystemMessage(`Level up! You gained ${payload.stat_points_gained} stat points. Visit a trainer to allocate them.`);
      }
    });

    this.client.on<ChatMessagePayload>('chat.message', (payload) => {
      this.chatBox.appendMessage(payload.channel as 'local' | 'global', payload.sender_name, payload.message, payload.timestamp);
    });

    this.client.on<AdminCommandResultPayload>('admin.command_result', (payload) => {
      this.chatBox.addAdminMessage(payload.success, payload.message);
    });

    this.client.on<CharacterCrownsChangedPayload>('character.crowns_changed', (payload) => {
      if (this.myCharacter) {
        this.myCharacter.crowns = payload.crowns;
        this.statsBar.setCrowns(payload.crowns);
        this.syncExpandedStats();
      }
    });

    this.client.on<DayNightStateDto>('world.day_night_changed', (payload) => {
      this.dayNightBar?.update(payload);
    });

    this.client.on<NightEncounterResultPayload>('night.encounter_result', (payload) => {
      // Reuse the explore CombatModal — adapt payload to the expected shape (action_id unused by modal)
      this.buildingPanel.showExploreResult({ action_id: 0, ...payload });
      if (payload.combat_result === 'win' && payload.crowns_gained && payload.crowns_gained > 0 && this.myCharacter) {
        this.myCharacter.crowns += payload.crowns_gained;
        this.statsBar.setCrowns(this.myCharacter.crowns);
      }
    });

    // ── City-specific handlers ──────────────────────────────────────

    this.client.on<CityPlayerMovedPayload>('city.player_moved', (payload) => {
      this.clearPathPreview();

      if (payload.character_id === this.myCharacter?.id) {
        this.myCharacter.current_node_id = payload.node_id;
        // Close building panel when player moves away
        this.buildingPanel.hide();

        const dir = this.pixelDir(
          this.playerAnimSprite.x, this.playerAnimSprite.y,
          payload.x, payload.y,
        );
        this.playerAnimSprite.setDirection(dir);
        this.playerAnimSprite.setAnimation('walk');
        this.movingTweenCount++;

        this.tweens.add({
          targets: this.playerAnimSprite,
          x: payload.x,
          y: payload.y,
          duration: 250,
          ease: 'Sine.easeInOut',
          onComplete: () => {
            this.movingTweenCount--;
            if (this.movingTweenCount === 0) {
              this.playerAnimSprite.setAnimation('breathing-idle');
            }
          },
        });
      } else {
        const container = this.remotePlayers.get(payload.character_id);
        if (container) {
          this.tweens.add({
            targets: container,
            x: payload.x,
            y: payload.y,
            duration: 250,
            ease: 'Sine.easeInOut',
          });
        }
      }
    });

    this.client.on<CityMoveRejectedPayload>('city.move_rejected', (payload) => {
      this.clearPathPreview();
      this.pendingBuildingId = null;

      // Snap back to current node
      const node = this.cityMapData?.nodes.find(n => n.id === payload.current_node_id);
      if (node) {
        this.myCharacter.current_node_id = payload.current_node_id;
        this.playerAnimSprite.setPosition(node.x, node.y);
      }
      this.cameras.main.shake(80, 0.004);
    });

    this.client.on<CityBuildingArrivedPayload>('city.building_arrived', (payload) => {
      this.pendingBuildingId = null;
      // Store all expedition states
      const allStates: ExpeditionStateDto[] = (payload as any).expedition_states ?? [];
      if (allStates.length === 0 && payload.expedition_state) {
        allStates.push(payload.expedition_state);
      }
      if (allStates.length > 0) {
        this.expeditionStateByBuilding.set(payload.building_id, allStates[0]!);
      }
      const building = this.cityMapData?.buildings.find((b) => b.id === payload.building_id);
      if (building) {
        this.buildingPanel.showWithStates(building, allStates);
      }
    });

    this.client.on<CityBuildingActionRejectedPayload>('city.building_action_rejected', (payload) => {
      if (this.awaitingTravelWorldState) {
        this.cameras.main.fadeIn(300, 0, 0, 0);
        this.awaitingTravelWorldState = false;
        this.awaitingWorldState = false;
      }
      this.buildingPanel.showRejection(payload.reason);
    });

    this.client.on<BuildingExploreResultPayload>('building.explore_result', (payload) => {
      // combat_started: combat screen takes over — no modal needed
      if (payload.outcome === 'combat_started') return;

      this.buildingPanel.showExploreResult(payload);
      if (payload.combat_result === 'win' && payload.crowns_gained && payload.crowns_gained > 0 && this.myCharacter) {
        this.myCharacter.crowns += payload.crowns_gained;
        this.statsBar.setCrowns(this.myCharacter.crowns);
      }
    });

    // Inventory handlers
    this.client.on<InventoryStatePayload>('inventory.state', (payload) => {
      this.leftPanel.onInventoryState(payload);

      // Update arena token count if arena panel is open
      if (this.arenaPanel?.isOpen()) {
        const tokenSlot = payload.slots.find(s => s.definition.name === 'Arena Challenge Token');
        this.arenaPanel.updateTokenCount(tokenSlot?.quantity ?? 0);
      }

      // Re-render building panel if open so gather sections pick up the updated inventory
      const bld = this.buildingPanel.getCurrentBuilding();
      if (bld && !this.buildingPanel.isGatheringActive()) {
        this.buildingPanel.show(bld, this.expeditionStateByBuilding.get(bld.id));
      }
    });

    this.client.on<InventoryItemDeletedPayload>('inventory.item_deleted', (payload) => {
      this.leftPanel.onInventoryItemDeleted(payload.slot_id);
    });

    this.client.on<InventoryDeleteRejectedPayload>('inventory.delete_rejected', (payload) => {
      this.leftPanel.showDeleteError(payload.slot_id);
    });

    this.client.on<InventoryItemReceivedPayload>('inventory.item_received', (payload) => {
      this.leftPanel.onInventoryItemReceived(payload);
    });

    this.client.on<InventoryFullPayload>('inventory.full', (payload) => {
      this.chatBox.addSystemMessage(`Inventory full — could not receive ${payload.item_name}`);
      this.leftPanel.onInventoryFull(payload);
    });

    // Equipment handlers
    this.client.on<EquipmentStatePayload>('equipment.state', (payload) => {
      this.leftPanel.onEquipmentState(payload);
    });

    this.client.on<EquipmentChangedPayload>('equipment.changed', (payload) => {
      this.leftPanel.onEquipmentChanged(payload);
      this.statsBar.updateStats(payload.effective_attack, payload.effective_defence);
      if (this.myCharacter) {
        this.myCharacter.attack_power = payload.effective_attack;
        this.myCharacter.defence = payload.effective_defence;
      }
      this.statsBar.setEffectiveStats(payload.effective_attack, payload.effective_defence);
    });

    this.client.on<EquipmentEquipRejectedPayload>('equipment.equip_rejected', (payload) => {
      this.leftPanel.onEquipRejected(payload);
    });

    this.client.on<EquipmentUnequipRejectedPayload>('equipment.unequip_rejected', (payload) => {
      this.leftPanel.onUnequipRejected(payload);
    });

    // Expedition handlers
    this.client.on<ExpeditionDispatchedPayload>('expedition.dispatched', (payload) => {
      this.buildingPanel.showExpeditionDispatched(payload);
    });

    this.client.on<ExpeditionDispatchRejectedPayload>('expedition.dispatch_rejected', (payload) => {
      this.buildingPanel.showExpeditionRejection(payload.reason);
    });

    this.client.on<ExpeditionCompletedPayload>('expedition.completed', (payload) => {
      this.chatBox.addSystemMessage(
        `${payload.squire_name} finished expedition at ${payload.building_name}. Visit the building to collect rewards.`,
      );
      this.buildingPanel.handleExpeditionCompleted(payload);
    });

    this.client.on<ExpeditionCollectResultPayload>('expedition.collect_result', (payload) => {
      this.buildingPanel.showExpeditionCollectResult(payload);
    });

    this.client.on<ExpeditionCollectRejectedPayload>('expedition.collect_rejected', (payload) => {
      const messages: Record<string, string> = {
        NOT_FOUND: 'Expedition not found.',
        NOT_OWNER: 'This is not your expedition.',
        NOT_COMPLETE: 'The expedition has not finished yet.',
        ALREADY_COLLECTED: 'Rewards already collected.',
      };
      this.chatBox.addSystemMessage(messages[payload.reason] ?? 'Could not collect expedition rewards.');
    });

    // Squire roster handlers
    this.client.on<SquireRosterDto>('squire.roster_update', (payload) => {
      this.leftPanel.updateSquireRoster(payload);
      this.buildingPanel.updateSquireRoster(payload);
    });

    this.client.on<SquireAcquiredPayload>('squire.acquired', (payload) => {
      this.chatBox.addSystemMessage(
        `You obtained a new squire: ${payload.squire.name} (${payload.squire.rank})!`,
      );
      this.leftPanel.updateSquireRoster(payload.updated_roster);
      this.buildingPanel.updateSquireRoster(payload.updated_roster);
    });

    this.client.on<SquireAcquisitionFailedPayload>('squire.acquisition_failed', (payload) => {
      this.chatBox.addSystemMessage(
        `Could not obtain squire ${payload.squire_name} — your squire roster is full.`,
      );
    });

    this.client.on<SquireDismissListResultPayload>('squire.dismiss_list_result', (payload) => {
      this.buildingPanel.showSquireDismissList(payload.squires);
    });

    this.client.on<SquireDismissedPayload>('squire.dismissed', (payload) => {
      this.chatBox.addSystemMessage(`Squire ${payload.squire_name} has been dismissed.`);
      this.leftPanel.updateSquireRoster(payload.updated_roster);
      this.buildingPanel.updateSquireRoster(payload.updated_roster);
      if (this.buildingPanel && this.buildingPanel['currentBuilding']) {
        this.buildingPanel['renderBuilding'](
          this.buildingPanel['currentBuilding'],
        );
      }
    });

    this.client.on<SquireDismissRejectedPayload>('squire.dismiss_rejected', (payload) => {
      const messages: Record<string, string> = {
        NOT_FOUND: 'Squire not found.',
        ON_EXPEDITION: 'Cannot dismiss a squire that is on expedition.',
        NOT_AT_NPC: 'You must be at a dismisser NPC.',
        NPC_NOT_DISMISSER: 'This NPC does not handle squire dismissal.',
      };
      this.chatBox.addSystemMessage(messages[payload.reason] ?? 'Cannot dismiss squire.');
    });

    // Crafting handlers
    this.client.on<CraftingStatePayload>('crafting.state', (payload) => {
      this.buildingPanel.getCraftingModal().handleState(payload);
    });
    this.client.on<CraftingStartedPayload>('crafting.started', (payload) => {
      this.buildingPanel.getCraftingModal().handleStarted(payload);
      if (this.myCharacter) this.myCharacter.crowns = payload.new_crowns;
      this.statsBar?.setCrowns(payload.new_crowns);
      this.leftPanel.onInventoryState({ slots: payload.updated_slots, capacity: 20 });
    });
    this.client.on<CraftingCancelledPayload>('crafting.cancelled', (payload) => {
      this.buildingPanel.getCraftingModal().handleCancelled(payload);
      if (this.myCharacter) this.myCharacter.crowns = payload.new_crowns;
      this.statsBar?.setCrowns(payload.new_crowns);
      this.leftPanel.onInventoryState({ slots: payload.updated_slots, capacity: 20 });
    });
    this.client.on<CraftingCollectedPayload>('crafting.collected', (payload) => {
      this.buildingPanel.getCraftingModal().handleCollected(payload);
      this.leftPanel.onInventoryState({ slots: payload.updated_slots, capacity: 20 });
    });
    this.client.on<CraftingRejectedPayload>('crafting.rejected', (payload) => {
      this.buildingPanel.getCraftingModal().handleRejected(payload);
    });
    this.client.on<CraftingSessionsUpdatedPayload>('crafting.sessions_updated', (payload) => {
      this.chatBox.addSystemMessage(payload.message);
      // Refresh crafting modal if open
      const modal = this.buildingPanel.getCraftingModal();
      if (modal.isOpen()) {
        this.client.send('crafting.open', { npc_id: modal.getNpcId() });
      }
    });

    // Marketplace handlers
    const mktModal = this.buildingPanel.getMarketplaceModal();
    this.client.on<MarketplaceBrowseResultPayload>('marketplace.browse_result', (payload) => {
      mktModal.handleBrowseResult(payload);
    });
    this.client.on<MarketplaceItemListingsResultPayload>('marketplace.item_listings_result', (payload) => {
      mktModal.handleItemListingsResult(payload);
    });
    this.client.on<MarketplaceBuyResultPayload>('marketplace.buy_result', (payload) => {
      mktModal.handleBuyResult(payload);
      if (payload.success && payload.new_crowns !== undefined) {
        if (this.myCharacter) this.myCharacter.crowns = payload.new_crowns;
        this.statsBar?.setCrowns(payload.new_crowns);
      }
    });
    this.client.on<MarketplaceListItemResultPayload>('marketplace.list_item_result', (payload) => {
      mktModal.handleListItemResult(payload);
      if (payload.success && payload.new_crowns !== undefined) {
        if (this.myCharacter) this.myCharacter.crowns = payload.new_crowns;
        this.statsBar?.setCrowns(payload.new_crowns);
      }
    });
    this.client.on<MarketplaceCancelResultPayload>('marketplace.cancel_result', (payload) => {
      mktModal.handleCancelResult(payload);
    });
    this.client.on<MarketplaceMyListingsResultPayload>('marketplace.my_listings_result', (payload) => {
      mktModal.handleMyListingsResult(payload);
    });
    this.client.on<MarketplaceCollectCrownsResultPayload>('marketplace.collect_crowns_result', (payload) => {
      mktModal.handleCollectCrownsResult(payload);
      if (payload.success) {
        if (this.myCharacter) this.myCharacter.crowns = payload.new_crowns;
        this.statsBar?.setCrowns(payload.new_crowns);
      }
    });
    this.client.on<MarketplaceCollectItemsResultPayload>('marketplace.collect_items_result', (payload) => {
      mktModal.handleCollectItemsResult(payload);
    });
    this.client.on<MarketplaceRejectedPayload>('marketplace.rejected', (payload) => {
      mktModal.handleRejected(payload);
    });

    // Warehouse handlers
    const whm = this.buildingPanel.getWarehouseModal();
    this.client.on<WarehouseStatePayload>('warehouse.state', (payload) => {
      if (this.myCharacter) {
        whm.setPlayerCrowns(this.myCharacter.crowns);
      }
      whm.handleState(payload);
    });
    this.client.on<WarehouseRejectedPayload>('warehouse.rejected', (payload) => {
      whm.handleRejected(payload);
    });
    this.client.on<WarehouseBulkResultPayload>('warehouse.bulk_result', (payload) => {
      whm.handleBulkResult(payload);
    });
    this.client.on<WarehouseBuySlotResultPayload>('warehouse.buy_slot_result', (payload) => {
      whm.handleBuySlotResult(payload);
      if (payload.success) {
        if (this.myCharacter) this.myCharacter.crowns = payload.new_crowns;
        this.statsBar?.setCrowns(payload.new_crowns);
      }
    });

    // Quest handlers
    this.client.on<QuestAvailableListPayload>('quest.available_list', (payload) => {
      this.questPanel.handleAvailableList(payload);
    });
    this.client.on<QuestAcceptedPayload>('quest.accepted', (payload) => {
      this.questPanel.handleAccepted(payload);
      this.questLog.handleQuestAccepted(payload.quest);
      this.questTracker.addQuest(payload.quest);
    });
    this.client.on<QuestCompletedPayload>('quest.completed', (payload) => {
      this.questPanel.handleCompleted(payload);
      this.questTracker.removeQuest(payload.character_quest_id);
      if (this.myCharacter) this.myCharacter.crowns = payload.new_crowns;
      this.statsBar?.setCrowns(payload.new_crowns);
      this.leftPanel.onInventoryState({ slots: payload.updated_slots, capacity: 20 });
      const newPts = (payload as any).new_rod_upgrade_points;
      if (newPts != null && this.myCharacter) {
        this.myCharacter.rod_upgrade_points = newPts;
        this.syncExpandedStats();
      }
    });
    this.client.on<QuestProgressPayload>('quest.progress', (payload) => {
      this.questPanel.handleProgress(payload);
      this.questLog.handleProgress(payload);
      this.questTracker.handleProgress(payload);
      if (payload.quest_complete) {
        this.chatBox.addSystemMessage('Quest ready to turn in! Return to the quest giver.');
      }
    });
    this.client.on<QuestRejectedPayload>('quest.rejected', (payload) => {
      this.questPanel.handleRejected(payload);
    });
    this.client.on<QuestAbandonedPayload>('quest.abandoned', (payload) => {
      this.questLog.handleAbandoned(payload);
      this.questTracker.removeQuest(payload.character_quest_id);
    });
    this.client.on<QuestLogPayload>('quest.log', (payload) => {
      this.questLog.handleQuestLog(payload);
      this.questTracker.updateFromQuestLog(payload.active_quests);
    });
    this.client.on<QuestNpcDialogsResponsePayload>('quest.npc_dialogs', (payload) => {
      this.buildingPanel.handleNpcDialogs(payload.npc_id, payload.dialogs);
    });
    this.client.on<QuestTalkCompletedPayload>('quest.talk_completed', (payload) => {
      this.buildingPanel.handleTalkCompleted(payload.dialog_response);
      if (payload.quest_complete) {
        this.chatBox.addSystemMessage('Quest ready to turn in! Return to the quest giver.');
      }
    });

    // Gathering handlers
    this.client.on<GatheringStartedPayload>('gathering.started', (payload) => {
      this.buildingPanel.handleGatheringStarted(payload);
    });
    this.client.on<GatheringTickPayload>('gathering.tick', (payload) => {
      this.buildingPanel.handleGatheringTick(payload);
      if (payload.event.type === 'accident' && payload.event.hp_damage) {
        if (this.myCharacter) this.myCharacter.current_hp = payload.current_hp;
        this.statsBar?.setHp(payload.current_hp, this.myCharacter?.max_hp ?? 0);
      }
    });
    this.client.on<GatheringEndedPayload>('gathering.ended', (payload) => {
      this.gatheringCombatActive = false;
      this.buildingPanel.handleGatheringEnded(payload);
    });
    this.client.on<GatheringRejectedPayload>('gathering.rejected', (payload) => {
      this.buildingPanel.handleGatheringRejected(payload);
    });
    this.client.on<GatheringCombatPausePayload>('gathering.combat_pause', (payload) => {
      this.gatheringCombatActive = true;
      this.chatBox.addSystemMessage('A monster attacks during gathering!');
      this.buildingPanel.handleGatheringCombatPause(payload.monster_name, payload.monster_icon_url ?? null);
    });
    this.client.on<GatheringCombatResumePayload>('gathering.combat_resume', (payload) => {
      this.gatheringCombatActive = false;
      this.chatBox.addSystemMessage(`Combat resolved (${payload.combat_result}). Gathering resumes...`);
      if (this.myCharacter) this.myCharacter.current_hp = payload.current_hp;
      this.statsBar?.setHp(payload.current_hp, this.myCharacter?.max_hp ?? 0);
      this.buildingPanel.handleGatheringCombatResume();
    });

    // Fishing handlers
    this.client.on<FishingSessionStartPayload>('fishing.session_start', (payload) => {
      if (!this.fishingMinigame) {
        this.fishingMinigame = new FishingMinigame(this.client);
      }
      this.fishingMinigame.onSessionStart(payload);
    });
    this.client.on<FishingResultPayload>('fishing.result', (payload) => {
      this.fishingMinigame?.onResult(payload);
      if (payload.success && payload.fish_name) {
        this.chatBox.addSystemMessage(`You caught a ${payload.fish_name}!`);
      }
    });
    this.client.on<FishingRejectedPayload>('fishing.rejected', (payload) => {
      this.fishingMinigame?.onRejected(payload);
      this.chatBox.addSystemMessage(payload.message);
    });
    this.client.on<FishingUpgradeResultPayload>('fishing.upgrade_result', (payload) => {
      if (payload.success) {
        this.chatBox.addSystemMessage(`Rod upgraded to tier ${payload.new_tier}! Durability: ${payload.new_durability}/${payload.new_max_durability}. Points remaining: ${payload.points_remaining}.`);
      } else {
        this.chatBox.addSystemMessage(`Upgrade failed: ${payload.reason ?? 'Unknown reason'}`);
      }
    });
    this.client.on<FishingRepairResultPayload>('fishing.repair_result', (payload) => {
      if (payload.success) {
        this.chatBox.addSystemMessage(`Rod repaired! Durability restored to ${payload.new_durability}. Crowns remaining: ${payload.crowns_remaining}.`);
      } else {
        this.chatBox.addSystemMessage(`Repair failed: ${payload.reason ?? 'Unknown reason'}`);
      }
    });

    // Disassembly handlers
    this.client.on<DisassemblyStatePayload>('disassembly.state', (_payload) => {
      // NPC confirmed as disassembler — modal already open from setOnDisassemblyOpen
    });
    this.client.on<DisassemblyPreviewResultPayload>('disassembly.preview_result', (payload) => {
      this.disassemblyModal.handlePreviewResult(payload);
    });
    this.client.on<DisassemblyResultPayload>('disassembly.result', (payload) => {
      this.disassemblyModal.handleResult(payload);
      // Server sends inventory.state automatically after execute — LeftPanel handles it
      if (payload.new_crowns !== undefined) {
        this.myCharacter.crowns = payload.new_crowns;
        this.statsBar.updateCrowns(payload.new_crowns);
      }
    });
    this.client.on<DisassemblyRejectedPayload>('disassembly.rejected', (payload) => {
      this.disassemblyModal.handleRejected(payload);
    });

    // Training (stat allocation) handlers
    this.client.on<TrainingStatePayload>('training.state', (payload) => {
      this.trainingModal.handleState(payload);
    });
    this.client.on<TrainingResultPayload>('training.result', (payload) => {
      this.trainingModal.handleResult(payload);
      if (this.myCharacter) {
        this.myCharacter.max_hp = payload.new_max_hp;
        this.myCharacter.attack_power = payload.new_attack_power;
        this.myCharacter.defence = payload.new_defence;
        this.myCharacter.attr_constitution = payload.attributes.constitution;
        this.myCharacter.attr_strength = payload.attributes.strength;
        this.myCharacter.attr_intelligence = payload.attributes.intelligence;
        this.myCharacter.attr_dexterity = payload.attributes.dexterity;
        this.myCharacter.attr_toughness = payload.attributes.toughness;
        this.myCharacter.stat_points_unspent = payload.unspent_points;
        this.statsBar.setHp(this.myCharacter.current_hp, payload.new_max_hp);
        this.statsBar.updateStats(payload.new_attack_power, payload.new_defence);
        this.statsBar.setUnspentPoints(payload.unspent_points);
        this.syncExpandedStats();
      }
    });
    this.client.on<TrainingErrorPayload>('training.error', (payload) => {
      this.trainingModal.handleError(payload.message);
    });

    // Stat training (consumable item) handlers
    this.client.on<StatTrainingStatePayload>('stat-training.state', (payload) => {
      this.statTrainingModal.handleState(payload);
    });
    this.client.on<StatTrainingResultPayload>('stat-training.result', (payload) => {
      this.statTrainingModal.handleResult(payload);
      if (payload.success && this.myCharacter) {
        // Update the trained attribute on myCharacter
        const attrKey = `attr_${payload.stat_name}` as keyof typeof this.myCharacter;
        if (attrKey in this.myCharacter) {
          (this.myCharacter as unknown as Record<string, unknown>)[attrKey] = payload.new_value;
        }
        this.syncExpandedStats();
      }
    });
    this.client.on<StatTrainingErrorPayload>('stat-training.error', (payload) => {
      this.statTrainingModal.handleError(payload.message);
    });

    // Skill book handlers
    this.client.on<{ ability_name: string; points_gained: number; leveled_up: boolean; new_level: number }>('skill-book.result', (payload) => {
      let msg = `${payload.ability_name}: +${payload.points_gained} points`;
      if (payload.leveled_up) {
        msg += ` — LEVEL UP! ${payload.ability_name} is now level ${payload.new_level}`;
      }
      this.chatBox.addSystemMessage(msg);
    });
    this.client.on<{ message: string }>('skill-book.error', (payload) => {
      this.chatBox.addSystemMessage(payload.message);
    });

    // Rankings handler
    this.client.on<RankingsDataPayload>('rankings.data', (payload) => {
      this.rankingsPanel.handleRankingsData(payload);
    });

    // Combat handlers
    this.client.on<CombatStartPayload>('combat:start', (payload) => {
      if (this.gatheringCombatActive) {
        // During gathering: embed combat inside the gathering modal
        const container = this.buildingPanel.getGatheringModal().enterCombatMode();
        this.leftPanel.setLoadoutLocked(true);
        this.combatScreen?.openEmbedded(payload, container);
      } else {
        this.buildingBeforeCombat = this.buildingPanel.getCurrentBuilding();
        this.buildingPanel.hide();
        this.leftPanel.setLoadoutLocked(true);
        this.combatScreen?.open(payload);
      }
    });

    this.client.on<CombatTurnResultPayload>('combat:turn_result', (payload) => {
      this.combatScreen?.applyTurnResult(payload);
    });

    this.client.on<CombatActiveWindowPayload>('combat:active_window', (payload) => {
      this.combatScreen?.openActiveWindow(payload);
    });

    this.client.on<CombatEndPayload>('combat:end', (payload) => {
      // Update HP in character state and stats bar
      if (this.myCharacter) this.myCharacter.current_hp = payload.current_hp;
      this.statsBar?.setHp(payload.current_hp, this.myCharacter?.max_hp ?? 0);

      if (this.gatheringCombatActive) {
        // During gathering: auto-close combat (no rewards screen), show loot in gathering log
        this.combatScreen?.close();
        this.buildingPanel.addGatheringCombatLoot({
          outcome: payload.outcome,
          xp_gained: payload.xp_gained,
          crowns_gained: payload.crowns_gained,
          items_dropped: payload.items_dropped.map((d) => ({ name: d.name, quantity: d.quantity, icon_url: d.icon_url })),
        });
        this.leftPanel.setLoadoutLocked(false);
      } else {
        this.combatScreen?.showOutcome(payload);
        this.leftPanel.setLoadoutLocked(false);
      }
    });

    // Boss combat handlers
    this.client.on<BossCombatStartPayload>('boss:combat_start', (payload) => {
      this.buildingBeforeCombat = this.buildingPanel.getCurrentBuilding();
      this.buildingPanel.hide();
      this.leftPanel.setLoadoutLocked(true);
      this.combatScreen?.showBoss(payload);
    });

    this.client.on<BossCombatTurnResultPayload>('boss:combat_turn_result', (payload) => {
      this.combatScreen?.updateBossTurn(payload);
    });

    this.client.on<BossCombatActiveWindowPayload>('boss:combat_active_window', (payload) => {
      this.combatScreen?.openActiveWindow(payload);
    });

    this.client.on<BossCombatEndPayload>('boss:combat_end', (payload) => {
      // Update HP in character state and stats bar
      if (this.myCharacter) this.myCharacter.current_hp = payload.current_hp;
      this.statsBar?.setHp(payload.current_hp, this.myCharacter?.max_hp ?? 0);

      this.combatScreen?.showBossEnd(payload);
      this.leftPanel.setLoadoutLocked(false);
    });

    this.client.on('connection_lost', () => {
      // Clear before close so the onClose callback does not re-open the building panel
      this.buildingBeforeCombat = null;
      this.combatScreen?.close();
      this.leftPanel.setLoadoutLocked(false);
    });

    // Loadout handlers
    this.client.on<LoadoutStatePayload>('loadout:state', (payload) => {
      this.leftPanel.updateLoadout(payload);
    });

    this.client.on<LoadoutUpdatedPayload>('loadout:updated', (_payload) => {
      // Full state refresh is sent alongside loadout:updated — handled by loadout:state handler above
    });

    this.client.on<LoadoutUpdateRejectedPayload>('loadout:update_rejected', (payload) => {
      this.leftPanel.handleLoadoutUpdateRejected(payload);
    });

    // Boss handlers
    this.client.on<BossStatePayload>('boss:state', (payload) => {
      this.handleBossStateUpdate(payload);
    });

    this.client.on<BossChallengeRejectedPayload>('boss:challenge_rejected', (payload) => {
      this.chatBox.addSystemMessage(payload.message);
    });

    this.client.on<import('../../../shared/protocol/index').BossAnnouncementPayload>('boss:announcement', (payload) => {
      this.bossAnnouncementBanner.show(payload);
    });

    // Arena handlers
    this.client.on<{ action_id: number }>('arena.open', (payload) => {
      this.client.send('arena:enter', { action_id: payload.action_id });
    });

    this.client.on<ArenaEnteredPayload>('arena:entered', (payload) => {
      if (!this.myCharacter) {
        // world.state hasn't arrived yet (reconnect into arena) — defer
        this.pendingArenaPayload = payload;
        return;
      }
      this.openArenaPanel(payload);
    });

    this.client.on<ArenaLeftPayload>('arena:left', (_payload) => {
      this.arenaPanel?.hide();
    });

    this.client.on<ArenaEnterRejectedPayload>('arena:enter_rejected', (payload) => {
      this.chatBox.addSystemMessage(payload.message);
    });

    this.client.on<ArenaLeaveRejectedPayload>('arena:leave_rejected', (payload) => {
      this.chatBox.addSystemMessage(payload.message);
    });

    this.client.on<ArenaPlayerEnteredPayload>('arena:player_entered', (payload) => {
      this.arenaPanel?.addParticipant(payload.participant);
    });

    this.client.on<ArenaPlayerLeftPayload>('arena:player_left', (payload) => {
      this.arenaPanel?.removeParticipant(payload.character_id);
    });

    this.client.on<ArenaParticipantUpdatedPayload>('arena:participant_updated', (payload) => {
      this.arenaPanel?.updateParticipant(payload.character_id, payload.in_combat, payload.current_streak, payload.arena_pvp_wins);
    });

    this.client.on<ArenaKickedPayload>('arena:kicked', (payload) => {
      this.arenaPanel?.hide();
      this.chatBox.addSystemMessage(payload.message);
    });

    this.client.on<{ can_leave_at: string }>('arena:timers_reset', (payload) => {
      this.arenaPanel?.resetLeaveTimer(new Date(payload.can_leave_at));
      this.chatBox.addSystemMessage('Arena timers have been reset by an admin.');
    });

    this.client.on<ArenaChallengeRejectedPayload>('arena:challenge_rejected', (payload) => {
      this.chatBox.addSystemMessage(payload.message);
    });

    // Arena combat uses the same CombatScreen — reuse existing combat handlers
    this.client.on<ArenaCombatStartPayload>('arena:combat_start', (payload) => {
      this.inArenaCombat = true;
      this.leftPanel.setLoadoutLocked(true);
      // Map arena combat payload to CombatStartPayload shape for the combat screen
      const opponentName = payload.is_pvp
        ? `${payload.opponent.name} (Lv.${payload.opponent.level})`
        : payload.opponent.name;
      this.combatScreen?.open({
        combat_id: payload.combat_id,
        monster: {
          id: 0,
          name: opponentName,
          icon_url: payload.opponent.icon_url,
          max_hp: payload.opponent.max_hp,
          attack: payload.opponent.attack,
          defence: payload.opponent.defence,
        },
        player: payload.player,
        loadout: payload.loadout,
        turn_timer_ms: payload.turn_timer_ms,
        active_effects: [],
        initial_enemy_hp: payload.opponent.current_hp,
        fatigue_config: payload.fatigue_config,
      });
    });

    this.client.on<ArenaCombatTurnResultPayload>('arena:combat_turn_result', (payload) => {
      // Map opponent_hp → enemy_hp for the shared CombatScreen
      this.combatScreen?.applyTurnResult({
        combat_id: payload.combat_id,
        turn: payload.turn,
        phase: payload.phase,
        events: payload.events,
        player_hp: payload.player_hp,
        player_mana: payload.player_mana,
        enemy_hp: payload.opponent_hp,
        ability_states: payload.ability_states,
        active_effects: payload.active_effects,
        fatigue_state: payload.fatigue_state,
      });
    });

    this.client.on<ArenaCombatActiveWindowPayload>('arena:combat_active_window', (payload) => {
      this.combatScreen?.openActiveWindow(payload);
    });

    this.client.on<ArenaCombatEndPayload>('arena:combat_end', (payload) => {
      if (this.myCharacter) this.myCharacter.current_hp = payload.current_hp;
      this.statsBar?.setHp(payload.current_hp, this.myCharacter?.max_hp ?? 0);
      this.arenaPanel?.updateHp(payload.current_hp, this.myCharacter?.max_hp ?? 0);

      this.inArenaCombat = false;
      // Map arena outcome values to CombatEndPayload shape
      this.combatScreen?.showOutcome({
        combat_id: payload.combat_id,
        outcome: payload.outcome === 'victory' ? 'win' : 'loss',
        current_hp: payload.current_hp,
        xp_gained: payload.xp_gained,
        crowns_gained: payload.crowns_gained,
        items_dropped: [],
        ability_drops: [],
        monster_name: payload.opponent_name,
        monster_icon_url: null,
      });
      this.leftPanel.setLoadoutLocked(false);
    });
  }

  // ── Tile map rendering ──────────────────────────────────────────

  private buildMap(zoneId: number): void {
    // Placeholder tile rendering — 20x20 grid of colored rectangles
    // Replace with Phaser Tilemap once tileset assets are available
    const mapWidth = 20;
    const mapHeight = 20;

    for (let row = 0; row < mapHeight; row++) {
      for (let col = 0; col < mapWidth; col++) {
        const isBorder = row === 0 || row === mapHeight - 1 || col === 0 || col === mapWidth - 1;
        const color = isBorder ? 0x2d4a2d : 0x3d6b3d;
        this.add.rectangle(
          col * TILE_SIZE + TILE_SIZE / 2,
          row * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE - 1,
          TILE_SIZE - 1,
          color,
        );
      }
    }

    this.cameras.main.setBounds(0, 0, mapWidth * TILE_SIZE, mapHeight * TILE_SIZE);
    void zoneId;
  }

  // ── City map rendering ──────────────────────────────────────────

  private buildCityMap(payload: WorldStatePayload): void {
    const cityMap = payload.city_map!;
    const imageKey = `city_bg_${payload.zone_id}`;

    // Load the city background image dynamically
    this.load.image(imageKey, cityMap.image_url);
    this.load.once('complete', () => {
      // Display background image
      this.cityBgSprite = this.add.sprite(
        cityMap.image_width / 2,
        cityMap.image_height / 2,
        imageKey,
      ).setDepth(0);
      this.cityBgSprite.setDisplaySize(cityMap.image_width, cityMap.image_height);

      // Set camera bounds to image dimensions
      this.cameras.main.setBounds(0, 0, cityMap.image_width, cityMap.image_height);

      // Render vignette overlay
      this.setMapVignette(true);

      // Render building hotspots as subtle highlights
      this.renderBuildingHotspots(cityMap.buildings);

      // Render building name labels
      this.renderBuildingLabels(cityMap.nodes, cityMap.buildings);

      // Render navigable node markers
      this.renderCityNodeMarkers();

      // Set up click-to-move input
      this.setupCityInput();
    });
    this.load.start();
  }

  private buildCityMapWithFadeIn(payload: WorldStatePayload): void {
    const cityMap = payload.city_map!;
    const imageKey = `city_bg_${payload.zone_id}`;

    // If texture already loaded (same zone revisited), skip load
    const startRender = () => {
      this.cityBgSprite = this.add.sprite(
        cityMap.image_width / 2,
        cityMap.image_height / 2,
        imageKey,
      ).setDepth(0);
      this.cityBgSprite.setDisplaySize(cityMap.image_width, cityMap.image_height);

      this.cameras.main.setBounds(0, 0, cityMap.image_width, cityMap.image_height);
      this.setMapVignette(true);
      this.renderBuildingHotspots(cityMap.buildings);
      this.renderBuildingLabels(cityMap.nodes, cityMap.buildings);
      this.renderCityNodeMarkers();
      this.setupCityInput();

      this.cameras.main.fadeIn(600, 0, 0, 0);
    };

    if (this.textures.exists(imageKey)) {
      startRender();
    } else {
      this.load.image(imageKey, cityMap.image_url);
      this.load.once('complete', startRender);
      this.load.start();
    }
  }

  private setMapVignette(visible: boolean): void {
    document.getElementById('map-vignette')?.classList.toggle('visible', visible);
  }

  private renderBuildingHotspots(buildings: CityMapBuilding[]): void {
    this.cityHotspotGraphics = this.add.graphics().setDepth(1);

    for (const building of buildings) {
      if (!building.hotspot) continue;
      const hs = building.hotspot;

      this.cityHotspotGraphics.fillStyle(0xc9a55c, 0.08);
      this.cityHotspotGraphics.lineStyle(1, 0xc9a55c, 0.25);

      if (hs.type === 'rect' && hs.w != null && hs.h != null) {
        this.cityHotspotGraphics.fillRect(hs.x, hs.y, hs.w, hs.h);
        this.cityHotspotGraphics.strokeRect(hs.x, hs.y, hs.w, hs.h);
      } else if (hs.type === 'circle' && hs.r != null) {
        this.cityHotspotGraphics.fillCircle(hs.x, hs.y, hs.r);
        this.cityHotspotGraphics.strokeCircle(hs.x, hs.y, hs.r);
      }
    }
  }

  private renderBuildingLabels(nodes: CityMapNode[], buildings: CityMapBuilding[]): void {
    for (const building of buildings) {
      const node = nodes.find(n => n.id === building.node_id);
      if (!node) continue;

      const label = this.add.text(
        node.x + building.label_x,
        node.y + building.label_y,
        building.name,
        {
          fontFamily: 'Cinzel, serif',
          fontSize: '13px',
          color: '#e8c87a',
          stroke: '#0a0806',
          strokeThickness: 5,
          shadow: {
            offsetX: 0,
            offsetY: 1,
            color: '#000000',
            blur: 4,
            fill: true,
          },
        },
      ).setOrigin(0.5).setDepth(5);

      this.cityBuildingLabels.push(label);
    }
  }

  private renderCityNodeMarkers(): void {
    if (!this.cityMapData) return;

    for (const node of this.cityMapData.nodes) {
      // Visual: small gold dot
      const marker = this.add.circle(node.x, node.y, 5, 0xd4a84b, 0.65).setDepth(2);
      marker.setStrokeStyle(1, 0xf5e099, 0.8);

      // Hit area is larger than the visual to make clicking comfortable
      marker.setInteractive(
        new Phaser.Geom.Circle(0, 0, 20),
        Phaser.Geom.Circle.Contains,
      );

      marker.on('pointerover', () => {
        this.input.setDefaultCursor('pointer');
        this.tweens.killTweensOf(marker);
        this.tweens.add({
          targets: marker,
          scaleX: 1.9,
          scaleY: 1.9,
          duration: 130,
          ease: 'Sine.easeOut',
        });
        marker.setFillStyle(0xffe27a, 0.95);
        marker.setStrokeStyle(1.5, 0xffffff, 0.9);
      });

      marker.on('pointerout', () => {
        this.input.setDefaultCursor('default');
        this.tweens.killTweensOf(marker);
        this.tweens.add({
          targets: marker,
          scaleX: 1,
          scaleY: 1,
          duration: 130,
          ease: 'Sine.easeOut',
        });
        marker.setFillStyle(0xd4a84b, 0.65);
        marker.setStrokeStyle(1, 0xf5e099, 0.8);
      });

      this.cityNodeMarkers.push(marker);
    }
  }

  private buildCityAdjacency(): void {
    this.cityAdjacency.clear();
    if (!this.cityMapData) return;

    for (const node of this.cityMapData.nodes) {
      this.cityAdjacency.set(node.id, []);
    }
    for (const edge of this.cityMapData.edges) {
      this.cityAdjacency.get(edge.from_node_id)?.push(edge.to_node_id);
      this.cityAdjacency.get(edge.to_node_id)?.push(edge.from_node_id);
    }
  }

  private setupCityInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.isCityMap || !this.cityMapData) return;

      const now = Date.now();
      if (now - this.lastMoveSent < this.MOVE_INTERVAL_MS) return;

      // Convert screen coordinates to world coordinates
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const clickX = worldPoint.x;
      const clickY = worldPoint.y;

      // Check if a building hotspot was clicked
      const clickedBuilding = this.findBuildingAtPoint(clickX, clickY);
      if (clickedBuilding) {
        const targetNodeId = clickedBuilding.node_id;
        if (targetNodeId === this.myCharacter.current_node_id) {
          // Already at this building — show panel with cached expedition state if available
          this.buildingPanel.show(clickedBuilding, this.expeditionStateByBuilding.get(clickedBuilding.id));
          return;
        }
        this.pendingBuildingId = clickedBuilding.id;
        this.sendCityMove(targetNodeId);
        return;
      }

      // Check if a node was clicked (within 24px radius)
      const clickedNode = this.findNodeAtPoint(clickX, clickY, 24);
      if (clickedNode) {
        if (clickedNode.id === this.myCharacter.current_node_id) return;
        this.pendingBuildingId = null;
        this.sendCityMove(clickedNode.id);
      }
    });
  }

  private findBuildingAtPoint(x: number, y: number): CityMapBuilding | null {
    if (!this.cityMapData) return null;

    for (const building of this.cityMapData.buildings) {
      if (!building.hotspot) continue;
      const hs = building.hotspot;

      if (hs.type === 'rect' && hs.w != null && hs.h != null) {
        if (x >= hs.x && x <= hs.x + hs.w && y >= hs.y && y <= hs.y + hs.h) {
          return building;
        }
      } else if (hs.type === 'circle' && hs.r != null) {
        const dx = x - hs.x;
        const dy = y - hs.y;
        if (dx * dx + dy * dy <= hs.r * hs.r) {
          return building;
        }
      }
    }
    return null;
  }

  private findNodeAtPoint(x: number, y: number, radius: number): CityMapNode | null {
    if (!this.cityMapData) return null;
    const r2 = radius * radius;

    for (const node of this.cityMapData.nodes) {
      const dx = x - node.x;
      const dy = y - node.y;
      if (dx * dx + dy * dy <= r2) {
        return node;
      }
    }
    return null;
  }

  private sendCityMove(targetNodeId: number): void {
    const currentNodeId = this.myCharacter.current_node_id;
    if (currentNodeId == null) return;

    // Draw path preview
    const path = this.bfsPath(currentNodeId, targetNodeId);
    if (path) {
      this.drawPathPreview(path);
    }

    this.lastMoveSent = Date.now();
    this.client.send('city.move', { target_node_id: targetNodeId });
  }

  private drawPathPreview(nodeIds: number[]): void {
    this.clearPathPreview();
    if (!this.cityMapData || nodeIds.length < 2) return;

    this.pathPreviewGraphics = this.add.graphics().setDepth(7);
    this.pathPreviewGraphics.lineStyle(2, 0xc9a55c, 0.4);

    const firstNode = this.cityMapData.nodes.find(n => n.id === nodeIds[0]);
    if (!firstNode) return;

    this.pathPreviewGraphics.beginPath();
    this.pathPreviewGraphics.moveTo(firstNode.x, firstNode.y);

    for (let i = 1; i < nodeIds.length; i++) {
      const node = this.cityMapData.nodes.find(n => n.id === nodeIds[i]);
      if (node) {
        this.pathPreviewGraphics.lineTo(node.x, node.y);
      }
    }
    this.pathPreviewGraphics.strokePath();
  }

  private clearPathPreview(): void {
    if (this.pathPreviewGraphics) {
      this.pathPreviewGraphics.destroy();
      this.pathPreviewGraphics = null;
    }
  }

  // ── BFS for city map path finding (client-side preview) ─────────

  private bfsPath(startId: number, endId: number): number[] | null {
    if (startId === endId) return [startId];

    const visited = new Set<number>();
    const parent = new Map<number, number>();
    const queue: number[] = [startId];
    visited.add(startId);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.cityAdjacency.get(current) ?? [];

      for (const neighbor of neighbors) {
        if (visited.has(neighbor)) continue;
        visited.add(neighbor);
        parent.set(neighbor, current);

        if (neighbor === endId) {
          // Reconstruct path
          const path: number[] = [];
          let node: number | undefined = endId;
          while (node !== undefined) {
            path.unshift(node);
            node = parent.get(node);
          }
          return path;
        }
        queue.push(neighbor);
      }
    }
    return null; // No path found
  }

  // ── Character placement ─────────────────────────────────────────

  // Additional AnimatedSprite instances (monsters, NPCs, remote players) can be
  // created using the same pattern — just supply a SpriteDefinition from getSprite().
  private placeMyCharacter(): void {
    let x: number;
    let y: number;

    if (this.isCityMap && this.cityMapData) {
      const nodeId = this.myCharacter.current_node_id ?? this.cityMapData.spawn_node_id;
      const node = this.cityMapData.nodes.find(n => n.id === nodeId);
      if (node) {
        x = node.x;
        y = node.y;
      } else {
        // Fallback to spawn node
        const spawn = this.cityMapData.nodes.find(n => n.id === this.cityMapData!.spawn_node_id);
        x = spawn?.x ?? 0;
        y = spawn?.y ?? 0;
      }
    } else {
      x = this.myCharacter.pos_x * TILE_SIZE + TILE_SIZE / 2;
      y = this.myCharacter.pos_y * TILE_SIZE + TILE_SIZE / 2;
    }

    // Destroy any previously-placed sprite (e.g. after zone travel)
    if (this.playerAnimSprite) {
      this.playerAnimSprite.destroy();
    }

    const def = getSprite('medieval_knight')!;
    this.playerAnimSprite = new AnimatedSprite(this, x, y, def);
    this.playerAnimSprite.setAnimation('breathing-idle');
    this.playerAnimSprite.setDirection('south');

    // Name label sits below the 64px sprite (sprite spans -32 to +32 from center)
    const nameLabel = this.add.text(0, 36, this.myCharacter.name, {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#0d0d0d',
      strokeThickness: 4,
    }).setOrigin(0.5, 0);
    this.playerAnimSprite.add(nameLabel);

    this.children.add(this.playerAnimSprite);
    this.playerAnimSprite.setDepth(10);
    this.cameras.main.startFollow(this.playerAnimSprite);
  }

  private syncExpandedStats(): void {
    if (!this.myCharacter) return;
    const c = this.myCharacter;
    const xpThreshold = XP_THRESHOLDS[c.level - 1] ?? 9999;
    this.statsBar.setCharacterData(c, xpThreshold);
  }

  private openArenaPanel(payload: ArenaEnteredPayload): void {
    this.buildingPanel.hide();

    if (!this.arenaPanel) {
      const gameEl = document.getElementById('game')!;
      this.arenaPanel = new ArenaPanel(gameEl, (type, p) => {
        this.client.send(type, p);
      });
      this.arenaPanel.setOnChallengePlayer((targetId) => {
        this.client.send('arena:challenge_player', { target_character_id: targetId });
      });
      this.arenaPanel.setOnChallengeNpc((monsterId) => {
        this.client.send('arena:challenge_npc', { monster_id: monsterId });
      });
      this.arenaPanel.setOnLeave((arenaId) => {
        this.client.send('arena:leave', { arena_id: arenaId });
      });
    }
    this.arenaPanel.show(payload, this.myCharacter?.id ?? '');

    // Set initial token count from current inventory
    const slots = this.leftPanel.getInventorySlots();
    const tokenSlot = slots.find(s => s.definition.name === 'Arena Challenge Token');
    this.arenaPanel.updateTokenCount(tokenSlot?.quantity ?? 0);
  }

  private buildStatsBar(): void {
    this.statsBar?.destroy();
    this.logoutButton?.destroy();

    const c = this.myCharacter;
    const level = c.level;
    const xpThreshold = XP_THRESHOLDS[level - 1] ?? 9999;
    const statsSlot = document.getElementById('stats-slot')!;
    this.statsBar = new StatsBar(
      statsSlot,
      c.name,
      `Class ${c.class_id}`,
      level,
      c.current_hp,
      c.max_hp,
      c.experience,
      xpThreshold,
      c.attack_power,
      c.defence,
      c.crowns,
    );

    // Give StatsBar full character data for the expanded view
    this.statsBar.setCharacterData(c, xpThreshold);
    this.statsBar.setEffectiveStats(c.attack_power, c.defence);
    this.statsBar.setUnspentPoints(c.stat_points_unspent);
    // Tell StatsBar where the tab bar ends so it expands up to that point
    this.statsBar.setExpandTarget(this.leftPanel.getTabsBottom());
    // Collapse expanded stats when any tab button is clicked
    this.leftPanel.setOnTabClick(() => {
      if (this.statsBar.isExpanded()) {
        this.statsBar.collapse();
      }
    });

    this.logoutButton = new LogoutButton(document.getElementById('top-bar')!, () => this.handleLogout());

    // Quest log toggle button in top bar
    const questLogBtn = document.createElement('button');
    questLogBtn.textContent = 'Quests';
    questLogBtn.style.cssText = [
      'position:absolute', 'right:80px', 'top:50%', 'transform:translateY(-50%)',
      'padding:4px 12px', 'background:rgba(90,74,42,0.4)', 'border:1px solid #5a4a2a',
      'color:#e8c870', 'font-family:Cinzel,serif', 'font-size:12px', 'cursor:pointer',
      'border-radius:2px', 'letter-spacing:0.05em',
    ].join(';');
    questLogBtn.addEventListener('click', () => {
      this.questLog.toggle();
      if (this.questLog.isVisible()) {
        this.client.send('quest.log', {});
      }
    });
    document.getElementById('top-bar')!.appendChild(questLogBtn);

    // Rankings toggle button in top bar
    const rankingsBtn = document.createElement('button');
    rankingsBtn.textContent = 'Rankings';
    rankingsBtn.style.cssText = [
      'position:absolute', 'right:160px', 'top:50%', 'transform:translateY(-50%)',
      'padding:4px 12px', 'background:rgba(90,74,42,0.4)', 'border:1px solid #5a4a2a',
      'color:#e8c870', 'font-family:Cinzel,serif', 'font-size:12px', 'cursor:pointer',
      'border-radius:2px', 'letter-spacing:0.05em',
    ].join(';');
    rankingsBtn.addEventListener('click', () => {
      this.rankingsPanel.toggle();
    });
    document.getElementById('top-bar')!.appendChild(rankingsBtn);
  }

  private handleLogout(): void {
    SessionStore.clear();
    this.client.disconnect();
    this.statsBar.destroy();
    this.logoutButton.destroy();
    this.chatBox.destroy();
    this.combatLog.destroy();
    this.buildingPanel.destroy();
    this.dayNightBar?.destroy();
    this.dayNightBar = null;
    this.scene.start('LoginScene');
  }

  private setupInput(): void {
    const keys = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
    }) as Record<string, Phaser.Input.Keyboard.Key>;

    const dirMap: [Phaser.Input.Keyboard.Key, Phaser.Input.Keyboard.Key, string][] = [
      [keys['up']!, keys['w']!, 'n'],
      [keys['down']!, keys['s']!, 's'],
      [keys['left']!, keys['a']!, 'w'],
      [keys['right']!, keys['d']!, 'e'],
    ];

    this.input.keyboard!.on('keydown', () => {
      const now = Date.now();
      if (now - this.lastMoveSent < this.MOVE_INTERVAL_MS) return;

      for (const [k1, k2, dir] of dirMap) {
        if (k1?.isDown || k2?.isDown) {
          this.lastMoveSent = now;
          // Client-side prediction
          const dx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0;
          const dy = dir === 's' ? 1 : dir === 'n' ? -1 : 0;
          this.playerAnimSprite.x += dx * TILE_SIZE;
          this.playerAnimSprite.y += dy * TILE_SIZE;
          // Update sprite facing direction
          this.playerAnimSprite.setDirection(DIR4_TO_DIR8[dir as Direction4]);
          this.client.send('player.move', { direction: dir });
          break;
        }
      }
    });
  }

  // ── Remote players ──────────────────────────────────────────────

  private spawnRemotePlayer(p: PlayerSummary): void {
    if (this.isCityMap && this.cityMapData) {
      const nodeId = p.current_node_id ?? this.cityMapData.spawn_node_id;
      const node = this.cityMapData.nodes.find(n => n.id === nodeId);
      if (node) {
        this.addRemotePlayerAtPixel(p.id, p.name, node.x, node.y);
      }
    } else {
      this.addRemotePlayer(p.id, p.name, p.pos_x, p.pos_y);
    }
  }

  private addRemotePlayer(id: string, name: string, posX: number, posY: number): void {
    if (this.remotePlayers.has(id)) return;

    const x = posX * TILE_SIZE + TILE_SIZE / 2;
    const y = posY * TILE_SIZE + TILE_SIZE / 2;

    const sprite = this.add.rectangle(0, 0, 20, 20, 0x8888ff).setDepth(9);
    const label = this.add.text(0, -20, name, { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5);
    const container = this.add.container(x, y, [sprite, label]).setDepth(9);

    this.remotePlayers.set(id, container);
  }

  private addRemotePlayerAtPixel(id: string, name: string, x: number, y: number): void {
    if (this.remotePlayers.has(id)) return;

    const sprite = this.add.rectangle(0, 0, 20, 20, 0x8888ff).setDepth(9);
    const label = this.add.text(0, -20, name, { fontSize: '10px', color: '#ffffff' }).setOrigin(0.5);
    const container = this.add.container(x, y, [sprite, label]).setDepth(9);

    this.remotePlayers.set(id, container);
  }

  private removeRemotePlayer(id: string): void {
    this.remotePlayers.get(id)?.destroy();
    this.remotePlayers.delete(id);
  }

  // ── Boss system ─────────────────────────────────────────────────

  private spawnBossSprites(bosses: BossDto[]): void {
    if (!this.cityMapData) return;

    for (const boss of bosses) {
      if (boss.status === 'defeated' || boss.status === 'inactive') continue;
      if (this.bossSprites.has(boss.id)) continue;

      // Find the building and its node to get position
      const building = this.cityMapData.buildings.find(b => b.id === boss.building_id);
      if (!building) continue;
      const node = this.cityMapData.nodes.find(n => n.id === building.node_id);
      if (!node) continue;

      const sprite = new BossSprite({
        scene: this,
        boss,
        x: node.x,
        y: node.y - 30, // offset above the node marker
      });
      this.children.add(sprite);
      sprite.loadSprite();

      // Click handler — open boss info panel
      sprite.on('pointerdown', () => {
        const tokenCount = this.getBossTokenCount();
        this.bossInfoPanel.show(sprite.getBossData(), tokenCount);
      });

      this.bossSprites.set(boss.id, sprite);
    }
  }

  private clearBossSprites(): void {
    this.bossSprites.forEach((s) => s.destroy());
    this.bossSprites.clear();
  }

  private handleBossStateUpdate(payload: BossStatePayload): void {
    // Update the cached boss data
    const idx = this.currentBosses.findIndex(b => b.id === payload.boss_id);
    if (idx >= 0) {
      this.currentBosses[idx]!.status = payload.status;
      this.currentBosses[idx]!.fighting_character_name = payload.fighting_character_name;
      this.currentBosses[idx]!.total_attempts = payload.total_attempts;
      this.currentBosses[idx]!.respawn_at = payload.respawn_at;
    }

    const existing = this.bossSprites.get(payload.boss_id);

    if (payload.status === 'alive' || payload.status === 'in_combat') {
      if (existing) {
        // Update existing sprite
        existing.updateStatus(payload.status);
        const updatedBoss = this.currentBosses.find(b => b.id === payload.boss_id);
        if (updatedBoss) existing.setBossData(updatedBoss);
      } else if (this.cityMapData) {
        // Boss respawned — create a new sprite
        const boss = this.currentBosses.find(b => b.id === payload.boss_id);
        if (boss) {
          boss.status = payload.status;
          this.spawnBossSprites([boss]);
        }
      }
    } else {
      // defeated or inactive — remove sprite
      if (existing) {
        existing.updateStatus(payload.status);
        // After a brief delay remove from map
        this.time.delayedCall(500, () => {
          existing.destroy();
          this.bossSprites.delete(payload.boss_id);
        });
      }
    }

    // Update the info panel if it's showing this boss
    if (this.bossInfoPanel.isVisible() && this.bossInfoPanel.getCurrentBossId() === payload.boss_id) {
      const boss = this.currentBosses.find(b => b.id === payload.boss_id);
      if (boss) {
        this.bossInfoPanel.updateStatus(boss, this.getBossTokenCount());
      }
    }

    // Update building panel boss blockers so it re-renders if showing a blocked/unblocked building
    this.buildingPanel.setBossBlockers(this.currentBosses);
  }

  private getBossTokenCount(): number {
    try {
      const slots = this.leftPanel.getInventorySlots();
      let count = 0;
      for (const slot of slots) {
        if (slot.definition.name === 'Boss Challenge Token') {
          count += slot.quantity;
        }
      }
      return count;
    } catch {
      return 0;
    }
  }

  update(_time: number, delta: number): void {
    this.playerAnimSprite?.update(delta);
  }

  /** Returns the nearest 8-way compass direction from (x0,y0) toward (x1,y1). */
  private pixelDir(x0: number, y0: number, x1: number, y1: number): Direction8 {
    const deg = ((Math.atan2(y1 - y0, x1 - x0) * 180 / Math.PI) + 360) % 360;
    if (deg < 22.5 || deg >= 337.5) return 'east';
    if (deg < 67.5)  return 'south-east';
    if (deg < 112.5) return 'south';
    if (deg < 157.5) return 'south-west';
    if (deg < 202.5) return 'west';
    if (deg < 247.5) return 'north-west';
    if (deg < 292.5) return 'north';
    return 'north-east';
  }

}
