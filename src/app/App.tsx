import { useEffect } from 'react';
import { AppProvider, useApp } from './store';
import { Toaster } from 'sonner';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';

// Theme colours
const THEMES = {
  light: {
    '--bg': '#FAF9F6',
    '--bg-card': '#FFFFFF',
    '--bg-secondary': '#F5F0EB',
    '--bg-muted': '#F0EBE3',
    '--text-primary': '#1A1816',
    '--text-secondary': '#6B6560',
    '--text-muted': '#8B8579',
    '--border': '#E8E2D9',
    '--nav-bg': '#FFFFFF',
    '--nav-border': '#F0EBE3',
  },
  dark: {
    '--bg': '#1A1816',
    '--bg-card': '#242220',
    '--bg-secondary': '#2E2C29',
    '--bg-muted': '#383530',
    '--text-primary': '#F5F0EB',
    '--text-secondary': '#C4BFB6',
    '--text-muted': '#8B8579',
    '--border': '#383530',
    '--nav-bg': '#1E1C1A',
    '--nav-border': '#2E2C29',
  },
};

function ThemeApplier() {
  const { state } = useApp();

  useEffect(() => {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const effectiveTheme =
      state.theme === 'system' ? (prefersDark ? 'dark' : 'light') : state.theme;

    const vars = THEMES[effectiveTheme];
    const root = document.documentElement;
    Object.entries(vars).forEach(([key, val]) => root.style.setProperty(key, val));

    // Also toggle a class for Tailwind dark: variants if needed
    root.classList.toggle('dark', effectiveTheme === 'dark');
  }, [state.theme]);

  return null;
}

function AppContent() {
  const { state } = useApp();
  if (!state.isLoggedIn) return <LoginPage />;
  return <Layout />;
}

export default function App() {
  return (
    <AppProvider>
      <ThemeApplier />
      <div
        style={{
          height: '100dvh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-muted, #E8E2D9)',
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100dvh',
            maxWidth: 430,
            overflow: 'hidden',
            background: 'var(--bg, #FAF9F6)',
            transition: 'background 0.3s ease',
          }}
        >
          <AppContent />
        </div>
        <Toaster
          position="top-center"
          richColors
          toastOptions={{
            style: {
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
              borderRadius: 12,
              fontSize: 13,
            },
          }}
        />
      </div>
    </AppProvider>
  );
}
