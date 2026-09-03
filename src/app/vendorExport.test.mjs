// The per-vendor statement is what a vendor gets paid from, so the numbers in
// it have to be right and it must contain nobody else's bills.
//
//   node src/app/vendorExport.test.mjs
import assert from 'node:assert/strict';
import * as XLSX from '../../node_modules/xlsx/xlsx.mjs';

// ── mirrors store.tsx ────────────────────────────────────────────────────────
const localDateStr = (s) => {
  if (typeof s !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const localMonthStr = (s) => localDateStr(s).slice(0, 7);
const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const formatBillDate = (s, { pad = true, year = true } = {}) => {
  const iso = localDateStr(s);
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  const day = pad ? String(d).padStart(2, '0') : String(d);
  const mon = MONTH_ABBR[m - 1] ?? '???';
  return year ? `${day} ${mon} ${y}` : `${day} ${mon}`;
};
const applyNumberFormats = (ws) => {
  Object.keys(ws).forEach(a => { if (!a.startsWith('!') && ws[a] && ws[a].t === 'n') ws[a].z = '#,##0'; });
  return ws;
};
const safeSheetName = (n) => (n.replace(/[:\\/?*[\]]/g, '-').trim().slice(0, 31) || 'Vendor');
const monthLabelFor = (month) => {
  const [yr, mo] = month.split('-');
  return new Date(Number(yr), Number(mo) - 1, 1).toLocaleString('en-IN', { month: 'long', year: 'numeric' });
};

function buildVendorSheet(vendor, bills, monthLabel) {
  const vBills = bills.filter(b => b.vendorId === vendor.id).sort((a, b) => a.date.localeCompare(b.date));
  if (vBills.length === 0) return null;
  const rows = [
    [`${vendor.name} — ${monthLabel || 'Bill Statement'}`],
    [`Commission Rate: ${vendor.cutPercent}%`],
    ['Generated: x'], [],
    ['Date', 'Bill No.', 'Customer Name', 'Bill Amount (₹)', `Commission ${vendor.cutPercent}% (₹)`],
  ];
  vBills.forEach(b => rows.push([formatBillDate(b.date), b.billNumber || '—', b.customerName, b.amount,
    Math.round(b.amount * vendor.cutPercent / 100)]));
  const vTotal = vBills.reduce((s, b) => s + b.amount, 0);
  const vEarn = vBills.reduce((s, b) => s + Math.round(b.amount * vendor.cutPercent / 100), 0);
  rows.push([]); rows.push(['', '', 'TOTAL', vTotal, vEarn]);
  rows.push([]); rows.push(['', '', `Amount to collect from ${vendor.name}:`, '', vEarn]);
  return applyNumberFormats(XLSX.utils.aoa_to_sheet(rows));
}

function buildVendorStatement(bills, vendors, vendorId, month) {
  const vendor = vendors.find(v => v.id === vendorId);
  if (!vendor) return null;
  const label = monthLabelFor(month);
  const monthBills = bills.filter(b => localMonthStr(b.date) === month);
  const ws = buildVendorSheet(vendor, monthBills, label);
  if (!ws) return null;
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(vendor.name));
  const vBills = monthBills.filter(b => b.vendorId === vendor.id);
  const fileName = `${vendor.name.replace(/[^a-zA-Z0-9]+/g, '_')}_${label.replace(/[^a-zA-Z0-9]+/g, '_')}.xlsx`;
  return {
    wb, fileName, vendorName: vendor.name,
    billCount: vBills.length,
    billTotal: vBills.reduce((s, b) => s + b.amount, 0),
    cutTotal: vBills.reduce((s, b) => s + Math.round(b.amount * vendor.cutPercent / 100), 0),
  };
}

// ── fixtures ────────────────────────────────────────────────────────────────
const relax = { id: 'v1', name: 'RELAX', cutPercent: 10, color: '#C45C4A' };
const ff    = { id: 'v2', name: 'F & F / Decor', cutPercent: 12.5, color: '#D97757' };
const vendors = [relax, ff];
const bills = [
  { id: 'b1', vendorId: 'v1', customerName: 'Ramesh', amount: 48000, date: '2026-09-01', billNumber: '5159', confidence: 'high' },
  { id: 'b2', vendorId: 'v1', customerName: 'Suresh', amount: 12500, date: '2026-09-30', billNumber: '5160', confidence: 'high' },
  { id: 'b3', vendorId: 'v2', customerName: 'Mahesh', amount: 20000, date: '2026-09-15', billNumber: '5161', confidence: 'high' },
  { id: 'b4', vendorId: 'v1', customerName: 'OldOne', amount: 99999, date: '2026-08-20', billNumber: '5000', confidence: 'high' },
];

const stmt = buildVendorStatement(bills, vendors, 'v1', '2026-09');
assert.ok(stmt, 'RELAX has September bills');

// Totals must match a hand calculation: 48000 + 12500 = 60500, 10% = 4800 + 1250
assert.equal(stmt.billCount, 2, 'only September bills, and only RELAX');
assert.equal(stmt.billTotal, 60500);
assert.equal(stmt.cutTotal, 6050);

// Read the sheet back the way Excel would.
const rows = XLSX.utils.sheet_to_json(stmt.wb.Sheets[stmt.wb.SheetNames[0]], { header: 1 });
const flat = JSON.stringify(rows);
assert.ok(flat.includes('5159') && flat.includes('5160'), 'both September bills present');
assert.ok(!flat.includes('5161'), 'must NOT contain the other vendor\'s bill');
assert.ok(!flat.includes('5000'), 'must NOT contain a bill from another month');
assert.ok(!flat.includes('Mahesh'), 'no other vendor\'s customer names leak in');
assert.ok(!flat.includes('OldOne'), 'no other month\'s customers leak in');

// The payout line the vendor is actually paid from.
const totalRow = rows.find(r => r && r[2] === 'TOTAL');
assert.deepEqual([totalRow[3], totalRow[4]], [60500, 6050], 'TOTAL row must carry the real figures');
const owed = rows.find(r => r && typeof r[2] === 'string' && r[2].startsWith('Amount to collect'));
assert.equal(owed[4], 6050, 'amount-to-collect must equal the commission total');

// A day-01 bill must not fall out of its own month (the original bug).
// Asserted on the row, not on a month abbreviation — "Sep" vs "Sept" varies
// with the ICU build, so pinning the string makes the test lie about the code.
const firstOfMonth = rows.find(r => r && r[3] === 48000);
assert.ok(firstOfMonth, 'the 1st-of-month bill has a row');
assert.match(String(firstOfMonth[0]), /^01\b/, 'shown as the 1st, not rolled back a day');
assert.match(String(firstOfMonth[0]), /2026/);
assert.equal(firstOfMonth[4], 4800, 'its commission is 10% of 48000');

// Fractional commission rounds per bill, consistently with the dashboard.
const s2 = buildVendorStatement(bills, vendors, 'v2', '2026-09');
assert.equal(s2.cutTotal, Math.round(20000 * 12.5 / 100));
assert.equal(s2.cutTotal, 2500);

// Sheet names: Excel forbids / \ : ? * [ ] and caps at 31 chars.
assert.equal(safeSheetName('F & F / Decor'), 'F & F - Decor');
assert.ok(!/[:\\/?*[\]]/.test(s2.wb.SheetNames[0]), 'sheet name must be Excel-legal');
assert.ok(s2.wb.SheetNames[0].length <= 31);
assert.equal(safeSheetName('a'.repeat(60)).length, 31, 'long names truncated');
assert.equal(safeSheetName('///'), '---', 'illegal chars are replaced, not dropped');
assert.equal(safeSheetName('   '), 'Vendor', 'a blank name still yields a usable sheet name');
assert.equal(safeSheetName(''), 'Vendor');

// Filenames must be safe to hand to a filesystem / share sheet.
assert.match(s2.fileName, /^F_F_Decor_September_2026\.xlsx$/);
assert.ok(!/[/\\]/.test(s2.fileName), 'no path separators in the filename');

// Nothing to send is reported, not silently empty.
assert.equal(buildVendorStatement(bills, vendors, 'v2', '2026-08'), null, 'no bills that month -> null');
assert.equal(buildVendorStatement(bills, vendors, 'nope', '2026-09'), null, 'unknown vendor -> null');

// The workbook is real xlsx bytes, not an empty shell.
const buf = XLSX.write(stmt.wb, { bookType: 'xlsx', type: 'array' });
assert.ok(buf.byteLength > 2000, 'produces a genuine workbook');
const reread = XLSX.read(buf, { type: 'array' });
assert.equal(reread.SheetNames.length, 1, 'one vendor, one sheet — nobody else included');
assert.equal(reread.SheetNames[0], 'RELAX');

// ── portability: the file lands on someone else's phone or PC ───────────────
// Dates must not depend on the device that produced the file. toLocaleDateString
// renders "01 Sept 2026" on one ICU build and "01 Sep 2026" on another, so the
// formatter is hand-rolled and must stay that way.
assert.equal(formatBillDate('2026-09-01'), '01 Sep 2026');
assert.equal(formatBillDate('2026-09-01', { pad: false, year: false }), '1 Sep');
assert.equal(formatBillDate('2026-12-31'), '31 Dec 2026');
assert.equal(formatBillDate('junk'), '—', 'a bad date degrades to a dash, not "Invalid Date"');
assert.ok(!/\d{1,2}\/\d{1,2}\/\d{4}/.test(flat),
  'no bare numeric dates — 05/09/2026 means different days in India and the US');

// Money must stay numeric so totals still add up in whatever app opens it;
// text that merely looks like a number would break every SUM.
const amountCell = stmt.wb.Sheets[stmt.wb.SheetNames[0]].D6;
assert.equal(amountCell.t, 'n', 'amounts are real numbers, not text');
assert.equal(amountCell.z, '#,##0', 'grouped so 60500 reads as 60,500 everywhere');

// Everything in the file must survive a round-trip through a reader, which is
// what Excel / Google Sheets / iOS Numbers / mobile viewers each do.
const rt = XLSX.utils.sheet_to_json(reread.Sheets[reread.SheetNames[0]], { header: 1 });
const rtTotal = rt.find(r => r && r[2] === 'TOTAL');
assert.deepEqual([rtTotal[3], rtTotal[4]], [60500, 6050], 'totals survive a write/read round-trip');
assert.equal(typeof rtTotal[3], 'number', 'still numeric after the round-trip');

// No styling, merged cells or formulas: those are the parts mobile and
// third-party viewers render inconsistently. Plain values only.
const sheet = stmt.wb.Sheets[stmt.wb.SheetNames[0]];
assert.equal(sheet['!merges'], undefined, 'no merged cells');
assert.ok(!Object.keys(sheet).some(a => !a.startsWith('!') && sheet[a].f),
  'no formulas — every figure is a literal value');

console.log('✓ vendor statement checks pass (correct totals, no cross-vendor or cross-month leakage, Excel-legal names, real workbook)');
console.log('✓ portability checks pass (device-independent dates, numeric money, clean round-trip, no merges or formulas)');
