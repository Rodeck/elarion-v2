import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import { StatsBar } from '../ui/StatsBar';
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
} from '@elarion/protocol';

const TILE_SIZE = 32;
const XP_THRESHOLDS = [100, 250, 500, 900, 1400];

export class GameScene extends Phaser.Scene {
  private client!: WSClient;
  private token = '';
  private myCharacter!: CharacterData;
  private playerSprite!: Phaser.GameObjects.Rectangle;
  private statsBar!: StatsBar;

  // Remote players: characterId → sprite
  private remotePlayers = new Map<string, Phaser.GameObjects.Container>();

  // Monster sprites: instanceId → sprite
  private monsterSprites = new Map<string, Phaser.GameObjects.Container>();

  // Movement throttle
  private lastMoveSent = 0;
  private readonly MOVE_INTERVAL_MS = 100; // max 10/sec

  // Combat
  private inCombat = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: { token: string; character?: CharacterData }): void {
    this.token = data.token;
  }

  create(): void {
    const wsHost = import.meta.env['VITE_WS_HOST'] ?? 'localhost:4000';
    this.client = new WSClient(`ws://${wsHost}/game?token=${this.token}`);

    void this.client.connect().then(() => {
      this.registerHandlers();
    });

    // Camera and world bounds set after world.state arrives
    this.cameras.main.setBackgroundColor('#1a3a1a');
  }

  private registerHandlers(): void {
    this.client.on<WorldStatePayload>('world.state', (payload) => {
      this.myCharacter = payload.my_character;
      this.buildMap(payload.zone_id);
      this.placeMyCharacter();
      this.buildStatsBar();

      // Place monsters
      for (const m of payload.monsters) {
        this.spawnMonsterSprite(m.instance_id, m.name, m.pos_x, m.pos_y, m.current_hp, m.max_hp);
      }

      // Place other players
      for (const p of payload.players) {
        this.addRemotePlayer(p.id, p.name, p.pos_x, p.pos_y);
      }

      this.setupInput();
    });

    this.client.on<PlayerMovedPayload>('player.moved', (payload) => {
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
      this.addRemotePlayer(p.id, p.name, p.pos_x, p.pos_y);
    });

    this.client.on<PlayerLeftZonePayload>('player.left_zone', (payload) => {
      this.removeRemotePlayer(payload.character_id);
    });

    this.client.on<MonsterSpawnedPayload>('monster.spawned', (payload) => {
      this.spawnMonsterSprite(payload.instance_id, payload.name, payload.pos_x, payload.pos_y, payload.max_hp, payload.max_hp);
    });

    this.client.on<MonsterDespawnedPayload>('monster.despawned', (payload) => {
      this.monsterSprites.get(payload.instance_id)?.destroy();
      this.monsterSprites.delete(payload.instance_id);
    });

    this.client.on<CombatStartedPayload>('combat.started', () => {
      this.inCombat = true;
    });

    this.client.on<CombatRoundPayload>('combat.round', (payload) => {
      if (this.myCharacter) {
        this.myCharacter.current_hp = payload.player_hp_after;
        this.statsBar.setHp(payload.player_hp_after, this.myCharacter.max_hp);
      }
    });

    this.client.on<CombatEndedPayload>('combat.ended', () => {
      this.inCombat = false;
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

    this.client.on<ChatMessagePayload>('chat.message', (_payload) => {
      // Chat rendering will be added in US5
    });
  }

  private buildMap(zoneId: number): void {
    // Placeholder tile rendering — 20×20 grid of colored rectangles
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

  private placeMyCharacter(): void {
    const x = this.myCharacter.pos_x * TILE_SIZE + TILE_SIZE / 2;
    const y = this.myCharacter.pos_y * TILE_SIZE + TILE_SIZE / 2;
    this.playerSprite = this.add.rectangle(x, y, 22, 22, 0x88cc88).setDepth(10);
    this.cameras.main.startFollow(this.playerSprite);
  }

  private buildStatsBar(): void {
    const c = this.myCharacter;
    const level = c.level;
    const xpThreshold = XP_THRESHOLDS[level - 1] ?? 9999;
    this.statsBar = new StatsBar(
      this,
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

  private addRemotePlayer(id: string, name: string, posX: number, posY: number): void {
    if (this.remotePlayers.has(id)) return;

    const x = posX * TILE_SIZE + TILE_SIZE / 2;
    const y = posY * TILE_SIZE + TILE_SIZE / 2;

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
