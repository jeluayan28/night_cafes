import { classify, parseHours, openStatus } from '../src/lib/hours';

// Fixed reference: Wednesday 2026-10-28, wall clock in Manila. Oct 26 is a Monday.
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m);
const REF = at(28, 12);
let bad = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(58), ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const cat = (s: string | null) => classify(parseHours(s), REF, s);
const open = (s: string, d: Date) => openStatus(parseHours(s), d)?.isOpen;

console.log('— classification');
check('24/7', cat('24/7'), 'always');
check('Mo-Su 00:00-24:00', cat('Mo-Su 00:00-24:00'), 'always');
check('Mo-Sa 00:00-24:00 (Sunday missing)', cat('Mo-Sa 00:00-24:00'), 'late');
check('Mo-Su 00:00-23:59 (one-minute gap)', cat('Mo-Su 00:00-23:59'), 'late');
check('Mo-Su 00:00-24:00; PH off (holiday closure)', cat('Mo-Su 00:00-24:00; PH off'), 'late');
check('Mo-Su 00:00-24:00; Dec 25 off (annual closure)', cat('Mo-Su 00:00-24:00; Dec 25 off'), 'late');
check('24/7; Su off', cat('24/7; Su off'), 'late');
check('Jan-Mar 24/7 (seasonal only)', cat('Jan-Mar 24/7'), 'day');
check('Mo-Su 18:00-02:00 (after midnight)', cat('Mo-Su 18:00-02:00'), 'late');
check('Mo-Su 10:00-23:30', cat('Mo-Su 10:00-23:30'), 'late');
check('Su 22:00-24:00 (runs through 23:00)', cat('Su 22:00-24:00'), 'late');
check('Su 20:00-22:30 only', cat('Su 20:00-22:30'), 'day');
check('Sa 20:00-03:00 (only Saturday night)', cat('Sa 20:00-03:00'), 'late');
check('Mo-Su 10:00-22:00', cat('Mo-Su 10:00-22:00'), 'day');
check('Mo-Fr 08:00-17:00', cat('Mo-Fr 08:00-17:00'), 'day');
check('garbage', cat('not a real tag!!'), 'unknown');
check('missing', cat(null), 'unknown');

console.log('— open now (Asia/Manila wall clock, overnight hours)');
const night = 'Mo-Su 18:00-02:00';
check('18:00-02:00 at Wed 17:59', open(night, at(28, 17, 59)), false);
check('18:00-02:00 at Wed 18:00', open(night, at(28, 18, 0)), true);
check('18:00-02:00 at Thu 01:30 (after midnight)', open(night, at(29, 1, 30)), true);
check('18:00-02:00 at Thu 02:00 (closing instant)', open(night, at(29, 2, 0)), false);
check('18:00-02:00 at Thu 03:00', open(night, at(29, 3, 0)), false);
check('Mo 18:00-02:00 at Tue 01:00 (Monday night)', open('Mo 18:00-02:00', at(27, 1)), true);
check('Mo 18:00-02:00 at Wed 01:00 (Tuesday night)', open('Mo 18:00-02:00', at(28, 1)), false);
check('Su 20:00-03:00 at Mon 01:00 (week wrap)', open('Su 20:00-03:00', at(26, 1)), true);
check('24/7 open at Sun 03:33', open('24/7', at(25, 3, 33)), true);
check('closing label names the next day after midnight', openStatus(parseHours(night), at(28, 23))?.changeAt, 'Thu 02:00');
check('"open now" is not "24/7" (18:00-02:00 at 23:00)', [open(night, at(28, 23)), cat(night)], [true, 'late']);

process.exit(bad ? 1 : 0);
