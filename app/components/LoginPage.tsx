import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, ChevronLeft } from 'lucide-react';
import { useApp } from '../store';
import { toast } from 'sonner';


type AuthView = 'welcome' | 'login' | 'register';

const ACCENT = '#D97757';
const ACCENT_LIGHT = '#FDF5F0';
const ACCENT_BG = '#FAF9F6';

export function LoginPage() {
  const { login, setUserProfile } = useApp();
  const [view, setView] = useState<AuthView>('welcome');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [regName, setRegName] = useState('');
  const [regBusiness, setRegBusiness] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const handleLogin = () => {
    if (!loginEmail || !loginPassword) {
      toast.error('Please enter your credentials');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      login(loginEmail, loginPassword);
      toast.success('Welcome back!');
      setLoading(false);
    }, 800);
  };

  const handleRegister = () => {
    if (!regName || !regEmail || !regPassword) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setUserProfile({
        name: regName,
        email: regEmail,
        businessName: regBusiness || `${regName}'s Business`,
      });
      login(regEmail, regPassword);
      toast.success(`Welcome, ${regName.split(' ')[0]}!`);
      setLoading(false);
    }, 900);
  };

  const SocialRow = () => (
    <div className="flex items-center gap-3">
      <button
        className="w-11 h-11 rounded-xl bg-white flex items-center justify-center border border-[#eee]"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      </button>
      <button
        className="w-11 h-11 rounded-xl bg-white flex items-center justify-center border border-[#eee]"
        style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}
      >
        <svg width="16" height="18" viewBox="0 0 16 20" fill="#333">
          <path d="M13.34 10.05c-.03-2.62 2.14-3.88 2.24-3.94-1.22-1.78-3.12-2.03-3.79-2.05-1.62-.16-3.15.95-3.97.95-.82 0-2.09-.93-3.44-.9-1.77.03-3.4 1.03-4.31 2.61-1.84 3.18-.47 7.9 1.32 10.48.88 1.27 1.93 2.69 3.3 2.64 1.33-.05 1.83-.86 3.43-.86 1.6 0 2.06.86 3.46.83 1.43-.02 2.33-1.29 3.19-2.57.99-1.47 1.4-2.9 1.43-2.97-.03-.01-2.74-1.05-2.77-4.17zM10.81 2.64C11.54 1.77 12.03.57 11.9-.63c-1.07.04-2.36.71-3.13 1.61-.69.79-1.29 2.05-1.13 3.27 1.19.09 2.4-.6 3.17-1.61z"/>
        </svg>
      </button>
    </div>
  );

  const Spinner = () => (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full"
    />
  );

  return (
    <div className="h-full flex flex-col" style={{ background: ACCENT_BG }}>
      <AnimatePresence mode="wait">

        {/* ==================== WELCOME ==================== */}
        {view === 'welcome' && (
          <motion.div
            key="welcome"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="h-full flex flex-col"
          >
            {/* Hero area — warm integrated illustration */}
            <div className="flex-[1.2] relative flex items-center justify-center overflow-hidden">
              {/* Warm gradient background that blends image into the page */}
              <div
                className="absolute inset-0"
                style={{
                  background: 'linear-gradient(180deg, #F3EAE0 0%, #FAF0E6 40%, #FAF9F6 100%)',
                }}
              />
              {/* Subtle decorative shapes */}
              <div className="absolute top-8 left-6 w-16 h-16 rounded-full opacity-[0.08]" style={{ background: ACCENT }} />
              <div className="absolute top-24 right-4 w-10 h-10 rounded-full opacity-[0.06]" style={{ background: '#D4A853' }} />
              <div className="absolute bottom-16 left-10 w-8 h-8 rounded-full opacity-[0.05]" style={{ background: '#5C9A6F' }} />

              {/* Image container with warm styling */}
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className="relative z-10 w-[75%] max-w-[260px]"
                style={{ filter: 'drop-shadow(0 12px 40px rgba(217,119,87,0.15))' }}
              >
                <svg viewBox="0 0 260 320" fill="none" xmlns="http://www.w3.org/2000/svg" style={{width:'100%',height:'100%'}}>
                  <rect x="30" y="40" width="200" height="240" rx="20" fill="#FDF5F0" stroke="#F0D5C8" strokeWidth="1.5"/>
                  <rect x="30" y="40" width="200" height="52" rx="20" fill="#D97757"/>
                  <rect x="30" y="72" width="200" height="20" fill="#D97757"/>
                  <circle cx="130" cy="66" r="18" fill="white" fillOpacity="0.2"/>
                  <text x="130" y="72" textAnchor="middle" fill="white" fontSize="16" fontWeight="700">&#8377;</text>
                  <rect x="50" y="112" width="80" height="8" rx="4" fill="#E8D5CC"/>
                  <rect x="170" y="112" width="40" height="8" rx="4" fill="#5C9A6F" fillOpacity="0.7"/>
                  <rect x="50" y="132" width="60" height="8" rx="4" fill="#E8D5CC"/>
                  <rect x="170" y="132" width="40" height="8" rx="4" fill="#D97757" fillOpacity="0.6"/>
                  <rect x="50" y="152" width="90" height="8" rx="4" fill="#E8D5CC"/>
                  <rect x="170" y="152" width="40" height="8" rx="4" fill="#D4A853" fillOpacity="0.7"/>
                  <rect x="50" y="172" width="160" height="1" fill="#F0EBE3"/>
                  <rect x="50" y="186" width="160" height="10" rx="5" fill="#F0EBE3"/>
                  <rect x="50" y="186" width="110" height="10" rx="5" fill="#D97757"/>
                  <rect x="50" y="210" width="46" height="46" rx="12" fill="#FDF5F0"/>
                  <text x="73" y="232" textAnchor="middle" fill="#D97757" fontSize="11" fontWeight="700">&#8377;12K</text>
                  <text x="73" y="245" textAnchor="middle" fill="#8B8579" fontSize="9">Earned</text>
                  <rect x="107" y="210" width="46" height="46" rx="12" fill="#EEF5F0"/>
                  <text x="130" y="232" textAnchor="middle" fill="#5C9A6F" fontSize="14" fontWeight="700">18</text>
                  <text x="130" y="245" textAnchor="middle" fill="#8B8579" fontSize="9">Bills</text>
                  <rect x="164" y="210" width="46" height="46" rx="12" fill="#FBF5E8"/>
                  <text x="187" y="232" textAnchor="middle" fill="#D4A853" fontSize="14" fontWeight="700">4</text>
                  <text x="187" y="245" textAnchor="middle" fill="#8B8579" fontSize="9">Vendors</text>
                  <rect x="50" y="268" width="160" height="32" rx="10" fill="#D97757"/>
                  <text x="130" y="289" textAnchor="middle" fill="white" fontSize="13" fontWeight="600">+ Upload Bill</text>
                </svg>
              </motion.div>

              {/* Bottom fade into page color */}
              <div
                className="absolute bottom-0 left-0 right-0 h-16 pointer-events-none"
                style={{ background: 'linear-gradient(180deg, transparent, #FAF9F6)' }}
              />
            </div>

            {/* Text + buttons — bottom portion */}
            <div className="flex-[0.85] flex flex-col items-center justify-center px-8">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-center"
              >
                <h1
                  style={{ color: ACCENT, fontSize: 32, fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}
                >
                  BillerPRO
                </h1>
                <p
                  className="mt-2 text-[#6B6560]"
                  style={{ fontSize: 16, fontWeight: 500 }}
                >
                  Track Your Bills Smartly
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-6 mt-8"
              >
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setView('login')}
                  className="px-10 py-3.5 rounded-xl text-white"
                  style={{
                    background: ACCENT,
                    fontSize: 16,
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(232,97,60,0.3)',
                  }}
                >
                  Login
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setView('register')}
                  className="text-[#333]"
                  style={{ fontSize: 16, fontWeight: 600 }}
                >
                  Register
                </motion.button>
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ==================== LOGIN ==================== */}
        {view === 'login' && (
          <motion.div
            key="login"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.25 }}
            className="h-full flex flex-col relative"
          >
            {/* Decorative circles */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
              <div className="absolute top-16 -right-8 w-48 h-48 border border-[#999] rounded-full" />
              <div className="absolute top-36 -left-12 w-36 h-36 border border-[#999] rounded-full" />
            </div>

            <div className="flex-1 flex flex-col px-7 pt-10 pb-6 relative z-10 overflow-y-auto">
              {/* Back */}
              <button
                onClick={() => setView('welcome')}
                className="self-start flex items-center gap-0.5 text-[#999] mb-8"
                style={{ fontSize: 13, fontWeight: 500 }}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              {/* Title block */}
              <div className="text-center mb-7">
                <h2 style={{ color: ACCENT, fontSize: 24, fontWeight: 700 }}>
                  Login here
                </h2>
                <p className="text-[#333] mt-2" style={{ fontSize: 16, fontWeight: 600, lineHeight: 1.35 }}>
                  Welcome back, you've<br />been missed!
                </p>
              </div>

              {/* Fields */}
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-3 rounded-xl border text-[#333] outline-none transition-all focus:border-[#E8613C] focus:ring-2 focus:ring-[#E8613C]/10 mb-3"
                style={{ fontSize: 14, background: ACCENT_LIGHT, borderColor: '#f0d5ca' }}
              />

              <div className="relative mb-2">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 rounded-xl border text-[#333] outline-none transition-all focus:border-[#E8613C] focus:ring-2 focus:ring-[#E8613C]/10 pr-11"
                  style={{ fontSize: 14, background: ACCENT_LIGHT, borderColor: '#f0d5ca' }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-[#bbb]" /> : <Eye className="w-4 h-4 text-[#bbb]" />}
                </button>
              </div>

              <div className="flex justify-end mb-5">
                <button style={{ color: ACCENT, fontSize: 13, fontWeight: 600 }}>
                  Forgot your password?
                </button>
              </div>

              {/* Sign in */}
              <motion.button
                onClick={handleLogin}
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl text-white flex items-center justify-center mb-4"
                style={{
                  background: ACCENT,
                  fontSize: 15,
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(232,97,60,0.3)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? <Spinner /> : 'Sign in'}
              </motion.button>

              <button
                onClick={() => setView('register')}
                className="text-[#333] mb-5"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                Create new account
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 w-full mb-4">
                <div className="flex-1 h-px bg-[#e0d0c8]" />
                <span style={{ color: ACCENT, fontSize: 12, fontWeight: 500 }}>Or continue with</span>
                <div className="flex-1 h-px bg-[#e0d0c8]" />
              </div>

              <div className="flex justify-center">
                <SocialRow />
              </div>
            </div>
          </motion.div>
        )}

        {/* ==================== REGISTER ==================== */}
        {view === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.25 }}
            className="h-full flex flex-col relative"
          >
            <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
              <div className="absolute top-20 -right-10 w-44 h-44 border border-[#999] rounded-full" />
              <div className="absolute bottom-28 -left-8 w-32 h-32 border border-[#999] rounded-full" />
            </div>

            <div className="flex-1 flex flex-col px-7 pt-10 pb-6 relative z-10 overflow-y-auto">
              {/* Back */}
              <button
                onClick={() => setView('welcome')}
                className="self-start flex items-center gap-0.5 text-[#999] mb-8"
                style={{ fontSize: 13, fontWeight: 500 }}
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>

              {/* Title */}
              <div className="text-center mb-7">
                <h2 style={{ color: ACCENT, fontSize: 24, fontWeight: 700 }}>
                  Create Account
                </h2>
                <p className="text-[#333] mt-2" style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.35 }}>
                  Start tracking your bills<br />in minutes
                </p>
              </div>

              {/* Fields */}
              <input
                value={regName}
                onChange={e => setRegName(e.target.value)}
                placeholder="Full Name"
                className="w-full px-4 py-3 rounded-xl border text-[#333] outline-none transition-all focus:border-[#E8613C] focus:ring-2 focus:ring-[#E8613C]/10 mb-3"
                style={{ fontSize: 14, background: ACCENT_LIGHT, borderColor: '#f0d5ca' }}
              />
              <input
                value={regBusiness}
                onChange={e => setRegBusiness(e.target.value)}
                placeholder="Business Name (optional)"
                className="w-full px-4 py-3 rounded-xl border text-[#333] outline-none transition-all focus:border-[#E8613C] focus:ring-2 focus:ring-[#E8613C]/10 mb-3"
                style={{ fontSize: 14, background: ACCENT_LIGHT, borderColor: '#f0d5ca' }}
              />
              <input
                type="email"
                value={regEmail}
                onChange={e => setRegEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-3 rounded-xl border text-[#333] outline-none transition-all focus:border-[#E8613C] focus:ring-2 focus:ring-[#E8613C]/10 mb-3"
                style={{ fontSize: 14, background: ACCENT_LIGHT, borderColor: '#f0d5ca' }}
              />
              <div className="relative mb-5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full px-4 py-3 rounded-xl border text-[#333] outline-none transition-all focus:border-[#E8613C] focus:ring-2 focus:ring-[#E8613C]/10 pr-11"
                  style={{ fontSize: 14, background: ACCENT_LIGHT, borderColor: '#f0d5ca' }}
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-[#bbb]" /> : <Eye className="w-4 h-4 text-[#bbb]" />}
                </button>
              </div>

              {/* Sign up */}
              <motion.button
                onClick={handleRegister}
                disabled={loading}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl text-white flex items-center justify-center mb-4"
                style={{
                  background: ACCENT,
                  fontSize: 15,
                  fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(232,97,60,0.3)',
                  opacity: loading ? 0.7 : 1,
                }}
              >
                {loading ? <Spinner /> : 'Sign up'}
              </motion.button>

              <button
                onClick={() => setView('login')}
                className="text-[#333] mb-5"
                style={{ fontSize: 14, fontWeight: 600 }}
              >
                Already have an account? <span style={{ color: ACCENT }}>Sign in</span>
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 w-full mb-4">
                <div className="flex-1 h-px bg-[#e0d0c8]" />
                <span style={{ color: ACCENT, fontSize: 12, fontWeight: 500 }}>Or continue with</span>
                <div className="flex-1 h-px bg-[#e0d0c8]" />
              </div>

              <div className="flex justify-center">
                <SocialRow />
              </div>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </div>
  );
}