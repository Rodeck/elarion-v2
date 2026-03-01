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

  constructor(client: WSClient) {
    this.client = client;

    this.panel = document.createElement('div');
    this.panel.style.cssText = `
      position: fixed;
      bottom: 10px;
      left: 10px;
      width: 320px;
      height: 200px;
      background: rgba(0,0,0,0.8);
      border: 1px solid #446644;
      border-radius: 4px;
      display: flex;
      flex-direction: column;
      font-family: monospace;
      font-size: 12px;
      color: #cccccc;
      z-index: 200;
    `;

    // Tabs
    const tabBar = document.createElement('div');
    tabBar.style.cssText = 'display:flex; border-bottom: 1px solid #446644;';

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
      color: #ff8888;
      font-size: 11px;
      padding: 2px 8px;
      display: none;
    `;
    this.panel.appendChild(this.rateLimitNotice);

    // Input row
    const inputRow = document.createElement('div');
    inputRow.style.cssText = 'display:flex; border-top: 1px solid #446644; padding: 4px;';

    this.input = document.createElement('input');
    this.input.type = 'text';
    this.input.placeholder = 'Say something...';
    this.input.maxLength = 256;
    this.input.style.cssText = `
      flex: 1;
      background: #1a2a1a;
      color: #e8d5a3;
      border: none;
      outline: none;
      font-size: 12px;
      padding: 2px 4px;
    `;
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendMessage();
    });

    this.sendBtn = document.createElement('button');
    this.sendBtn.textContent = 'Send';
    this.sendBtn.style.cssText = `
      background: #446644;
      color: #ffffff;
      border: none;
      padding: 2px 8px;
      cursor: pointer;
      font-size: 11px;
      margin-left: 4px;
    `;
    this.sendBtn.addEventListener('click', () => this.sendMessage());

    inputRow.appendChild(this.input);
    inputRow.appendChild(this.sendBtn);
    this.panel.appendChild(inputRow);

    document.body.appendChild(this.panel);

    this.setActiveTab('local');
  }

  private createTab(label: string, channel: Channel, container: HTMLElement): HTMLButtonElement {
    const btn = document.createElement('button');
    btn.dataset['channel'] = channel;
    btn.style.cssText = `
      flex: 1;
      background: none;
      border: none;
      color: #aaaaaa;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 12px;
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
      padding: 4px 8px;
    `;
    return div;
  }

  private setActiveTab(channel: Channel): void {
    this.activeChannel = channel;

    this.localList.style.display = channel === 'local' ? 'block' : 'none';
    this.globalList.style.display = channel === 'global' ? 'block' : 'none';

    if (channel === 'local') {
      this.localUnread = 0;
      this.localTab.style.color = '#e8d5a3';
      this.localTab.style.borderBottom = '2px solid #88cc88';
      this.globalTab.style.color = '#aaaaaa';
      this.globalTab.style.borderBottom = 'none';
      this.localTab.textContent = 'Local';
    } else {
      this.globalUnread = 0;
      this.globalTab.style.color = '#e8d5a3';
      this.globalTab.style.borderBottom = '2px solid #88cc88';
      this.localTab.style.color = '#aaaaaa';
      this.localTab.style.borderBottom = 'none';
      this.globalTab.textContent = 'Global';
    }
  }

  appendMessage(channel: Channel, senderName: string, message: string, timestamp: string): void {
    const list = channel === 'local' ? this.localList : this.globalList;
    const time = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    const line = document.createElement('div');
    line.style.cssText = 'margin-bottom: 2px; word-wrap: break-word;';
    line.innerHTML = `<span style="color:#888">[${time}]</span> <span style="color:#88cc88">${this.escapeHtml(senderName)}</span>: ${this.escapeHtml(message)}`;
    list.appendChild(line);

    // Keep last 100 messages
    while (list.children.length > 100) list.removeChild(list.firstChild!);
    list.scrollTop = list.scrollHeight;

    // Badge unread count on inactive tab
    if (channel !== this.activeChannel) {
      if (channel === 'local') {
        this.localUnread++;
        this.localTab.textContent = `Local (${this.localUnread})`;
      } else {
        this.globalUnread++;
        this.globalTab.textContent = `Global (${this.globalUnread})`;
      }
    }
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

  private sendMessage(): void {
    const text = this.input.value.trim();
    if (!text || this.sendBtn.disabled) return;

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
