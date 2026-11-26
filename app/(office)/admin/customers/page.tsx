import Link from 'next/link';
import { need } from '@/lib/auth';
import { q } from '@/lib/db';
import { inr, fmtDate } from '@/lib/core';
import { Head, Flash, BStatus, type SP } from '../../_ui';

export default async function Customers({ searchParams }: { searchParams: SP }) {
  await need('admin', 'staff');
  const rows = await q<{ id: string; name: string; phone: string; email: string | null; booking: string; flat_no: string; status: string; agreement_value: number; paid: number; demanded: number; last_login: string | null; has_login: boolean }>(
    `select c.id, c.name, c.phone, c.email, b.id booking, b.flat_no, b.status, b.agreement_value,
      (select coalesce(sum(amount),0) from receipts r where r.booking_id=b.id) paid,
      (select coalesce(sum(amount),0) from payment_stages s where s.booking_id=b.id and s.demanded_at is not null) demanded,
      u.last_login, (u.id is not null) has_login
     from customers c join bookings b on b.customer_id=c.id and b.status <> 'cancelled' left join users u on u.customer_id=c.id and u.active
     order by b.flat_no`);
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Buyers" sub={`${rows.length} homes sold · each buyer has a customer ID and, with an email, their own login to see payments, documents and site updates`} />
      <div className="card scroll">
        <table>
          <thead><tr><th>Customer ID</th><th>Buyer</th><th>Flat</th><th>Status</th><th className="n">Agreement</th><th className="n">Received</th><th className="n">Overdue</th><th>Login</th></tr></thead>
          <tbody>{rows.length ? rows.map((c) => (
            <tr key={c.booking}>
              <td>{c.id}</td><td>{c.name}<div className="small muted">{c.phone}{c.email ? ` · ${c.email}` : ''}</div></td>
              <td><Link href={`/admin/bookings/${c.booking}`}>{c.flat_no}</Link></td><td><BStatus v={c.status} /></td>
              <td className="n">{inr(c.agreement_value)}</td><td className="n">{inr(c.paid)}</td><td className="n">{c.demanded > c.paid ? <b>{inr(c.demanded - c.paid)}</b> : '—'}</td>
              <td className="small">{c.has_login ? (c.last_login ? `last ${fmtDate(c.last_login)}` : 'not used yet') : 'none'}</td>
            </tr>
          )) : <tr><td colSpan={8} className="muted">No buyers yet.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}
