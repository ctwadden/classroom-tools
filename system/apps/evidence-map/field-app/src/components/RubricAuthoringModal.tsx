import React, { useState, useEffect } from 'react';
import { 
  ApprovedRubric, 
  CourseId, 
  RubricCriterion,
  OutcomeDefinition 
} from '../types/evidenceContract';
import { saveDraftRubric, saveApprovedRubric } from '../utils/indexedDb';
import { 
  ScrollText, 
  Sparkles, 
  Plus, 
  Trash2, 
  Save, 
  Send, 
  AlertCircle, 
  CheckCircle2, 
  Layers, 
  Copy,
  Info
} from 'lucide-react';
import catalogueData from '../data/connected-catalogue.json';

interface RubricAuthoringModalProps {
  isOpen: boolean;
  onClose: () => void;
  courseId: CourseId;
  initialRubricToDuplicate?: ApprovedRubric | null;
  onPublished: (rubric: ApprovedRubric) => void;
}

export const RubricAuthoringModal: React.FC<RubricAuthoringModalProps> = ({
  isOpen,
  onClose,
  courseId: defaultCourseId,
  initialRubricToDuplicate,
  onPublished,
}) => {
  const [course, setCourse] = useState<CourseId>(defaultCourseId);
  const [title, setTitle] = useState<string>('');
  const [projectId, setProjectId] = useState<string>('');
  const [criteria, setCriteria] = useState<RubricCriterion[]>([]);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Available outcomes for selected course
  const [availableOutcomes, setAvailableOutcomes] = useState<OutcomeDefinition[]>([]);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setCourse(defaultCourseId);

      const catalogue = catalogueData as any;
      const filtered = (catalogue.outcomes || []).filter((o: OutcomeDefinition) => o.course_id === defaultCourseId);
      setAvailableOutcomes(filtered);

      if (initialRubricToDuplicate) {
        setTitle(`${initialRubricToDuplicate.title} (Adapted)`);
        setProjectId(initialRubricToDuplicate.project_id || '');
        setCriteria(initialRubricToDuplicate.criteria || []);
      } else {
        // Initial blank template with 1 criterion
        setTitle('');
        setProjectId('');
        setCriteria([
          {
            id: `crit_${Date.now()}_1`,
            name: 'Concept Application & Workflow',
            outcome_codes: [],
            descriptors: {
              Beginning: '',
              Developing: '',
              Secure: '',
              Extending: '',
            },
            collection: 'Observation during active studio work and student explanation.',
            mapping_ready: true,
          },
        ]);
      }
    }
  }, [isOpen, defaultCourseId, initialRubricToDuplicate]);

  const handleCourseChange = (newCourse: CourseId) => {
    setCourse(newCourse);
    const catalogue = catalogueData as any;
    const filtered = (catalogue.outcomes || []).filter((o: OutcomeDefinition) => o.course_id === newCourse);
    setAvailableOutcomes(filtered);
  };

  const handleAddCriterion = () => {
    const defaultOutcome: string[] = [];
    setCriteria([
      ...criteria,
      {
        id: `crit_${Date.now()}_${criteria.length + 1}`,
        name: `New Criterion ${criteria.length + 1}`,
        outcome_codes: defaultOutcome,
        descriptors: {
          Beginning: '',
          Developing: '',
          Secure: '',
          Extending: '',
        },
        collection: 'Observation & conversation notes.',
        mapping_ready: true,
      },
    ]);
  };

  const handleRemoveCriterion = (idx: number) => {
    if (criteria.length <= 1) return;
    setCriteria(criteria.filter((_, i) => i !== idx));
  };

  const handleUpdateCriterion = (idx: number, field: keyof RubricCriterion, value: any) => {
    setCriteria((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      return updated;
    });
  };

  const handleUpdateDescriptor = (critIdx: number, band: 'Beginning' | 'Developing' | 'Secure' | 'Extending', text: string) => {
    setCriteria((prev) => {
      const updated = [...prev];
      updated[critIdx] = {
        ...updated[critIdx],
        descriptors: {
          ...updated[critIdx].descriptors,
          [band]: text,
        },
      };
      return updated;
    });
  };

  const handleAskGeminiDraft = async () => {
    if (!title.trim()) {
      setErrorMessage('Please enter an assignment or outcome title first so Gemini has context.');
      return;
    }
    setIsAiGenerating(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/ai/rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcomeTitle: title,
          subject: course === 'MM12' ? 'Multimedia 12' : course === 'COM11' ? 'Communications Tech 11' : 'IB Digital Society',
          bandTemplate: '4-Band: Beginning, Developing, Secure, Extending',
          description: 'Criterion-referenced rubric for classroom observation and conversation.',
        }),
      });

      const data = await response.json();
      if (data.success && data.rubric?.criteria) {
        const generatedCriteria: RubricCriterion[] = data.rubric.criteria.map((c: any, i: number) => ({
          id: `crit_ai_${Date.now()}_${i + 1}`,
          name: c.title || `Criterion ${i + 1}`,
          outcome_codes: [],
          descriptors: {
            Beginning: c.bands?.find((b: any) => /beginning|emerging|1/i.test(b.name))?.description || 'Requires guidance.',
            Developing: c.bands?.find((b: any) => /developing|2/i.test(b.name))?.description || 'Demonstrates partial skill.',
            Secure: c.bands?.find((b: any) => /secure|proficient|3/i.test(b.name))?.description || 'Applies skill accurately.',
            Extending: c.bands?.find((b: any) => /extending|advanced|4/i.test(b.name))?.description || 'Extends and transfers skill.',
          },
          collection: 'Observation and conversation during studio work.',
          mapping_ready: true,
        }));
        setCriteria(generatedCriteria);
        setSuccessMessage('Gemini drafted criteria descriptors based on your assignment title!');
      } else {
        setErrorMessage('Could not generate draft; check Gemini server status.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Gemini drafting error.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!title.trim()) {
      setErrorMessage('Assignment title is required');
      return;
    }
    const rubricId = `${course}-${title.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20)}-R1`;
    const draft: ApprovedRubric = {
      id: rubricId,
      version: 'draft.1',
      course,
      project_id: projectId.trim() || `${course}-PROJECT-${title.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').slice(0,60)}`,
      title: title.trim(),
      status: 'draft',
      bands: ['Beginning', 'Developing', 'Secure', 'Extending'],
      criteria,
      capture_ready: false,
    };
    await saveDraftRubric(draft);
    setSuccessMessage('Saved local draft! You can review and publish when ready.');
  };

  const handlePublishImmutableVersion = async () => {
    if (!title.trim()) {
      setErrorMessage('Assignment title is required');
      return;
    }
    setIsPublishing(true);
    setErrorMessage(null);

    const rubricId = `${course}-${title.toUpperCase().replace(/[^A-Z0-9]/g, '-').slice(0, 20)}-R1`;
    const version = `${new Date().toISOString().slice(0, 10)}.1`;

    const publishedRubric: ApprovedRubric = {
      id: rubricId,
      version,
      course,
      project_id: projectId.trim() || `${course}-PROJECT-${title.trim().toUpperCase().replace(/[^A-Z0-9]+/g,'-').slice(0,60)}`,
      title: title.trim(),
      status: 'approved',
      approved_at: new Date().toISOString(),
      bands: ['Beginning', 'Developing', 'Secure', 'Extending'],
      criteria,
      capture_ready: true,
    };

    // Only a successful server response creates an approved local release.
    try {
      const response=await fetch('/.netlify/functions/evidence-bridge?action=rubric-publish',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({...publishedRubric,confirmed:true})});
      const data=await response.json();
      if(!response.ok||!data.ok||data.rubric?.status!=='approved')throw new Error(data.error||'Publishing failed. Your rubric remains a draft.');
      await saveApprovedRubric(data.rubric);
      onPublished(data.rubric);onClose();
    }catch(error:any){setErrorMessage(error.message||'Publishing failed. Your rubric remains a draft.');}
    finally{setIsPublishing(false);}

  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Rubric Authoring & Publishing</h3>
              <p className="text-xs text-slate-500">
                Draft → Teacher Review → Explicit Immutable Version Release
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            ✕
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          
          {/* Course & Title Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                Target Course:
              </label>
              <select
                value={course}
                onChange={(e) => handleCourseChange(e.target.value as CourseId)}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-800"
              >
                <option value="MM12">Multimedia 12 (MM12)</option>
                <option value="COM11">Communications Tech 11 (COM11)</option>
                <option value="IBDS">IB Digital Society SL (IBDS)</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                  Assignment Title:
                </label>
                <button
                  type="button"
                  onClick={handleAskGeminiDraft}
                  disabled={isAiGenerating}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>{isAiGenerating ? 'Drafting...' : 'Ask Gemini for Draft'}</span>
                </button>
              </div>
              <input
                type="text"
                placeholder="e.g. Visual Hierarchy & Layer Masking Project"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <label className="block text-sm font-bold">Assignment / workbook
            <select value={projectId} onChange={e=>setProjectId(e.target.value)} className="block w-full p-3 mt-1 border rounded-xl bg-white">
              <option value="">New assignment using the title above</option>
              {Array.from(new Map((catalogueData as any).rubrics.filter((r:any)=>r.course===course&&r.project_id).map((r:any)=>[r.project_id,r.title])).entries()).map(([id,name]:any)=><option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <p className="text-xs text-slate-600">The download includes the shared assignment and rubric references for the workbook author. Review outcome links and performance descriptions before publishing.</p>
          {/* Criteria List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Rubric Criteria ({criteria.length})
              </h4>
              <button
                type="button"
                onClick={handleAddCriterion}
                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center space-x-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Criterion</span>
              </button>
            </div>

            {criteria.map((crit, idx) => (
              <div
                key={crit.id}
                className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200 space-y-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={crit.name}
                    onChange={(e) => handleUpdateCriterion(idx, 'name', e.target.value)}
                    placeholder="Criterion Name..."
                    className="flex-1 p-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-900"
                  />
                  {criteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCriterion(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Outcome Code Mapping */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                    Mapped Outcome Codes:
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {availableOutcomes.map((o) => {
                      const isMapped = (crit.outcome_codes || []).includes(o.outcome_code);
                      return (
                        <button
                          key={o.outcome_id}
                          type="button"
                          onClick={() => {
                            const newCodes = isMapped
                              ? (crit.outcome_codes || []).filter((c) => c !== o.outcome_code)
                              : [...(crit.outcome_codes || []), o.outcome_code];
                            handleUpdateCriterion(idx, 'outcome_codes', newCodes);
                          }}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            isMapped
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                          title={o.outcome_title}
                        >
                          {o.display_code || o.outcome_code}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <label className="block text-xs text-slate-600">
                  Taught skills
                  <select multiple size={5} value={crit.skill_ids || []}
                    onChange={(e) => handleUpdateCriterion(idx, 'skill_ids', Array.from(e.target.selectedOptions, o => o.value))}
                    className="w-full p-2 rounded-lg border border-slate-200 mt-1">
                    {Array.from(new Map([
                      ...(crit.skill_ids || []).map(id => [id, id]),
                      ...((catalogueData as any).skills || []).filter((s:any) => !s.course || s.course === course || s.course === 'ALL').map((s:any) => [s.id, s.name || s.id]),
                      ...((catalogueData as any).crosswalk?.crosswalk || []).map((s:any) => [s.tutorial_skill_id, s.tutorial_label || s.tutorial_skill_id])
                    ]).entries()).map(([id, name]:any) => <option key={id} value={id}>{name} · {id}</option>)}
                  </select>
                  <span className="text-[10px]">Choose the skills this criterion actually samples. On a keyboard, hold Command or Control to choose several.</span>
                </label>
                <label className="block text-xs text-slate-600">
                  Evidence to collect
                  <textarea rows={2} value={crit.collection || ''}
                    onChange={(e) => handleUpdateCriterion(idx, 'collection', e.target.value)}
                    className="w-full p-2 rounded-lg border border-slate-200 mt-1" />
                </label>

                {/* 4 Performance Descriptors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-amber-800 block mb-0.5">1 - Beginning:</span>
                    <textarea
                      rows={2}
                      value={crit.descriptors?.Beginning || ''}
                      onChange={(e) => handleUpdateDescriptor(idx, 'Beginning', e.target.value)}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-[11px]"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-blue-800 block mb-0.5">2 - Developing:</span>
                    <textarea
                      rows={2}
                      value={crit.descriptors?.Developing || ''}
                      onChange={(e) => handleUpdateDescriptor(idx, 'Developing', e.target.value)}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-[11px]"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-emerald-800 block mb-0.5">3 - Secure:</span>
                    <textarea
                      rows={2}
                      value={crit.descriptors?.Secure || ''}
                      onChange={(e) => handleUpdateDescriptor(idx, 'Secure', e.target.value)}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-[11px]"
                    />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-purple-800 block mb-0.5">4 - Extending:</span>
                    <textarea
                      rows={2}
                      value={crit.descriptors?.Extending || ''}
                      onChange={(e) => handleUpdateDescriptor(idx, 'Extending', e.target.value)}
                      className="w-full p-2 rounded-lg bg-white border border-slate-200 text-[11px]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Status / Notices */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3 shrink-0">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-1.5 min-h-[44px]"
          >
            <Save className="w-4 h-4" />
            <span>Save Local Draft</span>
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
              onClick={handlePublishImmutableVersion}
              disabled={isPublishing}
              className="py-2.5 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm min-h-[44px]"
            >
              <Send className="w-4 h-4" />
              <span>{isPublishing ? 'Publishing...' : 'Publish Version to Registry'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
