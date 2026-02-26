import React, { useState, useMemo } from 'react';
import { useApp } from '../store';
import { motion } from 'motion/react';
import { TrendingUp, Trophy, Calendar, Receipt } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area,
} from 'recharts';

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

type Period = 'This Month' | '3 Months' | '6 Months' | 'Year';
const periods: Period[] = ['This Month', '3 Months', '6 Months', 'Year'];

// Get a list of YYYY-MM keys for the given period ending at selectedMonth
function getMonthKeys(selectedMonth: string, period: Period): string[] {
  const [y, m] = selectedMonth.split('-').map(Number);
  const count = period === 'This Month' ? 1 : period === '3 Months' ? 3 : period === '6 Months' ? 6 : 12;
  const keys: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(y, m - 1 - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return keys;
}

export function Analytics() {
  const { state, getVendor } = useApp();
  const [period, setPeriod] = useState<Period>('6 Months');

  const monthKeys = useMemo(() => getMonthKeys(state.selectedMonth, period), [state.selectedMonth, period]);

  // Filter bills to only those in the selected period
  const periodBills = useMemo(() => {
    return state.bills.filter(b => monthKeys.some(k => b.date.startsWith(k)));
  }, [state.bills, monthKeys]);

  // Monthly bar chart data
  const monthlyData = useMemo(() => {
    return monthKeys.map(key => {
      const bills = state.bills.filter(b => b.date.startsWith(key));
      const totalBills = bills.reduce((s, b) => s + b.amount, 0);
      const earnings = bills.reduce((s, b) => {
        const v = state.vendors.find(v => v.id === b.vendorId);
        return s + (v ? b.amount * v.cutPercent / 100 : 0);
      }, 0);
      const label = new Date(key + '-01').toLocaleString('en', { month: 'short' });
      return { month: label, totalBills: Math.round(totalBills), earnings: Math.round(earnings) };
    });
  }, [state.bills, state.vendors, monthKeys]);

  // Pie chart: earnings by vendor within period
  const vendorPieData = useMemo(() => {
    const map: Record<string, number> = {};
    periodBills.forEach(b => {
      const v = getVendor(b.vendorId);
      if (!v) return;
      map[b.vendorId] = (map[b.vendorId] || 0) + b.amount * v.cutPercent / 100;
    });
    return Object.entries(map).map(([vid, amount]) => {
      const v = getVendor(vid);
      return { name: v?.name || '', value: Math.round(amount), color: v?.color || '#ccc' };
    }).sort((a, b) => b.value - a.value);
  }, [periodBills, getVendor]);

  const totalPieEarnings = vendorPieData.reduce((s, d) => s + d.value, 0);

  // Vendor comparison bars within period
  const vendorComparison = useMemo(() => {
    const map: Record<string, { total: number; cut: number }> = {};
    periodBills.forEach(b => {
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
  }, [periodBills, getVendor]);

  // Daily trend — for This Month, show all days; for multi-month, show monthly area
  const dailyTrend = useMemo(() => {
    if (period === 'This Month') {
      const days: Record<number, number> = {};
      periodBills.forEach(b => {
        const day = parseInt(b.date.split('-')[2]);
        days[day] = (days[day] || 0) + b.amount;
      });
      return Array.from({ length: 28 }, (_, i) => ({ label: String(i + 1), amount: days[i + 1] || 0 }));
    } else {
      // Show monthly totals as area
      return monthlyData.map(m => ({ label: m.month, amount: m.totalBills }));
    }
  }, [periodBills, period, monthlyData]);

  // Summary stats across the full period
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
    periodBills.forEach(b => {
      const v = getVendor(b.vendorId);
      if (!v) return;
      vendorTotals[b.vendorId] = (vendorTotals[b.vendorId] || 0) + b.amount * v.cutPercent / 100;
    });
    const topVendor = Object.entries(vendorTotals).sort((a, b) => b[1] - a[1])[0];

    const avgMonthly = monthKeys.length > 0
      ? monthKeys.reduce((sum, k) => {
          const e = state.bills.filter(b => b.date.startsWith(k)).reduce((s, b) => {
            const v = getVendor(b.vendorId);
            return s + (v ? b.amount * v.cutPercent / 100 : 0);
          }, 0);
          return sum + e;
        }, 0) / monthKeys.length
      : 0;

    return {
      topVendor: topVendor ? getVendor(topVendor[0])?.name || '-' : '-',
      bestMonth: bestMonth ? new Date(bestMonth[0] + '-01').toLocaleString('en', { month: 'short', year: 'numeric' }) : '-',
      bestMonthAmt: bestMonth ? formatCurrency(Math.round(bestMonth[1])) : '-',
      totalBills: periodBills.length,
      avgMonthly: formatCurrency(Math.round(avgMonthly)),
    };
  }, [state.bills, periodBills, getVendor, monthKeys]);

  const customTooltipStyle = {
    backgroundColor: '#1A1816',
    border: 'none',
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: 13,
    color: 'white',
    fontFamily: "'Inter', sans-serif",
  };

  return (
    <div className="min-h-full px-5 pt-6 pb-5">
      <div className="mb-5">
        <h2 className="text-[#1A1816] mb-1" style={{ fontSize: 22, fontWeight: 700 }}>Analytics</h2>
        <p className="text-[#8B8579]" style={{ fontSize: 15 }}>Your business performance at a glance</p>
      </div>

      {/* Period selector — now actually filters data */}
      <div className="flex gap-2 overflow-x-auto mb-5" style={{ scrollbarWidth: 'none' }}>
        {periods.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="px-4 py-2.5 rounded-lg flex-shrink-0 whitespace-nowrap transition-all"
            style={{
              fontSize: 14, fontWeight: 600,
              background: period === p ? '#1A1816' : '#FFFFFF',
              color: period === p ? '#FFFFFF' : '#6B6560',
              border: period === p ? 'none' : '1px solid #E8E2D9',
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
          { icon: Receipt, label: `Bills (${period})`, value: String(stats.totalBills), color: '#D97757', bg: '#FDF5F0' },
          { icon: TrendingUp, label: 'Avg / Month', value: stats.avgMonthly, color: '#9B7E6B', bg: '#F5F0EB' },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-xl p-4"
            style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-2.5" style={{ background: s.bg }}>
              <s.icon className="w-[18px] h-[18px]" style={{ color: s.color }} />
            </div>
            <p className="text-[#8B8579] mb-0.5" style={{ fontSize: 13, fontWeight: 500 }}>{s.label}</p>
            <p className="text-[#1A1816] truncate" style={{ fontSize: 17, fontWeight: 700 }}>{s.value}</p>
            {s.sub && <p className="text-[#8B8579]" style={{ fontSize: 13 }}>{s.sub}</p>}
          </motion.div>
        ))}
      </div>

      {/* Monthly Earnings Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-5 mb-4"
        style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
      >
        <h3 className="text-[#1A1816] mb-4" style={{ fontSize: 18, fontWeight: 700 }}>
          Monthly Overview — {period}
        </h3>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthlyData} barGap={2}>
            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8B8579' }} axisLine={false} tickLine={false} />
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
          style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
        >
          <h3 className="text-[#1A1816] mb-4" style={{ fontSize: 18, fontWeight: 700 }}>Earnings by Vendor</h3>
          {vendorPieData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="relative flex-shrink-0">
                <PieChart width={130} height={130}>
                  <Pie data={vendorPieData} cx="50%" cy="50%" innerRadius={38} outerRadius={58} paddingAngle={3} dataKey="value">
                    {vendorPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-[#C4BFB6]" style={{ fontSize: 10 }}>Total</p>
                    <p className="text-[#1A1816]" style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(totalPieEarnings)}</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 space-y-2.5">
                {vendorPieData.map(d => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: d.color }} />
                    <span className="text-[#6B6560] truncate flex-1" style={{ fontSize: 13 }}>{d.name}</span>
                    <span className="text-[#1A1816] flex-shrink-0" style={{ fontSize: 13, fontWeight: 700 }}>{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-center text-[#C4BFB6] py-8" style={{ fontSize: 15 }}>No data for this period</p>
          )}
        </motion.div>

        {vendorComparison.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="rounded-2xl p-5"
            style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
          >
            <h3 className="text-[#1A1816] mb-4" style={{ fontSize: 18, fontWeight: 700 }}>Vendor Comparison</h3>
            <div className="space-y-3.5">
              {vendorComparison.map(vc => {
                const max = vendorComparison[0]?.total || 1;
                return (
                  <div key={vc.name}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[#6B6560] truncate" style={{ fontSize: 14, fontWeight: 500 }}>{vc.name}</span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[#5C9A6F]" style={{ fontSize: 13, fontWeight: 600 }}>+{formatCurrency(vc.cut)}</span>
                        <span className="text-[#8B8579]" style={{ fontSize: 13 }}>{formatCurrency(vc.total)}</span>
                      </div>
                    </div>
                    <div className="h-3 rounded-full overflow-hidden" style={{ background: '#F0EBE3' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(vc.total / max) * 100}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{ background: vc.color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </div>

      {/* Area Chart */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl p-5"
        style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}
      >
        <h3 className="text-[#1A1816] mb-4" style={{ fontSize: 18, fontWeight: 700 }}>
          {period === 'This Month' ? 'Daily Trend' : 'Monthly Trend'}
        </h3>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={dailyTrend}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#C4BFB6' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: '#C4BFB6' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={customTooltipStyle} formatter={(v: number) => formatCurrency(v)} />
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97757" stopOpacity={0.2} />
                <stop offset="100%" stopColor="#D97757" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="amount" stroke="#D97757" fill="url(#grad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
