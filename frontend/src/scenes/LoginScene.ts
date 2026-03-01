import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import type { AuthSuccessPayload, AuthErrorPayload } from '@elarion/protocol';

type Tab = 'login' | 'register';

export class LoginScene extends Phaser.Scene {
  private activeTab: Tab = 'login';
  private errorText!: Phaser.GameObjects.Text;
  private usernameInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;

  constructor() {
    super({ key: 'LoginScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Title
    this.add.text(cx, cy - 140, 'ELARION', {
      fontSize: '40px',
      color: '#e8d5a3',
      fontFamily: 'serif',
    }).setOrigin(0.5);

    // Tab buttons
    const loginTabBtn = this.add.text(cx - 70, cy - 80, 'Login', {
      fontSize: '18px',
      color: '#ffffff',
      backgroundColor: '#336633',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    const registerTabBtn = this.add.text(cx + 70, cy - 80, 'Register', {
      fontSize: '18px',
      color: '#aaaaaa',
      padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    loginTabBtn.on('pointerdown', () => {
      this.activeTab = 'login';
      loginTabBtn.setStyle({ color: '#ffffff', backgroundColor: '#336633' });
      registerTabBtn.setStyle({ color: '#aaaaaa', backgroundColor: undefined });
      this.clearError();
    });

    registerTabBtn.on('pointerdown', () => {
      this.activeTab = 'register';
      registerTabBtn.setStyle({ color: '#ffffff', backgroundColor: '#336633' });
      loginTabBtn.setStyle({ color: '#aaaaaa', backgroundColor: undefined });
      this.clearError();
    });

    // HTML inputs overlaid on canvas
    this.usernameInput = this.createInput('text', 'Username', cx, cy - 30);
    this.passwordInput = this.createInput('password', 'Password', cx, cy + 20);

    // Submit button
    const submitBtn = this.add.text(cx, cy + 80, 'Submit', {
      fontSize: '20px',
      color: '#ffffff',
      backgroundColor: '#446644',
      padding: { x: 24, y: 10 },
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    submitBtn.on('pointerdown', () => void this.submit());

    // Error text
    this.errorText = this.add.text(cx, cy + 120, '', {
      fontSize: '14px',
      color: '#ff6666',
      wordWrap: { width: 300 },
    }).setOrigin(0.5);
  }

  private createInput(type: string, placeholder: string, cx: number, cy: number): HTMLInputElement {
    const el = document.createElement('input');
    el.type = type;
    el.placeholder = placeholder;
    el.style.cssText = `
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
    el.style.left = `${rect.left + cx - 110}px`;
    el.style.top = `${rect.top + cy - 16}px`;

    document.body.appendChild(el);
    this.events.once('shutdown', () => el.remove());

    return el;
  }

  private async submit(): Promise<void> {
    this.clearError();
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;

    if (!username || !password) {
      this.showError('Please enter username and password.');
      return;
    }

    const wsHost = import.meta.env['VITE_WS_HOST'] ?? 'localhost:4000';
    const client = new WSClient(`ws://${wsHost}/game?token=`);

    await client.connect();

    client.on<AuthSuccessPayload>('auth.success', (payload) => {
      // Store JWT for reconnect
      sessionStorage.setItem('elarion_token', payload.token);
      client.disconnect();

      if (payload.has_character) {
        this.cleanupInputs();
        this.scene.start('GameScene', { token: payload.token });
      } else {
        this.cleanupInputs();
        this.scene.start('CharacterCreateScene', { token: payload.token });
      }
    });

    client.on<AuthErrorPayload>('auth.error', (payload) => {
      this.showError(this.errorMessage(payload.code));
      client.disconnect();
    });

    const type = this.activeTab === 'login' ? 'auth.login' : 'auth.register';
    client.send(type, { username, password });
  }

  private errorMessage(code: string): string {
    switch (code) {
      case 'USERNAME_TAKEN':      return 'That username is already taken.';
      case 'INVALID_CREDENTIALS': return 'Invalid username or password.';
      case 'USERNAME_INVALID':    return 'Username must be 3–32 chars (letters, numbers, underscores).';
      case 'PASSWORD_TOO_SHORT':  return 'Password must be at least 8 characters.';
      default:                    return 'An error occurred. Please try again.';
    }
  }

  private showError(msg: string): void {
    this.errorText.setText(msg);
  }

  private clearError(): void {
    this.errorText.setText('');
  }

  private cleanupInputs(): void {
    this.usernameInput.remove();
    this.passwordInput.remove();
  }
}
