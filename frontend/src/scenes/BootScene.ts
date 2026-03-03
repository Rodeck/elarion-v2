import Phaser from 'phaser';
import { Colors, Fonts } from '../styles/phaser-tokens';
import { queueTextures, buildDefinition } from '../entities/SpriteLoader';
import { SessionStore } from '../auth/SessionStore';
import { WSClient } from '../network/WSClient';
import type { SpriteMetadataJson } from '../types/sprite';
import type { AuthSessionInfoPayload } from '@elarion/protocol';

const KNIGHT_ID = 'medieval_knight';
const KNIGHT_META_KEY = 'medieval_knight_meta';
const KNIGHT_BASE_PATH = '/assets/characters/medieval_knight';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale;
    const barWidth = 320;
    const barHeight = 8;
    const barX = (width - barWidth) / 2;
    const barY = height / 2;

    // Loading label
    const label = this.add.text(width / 2, barY - 24, 'Loading...', {
      fontFamily: Fonts.display,
      fontSize: '14px',
      color: Colors.textSecondary,
    }).setOrigin(0.5);

    // Track
    const bgBar = this.add.graphics();
    bgBar.fillStyle(Colors.xpBg, 1.0);
    bgBar.fillRect(barX, barY, barWidth, barHeight);
    bgBar.lineStyle(1, Colors.goldSubtle, 1.0);
    bgBar.strokeRect(barX, barY, barWidth, barHeight);

    // Fill
    const fgBar = this.add.graphics();

    this.load.on('progress', (value: number) => {
      fgBar.clear();
      fgBar.fillStyle(Colors.xpFill, 1.0);
      fgBar.fillRect(barX, barY, barWidth * value, barHeight);
    });

    this.load.on('complete', () => {
      fgBar.clear();
      fgBar.fillStyle(Colors.xpFill, 1.0);
      fgBar.fillRect(barX, barY, barWidth, barHeight);
    });

    void label;

    // Load sprite metadata JSON — when it completes, queue all frame textures in the
    // same load batch so everything is ready before create() runs.
    this.load.json(KNIGHT_META_KEY, `${KNIGHT_BASE_PATH}/metadata.json`);
    this.load.once(`filecomplete-json-${KNIGHT_META_KEY}`, () => {
      const meta = this.cache.json.get(KNIGHT_META_KEY) as SpriteMetadataJson;
      queueTextures(this, meta, KNIGHT_ID, KNIGHT_BASE_PATH);
    });
  }

  create(): void {
    // Build the SpriteDefinition from the loaded metadata and register it globally.
    buildDefinition(this, KNIGHT_META_KEY, KNIGHT_ID);

    this.trySessionRestore();
  }

  private trySessionRestore(): void {
    const token = SessionStore.load();

    if (!token) {
      this.scene.start('LoginScene');
      return;
    }

    const wsHost = import.meta.env['VITE_WS_HOST'] ?? 'localhost:4000';
    const client = new WSClient(`ws://${wsHost}/game?token=${token}`);

    let settled = false;

    const settle = (fn: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(fallbackTimer);
      fn();
    };

    const fallbackTimer = setTimeout(() => {
      settle(() => {
        SessionStore.clear();
        client.disconnect();
        this.scene.start('LoginScene');
      });
    }, 5000);

    client.on<AuthSessionInfoPayload>('auth.session_info', (payload) => {
      if (!payload.has_character) {
        settle(() => {
          client.disconnect();
          this.scene.start('CharacterCreateScene', { token });
        });
      }
    });

    // world.state means authenticated with character — let GameScene handle the rest
    client.on<unknown>('world.state', () => {
      settle(() => {
        client.disconnect();
        this.scene.start('GameScene', { token });
      });
    });

    client.on<unknown>('disconnected', () => {
      settle(() => {
        SessionStore.clear();
        this.scene.start('LoginScene');
      });
    });

    client.connect().catch(() => {
      settle(() => {
        SessionStore.clear();
        this.scene.start('LoginScene');
      });
    });
  }
}
