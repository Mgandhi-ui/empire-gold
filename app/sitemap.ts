import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const s = 'https://empiregoldmazgaon.com';
  return [{ url: `${s}/`, priority: 1 }, { url: `${s}/partners`, priority: 0.6 }, { url: `${s}/privacy`, priority: 0.2 }];
}
