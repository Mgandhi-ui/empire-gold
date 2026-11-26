// Photo of a construction update. Public updates for everyone; private ones only for signed-in people.
import { one } from '@/lib/db';
import { currentUser } from '@/lib/auth';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return new Response('Not found', { status: 404 });
  const r = await one<{ photo: Buffer; photo_mime: string; public: boolean }>('select photo, photo_mime, public from updates where id = $1 and photo is not null', [id]);
  if (!r) return new Response('Not found', { status: 404 });
  if (!r.public && !(await currentUser())) return new Response('Not found', { status: 404 });
  return new Response(new Uint8Array(r.photo), { headers: { 'content-type': r.photo_mime, 'cache-control': r.public ? 'public, max-age=3600' : 'private, no-store' } });
}
