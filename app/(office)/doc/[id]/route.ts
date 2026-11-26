// A booking document: staff see all; a buyer sees their own (if marked visible); a broker sees none.
import { one } from '@/lib/db';
import { currentUser, isStaff } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const u = await currentUser();
  const id = Number(params.id);
  if (!u || !Number.isInteger(id)) return new Response('Not found', { status: 404 });
  const d = await one<{ title: string; mime: string; data: Buffer; visible_to_customer: boolean; customer_id: string }>(
    'select d.title, d.mime, d.data, d.visible_to_customer, b.customer_id from documents d join bookings b on b.id = d.booking_id where d.id = $1', [id]);
  const ok = d && (isStaff(u) || (u.role === 'customer' && d.visible_to_customer && d.customer_id === u.customer_id));
  if (!ok) return new Response('Not found', { status: 404 });
  const ext = d!.mime === 'application/pdf' ? 'pdf' : d!.mime === 'image/png' ? 'png' : 'jpg';
  const name = d!.title.replace(/[^\w .-]/g, '').slice(0, 80) || 'document';
  return new Response(new Uint8Array(d!.data), { headers: { 'content-type': d!.mime, 'content-disposition': `inline; filename="${name}.${ext}"`, 'cache-control': 'private, no-store' } });
}
