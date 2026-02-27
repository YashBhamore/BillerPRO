import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { toast } from 'sonner';
import { ChevronLeft, Fingerprint } from 'lucide-react';

const ACCENT = '#D97757';
type View = 'welcome' | 'create-account' | 'pin-setup' | 'pin-login';

export function LoginPage() {
  const { login, setUserProfile } = useApp();
  const [view, setView] = useState<View>('welcome');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [name, setName] = useState('');
  const [business, setBusiness] = useState('');
  const [shake, setShake] = useState(false);

  const savedPin = localStorage.getItem('billerpro_pin');
  const savedName = localStorage.getItem('billerpro_username') || '';

  // Existing user → go straight to PIN login screen (skip welcome)
  useEffect(() => {
    if (savedPin && savedName) setView('pin-login');
  }, []);

  // Auto-verify login PIN
  useEffect(() => {
    if (view === 'pin-login' && pin.length === 4) {
      if (pin === savedPin) {
        setTimeout(() => login('user', 'pin'), 300);
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setPin(''); }, 600);
        toast.error('Wrong PIN, try again');
      }
    }
  }, [pin, view]);

  // Auto-verify confirm PIN during setup
  const isConfirmStep = view === 'pin-setup' && pin.length === 4;
  useEffect(() => {
    if (isConfirmStep && confirmPin.length === 4) {
      if (pin === confirmPin) {
        localStorage.setItem('billerpro_pin', pin);
        localStorage.setItem('billerpro_username', name);
        setUserProfile({ name, businessName: business || name + "'s Business", email: '' });
        setTimeout(() => { login('user', 'pin'); toast.success('Welcome, ' + name.split(' ')[0] + '!'); }, 300);
      } else {
        setShake(true);
        setTimeout(() => { setShake(false); setConfirmPin(''); }, 600);
        toast.error("PINs don't match");
      }
    }
  }, [confirmPin]);

  const activePin = isConfirmStep ? confirmPin : pin;

  const handleDigit = (d: string) => {
    if (activePin.length >= 4) return;
    isConfirmStep ? setConfirmPin(c => c + d) : setPin(p => p + d);
  };
  const handleBack = () => {
    isConfirmStep ? setConfirmPin(c => c.slice(0,-1)) : setPin(p => p.slice(0,-1));
  };

  const PinDots = ({ value, shaking }: { value: string; shaking: boolean }) => (
    <motion.div className="flex gap-5 justify-center my-8"
      animate={shaking ? { x: [-10,10,-10,10,0] } : {}}
      transition={{ duration: 0.4 }}>
      {[0,1,2,3].map(i => (
        <motion.div key={i}
          className="w-4 h-4 rounded-full border-2"
          style={{ background: i < value.length ? ACCENT : 'transparent', borderColor: i < value.length ? ACCENT : '#E8E2D9' }}
          animate={{ scale: i === value.length - 1 ? [1, 1.4, 1] : 1 }}
          transition={{ duration: 0.15 }} />
      ))}
    </motion.div>
  );

  const Keypad = () => (
    <div className="grid grid-cols-3 gap-3 max-w-[280px] mx-auto">
      {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((key, i) => (
        <motion.button key={i} whileTap={{ scale: key ? 0.88 : 1 }}
          onClick={() => key === '⌫' ? handleBack() : key ? handleDigit(key) : null}
          style={{
            height: 64, borderRadius: 16, fontSize: key === '⌫' ? 22 : 26, fontWeight: 500,
            color: '#1A1816', background: key ? '#FFFFFF' : 'transparent',
            boxShadow: key ? '0 1px 4px rgba(26,24,22,0.08)' : 'none',
            visibility: (!key && key !== '0') ? 'hidden' : 'visible',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', cursor: key ? 'pointer' : 'default',
          }}>
          {key}
        </motion.button>
      ))}
    </div>
  );

  return (
    <div className="h-full flex flex-col" style={{ background: '#FAF9F6' }}>
      <AnimatePresence mode="wait">

        {/* ── WELCOME ── */}
        {view === 'welcome' && (
          <motion.div key="welcome"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }}
            className="h-full flex flex-col">

            {/* Hero area */}
            <div className="flex-[1.3] relative flex items-center justify-center overflow-hidden"
              style={{ background: 'linear-gradient(180deg, #F3EAE0 0%, #FAF0E6 50%, #FAF9F6 100%)' }}>

              {/* Background decorative circles */}
              <div className="absolute top-8 left-6 w-24 h-24 rounded-full" style={{ background: ACCENT, opacity: 0.06 }} />
              <div className="absolute top-32 right-4 w-14 h-14 rounded-full" style={{ background: '#D4A853', opacity: 0.05 }} />
              <div className="absolute bottom-24 left-10 w-10 h-10 rounded-full" style={{ background: '#5C9A6F', opacity: 0.05 }} />

              {/* App icon + floating stat cards */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>

                <div style={{
                  width: 120, height: 120, borderRadius: 32,
                  background: 'linear-gradient(135deg, #D97757, #C4613C)',
                  boxShadow: '0 20px 60px rgba(217,119,87,0.4), 0 4px 16px rgba(26,24,22,0.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 54,
                }}>BP</div>

                {/* Floating card left */}
                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  style={{
                    position: 'absolute', left: -64, top: 8,
                    background: '#FFFFFF', borderRadius: 12, padding: '8px 14px',
                    boxShadow: '0 4px 20px rgba(26,24,22,0.12)',
                  }}>
                  <p style={{ fontSize: 10, color: '#8B8579', margin: 0 }}>Earnings</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#5C9A6F', margin: 0 }}>₹14,270</p>
                </motion.div>

                {/* Floating card right */}
                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 }}
                  style={{
                    position: 'absolute', right: -60, top: 20,
                    background: '#FFFFFF', borderRadius: 12, padding: '8px 14px',
                    boxShadow: '0 4px 20px rgba(26,24,22,0.12)',
                  }}>
                  <p style={{ fontSize: 10, color: '#8B8579', margin: 0 }}>Cut %</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: ACCENT, margin: 0 }}>11.5%</p>
                </motion.div>
              </motion.div>

              {/* Bottom fade into page */}
              <div className="absolute bottom-0 left-0 right-0 h-20 pointer-events-none"
                style={{ background: 'linear-gradient(transparent, #FAF9F6)' }} />
            </div>

            {/* Text + CTA */}
            <div className="flex-[0.85] flex flex-col items-center justify-center px-8 pb-10">
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }} className="text-center mb-8">
                <h1 style={{ fontSize: 38, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                  BillerPRO
                </h1>
                <p className="mt-2 text-[#6B6560]" style={{ fontSize: 16, fontWeight: 500 }}>
                  Track your bills. Know your earnings.
                </p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }} className="w-full space-y-3">
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => setView('create-account')}
                  className="w-full py-4 rounded-2xl text-white"
                  style={{
                    background: `linear-gradient(135deg, ${ACCENT}, #C4613C)`,
                    fontSize: 17, fontWeight: 600,
                    boxShadow: '0 6px 20px rgba(217,119,87,0.35)',
                    border: 'none', cursor: 'pointer',
                  }}>
                  Get Started
                </motion.button>
                <p className="text-center text-[#C4BFB6]" style={{ fontSize: 13 }}>
                  Private · No account needed · Data stays on your device
                </p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── CREATE ACCOUNT ── */}
        {view === 'create-account' && (
          <motion.div key="create"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.22 }}
            className="h-full flex flex-col px-7 overflow-y-auto" style={{ paddingTop: 56, paddingBottom: 32 }}>

            <button onClick={() => setView('welcome')}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, color: '#8B8579', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 32 }}>
              <ChevronLeft size={16} /> Back
            </button>

            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1A1816', margin: 0 }}>Your Profile</h2>
            <p style={{ color: '#8B8579', fontSize: 15, marginTop: 6, marginBottom: 32 }}>
              Just your name — to personalise the app
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#6B6560', display: 'block', marginBottom: 6 }}>Your Name *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Ramesh Mehta" autoFocus
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 16, background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none', color: '#1A1816', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#6B6560', display: 'block', marginBottom: 6 }}>
                  Business Name <span style={{ fontWeight: 400, color: '#C4BFB6' }}>(optional)</span>
                </label>
                <input value={business} onChange={e => setBusiness(e.target.value)}
                  placeholder="e.g. Mehta Trading Co."
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 16, background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none', color: '#1A1816', boxSizing: 'border-box' }} />
              </div>
            </div>

            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => { if (!name.trim()) { toast.error('Please enter your name'); return; } setView('pin-setup'); }}
              style={{
                width: '100%', marginTop: 32, padding: '16px 0', borderRadius: 16, color: '#FFFFFF',
                background: `linear-gradient(135deg, ${ACCENT}, #C4613C)`, fontSize: 17, fontWeight: 600,
                boxShadow: '0 4px 16px rgba(217,119,87,0.3)', border: 'none', cursor: 'pointer',
              }}>
              Set Up PIN →
            </motion.button>
          </motion.div>
        )}

        {/* ── PIN SETUP ── */}
        {view === 'pin-setup' && (
          <motion.div key="pin-setup"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.22 }}
            className="h-full flex flex-col px-7" style={{ paddingTop: 56, paddingBottom: 32 }}>

            <button onClick={() => { setView('create-account'); setPin(''); setConfirmPin(''); }}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, color: '#8B8579', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 32 }}>
              <ChevronLeft size={16} /> Back
            </button>

            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FDF5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Fingerprint size={28} color={ACCENT} />
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 700, color: '#1A1816', margin: 0 }}>
                {!isConfirmStep ? 'Create your PIN' : 'Confirm your PIN'}
              </h2>
              <p style={{ color: '#8B8579', fontSize: 15, marginTop: 8 }}>
                {!isConfirmStep ? '4-digit PIN to protect your data' : 'Enter the same PIN again'}
              </p>
              <PinDots value={activePin} shaking={shake} />
            </div>

            <Keypad />
          </motion.div>
        )}

        {/* ── PIN LOGIN (returning user) ── */}
        {view === 'pin-login' && (
          <motion.div key="pin-login"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}
            className="h-full flex flex-col px-7" style={{ paddingTop: 64, paddingBottom: 32 }}>

            <div style={{ textAlign: 'center', flex: 1 }}>
              {/* Logo */}
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
                style={{
                  width: 88, height: 88, borderRadius: 26,
                  background: 'linear-gradient(135deg, #D97757, #C4613C)',
                  boxShadow: '0 12px 32px rgba(217,119,87,0.35)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 42, margin: '0 auto 16px',
                }}>BP</motion.div>

              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                style={{ fontSize: 30, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em', margin: 0 }}>
                BillerPRO
              </motion.h1>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                style={{ color: '#8B8579', fontSize: 15, marginTop: 6 }}>
                Welcome back, {savedName.split(' ')[0]}
              </motion.p>

              <PinDots value={pin} shaking={shake} />
            </div>

            <Keypad />

            <button
              onClick={() => { localStorage.removeItem('billerpro_pin'); localStorage.removeItem('billerpro_username'); setPin(''); setView('welcome'); }}
              style={{ marginTop: 20, color: '#C4BFB6', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer' }}>
              Not {savedName.split(' ')[0]}? Switch account
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
