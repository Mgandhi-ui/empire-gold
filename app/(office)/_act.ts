'use server';
// Every change made in the back office. Each action checks who is signed in before touching anything.
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { pool, one, tx, audit, setting } from '@/lib/db';
import { need, isStaff, requestCode, verifyCode, homeFor, signOut, type User } from '@/lib/auth';
import { UserError, fail, clip, cleanEmail, mobile, rupees, STAGES, SOURCES, LOST_REASONS, todayIST, inr } from '@/lib/core';
import { addLead, registerClient } from '@/lib/leads';
import { reportStage } from '@/lib/meta';
import { sendMail } from '@/lib/mail';

const s = (f: FormData, k: string, n = 200) => clip(f.get(k), n);
const date = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const enc = encodeURIComponent;

/** Run an action; on a user mistake come back with the message, otherwise go where the action says (or back with "Saved"). */
async function run(back: string, fn: () => Promise<string | void>) {
  let to: string | void;
  try { to = await fn(); }
  catch (e) {
    if (e instanceof UserError) redirect(`${back}${back.includes('?') ? '&' : '?'}err=${enc(e.message)}`);
    const code = (e as { code?: string }).code;
    if (code === '23505') redirect(`${back}${back.includes('?') ? '&' : '?'}err=${enc('That already exists (duplicate number, flat or email).')}`);
    throw e;
  }
  revalidatePath('/', 'layout');
  redirect(to || `${back}${back.includes('?') ? '&' : '?'}ok=Saved`);
}
const staff = () => need('admin', 'staff');
const admin = () => need('admin');

// ─── Sign in ───────────────────────────────────────────────────────────────────────────────────────────────────
export async function askCode(f: FormData) {
  const email = s(f, 'email', 200).toLowerCase();
  await run('/login', async () => { await requestCode(email); return `/login?sent=1&email=${enc(email)}`; });
}
export async function checkCode(f: FormData) {
  const email = s(f, 'email', 200);
  let u: User | null = null;
  try { u = await verifyCode(email, s(f, 'code', 10)); }
  catch (e) { if (e instanceof UserError) redirect(`/login?sent=1&email=${enc(email)}&err=${enc(e.message)}`); throw e; }
  redirect(homeFor(u.role));
}
export async function logout() { await signOut(); redirect('/login'); }

// ─── Leads ─────────────────────────────────────────────────────────────────────────────────────────────────────
export async function newLead(f: FormData) {
  const u = await staff();
  await run('/admin/leads', async () => {
    const name = s(f, 'name', 80); if (name.length < 2) fail('Name is needed.');
    const phone = mobile(f.get('phone')) ?? fail('Enter a 10-digit mobile.');
    const source = s(f, 'source', 20); if (!(SOURCES as readonly string[]).includes(source)) fail('Pick a source.');
    const partnerId = s(f, 'partner_id', 20) || null;
    if (source === 'broker' && !partnerId) fail('Pick the broker for a broker lead.');
    const r = await addLead({ name, phone, email: cleanEmail(f.get('email')), source, sourceDetail: s(f, 'source_detail', 160) || null,
      interested: s(f, 'interested', 40) || null, budget: s(f, 'budget', 40) || null, message: s(f, 'message', 600) || null,
      partnerId: source === 'broker' ? partnerId : null, ownerId: u.id, by: u.id });
    return `/admin/leads/${r.id}?ok=${enc(r.duplicate ? 'This number was already a lead: added a note to it.' : 'Lead added.')}`;
  });
}

