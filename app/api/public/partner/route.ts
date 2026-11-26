// "Become a channel partner" form → an application the admin approves in the back office.
import { originOk, isJson, json, errorJson } from '../../_util';
import { clip, cleanEmail, mobile, fail, ipOf, limit } from '@/lib/core';
import { one } from '@/lib/db';
import { alertTeam } from '@/lib/mail';

export async function POST(req: Request) {
  try {
    if (!originOk(req) || !isJson(req)) return json({ error: 'Not allowed.' }, 403);
    const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (b.website) return json({ ok: true });
    await limit(`partner:${ipOf(req.headers)}`, 5, 60);
    const contact = clip(b.contact, 80); if (contact.length < 2) fail('Please tell us your name.');
    const firm = clip(b.firm, 120) || contact;
    const phone = mobile(b.phone) ?? fail('Please enter a 10-digit Indian mobile number.');
    const email = cleanEmail(b.email) ?? fail('Please enter your email: your partner login is sent to it.');
    const rera = clip(b.rera, 40).toUpperCase().replace(/\s+/g, '');
    if (!/^A\d{8,14}$/.test(rera)) fail('Please enter your MahaRERA agent registration number (it starts with A).');
    const area = clip(b.area, 80);
    const row = await one<{ id: string }>(`insert into partners(firm, contact_name, phone, email, rera_no, area, source) values ($1,$2,$3,$4,$5,$6,'website')
      on conflict (phone) do nothing returning id`, [firm, contact, phone, email, rera, area]);
    if (!row) return json({ ok: true, already: true });
    await alertTeam(`Broker application: ${firm}`, `${contact} · ${phone} · ${email}\nMahaRERA ${rera} · ${area}\n\nApprove: https://back.empiregoldmazgaon.com/admin/partners`);
    return json({ ok: true });
  } catch (e) { return errorJson(e); }
}
