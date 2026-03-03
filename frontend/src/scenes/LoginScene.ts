import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import { Colors, Fonts } from '../styles/phaser-tokens';
import { SessionStore } from '../auth/SessionStore';
import type { AuthSuccessPayload, AuthErrorPayload } from '@elarion/protocol';

type Tab = 'login' | 'register';

export class LoginScene extends Phaser.Scene {
  private activeTab: Tab = 'login';
  private errorText!: Phaser.GameObjects.Text;
  private usernameInput!: HTMLInputElement;
  private passwordInput!: HTMLInputElement;
  private loginTabUnderline!: Phaser.GameObjects.Rectangle;
  private registerTabUnderline!: Phaser.GameObjects.Rectangle;
  private loginTabText!: Phaser.GameObjects.Text;
  private registerTabText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'LoginScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;
    const cy = height / 2;

    // Background
    this.cameras.main.setBackgroundColor(Colors.bgDeepest);

    // Panel background
    const panelW = 340;
    const panelH = 320;
    const panel = this.add.graphics();
    panel.fillStyle(Colors.bgPanel, 0.95);
    panel.fillRoundedRect(cx - panelW / 2, cy - panelH / 2 - 20, panelW, panelH, 3);
    panel.lineStyle(1, Colors.goldDim, 1.0);
    panel.strokeRoundedRect(cx - panelW / 2, cy - panelH / 2 - 20, panelW, panelH, 3);
    panel.lineStyle(1, Colors.goldBright, 0.07);
    panel.lineBetween(cx - panelW / 2 + 4, cy - panelH / 2 - 19, cx + panelW / 2 - 4, cy - panelH / 2 - 19);

    // Title
    this.add.text(cx, cy - 130, 'ELARION', {
      fontFamily: Fonts.display,
      fontSize: '42px',
      color: Colors.goldBrightStr,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Tabs
    this.loginTabText = this.add.text(cx - 60, cy - 80, 'LOGIN', {
      fontFamily: Fonts.display,
      fontSize: '12px',
      color: Colors.goldPrimaryStr,
      fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    this.registerTabText = this.add.text(cx + 60, cy - 80, 'REGISTER', {
      fontFamily: Fonts.display,
      fontSize: '12px',
      color: Colors.textMuted,
    }).setOrigin(0.5).setInteractive({ cursor: 'pointer' });

    // Tab underlines
    this.loginTabUnderline = this.add.rectangle(cx - 60, cy - 70, 52, 2, Colors.goldPrimary).setOrigin(0.5, 0);
    this.registerTabUnderline = this.add.rectangle(cx + 60, cy - 70, 66, 2, Colors.goldPrimary, 0).setOrigin(0.5, 0);

    // Divider
    const divider = this.add.graphics();
    divider.lineStyle(1, Colors.goldSubtle, 0.6);
    divider.lineBetween(cx - panelW / 2 + 16, cy - 68, cx + panelW / 2 - 16, cy - 68);

    // Input labels
    this.add.text(cx - 110, cy - 54, 'Username', {
      fontFamily: Fonts.display,
      fontSize: '11px',
      color: Colors.textSecondary,
    }).setOrigin(0, 0.5);

    this.add.text(cx - 110, cy - 4, 'Password', {
      fontFamily: Fonts.display,
      fontSize: '11px',
      color: Colors.textSecondary,
    }).setOrigin(0, 0.5);

    // HTML inputs
    this.usernameInput = this.createInput('text', 'Enter username', cx, cy - 29);
    this.passwordInput = this.createInput('password', 'Enter password', cx, cy + 22);

    // Submit button
    const btnW = 160;
    const btnH = 36;
    const btnX = cx - btnW / 2;
    const btnY = cy + 60;

    const btnBg = this.add.graphics();
    const drawBtn = (hover: boolean) => {
      btnBg.clear();
      btnBg.fillStyle(hover ? Colors.bgPanelAlt : Colors.bgPanel, 1.0);
      btnBg.fillRoundedRect(btnX, btnY, btnW, btnH, 3);
      btnBg.lineStyle(1, hover ? Colors.goldBright : Colors.goldPrimary, 1.0);
      btnBg.strokeRoundedRect(btnX, btnY, btnW, btnH, 3);
    };
    drawBtn(false);

    const btnLabel = this.add.text(cx, btnY + btnH / 2, 'ENTER', {
      fontFamily: Fonts.display,
      fontSize: '13px',
      color: Colors.goldPrimaryStr,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const btnHitArea = this.add.rectangle(cx, btnY + btnH / 2, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ cursor: 'pointer' });

    btnHitArea.on('pointerover',  () => drawBtn(true));
    btnHitArea.on('pointerout',   () => drawBtn(false));
    btnHitArea.on('pointerdown',  () => void this.submit());

    // Error text
    this.errorText = this.add.text(cx, cy + 118, '', {
      fontFamily: Fonts.body,
      fontSize: '12px',
      color: '#e74c3c',
      wordWrap: { width: 300 },
    }).setOrigin(0.5);

    // Tab events
    this.loginTabText.on('pointerdown', () => this.switchTab('login'));
    this.registerTabText.on('pointerdown', () => this.switchTab('register'));

    void panel;
    void divider;
    void btnLabel;
  }

  private switchTab(tab: Tab): void {
    this.activeTab = tab;
    if (tab === 'login') {
      this.loginTabText.setStyle({ color: Colors.goldPrimaryStr, fontStyle: 'bold' });
      this.registerTabText.setStyle({ color: Colors.textMuted, fontStyle: 'normal' });
      this.loginTabUnderline.setAlpha(1);
      this.registerTabUnderline.setAlpha(0);
    } else {
      this.registerTabText.setStyle({ color: Colors.goldPrimaryStr, fontStyle: 'bold' });
      this.loginTabText.setStyle({ color: Colors.textMuted, fontStyle: 'normal' });
      this.registerTabUnderline.setAlpha(1);
      this.loginTabUnderline.setAlpha(0);
    }
    this.clearError();
  }

  private createInput(type: string, placeholder: string, cx: number, cy: number): HTMLInputElement {
    const el = document.createElement('input');
    el.type = type;
    el.placeholder = placeholder;
    el.style.cssText = `
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
    el.addEventListener('focus', () => { el.style.borderColor = 'var(--color-gold-primary)'; });
    el.addEventListener('blur',  () => { el.style.borderColor = 'var(--color-gold-subtle)'; });

    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width / this.scale.width;
    const scaleY = rect.height / this.scale.height;
    el.style.left = `${rect.left + (cx - 110) * scaleX}px`;
    el.style.top  = `${rect.top  + (cy - 16) * scaleY}px`;

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
      SessionStore.save(payload.token);
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
