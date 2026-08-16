import type { MetadataRoute } from 'next';

const SITE_URL = 'https://lexipulse.de';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing behind these paths is content: `/api/extract` is a POST endpoint and
        // `/offline` only exists as a service-worker fallback.
        disallow: ['/api/', '/offline'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
