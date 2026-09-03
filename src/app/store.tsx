import * as XLSX from 'xlsx';

// ── Date keys — single source of truth for every month/day bucket ────────────
// Bills are stored as "YYYY-MM-DD". Do NOT round-trip that through `new Date()`:
// JS parses a date-only ISO string as UTC midnight, then getMonth()/getDate()
// read it back in local time — so in any timezone behind UTC (the Americas),
// "2026-06-01" reads as 31 May and the bill vanishes from June.
// The string already IS the local date, so slice it.
export function localDateStr(dateStr: string): string {
  if (typeof dateStr !== 'string') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  // Non-ISO fallback (older records, odd AI output). Invalid → '' so it never
  // matches a real month instead of producing a "NaN-NaN" bucket.
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

export function localMonthStr(dateStr: string): string {
  return localDateStr(dateStr).slice(0, 7);
}

// Display formatter. Builds the Date from parts (local midnight) so the date
// shown on screen always matches the month bucket the bill was filed under.
export function formatBillDate(
  dateStr: string,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' },
): string {
  const iso = localDateStr(dateStr);
  if (!iso) return '—';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
}

import React, { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from 'react';
import {
  saveBillToDrive, deleteBillFromDrive,
  saveVendorsToDrive, saveSettingsToDrive,
  loadAllFromDrive, initDrive, signOutDrive, isDriveReady,
} from './googleDrive';

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
  billNumber?: string;   // dedicated field — used for duplicate detection
  confidence: 'high' | 'medium' | 'low';
}

export interface UserProfile {
  name: string;
  email: string;
  businessName: string;
}

export interface DriveStatus {
  connected: boolean;
  userEmail: string;
  lastSync: string | null;
  rootFolderId: string | null;
  billsFolderId: string | null;
  syncing: boolean;   // true while a Drive write is in progress
  syncError: string | null;
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
  driveClientId: string;
  driveStatus: DriveStatus;
}

const VENDOR_COLORS = ['#D97757','#5C9A6F','#D4A853','#C45C4A','#9B7E6B','#7BA5B5','#B57D52','#6B8F71'];
const STORAGE_KEY = 'billerpro_state';
const STORAGE_VERSION = 'v3';

if (localStorage.getItem('billerpro_version') !== STORAGE_VERSION) {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.setItem('billerpro_version', STORAGE_VERSION);
}

function getVendorColor(index: number) { return VENDOR_COLORS[index % VENDOR_COLORS.length]; }
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

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
  driveClientId: '',
  driveStatus: {
    connected: false,
    userEmail: '',
    lastSync: null,
    rootFolderId: null,
    billsFolderId: null,
    syncing: false,
    syncError: null,
  },
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
      // Always open on the current month. Persisting this meant a user who last
      // viewed March still saw March months later — new bills looked "missing".
      selectedMonth: currentMonth(),
      // Reset transient drive UI states
      driveStatus: {
        ...defaultState.driveStatus,
        ...(saved.driveStatus || {}),
        syncing: false,
        syncError: null,
      },
    };
  } catch { return defaultState; }
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
    driveClientId: state.driveClientId,
    driveStatus: {
      connected: state.driveStatus.connected,
      userEmail: state.driveStatus.userEmail,
      lastSync: state.driveStatus.lastSync,
      rootFolderId: state.driveStatus.rootFolderId,
      billsFolderId: state.driveStatus.billsFolderId,
    },
  };
}

// ── Full backup (JSON) ───────────────────────────────────────────────────────
// The safety net for the majority of users who never connect Google Drive.
// One file, restorable on any device, no account required.

export const BACKUP_MARKER = 'BillerPRO';

