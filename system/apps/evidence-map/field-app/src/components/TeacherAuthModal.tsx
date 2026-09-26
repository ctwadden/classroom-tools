import React, { useState, useEffect } from 'react';
import { evidenceBridge, BridgeStatus } from '../utils/evidenceBridge';
import { 
  ShieldCheck, 
  KeyRound, 
  Lock, 
  Wifi, 
  WifiOff, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink,
  Info,
  Server,
  LogOut,
  Sparkles
} from 'lucide-react';

interface TeacherAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChanged: (status: BridgeStatus) => void;
}

export const TeacherAuthModal: React.FC<TeacherAuthModalProps> = ({
  isOpen,
  onClose,
  onStatusChanged,
}) => {
  const [accessKey, setAccessKey] = useState<string>('');
  const [status, setStatus] = useState<BridgeStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      loadStatus();
    }
  }, [isOpen]);

  const loadStatus = async () => {
    setIsLoading(true);
    const s = await evidenceBridge.checkStatus();
    setStatus(s);
    setIsDemoMode(s.mode === 'demo');
    setIsLoading(false);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessKey.trim()) return;

    setIsLoading(true);
    setErrorNotice(null);

    const res = await evidenceBridge.login(accessKey.trim());
    if (res.ok) {
      setAccessKey('');
      const updatedStatus = await evidenceBridge.checkStatus();
      setStatus(updatedStatus);
      onStatusChanged(updatedStatus);
      onClose();
    } else {
      setErrorNotice(res.error || 'Authentication failed');
    }
    setIsLoading(false);
  };

  const handleLogout = async () => {
    setIsLoading(true);
    await evidenceBridge.logout();
    const updatedStatus = await evidenceBridge.checkStatus();
    setStatus(updatedStatus);
    onStatusChanged(updatedStatus);
    setIsLoading(false);
  };

  const toggleMode = (demo: boolean) => {
    evidenceBridge.setDemoMode(demo);
    setIsDemoMode(demo);
    loadStatus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Teacher Sign-In & Security</h3>
              <p className="text-xs text-slate-500">Secure HttpOnly session with Evidence Map</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg p-1"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector (Demo vs Live) */}
        <div className="bg-slate-100 p-1 rounded-2xl grid grid-cols-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => toggleMode(true)}
            className={`py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              isDemoMode ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Demo Sandbox Mode</span>
          </button>
          <button
            type="button"
            onClick={() => toggleMode(false)}
            className={`py-2 rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
              !isDemoMode ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>Connected Netlify Site</span>
          </button>
        </div>

        {/* Current Status Card */}
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500">Connection Mode:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold ${
              isDemoMode ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {isDemoMode ? 'Offline / Demo Preview' : 'Connected to Netlify Bridge'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500">Authentication:</span>
            <span className={`px-2 py-0.5 rounded-full font-bold ${
              status?.authenticated ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'
            }`}>
              {status?.authenticated ? 'Signed In (Teacher)' : 'Not Signed In'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-500">Live API Endpoint:</span>
            <span className="font-mono text-[11px] text-slate-600">/.netlify/functions/evidence-bridge</span>
          </div>
        </div>

        {/* Sign In Form */}
        {!status?.authenticated ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Teacher Password / Access Key
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  placeholder="Enter private teacher key..."
                  value={accessKey}
                  onChange={(e) => setAccessKey(e.target.value)}
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                  required
                />
              </div>
              <p className="text-[11px] text-slate-400">
                Creates a secure, 4-hour SameSite=Strict HttpOnly cookie. Passwords are never stored on your iPad.
              </p>
            </div>

            {/* Quick Helper Callout */}
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-950 space-y-1.5">
              <div className="flex items-center space-x-2 font-bold text-indigo-900">
                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Where to find this key:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1 text-[11px]">
                <li><strong>Netlify Production:</strong> Set in your Netlify site under <em>Site configuration → Environment variables → <code>EVIDENCE_MAP_TEACHER_SECRET</code></em>.</li>
                <li><strong>Local / Testing default:</strong> <code>teacher-secret</code></li>
                <li><strong>No password handy?</strong> Switch to <strong>Demo Sandbox Mode</strong> at the top to access full teacher features immediately without a key.</li>
              </ul>
            </div>

            {errorNotice && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorNotice}</span>
              </div>
            )}

            <div className="flex items-center space-x-3 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-sm transition-all min-h-[44px]"
              >
                {isLoading ? 'Signing In...' : 'Sign In as Teacher'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center space-x-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold">Active Teacher Session</p>
                <p className="text-[11px] text-emerald-800">You are authenticated to capture evidence and download approved rubrics.</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={handleLogout}
                disabled={isLoading}
                className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-sm transition-all flex items-center justify-center space-x-2 min-h-[44px]"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm min-h-[44px]"
              >
                Close
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
