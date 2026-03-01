import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Pencil, X, Users, IndianRupee, Percent, TrendingUp, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { CircularProgress } from './CircularProgress';
import { toast } from 'sonner';

function formatFull(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

function formatShort(val: number) {
  if (val >= 100000) return '₹' + (val / 100000).toFixed(1) + 'L';
  if (val >= 1000) return '₹' + (val / 1000).toFixed(1) + 'K';
  return '₹' + val.toLocaleString('en-IN');
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export function HomeDashboard() {
  const {
    state, getVendor, getBillsForMonth, getEarningsForMonth,
    getTotalBillsForMonth, setSelectedMonth, addVendor, updateVendor,
    setActiveTab, logout,
  } = useApp();

  const [year, month] = state.selectedMonth.split('-').map(Number);
  const monthBills = useMemo(() => getBillsForMonth(state.selectedMonth), [getBillsForMonth, state.selectedMonth]);
  const totalEarnings = useMemo(() => getEarningsForMonth(state.selectedMonth), [getEarningsForMonth, state.selectedMonth]);
  const totalBills = useMemo(() => getTotalBillsForMonth(state.selectedMonth), [getTotalBillsForMonth, state.selectedMonth]);
  const activeVendors = useMemo(() => new Set(monthBills.map(b => b.vendorId)).size, [monthBills]);
  const avgCutPercent = useMemo(() => {
    if (totalBills === 0) return 0;
    return (totalEarnings / totalBills) * 100;
  }, [totalEarnings, totalBills]);

  const progress = state.monthlyTarget > 0 ? Math.min((totalEarnings / state.monthlyTarget) * 100, 100) : 0;

  const getMotivation = () => {
    const p = Math.round(progress);
    if (p >= 100) return { text: 'Target Achieved!', emoji: '🎉' };
    if (p >= 75) return { text: `${formatFull(Math.round(state.monthlyTarget - totalEarnings))} to go!`, emoji: '🎯' };
    if (p >= 50) return { text: 'Past halfway!', emoji: '⚡' };
    if (p >= 25) return { text: 'Building momentum!', emoji: '🔥' };
    return { text: 'Keep going!', emoji: '💪' };
  };
  const motivation = getMotivation();

  const [showVendorSheet, setShowVendorSheet] = useState(false);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorCut, setVendorCut] = useState('');

  const openAddVendor = () => { setEditingVendor(null); setVendorName(''); setVendorCut(''); setShowVendorSheet(true); };
  const openEditVendor = (id: string) => {
    const v = state.vendors.find(v => v.id === id);
    if (!v) return;
    setEditingVendor(id); setVendorName(v.name); setVendorCut(String(v.cutPercent)); setShowVendorSheet(true);
  };
  const saveVendor = () => {
    if (!vendorName || !vendorCut) { toast.error('Fill all fields'); return; }
    const cut = parseFloat(vendorCut);
    if (isNaN(cut) || cut <= 0 || cut > 100) { toast.error('Cut % must be between 1 and 100'); return; }
    if (editingVendor) { updateVendor(editingVendor, vendorName, cut); toast.success('Vendor updated'); }
    else { addVendor(vendorName, cut); toast.success('Vendor added'); }
    setShowVendorSheet(false);
  };

  const vendorEarnings = useMemo(() => {
    const map: Record<string, { total: number; cut: number; count: number }> = {};
    monthBills.forEach(b => {
      const v = getVendor(b.vendorId);
      if (!v) return;
      if (!map[b.vendorId]) map[b.vendorId] = { total: 0, cut: 0, count: 0 };
      map[b.vendorId].total += b.amount;
      map[b.vendorId].cut += b.amount * v.cutPercent / 100;
      map[b.vendorId].count++;
    });
    return map;
  }, [monthBills, getVendor]);

  const prevMonth = () => {
    const d = new Date(year, month - 2, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };
  const nextMonth = () => {
    const d = new Date(year, month, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  };

  return (
    <div className="pb-5 px-5 pt-6">
      {/* Month Selector + Exit */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={prevMonth} className="w-9 h-9 rounded-lg flex items-center justify-center active:bg-[#F0EBE3]" style={{ background: '#FFFFFF', border: '1px solid #E8E2D9' }}>
          <ChevronLeft className="w-5 h-5 text-[#6B6560]" />
        </button>
        <h2 className="text-[#1A1816]" style={{ fontSize: 20, fontWeight: 700 }}>
          {MONTHS[month - 1]} {year}
        </h2>
        <div className="flex items-center gap-2">
          <button onClick={nextMonth} className="w-9 h-9 rounded-lg flex items-center justify-center active:bg-[#F0EBE3]" style={{ background: '#FFFFFF', border: '1px solid #E8E2D9' }}>
            <ChevronRight className="w-5 h-5 text-[#6B6560]" />
          </button>
          <button
            onClick={logout}
            className="w-9 h-9 rounded-lg flex items-center justify-center active:bg-[#FBF0EE] transition-colors"
            style={{ background: '#FFFFFF', border: '1px solid #E8E2D9' }}
            title="Exit"
          >
            <LogOut className="w-[18px] h-[18px] text-[#8B8579]" />
          </button>
        </div>
      </div>

      {/* Monthly Target */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-2xl p-5 mb-5 flex flex-col items-center"
        style={{ background: '#FFFFFF', boxShadow: '0 1px 4px rgba(26,24,22,0.05), 0 4px 16px rgba(26,24,22,0.03)' }}
      >
        <div className="flex items-center justify-between w-full mb-3">
          <span className="text-[#1A1816]" style={{ fontSize: 16, fontWeight: 600 }}>Monthly Target</span>
          <button onClick={() => setActiveTab('settings')} className="text-[#D97757]" style={{ fontSize: 14, fontWeight: 600 }}>Edit</button>
        </div>
        <CircularProgress
          progress={progress}
          size={160}
          strokeWidth={11}
          earned={formatFull(Math.round(totalEarnings))}
          target={formatFull(state.monthlyTarget)}
        />
        <div className="flex items-center gap-2 mt-3 px-4 py-1.5 rounded-full" style={{ background: '#F5F0EB' }}>
          <span style={{ fontSize: 15 }}>{motivation.emoji}</span>
          <span className="text-[#6B6560]" style={{ fontSize: 14, fontWeight: 500 }}>{motivation.text}</span>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { icon: IndianRupee, label: 'Total Bills', value: formatShort(totalBills), color: '#D97757', bg: '#FDF5F0', tab: 'bills' },
          { icon: TrendingUp, label: 'Earnings', value: formatShort(Math.round(totalEarnings)), color: '#5C9A6F', bg: '#EEF5F0', tab: 'analytics' },
          { icon: Users, label: 'Vendors', value: String(state.vendors.length), color: '#D4A853', bg: '#FBF5E8', tab: 'settings' },
          { icon: Percent, label: 'Avg Cut', value: avgCutPercent.toFixed(1) + '%', color: '#9B7E6B', bg: '#F5F0EB', tab: 'analytics' },
        ].map((stat, i) => (
          <motion.button
            key={stat.label}
            onClick={() => setActiveTab(stat.tab)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileTap={{ scale: 0.97 }}
            className="rounded-xl p-4 flex items-center gap-3 text-left active:bg-[#FAFAF8]"
            style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: stat.bg }}>
              <stat.icon className="w-[18px] h-[18px]" style={{ color: stat.color }} />
            </div>
            <div>
              <p className="text-[#8B8579]" style={{ fontSize: 13, fontWeight: 500 }}>{stat.label}</p>
              <p className="text-[#1A1816]" style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.01em' }}>{stat.value}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Vendors & Commission */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[#1A1816]" style={{ fontSize: 18, fontWeight: 700 }}>Vendors & Commission</h3>
          <button
            onClick={openAddVendor}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[#D97757] active:opacity-70"
            style={{ fontSize: 14, fontWeight: 600, background: '#FDF5F0' }}
          >
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        <div className="space-y-2.5">
          {state.vendors.map((vendor, i) => {
            const ve = vendorEarnings[vendor.id];
            return (
              <motion.div
                key={vendor.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className="rounded-xl px-4 py-3 flex items-center gap-3"
                style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
              >
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0"
                  style={{ background: vendor.color, fontSize: 14, fontWeight: 700 }}
                >
                  {vendor.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#1A1816] truncate" style={{ fontSize: 15, fontWeight: 600 }}>{vendor.name}</p>
                  <p className="text-[#8B8579]" style={{ fontSize: 13 }}>
                    {ve ? `${ve.count} bills` : 'No bills'}
                    {ve ? ` · ${formatShort(ve.total)}` : ''}
                  </p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full flex-shrink-0"
                  style={{ background: vendor.color + '15', color: vendor.color, fontSize: 13, fontWeight: 700 }}
                >
                  {vendor.cutPercent}%
                </span>
                {ve && (
                  <span className="text-[#5C9A6F] flex-shrink-0" style={{ fontSize: 14, fontWeight: 700 }}>
                    +{formatShort(Math.round(ve.cut))}
                  </span>
                )}
                <button onClick={() => openEditVendor(vendor.id)} className="p-1.5 rounded-md active:bg-[#F5F0EB]">
                  <Pencil className="w-4 h-4 text-[#C4BFB6]" />
                </button>

              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Vendor Add/Edit Bottom Sheet */}
      <AnimatePresence>
        {showVendorSheet && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
              onClick={() => setShowVendorSheet(false)}
            />
            {/* Centering wrapper — separate from animated element so transforms don't conflict */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              style={{
                width: '100%',
                maxWidth: 430,
                borderRadius: '20px 20px 0 0',
                background: '#FFFFFF',
                boxShadow: '0 -4px 20px rgba(26,24,22,0.08)',
                pointerEvents: 'all',
              }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#E8E2D9]" />
              </div>
              <div className="px-6 pb-7">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[#1A1816]" style={{ fontSize: 20, fontWeight: 700 }}>
                    {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
                  </h3>
                  <button onClick={() => setShowVendorSheet(false)} className="p-1.5">
                    <X className="w-5 h-5 text-[#8B8579]" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[#6B6560] mb-1.5 block" style={{ fontSize: 14, fontWeight: 500 }}>Vendor Name</label>
                    <input
                      value={vendorName}
                      onChange={e => setVendorName(e.target.value)}
                      placeholder="e.g. Sharma Traders"
                      className="w-full px-4 py-3.5 rounded-xl text-[#1A1816] outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/10"
                      style={{ fontSize: 16, background: '#F5F0EB', border: '1px solid #E8E2D9' }}
                      inputMode="text"
                    />
                  </div>
                  <div>
                    <label className="text-[#6B6560] mb-1.5 block" style={{ fontSize: 14, fontWeight: 500 }}>Commission Cut (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={vendorCut}
                        onChange={e => setVendorCut(e.target.value)}
                        placeholder="10"
                        className="w-full px-4 py-3.5 rounded-xl text-[#1A1816] outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/10 pr-10"
                        style={{ fontSize: 16, background: '#F5F0EB', border: '1px solid #E8E2D9' }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B8579]" style={{ fontSize: 15 }}>%</span>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={saveVendor}
                  className="w-full mt-6 py-4 rounded-xl text-white"
                  style={{
                    background: 'linear-gradient(135deg, #D97757, #C4613C)',
                    fontSize: 16,
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(217,119,87,0.3)',
                  }}
                >
                  {editingVendor ? 'Update Vendor' : 'Save Vendor'}
                </motion.button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}