// Sign-in for back.empiregoldmazgaon.com: a 6-digit code sent to the person's email, then a 30-day session cookie.
// Only people already in `users` can get a code (staff added by an admin; brokers when approved; buyers when booked).
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, pool } from './db';
import { codeHash, newCode, newToken, sha, same, cleanEmail, fail, ipOf, limit } from './core';
import { sendMail } from './mail';

export type Role = 'admin' | 'staff' | 'partner' | 'customer';
export type User = { id: string; email: string; name: string; role: Role; partner_id: string | null; customer_id: string | null };

const COOKIE = 'eg_s';
const DAYS = 30;

export async function requestCode(emailRaw: string) {
  const email = cleanEmail(emailRaw);
  if (!email) fail('Please enter a valid email address.');
  const ip = ipOf(headers());
  await limit(`code-ip:${ip}`, 20, 60);
  await limit(`code:${email}`, 5, 15);
  const u = await one<{ id: string; name: string }>('select id, name from users where email = $1 and active', [email]);
  // Same answer whether or not the email is known, so nobody can find out who has an account.
  if (!u) return;
  const code = newCode();
  await pool.query(`insert into otps(email, code_hash, tries, expires_at) values ($1,$2,0, now() + interval '10 minutes')
    on conflict (email) do update set code_hash = excluded.code_hash, tries = 0, expires_at = excluded.expires_at, created_at = now()`, [email, codeHash(email!, code)]);
  if (process.env.EG_OTP_TEST === '1' && process.env.VERCEL_ENV !== 'production') console.log(`[test] code for ${email}: ${code}`);
  await sendMail(email!, `${code} is your Empire Gold sign-in code`,
    `Hello ${u.name},\n\nYour code to sign in at back.empiregoldmazgaon.com is ${code}.\nIt works for 10 minutes. If you did not ask for it, ignore this email.\n\nEmpire Gold, Mazgaon`);
}

export async function verifyCode(emailRaw: string, codeRaw: string): Promise<User> {
  const email = cleanEmail(emailRaw) ?? fail('Please enter a valid email address.');
  const code = String(codeRaw ?? '').replace(/\D/g, '');
  await limit(`verify-ip:${ipOf(headers())}`, 30, 60);
  const o = await one<{ code_hash: string; tries: number; expired: boolean }>('select code_hash, tries, expires_at < now() as expired from otps where email = $1', [email]);
  if (!o || o.expired) fail('That code has expired. Ask for a new one.');
  if (o!.tries >= 5) fail('Too many wrong codes. Ask for a new one.');
  if (code.length !== 6 || !same(o!.code_hash, codeHash(email, code))) {
    await pool.query('update otps set tries = tries + 1 where email = $1', [email]);
    fail('That code is not right. Check the email and try again.');
  }
  await pool.query('delete from otps where email = $1', [email]);
  const u = await one<User>('select id, email, name, role, partner_id, customer_id from users where email = $1 and active', [email]);
  if (!u) fail('This account is not active.');
  const token = newToken();
  await pool.query(`insert into sessions(token_hash, user_id, expires_at) values ($1,$2, now() + make_interval(days => $3))`, [sha(token), u!.id, DAYS]);
  await pool.query('update users set last_login = now() where id = $1', [u!.id]);
  await pool.query(`delete from sessions where expires_at < now()`);
  cookies().set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: DAYS * 86400 });
  return u!;
}

export async function currentUser(): Promise<User | null> {
  const t = cookies().get(COOKIE)?.value;
  if (!t || t.length > 100) return null;
  return (await one<User>(`select u.id, u.email, u.name, u.role, u.partner_id, u.customer_id from sessions s join users u on u.id = s.user_id
    where s.token_hash = $1 and s.expires_at > now() and u.active`, [sha(t)])) ?? null;
}

/** For pages and actions: the signed-in person, if their role is allowed; otherwise off to the sign-in page. */
export async function need(...roles: Role[]): Promise<User> {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (!roles.includes(u.role)) redirect('/');
  return u;
}
export const isStaff = (u: User) => u.role === 'admin' || u.role === 'staff';

export async function signOut() {
  const t = cookies().get(COOKIE)?.value;
  if (t) await pool.query('delete from sessions where token_hash = $1', [sha(t)]);
  cookies().delete(COOKIE);
}

export const homeFor = (role: Role) => (role === 'partner' ? '/partner' : role === 'customer' ? '/my' : '/admin');
