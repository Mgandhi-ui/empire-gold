// One app, two addresses, no overlap:
//   empiregoldmazgaon.com        → the public website: /, /partners, /privacy
//   back.empiregoldmazgaon.com   → sign-in, back office, partner and buyer logins: /login, /admin, /partner, /my, /doc, /logout
// Each address refuses the other's pages. Any host starting with "back." is the back office (locally: http://back.localhost:3300).
import { NextResponse, type NextRequest } from 'next/server';

const BACK_ONLY = /^\/(login|logout|admin|partner|my|doc)(\/|$)/;
const SITE_ONLY = /^\/(partners|privacy)(\/|$)/;

export function middleware(req: NextRequest) {
  const host = (req.headers.get('host') ?? '').toLowerCase();
  const { pathname } = req.nextUrl;
  if (host.startsWith('back.')) {
    if (pathname === '/') return NextResponse.redirect(new URL('/login', req.url));
    if (SITE_ONLY.test(pathname)) return NextResponse.redirect(`https://${host.replace(/^back\./, '')}${pathname}`);
    return NextResponse.next();
  }
  if (BACK_ONLY.test(pathname)) {
    const back = new URL(req.url);
    back.host = `back.${host.replace(/^www\./, '')}`;
    return NextResponse.redirect(back);
  }
  return NextResponse.next();
}

export const config = { matcher: ['/((?!api/|_next/|img/|favicon|og.jpg|robots.txt|sitemap.xml|icon).*)'] };
