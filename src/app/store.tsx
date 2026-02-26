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
  avatar?: string;
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

function getVendorColor(index: number) {
  return VENDOR_COLORS[index % VENDOR_COLORS.length];
}

const defaultVendors: Vendor[] = [];

const defaultBills: Bill[] = [];

const defaultState: AppState = {
  isLoggedIn: false,
  user: { name: '', email: '', businessName: '' },
  vendors: defaultVendors,
  bills: defaultBills,
  monthlyTarget: 20000,
  selectedMonth: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
  theme: 'light',
  activeTab: 'home',
  claudeApiKey: '',
};

// Load persisted state from localStorage, merging with defaults
function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    const saved = JSON.parse(raw);
    // Merge saved state with defaults so new fields always exist
    return {
      ...defaultState,
      ...saved,
      // Always start logged out for security
      isLoggedIn: false,
      // Preserve active tab only as 'home' on reload
      activeTab: 'home',
    };
  } catch {
    return defaultState;
  }
}

// Fields we want to persist (exclude volatile UI state)
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

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function triggerCsvDownload(filename: string, csv: string) {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

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
  downloadBillsCsv: (scope: 'month' | 'all') => string;
  getVendor: (id: string) => Vendor | undefined;
  getBillsForMonth: (month: string) => Bill[];
  getEarningsForMonth: (month: string) => number;
  getTotalBillsForMonth: (month: string) => number;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  // Persist to localStorage whenever relevant state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pickPersistable(state)));
    } catch {
      // Silently fail if storage is full
    }
  }, [state.user, state.vendors, state.bills, state.monthlyTarget, state.selectedMonth, state.theme, state.claudeApiKey]);

  const login = useCallback((email: string, _password: string) => {
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
    setState(s => ({
      ...s,
      vendors: s.vendors.filter(v => v.id !== id),
      bills: s.bills.filter(b => b.vendorId !== id),
    }));
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

  const downloadBillsCsv = useCallback((scope: 'month' | 'all') => {
    const sourceBills = scope === 'month'
      ? state.bills.filter(b => b.date.startsWith(state.selectedMonth))
      : state.bills;

    const rows: (string | number)[][] = [
      ['Date', 'Vendor', 'Customer', 'Amount', 'Cut %', 'Earnings', 'Confidence', 'Notes'],
      ...sourceBills.map(b => {
        const vendor = state.vendors.find(v => v.id === b.vendorId);
        const cutPercent = vendor?.cutPercent ?? 0;
        const earnings = Math.round(((b.amount * cutPercent) / 100) * 100) / 100;
        return [
          b.date,
          vendor?.name ?? 'Unknown Vendor',
          b.customerName,
          b.amount,
          cutPercent,
          earnings,
          b.confidence,
          b.notes ?? '',
        ];
      }),
    ];

    const totalAmount = sourceBills.reduce((sum, b) => sum + b.amount, 0);
    const totalEarnings = sourceBills.reduce((sum, b) => {
      const vendor = state.vendors.find(v => v.id === b.vendorId);
      return sum + (vendor ? (b.amount * vendor.cutPercent) / 100 : 0);
    }, 0);

    rows.push([]);
    rows.push(['GRAND TOTAL', '', '', totalAmount, '', Math.round(totalEarnings * 100) / 100, '', '']);

    const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
    const scopeLabel = scope === 'month' ? state.selectedMonth : 'all-data';
    const filename = `billerpro-${scopeLabel}.csv`;
    triggerCsvDownload(filename, csv);
    return filename;
  }, [state.bills, state.selectedMonth, state.vendors]);

  const getVendor = useCallback((id: string) => {
    return state.vendors.find(v => v.id === id);
  }, [state.vendors]);

  const getBillsForMonth = useCallback((month: string) => {
    return state.bills.filter(b => b.date.startsWith(month));
  }, [state.bills]);

  const getEarningsForMonth = useCallback((month: string) => {
    const bills = state.bills.filter(b => b.date.startsWith(month));
    return bills.reduce((sum, b) => {
      const vendor = state.vendors.find(v => v.id === b.vendorId);
      return sum + (vendor ? b.amount * vendor.cutPercent / 100 : 0);
    }, 0);
  }, [state.bills, state.vendors]);

  const getTotalBillsForMonth = useCallback((month: string) => {
    return state.bills.filter(b => b.date.startsWith(month)).reduce((sum, b) => sum + b.amount, 0);
  }, [state.bills]);

  return (
    <AppContext.Provider value={{
      state, login, logout, setActiveTab, addVendor, updateVendor, deleteVendor,
      addBill, deleteBill, setMonthlyTarget, setSelectedMonth,
      setUserProfile, setTheme, setClaudeApiKey, downloadBillsCsv, getVendor, getBillsForMonth,
      getEarningsForMonth, getTotalBillsForMonth,
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
