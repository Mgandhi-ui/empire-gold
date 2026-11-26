'use client';
import { useState } from 'react';
import { currentRef } from './Track';

const TYPES = ['1 RK', '1 BHK', '1 BHK (Large)', '1.5 BHK', 'Combination', 'Not sure'];
const BUDGETS = ['Under ₹1 Cr', '₹1–1.5 Cr', '₹1.5–2 Cr', 'Above ₹2 Cr', 'Not sure'];
const VISITS = ['This weekend', 'A weekday', 'Next week', 'Just call me first'];

declare global { interface Window { fbq?: (...a: unknown[]) => void } }

export default function EnquiryForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle');
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const data = Object.fromEntries(f.entries()) as Record<string, string>;
    if ((data.name ?? '').trim().length < 2) return setErr('Please tell us your name.');
    if ((data.phone ?? '').replace(/\D/g, '').length < 10) return setErr('Please enter a 10-digit mobile number.');
    setErr(''); setState('sending');
    const eventId = `web-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const r = await fetch('/api/public/enquiry', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, ref: currentRef(), eventId, url: location.href }) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setState('idle'); return setErr(j.error || 'Could not send. Please call +91 99301 12352.'); }
    try { window.fbq?.('track', 'Lead', { content_name: data.interested || 'Empire Gold' }, { eventID: eventId }); } catch {}
    setState('done');
  }
  if (state === 'done') return (
    <div className="done" role="status">
      <b>Thank you. We have your details.</b><br />Someone from the site office will call you shortly to fix a visit. You can also call us on +91 99301 12352.
    </div>
  );
  return (
    <form className="form" onSubmit={submit} noValidate>
      <label>Your name<input name="name" autoComplete="name" required maxLength={80} /></label>
      <div className="row2">
        <label>Mobile<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={16} /></label>
        <label>Email <span className="fine">(optional)</span><input name="email" type="email" autoComplete="email" maxLength={120} /></label>
      </div>
      <div className="row2">
        <label>Interested in<select name="interested" defaultValue="Not sure">{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label>Budget<select name="budget" defaultValue="Not sure">{BUDGETS.map((t) => <option key={t}>{t}</option>)}</select></label>
      </div>
      <label>Best time to visit<select name="visit" defaultValue="This weekend">{VISITS.map((t) => <option key={t}>{t}</option>)}</select></label>
      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="err" aria-live="polite">{err}</p>
      <button className="btn btn-gold" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Book my site visit'}</button>
      <p className="fine">We use your number only to contact you about Empire Gold. No spam, no sharing.</p>
    </form>
  );
}
