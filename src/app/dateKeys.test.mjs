// Self-check for the date-key helpers. No framework — run it directly:
//   node src/app/dateKeys.test.mjs
//   TZ=America/Chicago node src/app/dateKeys.test.mjs
// Must pass in BOTH a negative-UTC and a positive-UTC timezone.
import assert from 'node:assert/strict';

// Kept in sync with store.tsx by hand (that file is TSX, not importable here).
function localDateStr(dateStr) {
  if (typeof dateStr !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const localMonthStr = (s) => localDateStr(s).slice(0, 7);

// The regression: day-01 bills vanished from their own month in any timezone
// behind UTC, because new Date("2026-06-01") is UTC midnight = 31 May locally.
for (const day of ['01', '02', '15', '28', '30']) {
  assert.equal(localMonthStr(`2026-06-${day}`), '2026-06', `2026-06-${day} must file under June`);
}
assert.equal(localDateStr('2026-06-01'), '2026-06-01', 'ISO date must survive untouched');

// Junk must not produce a "NaN-NaN" bucket that silently swallows bills.
for (const junk of ['', 'N/A', 'not a date', null, undefined, 123]) {
  assert.equal(localMonthStr(junk), '', `${JSON.stringify(junk)} must yield empty, not NaN`);
}
assert.notEqual(localMonthStr('bogus'), 'NaN-NaN');

// A real month key must never match the empty key.
assert.notEqual(localMonthStr(''), localMonthStr('2026-06-01'));

console.log(`✓ date key checks pass (TZ=${process.env.TZ || 'system'})`);
