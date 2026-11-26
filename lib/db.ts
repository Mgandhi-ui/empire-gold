// The Empire Gold database (Supabase Postgres). Server only: the browser never talks to it.
import pg from 'pg';

// bigint (count, sums) come back as numbers; rupee amounts stay well inside 2^53.
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
// dates stay as 'YYYY-MM-DD' text, so no time-zone shifts.
pg.types.setTypeParser(1082, (v) => v);

const url = process.env.EG_DATABASE_URL ?? '';
const g = globalThis as unknown as { egPool?: pg.Pool };
export const pool = g.egPool ?? new pg.Pool({
  connectionString: url,
  max: 4, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 8_000,
  ssl: /localhost|127\.0\.0\.1/.test(url) ? undefined : { rejectUnauthorized: false },
});
g.egPool = pool;

export const q = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows as T[];
export const one = async <T = Record<string, any>>(sql: string, params: unknown[] = []) => (await pool.query(sql, params)).rows[0] as T | undefined;

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try { await c.query('begin'); const r = await fn(c); await c.query('commit'); return r; }
  catch (e) { await c.query('rollback').catch(() => {}); throw e; }
  finally { c.release(); }
}

export async function audit(userId: string | null, kind: string, ref: string | null, data?: unknown) {
  await pool.query('insert into audit(user_id, kind, ref, data) values ($1,$2,$3,$4)', [userId, kind, ref, data ? JSON.stringify(data) : null]);
}

export async function setting(key: string, fallback = ''): Promise<string> {
  const r = await one<{ value: string }>('select value from settings where key = $1', [key]);
  return r?.value ?? process.env[key.toUpperCase()] ?? fallback;
}
