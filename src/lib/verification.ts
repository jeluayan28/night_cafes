/**
 * "Verification" here means one thing only: a mapper recorded a check_date on
 * OpenStreetMap. Night Café Butuan does not verify cafés itself.
 */
export interface Verification {
  tone: 'ok' | 'warn' | 'none';
  label: string;
  detail: string;
  /** Whole months since the check date, when known. */
  ageMonths: number | null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STALE_AFTER_MONTHS = 12;

/** Accepts the partial ISO dates OSM uses: YYYY, YYYY-MM or YYYY-MM-DD. */
function parseCheckDate(value: string): { y: number; m: number | null; d: number | null } | null {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value.trim());
  if (!match) return null;
  const [, y, m, d] = match;
  const month = m ? Number(m) : null;
  const day = d ? Number(d) : null;
  if (month !== null && (month < 1 || month > 12)) return null;
  if (day !== null && (day < 1 || day > 31)) return null;
  return { y: Number(y), m: month, d: day };
}

export function formatCheckDate(value: string): string {
  const p = parseCheckDate(value);
  if (!p) return value;
  if (p.m === null) return String(p.y);
  return `${p.d ? `${p.d} ` : ''}${MONTHS[p.m - 1]} ${p.y}`;
}

export function verificationOf(checkedOn: string | null, now: Date): Verification {
  const none = (detail: string): Verification => ({ tone: 'none', label: 'Not verified', detail, ageMonths: null });
  if (!checkedOn) return none('No one has recorded when these details were last checked.');

  const p = parseCheckDate(checkedOn);
  if (!p) return none(`The recorded check date (“${checkedOn}”) isn’t a valid date.`);

  const ageMonths = (now.getFullYear() - p.y) * 12 + (now.getMonth() + 1 - (p.m ?? 1));
  if (ageMonths < 0) return none(`The recorded check date (“${checkedOn}”) is in the future, so it can’t be trusted.`);

  const when = formatCheckDate(checkedOn);
  return ageMonths > STALE_AFTER_MONTHS
    ? { tone: 'warn', label: `Last checked ${when}`, detail: 'That was over a year ago, so details may be out of date.', ageMonths }
    : { tone: 'ok', label: `Checked ${when}`, detail: 'A mapper recorded this check on OpenStreetMap.', ageMonths };
}
