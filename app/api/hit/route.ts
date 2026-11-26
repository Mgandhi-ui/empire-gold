// Page views per day, path and ?ref= tag (no cookies, no personal data), for the back-office dashboard.
import { pool } from '@/lib/db';
import { clip } from '@/lib/core';
import { originOk } from '../_util';

export async function POST(req: Request) {
  if (!originOk(req)) return new Response(null, { status: 204 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const path = clip(b.path, 60).replace(/[^a-z0-9/_-]/gi, '') || '/';
  const ref = clip(b.ref, 30).toLowerCase().replace(/[^a-z0-9_-]/g, '');
  await pool.query(`insert into site_hits(day, path, ref, n) values ((now() at time zone 'Asia/Kolkata')::date, $1, $2, 1)
    on conflict (day, path, ref) do update set n = site_hits.n + 1`, [path, ref]).catch(() => {});
  return new Response(null, { status: 204 });
}
