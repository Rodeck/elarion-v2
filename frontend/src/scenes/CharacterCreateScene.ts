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
  private nameInput: HTMLInputElement | null = null;
  private errorEl: HTMLElement | null = null;
  private view: HTMLElement | null = null;
  private token = '';

  constructor() {
    super({ key: 'CharacterCreateScene' });
  }

  init(data: { token: string }): void {
    this.token = data.token;
  }

  create(): void {
    this.view = document.getElementById('char-create-view')!;
    this.view.style.display = 'flex';
    this.renderForm();
    this.events.once('shutdown', () => this.hideView());
  }

  private renderForm(): void {
    const v = this.view!;

    const cardsHTML = CLASSES.map((cls) => {
      const selected = cls.id === this.selectedClassId;
      const hpPct  = Math.round((cls.hp      / 120) * 100);
      const atkPct = Math.round((cls.attack  /  25) * 100);
      const defPct = Math.round((cls.defence /  25) * 100);
      return `
        <div class="char-card${selected ? ' is-selected' : ''}" data-class-id="${cls.id}">
          <div class="char-card-name">${cls.name.toUpperCase()}</div>
          <hr class="char-card-sep">
          <div class="char-card-stats">
            <div class="stat-row">
              <span class="stat-label">HP</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${hpPct}%;background:#c0392b"></div></div>
              <span class="stat-value" style="color:#c0392b">${cls.hp}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">ATK</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${atkPct}%;background:#e9c46a"></div></div>
              <span class="stat-value" style="color:#e9c46a">${cls.attack}</span>
            </div>
            <div class="stat-row">
              <span class="stat-label">DEF</span>
              <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${defPct}%;background:#5d9cec"></div></div>
              <span class="stat-value" style="color:#5d9cec">${cls.defence}</span>
            </div>
          </div>
          <p class="char-card-desc">${cls.description}</p>
        </div>
      `;
    }).join('');

    v.innerHTML = `
      <h1 class="cc-title">Choose Your Path</h1>
      <hr class="cc-divider">
      <div class="char-cards">${cardsHTML}</div>
      <div class="cc-name-section">
        <label class="cc-name-label">Character Name</label>
        <input class="cc-name-input" type="text" placeholder="Enter name (3–32 chars)" autocomplete="off">
      </div>
      <button class="cc-submit">BEGIN YOUR JOURNEY</button>
      <p class="cc-error" id="cc-error"></p>
    `;

    this.nameInput = v.querySelector<HTMLInputElement>('.cc-name-input')!;
    this.errorEl   = v.querySelector<HTMLElement>('#cc-error')!;

    v.querySelectorAll<HTMLElement>('.char-card').forEach((card) => {
      card.addEventListener('click', () => {
        this.selectedClassId = Number(card.dataset['classId']);
        v.querySelectorAll('.char-card').forEach((c) => c.classList.remove('is-selected'));
        card.classList.add('is-selected');
      });
    });

    v.querySelector<HTMLButtonElement>('.cc-submit')!
      .addEventListener('click', () => void this.confirm());

    v.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.confirm();
    });

    this.nameInput.focus();
  }

  private async confirm(): Promise<void> {
    const name = this.nameInput!.value.trim();
    if (!name) {
      this.showError('Please enter a character name.');
      return;
    }

    const wsHost = import.meta.env['VITE_WS_HOST'] ?? 'localhost:4000';
    const client = new WSClient(`ws://${wsHost}/game?token=${this.token}`);
    await client.connect();

    client.on<CharacterCreatedPayload>('character.created', (payload) => {
      client.disconnect();
      this.scene.start('GameScene', { token: this.token, character: payload.character });
    });

    client.on<ServerErrorPayload>('server.error', (payload) => {
      if (payload.code === 'CHARACTER_EXISTS') {
        client.disconnect();
        this.scene.start('GameScene', { token: this.token });
      } else {
        this.showError(payload.message);
        client.disconnect();
      }
    });

    client.send('character.create', { name, class_id: this.selectedClassId });
  }

  private showError(msg: string): void {
    if (this.errorEl) {
      this.errorEl.textContent = msg;
      this.errorEl.style.display = 'block';
    }
  }

  private hideView(): void {
    if (this.view) {
      this.view.style.display = 'none';
      this.view.innerHTML = '';
    }
    this.view = null;
    this.nameInput = null;
    this.errorEl = null;
  }
}