export async function saveLead(f: FormData) {
  const u = await staff();
  const id = Number(f.get('id'));
  await run(`/admin/leads/${id}`, async () => {
    const stage = s(f, 'stage', 20); if (!(STAGES as readonly string[]).includes(stage)) fail('Pick a stage.');
    const lost = s(f, 'lost_reason', 40);
    if (stage === 'lost' && !LOST_REASONS.includes(lost)) fail('A lost lead needs a reason.');
    const follow = date(s(f, 'next_follow_up', 10));
    if (!['booked', 'lost'].includes(stage) && !follow) fail('An open lead needs a next follow-up date.');
    const visitAt = s(f, 'visit_at', 20);
    const flat = s(f, 'flat_no', 6) || null;
    const before = await one<{ stage: string; meta_lead_id: string | null }>('select stage, meta_lead_id from leads where id = $1', [id]);
    if (!before) fail('Lead not found.', 404);
    await pool.query(`update leads set name=$2, email=$3, stage=$4, next_follow_up=$5, visit_at=$6, interested=$7, budget=$8, flat_no=$9,
      lost_reason=$10, owner_id=$11, updated_at=now() where id=$1`,
      [id, s(f, 'name', 80), cleanEmail(f.get('email')), stage, ['booked', 'lost'].includes(stage) ? null : follow,
        visitAt ? new Date(visitAt + ':00+05:30') : null, s(f, 'interested', 40) || null, s(f, 'budget', 40) || null, flat,
        stage === 'lost' ? lost : null, s(f, 'owner_id', 40) || u.id]);
    if (before!.stage !== stage) {
      await pool.query('insert into lead_notes(lead_id, by_user, text) values ($1,$2,$3)', [id, u.id, `Stage: ${before!.stage} → ${stage}${stage === 'lost' ? ` (${lost})` : ''}`]);
      await reportStage(before!.meta_lead_id, stage, id);
    }
  });
}

export async function addNote(f: FormData) {
  const u = await staff();
  const id = Number(f.get('id'));
  await run(`/admin/leads/${id}`, async () => {
    const text = s(f, 'text', 2000); if (!text) fail('Write something first.');
    await pool.query('insert into lead_notes(lead_id, by_user, text) values ($1,$2,$3)', [id, u.id, text]);
    const follow = date(s(f, 'next_follow_up', 10));
    await pool.query(`update leads set updated_at = now(), stage = case when stage = 'new' then 'contacted' else stage end,
      next_follow_up = coalesce($2::date, next_follow_up) where id = $1`, [id, follow]);
  });
}

// ─── Inventory ─────────────────────────────────────────────────────────────────────────────────────────────────
export async function saveFlat(f: FormData) {
  const u = await staff();
  const no = s(f, 'no', 6);
  await run(`/admin/inventory`, async () => {
    const status = s(f, 'status', 12);
    if (!['available', 'hold'].includes(status)) fail('Booked flats change through their booking.');
    const cur = await one<{ status: string }>('select status from flats where no = $1', [no]);
    if (!cur) fail('No such flat.');
    if (cur!.status === 'booked') fail(`Flat ${no} is booked. Cancel its booking first.`);
    const rate = s(f, 'rate_sqft', 10) ? Number(s(f, 'rate_sqft', 10).replace(/\D/g, '')) : null;
    if (rate !== null && (rate < 5000 || rate > 200000)) fail('Rate per sq.ft looks wrong.');
    const until = status === 'hold' ? date(s(f, 'hold_until', 10)) ?? fail('A hold needs an end date.') : null;
    await pool.query(`update flats set status=$2, rate_sqft=$3, hold_until=$4, hold_note=$5, updated_at=now() where no=$1`,
      [no, status, rate, until, status === 'hold' ? s(f, 'hold_note', 200) || null : null]);
    await audit(u.id, 'flat', no, { status, rate, until });
  });
}

