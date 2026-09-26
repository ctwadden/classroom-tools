import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CourseId, 
  FieldEvent, 
  Learner, 
  ApprovedRubric, 
  RubricCriterion, 
  AchievementBand, 
  SupportContext 
} from '../types/evidenceContract';
import { 
  savePendingEvent, 
  getPendingEvents,
  getConfirmedEvents, 
  getApprovedRubrics, 
  getCachedRoster, 
  getSetting, 
  setSetting 
} from '../utils/indexedDb';
import { evidenceBridge } from '../utils/evidenceBridge';
import { 
  Eye, 
  MessageSquare, 
  PackageCheck, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  Search, 
  Sparkles, 
  Layers, 
  ExternalLink, 
  Save, 
  Info, 
  RefreshCw, 
  Wifi, 
  WifiOff, 
  Code2, 
  ChevronDown, 
  ChevronUp, 
  HelpCircle,
  Clock,
  UserCheck,
  Mic,
  ClipboardCheck,
  ShieldAlert,
  SlidersHorizontal
} from 'lucide-react';
import { VoiceNotesModal } from './VoiceNotesModal';
import { GeminiAssistModal } from './GeminiAssistModal';
import { CompleteRubricModal } from './CompleteRubricModal';

interface ClassroomFieldCaptureProps {
  onCaptureSaved: (event: FieldEvent) => void;
  onNavigateToSync: () => void;
}

const COURSES: { id: CourseId; name: string; code: string; badgeColor: string }[] = [
  { id: 'MM12', name: 'Multimedia 12', code: 'MM12', badgeColor: 'bg-indigo-600 text-white' },
  { id: 'COM11', name: 'Communications Tech 11', code: 'COM11', badgeColor: 'bg-emerald-600 text-white' },
  { id: 'IBDS', name: 'IB Digital Society SL', code: 'IBDS', badgeColor: 'bg-sky-600 text-white' },
];

