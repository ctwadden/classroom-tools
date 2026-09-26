import { AssessmentRecord, GoogleSheetConfig, OutcomeRubric, Student } from '../types';
import { INITIAL_RUBRICS, INITIAL_STUDENTS, INITIAL_RECORDS } from '../data/defaults';

const STUDENTS_KEY = 'assess_students_v2';
const RUBRICS_KEY = 'assess_rubrics_v2';
const RECORDS_KEY = 'assess_records_v2';
const GSHEET_KEY = 'assess_gsheet_v2';

export function getStoredStudents(): Student[] {
  try {
    const raw = localStorage.getItem(STUDENTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load students from localStorage:', e);
  }
  return INITIAL_STUDENTS;
}

export function saveStoredStudents(students: Student[]) {
  try {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(students));
  } catch (e) {
    console.error('Failed to save students:', e);
  }
}

export function getStoredRubrics(): OutcomeRubric[] {
  try {
    const raw = localStorage.getItem(RUBRICS_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load rubrics from localStorage:', e);
  }
  return INITIAL_RUBRICS;
}

export function saveStoredRubrics(rubrics: OutcomeRubric[]) {
  try {
    localStorage.setItem(RUBRICS_KEY, JSON.stringify(rubrics));
  } catch (e) {
    console.error('Failed to save rubrics:', e);
  }
}

export function getStoredRecords(): AssessmentRecord[] {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to load records from localStorage:', e);
  }
  return INITIAL_RECORDS;
}

export function saveStoredRecords(records: AssessmentRecord[]) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Failed to save records:', e);
  }
}

export function getStoredGoogleSheetConfig(): GoogleSheetConfig {
  try {
    const raw = localStorage.getItem(GSHEET_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load sheet config:', e);
  }
  return {
    appsScriptUrl: '',
    sheetName: 'Assessment_Records',
    autoSync: true,
  };
}

export function saveStoredGoogleSheetConfig(config: GoogleSheetConfig) {
  try {
    localStorage.setItem(GSHEET_KEY, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save sheet config:', e);
  }
}

// Generate the Google Apps Script snippet ready for Google Sheets
export function getGoogleAppsScriptSnippet(): string {
  return `/**
 * Google Apps Script for Student Assessment Master Database
 * 
 * Instructions:
 * 1. In your Google Sheet, click Extensions > Apps Script
 * 2. Delete existing code and paste this entire file
 * 3. Click "Deploy" > "New deployment"
 * 4. Select type: "Web app"
 * 5. Description: "Student Assessment Sync"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone" (allows iPad & app to post records directly)
 * 8. Click "Deploy", authorize permissions, and copy the Web App URL!
 * 9. Paste that URL into the app's Google Sheet Sync settings.
 */

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  
  try {
    var sheet = getOrCreateMasterSheet();
    var payload = JSON.parse(e.postData.contents);
    
    if (payload.action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success',
        message: 'Connected to ' + sheet.getName(),
        rowCount: sheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    var records = payload.records || [];
    if (!Array.isArray(records)) {
      records = [records];
    }
    
    var addedCount = 0;
    records.forEach(function(rec) {
      sheet.appendRow([
        new Date(rec.date || new Date()),
        rec.studentId || '',
        rec.studentName || '',
        rec.rubricTitle || '',
        rec.type || 'observation',
        rec.selectedBandName || '',
        rec.selectedScore || '',
        rec.observationNotes || '',
        rec.conversationNotes || '',
        rec.voiceTranscript || '',
        rec.aiAssessment ? rec.aiAssessment.studentFeedback : '',
        rec.aiAssessment ? rec.aiAssessment.suggestedNextSteps.join('; ') : '',
        rec.id || ''
      ]);
      addedCount++;
    });
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      syncedCount: addedCount,
      totalRows: sheet.getLastRow()
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

function getOrCreateMasterSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetName = "Assessment_Records";
  var sheet = ss.getSheetByName(sheetName);
  
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    var headers = [
      "Timestamp",
      "Student ID",
      "Student Name",
      "Outcome / Assignment",
      "Evidence Mode",
      "Rubric Band",
      "Score",
      "Observation Notes",
      "Conversation Notes",
      "Voice Transcript",
      "AI Student Feedback",
      "AI Next Steps",
      "Record ID"
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground("#1e293b").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'online',
    app: 'Student Observation & Conversation Assessment Database'
  })).setMimeType(ContentService.MimeType.JSON);
}
`;
}

// Download CSV helper
export function downloadRecordsCSV(records: AssessmentRecord[]) {
  const headers = [
    'Date',
    'Student Name',
    'Outcome / Assignment',
    'Evidence Mode',
    'Rubric Band',
    'Score',
    'Observation Notes',
    'Conversation Notes',
    'Voice Transcript',
    'AI Feedback',
    'Next Steps',
    'Record ID',
  ];

  const escapeCSV = (str: string | number | undefined) => {
    if (str === undefined || str === null) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const rows = records.map((r) => [
    escapeCSV(new Date(r.date).toLocaleString()),
    escapeCSV(r.studentName),
    escapeCSV(r.rubricTitle),
    escapeCSV(r.type),
    escapeCSV(r.selectedBandName),
    escapeCSV(r.selectedScore),
    escapeCSV(r.observationNotes),
    escapeCSV(r.conversationNotes),
    escapeCSV(r.voiceTranscript),
    escapeCSV(r.aiAssessment?.studentFeedback || ''),
    escapeCSV(r.aiAssessment?.suggestedNextSteps?.join('; ') || ''),
    escapeCSV(r.id),
  ]);

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Assessment_Evidence_Master_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
