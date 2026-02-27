import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useApp } from '../store';
import { toast } from 'sonner';
import { ChevronLeft, Fingerprint, FolderOpen } from 'lucide-react';

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

  useEffect(() => {
    if (savedPin && savedName) setView('pin-login');
  }, []);

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

  const isConfirmStep = view === 'pin-setup' && pin.length === 4;

  useEffect(() => {
    if (isConfirmStep && confirmPin.length === 4) {
      if (pin === confirmPin) {
        localStorage.setItem('billerpro_pin', pin);
        localStorage.setItem('billerpro_username', name);
        setUserProfile({ name, businessName: business || name + "'s Business", email: '' });
        setTimeout(() => { login('user', 'pin'); toast.success('Welcome, ' + name.split(' ')[0] + '! 🎉'); }, 300);
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
  const handleBackspace = () => {
    isConfirmStep ? setConfirmPin(c => c.slice(0,-1)) : setPin(p => p.slice(0,-1));
  };

  // PIN dots
  const PinDots = ({ value, shaking }: { value: string; shaking: boolean }) => (
    <motion.div
      style={{ display: 'flex', gap: 20, justifyContent: 'center', margin: '28px 0' }}
      animate={shaking ? { x: [-10,10,-10,10,0] } : {}}
      transition={{ duration: 0.4 }}
    >
      {[0,1,2,3].map(i => (
        <motion.div
          key={i}
          animate={{ scale: i === value.length - 1 ? [1, 1.4, 1] : 1 }}
          transition={{ duration: 0.15 }}
          style={{
            width: 14, height: 14, borderRadius: '50%',
            background: i < value.length ? ACCENT : 'transparent',
            border: `2px solid ${i < value.length ? ACCENT : '#E8E2D9'}`,
          }}
        />
      ))}
    </motion.div>
  );

  // Compact square keypad — fixed size buttons, not stretched
  const Keypad = () => {
    const keys = ['1','2','3','4','5','6','7','8','9','','0','del'];
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 72px)',
        gridTemplateRows: 'repeat(4, 64px)',
        gap: 12,
        justifyContent: 'center',
        margin: '0 auto',
      }}>
        {keys.map((key, i) => {
          const isEmpty = key === '';
          const isDel = key === 'del';
          return (
            <motion.button
              key={i}
              whileTap={{ scale: isEmpty ? 1 : 0.88 }}
              onClick={() => {
                if (isDel) handleBackspace();
                else if (!isEmpty) handleDigit(key);
              }}
              style={{
                width: 72, height: 64,
                borderRadius: 16,
                fontSize: isDel ? 18 : 26,
                fontWeight: isDel ? 400 : 500,
                color: '#1A1816',
                background: isEmpty ? 'transparent' : '#FFFFFF',
                boxShadow: isEmpty ? 'none' : '0 1px 4px rgba(26,24,22,0.08)',
                border: 'none',
                cursor: isEmpty ? 'default' : 'pointer',
                visibility: isEmpty ? 'hidden' : 'visible',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isDel ? '⌫' : key}
            </motion.button>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#FAF9F6' }}>
      <AnimatePresence mode="wait">

        {/* ══ WELCOME ══ */}
        {view === 'welcome' && (
          <motion.div key="welcome"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            {/* Hero */}
            <div style={{
              flex: '1.3', position: 'relative', display: 'flex', alignItems: 'center',
              justifyContent: 'center', overflow: 'hidden',
              background: 'linear-gradient(180deg, #F3EAE0 0%, #FAF0E6 50%, #FAF9F6 100%)',
            }}>
              <div style={{ position: 'absolute', top: 32, left: 24, width: 80, height: 80, borderRadius: '50%', background: ACCENT, opacity: 0.06 }} />
              <div style={{ position: 'absolute', top: 112, right: 16, width: 48, height: 48, borderRadius: '50%', background: '#D4A853', opacity: 0.05 }} />

              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <div style={{
                  width: 120, height: 120, borderRadius: Math.round(120 * 0.219),
                  background: 'linear-gradient(135deg, #E89580, #D77A5C)',
                  boxShadow: '0 20px 60px rgba(215,122,92,0.45)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                  <FolderOpen style={{ width: 60, height: 60, color: 'white', strokeWidth: 1.8 }} />
                  <div style={{ display: 'flex', gap: 4, marginTop: -8 }}>
                    <div style={{ width: 3, height: 14, background: 'rgba(255,255,255,0.7)', borderRadius: 9999 }} />
                    <div style={{ width: 3, height: 18, background: 'rgba(255,255,255,0.6)', borderRadius: 9999 }} />
                    <div style={{ width: 3, height: 16, background: 'rgba(255,255,255,0.5)', borderRadius: 9999 }} />
                  </div>
                </div>

                <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 }}
                  style={{ position: 'absolute', left: -68, top: 8, background: '#FFFFFF', borderRadius: 12, padding: '8px 14px', boxShadow: '0 4px 20px rgba(26,24,22,0.12)' }}>
                  <p style={{ fontSize: 10, color: '#8B8579', margin: 0 }}>Earnings</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: '#5C9A6F', margin: 0 }}>₹14,270</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6 }}
                  style={{ position: 'absolute', right: -62, top: 20, background: '#FFFFFF', borderRadius: 12, padding: '8px 14px', boxShadow: '0 4px 20px rgba(26,24,22,0.12)' }}>
                  <p style={{ fontSize: 10, color: '#8B8579', margin: 0 }}>Cut %</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: ACCENT, margin: 0 }}>11.5%</p>
                </motion.div>
              </motion.div>

              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(transparent, #FAF9F6)', pointerEvents: 'none' }} />
            </div>

            {/* CTA */}
            <div style={{ flex: '0.85', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 32px 40px' }}>
              <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ textAlign: 'center', marginBottom: 32 }}>
                <h1 style={{ fontSize: 38, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em', lineHeight: 1.05, margin: 0 }}>BillerPRO</h1>
                <p style={{ color: '#6B6560', fontSize: 16, fontWeight: 500, marginTop: 8, marginBottom: 0 }}>Track your bills. Know your earnings.</p>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} style={{ width: '100%' }}>
                <motion.button whileTap={{ scale: 0.97 }}
                  onClick={() => setView('create-account')}
                  style={{
                    width: '100%', padding: '16px 0', borderRadius: 20, color: '#FFFFFF', border: 'none', cursor: 'pointer',
                    background: `linear-gradient(135deg, ${ACCENT}, #C4613C)`,
                    fontSize: 17, fontWeight: 600, boxShadow: '0 6px 20px rgba(217,119,87,0.35)', marginBottom: 12,
                  }}>Get Started</motion.button>
                <p style={{ textAlign: 'center', color: '#C4BFB6', fontSize: 13, margin: 0 }}>Private · No account needed · Data stays on device</p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ══ CREATE ACCOUNT ══ */}
        {view === 'create-account' && (
          <motion.div key="create"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 28px 32px', overflowY: 'auto' }}
          >
            <button onClick={() => setView('welcome')}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, color: '#8B8579', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 32 }}>
              <ChevronLeft size={16} /> Back
            </button>
            <h2 style={{ fontSize: 28, fontWeight: 700, color: '#1A1816', margin: '0 0 6px' }}>Your Profile</h2>
            <p style={{ color: '#8B8579', fontSize: 15, margin: '0 0 32px' }}>Just your name — to personalise the app</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#6B6560', display: 'block', marginBottom: 6 }}>Your Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ramesh Mehta" autoFocus
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 16, background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none', color: '#1A1816', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 14, fontWeight: 500, color: '#6B6560', display: 'block', marginBottom: 6 }}>Business Name <span style={{ fontWeight: 400, color: '#C4BFB6' }}>(optional)</span></label>
                <input value={business} onChange={e => setBusiness(e.target.value)} placeholder="e.g. Mehta Trading Co."
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 12, fontSize: 16, background: '#F5F0EB', border: '1px solid #E8E2D9', outline: 'none', color: '#1A1816', boxSizing: 'border-box' }} />
              </div>
            </div>

            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => { if (!name.trim()) { toast.error('Please enter your name'); return; } setView('pin-setup'); }}
              style={{ width: '100%', marginTop: 32, padding: '16px 0', borderRadius: 16, color: '#FFFFFF', background: `linear-gradient(135deg, ${ACCENT}, #C4613C)`, fontSize: 17, fontWeight: 600, boxShadow: '0 4px 16px rgba(217,119,87,0.3)', border: 'none', cursor: 'pointer' }}>
              Set Up PIN →
            </motion.button>
          </motion.div>
        )}

        {/* ══ PIN SETUP ══ */}
        {view === 'pin-setup' && (
          <motion.div key="pin-setup"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '56px 28px 32px' }}
          >
            <button onClick={() => { setView('create-account'); setPin(''); setConfirmPin(''); }}
              style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4, color: '#8B8579', fontSize: 14, background: 'none', border: 'none', cursor: 'pointer', marginBottom: 32 }}>
              <ChevronLeft size={16} /> Back
            </button>

            <div style={{ textAlign: 'center', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ width: 56, height: 56, borderRadius: 16, background: '#FDF5F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Fingerprint size={28} color={ACCENT} />
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#1A1816', margin: '0 0 8px' }}>
                {!isConfirmStep ? 'Create your PIN' : 'Confirm your PIN'}
              </h2>
              <p style={{ color: '#8B8579', fontSize: 15, margin: 0 }}>
                {!isConfirmStep ? '4-digit PIN to protect your data' : 'Enter the same PIN again'}
              </p>
              <PinDots value={activePin} shaking={shake} />
            </div>

            <Keypad />
          </motion.div>
        )}

        {/* ══ PIN LOGIN (returning user) ══ */}
        {view === 'pin-login' && (
          <motion.div key="pin-login"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '48px 28px 32px' }}
          >
            {/* Logo + branding at top */}
            <div style={{ textAlign: 'center', marginBottom: 0 }}>
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.1 }}
                style={{
                  width: 80, height: 80, borderRadius: Math.round(80 * 0.219),
                  background: 'linear-gradient(135deg, #E89580, #D77A5C)',
                  boxShadow: '0 12px 32px rgba(215,122,92,0.4)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  margin: '0 auto 14px',
                }}>
                  <FolderOpen style={{ width: 40, height: 40, color: 'white', strokeWidth: 1.8 }} />
                  <div style={{ display: 'flex', gap: 2, marginTop: -6 }}>
                    <div style={{ width: 2, height: 8, background: 'rgba(255,255,255,0.7)', borderRadius: 9999 }} />
                    <div style={{ width: 2, height: 11, background: 'rgba(255,255,255,0.6)', borderRadius: 9999 }} />
                    <div style={{ width: 2, height: 9, background: 'rgba(255,255,255,0.5)', borderRadius: 9999 }} />
                  </div>
                </motion.div>

              <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                style={{ fontSize: 28, fontWeight: 800, color: ACCENT, letterSpacing: '-0.02em', margin: '0 0 6px' }}>
                BillerPRO
              </motion.h1>

              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                style={{ color: '#8B8579', fontSize: 15, margin: 0 }}>
                Welcome back, {savedName.split(' ')[0]} 👋
              </motion.p>

              <PinDots value={pin} shaking={shake} />
            </div>

            {/* Keypad centered with fixed space */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Keypad />
            </div>

            <button
              onClick={() => { localStorage.removeItem('billerpro_pin'); localStorage.removeItem('billerpro_username'); setPin(''); setView('welcome'); }}
              style={{ color: '#C4BFB6', fontSize: 13, background: 'none', border: 'none', cursor: 'pointer', textAlign: 'center', paddingTop: 16 }}>
              Not {savedName.split(' ')[0]}? Switch account
            </button>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}
