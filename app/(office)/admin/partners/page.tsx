import { need } from '@/lib/auth';
import { q } from '@/lib/db';
import { inr, fmtDate } from '@/lib/core';
import { Head, Flash, Pill, type SP } from '../../_ui';
import { decidePartner, savePartner, addPartner } from '../../_act';

type P = { id: string; firm: string; contact_name: string; phone: string; email: string; rera_no: string | null; area: string | null; status: string; brokerage_pct: number;
  note: string | null; created_at: string; leads: number; live_leads: number; visits: number; bookings: number; sold: number; earned: number; paid: number; last_login: string | null };

export default async function Partners({ searchParams }: { searchParams: SP }) {
  const u = await need('admin', 'staff');
  const rows = await q<P>(`select p.*,
      (select count(*) from leads l where l.partner_id = p.id)::int leads,
      (select count(*) from leads l where l.partner_id = p.id and l.stage not in ('booked','lost'))::int live_leads,
      (select count(*) from leads l where l.partner_id = p.id and l.stage in ('visited','negotiation','booked'))::int visits,
      (select count(*) from bookings b where b.partner_id = p.id and b.status <> 'cancelled')::int bookings,
      (select coalesce(sum(agreement_value),0) from bookings b where b.partner_id = p.id and b.status <> 'cancelled') sold,
      (select coalesce(sum(brokerage_amount),0) from bookings b where b.partner_id = p.id and b.status <> 'cancelled') earned,
      (select coalesce(sum(x.amount),0) from brokerage_payouts x join bookings b on b.id = x.booking_id where x.partner_id = p.id and b.status <> 'cancelled') paid,
      (select max(last_login) from users where partner_id = p.id) last_login
    from partners p order by case p.status when 'applied' then 0 when 'active' then 1 when 'paused' then 2 else 3 end, bookings desc, p.created_at desc`);
  const applied = rows.filter((r) => r.status === 'applied');
  const others = rows.filter((r) => r.status !== 'applied');
  const isAdmin = u.role === 'admin';
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Brokers" sub={`${others.filter((r) => r.status === 'active').length} active · ${applied.length} waiting for approval`} />
      {applied.length > 0 && (
        <div className="card scroll">
          <h2>Waiting for approval</h2>
          <table>
            <thead><tr><th>Broker</th><th>Contact</th><th>MahaRERA no.</th><th>Area</th><th>Applied</th><th></th></tr></thead>
            <tbody>{applied.map((p) => (
              <tr key={p.id}>
                <td><b>{p.firm}</b><div className="small muted">{p.id}</div></td>
                <td>{p.contact_name}<div className="small">{p.phone} · {p.email}</div></td>
                <td>{p.rera_no ?? '—'}{p.rera_no && <div className="small"><a href="https://maharera.maharashtra.gov.in" target="_blank" rel="noopener">Check on MahaRERA</a></div>}</td>
                <td className="small">{p.area}</td><td className="small">{fmtDate(p.created_at)}</td>
                <td>{isAdmin && <div className="inline">
                  <form action={decidePartner}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="act" value="approve" /><button type="submit" className="gold">Approve and send login</button></form>
                  <form action={decidePartner}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="act" value="reject" /><button type="submit" className="danger">Reject</button></form>
                </div>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <div className="card scroll">
        <h2>All brokers</h2>
        <table>
          <thead><tr><th>Broker</th><th>Status</th><th className="n">Clients</th><th className="n">Visits</th><th className="n">Bookings</th><th className="n">Sold</th><th className="n">Earned</th><th className="n">Paid</th><th className="n">Due</th>{isAdmin && <th>Brokerage % · note</th>}</tr></thead>
          <tbody>{others.length ? others.map((p) => (
            <tr key={p.id}>
              <td><b>{p.firm}</b><div className="small muted">{p.id} · {p.contact_name} · {p.phone}</div><div className="small muted">{p.rera_no ?? 'no MahaRERA no.'} · last login {p.last_login ? fmtDate(p.last_login) : 'never'}</div></td>
              <td><Pill v={p.status} /></td>
              <td className="n">{p.leads}<div className="small muted">{p.live_leads} open</div></td><td className="n">{p.visits}</td><td className="n">{p.bookings}</td>
              <td className="n">{inr(p.sold)}</td><td className="n">{inr(p.earned)}</td><td className="n">{inr(p.paid)}</td><td className="n"><b>{inr(p.earned - p.paid)}</b></td>
              {isAdmin && <td>
                <form action={savePartner} className="inline"><input type="hidden" name="id" value={p.id} />
                  <input name="brokerage_pct" defaultValue={p.brokerage_pct} style={{ width: 70 }} /><input name="note" defaultValue={p.note ?? ''} placeholder="Note" style={{ width: 140 }} />
                  <button type="submit" className="ghost">Save</button></form>
                <form action={decidePartner} style={{ marginTop: 6 }}><input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="act" value={p.status === 'active' ? 'pause' : 'resume'} />
                  <button type="submit" className={p.status === 'active' ? 'danger' : 'ghost'}>{p.status === 'active' ? 'Pause login' : 'Re-activate'}</button></form>
              </td>}
            </tr>
          )) : <tr><td colSpan={10} className="muted">No brokers yet. They apply at empiregoldmazgaon.com/partners, or add one below.</td></tr>}</tbody>
        </table>
      </div>
      {isAdmin && (
        <details>
          <summary>Add a broker yourself (e.g. met at the broker meet)</summary>
          <form className="f" action={addPartner}>
            <div className="fr">
              <label>Name<input name="contact" required /></label><label>Firm<input name="firm" /></label>
              <label>Mobile<input name="phone" required /></label><label>Email<input name="email" type="email" required /></label>
              <label>MahaRERA agent no.<input name="rera" /></label><label>Area<input name="area" /></label>
            </div>
            <div><button type="submit">Add, then approve above</button></div>
          </form>
        </details>
      )}
    </>
  );
}
