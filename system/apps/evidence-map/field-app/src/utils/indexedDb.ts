/**
 * IndexedDB Local Offline Storage for iPad Field Evidence Capture
 * Handles pending captures queue, cached rosters, approved rubrics, and offline transactions.
 */

import { 
  FieldEvent, 
  Learner, 
  ApprovedRubric, 
  CourseId, 
  SyncStatus, 
  ConnectedCatalogue 
} from '../types/evidenceContract';
import catalogueData from '../data/connected-catalogue.json';

const DB_NAME = 'evidence_map_field_connected_v1';
const DB_VERSION = 2;

// Stores
const STORE_PENDING = 'pending_events';
const STORE_CONFIRMED = 'confirmed_events';
const STORE_ROSTER = 'cached_roster';
const STORE_RUBRICS = 'approved_rubrics';
const STORE_DRAFTS = 'draft_rubrics';
const STORE_MEDIA = 'media_blobs';
const STORE_SESSIONS = 'completed_sessions';
const STORE_SETTINGS = 'app_settings';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported on this platform'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(STORE_PENDING)) {
        const store = db.createObjectStore(STORE_PENDING, { keyPath: 'event_id' });
        store.createIndex('course_id', 'course_id', { unique: false });
        store.createIndex('local_status', 'local_status', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_CONFIRMED)) {
        const store = db.createObjectStore(STORE_CONFIRMED, { keyPath: 'event_id' });
        store.createIndex('course_id', 'course_id', { unique: false });
        store.createIndex('learner_id', 'learner_id', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_ROSTER)) {
        db.createObjectStore(STORE_ROSTER, { keyPath: 'course_id' });
      }

      if (!db.objectStoreNames.contains(STORE_RUBRICS)) {
        const store = db.createObjectStore(STORE_RUBRICS, { keyPath: ['course', 'id', 'version'] });
        store.createIndex('course', 'course', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_SETTINGS)) {
        db.createObjectStore(STORE_SETTINGS, { keyPath: 'key' });
      }

      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        const store = db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
        store.createIndex('course', 'course', { unique: false });
      }

      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
        const store = db.createObjectStore(STORE_SESSIONS, { keyPath: 'session_id' });
        store.createIndex('learner_id', 'learner_id', { unique: false });
        store.createIndex('course_id', 'course_id', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save or update a field capture event in the pending queue
 */
export async function savePendingEvent(event: FieldEvent): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PENDING], 'readwrite');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.put({
        ...event,
        local_status: event.local_status || 'pending',
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('IndexedDB write fallback to localStorage:', err);
    const key = `pending_event_${event.event_id}`;
    localStorage.setItem(key, JSON.stringify(event));
  }
}

/**
 * Get all pending events awaiting sync to Evidence Map
 */
export async function getPendingEvents(): Promise<FieldEvent[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PENDING], 'readonly');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const events: FieldEvent[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('pending_event_')) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '');
          if (item?.event_id) events.push(item);
        } catch {}
      }
    }
    return events;
  }
}

/**
 * Move an event from pending to confirmed after successful API receipt
 */
export async function markEventConfirmed(event: FieldEvent, revisionId?: string, mappingStatus?: any): Promise<void> {
  const confirmedEvent: FieldEvent = {
    ...event,
    local_status: 'saved_evidence_map',
    revision_id: revisionId || event.revision_id,
    mapping_status: mappingStatus || event.mapping_status || 'mapped',
    google_mirror_status: event.google_mirror_status || 'unverified',
  };

  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PENDING, STORE_CONFIRMED], 'readwrite');
      tx.objectStore(STORE_PENDING).delete(event.event_id);
      tx.objectStore(STORE_CONFIRMED).put(confirmedEvent);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    localStorage.removeItem(`pending_event_${event.event_id}`);
    localStorage.setItem(`confirmed_event_${event.event_id}`, JSON.stringify(confirmedEvent));
  }
}

/**
 * Mark event with sync error / needs correction
 */