export const ClassroomFieldCapture: React.FC<ClassroomFieldCaptureProps> = ({
  onCaptureSaved,
  onNavigateToSync,
}) => {
  // 1. Course Selection
  const [selectedCourse, setSelectedCourse] = useState<CourseId>('MM12');
  
  // 2. Roster and Selected Learner
  const [roster, setRoster] = useState<Learner[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string>('');
  const [searchStudent, setSearchStudent] = useState<string>('');

  // 3. Rubrics and Selected Assignment / Criterion
  const [rubrics, setRubrics] = useState<ApprovedRubric[]>([]);
  const [selectedRubricId, setSelectedRubricId] = useState<string>('');
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>('');

  // 4. Evidence Method (Observation / Conversation / Product)
  const [isObservation, setIsObservation] = useState<boolean>(true);
  const [isConversation, setIsConversation] = useState<boolean>(false);
  const [isProduct, setIsProduct] = useState<boolean>(false);

  // 5. Notes and Artifact
  const [teacherNote, setTeacherNote] = useState<string>('');
  const [artifactUrl, setArtifactUrl] = useState<string>('');
  const [urlError, setUrlError] = useState<string>('');
  
  // Extension Fields: Voice notes, transcripts, AI drafts
  const [voiceNoteId, setVoiceNoteId] = useState<string | undefined>(undefined);
  const [transcriptText, setTranscriptText] = useState<string | undefined>(undefined);
  const [transcriptReviewed, setTranscriptReviewed] = useState<boolean | undefined>(undefined);
  const [commentDraftId, setCommentDraftId] = useState<string | undefined>(undefined);

  // Modals
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState<boolean>(false);
  const [isGeminiModalOpen, setIsGeminiModalOpen] = useState<boolean>(false);
  const [isCompleteRubricModalOpen, setIsCompleteRubricModalOpen] = useState<boolean>(false);
  const [observedToday, setObservedToday] = useState<Set<string>>(new Set());
  const [snapshotNotice,setSnapshotNotice] = useState('');
  const [saving,setSaving] = useState(false);
  const saveLock = useRef(false);
  const requestSequence = useRef(0);
  const activeCourse = useRef(selectedCourse);
  activeCourse.current = selectedCourse;
  const [filterUnobservedToday, setFilterUnobservedToday] = useState<boolean>(false);

  // 6. Optional Achievement & Support
  const [achievementLevel, setAchievementLevel] = useState<AchievementBand | ''>('');
  const [supportContext, setSupportContext] = useState<SupportContext | ''>('');

  // 7. System status & queue
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showTechnicalDetails, setShowTechnicalDetails] = useState<boolean>(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isRefreshingSnapshot, setIsRefreshingSnapshot] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  // Per-student draft isolation to prevent cross-learner leakage
  interface StudentDraft {
    teacherNote: string;
    artifactUrl: string;
    achievementLevel: AchievementBand | '';
    supportContext: SupportContext | '';
    voiceNoteId?: string;
    transcriptText?: string;
    transcriptReviewed?: boolean;
    commentDraftId?: string;
    isObservation: boolean;
    isConversation: boolean;
    isProduct: boolean;
  }
  const draftsRef = useRef<Record<string, StudentDraft>>({});

  const rubricKey = (r:ApprovedRubric) => `${r.id}@${r.version}`;
  const getDraftKey = (learnerId:string,rubricId:string,critId:string,course=selectedCourse) => `${course}|${learnerId}|${rubricId}|${critId}`;
  const clearForm = () => {setTeacherNote('');setArtifactUrl('');setUrlError('');setAchievementLevel('');setSupportContext('');setVoiceNoteId(undefined);setTranscriptText(undefined);setTranscriptReviewed(undefined);setCommentDraftId(undefined);setIsObservation(true);setIsConversation(false);setIsProduct(false);};
  const stash = () => {
    if(selectedLearnerId && selectedRubricId && selectedCriterionId) draftsRef.current[getDraftKey(selectedLearnerId,selectedRubricId,selectedCriterionId)]={teacherNote,artifactUrl,achievementLevel,supportContext,voiceNoteId,transcriptText,transcriptReviewed,commentDraftId,isObservation,isConversation,isProduct};
  };
  const restore = (learner:string,rubric:string,criterion:string,course=selectedCourse) => {
    const d=draftsRef.current[getDraftKey(learner,rubric,criterion,course)];clearForm();
    if(d){setTeacherNote(d.teacherNote);setArtifactUrl(d.artifactUrl);setAchievementLevel(d.achievementLevel);setSupportContext(d.supportContext);setVoiceNoteId(d.voiceNoteId);setTranscriptText(d.transcriptText);setTranscriptReviewed(d.transcriptReviewed);setCommentDraftId(d.commentDraftId);setIsObservation(d.isObservation);setIsConversation(d.isConversation);setIsProduct(d.isProduct);}
  };
  const handleSelectLearner=(id:string)=>{stash();setSelectedLearnerId(id);restore(id,selectedRubricId,selectedCriterionId);};
  const handleRubric=(id:string)=>{stash();const r=rubrics.find(r=>rubricKey(r)===id);const criterion=r?.criteria[0]?.id||'';setSelectedRubricId(id);setSelectedCriterionId(criterion);restore(selectedLearnerId,id,criterion);};
  const handleCriterion=(id:string)=>{stash();setSelectedCriterionId(id);restore(selectedLearnerId,selectedRubricId,id);};
  const handleCourse=(course:CourseId)=>{if(course===selectedCourse)return;stash();activeCourse.current=course;++requestSequence.current;clearForm();setRoster([]);setRubrics([]);setSelectedLearnerId('');setSelectedRubricId('');setSelectedCriterionId('');setSearchStudent('');setLastRefreshedAt(null);setSelectedCourse(course);};
  async function noteCoverage(course:CourseId,serverEvents:any[]=[]){
    const local=[...await getPendingEvents(),...await getConfirmedEvents()];
    const today=new Date().toLocaleDateString('en-CA');
    const ids=new Set<string>();
    for(const e of [...serverEvents,...local])if(e.course_id===course&&!e.conflict&&new Date(e.timestamp).toLocaleDateString('en-CA')===today&&String(e.evidence_type_raw).includes('Observation'))ids.add(e.learner_id);
    if(activeCourse.current===course)setObservedToday(ids);
  }
  const refreshSnapshot=async(course:CourseId)=>{
    const sequence=++requestSequence.current;setIsRefreshingSnapshot(true);setSnapshotNotice('');
    const cachedRoster=await getCachedRoster(course);
    let learners=cachedRoster.filter(l=>l.active),available=(await getApprovedRubrics(course)).filter(r=>r.status==='approved'&&r.capture_ready);
    let serverEvents:any[]=[];
    if(navigator.onLine){
      const res=await evidenceBridge.fetchCourseSnapshot(course);
      if(sequence!==requestSequence.current||activeCourse.current!==course)return;
      if(res.ok&&res.data){learners=res.data.roster.learners.filter(l=>l.active);available=res.data.rubrics.filter(r=>r.status==='approved'&&r.capture_ready);serverEvents=res.data.events||[];setLastRefreshedAt(new Date().toLocaleTimeString());}
      else setSnapshotNotice(res.error||'Refresh did not complete. Showing downloaded records.');
    } else setSnapshotNotice('Offline: showing the last downloaded roster and approved rubrics.');
    if(sequence!==requestSequence.current||activeCourse.current!==course)return;
    setRoster(learners);setRubrics(available);
    const preference=await getSetting('active_rubric','');
    if(sequence!==requestSequence.current||activeCourse.current!==course)return;
    const r=available.find(r=>rubricKey(r)===selectedRubricId)||available.find(r=>rubricKey(r)===preference)||available[0];
    const rid=r?rubricKey(r):'',cid=r?.criteria.find(c=>c.id===selectedCriterionId)?.id||r?.criteria[0]?.id||'';
    const lid=learners.find(l=>l.learner_id===selectedLearnerId)?.learner_id||learners[0]?.learner_id||'';
    if(lid!==selectedLearnerId||rid!==selectedRubricId||cid!==selectedCriterionId){stash();restore(lid,rid,cid,course);}
    setSelectedLearnerId(lid);setSelectedRubricId(rid);setSelectedCriterionId(cid);setIsRefreshingSnapshot(false);
    await noteCoverage(course,serverEvents);
  };
  useEffect(()=>{
    getSetting<CourseId>('active_course','MM12').then(c=>{if(c!==selectedCourse)handleCourse(c);});
    getPendingEvents().then(e=>setPendingCount(e.length));
    const on=()=>setIsOnline(true),off=()=>setIsOnline(false);
    window.addEventListener('online',on);window.addEventListener('offline',off);
    return()=>{++requestSequence.current;window.removeEventListener('online',on);window.removeEventListener('offline',off);};
  },[]);
  useEffect(()=>{setSetting('active_course',selectedCourse);refreshSnapshot(selectedCourse);},[selectedCourse,isOnline]);

  // Selected entities
  const currentStudent = useMemo(() => {
    return roster.find((l) => l.learner_id === selectedLearnerId);
  }, [roster, selectedLearnerId]);

  const currentRubric = useMemo(() => {
    return rubrics.find((r) => rubricKey(r) === selectedRubricId);
  }, [rubrics, selectedRubricId]);

  const currentCriterion = useMemo(() => {
    return currentRubric?.criteria.find((c) => c.id === selectedCriterionId);
  }, [currentRubric, selectedCriterionId]);

  // Filtered roster for search
  const filteredRoster = useMemo(() => {
    const term=searchStudent.toLowerCase();
    return roster.filter(l=>(!filterUnobservedToday||!observedToday.has(l.learner_id))&&l.display_name.toLowerCase().includes(term));
  }, [roster,searchStudent,filterUnobservedToday,observedToday]);

  // Method string (joined by '+')
  const evidenceTypeRaw = useMemo(() => {
    const methods: string[] = [];
    if (isObservation) methods.push('Observation');
    if (isConversation) methods.push('Conversation');
    if (isProduct) methods.push('Product');
    return methods.length > 0 ? methods.join('+') : 'Observation';
  }, [isObservation, isConversation, isProduct]);

  // Validate HTTPS URL
  const handleArtifactUrlChange = (url: string) => {
    setArtifactUrl(url);
    if (url.trim() && !/^https:\/\//i.test(url.trim())) {
      setUrlError('Artifact link must start with https://');
    } else {
      setUrlError('');
    }
  };

  // Construct and save FieldEvent
  const handleSaveCapture = async (advanceToNext: boolean = false) => {
    if (saveLock.current) return;
    if (!currentStudent || !currentRubric || !currentCriterion || currentRubric.status !== 'approved') {
      alert('Please ensure course, student, rubric, and criterion are selected.');
      return;
    }

    if (!currentRubric.project_id) {
      alert(`The selected rubric "${currentRubric.title}" has no associated project ID. Please configure project mapping in Rubric Explorer before capturing evidence.`);
      return;
    }

    if (artifactUrl.trim() && !/^https:\/\//i.test(artifactUrl.trim())) {
      setUrlError('Artifact link must use HTTPS');
      return;
    }

    if(!teacherNote.trim() && !artifactUrl.trim()) {alert('Add an observation, conversation note or product link before saving.');return;}
    if(!isObservation&&!isConversation&&!isProduct){alert('Choose at least one evidence method.');return;}
    saveLock.current=true;setSaving(true);
    const eventId = `field_${crypto.randomUUID()}`;
    const outcomeCodes = (currentCriterion.outcome_codes || []).join(';');

    const newEvent: FieldEvent = {
      schema_version: '1.0',
      event_id: eventId,
      source_revision: 1,
      stream: 'evidence',
      learner_id: currentStudent.learner_id,
      course_id: selectedCourse,
      project_id: currentRubric.project_id,
      canonical_id: currentCriterion.id,
      step_id: '',
      rubric_id: currentRubric.id,
      rubric_version: currentRubric.version,
      criterion_id: currentCriterion.id,
      tutorial_skill_ids: currentCriterion.skill_ids || [],
      outcome_codes_raw: outcomeCodes,
      evidence_type_raw: evidenceTypeRaw,
      response_value: teacherNote.trim() || `${evidenceTypeRaw} recorded during class session.`,
      teacher_note: teacherNote.trim(),
      level_raw: achievementLevel || undefined,
      independence_raw: supportContext || undefined,
      artifact_url: artifactUrl.trim() || undefined,
      assessment_session_id: undefined,
      voice_note_id: voiceNoteId,
      transcript_text: transcriptText,
      transcript_reviewed: transcriptReviewed,
      comment_draft_id: commentDraftId,
      teacher_verified: false,
      source: 'field',
      timestamp: new Date().toISOString(),
      local_status: 'pending',
      google_mirror_status: 'unverified',
      learner_name: currentStudent.display_name,
      rubric_title: currentRubric.title,
      criterion_name: currentCriterion.name,
    };

    // Save to local IndexedDB
    try {await savePendingEvent(newEvent);} catch(e){saveLock.current=false;setSaving(false);alert('Capture could not be saved. Your note is still here; retry.');return;}
    onCaptureSaved(newEvent);

    // Delete saved student draft
    delete draftsRef.current[getDraftKey(currentStudent.learner_id, selectedRubricId, currentCriterion.id)];

    // Update pending counter
    const pending = await getPendingEvents();
    setPendingCount(pending.length);

    // Trigger toast
    setSuccessToast(`Evidence captured for ${currentStudent.display_name}!`);
    setTimeout(() => setSuccessToast(null), 3500);

    // Attempt background sync if online
    if (navigator.onLine) {
      evidenceBridge.syncPendingQueue().then(async () => {
        const updatedPending = await getPendingEvents();
        setPendingCount(updatedPending.length);
      });
    }

    // Reset student specific inputs
    setTeacherNote('');
    setArtifactUrl('');
    setAchievementLevel('');
    setSupportContext('');
    setVoiceNoteId(undefined);
    setTranscriptText(undefined);
    setTranscriptReviewed(undefined);
    setCommentDraftId(undefined);

    saveLock.current=false;setSaving(false);await noteCoverage(selectedCourse);
    // Advance to next student in roster if requested
    if (advanceToNext && roster.length > 1) {
      const currentIndex = roster.findIndex((l) => l.learner_id === currentStudent.learner_id);
      const nextIndex = (currentIndex + 1) % roster.length;
      setSelectedLearnerId(roster[nextIndex].learner_id);
      restore(roster[nextIndex].learner_id,selectedRubricId,selectedCriterionId);
    }
  };

  // Manual Trigger Sync
  const handleTriggerSync = async () => {
    setIsSyncing(true);
    const res = await evidenceBridge.syncPendingQueue();
    const pending = await getPendingEvents();
    setPendingCount(pending.length);
    setIsSyncing(false);

    if (res.syncedCount > 0) {
      setSuccessToast(`Synced ${res.syncedCount} captures to Evidence Map!`);
      setTimeout(() => setSuccessToast(null), 3500);
    } else if (res.errors.length > 0) {
      alert(`Sync notice:\n${res.errors.join('\n')}`);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 space-y-5">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center space-x-2 border border-emerald-700 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span className="text-sm font-semibold">{successToast}</span>
        </div>
      )}

      {/* Top Banner: Online Status, Unsent Queue & Course Tabs */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Course Selector Buttons */}
        <div>
          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-slate-400" />
            Active Course
          </div>
          <div className="flex flex-wrap gap-2">
            {COURSES.map((course) => (
              <button
                key={course.id}
                onClick={() => handleCourse(course.id)}
                className={`px-4 py-2.5 rounded-xl font-bold text-sm transition-all min-h-[44px] flex items-center space-x-2 ${
                  selectedCourse === course.id
                    ? `${course.badgeColor} shadow-md shadow-indigo-100 ring-2 ring-indigo-600/30 scale-102`
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{course.code}</span>
                <span className="text-xs font-normal opacity-90 hidden sm:inline">({course.name})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Sync & Offline Status Indicator */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 border ${
            isOnline 
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {isOnline ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            <span>{isOnline ? 'Internet available' : 'Offline (iPad Storage)'}</span>
          </div>

          <button
            onClick={pendingCount > 0 ? handleTriggerSync : onNavigateToSync}
            disabled={isSyncing}
            className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold flex items-center space-x-2 transition-all min-h-[44px] ${
              pendingCount > 0
                ? 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm animate-pulse'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>
              {isSyncing 
                ? 'Syncing...' 
                : pendingCount > 0 
                ? `${pendingCount} Pending Sync` 
                : 'Queue Empty'}
            </span>
          </button>
        </div>
      </div>

      {/* Google Sheet Live Sharing State Notice */}
      <div className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200 text-slate-800 text-xs flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2.5">
          <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0" />
          <div>
            <span className="font-bold">Connected Google Sheet: </span>
            <span>Technology Evidence System provides the roster and receives a mirror of saved evidence. Audio recordings stay on this device; reviewed transcripts can be synced.</span>
          </div>
        </div>
        <a
          href="https://docs.google.com/spreadsheets/d/1hGXzxde_q7UmKUFYKub3N_j_bFTMRrZqIUxTCIpciwc/edit"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 font-semibold text-slate-700 text-xs shrink-0 transition-colors"
        >
          <span>Open Sheet</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {snapshotNotice&&<p role="status" className="p-3 bg-amber-50 rounded-xl text-sm">{snapshotNotice}</p>}
      {!rubrics.length&&<p className="p-4 bg-indigo-50 rounded-xl text-sm">This course has no teacher-approved rubric downloaded yet. <a className="underline font-bold" href="/connected.html">Review and approve a rubric in the main dashboard</a>, then refresh this class.</p>}
      {/* Main Classroom Workflow: 2-Column Grid for iPad */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Left Column: Student Roster Grid (5 cols on desktop/iPad landscape) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-base">Student Roster</h3>
              <p className="text-xs text-slate-500">
                {filteredRoster.length} students in {selectedCourse}
                {lastRefreshedAt && <span className="ml-1 text-slate-400">• Updated {lastRefreshedAt}</span>}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => refreshSnapshot(selectedCourse)}
                disabled={isRefreshingSnapshot}
                className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center space-x-1.5 transition-all disabled:opacity-50"
                title="Download updated snapshot from Google Sheet"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingSnapshot ? 'animate-spin text-indigo-600' : ''}`} />
                <span>{isRefreshingSnapshot ? 'Syncing...' : 'Refresh'}</span>
              </button>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700">
                {lastRefreshedAt?'From Evidence Map':'Downloaded roster'}
              </span>
            </div>
          </div>

          {/* Search Box & Unobserved Today Toggle */}
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search student name..."
                value={searchStudent}
                onChange={(e) => setSearchStudent(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[42px]"
              />
            </div>

            <button
              type="button"
              onClick={() => setFilterUnobservedToday(!filterUnobservedToday)}
              className={`w-full py-1.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-between border transition-all ${
                filterUnobservedToday
                  ? 'bg-amber-100 text-amber-900 border-amber-300'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="flex items-center space-x-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span>Today's View: Unobserved Only</span>
              </span>
              <span className="text-[10px] font-bold uppercase">{filterUnobservedToday ? 'Active' : 'Show All'}</span>
            </button>
          </div>

          {/* Student List Grid */}
          <div className="flex-1 overflow-y-auto max-h-[480px] space-y-1.5 pr-1 no-scrollbar">
            {filteredRoster.length > 0 ? (
              filteredRoster.map((learner) => {
                const isSelected = learner.learner_id === selectedLearnerId;
                return (
                  <button
                    key={learner.learner_id}
                    onClick={() => handleSelectLearner(learner.learner_id)}
                    className={`w-full text-left px-3.5 py-2.5 rounded-xl transition-all flex items-center justify-between min-h-[48px] ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-sm ring-2 ring-indigo-600/40'
                        : 'hover:bg-slate-100 text-slate-800 bg-slate-50/70 border border-slate-200/60'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-extrabold shrink-0 ${
                        isSelected ? 'bg-white text-indigo-700' : 'bg-indigo-100 text-indigo-700'
                      }`}>
                        {learner.display_name.charAt(0)}
                      </div>
                      <span className="text-sm truncate">{learner.display_name}</span>
                    </div>
                    {isSelected && (
                      <CheckCircle2 className="w-4 h-4 text-white shrink-0 ml-2" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="py-8 text-center text-slate-500 text-sm">
                {searchStudent ? `No students found matching "${searchStudent}"` : 'No active learners enrolled in this course roster. Click Refresh to download.'}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Capture Panel (8 cols on iPad) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-4 sm:p-6 border border-slate-200 shadow-xs space-y-5">
          
          {/* Active Context Header with Complete Rubric Button */}
          <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white font-extrabold flex items-center justify-center text-base shadow-sm">
                {currentStudent?.display_name.charAt(0) || '?'}
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-base">{currentStudent?.display_name || 'Select Student'}</h4>
                <p className="text-xs text-slate-500">{COURSES.find(c=>c.id===selectedCourse)?.name}</p>
              </div>
            </div>

            {currentRubric && currentStudent && (
              <button
                type="button"
                onClick={() => setIsCompleteRubricModalOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm transition-all min-h-[40px] shrink-0"
                title="Evaluate multiple criteria for this student in one session"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Complete Full Rubric</span>
              </button>
            )}
          </div>

          {/* Assignment / Rubric Selection */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
              <span>1. Choose Assignment / Approved Rubric</span>
              <span className="text-[11px] font-normal text-slate-400">Server Approved</span>
            </label>
            <select
              value={selectedRubricId}
              onChange={(e) => handleRubric(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm font-medium text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 min-h-[44px]"
            >
              {rubrics.map((r) => (
                <option key={rubricKey(r)} value={rubricKey(r)}>
                  {r.title} (v{r.version})
                </option>
              ))}
            </select>
          </div>

          {/* Rubric Criterion Tabs & Descriptors */}
          {currentRubric && (
            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                2. Select Rubric Criterion & Inspect Descriptors
              </label>
              
              {/* Criterion Selection Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {currentRubric.criteria.map((crit) => {
                  const isCritSelected = crit.id === selectedCriterionId;
                  return (
                    <button
                      key={crit.id}
                      type="button"
                      onClick={() => handleCriterion(crit.id)}
                      className={`px-3 py-2.5 rounded-xl text-left transition-all border min-h-[44px] ${
                        isCritSelected
                          ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs'
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                      }`}
                    >
                      <div className="text-xs font-bold truncate">{crit.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Outcomes: {crit.outcome_codes.join(', ')}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Expandable Criterion Descriptors Card */}
              {currentCriterion && (
                <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-800">{currentCriterion.name}</span>
                    <span className="text-indigo-600 font-semibold">{currentCriterion.outcome_codes.join(' • ')}</span>
                  </div>

                  {/* 4 Performance Bands Display */}
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs">
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200">
                      <span className="font-bold text-rose-800 block mb-1">Beginning</span>
                      <p className="text-[11px] text-rose-900 leading-snug">{currentCriterion.descriptors.Beginning}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-amber-50 border border-amber-200">
                      <span className="font-bold text-amber-800 block mb-1">Developing</span>
                      <p className="text-[11px] text-amber-900 leading-snug">{currentCriterion.descriptors.Developing}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200">
                      <span className="font-bold text-emerald-800 block mb-1">Secure</span>
                      <p className="text-[11px] text-emerald-900 leading-snug">{currentCriterion.descriptors.Secure}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-200">
                      <span className="font-bold text-indigo-800 block mb-1">Extending</span>
                      <p className="text-[11px] text-indigo-900 leading-snug">{currentCriterion.descriptors.Extending}</p>
                    </div>
                  </div>

                  {currentCriterion.collection && (
                    <div className="text-[11px] text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200">
                      <span className="font-semibold text-slate-700 not-italic">Collection Guidance: </span>
                      {currentCriterion.collection}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Evidence Method Multi-Select (Observation, Conversation, Product) */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
              3. Evidence Modality (Select All That Apply)
            </label>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setIsObservation(!isObservation)}
                className={`px-3 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all min-h-[48px] border ${
                  isObservation
                    ? 'bg-sky-600 text-white border-sky-700 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Eye className="w-4 h-4" />
                <span>Observation</span>
              </button>

              <button
                type="button"
                onClick={() => setIsConversation(!isConversation)}
                className={`px-3 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all min-h-[48px] border ${
                  isConversation
                    ? 'bg-violet-600 text-white border-violet-700 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Conversation</span>
              </button>

              <button
                type="button"
                onClick={() => setIsProduct(!isProduct)}
                className={`px-3 py-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center space-x-2 transition-all min-h-[48px] border ${
                  isProduct
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <PackageCheck className="w-4 h-4" />
                <span>Product</span>
              </button>
            </div>
            <div className="text-xs text-slate-500 flex items-center justify-between">
              <span>Combined method string: <strong className="text-slate-800 font-mono">{evidenceTypeRaw}</strong></span>
              <span className="text-[11px] text-slate-400">Preserves all selected methods</span>
            </div>
          </div>

          {/* Brief Note Input with Voice Notes & Gemini Assist Triggers */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider">
                4. Brief Teacher Note & Student Assertion
              </label>

              <div className="flex items-center space-x-1.5">
                <button
                  type="button"
                  onClick={() => setIsVoiceModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold flex items-center space-x-1 border border-rose-200 transition-all min-h-[36px]"
                  title="Record voice note or view iPad dictation instructions"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Voice Note</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsGeminiModalOpen(true)}
                  className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center space-x-1 border border-indigo-200 transition-all min-h-[36px]"
                  title="Ask Gemini to improve wording, summarize, or draft questions"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Gemini Assist</span>
                </button>
              </div>
            </div>

            <textarea
              rows={3}
              value={teacherNote}
              onChange={(e) => setTeacherNote(e.target.value)}
              placeholder="Record what the student did, explained or demonstrated (e.g. 'Located editable layer mask, repaired edge, explained why adjustment is reversible')..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
            
            {/* Display metadata badges if attached */}
            {(voiceNoteId || transcriptText || commentDraftId) && (
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-500 pt-1">
                {voiceNoteId && (
                  <span className="px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                    Audio Note: {voiceNoteId.slice(0, 10)}...
                  </span>
                )}
                {transcriptReviewed && (
                  <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ✓ Transcript Reviewed
                  </span>
                )}
                {commentDraftId && (
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
                    AI Draft Ref: {commentDraftId.slice(0, 12)}...
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Optional Product HTTPS Link */}
          {isProduct && (
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center justify-between">
                <span>Product Artifact Link (Optional HTTPS URL)</span>
                <span className="text-[11px] font-normal text-slate-400">Must start with https://</span>
              </label>
              <input
                type="url"
                placeholder="https://drive.google.com/... or https://github.com/..."
                value={artifactUrl}
                onChange={(e) => handleArtifactUrlChange(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border text-sm focus:bg-white focus:ring-2 focus:ring-indigo-500 min-h-[42px] ${
                  urlError ? 'border-rose-300 ring-rose-500' : 'border-slate-200'
                }`}
              />
              {urlError && <p className="text-xs text-rose-600 font-medium">{urlError}</p>}
            </div>
          )}

          {/* Optional Suggested Achievement & Support Context */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-slate-100">
            {/* Achievement Band */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Suggested Level (Optional)</span>
                <span className="text-[10px] font-normal text-slate-400">Not final judgment</span>
              </label>
              <div className="grid grid-cols-5 gap-1">
                {(['IE', 'Beginning', 'Developing', 'Secure', 'Extending'] as AchievementBand[]).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setAchievementLevel(achievementLevel === lvl ? '' : lvl)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                      achievementLevel === lvl
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {lvl === 'Beginning' ? 'Beg' : lvl === 'Developing' ? 'Dev' : lvl === 'Secure' ? 'Sec' : lvl === 'Extending' ? 'Ext' : 'IE'}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">IE = Insufficient evidence (gap, not zero).</p>
            </div>

            {/* Support Context */}
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Support Context (Optional)</span>
                <span className="text-[10px] font-normal text-slate-400">Separate from achievement</span>
              </label>
              <div className="grid grid-cols-4 gap-1">
                {(['Guided', 'Supported', 'Independent', 'Transfer'] as SupportContext[]).map((sup) => (
                  <button
                    key={sup}
                    type="button"
                    onClick={() => setSupportContext(supportContext === sup ? '' : sup)}
                    className={`py-1.5 px-1 rounded-lg text-xs font-semibold transition-all min-h-[36px] ${
                      supportContext === sup
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {sup}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Access support never caps achievement.</p>
            </div>
          </div>

          {/* Action Buttons: Save & Save & Next Student */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              disabled={saving || !currentCriterion || !currentStudent}
              onClick={() => handleSaveCapture(false)}
              className="w-full py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-sm active:scale-98 min-h-[48px]"
            >
              <Save className="w-4 h-4" />
              <span>Save Evidence</span>
            </button>

            <button
              type="button"
              disabled={saving || !currentCriterion || !currentStudent}
              onClick={() => handleSaveCapture(true)}
              className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm flex items-center justify-center space-x-2 transition-all shadow-md shadow-indigo-100 active:scale-98 min-h-[48px]"
            >
              <span>Save & Next Student</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          {/* Technical IDs Accordion (Collapsed by Default) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}
              className="text-xs text-slate-500 hover:text-slate-700 font-semibold flex items-center space-x-1 py-1"
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>{showTechnicalDetails ? 'Hide Technical IDs' : 'Show Technical Contract IDs'}</span>
              {showTechnicalDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showTechnicalDetails && (
              <div className="mt-2 p-3 rounded-xl bg-slate-900 text-slate-200 text-xs font-mono space-y-1">
                <div>learner_id: <span className="text-emerald-400">{currentStudent?.learner_id}</span></div>
                <div>course_id: <span className="text-sky-400">{selectedCourse}</span></div>
                <div>project_id: <span className="text-amber-400">{currentRubric?.project_id}</span></div>
                <div>rubric_id: <span className="text-violet-400">{currentRubric?.id}</span> (v{currentRubric?.version})</div>
                <div>criterion_id: <span className="text-indigo-400">{currentCriterion?.id}</span></div>
                <div>outcomes: <span className="text-slate-300">{currentCriterion?.outcome_codes.join(';')}</span></div>
                <div>evidence_type: <span className="text-rose-400">{evidenceTypeRaw}</span></div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Voice Notes & Dictation Modal */}
      {currentStudent && (
        <VoiceNotesModal
          isOpen={isVoiceModalOpen}
          onClose={() => setIsVoiceModalOpen(false)}
          learnerId={currentStudent.learner_id}
          learnerName={currentStudent.display_name}
          courseId={selectedCourse}
          onAcceptTranscriptAsNote={(transcript, vnId) => {
            setTeacherNote(transcript);
            setVoiceNoteId(vnId);
            setTranscriptText(transcript);
            setTranscriptReviewed(true);
          }}
        />
      )}

      {/* Gemini Writing Assistance Modal */}
      {currentStudent && (
        <GeminiAssistModal
          isOpen={isGeminiModalOpen}
          onClose={() => setIsGeminiModalOpen(false)}
          originalText={teacherNote}
          context={{
            learnerName: currentStudent.display_name,
            courseId: selectedCourse,
            rubricTitle: currentRubric?.title,
            criterionName: currentCriterion?.name,
            evidenceType: evidenceTypeRaw,
          }}
          onApplyDraft={(draft, draftId) => {
            setTeacherNote(draft);
            setCommentDraftId(draftId);
          }}
        />
      )}

      {/* Complete Full Rubric Modal */}
      {currentStudent && currentRubric && (
        <CompleteRubricModal key={`${selectedCourse}|${selectedLearnerId}|${selectedRubricId}`}
          isOpen={isCompleteRubricModalOpen}
          onClose={() => setIsCompleteRubricModalOpen(false)}
          rubric={currentRubric}
          learner={currentStudent}
          courseId={selectedCourse}
          onSaved={async () => {
            const pending = await getPendingEvents();
            setPendingCount(pending.length);
          }}
        />
      )}
    </div>
  );
};
