import type { MetadataRoute } from 'next';

const SITE_URL = 'https://lexipulse.de';

const ROUTES: { path: string; priority: number; changeFrequency: 'monthly' | 'yearly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'monthly' },
  { path: '/pdf', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/reader', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/reader/library', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/reader/stats', priority: 0.5, changeFrequency: 'monthly' },
  { path: '/impressum', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/datenschutz', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/agb', priority: 0.3, changeFrequency: 'yearly' },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
