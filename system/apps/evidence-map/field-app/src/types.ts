export interface Student {
  id: string;
  name: string;
  grade?: string;
  notes?: string;
  avatarColor: string;
}

export interface RubricBand {
  id: string;
  name: string;
  score: number;
  color: string;
  description: string;
}

export interface RubricCriterion {
  id: string;
  title: string;
  description: string;
  bands: RubricBand[];
}

export interface OutcomeRubric {
  id: string;
  title: string;
  outcomeCode?: string;
  subject?: string;
  gradeLevel?: string;
  description: string;
  criteria: RubricCriterion[];
  createdAt: string;
  updatedAt: string;
}

export interface AssessmentRecord {
  id: string;
  studentId: string;
  studentName: string;
  rubricId: string;
  rubricTitle: string;
  type: 'observation' | 'conversation' | 'both';
  date: string;
  observationNotes: string;
  conversationNotes: string;
  voiceAudioUrl?: string; // audio data URI if recorded
  voiceTranscript?: string;
  selectedBandId: string;
  selectedBandName: string;
  selectedScore: number;
  aiAssessment?: {
    recommendedBandId: string;
    recommendedBandName: string;
    rationale: string;
    strengths: string[];
    growthAreas: string[];
    studentFeedback: string;
    suggestedNextSteps: string[];
  };
  probingQuestions?: {
    question: string;
    purpose: string;
  }[];
  syncedToGoogleSheet: boolean;
  syncedAt?: string;
}

export interface GoogleSheetConfig {
  appsScriptUrl: string;
  sheetName: string;
  autoSync: boolean;
  lastSyncTime?: string;
  lastSyncStatus?: 'success' | 'error';
  lastSyncMessage?: string;
}

export type ActiveTab = 
  | 'field-capture' 
  | 'dashboard' 
  | 'rubrics' 
  | 'sync-hub' 
  | 'assess' 
  | 'students' 
  | 'history' 
  | 'export-sync';
