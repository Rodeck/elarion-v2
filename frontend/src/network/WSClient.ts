type MessageHandler<T> = (payload: T) => void;

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

export class WSClient {
  private socket: WebSocket | null = null;
  private readonly url: string;
  private handlers = new Map<string, MessageHandler<unknown>[]>();
  private retryCount = 0;
  private closed = false;

  constructor(url: string) {
    this.url = url;
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);

      this.socket.onopen = () => {
        this.retryCount = 0;
        resolve();
      };

      this.socket.onerror = (event) => {
        if (this.retryCount === 0) reject(event);
      };

      this.socket.onmessage = (event: MessageEvent<string>) => {
        try {
          const msg = JSON.parse(event.data) as { type: string; v: number; payload: unknown };
          const typeHandlers = this.handlers.get(msg.type);
          if (typeHandlers) {
            for (const handler of typeHandlers) handler(msg.payload);
          }
        } catch {
          // Malformed message — ignore
        }
      };

      this.socket.onclose = () => {
        if (!this.closed) {
          void this.reconnect();
        } else {
          this.emit('disconnected', {});
        }
      };
    });
  }

  private async reconnect(): Promise<void> {
    if (this.retryCount >= MAX_RETRIES) {
      this.emit('disconnected', {});
      return;
    }

    this.retryCount++;
    const delay = BASE_DELAY_MS * Math.pow(2, this.retryCount - 1);
    await new Promise((r) => setTimeout(r, delay));

    try {
      await this.connect();
    } catch {
      // onclose will trigger again and retry
    }
  }

  send<T>(type: string, payload: T): void {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type, v: 1, payload }));
    }
  }

  on<T>(type: string, handler: MessageHandler<T>): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler as MessageHandler<unknown>);
    this.handlers.set(type, existing);
  }

  off(type: string): void {
    this.handlers.delete(type);
  }

  private emit(type: string, payload: unknown): void {
    const typeHandlers = this.handlers.get(type);
    if (typeHandlers) {
      for (const handler of typeHandlers) handler(payload);
    }
  }

  disconnect(): void {
    this.closed = true;
    this.socket?.close();
    this.socket = null;
  }
}
