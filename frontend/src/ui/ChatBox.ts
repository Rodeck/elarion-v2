import { WSClient } from '../network/WSClient';

type Channel = 'local' | 'global';

export class ChatBox {
  private panel: HTMLDivElement;
  private localList: HTMLDivElement;
  private globalList: HTMLDivElement;
  private input: HTMLInputElement;
  private sendBtn: HTMLButtonElement;
  private activeChannel: Channel = 'local';
  private localTab!: HTMLButtonElement;
  private globalTab!: HTMLButtonElement;
  private localUnread = 0;
  private globalUnread = 0;
  private rateLimitTimer: ReturnType<typeof setInterval> | null = null;
  private rateLimitNotice: HTMLDivElement;
  private client: WSClient;
  private history: string[] = [];
  private historyIndex = -1;
  private historyDraft = '';
  private static readonly ADMIN_COMMANDS = [
    '/level_up', '/item', '/clear_inventory', '/day', '/night',
    '/crown', '/abilities.all', '/spells.all', '/crafting_finish', '/heal',
    '/squire', '/expedition_finish', '/reset_player',
  ];

  constructor(client: WSClient, container: HTMLElement = document.body) {
    this.client = client;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      flex: 1;
      min-width: 0;
      height: 100%;
      background: rgba(26, 24, 20, 0.95);
      border-right: 1px solid var(--color-gold-subtle);
      display: flex;
      flex-direction: column;
      font-family: var(--font-body);
      font-size: var(--type-body);
      color: var(--color-text-primary);
    `;

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex; border-bottom: 1px solid var(--color-gold-subtle);';

    this.localTab = this.createTab('Local', 'local', tabBar);
    this.globalTab = this.createTab('Global', 'global', tabBar);
    this.panel.appendChild(tabBar);

    // Message lists
    this.localList = this.createMessageList();
    this.globalList = this.createMessageList();
    this.globalList.style.display = 'none';
    this.panel.appendChild(this.localList);
    this.panel.appendChild(this.globalList);

    // Rate limit notice
    this.rateLimitNotice = document.createElement('div');
    this.rateLimitNotice.style.cssText = `
      color: var(--color-combat-dmg);
      font-size: var(--type-small);
      font-family: var(--font-display);
      padding: 2px 8px;
      display: none;
    `;
    this.panel.appendChild(this.rateLimitNotice);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; border-top: 1px solid var(--color-gold-subtle); padding: 4px; gap: 4px;';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Say something...';
    this.input.maxLength = 256;
    this.input.style.cssText = `
      flex: 1;
      background: var(--color-bg-inset);
      color: var(--color-text-primary);
      border: 1px solid var(--color-gold-subtle);
      border-radius: 2px;
      outline: none;
      font-family: var(--font-body);
      font-size: var(--type-body);
      padding: 3px 6px;
      transition: border-color 0.2s;
    `;
    this.input.addEventListener('focus', () => { this.input.style.borderColor = 'var(--color-gold-primary)'; });
    this.input.addEventListener('blur',  () => { this.input.style.borderColor = 'var(--color-gold-subtle)'; });
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Tab') {
        const completed = this.tryTabComplete();
        if (completed) {
          e.preventDefault();
        }
      } else if (e.key === 'Enter') {
        this.sendMessage();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.history.length === 0) return;
        if (this.historyIndex === -1) this.historyDraft = this.input.value;
        this.historyIndex = Math.min(this.historyIndex + 1, this.history.length - 1);
        this.input.value = this.history[this.historyIndex]!;
        this.input.setSelectionRange(this.input.value.length, this.input.value.length);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.historyIndex === -1) return;
        this.historyIndex--;
        this.input.value = this.historyIndex === -1 ? this.historyDraft : this.history[this.historyIndex]!;
        this.input.setSelectionRange(this.input.value.length, this.input.value.length);
      }
    });

    this.sendBtn = document.createElement('button');
    this.sendBtn.textContent = 'Send';
    this.sendBtn.style.cssText = `
      background: var(--color-bg-panel-alt);
      color: var(--color-gold-primary);
      border: 1px solid var(--color-gold-dim);
      border-radius: 2px;
      padding: 2px 10px;
      cursor: pointer;
      font-family: var(--font-display);
      font-size: var(--type-small);
      letter-spacing: 1px;
    `;
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    inputRow.appendChild(this.input);
    inputRow.appendChild(this.sendBtn);
    this.panel.appendChild(inputRow);

    container.appendChild(this.panel);

    this.setActiveTab('local');
  }

  private createTab(label: string, channel: Channel, container: HTMLElement): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.dataset['channel'] = channel;
    btn.style.cssText = `
      flex: 1;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: var(--color-text-muted);
      cursor: pointer;
      padding: 5px 8px;
      font-family: var(--font-display);
      font-size: var(--type-small);
      text-transform: uppercase;
      letter-spacing: 1px;
      transition: color 0.15s;
    `;
    btn.textContent = label;
    btn.addEventListener('click', () => this.setActiveTab(channel));
    container.appendChild(btn);
    return btn;
  }

  private createMessageList(): HTMLDivElement {
    const div = document.createElement('div');
    div.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 5px 8px;
      scrollbar-width: thin;
      scrollbar-color: var(--color-gold-subtle) transparent;
    `;
    return div;
  }

