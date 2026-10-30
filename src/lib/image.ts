/**
 * Café photos are hotlinked from wherever OpenStreetMap points, so Next's image optimizer
 * (which needs a fixed host allow-list) can't be used. Where the host can resize for us we ask
 * for a thumbnail of the size we actually draw (Wikimedia Commons, by far the common case);
 * otherwise the URL is used as is. Callers pass the CSS width and we request 2x for sharp screens.
 */
export function photoSrc(url: string, cssWidth: number): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'commons.wikimedia.org' && u.pathname.startsWith('/wiki/Special:FilePath/')) {
      u.searchParams.set('width', String(Math.round(cssWidth * 2)));
      return u.toString();
    }
  } catch {
    /* fall through to the original */
  }
  return url;
}
