// The website's enquiry form → a lead in the back office (+ a "Lead" to Meta's Conversions API).
import { originOk, isJson, json, errorJson } from '../../_util';
import { clip, cleanEmail, mobile, fail, ipOf, limit, TYPES } from '@/lib/core';
import { addLead } from '@/lib/leads';
import { sendCapi } from '@/lib/meta';

const REF_SOURCE: Record<string, string> = { meta: 'meta', fb: 'meta', ig: 'meta', instagram: 'meta', google: 'google', hoarding: 'hoarding', qr: 'hoarding', portal: 'portal', magicbricks: 'portal', '99acres': 'portal' };
const BUDGETS = ['Under ₹1 Cr', '₹1–1.5 Cr', '₹1.5–2 Cr', 'Above ₹2 Cr', 'Not sure'];

export async function POST(req: Request) {
  try {
    if (!originOk(req) || !isJson(req)) return json({ error: 'Not allowed.' }, 403);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (b.website) return json({ ok: true }); // honeypot: bots fill the hidden field
    const ip = ipOf(req.headers);
    await limit(`enq:${ip}`, 8, 60, 'Thank you — we already have your enquiry. We will call you shortly.');
    const name = clip(b.name, 80);
    if (name.length < 2) fail('Please tell us your name.');
    const phone = mobile(b.phone) ?? fail('Please enter a 10-digit Indian mobile number.');
    const email = b.email ? cleanEmail(b.email) ?? fail('That email address does not look right.') : null;
    const interested = TYPES.includes(String(b.interested)) ? String(b.interested) : null;
    const budget = BUDGETS.includes(String(b.budget)) ? String(b.budget) : null;
    const ref = clip(b.ref, 40).toLowerCase().replace(/[^a-z0-9_-]/g, '');
    const source = REF_SOURCE[ref] ?? 'website';
    const visit = clip(b.visit, 40);
    const message = [visit && `Visit: ${visit}`, clip(b.message, 600)].filter(Boolean).join('\n') || null;
    const r = await addLead({ name, phone, email, source, sourceDetail: ref || null, interested, budget, message });
    const eventId = clip(b.eventId, 64) || `lead-${r.id}`;
    const cookie = req.headers.get('cookie') ?? '';
    const ck = (k: string) => new RegExp(`(?:^|; )${k}=([^;]+)`).exec(cookie)?.[1];
    await sendCapi({ name: 'Lead', eventId, url: clip(b.url, 300) || undefined, email, phone10: phone, firstName: name, ip,
      ua: req.headers.get('user-agent') ?? undefined, fbp: ck('_fbp'), fbc: ck('_fbc'), custom: { content_name: interested ?? 'Empire Gold' } }).catch(() => false);
    return json({ ok: true });
  } catch (e) { return errorJson(e); }
}
