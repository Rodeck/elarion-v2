import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import { StatsBar } from '../ui/StatsBar';
import { ChatBox } from '../ui/ChatBox';
import { CombatLog } from '../ui/CombatLog';
import { BuildingPanel } from '../ui/BuildingPanel';
import type {
  WorldStatePayload,
  CharacterData,
  PlayerMovedPayload,
  PlayerEnteredZonePayload,
  PlayerLeftZonePayload,
  PlayerMoveRejectedPayload,
  CombatStartedPayload,
  CombatRoundPayload,
  CombatEndedPayload,
  CharacterLevelledUpPayload,
  MonsterSpawnedPayload,
  MonsterDespawnedPayload,
  ChatMessagePayload,
  CityPlayerMovedPayload,
  CityMoveRejectedPayload,
  CityBuildingArrivedPayload,
  CityMapData,
  CityMapNode,
  CityMapBuilding,
} from '@elarion/protocol';

const TILE_SIZE = 32;
const XP_THRESHOLDS = [100, 250, 500, 900, 1400];

export class GameScene extends Phaser.Scene {
  private client!: WSClient;
  private token = '';
  private myCharacter!: CharacterData;
  private playerSprite!: Phaser.GameObjects.Container;
  private statsBar!: StatsBar;
  private chatBox!: ChatBox;
  private combatLog!: CombatLog;
  private buildingPanel!: BuildingPanel;

  // Remote players: characterId → sprite
  private remotePlayers = new Map<string, Phaser.GameObjects.Container>();

  // Monster sprites: instanceId → sprite
  private monsterSprites = new Map<string, Phaser.GameObjects.Container>();

  // Movement throttle
  private lastMoveSent = 0;
  private readonly MOVE_INTERVAL_MS = 100; // max 10/sec

  // Combat
  private inCombat = false;

  // City map state
  private isCityMap = false;
  private cityMapData: CityMapData | null = null;
  private cityAdjacency = new Map<number, number[]>();
  private pathPreviewGraphics: Phaser.GameObjects.Graphics | null = null;
  private pendingBuildingId: number | null = null;
  private cityBuildingLabels: Phaser.GameObjects.Text[] = [];
  private cityHotspotGraphics: Phaser.GameObjects.Graphics | null = null;
  private cityNodeMarkers: Phaser.GameObjects.Arc[] = [];

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

    const gameEl = document.getElementById('game')!;
    this.buildingPanel = new BuildingPanel(gameEl);

    void this.client.connect().then(() => {
      this.registerHandlers();
    });

