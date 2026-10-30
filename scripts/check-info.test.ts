// Test-only fixtures; never part of the shipped data.
import { buildCafes } from '../src/lib/cafes';
import { osmToRecord } from '../src/lib/model/osm-import';
import { uncertaintyNotes } from '../src/lib/notes';
import { phoneHref, safeHttpUrl } from '../src/lib/safe';
import { formatCheckDate, verificationOf } from '../src/lib/verification';
import type { RawCafe } from '../src/types';

let bad = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(62), ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const cafe = (tags: Record<string, string>) => buildCafes([osmToRecord({ id: 'node/1', name: 'T', lat: 8.9, lon: 125.5, tags } as RawCafe, '2026-10-29T00:00:00Z')])[0];
const NOW = new Date(2026, 9, 28); // Oct 2026

console.log('— nothing is invented when tags are missing');
const bare = cafe({});
check('all optional fields are null / empty', [bare.description, bare.address, bare.barangay, bare.priceRange, bare.phone, bare.website, bare.checkedOn, bare.photos, bare.amenities], [null, null, null, null, null, null, null, [], []]);
check('not budget / study by default', [bare.budget, bare.study], [false, false]);

console.log('— fields come straight from tags');
const full = cafe({
  description: ' Cozy corner spot. ', 'addr:housenumber': '12', 'addr:street': 'Montilla Blvd', 'addr:barangay': 'Holy Redeemer',
  'addr:city': 'Butuan City', 'addr:province': 'Agusan del Norte', 'addr:postcode': '8600', price_range: 'budget',
  phone: '+63 85 342 1234', website: 'https://example.com/cafe', image: 'https://img.example.com/a.jpg;https://img.example.com/b.jpg',
  'opening_hours:check_date': '2026-08-14', check_date: '2025-01-02', note: 'Closed during typhoons',
});
check('description trimmed', full.description, 'Cozy corner spot.');
check('full address', full.address, '12 Montilla Blvd, Holy Redeemer, Butuan City, Agusan del Norte, 8600');
check('barangay', full.barangay, 'Holy Redeemer');
check('price range verbatim + budget flag', [full.priceRange, full.budget], ['budget', true]);
check('two photo URLs', full.photos, ['https://img.example.com/a.jpg', 'https://img.example.com/b.jpg']);
check('latest check date wins', full.checkedOn, '2026-08-14');
check('addr:full preferred when present', cafe({ 'addr:full': 'Corner of A and B', 'addr:street': 'X' }).address, 'Corner of A and B');

console.log('— unsafe links never become links');
check('javascript: URL rejected', safeHttpUrl('javascript:alert(1)'), null);
check('data: URL rejected', safeHttpUrl('data:text/html,<script>1</script>'), null);
check('bare handle rejected', safeHttpUrl('mycafe'), null);
check('https accepted', safeHttpUrl('https://example.com/x'), 'https://example.com/x');
check('website tag with javascript: -> null', cafe({ website: 'javascript:alert(1)' }).website, null);
check('image tag with non-http -> no photos', cafe({ image: 'file:///etc/passwd;ftp://x/y.jpg' }).photos, []);
check('phone href strips formatting', phoneHref('+63 85 342-1234'), 'tel:+63853421234');
check('phone with letters not linked', phoneHref('call us now'), null);

console.log('— verification (only a recorded check_date counts)');
const v = (d: string | null) => verificationOf(d, NOW);
check('no date -> Not verified', [v(null).tone, v(null).label], ['none', 'Not verified']);
check('recent day-precision -> ok', [v('2026-08-14').tone, v('2026-08-14').label], ['ok', 'Checked 14 Aug 2026']);
check('month precision', v('2026-03').label, 'Checked Mar 2026');
check('>12 months -> warn', [v('2024-06-01').tone, v('2024-06-01').label], ['warn', 'Last checked 1 Jun 2024']);
check('exactly 12 months still ok', v('2025-10-01').tone, 'ok');
check('future date not trusted', v('2027-01-01').tone, 'none');
check('garbage date not trusted', v('sometime').tone, 'none');
check('formatCheckDate year only', formatCheckDate('2023'), '2023');

console.log('— notes appear only for real gaps');
check('bare café lists the gaps (hours, address, amenities)', uncertaintyNotes(bare).length, 3);
check('hours missing note', uncertaintyNotes(bare).some((n) => /aren’t listed/.test(n)), true);
const good = cafe({ opening_hours: 'Mo-Su 10:00-22:00', 'addr:street': 'A', 'opening_hours:check_date': '2026-09-01', internet_access: 'wlan' });
check('fully-documented café has no notes', uncertaintyNotes(good), []);
check('PH rules flagged', uncertaintyNotes(cafe({ opening_hours: 'Mo-Su 10:00-22:00; PH off' })).some((n) => /Holiday/.test(n)), true);
check('seasonal rules flagged', uncertaintyNotes(cafe({ opening_hours: 'Dec Mo-Su 10:00-22:00; Jan-Nov Mo-Fr 08:00-17:00' })).some((n) => /can’t interpret/.test(n)), true);
check('24/7 label caveat', uncertaintyNotes(cafe({ opening_hours: '24/7' })).some((n) => /24\/7 label/.test(n)), true);
check('mapper note shown verbatim and attributed', uncertaintyNotes(full).some((n) => /Mapper’s note.*Closed during typhoons/.test(n)), true);
check('contact caveat only when contact exists', [uncertaintyNotes(bare).some((n) => /Contact details/.test(n)), uncertaintyNotes(full).some((n) => /Contact details/.test(n))], [false, true]);

process.exit(bad ? 1 : 0);
