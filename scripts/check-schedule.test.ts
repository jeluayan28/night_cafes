import { categorize, manilaWallTime, openState, openStatus, specialRows, summarizeHours, unknownSchedule, validateSchedule, weeklyRows } from '../src/lib/model/schedule';
import type { DaySchedule, WeeklySchedule } from '../src/lib/model/schedule-types';
import { scheduleFromOsm } from '../src/lib/model/osm-import';

let bad = 0;
const check = (label: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) bad++;
  console.log(ok ? 'ok  ' : 'FAIL', label.padEnd(62), ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

/** An instant given as Asia/Manila wall-clock (UTC+8): Oct 2026, Mon = 26th. */
const manila = (day: number, h: number, m = 0) => new Date(Date.UTC(2026, 9, day, h - 8, m));
const osm = scheduleFromOsm;
const cat = (s: string | null) => categorize(osm(s));
const state = (s: WeeklySchedule, at: Date) => openState(s, at);

const open = (...r: Array<[string, string]>): DaySchedule => ({ status: 'open', ranges: r.map(([open, close]) => ({ open, close })) });
const CLOSED: DaySchedule = { status: 'closed' };
const UNKNOWN: DaySchedule = { status: 'unknown' };
const week = (over: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', DaySchedule>> = {}, extra: Partial<WeeklySchedule> = {}): WeeklySchedule => ({
  version: 1, timezone: 'Asia/Manila', status: 'known',
  days: { mon: CLOSED, tue: CLOSED, wed: CLOSED, thu: CLOSED, fri: CLOSED, sat: CLOSED, sun: CLOSED, ...over },
  special: [], unmodeled_rules: [], source_text: null, ...extra,
});
const everyDay = (d: DaySchedule) => week({ mon: d, tue: d, wed: d, thu: d, fri: d, sat: d, sun: d });

console.log('— Asia/Manila wall clock (independent of the machine timezone)');
check('2026-10-28 23:30 UTC is already Thu 29th 07:30 in Manila', manilaWallTime(new Date(Date.UTC(2026, 9, 28, 23, 30))), { date: '2026-10-29', weekday: 'thu', minutes: 450 });
check('midnight Manila = 16:00 UTC', manilaWallTime(new Date(Date.UTC(2026, 9, 27, 16, 0))), { date: '2026-10-28', weekday: 'wed', minutes: 0 });
check('year rollover', manilaWallTime(new Date(Date.UTC(2026, 11, 31, 16, 0))).date, '2027-01-01');

console.log('— classification from OSM text (via the structured schedule)');
check('24/7', cat('24/7'), 'always');
check('Mo-Su 00:00-24:00', cat('Mo-Su 00:00-24:00'), 'always');
check('Mo-Sa 00:00-24:00 (Sunday closed)', cat('Mo-Sa 00:00-24:00'), 'late');
check('Mo-Su 00:00-23:59 (one-minute gap)', cat('Mo-Su 00:00-23:59'), 'late');
check('24/7; PH off (holiday clause)', cat('24/7; PH off'), 'late');
check('Mo-Su 00:00-24:00; Dec 25 off (annual closure)', cat('Mo-Su 00:00-24:00; Dec 25 off'), 'late');
check('24/7; Su off', cat('24/7; Su off'), 'late');
check('Jan-Mar 24/7 (seasonal) -> not guessed', cat('Jan-Mar 24/7'), 'unknown');
check('Mo-Su 18:00-02:00 (after midnight)', cat('Mo-Su 18:00-02:00'), 'late');
check('Mo-Su 10:00-23:30', cat('Mo-Su 10:00-23:30'), 'late');
check('Su 22:00-24:00 (runs through 23:00)', cat('Su 22:00-24:00'), 'late');
check('Su 20:00-22:30 only', cat('Su 20:00-22:30'), 'day');
check('Sa 20:00-03:00 (only Saturday night)', cat('Sa 20:00-03:00'), 'late');
check('Mo-Su 10:00-22:00', cat('Mo-Su 10:00-22:00'), 'day');
check('Mo-Fr 08:00-17:00', cat('Mo-Fr 08:00-17:00'), 'day');
check('garbage', cat('not a real tag!!'), 'unknown');
check('missing', cat(null), 'unknown');

