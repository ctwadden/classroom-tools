import React, { useState, useEffect } from 'react';
import { 
  ApprovedRubric, 
  Learner, 
  CourseId, 
  AchievementBand, 
  SupportContext, 
  EvidenceMethod,
  FieldEvent,
  CompletedRubricSession,
  CompletedRubricCriterionAssessment
} from '../types/evidenceContract';
import { saveAssessmentSession } from '../utils/indexedDb';
import { 
  ClipboardCheck, 
  CheckCircle2, 
  Download, 
  FileText, 
  Layers, 
  Save, 
  X, 
  AlertCircle,
  HelpCircle,
  Sparkles
} from 'lucide-react';

interface CompleteRubricModalProps {
  isOpen: boolean;
  onClose: () => void;
  rubric: ApprovedRubric;
  learner: Learner;
  courseId: CourseId;
  onSaved: (sessionId: string) => void;
}

export const CompleteRubricModal: React.FC<CompleteRubricModalProps> = ({
  isOpen,
  onClose,
  rubric,
  learner,
  courseId,
  onSaved,
}) => {
  const storageKey = `rubric_session_${courseId}_${learner?.learner_id}_${rubric?.id}_${rubric?.version}`;

  const [sessionId, setSessionId] = useState<string>('');
  const [evaluations, setEvaluations] = useState<Record<string, {
    methods: EvidenceMethod[];
    level?: AchievementBand;
    support?: SupportContext;
    note: string;
    artifactUrl?: string;
  }>>({});
  const [criterionEventIds, setCriterionEventIds] = useState<Record<string, string>>({});
  const [sourceRevisions, setSourceRevisions] = useState<Record<string, number>>({});
  const [overallNote, setOverallNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && rubric && learner) {
      setSuccessNotice(null);
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.sessionId) {
            setSessionId(parsed.sessionId);
            setEvaluations(parsed.evaluations || {});
            setCriterionEventIds(parsed.criterionEventIds || {});
            setSourceRevisions(parsed.sourceRevisions || {});
            setOverallNote(parsed.overallNote || '');
            return;
          }
        }
      } catch {}

      // Fresh session with stable deterministic ID
      const newSessionId = `session_${crypto.randomUUID()}`;
      setSessionId(newSessionId);
      setEvaluations({});
      setCriterionEventIds({});
      setSourceRevisions({});
      setOverallNote('');
    }
  }, [isOpen, rubric, learner, storageKey]);

  // Persist partial state on changes
  useEffect(() => {
    if (isOpen && sessionId && rubric && learner) {
      try {
        localStorage.setItem(storageKey, JSON.stringify({
          sessionId,
          evaluations,
          criterionEventIds,
          sourceRevisions,
          overallNote,
        }));
      } catch {}
    }
  }, [isOpen, sessionId, evaluations, criterionEventIds, sourceRevisions, overallNote, storageKey]);

  if (!isOpen) return null;

  const handleToggleMethod = (criterionId: string, method: EvidenceMethod) => {
    setEvaluations((prev) => {
      const cur = prev[criterionId] || { methods: ['Observation'], note: '' };
      const exists = cur.methods.includes(method);
      const newMethods = exists
        ? cur.methods.filter((m) => m !== method)
        : [...cur.methods, method];
      return {
        ...prev,
        [criterionId]: {
          ...cur,
          methods: newMethods.length > 0 ? newMethods : ['Observation'],
        },
      };
    });
  };

  const handleSetLevel = (criterionId: string, level: AchievementBand) => {
    setEvaluations((prev) => {
      const cur = prev[criterionId] || { methods: ['Observation'], note: '' };
      return {
        ...prev,
        [criterionId]: {
          ...cur,
          level: cur.level === level ? undefined : level,
        },
      };
    });
  };

  const handleSetSupport = (criterionId: string, support: SupportContext) => {
    setEvaluations((prev) => {
      const cur = prev[criterionId] || { methods: ['Observation'], note: '' };
      return {
        ...prev,
        [criterionId]: {
          ...cur,
          support: cur.support === support ? undefined : support,
        },
      };
    });
  };

  const handleSetNote = (criterionId: string, note: string) => {
    setEvaluations((prev) => {
      const cur = prev[criterionId] || { methods: ['Observation'], note: '' };
      return {
        ...prev,
        [criterionId]: {
          ...cur,
          note,
        },
      };
    });
  };

  const handleSaveAssessment = async () => {
    if(isSaving)return;
    setIsSaving(true);
    try {
    const pendingEvents:FieldEvent[]=[];
    const now = new Date().toISOString();
    let savedCount = 0;

    const sessionEvaluations: Record<string, CompletedRubricCriterionAssessment> = {};

    const newEventIds = { ...criterionEventIds };
    const newRevisions = { ...sourceRevisions };

    for (const criterion of rubric.criteria) {
      const evaluation = evaluations[criterion.id];
      // Only create an evidence event if the teacher provided a level or note
      if (evaluation && (evaluation.level || evaluation.note.trim())) {
        const eventId = criterionEventIds[criterion.id] || `field_${crypto.randomUUID()}`;
        const sourceRev = (sourceRevisions[criterion.id] || 0) + 1;
        newEventIds[criterion.id] = eventId;
        newRevisions[criterion.id] = sourceRev;

        const evidenceTypeRaw = evaluation.methods.join('+');

        const event: FieldEvent = {
          schema_version: '1.0',
          event_id: eventId,
          source_revision: sourceRev,
          stream: 'evidence',
          learner_id: learner.learner_id,
          course_id: courseId,
          project_id: rubric.project_id || '',
          canonical_id: criterion.id,
          step_id: '',
          rubric_id: rubric.id,
          rubric_version: rubric.version,
          criterion_id: criterion.id,
          tutorial_skill_ids: criterion.skill_ids||[],
          outcome_codes_raw: (criterion.outcome_codes || []).join(';'),
          evidence_type_raw: evidenceTypeRaw,
          response_value: evaluation.note.trim() || 'Evaluated during complete rubric session',
          teacher_note: evaluation.note.trim(),
          level_raw: evaluation.level || undefined,
          independence_raw: evaluation.support || undefined,
          artifact_url: evaluation.artifactUrl || undefined,
          teacher_verified: false,
          source: 'field',
          timestamp: now,
          assessment_session_id: sessionId,
          local_status: 'pending',
          google_mirror_status: 'unverified',
          learner_name: learner.display_name,
          rubric_title: rubric.title,
          criterion_name: criterion.name,
        };

        pendingEvents.push(event);
        savedCount++;

        sessionEvaluations[criterion.id] = {
          criterion_id: criterion.id,
          criterion_name: criterion.name,
          outcome_codes: criterion.outcome_codes || [],
          evidence_methods: evaluation.methods,
          evidence_note: evaluation.note,
          suggested_achievement: evaluation.level,
          support_context: evaluation.support,
          artifact_url: evaluation.artifactUrl,
          event_id: eventId,
          status: 'saved',
        };
      } else {
        sessionEvaluations[criterion.id] = {
          criterion_id: criterion.id,
          criterion_name: criterion.name,
          outcome_codes: criterion.outcome_codes || [],
          evidence_methods: ['Observation'],
          evidence_note: '',
          status: 'unassessed',
        };
      }
    }



    const sessionRecord: CompletedRubricSession = {
      session_id: sessionId,
      learner_id: learner.learner_id,
      learner_name: learner.display_name,
      course_id: courseId,
      rubric_id: rubric.id,
      rubric_version: rubric.version,
      rubric_title: rubric.title,
      project_id: rubric.project_id,
      started_at: now,
      completed_at: now,
      criteria_evaluations: sessionEvaluations,
      overall_teacher_note: overallNote,
      exported_pdf: false,
    };

    await saveAssessmentSession(pendingEvents,sessionRecord);
    setCriterionEventIds(newEventIds);setSourceRevisions(newRevisions);
    setIsSaving(false);
    setSuccessNotice(`Saved ${savedCount} criterion evidence captures for ${learner.display_name}!`);
    setTimeout(() => {
      onSaved(sessionId);
      onClose();
    }, 1200);
    }catch(e){setIsSaving(false);alert("The assessment could not be saved. Your entries remain here; retry.");}
  };

  const handleExportJson = () => {
    const sessionData = {
      session_id: sessionId,
      learner_id: learner.learner_id,
      learner_name: learner.display_name,
      course_id: courseId,
      rubric: {
        id: rubric.id,
        version: rubric.version,
        title: rubric.title,
      },
      evaluations,
      overall_note: overallNote,
      exported_at: new Date().toISOString(),
    };

    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(sessionData, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `rubric_assessment_${learner.display_name.replace(/\s+/g, '_')}_${rubric.id}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const bands: AchievementBand[] = ['IE', 'Beginning', 'Developing', 'Secure', 'Extending'];
  const supportList: SupportContext[] = ['Guided', 'Supported', 'Independent', 'Transfer'];

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900">Complete Student Rubric Assessment</h3>
                <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-mono font-bold">
                  v{rubric.version}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Evaluating <strong>{learner.display_name}</strong> in {courseId} • <em>{rubric.title}</em>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            ✕
          </button>
        </div>

        {/* Scrollable Criteria List */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          
          <div className="p-3 rounded-2xl bg-amber-50/70 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Unassessed Criteria Policy:</strong> Genuinely unassessed criteria can remain blank. They are not calculated as zeros or counted toward a course grade.
            </span>
          </div>

          {rubric.criteria.map((criterion, idx) => {
            const evalState = evaluations[criterion.id] || { methods: ['Observation'], note: '' };

            return (
              <div
                key={criterion.id}
                className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Criterion {idx + 1}
                    </span>
                    <h4 className="text-sm font-bold text-slate-900">{criterion.name}</h4>
                    <p className="text-[11px] text-indigo-700 font-mono mt-0.5">
                      {(criterion.outcome_codes || []).join(' • ')}
                    </p>
                  </div>

                  {/* Method selector */}
                  <div className="flex items-center space-x-1 bg-white p-1 rounded-xl border border-slate-200 text-[11px]">
                    {(['Observation', 'Conversation', 'Product'] as EvidenceMethod[]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleToggleMethod(criterion.id, m)}
                        className={`px-2 py-1 rounded-lg font-bold transition-all ${
                          evalState.methods.includes(m)
                            ? 'bg-indigo-600 text-white'
                            : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {m[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Performance Bands Selector */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Suggested Performance Band (Optional):
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-xs">
                    {bands.map((band) => (
                      <button
                        key={band}
                        type="button"
                        onClick={() => handleSetLevel(criterion.id, band)}
                        className={`p-2 rounded-xl border text-center transition-all min-h-[44px] flex flex-col items-center justify-center ${
                          evalState.level === band
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <span>{band}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Support Context */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">
                    Support Context (Independent of Achievement):
                  </span>
                  <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {supportList.map((sup) => (
                      <button
                        key={sup}
                        type="button"
                        onClick={() => handleSetSupport(criterion.id, sup)}
                        className={`px-2.5 py-1.5 rounded-lg border transition-all ${
                          evalState.support === sup
                            ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                            : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {sup}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Evidence Note */}
                <textarea
                  rows={2}
                  placeholder={`Observation or conversation note for ${criterion.name}...`}
                  value={evalState.note}
                  onChange={(e) => handleSetNote(criterion.id, e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            );
          })}

          {/* Overall Session Note */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
            <label className="text-xs font-bold text-slate-900 block">
              Overall Teacher Summary & Next Steps:
            </label>
            <textarea
              rows={2}
              placeholder="Overall assessment summary or synthesis note..."
              value={overallNote}
              onChange={(e) => setOverallNote(e.target.value)}
              className="w-full p-2.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

        </div>

        {/* Success toast inside modal */}
        {successNotice && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 shrink-0">
          <button
            type="button"
            onClick={handleExportJson}
            className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-1.5 min-h-[44px]"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs min-h-[44px]"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSaveAssessment}
              disabled={isSaving}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Completed Rubric'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
