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

// ── CSV export helpers ────────────────────────────────────────────────────────
export function exportToCSV(bills: Bill[], vendors: Vendor[]) {
  const getV = (id: string) => vendors.find(v => v.id === id);
  const BOM = '\uFEFF';
  const rows = [
    ['Date','Bill Customer','Vendor','Bill Amount','Cut %','Your Earnings'],
    ...bills.map(b => {
      const v = getV(b.vendorId);
      const cut = v ? b.amount * v.cutPercent / 100 : 0;
      return [b.date, b.customerName, v?.name||'Unknown', b.amount, v?.cutPercent||0, Math.round(cut)];
    }),
    ['','','TOTAL', bills.reduce((s,b)=>s+b.amount,0), '',
      Math.round(bills.reduce((s,b)=>{const v=getV(b.vendorId);return s+(v?b.amount*v.cutPercent/100:0);},0))],
  ];
  const csv = BOM + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `BillerPRO_export_${Date.now()}.csv`; a.click();
  URL.revokeObjectURL(url);
}

export function exportMonthToCSV(bills: Bill[], vendors: Vendor[], month: string) {
  exportToCSV(bills.filter(b => b.date.startsWith(month)), vendors);
}

// ── Helper selectors ─────────────────────────────────────────────────────────
function getBillsForMonthFn(bills: Bill[], month: string): Bill[] {
  return bills.filter(b => b.date.startsWith(month));
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
