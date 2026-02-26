import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Building2, Delete, Fingerprint, KeyRound, UserRound } from 'lucide-react';
import { useApp } from '../store';
import { toast } from 'sonner';

const ACCENT = '#D97757';
const ACCENT_BG = '#FAF9F6';
const AUTH_PROFILE_KEY = 'billerpro_pin_profile_v1';
const AUTH_PIN_KEY = 'billerpro_pin_v1';

type AuthMode = 'loading' | 'setup' | 'pin';

interface PinProfile {
  name: string;
  businessName: string;
  email: string;
}

function sanitizePin(value: string) {
  return value.replace(/\D/g, '').slice(0, 4);
}

function buildFallbackEmail(name: string) {
  const slug = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '') || 'user';
  return `${slug}@billerpro.local`;
}

function readStoredAuth(): { profile: PinProfile | null; pin: string } {
  try {
    const rawProfile = localStorage.getItem(AUTH_PROFILE_KEY);
    const pin = localStorage.getItem(AUTH_PIN_KEY) || '';
    if (!rawProfile || !/^\d{4}$/.test(pin)) return { profile: null, pin: '' };
    const parsed = JSON.parse(rawProfile) as Partial<PinProfile>;
    if (!parsed?.name || !parsed?.businessName) return { profile: null, pin: '' };
    return {
      profile: {
        name: parsed.name,
        businessName: parsed.businessName,
        email: parsed.email || buildFallbackEmail(parsed.name),
      },
      pin,
    };
  } catch {
    return { profile: null, pin: '' };
  }
}

function saveStoredAuth(profile: PinProfile, pin: string) {
  localStorage.setItem(AUTH_PROFILE_KEY, JSON.stringify(profile));
  localStorage.setItem(AUTH_PIN_KEY, pin);
}

function PinDots({ value }: { value: string }) {
  return (
    <div className="flex items-center justify-center gap-2 mt-4 mb-4">
      {[0, 1, 2, 3].map(index => (
        <div
          key={index}
          className="w-3 h-3 rounded-full border"
          style={{
            background: value[index] ? ACCENT : '#FFFFFF',
            borderColor: value[index] ? ACCENT : '#E8E2D9',
          }}
        />
      ))}
    </div>
  );
}

