import React from 'react';
import { Home, Upload, ScanLine, BarChart3, Settings, Bell } from 'lucide-react';
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
    <div className="h-full w-full min-h-0 flex flex-col overflow-hidden" style={{ background: '#FAF9F6' }}>
      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={state.activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="min-h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Tab Bar */}
      <nav
        className="border-t flex items-center justify-around flex-shrink-0 sticky bottom-0 z-10"
        style={{
          height: 64,
          minHeight: 64,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          background: '#FFFFFF',
          borderColor: '#F0EBE3',
        }}
      >
        {tabs.map(tab => {
          const isActive = state.activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 py-1.5 transition-colors relative"
            >
              {isActive && (
                <motion.div
                  layoutId="activeTabIndicator"
                  className="absolute -top-px left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-full"
                  style={{ background: '#D97757' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className="w-[22px] h-[22px]"
                strokeWidth={isActive ? 2.2 : 1.6}
                style={{ color: isActive ? '#D97757' : '#ADA79F' }}
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
