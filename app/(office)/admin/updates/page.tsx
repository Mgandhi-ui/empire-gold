import { need } from '@/lib/auth';
import { q } from '@/lib/db';
import { fmtDate, todayIST } from '@/lib/core';
import { Head, Flash, type SP } from '../../_ui';
import { postUpdate, deleteUpdate } from '../../_act';

export default async function Updates({ searchParams }: { searchParams: SP }) {
  const u = await need('admin', 'staff');
  const rows = await q<{ id: number; date: string; title: string; body: string; public: boolean; has_photo: boolean }>(
    'select id, date, title, body, public, photo is not null has_photo from updates order by date desc, id desc');
  return (
    <>
      <Flash s={searchParams} />
      <Head title="Site updates" sub="Construction progress. Every buyer sees these in their login; tick “show on website” to put one on empiregoldmazgaon.com too." />
      <form className="card f" action={postUpdate}>
        <div className="fr">
          <label>Title<input name="title" placeholder="10th floor slab cast" required /></label>
          <label>Date<input name="date" type="date" defaultValue={todayIST()} /></label>
          <label>Photo (optional)<input name="photo" type="file" accept="image/jpeg,image/png,image/webp" /></label>
        </div>
        <label>What happened<textarea name="body" required placeholder="The structural consultant certified the 10th slab on…" /></label>
        <label className="chk"><input type="checkbox" name="public" /> Show on the website</label>
        <div><button type="submit">Post update</button></div>
      </form>
      <div className="card">
        {rows.length ? rows.map((r) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: r.has_photo ? '120px 1fr auto' : '1fr auto', gap: 14, padding: '12px 0', borderBottom: '1px solid #EFEBE2' }}>
            {r.has_photo && <img src={`/api/update-photo/${r.id}`} alt="" style={{ width: 120, height: 80, objectFit: 'cover', borderRadius: 6 }} />}
            <div><b>{r.title}</b> <span className="small muted">· {fmtDate(r.date)} · {r.public ? 'website + buyers' : 'buyers only'}</span><div className="small" style={{ whiteSpace: 'pre-line' }}>{r.body}</div></div>
            {u.role === 'admin' && <form action={deleteUpdate}><input type="hidden" name="id" value={r.id} /><button className="danger" type="submit">Delete</button></form>}
          </div>
        )) : <p className="muted">No updates yet.</p>}
      </div>
    </>
  );
}
