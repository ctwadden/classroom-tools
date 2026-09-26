import React, { useState, useEffect } from 'react';
import { ApprovedRubric, CourseId } from '../types/evidenceContract';
import { getApprovedRubrics, cacheApprovedRubrics, saveDraftRubric } from '../utils/indexedDb';
import { 
  ScrollText, 
  Download, 
  Upload, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Layers, 
  HelpCircle,
  FileJson,
  BookOpen,
  Plus,
  Copy
} from 'lucide-react';
import {evidenceBridge} from '../utils/evidenceBridge';
import { RubricAuthoringModal } from './RubricAuthoringModal';

interface RubricExplorerProps {
  onSelectRubricForCapture?: (rubricId: string, courseId: CourseId) => void;
}

export const RubricExplorer: React.FC<RubricExplorerProps> = ({
  onSelectRubricForCapture,
}) => {
  const [rubrics, setRubrics] = useState<ApprovedRubric[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<CourseId | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedRubric, setSelectedRubric] = useState<ApprovedRubric | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Authoring modal state
  const [isAuthoringOpen, setIsAuthoringOpen] = useState<boolean>(false);
  const [rubricToDuplicate, setRubricToDuplicate] = useState<ApprovedRubric | null>(null);

  useEffect(() => {
    async function load() {
      if(navigator.onLine)await Promise.all((['MM12','COM11','IBDS'] as CourseId[]).map(c=>evidenceBridge.fetchCourseSnapshot(c)));
      const list = await getApprovedRubrics();
      setRubrics(list);
      if (list.length > 0) {
        setSelectedRubric(list[0]);
      }
    }
    load();
  }, []);

  const filteredRubrics = rubrics.filter((r) => {
    if (selectedCourse !== 'all' && r.course !== selectedCourse) return false;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(query) || r.id.toLowerCase().includes(query);
    }
    return true;
  });

  const handleDownloadRubricJson = (rubric: ApprovedRubric) => {
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(rubric, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', jsonStr);
    link.setAttribute('download', `${rubric.id}_v${rubric.version}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (!parsed.id || !parsed.version || !parsed.criteria || !Array.isArray(parsed.criteria)) {
          alert('Invalid rubric structure. Missing id, version, or criteria array.');
          return;
        }

        // Imported JSON is a local draft until the shared server approves it.
        parsed.status='draft';
        await saveDraftRubric(parsed);
        // Add to this review view only
        const updated = [parsed, ...rubrics.filter((r) => r.id !== parsed.id || r.version !== parsed.version)];
        setRubrics(updated);

        setSelectedRubric(parsed);

        setToastMessage(`Imported rubric "${parsed.title || parsed.id}" v${parsed.version}`);
        setTimeout(() => setToastMessage(null), 3500);
      } catch (err: any) {
        alert('Failed to parse JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 space-y-6">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 border border-emerald-700 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-indigo-600" />
            Shared rubrics & outcomes
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Exact catalogue rubrics, versioned criteria, and performance bands matching Evidence Map.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setRubricToDuplicate(null);
              setIsAuthoringOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs flex items-center space-x-1.5 shadow-sm min-h-[44px]"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Rubric</span>
          </button>

          {selectedRubric && (
            <button
              onClick={() => {
                setRubricToDuplicate(selectedRubric);
                setIsAuthoringOpen(true);
              }}
              className="px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs flex items-center space-x-1.5 min-h-[44px]"
              title="Duplicate and adapt this rubric"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Duplicate & Adapt</span>
            </button>
          )}

          <button
            onClick={handlePrint}
            className="px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center space-x-1.5 min-h-[44px]"
          >
            <Printer className="w-4 h-4" />
            <span>Print / PDF</span>
          </button>

          <label className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-xs flex items-center space-x-1.5 cursor-pointer min-h-[44px] border border-indigo-200">
            <Upload className="w-4 h-4" />
            <span>Import JSON</span>
            <input type="file" accept=".json" onChange={handleImportJson} className="hidden" />
          </label>
        </div>
      </div>

      {/* Main Rubrics Layout: 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Rubrics Selector List (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
          {/* Course Tabs */}
          <div className="grid grid-cols-4 gap-1 bg-slate-100 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setSelectedCourse('all')}
              className={`py-1.5 rounded-lg transition-all ${selectedCourse === 'all' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'}`}
            >
              All
            </button>
            <button
              onClick={() => setSelectedCourse('MM12')}
              className={`py-1.5 rounded-lg transition-all ${selectedCourse === 'MM12' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'}`}
            >
              MM12
            </button>
            <button
              onClick={() => setSelectedCourse('COM11')}
              className={`py-1.5 rounded-lg transition-all ${selectedCourse === 'COM11' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'}`}
            >
              COM11
            </button>
            <button
              onClick={() => setSelectedCourse('IBDS')}
              className={`py-1.5 rounded-lg transition-all ${selectedCourse === 'IBDS' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600'}`}
            >
              IBDS
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search rubrics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white"
            />
          </div>

          {/* List */}
          <div className="space-y-1.5 max-h-[540px] overflow-y-auto no-scrollbar">
            {filteredRubrics.map((r) => {
              const isSelected = selectedRubric?.id === r.id;
              return (
                <button
                  key={`${r.id}_${r.version}`}
                  onClick={() => setSelectedRubric(r)}
                  className={`w-full text-left p-3 rounded-xl transition-all border min-h-[48px] ${
                    isSelected
                      ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20 shadow-xs'
                      : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">
                      {r.course}
                    </span>
                    <span className="text-[10px] text-slate-400">v{r.version}</span>
                  </div>
                  <h4 className="font-bold text-xs text-slate-900 line-clamp-2 leading-snug">{r.title}</h4>
                  <div className="text-[10px] text-slate-500 mt-1 flex items-center justify-between">
                    <span>{r.criteria.length} Criteria</span>
                    {r.capture_ready && (
                      <span className="text-emerald-600 font-semibold flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Capture Ready
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Full Rubric Details View (8 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 sm:p-6 border border-slate-200 shadow-xs space-y-5">
          {selectedRubric ? (
            <>
              {/* Header */}
              <div className="border-b border-slate-100 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white">
                      {selectedRubric.course}
                    </span>
                    <span className="text-xs font-mono text-slate-400">ID: {selectedRubric.id} (v{selectedRubric.version})</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mt-1.5">{selectedRubric.title}</h3>
                  {selectedRubric.project_id && (
                    <p className="text-xs text-slate-500">Project / Sprint: <strong className="text-slate-800">{selectedRubric.project_id}</strong></p>
                  )}
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {selectedRubric.status==='approved'&&onSelectRubricForCapture&&<button className="px-3 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold" onClick={()=>onSelectRubricForCapture(`${selectedRubric.id}@${selectedRubric.version}`,selectedRubric.course)}>Use for capture</button>}
                  <button
                    onClick={() => handleDownloadRubricJson(selectedRubric)}
                    className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs flex items-center space-x-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download JSON</span>
                  </button>
                </div>
              </div>

              {/* Review Note */}
              {selectedRubric.review_note && (
                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-100 text-xs text-indigo-900 space-y-1">
                  <div className="font-bold flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    Pedagogical Review & Moderation Note
                  </div>
                  <p>{selectedRubric.review_note}</p>
                </div>
              )}

              {/* Criteria List */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                  Rubric Criteria ({selectedRubric.criteria.length})
                </h4>

                {selectedRubric.criteria.map((criterion, idx) => (
                  <div key={criterion.id} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200/80 pb-2">
                      <div className="font-bold text-sm text-slate-900">
                        {idx + 1}. {criterion.name}
                      </div>
                      <div className="text-xs font-mono text-indigo-700 font-semibold">
                        Outcomes: {criterion.outcome_codes.join(', ')}
                      </div>
                    </div>

                    {/* Descriptors */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-bold text-rose-700 block mb-1">Beginning</span>
                        <p className="text-[11px] text-slate-600 leading-snug">{criterion.descriptors.Beginning}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-bold text-amber-700 block mb-1">Developing</span>
                        <p className="text-[11px] text-slate-600 leading-snug">{criterion.descriptors.Developing}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-bold text-emerald-700 block mb-1">Secure</span>
                        <p className="text-[11px] text-slate-600 leading-snug">{criterion.descriptors.Secure}</p>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white border border-slate-200">
                        <span className="font-bold text-indigo-700 block mb-1">Extending</span>
                        <p className="text-[11px] text-slate-600 leading-snug">{criterion.descriptors.Extending}</p>
                      </div>
                    </div>

                    {/* Collection & Repair Advice */}
                    {criterion.collection && (
                      <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200">
                        <strong className="text-slate-700 not-italic">Collection Guidance: </strong>
                        {criterion.collection}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Rules & Policy Footer */}
              <div className="p-3.5 rounded-xl bg-slate-100 text-slate-600 text-xs space-y-1">
                <div className="font-bold text-slate-800">Support & Assessment Policy:</div>
                <p>• {selectedRubric.support_rule || 'Record Guided, Supported, Independent or Transfer separately. Access support never caps achievement.'}</p>
                <p>• {selectedRubric.powerschool || 'Teacher confirms each outcome and writes reporting comments in Evidence Map.'}</p>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-slate-400">
              Select a rubric from the left panel to inspect its criteria.
            </div>
          )}
        </div>
      </div>

      {/* Rubric Authoring & Publishing Modal */}
      <RubricAuthoringModal
        isOpen={isAuthoringOpen}
        onClose={() => setIsAuthoringOpen(false)}
        courseId={selectedCourse !== 'all' ? selectedCourse : 'MM12'}
        initialRubricToDuplicate={rubricToDuplicate}
        onPublished={(newRubric) => {
          setRubrics([newRubric, ...rubrics]);
          setSelectedRubric(newRubric);
          setToastMessage(`Published immutable rubric "${newRubric.title}" v${newRubric.version}!`);
          setTimeout(() => setToastMessage(null), 3500);
        }}
      />
    </div>
  );
};