// ─── Bookings ──────────────────────────────────────────────────────────────────────────────────────────────────
export async function createBooking(f: FormData) {
  const u = await staff();
  await run('/admin/bookings/new', async () => {
    const flat = s(f, 'flat_no', 6);
    const value = rupees(f.get('agreement_value')) ?? fail('Enter the agreement value in rupees.');
    if (value! < 1_000_000) fail('Agreement value looks too low. Enter it in rupees, e.g. 1,04,30,000.');
    const bdate = date(s(f, 'booking_date', 10)) ?? todayIST();
    const leadId = Number(f.get('lead_id')) || null;
    let partnerId = s(f, 'partner_id', 20) || null;
    const name = s(f, 'name', 100); if (name.length < 2) fail("Buyer's name is needed.");
    const phone = mobile(f.get('phone')) ?? fail("Buyer's 10-digit mobile is needed.");
    const email = f.get('email') ? cleanEmail(f.get('email')) ?? fail("Buyer's email does not look right.") : null;
    let pct = 0;
    if (partnerId) {
      const p = await one<{ status: string; brokerage_pct: number }>('select status, brokerage_pct from partners where id = $1', [partnerId]);
      if (!p || p.status !== 'active') fail('That broker is not active.');
      pct = s(f, 'brokerage_pct', 6) ? Number(s(f, 'brokerage_pct', 6)) : p!.brokerage_pct;
      if (!(pct >= 0 && pct <= 5)) fail('Brokerage % must be between 0 and 5.');
    }
    const id = await tx(async (c) => {
      const fl = (await c.query('select status from flats where no = $1 for update', [flat])).rows[0];
      if (!fl) fail('Pick a flat.');
      if (fl.status === 'booked') fail(`Flat ${flat} is already booked.`);
      let cust = (await c.query('select id from customers where phone = $1', [phone])).rows[0]?.id as string | undefined;
      if (!cust) cust = (await c.query(`insert into customers(name, phone, email, address, co_applicant) values ($1,$2,$3,$4,$5) returning id`,
        [name, phone, email, s(f, 'address', 300) || null, s(f, 'co_applicant', 100) || null])).rows[0].id;
      else await c.query('update customers set name=$2, email=coalesce($3,email) where id=$1', [cust, name, email]);
      if (leadId && !partnerId) {
        const l = (await c.query(`select partner_id from leads where id = $1 and partner_until >= current_date`, [leadId])).rows[0];
        if (l?.partner_id) fail(`This lead is registered to broker ${l.partner_id} until their protection ends. Pick that broker, or record why not in the lead first.`);
      }
      const b = (await c.query(`insert into bookings(flat_no, customer_id, partner_id, lead_id, booking_date, agreement_value, brokerage_pct, note, created_by)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id`, [flat, cust, partnerId, leadId, bdate, value, pct, s(f, 'note', 500) || null, u.id])).rows[0].id as string;
      await c.query(`update flats set status='booked', hold_until=null, hold_note=null, updated_at=now() where no=$1`, [flat]);
      if (leadId) await c.query(`update leads set stage='booked', flat_no=$2, customer_id=$3, next_follow_up=null, updated_at=now() where id=$1`, [leadId, flat, cust]);
      if (email) await c.query(`insert into users(email, name, phone, role, customer_id) values ($1,$2,$3,'customer',$4) on conflict (email) do nothing`, [email, name, phone, cust]);
      await c.query('insert into audit(user_id, kind, ref, data) values ($1,$2,$3,$4)', [u.id, 'booking_created', b, JSON.stringify({ flat, cust, partnerId, value, pct })]);
      return b;
    });
    if (leadId) {
      const l = await one<{ meta_lead_id: string | null }>('select meta_lead_id from leads where id = $1', [leadId]);
      await reportStage(l?.meta_lead_id ?? null, 'booked', leadId);
    }
    return `/admin/bookings/${id}?ok=${enc(`Booking ${id} created for flat ${flat}.`)}`;
  });
}

const BSTATUS = ['booked', 'agreement_registered', 'possession_offered', 'handed_over'];
export async function saveBooking(f: FormData) {
  const u = await staff();
  const id = s(f, 'id', 20);
  await run(`/admin/bookings/${id}`, async () => {
    const st = s(f, 'status', 30); if (!BSTATUS.includes(st)) fail('Pick a status.');
    const value = rupees(f.get('agreement_value')) ?? fail('Enter the agreement value.');
    const pct = Number(s(f, 'brokerage_pct', 6) || 0);
    if (!(pct >= 0 && pct <= 5)) fail('Brokerage % must be between 0 and 5.');
    if (st !== 'booked' && !date(s(f, 'agreement_date', 10))) fail('Enter the agreement registration date.');
    if (st === 'handed_over' && !date(s(f, 'handover_date', 10))) fail('Enter the date the keys were handed over.');
    const r = await pool.query(`update bookings set status=$2, agreement_value=$3, brokerage_pct=$4, agreement_date=$5, possession_date=$6, handover_date=$7, note=$8
      where id=$1 and status <> 'cancelled'`, [id, st, value, pct, date(s(f, 'agreement_date', 10)), date(s(f, 'possession_date', 10)), date(s(f, 'handover_date', 10)), s(f, 'note', 500) || null]);
    if (!r.rowCount) fail('Booking not found or cancelled.');
    await audit(u.id, 'booking_saved', id, { st, value, pct });
  });
}

