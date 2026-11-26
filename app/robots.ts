import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';
export default function robots(): MetadataRoute.Robots {
  const back = (headers().get('host') ?? '').startsWith('back.');
  return back ? { rules: { userAgent: '*', disallow: '/' } }
    : { rules: { userAgent: '*', allow: '/', disallow: ['/api/'] }, sitemap: 'https://empiregoldmazgaon.com/sitemap.xml' };
}
