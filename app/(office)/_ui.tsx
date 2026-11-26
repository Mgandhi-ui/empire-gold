// Small building blocks for back-office pages.
import Link from 'next/link';
import { STAGE_LABEL, BOOKING_STATUS, inr } from '@/lib/core';

export type SP = Record<string, string | string[] | undefined>;
export const sp = (s: SP, k: string) => { const v = s[k]; return (Array.isArray(v) ? v[0] : v) ?? ''; };

export function Flash({ s }: { s: SP }) {
  const ok = sp(s, 'ok'), err = sp(s, 'err');
  return <>{ok && <div className="flash ok" role="status">{ok}</div>}{err && <div className="flash err" role="alert">{err}</div>}</>;
}
export function Head({ title, sub, children }: { title: string; sub?: React.ReactNode; children?: React.ReactNode }) {
  return <div className="head"><div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div><div className="inline">{children}</div></div>;
}
export const Stage = ({ v }: { v: string }) => <span className={`pill ${v}`}>{STAGE_LABEL[v] ?? v}</span>;
export const BStatus = ({ v }: { v: string }) => <span className={`pill ${v}`}>{BOOKING_STATUS[v] ?? v}</span>;
export const Pill = ({ v, label }: { v: string; label?: string }) => <span className={`pill ${v}`}>{label ?? v}</span>;
export const Kpi = ({ v, label, hot }: { v: React.ReactNode; label: string; hot?: boolean }) => <div className={`kpi${hot ? ' hot' : ''}`}><b>{v}</b><span>{label}</span></div>;
export const Money = ({ v }: { v: number | null | undefined }) => <>{inr(v)}</>;
export const A = ({ href, children }: { href: string; children: React.ReactNode }) => <Link href={href}>{children}</Link>;
export const maskPhone = (p: string) => (p ? `${p.slice(0, 2)}••••${p.slice(-4)}` : '');
