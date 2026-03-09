import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import { StatsBar } from '../ui/StatsBar';
import { ChatBox } from '../ui/ChatBox';
import { CombatLog } from '../ui/CombatLog';
import { BuildingPanel } from '../ui/BuildingPanel';
import { LogoutButton } from '../ui/LogoutButton';
import { LeftPanel } from '../ui/LeftPanel';
import { SessionStore } from '../auth/SessionStore';
import { AnimatedSprite } from '../entities/AnimatedSprite';
import { getSprite } from '../entities/SpriteRegistry';
import { DIR4_TO_DIR8 } from '../types/sprite';
import type { Direction4, Direction8 } from '../types/sprite';
import type {
  WorldStatePayload,
  CharacterData,
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
} from '@elarion/protocol';

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
    );

    const buildingSlot = document.getElementById('building-panel-slot')!;
    this.buildingPanel = new BuildingPanel(buildingSlot, (payload) => {
      if (payload.action_type === 'travel') {
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.awaitingTravelWorldState = true;
        this.awaitingWorldState = true;
      }
      this.client.send('city.building_action', payload);
    });
    this.buildingPanel.setOnExpeditionDispatch((buildingId, actionId, durationHours) => {
      this.client.send('expedition.dispatch', { building_id: buildingId, action_id: actionId, duration_hours: durationHours });
    });
    this.buildingPanel.setOnExpeditionCollect((expeditionId) => {
      this.client.send('expedition.collect', { expedition_id: expeditionId });
    });

    void this.client.connect().then(() => {
      this.registerHandlers();
    });

    // Camera and world bounds set after world.state arrives
    this.cameras.main.setBackgroundColor('#1a1814');
  }

  private registerHandlers(): void {
    this.client.on<WorldStatePayload>('world.state', (payload) => {
      const isTravelArrival = this.awaitingTravelWorldState;
      this.awaitingTravelWorldState = false;
      this.awaitingWorldState = false;

      this.myCharacter = payload.my_character;

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

      // Place other players
      for (const p of payload.players) {
        this.spawnRemotePlayer(p);
      }

      // Flush any player.entered_zone events that arrived before this world.state
      this.pendingEnteredZone.splice(0).forEach((ev) => this.spawnRemotePlayer(ev.character));
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

    this.client.on<CharacterLevelledUpPayload>('character.levelled_up', (payload) => {
      if (this.myCharacter) {
        this.myCharacter.level = payload.new_level;
        this.myCharacter.max_hp = payload.new_max_hp;
        this.myCharacter.current_hp = payload.new_max_hp;
        this.myCharacter.attack_power = payload.new_attack_power;
        this.myCharacter.defence = payload.new_defence;
        this.myCharacter.experience = payload.new_experience;
        this.statsBar.setLevel(payload.new_level);
        this.statsBar.setHp(payload.new_max_hp, payload.new_max_hp);
        const nextThreshold = XP_THRESHOLDS[payload.new_level] ?? 9999;
        this.statsBar.setXp(payload.new_experience, nextThreshold);
      }
    });

    this.client.on<ChatMessagePayload>('chat.message', (payload) => {
      this.chatBox.appendMessage(payload.channel as 'local' | 'global', payload.sender_name, payload.message, payload.timestamp);
    });

    this.client.on<AdminCommandResultPayload>('admin.command_result', (payload) => {
      this.chatBox.addAdminMessage(payload.success, payload.message);
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
      if (payload.expedition_state) {
        this.expeditionStateByBuilding.set(payload.building_id, payload.expedition_state);
      }
      const building = this.cityMapData?.buildings.find((b) => b.id === payload.building_id);
      if (building) {
        this.buildingPanel.show(building, payload.expedition_state);
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
      this.buildingPanel.showExploreResult(payload);
    });

    // Inventory handlers
    this.client.on<InventoryStatePayload>('inventory.state', (payload) => {
      this.leftPanel.onInventoryState(payload);
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
    );
    this.logoutButton = new LogoutButton(document.getElementById('top-bar')!, () => this.handleLogout());
  }

  private handleLogout(): void {
    SessionStore.clear();
    this.client.disconnect();
    this.statsBar.destroy();
    this.logoutButton.destroy();
    this.chatBox.destroy();
    this.combatLog.destroy();
    this.buildingPanel.destroy();
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

  private spawnRemotePlayer(p: CharacterData): void {
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