  private setActiveTab(channel: Channel): void {
    this.activeChannel = channel;

    this.localList.style.display = channel === 'local' ? 'block' : 'none';
    this.globalList.style.display = channel === 'global' ? 'block' : 'none';

    if (channel === 'local') {
      this.localUnread = 0;
      this.localTab.style.color = 'var(--color-gold-primary)';
      this.localTab.style.borderBottom = '2px solid var(--color-gold-primary)';
      this.globalTab.style.color = 'var(--color-text-muted)';
      this.globalTab.style.borderBottom = '2px solid transparent';
      this.localTab.textContent = 'Local';
    } else {
      this.globalUnread = 0;
      this.globalTab.style.color = 'var(--color-gold-primary)';
      this.globalTab.style.borderBottom = '2px solid var(--color-gold-primary)';
      this.localTab.style.color = 'var(--color-text-muted)';
      this.localTab.style.borderBottom = '2px solid transparent';
      this.globalTab.textContent = 'Global';
    }
  }

  appendMessage(channel: Channel, senderName: string, message: string, timestamp: string): void {
    const list = channel === 'local' ? this.localList : this.globalList;
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const msgColor = channel === 'global' ? 'var(--color-chat-global)' : 'var(--color-chat-local)';
    const line = document.createElement('div');
    line.style.cssText = 'margin-bottom: 3px; word-wrap: break-word; line-height: 1.4;';
    line.innerHTML = `<span style="color:var(--color-text-muted);font-size:var(--type-small)">[${time}]</span> <span style="color:${msgColor};font-weight:600">${this.escapeHtml(senderName)}</span>: ${this.escapeHtml(message)}`;
    list.appendChild(line);

    // Keep last 100 messages
    while (list.children.length > 100) list.removeChild(list.firstChild!);
    list.scrollTop = list.scrollHeight;

    // Badge unread count on inactive tab
    if (channel !== this.activeChannel) {
      if (channel === 'local') {
        this.localUnread++;
        this.localTab.textContent = `Local (${this.localUnread})`;
        this.localTab.style.color = 'var(--color-gold-bright)';
      } else {
        this.globalUnread++;
        this.globalTab.textContent = `Global (${this.globalUnread})`;
        this.globalTab.style.color = 'var(--color-gold-bright)';
      }
    }
  }

  addSystemMessage(message: string): void {
    const list = this.activeChannel === 'global' ? this.globalList : this.localList;
    const line = document.createElement('div');
    line.style.cssText = 'padding:2px 4px;';
    line.innerHTML = `<span style="color:var(--color-text-muted);font-style:italic;">${this.escapeHtml(message)}</span>`;
    list.appendChild(line);
    list.scrollTop = list.scrollHeight;
    while (list.children.length > 100) list.removeChild(list.firstChild!);
  }

