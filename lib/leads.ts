// Adding leads from every door (website, Meta, brokers, staff), with one rule for duplicates:
// the same mobile number within 90 days is the same person — we add a note to their lead instead of a second lead.
import { one, pool, setting } from './db';
import { addDays, fail, todayIST } from './core';
import { alertTeam } from './mail';

export type NewLead = {
  name: string; phone: string; email?: string | null; source: string; sourceDetail?: string | null;
  interested?: string | null; budget?: string | null; message?: string | null; partnerId?: string | null;
  metaLeadId?: string | null; ownerId?: string | null; by?: string | null;
};

export async function addLead(l: NewLead): Promise<{ id: number; duplicate: boolean }> {
  if (l.metaLeadId) {
    const m = await one<{ id: number }>('select id from leads where meta_lead_id = $1', [l.metaLeadId]);
    if (m) return { id: m.id, duplicate: true };
  }
  const dup = await one<{ id: number; partner_id: string | null }>(
    `select id, partner_id from leads where phone = $1 and created_at > now() - interval '90 days' order by created_at desc limit 1`, [l.phone]);
  if (dup) {
    await pool.query('insert into lead_notes(lead_id, by_user, text) values ($1,$2,$3)', [dup.id, l.by ?? null,
      `Enquired again via ${l.source}${l.sourceDetail ? ` (${l.sourceDetail})` : ''}.${l.message ? ' Message: ' + l.message : ''}`]);
    await pool.query(`update leads set updated_at = now(), stage = case when stage = 'lost' then 'new' else stage end,
      next_follow_up = least(coalesce(next_follow_up, $2::date), $2::date) where id = $1`, [dup.id, todayIST()]);
    return { id: dup.id, duplicate: true };
  }
  let partnerUntil: string | null = null;
  if (l.partnerId) partnerUntil = addDays(todayIST(), Number(await setting('partner_lock_days', '60')) || 60);
  const r = await one<{ id: number }>(`insert into leads(name, phone, email, source, source_detail, interested, budget, message, partner_id, partner_until,
      meta_lead_id, owner_id, next_follow_up) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) returning id`,
    [l.name, l.phone, l.email || null, l.source, l.sourceDetail || null, l.interested || null, l.budget || null, l.message || null,
      l.partnerId || null, partnerUntil, l.metaLeadId || null, l.ownerId || null, todayIST()]);
  await alertTeam(`New lead: ${l.name} (${l.source})`,
    `${l.name} · ${l.phone}${l.email ? ' · ' + l.email : ''}\nSource: ${l.source}${l.sourceDetail ? ' — ' + l.sourceDetail : ''}\nInterested in: ${l.interested ?? '—'} · Budget: ${l.budget ?? '—'}\n${l.message ?? ''}\n\nOpen: https://back.empiregoldmazgaon.com/admin/leads/${r!.id}`);
  return { id: r!.id, duplicate: false };
}

/** A broker registers a client. Refused if we already know this number (from anyone) in the last 90 days. */
export async function registerClient(partnerId: string, c: { name: string; phone: string; email?: string | null; interested?: string | null; budget?: string | null; note?: string | null }) {
  const known = await one<{ id: number }>(`select id from leads where phone = $1 and created_at > now() - interval '90 days' limit 1`, [c.phone]);
  if (known) fail('This client is already registered with us, so we cannot add them under your name. Call the site office if you think this is a mistake.');
  return addLead({ name: c.name, phone: c.phone, email: c.email, source: 'broker', sourceDetail: partnerId, partnerId, interested: c.interested, budget: c.budget, message: c.note });
}