export function exportBackupJSON(state: AppState) {
  const payload = {
    _app: BACKUP_MARKER,
    _version: STORAGE_VERSION,
    _exportedAt: new Date().toISOString(),
    user: state.user,
    vendors: state.vendors,
    bills: state.bills,
    monthlyTarget: state.monthlyTarget,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `BillerPRO-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return state.bills.length;
}

export interface BackupData {
  user?: Partial<UserProfile>;
  vendors: Vendor[];
  bills: Bill[];
  monthlyTarget?: number;
}

// Throws on anything that isn't a recognisable BillerPRO backup, so a
// mis-picked file can never wipe real data.
export function parseBackupJSON(text: string): BackupData {
  let raw: any;
  try { raw = JSON.parse(text); }
  catch { throw new Error('That file is not readable JSON.'); }

  if (!raw || typeof raw !== 'object') throw new Error('That file is not a BillerPRO backup.');
  if (raw._app && raw._app !== BACKUP_MARKER) throw new Error('That backup is from a different app.');
  if (!Array.isArray(raw.bills) || !Array.isArray(raw.vendors)) {
    throw new Error('That file is not a BillerPRO backup.');
  }
  const bills = raw.bills.filter(
    (b: any) => b && typeof b.id === 'string' && typeof b.amount === 'number' && typeof b.date === 'string',
  );
  const vendors = raw.vendors.filter(
    (v: any) => v && typeof v.id === 'string' && typeof v.name === 'string',
  );
  if (bills.length === 0 && vendors.length === 0) throw new Error('That backup is empty.');
  return { user: raw.user, vendors, bills, monthlyTarget: raw.monthlyTarget };
}

// ── Excel (XLSX) export ───────────────────────────────────────────────────────
// Exports a proper .xlsx file with one sheet per vendor — perfect for sharing
// with each vendor as monthly proof of sales + commission owed.

export function exportToXLSX(bills: Bill[], vendors: Vendor[], monthLabel?: string) {
  const getV = (id: string) => vendors.find(v => v.id === id);
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Full Summary (all vendors together) ─────────────────────────
  const summaryRows: any[][] = [
    [`BillerPRO — ${monthLabel || 'All Bills'}`],
    [`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`],
    [],
    ['Date', 'Bill No.', 'Customer Name', 'Vendor', 'Bill Amount (₹)', 'Cut %', 'Your Earnings (₹)'],
  ];

  const sortedBills = [...bills].sort((a, b) => a.date.localeCompare(b.date));
  sortedBills.forEach(b => {
    const v = getV(b.vendorId);
    const cut = v ? Math.round(b.amount * v.cutPercent / 100) : 0;
    summaryRows.push([
      formatBillDate(b.date),
      b.billNumber || '—',
      b.customerName,
      v?.name || 'Unknown',
      b.amount,
      v ? v.cutPercent + '%' : '0%',
      cut,
    ]);
  });

  const totalAmt = bills.reduce((s, b) => s + b.amount, 0);
  const totalEarn = bills.reduce((s, b) => {
    const v = getV(b.vendorId);
    return s + (v ? Math.round(b.amount * v.cutPercent / 100) : 0);
  }, 0);
  summaryRows.push([]);
  summaryRows.push(['', '', '', 'TOTAL', totalAmt, '', totalEarn]);

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  wsSummary['!cols'] = [
    { wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 16 },
    { wch: 16 }, { wch: 7 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'All Bills');

  // ── One sheet per vendor — perfect for sharing with each vendor ──────────
  vendors.forEach(vendor => {
    const vBills = bills.filter(b => b.vendorId === vendor.id)
                        .sort((a, b) => a.date.localeCompare(b.date));
    if (vBills.length === 0) return;

    const rows: any[][] = [
      [`${vendor.name} — ${monthLabel || 'Bill Statement'}`],
      [`Commission Rate: ${vendor.cutPercent}%`],
      [`Generated: ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`],
      [],
      ['Date', 'Bill No.', 'Customer Name', 'Bill Amount (₹)', `Commission ${vendor.cutPercent}% (₹)`],
    ];

    vBills.forEach(b => {
      const cut = Math.round(b.amount * vendor.cutPercent / 100);
      rows.push([
        formatBillDate(b.date),
        b.billNumber || '—',
        b.customerName,
        b.amount,
        cut,
      ]);
    });

    const vTotal = vBills.reduce((s, b) => s + b.amount, 0);
    const vEarn  = vBills.reduce((s, b) => s + Math.round(b.amount * vendor.cutPercent / 100), 0);
    rows.push([]);
    rows.push(['', '', 'TOTAL', vTotal, vEarn]);
    rows.push([]);
    rows.push(['', '', `Amount to collect from ${vendor.name}:`, '', vEarn]);

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 30 }, { wch: 16 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws, vendor.name.slice(0, 31));
  });

  const label = monthLabel ? monthLabel.replace(/[^a-zA-Z0-9]/g, '_') : 'All';
  XLSX.writeFile(wb, `BillerPRO_${label}.xlsx`);
}

export function exportMonthToXLSX(bills: Bill[], vendors: Vendor[], month: string) {
  const [yr, mo] = month.split('-');
  const label = new Date(Number(yr), Number(mo) - 1, 1)
    .toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  exportToXLSX(bills.filter(b => localMonthStr(b.date) === month), vendors, label);
}

// Keep old names as aliases so nothing else breaks
export const exportToCSV = exportToXLSX;
export function exportMonthToCSV(bills: Bill[], vendors: Vendor[], month: string) {
  exportMonthToXLSX(bills, vendors, month);
}

// ── Helper selectors ─────────────────────────────────────────────────────────
function getBillsForMonthFn(bills: Bill[], month: string): Bill[] {
  return bills.filter(b => localMonthStr(b.date) === month);
}
function getEarningsForMonthFn(bills: Bill[], vendors: Vendor[], month: string): number {
  return getBillsForMonthFn(bills, month).reduce((sum, b) => {
    const v = vendors.find(v => v.id === b.vendorId);
    return sum + (v ? b.amount * v.cutPercent / 100 : 0);
  }, 0);
}
function getTotalBillsForMonthFn(bills: Bill[], month: string): number {
  return getBillsForMonthFn(bills, month).reduce((sum, b) => sum + b.amount, 0);
}

// ── Context ───────────────────────────────────────────────────────────────────
interface AppContextType {
  state: AppState;
  login: (name: string, businessName: string) => void;
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
  connectDrive: (clientId: string) => Promise<void>;
  disconnectDrive: () => void;
  loadFromDrive: () => Promise<boolean>;
  getVendor: (id: string) => Vendor | undefined;
  getBillsForMonth: (month: string) => Bill[];
  getEarningsForMonth: (month: string) => number;
  getTotalBillsForMonth: (month: string) => number;
  setDriveClientId: (id: string) => void;
  restoreBackup: (data: BackupData) => { added: number; skipped: number };
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(loadState);

  // Persist to localStorage on every state change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pickPersistable(state)));
  }, [state]);

  // ── Helper: fire-and-forget Drive sync with error tracking ────────────────
  const driveSync = useCallback(async (fn: () => Promise<void>) => {
    setState(s => ({ ...s, driveStatus: { ...s.driveStatus, syncing: true, syncError: null } }));
    try {
      await fn();
      setState(s => ({ ...s, driveStatus: { ...s.driveStatus, syncing: false, lastSync: new Date().toISOString() } }));
    } catch (err: any) {
      console.error('Drive sync error:', err);
      setState(s => ({ ...s, driveStatus: { ...s.driveStatus, syncing: false, syncError: err.message } }));
    }
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const login = useCallback((name: string, businessName: string) => {
    setState(s => ({ ...s, isLoggedIn: true, user: { ...s.user, name, businessName } }));
  }, []);

  const logout = useCallback(() => {
    setState(s => ({ ...s, isLoggedIn: false, activeTab: 'home' }));
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setState(s => ({ ...s, activeTab: tab }));
  }, []);

  // ── Vendors — auto-sync to Drive ──────────────────────────────────────────
  const addVendor = useCallback((name: string, cutPercent: number, notes?: string) => {
    setState(s => {
      const newVendors = [...s.vendors, {
        id: 'v' + Date.now(), name, cutPercent,
        color: getVendorColor(s.vendors.length), notes,
      }];
      // Auto-sync if Drive connected
      if (s.driveStatus.connected && s.driveStatus.rootFolderId) {
        driveSync(() => saveVendorsToDrive(newVendors, s.driveStatus.rootFolderId!));
      }
      return { ...s, vendors: newVendors };
    });
  }, [driveSync]);

  const updateVendor = useCallback((id: string, name: string, cutPercent: number, notes?: string) => {
    setState(s => {
      const newVendors = s.vendors.map(v => v.id === id ? { ...v, name, cutPercent, notes } : v);
      if (s.driveStatus.connected && s.driveStatus.rootFolderId) {
        driveSync(() => saveVendorsToDrive(newVendors, s.driveStatus.rootFolderId!));
      }
      return { ...s, vendors: newVendors };
    });
  }, [driveSync]);

  const deleteVendor = useCallback((id: string) => {
    setState(s => {
      const newVendors = s.vendors.filter(v => v.id !== id);
      if (s.driveStatus.connected && s.driveStatus.rootFolderId) {
        driveSync(() => saveVendorsToDrive(newVendors, s.driveStatus.rootFolderId!));
      }
      return { ...s, vendors: newVendors };
    });
  }, [driveSync]);

  // ── Bills — auto-sync to Drive ────────────────────────────────────────────
  const addBill = useCallback((bill: Omit<Bill, 'id'>) => {
    const newBill: Bill = { ...bill, id: 'b' + Date.now() };
    setState(s => {
      if (s.driveStatus.connected && s.driveStatus.billsFolderId) {
        // Save this single bill as its own file in Drive
        driveSync(() => saveBillToDrive(newBill, s.driveStatus.billsFolderId!));
      }
      return { ...s, bills: [newBill, ...s.bills] };
    });
  }, [driveSync]);

  const deleteBill = useCallback((id: string) => {
    setState(s => {
      if (s.driveStatus.connected && s.driveStatus.billsFolderId) {
        driveSync(() => deleteBillFromDrive(id, s.driveStatus.billsFolderId!));
      }
      return { ...s, bills: s.bills.filter(b => b.id !== id) };
    });
  }, [driveSync]);

  // ── Settings — auto-sync to Drive ─────────────────────────────────────────
  const setMonthlyTarget = useCallback((val: number) => {
    setState(s => {
      if (s.driveStatus.connected && s.driveStatus.rootFolderId) {
        driveSync(() => saveSettingsToDrive({ monthlyTarget: val, user: s.user }, s.driveStatus.rootFolderId!));
      }
      return { ...s, monthlyTarget: val };
    });
  }, [driveSync]);

  const setUserProfile = useCallback((profile: Partial<UserProfile>) => {
    setState(s => {
      const newUser = { ...s.user, ...profile };
      if (s.driveStatus.connected && s.driveStatus.rootFolderId) {
        driveSync(() => saveSettingsToDrive({ monthlyTarget: s.monthlyTarget, user: newUser }, s.driveStatus.rootFolderId!));
      }
      return { ...s, user: newUser };
    });
  }, [driveSync]);

  const setSelectedMonth = useCallback((val: string) => {
    setState(s => ({ ...s, selectedMonth: val }));
  }, []);

  const setTheme = useCallback((theme: 'light' | 'dark' | 'system') => {
    setState(s => ({ ...s, theme }));
  }, []);

  const setClaudeApiKey = useCallback((key: string) => {
    setState(s => ({ ...s, claudeApiKey: key }));
  }, []);

  const setDriveClientId = useCallback((id: string) => {
    setState(s => ({ ...s, driveClientId: id }));
  }, []);

  // ── Connect Google Drive ──────────────────────────────────────────────────
  const connectDrive = useCallback(async (clientId: string) => {
    const info = await initDrive(clientId);
    setState(s => ({
      ...s,
      driveClientId: clientId,
      driveStatus: {
        connected: true,
        userEmail: info.userEmail,
        lastSync: info.lastSync,
        rootFolderId: info.rootFolderId,
        billsFolderId: info.billsFolderId,
        syncing: false,
        syncError: null,
      },
    }));
  }, []);

  // ── Disconnect Google Drive ───────────────────────────────────────────────
  const disconnectDrive = useCallback(() => {
    signOutDrive();
    setState(s => ({
      ...s,
      driveStatus: { ...defaultState.driveStatus },
    }));
  }, []);

  // ── Load all data FROM Drive (called on startup if connected) ─────────────
  const loadFromDrive = useCallback(async (): Promise<boolean> => {
    const s = state;
    if (!s.driveStatus.connected || !s.driveClientId) return false;

    setState(prev => ({ ...prev, driveStatus: { ...prev.driveStatus, syncing: true, syncError: null } }));
    try {
      const data = await loadAllFromDrive(s.driveClientId, s.driveStatus);
      if (!data) { throw new Error('No data found on Drive'); }

      setState(prev => ({
        ...prev,
        vendors: data.vendors.length > 0 ? data.vendors : prev.vendors,
        bills: data.bills.length > 0 ? data.bills : prev.bills,
        monthlyTarget: data.settings?.monthlyTarget ?? prev.monthlyTarget,
        user: data.settings?.user ? { ...prev.user, ...data.settings.user } : prev.user,
        driveStatus: {
          ...prev.driveStatus,
          syncing: false,
          lastSync: new Date().toISOString(),
        },
      }));
      return true;
    } catch (err: any) {
      setState(prev => ({ ...prev, driveStatus: { ...prev.driveStatus, syncing: false, syncError: err.message } }));
      return false;
    }
  }, [state]);

  // ── Restore from a backup file ────────────────────────────────────────────
  // MERGES rather than replaces: restoring an older backup must never delete
  // bills recorded since. Existing ids always win.
  const restoreBackup = useCallback((data: BackupData) => {
    let added = 0, skipped = 0;
    setState(s => {
      const billIds = new Set(s.bills.map(b => b.id));
      const newBills = data.bills.filter(b => {
        if (billIds.has(b.id)) { skipped++; return false; }
        added++; return true;
      });
      const vendorIds = new Set(s.vendors.map(v => v.id));
      const newVendors = data.vendors.filter(v => !vendorIds.has(v.id));

      return {
        ...s,
        bills: [...newBills, ...s.bills].sort((a, b) => b.date.localeCompare(a.date)),
        vendors: [...s.vendors, ...newVendors],
        monthlyTarget: s.monthlyTarget || data.monthlyTarget || 0,
        user: { ...s.user, ...(data.user || {}) },
      };
    });
    return { added, skipped };
  }, []);

  const getVendor = useCallback((id: string) => state.vendors.find(v => v.id === id), [state.vendors]);
  const getBillsForMonth = useCallback((month: string) => getBillsForMonthFn(state.bills, month), [state.bills]);
  const getEarningsForMonth = useCallback((month: string) => getEarningsForMonthFn(state.bills, state.vendors, month), [state.bills, state.vendors]);
  const getTotalBillsForMonth = useCallback((month: string) => getTotalBillsForMonthFn(state.bills, month), [state.bills]);

  return (
    <AppContext.Provider value={{
      state, login, logout, setActiveTab,
      addVendor, updateVendor, deleteVendor,
      addBill, deleteBill,
      setMonthlyTarget, setSelectedMonth,
      setUserProfile, setTheme, setClaudeApiKey,
      connectDrive, disconnectDrive, loadFromDrive,
      getVendor, getBillsForMonth, getEarningsForMonth, getTotalBillsForMonth, setDriveClientId,
      restoreBackup,
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
