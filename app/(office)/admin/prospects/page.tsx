import { need } from '@/lib/auth';
import { q } from '@/lib/db';
import { fmtDate } from '@/lib/core';
import { Head, Flash, Pill, sp, type SP } from '../../_ui';
import { importProspects, prospectStatus, invitePartner } from '../../_act';

const ST: Record<string, string> = { new: 'New', contacted: 'Contacted', invited: 'Invited', joined: 'Joined', not_interested: 'Not interested' };

export default async function Prospects({ searchParams }: { searchParams: SP }) {
  await need('admin', 'staff');
  const area = sp(searchParams, 'area').trim(), st = sp(searchParams, 'status');
  const args: unknown[] = [], where: string[] = [];
  if (area) { args.push(`%${area.toLowerCase()}%`); where.push(`lower(coalesce(area,'')) like $${args.length}`); }
  if (ST[st]) { args.push(st); where.push(`status = $${args.length}`); }
  const rows = await q<{ id: number; name: string; firm: string | null; phone: string | null; email: string | null; rera_no: string | null; area: string | null; source: string; status: string; note: string | null; updated_at: string }>(
    `select * from prospects ${where.length ? 'where ' + where.join(' and ') : ''} order by case status when 'new' then 0 when 'contacted' then 1 when 'invited' then 2 else 3 end, area, name limit 500`, args);
  const counts = await q<{ status: string; n: number }>('select status, count(*)::int n from prospects group by status');
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Broker prospects" sub={counts.map((c) => `${ST[c.status]} ${c.n}`).join(' · ') || 'Brokers you want to sign up. The more partners, the faster it sells.'} />
      <details open={!rows.length}>
        <summary>Add prospects (paste a list)</summary>
        <p className="small muted">One broker per line: <code>name, firm, mobile, email, MahaRERA no., area</code>. Copy rows from a spreadsheet (tabs work too).
          A good source is the public MahaRERA agent register: search <a href="https://maharera.maharashtra.gov.in" target="_blank" rel="noopener">registered agents</a> by Mumbai City and copy those in Mazgaon, Byculla, Dongri, Agripada, Nagpada, Reay Road and Sewri. Use only business contact details agents publish themselves.</p>
        <form className="f" action={importProspects}>
          <label>Rows<textarea name="csv" rows={6} placeholder={'Rashid Shaikh, Shaikh Realty, 98200 00000, rashid@example.com, A51900012345, Byculla'} /></label>
          <div className="inline"><label>Where from<input name="source" placeholder="MahaRERA register, broker meet, referral…" /></label><button type="submit">Add to list</button></div>
        </form>
      </details>
      <form className="card inline" action="/admin/prospects">
        <label>Area<input name="area" defaultValue={area} placeholder="Byculla" /></label>
        <label>Status<select name="status" defaultValue={st}><option value="">All</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <button type="submit" className="ghost">Filter</button>
      </form>
      <div className="card scroll">
        <table>
          <thead><tr><th>Broker</th><th>Contact</th><th>Area</th><th>Status</th><th>Update</th><th></th></tr></thead>
          <tbody>{rows.length ? rows.map((p) => (
            <tr key={p.id}>
              <td><b>{p.name}</b>{p.firm && <div className="small">{p.firm}</div>}<div className="small muted">{p.rera_no ?? ''} · {p.source}</div></td>
              <td className="small">{p.phone && <a href={`tel:+91${p.phone}`}>{p.phone}</a>}{p.email && <div>{p.email}</div>}</td>
              <td className="small">{p.area}</td>
              <td><Pill v={p.status === 'joined' ? 'active' : p.status === 'not_interested' ? 'lost' : p.status === 'new' ? 'new' : 'hold'} label={ST[p.status]} /><div className="small muted">{fmtDate(p.updated_at)}</div>{p.note && <div className="small">{p.note}</div>}</td>
              <td><form action={prospectStatus} className="inline"><input type="hidden" name="id" value={p.id} />
                <select name="status" defaultValue={p.status} style={{ width: 140 }}>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input name="note" placeholder="Note" style={{ width: 140 }} /><button type="submit" className="ghost">Save</button></form></td>
              <td>{p.email && p.status !== 'joined' && <form action={invitePartner}><input type="hidden" name="id" value={p.id} /><button type="submit" className="ghost">Email invitation</button></form>}</td>
            </tr>
          )) : <tr><td colSpan={6} className="muted">No prospects yet.</td></tr>}</tbody>
        </table>
      </div>
    </>
  );
}
