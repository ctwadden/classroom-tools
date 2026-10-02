import React, { useState } from 'react';
import { AssessmentRecord, GoogleSheetConfig } from '../types';
import { getGoogleAppsScriptSnippet, downloadRecordsCSV } from '../utils/storage';
import { 
  Table, 
  Copy, 
  Check, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle, 
  FileSpreadsheet, 
  ExternalLink,
  Code,
  ShieldCheck,
  Send,
  Loader2
} from 'lucide-react';

interface GoogleSheetSyncModalProps {
  config: GoogleSheetConfig;
  records: AssessmentRecord[];
  onSaveConfig: (config: GoogleSheetConfig) => void;
  onSyncAll: () => Promise<void>;
  isSyncing: boolean;
}

export const GoogleSheetSyncModal: React.FC<GoogleSheetSyncModalProps> = ({
  config,
  records,
  onSaveConfig,
  onSyncAll,
  isSyncing,
}) => {
  const [appsScriptUrl, setAppsScriptUrl] = useState(config.appsScriptUrl);
  const [sheetName, setSheetName] = useState(config.sheetName || 'Assessment_Records');
  const [autoSync, setAutoSync] = useState(config.autoSync ?? true);
  const [copiedScript, setCopiedScript] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const unsyncedCount = records.filter((r) => !r.syncedToGoogleSheet).length;

  const handleCopyScript = () => {
    navigator.clipboard.writeText(getGoogleAppsScriptSnippet());
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2500);
  };

  const handleSaveSettings = () => {
    onSaveConfig({
      appsScriptUrl: appsScriptUrl.trim(),
      sheetName: sheetName.trim(),
      autoSync,
    });
    alert('Google Sheet configuration saved!');
  };

  const handleTestConnection = async () => {
    if (!appsScriptUrl.trim()) {
      alert('Please enter your Google Apps Script Web App URL first.');
      return;
    }

    setTestStatus('testing');
    setTestMessage('');

    try {
      const response = await fetch('/api/sync/google-sheet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appsScriptUrl: appsScriptUrl.trim(),
          payload: {
            action: 'ping',
            timestamp: new Date().toISOString(),
          },
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTestStatus('success');
        setTestMessage(
          data.data?.message || 'Connection successful! Your Google Sheet is ready to receive assessment records.'
        );
      } else {
        setTestStatus('error');
        setTestMessage(data.error || 'Connection failed. Please check your Apps Script deployment URL.');
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestMessage(err.message || 'Failed to communicate with Google Sheet');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-100">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Google Sheet & Master Database Sync
            </h2>
            <p className="text-xs text-slate-500">
              Sync student observations, conversation transcripts, rubric bands, and AI feedback directly into your Google Drive spreadsheet.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV fallback */}
          <button
            onClick={() => downloadRecordsCSV(records)}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs shadow-2xs transition-all active:scale-95"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Download Master CSV</span>
          </button>

          {/* Sync All Button */}
          <button
            onClick={onSyncAll}
            disabled={isSyncing || !appsScriptUrl.trim() || records.length === 0}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md shadow-emerald-100 transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing Records...' : `Sync All to Google Sheet (${unsyncedCount} pending)`}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Connection Setup & Test */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Google Apps Script Web App Connection</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Apps Script Web App URL: *
              </label>
              <input
                type="url"
                value={appsScriptUrl}
                onChange={(e) => setAppsScriptUrl(e.target.value)}
                placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                Obtain this by deploying the Apps Script code in your Google Sheet (instructions on the right).
              </p>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Master Database Sheet Tab Name:
              </label>
              <input
                type="text"
                value={sheetName}
                onChange={(e) => setSheetName(e.target.value)}
                placeholder="Assessment_Records"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
              />
            </div>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="autoSync"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
              />
              <label htmlFor="autoSync" className="text-xs font-semibold text-slate-700 cursor-pointer">
                Automatically push to Google Sheet immediately when an assessment is saved
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testStatus === 'testing' || !appsScriptUrl.trim()}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl transition-colors disabled:opacity-50"
            >
              {testStatus === 'testing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5 text-slate-600" />
              )}
              <span>Test Google Sheet Connection</span>
            </button>

            <button
              type="button"
              onClick={handleSaveSettings}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
            >
              Save Sync Settings
            </button>
          </div>

          {/* Test Status Feedback */}
          {testStatus === 'success' && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2 text-xs text-emerald-900">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Connection Verified!</p>
                <p>{testMessage}</p>
              </div>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2 text-xs text-rose-900">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Connection Failed</p>
                <p>{testMessage}</p>
              </div>
            </div>
          )}

          {/* Database Columns Schema */}
          <div className="pt-2">
            <span className="text-xs font-bold text-slate-800 block mb-2">
              Columns Automatically Appended in Google Sheet:
            </span>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Timestamp',
                'Student ID',
                'Student Name',
                'Outcome / Assignment',
                'Evidence Mode',
                'Rubric Band',
                'Score',
                'Observation Notes',
                'Conversation Notes',
                'Voice Transcript',
                'AI Student Feedback',
                'AI Next Steps',
                'Record ID',
              ].map((col) => (
                <span
                  key={col}
                  className="text-[11px] font-mono px-2 py-1 bg-slate-100 text-slate-700 rounded-md border border-slate-200"
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: 60-Second Setup Guide & Ready-to-Copy Script */}
        <div className="lg:col-span-5 bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center space-x-2">
              <Code className="w-4 h-4 text-emerald-400" />
              <span>Google Apps Script Setup (60 seconds)</span>
            </h3>
            <button
              onClick={handleCopyScript}
              className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs transition-all active:scale-95 shadow-sm"
            >
              {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedScript ? 'Copied!' : 'Copy Script'}</span>
            </button>
          </div>

          <ol className="text-xs space-y-3 text-slate-300 list-decimal list-inside leading-relaxed">
            <li>
              Open or create a new spreadsheet in <strong>Google Drive / Google Sheets</strong>.
            </li>
            <li>
              In the top menu, click <strong>Extensions &gt; Apps Script</strong>.
            </li>
            <li>
              Delete any template code and <strong>paste</strong> the copied script.
            </li>
            <li>
              Click <strong>Deploy &gt; New deployment</strong>.
            </li>
            <li>
              Under "Select type", choose <strong>Web app</strong>.
            </li>
            <li>
              Set "Execute as" to <strong>Me</strong>, and "Who has access" to <strong>Anyone</strong> (this allows your iPad to securely send records without complex OAuth popups).
            </li>
            <li>
              Click <strong>Deploy</strong>, grant permission, and <strong>copy the Web App URL</strong>.
            </li>
            <li>
              Paste the Web App URL into the field on the left and tap <strong>Test Connection</strong>!
            </li>
          </ol>

          <div className="p-3 bg-white/10 rounded-xl border border-white/10 text-[11px] text-slate-300">
            <strong className="text-emerald-400 block mb-1">Seamless Cross-Device Sync:</strong>
            Whenever you record student observations or conversations on your iPad or phone, records are added in real time to your Google Sheet master sheet!
          </div>
        </div>
      </div>
    </div>
  );
};
