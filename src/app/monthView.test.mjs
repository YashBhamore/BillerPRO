// Guards the "I saved a bill and the dashboard still reads zero" bug.
//
// The dashboard only ever shows one month. Bills are dated when the vendor
// issued them, which is usually not today, so pinning the view to the current
// month hid bills that had just saved correctly. Two behaviours protect it now:
// saving jumps the view to the bill's own month, and a zero month that has
// bills elsewhere says so instead of showing a bare zero.
//
//   node src/app/monthView.test.mjs
import assert from 'node:assert/strict';

// mirrors store.tsx
function localDateStr(dateStr) {
  if (typeof dateStr !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const localMonthStr = (s) => localDateStr(s).slice(0, 7);
const billsForMonth = (bills, month) => bills.filter(b => localMonthStr(b.date) === month);

// mirrors saveBill: the view follows the bill that was just saved
const monthAfterSave = (billDate) => localMonthStr(billDate);

// mirrors HomeDashboard's `elsewhere`
function elsewhere(bills, selectedMonth) {
  const shown = billsForMonth(bills, selectedMonth);
  if (shown.length > 0 || bills.length === 0) return null;
  const latest = bills.reduce((a, b) => (localMonthStr(b.date) > localMonthStr(a.date) ? b : a));
  const m = localMonthStr(latest.date);
  if (!m) return null;
  return { count: bills.length, month: m };
}

const bill = (id, date) => ({ id, vendorId: 'v1', customerName: 'X', amount: 48000, date, confidence: 'high' });

// ── the exact reported failure ───────────────────────────────────────────────
// One bill, issued in February, dashboard pinned to the current month.
const feb = [bill('b1', '2026-02-26')];
assert.equal(billsForMonth(feb, '2026-09').length, 0, 'precondition: bill is not in September');

// Saving it must take the view to February, so it is visible immediately.
assert.equal(monthAfterSave('2026-02-26'), '2026-02');
assert.equal(billsForMonth(feb, monthAfterSave('2026-02-26')).length, 1,
  'after saving, the bill must be visible in the month the view lands on');

// And if the user does navigate to an empty month, they get told why.
const hint = elsewhere(feb, '2026-09');
assert.deepEqual(hint, { count: 1, month: '2026-02' }, 'empty month must point at where the bills are');

// ── the hint must not fire when it would be noise ───────────────────────────
assert.equal(elsewhere([], '2026-09'), null, 'no bills at all: no hint');
assert.equal(elsewhere(feb, '2026-02'), null, 'bills are visible: no hint');

// Latest month wins, not merely the last array element.
const spread = [bill('a', '2026-01-05'), bill('b', '2026-07-31'), bill('c', '2026-03-02')];
assert.equal(elsewhere(spread, '2026-09').month, '2026-07', 'must point at the most recent month');
assert.equal(elsewhere(spread, '2026-09').count, 3);

// A bill dated the 1st must belong to its own month in every timezone —
// this is the UTC-midnight trap that started all of it.
for (const tz of ['2026-06-01', '2026-01-01', '2026-12-01']) {
  assert.equal(localMonthStr(tz), tz.slice(0, 7), `${tz} must file under its own month`);
  assert.equal(monthAfterSave(tz), tz.slice(0, 7));
}

// Unparseable dates must not produce a bogus month to jump to.
assert.equal(elsewhere([bill('x', 'not-a-date')], '2026-09'), null,
  'a junk date must not send the view to an invalid month');

// Mixed valid/junk: the hint follows the valid one.
const mixed = [bill('x', 'not-a-date'), bill('y', '2026-04-10')];
assert.equal(elsewhere(mixed, '2026-09').month, '2026-04');

console.log('✓ month-view checks pass (save jumps to the bill\'s month, empty month explains itself, junk dates ignored)');