    // Camera and world bounds set after world.state arrives
    this.cameras.main.setBackgroundColor('#1a1814');
  }

  private registerHandlers(): void {
    this.client.on<WorldStatePayload>('world.state', (payload) => {
      this.myCharacter = payload.my_character;

      if (payload.map_type === 'city' && payload.city_map) {
        this.isCityMap = true;
        this.cityMapData = payload.city_map;
        this.buildCityAdjacency();
        this.buildCityMap(payload);
      } else {
        this.isCityMap = false;
        this.cityMapData = null;
        this.buildMap(payload.zone_id);
        this.setupInput();
      }

      this.placeMyCharacter();
      this.buildStatsBar();

      // Place monsters (tile maps only — city maps don't have roaming monsters)
      if (!this.isCityMap) {
        for (const m of payload.monsters) {
          this.spawnMonsterSprite(m.instance_id, m.name, m.pos_x, m.pos_y, m.current_hp, m.max_hp);
        }
      }

      // Place other players
      for (const p of payload.players) {
        if (this.isCityMap) {
          const nodeId = p.current_node_id ?? this.cityMapData!.spawn_node_id;
          const node = this.cityMapData!.nodes.find(n => n.id === nodeId);
          if (node) {
            this.addRemotePlayerAtPixel(p.id, p.name, node.x, node.y);
          }
        } else {
          this.addRemotePlayer(p.id, p.name, p.pos_x, p.pos_y);
        }
      }
    });

    this.client.on<PlayerMovedPayload>('player.moved', (payload) => {
      if (this.isCityMap) return; // City maps use city.player_moved

      if (payload.character_id === this.myCharacter?.id) {
        this.myCharacter.pos_x = payload.pos_x;
        this.myCharacter.pos_y = payload.pos_y;
        this.playerSprite.setPosition(
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

      // Roll back prediction
      this.myCharacter.pos_x = payload.pos_x;
      this.myCharacter.pos_y = payload.pos_y;
      this.playerSprite.setPosition(
        payload.pos_x * TILE_SIZE + TILE_SIZE / 2,
        payload.pos_y * TILE_SIZE + TILE_SIZE / 2,
      );
      // Visual shake indicator
      this.cameras.main.shake(80, 0.004);
    });

    this.client.on<PlayerEnteredZonePayload>('player.entered_zone', (payload) => {
      const p = payload.character;
      if (this.isCityMap) {
        const nodeId = p.current_node_id ?? this.cityMapData!.spawn_node_id;
        const node = this.cityMapData!.nodes.find(n => n.id === nodeId);
        if (node) {
          this.addRemotePlayerAtPixel(p.id, p.name, node.x, node.y);
        }
      } else {
        this.addRemotePlayer(p.id, p.name, p.pos_x, p.pos_y);
      }
    });

    this.client.on<PlayerLeftZonePayload>('player.left_zone', (payload) => {
      this.removeRemotePlayer(payload.character_id);
    });

    this.client.on<MonsterSpawnedPayload>('monster.spawned', (payload) => {
      if (!this.isCityMap) {
        this.spawnMonsterSprite(payload.instance_id, payload.name, payload.pos_x, payload.pos_y, payload.max_hp, payload.max_hp);
      }
    });

    this.client.on<MonsterDespawnedPayload>('monster.despawned', (payload) => {
      this.monsterSprites.get(payload.instance_id)?.destroy();
      this.monsterSprites.delete(payload.instance_id);
    });

    this.client.on<{ code: string; message: string }>('server.error', (payload) => {
      this.combatLog.appendError(payload.message);
    });

    this.client.on<CombatStartedPayload>('combat.started', () => {
      this.inCombat = true;
    });

    this.client.on<CombatRoundPayload>('combat.round', (payload) => {
      if (this.myCharacter) {
        this.myCharacter.current_hp = payload.player_hp_after;
        this.statsBar.setHp(payload.player_hp_after, this.myCharacter.max_hp);
      }
      this.combatLog.appendRound(
        payload.round_number,
        payload.attacker,
        payload.action,
        payload.damage,
        payload.player_hp_after,
        payload.monster_hp_after,
      );
    });

    this.client.on<CombatEndedPayload>('combat.ended', (payload) => {
      this.inCombat = false;
      this.combatLog.appendSummary(payload.outcome, payload.xp_gained, payload.items_gained ?? []);
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

    // ── City-specific handlers ──────────────────────────────────────

    this.client.on<CityPlayerMovedPayload>('city.player_moved', (payload) => {
      this.clearPathPreview();

      if (payload.character_id === this.myCharacter?.id) {
        this.myCharacter.current_node_id = payload.node_id;
        this.tweens.add({
          targets: this.playerSprite,
          x: payload.x,
          y: payload.y,
          duration: 250,
          ease: 'Sine.easeInOut',
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
        this.playerSprite.setPosition(node.x, node.y);
      }
      this.cameras.main.shake(80, 0.004);
    });

    this.client.on<CityBuildingArrivedPayload>('city.building_arrived', (payload) => {
      this.pendingBuildingId = null;
      this.buildingPanel.show(payload.building_name);
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
      const bg = this.add.sprite(
        cityMap.image_width / 2,
        cityMap.image_height / 2,
        imageKey,
      ).setDepth(0);
      bg.setDisplaySize(cityMap.image_width, cityMap.image_height);

      // Set camera bounds to image dimensions
      this.cameras.main.setBounds(0, 0, cityMap.image_width, cityMap.image_height);

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
          color: '#c9a55c',
          stroke: '#0f0d0a',
          strokeThickness: 3,
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
      if (this.inCombat || !this.isCityMap || !this.cityMapData) return;

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
          // Already at this building — show panel immediately
          this.buildingPanel.show(clickedBuilding.name);
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

    const sprite = this.add.rectangle(0, 0, 22, 22, 0x88cc88);
    const nameLabel = this.add.text(0, 14, this.myCharacter.name, {
      fontFamily: 'Rajdhani, sans-serif',
      fontSize: '12px',
      color: '#ffffff',
      stroke: '#0d0d0d',
      strokeThickness: 4,
    }).setOrigin(0.5, 0);

    this.playerSprite = this.add.container(x, y, [sprite, nameLabel]).setDepth(10);
    this.cameras.main.startFollow(this.playerSprite);
  }

  private buildStatsBar(): void {
    const c = this.myCharacter;
    const level = c.level;
    const xpThreshold = XP_THRESHOLDS[level - 1] ?? 9999;
    const topBar = document.getElementById('top-bar')!;
    this.statsBar = new StatsBar(
      topBar,
      c.name,
      `Class ${c.class_id}`,
      level,
      c.current_hp,
      c.max_hp,
      c.experience,
      xpThreshold,
    );
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
      if (this.inCombat) return;

      const now = Date.now();
      if (now - this.lastMoveSent < this.MOVE_INTERVAL_MS) return;

      for (const [k1, k2, dir] of dirMap) {
        if (k1?.isDown || k2?.isDown) {
          this.lastMoveSent = now;
          // Client-side prediction
          const dx = dir === 'e' ? 1 : dir === 'w' ? -1 : 0;
          const dy = dir === 's' ? 1 : dir === 'n' ? -1 : 0;
          this.playerSprite.x += dx * TILE_SIZE;
          this.playerSprite.y += dy * TILE_SIZE;
          this.client.send('player.move', { direction: dir });
          break;
        }
      }
    });
  }

  // ── Remote players ──────────────────────────────────────────────

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

  private spawnMonsterSprite(instanceId: string, name: string, posX: number, posY: number, currentHp: number, maxHp: number): void {
    const x = posX * TILE_SIZE + TILE_SIZE / 2;
    const y = posY * TILE_SIZE + TILE_SIZE / 2;

    const sprite = this.add.rectangle(0, 0, 20, 20, 0xcc4444).setDepth(8);
    const label = this.add.text(0, -20, name, { fontSize: '9px', color: '#ffaaaa' }).setOrigin(0.5);
    const hpText = this.add.text(0, 14, `${currentHp}/${maxHp}`, { fontSize: '9px', color: '#ff8888' }).setOrigin(0.5);
    const container = this.add.container(x, y, [sprite, label, hpText]).setDepth(8);

    // Make monster interactive for combat
    sprite.setInteractive({ cursor: 'pointer' });
    sprite.on('pointerdown', () => {
      if (!this.inCombat) {
        this.client.send('combat.start', { monster_instance_id: instanceId });
      }
    });

    this.monsterSprites.set(instanceId, container);
  }
}
