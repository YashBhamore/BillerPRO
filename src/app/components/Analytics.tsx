import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { motion, AnimatePresence } from 'motion/react';
import { TrendingUp, Trophy, Calendar, Receipt, Filter, X } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

const periods = ['This Month', '3 Months', '6 Months', 'Year'];

export function Analytics() {
  const { state, getVendor } = useApp();
  const [period, setPeriod] = useState('6 Months');

  // ── Filter state ─────────────────────────────────────────────────────────
  const [showFilter, setShowFilter] = useState(false);
  const [filterVendor, setFilterVendor] = useState('all');
  const [filterRange, setFilterRange] = useState<'month'|'today'|'yesterday'|'week'|'custom'>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [filtersActive, setFiltersActive] = useState(false);

  // ── Date range computed inside useMemo so it always uses fresh state ───────
  // Bug fix: getRangeDates was a plain function — rangeFrom/rangeTo could be
  // stale inside filteredBills useMemo. Now everything is in one memo.
  const { filteredBills, rangeFrom, rangeTo } = useMemo(() => {
    const t = new Date();
    // Use local date parts to avoid UTC offset shifting the date
    const localFmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const today = localFmt(t);
    const yest  = localFmt(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 1));
    const week  = localFmt(new Date(t.getFullYear(), t.getMonth(), t.getDate() - 6));
    const month = localFmt(new Date(t.getFullYear(), t.getMonth(), 1));

    const ranges: Record<string, {from:string; to:string}> = {
      today:     { from: today, to: today },
      yesterday: { from: yest, to: yest },
      week:      { from: week, to: today },
      month:     { from: month, to: today },
      custom:    { from: customFrom, to: customTo },
    };
    const { from, to } = ranges[filterRange] || ranges.month;

    let bills: typeof state.bills;
    if (!filtersActive) {
      bills = state.bills.filter(b => b.date.startsWith(state.selectedMonth));
    } else {
      bills = state.bills.filter(b => {
        // Normalise stored date to local YYYY-MM-DD for safe comparison
        const bDate = b.date.slice(0, 10);
        const inRange  = bDate >= from && bDate <= to;
        const inVendor = filterVendor === 'all' || b.vendorId === filterVendor;
        return inRange && inVendor;
      });
    }
    return { filteredBills: bills, rangeFrom: from, rangeTo: to };
  }, [state.bills, state.selectedMonth, filtersActive, filterRange, customFrom, customTo, filterVendor]);

  const monthlyData = useMemo(() => {
    const now = new Date();
    const count = period === 'This Month' ? 1 : period === '3 Months' ? 3 : period === 'Year' ? 12 : 6;
    const months: { month: string; totalBills: number; earnings: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const monthBills = state.bills.filter(b => b.date.startsWith(key));
      const totalBills = monthBills.reduce((s, b) => s + b.amount, 0);
      const earnings = monthBills.reduce((s, b) => {
        const v = state.vendors.find(v => v.id === b.vendorId);
        return s + (v ? b.amount * v.cutPercent / 100 : 0);
      }, 0);
      months.push({ month: d.toLocaleString('en', { month: 'short' }), totalBills: Math.round(totalBills), earnings: Math.round(earnings) });
    }
    return months;
  }, [state.bills, state.vendors, period]);

  const vendorPieData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredBills.forEach(b => {
      const v = getVendor(b.vendorId);
      if (!v) return;
      map[b.vendorId] = (map[b.vendorId] || 0) + b.amount * v.cutPercent / 100;
    });
    return Object.entries(map).map(([vid, amount]) => {
      const v = getVendor(vid);
      return { name: v?.name || '', value: Math.round(amount), color: v?.color || '#ccc' };
    });
  }, [filteredBills, getVendor]);

  const totalPieEarnings = vendorPieData.reduce((s, d) => s + d.value, 0);

  const vendorComparison = useMemo(() => {
    const map: Record<string, { total: number; cut: number }> = {};
    filteredBills.forEach(b => {
      const v = getVendor(b.vendorId);
      if (!v) return;
      if (!map[b.vendorId]) map[b.vendorId] = { total: 0, cut: 0 };
      map[b.vendorId].total += b.amount;
      map[b.vendorId].cut += b.amount * v.cutPercent / 100;
    });
    return Object.entries(map).map(([vid, data]) => {
      const v = getVendor(vid);
      return { name: v?.name || '', total: Math.round(data.total), cut: Math.round(data.cut), color: v?.color || '#ccc', cutPercent: v?.cutPercent || 0 };
    }).sort((a, b) => b.total - a.total);
  }, [filteredBills, getVendor]);

  const dailyTrend = useMemo(() => {
    const days: Record<number, number> = {};
    filteredBills.forEach(b => {
      const day = parseInt(b.date.split('-')[2]);
      days[day] = (days[day] || 0) + b.amount;
    });
    return Array.from({ length: 28 }, (_, i) => ({ day: i + 1, amount: days[i + 1] || 0 }));
  }, [filteredBills]);

  const stats = useMemo(() => {
    const monthEarnings: Record<string, number> = {};
    state.bills.forEach(b => {
      const key = b.date.substring(0, 7);
      const v = getVendor(b.vendorId);
      if (!v) return;
      monthEarnings[key] = (monthEarnings[key] || 0) + b.amount * v.cutPercent / 100;
    });
    const bestMonth = Object.entries(monthEarnings).sort((a, b) => b[1] - a[1])[0];
    const vendorTotals: Record<string, number> = {};
    state.bills.forEach(b => {
      const v = getVendor(b.vendorId);
      if (!v) return;
      vendorTotals[b.vendorId] = (vendorTotals[b.vendorId] || 0) + b.amount * v.cutPercent / 100;
    });
    const topVendor = Object.entries(vendorTotals).sort((a, b) => b[1] - a[1])[0];
    const avgMonthly = Object.values(monthEarnings).length > 0
      ? Object.values(monthEarnings).reduce((a, b) => a + b, 0) / Object.values(monthEarnings).length : 0;
    return {
      topVendor: topVendor ? getVendor(topVendor[0])?.name || '' : '-',
      bestMonth: bestMonth ? `${new Date(bestMonth[0] + '-01').toLocaleString('en', { month: 'short', year: 'numeric' })}` : '-',
      bestMonthAmt: bestMonth ? formatCurrency(Math.round(bestMonth[1])) : '-',
      totalBills: state.bills.length,
      avgMonthly: formatCurrency(Math.round(avgMonthly)),
    };
  }, [state.bills, getVendor]);

  const customTooltipStyle = {
    backgroundColor: 'var(--text-primary, #1A1816)',
    border: 'none',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'white',
    fontFamily: "'Times New Roman', Times, Georgia, serif",
  };

  return (
    <div className="min-h-full px-5 pt-6 pb-5">
      {/* Header with filter button */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div>
          <h2 className="text-[var(--text-primary,#1A1816)]" style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Analytics</h2>
          <p className="text-[var(--text-muted,#8B8579)]" style={{ fontSize: 14, margin: '2px 0 0' }}>Your business performance</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {filtersActive && (
            <button onClick={() => { setFiltersActive(false); setFilterVendor('all'); setFilterRange('month'); }}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#C45C4A', background: '#FBF0EE', padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
              <X style={{ width: 11, height: 11 }} /> Clear
            </button>
          )}
          <button onClick={() => setShowFilter(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 10, border: 'none', cursor: 'pointer', background: filtersActive ? '#FDF5F0' : 'var(--bg-secondary, #F5F0EB)', color: filtersActive ? '#D97757' : 'var(--text-secondary, #6B6560)' }}>
            <Filter style={{ width: 14, height: 14 }} /> Filter{filtersActive ? ' ●' : ''}
          </button>
        </div>
      </div>

      {/* Active filter summary pill */}
      {filtersActive && (
        <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: '8px 12px', borderRadius: 10, background: '#FDF5F0', border: '1px solid rgba(217,119,87,0.2)', marginBottom: 12 }}>
          <p style={{ fontSize: 12, color: '#D97757', fontWeight: 600, margin: 0 }}>
            🔍 {filterVendor === 'all' ? 'All Vendors' : (state.vendors.find(v => v.id === filterVendor)?.name || '')}
            {' · '}
            {(() => {
              const fmtPill = (iso: string) => {
                if (!iso) return '?';
                const [y,m,d] = iso.split('-').map(Number);
                return new Date(y,m-1,d).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
              };
              const labels: Record<string,string> = {
                today: 'Today', yesterday: 'Yesterday',
                week: 'Last 7 Days', month: 'This Month',
                custom: customFrom === customTo
                  ? fmtPill(customFrom)
                  : `${fmtPill(customFrom)} → ${fmtPill(customTo)}`,
              };
              return labels[filterRange] || filterRange;
            })()}
          </p>
          <p style={{ fontSize: 11, color: '#ADA79F', margin: '2px 0 0' }}>
            {filteredBills.length} bills · ₹{filteredBills.reduce((s,b)=>s+b.amount,0).toLocaleString('en-IN')} total
          </p>
        </motion.div>
      )}

      <div className="flex gap-2 overflow-x-auto mb-5" style={{ scrollbarWidth: 'none' }}>
        {periods.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-4 py-2.5 rounded-lg flex-shrink-0 whitespace-nowrap transition-all"
            style={{
              fontSize: 14, fontWeight: 600,
              background: period === p ? 'var(--text-primary, #1A1816)' : 'var(--bg-card, #FFFFFF)',
              color: period === p ? 'var(--bg-card, #FFFFFF)' : 'var(--text-secondary, #6B6560)',
              border: period === p ? 'none' : '1px solid var(--border, #E8E2D9)',
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        {[
          { icon: Trophy, label: 'Top Vendor', value: stats.topVendor, color: '#D4A853', bg: '#FBF5E8' },
          { icon: Calendar, label: 'Best Month', value: stats.bestMonth, sub: stats.bestMonthAmt, color: '#5C9A6F', bg: '#EEF5F0' },
          { icon: Receipt, label: 'Total Bills', value: String(stats.totalBills), color: '#D97757', bg: '#FDF5F0' },
          { icon: TrendingUp, label: 'Avg Monthly', value: stats.avgMonthly, color: '#9B7E6B', bg: 'var(--bg-secondary, #F5F0EB)' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl p-4"
            style={{ background: 'var(--bg-card, #FFFFFF)', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2.5" style={{ background: s.bg }}>
              <s.icon className="w-[18px] h-[18px]" style={{ color: s.color }} />
            </div>
            <p className="text-[var(--text-muted,#8B8579)] mb-0.5" style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</p>
            <p className="text-[var(--text-primary,#1A1816)] truncate" style={{ fontSize: 17, fontWeight: 700 }}>{s.value}</p>
            {s.sub && <p className="text-[var(--text-muted,#8B8579)]" style={{ fontSize: 13 }}>{s.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Monthly Earnings Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-4"
        style={{ background: 'var(--bg-card, #FFFFFF)', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
      >
        <h3 className="text-[var(--text-primary,#1A1816)] mb-4" style={{ fontSize: 18, fontWeight: 700 }}>Monthly Overview</h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} barGap={2}>
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted, #8B8579)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#C4BFB6' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
            <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
            <Bar dataKey="totalBills" name="Total Bills" fill="#D97757" radius={[4, 4, 0, 0]} />
            <Bar dataKey="earnings" name="Earnings" fill="#5C9A6F" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* Donut + Vendor Comparison */}
      <div className="space-y-4 mb-4">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card, #FFFFFF)', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
        >
          <h3 className="text-[var(--text-primary,#1A1816)] mb-4" style={{ fontSize: 18, fontWeight: 700 }}>Earnings by Vendor</h3>
          <div className="flex items-center gap-4">
            <div className="relative">
              <PieChart width={130} height={130}>
                <Pie data={vendorPieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                  {vendorPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-[#C4BFB6]" style={{ fontSize: 10 }}>Total</p>
                  <p className="text-[var(--text-primary,#1A1816)]" style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(totalPieEarnings)}</p>
                </div>
              </div>
            </div>
            <div className="flex-1 space-y-2.5">
              {vendorPieData.map(d => (
                <div key={d.name} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span className="text-[var(--text-secondary,#6B6560)] truncate flex-1" style={{ fontSize: 13 }}>{d.name}</span>
                  <span className="text-[var(--text-primary,#1A1816)] flex-shrink-0" style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(d.value)}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl p-5"
          style={{ background: 'var(--bg-card, #FFFFFF)', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
        >
          <h3 className="text-[var(--text-primary,#1A1816)] mb-4" style={{ fontSize: 18, fontWeight: 700 }}>Vendor Comparison</h3>
          <div className="space-y-3.5">
            {vendorComparison.map(vc => {
              const max = vendorComparison[0]?.total || 1;
              return (
                <div key={vc.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[var(--text-secondary,#6B6560)] truncate" style={{ fontSize: 14, fontWeight: 500 }}>{vc.name}</span>
                    <span className="text-[var(--text-muted,#8B8579)] flex-shrink-0" style={{ fontSize: 13 }}>{formatCurrency(vc.total)}</span>
                  </div>
                  <div className="h-3 rounded-full overflow-hidden" style={{ background: 'var(--bg-muted, #F0EBE3)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(vc.total / max) * 100}%` }}
                      transition={{ duration: 0.8 }}
                      className="h-full rounded-full"
                      style={{ background: vc.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* Area Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-5"
        style={{ background: 'var(--bg-card, #FFFFFF)', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
      >
        <h3 className="text-[var(--text-primary,#1A1816)] mb-4" style={{ fontSize: 18, fontWeight: 700 }}>Daily Trend</h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={dailyTrend}>
            <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#C4BFB6' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#C4BFB6' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97757" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#D97757" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="amount" stroke="#D97757" fill="url(#grad)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ── FILTER BOTTOM SHEET ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showFilter && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowFilter(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,22,0.4)', zIndex: 100 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{ width: '100%', maxWidth: 430, borderRadius: '22px 22px 0 0', background: 'var(--bg-card, #FFFFFF)', boxShadow: '0 -8px 30px rgba(26,24,22,0.12)', padding: '20px 24px', paddingBottom: 'max(32px, calc(32px + env(safe-area-inset-bottom)))', pointerEvents: 'all', maxHeight: '85vh', overflowY: 'auto' }}>

                <div style={{ width: 40, height: 4, borderRadius: 9999, background: 'var(--border, #E8E2D9)', margin: '0 auto 18px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 19, fontWeight: 700, color: 'var(--text-primary, #1A1816)', margin: 0 }}>Filter Analytics</h3>
                  <button onClick={() => setShowFilter(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X style={{ width: 19, height: 19, color: 'var(--text-muted, #8B8579)' }} />
                  </button>
                </div>

                {/* Vendor */}
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #8B8579)', letterSpacing: '0.06em', margin: '0 0 10px' }}>VENDOR</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 22 }}>
                  {[{ id: 'all', name: 'All Vendors' }, ...state.vendors].map(v => (
                    <button key={v.id} onClick={() => setFilterVendor(v.id)}
                      style={{ padding: '7px 14px', borderRadius: 99, fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer', background: filterVendor === v.id ? '#D97757' : 'var(--bg-secondary, #F5F0EB)', color: filterVendor === v.id ? '#fff' : 'var(--text-secondary, #6B6560)' }}>
                      {v.name}
                    </button>
                  ))}
                </div>

                {/* Date range */}
                <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted, #8B8579)', letterSpacing: '0.06em', margin: '0 0 10px' }}>DATE RANGE</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {([
                    { key: 'today', label: 'Today' },
                    { key: 'yesterday', label: 'Yesterday' },
                    { key: 'week', label: 'Last 7 Days' },
                    { key: 'month', label: 'This Month' },
                  ] as const).map(r => (
                    <button key={r.key} onClick={() => setFilterRange(r.key)}
                      style={{ padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', background: filterRange === r.key ? '#D97757' : 'var(--bg-secondary, #F5F0EB)', color: filterRange === r.key ? '#fff' : 'var(--text-secondary, #6B6560)' }}>
                      {r.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setFilterRange('custom')}
                  style={{ width: '100%', padding: '10px 0', borderRadius: 12, fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', marginBottom: 12, background: filterRange === 'custom' ? '#D97757' : 'var(--bg-secondary, #F5F0EB)', color: filterRange === 'custom' ? '#fff' : 'var(--text-secondary, #6B6560)' }}>
                  Custom Range
                </button>

                {filterRange === 'custom' && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #8B8579)', display: 'block', marginBottom: 5 }}>FROM</label>
                      <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 14, background: 'var(--bg-secondary, #F5F0EB)', border: '1px solid var(--border, #E8E2D9)', outline: 'none', color: 'var(--text-primary, #1A1816)', boxSizing: 'border-box' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #8B8579)', display: 'block', marginBottom: 5 }}>TO</label>
                      <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: 10, fontSize: 14, background: 'var(--bg-secondary, #F5F0EB)', border: '1px solid var(--border, #E8E2D9)', outline: 'none', color: 'var(--text-primary, #1A1816)', boxSizing: 'border-box' }} />
                    </div>
                  </motion.div>
                )}

                {filterRange === 'custom' && (!customFrom || !customTo) && (
                  <p style={{ fontSize: 12, color: '#C45C4A', textAlign: 'center', margin: '0 0 8px', fontWeight: 500 }}>
                    Please select both From and To dates
                  </p>
                )}
                <motion.button
                  whileTap={{ scale: filterRange === 'custom' && (!customFrom || !customTo) ? 1 : 0.97 }}
                  onClick={() => {
                    if (filterRange === 'custom' && (!customFrom || !customTo)) return;
                    if (filterRange === 'custom' && customFrom > customTo) {
                      // Swap if user picked dates in wrong order
                      const tmp = customFrom;
                      setCustomFrom(customTo);
                      setCustomTo(tmp);
                    }
                    setFiltersActive(true);
                    setShowFilter(false);
                  }}
                  style={{ width: '100%', padding: '15px 0', borderRadius: 14, color: '#fff', border: 'none', cursor: filterRange === 'custom' && (!customFrom || !customTo) ? 'not-allowed' : 'pointer', background: filterRange === 'custom' && (!customFrom || !customTo) ? '#C4BFB6' : 'linear-gradient(135deg, #D97757, #C4613C)', fontSize: 16, fontWeight: 700, marginTop: 4, opacity: filterRange === 'custom' && (!customFrom || !customTo) ? 0.6 : 1 }}>
                  Apply Filter
                </motion.button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
