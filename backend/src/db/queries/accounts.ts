import { query } from '../connection';

export interface Account {
  id: string;
  username: string;
  password_hash: string;
  created_at: Date;
  banned_at: Date | null;
}

export async function insertAccount(username: string, passwordHash: string): Promise<Account> {
  const result = await query<Account>(
    `INSERT INTO accounts (username, password_hash)
     VALUES ($1, $2)
     RETURNING id, username, password_hash, created_at, banned_at`,
    [username, passwordHash],
  );
  return result.rows[0];
}

export async function findByUsername(username: string): Promise<Account | null> {
  const result = await query<Account>(
    `SELECT id, username, password_hash, created_at, banned_at
     FROM accounts
     WHERE LOWER(username) = LOWER($1)`,
    [username],
  );
  return result.rows[0] ?? null;
}

export async function isBanned(accountId: string): Promise<boolean> {
  const result = await query<{ banned_at: Date | null }>(
    `SELECT banned_at FROM accounts WHERE id = $1`,
    [accountId],
  );
  return result.rows[0]?.banned_at !== null && result.rows[0]?.banned_at !== undefined;
}