export function LoginPage() {
  const { login, setUserProfile } = useApp();

  const [mode, setMode] = useState<AuthMode>('loading');
  const [savedProfile, setSavedProfile] = useState<PinProfile | null>(null);
  const [savedPin, setSavedPin] = useState('');

  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [enteredPin, setEnteredPin] = useState('');
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const { profile, pin } = readStoredAuth();
    if (profile && pin) {
      setSavedProfile(profile);
      setSavedPin(pin);
      setMode('pin');
      return;
    }
    setMode('setup');
  }, []);

  const completeLogin = (profile: PinProfile, pin: string) => {
    setUserProfile(profile);
    login(profile.email, pin);
  };

  const handleGoogleClick = () => {
    toast.info('Google Sign-In button is ready. Connect real Google auth in your production setup.');
  };

  const handleCreatePin = () => {
    const cleanName = name.trim();
    const cleanBusiness = businessName.trim();
    const pin = sanitizePin(setupPin);
    const pinConfirm = sanitizePin(confirmPin);

    if (!cleanName || !cleanBusiness) {
      toast.error('Enter your name and business name');
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error('Create a 4-digit PIN');
      return;
    }
    if (pin !== pinConfirm) {
      toast.error('PINs do not match');
      return;
    }

    const profile: PinProfile = {
      name: cleanName,
      businessName: cleanBusiness,
      email: buildFallbackEmail(cleanName),
    };

    saveStoredAuth(profile, pin);
    setSavedProfile(profile);
    setSavedPin(pin);
    toast.success('PIN setup complete');
    completeLogin(profile, pin);
  };

  const verifyPin = (candidate: string) => {
    if (!savedProfile) return;
    setVerifying(true);
    window.setTimeout(() => {
      if (candidate === savedPin) {
        toast.success(`Welcome back, ${savedProfile.name.split(' ')[0]}!`);
        completeLogin(savedProfile, candidate);
      } else {
        toast.error('Wrong PIN');
        setEnteredPin('');
      }
      setVerifying(false);
    }, 180);
  };

  const handleDigit = (digit: string) => {
    if (verifying) return;
    setEnteredPin(prev => {
      if (prev.length >= 4) return prev;
      const next = `${prev}${digit}`;
      if (next.length === 4) verifyPin(next);
      return next;
    });
  };

  const handleBackspace = () => {
    if (verifying) return;
    setEnteredPin(prev => prev.slice(0, -1));
  };

  const resetLocalLogin = () => {
    localStorage.removeItem(AUTH_PROFILE_KEY);
    localStorage.removeItem(AUTH_PIN_KEY);
    setSavedProfile(null);
    setSavedPin('');
    setEnteredPin('');
    setMode('setup');
    toast.success('Local PIN login reset on this device');
  };

  if (mode === 'loading') {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: ACCENT_BG }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2 border-[#E8E2D9] border-t-[#D97757]"
        />
      </div>
    );
  }

  return (
    <div className="h-full px-4 py-6 flex items-center justify-center" style={{ background: ACCENT_BG }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[390px] rounded-3xl p-5"
        style={{
          background: '#FFFFFF',
          boxShadow: '0 12px 30px rgba(26,24,22,0.08)',
          border: '1px solid #F0EBE3',
        }}
      >
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-3" style={{ background: '#FDF5F0', color: ACCENT }}>
            <KeyRound className="w-4 h-4" />
            <span style={{ fontSize: 12, fontWeight: 700 }}>BillerPRO Secure Login</span>
          </div>
          <h1 className="text-[#1A1816]" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.1 }}>
            {mode === 'setup' ? 'Create your PIN login' : 'Enter 4-digit PIN'}
          </h1>
          <p className="text-[#8B8579] mt-1" style={{ fontSize: 14 }}>
            {mode === 'setup'
              ? 'First-time setup. Save your profile and use a PIN for faster logins.'
              : 'PIN is stored locally on this device. Tap 4 digits to continue.'}
          </p>
        </div>

        <button
          onClick={handleGoogleClick}
          className="w-full rounded-xl px-4 py-3 mb-4 flex items-center justify-center gap-2"
          style={{ border: '1px solid #E8E2D9', background: '#FFFFFF' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="text-[#1A1816]" style={{ fontSize: 15, fontWeight: 600 }}>Continue with Google</span>
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-px flex-1 bg-[#F0EBE3]" />
          <span className="text-[#ADA79F]" style={{ fontSize: 12, fontWeight: 600 }}>OR USE PIN</span>
          <div className="h-px flex-1 bg-[#F0EBE3]" />
        </div>

        <AnimatePresence mode="wait">
          {mode === 'setup' ? (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <div className="relative">
                <UserRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#ADA79F]" />
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Your name"
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none"
                  style={{ background: '#F5F0EB', border: '1px solid #E8E2D9', fontSize: 15 }}
                />
              </div>

              <div className="relative">
                <Building2 className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#ADA79F]" />
                <input
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  placeholder="Business name"
                  className="w-full pl-10 pr-4 py-3 rounded-xl outline-none"
                  style={{ background: '#F5F0EB', border: '1px solid #E8E2D9', fontSize: 15 }}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#8B8579] mb-1.5" style={{ fontSize: 12, fontWeight: 600 }}>Create PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={setupPin}
                    onChange={e => setSetupPin(sanitizePin(e.target.value))}
                    placeholder="4 digits"
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{ background: '#F5F0EB', border: '1px solid #E8E2D9', fontSize: 15, letterSpacing: '0.2em' }}
                  />
                </div>
                <div>
                  <label className="block text-[#8B8579] mb-1.5" style={{ fontSize: 12, fontWeight: 600 }}>Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    value={confirmPin}
                    onChange={e => setConfirmPin(sanitizePin(e.target.value))}
                    placeholder="4 digits"
                    className="w-full px-4 py-3 rounded-xl outline-none"
                    style={{ background: '#F5F0EB', border: '1px solid #E8E2D9', fontSize: 15, letterSpacing: '0.2em' }}
                  />
                </div>
              </div>

              <button
                onClick={handleCreatePin}
                className="w-full py-3 rounded-xl text-white"
                style={{ background: ACCENT, fontSize: 15, fontWeight: 700, boxShadow: '0 8px 20px rgba(217,119,87,0.25)' }}
              >
                Save Profile & Continue
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="pin"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
            >
              <div className="rounded-2xl p-4 mb-4" style={{ background: '#FDF5F0', border: '1px solid #F4E6DA' }}>
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white" style={{ background: ACCENT }}>
                    <Fingerprint className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[#1A1816]" style={{ fontSize: 15, fontWeight: 700 }}>{savedProfile?.name}</p>
                    <p className="text-[#8B8579]" style={{ fontSize: 13 }}>{savedProfile?.businessName}</p>
                  </div>
                </div>
                <PinDots value={enteredPin} />
              </div>

              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button
                    key={n}
                    onClick={() => handleDigit(String(n))}
                    className="h-12 rounded-xl text-[#1A1816]"
                    style={{ background: '#FFFFFF', border: '1px solid #E8E2D9', fontSize: 18, fontWeight: 600 }}
                  >
                    {n}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={resetLocalLogin}
                  className="h-12 rounded-xl text-[#8B8579]"
                  style={{ background: '#F5F0EB', border: '1px solid #E8E2D9', fontSize: 12, fontWeight: 700 }}
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="h-12 rounded-xl text-[#1A1816]"
                  style={{ background: '#FFFFFF', border: '1px solid #E8E2D9', fontSize: 18, fontWeight: 600 }}
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-12 rounded-xl flex items-center justify-center"
                  style={{ background: '#FFFFFF', border: '1px solid #E8E2D9' }}
                >
                  <Delete className="w-4 h-4 text-[#6B6560]" />
                </button>
              </div>

              <p className="text-center text-[#8B8579] mt-3" style={{ fontSize: 12 }}>
                {verifying ? 'Checking PIN...' : 'Tap 4 digits to sign in'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
