import React, { useState, useEffect } from 'react';
import { useApp } from '../store';
import {
  Plus, Download, Moon, Sun, Monitor,
  ChevronRight, X, LogOut, RefreshCw, Loader2,
  CheckCircle2, AlertCircle, FolderOpen, Pencil, Trash2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { exportToCSV, exportMonthToCSV } from '../store';

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function SettingsScreen() {
  const {
    state, setUserProfile, setMonthlyTarget,
    addVendor, updateVendor, deleteVendor, logout, setTheme,
    connectDrive, disconnectDrive, loadFromDrive, setDriveClientId,
  } = useApp();

  // ── Vendor sheet (add/edit) ──────────────────────────────────────────────
  const [showVendorSheet, setShowVendorSheet] = useState(false);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorCut, setVendorCut] = useState('');

  // ── Vendor manage mode (select + delete) ────────────────────────────────
  const [manageMode, setManageMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── Target edit ──────────────────────────────────────────────────────────
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetValue, setTargetValue] = useState(String(state.monthlyTarget));

  // ── Drive sheet ──────────────────────────────────────────────────────────
  const [showDriveSheet, setShowDriveSheet] = useState(false);
  const [driveClientIdInput, setDriveClientIdInput] = useState('');
  const [driveConnecting, setDriveConnecting] = useState(false);
  const [driveLoading, setDriveLoading] = useState(false);

  // Auto-load from Drive on mount
  useEffect(() => {
    if (state.driveStatus.connected && !state.driveStatus.syncing) {
      loadFromDrive().catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Exit manage mode when vendors become empty
  useEffect(() => {
    if (state.vendors.length === 0) {
      setManageMode(false);
      setSelectedIds(new Set());
    }
  }, [state.vendors.length]);

  // ── Vendor add/edit ──────────────────────────────────────────────────────
  function openAddVendor() {
    setEditingVendor(null); setVendorName(''); setVendorCut('');
    setShowVendorSheet(true);
  }

  function openEditVendor(v: { id: string; name: string; cutPercent: number }) {
    setEditingVendor(v.id);
    setVendorName(v.name);
    setVendorCut(String(v.cutPercent));
    setShowVendorSheet(true);
  }

  function saveVendor() {
    if (!vendorName.trim() || !vendorCut) { toast.error('Fill all fields'); return; }
    const cut = parseFloat(vendorCut);
    if (isNaN(cut) || cut <= 0 || cut > 100) { toast.error('Cut % must be 1–100'); return; }
    if (editingVendor) {
      updateVendor(editingVendor, vendorName.trim(), cut);
      toast.success('Vendor updated!');
    } else {
      addVendor(vendorName.trim(), cut);
      toast.success('Vendor added!');
    }
    setShowVendorSheet(false);
    setVendorName(''); setVendorCut(''); setEditingVendor(null);
  }

  // ── Vendor delete (2-step) ───────────────────────────────────────────────
  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function confirmDelete() {
    const count = selectedIds.size;
    selectedIds.forEach(id => deleteVendor(id));
    setSelectedIds(new Set());
    setManageMode(false);
    setShowDeleteConfirm(false);
    toast.success(`${count} vendor${count > 1 ? 's' : ''} deleted`);
  }

  const ds = state.driveStatus;
  const selectedNames = state.vendors.filter(v => selectedIds.has(v.id)).map(v => v.name);

  return (
    <div style={{ padding: '24px 20px 100px' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1A1816', margin: '0 0 20px' }}>Settings</h2>

      {/* ── GOOGLE DRIVE ──────────────────────────────────────────────────── */}
      <div style={{ borderRadius: 18, padding: '18px 16px', marginBottom: 16, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.06)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: ds.connected ? 14 : 0 }}>
          <div>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#8B8579', letterSpacing: '0.06em', margin: '0 0 4px' }}>GOOGLE DRIVE</p>
            {ds.connected
              ? <p style={{ fontSize: 13, color: '#5C9A6F', margin: 0, fontWeight: 500 }}>● {ds.userEmail}</p>
              : <p style={{ fontSize: 13, color: '#ADA79F', margin: 0 }}>Back up all bills & vendors automatically</p>}
          </div>
          {ds.connected ? (
            <button onClick={() => { disconnectDrive(); toast.success('Disconnected'); }}
              style={{ fontSize: 12, fontWeight: 600, color: '#C45C4A', background: '#FBF0EE', padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer' }}>
              Disconnect
            </button>
          ) : (
            <button onClick={() => setShowDriveSheet(true)}
              style={{ fontSize: 13, fontWeight: 700, color: '#fff', background: '#4285F4', padding: '7px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57C21.36 18.52 22.56 15.59 22.56 12.25z" fill="#fff"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/></svg>
              Connect
            </button>
          )}
        </div>

        {ds.connected && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderRadius: 12, background: '#F5F0EB', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FolderOpen style={{ width: 15, height: 15, color: '#D97757' }} />
                <div>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#6B6560', margin: 0 }}>BillerPRO Data/</p>
                  <p style={{ fontSize: 11, color: '#ADA79F', margin: 0 }}>{state.bills.length} bills · {state.vendors.length} vendors</p>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                {ds.syncing
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: '#D97757' }}>
                      <Loader2 style={{ width: 13, height: 13, animation: 'spin 1s linear infinite' }} />
                      <span style={{ fontSize: 11 }}>Syncing...</span>
                    </div>
                  : ds.syncError
                    ? <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#C45C4A' }}>
                        <AlertCircle style={{ width: 13, height: 13 }} />
                        <span style={{ fontSize: 11 }}>Sync failed</span>
                      </div>
                    : <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#5C9A6F' }}>
                        <CheckCircle2 style={{ width: 13, height: 13 }} />
                        <span style={{ fontSize: 11 }}>{timeAgo(ds.lastSync)}</span>
                      </div>}
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#ADA79F', margin: '0 0 10px', lineHeight: 1.5, padding: '0 4px' }}>
              Every bill scan, vendor change & target update saves automatically to your Google Drive.
            </p>
            <button disabled={driveLoading || ds.syncing}
              onClick={async () => {
                setDriveLoading(true);
                const ok = await loadFromDrive();
                setDriveLoading(false);
                if (ok) toast.success('Loaded from Drive!');
                else toast.error(ds.syncError || 'Could not load from Drive');
              }}
              style={{ width: '100%', padding: '11px 0', borderRadius: 12, border: 'none', cursor: 'pointer', background: driveLoading ? '#E8E2D9' : '#F5F0EB', color: '#6B6560', fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              {driveLoading
                ? <><Loader2 style={{ width: 14, height: 14, animation: 'spin 1s linear infinite' }} /> Loading...</>
                : <><RefreshCw style={{ width: 14, height: 14 }} /> Load latest from Drive</>}
            </button>
          </div>
        )}
      </div>

      {/* ── VENDORS ───────────────────────────────────────────────────────── */}
      <div style={{ borderRadius: 18, padding: '18px 16px', marginBottom: 16, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.06)' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#8B8579', letterSpacing: '0.06em', margin: 0 }}>VENDORS</p>
            {/* Live count badge */}
            {state.vendors.length > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, color: '#D97757', background: '#FDF5F0', padding: '2px 7px', borderRadius: 99, border: '1px solid rgba(217,119,87,0.2)' }}>
                {state.vendors.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {state.vendors.length > 0 && (
              <button
                onClick={() => { setManageMode(m => !m); setSelectedIds(new Set()); }}
                style={{ fontSize: 13, fontWeight: 600, color: manageMode ? '#C45C4A' : '#8B8579', background: manageMode ? '#FBF0EE' : '#F5F0EB', padding: '6px 12px', borderRadius: 9, border: 'none', cursor: 'pointer' }}>
                {manageMode ? 'Cancel' : 'Manage'}
              </button>
            )}
            {!manageMode && (
              <button onClick={openAddVendor}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#D97757', background: '#FDF5F0', padding: '6px 12px', borderRadius: 9, border: 'none', cursor: 'pointer' }}>
                <Plus style={{ width: 14, height: 14 }} /> Add
              </button>
            )}
          </div>
        </div>

        {/* Manage mode hint */}
        {manageMode && (
          <div style={{ padding: '8px 12px', borderRadius: 10, background: '#FDF5F0', marginBottom: 12 }}>
            <p style={{ fontSize: 12, color: '#D97757', margin: 0, fontWeight: 500 }}>
              Tap vendors to select them, then tap Delete
            </p>
          </div>
        )}

        {/* Vendor list */}
        {state.vendors.length === 0
          ? <p style={{ fontSize: 14, color: '#ADA79F', textAlign: 'center', padding: '16px 0', margin: 0 }}>No vendors yet — tap Add to get started</p>
          : state.vendors.map((v, i) => {
            const isSelected = selectedIds.has(v.id);
            return (
              <motion.div key={v.id} layout
                onClick={() => manageMode && toggleSelect(v.id)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 10px', marginBottom: 4, borderRadius: 12,
                  background: isSelected ? '#FDF5F0' : 'transparent',
                  border: isSelected ? '1.5px solid rgba(217,119,87,0.3)' : '1.5px solid transparent',
                  cursor: manageMode ? 'pointer' : 'default',
                  transition: 'background 0.15s, border 0.15s',
                }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {/* Checkbox in manage mode */}
                  {manageMode && (
                    <div style={{
                      width: 22, height: 22, borderRadius: 6, border: `2px solid ${isSelected ? '#D97757' : '#C4BFB6'}`,
                      background: isSelected ? '#D97757' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      {isSelected && <span style={{ color: '#fff', fontSize: 13, fontWeight: 700 }}>✓</span>}
                    </div>
                  )}
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: v.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: v.color }}>{v.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: '#1A1816', margin: '0 0 2px' }}>{v.name}</p>
                    <p style={{ fontSize: 12, color: '#8B8579', margin: 0 }}>{v.cutPercent}% commission cut</p>
                  </div>
                </div>
                {/* Edit button — only in normal mode */}
                {!manageMode && (
                  <button onClick={() => openEditVendor(v)}
                    style={{ width: 32, height: 32, borderRadius: 9, background: '#F5F0EB', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Pencil style={{ width: 14, height: 14, color: '#6B6560' }} />
                  </button>
                )}
              </motion.div>
            );
          })}

        {/* Delete button — only visible in manage mode when something selected */}
        <AnimatePresence>
          {manageMode && selectedIds.size > 0 && (
            <motion.button
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              onClick={() => setShowDeleteConfirm(true)}
              style={{ width: '100%', marginTop: 12, padding: '13px 0', borderRadius: 13, background: '#C45C4A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Trash2 style={{ width: 15, height: 15 }} />
              Delete {selectedIds.size} vendor{selectedIds.size > 1 ? 's' : ''}
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── MONTHLY TARGET ────────────────────────────────────────────────── */}
      <div style={{ borderRadius: 18, padding: '18px 16px', marginBottom: 16, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.06)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#8B8579', letterSpacing: '0.06em', margin: '0 0 12px' }}>MONTHLY TARGET</p>
        {editingTarget ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <span style={{ fontSize: 22, color: '#8B8579' }}>₹</span>
              <input type="number" value={targetValue} onChange={e => setTargetValue(e.target.value)} autoFocus
                style={{ flex: 1, fontSize: 28, fontWeight: 700, color: '#1A1816', background: 'transparent', border: 'none', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => { const v = parseFloat(targetValue); if (v > 0) { setMonthlyTarget(v); setEditingTarget(false); toast.success('Target updated!'); } }}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#D97757', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Save
              </button>
              <button onClick={() => setEditingTarget(false)}
                style={{ flex: 1, padding: '11px 0', borderRadius: 12, background: '#F0EBE3', color: '#6B6560', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 26, fontWeight: 700, color: '#1A1816', margin: '0 0 2px' }}>
                {state.monthlyTarget > 0 ? formatCurrency(state.monthlyTarget) : 'Not set'}
              </p>
              <p style={{ fontSize: 12, color: '#ADA79F', margin: 0 }}>earnings target per month</p>
            </div>
            <button onClick={() => { setTargetValue(String(state.monthlyTarget)); setEditingTarget(true); }}
              style={{ fontSize: 14, fontWeight: 600, color: '#D97757', background: '#FDF5F0', padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer' }}>
              Edit
            </button>
          </div>
        )}
      </div>

      {/* ── EXPORT ────────────────────────────────────────────────────────── */}
      <div style={{ borderRadius: 18, padding: '18px 16px', marginBottom: 16, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.06)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#8B8579', letterSpacing: '0.06em', margin: '0 0 12px' }}>EXPORT DATA</p>
        {[
          { label: 'Export this month', sub: 'Current month as CSV', action: () => {
            const mb = state.bills.filter(b => b.date.startsWith(state.selectedMonth));
            if (!mb.length) { toast.error('No bills this month'); return; }
            exportMonthToCSV(state.bills, state.vendors, state.selectedMonth);
            toast.success(`Exported ${mb.length} bills!`);
          }},
          { label: 'Export all data', sub: 'All bills — opens in Excel', action: () => {
            if (!state.bills.length) { toast.error('No bills yet'); return; }
            exportToCSV(state.bills, state.vendors);
            toast.success(`Exported ${state.bills.length} bills!`);
          }},
        ].map((item, i) => (
          <button key={item.label} onClick={item.action}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px', borderBottom: i === 0 ? '1px solid #F5F0EB' : 'none', background: 'transparent', border: 'none', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Download style={{ width: 17, height: 17, color: '#5C9A6F' }} />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontSize: 15, color: '#1A1816', margin: '0 0 1px' }}>{item.label}</p>
                <p style={{ fontSize: 12, color: '#8B8579', margin: 0 }}>{item.sub}</p>
              </div>
            </div>
            <ChevronRight style={{ width: 17, height: 17, color: '#C4BFB6' }} />
          </button>
        ))}
      </div>

      {/* ── THEME ─────────────────────────────────────────────────────────── */}
      <div style={{ borderRadius: 18, padding: '18px 16px', marginBottom: 16, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.06)' }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: '#8B8579', letterSpacing: '0.06em', margin: '0 0 12px' }}>THEME</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {[
            { key: 'light' as const, label: 'Light', icon: Sun },
            { key: 'dark' as const, label: 'Dark', icon: Moon },
            { key: 'system' as const, label: 'System', icon: Monitor },
          ].map(t => (
            <button key={t.key} onClick={() => setTheme(t.key)}
              style={{ padding: '12px 0', borderRadius: 12, border: 'none', cursor: 'pointer', background: state.theme === t.key ? '#D97757' : '#F5F0EB', color: state.theme === t.key ? '#fff' : '#6B6560', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600 }}>
              <t.icon style={{ width: 17, height: 17 }} />
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SIGN OUT ──────────────────────────────────────────────────────── */}
      <button onClick={logout}
        style={{ width: '100%', padding: '14px 0', borderRadius: 14, background: '#FBF0EE', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600, color: '#C45C4A', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        <LogOut style={{ width: 17, height: 17 }} /> Sign Out
      </button>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SHEETS — all with zIndex: 100 to always sit above nav bar          */}
      {/* ════════════════════════════════════════════════════════════════════ */}

      {/* ── DELETE CONFIRM MODAL ──────────────────────────────────────────── */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,22,0.5)', backdropFilter: 'blur(4px)', zIndex: 100 }} />
            <div style={{ position: 'fixed', inset: 0, zIndex: 101, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.92 }}
                transition={{ type: 'spring', damping: 24, stiffness: 300 }}
                style={{ width: '100%', maxWidth: 340, borderRadius: 22, background: '#FFFFFF', padding: '28px 24px', boxShadow: '0 20px 60px rgba(26,24,22,0.2)' }}>

                {/* Warning icon */}
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FBF0EE', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <Trash2 style={{ width: 24, height: 24, color: '#C45C4A' }} />
                </div>

                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#1A1816', textAlign: 'center', margin: '0 0 8px' }}>
                  Delete {selectedIds.size > 1 ? `${selectedIds.size} Vendors` : 'Vendor'}?
                </h3>
                <p style={{ fontSize: 14, color: '#8B8579', textAlign: 'center', margin: '0 0 6px', lineHeight: 1.5 }}>
                  You are about to permanently delete:
                </p>
                {/* List selected vendor names */}
                <div style={{ background: '#F5F0EB', borderRadius: 10, padding: '10px 14px', margin: '0 0 16px' }}>
                  {selectedNames.map(name => (
                    <p key={name} style={{ fontSize: 14, fontWeight: 600, color: '#C45C4A', margin: '2px 0' }}>· {name}</p>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: '#ADA79F', textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
                  Bills linked to {selectedIds.size > 1 ? 'these vendors' : 'this vendor'} will lose their earnings calculation. This cannot be undone.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button onClick={confirmDelete}
                    style={{ width: '100%', padding: '14px 0', borderRadius: 13, background: '#C45C4A', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700 }}>
                    Yes, Delete {selectedIds.size > 1 ? 'All' : 'It'}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    style={{ width: '100%', padding: '13px 0', borderRadius: 13, background: '#F5F0EB', color: '#6B6560', border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 600 }}>
                    Cancel, Keep {selectedIds.size > 1 ? 'Them' : 'It'}
                  </button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── ADD / EDIT VENDOR SHEET ───────────────────────────────────────── */}
      <AnimatePresence>
        {showVendorSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowVendorSheet(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,22,0.4)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
            {/* Two-layer: outer centers, inner animates — same fix as HomeDashboard */}
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <motion.div
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{
                  width: '100%', maxWidth: 430,
                  borderRadius: '22px 22px 0 0',
                  background: '#FFFFFF',
                  boxShadow: '0 -8px 30px rgba(26,24,22,0.12)',
                  // Extra bottom padding to clear the nav bar + device home indicator
                  padding: '20px 24px 48px',
                  paddingBottom: 'max(48px, calc(48px + env(safe-area-inset-bottom)))',
                  pointerEvents: 'all',
                }}>
                <div style={{ width: 40, height: 4, borderRadius: 9999, background: '#E8E2D9', margin: '0 auto 18px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                  <h3 style={{ fontSize: 19, fontWeight: 700, color: '#1A1816', margin: 0 }}>
                    {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
                  </h3>
                  <button onClick={() => setShowVendorSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X style={{ width: 19, height: 19, color: '#8B8579' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#6B6560', display: 'block', marginBottom: 6 }}>Vendor Name</label>
                    <input
                      value={vendorName}
                      onChange={e => setVendorName(e.target.value)}
                      placeholder="e.g. F & F Decor"
                      autoFocus
                      style={{ width: '100%', padding: '13px 15px', borderRadius: 12, fontSize: 16, background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none', color: '#1A1816', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 13, fontWeight: 500, color: '#6B6560', display: 'block', marginBottom: 6 }}>Your Commission Cut (%)</label>
                    <input
                      type="number"
                      value={vendorCut}
                      onChange={e => setVendorCut(e.target.value)}
                      placeholder="e.g. 10"
                      style={{ width: '100%', padding: '13px 15px', borderRadius: 12, fontSize: 16, background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none', color: '#1A1816', boxSizing: 'border-box' }}
                    />
                  </div>
                  <motion.button whileTap={{ scale: 0.97 }} onClick={saveVendor}
                    style={{ padding: '15px 0', borderRadius: 14, color: '#fff', border: 'none', cursor: 'pointer', background: 'linear-gradient(135deg, #D97757, #C4613C)', fontSize: 16, fontWeight: 700, marginTop: 4 }}>
                    {editingVendor ? 'Save Changes' : 'Add Vendor'}
                  </motion.button>
                </div>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>

      {/* ── GOOGLE DRIVE CONNECT SHEET ────────────────────────────────────── */}
      <AnimatePresence>
        {showDriveSheet && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowDriveSheet(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,22,0.4)', backdropFilter: 'blur(2px)', zIndex: 100 }} />
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                style={{
                  width: '100%', maxWidth: 430,
                  borderRadius: '22px 22px 0 0', background: '#FFFFFF',
                  boxShadow: '0 -8px 30px rgba(26,24,22,0.12)',
                  padding: '20px 24px 48px',
                  paddingBottom: 'max(48px, calc(48px + env(safe-area-inset-bottom)))',
                  pointerEvents: 'all',
                  overflowY: 'auto', maxHeight: '85vh',
                }}>
                <div style={{ width: 40, height: 4, borderRadius: 9999, background: '#E8E2D9', margin: '0 auto 18px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <h3 style={{ fontSize: 19, fontWeight: 700, color: '#1A1816', margin: 0 }}>Connect Google Drive</h3>
                  <button onClick={() => setShowDriveSheet(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
                    <X style={{ width: 19, height: 19, color: '#8B8579' }} />
                  </button>
                </div>
                <p style={{ fontSize: 13, color: '#8B8579', margin: '0 0 16px', lineHeight: 1.5 }}>
                  Bills & vendors will be saved to <strong>"BillerPRO Data"</strong> in your Google Drive — automatically after every change.
                </p>
                <div style={{ background: '#EEF5F0', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#5C9A6F', margin: '0 0 6px' }}>What auto-syncs:</p>
                  {['Every bill scan → bill_xxxxx.json', 'Vendor list → billerpro_vendors.json', 'Monthly targets & settings', 'You own the files — delete anytime from Drive'].map((s, i) => (
                    <p key={i} style={{ fontSize: 12, color: '#5C9A6F', margin: '0 0 3px' }}>✓ {s}</p>
                  ))}
                </div>
                <div style={{ background: '#F5F0EB', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#6B6560', margin: '0 0 8px' }}>One-time setup (5 mins on laptop):</p>
                  {['Go to console.cloud.google.com', 'New project → Enable "Google Drive API"', 'Credentials → OAuth 2.0 Client ID → Web app', 'Add https://biller-pro.vercel.app as origin', 'Copy Client ID and paste below'].map((s, i) => (
                    <p key={i} style={{ fontSize: 12, color: '#6B6560', margin: '0 0 4px' }}>{i+1}. {s}</p>
                  ))}
                </div>
                <label style={{ fontSize: 13, fontWeight: 500, color: '#6B6560', display: 'block', marginBottom: 6 }}>Google OAuth Client ID</label>
                <input
                  value={driveClientIdInput || state.driveClientId}
                  onChange={e => setDriveClientIdInput(e.target.value)}
                  placeholder="xxxxxxx.apps.googleusercontent.com"
                  style={{ width: '100%', padding: '13px 15px', borderRadius: 12, fontSize: 13, background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none', color: '#1A1816', boxSizing: 'border-box', fontFamily: 'monospace', marginBottom: 14 }}
                />
                <motion.button whileTap={{ scale: 0.97 }} disabled={driveConnecting}
                  onClick={async () => {
                    const id = (driveClientIdInput || state.driveClientId).trim();
                    if (!id.includes('googleusercontent.com')) { toast.error('Invalid Client ID'); return; }
                    setDriveConnecting(true);
                    try {
                      await connectDrive(id);
                      setDriveClientIdInput('');
                      setShowDriveSheet(false);
                      toast.success('Google Drive connected! Auto-syncing from now.');
                      const ok = await loadFromDrive();
                      if (ok) toast.success('Loaded existing data from your Drive!');
                    } catch (e: any) {
                      toast.error(e.message || 'Connection failed — check Client ID');
                    } finally {
                      setDriveConnecting(false);
                    }
                  }}
                  style={{ width: '100%', padding: '14px 0', borderRadius: 14, color: '#fff', border: 'none', cursor: driveConnecting ? 'not-allowed' : 'pointer', background: driveConnecting ? '#9BB8F5' : 'linear-gradient(135deg, #4285F4, #2563EB)', fontSize: 15, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {driveConnecting
                    ? <><Loader2 style={{ width: 16, height: 16, animation: 'spin 1s linear infinite' }} /> Connecting...</>
                    : <>
                        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57C21.36 18.52 22.56 15.59 22.56 12.25z" fill="#fff"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#fff"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/></svg>
                        Sign in with Google
                      </>}
                </motion.button>
              </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
