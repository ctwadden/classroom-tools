/* Student OS core — shared domain logic for the local demo (Node) and the proposed Apps Script web app.
 *
 * Runs unchanged in both runtimes: no modules, no Node or browser APIs. Platform services are injected:
 *   repo     storage (MemoryRepo locally, SheetRepo in Apps Script)
 *   adapters assignment source, evidence submitter, announcements (mock/demo or proposed live)
 *   sha256   (text) -> hex
 *   uuid     () -> unique string
 *   now      () -> ISO timestamp
 *
 * Security model: every call receives an `identity` that the SERVER resolved from the authenticated
 * account (see resolveIdentity). Request arguments never carry authorization: any learner_id, email
 * or role inside `args` is ignored or rejected.
 */
(function (root) {
  'use strict';

  var COLUMNS = ['plan', 'working', 'need_feedback', 'revise', 'complete'];
  var COLUMN_LABELS = { plan: 'To do', working: 'Working', need_feedback: 'Need feedback', revise: 'Revise', complete: 'Complete' };
  var COURSES = { IBDS: 'IB Digital Society SL', COM11: 'Communications Technology 11', MM12: 'Multimedia 12' };
  var PROMPTS = { tried: 'What did I try?', evidence: 'What evidence shows my progress?', changed: 'What changed after feedback?', next: 'What will I do next?' };
  var ARTIFACT_TYPES = ['link', 'image', 'document', 'video'];
  var HTTPS_URL = /^https:\/\/[A-Za-z0-9.-]+(?::\d{1,5})?(?:[/?#][^\s<>"'`\\]*)?$/;
  var TAG = /^[\p{L}\p{N}][\p{L}\p{N} _-]{0,29}$/u;
  var DATE = /^\d{4}-\d{2}-\d{2}$/;
  var AUDIENCES = ['private', 'teacher', 'class'];
  var CONFIDENCE = ['Lost', 'Getting there', 'Got it', 'Could teach it'];
  var REVIEW_GAPS = [1, 3, 7, 14, 30]; // days until the next review after each "Got it"
  var MEDIA_TYPES = ['article', 'image', 'video', 'link'];
  var DEFAULT_WEEKLY = ['What did you try this week?', 'What shows it is working — or not yet?', 'What is your one focus for next week?'];
  var SUPPORTS = ['today', 'glossary', 'summary', 'audio', 'checklist', 'worked', 'frames', 'stretch'];
  var SUPPORT_LABELS = { today: 'One step at a time', glossary: 'Key-term help', summary: 'Source in short', audio: 'Read aloud', checklist: 'Step checklist',
    worked: 'Worked example first', frames: 'Sentence starters', stretch: 'Stretch challenge' };
  var PROFILE_LEVELS = ['Guided', 'Supported', 'Independent', 'Transfer'];
  var SUPPORT_DIMENSIONS = { today: 'LI-D01', worked: 'LI-D01', glossary: 'LI-D02', summary: 'LI-D04', audio: 'LI-D04', frames: 'LI-D07', checklist: 'LI-D08', stretch: 'LI-D06' };
  function shiftDate(ymd, days) { var d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
  function fridayOnOrBefore(ymd) { var d = new Date(ymd + 'T12:00:00Z'); return shiftDate(ymd, -((d.getUTCDay() + 2) % 7)); }
  function mondayOf(ymd) { var d = new Date(ymd + 'T12:00:00Z'); return shiftDate(ymd, -((d.getUTCDay() + 6) % 7)); }
  function answers(list, max) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list) || list.length > (max || 8)) fail('INVALID', 'Too many answers.');
    return list.map(function (a) { return str(a, 4000, 'Answer', false); });
  }
  function questions(list) {
    if (!Array.isArray(list) || !list.length || list.length > 6) fail('INVALID', 'Add one to six questions.');
    return list.map(function (q) { return str(q, 300, 'Question', true).trim(); });
  }
  var FORBIDDEN_KEYS = ['learner_id', 'student_email', 'email', 'role', 'mark', 'marks', 'raw_mark', 'grade', 'achievement', 'level', 'band',
    'deadline', 'due_date', 'criteria', 'rubric_id', 'ref', 'status', 'version', 'review', 'receipt', 'author_role'];

  function SosError(code, message, status, detail) {
    var e = new Error(message);
    e.name = 'SosError'; e.code = code; e.status = status || 400; if (detail !== undefined) e.detail = detail;
    return e;
  }
  function fail(code, message, status, detail) { throw SosError(code, message, status, detail); }
  function denied() { fail('DENIED', 'Sign in with your school account to use Student OS.', 401); }
  function forbidden(msg) { fail('FORBIDDEN', msg || 'You do not have permission for this action.', 403); }
  function notFound() { fail('NOT_FOUND', 'Not found, or not available to you.', 404); }

  function str(v, max, label, required) {
    if (v === undefined || v === null) v = '';
    if (typeof v !== 'string') fail('INVALID', label + ' must be text.');
    v = v.replace(/\r\n?/g, '\n');
    if (required && !v.trim()) fail('INVALID', label + ' is required.');
    if (v.length > max) fail('INVALID', label + ' is too long (maximum ' + max + ' characters).');
    return v;
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function rejectForbidden(args, allowed) {
    Object.keys(args || {}).forEach(function (k) {
      if (allowed.indexOf(k) < 0) {
        if (FORBIDDEN_KEYS.indexOf(k) >= 0) fail('READ_ONLY', 'The field “' + k + '” cannot be set by this request.', 403);
        fail('INVALID', 'Unknown field “' + k + '”.');
      }
    });
  }
  function artifacts(list) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list) || list.length > 10) fail('INVALID', 'Add up to 10 artifact links.');
    return list.map(function (a) {
      if (!a || typeof a !== 'object') fail('INVALID', 'Each artifact needs a label and a link.');
      var url = str(a.url, 1800, 'Artifact link', true).trim();
      if (!HTTPS_URL.test(url)) fail('INVALID', 'Artifact links must be complete https:// addresses.');
      var type = a.type || 'link';
      if (ARTIFACT_TYPES.indexOf(type) < 0) fail('INVALID', 'Unknown artifact type.');
      return { label: str(a.label, 120, 'Artifact label', false).trim() || url.replace(/^https:\/\//, '').split('/')[0], url: url, type: type };
    });
  }
  function tags(list) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list) || list.length > 10) fail('INVALID', 'Use up to 10 tags.');
    var seen = {};
    return list.map(function (t) { t = str(t, 30, 'Tag', true).trim(); if (!TAG.test(t)) fail('INVALID', 'Tags use letters, numbers, spaces, - or _.'); return t; })
      .filter(function (t) { var k = t.toLowerCase(); if (seen[k]) return false; seen[k] = true; return true; });
  }
  function prompts(p) {
    var out = {};
    if (p === undefined || p === null) return out;
    if (typeof p !== 'object' || Array.isArray(p)) fail('INVALID', 'Reflection prompts must be an object.');
    Object.keys(p).forEach(function (k) {
      if (!PROMPTS[k]) fail('INVALID', 'Unknown reflection prompt.');
      var v = str(p[k], 4000, PROMPTS[k], false);
      if (v.trim()) out[k] = v;
    });
    return out;
  }
  function checklist(list, uuid) {
    if (list === undefined || list === null) return [];
    if (!Array.isArray(list) || list.length > 30) fail('INVALID', 'Use up to 30 checklist items.');
    return list.map(function (i) {
      if (!i || typeof i !== 'object') fail('INVALID', 'Checklist items need text.');
      return { id: typeof i.id === 'string' && /^[A-Za-z0-9-]{1,64}$/.test(i.id) ? i.id : uuid(), text: str(i.text, 200, 'Checklist item', true).trim(), done: i.done === true };
    });
  }
  function dateOrNull(v, label) {
    if (v === undefined || v === null || v === '') return null;
    if (typeof v !== 'string' || !DATE.test(v)) fail('INVALID', label + ' must be a date (YYYY-MM-DD).');
    return v;
  }
  function supportList(list) {
    if (!Array.isArray(list)) fail('INVALID', 'Supports must be a list.');
    var seen = {};
    return list.map(function (s) { return str(s, 30, 'Support', true); }).filter(function (s) {
      if (SUPPORTS.indexOf(s) < 0) fail('INVALID', 'Unknown support.');
      if (seen[s]) return false; seen[s] = true; return true;
    });
  }

  /* ------------------------------------------------------------------ identity */
  /**
   * Resolve an authenticated email into a Student OS identity.
   * roster:   rows {student_email, learner_id, course_id, active, student_name} from the EXISTING Roster.
   * teachers: explicit allow-list {email: {courses:[...], label}} from Script Properties / demo config.
   * Returns null-safe errors: an unresolved identity is always DENIED.
   */
  function resolveIdentity(email, roster, teachers) {
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!email || email.indexOf('@') < 1) denied();
    var t = teachers && Object.prototype.hasOwnProperty.call(teachers, email) ? teachers[email] : null;
    var rows = (roster || []).filter(function (r) {
      return String(r.student_email || '').trim().toLowerCase() === email && (r.active === true || String(r.active).toLowerCase() === 'true');
    });
    if (t && rows.length) fail('DENIED', 'This account is configured as both teacher and student. Ask the coordinator to fix the roster.', 401);
    if (t) {
      var tc = (t.courses || []).filter(function (c) { return COURSES[c]; });
      if (!tc.length) fail('DENIED', 'This teacher account has no authorized courses.', 401);
      return { kind: 'teacher', email: email, label: t.label || 'Teacher', courses: tc, preview_key: opaqueKey(email) };
    }
    if (!rows.length) fail('DENIED', 'This account is not on an active class roster for Student OS. Nothing private was loaded.', 401);
    var ids = {};
    rows.forEach(function (r) { ids[String(r.learner_id || '')] = true; });
    var idList = Object.keys(ids);
    if (idList.length !== 1 || !idList[0]) fail('DENIED', 'Your roster record needs attention. Ask your teacher.', 401);
    var courses = [];
    rows.forEach(function (r) { var c = String(r.course_id || '').trim().replace(/^CT11$/, 'COM11'); if (COURSES[c] && courses.indexOf(c) < 0) courses.push(c); });
    if (!courses.length) denied();
    return { kind: 'student', learner_id: idList[0], display_name: String(rows[0].student_name || 'Student'), courses: courses };
  }

  /* ------------------------------------------------------------------ teacher preview ("view as student") */
  // A teacher may view the student experience as a PRACTICE student for one of their courses. Practice students
  // have no email, so no real account can ever resolve to them, and they are never a real learner.
  var PREVIEW_PREFIX = 'preview-';
  function opaqueKey(value) {
    // Stable preview namespace only. Authorization still comes from the server-resolved teacher identity.
    var a = 2166136261, b = 2246822519, s = String(value || '').toLowerCase();
    for (var i = 0; i < s.length; i++) { a ^= s.charCodeAt(i); a = Math.imul(a, 16777619); b ^= s.charCodeAt(i); b = Math.imul(b, 3266489917); }
    return ('00000000' + (a >>> 0).toString(16)).slice(-8) + ('00000000' + (b >>> 0).toString(16)).slice(-8);
  }
  function previewIdentity(teacher, course) {
    if (!teacher || teacher.kind !== 'teacher' || teacher.courses.indexOf(course) < 0) forbidden('Only a teacher can preview their own course.');
    return { kind: 'student', learner_id: PREVIEW_PREFIX + teacher.preview_key + '-' + course, display_name: 'Practice student (' + course + ')', courses: [course], preview: true };
  }
  function previewRoster(courses) {
    return courses.map(function (c) { return { student_name: 'Practice student (' + c + ')', student_email: '', learner_id: PREVIEW_PREFIX + c, course_id: c, active: true }; });
  }
  function isPractice(learnerId) { return String(learnerId || '').indexOf(PREVIEW_PREFIX) === 0; }
  function practiceCourse(learnerId) {
    if (!isPractice(learnerId)) return null;
    var course = String(learnerId).split('-').pop();
    return COURSES[course] ? course : null;
  }

  /* ------------------------------------------------------------------ service */
  function createService(deps) {
    var repo = deps.repo, A = deps.adapters, sha256 = deps.sha256, uuid = deps.uuid, now = deps.now;
    var today = deps.today || function () { return new Date().toISOString().slice(0, 10); };
    var roster = deps.roster || [];

    function isStudent(id) { if (!id) denied(); return id.kind === 'student'; }
    function requireStudent(id) { if (!isStudent(id)) forbidden('Only students can do this.'); }
    function requireTeacher(id) { if (!id) denied(); if (id.kind !== 'teacher') forbidden('Only an authorized teacher can do this.'); }
    function enrolled(learner, course) {
      if (isPractice(learner)) return practiceCourse(learner) === course;
      return roster.some(function (r) {
        return r.learner_id === learner && String(r.course_id).replace(/^CT11$/, 'COM11') === course && (r.active === true || String(r.active).toLowerCase() === 'true');
      });
    }
    function learnerLabel(learner) {
      if (isPractice(learner)) return 'Practice student (' + String(learner).split('-').pop() + ')';
      var r = roster.filter(function (x) { return x.learner_id === learner; })[0];
      return r ? String(r.student_name || learner) : learner;
    }
    function teacherOwnerKey(id) {
      requireTeacher(id);
      return sha256('student-os|teacher|' + String(id.email || '').trim().toLowerCase());
    }
    function supportKey(learner, course, scope) { return 'support-' + learner + '-' + course + '-' + scope; }
    function supportSetting(learner, course, scope) {
      return repo.get('supportsetting', supportKey(learner, course, scope)) || { id: supportKey(learner, course, scope), kind: 'supportsetting', learner_id: learner,
        course_id: course, scope: scope, teacher_supports: [], student_supports: [], version: 0, updated_at: null };
    }
    function saveSupportSetting(rec) {
      var old = repo.get('supportsetting', rec.id); rec.updated_at = now(); rec.version = old ? old.version + 1 : 1;
      if (old) repo.update('supportsetting', rec, old.version); else repo.insert('supportsetting', rec);
      return clone(rec);
    }
    function profileFor(learner, course) {
      var rows = A.profiles && A.profiles.list ? A.profiles.list(learner, [course]) : [];
      var p = rows.filter(function (x) { return x.course_id === course && (!x.learner_id || x.learner_id === learner); })[0];
      var dims = {}, raw = p && p.dimensions || {};
      for (var i = 1; i <= 8; i++) { var k = 'LI-D0' + i, v = raw[k]; dims[k] = PROFILE_LEVELS.indexOf(v) >= 0 ? v : null; }
      return { source: p && p.source || 'No connected learning profile', dimensions: dims };
    }
    function suggestedSupports(profile) {
      return SUPPORTS.filter(function (s) {
        var level = profile.dimensions[SUPPORT_DIMENSIONS[s]];
        return s === 'stretch' ? level === 'Transfer' : level === 'Guided' || level === 'Supported';
      });
    }
    function supportView(learner, course, sprint) {
      var all = supportSetting(learner, course, 'all'), scoped = supportSetting(learner, course, sprint);
      var effective = [], add = function (xs) { xs.forEach(function (x) { if (effective.indexOf(x) < 0) effective.push(x); }); };
      var connectedAll = A.supports && A.supports.preset ? supportList(A.supports.preset(learner, course, sprint, 'all')) : [];
      var connectedSprint = A.supports && A.supports.preset ? supportList(A.supports.preset(learner, course, sprint, 'sprint')) : [];
      add(connectedAll); add(connectedSprint); add(all.teacher_supports); add(scoped.teacher_supports); add(all.student_supports); add(scoped.student_supports);
      var profile = profileFor(learner, course);
      return { course_id: course, sprint_id: sprint, options: SUPPORTS.map(function (s) { return { id: s, label: SUPPORT_LABELS[s], dimension_id: SUPPORT_DIMENSIONS[s] }; }),
        profile: profile, suggested: suggestedSupports(profile), effective: effective, settings: { all: all, sprint: scoped, connected_teacher: { all: connectedAll, sprint: connectedSprint } },
        separation: 'Support and independence information only. Never achievement, a mark or a prediction input.' };
    }
    /** Owner check for any learner record. Other students' records look identical to missing ones. */
    function canAccess(id, rec, opts) {
      if (!rec) return false;
      if (id.kind === 'student') return rec.learner_id === id.learner_id && id.courses.indexOf(rec.course_id) >= 0;
      if (id.courses.indexOf(rec.course_id) < 0 || !enrolled(rec.learner_id, rec.course_id)) return false;
      // Teachers review submitted work. Never-submitted drafts stay private to the student.
      if (opts && opts.teacherNeedsSubmission) return !!rec.first_submitted_at;
      return true;
    }
    function load(id, kind, recId, opts) {
      if (typeof recId !== 'string' || !recId) notFound();
      var rec = repo.get(kind, recId);
      if (!canAccess(id, rec, opts)) notFound();
      return rec;
    }
    function audit(id, action, rec, detail) {
      repo.insert('audit', { id: uuid(), learner_id: rec.learner_id, course_id: rec.course_id, at: now(), actor: id.kind, action: action,
        target_kind: rec.kind, target_id: rec.id, detail: detail || '' , version: 1});
    }

    /* assignments -------------------------------------------------- */
    function releasedFor(courses, identity) {
      return A.assignments.listReleased(courses, identity).filter(function (a) { return courses.indexOf(a.course_id) >= 0; });
    }
    function assignmentFor(id, key, course) {
      if (key === null || key === undefined || key === '') return null;
      if (typeof key !== 'string') fail('INVALID', 'Choose an assignment from the list.');
      var a = releasedFor(id.courses, id).filter(function (x) { return x.assignment_key === key; })[0];
      if (!a) fail('INVALID', 'That assignment is not available in your courses.', 404);
      if (course && a.course_id !== course) fail('INVALID', 'The assignment belongs to a different course.');
      return a;
    }
    function refOf(a) {
      var r = clone(a.ref);
      r.assignment_key = a.assignment_key; r.title = a.title;
      r.source = (a.provenance || []).map(function (p) { return { path: p.path, sha256: p.sha256, version: p.version || null }; });
      return r;
    }
    function syncReleasedCards(id) {
      if (id.kind !== 'student' || !A.assignments.autoBoard) return;
      var released = releasedFor(id.courses, id).filter(function(a){return !a.availability||a.availability.state!=='closed'&&a.availability.required!==false;});
      repo.withLock(function () {
        var existing = repo.list('card', { learner_id: id.learner_id });
        released.forEach(function (a) {
          if (existing.some(function (c) { return c.type === 'assignment' && c.assignment_key === a.assignment_key; })) return;
          var t = now();
          var card = { id: 'release-' + sha256(id.learner_id + '|' + a.assignment_key).slice(0, 40), kind: 'card', type: 'assignment', learner_id: id.learner_id,
            course_id: a.course_id, assignment_key: a.assignment_key, ref: refOf(a), parent_id: null, title: a.title, description: '', checklist: [],
            target_date: null, column: 'plan', links: [], version: 1, created_at: t, updated_at: t,
            activity: [{ at: t, actor: 'system', action: 'Released by your teacher · added to To do' }] };
          repo.insert('card', card); existing.push(card);
        });
      });
    }

    function currentCards(id,cards) {
      var open=releasedFor(id.courses,id).filter(function(a){return !a.availability||a.availability.state!=='closed';}).map(function(a){return a.assignment_key;});
      return cards.filter(function(c){return !c.assignment_key||open.indexOf(c.assignment_key)>=0;});
    }

    /* derived state (distinct, never collapsed) ---------------------- */
    function entryState(entry, subs, comments) {
      var latest = subs.slice().sort(function (a, b) { return b.attempt - a.attempt; })[0] || null;
      var released = comments.filter(function (c) { return c.author_role === 'teacher' && c.status === 'released'; });
      return {
        draft_saved: { version: entry.version, at: entry.updated_at },
        submitted: latest ? { attempt: latest.attempt, entry_version: latest.entry_version, at: latest.submitted_at, receipt: latest.receipt, current_version_submitted: latest.entry_version === entry.version } : null,
        teacher_reviewed: latest && latest.review && latest.review.status === 'reviewed' ? { at: latest.review.at, attempt: latest.attempt } : null,
        feedback_returned: released.length ? { count: released.length, last_at: released.map(function (c) { return c.released_at; }).sort().pop() } : null,
        achievement: { recorded_here: false, note: 'Achievement is confirmed only by your teacher in the evidence system. Student OS never records it.' }
      };
    }
    function visibleComments(id, entry) {
      return repo.list('comment', { learner_id: entry.learner_id }).filter(function (c) {
        return c.entry_id === entry.id && (id.kind === 'teacher' || c.author_role === 'student' || c.status === 'released');
      }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; })
        .map(function (c) { var o = clone(c); if (id.kind === 'student' && o.author_role === 'teacher') { delete o.history; } return o; });
    }
    function entryView(id, entry) {
      var subs = repo.list('submission', { learner_id: entry.learner_id }).filter(function (s) { return s.entry_id === entry.id; });
      var comments = visibleComments(id, entry);
      var revs = repo.list('revision', { learner_id: entry.learner_id }).filter(function (r) { return r.entry_id === entry.id; })
        .sort(function (a, b) { return b.version - a.version; })
        .map(function (r) { return { version: r.version, saved_at: r.saved_at, reason: r.reason }; });
      var out = clone(entry);
      if (id.kind === 'teacher') {
        var submitted = subs.slice().sort(function(a,b){return b.attempt-a.attempt;})[0];
        if (!submitted) notFound();
        Object.keys(submitted.snapshot).forEach(function(k){out[k]=clone(submitted.snapshot[k]);});
        out.version=submitted.entry_version; out.updated_at=submitted.submitted_at; out.status='submitted';
        delete out.showcase;
        revs=revs.filter(function(r){return subs.some(function(s){return s.entry_version===r.version;});});
      }
      out.state = entryState(out, subs, comments);
      out.submissions = subs.sort(function (a, b) { return a.attempt - b.attempt; }).map(clone);
      out.comments = comments;
      out.revisions = revs;
      if (id.kind === 'teacher') out.learner_label = learnerLabel(entry.learner_id);
      return out;
    }

    function saveRevision(entry, reason) {
      repo.insert('revision', { id: entry.id + ':' + entry.version, kind: 'revision', entry_id: entry.id, learner_id: entry.learner_id, course_id: entry.course_id,
        version: entry.version, saved_at: entry.updated_at, reason: reason,
        snapshot: { title: entry.title, body: entry.body, prompts: entry.prompts, answers: entry.answers || [], tags: entry.tags, artifacts: entry.artifacts, assignment_key: entry.assignment_key } });
    }


    function shareEntry(id, args, audience, requireAssignment) {
      return repo.withLock(function () {
        var entry = load(id, 'entry', args.entry_id);
        if (requireAssignment && !entry.assignment_key) fail('INVALID', 'Link this entry to an assignment before submitting it.');
        if (entry.assignment_key) {var assigned=assignmentFor(id, entry.assignment_key, entry.course_id);if(assigned.availability&&assigned.availability.state==='closed')fail('READ_ONLY','This module is closed for submission. Your saved work remains available.',403);}
        if (!Number.isInteger(args.base_version)) fail('INVALID', 'base_version is required.');
        if (args.base_version !== entry.version) fail('CONFLICT', 'This post changed after you opened it. Review the latest version before sharing.', 409, { current: entryView(id, entry) });
        if (!entry.body.trim() && !Object.keys(entry.prompts).length && !entry.artifacts.length && !(entry.answers || []).some(function (x) { return x.trim(); }))
          fail('INVALID', 'Write something or add a link before posting.');
        var cur = entry.audience || (entry.first_submitted_at ? 'teacher' : 'private');
        var target = audience || (cur === 'class' ? 'class' : 'teacher');
        // Deterministic key: the same learner + entry + version is one submission, however often it is sent.
        var key = 'sub-' + sha256([entry.learner_id, entry.id, entry.version].join('|')).slice(0, 40);
        var existing = repo.get('submission', key);
        if (existing) {
          // Retry the original pending payload; never create a new attempt or timestamp.
          if (existing.receipt && existing.receipt.status === 'pending') {
            var retry = clone(existing);
            retry.receipt = A.evidence.submit(existing);
            retry.version = existing.version + 1;
            repo.update('submission', retry, existing.version);
            existing = retry;
          }
          if (target !== cur) { var n2 = clone(entry); n2.audience = target; repo.update('entry', n2, entry.version); entry = n2; }
          return { duplicate: true, submission: clone(existing), entry: entryView(id, entry) };
        }
        var prior = repo.list('submission', { learner_id: entry.learner_id }).filter(function (s) { return s.entry_id === entry.id; });
        var t = now();
        var sub = { id: key, kind: 'submission', learner_id: entry.learner_id, course_id: entry.course_id, entry_id: entry.id, entry_version: entry.version,
          attempt: prior.length + 1, assignment_key: entry.assignment_key, ref: clone(entry.ref), prompt: clone(entry.prompt || null), submitted_at: t,
          snapshot: { title: entry.title, body: entry.body, prompts: entry.prompts, answers: entry.answers || [], tags: entry.tags, artifacts: entry.artifacts },
          review: { status: 'not_reviewed', at: null }, receipt: null, version: 1 };
        // Only assignment-linked work goes to the evidence adapter. Blog posts and reflections stay in Student OS.
        if (entry.assignment_key) sub.receipt = A.evidence.submit(sub); // idempotent by sub.id; mock receipts say Demo
        repo.insert('submission', sub);
        var next = clone(entry);
        next.status = 'submitted'; next.audience = target; next.first_submitted_at = entry.first_submitted_at || t; next.last_submitted_at = t;
        repo.update('entry', next, entry.version, { keepVersion: true });
        audit(id, 'entry.shared', next, target + ' · attempt ' + sub.attempt + ' (version ' + sub.entry_version + ')');
        return { duplicate: false, submission: clone(sub), entry: entryView(id, next) };
      });
    }

    /* reflection prompts: default Friday reflection per course, plus teacher pushes ------------- */
    function weeklySetting(course) {
      return repo.get('setting', 'weekly:' + course) || { id: 'weekly:' + course, course_id: course, enabled: true, questions: DEFAULT_WEEKLY.slice(), version: 0 };
    }
    function weeklyTitle(course) {
      var cur = currentSprint(course);
      var named = cur && (cur.sprint || cur.upcoming);
      return named ? 'Friday reflection · Sprint ' + named.number + ' · ' + named.title : 'Friday reflection';
    }
    function promptsFor(courses, opts) {
      var d = today(), out = [];
      courses.forEach(function (c) {
        var set = weeklySetting(c), fri = fridayOnOrBefore(d), wid = 'weekly-' + c + '-' + fri;
        var stored = repo.get('prompt', wid);
        if (stored) { if (stored.status !== 'skipped' || (opts && opts.includeSkipped)) { var shown = clone(stored); if (shown.source === 'default') shown.title = weeklyTitle(c); out.push(shown); } }
        else if (set.enabled) { out.push({ id: wid, kind: 'weekly', course_id: c,
          title: weeklyTitle(c),
          questions: set.questions, opens_on: fri, closes_on: shiftDate(fri, 6), source: 'default', status: 'active', version: 0 }); }
        repo.list('prompt', null).filter(function (p) { return p.course_id === c && p.id !== wid && p.status === 'active' && p.opens_on <= d && (!p.closes_on || p.closes_on >= d); })
          .sort(function (a, b) { return a.opens_on < b.opens_on ? 1 : -1; }).forEach(function (p) { out.push(p); });
      });
      return out.map(clone);
    }
    function currentSprint(course) {
      var list = (A.calendar && A.calendar.sprints([course])) || [];
      var d = today();
      var cur = list.filter(function (s) { return s.start <= d && d <= s.end; })[0];
      var next = list.filter(function (s) { return s.start > d; }).sort(function (a, b) { return a.start < b.start ? -1 : 1; })[0];
      if (!cur) return next ? { course_id: course, upcoming: clone(next) } : null;
      var total = Math.max(1, Math.ceil((Date.parse(cur.end) - Date.parse(cur.start) + 86400000) / (7 * 86400000)));
      var week = Math.min(total, Math.floor((Date.parse(d) - Date.parse(cur.start)) / (7 * 86400000)) + 1);
      return { course_id: course, sprint: clone(cur), week: week, weeks: total, next: next ? clone(next) : null };
    }
    function thisMonday() { return mondayOf(today()); }
    function discussionOpen(d) { return d.status === 'open' && (!d.closes_on || d.closes_on >= today()); }
    function reflectionStreak(entries, course) {
      var dates = {};
      entries.filter(function (e) { return e.course_id === course && e.first_submitted_at && e.prompt && e.prompt.kind === 'weekly'; })
        .forEach(function (e) { dates[fridayOnOrBefore(e.prompt.opens_on || e.first_submitted_at.slice(0, 10))] = true; });
      var weeks = Object.keys(dates).sort().reverse(), streak = weeks.length ? 1 : 0;
      for (var i = 1; i < weeks.length && weeks[i] === shiftDate(weeks[i - 1], -7); i++) streak++;
      return streak;
    }
    function confirmedEvidence(id, course) {
      if (!A.achievements || !A.achievements.listConfirmed) return [];
      return A.achievements.listConfirmed(id.learner_id, [course]).filter(function (e) {
        return e && (!e.learner_id || e.learner_id === id.learner_id) && e.course_id === course && e.teacher_confirmed === true;
      }).map(function (e) {
        return { course_id: e.course_id, project_id: e.project_id || null, task_id: e.task_id || null, canonical_id: e.canonical_id || null,
          confirmed_at: e.confirmed_at || null, evidence_type: e.evidence_type || null, skill_ids: (e.skill_ids || []).slice(),
          camera_capture_verified: e.camera_capture_verified === true,
          outcomes: (e.outcomes || []).map(function (o) { return { outcome_id: o.outcome_id, outcome_code: o.outcome_code, title: o.title }; }) };
      });
    }
    function evidenceMatchesAssignment(e, a) {
      var ref = a.ref || {};
      return e.course_id === a.course_id && (ref.task_id ? (e.task_id === ref.task_id || e.canonical_id === ref.task_id) : e.project_id === ref.project_id);
    }

    var api = {
      /* ---------------------------------------------------------- session */
      whoami: function (id) {
        if (!id) denied();
        return { kind: id.kind, display_name: id.kind === 'student' ? id.display_name : id.label, courses: id.courses.map(function (c) { return { course_id: c, title: COURSES[c] }; }),
          demo: !!A.demo, adapters: A.labels || {}, today: today(), preview: !!id.preview };
      },

      /* ---------------------------------------------------------- home */
      home: function (id) {
        requireStudent(id);
        syncReleasedCards(id);
        var as = releasedFor(id.courses, id);
        var entries = repo.list('entry', { learner_id: id.learner_id }).filter(function (e) { return id.courses.indexOf(e.course_id) >= 0; });
        var cards = currentCards(id,repo.list('card', { learner_id: id.learner_id }).filter(function (c) { return id.courses.indexOf(c.course_id) >= 0; }));
        var views = entries.map(function (e) { return entryView(id, e); });
        var next = [];
        views.forEach(function (v) {
          if (v.state.feedback_returned && (!v.state.submitted || v.state.feedback_returned.last_at > v.state.submitted.at) && v.updated_at < v.state.feedback_returned.last_at)
            next.push({ kind: 'feedback', entry_id: v.id, title: v.title, text: 'Read your teacher’s feedback and revise.' });
          else if (v.status !== 'submitted' && v.assignment_key && as.some(function(a){return a.assignment_key===v.assignment_key&&(!a.availability||a.availability.state!=='closed'&&a.availability.required!==false);})) next.push({ kind: 'draft', entry_id: v.id, title: v.title, text: v.status === 'revising' ? 'Revised since your last submission — submit when ready.' : 'Draft saved — not submitted yet.' });
        });
        cards.filter(function (c) { return c.column !== 'complete'; }).sort(function (a, b) { return (a.target_date || '9999') < (b.target_date || '9999') ? -1 : 1; })
          .slice(0, 6).forEach(function (c) { next.push({ kind: 'card', card_id: c.id, title: c.title, column: c.column, target_date: c.target_date || null }); });
        return {
          profile: { display_name: id.display_name, courses: id.courses.map(function (c) { return { course_id: c, title: COURSES[c] }; }) },
          assignments: as.map(function (a) { return api._assignmentSummary(id, a, entries, cards); }),
          next_actions: next,
          recent_entries: views.sort(function (a, b) { return b.updated_at < a.updated_at ? -1 : 1; }).slice(0, 5).map(function (v) {
            return { id: v.id, title: v.title, course_id: v.course_id, status: v.status, audience: v.audience || (v.first_submitted_at ? 'teacher' : 'private'), updated_at: v.updated_at, assignment_title: v.ref ? v.ref.title : null, state: v.state };
          }),
          deadlines: as.filter(function (a) { return a.deadline && a.deadline.date; }).map(function (a) {
            return { assignment_key: a.assignment_key, title: a.title, course_id: a.course_id, date: a.deadline.date, label: a.deadline.label };
          }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }),
          personal_targets: cards.filter(function (c) { return c.target_date && c.column !== 'complete'; }).map(function (c) {
            return { card_id: c.id, title: c.title, date: c.target_date, course_id: c.course_id };
          }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }),
          announcements: A.announcements.list(id.courses),
          today: today(),
          sprints: id.courses.map(currentSprint).filter(Boolean),
          prompts: api.listPrompts(id, {}),
          focus: cards.filter(function (c) { return c.focus_week === thisMonday(); }).map(clone),
          board_counts: COLUMNS.reduce(function (o, k) { o[k] = cards.filter(function (c) { return c.column === k; }).length; return o; }, {}),
          feedback: api.feedbackInbox(id).slice(0, 3),
          class_feed: api.classFeed(id, {}).filter(function (x) { return !x.mine; }).slice(0, 3),
          exit_notes: id.courses.map(function (c) { var n = repo.get('exit', 'exit-' + id.learner_id + '-' + c + '-' + today()); return { course_id: c, note: n ? clone(n) : null }; }),
          review_due: api.listReview(id).filter(function (r) { return r.due; }).length,
          quiz_new: api.quizFeedback(id).filter(function (m) { return !m.review_item_id; }).length,
          discussions: api.listDiscussions(id, {}).filter(function (x) { return x.open; }).slice(0, 4),
          forms: api.listForms(id)
        };
      },
      studentDashboard: function (id) {
        requireStudent(id);
        syncReleasedCards(id);
        var entries = repo.list('entry', { learner_id: id.learner_id }).filter(function (e) { return id.courses.indexOf(e.course_id) >= 0; });
        var cards = currentCards(id,repo.list('card', { learner_id: id.learner_id }).filter(function (c) { return id.courses.indexOf(c.course_id) >= 0; }));
        var submissions = repo.list('submission', { learner_id: id.learner_id });
        var reviews = repo.list('review', { learner_id: id.learner_id });
        var comments = repo.list('comment', { learner_id: id.learner_id }).filter(function (c) { return c.author_role === 'teacher' && c.status === 'released'; });
        var reads = {}; repo.list('feedbackread', { learner_id: id.learner_id }).forEach(function (r) { reads[r.comment_id] = true; });
        var discussionComments = repo.list('dcomment', { learner_id: id.learner_id });
        return {
          generated_at: now(),
          courses: id.courses.map(function (course) {
            var as = releasedFor([course], id).filter(function(a){return !a.availability||a.availability.state!=='closed'&&a.availability.required!==false;}), courseCards = cards.filter(function (c) { return c.course_id === course; });
            var courseReviews = reviews.filter(function (r) { return r.course_id === course; });
            var streak = reflectionStreak(entries, course);
            var contributions = discussionComments.filter(function (c) { return c.course_id === course && !c.hidden; }).length;
            var courseFeedback = comments.filter(function (c) { return c.course_id === course; });
            var confirmed = confirmedEvidence(id, course), outcomeMap = {};
            confirmed.forEach(function (e) { (e.outcomes || []).forEach(function (o) {
              if (!o || !o.outcome_id) return;
              if (!outcomeMap[o.outcome_id]) outcomeMap[o.outcome_id] = { outcome_id: o.outcome_id, outcome_code: o.outcome_code, title: o.title, confirmed_count: 0, latest_at: null };
              outcomeMap[o.outcome_id].confirmed_count++;
              if (e.confirmed_at && (!outcomeMap[o.outcome_id].latest_at || e.confirmed_at > outcomeMap[o.outcome_id].latest_at)) outcomeMap[o.outcome_id].latest_at = e.confirmed_at;
            }); });
            var results = A.results && A.results.listReleased ? A.results.listReleased(id.learner_id, [course]) : [];
            results = results.filter(function (x) { return x && (!x.learner_id || x.learner_id === id.learner_id) && x.course_id === course && x.released === true; })
              .map(function (x) { return { task_id: x.task_id, title: x.title, raw_earned: x.raw_earned, raw_possible: x.raw_possible,
                approved_feedback: x.approved_feedback || '', released_at: x.released_at }; });
            var sprint = currentSprint(course), cert = null;
            if (sprint && sprint.sprint && A.certificates && A.certificates.requirements) {
              // Released Student OS cards do not prove that every required quiz, transfer, observation
              // or retry has been reviewed. A certificate needs an explicit complete-evidence manifest.
              var required = A.certificates.requirements(course, sprint.sprint.sprint_id) || [];
              var reviewed = required.filter(function (req) { return confirmed.some(function (e) {
                return e.course_id === course && (req.task_id ? (e.task_id === req.task_id || e.canonical_id === req.task_id) : e.project_id === req.project_id);
              }); });
              if (required.length) cert = { sprint_id: sprint.sprint.sprint_id, title: sprint.sprint.title, required: required.length, teacher_reviewed: reviewed.length,
                awarded: reviewed.length === required.length };
            }
            // Photo Desk licence gates reuse its registered project/checkpoint IDs and PS-CAM-01.
            // Levels are cumulative: a practical-check row cannot bypass safe handling or jobs.
            var cameraSteps = {};
            confirmed.forEach(function(e){
              if(e.project_id !== 'camera-lab-photo-desk-v1' || e.camera_capture_verified !== true || (e.skill_ids||[]).indexOf('PS-CAM-01')<0 ||
                 ['Observation','Conversation','Product'].indexOf(e.evidence_type)<0 || !(e.outcomes||[]).length) return;
              var m=/^camera-lab-photo-desk-v1:step-(\d+)$/.exec(e.canonical_id||'');
              if(m) cameraSteps[Number(m[1])] = true;
            });
            var cameraLevels = [
              {label:'Camera Licence Level 1',steps:[2]},
              {label:'Camera Licence Level 2',steps:[2,4,5,6,7,8]},
              {label:'Camera Licence Level 3',steps:[2,4,5,6,7,8,10]}
            ].filter(function(g){return g.steps.every(function(n){return cameraSteps[n]===true})}).map(function(g){
              return {outcome_id:'PS-CAM-01',outcome_code:'PS-CAM-01',title:g.label,confirmed_count:g.steps.length,latest_at:null};
            });
            return {
              course_id: course, title: COURSES[course],
              workflow: {
                assignments_total: as.length,
                assignments_done: as.filter(function (a) { return courseCards.some(function (c) { return c.assignment_key === a.assignment_key && c.column === 'complete'; }); }).length,
                due: as.filter(function (a) { return a.deadline && a.deadline.date; }).map(function (a) { return { assignment_key: a.assignment_key, title: a.title, date: a.deadline.date }; }).sort(function (a, b) { return a.date < b.date ? -1 : 1; }),
                tutorial_steps_done: courseCards.reduce(function (n, c) { return n + (c.checklist || []).filter(function (i) { return i.done; }).length; }, 0),
                self_checks: entries.filter(function (e) { return e.course_id === course && e.prompt && e.first_submitted_at; }).length,
                note: 'Workflow, support use and independence activity are learning habits. They are not achievement or a grade.'
              },
              released_results: { items: results, available: !!(A.results && A.results.listReleased), note: results.length ? 'Raw results released by your teacher. They are not an IB grade.' : 'No released results are connected for this course yet.' },
              review: { total: courseReviews.length, active: courseReviews.filter(function (r) { return !r.archived; }).length,
                due: courseReviews.filter(function (r) { return !r.archived && r.due_on <= today(); }).length,
                mastered: courseReviews.filter(function (r) { return r.stage >= REVIEW_GAPS.length; }).length },
              reflection_streak: streak,
              feedback_waiting: courseFeedback.filter(function (c) { return !reads[c.id]; }).map(function (c) { return { comment_id: c.id, entry_id: c.entry_id, released_at: c.released_at }; }),
              effort_badges: [
                { label: 'Four-week reflection streak', earned: streak >= 4, current: Math.min(streak, 4), target: 4 },
                { label: 'Review list cleared', earned: courseReviews.length > 0 && courseReviews.filter(function (r) { return !r.archived; }).length === 0, current: courseReviews.filter(function (r) { return r.archived; }).length, target: courseReviews.length || 1 },
                { label: 'Discussion contributor', earned: contributions >= 3, current: Math.min(contributions, 3), target: 3 }
              ],
              achievement: { badges: Object.keys(outcomeMap).map(function (k) { return outcomeMap[k]; }).concat(cameraLevels), certificate: cert,
                note: 'Achievement appears only from teacher-confirmed evidence joined to an existing Evidence Map outcome. Student OS activity cannot award it.' }
            };
          })
        };
      },
      studentSupports: function (id, args) {
        requireStudent(id); rejectForbidden(args || {}, ['course_id', 'sprint_id']);
        var course = args && args.course_id || id.courses[0], sprint = args && args.sprint_id || 'ibds-26-s04';
        if (id.courses.indexOf(course) < 0) forbidden('That course is not on your roster.');
        return supportView(id.learner_id, course, sprint);
      },
      setStudentSupports: function (id, args) {
        requireStudent(id); rejectForbidden(args, ['course_id', 'sprint_id', 'supports']);
        var course = args.course_id, sprint = args.sprint_id || 'ibds-26-s04';
        if (id.courses.indexOf(course) < 0) forbidden('That course is not on your roster.');
        return repo.withLock(function () {
          var rec = supportSetting(id.learner_id, course, sprint); rec.student_supports = supportList(args.supports);
          saveSupportSetting(rec);
          rec.kind = 'supportsetting'; audit(id, 'support.preferences', rec, 'stream=support; student opt-in; ' + rec.student_supports.join(','));
          return supportView(id.learner_id, course, sprint);
        });
      },
      logSupportUse: function (id, args) {
        requireStudent(id); rejectForbidden(args, ['course_id', 'sprint_id', 'lesson_id', 'support_id', 'action']);
        var course = args.course_id, support = str(args.support_id, 30, 'Support', true);
        if (id.courses.indexOf(course) < 0 || SUPPORTS.indexOf(support) < 0) forbidden('That support is not available.');
        return repo.withLock(function () {
          var rec = { id: uuid(), kind: 'supportevent', stream: 'support', learner_id: id.learner_id, course_id: course, sprint_id: str(args.sprint_id || '', 80, 'Sprint', false),
            lesson_id: str(args.lesson_id || '', 80, 'Lesson', false), support_id: support, action: str(args.action || 'used', 80, 'Action', true), at: now(),
            achievement: false, prediction_eligible: false, version: 1 };
          repo.insert('supportevent', rec); return { recorded: true, stream: 'support', achievement: false };
        });
      },
      teacherAdaptations: function (id, args) {
        requireTeacher(id); rejectForbidden(args || {}, ['course_id', 'sprint_id']);
        var course = args && args.course_id || 'IBDS', sprint = args && args.sprint_id || 'ibds-26-s04';
        if (id.courses.indexOf(course) < 0) forbidden('That course is not assigned to you.');
        var learners = {}, rows = [];
        roster.forEach(function (r) { if (!isPractice(r.learner_id) && String(r.course_id).replace(/^CT11$/, 'COM11') === course && (r.active === true || String(r.active).toLowerCase() === 'true')) learners[r.learner_id] = String(r.student_name || r.learner_id); });
        Object.keys(learners).forEach(function (lid) { var v = supportView(lid, course, sprint); rows.push({ learner_id: lid, learner_label: learners[lid], profile: v.profile,
          suggested: v.suggested, effective: v.effective, settings: v.settings }); });
        return { course_id: course, sprint_id: sprint, options: supportView('preview-' + course, course, sprint).options, learners: rows,
          note: 'Suggestions come from LI-D01–D08. The teacher decides; support use remains separate from achievement.' };
      },
      setTeacherSupports: function (id, args) {
        requireTeacher(id); rejectForbidden(args, ['learner_id', 'course_id', 'sprint_id', 'scope', 'supports']);
        var course = args.course_id, sprint = str(args.sprint_id || '', 80, 'Sprint', args.scope !== 'all'), scope = args.scope === 'all' ? 'all' : sprint;
        if (id.courses.indexOf(course) < 0 || !enrolled(args.learner_id, course)) forbidden('That learner is not in this course.');
        return repo.withLock(function () {
          var rec = supportSetting(args.learner_id, course, scope); rec.teacher_supports = supportList(args.supports);
          saveSupportSetting(rec); rec.kind = 'supportsetting'; audit(id, 'support.assigned', rec, 'stream=support; scope=' + scope + '; ' + rec.teacher_supports.join(','));
          return supportView(args.learner_id, course, sprint);
        });
      },
      createCustomVersionDraft: function (id, args) {
        requireTeacher(id); rejectForbidden(args, ['learner_id', 'course_id', 'sprint_id', 'note']);
        if (id.courses.indexOf(args.course_id) < 0 || !enrolled(args.learner_id, args.course_id)) forbidden('That learner is not in this course.');
        return repo.withLock(function () {
          var rec = { id: uuid(), kind: 'customversion', learner_id: args.learner_id, course_id: args.course_id, sprint_id: str(args.sprint_id, 80, 'Sprint', true),
            note: str(args.note, 2000, 'Custom version note', true), status: 'pending_approval', created_at: now(), created_by_key: teacherOwnerKey(id), created_by_label: id.label,
            locks: { question_text: true, question_ids: true, assessed_tasks: true, task_ids: true }, release_state: 'draft_only', version: 1 };
          repo.insert('customversion', rec); return clone(rec);
        });
      },
      readFeedback: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['comment_id']);
        var c = repo.get('comment', args.comment_id);
        if (!c || c.learner_id !== id.learner_id || id.courses.indexOf(c.course_id) < 0 || c.author_role !== 'teacher' || c.status !== 'released') notFound();
        return repo.withLock(function () {
          var key = 'feedback-read-' + id.learner_id + '-' + c.id, old = repo.get('feedbackread', key);
          if (old) return clone(old);
          var rec = { id: key, kind: 'feedbackread', learner_id: id.learner_id, course_id: c.course_id, comment_id: c.id, read_at: now(), version: 1 };
          repo.insert('feedbackread', rec); return clone(rec);
        });
      },
      _assignmentSummary: function (id, a, entries, cards) {
        var mine = entries.filter(function (e) { return e.assignment_key === a.assignment_key; });
        return { assignment_key: a.assignment_key, course_id: a.course_id, title: a.title, deadline: a.deadline, release: a.release, availability: a.availability||null,
          entries: mine.length, submitted: mine.filter(function (e) { return !!e.first_submitted_at; }).length,
          cards: cards.filter(function (c) { return c.assignment_key === a.assignment_key; }).length };
      },

      /* ---------------------------------------------------------- assignments */
      listAssignments: function (id) {
        if (!id) denied();
        return releasedFor(id.courses, id).map(function (a) { return { assignment_key: a.assignment_key, course_id: a.course_id, title: a.title, deadline: a.deadline, release: a.release, availability: a.availability||null }; });
      },
      getAssignment: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['assignment_key']);
        var a = clone(assignmentFor(id, args.assignment_key));
        if (id.kind === 'student') {
          a.my_entries = repo.list('entry', { learner_id: id.learner_id }).filter(function (e) { return e.assignment_key === a.assignment_key; })
            .map(function (e) { var v = entryView(id, e); return { id: v.id, title: v.title, status: v.status, updated_at: v.updated_at, state: v.state }; });
          a.my_cards = repo.list('card', { learner_id: id.learner_id }).filter(function (c) { return c.assignment_key === a.assignment_key; })
            .map(function (c) { return { id: c.id, title: c.title, type: c.type, column: c.column, target_date: c.target_date }; });
        }
        a.receipt_note = A.evidence.demo ? 'Receipts shown in Student OS are Demo receipts. This pilot does not read the Google Form submission status.' : A.evidence.label;
        return a;
      },

      /* ---------------------------------------------------------- journal */
      listEntries: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['course_id']);
        var course = args && args.course_id;
        return repo.list('entry', { learner_id: id.learner_id }).filter(function (e) { return id.courses.indexOf(e.course_id) >= 0 && (!course || e.course_id === course); })
          .sort(function (a, b) { return b.created_at < a.created_at ? -1 : 1; })
          .map(function (e) { var v = entryView(id, e); delete v.revisions; return v; });
      },
      getEntry: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['entry_id']);
        return entryView(id, load(id, 'entry', args.entry_id, { teacherNeedsSubmission: true }));
      },
      getRevision: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['entry_id', 'version']);
        var entry = load(id, 'entry', args.entry_id, { teacherNeedsSubmission: true });
        var r = repo.get('revision', entry.id + ':' + Number(args.version));
        if (!r || r.learner_id !== entry.learner_id) notFound();
        if (id.kind === 'teacher' && !repo.list('submission',{learner_id:entry.learner_id}).some(function(s){return s.entry_id===entry.id && s.entry_version===r.version;})) notFound();
        return clone(r);
      },
      createEntry: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['title', 'body', 'tags', 'artifacts', 'prompts', 'answers', 'course_id', 'assignment_key', 'prompt_id', 'showcase', 'client_request_id']);
        var course = str(args.course_id, 10, 'Course', true);
        if (id.courses.indexOf(course) < 0) fail('INVALID', 'Choose one of your courses.', 403);
        var a = assignmentFor(id, args.assignment_key, course);
        var pr = null;
        if (args.prompt_id) {
          pr = promptsFor([course]).filter(function (p) { return p.id === args.prompt_id; })[0];
          if (!pr) fail('INVALID', 'That reflection prompt is not open in this course.', 404);
        }
        return repo.withLock(function () {
          // A retried create (same client_request_id) returns the first entry instead of a duplicate.
          if (args.client_request_id) {
            var crid = str(args.client_request_id, 64, 'Request id', true);
            var prior = repo.list('entry', { learner_id: id.learner_id }).filter(function (e) { return e.client_request_id === crid; })[0];
            if (prior) return entryView(id, prior);
          }
          var t = now();
          var entry = { id: uuid(), kind: 'entry', learner_id: id.learner_id, course_id: course, assignment_key: a ? a.assignment_key : null, ref: a ? refOf(a) : null,
            title: str(args.title, 200, 'Title', true).trim(), body: str(args.body, 20000, 'Entry', false), tags: tags(args.tags), artifacts: artifacts(args.artifacts),
            prompts: prompts(args.prompts), showcase: args.showcase === true, status: 'draft', version: 1, created_at: t, updated_at: t, first_submitted_at: null,
            audience: 'private', class_hidden: false, answers: answers(args.answers, pr ? pr.questions.length : 8),
            prompt: pr ? { id: pr.id, kind: pr.kind, title: pr.title, questions: pr.questions, opens_on: pr.opens_on } : null,
            client_request_id: args.client_request_id || null };
          repo.insert('entry', entry);
          saveRevision(entry, 'created');
          audit(id, 'entry.created', entry);
          return entryView(id, entry);
        });
      },
      updateEntry: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['entry_id', 'base_version', 'title', 'body', 'tags', 'artifacts', 'prompts', 'answers', 'assignment_key', 'showcase']);
        return repo.withLock(function () {
          var entry = load(id, 'entry', args.entry_id);
          if (!Number.isInteger(args.base_version)) fail('INVALID', 'base_version is required.');
          if (args.base_version !== entry.version) fail('CONFLICT', 'This entry was changed somewhere else. Nothing was overwritten.', 409, { current: entryView(id, entry) });
          var next = clone(entry);
          if ('title' in args) next.title = str(args.title, 200, 'Title', true).trim();
          if ('body' in args) next.body = str(args.body, 20000, 'Entry', false);
          if ('tags' in args) next.tags = tags(args.tags);
          if ('artifacts' in args) next.artifacts = artifacts(args.artifacts);
          if ('prompts' in args) next.prompts = prompts(args.prompts);
          if ('showcase' in args) next.showcase = args.showcase === true;
          if ('answers' in args) next.answers = answers(args.answers, entry.prompt ? entry.prompt.questions.length : 8);
          if ('assignment_key' in args) {
            var a = args.assignment_key===entry.assignment_key ? {assignment_key:entry.assignment_key,ref:entry.ref} : assignmentFor(id, args.assignment_key, entry.course_id);
            if (entry.first_submitted_at && (a ? a.assignment_key : null) !== (entry.assignment_key || null)) fail('READ_ONLY', 'A shared post stays linked to what it was shared for.', 403);
            next.assignment_key = a ? a.assignment_key : null; next.ref = a ? (args.assignment_key===entry.assignment_key?clone(entry.ref):refOf(a)) : null;
          }
          var changed = ['title', 'body', 'tags', 'artifacts', 'prompts', 'answers', 'showcase', 'assignment_key'].some(function (k) { return JSON.stringify(next[k]) !== JSON.stringify(entry[k]); });
          if (!changed) return entryView(id, entry);
          next.version = entry.version + 1; next.updated_at = now();
          if (entry.status === 'submitted') next.status = 'revising';
          repo.update('entry', next, entry.version);
          saveRevision(next, entry.status === 'submitted' ? 'revised after submission' : 'saved');
          audit(id, 'entry.saved', next, 'version ' + next.version);
          return entryView(id, next);
        });
      },
      /** Share the current saved version with the teacher (and optionally the class). Assignment-linked posts also go
       *  through the evidence adapter (Demo receipts in the pilot). The same version is one submission however often it is sent. */
      publishEntry: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['entry_id', 'base_version', 'audience']);
        if (['teacher', 'class'].indexOf(args.audience) < 0) fail('INVALID', 'Choose who can see this post: your teacher, or your teacher and class.');
        if (id.preview && args.audience === 'class') forbidden('Practice posts stay in the teacher workspace and cannot enter a real class feed.');
        return shareEntry(id, args, args.audience, false);
      },
      /** Backward-compatible assignment submission (shares with the teacher; keeps class sharing if already on). */
      submitEntry: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['entry_id', 'base_version']);
        return shareEntry(id, args, null, true);
      },
      /** Change who can see an already-shared post. Once the teacher has it, it stays with the teacher. */
      setAudience: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['entry_id', 'audience']);
        if (AUDIENCES.indexOf(args.audience) < 0) fail('INVALID', 'Unknown audience.');
        return repo.withLock(function () {
          var entry = load(id, 'entry', args.entry_id);
          var cur = entry.audience || (entry.first_submitted_at ? 'teacher' : 'private');
          if (args.audience === cur) return entryView(id, entry);
          if (id.preview && args.audience === 'class') forbidden('Practice posts stay in the teacher workspace and cannot enter a real class feed.');
          if (args.audience === 'private' && entry.first_submitted_at) fail('READ_ONLY', 'Posts you have shared stay visible to your teacher. You can still take a post off the class feed.', 403);
          if (args.audience !== 'private' && !entry.first_submitted_at) fail('INVALID', 'Post it first — sharing always uses a saved version.');
          var next = clone(entry); next.audience = args.audience;
          repo.update('entry', next, entry.version);
          audit(id, 'entry.audience', next, cur + '→' + args.audience);
          return entryView(id, next);
        });
      },

      /* ---------------------------------------------------------- comments */
      addReply: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['entry_id', 'parent_id', 'body']);
        return repo.withLock(function () {
          var entry = load(id, 'entry', args.entry_id);
          var parent = args.parent_id ? repo.get('comment', args.parent_id) : null;
          if (args.parent_id && (!parent || parent.entry_id !== entry.id || parent.author_role !== 'teacher' || parent.status !== 'released')) notFound();
          var t = now();
          var c = { id: uuid(), kind: 'comment', entry_id: entry.id, learner_id: entry.learner_id, course_id: entry.course_id, author_role: 'student', author_label: id.display_name,
            parent_id: parent ? parent.id : null, submission_id: null, body: str(args.body, 4000, 'Reply', true), status: 'posted', version: 1, history: [], created_at: t, updated_at: t, released_at: null };
          repo.insert('comment', c); audit(id, 'reply.posted', entry);
          return clone(c);
        });
      },
      editComment: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['comment_id', 'base_version', 'body']);
        return repo.withLock(function () {
          var c = repo.get('comment', args.comment_id);
          if (!c || !canAccess(id, c)) notFound();
          if (id.kind === 'student' && c.author_role !== 'student') notFound();
          if (id.kind === 'teacher' && c.author_role !== 'teacher') forbidden('Teachers cannot edit student replies.');
          if (id.kind === 'teacher' && c.author_key !== teacherOwnerKey(id)) forbidden('Only the teacher who wrote this feedback can edit it.');
          if (args.base_version !== c.version) fail('CONFLICT', 'This comment changed somewhere else. Nothing was overwritten.', 409, { current: clone(c) });
          var next = clone(c);
          next.history = (c.history || []).concat([{ body: c.body, edited_at: c.updated_at, version: c.version }]);
          next.body = str(args.body, 4000, 'Comment', true); next.version = c.version + 1; next.updated_at = now();
          repo.update('comment', next, c.version);
          return clone(next);
        });
      },

      /* ---------------------------------------------------------- board */
      listCards: function (id) {
        requireStudent(id);
        syncReleasedCards(id);
        return repo.list('card', { learner_id: id.learner_id }).filter(function (c) { return id.courses.indexOf(c.course_id) >= 0; })
          .sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; }).map(function(c){var out=clone(c);var active=currentCards(id,[c]).length>0;out.module_paused=!!c.assignment_key&&!active;return out;});
      },
      addAssignmentCard: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['assignment_key']);
        var a = assignmentFor(id, args.assignment_key);
        return repo.withLock(function () {
          var existing = repo.list('card', { learner_id: id.learner_id }).filter(function (c) { return c.type === 'assignment' && c.assignment_key === a.assignment_key; })[0];
          if (existing) return clone(existing);
          var t = now();
          var card = { id: uuid(), kind: 'card', type: 'assignment', learner_id: id.learner_id, course_id: a.course_id, assignment_key: a.assignment_key, ref: refOf(a), parent_id: null,
            title: a.title, description: '', checklist: [], target_date: null, column: 'plan', links: [], version: 1, created_at: t, updated_at: t,
            activity: [{ at: t, actor: 'student', action: 'Added the assignment to my board' }] };
          repo.insert('card', card); audit(id, 'card.created', card);
          return clone(card);
        });
      },
      createCard: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['parent_id', 'title', 'description', 'checklist', 'target_date', 'column', 'client_request_id']);
        return repo.withLock(function () {
          var parent = load(id, 'card', args.parent_id);
          if (parent.type !== 'assignment') fail('INVALID', 'Subtasks belong under an assignment card.');
          if (args.client_request_id) {
            var prior = repo.list('card', { learner_id: id.learner_id }).filter(function (c) { return c.client_request_id === args.client_request_id; })[0];
            if (prior) return clone(prior);
          }
          var col = args.column || 'plan';
          if (COLUMNS.indexOf(col) < 0) fail('INVALID', 'Unknown column.');
          var t = now();
          var card = { id: uuid(), kind: 'card', type: 'subtask', learner_id: id.learner_id, course_id: parent.course_id, assignment_key: parent.assignment_key, ref: clone(parent.ref), parent_id: parent.id,
            title: str(args.title, 200, 'Card title', true).trim(), description: str(args.description, 4000, 'Description', false), checklist: checklist(args.checklist, uuid),
            target_date: dateOrNull(args.target_date, 'Personal target date'), column: col, links: [], version: 1, created_at: t, updated_at: t,
            client_request_id: args.client_request_id ? str(args.client_request_id, 64, 'Request id', true) : null,
            activity: [{ at: t, actor: 'student', action: 'Created subtask in ' + COLUMN_LABELS[col] }] };
          repo.insert('card', card); audit(id, 'card.created', card);
          return clone(card);
        });
      },
      updateCard: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['card_id', 'base_version', 'title', 'description', 'checklist', 'target_date', 'links', 'focus']);
        return repo.withLock(function () {
          var card = load(id, 'card', args.card_id);
          if (args.base_version !== card.version) fail('CONFLICT', 'This card changed somewhere else. Nothing was overwritten.', 409, { current: clone(card) });
          if (card.type === 'assignment' && ('title' in args)) fail('READ_ONLY', 'The assignment title comes from your teacher and cannot be changed.', 403);
          var next = clone(card), what = [];
          if ('title' in args) { next.title = str(args.title, 200, 'Card title', true).trim(); what.push('title'); }
          if ('description' in args) { next.description = str(args.description, 4000, 'Description', false); what.push('description'); }
          if ('checklist' in args) { next.checklist = checklist(args.checklist, uuid); what.push('checklist'); }
          if ('target_date' in args) { next.target_date = dateOrNull(args.target_date, 'Personal target date'); what.push('personal target date'); }
          if ('focus' in args) {
            var wk = thisMonday();
            if (args.focus === true && card.focus_week !== wk && repo.list('card', { learner_id: id.learner_id }).filter(function (c) { return c.focus_week === wk && c.id !== card.id; }).length >= 3)
              fail('INVALID', 'Pick up to three focus cards for this week. Unpin one first.');
            next.focus_week = args.focus === true ? wk : null; what.push(args.focus ? 'pinned as this week’s focus' : 'unpinned from this week’s focus');
          }
          if ('links' in args) {
            if (!Array.isArray(args.links) || args.links.length > 20) fail('INVALID', 'Use up to 20 links.');
            next.links = args.links.map(function (l) {
              if (l && l.kind === 'entry') { var e = load(id, 'entry', l.entry_id); if (e.course_id !== card.course_id) fail('INVALID', 'Link entries from the same course.'); return { kind: 'entry', entry_id: e.id, title: e.title }; }
              if (l && l.kind === 'url') { var a = artifacts([{ url: l.url, label: l.label }])[0]; return { kind: 'url', url: a.url, label: a.label }; }
              fail('INVALID', 'Unknown link.');
            });
            what.push('links');
          }
          next.version = card.version + 1; next.updated_at = now();
          next.activity = card.activity.concat([{ at: next.updated_at, actor: 'student', action: 'Edited ' + (what.join(', ') || 'nothing') }]);
          repo.update('card', next, card.version);
          return clone(next);
        });
      },
      moveCard: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['card_id', 'base_version', 'to']);
        return repo.withLock(function () {
          var card = load(id, 'card', args.card_id);
          if (COLUMNS.indexOf(args.to) < 0) fail('INVALID', 'Unknown column.');
          if (args.base_version !== card.version) fail('CONFLICT', 'This card moved somewhere else. Reload the board.', 409, { current: clone(card) });
          if (card.column === args.to) return clone(card);
          var next = clone(card), t = now();
          next.column = args.to; next.version = card.version + 1; next.updated_at = t;
          next.activity = card.activity.concat([{ at: t, actor: 'student', action: 'Moved from ' + COLUMN_LABELS[card.column] + ' to ' + COLUMN_LABELS[args.to] +
            (args.to === 'complete' ? ' (student-reported; not teacher approval)' : '') }]);
          repo.update('card', next, card.version);
          audit(id, 'card.moved', next, card.column + '→' + args.to);
          return clone(next);
        });
      },

      /* ---------------------------------------------------------- class feed */
      /** Posts classmates chose to share with the class. Shows the shared version only — never drafts, feedback or receipts. */
      classFeed: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['course_id']);
        var courses = args && args.course_id ? [args.course_id] : id.courses;
        if (courses.some(function (c) { return id.courses.indexOf(c) < 0; })) forbidden('That course is not one of yours.');
        var names = {};
        roster.forEach(function (r) { names[r.learner_id] = String(r.student_name || 'Classmate'); });
        var entries = repo.list('entry', null).filter(function (e) {
          return !isPractice(e.learner_id) && e.audience === 'class' && courses.indexOf(e.course_id) >= 0 && enrolled(e.learner_id, e.course_id) && (id.kind === 'teacher' || !e.class_hidden || e.learner_id === id.learner_id);
        });
        return entries.map(function (e) {
          var sub = repo.list('submission', { learner_id: e.learner_id }).filter(function (x) { return x.entry_id === e.id; }).sort(function (a, b) { return b.attempt - a.attempt; })[0];
          if (!sub) return null;
          return { entry_id: e.id, course_id: e.course_id, author: names[e.learner_id] || 'Classmate', mine: id.kind === 'student' && e.learner_id === id.learner_id,
            title: sub.snapshot.title, body: sub.snapshot.body, answers: sub.snapshot.answers || [], questions: sub.prompt ? sub.prompt.questions : [], prompt_title: sub.prompt ? sub.prompt.title : null,
            artifacts: sub.snapshot.artifacts, tags: sub.snapshot.tags, shared_at: sub.submitted_at, hidden: !!e.class_hidden };
        }).filter(Boolean).sort(function (a, b) { return a.shared_at < b.shared_at ? 1 : -1; });
      },
      setClassHidden: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['entry_id', 'hidden']);
        return repo.withLock(function () {
          var e = repo.get('entry', args.entry_id);
          if (!e || e.audience !== 'class' || !canAccess(id, e, { teacherNeedsSubmission: true })) notFound();
          var next = clone(e); next.class_hidden = args.hidden === true;
          repo.update('entry', next, e.version);
          audit(id, next.class_hidden ? 'class.hidden' : 'class.shown', next);
          return { entry_id: e.id, hidden: next.class_hidden };
        });
      },

      /* ---------------------------------------------------------- reflection prompts */
      listPrompts: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['course_id']);
        var courses = args && args.course_id ? [args.course_id] : id.courses;
        if (courses.some(function (c) { return id.courses.indexOf(c) < 0; })) forbidden('That course is not one of yours.');
        var mine = repo.list('entry', { learner_id: id.learner_id });
        return promptsFor(courses).map(function (p) {
          var e = mine.filter(function (x) { return x.prompt && x.prompt.id === p.id; })[0];
          p.response = e ? { entry_id: e.id, shared: !!e.first_submitted_at, audience: e.audience || 'private', updated_at: e.updated_at } : null;
          return p;
        });
      },
      teacherPrompts: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['course_id']);
        var course = args && args.course_id;
        if (!course || id.courses.indexOf(course) < 0) forbidden('That course is not assigned to you.');
        var learners = roster.filter(function (r) { return !isPractice(r.learner_id) && String(r.course_id).replace(/^CT11$/, 'COM11') === course && (r.active === true || String(r.active).toLowerCase() === 'true'); });
        var entries = repo.list('entry', null).filter(function (e) { return e.course_id === course && e.prompt && e.first_submitted_at; });
        var list = promptsFor([course], { includeSkipped: true });
        repo.list('prompt', null).filter(function (p) { return p.course_id === course && list.every(function (x) { return x.id !== p.id; }); })
          .sort(function (a, b) { return a.opens_on < b.opens_on ? 1 : -1; }).slice(0, 8).forEach(function (p) { list.push(clone(p)); });
        return { setting: clone(weeklySetting(course)), today: today(), learners: learners.length, prompts: list.map(function (p) {
          var rs = entries.filter(function (e) { return e.prompt.id === p.id; });
          p.responses = rs.map(function (e) { return { entry_id: e.id, learner_label: learnerLabel(e.learner_id), audience: e.audience, shared_at: e.last_submitted_at }; });
          p.open = p.status === 'active' && p.opens_on <= today() && (!p.closes_on || p.closes_on >= today());
          return p;
        }) };
      },
      /** Push a reflection now or on a date. A weekly prompt for a Friday replaces that week's default questions. */
      createPrompt: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['course_id', 'kind', 'title', 'questions', 'opens_on', 'closes_on']);
        if (id.courses.indexOf(args.course_id) < 0) forbidden('That course is not assigned to you.');
        var kind = ['weekly', 'sprint', 'custom'].indexOf(args.kind) >= 0 ? args.kind : 'custom';
        var opens = dateOrNull(args.opens_on, 'Opens on') || today();
        var closes = dateOrNull(args.closes_on, 'Closes on');
        if (closes && closes < opens) fail('INVALID', 'The closing date is before the opening date.');
        return repo.withLock(function () {
          var pid = kind === 'weekly' ? 'weekly-' + args.course_id + '-' + fridayOnOrBefore(opens) : uuid();
          var prev = repo.get('prompt', pid);
          var rec = { id: pid, kind: kind, course_id: args.course_id, learner_id: '', title: str(args.title, 120, 'Title', true).trim(), questions: questions(args.questions),
            opens_on: kind === 'weekly' ? fridayOnOrBefore(opens) : opens, closes_on: closes || (kind === 'weekly' ? shiftDate(fridayOnOrBefore(opens), 6) : null),
            source: 'teacher', status: 'active', created_by: id.label, created_at: now(), version: prev ? prev.version + 1 : 1 };
          if (prev) repo.update('prompt', rec, prev.version); else repo.insert('prompt', rec);
          return clone(rec);
        });
      },
      skipWeekly: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['course_id', 'friday', 'skip']);
        if (id.courses.indexOf(args.course_id) < 0) forbidden('That course is not assigned to you.');
        var fri = fridayOnOrBefore(dateOrNull(args.friday, 'Week') || today());
        return repo.withLock(function () {
          var pid = 'weekly-' + args.course_id + '-' + fri, prev = repo.get('prompt', pid), set = weeklySetting(args.course_id);
          var rec = prev ? clone(prev) : { id: pid, kind: 'weekly', course_id: args.course_id, learner_id: '', title: 'Friday reflection', questions: set.questions, opens_on: fri, closes_on: shiftDate(fri, 6), source: 'default', created_at: now(), version: 0 };
          rec.status = args.skip === false ? 'active' : 'skipped'; rec.version = (prev ? prev.version : 0) + 1;
          if (prev) repo.update('prompt', rec, prev.version); else repo.insert('prompt', rec);
          return clone(rec);
        });
      },
      setWeeklyDefault: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['course_id', 'enabled', 'questions']);
        if (id.courses.indexOf(args.course_id) < 0) forbidden('That course is not assigned to you.');
        return repo.withLock(function () {
          var prev = repo.get('setting', 'weekly:' + args.course_id);
          var rec = { id: 'weekly:' + args.course_id, kind: 'setting', course_id: args.course_id, learner_id: '', enabled: args.enabled !== false,
            questions: args.questions ? questions(args.questions) : weeklySetting(args.course_id).questions, updated_at: now(), version: prev ? prev.version + 1 : 1 };
          if (prev) repo.update('setting', rec, prev.version); else repo.insert('setting', rec);
          return clone(rec);
        });
      },

      /* ---------------------------------------------------------- feedback inbox */
      feedbackInbox: function (id) {
        requireStudent(id);
        var mine = repo.list('entry', { learner_id: id.learner_id });
        var reads = {}; repo.list('feedbackread', { learner_id: id.learner_id }).forEach(function (r) { reads[r.comment_id] = true; });
        return repo.list('comment', { learner_id: id.learner_id }).filter(function (c) { return c.author_role === 'teacher' && c.status === 'released'; })
          .map(function (c) {
            var e = mine.filter(function (x) { return x.id === c.entry_id; })[0];
            return { comment_id: c.id, entry_id: c.entry_id, entry_title: e ? e.title : '', body: c.body, from: c.author_label, released_at: c.released_at,
              read: !!reads[c.id], acted_on: !!(e && e.last_submitted_at && e.last_submitted_at > c.released_at) };
          }).sort(function (a, b) { return a.released_at < b.released_at ? 1 : -1; });
      },

      /* ---------------------------------------------------------- forms and quizzes for my courses only */
      listForms: function (id) {
        if (!id) denied();
        var forms = releasedFor(id.courses, id).filter(function (a) { return a.submission && a.submission.url; }).map(function (a) {
          return { kind: 'form', course_id: a.course_id, assignment_key: a.assignment_key, title: a.submission.title || a.title + ' · knowledge and reflection form', url: a.submission.url, state: a.submission.state || null };
        });
        var quizzes = (A.assignments.listQuizzes ? A.assignments.listQuizzes(id.courses) : []).filter(function (q) { return id.courses.indexOf(q.course_id) >= 0; })
          .map(function (q) { return { kind: 'quiz', course_id: q.course_id, title: q.title, date: q.date, reading: q.reading, url: null, delivery: q.delivery }; });
        return forms.concat(quizzes);
      },

      /* ---------------------------------------------------------- exit notes (end of class) */
      /** One note per student, course and day. Goes to the teacher. Editable until the end of the day. */
      saveExitNote: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['course_id', 'clicked', 'fuzzy', 'confidence', 'base_version']);
        if (id.courses.indexOf(args.course_id) < 0) forbidden('Choose one of your courses.');
        var conf = args.confidence === undefined || args.confidence === null ? null : Number(args.confidence);
        if (conf !== null && !(Number.isInteger(conf) && conf >= 1 && conf <= 4)) fail('INVALID', 'Choose how confident you feel.');
        var clicked = str(args.clicked, 1000, 'What clicked', false).trim(), fuzzy = str(args.fuzzy, 1000, 'What is still fuzzy', false).trim();
        if (!clicked && !fuzzy && conf === null) fail('INVALID', 'Write a few words or choose how confident you feel.');
        return repo.withLock(function () {
          var d = today(), key = 'exit-' + id.learner_id + '-' + args.course_id + '-' + d, prev = repo.get('exit', key), t = now();
          if (prev && args.base_version !== prev.version) fail('CONFLICT', 'You already updated this note somewhere else.', 409, { current: clone(prev) });
          var rec = { id: key, kind: 'exit', learner_id: id.learner_id, course_id: args.course_id, date: d, clicked: clicked, fuzzy: fuzzy, confidence: conf,
            created_at: prev ? prev.created_at : t, updated_at: t, version: prev ? prev.version + 1 : 1 };
          if (prev) repo.update('exit', rec, prev.version); else repo.insert('exit', rec);
          return clone(rec);
        });
      },
      myExitNotes: function (id) {
        requireStudent(id);
        return repo.list('exit', { learner_id: id.learner_id }).filter(function (x) { return id.courses.indexOf(x.course_id) >= 0; })
          .sort(function (a, b) { return a.date < b.date ? 1 : -1; }).map(clone);
      },
      teacherExitNotes: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['course_id', 'date']);
        if (!args.course_id || id.courses.indexOf(args.course_id) < 0) forbidden('That course is not assigned to you.');
        var d = dateOrNull(args.date, 'Date') || today();
        var notes = repo.list('exit', null).filter(function (x) { return x.course_id === args.course_id && x.date === d && enrolled(x.learner_id, x.course_id); });
        var active = roster.filter(function (r) { return !isPractice(r.learner_id) && String(r.course_id).replace(/^CT11$/, 'COM11') === args.course_id && (r.active === true || String(r.active).toLowerCase() === 'true'); }).length;
        var dates = {}; repo.list('exit', null).forEach(function (x) { if (x.course_id === args.course_id) dates[x.date] = true; });
        return { date: d, learners: active, dates: Object.keys(dates).sort().reverse().slice(0, 20),
          confidence: CONFIDENCE.map(function (label, i) { return { level: i + 1, label: label, count: notes.filter(function (n) { return n.confidence === i + 1; }).length }; }),
          notes: notes.map(function (n) { return { learner_label: learnerLabel(n.learner_id), clicked: n.clicked, fuzzy: n.fuzzy, confidence: n.confidence, updated_at: n.updated_at }; })
            .sort(function (a, b) { return (a.confidence || 9) - (b.confidence || 9); }) };
      },

      /* ---------------------------------------------------------- review list ("things I got wrong") */
      quizFeedback: function (id) {
        requireStudent(id);
        var added = {}; repo.list('review', { learner_id: id.learner_id }).forEach(function (r) { if (r.source_id) added[r.source_id] = r.id; });
        var misses = A.quizzes ? A.quizzes.releasedMisses(id.learner_id, id.courses) : [];
        return misses.filter(function (m) { return id.courses.indexOf(m.course_id) >= 0; }).map(function (m) { var o = clone(m); o.review_item_id = added[m.source_id] || null; return o; });
      },
      listReview: function (id) {
        requireStudent(id);
        var d = today();
        return repo.list('review', { learner_id: id.learner_id }).filter(function (r) { return id.courses.indexOf(r.course_id) >= 0 && !r.archived; })
          .map(function (r) { var o = clone(r); o.due = o.due_on <= d; return o; })
          .sort(function (a, b) { return a.due_on < b.due_on ? -1 : 1; });
      },
      addReviewItem: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['course_id', 'question', 'my_mistake', 'correct_idea', 'source_id']);
        var src = null;
        if (args.source_id) {
          src = (A.quizzes ? A.quizzes.releasedMisses(id.learner_id, id.courses) : []).filter(function (m) { return m.source_id === args.source_id; })[0];
          if (!src) notFound();
        }
        var course = src ? src.course_id : args.course_id;
        if (id.courses.indexOf(course) < 0) forbidden('Choose one of your courses.');
        return repo.withLock(function () {
          if (src) {
            var prior = repo.list('review', { learner_id: id.learner_id }).filter(function (r) { return r.source_id === src.source_id; })[0];
            if (prior) return clone(prior);
          }
          var t = now();
          var rec = { id: uuid(), kind: 'review', learner_id: id.learner_id, course_id: course, source_id: src ? src.source_id : null, source_label: src ? src.quiz_title : null,
            question: str(src ? src.question : args.question, 1000, 'Question or idea', true).trim(),
            my_mistake: str(args.my_mistake !== undefined ? args.my_mistake : (src ? 'I answered: ' + src.your_answer : ''), 1000, 'What I got wrong', false).trim(),
            correct_idea: str(args.correct_idea !== undefined ? args.correct_idea : (src ? src.explanation : ''), 2000, 'The right idea', false).trim(),
            stage: 0, due_on: today(), history: [], archived: false, created_at: t, updated_at: t, version: 1 };
          repo.insert('review', rec);
          return clone(rec);
        });
      },
      updateReviewItem: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['item_id', 'base_version', 'question', 'my_mistake', 'correct_idea', 'archived']);
        return repo.withLock(function () {
          var r = load(id, 'review', args.item_id);
          if (args.base_version !== r.version) fail('CONFLICT', 'This item changed somewhere else.', 409, { current: clone(r) });
          var next = clone(r);
          if ('question' in args) next.question = str(args.question, 1000, 'Question or idea', true).trim();
          if ('my_mistake' in args) next.my_mistake = str(args.my_mistake, 1000, 'What I got wrong', false).trim();
          if ('correct_idea' in args) next.correct_idea = str(args.correct_idea, 2000, 'The right idea', false).trim();
          if ('archived' in args) next.archived = args.archived === true;
          next.version = r.version + 1; next.updated_at = now();
          repo.update('review', next, r.version);
          return clone(next);
        });
      },
      reviewResult: function (id, args) {
        requireStudent(id);
        rejectForbidden(args, ['item_id', 'base_version', 'result']);
        if (['got_it', 'not_yet'].indexOf(args.result) < 0) fail('INVALID', 'Choose “Got it” or “Not yet”.');
        return repo.withLock(function () {
          var r = load(id, 'review', args.item_id);
          if (args.base_version !== r.version) fail('CONFLICT', 'This item changed somewhere else.', 409, { current: clone(r) });
          var next = clone(r), d = today();
          next.stage = args.result === 'got_it' ? Math.min(r.stage + 1, REVIEW_GAPS.length) : 0;
          next.due_on = shiftDate(d, args.result === 'got_it' ? REVIEW_GAPS[Math.min(r.stage, REVIEW_GAPS.length - 1)] : 1);
          next.history = (r.history || []).concat([{ on: d, result: args.result }]).slice(-30);
          next.version = r.version + 1; next.updated_at = now();
          repo.update('review', next, r.version);
          return clone(next);
        });
      },

      /* ---------------------------------------------------------- discussions (article / image + comment or debate) */
      createDiscussion: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['course_id', 'title', 'prompt', 'media_url', 'media_type', 'caption', 'mode', 'positions', 'respond_first', 'closes_on']);
        if (id.courses.indexOf(args.course_id) < 0) forbidden('That course is not assigned to you.');
        var mode = args.mode === 'debate' ? 'debate' : 'discuss';
        var positions = mode === 'debate' ? (args.positions && args.positions.length ? args.positions : ['Agree', 'Disagree']) : [];
        if (positions.length && (positions.length > 4 || positions.length < 2)) fail('INVALID', 'A debate needs two to four positions.');
        positions = positions.map(function (x) { return str(x, 60, 'Position', true).trim(); });
        var media = null;
        if (args.media_url) {
          var url = str(args.media_url, 1800, 'Link', true).trim();
          if (!HTTPS_URL.test(url) && !/^\/media\/[a-z0-9-]+\.(svg|png|jpg)$/.test(url)) fail('INVALID', 'Links must be complete https:// addresses.');
          media = { type: MEDIA_TYPES.indexOf(args.media_type) >= 0 ? args.media_type : 'link', url: url, caption: str(args.caption, 300, 'Caption', false).trim() };
        }
        return repo.withLock(function () {
          var t = now();
          var rec = { id: uuid(), kind: 'discussion', learner_id: '', course_id: args.course_id, title: str(args.title, 160, 'Title', true).trim(),
            prompt: str(args.prompt, 2000, 'Question', true).trim(), media: media, mode: mode, positions: positions, respond_first: args.respond_first !== false,
            opens_on: today(), closes_on: dateOrNull(args.closes_on, 'Closes on'), status: 'open', created_by: id.label, created_at: t, updated_at: t, version: 1 };
          repo.insert('discussion', rec);
          return clone(rec);
        });
      },
      setDiscussionStatus: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['discussion_id', 'status']);
        return repo.withLock(function () {
          var dsc = repo.get('discussion', args.discussion_id);
          if (!dsc || id.courses.indexOf(dsc.course_id) < 0) notFound();
          var next = clone(dsc); next.status = args.status === 'closed' ? 'closed' : 'open'; next.version = dsc.version + 1; next.updated_at = now();
          repo.update('discussion', next, dsc.version);
          return clone(next);
        });
      },
      listDiscussions: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['course_id']);
        var courses = args && args.course_id ? [args.course_id] : id.courses;
        if (courses.some(function (c) { return id.courses.indexOf(c) < 0; })) forbidden('That course is not one of yours.');
        var comments = repo.list('dcomment', null);
        return repo.list('discussion', null).filter(function (x) { return courses.indexOf(x.course_id) >= 0; })
          .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; }).map(function (x) {
            var cs = comments.filter(function (c) { return c.discussion_id === x.id && !c.hidden; });
            var o = clone(x); o.open = discussionOpen(x); o.response_count = cs.filter(function (c) { return !c.parent_id && c.learner_id; }).length;
            if (id.kind === 'student') o.responded = cs.some(function (c) { return c.learner_id === id.learner_id && !c.parent_id; }) || repo.list('dcomment', { learner_id: id.learner_id }).some(function (c) { return c.discussion_id === x.id && !c.parent_id; });
            return o;
          });
      },
      getDiscussion: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['discussion_id']);
        var dsc = repo.get('discussion', args.discussion_id);
        if (!dsc || id.courses.indexOf(dsc.course_id) < 0) notFound();
        var all = repo.list('dcomment', null).filter(function (c) { return c.discussion_id === dsc.id; }).sort(function (a, b) { return a.created_at < b.created_at ? -1 : 1; });
        var student = id.kind === 'student';
        var mineTop = student && all.some(function (c) { return c.learner_id === id.learner_id && !c.parent_id; });
        var locked = student && dsc.respond_first && !mineTop;
        var visible = all.filter(function (c) { return !student || !c.hidden || c.learner_id === id.learner_id; });
        var out = clone(dsc); out.open = discussionOpen(dsc); out.locked = locked;
        out.comments = (locked ? visible.filter(function (c) { return c.learner_id === id.learner_id; }) : visible).map(function (c) {
          var o = clone(c); o.author = c.author_role === 'teacher' ? c.author_label : learnerLabel(c.learner_id); o.mine = student && c.learner_id === id.learner_id;
          if (student && !o.mine) delete o.history; delete o.learner_id; return o;
        });
        out.hidden_count = locked ? visible.filter(function (c) { return !c.parent_id && c.learner_id !== id.learner_id; }).length : 0;
        if (!student) {
          var learners = roster.filter(function (r) { return String(r.course_id).replace(/^CT11$/, 'COM11') === dsc.course_id && (r.active === true || String(r.active).toLowerCase() === 'true'); });
          out.participation = learners.map(function (r) {
            var mine = all.filter(function (c) { return c.learner_id === r.learner_id; });
            return { learner_label: String(r.student_name || r.learner_id), responses: mine.filter(function (c) { return !c.parent_id; }).length, replies: mine.filter(function (c) { return c.parent_id; }).length };
          });
        }
        return out;
      },
      postDiscussionComment: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['discussion_id', 'body', 'position', 'evidence_url', 'parent_id', 'client_request_id']);
        var dsc = repo.get('discussion', args.discussion_id);
        if (!dsc || id.courses.indexOf(dsc.course_id) < 0) notFound();
        if (id.kind === 'student' && !enrolled(id.learner_id, dsc.course_id)) notFound();
        if (!discussionOpen(dsc)) fail('INVALID', 'This discussion is closed.');
        return repo.withLock(function () {
          var all = repo.list('dcomment', null).filter(function (c) { return c.discussion_id === dsc.id; });
          var who = id.kind === 'student' ? id.learner_id : '';
          if (args.client_request_id) { var prior = all.filter(function (c) { return c.client_request_id === args.client_request_id && c.learner_id === who; })[0]; if (prior) return clone(prior); }
          var parent = null;
          if (args.parent_id) {
            parent = all.filter(function (c) { return c.id === args.parent_id && !c.parent_id; })[0];
            if (!parent || (id.kind === 'student' && parent.hidden)) notFound();
            if (id.kind === 'student' && dsc.respond_first && !all.some(function (c) { return c.learner_id === id.learner_id && !c.parent_id; })) fail('INVALID', 'Post your own response first, then reply to classmates.');
          }
          if (!parent && id.kind === 'student' && all.some(function (c) { return c.learner_id === id.learner_id && !c.parent_id; }))
            fail('INVALID', 'You’ve already responded. Edit your response or reply to a classmate.');
          var position = null;
          if (!parent && dsc.mode === 'debate' && id.kind === 'student') {
            if (dsc.positions.indexOf(args.position) < 0) fail('INVALID', 'Choose your position first.');
            position = args.position;
          }
          var ev = args.evidence_url ? artifacts([{ url: args.evidence_url, label: 'Evidence' }])[0].url : null;
          var t = now();
          var rec = { id: uuid(), kind: 'dcomment', discussion_id: dsc.id, course_id: dsc.course_id, learner_id: who, author_role: id.kind, author_label: id.kind === 'teacher' ? id.label : '',
            parent_id: parent ? parent.id : null, position: position, body: str(args.body, 3000, 'Comment', true), evidence_url: ev, hidden: false, history: [],
            client_request_id: args.client_request_id ? str(args.client_request_id, 64, 'Request id', true) : null, created_at: t, updated_at: t, version: 1 };
          repo.insert('dcomment', rec);
          var o = clone(rec); delete o.learner_id; o.mine = true; o.author = id.kind === 'teacher' ? id.label : id.display_name; return o;
        });
      },
      editDiscussionComment: function (id, args) {
        if (!id) denied();
        rejectForbidden(args, ['comment_id', 'base_version', 'body']);
        return repo.withLock(function () {
          var c = repo.get('dcomment', args.comment_id);
          var own = c && ((id.kind === 'student' && c.learner_id === id.learner_id) || (id.kind === 'teacher' && c.author_role === 'teacher' && id.courses.indexOf(c.course_id) >= 0));
          if (!own) notFound();
          if (args.base_version !== c.version) fail('CONFLICT', 'This comment changed somewhere else.', 409);
          var next = clone(c); next.history = (c.history || []).concat([{ body: c.body, edited_at: c.updated_at }]); next.body = str(args.body, 3000, 'Comment', true);
          next.version = c.version + 1; next.updated_at = now();
          repo.update('dcomment', next, c.version);
          var o = clone(next); delete o.learner_id; o.mine = true; return o;
        });
      },
      hideDiscussionComment: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['comment_id', 'hidden']);
        return repo.withLock(function () {
          var c = repo.get('dcomment', args.comment_id);
          if (!c || id.courses.indexOf(c.course_id) < 0) notFound();
          var next = clone(c); next.hidden = args.hidden === true; next.version = c.version + 1;
          repo.update('dcomment', next, c.version);
          return { comment_id: c.id, hidden: next.hidden };
        });
      },

      /* ---------------------------------------------------------- portfolio */
      portfolioPreview: function (id) {
        requireStudent(id);
        return repo.list('entry', { learner_id: id.learner_id }).filter(function (e) { return e.showcase && id.courses.indexOf(e.course_id) >= 0; })
          .map(function (e) { return { id: e.id, title: e.title, body: e.body, artifacts: e.artifacts, tags: e.tags, course_id: e.course_id, updated_at: e.updated_at }; });
      },

      /* ---------------------------------------------------------- teacher */
      teacherQueue: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['course_id']);
        var courses = args && args.course_id ? [args.course_id] : id.courses;
        if (courses.some(function (c) { return id.courses.indexOf(c) < 0; })) forbidden('That course is not assigned to you.');
        return repo.list('submission', null).filter(function (s) { return courses.indexOf(s.course_id) >= 0 && enrolled(s.learner_id, s.course_id); })
          .sort(function (a, b) { return b.submitted_at < a.submitted_at ? -1 : 1; })
          .map(function (s) {
            var fb = repo.list('comment', { learner_id: s.learner_id }).filter(function (c) { return c.entry_id === s.entry_id && c.author_role === 'teacher'; });
            var ent = repo.get('entry', s.entry_id) || {};
            return { submission_id: s.id, entry_id: s.entry_id, learner_label: learnerLabel(s.learner_id), course_id: s.course_id, assignment_title: s.ref ? s.ref.title : '', ref: s.ref,
              kind: s.ref ? 'assignment' : s.prompt ? 'reflection' : 'post', title: s.snapshot.title, prompt_title: s.prompt ? s.prompt.title : null, audience: ent.audience || 'teacher',
              attempt: s.attempt, entry_version: s.entry_version, submitted_at: s.submitted_at, review: s.review, receipt: s.receipt,
              feedback: { drafts: fb.filter(function (c) { return c.status === 'draft'; }).length, released: fb.filter(function (c) { return c.status === 'released'; }).length } };
          });
      },
      markReviewed: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['submission_id']);
        return repo.withLock(function () {
          var s = load(id, 'submission', args.submission_id);
          if (s.review.status === 'reviewed') return clone(s);
          var next = clone(s); next.review = { status: 'reviewed', at: now(), by: id.label }; next.version = s.version + 1;
          repo.update('submission', next, s.version); audit(id, 'submission.reviewed', s);
          return clone(next);
        });
      },
      addFeedback: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['entry_id', 'submission_id', 'body']);
        return repo.withLock(function () {
          var entry = load(id, 'entry', args.entry_id, { teacherNeedsSubmission: true });
          var sub = args.submission_id ? load(id, 'submission', args.submission_id) : null;
          if (sub && sub.entry_id !== entry.id) notFound();
          var t = now();
          var c = { id: uuid(), kind: 'comment', entry_id: entry.id, learner_id: entry.learner_id, course_id: entry.course_id, author_role: 'teacher', author_label: id.label, author_key: teacherOwnerKey(id),
            parent_id: null, submission_id: sub ? sub.id : null, body: str(args.body, 4000, 'Feedback', true), status: 'draft', version: 1, history: [], created_at: t, updated_at: t, released_at: null };
          repo.insert('comment', c); audit(id, 'feedback.drafted', entry);
          return clone(c);
        });
      },
      releaseFeedback: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['comment_id', 'base_version']);
        return repo.withLock(function () {
          var c = repo.get('comment', args.comment_id);
          if (!c || !canAccess(id, c) || c.author_role !== 'teacher') notFound();
          if (c.author_key !== teacherOwnerKey(id)) forbidden('Only the teacher who wrote this feedback can release it.');
          if (c.status === 'released') return clone(c);
          if (args.base_version !== c.version) fail('CONFLICT', 'This feedback changed since you opened it. Review it before releasing.', 409, { current: clone(c) });
          var next = clone(c); next.status = 'released'; next.released_at = now(); next.version = c.version + 1;
          repo.update('comment', next, c.version); audit(id, 'feedback.released', c);
          return clone(next);
        });
      },
      teacherActivity: function (id, args) {
        requireTeacher(id);
        rejectForbidden(args, ['course_id']);
        var course = args && args.course_id;
        if (!course || id.courses.indexOf(course) < 0) forbidden('That course is not assigned to you.');
        var learners = {};
        roster.forEach(function (r) { if (!isPractice(r.learner_id) && String(r.course_id).replace(/^CT11$/, 'COM11') === course && (r.active === true || String(r.active).toLowerCase() === 'true')) learners[r.learner_id] = String(r.student_name || r.learner_id); });
        return Object.keys(learners).map(function (lid) {
          var cards = repo.list('card', { learner_id: lid }).filter(function (c) { return c.course_id === course; });
          var subs = repo.list('submission', { learner_id: lid }).filter(function (s) { return s.course_id === course; });
          var cols = {}; COLUMNS.forEach(function (k) { cols[k] = cards.filter(function (c) { return c.column === k; }).length; });
          return { learner_label: learners[lid], submissions: subs.length, reviewed: subs.filter(function (s) { return s.review.status === 'reviewed'; }).length,
            board: cols, need_feedback: cards.filter(function (c) { return c.column === 'need_feedback'; }).map(function (c) { return { title: c.title, assignment: c.ref ? c.ref.title : '' }; }),
            note: 'Workflow activity only. Not achievement, not a mark, not a prediction input.' };
        });
      }
    };
    return api;
  }

  /* ------------------------------------------------------------------ in-memory repository (demo + tests) */
  function MemoryRepo(initial) {
    var data = initial || {};
    var depth = 0;
    function bucket(kind) { if (!data[kind]) data[kind] = {}; return data[kind]; }
    return {
      get: function (kind, id) { var r = bucket(kind)[id]; return r ? clone(r) : null; },
      list: function (kind, filter) {
        var b = bucket(kind);
        return Object.keys(b).map(function (k) { return b[k]; }).filter(function (r) { return !filter || !filter.learner_id || r.learner_id === filter.learner_id; }).map(clone);
      },
      insert: function (kind, rec) { var b = bucket(kind); if (b[rec.id]) fail('DUPLICATE', 'Record already exists.', 409); b[rec.id] = clone(rec); },
      update: function (kind, rec, expected) {
        var b = bucket(kind), cur = b[rec.id];
        if (!cur) notFound();
        if (cur.version !== expected) fail('CONFLICT', 'Record changed; nothing was overwritten.', 409);
        b[rec.id] = clone(rec);
      },
      withLock: function (fn) { depth++; try { return fn(); } finally { depth--; } }, // single-threaded runtime; Apps Script uses LockService
      dump: function () { return clone(data); }
    };
  }

  var SOS = { previewIdentity: previewIdentity, previewRoster: previewRoster, CONFIDENCE: CONFIDENCE, COLUMNS: COLUMNS, COLUMN_LABELS: COLUMN_LABELS, COURSES: COURSES, PROMPTS: PROMPTS, HTTPS_URL: HTTPS_URL,
    SUPPORTS: SUPPORTS, SUPPORT_LABELS: SUPPORT_LABELS, SUPPORT_DIMENSIONS: SUPPORT_DIMENSIONS,
    SosError: SosError, resolveIdentity: resolveIdentity, createService: createService, MemoryRepo: MemoryRepo,
    errorPayload: function (e) {
      if (e && e.name === 'SosError') return { ok: false, error: { code: e.code, message: e.message, status: e.status, detail: e.detail } };
      return { ok: false, error: { code: 'SERVER', message: 'Something went wrong. Nothing was saved.', status: 500 } };
    } };
  if (typeof module !== 'undefined' && module.exports) module.exports = SOS; else root.SOS = SOS;
})(typeof globalThis !== 'undefined' ? globalThis : this);
