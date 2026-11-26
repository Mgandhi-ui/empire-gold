'use client';
// Remembers where the visitor came from (?ref=meta, ?utm_source=google, …) for the enquiry form, and counts the page view.
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function currentRef(): string {
  try { return sessionStorage.getItem('eg_ref') || ''; } catch { return ''; }
}

export default function Track() {
  const path = usePathname();
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    const ref = (p.get('ref') || p.get('utm_source') || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 30);
    try { if (ref) sessionStorage.setItem('eg_ref', ref); } catch {}
    fetch('/api/hit', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path, ref: ref || currentRef() }), keepalive: true }).catch(() => {});
  }, [path]);
  return null;
}
