import Link from 'next/link';
import { need } from '@/lib/auth';
import { q } from '@/lib/db';
import { fmtDate, SOURCES, SOURCE_LABEL, STAGES, STAGE_LABEL, TYPES } from '@/lib/core';
import { Head, Stage, Flash, sp, type SP } from '../../_ui';
import { newLead } from '../../_act';

export default async function Leads({ searchParams }: { searchParams: SP }) {
  await need('admin', 'staff');
  const stage = sp(searchParams, 'stage'), source = sp(searchParams, 'source'), text = sp(searchParams, 'q').trim(), view = sp(searchParams, 'view');
  const where: string[] = [], args: unknown[] = [];
  if ((STAGES as readonly string[]).includes(stage)) { args.push(stage); where.push(`l.stage = $${args.length}`); }
  else if (view !== 'all') where.push(`l.stage not in ('booked','lost')`);
  if ((SOURCES as readonly string[]).includes(source)) { args.push(source); where.push(`l.source = $${args.length}`); }
  if (view === 'due') where.push(`l.next_follow_up <= current_date`);
  if (text) { args.push(`%${text.toLowerCase()}%`); where.push(`(lower(l.name) like $${args.length} or l.phone like $${args.length} or lower(coalesce(l.email,'')) like $${args.length})`); }
  const leads = await q<{ id: number; created_at: string; name: string; phone: string; source: string; partner: string | null; interested: string | null; budget: string | null; stage: string; next_follow_up: string | null; flat_no: string | null }>(
    `select l.id, l.created_at, l.name, l.phone, l.source, p.firm partner, l.interested, l.budget, l.stage, l.next_follow_up, l.flat_no
     from leads l left join partners p on p.id = l.partner_id ${where.length ? 'where ' + where.join(' and ') : ''}
     order by (l.next_follow_up is null), l.next_follow_up, l.created_at desc limit 300`, args);
  const partners = await q<{ id: string; firm: string }>(`select id, firm from partners where status='active' order by firm`);
  const tab = (label: string, href: string, on: boolean) => <Link className={`btn ${on ? '' : 'ghost'}`} href={href}>{label}</Link>;
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Leads" sub={`${leads.length} shown`}>
        {tab('Open', '/admin/leads', !view && !stage)}{tab('Due today', '/admin/leads?view=due', view === 'due')}{tab('All', '/admin/leads?view=all', view === 'all')}
      </Head>
      <details open={sp(searchParams, 'add') === '1'}>
        <summary>Add a lead (call, walk-in, portal, referral)</summary>
        <form className="f" action={newLead}>
          <div className="fr">
            <label>Name<input name="name" required /></label>
            <label>Mobile<input name="phone" type="tel" required /></label>
            <label>Email<input name="email" type="email" /></label>
            <label>Source<select name="source" defaultValue="walk_in">{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select></label>
            <label>Broker (if broker lead)<select name="partner_id" defaultValue=""><option value="">—</option>{partners.map((p) => <option key={p.id} value={p.id}>{p.firm} ({p.id})</option>)}</select></label>
          </div>
          <div className="fr">
            <label>Interested in<select name="interested" defaultValue="">{['', ...TYPES].map((t) => <option key={t}>{t}</option>)}</select></label>
            <label>Budget<input name="budget" placeholder="e.g. ₹1–1.5 Cr" /></label>
            <label>Detail<input name="source_detail" placeholder="Portal name, referrer, campaign…" /></label>
          </div>
          <label>Note<textarea name="message" /></label>
          <div><button type="submit">Add lead</button></div>
        </form>
      </details>
      <form className="card inline" action="/admin/leads">
        <label>Search<input name="q" defaultValue={text} placeholder="Name, mobile or email" /></label>
        <label>Stage<select name="stage" defaultValue={stage}><option value="">Open</option>{STAGES.map((s) => <option key={s} value={s}>{STAGE_LABEL[s]}</option>)}</select></label>
        <label>Source<select name="source" defaultValue={source}><option value="">All</option>{SOURCES.map((s) => <option key={s} value={s}>{SOURCE_LABEL[s]}</option>)}</select></label>
        {view && <input type="hidden" name="view" value={view} />}
        <button type="submit" className="ghost">Filter</button>
      </form>
      <div className="card scroll">
        <table>
          <thead><tr><th>Name</th><th>Mobile</th><th>Stage</th><th>Follow up</th><th>Source</th><th>Wants</th><th>Budget</th><th>Came in</th></tr></thead>
          <tbody>{leads.length ? leads.map((l) => (
            <tr key={l.id}>
              <td><Link href={`/admin/leads/${l.id}`}>{l.name}</Link>{l.flat_no && <div className="small muted">Flat {l.flat_no}</div>}</td>
              <td><a href={`tel:+91${l.phone}`}>{l.phone}</a></td>
              <td><Stage v={l.stage} /></td>
              <td>{l.next_follow_up ? fmtDate(l.next_follow_up) : '—'}</td>
              <td className="small">{SOURCE_LABEL[l.source]}{l.partner && <div className="muted">{l.partner}</div>}</td>
              <td className="small">{l.interested ?? '—'}</td><td className="small">{l.budget ?? '—'}</td>
              <td className="small">{fmtDate(l.created_at)}</td>
            </tr>
          )) : <tr><td colSpan={8} className="muted">No leads match.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}
