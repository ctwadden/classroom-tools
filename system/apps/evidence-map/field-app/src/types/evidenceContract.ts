/**
 * Type definitions matching INTERFACE_CONTRACT.json
 * Base system: https://outcome-evidence-map.netlify.app
 */

export type CourseId = 'MM12' | 'COM11' | 'IBDS';

export type EvidenceStream = 'evidence' | 'knowledge' | 'reflection' | 'transfer' | 'support';

export type EvidenceMethod = 'Observation' | 'Conversation' | 'Product';

export type AchievementBand = 'IE' | 'Beginning' | 'Developing' | 'Secure' | 'Extending';

export type SupportContext = 'Guided' | 'Supported' | 'Independent' | 'Transfer';

export type MappingStatus = 'mapped' | 'needs_mapping' | 'unlinked';

export type SyncStatus = 
  | 'draft' 
  | 'pending' 
  | 'syncing' 
  | 'saved_evidence_map' 
  | 'needs_correction' 
  | 'conflict';

export type GoogleDeliveryStatus = 'unverified' | 'mirrored';

export interface Learner {
  learner_id: string;
  display_name: string;
  active: boolean;
  powerschool_id?: string;
  student_email?: string; // only present in internal roster, never sent publicly
}

export interface RubricCriterionDescriptor {
  Beginning: string;
  Developing: string;
  Secure: string;
  Extending: string;
}

export interface RubricCriterion {
  id: string;
  name: string;
  outcome_codes: string[];
  skill_ids?: string[];
  descriptors: RubricCriterionDescriptor;
  collection?: string;
  repair?: string;
  mapping_ready?: boolean;
}

export interface ApprovedRubric {
  id: string;
  version: string;
  course: CourseId;
  project_id: string;
  title: string;
  status: 'approved' | 'draft';
  approved_at?: string;
  bands: string[];
  missing?: string;
  review_note?: string;
  criteria: RubricCriterion[];
  support_rule?: string;
  knowledge_rule?: string;
  powerschool?: string;
  original_version?: string;
  capture_ready: boolean;
}

export interface OutcomeDefinition {
  course_id: CourseId;
  outcome_id: string;
  outcome_code: string;
  ps_outcome_code?: string;
  display_code: string;
  outcome_title: string;
  active: string | boolean;
  aliases?: string[];
  authority?: string;
  active_in_plan?: boolean;
}

export interface FieldEventOutcome {
  raw?: string;
  outcome_code: string;
  outcome_id: string | null;
}

export interface FieldEvent {
  schema_version: '1.0';
  event_id: string;
  source_revision: number;
  stream: 'evidence';
  learner_id: string;
  course_id: CourseId;
  project_id: string;
  canonical_id: string;
  step_id?: string;
  rubric_id: string;
  rubric_version: string;
  criterion_id: string;
  tutorial_skill_ids?: string[];
  outcome_codes_raw: string;
  outcomes?: FieldEventOutcome[];
  evidence_type_raw: string; // e.g. 'Observation' | 'Conversation' | 'Product' | 'Observation+Conversation' | 'Observation+Conversation+Product'
  methods?: string[];
  response_value: string;
  teacher_note: string;
  level_raw?: string; // e.g. '3 - Secure', 'Beginning', 'IE'
  band?: string | null;
  independence_raw?: string; // e.g. 'Guided', 'Supported', 'Independent', 'Transfer'
  support_signal?: {
    raw: string;
    band: SupportContext | null;
    confirmed: boolean;
  } | null;
  artifact_url?: string;
  teacher_verified: false;
  source_teacher_claim?: boolean;
  source: 'field' | 'google' | 'google_legacy';
  timestamp: string;
  revision_id?: string;
  mapping_status?: MappingStatus;
  conflict?: boolean;
  
  // Extensions for sessions, voice notes, transcription and AI comment drafts
  assessment_session_id?: string;
  voice_note_id?: string;
  transcript_text?: string;
  transcript_reviewed?: boolean;
  comment_draft_id?: string;

  // Local state extensions (client-side only)
  local_status?: SyncStatus;
  sync_error?: string;
  google_mirror_status?: GoogleDeliveryStatus;
  last_sync_attempt?: string;
  learner_name?: string; // cached for visual UI
  rubric_title?: string;
  criterion_name?: string;
}

export interface VoiceNoteRecord {
  id: string; // voice_note_id
  learner_id: string;
  course_id: CourseId;
  created_at: string;
  duration_seconds: number;
  mime_type: string;
  audio_blob_key?: string; // indexedDB blob key
  transcript_text?: string;
  transcript_reviewed: boolean;
  reviewed_at?: string;
  server_backed_up: boolean;
}

export interface CompletedRubricCriterionAssessment {
  criterion_id: string;
  criterion_name: string;
  outcome_codes: string[];
  evidence_methods: EvidenceMethod[];
  evidence_note: string;
  suggested_achievement?: AchievementBand;
  support_context?: SupportContext;
  artifact_url?: string;
  event_id?: string;
  status: 'unassessed' | 'draft' | 'saved';
}

export interface CompletedRubricSession {
  session_id: string;
  learner_id: string;
  learner_name: string;
  course_id: CourseId;
  rubric_id: string;
  rubric_version: string;
  rubric_title: string;
  project_id: string;
  started_at: string;
  completed_at?: string;
  criteria_evaluations: Record<string, CompletedRubricCriterionAssessment>;
  overall_teacher_note?: string;
  exported_pdf?: boolean;
}

export type GeminiAssistAction = 
  | 'improve_wording'
  | 'make_concise'
  | 'draft_feedback'
  | 'suggest_question'
  | 'draft_reporting_comment'
  | 'draft_rubric_descriptors'
  | 'transcribe_voice_note';

export interface GeminiDraftResult {
  action: GeminiAssistAction;
  original_text: string;
  draft_text: string;
  comment_draft_id?: string;
  model_used: string;
  created_at: string;
  status: 'draft' | 'accepted' | 'edited' | 'rejected';
}

export interface EventBatchResult {
  ok: boolean;
  record_id?: string;
  revision_id?: string;
  dedup?: boolean;
  mapping_status?: MappingStatus;
  error?: string;
}

export interface EventsResponse {
  results: Record<string, EventBatchResult>;
  error?: string;
}

export interface SnapshotResponse {
  schema_version: '1.0';
  role: 'teacher' | 'reader' | 'google' | null;
  course_id: CourseId;
  events: FieldEvent[];
  progress: Array<{
    course_id: CourseId;
    learner_id: string;
    outcome_id: string;
    outcome_code: string;
    ps_outcome_code?: string;
    achievement: AchievementBand | null;
    support: SupportContext | null;
    comment: string;
    evidence_ids: string[];
    updated_at: string;
    reviewer: string;
    status: 'teacher_confirmed' | 'conflict';
    revision_ids: string[];
    reporting: string;
  }>;
  roster: {
    course_id?: CourseId;
    learners: Learner[];
    updated_at: string | null;
  };
  rubrics: ApprovedRubric[];
  plan_version: string;
  generated_at: string;
}

export interface ConnectedCatalogue {
  schema_version: string;
  plan_version: string;
  courses: Record<string, string>;
  outcomes: OutcomeDefinition[];
  rubrics: ApprovedRubric[];
  sprints?: Record<string, any[]>;
}
