/**
 * Evidence Bridge API client conforming to INTERFACE_CONTRACT.json
 * Handles authenticated teacher session, snapshot fetching, events ingestion,
 * and reliable offline retry queue management.
 */

import { 
  FieldEvent, 
  CourseId, 
  SnapshotResponse, 
  EventsResponse, 
  Learner, 
  ApprovedRubric 
} from '../types/evidenceContract';
import { 
  getPendingEvents,
  getConfirmedEvents, 
  markEventConfirmed, 
  markEventError, 
  cacheRoster, 
  cacheApprovedRubrics, 
  savePendingEvent 
} from './indexedDb';

export const API_BASE_URL = 'https://outcome-evidence-map.netlify.app';
export const API_PATH = '/.netlify/functions/evidence-bridge';

export function readFieldLaunch(search: string): {course: CourseId; rubricKey?: string} | null {
  const params = new URLSearchParams(search), course = params.get('course');
  if (!['MM12', 'COM11', 'IBDS'].includes(course || '')) return null;
  const id = params.get('rubric'), version = params.get('version');
  return {course: course as CourseId, ...(id || version ? {rubricKey: id && version ? `${id}@${version}` : 'invalid-request'} : {})};
}

export function chooseFieldRubric(available: ApprovedRubric[], requested: string | undefined, selected: string, preference: string): ApprovedRubric | undefined {
  const key = (r: ApprovedRubric) => `${r.id}@${r.version}`;
  // A missing requested version must never silently open a different assessment.
  if (requested) return available.find(r => key(r) === requested);
  return available.find(r => key(r) === selected) || available.find(r => key(r) === preference) || available[0];
}

export interface BridgeStatus {
  online: boolean;
  authenticated: boolean;
  role: 'teacher' | 'reader' | 'google' | null;
  mode: 'connected' | 'demo';
  lastSyncTime?: string;
  expiresAt?: number;
  errorMessage?: string;
}

class EvidenceBridgeService {
  private isConnectedMode: boolean = true;
  private isSyncing: boolean = false;

  public getMode(): 'connected' | 'demo' { return 'connected'; }
  public setDemoMode(forceDemo: boolean) {
    if (forceDemo) throw new Error('This installed companion uses real Evidence Map data. Demo mode is disabled.');
  }

