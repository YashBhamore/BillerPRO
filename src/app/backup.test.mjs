// Backup parse/merge logic — mirrors store.tsx. Guards the property that
// matters most here: restoring must never delete bills recorded since.
import assert from 'node:assert/strict';

const BACKUP_MARKER = 'BillerPRO';

function parseBackupJSON(text) {
  let raw;
  try { raw = JSON.parse(text); }
  catch { throw new Error('That file is not readable JSON.'); }
  if (!raw || typeof raw !== 'object') throw new Error('That file is not a BillerPRO backup.');
  if (raw._app && raw._app !== BACKUP_MARKER) throw new Error('That backup is from a different app.');
  if (!Array.isArray(raw.bills) || !Array.isArray(raw.vendors)) throw new Error('That file is not a BillerPRO backup.');
  const bills = raw.bills.filter(b => b && typeof b.id === 'string' && typeof b.amount === 'number' && typeof b.date === 'string');
  const vendors = raw.vendors.filter(v => v && typeof v.id === 'string' && typeof v.name === 'string');
  if (bills.length === 0 && vendors.length === 0) throw new Error('That backup is empty.');
  return { user: raw.user, vendors, bills, monthlyTarget: raw.monthlyTarget };
}

function merge(current, data) {
  let added = 0, skipped = 0;
  const billIds = new Set(current.bills.map(b => b.id));
  const newBills = data.bills.filter(b => {
    if (billIds.has(b.id)) { skipped++; return false; }
    added++; return true;
  });
  const vendorIds = new Set(current.vendors.map(v => v.id));
  const newVendors = data.vendors.filter(v => !vendorIds.has(v.id));
  return {
    added, skipped,
    bills: [...newBills, ...current.bills].sort((a, b) => b.date.localeCompare(a.date)),
    vendors: [...current.vendors, ...newVendors],
  };
}

const bill = (id, date) => ({ id, vendorId: 'v1', customerName: 'X', amount: 100, date, confidence: 'high' });
const vendor = { id: 'v1', name: 'F&F Decor', cutPercent: 10, color: '#D97757' };

// Junk files are rejected, never silently applied.
for (const bad of ['not json', '{}', '[]', JSON.stringify({ _app: 'OtherApp', bills: [], vendors: [] }),
                   JSON.stringify({ bills: [], vendors: [] })]) {
  assert.throws(() => parseBackupJSON(bad), /backup|JSON/i, `must reject: ${bad.slice(0, 40)}`);
}

// A real backup parses.
const backup = JSON.stringify({
  _app: 'BillerPRO', _version: 'v3',
  bills: [bill('b1', '2026-09-01'), bill('b2', '2026-09-15')],
  vendors: [vendor], monthlyTarget: 120000,
});
assert.equal(parseBackupJSON(backup).bills.length, 2);

// THE critical property: restoring an OLD backup must not drop newer bills.
const current = { bills: [bill('b1', '2026-09-01'), bill('b9', '2026-09-30')], vendors: [vendor] };
const r = merge(current, parseBackupJSON(backup));
assert.ok(r.bills.some(b => b.id === 'b9'), 'newer bill b9 must survive a restore');
assert.equal(r.bills.filter(b => b.id === 'b1').length, 1, 'no duplicate on re-restore');
assert.equal(r.bills.length, 3);
assert.equal(r.added, 1);
assert.equal(r.skipped, 1);
assert.equal(r.vendors.length, 1, 'vendor must not duplicate');

// Restoring the same file twice changes nothing further (idempotent).
const again = merge({ bills: r.bills, vendors: r.vendors }, parseBackupJSON(backup));
assert.equal(again.added, 0);
assert.equal(again.bills.length, 3);

// Restore into an empty device (the reinstall case) brings everything back.
const fresh = merge({ bills: [], vendors: [] }, parseBackupJSON(backup));
assert.equal(fresh.bills.length, 2);
assert.equal(fresh.vendors.length, 1);

console.log('✓ backup checks pass (rejects junk, merges without loss, idempotent)');