  addAdminMessage(success: boolean, message: string): void {
    const list = this.activeChannel === 'global' ? this.globalList : this.localList;
    const colour = success ? '#88ff88' : '#ff8888';
    const prefix = success ? '[Admin ✓]' : '[Admin ✗]';
    const line = document.createElement('div');
    line.style.cssText = 'padding:2px 4px;';
    line.innerHTML = `<span style="color:${colour};font-weight:600;font-family:var(--font-display);font-size:var(--type-small);">${prefix} ${this.escapeHtml(message)}</span>`;
    list.appendChild(line);
    list.scrollTop = list.scrollHeight;
    while (list.children.length > 100) list.removeChild(list.firstChild!);
  }

  showRateLimitNotice(retryAfterMs: number): void {
    if (this.rateLimitTimer) clearInterval(this.rateLimitTimer);

    this.sendBtn.disabled = true;
    this.sendBtn.style.opacity = '0.5';
    this.rateLimitNotice.style.display = 'block';

    let remaining = Math.ceil(retryAfterMs / 1000);
    this.rateLimitNotice.textContent = `Slow down — wait ${remaining}s`;

    this.rateLimitTimer = setInterval(() => {
      remaining--;
      if (remaining <= 0) {
        clearInterval(this.rateLimitTimer!);
        this.rateLimitTimer = null;
        this.sendBtn.disabled = false;
        this.sendBtn.style.opacity = '1';
        this.rateLimitNotice.style.display = 'none';
      } else {
        this.rateLimitNotice.textContent = `Slow down — wait ${remaining}s`;
      }
    }, 1000);
  }

  private tryTabComplete(): boolean {
    const text = this.input.value;
    if (!text.startsWith('/')) return false;

    const firstSpace = text.indexOf(' ');
    const partial = (firstSpace === -1 ? text : text.substring(0, firstSpace)).toLowerCase();

    // Only complete if cursor is still in the command portion (before first space or no space)
    if (firstSpace !== -1 && this.input.selectionStart! > firstSpace) return false;

    const matches = ChatBox.ADMIN_COMMANDS.filter((cmd) => cmd.startsWith(partial));
    if (matches.length === 1) {
      const completed = matches[0]!;
      const rest = firstSpace === -1 ? ' ' : text.substring(firstSpace);
      this.input.value = completed + rest;
      const cursorPos = completed.length + (firstSpace === -1 ? 1 : 0);
      this.input.setSelectionRange(cursorPos, cursorPos);
      return true;
    }

    if (matches.length > 1) {
      // Find longest common prefix among matches
      let prefix = matches[0]!;
      for (let i = 1; i < matches.length; i++) {
        while (!matches[i]!.startsWith(prefix)) {
          prefix = prefix.substring(0, prefix.length - 1);
        }
      }
      if (prefix.length > partial.length) {
        const rest = firstSpace === -1 ? '' : text.substring(firstSpace);
        this.input.value = prefix + rest;
        this.input.setSelectionRange(prefix.length, prefix.length);
      }
      // Show available matches in chat
      this.addSystemMessage(`Commands: ${matches.join(', ')}`);
      return true;
    }

    return false;
  }

  private sendMessage(): void {
    const text = this.input.value.trim();
    if (!text || this.sendBtn.disabled) return;

    this.history.unshift(text);
    if (this.history.length > 50) this.history.pop();
    this.historyIndex = -1;
    this.historyDraft = '';

    this.client.send('chat.send', { channel: this.activeChannel, message: text });
    this.input.value = '';
  }

  private escapeHtml(str: string): string {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  destroy(): void {
    if (this.rateLimitTimer) clearInterval(this.rateLimitTimer);
    this.panel.remove();
  }
}