console.log('— importer output shape');
check('overnight stored as close < open', osm('Mo-Su 18:00-02:00').days.wed, open(['18:00', '02:00']));
check('24/7 stored as one full-day range per day', osm('24/7').days.sun, open(['00:00', '24:00']));
check('closed days are explicit', osm('Mo-Fr 08:00-17:00').days.sat, CLOSED);
check('split shift', osm('Mo 08:00-12:00,14:00-18:00').days.mon, open(['08:00', '12:00'], ['14:00', '18:00']));
check('Sunday night into Monday morning is one overnight range', [osm('Su 20:00-03:00').days.sun, osm('Su 20:00-03:00').days.mon], [open(['20:00', '03:00']), CLOSED]);
check('source text kept', osm('Mo-Su 10:00-22:00').source_text, 'Mo-Su 10:00-22:00');
check('holiday clause kept aside, not dropped silently', osm('Mo-Su 10:00-22:00; PH off').unmodeled_rules, ['PH off']);
check('Dec 25 off -> recurring special', osm('Mo-Su 10:00-22:00; Dec 25 off').special, [{ recurring: '12-25', day: { status: 'closed' } }]);
check('missing hours -> unknown schedule', [osm(null).status, osm(null).days.mon], ['unknown', UNKNOWN]);
check('unparseable keeps the text as an unmodeled rule', osm('nonsense!!').unmodeled_rules, ['nonsense!!']);

console.log('— open now (calculated, Asia/Manila)');
const night = osm('Mo-Su 18:00-02:00');
check('Wed 17:59 closed', state(night, manila(28, 17, 59)), 'closed');
check('Wed 18:00 open', state(night, manila(28, 18, 0)), 'open');
check('Thu 01:30 open (after midnight)', state(night, manila(29, 1, 30)), 'open');
check('Thu 02:00 closed (closing instant)', state(night, manila(29, 2, 0)), 'closed');
check('Mo 18:00-02:00 at Tue 01:00 open (Monday night)', state(osm('Mo 18:00-02:00'), manila(27, 1)), 'open');
check('Mo 18:00-02:00 at Wed 01:00 closed', state(osm('Mo 18:00-02:00'), manila(28, 1)), 'closed');
check('Su 20:00-03:00 at Mon 01:00 open (week wrap)', state(osm('Su 20:00-03:00'), manila(26, 1)), 'open');
check('24/7 at any time', state(osm('24/7'), manila(25, 3, 33)), 'open');
check('visitor in another timezone: 10:00 UTC Wed = 18:00 Manila', state(night, new Date(Date.UTC(2026, 9, 28, 10, 0))), 'open');
check('"open now" != "24/7"', [state(night, manila(28, 23)), categorize(night)], ['open', 'late']);

console.log('— next change label');
check('closes after midnight names the day', openStatus(night, manila(28, 23)).changeAt, 'Thu 02:00');
check('closes same evening', openStatus(osm('Mo-Su 10:00-22:00'), manila(28, 12)).changeAt, '22:00');
check('opens later today', openStatus(osm('Mo-Su 10:00-22:00'), manila(28, 7)).changeAt, '10:00');
check('opens tomorrow', openStatus(osm('Mo-Su 10:00-22:00'), manila(28, 23)).changeAt, 'Thu 10:00');
check('24/7 never changes', openStatus(osm('24/7'), manila(28, 12)).changeAt, null);
check('contiguous 00:00-24:00 days merge (no phantom midnight close)', openStatus(osm('Mo-Sa 00:00-24:00'), manila(28, 12)).changeAt, 'Sun 00:00');

console.log('— unknown is never closed');
const mixed = week({ mon: open(['08:00', '17:00']), tue: UNKNOWN, wed: open(['08:00', '17:00']) });
check('known day, in hours -> open', state(mixed, manila(26, 10)), 'open');
check('known day, outside hours -> closed', state(mixed, manila(26, 20)), 'closed');
check('unknown day -> unknown (not closed)', state(mixed, manila(27, 10)), 'unknown');
check('unknown schedule -> unknown', state(unknownSchedule(), manila(27, 10)), 'unknown');
check('status for unknown has no change label', openStatus(unknownSchedule(), manila(27, 10)), { isOpen: false, unknown: true, changeAt: null });
check('an unknown day prevents the 24/7 label (still late)', categorize(week({ mon: open(['00:00', '24:00']), tue: UNKNOWN, wed: open(['00:00', '24:00']), thu: open(['00:00', '24:00']), fri: open(['00:00', '24:00']), sat: open(['00:00', '24:00']), sun: open(['00:00', '24:00']) })), 'late');

