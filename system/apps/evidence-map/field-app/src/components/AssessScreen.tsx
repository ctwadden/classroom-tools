import React, { useState, useEffect } from 'react';
import { 
  Student, 
  OutcomeRubric, 
  AssessmentRecord, 
  RubricBand, 
  GoogleSheetConfig 
} from '../types';
import { AudioVoiceRecorder } from './AudioVoiceRecorder';
import { 
  CheckCircle2, 
  Sparkles, 
  HelpCircle, 
  ArrowRight, 
  Eye, 
  MessageSquare, 
  Layers, 
  Save, 
  Send, 
  BookOpen, 
  ChevronRight,
  Info,
  Loader2,
  RefreshCw,
  Plus
} from 'lucide-react';

interface AssessScreenProps {
  students: Student[];
  rubrics: OutcomeRubric[];
  sheetConfig: GoogleSheetConfig;
  onSaveRecord: (record: AssessmentRecord, syncImmediately?: boolean) => Promise<void>;
  onNavigateToRubrics: () => void;
  onNavigateToStudents: () => void;
  targetStudentId?: string;
  targetRubricId?: string;
}

const QUICK_OBSERVATION_TAGS = [
  'Used concrete manipulatives',
  'Fluently articulated reasoning',
  'Self-corrected initial mistake',
  'Needed targeted scaffolding',
  'Collaborated productively',
  'Cited specific evidence',
  'Misconception identified',
  'Demonstrated independent mastery',
];

