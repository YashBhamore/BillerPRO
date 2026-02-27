import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

export interface Vendor {
  id: string;
  name: string;
  cutPercent: number;
  color: string;
  notes?: string;
}

export interface Bill {
  id: string;
  vendorId: string;
  customerName: string;
  amount: number;
  date: string;
  notes?: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface UserProfile {
  name: string;
  email: string;
  businessName: string;
}

export interface AppState {
  isLoggedIn: boolean;
  user: UserProfile;
  vendors: Vendor[];
  bills: Bill[];
  monthlyTarget: number;
  selectedMonth: string;
  theme: 'light' | 'dark' | 'system';
  activeTab: string;
  claudeApiKey: string;
}

const VENDOR_COLORS = ['#D97757', '#5C9A6F', '#D4A853', '#C45C4A', '#9B7E6B', '#7BA5B5', '#B57D52', '#6B8F71'];
const STORAGE_KEY = 'billerpro_state';
const STORAGE_VERSION = 'v2'; // bump this to wipe old cached data

// Wipe old data if version mismatch (clears fake demo data from old builds)
if (localStorage.getItem('billerpro_version') !== STORAGE_VERSION) {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem('billerpro_version', STORAGE_VERSION);
}

function getVendorColor(index: number) {
  return VENDOR_COLORS[index % VENDOR_COLORS.length];
}

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// Fresh empty state — no demo data
const defaultState: AppState = {
  isLoggedIn: false,
  user: { name: '', email: '', businessName: '' },
  vendors: [],
  bills: [],
  monthlyTarget: 0,
  selectedMonth: currentMonth(),
  theme: 'light',
  activeTab: 'home',
  claudeApiKey: '',
};

function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const saved = JSON.parse(raw);
    return {
      ...defaultState,
      ...saved,
      isLoggedIn: false,
      activeTab: 'home',
    };
  } catch {
    return defaultState;
  }
}

function pickPersistable(state: AppState) {
  return {
    user: state.user,
    vendors: state.vendors,
    bills: state.bills,
    monthlyTarget: state.monthlyTarget,
    selectedMonth: state.selectedMonth,
    theme: state.theme,
    claudeApiKey: state.claudeApiKey,
  };
}

// ─── REAL EXPORT FUNCTIONS ───────────────────────────────────────────────────

