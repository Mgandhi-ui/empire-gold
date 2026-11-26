import Link from 'next/link';
import { need } from '@/lib/auth';
import { q, setting } from '@/lib/db';
import { inrShort, fmtDate, todayIST, addDays } from '@/lib/core';
import { Head, Flash, Pill, type SP } from '../../_ui';
import { saveFlat } from '../../_act';

type F = { no: string; floor: number; type: string; carpet_sqft: number; status: string; rate_sqft: number | null; hold_until: string | null; hold_note: string | null; booking: string | null; buyer: string | null; value: number | null };

export default async function Inventory({ searchParams }: { searchParams: SP }) {
  await need('admin', 'staff');
  const base = Number(await setting('rate_sqft', '35000'));
  const flats = await q<F>(`select f.*, b.id booking, c.name buyer, b.agreement_value value from flats f
    left join bookings b on b.flat_no = f.no and b.status <> 'cancelled' left join customers c on c.id = b.customer_id order by f.floor desc, f.no`);
  const floors = [...new Set(flats.map((f) => f.floor))];
  const open = flats.filter((f) => f.status !== 'booked');
  const openValue = open.reduce((t, f) => t + f.carpet_sqft * (f.rate_sqft ?? base), 0);
  const soldValue = flats.reduce((t, f) => t + (f.value ?? 0), 0);
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Inventory" sub={`Base rate ₹${base.toLocaleString('en-IN')}/sq.ft (Settings) · ${open.length} open worth ${inrShort(openValue)} · sold ${inrShort(soldValue)}`} />
      <div className="card floors">
        {floors.map((fl) => (
          <div className="floor" key={fl}>
            <b>{fl}th</b>
            {flats.filter((f) => f.floor === fl).map((f) => (
              <a key={f.no} href={f.booking ? `/admin/bookings/${f.booking}` : `#f${f.no}`} className={`flat ${f.status}`}>
                <b>{f.no}</b> <span className="muted">{f.type}</span><br />
                {f.carpet_sqft} sq.ft · {f.status === 'booked' ? <>{f.buyer}</> : f.status === 'hold' ? <>hold till {fmtDate(f.hold_until)}</> : inrShort(f.carpet_sqft * (f.rate_sqft ?? base))}
              </a>
            ))}
          </div>
        ))}
      </div>
      <div className="card scroll">
        <h2>Change a flat</h2>
        <table>
          <thead><tr><th>Flat</th><th>Type</th><th className="n">Sq.ft</th><th>Status</th><th>Own rate ₹/sq.ft</th><th>Hold until</th><th>Hold for</th><th></th></tr></thead>
          <tbody>{flats.map((f) => f.status === 'booked' ? (
            <tr key={f.no} id={`f${f.no}`}><td><b>{f.no}</b></td><td>{f.type}</td><td className="n">{f.carpet_sqft}</td><td><Pill v="booked" /></td>
              <td colSpan={4}><Link href={`/admin/bookings/${f.booking}`}>{f.booking}</Link> · {f.buyer} · {inrShort(f.value)}</td></tr>
          ) : (
            <tr key={f.no} id={`f${f.no}`}>
              <td><b>{f.no}</b></td><td>{f.type}</td><td className="n">{f.carpet_sqft}</td>
              <td colSpan={5}>
                <form action={saveFlat} className="inline">
                  <input type="hidden" name="no" value={f.no} />
                  <select name="status" defaultValue={f.status} style={{ width: 120 }}><option value="available">Available</option><option value="hold">On hold</option></select>
                  <input name="rate_sqft" defaultValue={f.rate_sqft ?? ''} placeholder={`${base}`} style={{ width: 110 }} />
                  <input name="hold_until" type="date" defaultValue={f.hold_until ?? addDays(todayIST(), 2)} style={{ width: 150 }} />
                  <input name="hold_note" defaultValue={f.hold_note ?? ''} placeholder="Buyer / reason" style={{ width: 180 }} />
                  <button type="submit" className="ghost">Save</button>
                </form>
              </td>
              <td></td>
            </tr>
          ))}</tbody>
        </table>
        <p className="small muted">Leave &ldquo;own rate&rdquo; empty to use the base rate. Rates never appear on the website.</p>
      </div>
    </>
  );
}
