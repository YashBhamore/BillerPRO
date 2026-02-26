import { AppProvider, useApp } from './store';
import { Toaster } from 'sonner';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';

function AppContent() {
  const { state } = useApp();
  if (!state.isLoggedIn) return <LoginPage />;
  return <Layout />;
}

export default function App() {
  return (
    <AppProvider>
      <div
        className="h-full w-full flex items-center justify-center bg-[#E8E2D9]"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }}
      >
        <div className="w-full h-full overflow-hidden" style={{ maxWidth: 430, background: '#FAF9F6' }}>
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
