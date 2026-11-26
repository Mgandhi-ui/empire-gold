'use client';
import { useState } from 'react';

export default function PartnerForm() {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'already'>('idle');
  const [err, setErr] = useState('');
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setErr(''); setState('sending');
    const r = await fetch('/api/public/partner', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setState('idle'); return setErr(j.error || 'Could not send. Please call +91 99301 12352.'); }
    setState(j.already ? 'already' : 'done');
  }
  if (state !== 'idle' && state !== 'sending') return (
    <div className="done" role="status">
      {state === 'already' ? <><b>You have already applied.</b><br />We will be in touch shortly.</>
        : <><b>Thank you. Your application is in.</b><br />Once we approve it, your partner login arrives by email and you can start registering clients.</>}
    </div>
  );
  return (
    <form className="form" onSubmit={submit} noValidate>
      <div className="row2">
        <label>Your name<input name="contact" autoComplete="name" required maxLength={80} /></label>
        <label>Firm name<input name="firm" autoComplete="organization" maxLength={120} /></label>
      </div>
      <div className="row2">
        <label>Mobile<input name="phone" type="tel" inputMode="tel" autoComplete="tel" required maxLength={16} /></label>
        <label>Email<input name="email" type="email" autoComplete="email" required maxLength={120} /></label>
      </div>
      <div className="row2">
        <label>MahaRERA agent no.<input name="rera" placeholder="A519000…" required maxLength={20} /></label>
        <label>Area you work in<input name="area" placeholder="e.g. Byculla, Mazgaon" maxLength={80} /></label>
      </div>
      <input className="hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <p className="err" aria-live="polite">{err}</p>
      <button className="btn btn-gold" type="submit" disabled={state === 'sending'}>{state === 'sending' ? 'Sending…' : 'Apply to partner'}</button>
    </form>
  );
}
