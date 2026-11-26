import { need } from '@/lib/auth';
import { q } from '@/lib/db';
import { inr, fmtDate, BOOKING_STATUS } from '@/lib/core';
import { Head, Kpi, type SP } from '../_ui';
import { P } from '@/lib/project';

// What a buyer sees: their home, what they owe and paid, their papers, and how the building is coming along.
export default async function MyHome({ searchParams: _ }: { searchParams: SP }) {
  const u = await need('customer');
  const bookings = await q<{ id: string; flat_no: string; type: string; carpet_sqft: number; floor: number; status: string; booking_date: string; agreement_value: number;
    agreement_date: string | null; possession_date: string | null; handover_date: string | null }>(
    `select b.id, b.flat_no, f.type, f.carpet_sqft, f.floor, b.status, b.booking_date, b.agreement_value, b.agreement_date, b.possession_date, b.handover_date
     from bookings b join flats f on f.no=b.flat_no where b.customer_id=$1 and b.status <> 'cancelled' order by b.booking_date`, [u.customer_id]);
  const updates = await q<{ id: number; date: string; title: string; body: string; has_photo: boolean }>('select id, date, title, body, photo is not null has_photo from updates order by date desc, id desc limit 12');
  const steps = ['booked', 'agreement_registered', 'possession_offered', 'handed_over'];
  return (
    <>
      <Head title={`Welcome, ${u.name.split(' ')[0]}`} sub={`Customer ID ${u.customer_id}`} />
      {!bookings.length && <div className="card">We could not find a booking under your name. Please call {P.phones[0]}.</div>}
      {await Promise.all(bookings.map(async (b) => {
        const stages = await q<{ seq: number; label: string; amount: number; due_date: string | null; demanded_at: string | null }>('select seq, label, amount, due_date, demanded_at from payment_stages where booking_id=$1 order by seq', [b.id]);
        const receipts = await q<{ date: string; amount: number; reference: string | null }>('select date, amount, reference from receipts where booking_id=$1 order by date', [b.id]);
        const docs = await q<{ id: number; title: string }>('select id, title from documents where booking_id=$1 and visible_to_customer order by id', [b.id]);
        const paid = receipts.reduce((t, r) => t + r.amount, 0);
        const demanded = stages.filter((s) => s.demanded_at).reduce((t, s) => t + s.amount, 0);
        let left = paid;
        const at = steps.indexOf(b.status);
        return (
          <section key={b.id}>
            <div className="card">
              <h2>Flat {b.flat_no} · {b.type} · {b.carpet_sqft} sq.ft MahaRERA carpet · {b.floor}th floor</h2>
              <div className="steps">{steps.map((s, i) => <span key={s} className={i <= at ? 'on' : ''}>{BOOKING_STATUS[s]}</span>)}</div>
              <p className="small muted">Booked {fmtDate(b.booking_date)}{b.agreement_date ? ` · agreement registered ${fmtDate(b.agreement_date)}` : ''}{b.possession_date ? ` · possession offered ${fmtDate(b.possession_date)}` : ''}{b.handover_date ? ` · keys handed over ${fmtDate(b.handover_date)}` : ''}</p>
            </div>
            <div className="kpis">
              <Kpi v={inr(b.agreement_value)} label="agreement value" />
              <Kpi v={inr(paid)} label="you have paid" />
              <Kpi v={inr(Math.max(0, demanded - paid))} label="due now" hot={demanded > paid} />
            </div>
            <div className="grid g2">
              <div className="card scroll">
                <h2>Payment schedule</h2>
                <table><thead><tr><th>Stage</th><th className="n">Amount</th><th>Due</th><th>Status</th></tr></thead>
                  <tbody>{stages.length ? stages.map((s) => { const c = Math.min(left, s.amount); left -= c; return (
                    <tr key={s.seq}><td>{s.label}</td><td className="n">{inr(s.amount)}</td><td>{s.demanded_at ? fmtDate(s.due_date) : 'Not yet due'}</td>
                      <td className="small">{c >= s.amount ? 'Paid' : c > 0 ? `${inr(c)} paid` : s.demanded_at ? <b>Please pay</b> : '—'}</td></tr>); })
                    : <tr><td colSpan={4} className="muted">Your schedule will appear here once it is set up.</td></tr>}</tbody></table>
              </div>
              <div className="card scroll">
                <h2>Payments received</h2>
                <table><thead><tr><th>Date</th><th className="n">Amount</th><th>Ref.</th></tr></thead>
                  <tbody>{receipts.length ? receipts.map((r, i) => <tr key={i}><td>{fmtDate(r.date)}</td><td className="n">{inr(r.amount)}</td><td className="small">{r.reference}</td></tr>)
                    : <tr><td colSpan={3} className="muted">None yet.</td></tr>}</tbody></table>
                <h2 style={{ marginTop: 16 }}>Your documents</h2>
                <ul>{docs.length ? docs.map((d) => <li key={d.id}><a href={`/doc/${d.id}`} target="_blank">{d.title}</a></li>) : <li className="muted">Your allotment letter and agreement will appear here.</li>}</ul>
              </div>
            </div>
          </section>
        );
      }))}
      <div className="card">
        <h2>How the building is coming along</h2>
        {updates.length ? updates.map((x) => (
          <div key={x.id} style={{ display: 'grid', gridTemplateColumns: x.has_photo ? '160px 1fr' : '1fr', gap: 14, padding: '12px 0', borderBottom: '1px solid #EFEBE2' }}>
            {x.has_photo && <img src={`/api/update-photo/${x.id}`} alt={x.title} style={{ width: 160, height: 110, objectFit: 'cover', borderRadius: 8 }} />}
            <div><b>{x.title}</b> <span className="small muted">· {fmtDate(x.date)}</span><div className="small" style={{ whiteSpace: 'pre-line' }}>{x.body}</div></div>
          </div>
        )) : <p className="muted">Updates from the site will appear here.</p>}
      </div>
      <p className="small muted">Questions: {P.phones.join(' · ')} · {P.address} · MahaRERA {P.rera}</p>
    </>
  );
}
