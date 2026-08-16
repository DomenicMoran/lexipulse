/**
 * Feeds the annotations provider the document that is currently open.
 *
 * A separate component because the provider needs `useReader()`, and `useReader` only
 * exists below `ReaderProvider` — a provider cannot consume the context of a sibling
 * further up its own tree.
 */
import { AnnotationsProvider } from './annotations';
import { useReader } from './reader';

export function AnnotationsGate({ children }: { children: React.ReactNode }) {
  const { document } = useReader();
  return <AnnotationsProvider documentId={document?.id ?? null}>{children}</AnnotationsProvider>;
}
