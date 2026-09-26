import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Check, 
  X, 
  Edit3, 
  RefreshCw, 
  AlertCircle, 
  HelpCircle, 
  MessageSquare, 
  BookOpen, 
  Send 
} from 'lucide-react';
import { GeminiAssistAction, GeminiDraftResult } from '../types/evidenceContract';

interface GeminiAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  originalText: string;
  context: {
    learnerName: string;
    courseId: string;
    rubricTitle?: string;
    criterionName?: string;
    evidenceType?: string;
  };
  onApplyDraft: (draftText: string, draftId: string) => void;
}

export const GeminiAssistModal: React.FC<GeminiAssistModalProps> = ({
  isOpen,
  onClose,
  originalText,
  context,
  onApplyDraft,
}) => {
  const [selectedAction, setSelectedAction] = useState<GeminiAssistAction>('improve_wording');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [draftResult, setDraftResult] = useState<GeminiDraftResult | null>(null);
  const [editableDraft, setEditableDraft] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      setDraftResult(null);
      setEditableDraft('');
      // The teacher explicitly chooses an action before sending a note to Gemini.
    }
  }, [isOpen]);

  const handleRunAction = async (action: GeminiAssistAction) => {
    if (!originalText || !originalText.trim()) {
      setErrorMessage('Please enter an observation note or recorded transcript before requesting AI assistance.');
      return;
    }

    setSelectedAction(action);
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/ai/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          originalText: originalText.trim(),
          context: {courseId:context.courseId,rubricTitle:context.rubricTitle,criterionName:context.criterionName},
        }),
      });

      const data = await response.json();
      if (data.success && data.draft) {
        const draftId = `ai_draft_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const res: GeminiDraftResult = {
          action,
          original_text: originalText,
          draft_text: data.draft,
          comment_draft_id: draftId,
          model_used: data.model || 'gemini-2.5-flash',
          created_at: new Date().toISOString(),
          status: 'draft',
        };
        setDraftResult(res);
        setEditableDraft(data.draft);
      } else {
        // Never invent student evidence on failure; show clear error and keep source intact
        setErrorMessage(data.error || 'Gemini assistance is currently unavailable. Please verify API configuration.');
      }
    } catch (err: any) {
      console.warn('AI Assist error:', err);
      setErrorMessage(err.message || 'Gemini service offline; check network or server configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = () => {
    if (!editableDraft.trim() || !draftResult) return;
    onApplyDraft(editableDraft.trim(), draftResult.comment_draft_id || `draft_${Date.now()}`);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-5 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Gemini Teacher Assistant</h3>
              <p className="text-xs text-slate-500">Draft suggestions for {context.learnerName} ({context.courseId})</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 font-bold p-1">
            ✕
          </button>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => handleRunAction('improve_wording')}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center space-x-1.5 min-h-[44px] ${
              selectedAction === 'improve_wording'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
            <span>Improve Wording</span>
          </button>

          <button
            type="button"
            onClick={() => handleRunAction('make_concise')}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center space-x-1.5 min-h-[44px] ${
              selectedAction === 'make_concise'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
            <span>Make Concise</span>
          </button>

          <button
            type="button"
            onClick={() => handleRunAction('draft_feedback')}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center space-x-1.5 min-h-[44px] ${
              selectedAction === 'draft_feedback'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
            <span>Student Feedback</span>
          </button>

          <button
            type="button"
            onClick={() => handleRunAction('suggest_question')}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center space-x-1.5 min-h-[44px] ${
              selectedAction === 'suggest_question'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
            <span>Next Question</span>
          </button>

          <button
            type="button"
            onClick={() => handleRunAction('draft_reporting_comment')}
            className={`p-2.5 rounded-xl border text-xs font-bold transition-all text-left flex items-center space-x-1.5 min-h-[44px] ${
              selectedAction === 'draft_reporting_comment'
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-xs'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
            <span>Report Comment</span>
          </button>
        </div>

        {/* Side by Side Comparison */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
          
          {/* Original Note */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
            <span className="font-bold text-slate-500 uppercase tracking-wider text-[10px]">Your Original Note:</span>
            <p className="text-slate-800 italic leading-relaxed text-xs">
              {originalText ? `"${originalText}"` : '(No initial text entered)'}
            </p>
          </div>

          {/* AI Draft Suggestion */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-indigo-900 uppercase tracking-wider text-[10px] flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                <span>Gemini Draft:</span>
              </span>
              {isLoading && <span className="text-[10px] text-indigo-600 animate-pulse font-semibold">Generating...</span>}
            </div>

            <textarea
              rows={4}
              value={editableDraft}
              onChange={(e) => setEditableDraft(e.target.value)}
              placeholder="AI draft will appear here..."
              className="w-full p-2.5 rounded-xl bg-white border border-indigo-200 text-xs text-slate-900 focus:ring-2 focus:ring-indigo-500 font-sans leading-relaxed"
            />
          </div>
        </div>

        {/* Pedagogical Safety Notice */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[11px] text-slate-500 leading-normal">
          <strong>Teacher Authority Principle:</strong> AI drafts remain reviewable suggestions. Accepting an AI edit preserves provenance and source references, but never automatically submits outcome judgments or alters student grades.
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Modal Actions */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={() => handleRunAction(selectedAction)}
            disabled={isLoading}
            className="py-2.5 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-1.5 min-h-[44px]"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Regenerate</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs min-h-[44px]"
            >
              Cancel / Reject
            </button>

            <button
              type="button"
              onClick={handleAccept}
              disabled={!editableDraft.trim()}
              className="py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm min-h-[44px]"
            >
              <Check className="w-4 h-4" />
              <span>Accept & Apply Draft</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
