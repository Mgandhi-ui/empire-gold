// Small shared pieces: hashing, validation, money, rate limits, request helpers.
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { pool } from './db';

export const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const newToken = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const newCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
export const same = (a: string, b: string) => { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); };

// EG_SECRET if set; otherwise derived from the database password (also a secret only the server knows).
const secret = () => {
  const s = process.env.EG_SECRET || process.env.SUPABASE_JWT_SECRET || process.env.POSTGRES_PASSWORD || '';
  if (s.length < 16 && process.env.VERCEL_ENV === 'production') throw new Error('EG_SECRET must be set (32+ characters).');
  return s ? 'eg|' + s : 'dev-only-secret-dev-only-secret-dev-only';
};
export const codeHash = (email: string, code: string) => createHmac('sha256', secret()).update(`${email}|${code}`).digest('hex');

export class UserError extends Error { status: number; constructor(message: string, status = 400) { super(message); this.status = status; } }
export const fail = (message: string, status = 400): never => { throw new UserError(message, status); };

export const clip = (v: unknown, n: number) => String(v ?? '').trim().slice(0, n);
export function cleanEmail(v: unknown): string | null {
  const e = String(v ?? '').trim().toLowerCase();
  return /^[^\s@]{1,64}@[^\s@]{1,190}\.[a-z]{2,}$/.test(e) ? e : null;
}
/** An Indian mobile as people type it (+91, 0, spaces, dashes) → 10 digits, or null. */
export function mobile(v: unknown): string | null {
  const m = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(String(v ?? '').replace(/[\s().-]/g, ''));
  return m ? m[1] : null;
}
/** Rupees typed as 1,04,30,000 or 10430000 or "1.04 cr" → whole rupees, or null. */
export function rupees(v: unknown): number | null {
  const s = String(v ?? '').toLowerCase().replace(/[₹,\s]/g, '');
  if (!s) return null;
  const m = /^(\d+(?:\.\d+)?)(cr|crore|l|lakh|lac)?$/.exec(s);
  if (!m) return null;
  const n = Number(m[1]) * (m[2]?.startsWith('c') ? 1e7 : m[2] ? 1e5 : 1);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
}
export const inr = (n: number | null | undefined) => (n == null ? '—' : '₹' + Math.round(n).toLocaleString('en-IN'));
/** ₹1.04 Cr / ₹88.2 L, for summaries. */
export function inrShort(n: number | null | undefined) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(1)} L`;
  return inr(n);
}
export const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return '—';
  const x = typeof d === 'string' ? new Date(d.length === 10 ? d + 'T00:00:00+05:30' : d) : d;
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
};
export const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
export const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);

export const ipOf = (h: Headers) => (h.get('x-real-ip') || h.get('x-forwarded-for')?.split(',')[0] || '').trim().slice(0, 45) || 'unknown';
/** At most n calls in the window for this key. Counts this call. */
export async function limit(key: string, n: number, minutes: number, message = 'Too many tries. Please wait a few minutes and try again.') {
  const r = await pool.query(`with ins as (insert into hits_log(key) values ($1)) select count(*)::int c from hits_log where key = $1 and at > now() - make_interval(mins => $2)`, [key, minutes]);
  if (r.rows[0].c >= n) fail(message, 429);
}

export const SOURCES = ['website', 'meta', 'google', 'portal', 'broker', 'hoarding', 'referral', 'walk_in', 'other'] as const;
export const SOURCE_LABEL: Record<string, string> = { website: 'Website', meta: 'Meta ad', google: 'Google ad', portal: 'Portal', broker: 'Broker', hoarding: 'Hoarding / QR', referral: 'Referral', walk_in: 'Walk-in', other: 'Other' };
export const STAGES = ['new', 'contacted', 'visit_booked', 'visited', 'negotiation', 'booked', 'lost'] as const;
export const STAGE_LABEL: Record<string, string> = { new: 'New', contacted: 'Contacted', visit_booked: 'Visit booked', visited: 'Site visit done', negotiation: 'Negotiation', booked: 'Booked', lost: 'Lost' };
export const LOST_REASONS = ['Budget', 'Location', 'Size / layout', 'Possession date', 'Home loan', 'No response', 'Bought elsewhere', 'Not genuine'];
export const BOOKING_STATUS: Record<string, string> = { booked: 'Booked', agreement_registered: 'Agreement registered', possession_offered: 'Possession offered', handed_over: 'Keys handed over', cancelled: 'Cancelled' };
export const TYPES = ['1 RK', '1 BHK', '1 BHK (Large)', '1.5 BHK', 'Combination', 'Not sure'];
