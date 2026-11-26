// Meta Lead Ads → leads. Meta first checks this address with a GET (hub.challenge), then POSTs each new form fill.
import { json } from '../../_util';
import { webhookSignatureOk, fetchLead, leadFields } from '@/lib/meta';
import { addLead } from '@/lib/leads';
import { mobile, cleanEmail, clip } from '@/lib/core';
import { audit } from '@/lib/db';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const ok = u.searchParams.get('hub.mode') === 'subscribe' && !!process.env.META_VERIFY_TOKEN && u.searchParams.get('hub.verify_token') === process.env.META_VERIFY_TOKEN;
  return ok ? new Response(u.searchParams.get('hub.challenge') ?? '', { status: 200 }) : new Response('Forbidden', { status: 403 });
}

type Change = { field: string; value: { leadgen_id?: string; form_id?: string; ad_id?: string } };
export async function POST(req: Request) {
  const raw = await req.text();
  if (!webhookSignatureOk(raw, req.headers.get('x-hub-signature-256'))) return new Response('Bad signature', { status: 401 });
  let body: { entry?: { changes?: Change[] }[] };
  try { body = JSON.parse(raw); } catch { return json({ ok: false }, 400); }
  for (const e of body.entry ?? []) for (const c of e.changes ?? []) {
    if (c.field !== 'leadgen' || !c.value.leadgen_id) continue;
    try {
      const l = await fetchLead(c.value.leadgen_id);
      if (!l) { await audit(null, 'meta_lead_fetch_failed', c.value.leadgen_id); continue; }
      const f = leadFields(l);
      const phone = mobile(f.phone);
      if (!phone) { await audit(null, 'meta_lead_no_mobile', l.id, { name: f.name, phone: f.phone }); continue; }
      await addLead({ name: clip(f.name, 80), phone, email: cleanEmail(f.email), source: 'meta', metaLeadId: l.id,
        sourceDetail: clip([l.campaign_name, l.ad_name].filter(Boolean).join(' / '), 160) || null, message: clip(f.extra, 600) || null });
    } catch (err) { console.error('Meta lead failed', err); }
  }
  return json({ ok: true }); // always 200, or Meta keeps retrying
}
