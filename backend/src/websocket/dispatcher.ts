import { log } from '../logger';
import { sendToSession } from './server';
import { validateMessage } from './validator';
import type { AuthenticatedSession } from './server';

// ---------------------------------------------------------------------------
// Handler registry
// ---------------------------------------------------------------------------

type HandlerFn = (session: AuthenticatedSession, payload: unknown) => Promise<void> | void;

const handlers = new Map<string, HandlerFn>();

export function registerHandler(type: string, fn: HandlerFn): void {
  handlers.set(type, fn);
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

export function dispatch(session: AuthenticatedSession, raw: string): void {
  let msg: { type?: unknown; v?: unknown; payload?: unknown };

  try {
    msg = JSON.parse(raw) as typeof msg;
  } catch {
    log('warn', 'dispatcher', 'parse_error', { accountId: session.accountId });
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: 'Message is not valid JSON.',
    });
    return;
  }

  // Protocol version check
  if (msg.v !== 1) {
    log('warn', 'dispatcher', 'protocol_version_mismatch', {
      accountId: session.accountId,
      received_v: msg.v,
    });
    sendToSession(session, 'server.error', {
      code: 'PROTOCOL_VERSION',
      message: `Unsupported protocol version. Expected v=1, got v=${msg.v}.`,
    });
    return;
  }

  const type = typeof msg.type === 'string' ? msg.type : null;

  if (!type) {
    log('warn', 'dispatcher', 'missing_type', { accountId: session.accountId });
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: 'Message missing required "type" field.',
    });
    return;
  }

  // Payload schema validation
  const validation = validateMessage(type, msg.payload ?? {});
  if (!validation.valid) {
    log('warn', 'dispatcher', 'validation_failed', { accountId: session.accountId, type, error: validation.error });
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: validation.error ?? 'Invalid message payload.',
    });
    return;
  }

  const handler = handlers.get(type);

  if (!handler) {
    log('warn', 'dispatcher', 'unhandled_message_type', {
      accountId: session.accountId,
      type,
    });
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: `Unknown message type: ${type}`,
    });
    return;
  }

  log('debug', 'dispatcher', 'dispatching', { accountId: session.accountId, type });

  Promise.resolve(handler(session, msg.payload ?? {})).catch((err: unknown) => {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log('error', 'dispatcher', 'handler_error', {
      accountId: session.accountId,
      type,
      error: message,
    });
    sendToSession(session, 'server.error', {
      code: 'INTERNAL_ERROR',
      message: 'An internal server error occurred.',
    });
  });
}
