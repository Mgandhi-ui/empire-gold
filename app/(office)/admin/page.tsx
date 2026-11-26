import Link from 'next/link';
import { need } from '@/lib/auth';
import { q, one } from '@/lib/db';
import { inrShort, fmtDate, SOURCE_LABEL, STAGES, STAGE_LABEL } from '@/lib/core';
import { Head, Kpi, Stage, Flash, maskPhone, type SP } from '../_ui';

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  await need('admin', 'staff');
  const k = (await one<Record<string, number>>(`select
      (select count(*) from flats where status='available') avail,
      (select count(*) from flats where status='hold') hold,
      (select count(*) from bookings where status<>'cancelled') booked,
      (select coalesce(sum(agreement_value),0) from bookings where status<>'cancelled') sales,
      (select coalesce(sum(r.amount),0) from receipts r join bookings b on b.id=r.booking_id where b.status<>'cancelled') collected,
      (select coalesce(sum(s.amount),0) from payment_stages s join bookings b on b.id=s.booking_id where b.status<>'cancelled' and s.demanded_at is not null) demanded,
      (select coalesce(sum(brokerage_amount),0) from bookings where status<>'cancelled' and partner_id is not null) brokerage,
      (select coalesce(sum(p.amount),0) from brokerage_payouts p join bookings b on b.id=p.booking_id where b.status<>'cancelled') brokerage_paid,
      (select count(*) from leads where created_at > now() - interval '30 days') leads30,
      (select count(*) from leads where visit_at > now() - interval '30 days' and stage in ('visited','negotiation','booked')) visits30,
      (select count(*) from leads where next_follow_up <= current_date and stage not in ('booked','lost')) due,
      (select count(*) from partners where status='active') partners,
      (select count(*) from partners where status='applied') applied,
      (select coalesce(sum(n),0) from site_hits where day > current_date - 30) hits30`))!;
  const stages = await q<{ stage: string; n: number }>(`select stage, count(*)::int n from leads group by stage`);
  const by = Object.fromEntries(stages.map((s) => [s.stage, s.n]));
  const maxStage = Math.max(1, ...stages.map((s) => s.n));
  const sources = await q<{ source: string; leads: number; visits: number; bookings: number }>(`select source, count(*)::int leads,
      count(*) filter (where stage in ('visited','negotiation','booked'))::int visits, count(*) filter (where stage='booked')::int bookings
      from leads where created_at > now() - interval '90 days' group by source order by leads desc`);
  const due = await q<{ id: number; name: string; phone: string; stage: string; next_follow_up: string; source: string }>(
    `select id, name, phone, stage, next_follow_up, source from leads where next_follow_up <= current_date and stage not in ('booked','lost') order by next_follow_up, id limit 15`);
  const recent = await q<{ id: string; flat_no: string; customer: string; partner: string | null; agreement_value: number; booking_date: string }>(
    `select b.id, b.flat_no, c.name customer, p.firm partner, b.agreement_value, b.booking_date from bookings b join customers c on c.id=b.customer_id
     left join partners p on p.id=b.partner_id where b.status<>'cancelled' order by b.booking_date desc, b.id desc limit 6`);
  const sold = 35 - k.avail - k.hold;
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Phase II sales" sub={`${sold} of 35 homes booked · updated live`}>
        <Link className="btn gold" href="/admin/bookings/new">New booking</Link>
        <Link className="btn ghost" href="/admin/leads?add=1">Add lead</Link>
      </Head>
      <div className="kpis">
        <Kpi v={`${k.avail}`} label={`homes available${k.hold ? ` · ${k.hold} on hold` : ''}`} />
        <Kpi v={inrShort(k.sales)} label={`sold · ${k.booked} bookings`} />
        <Kpi v={inrShort(k.collected)} label="collected from buyers" />
        <Kpi v={inrShort(Math.max(0, k.demanded - k.collected))} label="demanded, not yet received" hot={k.demanded > k.collected} />
        <Kpi v={inrShort(k.brokerage - k.brokerage_paid)} label="brokerage still to pay" />
        <Kpi v={`${k.due}`} label="follow-ups due today" hot={k.due > 0} />
      </div>
      <div className="grid g2">
        <div className="card">
          <h2>Pipeline</h2>
          {STAGES.map((s) => (
            <div key={s} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 40px', gap: 10, alignItems: 'center', marginBottom: 8 }}>
              <Link href={`/admin/leads?stage=${s}`} className="small">{STAGE_LABEL[s]}</Link>
              <div className="bar"><i style={{ width: `${((by[s] ?? 0) / maxStage) * 100}%` }} /></div>
              <span className="small right">{by[s] ?? 0}</span>
            </div>
          ))}
          <p className="small muted">Last 30 days: {k.leads30} new leads, {k.visits30} site visits, {k.hits30} website visits. {k.partners} active brokers{k.applied ? `, ${k.applied} waiting for approval` : ''}.</p>
        </div>
        <div className="card">
          <h2>Which source sells (last 90 days)</h2>
          <div className="scroll"><table>
            <thead><tr><th>Source</th><th className="n">Leads</th><th className="n">Visits</th><th className="n">Bookings</th><th className="n">Lead → visit</th></tr></thead>
            <tbody>{sources.length ? sources.map((s) => (
              <tr key={s.source}><td>{SOURCE_LABEL[s.source] ?? s.source}</td><td className="n">{s.leads}</td><td className="n">{s.visits}</td><td className="n">{s.bookings}</td>
                <td className="n">{s.leads ? Math.round((s.visits / s.leads) * 100) + '%' : '—'}</td></tr>
            )) : <tr><td colSpan={5} className="muted">No leads yet.</td></tr>}</tbody>
          </table></div>
        </div>
      </div>
      <div className="grid g2">
        <div className="card">
          <h2>Call today</h2>
          <div className="scroll"><table>
            <thead><tr><th>Lead</th><th>Stage</th><th>Due</th><th>Source</th></tr></thead>
            <tbody>{due.length ? due.map((l) => (
              <tr key={l.id}><td><Link href={`/admin/leads/${l.id}`}>{l.name}</Link><div className="small muted">{maskPhone(l.phone)}</div></td>
                <td><Stage v={l.stage} /></td><td>{fmtDate(l.next_follow_up)}</td><td className="small">{SOURCE_LABEL[l.source]}</td></tr>
            )) : <tr><td colSpan={4} className="muted">Nothing overdue. Good.</td></tr>}</tbody>
          </table></div>
        </div>
        <div className="card">
          <h2>Latest bookings</h2>
          <div className="scroll"><table>
            <thead><tr><th>Booking</th><th>Flat</th><th>Buyer</th><th>Broker</th><th className="n">Value</th></tr></thead>
            <tbody>{recent.length ? recent.map((b) => (
              <tr key={b.id}><td><Link href={`/admin/bookings/${b.id}`}>{b.id}</Link><div className="small muted">{fmtDate(b.booking_date)}</div></td>
                <td>{b.flat_no}</td><td>{b.customer}</td><td className="small">{b.partner ?? 'Direct'}</td><td className="n">{inrShort(b.agreement_value)}</td></tr>
            )) : <tr><td colSpan={5} className="muted">No bookings yet.</td></tr>}</tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}
