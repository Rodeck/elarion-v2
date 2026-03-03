import { jwtVerify } from 'jose';
import { Pool } from 'pg';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config';

export const pool = new Pool({ connectionString: config.databaseUrl });

declare global {
  namespace Express {
    interface Request {
      account_id?: number;
      username?: string;
    }
  }
}

export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const secret = new TextEncoder().encode(config.jwtSecret);
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    const account_id = payload.sub ?? (typeof payload['accountId'] === 'string' ? payload['accountId'] : undefined);
    if (!account_id) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const result = await pool.query<{ is_admin: boolean }>(
      'SELECT is_admin FROM accounts WHERE id = $1',
      [account_id],
    );

    if (result.rows.length === 0 || !result.rows[0]!.is_admin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }

    req.account_id = account_id;
    req.username = typeof payload['username'] === 'string' ? payload['username'] : undefined;

    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}
