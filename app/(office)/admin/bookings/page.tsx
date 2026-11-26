import Link from 'next/link';
import { need } from '@/lib/auth';
import { q } from '@/lib/db';
import { inr, inrShort, fmtDate } from '@/lib/core';
import { Head, Flash, BStatus, type SP } from '../../_ui';

type B = { id: string; flat_no: string; type: string; customer_id: string; buyer: string; partner_id: string | null; firm: string | null; booking_date: string; status: string;
  agreement_value: number; brokerage_amount: number; paid: number; demanded: number; brokerage_paid: number };

export default async function Bookings({ searchParams }: { searchParams: SP }) {
  await need('admin', 'staff');
  const rows = await q<B>(`select b.id, b.flat_no, f.type, b.customer_id, c.name buyer, b.partner_id, p.firm, b.booking_date, b.status, b.agreement_value, b.brokerage_amount,
      (select coalesce(sum(amount),0) from receipts r where r.booking_id=b.id) paid,
      (select coalesce(sum(amount),0) from payment_stages s where s.booking_id=b.id and s.demanded_at is not null) demanded,
      (select coalesce(sum(amount),0) from brokerage_payouts x where x.booking_id=b.id) brokerage_paid
    from bookings b join flats f on f.no=b.flat_no join customers c on c.id=b.customer_id left join partners p on p.id=b.partner_id
    order by (b.status='cancelled'), b.booking_date desc, b.id desc`);
  const live = rows.filter((r) => r.status !== 'cancelled');
  const sum = (k: keyof B) => live.reduce((t, r) => t + Number(r[k] ?? 0), 0);
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Bookings" sub={`${live.length} live · sold ${inrShort(sum('agreement_value'))} · collected ${inrShort(sum('paid'))} · brokerage ${inrShort(sum('brokerage_amount'))} (paid ${inrShort(sum('brokerage_paid'))})`}>
        <Link className="btn gold" href="/admin/bookings/new">New booking</Link>
      </Head>
      <div className="card scroll">
        <table>
          <thead><tr><th>Booking</th><th>Flat</th><th>Buyer</th><th>Broker</th><th>Status</th><th className="n">Agreement value</th><th className="n">Received</th><th className="n">Due now</th><th className="n">Brokerage</th></tr></thead>
          <tbody>{rows.length ? rows.map((b) => (
            <tr key={b.id} style={b.status === 'cancelled' ? { opacity: 0.5 } : undefined}>
              <td><Link href={`/admin/bookings/${b.id}`}>{b.id}</Link><div className="small muted">{fmtDate(b.booking_date)}</div></td>
              <td>{b.flat_no}<div className="small muted">{b.type}</div></td>
              <td>{b.buyer}<div className="small muted">{b.customer_id}</div></td>
              <td className="small">{b.firm ? <>{b.firm}<div className="muted">{b.partner_id}</div></> : 'Direct'}</td>
              <td><BStatus v={b.status} /></td>
              <td className="n">{inr(b.agreement_value)}</td><td className="n">{inr(b.paid)}</td>
              <td className="n">{b.demanded > b.paid ? <b>{inr(b.demanded - b.paid)}</b> : '—'}</td>
              <td className="n">{b.partner_id ? <>{inr(b.brokerage_amount)}<div className="small muted">paid {inr(b.brokerage_paid)}</div></> : '—'}</td>
            </tr>
          )) : <tr><td colSpan={9} className="muted">No bookings yet. Create one from a lead, or with New booking.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}
