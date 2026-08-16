import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Mono, Inter, JetBrains_Mono, Literata } from 'next/font/google';
import * as React from 'react';
import { ServiceWorker } from '@/components/service-worker';
import { SettingsProvider } from '@/components/settings-provider';
import { BOOT_THEME_SCRIPT } from '@/lib/theme';
import './globals.css';

/*
 * Every web font in the product is declared here and nowhere else.
 *
 * A second `next/font` call for the same family in another module produces a second
 * @font-face block and a second preload, and the browser then downloads the file twice —
 * paid for directly in LCP. One module, one declaration.
 *
 * Inter and JetBrains Mono carry the interface and the player, so they are preloaded.
 * IBM Plex Mono and Literata exist only because the reader lets you choose them; with
 * `preload: false` their files are fetched the moment a glyph actually needs them and
 * never before.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--lx-font-inter',
  adjustFontFallback: true,
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--lx-font-jetbrains',
  adjustFontFallback: true,
});

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
  preload: false,
  variable: '--lx-font-plex',
  adjustFontFallback: true,
});

const literata = Literata({
  subsets: ['latin'],
  display: 'swap',
  preload: false,
  variable: '--lx-font-literata',
  adjustFontFallback: true,
});

const SITE_URL = 'https://lexipulse.de';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'LexiPulse — RSVP-Reader für EPUB, PDF und Web-Artikel',
    template: '%s — LexiPulse',
  },
  description:
    'Lesen Sie EPUB, PDF und Web-Artikel Wort für Wort an fester Position, mit markiertem Erkennungspunkt. Offline, ohne Konto, ohne Datenerhebung.',
  applicationName: 'LexiPulse',
  authors: [{ name: 'MenuCloud Berlin' }],
  creator: 'MenuCloud Berlin',
  publisher: 'MenuCloud Berlin',
  keywords: [
    'RSVP',
    'Schnelllesen',
    'Speed Reading',
    'EPUB Reader',
    'PDF Reader',
    'Offline Reader',
    'Lesen ohne Tracking',
  ],
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '32x32' },
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    url: SITE_URL,
    siteName: 'LexiPulse',
    title: 'LexiPulse — RSVP-Reader für EPUB, PDF und Web-Artikel',
    description:
      'Ein Wort nach dem anderen, an fester Position, mit markiertem Erkennungspunkt. Offline, ohne Konto, ohne Datenerhebung.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'LexiPulse' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LexiPulse — RSVP-Reader für EPUB, PDF und Web-Artikel',
    description:
      'Ein Wort nach dem anderen, an fester Position, mit markiertem Erkennungspunkt. Offline, ohne Konto.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="de"
      className={`${inter.variable} ${jetbrainsMono.variable} ${plexMono.variable} ${literata.variable}`}
      suppressHydrationWarning
    >
      <body>
        {/* Replays the cached theme before the first frame; without it a sepia reader
            would flash black on every navigation. */}
        <script dangerouslySetInnerHTML={{ __html: BOOT_THEME_SCRIPT }} />
        <a
          href="#inhalt"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[8px] focus:border focus:border-[var(--lx-border-strong)] focus:bg-[var(--lx-surface)] focus:px-4 focus:py-2 focus:text-[14px] focus:text-[var(--lx-text)]"
        >
          Zum Inhalt springen
        </a>
        <SettingsProvider>{children}</SettingsProvider>
        <ServiceWorker />
      </body>
    </html>
  );
}
