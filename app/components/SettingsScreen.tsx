import React, { useState } from 'react';
import { useApp } from '../store';
import { Pencil, Trash2, Plus, Download, Moon, Sun, Monitor, Bell, ChevronRight, X, Shield, LogOut } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';

function formatCurrency(val: number) {
  return '₹' + val.toLocaleString('en-IN');
}

export function SettingsScreen() {
  const {
    state, setUserProfile, setMonthlyTarget,
    addVendor, updateVendor, deleteVendor, logout, setTheme,
  } = useApp();

  const [showVendorSheet, setShowVendorSheet] = useState(false);
  const [editingVendor, setEditingVendor] = useState<string | null>(null);
  const [vendorName, setVendorName] = useState('');
  const [vendorCut, setVendorCut] = useState('');
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetValue, setTargetValue] = useState(String(state.monthlyTarget));
  const [editingField, setEditingField] = useState<string | null>(null);

  const [notifications, setNotifications] = useState({
    billReminder: true,
    targetAlerts: true,
    milestoneNotifs: true,
  });

  const openAddVendor = () => {
    setEditingVendor(null);
    setVendorName('');
    setVendorCut('');
    setShowVendorSheet(true);
  };

  const openEditVendor = (id: string) => {
    const v = state.vendors.find(v => v.id === id);
    if (!v) return;
    setEditingVendor(id);
    setVendorName(v.name);
    setVendorCut(String(v.cutPercent));
    setShowVendorSheet(true);
  };

  const saveVendor = () => {
    if (!vendorName || !vendorCut) { toast.error('Fill all fields'); return; }
    if (editingVendor) {
      updateVendor(editingVendor, vendorName, parseFloat(vendorCut));
      toast.success('Vendor updated');
    } else {
      addVendor(vendorName, parseFloat(vendorCut));
      toast.success('Vendor added');
    }
    setShowVendorSheet(false);
  };

  const saveTarget = () => {
    setMonthlyTarget(parseInt(targetValue) || 0);
    setEditingTarget(false);
    toast.success('Target updated');
  };

  return (
    <div className="min-h-full px-5 pt-6 pb-5">
      <div className="mb-6">
        <h2 className="text-[#1A1816] mb-1" style={{ fontSize: 22, fontWeight: 700 }}>Settings</h2>
        <p className="text-[#8B8579]" style={{ fontSize: 15 }}>Manage your account and preferences</p>
      </div>

      {/* Profile */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
        <p className="text-[#8B8579] mb-4" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>PROFILE</p>
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-white flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #D97757, #C4613C)', fontSize: 22, fontWeight: 700 }}
          >
            {state.user.name.split(' ').map(w => w[0]).join('')}
          </div>
          <div className="flex-1">
            {editingField === 'name' ? (
              <input
                value={state.user.name}
                onChange={e => setUserProfile({ name: e.target.value })}
                onBlur={() => setEditingField(null)}
                className="text-[#1A1816] rounded-lg px-3 py-2 w-full outline-none focus:border-[#D97757]"
                style={{ fontSize: 17, fontWeight: 600, background: '#F5F0EB', border: '1px solid #E8E2D9' }}
                autoFocus
              />
            ) : (
              <button onClick={() => setEditingField('name')} className="flex items-center gap-2 text-left">
                <span className="text-[#1A1816]" style={{ fontSize: 18, fontWeight: 700 }}>{state.user.name}</span>
                <Pencil className="w-3.5 h-3.5 text-[#C4BFB6]" />
              </button>
            )}
            {editingField === 'business' ? (
              <input
                value={state.user.businessName}
                onChange={e => setUserProfile({ businessName: e.target.value })}
                onBlur={() => setEditingField(null)}
                className="text-[#6B6560] rounded-lg px-3 py-2 w-full outline-none focus:border-[#D97757] mt-1"
                style={{ fontSize: 15, background: '#F5F0EB', border: '1px solid #E8E2D9' }}
                autoFocus
              />
            ) : (
              <button onClick={() => setEditingField('business')} className="flex items-center gap-2 text-left mt-0.5">
                <span className="text-[#8B8579]" style={{ fontSize: 15 }}>{state.user.businessName}</span>
                <Pencil className="w-3 h-3 text-[#C4BFB6]" />
              </button>
            )}
          </div>
        </div>
        <p className="text-[#8B8579]" style={{ fontSize: 14 }}>{state.user.email}</p>
      </div>

      {/* Vendors */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-[#8B8579]" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>VENDORS</p>
          <button onClick={openAddVendor} className="flex items-center gap-1 text-[#D97757]" style={{ fontSize: 14, fontWeight: 600 }}>
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
        <div className="space-y-2">
          {state.vendors.map(v => (
            <div key={v.id} className="flex items-center gap-3 py-3" style={{ borderBottom: '1px solid #F0EBE3' }}>
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-white flex-shrink-0" style={{ background: v.color, fontSize: 13, fontWeight: 700 }}>
                {v.name.split(' ').map(w => w[0]).join('').substring(0, 2)}
              </div>
              <span className="flex-1 text-[#1A1816] truncate" style={{ fontSize: 16, fontWeight: 500 }}>{v.name}</span>
              <span className="px-2.5 py-1 rounded-md flex-shrink-0" style={{ background: v.color + '15', color: v.color, fontSize: 14, fontWeight: 700 }}>{v.cutPercent}%</span>
              <button onClick={() => openEditVendor(v.id)} className="p-1.5 rounded-lg hover:bg-[#F5F0EB]">
                <Pencil className="w-4 h-4 text-[#8B8579]" />
              </button>
              <button onClick={() => { deleteVendor(v.id); toast.success('Deleted'); }} className="p-1.5 rounded-lg hover:bg-[#FBF0EE]">
                <Trash2 className="w-4 h-4 text-[#C45C4A]/50" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly Target */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
        <p className="text-[#8B8579] mb-3" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>MONTHLY TARGET</p>
        {editingTarget ? (
          <div className="flex items-center gap-2">
            <span className="text-[#1A1816]" style={{ fontSize: 20, fontWeight: 700 }}>₹</span>
            <input
              type="number"
              value={targetValue}
              onChange={e => setTargetValue(e.target.value)}
              className="flex-1 text-[#1A1816] rounded-lg px-3 py-2.5 outline-none focus:border-[#D97757]"
              style={{ fontSize: 18, fontWeight: 600, background: '#F5F0EB', border: '1px solid #E8E2D9' }}
              autoFocus
            />
            <button onClick={saveTarget} className="px-4 py-2.5 rounded-lg text-white" style={{ background: '#D97757', fontSize: 15, fontWeight: 600 }}>
              Save
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[#1A1816]" style={{ fontSize: 24, fontWeight: 700 }}>{formatCurrency(state.monthlyTarget)}</span>
            <button onClick={() => { setTargetValue(String(state.monthlyTarget)); setEditingTarget(true); }} className="text-[#D97757]" style={{ fontSize: 15, fontWeight: 600 }}>
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Export */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
        <p className="text-[#8B8579] mb-3" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>DATA & EXPORT</p>
        {['Export to Excel', "Export this month's data", 'Export all data'].map(label => (
          <button
            key={label}
            onClick={() => toast.success('Export started!')}
            className="w-full flex items-center justify-between py-3.5 last:border-0 transition-all hover:bg-[#F5F0EB] rounded-lg px-1"
            style={{ borderBottom: '1px solid #F0EBE3' }}
          >
            <div className="flex items-center gap-3">
              <Download className="w-[18px] h-[18px] text-[#8B8579]" />
              <span className="text-[#1A1816]" style={{ fontSize: 16 }}>{label}</span>
            </div>
            <ChevronRight className="w-[18px] h-[18px] text-[#C4BFB6]" />
          </button>
        ))}
      </div>

      {/* Notifications */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
        <p className="text-[#8B8579] mb-3" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>NOTIFICATIONS</p>
        {[
          { key: 'billReminder' as const, label: 'Bill Upload Reminder' },
          { key: 'targetAlerts' as const, label: 'Monthly Target Alerts' },
          { key: 'milestoneNotifs' as const, label: 'Milestone Notifications' },
        ].map(item => (
          <div key={item.key} className="flex items-center justify-between py-3.5" style={{ borderBottom: '1px solid #F0EBE3' }}>
            <span className="text-[#1A1816]" style={{ fontSize: 16 }}>{item.label}</span>
            <button
              onClick={() => setNotifications(n => ({ ...n, [item.key]: !n[item.key] }))}
              className="w-12 h-7 rounded-full p-0.5 transition-colors"
              style={{ background: notifications[item.key] ? '#D97757' : '#E8E2D9' }}
            >
              <motion.div
                className="w-6 h-6 rounded-full bg-white"
                style={{ boxShadow: '0 1px 3px rgba(26,24,22,0.15)' }}
                animate={{ x: notifications[item.key] ? 20 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
        ))}
      </div>

      {/* App */}
      <div className="rounded-2xl p-5 mb-4" style={{ background: '#FFFFFF', boxShadow: '0 1px 3px rgba(26,24,22,0.05)' }}>
        <p className="text-[#8B8579] mb-3" style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.05em' }}>APP</p>
        <div className="flex items-center justify-between py-3.5" style={{ borderBottom: '1px solid #F0EBE3' }}>
          <span className="text-[#1A1816]" style={{ fontSize: 16 }}>Theme</span>
          <div className="flex gap-1 rounded-lg p-1" style={{ background: '#F0EBE3' }}>
            {[
              { key: 'light', icon: Sun },
              { key: 'dark', icon: Moon },
              { key: 'system', icon: Monitor },
            ].map(t => (
              <button
                key={t.key}
                className="w-9 h-8 rounded-md flex items-center justify-center transition-all"
                style={{ background: state.theme === t.key ? '#FFFFFF' : 'transparent', boxShadow: state.theme === t.key ? '0 1px 2px rgba(26,24,22,0.06)' : 'none' }}
                onClick={() => setTheme(t.key as 'light' | 'dark' | 'system')}
              >
                <t.icon className="w-4 h-4" style={{ color: state.theme === t.key ? '#D97757' : '#8B8579' }} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between py-3.5" style={{ borderBottom: '1px solid #F0EBE3' }}>
          <span className="text-[#1A1816]" style={{ fontSize: 16 }}>Currency</span>
          <span className="text-[#6B6560]" style={{ fontSize: 16 }}>₹ INR</span>
        </div>
        <div className="flex items-center justify-between py-3.5" style={{ borderBottom: '1px solid #F0EBE3' }}>
          <div className="flex items-center gap-2">
            <Shield className="w-[18px] h-[18px] text-[#8B8579]" />
            <span className="text-[#1A1816]" style={{ fontSize: 16 }}>Security</span>
          </div>
          <ChevronRight className="w-[18px] h-[18px] text-[#C4BFB6]" />
        </div>
      </div>

      {/* Logout & Danger */}
      <div className="space-y-3">
        <button
          onClick={logout}
          className="w-full py-4 rounded-xl flex items-center justify-center gap-2 text-[#6B6560] transition-all hover:bg-[#F5F0EB]"
          style={{ fontSize: 16, fontWeight: 600, background: '#FFFFFF', border: '1px solid #E8E2D9' }}
        >
          <LogOut className="w-[18px] h-[18px]" /> Sign Out
        </button>
        <button
          onClick={() => toast.error('This action cannot be undone!')}
          className="w-full py-4 rounded-xl text-[#C45C4A] transition-all hover:bg-[#FBE9E5]"
          style={{ fontSize: 16, fontWeight: 500, background: '#FBF0EE', border: '1px solid rgba(196,92,74,0.1)' }}
        >
          Clear All Data
        </button>
      </div>

      {/* Vendor Sheet */}
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
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 rounded-t-3xl z-50"
              style={{ background: '#FFFFFF', boxShadow: '0 -8px 30px rgba(26,24,22,0.1)' }}
            >
              <div className="flex justify-center pt-3 pb-1">
                <div className="w-10 h-1 rounded-full bg-[#E8E2D9]" />
              </div>
              <div className="px-6 pb-8">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[#1A1816]" style={{ fontSize: 22, fontWeight: 700 }}>
                    {editingVendor ? 'Edit Vendor' : 'Add Vendor'}
                  </h3>
                  <button onClick={() => setShowVendorSheet(false)} className="p-1.5 rounded-lg hover:bg-[#F5F0EB]">
                    <X className="w-5 h-5 text-[#8B8579]" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="text-[#6B6560] mb-1.5 block" style={{ fontSize: 15, fontWeight: 500 }}>Vendor Name</label>
                    <input
                      value={vendorName}
                      onChange={e => setVendorName(e.target.value)}
                      placeholder="e.g. Sharma Traders"
                      className="w-full px-4 py-3.5 rounded-xl text-[#1A1816] outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/10"
                      style={{ fontSize: 17, background: '#F5F0EB', border: '1px solid #E8E2D9' }}
                    />
                  </div>
                  <div>
                    <label className="text-[#6B6560] mb-1.5 block" style={{ fontSize: 15, fontWeight: 500 }}>Commission (%)</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={vendorCut}
                        onChange={e => setVendorCut(e.target.value)}
                        placeholder="10"
                        className="w-full px-4 py-3.5 rounded-xl text-[#1A1816] outline-none focus:border-[#D97757] focus:ring-2 focus:ring-[#D97757]/10 pr-10"
                        style={{ fontSize: 17, background: '#F5F0EB', border: '1px solid #E8E2D9' }}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#8B8579]" style={{ fontSize: 16 }}>%</span>
                    </div>
                  </div>
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={saveVendor}
                  className="w-full mt-6 py-4 rounded-xl text-white"
                  style={{ background: 'linear-gradient(135deg, #D97757, #C4613C)', fontSize: 17, fontWeight: 600, boxShadow: '0 4px 14px rgba(217,119,87,0.3)' }}
                >
                  {editingVendor ? 'Update Vendor' : 'Save Vendor'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}