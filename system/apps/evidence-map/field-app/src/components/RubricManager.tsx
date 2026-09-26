import React, { useState } from 'react';
import { OutcomeRubric, RubricCriterion, RubricBand } from '../types';
import { PRESET_BAND_TEMPLATES } from '../data/defaults';
import { 
  Plus, 
  Sparkles, 
  Trash2, 
  Edit3, 
  Check, 
  Copy, 
  BookOpen, 
  ChevronDown, 
  ChevronUp, 
  Loader2,
  Settings,
  ArrowRight
} from 'lucide-react';

interface RubricManagerProps {
  rubrics: OutcomeRubric[];
  onSaveRubrics: (rubrics: OutcomeRubric[]) => void;
  onSelectRubricForAssessment: (rubricId: string) => void;
}

export const RubricManager: React.FC<RubricManagerProps> = ({
  rubrics,
  onSaveRubrics,
  onSelectRubricForAssessment,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingRubricId, setEditingRubricId] = useState<string | null>(null);

  // Form states for rubric creation/editing
  const [title, setTitle] = useState('');
  const [outcomeCode, setOutcomeCode] = useState('');
  const [subject, setSubject] = useState('General');
  const [gradeLevel, setGradeLevel] = useState('Middle School');
  const [description, setDescription] = useState('');
  const [selectedPresetId, setSelectedPresetId] = useState('standards-4');
  const [customCriteria, setCustomCriteria] = useState<RubricCriterion[]>([]);
  
  // AI Generation state
  const [isAiGenerating, setIsAiGenerating] = useState(false);

  // Expanded cards tracker
  const [expandedRubricIds, setExpandedRubricIds] = useState<Record<string, boolean>>({
    [rubrics[0]?.id || '']: true,
  });

  const toggleExpand = (id: string) => {
    setExpandedRubricIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const startNewRubric = () => {
    setTitle('');
    setOutcomeCode('');
    setSubject('General');
    setGradeLevel('Grade 6');
    setDescription('');
    setSelectedPresetId('standards-4');
    
    // Set default initial criteria with selected preset
    const preset = PRESET_BAND_TEMPLATES.find((p) => p.id === 'standards-4') || PRESET_BAND_TEMPLATES[0];
    setCustomCriteria([
      {
        id: `crit-${Date.now()}-1`,
        title: 'Conceptual Understanding & Reasoning',
        description: 'Articulates conceptual relationships and justifies problem-solving process during conversation and task.',
        bands: JSON.parse(JSON.stringify(preset.bands)),
      },
      {
        id: `crit-${Date.now()}-2`,
        title: 'Communication & Mathematical/Scientific Discourse',
        description: 'Uses precise vocabulary and evidence during teacher-student interaction.',
        bands: JSON.parse(JSON.stringify(preset.bands)),
      },
    ]);

    setEditingRubricId(null);
    setIsCreating(true);
  };

  const editExistingRubric = (rubric: OutcomeRubric) => {
    setTitle(rubric.title);
    setOutcomeCode(rubric.outcomeCode || '');
    setSubject(rubric.subject || 'General');
    setGradeLevel(rubric.gradeLevel || 'Middle School');
    setDescription(rubric.description);
    setCustomCriteria(JSON.parse(JSON.stringify(rubric.criteria)));
    setEditingRubricId(rubric.id);
    setIsCreating(true);
  };

  const handleApplyPresetToCriteria = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PRESET_BAND_TEMPLATES.find((p) => p.id === presetId);
    if (!preset) return;

    setCustomCriteria((prev) =>
      prev.map((crit) => ({
        ...crit,
        bands: JSON.parse(JSON.stringify(preset.bands)),
      }))
    );
  };

  // AI Rubric Generator
  const handleGenerateRubricWithAi = async () => {
    if (!title.trim() && !description.trim()) {
      alert('Please enter an Outcome Title or Description before asking AI to generate the rubric.');
      return;
    }

    setIsAiGenerating(true);
    try {
      const preset = PRESET_BAND_TEMPLATES.find((p) => p.id === selectedPresetId);
      const res = await fetch('/api/ai/rubric', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          outcomeTitle: title,
          outcomeCode,
          subject,
          gradeLevel,
          description,
          bandTemplate: preset?.name || '4-Band Standards',
        }),
      });

      const data = await res.json();
      if (data.success && data.rubric) {
        if (data.rubric.title && !title) setTitle(data.rubric.title);
        if (data.rubric.description && !description) setDescription(data.rubric.description);
        if (data.rubric.criteria && data.rubric.criteria.length > 0) {
          setCustomCriteria(data.rubric.criteria);
        }
      } else {
        alert(data.error || 'Failed to generate rubric');
      }
    } catch (err: any) {
      console.error('AI Rubric Generation error:', err);
      alert('Could not generate rubric with AI.');
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleSaveRubric = () => {
    if (!title.trim()) {
      alert('Please enter a rubric or outcome title.');
      return;
    }
    if (customCriteria.length === 0) {
      alert('Please add at least one criterion.');
      return;
    }

    const updatedRubric: OutcomeRubric = {
      id: editingRubricId || `rubric-${Date.now()}`,
      title,
      outcomeCode: outcomeCode || undefined,
      subject,
      gradeLevel,
      description,
      criteria: customCriteria,
      createdAt: editingRubricId ? rubrics.find((r) => r.id === editingRubricId)?.createdAt || new Date().toISOString() : new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedList: OutcomeRubric[];
    if (editingRubricId) {
      updatedList = rubrics.map((r) => (r.id === editingRubricId ? updatedRubric : r));
    } else {
      updatedList = [updatedRubric, ...rubrics];
    }

    onSaveRubrics(updatedList);
    setIsCreating(false);
    setEditingRubricId(null);
    setExpandedRubricIds((prev) => ({ ...prev, [updatedRubric.id]: true }));
  };

  const handleDeleteRubric = (id: string) => {
    if (rubrics.length <= 1) {
      alert('You must have at least one outcome rubric available.');
      return;
    }
    if (confirm('Are you sure you want to delete this rubric?')) {
      const filtered = rubrics.filter((r) => r.id !== id);
      onSaveRubrics(filtered);
    }
  };

  // Add custom band to a criterion
  const handleAddBandToCriterion = (critIndex: number) => {
    const crit = customCriteria[critIndex];
    const newScore = crit.bands.length + 1;
    const newBand: RubricBand = {
      id: `b-${Date.now()}`,
      name: `Level ${newScore}`,
      score: newScore,
      color: 'indigo',
      description: 'Observable student action and evidence indicator.',
    };

    setCustomCriteria((prev) => {
      const copy = [...prev];
      copy[critIndex].bands.push(newBand);
      return copy;
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & New Rubric Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Outcome & Assignment Rubrics</h2>
          <p className="text-xs text-slate-500">
            Define learning outcomes, use pre-canned standard bands or take custom control, and auto-generate rubrics with AI.
          </p>
        </div>

        {!isCreating && (
          <button
            onClick={startNewRubric}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-md shadow-indigo-100 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>New Outcome Rubric</span>
          </button>
        )}
      </div>

      {/* Creation / Edit Form Modal/Section */}
      {isCreating && (
        <div className="bg-white border-2 border-indigo-500 rounded-2xl p-6 shadow-md space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {editingRubricId ? 'Edit Outcome Rubric' : 'Create New Outcome Rubric'}
              </h3>
              <p className="text-xs text-slate-500">
                Configure your outcome target, select pre-canned bands or customize descriptors
              </p>
            </div>
            <button
              onClick={() => setIsCreating(false)}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200"
            >
              Cancel
            </button>
          </div>

          {/* Outcome Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Outcome / Assignment Title: *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Ratio & Proportional Reasoning"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Standard / Outcome Code:
              </label>
              <input
                type="text"
                value={outcomeCode}
                onChange={(e) => setOutcomeCode(e.target.value)}
                placeholder="e.g. MATH.6.RP.A.1"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Subject & Grade Level:
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Subject"
                  className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
                <input
                  type="text"
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  placeholder="Grade"
                  className="w-1/2 px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Outcome Intent / Observation Focus:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What specifically should be observed in student conversations, problem-solving discourse, and physical tasks..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900"
            />
          </div>

          {/* Pre-canned Band Templates vs Take Control */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Rubric Band Structure:
                </span>
                <span className="text-xs text-slate-500">
                  Choose a pre-canned template, or customize each band descriptor below
                </span>
              </div>

              {/* AI Auto-generate button */}
              <button
                type="button"
                onClick={handleGenerateRubricWithAi}
                disabled={isAiGenerating}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-xs font-bold shadow-xs hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
              >
                {isAiGenerating ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>{isAiGenerating ? 'Generating with Gemini...' : 'Generate Rubric with AI'}</span>
              </button>
            </div>

            {/* Pre-canned Template Pills */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              {PRESET_BAND_TEMPLATES.map((preset) => {
                const isSelected = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPresetToCriteria(preset.id)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold ring-2 ring-indigo-200'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <p className="text-xs font-bold">{preset.name}</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      {preset.bands.map((b) => b.name).join(' → ')}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Criteria & Bands Customizer */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Criteria & Performance Descriptors ({customCriteria.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  const preset = PRESET_BAND_TEMPLATES.find((p) => p.id === selectedPresetId) || PRESET_BAND_TEMPLATES[0];
                  setCustomCriteria((prev) => [
                    ...prev,
                    {
                      id: `crit-${Date.now()}`,
                      title: 'New Assessment Criterion',
                      description: 'Observational and conversational indicators.',
                      bands: JSON.parse(JSON.stringify(preset.bands)),
                    },
                  ]);
                }}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                + Add Criterion
              </button>
            </div>

            {customCriteria.map((crit, critIdx) => (
              <div key={crit.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={crit.title}
                    onChange={(e) => {
                      const updated = [...customCriteria];
                      updated[critIdx].title = e.target.value;
                      setCustomCriteria(updated);
                    }}
                    placeholder="Criterion Title (e.g. Explaining Reasoning)"
                    className="font-bold text-sm text-slate-900 border-b border-slate-200 pb-1 focus:outline-hidden focus:border-indigo-500 flex-1"
                  />
                  {customCriteria.length > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomCriteria(customCriteria.filter((_, i) => i !== critIdx));
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title="Remove Criterion"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Bands grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {crit.bands.map((band, bandIdx) => (
                    <div key={band.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5">
                      <div className="flex items-center justify-between">
                        <input
                          type="text"
                          value={band.name}
                          onChange={(e) => {
                            const updated = [...customCriteria];
                            updated[critIdx].bands[bandIdx].name = e.target.value;
                            setCustomCriteria(updated);
                          }}
                          className="text-xs font-bold text-slate-900 bg-transparent border-b border-slate-300 w-28 focus:outline-hidden"
                        />
                        <span className="text-[11px] font-mono text-slate-500">
                          Score {band.score}
                        </span>
                      </div>
                      <textarea
                        rows={3}
                        value={band.description}
                        onChange={(e) => {
                          const updated = [...customCriteria];
                          updated[critIdx].bands[bandIdx].description = e.target.value;
                          setCustomCriteria(updated);
                        }}
                        placeholder="Observable indicators for this band..."
                        className="w-full text-xs text-slate-700 bg-white border border-slate-200 rounded-md p-2 focus:outline-hidden focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Save / Cancel Bar */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-sm hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveRubric}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition-all active:scale-95"
            >
              Save Outcome Rubric
            </button>
          </div>
        </div>
      )}

      {/* Existing Rubrics List */}
      <div className="space-y-4">
        {rubrics.map((rubric) => {
          const isExpanded = Boolean(expandedRubricIds[rubric.id]);
          return (
            <div
              key={rubric.id}
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs hover:border-slate-300 transition-colors"
            >
              {/* Collapsible Header */}
              <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 cursor-pointer" onClick={() => toggleExpand(rubric.id)}>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-slate-900">{rubric.title}</h3>
                    {rubric.outcomeCode && (
                      <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                        {rubric.outcomeCode}
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-medium">
                      {rubric.subject || 'General'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rubric.description}</p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    onClick={() => onSelectRubricForAssessment(rubric.id)}
                    className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-all"
                    title="Assess students using this rubric"
                  >
                    <span>Assess with this Rubric</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    onClick={() => editExistingRubric(rubric)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                    title="Edit Rubric"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleDeleteRubric(rubric.id)}
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Delete Rubric"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => toggleExpand(rubric.id)}
                    className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
                  >
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded Criteria Matrix */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-4">
                  {rubric.criteria.map((crit) => (
                    <div key={crit.id} className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-800 flex items-center space-x-2">
                        <span>{crit.title}</span>
                        {crit.description && (
                          <span className="text-slate-400 font-normal">({crit.description})</span>
                        )}
                      </h4>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {crit.bands.map((band) => (
                          <div
                            key={band.id}
                            className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-bold text-slate-900">{band.name}</span>
                              <span className="text-[11px] font-mono text-slate-400 font-semibold">
                                Score {band.score}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600 leading-relaxed">
                              {band.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
