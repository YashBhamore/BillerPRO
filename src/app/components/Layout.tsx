import React from 'react';
import { Home, Upload, ScanLine, BarChart3, Settings } from 'lucide-react';
import { useApp } from '../store';
import { HomeDashboard } from './HomeDashboard';
import { UploadBill } from './UploadBill';
import { AllBills } from './AllBills';
import { Analytics } from './Analytics';
import { SettingsScreen } from './SettingsScreen';
import { motion, AnimatePresence } from 'motion/react';

const tabs = [
  { id: 'home', icon: Home, label: 'Home' },
  { id: 'upload', icon: Upload, label: 'Upload' },
  { id: 'bills', icon: ScanLine, label: 'Bills' },
  { id: 'analytics', icon: BarChart3, label: 'Analytics' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function Layout() {
  const { state, setActiveTab } = useApp();

  const renderContent = () => {
    switch (state.activeTab) {
      case 'home': return <HomeDashboard />;
      case 'upload': return <UploadBill />;
      case 'bills': return <AllBills />;
      case 'analytics': return <Analytics />;
      case 'settings': return <SettingsScreen />;
      default: return <HomeDashboard />;
    }
  };

  return (
    // Use fixed positioning strategy: nav is always at bottom, content fills remaining space
    <div
      className="w-full"
      style={{
        height: '100dvh', // dynamic viewport height — handles mobile browser chrome
        display: 'flex',
        flexDirection: 'column',
        background: '#FAF9F6',
        overflow: 'hidden', // prevent outer scroll
      }}
    >
      {/* Scrollable content area — takes all space above nav */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch', // smooth iOS scroll
          minHeight: 0, // critical: allows flex child to shrink below content size
        }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={state.activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Tab Bar — always visible, never scrolls away */}
      <nav
        style={{
          flexShrink: 0,
          height: 64,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: '#FFFFFF',
          borderTop: '1px solid #F0EBE3',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-around',
          // Ensure it stays above everything including modals backdrop
          position: 'relative',
          zIndex: 10,
        }}
      >
        {tabs.map(tab => {
          const isActive = state.activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                paddingTop: 6,
                paddingBottom: 6,
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  style={{
                    position: 'absolute',
                    top: -1,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: 40,
                    height: 3,
                    borderRadius: 9999,
                    background: '#D97757',
                  }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                style={{
                  width: 22,
                  height: 22,
                  color: isActive ? '#D97757' : '#ADA79F',
                  strokeWidth: isActive ? 2.2 : 1.6,
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? '#D97757' : '#ADA79F',
                  lineHeight: 1.3,
                }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