export async function markEventError(eventId: string, errorMessage: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PENDING], 'readwrite');
      const store = tx.objectStore(STORE_PENDING);
      const req = store.get(eventId);
      req.onsuccess = () => {
        const item = req.result;
        if (item) {
          item.local_status = 'needs_correction';
          item.sync_error = errorMessage;
          store.put(item);
        }
        resolve();
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.error('Error marking event status:', err);
  }
}

/**
 * Get all confirmed events from local database
 */
export async function getConfirmedEvents(): Promise<FieldEvent[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_CONFIRMED], 'readonly');
      const store = tx.objectStore(STORE_CONFIRMED);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const events: FieldEvent[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('confirmed_event_')) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '');
          if (item?.event_id) events.push(item);
        } catch {}
      }
    }
    return events;
  }
}

/**
 * Cache roster for a course
 */
export async function cacheRoster(courseId: CourseId, learners: Learner[]): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_ROSTER], 'readwrite');
      tx.objectStore(STORE_ROSTER).put({
        course_id: courseId,
        learners,
        updated_at: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    localStorage.setItem(`roster_${courseId}`, JSON.stringify({ learners, updated_at: new Date().toISOString() }));
  }
}

/**
 * Get cached roster for a course, with safe fallback to catalogue defaults
 */
export async function getCachedRoster(courseId: CourseId): Promise<Learner[]> {
  try {
    const db = await openDB();
    const result: any = await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_ROSTER], 'readonly');
      const req = tx.objectStore(STORE_ROSTER).get(courseId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    if (result && Array.isArray(result.learners)) {
      return result.learners;
    }
  } catch (err) {
    const raw = localStorage.getItem(`roster_${courseId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed.learners)) return parsed.learners;
      } catch {}
    }
  }

  return [];
}

/**
 * Cache approved rubrics from server snapshot
 */
export async function cacheApprovedRubrics(rubrics: ApprovedRubric[], courseId?: CourseId): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RUBRICS], 'readwrite');
      const store = tx.objectStore(STORE_RUBRICS);
      const read = store.getAll();
      read.onsuccess = () => {
        for (const r of read.result) if (!courseId || r.course === courseId) store.delete([r.course,r.id,r.version]);
        rubrics.filter(r => r.status === 'approved').forEach((r) => store.put(r));
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    const old = JSON.parse(localStorage.getItem('approved_rubrics') || '[]');
    localStorage.setItem('approved_rubrics', JSON.stringify([...old.filter((r:any) => courseId && r.course !== courseId), ...rubrics.filter(r => r.status === 'approved')]));
  }
}

export async function saveApprovedRubric(rubric: ApprovedRubric): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RUBRICS], 'readwrite');
      const store = tx.objectStore(STORE_RUBRICS);
      store.put(rubric);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    const existing = await getApprovedRubrics();
    const updated = [...existing.filter(r => !(r.id === rubric.id && r.version === rubric.version)), rubric];
    localStorage.setItem('approved_rubrics', JSON.stringify(updated));
  }
}

/**
 * Get approved rubrics for course, falling back to catalogue approved/ready rubrics
 */
export async function getApprovedRubrics(courseId?: CourseId): Promise<ApprovedRubric[]> {
  let list: ApprovedRubric[] = [];

  try {
    const db = await openDB();
    list = await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_RUBRICS], 'readonly');
      const store = tx.objectStore(STORE_RUBRICS);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    const raw = localStorage.getItem('approved_rubrics');
    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {}
    }
  }

  // If no rubrics cached yet, catalogue rubrics remain drafts until explicit server approval
  if (!list || list.length === 0) {
    const catalogue = catalogueData as unknown as ConnectedCatalogue;
    list = (catalogue.rubrics || []).map((r) => ({
      ...r,
      // Public catalogue entries remain drafts until explicit server approval
      status: 'draft',
    }));
  }

  if (courseId) {
    return list.filter((r) => r.course === courseId);
  }
  return list;
}

/**
 * Delete a specific event by ID
 */
export async function deleteEvent(eventId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_PENDING, STORE_CONFIRMED], 'readwrite');
      tx.objectStore(STORE_PENDING).delete(eventId);
      tx.objectStore(STORE_CONFIRMED).delete(eventId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    localStorage.removeItem(`pending_event_${eventId}`);
    localStorage.removeItem(`confirmed_event_${eventId}`);
  }
}

/**
 * App Settings persistence (Active course, active assignment, mode)
 */
export async function getSetting<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const db = await openDB();
    const res: any = await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SETTINGS], 'readonly');
      const req = tx.objectStore(STORE_SETTINGS).get(key);
      req.onsuccess = () => resolve(req.result?.value);
      req.onerror = () => reject(req.error);
    });
    return res !== undefined ? res : defaultValue;
  } catch {
    const raw = localStorage.getItem(`setting_${key}`);
    return raw ? JSON.parse(raw) : defaultValue;
  }
}

export async function setSetting<T>(key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SETTINGS], 'readwrite');
      tx.objectStore(STORE_SETTINGS).put({ key, value });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    localStorage.setItem(`setting_${key}`, JSON.stringify(value));
  }
}

/**
 * Media blobs storage (private audio recordings for voice notes)
 */
export async function saveVoiceBlob(id: string, blob: Blob, mimeType: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA], 'readwrite');
      tx.objectStore(STORE_MEDIA).put({
        id,
        blob,
        mimeType,
        createdAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    throw new Error('Recording could not be saved on this device. Keep the typed note and retry.');
  }
}

export async function getVoiceBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA], 'readonly');
      const req = tx.objectStore(STORE_MEDIA).get(id);
      req.onsuccess = () => resolve(req.result?.blob || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function deleteVoiceBlob(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_MEDIA], 'readwrite');
      tx.objectStore(STORE_MEDIA).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Could not delete media blob:', err);
  }
}

/**
 * Draft Rubrics (local teacher drafts before publishing immutable versions)
 */
export async function saveDraftRubric(rubric: ApprovedRubric): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DRAFTS], 'readwrite');
      tx.objectStore(STORE_DRAFTS).put(rubric);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    localStorage.setItem(`draft_rubric_${rubric.id}`, JSON.stringify(rubric));
  }
}

export async function getDraftRubrics(courseId?: CourseId): Promise<ApprovedRubric[]> {
  try {
    const db = await openDB();
    const list: ApprovedRubric[] = await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_DRAFTS], 'readonly');
      const req = tx.objectStore(STORE_DRAFTS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (courseId) return list.filter((r) => r.course === courseId);
    return list;
  } catch {
    const list: ApprovedRubric[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('draft_rubric_')) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '');
          if (item?.id) list.push(item);
        } catch {}
      }
    }
    if (courseId) return list.filter((r) => r.course === courseId);
    return list;
  }
}

/**
 * Completed Multi-Criterion Assessment Sessions
 */
export async function saveCompletedSession(session: any): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readwrite');
      tx.objectStore(STORE_SESSIONS).put(session);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    localStorage.setItem(`completed_session_${session.session_id}`, JSON.stringify(session));
  }
}

export async function getCompletedSessions(courseId?: CourseId): Promise<any[]> {
  try {
    const db = await openDB();
    const list: any[] = await new Promise((resolve, reject) => {
      const tx = db.transaction([STORE_SESSIONS], 'readonly');
      const req = tx.objectStore(STORE_SESSIONS).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
    if (courseId) return list.filter((s) => s.course_id === courseId);
    return list;
  } catch {
    const list: any[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k?.startsWith('completed_session_')) {
        try {
          const item = JSON.parse(localStorage.getItem(k) || '');
          if (item?.session_id) list.push(item);
        } catch {}
      }
    }
    if (courseId) return list.filter((s) => s.course_id === courseId);
    return list;
  }
}

/** All criteria and the session receipt commit together; failure leaves the form intact. */
export async function saveAssessmentSession(events:FieldEvent[],session:any):Promise<void>{
  const db=await openDB();
  await new Promise<void>((resolve,reject)=>{
    const tx=db.transaction([STORE_PENDING,STORE_SESSIONS],'readwrite');
    for(const event of events)tx.objectStore(STORE_PENDING).put(event);
    tx.objectStore(STORE_SESSIONS).put(session);
    tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Session save interrupted'));
  });
}
