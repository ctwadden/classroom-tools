import React, { useState } from 'react';
import { AssessmentRecord, OutcomeRubric, Student } from '../types';
import { generateStudentReportPDF, generateClassSummaryPDF } from '../utils/pdfGenerator';
import { 
  FileDown, 
  FileText, 
  Trash2, 
  Filter, 
  Calendar, 
  Eye, 
  MessageSquare, 
  Sparkles, 
  Search, 
  CheckCircle2, 
  Clock,
  Play,
  Volume2
} from 'lucide-react';

interface HistoryReportsProps {
  records: AssessmentRecord[];
  students: Student[];
  rubrics: OutcomeRubric[];
  onDeleteRecord: (id: string) => void;
}

export const HistoryReports: React.FC<HistoryReportsProps> = ({
  records,
  students,
  rubrics,
  onDeleteRecord,
}) => {
  const [selectedStudentFilter, setSelectedStudentFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const filteredRecords = records.filter((r) => {
    if (selectedStudentFilter !== 'all' && r.studentId !== selectedStudentFilter) return false;
    if (selectedTypeFilter !== 'all' && r.type !== selectedTypeFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = r.studentName.toLowerCase().includes(q);
      const matchTitle = r.rubricTitle.toLowerCase().includes(q);
      const matchObs = r.observationNotes.toLowerCase().includes(q);
      const matchConvo = r.conversationNotes.toLowerCase().includes(q);
      const matchTranscript = (r.voiceTranscript || '').toLowerCase().includes(q);
      if (!matchName && !matchTitle && !matchObs && !matchConvo && !matchTranscript) {
        return false;
      }
    }
    return true;
  });

  const handleDownloadStudentPDF = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const studentRecords = records.filter((r) => r.studentId === studentId);
    generateStudentReportPDF(student, studentRecords, rubrics);
  };

  const handleDownloadClassPDF = () => {
    generateClassSummaryPDF(records, rubrics, students);
  };

  const playRecordAudio = (recordId: string, url: string) => {
    const audio = new Audio(url);
    setPlayingAudioId(recordId);
    audio.play();
    audio.onended = () => setPlayingAudioId(null);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & PDF Export Actions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Evidence History & PDF Reports</h2>
          <p className="text-xs text-slate-500">
            {records.length} assessment records logged. Export organized PDF reports for your school records and conferences.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {selectedStudentFilter !== 'all' && (
            <button
              onClick={() => handleDownloadStudentPDF(selectedStudentFilter)}
              className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs border border-indigo-200 shadow-2xs transition-all active:scale-95"
            >
              <FileDown className="w-4 h-4" />
              <span>Export Student PDF Portfolio</span>
            </button>
          )}

          <button
            onClick={handleDownloadClassPDF}
            disabled={records.length === 0}
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md transition-all active:scale-95 disabled:opacity-50"
          >
            <FileText className="w-4 h-4" />
            <span>Export Class Summary PDF</span>
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Student Filter */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Filter by Student:</label>
          <select
            value={selectedStudentFilter}
            onChange={(e) => setSelectedStudentFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
          >
            <option value="all">All Students ({students.length})</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Evidence Mode Filter */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Evidence Mode:</label>
          <select
            value={selectedTypeFilter}
            onChange={(e) => setSelectedTypeFilter(e.target.value)}
            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900"
          >
            <option value="all">All Evidence Types</option>
            <option value="observation">Observation Only</option>
            <option value="conversation">Conversation Only</option>
            <option value="both">Both (Observation & Conversation)</option>
          </select>
        </div>

        {/* Search */}
        <div>
          <label className="text-xs font-bold text-slate-600 block mb-1">Search Keywords:</label>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quotes, feedback, notes..."
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* Records Feed */}
      {filteredRecords.length === 0 ? (
        <div className="text-center py-16 bg-white border border-slate-200 rounded-2xl p-6">
          <Clock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-800">No Assessment Records Found</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {records.length === 0
              ? "You haven't saved any student assessments yet. Use the Assess Student tab to begin documenting observations and conversations."
              : 'No records match the current filter selection.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRecords.map((record) => (
            <div
              key={record.id}
              className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs hover:border-slate-300 transition-colors space-y-4"
            >
              {/* Top Record Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-sm shrink-0">
                    {record.studentName.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h4 className="text-sm font-bold text-slate-900">{record.studentName}</h4>
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-slate-100 text-slate-800">
                        {record.selectedBandName} (Score: {record.selectedScore})
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium">{record.rubricTitle}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-xs text-slate-400 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{new Date(record.date).toLocaleDateString()}</span>
                  </span>

                  {record.syncedToGoogleSheet ? (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      Synced to Sheet
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                      Local
                    </span>
                  )}

                  <button
                    onClick={() => {
                      if (confirm('Delete this assessment record?')) {
                        onDeleteRecord(record.id);
                      }
                    }}
                    className="text-slate-400 hover:text-rose-600 p-1"
                    title="Delete record"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Observation & Conversation Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {/* Observations */}
                {record.observationNotes && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl">
                    <div className="flex items-center space-x-1.5 font-bold text-slate-700 mb-1.5">
                      <Eye className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Observation Notes:</span>
                    </div>
                    <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                      {record.observationNotes}
                    </p>
                  </div>
                )}

                {/* Conversation & Voice Note */}
                {(record.conversationNotes || record.voiceTranscript || record.voiceAudioUrl) && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-1.5 font-bold text-slate-700">
                        <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Conversation Dialogue:</span>
                      </div>
                      {record.voiceAudioUrl && (
                        <button
                          onClick={() => playRecordAudio(record.id, record.voiceAudioUrl!)}
                          className="inline-flex items-center space-x-1 text-xs text-indigo-600 hover:text-indigo-800 font-semibold"
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                          <span>{playingAudioId === record.id ? 'Playing...' : 'Play Audio'}</span>
                        </button>
                      )}
                    </div>

                    {record.conversationNotes && (
                      <p className="text-slate-800 whitespace-pre-line leading-relaxed">
                        {record.conversationNotes}
                      </p>
                    )}

                    {record.voiceTranscript && (
                      <p className="text-slate-700 italic bg-white p-2 rounded-lg border border-slate-200">
                        "{record.voiceTranscript}"
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* AI Feedback & Next Steps if generated */}
              {record.aiAssessment && (
                <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center space-x-1.5 font-bold text-indigo-950">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>AI Feedback & Suggested Next Steps:</span>
                  </div>
                  <p className="text-indigo-900 leading-relaxed">
                    <span className="font-semibold">Feedback: </span>
                    {record.aiAssessment.studentFeedback}
                  </p>
                  {record.aiAssessment.suggestedNextSteps?.length > 0 && (
                    <p className="text-indigo-800">
                      <span className="font-semibold">Next Steps: </span>
                      {record.aiAssessment.suggestedNextSteps.join('; ')}
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