console.log('— special hours');
const xmas = week({ mon: open(['10:00', '22:00']), tue: open(['10:00', '22:00']), wed: open(['10:00', '22:00']), thu: open(['10:00', '22:00']), fri: open(['10:00', '22:00']), sat: open(['10:00', '22:00']), sun: open(['10:00', '22:00']) }, {
  special: [{ recurring: '12-25', label: 'Christmas', day: CLOSED }, { date: '2026-10-30', label: 'Short day', day: open(['10:00', '14:00']) }],
});
check('recurring closure, 25 Dec 12:00', state(xmas, new Date(Date.UTC(2026, 11, 25, 4, 0))), 'closed');
check('recurring closure applies in other years', state(xmas, new Date(Date.UTC(2031, 11, 25, 4, 0))), 'closed');
check('24 Dec 12:00 normal', state(xmas, new Date(Date.UTC(2026, 11, 24, 4, 0))), 'open');
check('one-off short day 15:00 closed', state(xmas, manila(30, 15)), 'closed');
check('one-off short day 12:00 open', state(xmas, manila(30, 12)), 'open');
check('one-off beats recurring on the same date', state(week({ mon: open(['10:00', '22:00']), tue: open(['10:00', '22:00']), wed: open(['10:00', '22:00']), thu: open(['10:00', '22:00']), fri: open(['10:00', '22:00']), sat: open(['10:00', '22:00']), sun: open(['10:00', '22:00']) }, { special: [{ recurring: '10-30', day: CLOSED }, { date: '2026-10-30', day: open(['09:00', '12:00']) }] }), manila(30, 10)), 'open');
const overnightXmas = week({ thu: open(['18:00', '02:00']) }, { special: [{ date: '2026-10-30', day: CLOSED }] });
check('overnight from Thu finishes into a closed Friday (01:00)', state(overnightXmas, manila(30, 1)), 'open');
check('...but Friday itself stays closed (19:00)', state(overnightXmas, manila(30, 19)), 'closed');
check('special closure makes it not 24/7', categorize({ ...osm('24/7'), special: [{ recurring: '12-25', day: CLOSED }] }), 'late');
check('special full-day open keeps 24/7', categorize({ ...osm('24/7'), special: [{ recurring: '12-25', day: open(['00:00', '24:00']) }] }), 'always');
check('special rows are readable', specialRows(xmas), [{ when: 'Every 25 Dec', label: 'Christmas', lines: ['Closed'] }, { when: '30 Oct 2026', label: 'Short day', lines: ['10:00–14:00'] }]);

console.log('— display');
check('weekly rows (overnight)', weeklyRows(night).map((r) => r.lines.join()), Array(7).fill('18:00–02:00 (+1)'));
check('weekly rows (24/7, closed, unknown)', [weeklyRows(osm('24/7'))[0].lines, weeklyRows(osm('Mo 08:00-17:00'))[1].lines, weeklyRows(unknownSchedule())[0].lines], [['Open 24 hours'], ['Closed'], ['Not confirmed']]);
check('summary: daily', summarizeHours(night), 'Daily 18:00–02:00 (+1)');
check('summary: 24/7', summarizeHours(osm('24/7')), 'Open 24 hours, daily');
check('summary: grouped days', summarizeHours(osm('Mo-Fr 08:00-17:00; Sa 09:00-12:00')), 'Mon–Fri 08:00–17:00 · Sat 09:00–12:00');
check('summary: unknown -> null', summarizeHours(unknownSchedule()), null);

console.log('— validation (also enforced by the database CHECK)');
const errs = (s: unknown) => validateSchedule(s).length;
check('valid schedules pass', [errs(night), errs(osm('24/7')), errs(unknownSchedule()), errs(xmas)], [0, 0, 0, 0]);
check('missing weekday', errs({ ...night, days: { ...night.days, sun: undefined } }) > 0, true);
check('25:00 rejected', errs(week({ mon: open(['10:00', '25:00']) })) > 0, true);
check('24:00 as an open time rejected', errs(week({ mon: open(['24:00', '02:00']) })) > 0, true);
check('open == close rejected', errs(week({ mon: open(['10:00', '10:00']) })) > 0, true);
check('overlapping ranges rejected', errs(week({ mon: open(['08:00', '12:00'], ['11:00', '14:00']) })) > 0, true);
check('touching ranges rejected (must merge)', errs(week({ mon: open(['08:00', '12:00'], ['12:00', '14:00']) })) > 0, true);
check('overnight overlapping next day rejected', errs(week({ mon: open(['18:00', '03:00']), tue: open(['02:00', '10:00']) })) > 0, true);
check('overnight touching next day allowed', errs(week({ mon: open(['18:00', '02:00']), tue: open(['02:00', '10:00']) })), 0);
check('open day without ranges rejected', errs(week({ mon: { status: 'open', ranges: [] } })) > 0, true);
check('closed day with ranges rejected', errs(week({ mon: { status: 'closed', ranges: [] } as never })) > 0, true);
check('unknown schedule with a known day rejected', errs({ ...unknownSchedule(), days: { ...unknownSchedule().days, mon: CLOSED } }) > 0, true);
check('special with both date and recurring rejected', errs(week({}, { special: [{ date: '2026-12-25', recurring: '12-25', day: CLOSED }] })) > 0, true);
check('special with an impossible date rejected', errs(week({}, { special: [{ date: '2026-02-30', day: CLOSED }] })) > 0, true);
check('recurring 02-29 allowed (leap day)', errs(week({}, { special: [{ recurring: '02-29', day: CLOSED }] })), 0);
check('wrong timezone rejected', errs({ ...night, timezone: 'UTC' }) > 0, true);

process.exit(bad ? 1 : 0);