export function exportToCSV(bills: Bill[], vendors: Vendor[]) {
  const getVendor = (id: string) => vendors.find(v => v.id === id);

  const headers = ['Date', 'Vendor', 'Customer', 'Bill Amount (₹)', 'Cut %', 'Your Earnings (₹)'];
  const rows = bills
    .sort((a, b) => b.date.localeCompare(a.date))
    .map(b => {
      const v = getVendor(b.vendorId);
      const cut = v ? b.amount * v.cutPercent / 100 : 0;
      return [
        b.date,
        v?.name || '',
        b.customerName,
        b.amount.toString(),
        v ? `${v.cutPercent}%` : '',
        Math.round(cut).toString(),
      ];
    });

  // Add summary rows
  const totalBills = bills.reduce((s, b) => s + b.amount, 0);
  const totalEarnings = bills.reduce((s, b) => {
    const v = getVendor(b.vendorId);
    return s + (v ? b.amount * v.cutPercent / 100 : 0);
  }, 0);

  rows.push([]);
  rows.push(['TOTAL', '', '', totalBills.toString(), '', Math.round(totalEarnings).toString()]);

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BillerPRO_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportMonthToCSV(bills: Bill[], vendors: Vendor[], month: string) {
  const monthBills = bills.filter(b => b.date.startsWith(month));
  exportToCSV(monthBills, vendors);
}

// ─────────────────────────────────────────────────────────────────────────────

interface AppContextType {
  state: AppState;
  login: (email: string, password: string) => boolean;
  logout: () => void;
  setActiveTab: (tab: string) => void;
  addVendor: (name: string, cutPercent: number, notes?: string) => void;
  updateVendor: (id: string, name: string, cutPercent: number, notes?: string) => void;
  deleteVendor: (id: string) => void;
  addBill: (bill: Omit<Bill, 'id'>) => void;
  deleteBill: (id: string) => void;
  setMonthlyTarget: (val: number) => void;
  setSelectedMonth: (val: string) => void;
  setUserProfile: (profile: Partial<UserProfile>) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setClaudeApiKey: (key: string) => void;
  getVendor: (id: string) => Vendor | undefined;
  getBillsForMonth: (month: string) => Bill[];
  getEarningsForMonth: (month: string) => number;
  getTotalBillsForMonth: (month: string) => number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pickPersistable(state)));
    } catch {}
  }, [state.user, state.vendors, state.bills, state.monthlyTarget, state.selectedMonth, state.theme, state.claudeApiKey]);

  const login = useCallback((_email: string, _password: string) => {
    setState(s => ({ ...s, isLoggedIn: true }));
    return true;
  }, []);

  const logout = useCallback(() => {
    setState(s => ({ ...s, isLoggedIn: false, activeTab: 'home' }));
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setState(s => ({ ...s, activeTab: tab }));
  }, []);

  const addVendor = useCallback((name: string, cutPercent: number, notes?: string) => {
    setState(s => ({
      ...s,
      vendors: [...s.vendors, {
        id: 'v' + Date.now(),
        name,
        cutPercent,
        color: getVendorColor(s.vendors.length),
        notes,
      }],
    }));
  }, []);

  const updateVendor = useCallback((id: string, name: string, cutPercent: number, notes?: string) => {
    setState(s => ({
      ...s,
      vendors: s.vendors.map(v => v.id === id ? { ...v, name, cutPercent, notes } : v),
    }));
  }, []);

  const deleteVendor = useCallback((id: string) => {
    setState(s => ({ ...s, vendors: s.vendors.filter(v => v.id !== id) }));
  }, []);

  const addBill = useCallback((bill: Omit<Bill, 'id'>) => {
    setState(s => ({
      ...s,
      bills: [{ ...bill, id: 'b' + Date.now() }, ...s.bills],
    }));
  }, []);

  const deleteBill = useCallback((id: string) => {
    setState(s => ({ ...s, bills: s.bills.filter(b => b.id !== id) }));
  }, []);

  const setMonthlyTarget = useCallback((val: number) => {
    setState(s => ({ ...s, monthlyTarget: val }));
  }, []);

  const setSelectedMonth = useCallback((val: string) => {
    setState(s => ({ ...s, selectedMonth: val }));
  }, []);

  const setUserProfile = useCallback((profile: Partial<UserProfile>) => {
    setState(s => ({ ...s, user: { ...s.user, ...profile } }));
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    setState(s => ({ ...s, theme }));
  }, []);

  const setClaudeApiKey = useCallback((key: string) => {
    setState(s => ({ ...s, claudeApiKey: key }));
  }, []);

  const getVendor = useCallback((id: string) => {
    return state.vendors.find(v => v.id === id);
  }, [state.vendors]);

  const getBillsForMonth = useCallback((month: string) => {
    return state.bills.filter(b => b.date.startsWith(month));
  }, [state.bills]);

  const getEarningsForMonth = useCallback((month: string) => {
    return state.bills
      .filter(b => b.date.startsWith(month))
      .reduce((sum, b) => {
        const v = state.vendors.find(v => v.id === b.vendorId);
        return sum + (v ? b.amount * v.cutPercent / 100 : 0);
      }, 0);
  }, [state.bills, state.vendors]);

  const getTotalBillsForMonth = useCallback((month: string) => {
    return state.bills.filter(b => b.date.startsWith(month)).reduce((sum, b) => sum + b.amount, 0);
  }, [state.bills]);

  return (
    <AppContext.Provider value={{
      state, login, logout, setActiveTab, addVendor, updateVendor, deleteVendor,
      addBill, deleteBill, setMonthlyTarget, setSelectedMonth,
      setUserProfile, setTheme, setClaudeApiKey, getVendor,
      getBillsForMonth, getEarningsForMonth, getTotalBillsForMonth,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
