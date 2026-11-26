import Link from 'next/link';
import { notFound } from 'next/navigation';
import { need } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { inr, fmtDate, todayIST, BOOKING_STATUS } from '@/lib/core';
import { Head, Flash, BStatus, Kpi, type SP } from '../../../_ui';
import { saveBooking, cancelBooking, addStage, demandStage, deleteStage, addReceipt, addPayout, uploadDoc } from '../../../_act';

type B = { id: string; flat_no: string; type: string; carpet_sqft: number; customer_id: string; buyer: string; phone: string; email: string | null; co_applicant: string | null;
  partner_id: string | null; firm: string | null; lead_id: number | null; booking_date: string; agreement_value: number; brokerage_pct: number; brokerage_amount: number;
  status: string; agreement_date: string | null; possession_date: string | null; handover_date: string | null; note: string | null; has_login: boolean };
const MODES: Record<string, string> = { cheque: 'Cheque', neft_rtgs: 'NEFT / RTGS', upi: 'UPI', home_loan: 'Home loan disbursal', other: 'Other' };

export default async function BookingPage({ params, searchParams }: { params: { id: string }; searchParams: SP }) {
  const u = await need('admin', 'staff');
  const b = await one<B>(`select b.*, f.type, f.carpet_sqft, c.name buyer, c.phone, c.email, c.co_applicant, p.firm,
      exists(select 1 from users x where x.customer_id = b.customer_id and x.active) has_login
    from bookings b join flats f on f.no=b.flat_no join customers c on c.id=b.customer_id left join partners p on p.id=b.partner_id where b.id = $1`, [params.id]);
  if (!b) notFound();
  const stages = await q<{ id: number; seq: number; label: string; pct: number | null; amount: number; due_date: string | null; demanded_at: string | null }>(
    'select * from payment_stages where booking_id = $1 order by seq', [b.id]);
  const receipts = await q<{ id: number; date: string; amount: number; mode: string; reference: string | null; note: string | null }>('select * from receipts where booking_id = $1 order by date, id', [b.id]);
  const payouts = await q<{ id: number; date: string; amount: number; reference: string | null }>('select * from brokerage_payouts where booking_id = $1 order by date, id', [b.id]);
  const docs = await q<{ id: number; title: string; visible_to_customer: boolean; created_at: string }>('select id, title, visible_to_customer, created_at from documents where booking_id = $1 order by id', [b.id]);
  const paid = receipts.reduce((t, r) => t + r.amount, 0);
  const demanded = stages.filter((s) => s.demanded_at).reduce((t, s) => t + s.amount, 0);
  const scheduled = stages.reduce((t, s) => t + s.amount, 0);
  const bPaid = payouts.reduce((t, r) => t + r.amount, 0);
  const live = b.status !== 'cancelled';
  // Which stages are covered by what has been received, in order.
  let left = paid;
  const cover = stages.map((s) => { const c = Math.min(left, s.amount); left -= c; return c; });
  return (
    <>
      <Flash s={searchParams} />
      <Head title={`${b.id} · Flat ${b.flat_no}`} sub={<>{b.type}, {b.carpet_sqft} sq.ft · booked {fmtDate(b.booking_date)} · <BStatus v={b.status} /></>}>
        {b.lead_id && <Link className="btn ghost" href={`/admin/leads/${b.lead_id}`}>Lead</Link>}
      </Head>
      <div className="kpis">
        <Kpi v={inr(b.agreement_value)} label="agreement value" />
        <Kpi v={inr(paid)} label={`received · ${b.agreement_value ? Math.round((paid / b.agreement_value) * 100) : 0}%`} />
        <Kpi v={inr(Math.max(0, demanded - paid))} label="demanded, not received" hot={demanded > paid} />
        <Kpi v={inr(b.agreement_value - paid)} label="balance to come" />
        {b.partner_id && <Kpi v={inr(b.brokerage_amount - bPaid)} label={`brokerage due to ${b.firm}`} />}
      </div>
      <div className="grid g2">
        <div className="card">
          <h2>Buyer</h2>
          <p><b>{b.buyer}</b> · customer ID <b>{b.customer_id}</b>{b.co_applicant ? ` · with ${b.co_applicant}` : ''}</p>
          <p className="small">{b.phone}{b.email ? ` · ${b.email}` : ''} · {b.has_login ? 'has a buyer login' : 'no login (add an email at booking to give one)'}</p>
          <h2 style={{ marginTop: 16 }}>Broker</h2>
          <p>{b.partner_id ? <><b>{b.firm}</b> ({b.partner_id}) · {b.brokerage_pct}% = {inr(b.brokerage_amount)}</> : 'Direct sale, no brokerage.'}</p>
        </div>
        <div className="card">
          <h2>Status</h2>
          {live ? (
            <form className="f" action={saveBooking}>
              <input type="hidden" name="id" value={b.id} />
              <div className="fr">
                <label>Status<select name="status" defaultValue={b.status}>{Object.entries(BOOKING_STATUS).filter(([k]) => k !== 'cancelled').map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label>Agreement value (₹)<input name="agreement_value" defaultValue={b.agreement_value} /></label>
                <label>Brokerage %<input name="brokerage_pct" defaultValue={b.brokerage_pct} /></label>
              </div>
              <div className="fr">
                <label>Agreement registered<input type="date" name="agreement_date" defaultValue={b.agreement_date ?? ''} /></label>
                <label>Possession offered<input type="date" name="possession_date" defaultValue={b.possession_date ?? ''} /></label>
                <label>Keys handed over<input type="date" name="handover_date" defaultValue={b.handover_date ?? ''} /></label>
              </div>
              <label>Note<textarea name="note" defaultValue={b.note ?? ''} /></label>
              <div><button type="submit">Save</button></div>
            </form>
          ) : <p className="muted" style={{ whiteSpace: 'pre-line' }}>Cancelled. {b.note}</p>}
        </div>
      </div>

      <div className="card scroll" id="schedule">
        <h2>Payment schedule</h2>
        <table>
          <thead><tr><th>#</th><th>Stage</th><th className="n">%</th><th className="n">Amount</th><th>Due</th><th>Demand</th><th className="n">Covered by receipts</th><th></th></tr></thead>
          <tbody>
            {stages.map((s, i) => (
              <tr key={s.id}><td>{s.seq}</td><td>{s.label}</td><td className="n">{s.pct ?? '—'}</td><td className="n">{inr(s.amount)}</td><td>{fmtDate(s.due_date)}</td>
                <td>{s.demanded_at ? `sent ${fmtDate(s.demanded_at)}` : live && (<form action={demandStage}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="stage_id" value={s.id} /><button className="ghost" type="submit">Mark demanded</button></form>)}</td>
                <td className="n">{cover[i] >= s.amount ? 'Paid' : cover[i] > 0 ? inr(cover[i]) : '—'}</td>
                <td>{live && !s.demanded_at && <form action={deleteStage}><input type="hidden" name="id" value={b.id} /><input type="hidden" name="stage_id" value={s.id} /><button className="danger" type="submit">Remove</button></form>}</td></tr>
            ))}
            <tr><td></td><td><b>Total scheduled</b></td><td></td><td className="n"><b>{inr(scheduled)}</b></td><td colSpan={4} className="small muted">{scheduled < b.agreement_value ? `${inr(b.agreement_value - scheduled)} of the agreement value not yet in a stage` : 'Whole agreement value scheduled'}</td></tr>
          </tbody>
        </table>
        {live && (
          <form action={addStage} className="inline" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={b.id} />
            <label>Stage<input name="label" placeholder="On casting of 10th slab" required style={{ width: 240 }} /></label>
            <label>% of value<input name="pct" placeholder="10" style={{ width: 80 }} /></label>
            <label>or ₹ amount<input name="amount" style={{ width: 140 }} /></label>
            <label>Due date<input name="due_date" type="date" /></label>
            <button type="submit" className="ghost">Add stage</button>
          </form>
        )}
        <p className="small muted">Under MahaRERA no more than 10% may be taken before the agreement for sale is registered.</p>
      </div>

      <div className="grid g2">
        <div className="card scroll" id="receipts">
          <h2>Received from buyer</h2>
          <table>
            <thead><tr><th>Date</th><th className="n">Amount</th><th>Mode</th><th>Ref.</th></tr></thead>
            <tbody>{receipts.length ? receipts.map((r) => <tr key={r.id}><td>{fmtDate(r.date)}</td><td className="n">{inr(r.amount)}</td><td className="small">{MODES[r.mode]}</td><td className="small">{r.reference}{r.note ? ` · ${r.note}` : ''}</td></tr>)
              : <tr><td colSpan={4} className="muted">Nothing received yet.</td></tr>}</tbody>
          </table>
          {live && (
            <form action={addReceipt} className="f" style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={b.id} />
              <div className="fr">
                <label>Date<input name="date" type="date" defaultValue={todayIST()} required /></label>
                <label>Amount (₹)<input name="amount" required /></label>
                <label>Mode<select name="mode" defaultValue="neft_rtgs">{Object.entries(MODES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              </div>
              <div className="fr"><label>Cheque / UTR no.<input name="reference" /></label><label>Note<input name="note" /></label></div>
              <div><button type="submit">Record receipt</button></div>
            </form>
          )}
        </div>
        <div className="card scroll" id="brokerage">
          <h2>Brokerage</h2>
          {b.partner_id ? (<>
            <p className="small">{b.firm} earns <b>{inr(b.brokerage_amount)}</b> ({b.brokerage_pct}%). Paid {inr(bPaid)}, due {inr(b.brokerage_amount - bPaid)}.</p>
            <table>
              <thead><tr><th>Date</th><th className="n">Paid</th><th>Ref.</th></tr></thead>
              <tbody>{payouts.length ? payouts.map((p) => <tr key={p.id}><td>{fmtDate(p.date)}</td><td className="n">{inr(p.amount)}</td><td className="small">{p.reference}</td></tr>)
                : <tr><td colSpan={3} className="muted">Nothing paid yet. Usually paid after the agreement is registered.</td></tr>}</tbody>
            </table>
            {live && u.role === 'admin' && (
              <form action={addPayout} className="inline" style={{ marginTop: 12 }}>
                <input type="hidden" name="id" value={b.id} />
                <label>Date<input name="date" type="date" defaultValue={todayIST()} /></label>
                <label>Amount (₹)<input name="amount" required style={{ width: 140 }} /></label>
                <label>UTR / cheque<input name="reference" style={{ width: 140 }} /></label>
                <button type="submit" className="ghost">Record payout</button>
              </form>
            )}
          </>) : <p className="muted">Direct sale.</p>}
        </div>
      </div>

      <div className="card" id="docs">
        <h2>Documents</h2>
        <ul>{docs.map((d) => <li key={d.id}><a href={`/doc/${d.id}`} target="_blank">{d.title}</a> <span className="small muted">· {fmtDate(d.created_at)} · {d.visible_to_customer ? 'buyer can see' : 'office only'}</span></li>)}
          {!docs.length && <li className="muted">None yet: allotment letter, agreement, receipts…</li>}</ul>
        <form action={uploadDoc} className="inline">
          <input type="hidden" name="id" value={b.id} />
          <label>Title<input name="title" placeholder="Allotment letter" /></label>
          <label>File (PDF/JPG/PNG, 5 MB)<input name="file" type="file" accept="application/pdf,image/jpeg,image/png" required /></label>
          <label className="chk"><input type="checkbox" name="visible" defaultChecked /> Buyer can see</label>
          <button type="submit" className="ghost">Upload</button>
        </form>
      </div>

      {live && u.role === 'admin' && (
        <details>
          <summary>Cancel this booking</summary>
          <form action={cancelBooking} className="inline">
            <input type="hidden" name="id" value={b.id} />
            <label>Reason<input name="reason" required style={{ width: 280 }} /></label>
            <label>Type CANCEL<input name="confirm" required style={{ width: 120 }} /></label>
            <button type="submit" className="danger">Cancel booking and free flat {b.flat_no}</button>
          </form>
        </details>
      )}
    </>
  );
}
