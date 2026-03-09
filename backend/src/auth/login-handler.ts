import * as bcrypt from 'bcrypt';
import { findByUsername, isBanned } from '../db/queries/accounts';
import { findByAccountId } from '../db/queries/characters';
import { signToken } from './jwt';
import { log } from '../logger';
import { sendToSession } from '../websocket/server';
import type { AuthenticatedSession } from '../websocket/server';
import type { AuthLoginPayload } from '@elarion/protocol';

export async function handleAuthLogin(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { username, password } = payload as AuthLoginPayload;

  const account = await findByUsername(username);

  if (!account) {
    log('info', 'auth', 'login_rejected', { reason: 'account_not_found', username });
    sendToSession(session, 'auth.error', {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.',
    });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, account.password_hash);
  if (!passwordMatch) {
    log('info', 'auth', 'login_rejected', { reason: 'wrong_password', accountId: account.id });
    sendToSession(session, 'auth.error', {
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid username or password.',
    });
    return;
  }

  const banned = await isBanned(account.id);
  if (banned) {
    log('warn', 'auth', 'login_rejected', { reason: 'banned', accountId: account.id });
    sendToSession(session, 'auth.error', {
      code: 'INVALID_CREDENTIALS',
      message: 'This account has been suspended.',
    });
    return;
  }

  const character = await findByAccountId(account.id);
  const token = await signToken(account.id, character?.id, account.is_admin);

  session.accountId = account.id;
  session.characterId = character?.id ?? null;
  session.isAdmin = account.is_admin;

  log('info', 'auth', 'login_success', { accountId: account.id, has_character: !!character });
  sendToSession(session, 'auth.success', {
    token,
    has_character: !!character,
  });
}
