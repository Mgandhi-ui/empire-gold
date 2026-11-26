// Email through Resend (RESEND_API_KEY, sender on empiregoldmazgaon.com verified in Resend).
// Without a key, mail is only printed to the server log (fine for a test copy, never for the live site).
export async function sendMail(to: string | string[], subject: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const list = (Array.isArray(to) ? to : to.split(',')).map((s) => s.trim()).filter(Boolean);
  if (!list.length) return false;
  if (!key) { console.log(`[mail not sent: no RESEND_API_KEY] to=${list.join(',')} subject=${subject}`); return false; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(10_000),
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: JSON.stringify({ from: process.env.MAIL_FROM || 'Empire Gold <noreply@empiregoldmazgaon.com>', to: list, subject, text }),
  }).catch(() => null);
  if (!r?.ok) console.error('Resend send failed', r?.status ?? 'no answer');
  return !!r?.ok;
}

/** A short note to the sales team (LEAD_ALERT_TO, comma separated) when a new lead or broker application arrives. */
export async function alertTeam(subject: string, text: string) {
  const to = process.env.LEAD_ALERT_TO;
  if (to) await sendMail(to, subject, text).catch(() => false);
}
