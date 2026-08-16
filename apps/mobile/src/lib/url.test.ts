import { describe, expect, it } from 'vitest';

import { isProbablyUrl, normalizeUrl } from './url';

describe('normalizeUrl', () => {
  it('leaves an absolute URL alone', () => {
    expect(normalizeUrl('https://lexipulse.de/blog')).toBe('https://lexipulse.de/blog');
    expect(normalizeUrl('http://example.com')).toBe('http://example.com');
  });

  it('assumes https for a bare host', () => {
    expect(normalizeUrl('lexipulse.de')).toBe('https://lexipulse.de');
  });

  it('trims what a paste brings along', () => {
    expect(normalizeUrl('  https://example.com/a  ')).toBe('https://example.com/a');
  });

  it('does not mistake the scheme for a missing one', () => {
    expect(normalizeUrl('HTTPS://Example.com')).toBe('HTTPS://Example.com');
  });
});

describe('isProbablyUrl', () => {
  it('accepts real addresses', () => {
    for (const value of [
      'https://lexipulse.de',
      'lexipulse.de',
      'www.spiegel.de/politik/artikel-123.html',
      'http://sub.domain.co.uk/path?q=1',
    ]) {
      expect(isProbablyUrl(value), value).toBe(true);
    }
  });

  it('rejects prose and bare words', () => {
    // Everything here normalises to a parseable `https://…`, which is precisely why the
    // check cannot just be "does URL() throw".
    for (const value of ['Hallo', 'ein Satz ohne Adresse', '', 'a.b', '...']) {
      expect(isProbablyUrl(value), value).toBe(false);
    }
  });
});
