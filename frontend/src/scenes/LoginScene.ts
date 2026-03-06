import Phaser from 'phaser';
import { WSClient } from '../network/WSClient';
import { SessionStore } from '../auth/SessionStore';
import type { AuthSuccessPayload, AuthErrorPayload } from '@elarion/protocol';

type Tab = 'login' | 'register';

export class LoginScene extends Phaser.Scene {
  private activeTab: Tab = 'login';
  private view: HTMLElement | null = null;
  private usernameInput: HTMLInputElement | null = null;
  private passwordInput: HTMLInputElement | null = null;
  private errorEl: HTMLElement | null = null;

  constructor() {
    super({ key: 'LoginScene' });
  }

  create(): void {
    this.activeTab = 'login';
    this.view = document.getElementById('login-view')!;
    this.view.style.display = 'flex';
    this.renderForm();
    this.events.once('shutdown', () => this.hideView());
  }

  private renderForm(): void {
    const v = this.view!;
    v.innerHTML = `
      <h1 class="login-title">ELARION</h1>
      <div class="login-panel">
        <div class="login-tabs">
          <button class="login-tab is-active" data-tab="login">LOGIN</button>
          <button class="login-tab" data-tab="register">REGISTER</button>
        </div>
        <hr class="login-divider">
        <div class="login-form">
          <label class="login-label">Username</label>
          <input class="login-input" id="lv-username" type="text" placeholder="Enter username" autocomplete="username">
          <label class="login-label">Password</label>
          <input class="login-input" id="lv-password" type="password" placeholder="Enter password" autocomplete="current-password">
        </div>
        <button class="login-submit">ENTER</button>
        <p class="login-error" id="lv-error"></p>
      </div>
    `;

    this.usernameInput = v.querySelector<HTMLInputElement>('#lv-username')!;
    this.passwordInput = v.querySelector<HTMLInputElement>('#lv-password')!;
    this.errorEl = v.querySelector<HTMLElement>('#lv-error')!;

    v.querySelectorAll<HTMLButtonElement>('.login-tab').forEach((btn) => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset['tab'] as Tab));
    });

    v.querySelector<HTMLButtonElement>('.login-submit')!
      .addEventListener('click', () => void this.submit());

    v.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') void this.submit();
    });

    this.usernameInput.focus();
  }

  private switchTab(tab: Tab): void {
    this.activeTab = tab;
    this.view!.querySelectorAll<HTMLButtonElement>('.login-tab').forEach((btn) => {
      btn.classList.toggle('is-active', btn.dataset['tab'] === tab);
    });
    this.clearError();
  }

  private async submit(): Promise<void> {
    this.clearError();
    const username = this.usernameInput!.value.trim();
    const password = this.passwordInput!.value;

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
        this.scene.start('GameScene', { token: payload.token });
      } else {
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
    if (this.errorEl) {
      this.errorEl.textContent = msg;
      this.errorEl.style.display = 'block';
    }
  }

  private clearError(): void {
    if (this.errorEl) {
      this.errorEl.textContent = '';
      this.errorEl.style.display = 'none';
    }
  }

  private hideView(): void {
    if (this.view) {
      this.view.style.display = 'none';
      this.view.innerHTML = '';
    }
    this.view = null;
    this.usernameInput = null;
    this.passwordInput = null;
    this.errorEl = null;
  }
}