export async function cancelBooking(f: FormData) {
  const u = await admin();
  const id = s(f, 'id', 20);
  await run(`/admin/bookings/${id}`, async () => {
    if (s(f, 'confirm', 20) !== 'CANCEL') fail('Type CANCEL to confirm.');
    await tx(async (c) => {
      const b = (await c.query(`update bookings set status='cancelled', note=coalesce(note,'') || $2 where id=$1 and status <> 'cancelled' returning flat_no, lead_id`,
        [id, `\nCancelled ${todayIST()}: ${s(f, 'reason', 300)}`])).rows[0];
      if (!b) fail('Already cancelled.');
      await c.query(`update flats set status='available', updated_at=now() where no=$1`, [b.flat_no]);
      if (b.lead_id) await c.query(`update leads set stage='negotiation', next_follow_up=current_date, updated_at=now() where id=$1`, [b.lead_id]);
      await c.query('insert into audit(user_id, kind, ref, data) values ($1,$2,$3,$4)', [u.id, 'booking_cancelled', id, JSON.stringify({ reason: s(f, 'reason', 300) })]);
    });
  });
}

export async function addStage(f: FormData) {
  await staff();
  const id = s(f, 'id', 20);
  await run(`/admin/bookings/${id}#schedule`, async () => {
    const label = s(f, 'label', 120); if (!label) fail('Name the stage, e.g. "On casting of 10th slab".');
    const b = await one<{ agreement_value: number }>('select agreement_value from bookings where id = $1', [id]);
    if (!b) fail('Booking not found.');
    const pct = s(f, 'pct', 6) ? Number(s(f, 'pct', 6)) : null;
    const amount = pct !== null ? Math.round(b!.agreement_value * pct / 100) : rupees(f.get('amount')) ?? fail('Enter a % or an amount.');
    const total = await one<{ t: number }>('select coalesce(sum(amount),0) t from payment_stages where booking_id = $1', [id]);
    if (total!.t + amount > b!.agreement_value) fail(`Stages would add up to ${inr(total!.t + amount)}, more than the agreement value ${inr(b!.agreement_value)}.`);
    await pool.query(`insert into payment_stages(booking_id, seq, label, pct, amount, due_date) values ($1, coalesce((select max(seq) from payment_stages where booking_id=$1),0)+1, $2,$3,$4,$5)`,
      [id, label, pct, amount, date(s(f, 'due_date', 10))]);
  });
}
export async function demandStage(f: FormData) {
  await staff();
  const id = s(f, 'id', 20), sid = Number(f.get('stage_id'));
  await run(`/admin/bookings/${id}#schedule`, async () => {
    await pool.query(`update payment_stages set demanded_at = current_date, due_date = coalesce(due_date, current_date + 15) where id=$1 and booking_id=$2`, [sid, id]);
  });
}
export async function deleteStage(f: FormData) {
  await staff();
  const id = s(f, 'id', 20);
  await run(`/admin/bookings/${id}#schedule`, async () => { await pool.query('delete from payment_stages where id=$1 and booking_id=$2', [Number(f.get('stage_id')), id]); });
}

export async function addReceipt(f: FormData) {
  const u = await staff();
  const id = s(f, 'id', 20);
  await run(`/admin/bookings/${id}#receipts`, async () => {
    const amount = rupees(f.get('amount')) ?? fail('Enter the amount received.');
    const d = date(s(f, 'date', 10)) ?? fail('Enter the date received.');
    const mode = s(f, 'mode', 20);
    if (!['cheque', 'neft_rtgs', 'upi', 'home_loan', 'other'].includes(mode)) fail('Pick how it was paid.');
    await pool.query('insert into receipts(booking_id, date, amount, mode, reference, note, created_by) values ($1,$2,$3,$4,$5,$6,$7)',
      [id, d, amount, mode, s(f, 'reference', 80) || null, s(f, 'note', 200) || null, u.id]);
    await audit(u.id, 'receipt', id, { amount, d, mode });
  });
}

