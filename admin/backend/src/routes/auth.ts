import { Router } from 'express';
import bcrypt from 'bcrypt';
import { SignJWT } from 'jose';
import { pool } from '../middleware/auth';
import { config } from '../config';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const result = await pool.query<{ id: string; password_hash: string; is_admin: boolean }>(
      'SELECT id, password_hash, is_admin FROM accounts WHERE LOWER(username) = LOWER($1)',
      [username],
    );

    if (result.rows.length === 0) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const account = result.rows[0]!;
    const valid = await bcrypt.compare(password, account.password_hash);

    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    if (!account.is_admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    const secret = new TextEncoder().encode(config.jwtSecret);
    const token = await new SignJWT({ sub: account.id, username })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('8h')
      .sign(secret);

    res.json({ token });
  } catch {
    res.status(500).json({ error: 'Internal server error' });
  }
});
