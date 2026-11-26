import { need } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { inr, fmtDate, STAGE_LABEL, BOOKING_STATUS, TYPES } from '@/lib/core';
import { Head, Flash, Kpi, Pill, BStatus, type SP } from '../_ui';
import { partnerRegister } from '../_act';

// What a broker sees: their own clients and sales, their brokerage, nothing about anyone else.
export default async function PartnerHome({ searchParams }: { searchParams: SP }) {
  const u = await need('partner');
  const p = await one<{ id: string; firm: string; status: string; brokerage_pct: number }>('select id, firm, status, brokerage_pct from partners where id = $1', [u.partner_id]);
  if (!p) return <p>Your partner account is not set up. Call +91 99301 12352.</p>;
  const sales = await q<{ id: string; flat_no: string; type: string; customer_id: string; buyer: string; booking_date: string; status: string; agreement_value: number; brokerage_pct: number; brokerage_amount: number; paid: number }>(
    `select b.id, b.flat_no, f.type, b.customer_id, split_part(c.name, ' ', 1) buyer, b.booking_date, b.status, b.agreement_value, b.brokerage_pct, b.brokerage_amount,
      (select coalesce(sum(amount),0) from brokerage_payouts x where x.booking_id=b.id) paid
     from bookings b join flats f on f.no=b.flat_no join customers c on c.id=b.customer_id where b.partner_id=$1 and b.status <> 'cancelled' order by b.booking_date desc`, [p.id]);
  const clients = await q<{ id: number; name: string; phone: string; created_at: string; partner_until: string | null; stage: string; visit_at: string | null }>(
    `select id, name, phone, created_at, partner_until, stage, visit_at from leads where partner_id=$1 order by created_at desc limit 200`, [p.id]);
  const payouts = await q<{ date: string; amount: number; reference: string | null; booking_id: string; flat_no: string }>(
    `select x.date, x.amount, x.reference, x.booking_id, b.flat_no from brokerage_payouts x join bookings b on b.id=x.booking_id where x.partner_id=$1 order by x.date desc`, [p.id]);
  const earned = sales.reduce((t, s) => t + s.brokerage_amount, 0), paid = sales.reduce((t, s) => t + s.paid, 0);
  return (
    <>
      <Flash s={searchParams} />
      <Head title={p.firm} sub={`Partner ID ${p.id} · brokerage ${p.brokerage_pct}% of agreement value, paid after the agreement for sale is registered`} />
      <div className="kpis">
        <Kpi v={`${clients.length}`} label="clients registered" />
        <Kpi v={`${clients.filter((c) => ['visited', 'negotiation', 'booked'].includes(c.stage)).length}`} label="have visited" />
        <Kpi v={`${sales.length}`} label="homes sold" />
        <Kpi v={inr(earned)} label="brokerage earned" />
        <Kpi v={inr(earned - paid)} label="still to be paid to you" hot={earned > paid} />
      </div>

      <div className="card scroll">
        <h2>My sales</h2>
        <table>
          <thead><tr><th>Order</th><th>Flat</th><th>Buyer (customer ID)</th><th>Status</th><th className="n">Agreement value</th><th className="n">My brokerage</th><th className="n">Paid</th></tr></thead>
          <tbody>{sales.length ? sales.map((s) => (
            <tr key={s.id}><td>{s.id}<div className="small muted">{fmtDate(s.booking_date)}</div></td><td>{s.flat_no}<div className="small muted">{s.type}</div></td>
              <td>{s.buyer}<div className="small muted">{s.customer_id}</div></td><td><BStatus v={s.status} /></td>
              <td className="n">{inr(s.agreement_value)}</td><td className="n">{inr(s.brokerage_amount)}<div className="small muted">{s.brokerage_pct}%</div></td><td className="n">{inr(s.paid)}</td></tr>
          )) : <tr><td colSpan={7} className="muted">No sales yet. Register your clients below before you bring them.</td></tr>}</tbody>
        </table>
        {payouts.length > 0 && <p className="small" style={{ marginTop: 10 }}>Payments to you: {payouts.map((x) => `${fmtDate(x.date)} ${inr(x.amount)} (${x.flat_no}${x.reference ? ', ' + x.reference : ''})`).join(' · ')}</p>}
      </div>

      <div className="grid g2">
        <div className="card" id="register">
          <h2>Register a client</h2>
          {p.status === 'active' ? (
            <form className="f" action={partnerRegister}>
              <div className="fr"><label>Client&apos;s name<input name="name" required /></label><label>Client&apos;s mobile<input name="phone" type="tel" required /></label></div>
              <div className="fr">
                <label>Email (optional)<input name="email" type="email" /></label>
                <label>Looking for<select name="interested" defaultValue="">{['', ...TYPES].map((t) => <option key={t}>{t}</option>)}</select></label>
                <label>Budget<input name="budget" /></label>
              </div>
              <label>Note for the site office<textarea name="note" placeholder="Coming Saturday 11 am with family…" /></label>
              <div><button type="submit" className="gold">Register client</button></div>
              <p className="small muted">A client is yours from the moment you register them, for the protection period. We cannot accept a client who is already registered with us by anyone.</p>
            </form>
          ) : <p className="muted">Your account is {p.status}. Call the site office.</p>}
        </div>
        <div className="card scroll" id="clients">
          <h2>My clients</h2>
          <table>
            <thead><tr><th>Client</th><th>Registered</th><th>Yours until</th><th>Status</th></tr></thead>
            <tbody>{clients.length ? clients.map((c) => (
              <tr key={c.id}><td>{c.name}<div className="small muted">{c.phone}</div></td><td className="small">{fmtDate(c.created_at)}</td>
                <td className="small">{c.partner_until ? fmtDate(c.partner_until) : '—'}</td>
                <td><Pill v={c.stage} label={c.stage === 'lost' ? 'Closed' : STAGE_LABEL[c.stage]} />{c.visit_at && c.stage === 'visit_booked' && <div className="small muted">{fmtDate(c.visit_at)}</div>}</td></tr>
            )) : <tr><td colSpan={4} className="muted">None yet.</td></tr>}</tbody>
          </table>
        </div>
      </div>
      <p className="small muted">Questions about a client or a payment: +91 99301 12352. Status of each sale: {Object.values(BOOKING_STATUS).slice(0, 4).join(' → ')}.</p>
    </>
  );
}
