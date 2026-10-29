import { classify, parseHours, openStatus } from '../src/lib/hours';

const cases: Array<[string | null, string]> = [
  ['24/7', 'always'],
  ['Mo-Su 00:00-24:00', 'always'],
  ['Mo-Su 18:00-02:00', 'late'],
  ['Mo-Su 10:00-23:30', 'late'],
  ['Mo-Su 10:00-22:00', 'day'],
  ['Mo-Fr 08:00-17:00', 'day'],
  ['not a real tag!!', 'unknown'],
  [null, 'unknown'],
];
let bad = 0;
for (const [input, want] of cases) {
  const got = classify(parseHours(input));
  if (got !== want) bad++;
  console.log(got === want ? 'ok  ' : 'FAIL', JSON.stringify(input), '->', got);
}
console.log('status 24/7:', openStatus(parseHours('24/7')));
process.exit(bad ? 1 : 0);