export async function addPayout(f: FormData) {
  const u = await admin();
  const id = s(f, 'id', 20);
  await run(`/admin/bookings/${id}#brokerage`, async () => {
    const b = await one<{ partner_id: string | null; brokerage_amount: number; status: string }>('select partner_id, brokerage_amount, status from bookings where id=$1', [id]);
    if (!b?.partner_id) fail('This booking has no broker.');
    const amount = rupees(f.get('amount')) ?? fail('Enter the amount paid.');
    const paid = await one<{ t: number }>('select coalesce(sum(amount),0) t from brokerage_payouts where booking_id=$1', [id]);
    if (paid!.t + amount > b!.brokerage_amount) fail(`That would pay ${inr(paid!.t + amount)}, more than the brokerage of ${inr(b!.brokerage_amount)}.`);
    await pool.query('insert into brokerage_payouts(booking_id, partner_id, date, amount, reference, created_by) values ($1,$2,$3,$4,$5,$6)',
      [id, b!.partner_id, date(s(f, 'date', 10)) ?? todayIST(), amount, s(f, 'reference', 80) || null, u.id]);
    await audit(u.id, 'brokerage_paid', id, { amount });
  });
}

export async function uploadDoc(f: FormData) {
  await staff();
  const id = s(f, 'id', 20);
  await run(`/admin/bookings/${id}#docs`, async () => {
    const file = f.get('file');
    if (!(file instanceof File) || !file.size) fail('Choose a file.');
    const fl = file as File;
    if (fl.size > 5_000_000) fail('Keep files under 5 MB.');
    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(fl.type)) fail('PDF, JPG or PNG only.');
    await pool.query('insert into documents(booking_id, title, mime, data, visible_to_customer) values ($1,$2,$3,$4,$5)',
      [id, s(f, 'title', 120) || fl.name.slice(0, 120), fl.type, Buffer.from(await fl.arrayBuffer()), f.get('visible') === 'on']);
  });
}

// ─── Brokers ───────────────────────────────────────────────────────────────────────────────────────────────────
export async function decidePartner(f: FormData) {
  const u = await admin();
  const id = s(f, 'id', 20), act = s(f, 'act', 10);
  await run('/admin/partners', async () => {
    const p = await one<{ email: string; contact_name: string; phone: string; status: string }>('select email, contact_name, phone, status from partners where id=$1', [id]);
    if (!p) fail('Broker not found.');
    if (act === 'approve' || act === 'resume') {
      await pool.query(`update partners set status='active', approved_at=coalesce(approved_at, now()) where id=$1`, [id]);
      await pool.query(`insert into users(email, name, phone, role, partner_id) values ($1,$2,$3,'partner',$4)
        on conflict (email) do update set active = true, role = 'partner', partner_id = excluded.partner_id`, [p!.email, p!.contact_name, p!.phone, id]);
      if (act === 'approve') await sendMail(p!.email, 'Your Empire Gold partner login is ready',
        `Hello ${p!.contact_name},\n\nYou are now an Empire Gold channel partner (ID ${id}).\n\nSign in at https://back.empiregoldmazgaon.com/login with this email address; we will send you a one-time code each time.\nRegister each client there before you bring them for a visit, so they are recorded against your name.\n\nSite office: +91 99301 12352\nEmpire Gold, Mazgaon`);
    } else if (act === 'reject' || act === 'pause') {
      await pool.query(`update partners set status=$2 where id=$1`, [id, act === 'reject' ? 'rejected' : 'paused']);
      await pool.query(`update users set active=false where partner_id=$1`, [id]);
    } else fail('Unknown action.');
    await audit(u.id, `partner_${act}`, id);
  });
}
export async function savePartner(f: FormData) {
  const u = await admin();
  const id = s(f, 'id', 20);
  await run('/admin/partners', async () => {
    const pct = Number(s(f, 'brokerage_pct', 6));
    if (!(pct >= 0 && pct <= 5)) fail('Brokerage % must be between 0 and 5.');
    await pool.query('update partners set brokerage_pct=$2, note=$3 where id=$1', [id, pct, s(f, 'note', 300) || null]);
    await audit(u.id, 'partner_saved', id, { pct });
  });
}
export async function addPartner(f: FormData) {
  const u = await admin();
  await run('/admin/partners', async () => {
    const contact = s(f, 'contact', 80); if (contact.length < 2) fail('Name is needed.');
    const phone = mobile(f.get('phone')) ?? fail('Enter a 10-digit mobile.');
    const email = cleanEmail(f.get('email')) ?? fail('Email is needed: the partner login goes to it.');
    const r = await one<{ id: string }>(`insert into partners(firm, contact_name, phone, email, rera_no, area, source, status) values ($1,$2,$3,$4,$5,$6,'manual','applied') returning id`,
      [s(f, 'firm', 120) || contact, contact, phone, email, s(f, 'rera', 30).toUpperCase() || null, s(f, 'area', 80) || null]);
    await audit(u.id, 'partner_added', r!.id);
    return `/admin/partners?ok=${enc(`${r!.id} added. Approve it to send the login.`)}`;
  });
}

