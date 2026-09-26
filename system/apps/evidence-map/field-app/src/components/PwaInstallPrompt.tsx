import React, { useState, useEffect } from 'react';
import { Tablet, Share, PlusSquare, CheckCircle2 } from 'lucide-react';

interface PwaInstallPromptProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PwaInstallPrompt: React.FC<PwaInstallPromptProps> = ({
  isOpen,
  onClose,
}) => {
  const [isIos, setIsIos] = useState<boolean>(false);

  useEffect(() => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIpadOrIphone = /iphone|ipad|ipod/.test(userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIos(isIpadOrIphone);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Tablet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Install on iPad / Tablet</h3>
              <p className="text-xs text-slate-500">Run standalone in classroom full-screen</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            ✕
          </button>
        </div>

        {/* Instructions */}
        <div className="space-y-3.5 text-xs text-slate-700">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <span className="font-bold text-indigo-900 block">iPad Safari Steps:</span>
            <div className="flex items-start space-x-2.5">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                1
              </div>
              <p className="mt-0.5">
                Tap the <strong>Share button</strong> <Share className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" /> at the top or bottom of your Safari browser bar.
              </p>
            </div>

            <div className="flex items-start space-x-2.5">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                2
              </div>
              <p className="mt-0.5">
                Scroll down and tap <strong>Add to Home Screen</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-indigo-600" />.
              </p>
            </div>

            <div className="flex items-start space-x-2.5">
              <div className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0 text-xs">
                3
              </div>
              <p className="mt-0.5">
                Tap <strong>Add</strong> in the top-right corner. The app will launch like a native iPad app with persistent offline storage.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-[11px]">IndexedDB automatically keeps your offline classroom captures safe between restarts.</span>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm min-h-[44px]"
        >
          Got It
        </button>

      </div>
    </div>
  );
};