  /**
   * Check connection & authentication status
   */
  public async checkStatus(): Promise<BridgeStatus> {
    try {
      const res = await fetch(`${API_PATH}?action=status`, {
        method: 'GET',
        credentials: 'include', // SameSite HttpOnly cookie
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (res.status === 200) {
        const data = await res.json();
        return {
          online: true,
          authenticated: data.role === 'teacher',
          role: data.role,
          expiresAt: data.expires_at,
          mode: 'connected',
        };
      }

      if (res.status === 401) {
        window.dispatchEvent(new Event('em-auth-required'));
        return {
          online: true,
          authenticated: false,
          role: null,
          mode: 'connected',
          errorMessage: 'Teacher sign-in required',
        };
      }

      return {
        online: true,
        authenticated: false,
        role: null,
        mode: 'connected',
        errorMessage: `HTTP ${res.status}`,
      };
    } catch (err: any) {
      return {
        online: false,
        authenticated: false,
        role: null,
        mode: 'connected',
        errorMessage: 'Network offline. Captures saved to iPad storage.',
      };
    }
  }

  /**
   * Teacher Login (creates 4-hour HttpOnly cookie on Netlify)
   */
  public async login(accessKey: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const res = await fetch(`${API_PATH}?action=login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ access_key: accessKey }),
      });

      const data = await res.json();
      if (res.ok && data.ok) {
        return { ok: true };
      }
      return { ok: false, error: data.error || 'Invalid teacher access key.' };
    } catch (err: any) {
      return { ok: false, error: 'Could not reach Evidence Map server. Ensure network is active.' };
    }
  }

  /**
   * Teacher Logout
   */
  public async logout(): Promise<void> {
    if (this.isConnectedMode) {
      try {
        const response=await fetch(`${API_PATH}?action=logout`, {
          method: 'POST',
          credentials: 'include',
          headers:{'Content-Type':'application/json'},body:'{}',
        });
        if(!response.ok)throw new Error('Server sign-out did not complete');
      } catch(error) {throw error;} 
    }
  }

  /**
   * Fetch Course Snapshot (Roster, Approved Rubrics, Events, Progress)
   */
  public async fetchCourseSnapshot(courseId: CourseId): Promise<{
    ok: boolean;
    data?: SnapshotResponse;
    error?: string;
  }> {
    try {
      const res = await fetch(`${API_PATH}?action=snapshot&course_id=${courseId}`, {
        method: 'GET',
        credentials: 'include',
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (res.status === 401) window.dispatchEvent(new Event('em-auth-required'));
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        return { ok: false, error: err.error || 'Failed to fetch snapshot' };
      }

      const data: SnapshotResponse = await res.json();

      if (data.role !== 'teacher' || data.course_id !== courseId || !Array.isArray(data.roster?.learners) || !Array.isArray(data.rubrics)) {
        return {ok:false,error:'The server did not return a valid teacher snapshot for this class.'};
      }
      // Cache the downloaded roster and approved rubrics into IndexedDB
      if (data.roster?.learners) {
        await cacheRoster(courseId, data.roster.learners);
      }
      if (data.rubrics) {
        await cacheApprovedRubrics(data.rubrics.filter(r => r.course === courseId && r.status === 'approved'), courseId);
      }

      return { ok: true, data };
    } catch (err: any) {
      return { ok: false, error: 'Offline - using cached roster & rubrics.' };
    }
  }

  /**
   * Submit a batch of field events (max 100 per request)
   */
  public async submitEventsBatch(events: FieldEvent[]): Promise<EventsResponse> {
    if (events.length === 0) {
      return { results: {} };
    }

    // Sanitize and format events according to INTERFACE_CONTRACT.json
    const payload = events.map((e) => {
      const item: Record<string, any> = {
        schema_version: '1.0',
        event_id: e.event_id,
        source_revision: e.source_revision || 1,
        stream: 'evidence',
        learner_id: e.learner_id,
        course_id: e.course_id,
        project_id: e.project_id,
        canonical_id: e.canonical_id || e.criterion_id,
        step_id: e.step_id || '',
        rubric_id: e.rubric_id,
        rubric_version: e.rubric_version,
        criterion_id: e.criterion_id,
        tutorial_skill_ids: e.tutorial_skill_ids || [],
        outcome_codes_raw: e.outcome_codes_raw,
        evidence_type_raw: e.evidence_type_raw,
        response_value: e.response_value || '',
        teacher_note: e.teacher_note || '',
        level_raw: e.level_raw || '',
        independence_raw: e.independence_raw || '',
        artifact_url: e.artifact_url || '',
        teacher_verified: false,
        timestamp: e.timestamp,
      };
      if (e.assessment_session_id) item.assessment_session_id = e.assessment_session_id;
      if (e.voice_note_id) item.voice_note_id = e.voice_note_id;
      if (e.transcript_text) item.transcript_text = e.transcript_text;
      if (e.transcript_reviewed !== undefined) item.transcript_reviewed = e.transcript_reviewed;
      if (e.comment_draft_id) item.comment_draft_id = e.comment_draft_id;
      return item;
    });

    try {
      const res = await fetch(`${API_PATH}?action=events`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: payload }),
      });

      if (res.status === 401) window.dispatchEvent(new Event('em-auth-required'));
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: `Server HTTP ${res.status}` }));
        return {
          results: {},
          error: errorData.error || `HTTP ${res.status}: Validation error`,
        };
      }

      return await res.json();
    } catch (err: any) {
      return {
        results: {},
        error: 'Network connection lost during sync. Retaining captures on device.',
      };
    }
  }

  /**
   * Sync all pending items from IndexedDB to Evidence Map
   */
  public async updateMirrorReceipts():Promise<void>{
    const courses:CourseId[]=['MM12','COM11','IBDS'];
    const confirmed=await getConfirmedEvents();
    for(const course of courses){
      if(!confirmed.some(e=>e.course_id===course))continue;
      try{
        const response=await fetch(`${API_PATH}?action=mirror-status&course_id=${course}`,{credentials:'include'});
        if(!response.ok)continue;
        const body=await response.json();
        if(body.course_id!==course||!Array.isArray(body.receipts))continue;
        for(const e of confirmed.filter(e=>e.course_id===course)){
          if(body.receipts.some((r:any)=>r.event_id===e.event_id&&r.revision_id===e.revision_id))await markEventConfirmed({...e,google_mirror_status:'mirrored'},e.revision_id,e.mapping_status);
        }
      }catch{/* Unverified stays unverified until a matching receipt arrives. */}
    }
  }

  public async syncPendingQueue(): Promise<{
    syncedCount: number;
    errorCount: number;
    errors: string[];
  }> {
    if (this.isSyncing) {
      return { syncedCount: 0, errorCount: 0, errors: ['Sync already in progress'] };
    }

    this.isSyncing = true;
    let syncedCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    try {
      const pending = await getPendingEvents();
      if (pending.length === 0) {
        this.isSyncing = false;
        return { syncedCount: 0, errorCount: 0, errors: [] };
      }

      // Process in chunks of up to 50
      for (let i = 0; i < pending.length; i += 50) {
        const chunk = pending.slice(i, i + 50);
        const response = await this.submitEventsBatch(chunk);

        if (response.error) {
          // Whole batch rejected by server (e.g. auth expired or mapping error)
          errors.push(response.error);
          for (const ev of chunk) {
            await markEventError(ev.event_id, response.error);
            errorCount++;
          }
          break;
        }

        const results = response.results || {};
        for (const ev of chunk) {
          const receipt = results[ev.event_id];
          if (receipt && receipt.ok) {
            if (receipt.record_id !== ev.event_id || typeof receipt.revision_id !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.revision_id)) {
              const message = 'Server receipt does not confirm this capture and revision. Capture remains on device.';
              await markEventError(ev.event_id, message);
              errors.push(message); errorCount++; continue;
            }
            await markEventConfirmed(ev, receipt.revision_id, receipt.mapping_status);
            syncedCount++;
          } else if (receipt && !receipt.ok) {
            const msg = receipt.error || 'Server rejected event';
            await markEventError(ev.event_id, msg);
            errors.push(`${ev.learner_name || ev.learner_id}: ${msg}`);
            errorCount++;
          } else {
            // No item receipt returned
            await markEventError(ev.event_id, 'No receipt returned by server');
            errorCount++;
          }
        }
      }
    } catch (err: any) {
      errors.push(err.message || 'Sync failed');
    } finally {
      window.dispatchEvent(new Event('em-field-updated'));
      this.isSyncing = false;
    }

    return { syncedCount, errorCount, errors };
  }
}

export const evidenceBridge = new EvidenceBridgeService();
