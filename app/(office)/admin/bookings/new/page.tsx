import { need } from '@/lib/auth';
import { q, one, setting } from '@/lib/db';
import { todayIST, fmtDate } from '@/lib/core';
import { Head, Flash, sp, type SP } from '../../../_ui';
import { createBooking } from '../../../_act';

export default async function NewBooking({ searchParams }: { searchParams: SP }) {
  await need('admin', 'staff');
  const leadId = Number(sp(searchParams, 'lead')) || null;
  const lead = leadId ? await one<{ id: number; name: string; phone: string; email: string | null; partner_id: string | null; partner_until: string | null; flat_no: string | null }>(
    'select id, name, phone, email, partner_id, partner_until, flat_no from leads where id = $1', [leadId]) : undefined;
  const base = Number(await setting('rate_sqft', '35000'));
  const flats = await q<{ no: string; type: string; carpet_sqft: number; status: string; rate_sqft: number | null }>(`select no, type, carpet_sqft, status, rate_sqft from flats where status <> 'booked' order by floor, no`);
  const partners = await q<{ id: string; firm: string; brokerage_pct: number }>(`select id, firm, brokerage_pct from partners where status='active' order by firm`);
  const pick = lead?.flat_no && flats.some((f) => f.no === lead.flat_no) ? lead.flat_no : '';
  const pickFlat = flats.find((f) => f.no === pick);
  const suggested = pickFlat ? pickFlat.carpet_sqft * (pickFlat.rate_sqft ?? base) : '';
  return (
    <>
      <Flash s={searchParams} />
      <Head title="New booking" sub={lead ? `From lead: ${lead.name}` : 'Links the flat, the buyer (customer ID) and the broker with their brokerage.'} />
      {lead?.partner_id && <div className="flash ok">This lead belongs to broker {lead.partner_id}{lead.partner_until ? ` (protected until ${fmtDate(lead.partner_until)})` : ''}. They are pre-selected below.</div>}
      <form className="card f" action={createBooking}>
        {lead && <input type="hidden" name="lead_id" value={lead.id} />}
        <h2>Flat</h2>
        <div className="fr">
          <label>Flat<select name="flat_no" defaultValue={pick} required><option value="" disabled>Pick a flat</option>
            {flats.map((f) => <option key={f.no} value={f.no}>{f.no} · {f.type} · {f.carpet_sqft} sq.ft · list ₹{(f.carpet_sqft * (f.rate_sqft ?? base)).toLocaleString('en-IN')}{f.status === 'hold' ? ' (on hold)' : ''}</option>)}
          </select></label>
          <label>Agreement value (₹)<input name="agreement_value" required defaultValue={suggested ? String(suggested) : ''} placeholder="e.g. 10430000 or 1.04 cr" /></label>
          <label>Booking date<input name="booking_date" type="date" defaultValue={todayIST()} required /></label>
        </div>
        <h2>Buyer</h2>
        <div className="fr">
          <label>Name<input name="name" required defaultValue={lead?.name ?? ''} /></label>
          <label>Mobile<input name="phone" type="tel" required defaultValue={lead?.phone ?? ''} /></label>
          <label>Email (gives the buyer a login)<input name="email" type="email" defaultValue={lead?.email ?? ''} /></label>
        </div>
        <div className="fr">
          <label>Co-applicant<input name="co_applicant" /></label>
          <label>Address<input name="address" /></label>
        </div>
        <h2>Broker</h2>
        <div className="fr">
          <label>Channel partner<select name="partner_id" defaultValue={lead?.partner_id ?? ''}><option value="">Direct sale (no broker)</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.firm} ({p.id}) · {p.brokerage_pct}%</option>)}</select></label>
          <label>Brokerage % (blank = broker&apos;s rate)<input name="brokerage_pct" placeholder="e.g. 2" /></label>
        </div>
        <label>Note<textarea name="note" placeholder="Parking bay, special terms…" /></label>
        <div><button type="submit" className="gold">Create booking</button></div>
        <p className="small muted">The flat is marked booked, the lead moves to Booked, the buyer gets a customer ID (and a login if an email is given), and the broker sees the sale and their brokerage in their partner login.</p>
      </form>
    </>
  );
}
