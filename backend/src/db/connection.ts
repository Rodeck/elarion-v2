import { Pool, QueryResult, QueryResultRow } from 'pg';
import { config } from '../config';

const pool = new Pool({ connectionString: config.databaseUrl, max: 10 });

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params);
}

export async function getClient() {
  return pool.connect();
}

export async function closePool(): Promise<void> {
  await pool.end();
}
