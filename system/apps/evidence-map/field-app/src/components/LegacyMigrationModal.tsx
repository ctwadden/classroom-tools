import React, { useState, useEffect } from 'react';
import { AssessmentRecord } from '../types';
import { getStoredRecords } from '../utils/storage';
import { savePendingEvent, getPendingEvents } from '../utils/indexedDb';
import { FieldEvent, CourseId } from '../types/evidenceContract';
import { 
  History, 
  Download, 
  ArrowRight, 
  CheckCircle2, 
  FileSpreadsheet, 
  AlertCircle 
} from 'lucide-react';

interface LegacyMigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMigrationComplete: () => void;
}

export const LegacyMigrationModal: React.FC<LegacyMigrationModalProps> = ({
  isOpen,
  onClose,
  onMigrationComplete,
}) => {
  const [legacyRecords, setLegacyRecords] = useState<AssessmentRecord[]>([]);
  const [isMigrating, setIsMigrating] = useState<boolean>(false);
  const [migratedCount, setMigratedCount] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      const records = getStoredRecords();
      setLegacyRecords(records);
    }
  }, [isOpen]);

  const handleExportLegacyJson = () => {
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(legacyRecords, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `legacy_assesstrack_records_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleMigrateAll = async () => {
    setIsMigrating(true);
    let count = 0;

    for (const rec of legacyRecords) {
      // Map old record to new FieldEvent structure
      const mappedEvent: FieldEvent = {
        schema_version: '1.0',
        event_id: `legacy_${rec.id}`,
        source_revision: 1,
        stream: 'evidence',
        learner_id: `lrn_${rec.studentId.replace(/[^a-zA-Z0-9]/g, '_')}`,
        course_id: 'MM12', // default course mapping
        project_id: 'LEGACY_MIGRATED',
        canonical_id: 'LEGACY-CRIT',
        step_id: '',
        rubric_id: 'MM12-TRUCK-AD-R1',
        rubric_version: '2026-09-23.1',
        criterion_id: 'TA-MM-C1',
        outcome_codes_raw: 'MM12-1.1',
        evidence_type_raw: rec.type === 'both' ? 'Observation+Conversation' : rec.type === 'conversation' ? 'Conversation' : 'Observation',
        response_value: rec.conversationNotes || rec.observationNotes || 'Legacy assessment note',
        teacher_note: rec.observationNotes ? `Observation: ${rec.observationNotes}` : (rec.conversationNotes || ''),
        level_raw: rec.selectedBandName || undefined,
        teacher_verified: false,
        source: 'field',
        timestamp: rec.date || new Date().toISOString(),
        local_status: 'pending',
        google_mirror_status: 'unverified',
        learner_name: rec.studentName,
        rubric_title: rec.rubricTitle,
      };

      await savePendingEvent(mappedEvent);
      count++;
    }

    setMigratedCount(count);
    setIsMigrating(false);
    onMigrationComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Legacy Records & Migration Hub</h3>
              <p className="text-xs text-slate-500">Preserve and migrate previous AssessTrack records</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="space-y-3 text-xs text-slate-700">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900">Previous Local Storage Records Found:</span>
              <span className="font-extrabold text-sm text-indigo-700">{legacyRecords.length} records</span>
            </div>
            <p className="text-slate-500 text-[11px]">
              All previously saved assessment logs are preserved safely in your device storage. You can download an offline JSON backup or migrate them into the new Evidence Map format.
            </p>
          </div>

          {migratedCount > 0 && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Successfully queued {migratedCount} legacy records for Evidence Map synchronization.</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          <button
            onClick={handleExportLegacyJson}
            className="py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center space-x-1.5 min-h-[44px]"
          >
            <Download className="w-4 h-4" />
            <span>Download Backup JSON</span>
          </button>

          <button
            onClick={handleMigrateAll}
            disabled={isMigrating || legacyRecords.length === 0}
            className="py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center justify-center space-x-1.5 min-h-[44px]"
          >
            <span>{isMigrating ? 'Migrating...' : 'Migrate to Evidence Map'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
};