export const AssessScreen: React.FC<AssessScreenProps> = ({
  students,
  rubrics,
  sheetConfig,
  onSaveRecord,
  onNavigateToRubrics,
  onNavigateToStudents,
  targetStudentId,
  targetRubricId,
}) => {
  // Active student selection
  const [selectedStudentId, setSelectedStudentId] = useState<string>(targetStudentId || students[0]?.id || '');
  // Active outcome / rubric selection
  const [selectedRubricId, setSelectedRubricId] = useState<string>(targetRubricId || rubrics[0]?.id || '');
  // Evidence type
  const [evidenceType, setEvidenceType] = useState<'observation' | 'conversation' | 'both'>('both');

  useEffect(() => {
    if (targetStudentId && students.some((s) => s.id === targetStudentId)) {
      setSelectedStudentId(targetStudentId);
    }
  }, [targetStudentId, students]);

  useEffect(() => {
    if (targetRubricId && rubrics.some((r) => r.id === targetRubricId)) {
      setSelectedRubricId(targetRubricId);
    }
  }, [targetRubricId, rubrics]);

  // Input states
  const [observationNotes, setObservationNotes] = useState<string>('');
  const [conversationNotes, setConversationNotes] = useState<string>('');
  const [voiceTranscript, setVoiceTranscript] = useState<string>('');
  const [voiceSummary, setVoiceSummary] = useState<string>('');
  const [audioUrl, setAudioUrl] = useState<string | undefined>(undefined);

  // Rubric band selection
  const [selectedBandId, setSelectedBandId] = useState<string>('');
  const [selectedBandName, setSelectedBandName] = useState<string>('');
  const [selectedScore, setSelectedScore] = useState<number>(3);

  // AI states
  const [isEvaluatingAi, setIsEvaluatingAi] = useState(false);
  const [aiEvaluation, setAiEvaluation] = useState<any | null>(null);
  const [isGeneratingPrompts, setIsGeneratingPrompts] = useState(false);
  const [probingQuestions, setProbingQuestions] = useState<{ question: string; purpose: string }[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  const activeStudent = students.find((s) => s.id === selectedStudentId) || students[0];
  const activeRubric = rubrics.find((r) => r.id === selectedRubricId) || rubrics[0];

  // Default to Proficient band on rubric change
  useEffect(() => {
    if (activeRubric && activeRubric.criteria.length > 0) {
      const firstCrit = activeRubric.criteria[0];
      const defaultBand = firstCrit.bands[Math.min(2, firstCrit.bands.length - 1)] || firstCrit.bands[0];
      if (defaultBand && !selectedBandId) {
        setSelectedBandId(defaultBand.id);
        setSelectedBandName(defaultBand.name);
        setSelectedScore(defaultBand.score);
      }
    }
  }, [activeRubric]);

  // Handle Voice Note audio & transcript
  const handleTranscriptReady = (transcript: string, summary: string, audioDataUri?: string) => {
    setVoiceTranscript(transcript);
    setVoiceSummary(summary);
    if (audioDataUri) setAudioUrl(audioDataUri);
  };

  // Add a quick observation tag to the notes field
  const handleAddTag = (tag: string) => {
    setObservationNotes((prev) => {
      const trimmed = prev.trim();
      if (!trimmed) return `• ${tag}`;
      return `${trimmed}\n• ${tag}`;
    });
  };

  // Call AI to evaluate evidence against rubric
  const handleAiEvaluate = async () => {
    if (!observationNotes.trim() && !conversationNotes.trim() && !voiceTranscript.trim()) {
      alert('Please add some observation notes or conversation quotes/voice transcript before asking AI to assess.');
      return;
    }

    setIsEvaluatingAi(true);
    try {
      const res = await fetch('/api/ai/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: activeStudent?.name,
          outcomeTitle: activeRubric?.title,
          rubric: activeRubric,
          evidenceType,
          observationNotes,
          conversationNotes,
          transcript: voiceTranscript || voiceSummary,
        }),
      });

      const data = await res.json();
      if (data.success && data.assessment) {
        setAiEvaluation(data.assessment);
        
        // Find matching band in active rubric
        const recBandName = data.assessment.recommendedBandName;
        const matchingBand = activeRubric.criteria[0]?.bands.find(
          (b) => b.name.toLowerCase() === recBandName.toLowerCase()
        );

        if (matchingBand) {
          setSelectedBandId(matchingBand.id);
          setSelectedBandName(matchingBand.name);
          setSelectedScore(matchingBand.score);
        } else {
          setSelectedBandName(recBandName);
          if (data.assessment.score) setSelectedScore(data.assessment.score);
        }
      } else {
        alert(data.error || 'AI assessment failed');
      }
    } catch (err: any) {
      console.error('AI Assessment error:', err);
      alert('Failed to connect to AI assessment service. Please check your network.');
    } finally {
      setIsEvaluatingAi(false);
    }
  };

  // Call AI to generate targeted probing conversation questions
  const handleGeneratePrompts = async () => {
    setIsGeneratingPrompts(true);
    try {
      const res = await fetch('/api/ai/probing-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: activeStudent?.name,
          outcomeTitle: activeRubric?.title,
          rubric: activeRubric,
          currentNotes: `${observationNotes} ${conversationNotes} ${voiceTranscript}`.trim(),
          recentBand: selectedBandName,
        }),
      });

      const data = await res.json();
      if (data.success && data.questions) {
        setProbingQuestions(data.questions);
      } else {
        alert(data.error || 'Failed to generate conversation prompts');
      }
    } catch (err: any) {
      console.error('Probing questions error:', err);
      alert('Could not generate conversation prompts.');
    } finally {
      setIsGeneratingPrompts(false);
    }
  };

  // Save current record
  const handleSave = async (andNext: boolean = false) => {
    if (!activeStudent) {
      alert('Please select or add a student first.');
      return;
    }
    if (!activeRubric) {
      alert('Please select or create an outcome rubric first.');
      return;
    }
    if (!observationNotes.trim() && !conversationNotes.trim() && !voiceTranscript.trim()) {
      alert('Please enter some observation notes, conversation dialogue, or a voice note before saving.');
      return;
    }

    setIsSaving(true);
    try {
      const newRecord: AssessmentRecord = {
        id: `rec-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        studentId: activeStudent.id,
        studentName: activeStudent.name,
        rubricId: activeRubric.id,
        rubricTitle: activeRubric.title,
        type: evidenceType,
        date: new Date().toISOString(),
        observationNotes,
        conversationNotes,
        voiceAudioUrl: audioUrl,
        voiceTranscript: voiceTranscript || voiceSummary,
        selectedBandId: selectedBandId || 'b-proficient',
        selectedBandName: selectedBandName || 'Proficient',
        selectedScore: selectedScore || 3,
        aiAssessment: aiEvaluation ? {
          recommendedBandId: aiEvaluation.recommendedBandId || selectedBandId,
          recommendedBandName: aiEvaluation.recommendedBandName || selectedBandName,
          rationale: aiEvaluation.rationale,
          strengths: aiEvaluation.strengths || [],
          growthAreas: aiEvaluation.growthAreas || [],
          studentFeedback: aiEvaluation.studentFeedback || '',
          suggestedNextSteps: aiEvaluation.suggestedNextSteps || [],
        } : undefined,
        probingQuestions: probingQuestions.length > 0 ? probingQuestions : undefined,
        syncedToGoogleSheet: false,
      };

      await onSaveRecord(newRecord, Boolean(sheetConfig.appsScriptUrl));

      setSaveSuccessMsg(`Assessment saved for ${activeStudent.name}!`);
      setTimeout(() => setSaveSuccessMsg(null), 3000);

      // Reset fields
      setObservationNotes('');
      setConversationNotes('');
      setVoiceTranscript('');
      setVoiceSummary('');
      setAudioUrl(undefined);
      setAiEvaluation(null);
      setProbingQuestions([]);

      if (andNext) {
        // Move to the next student in list
        const currentIndex = students.findIndex((s) => s.id === activeStudent.id);
        const nextIndex = (currentIndex + 1) % students.length;
        setSelectedStudentId(students[nextIndex].id);
      }
    } catch (err: any) {
      console.error('Save error:', err);
      alert('Failed to save assessment record.');
    } finally {
      setIsSaving(false);
    }
  };

  // Color helper for bands
  const getBandBadgeClass = (bandName: string, isSelected: boolean) => {
    const lower = bandName.toLowerCase();
    if (lower.includes('emerg') || lower.includes('level 1') || lower.includes('not yet')) {
      return isSelected 
        ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-200' 
        : 'bg-rose-50 text-rose-800 border-rose-200 hover:bg-rose-100';
    }
    if (lower.includes('develop') || lower.includes('level 2') || lower.includes('progress') || lower.includes('approach')) {
      return isSelected 
        ? 'bg-amber-600 text-white border-amber-600 shadow-md ring-2 ring-amber-200' 
        : 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100';
    }
    if (lower.includes('proficient') || lower.includes('level 3') || lower.includes('master') || lower.includes('standard')) {
      return isSelected 
        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-200' 
        : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100';
    }
    // Extending
    return isSelected 
      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md ring-2 ring-indigo-200' 
      : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100';
  };

  if (students.length === 0) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 px-4">
        <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <BookOpen className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">No Students in Roster</h3>
        <p className="text-slate-600 text-sm mb-6">
          Add students to your roster to start assessing observations and classroom conversations.
        </p>
        <button
          onClick={onNavigateToStudents}
          className="inline-flex items-center space-x-2 px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm shadow-md hover:bg-indigo-700 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Students to Roster</span>
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Top Banner: Success message */}
      {saveSuccessMsg && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between text-emerald-800 text-sm font-semibold animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
          <span className="text-xs text-emerald-600">Sync status logged</span>
        </div>
      )}

      {/* 1. Student Fast-Scroll Selector (Optimized for iPad touch navigation) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              1. Assessing Student
            </span>
            <span className="text-xs text-slate-500 font-medium">({students.length} in class)</span>
          </div>
          <button
            onClick={onNavigateToStudents}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            Manage Roster
          </button>
        </div>

        {/* Horizontal scrollable cards for iPad fingertips */}
        <div className="flex space-x-3 overflow-x-auto pb-2 pt-1 no-scrollbar">
          {students.map((student) => {
            const isSelected = student.id === selectedStudentId;
            return (
              <button
                key={student.id}
                onClick={() => setSelectedStudentId(student.id)}
                className={`shrink-0 flex items-center space-x-3 px-4 py-2.5 rounded-xl border transition-all text-left min-w-[170px] min-h-[52px] ${
                  isSelected
                    ? 'bg-indigo-50/80 border-indigo-500 ring-2 ring-indigo-200 shadow-sm'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className={`w-9 h-9 rounded-full ${student.avatarColor || 'bg-indigo-500'} text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-xs`}>
                  {student.name.charAt(0)}
                </div>
                <div className="truncate">
                  <p className={`text-sm font-bold truncate ${isSelected ? 'text-indigo-950' : 'text-slate-800'}`}>
                    {student.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">
                    {student.grade || 'Student'}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Outcome / Assignment & Rubric Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            2. Target Outcome or Assignment & Rubric
          </span>
          <button
            onClick={onNavigateToRubrics}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
          >
            <span>+ Create / Customize Rubrics</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
          <div className="md:col-span-8">
            <select
              value={selectedRubricId}
              onChange={(e) => setSelectedRubricId(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            >
              {rubrics.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title} {r.outcomeCode ? `(${r.outcomeCode})` : ''} - {r.subject || 'Curriculum'}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-4 flex items-center space-x-2">
            {/* Mode selection toggle */}
            <div className="w-full grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setEvidenceType('observation')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  evidenceType === 'observation'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Observation
              </button>
              <button
                type="button"
                onClick={() => setEvidenceType('conversation')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  evidenceType === 'conversation'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Conversation
              </button>
              <button
                type="button"
                onClick={() => setEvidenceType('both')}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  evidenceType === 'both'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Both
              </button>
            </div>
          </div>
        </div>

        {activeRubric && (
          <p className="text-xs text-slate-500 mt-2 line-clamp-2">
            <span className="font-semibold text-slate-700">Outcome Intent: </span>
            {activeRubric.description}
          </p>
        )}
      </div>

      {/* 3. Evidence Collection Grid: Observation + Conversation (Voice Note / Audio) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column: Observation Evidence */}
        {(evidenceType === 'observation' || evidenceType === 'both') && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <Eye className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Observation Notes</h3>
                <p className="text-xs text-slate-500">Document student actions, strategies, and body language</p>
              </div>
            </div>

            {/* Quick Tap Observation Tags */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_OBSERVATION_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleAddTag(tag)}
                  className="text-[11px] font-medium px-2.5 py-1.5 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg border border-slate-200/80 transition-all active:scale-95"
                >
                  + {tag}
                </button>
              ))}
            </div>

            <textarea
              rows={6}
              value={observationNotes}
              onChange={(e) => setObservationNotes(e.target.value)}
              placeholder="e.g., While working with the fraction strips, Maya immediately identified that 3/6 was equivalent to 1/2. She justified this without prompting, showing strong conceptual grasp..."
              className="w-full flex-1 px-3.5 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        )}

        {/* Right Column: Conversation Evidence & Audio Voice Recorder */}
        {(evidenceType === 'conversation' || evidenceType === 'both') && (
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col space-y-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Conversation & Voice Evidence</h3>
                <p className="text-xs text-slate-500">1-on-1 dialogue, teacher questioning, and student explanation</p>
              </div>
            </div>

            {/* Audio Voice Recorder for student recording / teacher voice memo */}
            <AudioVoiceRecorder
              onTranscriptReady={handleTranscriptReady}
              currentTranscript={voiceTranscript}
            />

            <div>
              <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                Teacher Conversation Notes:
              </label>
              <textarea
                rows={3}
                value={conversationNotes}
                onChange={(e) => setConversationNotes(e.target.value)}
                placeholder="e.g., Teacher asked: 'Can you show me another way?' Student replied with a geometric model and explained why the proportions stayed identical..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Rubric Bands Selection & AI Evaluation Hub */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                3. Rubric Performance Bands
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                Selected: {selectedBandName || 'Choose Band'} (Score: {selectedScore})
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Select the band manually, or let Gemini AI evaluate the observed evidence against the rubric criteria.
            </p>
          </div>

          {/* AI Assessment Action Button */}
          <button
            type="button"
            onClick={handleAiEvaluate}
            disabled={isEvaluatingAi}
            className="inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white text-sm font-bold shadow-md shadow-indigo-100 hover:from-indigo-700 hover:to-purple-700 active:scale-95 transition-all disabled:opacity-50 min-h-[44px]"
          >
            {isEvaluatingAi ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{isEvaluatingAi ? 'Evaluating with Gemini...' : 'Use AI to Assess & Generate Feedback'}</span>
          </button>
        </div>

        {/* Rubric Bands Display (Interactive Touch Cards) */}
        {activeRubric?.criteria.map((crit) => (
          <div key={crit.id} className="space-y-2">
            <div className="text-xs font-bold text-slate-700 flex items-center space-x-2">
              <span>{crit.title}</span>
              {crit.description && (
                <span className="text-slate-400 font-normal">({crit.description})</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {crit.bands.map((band) => {
                const isSelected = selectedBandId === band.id || selectedBandName === band.name;
                return (
                  <button
                    key={band.id}
                    type="button"
                    onClick={() => {
                      setSelectedBandId(band.id);
                      setSelectedBandName(band.name);
                      setSelectedScore(band.score);
                    }}
                    className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all min-h-[110px] ${getBandBadgeClass(
                      band.name,
                      isSelected
                    )}`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <span className="font-bold text-sm">{band.name}</span>
                      <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-md bg-white/20">
                        Score {band.score}
                      </span>
                    </div>
                    <p className={`text-xs leading-relaxed ${isSelected ? 'text-white/95' : 'text-slate-600'}`}>
                      {band.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        {/* AI Evaluation Insights Output */}
        {aiEvaluation && (
          <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-50/90 to-purple-50/70 border border-indigo-200 rounded-xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                <h4 className="text-sm font-bold text-indigo-950">AI Pedagogical Assessment & Feedback</h4>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-white text-indigo-700 rounded-full border border-indigo-200 shadow-2xs">
                Suggested Band: {aiEvaluation.recommendedBandName}
              </span>
            </div>

            <p className="text-xs text-indigo-900 leading-relaxed">
              <span className="font-bold">Pedagogical Rationale: </span>
              {aiEvaluation.rationale}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white/90 rounded-lg border border-indigo-100">
                <span className="font-bold text-emerald-700 block mb-1">Demonstrated Strengths:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  {aiEvaluation.strengths?.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3 bg-white/90 rounded-lg border border-indigo-100">
                <span className="font-bold text-amber-700 block mb-1">Growth Areas & Next Steps:</span>
                <ul className="list-disc list-inside space-y-1 text-slate-700">
                  {aiEvaluation.growthAreas?.map((g: string, idx: number) => (
                    <li key={idx}>{g}</li>
                  ))}
                </ul>
              </div>
            </div>

            {aiEvaluation.studentFeedback && (
              <div className="p-3 bg-white rounded-lg border border-indigo-200">
                <span className="text-xs font-bold text-indigo-900 block mb-1">
                  Constructive Student-Facing Feedback:
                </span>
                <p className="text-xs text-slate-800 italic">
                  "{aiEvaluation.studentFeedback}"
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 5. AI Conversation Prompter for Future Interactions */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <HelpCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                AI Probing Questions for Future Student Interactions
              </h3>
              <p className="text-xs text-slate-500">
                Generate tailored questions to deepen student reasoning, diagnose misunderstandings, or scaffold next steps
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGeneratePrompts}
            disabled={isGeneratingPrompts}
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 text-xs font-bold border border-amber-200 transition-all active:scale-95 disabled:opacity-50"
          >
            {isGeneratingPrompts ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span>{isGeneratingPrompts ? 'Generating Questions...' : 'Generate Probing Questions'}</span>
          </button>
        </div>

        {probingQuestions.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {probingQuestions.map((pq, idx) => (
              <div
                key={idx}
                className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl hover:bg-indigo-50/50 hover:border-indigo-200 transition-colors group"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-md">
                    {pq.purpose}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setConversationNotes((prev) => `${prev ? prev + '\n' : ''}Teacher asked: "${pq.question}"`);
                    }}
                    className="text-[11px] text-slate-400 group-hover:text-indigo-600 font-semibold"
                    title="Insert question into conversation notes"
                  >
                    + Insert Question
                  </button>
                </div>
                <p className="text-xs text-slate-800 font-medium leading-relaxed">
                  "{pq.question}"
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 6. Primary Action Bar (iPad bottom sticky or wide buttons) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-2 text-xs text-slate-500">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            Records are persisted locally on your device and instantly ready for PDF export and Google Sheets sync.
          </span>
        </div>

        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => handleSave(false)}
            disabled={isSaving}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all active:scale-95 disabled:opacity-50 min-h-[48px]"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save Assessment</span>
          </button>

          <button
            type="button"
            onClick={() => handleSave(true)}
            disabled={isSaving}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md shadow-indigo-100 transition-all active:scale-95 disabled:opacity-50 min-h-[48px]"
          >
            <span>Save & Next Student</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