// Partner portal: a broker registers a client.
export async function partnerRegister(f: FormData) {
  const u = await need('partner');
  await run('/partner', async () => {
    const p = await one<{ status: string }>('select status from partners where id=$1', [u.partner_id]);
    if (p?.status !== 'active') fail('Your partner account is not active.');
    const name = s(f, 'name', 80); if (name.length < 2) fail("Client's name is needed.");
    const phone = mobile(f.get('phone')) ?? fail("Client's 10-digit mobile is needed.");
    await registerClient(u.partner_id!, { name, phone, email: cleanEmail(f.get('email')), interested: s(f, 'interested', 40) || null, budget: s(f, 'budget', 40) || null, note: s(f, 'note', 400) || null });
    return `/partner?ok=${enc(`${name} is registered to you.`)}#clients`;
  });
}

// ─── Broker prospects ──────────────────────────────────────────────────────────────────────────────────────────
export async function importProspects(f: FormData) {
  await staff();
  await run('/admin/prospects', async () => {
    const text = String(f.get('csv') ?? '').slice(0, 200_000);
    const src = s(f, 'source', 40) || 'import';
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) fail('Paste some rows first.');
    let added = 0, skipped = 0;
    for (const line of lines) {
      const c = line.split(/\t|,/).map((x) => x.trim().replace(/^"|"$/g, ''));
      const [name, firm, phoneRaw, emailRaw, rera, area] = c;
      if (!name || /^name$/i.test(name)) { skipped++; continue; }
      const phone = mobile(phoneRaw), email = cleanEmail(emailRaw);
      const r = await pool.query(`insert into prospects(name, firm, phone, email, rera_no, area, source) values ($1,$2,$3,$4,$5,$6,$7) on conflict do nothing`,
        [name.slice(0, 80), firm?.slice(0, 120) || null, phone, email, rera ? rera.toUpperCase().slice(0, 30) : null, area?.slice(0, 80) || null, src]);
      r.rowCount ? added++ : skipped++;
    }
    return `/admin/prospects?ok=${enc(`${added} added, ${skipped} skipped (header rows or already in the list).`)}`;
  });
}
export async function prospectStatus(f: FormData) {
  await staff();
  await run('/admin/prospects', async () => {
    const st = s(f, 'status', 20);
    if (!['new', 'contacted', 'invited', 'joined', 'not_interested'].includes(st)) fail('Pick a status.');
    await pool.query('update prospects set status=$2, note=coalesce(nullif($3,\'\'), note), updated_at=now() where id=$1', [Number(f.get('id')), st, s(f, 'note', 300)]);
  });
}
export async function invitePartner(f: FormData) {
  await staff();
  await run('/admin/prospects', async () => {
    const p = await one<{ name: string; email: string | null }>('select name, email from prospects where id=$1', [Number(f.get('id'))]);
    if (!p?.email) fail('This prospect has no email. Call them, then mark Contacted.');
    const ok = await sendMail(p!.email!, 'Invitation: Empire Gold, Mazgaon — channel partners',
      `Hello ${p!.name},\n\nWe are selling Phase II of Empire Gold, 51C Dockyard Road, Mazgaon: 35 homes (1 RK to 1.5 BHK) on floors 8–15, above a delivered and occupied Phase I. MahaRERA P51900008690.\n\nWe would like you to bring your clients. Apply in two minutes at https://empiregoldmazgaon.com/partners — once approved you get a partner login to register clients and track your sales.\n\nOr call the site office: +91 99301 12352.\n\nEmpire Gold, Mazgaon`);
    if (!ok) fail('Email could not be sent (is RESEND_API_KEY set?).');
    await pool.query(`update prospects set status='invited', updated_at=now() where id=$1`, [Number(f.get('id'))]);
    return `/admin/prospects?ok=${enc(`Invitation sent to ${p!.name}.`)}`;
  });
}

