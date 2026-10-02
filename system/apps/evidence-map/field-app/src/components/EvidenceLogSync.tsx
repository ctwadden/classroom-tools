import React, { useState, useEffect, useMemo } from 'react';
import { FieldEvent, CourseId, SyncStatus } from '../types/evidenceContract';
import { 
  getPendingEvents, 
  getConfirmedEvents, 
  deleteEvent, 
  savePendingEvent 
} from '../utils/indexedDb';
import { evidenceBridge } from '../utils/evidenceBridge';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  Download, 
  Trash2, 
  Filter, 
  ExternalLink, 
  Search, 
  Layers, 
  FileSpreadsheet, 
  ShieldAlert,
  ArrowUpRight,
  Eye,
  MessageSquare,
  PackageCheck
} from 'lucide-react';

interface EvidenceLogSyncProps {
  onNavigateToCapture: () => void;
}

export const EvidenceLogSync: React.FC<EvidenceLogSyncProps> = ({
  onNavigateToCapture,
}) => {
  const [loading,setLoading]=useState(true);
  const [allEvents, setAllEvents] = useState<FieldEvent[]>([]);
  const [filterCourse, setFilterCourse] = useState<CourseId | 'all'>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncNotice, setSyncNotice] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadAllEvents = async () => {
    if(navigator.onLine)await evidenceBridge.updateMirrorReceipts();
    const pending = await getPendingEvents();
    const confirmed = await getConfirmedEvents();
    
    // Merge pending and confirmed
    const merged = [...pending, ...confirmed.filter(e=>!pending.some(p=>p.event_id===e.event_id))].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    setAllEvents(merged);setLoading(false);
  };

  useEffect(() => {
    loadAllEvents();
  }, []);

  // Filtered list
  const filteredEvents = useMemo(() => {
    return allEvents.filter((ev) => {
      if (filterCourse !== 'all' && ev.course_id !== filterCourse) return false;
      if (filterStatus !== 'all' && ev.local_status !== filterStatus) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchName = (ev.learner_name || ev.learner_id).toLowerCase().includes(query);
        const matchNote = (ev.teacher_note || '').toLowerCase().includes(query);
        const matchRubric = (ev.rubric_title || ev.rubric_id).toLowerCase().includes(query);
        if (!matchName && !matchNote && !matchRubric) return false;
      }
      return true;
    });
  }, [allEvents, filterCourse, filterStatus, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const pending = allEvents.filter((e) => e.local_status === 'pending' || !e.local_status).length;
    const confirmed = allEvents.filter((e) => e.local_status === 'saved_evidence_map').length;
    const errors = allEvents.filter((e) => e.local_status === 'needs_correction').length;
    const conflicts = allEvents.filter((e) => e.conflict || e.local_status === 'conflict').length;
    return { pending, confirmed, errors, conflicts, total: allEvents.length };
  }, [allEvents]);

  // Trigger Sync
  const handleSyncNow = async () => {
    setIsSyncing(true);
    setSyncNotice(null);
    try {
      const res = await evidenceBridge.syncPendingQueue();
      await loadAllEvents();

      if (res.syncedCount > 0) {
        setSyncNotice({
          message: `Successfully synced ${res.syncedCount} captures to Evidence Map.`,
          type: 'success',
        });
      } else if (res.errors.length > 0) {
        setSyncNotice({
          message: `Sync encountered errors: ${res.errors.join('; ')}`,
          type: 'error',
        });
      } else {
        setSyncNotice({
          message: 'All pending items are already synchronized.',
          type: 'info',
        });
      }
    } catch (err: any) {
      setSyncNotice({ message: err.message || 'Sync failed', type: 'error' });
    } finally {
      setIsSyncing(false);
    }
  };

  // Retry an error event
  const handleRetryEvent = async (event: FieldEvent) => {
    const resetEvent: FieldEvent = {
      ...event,
      local_status: 'pending',
      sync_error: undefined,
    };
    await savePendingEvent(resetEvent);
    await loadAllEvents();
    handleSyncNow();
  };

  // Delete event
  const handleDeleteEvent = async (eventId: string) => {
    if (confirm('Are you sure you want to delete this evidence capture from local storage?')) {
      await deleteEvent(eventId);
      await loadAllEvents();
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    const headers = [
      'Event ID',
      'Course',
      'Learner ID',
      'Learner Name',
      'Rubric ID',
      'Criterion ID',
      'Outcomes',
      'Evidence Type',
      'Teacher Note',
      'Suggested Level',
      'Support Context',
      'Artifact URL',
      'Status',
      'Timestamp',
    ];

    const rows = filteredEvents.map((e) => [
      e.event_id,
      e.course_id,
      e.learner_id,
      `"${(e.learner_name || '').replace(/"/g, '""')}"`,
      e.rubric_id,
      e.criterion_id,
      `"${e.outcome_codes_raw}"`,
      `"${e.evidence_type_raw}"`,
      `"${(e.teacher_note || '').replace(/"/g, '""')}"`,
      e.level_raw || '',
      e.independence_raw || '',
      e.artifact_url || '',
      e.local_status || 'saved',
      e.timestamp,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `field_evidence_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJson = () => {
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(allEvents, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `field_evidence_backup_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">
      {/* Toast Notice */}
      {syncNotice && (
        <div className={`p-4 rounded-xl border text-sm font-semibold flex items-center justify-between animate-in fade-in ${
          syncNotice.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
            : syncNotice.type === 'error' 
            ? 'bg-rose-50 text-rose-800 border-rose-200' 
            : 'bg-indigo-50 text-indigo-800 border-indigo-200'
        }`}>
          <span>{syncNotice.message}</span>
          <button onClick={() => setSyncNotice(null)} className="text-xs font-bold underline ml-3">Dismiss</button>
        </div>
      )}

      {/* Header Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            Field Evidence Delivery & Sync Hub
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Tracking one-way write pipeline: iPad → Evidence Map API → Google Sheet Field Evidence Mirror.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleSyncNow}
            disabled={isSyncing}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm shadow-sm transition-all flex items-center space-x-2 min-h-[44px]"
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Pending Captures'}</span>
          </button>

          <button
            onClick={handleExportCsv}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center space-x-1.5 min-h-[44px]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleExportJson}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center space-x-1.5 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>JSON Backup</span>
          </button>
        </div>
      </div>

      {/* Status KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl p-3.5 border border-slate-200">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Total Captures</span>
          <span className="text-2xl font-extrabold text-slate-900">{stats.total}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-slate-200">
          <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider block">Saved to Evidence Map</span>
          <span className="text-2xl font-extrabold text-emerald-700">{stats.confirmed}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-slate-200">
          <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wider block">Pending / Offline</span>
          <span className="text-2xl font-extrabold text-amber-700">{stats.pending}</span>
        </div>
        <div className="bg-white rounded-xl p-3.5 border border-slate-200">
          <span className="text-[11px] font-bold text-rose-600 uppercase tracking-wider block">Needs Correction</span>
          <span className="text-2xl font-extrabold text-rose-700">{stats.errors}</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search learner, note or rubric..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 min-h-[40px]"
          />
        </div>

        {/* Course Filter */}
        <div>
          <select
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value as any)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white min-h-[40px]"
          >
            <option value="all">All Courses (MM12, COM11, IBDS)</option>
            <option value="MM12">Multimedia 12 (MM12)</option>
            <option value="COM11">Communications Tech 11 (COM11)</option>
            <option value="IBDS">IB Digital Society SL (IBDS)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 focus:bg-white min-h-[40px]"
          >
            <option value="all">All Delivery States</option>
            <option value="saved_evidence_map">Saved to Evidence Map</option>
            <option value="pending">Pending Sync / Offline</option>
            <option value="needs_correction">Needs Correction</option>
            <option value="conflict">Conflict</option>
          </select>
        </div>
      </div>

      {/* Evidence Captures List */}
      <div className="space-y-3">
        {filteredEvents.length > 0 ? (
          filteredEvents.map((ev) => {
            const isSaved = ev.local_status === 'saved_evidence_map';
            const isPending = ev.local_status === 'pending' || !ev.local_status;
            const isError = ev.local_status === 'needs_correction';
            const isConflict = ev.conflict || ev.local_status === 'conflict';

            return (
              <div 
                key={ev.event_id}
                className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs space-y-3 transition-all"
              >
                {/* Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                  <div className="flex items-center space-x-2.5">
                    <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold flex items-center justify-center text-xs">
                      {(ev.learner_name || ev.learner_id).charAt(0)}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm">{ev.learner_name || ev.learner_id}</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                          {ev.course_id}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        {new Date(ev.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Delivery Status Badges */}
                  <div className="flex items-center space-x-2">
                    {isSaved && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Saved to Evidence Map</span>
                      </span>
                    )}

                    {isPending && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Waiting to sync</span>
                      </span>
                    )}

                    {isError && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Needs correction</span>
                      </span>
                    )}

                    {isConflict && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 flex items-center gap-1">
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Conflict</span>
                      </span>
                    )}

                    <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-600">
                      {ev.google_mirror_status === 'mirrored' ? 'Google Mirrored' : 'Google copy not yet verified'}
                    </span>
                  </div>
                </div>

                {/* Rubric & Modality Details */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500">Rubric & Criterion: </span>
                    <span className="text-slate-800 font-medium">{ev.rubric_title || ev.rubric_id} → {ev.criterion_name || ev.criterion_id}</span>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-500">Method(s): </span>
                    <span className="text-indigo-700 font-bold">{ev.evidence_type_raw}</span>
                  </div>
                </div>

                {/* Teacher Note */}
                {ev.teacher_note && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-800">
                    <span className="font-bold text-slate-600 block mb-0.5">Teacher Note & Observation:</span>
                    <span>{ev.teacher_note}</span>
                  </div>
                )}

                {/* Artifact Link */}
                {ev.artifact_url && (
                  <div className="flex items-center space-x-2 text-xs">
                    <span className="font-semibold text-slate-500">Product Link:</span>
                    <a 
                      href={ev.artifact_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-indigo-600 hover:text-indigo-800 underline truncate flex items-center gap-1"
                    >
                      <span className="truncate">{ev.artifact_url}</span>
                      <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </div>
                )}

                {/* Levels and Support */}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {ev.level_raw && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                      Suggested Level: {ev.level_raw}
                    </span>
                  )}
                  {ev.independence_raw && (
                    <span className="px-2 py-0.5 rounded-lg text-xs font-semibold bg-violet-50 text-violet-700 border border-violet-200">
                      Support: {ev.independence_raw}
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 ml-auto">
                    Outcomes: {ev.outcome_codes_raw}
                  </span>
                </div>

                {/* Error Banner & Retry Button */}
                {isError && ev.sync_error && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center justify-between">
                    <span>Validation issue: {ev.sync_error}</span>
                    <button
                      onClick={() => handleRetryEvent(ev)}
                      className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold hover:bg-rose-700 ml-2 shrink-0"
                    >
                      Retry
                    </button>
                  </div>
                )}

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                  <span className="font-mono text-[10px] text-slate-400">ID: {ev.event_id}</span>
                  <button
                    onClick={() => handleDeleteEvent(ev.event_id)}
                    className="text-slate-400 hover:text-rose-600 transition-all p-1"
                    title="Delete local record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-400">
            <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <h4 className="text-base font-bold text-slate-700 mb-1">{loading?'Loading saved captures…':'No evidence records on this device'}</h4>
            <p className="text-xs max-w-md mx-auto mb-4">
              {loading?'Checking local storage and mirror receipts.':'Capture evidence here, or open the main dashboard to see records from every device.'}
            </p>
            <button
              onClick={onNavigateToCapture}
              className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-xs shadow-sm hover:bg-indigo-700"
            >
              + Go to Classroom Capture
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
