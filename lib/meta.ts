// Meta (Facebook / Instagram) integration. Three pieces, each off until its keys are set:
// 1. Conversions API: the website's enquiry form reports a "Lead" from our server too (deduplicated with the browser
//    Pixel by event_id), so ads optimise even when the browser blocks the Pixel. Keys: META_PIXEL_ID, META_CAPI_TOKEN.
// 2. Lead Ads: Meta calls /api/meta/webhook when someone fills an Instant Form; we fetch the answers and add the lead.
//    Keys: META_VERIFY_TOKEN (any long random text, typed in the Meta app too), META_APP_SECRET, META_PAGE_TOKEN.
// 3. CRM quality signals: when a Meta lead reaches "Site visit done" or "Booked" we tell Meta, so it finds more people
//    like the ones who visit and buy, not just the ones who fill forms (Meta's "Conversion leads" optimisation).
import { createHmac } from 'node:crypto';
import { sha, same } from './core';

const V = () => process.env.META_GRAPH_VERSION || 'v23.0';
const G = 'https://graph.facebook.com';
const norm = (s: string) => s.trim().toLowerCase();

export type CapiEvent = {
  name: string; eventId: string; url?: string; email?: string | null; phone10?: string | null; firstName?: string | null;
  ip?: string; ua?: string; fbp?: string; fbc?: string; action?: 'website' | 'system_generated'; metaLeadId?: string | null;
  custom?: Record<string, unknown>;
};

export async function sendCapi(e: CapiEvent): Promise<boolean> {
  const pixel = process.env.META_PIXEL_ID, token = process.env.META_CAPI_TOKEN;
  if (!pixel || !token) return false;
  const user_data: Record<string, unknown> = { country: [sha('in')] };
  if (e.email) user_data.em = [sha(norm(e.email))];
  if (e.phone10) user_data.ph = [sha('91' + e.phone10)];
  if (e.firstName) user_data.fn = [sha(norm(e.firstName.split(/\s+/)[0] ?? ''))];
  if (e.ip && e.ip !== 'unknown') user_data.client_ip_address = e.ip;
  if (e.ua) user_data.client_user_agent = e.ua;
  if (e.fbp) user_data.fbp = e.fbp;
  if (e.fbc) user_data.fbc = e.fbc;
  if (e.metaLeadId) user_data.lead_id = e.metaLeadId;
  const data = [{
    event_name: e.name, event_time: Math.floor(Date.now() / 1000), event_id: e.eventId,
    action_source: e.action ?? 'website', ...(e.url ? { event_source_url: e.url } : {}), user_data,
    custom_data: { ...(e.action === 'system_generated' ? { event_source: 'crm', lead_event_source: 'Empire Gold back office' } : {}), ...(e.custom ?? {}) },
  }];
  const body: Record<string, unknown> = { data };
  if (process.env.META_TEST_EVENT_CODE) body.test_event_code = process.env.META_TEST_EVENT_CODE;
  const r = await fetch(`${G}/${V()}/${pixel}/events?access_token=${encodeURIComponent(token)}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000),
  }).catch(() => null);
  if (!r?.ok) console.error('Meta CAPI failed', r?.status, await r?.text().catch(() => ''));
  return !!r?.ok;
}

/** CRM stage → Meta, only for leads that came from Meta Lead Ads. */
const STAGE_EVENT: Record<string, string> = { visited: 'SiteVisit', booked: 'Booked', lost: 'Disqualified' };
export async function reportStage(metaLeadId: string | null, stage: string, leadId: number) {
  const name = STAGE_EVENT[stage];
  if (!metaLeadId || !name) return;
  await sendCapi({ name, eventId: `crm-${leadId}-${stage}`, action: 'system_generated', metaLeadId }).catch(() => false);
}

export function webhookSignatureOk(raw: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header?.startsWith('sha256=')) return false;
  const want = 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
  return same(want, header);
}

export type MetaLead = { id: string; created_time: string; ad_name?: string; campaign_name?: string; form_id?: string; field_data: { name: string; values: string[] }[] };
export async function fetchLead(leadgenId: string): Promise<MetaLead | null> {
  const token = process.env.META_PAGE_TOKEN;
  if (!token || !/^\d{5,25}$/.test(leadgenId)) return null;
  const r = await fetch(`${G}/${V()}/${leadgenId}?fields=id,created_time,ad_name,campaign_name,form_id,field_data&access_token=${encodeURIComponent(token)}`,
    { signal: AbortSignal.timeout(8000) }).catch(() => null);
  if (!r?.ok) { console.error('Meta lead fetch failed', r?.status); return null; }
  return (await r.json()) as MetaLead;
}

/** Pull the usual Instant Form answers out by their field names (Meta's standard ones and common custom ones). */
export function leadFields(l: MetaLead) {
  const f = (...names: string[]) => l.field_data.find((x) => names.includes(x.name.toLowerCase()))?.values?.[0] ?? '';
  const first = f('first_name'), last = f('last_name');
  const extra = l.field_data.filter((x) => !['full_name', 'first_name', 'last_name', 'phone_number', 'phone', 'email'].includes(x.name.toLowerCase()))
    .map((x) => `${x.name.replace(/_/g, ' ')}: ${x.values.join(', ')}`).join('\n');
  return { name: f('full_name') || `${first} ${last}`.trim() || 'Meta lead', phone: f('phone_number', 'phone'), email: f('email'), extra };
}
