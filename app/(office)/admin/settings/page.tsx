import { need } from '@/lib/auth';
import { q, setting } from '@/lib/db';
import { fmtDate } from '@/lib/core';
import { Head, Flash, Pill, type SP } from '../../_ui';
import { saveSettings, addTeam, toggleUser } from '../../_act';

const ENV: [string, string][] = [
  ['RESEND_API_KEY', 'Email (sign-in codes, broker logins, alerts)'],
  ['LEAD_ALERT_TO', 'Who gets an email for each new lead'],
  ['NEXT_PUBLIC_META_PIXEL_ID', 'Meta Pixel on the website'],
  ['META_CAPI_TOKEN', 'Meta Conversions API (server-side leads)'],
  ['META_VERIFY_TOKEN', 'Meta Lead Ads webhook: verify token'],
  ['META_APP_SECRET', 'Meta Lead Ads webhook: signature check'],
  ['META_PAGE_TOKEN', 'Meta Lead Ads: reading the form answers'],
  ['NEXT_PUBLIC_GA_ID', 'Google Analytics'],
];

export default async function Settings({ searchParams }: { searchParams: SP }) {
  const me = await need('admin');
  const [rate, pct, days] = await Promise.all([setting('rate_sqft', '35000'), setting('brokerage_pct', '2'), setting('partner_lock_days', '60')]);
  const team = await q<{ id: string; email: string; name: string; role: string; active: boolean; last_login: string | null }>(
    `select id, email, name, role, active, last_login from users where role in ('admin','staff') order by active desc, role, name`);
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Settings" />
      <div className="grid g2">
        <form className="card f" action={saveSettings}>
          <h2>Pricing and brokers</h2>
          <label>Base rate, ₹ per sq.ft of MahaRERA carpet<input name="rate_sqft" defaultValue={rate} /></label>
          <label>Default brokerage % for new brokers<input name="brokerage_pct" defaultValue={pct} /></label>
          <label>Days a broker&apos;s registered client stays theirs<input name="partner_lock_days" defaultValue={days} /></label>
          <div><button type="submit">Save</button></div>
          <p className="small muted">None of these appear on the website.</p>
        </form>
        <div className="card">
          <h2>Connections</h2>
          <table><tbody>{ENV.map(([k, label]) => <tr key={k}><td className="small">{label}</td><td><Pill v={process.env[k] ? 'active' : 'hold'} label={process.env[k] ? 'On' : 'Not set'} /></td></tr>)}</tbody></table>
          <p className="small muted">Set these in Vercel → Project → Settings → Environment Variables, then redeploy. Meta webhook address: <code>https://back.empiregoldmazgaon.com/api/meta/webhook</code></p>
        </div>
      </div>
      <div className="card scroll">
        <h2>Team</h2>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last sign-in</th><th></th></tr></thead>
          <tbody>{team.map((t) => (
            <tr key={t.id} style={t.active ? undefined : { opacity: 0.5 }}><td>{t.name}</td><td>{t.email}</td><td>{t.role}</td><td className="small">{t.last_login ? fmtDate(t.last_login) : 'never'}</td>
              <td>{t.id !== me.id && <form action={toggleUser}><input type="hidden" name="uid" value={t.id} /><button className={t.active ? 'danger' : 'ghost'} type="submit">{t.active ? 'Switch off' : 'Switch on'}</button></form>}</td></tr>
          ))}</tbody>
        </table>
        <form className="inline" action={addTeam} style={{ marginTop: 12 }}>
          <label>Name<input name="name" /></label><label>Email<input name="email" type="email" required /></label>
          <label>Role<select name="role" defaultValue="staff"><option value="staff">Staff (sales)</option><option value="admin">Admin</option></select></label>
          <button type="submit" className="ghost">Add</button>
        </form>
        <p className="small muted">Staff see leads, inventory, bookings and buyers. Only admins approve brokers, pay brokerage, cancel bookings and change settings.</p>
      </div>
    </>
  );
}