// ─── Site updates ──────────────────────────────────────────────────────────────────────────────────────────────
export async function postUpdate(f: FormData) {
  await staff();
  await run('/admin/updates', async () => {
    const title = s(f, 'title', 120); if (!title) fail('Give the update a title.');
    const body = s(f, 'body', 3000); if (!body) fail('Write what happened.');
    let photo: Buffer | null = null, mime: string | null = null;
    const file = f.get('photo');
    if (file instanceof File && file.size) {
      if (file.size > 4_000_000) fail('Keep the photo under 4 MB.');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) fail('Photo must be JPG, PNG or WebP.');
      photo = Buffer.from(await file.arrayBuffer()); mime = file.type;
    }
    await pool.query('insert into updates(date, title, body, public, photo, photo_mime) values ($1,$2,$3,$4,$5,$6)',
      [date(s(f, 'date', 10)) ?? todayIST(), title, body, f.get('public') === 'on', photo, mime]);
  });
}
export async function deleteUpdate(f: FormData) {
  await admin();
  await run('/admin/updates', async () => { await pool.query('delete from updates where id=$1', [Number(f.get('id'))]); });
}

// ─── Settings and team ─────────────────────────────────────────────────────────────────────────────────────────
export async function saveSettings(f: FormData) {
  const u = await admin();
  await run('/admin/settings', async () => {
    const rate = Number(s(f, 'rate_sqft', 10).replace(/\D/g, ''));
    if (rate < 5000 || rate > 200000) fail('Rate per sq.ft looks wrong.');
    const pct = Number(s(f, 'brokerage_pct', 6));
    if (!(pct >= 0 && pct <= 5)) fail('Brokerage % must be between 0 and 5.');
    const days = Number(s(f, 'partner_lock_days', 4));
    if (!(days >= 7 && days <= 365)) fail('Client protection must be 7 to 365 days.');
    for (const [k, v] of [['rate_sqft', rate], ['brokerage_pct', pct], ['partner_lock_days', days]] as const)
      await pool.query(`insert into settings(key, value) values ($1,$2) on conflict (key) do update set value=excluded.value, updated_at=now()`, [k, String(v)]);
    await audit(u.id, 'settings', null, { rate, pct, days });
  });
}
export async function addTeam(f: FormData) {
  const u = await admin();
  await run('/admin/settings', async () => {
    const email = cleanEmail(f.get('email')) ?? fail('Enter an email.');
    const role = s(f, 'role', 10); if (!['admin', 'staff'].includes(role)) fail('Pick a role.');
    const name = s(f, 'name', 80) || email;
    await pool.query(`insert into users(email, name, role) values ($1,$2,$3) on conflict (email) do update set role=excluded.role, name=excluded.name, active=true`, [email, name, role]);
    await audit(u.id, 'team_added', email, { role });
  });
}
export async function toggleUser(f: FormData) {
  const u = await admin();
  await run('/admin/settings', async () => {
    const id = s(f, 'uid', 40);
    if (id === u.id) fail('You cannot switch yourself off.');
    await pool.query('update users set active = not active where id=$1', [id]);
    await pool.query('delete from sessions where user_id=$1', [id]);
  });
}

export async function defaultRate() { return Number(await setting('rate_sqft', '35000')) || 35000; }
export async function staffCheck() { const u = await staff(); return isStaff(u); }
