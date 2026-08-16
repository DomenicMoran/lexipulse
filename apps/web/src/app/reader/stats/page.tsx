import type { Metadata } from 'next';
import { StatsView } from '@/components/reader/stats-view';

export const metadata: Metadata = {
  title: 'Statistik',
  description:
    'Gelesene Wörter, Lesezeit, Durchschnittstempo und Aktivität der letzten zwölf Wochen — lokal berechnet.',
  alternates: { canonical: '/reader/stats' },
};

export default function StatsPage() {
  return <StatsView />;
}
