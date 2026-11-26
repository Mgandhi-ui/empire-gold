import Link from 'next/link';
import { notFound } from 'next/navigation';
import { need } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { fmtDate, SOURCE_LABEL, STAGES, STAGE_LABEL, TYPES, LOST_REASONS, addDays, todayIST } from '@/lib/core';
import { Head, Stage, Flash, type SP } from '../../../_ui';
import { saveLead, addNote } from '../../../_act';

type L = { id: number; created_at: string; name: string; phone: string; email: string | null; source: string; source_detail: string | null; partner_id: string | null;
  partner_until: string | null; firm: string | null; interested: string | null; budget: string | null; message: string | null; stage: string; next_follow_up: string | null;
  visit_local: string | null; flat_no: string | null; lost_reason: string | null; owner_id: string | null; customer_id: string | null; meta_lead_id: string | null; booking: string | null };

export default async function LeadPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  await need('admin', 'staff');
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();
  const l = await one<L>(`select l.*, p.firm, to_char(l.visit_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD"T"HH24:MI') visit_local,
      (select b.id from bookings b where b.lead_id = l.id and b.status <> 'cancelled' limit 1) booking
    from leads l left join partners p on p.id = l.partner_id where l.id = $1`, [id]);
  if (!l) notFound();
  const notes = await q<{ at: string; text: string; who: string | null }>(`select n.at, n.text, u.name who from lead_notes n left join users u on u.id = n.by_user where n.lead_id = $1 order by n.at desc`, [id]);
  const team = await q<{ id: string; name: string }>(`select id, name from users where role in ('admin','staff') and active order by name`);
  const flats = await q<{ no: string; type: string; status: string }>(`select no, type, status from flats order by floor, no`);
  const t = todayIST();
  return (
    <>
      <Flash s={searchParams} />
      <Head title={l.name} sub={<>{SOURCE_LABEL[l.source]}{l.source_detail ? ` · ${l.source_detail}` : ''} · came in {fmtDate(l.created_at)}{l.meta_lead_id ? ' · Meta Lead Ad' : ''}</>}>
        <a className="btn ghost" href={`tel:+91${l.phone}`}>Call {l.phone}</a>
        <a className="btn ghost" href={`https://wa.me/91${l.phone}`} target="_blank" rel="noopener">WhatsApp</a>
        {l.booking ? <Link className="btn" href={`/admin/bookings/${l.booking}`}>Booking {l.booking}</Link>
          : <Link className="btn gold" href={`/admin/bookings/new?lead=${l.id}`}>Book a flat</Link>}
      </Head>
      {l.partner_id && <div className="flash ok">Broker lead: <b>{l.firm}</b> ({l.partner_id}){l.partner_until ? `, protected until ${fmtDate(l.partner_until)}` : ''}.</div>}
      <div className="grid g2">
        <div className="card">
          <h2>Details <Stage v={l.stage} /></h2>
          <form className="f" action={saveLead}>
            <input type="hidden" name="id" value={l.id} />
            <div className="fr">
              <label>Name<input name="name" defaultValue={l.name} required /></label>
              <label>Email<input name="email" type="email" defaultValue={l.email ?? ''} /></label>
            </div>
            <div className="fr">
              <label>Stage<select name="stage" defaultValue={l.stage}>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
              <label>Next follow-up<input name="next_follow_up" type="date" defaultValue={l.next_follow_up ?? addDays(t, 1)} /></label>
              <label>Site visit<input name="visit_at" type="datetime-local" defaultValue={l.visit_local ?? ''} /></label>
            </div>
            <div className="fr">
              <label>Interested in<select name="interested" defaultValue={l.interested ?? ''}>{['', ...TYPES].map((x) => <option key={x}>{x}</option>)}</select></label>
              <label>Budget<input name="budget" defaultValue={l.budget ?? ''} /></label>
              <label>Flat discussed<select name="flat_no" defaultValue={l.flat_no ?? ''}><option value="">—</option>{flats.map((f) => <option key={f.no} value={f.no}>{f.no} · {f.type}{f.status !== 'available' ? ` (${f.status})` : ''}</option>)}</select></label>
            </div>
            <div className="fr">
              <label>Lost reason (if lost)<select name="lost_reason" defaultValue={l.lost_reason ?? ''}><option value="">—</option>{LOST_REASONS.map((r) => <option key={r}>{r}</option>)}</select></label>
              <label>Owner<select name="owner_id" defaultValue={l.owner_id ?? ''}><option value="">Me</option>{team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}</select></label>
            </div>
            {l.message && <p className="small" style={{ whiteSpace: 'pre-line' }}><b>From the enquiry:</b> {l.message}</p>}
            <div><button type="submit">Save</button></div>
          </form>
        </div>
        <div className="card">
          <h2>Notes and calls</h2>
          <form className="f" action={addNote}>
            <input type="hidden" name="id" value={l.id} />
            <label>What happened<textarea name="text" placeholder="Called, wants 1 BHK on a high floor, coming Saturday 11 am…" required /></label>
            <div className="inline"><label>Next follow-up<input name="next_follow_up" type="date" defaultValue={addDays(t, 2)} /></label><button type="submit">Add note</button></div>
          </form>
          <ul className="timeline" style={{ marginTop: 16 }}>
            {notes.map((n, i) => <li key={i}><time>{new Date(n.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' })}{n.who ? ` · ${n.who}` : ''}</time><div style={{ whiteSpace: 'pre-line' }}>{n.text}</div></li>)}
            {!notes.length && <li className="muted">No notes yet.</li>}
          </ul>
        </div>
      </div>
    </>
  );
}
