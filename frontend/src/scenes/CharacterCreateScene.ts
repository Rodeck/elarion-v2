import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import { Colors, Fonts } from '../styles/phaser-tokens';
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

    this.cameras.main.setBackgroundColor(Colors.bgDeepest);

    // Screen title
    this.add.text(cx, 36, 'Choose Your Path', {
      fontFamily: Fonts.display,
      fontSize: '26px',
      color: Colors.goldBrightStr,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle divider
    const divider = this.add.graphics();
    divider.lineStyle(1, Colors.goldSubtle, 0.8);
    divider.lineBetween(cx - 120, 58, cx + 120, 58);

    // Class cards
    const cardY = 200;
    const cardW = 160;
    const cardH = 200;
    const cardSpacing = 190;

    CLASSES.forEach((cls, i) => {
      const cardX = cx + (i - 1) * cardSpacing;
      const selected = cls.id === this.selectedClassId;

      // Card background
      const cardBg = this.add.graphics();
      cardBg.fillStyle(selected ? Colors.bgPanelAlt : Colors.bgPanel, 0.95);
      cardBg.fillRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 3);
      cardBg.lineStyle(1, selected ? Colors.goldPrimary : Colors.goldDim, 1.0);
      cardBg.strokeRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 3);
      if (selected) {
        // Subtle glow line on top
        cardBg.lineStyle(1, Colors.goldBright, 0.15);
        cardBg.lineBetween(cardX - cardW / 2 + 4, cardY - cardH / 2 + 1, cardX + cardW / 2 - 4, cardY - cardH / 2 + 1);
      }

      // Hit area
      const hitZone = this.add.rectangle(cardX, cardY, cardW, cardH)
        .setOrigin(0.5)
        .setInteractive({ cursor: 'pointer' });

      hitZone.on('pointerover', () => {
        if (cls.id !== this.selectedClassId) {
          cardBg.clear();
          cardBg.fillStyle(Colors.bgPanelAlt, 0.95);
          cardBg.fillRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 3);
          cardBg.lineStyle(1, Colors.goldDim, 1.0);
          cardBg.strokeRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 3);
        }
      });
      hitZone.on('pointerout', () => {
        if (cls.id !== this.selectedClassId) {
          cardBg.clear();
          cardBg.fillStyle(Colors.bgPanel, 0.95);
          cardBg.fillRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 3);
          cardBg.lineStyle(1, Colors.goldDim, 1.0);
          cardBg.strokeRoundedRect(cardX - cardW / 2, cardY - cardH / 2, cardW, cardH, 3);
        }
      });

      hitZone.on('pointerdown', () => {
        this.selectedClassId = cls.id;
        this.cleanupInputs();
        this.scene.restart({ token: this.token });
      });

      // Class name
      this.add.text(cardX, cardY - 72, cls.name.toUpperCase(), {
        fontFamily: Fonts.display,
        fontSize: '16px',
        color: selected ? Colors.goldBrightStr : Colors.goldPrimaryStr,
        fontStyle: 'bold',
      }).setOrigin(0.5);

      // Thin separator
      const sep = this.add.graphics();
      sep.lineStyle(1, Colors.goldSubtle, 0.5);
      sep.lineBetween(cardX - 50, cardY - 55, cardX + 50, cardY - 55);

      // Stats
      const stats = [
        { label: 'HP',  value: cls.hp,      color: '#c0392b' },
        { label: 'ATK', value: cls.attack,   color: '#e9c46a' },
        { label: 'DEF', value: cls.defence,  color: '#5d9cec' },
      ];
      stats.forEach((stat, si) => {
        const sy = cardY - 34 + si * 20;
        this.add.text(cardX - 50, sy, stat.label, {
          fontFamily: Fonts.display,
          fontSize: '10px',
          color: Colors.textSecondary,
        }).setOrigin(0, 0.5);
        this.add.text(cardX + 50, sy, String(stat.value), {
          fontFamily: Fonts.number,
          fontSize: '13px',
          color: stat.color,
        }).setOrigin(1, 0.5);

        // Stat bar
        const barW = 80;
        const maxVal = stat.label === 'HP' ? 120 : 25;
        const barFill = Math.round((stat.value / maxVal) * barW);
        const statBg = this.add.graphics();
        statBg.fillStyle(Colors.bgInset, 1.0);
        statBg.fillRect(cardX - 50, sy + 7, barW, 3);
        statBg.fillStyle(parseInt(stat.color.replace('#', ''), 16), 0.8);
        statBg.fillRect(cardX - 50, sy + 7, barFill, 3);
        void statBg;
      });

      // Description
      this.add.text(cardX, cardY + 52, cls.description, {
        fontFamily: Fonts.body,
        fontSize: '11px',
        color: Colors.textMuted,
        wordWrap: { width: cardW - 20 },
        align: 'center',
        fontStyle: 'italic',
      }).setOrigin(0.5, 0);

      void sep;
    });

    // Name input label
    this.add.text(cx, height / 2 + 64, 'Character Name', {
      fontFamily: Fonts.display,
      fontSize: '13px',
      color: Colors.textSecondary,
    }).setOrigin(0.5);

    // HTML name input
    this.nameInput = document.createElement('input');
    this.nameInput.type = 'text';
    this.nameInput.placeholder = 'Enter name (3–32 chars)';
    this.nameInput.style.cssText = `
      position: absolute;
      width: 220px;
      padding: 8px 12px;
      font-family: var(--font-body);
      font-size: 14px;
      background: var(--color-bg-inset);
      color: var(--color-text-primary);
      border: 1px solid var(--color-gold-subtle);
      border-radius: 2px;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.2s;
    `;
    this.nameInput.addEventListener('focus', () => { this.nameInput.style.borderColor = 'var(--color-gold-primary)'; });
    this.nameInput.addEventListener('blur',  () => { this.nameInput.style.borderColor = 'var(--color-gold-subtle)'; });

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / this.scale.width;
    const scaleY = rect.height / this.scale.height;
    const inputY = height / 2 + 84;
    this.nameInput.style.left = `${rect.left + (cx - 110) * scaleX}px`;
    this.nameInput.style.top  = `${rect.top  + inputY * scaleY}px`;
    document.body.appendChild(this.nameInput);

    // Create button
    const btnW = 200;
    const btnH = 36;
    const btnX = cx - btnW / 2;
    const btnY = height / 2 + 130;

    const btnBg = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hover ? Colors.bgPanelAlt : Colors.bgPanel, 1.0);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 3);
      btnBg.lineStyle(1, hover ? Colors.goldBright : Colors.goldPrimary, 1.0);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 3);
    };
    drawBtn(false);

    this.add.text(cx, btnY + btnH / 2, 'BEGIN YOUR JOURNEY', {
      fontFamily: Fonts.display,
      fontSize: '12px',
      color: Colors.goldPrimaryStr,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const errorText = this.add.text(cx, btnY + btnH + 14, '', {
      fontFamily: Fonts.body,
      fontSize: '12px',
      color: '#e74c3c',
    }).setOrigin(0.5);

    const btnHit = this.add.rectangle(cx, btnY + btnH / 2, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ cursor: 'pointer' });
    btnHit.on('pointerover',  () => drawBtn(true));
    btnHit.on('pointerout',   () => drawBtn(false));
    btnHit.on('pointerdown',  () => void this.confirm(errorText));

    this.events.once('shutdown', () => this.cleanupInputs());

    void divider;
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
