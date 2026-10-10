import React from 'react';
import { ActiveTab } from '../types';
import { 
  ClipboardCheck, 
  ScrollText, 
  RefreshCw, 
  LayoutDashboard,
  ShieldCheck,
  Tablet,
  History,
  Layers,
  Sparkles,
  Wifi,
  WifiOff
} from 'lucide-react';

interface NavigationHeaderProps {
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  pendingSyncCount: number;
  onOpenAuthModal: () => void;
  onOpenPwaModal: () => void;
  onOpenMigrationModal: () => void;
  isOnline: boolean;
  isDemoMode: boolean;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  activeTab,
  setActiveTab,
  pendingSyncCount,
  onOpenAuthModal,
  onOpenPwaModal,
  onOpenMigrationModal,
  isOnline,
  isDemoMode,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Identity */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-100 shrink-0">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                  AssessTrack
                </h1>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide border ${
                  isDemoMode 
                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  {isDemoMode ? 'Demo Sandbox' : 'Netlify Live'}
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden md:block">
                Field Evidence Companion for Observation, Conversation & Product
              </p>
            </div>
          </div>

          {/* Actions & iPad Controls */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            
            {/* Install on iPad */}
            <button
              onClick={onOpenPwaModal}
              title="Add to iPad Home Screen"
              className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 transition-all min-h-[40px]"
            >
              <Tablet className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">iPad App</span>
            </button>

            {/* Teacher Sign-In & Security */}
            <button
              onClick={onOpenAuthModal}
              title="Teacher Security & API Connection"
              className="px-3 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold flex items-center space-x-1.5 transition-all min-h-[40px]"
            >
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">Teacher Auth</span>
            </button>

            {/* Legacy Migration */}
            <button
              onClick={onOpenMigrationModal}
              title="Migrate or Backup Legacy Records"
              className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium flex items-center space-x-1 min-h-[40px]"
            >
              <History className="w-4 h-4" />
              <span className="hidden lg:inline">Migration</span>
            </button>
          </div>
        </div>

        {/* Primary Tabs Navigation - iPad Touch Target Optimized */}
        <nav className="flex space-x-1 sm:space-x-2 pb-2 overflow-x-auto no-scrollbar border-t border-slate-100 pt-2">
          
          {/* Main Everyday Classroom Workflow */}
          <button
            onClick={() => setActiveTab('field-capture')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap min-h-[44px] ${
              activeTab === 'field-capture'
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Classroom Capture (O/C/P)</span>
          </button>

          {/* Delivery & Sync Hub */}
          <button
            onClick={() => setActiveTab('sync-hub')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap min-h-[44px] ${
              activeTab === 'sync-hub'
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <RefreshCw className="w-4 h-4" />
            <span>Evidence Log & Sync</span>
            {pendingSyncCount > 0 && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-500 text-white font-extrabold animate-pulse">
                {pendingSyncCount}
              </span>
            )}
          </button>

          {/* Performance Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap min-h-[44px] ${
              activeTab === 'dashboard'
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className="w-4 h-4" />
            <span>Trends Dashboard</span>
          </button>

          {/* Approved Rubrics */}
          <button
            onClick={() => setActiveTab('rubrics')}
            className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-sm font-bold transition-all whitespace-nowrap min-h-[44px] ${
              activeTab === 'rubrics'
                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/30'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ScrollText className="w-4 h-4" />
            <span>Approved Rubrics</span>
          </button>

          {/* Custom Rubric Generator (Legacy feature) */}
          <button
            onClick={() => setActiveTab('assess')}
            className={`flex items-center space-x-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all whitespace-nowrap min-h-[44px] ${
              activeTab === 'assess'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Rubric Authoring</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
