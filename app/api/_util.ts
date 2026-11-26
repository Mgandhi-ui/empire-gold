// Shared bits for the public API routes.
import { UserError } from '@/lib/core';

const ORIGINS = () => (process.env.EG_SITE_ORIGINS || 'https://empiregoldmazgaon.com,https://www.empiregoldmazgaon.com').split(',').map((s) => s.trim());
/** A browser POST must come from our own website (browsers always send Origin on a POST; other sites cannot fake it). */
export function originOk(req: Request) {
  const o = req.headers.get('origin');
  if (!o) return false;
  if (ORIGINS().includes(o)) return true;
  return process.env.VERCEL_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
}
export const isJson = (req: Request) => /^application\/json(\s*;|$)/i.test(req.headers.get('content-type') ?? '');
export const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
export function errorJson(e: unknown) {
  if (e instanceof UserError) return json({ error: e.message }, e.status);
  console.error(e);
  return json({ error: 'Something went wrong on our side. Please call +91 99301 12352.' }, 500);
}
