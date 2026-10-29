/** OSM tags are free text, so anything that becomes a link is validated first. */

/** http(s) URLs only; rejects javascript:, data:, malformed values. */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

/** A tel: href for the first number, only if the value looks like a phone number. */
export function phoneHref(value: string | null | undefined): string | null {
  if (!value || !/^[+0-9()\-\s.;,/]+$/.test(value)) return null;
  const first = value.split(/[;,/]/)[0].replace(/[^+\d]/g, '');
  return first.length >= 5 ? `tel:${first}` : null;
}
