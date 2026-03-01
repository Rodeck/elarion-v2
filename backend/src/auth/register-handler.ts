import * as bcrypt from 'bcrypt';
import { findByUsername, insertAccount } from '../db/queries/accounts';
import { signToken } from './jwt';
import { log } from '../logger';
import { sendToSession } from '../websocket/server';
import type { AuthenticatedSession } from '../websocket/server';
import type { AuthRegisterPayload } from '@elarion/protocol';

const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,32}$/;
const BCRYPT_ROUNDS = 12;

export async function handleAuthRegister(session: AuthenticatedSession, payload: unknown): Promise<void> {
  const { username, password } = payload as AuthRegisterPayload;

  if (!USERNAME_REGEX.test(username)) {
    log('info', 'auth', 'register_rejected', { reason: 'username_invalid' });
    sendToSession(session, 'auth.error', {
      code: 'USERNAME_INVALID',
      message: 'Username must be 3–32 characters and contain only letters, numbers, and underscores.',
    });
    return;
  }

  if (!password || password.length < 8) {
    log('info', 'auth', 'register_rejected', { reason: 'password_too_short' });
    sendToSession(session, 'auth.error', {
      code: 'PASSWORD_TOO_SHORT',
      message: 'Password must be at least 8 characters.',
    });
    return;
  }

  const existing = await findByUsername(username);
  if (existing) {
    log('info', 'auth', 'register_rejected', { reason: 'username_taken', username });
    sendToSession(session, 'auth.error', {
      code: 'USERNAME_TAKEN',
      message: 'That username is already taken.',
    });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const account = await insertAccount(username, passwordHash);
  const token = await signToken(account.id);

  session.accountId = account.id;

  log('info', 'auth', 'register_success', { accountId: account.id, username });
  sendToSession(session, 'auth.success', { token, has_character: false });
}
