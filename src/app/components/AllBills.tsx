import React, { useState, useMemo } from 'react';
import { Search, X, Trash2, Pencil, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

function extractBillNoFromNotes(notes?: string): string {
  if (!notes) return '';
  const match = notes.match(/Bill\s*#\s*([A-Za-z0-9][A-Za-z0-9/_\-.]*)/i);
  return match?.[1]?.trim() || '';
}

function getBillNumber(bill: any): string {
  const direct = typeof bill.billNumber === 'string' ? bill.billNumber.trim() : '';
  if (direct) return direct;
  return extractBillNoFromNotes(bill.notes);
}

export function AllBills() {
  const { state, getVendor, deleteBill, setActiveTab } = useApp();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<string | null>(null);
  const [selectedBill, setSelectedBill] = useState<string | null>(null);

  const filteredBills = useMemo(() => {
    let bills = [...state.bills];
    if (selectedVendor) bills = bills.filter(b => b.vendorId === selectedVendor);
    if (search) {
      const q = search.toLowerCase();
      bills = bills.filter(b => {
        const v = getVendor(b.vendorId);
        const billNo = getBillNumber(b).toLowerCase();
        return (
          b.customerName.toLowerCase().includes(q) ||
          v?.name.toLowerCase().includes(q) ||
          b.amount.toString().includes(q) ||
          billNo.includes(q)
        );
      });
    }
    return bills.sort((a, b) => b.date.localeCompare(a.date));
  }, [state.bills, selectedVendor, search, getVendor]);

  const grouped = useMemo(() => {
    const map: Record<string, typeof filteredBills> = {};
    filteredBills.forEach(b => {
      const key = b.date.substring(0, 7);
      if (!map[key]) map[key] = [];
      map[key].push(b);
    });
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [filteredBills]);

  const bill = selectedBill ? state.bills.find(b => b.id === selectedBill) : null;
  const billVendor = bill ? getVendor(bill.vendorId) : null;
  const billNo = bill ? getBillNumber(bill) : '';

  return (
    <div className="min-h-full px-5 pt-6 pb-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-[var(--text-primary)]" style={{ fontSize: 22, fontWeight: 700 }}>All Bills</h2>
          <p className="text-[var(--text-muted)]" style={{ fontSize: 14 }}>{filteredBills.length} bills found</p>
        </div>
        <button
          onClick={() => setSearchOpen(!searchOpen)}
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-all hover:bg-[var(--bg-secondary)]"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
        >
          {searchOpen ? <X className="w-5 h-5 text-[var(--text-secondary)]" /> : <Search className="w-5 h-5 text-[var(--text-secondary)]" />}
        </button>
      </div>

      {searchOpen && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-4">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by vendor, customer, amount..."
            className="w-full px-4 py-3.5 rounded-xl text-[var(--text-primary)] outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/10 transition-all"
            style={{ fontSize: 16, background: 'var(--bg-card)', border: '1px solid var(--border)' }}
            autoFocus
          />
        </motion.div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-4 mb-2" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => setSelectedVendor(null)}
          className="px-4 py-2 rounded-lg flex-shrink-0 whitespace-nowrap transition-all"
          style={{
            fontSize: 14, fontWeight: 600,
            background: !selectedVendor ? 'var(--text-primary)' : 'var(--bg-card)',
            color: !selectedVendor ? 'var(--bg-card)' : 'var(--text-secondary)',
            border: !selectedVendor ? 'none' : '1px solid var(--border)',
          }}
        >
          All ({state.bills.length})
        </button>
        {state.vendors.map(v => (
          <button
            key={v.id}
            onClick={() => setSelectedVendor(selectedVendor === v.id ? null : v.id)}
            className="px-4 py-2 rounded-lg flex-shrink-0 whitespace-nowrap transition-all"
            style={{
              fontSize: 14, fontWeight: 600,
              background: selectedVendor === v.id ? v.color : 'var(--bg-card)',
              color: selectedVendor === v.id ? 'var(--bg-card)' : 'var(--text-secondary)',
              border: selectedVendor === v.id ? 'none' : '1px solid var(--border)',
            }}
          >
            {v.name}
          </button>
        ))}
      </div>

      {/* Bills List */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'var(--bg-secondary)' }}>
            <Receipt className="w-8 h-8 text-[#C4BFB6]" />
          </div>
          <p className="text-[var(--text-primary)] mb-1" style={{ fontSize: 18, fontWeight: 600 }}>No bills found</p>
          <p className="text-[var(--text-muted)] mb-5" style={{ fontSize: 15 }}>Upload your first bill to get started</p>
          <button
            onClick={() => setActiveTab('upload')}
            className="px-6 py-3 rounded-xl text-white"
            style={{ background: 'linear-gradient(135deg, #D97757, #C4613C)', fontSize: 16, fontWeight: 600 }}
          >
            Upload Bill
          </button>
        </div>
      ) : (
        grouped.map(([monthKey, bills]) => {
          const [y, m] = monthKey.split('-');
          const monthName = new Date(parseInt(y), parseInt(m) - 1).toLocaleString('en', { month: 'long', year: 'numeric' });
          const monthTotal = bills.reduce((s, b) => s + b.amount, 0);
          return (
            <div key={monthKey} className="mb-5">
              <div className="flex items-center justify-between mb-2.5">
                <p className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 700 }}>{monthName}</p>
                <p className="text-[var(--text-muted)]" style={{ fontSize: 14 }}>
                  {bills.length} bills · {formatCurrency(monthTotal)}
                </p>
              </div>
              <div className="space-y-2.5">
                {bills.map((b, idx) => {
                  const vendor = getVendor(b.vendorId);
                  const cut = vendor ? b.amount * vendor.cutPercent / 100 : 0;
                  const billNo = getBillNumber(b);
                  return (
                    <motion.div
                      key={b.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      onClick={() => setSelectedBill(b.id)}
                      className="rounded-xl px-4 py-3.5 cursor-pointer transition-all hover:shadow-md"
                      style={{
                        background: 'var(--bg-card)',
                        boxShadow: '0 1px 3px rgba(26,24,22,0.05)',
                        borderLeft: `3px solid ${vendor?.color || 'var(--border)'}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 600 }}>{vendor?.name}</span>
                        <span className="text-[var(--text-muted)]" style={{ fontSize: 13 }}>
                          {new Date(b.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[var(--text-muted)]" style={{ fontSize: 14 }}>{b.customerName}</span>
                          {billNo && (
                            <span className="block" style={{ fontSize: 11, color: '#ADA79F', marginTop: 1 }}>
                              Bill #{billNo}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[var(--text-primary)]" style={{ fontSize: 17, fontWeight: 700 }}>{formatCurrency(b.amount)}</span>
                          <span className="text-[#5C9A6F]" style={{ fontSize: 14, fontWeight: 600 }}>+{formatCurrency(Math.round(cut))}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}

      {/* Bill Detail Sheet */}
      <AnimatePresence>
        {bill && billVendor && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              onClick={() => setSelectedBill(null)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-50 max-h-[75vh] overflow-y-auto"
              style={{ background: 'var(--bg-card)', boxShadow: '0 -8px 30px rgba(26,24,22,0.1)' }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
              </div>
              <div className="px-6 pb-8">
                <h3 className="text-[var(--text-primary)] mb-5" style={{ fontSize: 22, fontWeight: 700 }}>Bill Details</h3>

                <div className="space-y-3 mb-5">
                  {[
                    { label: 'Date', value: new Date(bill.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
                    ...(billNo ? [{ label: 'Bill No.', value: `#${billNo}` }] : []),
                    { label: 'Vendor', value: billVendor.name },
                    { label: 'Customer', value: bill.customerName },
                    { label: 'Amount', value: formatCurrency(bill.amount) },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                      <span className="text-[var(--text-muted)]" style={{ fontSize: 15 }}>{row.label}</span>
                      <span className="text-[var(--text-primary)]" style={{ fontSize: 16, fontWeight: 600 }}>{row.value}</span>
                    </div>
                  ))}
                </div>

                <div className="rounded-xl p-4 mb-5" style={{ background: '#EEF5F0', border: '1px solid rgba(92,154,111,0.15)' }}>
                  <p className="text-[#5C9A6F]" style={{ fontSize: 18, fontWeight: 700 }}>
                    Your Earning: {formatCurrency(Math.round(bill.amount * billVendor.cutPercent / 100))}
                  </p>
                </div>

                <div className="flex gap-3">
                  <button
                    className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 text-[var(--text-secondary)] transition-all hover:bg-[var(--bg-muted)]"
                    style={{ fontSize: 16, fontWeight: 500, background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}
                  >
                    <Pencil className="w-4 h-4" /> Edit
                  </button>
                  <button
                    onClick={() => { deleteBill(bill.id); setSelectedBill(null); }}
                    className="flex-1 py-3.5 rounded-xl flex items-center justify-center gap-2 text-[#C45C4A] transition-all hover:bg-[#FBE9E5]"
                    style={{ fontSize: 16, fontWeight: 500, background: '#FBF0EE', border: '1px solid rgba(196,92,74,0.1)' }}
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
