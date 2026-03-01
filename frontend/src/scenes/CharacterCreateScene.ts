import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import type { CharacterCreatedPayload, ServerErrorPayload } from '@elarion/protocol';

interface ClassData {
  id: number;
  name: string;
  hp: number;
  attack: number;
  defence: number;
  description: string;
}

const CLASSES: ClassData[] = [
  { id: 1, name: 'Warrior', hp: 120, attack: 15, defence: 12, description: 'Durable frontline fighter.' },
  { id: 2, name: 'Mage',    hp: 70,  attack: 25, defence: 6,  description: 'High damage, fragile.' },
  { id: 3, name: 'Ranger',  hp: 90,  attack: 20, defence: 9,  description: 'Balanced ranged combatant.' },
];

export class CharacterCreateScene extends Phaser.Scene {
  private selectedClassId = 1;
  private nameInput!: HTMLInputElement;
  private token = '';

  constructor() {
    super({ key: 'CharacterCreateScene' });
  }

  init(data: { token: string }): void {
    this.token = data.token;
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    this.add.text(cx, 40, 'Create Your Character', {
      fontSize: '28px',
      color: '#e8d5a3',
      fontFamily: 'serif',
    }).setOrigin(0.5);

    // Class cards
    const cardY = 140;
    const cardSpacing = 180;

    CLASSES.forEach((cls, i) => {
      const cardX = cx + (i - 1) * cardSpacing;
      const selected = cls.id === this.selectedClassId;

      const bg = this.add.rectangle(cardX, cardY, 160, 160, selected ? 0x336633 : 0x1a2a1a)
        .setStrokeStyle(2, selected ? 0x88cc88 : 0x446644)
        .setInteractive({ cursor: 'pointer' });

      const label = this.add.text(cardX, cardY - 50, cls.name, {
        fontSize: '18px',
        color: '#e8d5a3',
      }).setOrigin(0.5);

      this.add.text(cardX, cardY - 20, `HP: ${cls.hp}`, { fontSize: '13px', color: '#aaffaa' }).setOrigin(0.5);
      this.add.text(cardX, cardY,      `ATK: ${cls.attack}`, { fontSize: '13px', color: '#ffaaaa' }).setOrigin(0.5);
      this.add.text(cardX, cardY + 20, `DEF: ${cls.defence}`, { fontSize: '13px', color: '#aaaaff' }).setOrigin(0.5);
      this.add.text(cardX, cardY + 45, cls.description, {
        fontSize: '11px',
        color: '#888888',
        wordWrap: { width: 140 },
        align: 'center',
      }).setOrigin(0.5);

      bg.on('pointerdown', () => {
        this.selectedClassId = cls.id;
        // Restart scene to refresh selection state (simple approach)
        this.cleanupInputs();
        this.scene.restart({ token: this.token });
      });

      void label;
    });

    // Name input
    this.add.text(cx, height / 2 + 30, 'Character Name', {
      fontSize: '16px',
      color: '#e8d5a3',
    }).setOrigin(0.5);

    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Enter name (3–32 chars)';
    this.nameInput.style.cssText = `
      position: absolute;
      width: 220px;
      padding: 8px;
      font-size: 16px;
      background: #1a2a1a;
      color: #e8d5a3;
      border: 1px solid #446644;
      outline: none;
      box-sizing: border-box;
    `;

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const inputY = height / 2 + 55;
    this.nameInput.style.left = `${rect.left + cx - 110}px`;
    this.nameInput.style.top = `${rect.top + inputY}px`;
    document.body.appendChild(this.nameInput);

    // Confirm button
    const confirmBtn = this.add.text(cx, height / 2 + 120, 'Create Character', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#446644',
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    const errorText = this.add.text(cx, height / 2 + 165, '', {
      fontSize: '14px',
      color: '#ff6666',
    }).setOrigin(0.5);

    confirmBtn.on('pointerdown', () => void this.confirm(errorText));

    this.events.once('shutdown', () => this.cleanupInputs());
  }

  private async confirm(errorText: Phaser.GameObjects.Text): Promise<void> {
    const name = this.nameInput.value.trim();
    if (!name) {
      errorText.setText('Please enter a character name.');
      return;
    }

    const wsHost = import.meta.env['VITE_WS_HOST'] ?? 'localhost:4000';
    const client = new WSClient(`ws://${wsHost}/game?token=${this.token}`);
    await client.connect();

    client.on<CharacterCreatedPayload>('character.created', (payload) => {
      client.disconnect();
      this.cleanupInputs();
      this.scene.start('GameScene', { token: this.token, character: payload.character });
    });

    client.on<ServerErrorPayload>('server.error', (payload) => {
      if (payload.code === 'CHARACTER_EXISTS') {
        client.disconnect();
        this.cleanupInputs();
        this.scene.start('GameScene', { token: this.token });
      } else {
        errorText.setText(payload.message);
        client.disconnect();
      }
    });

    client.send('character.create', { name, class_id: this.selectedClassId });
  }

  private cleanupInputs(): void {
    this.nameInput?.remove();
  }
}
