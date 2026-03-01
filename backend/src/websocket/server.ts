import * as http from 'http';
import * as ws from 'ws';
import { config } from '../config';
import { log } from '../logger';
import { verifyToken } from '../auth/jwt';
import { dispatch } from './dispatcher';

// ---------------------------------------------------------------------------
// Session type attached to each authenticated connection
// ---------------------------------------------------------------------------

export interface AuthenticatedSession {
  accountId: string;
  characterId: string | null;
  socket: ws.WebSocket;
}

// ---------------------------------------------------------------------------
// Active connection registry
// ---------------------------------------------------------------------------

const sessions = new Map<ws.WebSocket, AuthenticatedSession>();

export function getSessions(): ReadonlyMap<ws.WebSocket, AuthenticatedSession> {
  return sessions;
}

export function getSessionByCharacterId(characterId: string): AuthenticatedSession | undefined {
  for (const session of sessions.values()) {
    if (session.characterId === characterId) return session;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Send helpers
// ---------------------------------------------------------------------------

export function sendToSocket(socket: ws.WebSocket, type: string, payload: unknown): void {
  if (socket.readyState === ws.WebSocket.OPEN) {
    socket.send(JSON.stringify({ type, v: 1, payload }));
  }
}

export function sendToSession(session: AuthenticatedSession, type: string, payload: unknown): void {
  sendToSocket(session.socket, type, payload);
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

export function startWebSocketServer(): void {
  const server = http.createServer();

  const wss = new ws.WebSocketServer({ noServer: true });

  // Handle HTTP upgrade — validate JWT before accepting the WebSocket connection.
  // Empty token is allowed for pre-auth sessions (login/register flow).
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') ?? '';

    const accept = (accountId: string, characterId: string | null): void => {
      wss.handleUpgrade(req, socket, head, (client) => {
        const session: AuthenticatedSession = { accountId, characterId, socket: client };
        wss.emit('connection', client, req, session);
      });
    };

    if (!token) {
      // Pre-auth connection — accountId is empty until auth.login/register succeeds
      accept('', null);
      return;
    }

    verifyToken(token)
      .then((claims) => accept(claims.accountId, claims.characterId ?? null))
      .catch(() => {
        log('warn', 'ws', 'upgrade_rejected', { reason: 'invalid_jwt' });
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      });
  });

  // Lazily imported to avoid circular dependency
  let worldStateHandler: ((session: AuthenticatedSession) => Promise<void>) | null = null;
  import('./handlers/world-state-handler').then((m) => {
    worldStateHandler = m.sendWorldState;
  }).catch(() => null);

  wss.on('connection', (client: ws.WebSocket, _req: http.IncomingMessage, session: AuthenticatedSession) => {
    sessions.set(client, session);
    log('info', 'ws', 'client_connected', {
      accountId: session.accountId,
      active_connections: sessions.size,
    });

    // Send world state immediately if player has a character
    if (session.characterId && worldStateHandler) {
      void worldStateHandler(session);
    }

    client.on('message', (raw) => {
      dispatch(session, raw.toString());
    });

    client.on('close', (code) => {
      sessions.delete(client);
      log('info', 'ws', 'client_disconnected', {
        accountId: session.accountId,
        code,
        active_connections: sessions.size,
      });
    });

    client.on('error', (err) => {
      log('error', 'ws', 'client_error', {
        accountId: session.accountId,
        error: err.message,
      });
    });
  });

  server.listen(config.wsPort, () => {
    log('info', 'ws', 'listening', { port: config.wsPort });
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  let shutdownInitiated = false;

  function gracefulShutdown(signal: string): void {
    if (shutdownInitiated) return;
    shutdownInitiated = true;
    log('info', 'ws', 'shutdown_start', { signal, active_connections: sessions.size });

    // Notify all clients
    for (const [socket] of sessions) {
      if (socket.readyState === ws.WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: 'server.error', v: 1, payload: { code: 'INTERNAL_ERROR', message: 'Server is shutting down.' } }));
        socket.close(1001, 'Server shutdown');
      }
    }

    // Wait up to 5s for in-progress work, then exit
    const timeout = setTimeout(() => {
      log('info', 'ws', 'shutdown_forced');
      process.exit(0);
    }, 5000);
    timeout.unref();

    wss.close(() => {
      server.close(async () => {
        const { closePool } = await import('../db/connection');
        await closePool();
        log('info', 'ws', 'shutdown_complete');
        process.exit(0);
      });
    });
  }

  process.on('SIGINT',  () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
}
