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
    <div style={{
      height: '100dvh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg, #FAF9F6)',
      overflow: 'hidden',
    }}>
      {/* Scrollable content */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        minHeight: 0,
      }}>
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

      {/* Bottom tab bar — always fixed at bottom */}
      <nav style={{
        flexShrink: 0,
        height: 64,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--nav-bg, #FFFFFF)',
        borderTop: '1px solid var(--nav-border, #F0EBE3)',
        display: 'flex',
        alignItems: 'stretch',
        position: 'relative',
        zIndex: 10,
      }}>
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
                gap: 3,
                position: 'relative',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '6px 0',
              }}
            >
              {/* Active indicator — uses CSS not spring animation to avoid offset */}
              {isActive && (
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 32,
                  height: 3,
                  borderRadius: 9999,
                  background: '#D97757',
                }} />
              )}
              <Icon
                style={{
                  width: 22,
                  height: 22,
                  color: isActive ? '#D97757' : 'var(--text-muted, #ADA79F)',
                  strokeWidth: isActive ? 2.2 : 1.6,
                  flexShrink: 0,
                }}
              />
              <span style={{
                fontSize: 11,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? '#D97757' : 'var(--text-muted, #ADA79F)',
                lineHeight: 1,
              }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
