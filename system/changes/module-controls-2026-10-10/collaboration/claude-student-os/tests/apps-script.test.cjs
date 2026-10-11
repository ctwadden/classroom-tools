/* Runs the GENERATED Apps Script files (apps-script/dist) in a Node vm with MOCKED Google services.
 * This proves the Apps Script code paths execute and enforce the rules; it is NOT a Google runtime test:
 * real Session identity, sharing, quotas, LockService contention and HtmlService rendering remain unverified. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
execFileSync(process.execPath, [path.join(ROOT, 'tools/build_apps_script.mjs')]);
const DIST = path.join(ROOT, 'apps-script/dist');
const snapshot = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/assignments.snapshot.json'), 'utf8'));
const releaseCatalogue = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/live-release-catalogue.json'), 'utf8'));
const D09 = 'IBDS:IBDS-SERVICE-OFFLINE:ibds-26-s04-d09';
const REAL_ROSTER_ID = '1hGXzxde_q7UmKUFYKub3N_j_bFTMRrZqIUxTCIpciwc';
const DS_SOURCE = releaseCatalogue.sources.IBDS, MM_SOURCE = releaseCatalogue.sources.MM12, COM_SOURCE = releaseCatalogue.sources.COM11;

function fakeSheet(name, rows) {
  const data = rows || [];
  const range = (r, c, nr, nc) => ({
    getValues: () => Array.from({ length: nr }, (_, i) => Array.from({ length: nc }, (_, j) => (data[r - 1 + i] || [])[c - 1 + j] ?? '')),
    getValue: () => (data[r - 1] || [])[c - 1] ?? '',
    setValue: v => { data[r - 1] = data[r - 1] || []; data[r - 1][c - 1] = v; },
    setValues: v => { v.forEach((row, i) => { data[r - 1 + i] = data[r - 1 + i] || []; row.forEach((x, j) => { data[r - 1 + i][c - 1 + j] = x; }); }); }
  });
  return { name, data, getRange: range, getLastRow: () => data.length, appendRow: r => data.push(r.slice()), setFrozenRows() {},
    getLastColumn: () => Math.max(0, ...data.map(r => r.length)),
    getDataRange: () => range(1, 1, data.length, Math.max(0, ...data.map(r => r.length))) };
}
function world({ email = '', live = false, fetch, moduleSettings = {}, moduleUnavailable = false, fresh = false, teacherInRoster = false, multiCourseRoster = false, releasePages = {}, confirmedEvidenceRows = [], gradebookRows = [], dsReceipts = [], teacherCourses = ['IBDS'], pilotAllowlist = ['student.a@synthetic.example.test', 'student.b@synthetic.example.test'] } = {}) {
  const rosterRows = [['student_name', 'student_email', 'course_id', 'active', 'learner_id'],
    ['Avery Sample (synthetic)', 'student.a@synthetic.example.test', 'IBDS', true, 'syn-learner-a'],
    ['Blake Example (synthetic)', 'student.b@synthetic.example.test', 'IBDS', true, 'syn-learner-b'],
    ['No ID yet (synthetic)', 'student.x@synthetic.example.test', 'IBDS', true, '']];
  if (teacherInRoster) rosterRows.push(['Integration QA teacher (synthetic)', 'teacher.demo@synthetic.example.test', 'IBDS', true, 'syn-teacher-qa']);
  if (multiCourseRoster) {
    rosterRows.push(['Avery Sample (synthetic)', 'student.a@synthetic.example.test', 'MM12', true, 'syn-learner-a']);
    rosterRows.push(['Blake Example (synthetic)', 'student.b@synthetic.example.test', 'COM11', true, 'syn-learner-b']);
  }
  const roster = fakeSheet('Roster', rosterRows);
  const evidenceHead = ['timestamp','student_email','student_name','course_id','project_id','canonical_id','evidence_type','skill_ids','outcome_codes','response_value','auto_score','level','independence','teacher_note','teacher_verified','source_form_id','source_response_id','rubric_context_json','Released to student','Released at'];
  const evidence = fakeSheet('Evidence_Log', [evidenceHead].concat(confirmedEvidenceRows));
  const dsHead = ['Evidence ID','Student ID','Date','Component','Task ID','Paper family / IA ID','Maximum','Raw mark','Conditions','Complete?','Teacher verified?','Selected?','Markscheme / source','Artifact link','Notes / exclusion rationale','Score %','Record check','Prediction eligible?','Age at review (days)','Recency review','Assessment registry check','Submission status','Draft feedback','Teacher-approved feedback','School task grade 1–7','Gradebook status','Released to student','Released at'];
  const gradebook = fakeSheet('Evidence Log', [[],[],[],dsHead].concat(gradebookRows));
  const receiptHead = ['record_id','task_id','attempt','form_id','source_response_id','learner_id','qa','payload_json','gradebook_sheet','gradebook_row','event_id','revision_id','status','last_error','updated_at'];
  const receipts = fakeSheet('DS Capture Receipts', [receiptHead].concat(dsReceipts));
  const tes = { sheets: { Roster: roster, Evidence_Log: evidence, 'DS Capture Receipts': receipts } }, store = { sheets: {} };
  const book = b => ({ getSheetByName: n => b.sheets[n] || null, insertSheet: n => (b.sheets[n] = fakeSheet(n)) });
  const books = { 'tes-id': book(tes), 'store-id': book(store), [REAL_ROSTER_ID]: book(tes),
    '1S-XxuBfuvq9vM3Ms6DvYRVsrA6gziaviUJ4YVJM_4AY': book({sheets:{'Evidence Log':gradebook}}) };
  let created = 0;
  const cache = new Map(), locks = { taken: 0 }, fetched = [];
  const snap = JSON.parse(JSON.stringify(snapshot));
  if (live) snap.assignments.forEach(a => { a.release = { state: 'released', label: 'Released by teacher' }; });
  const props = { SOS_ROSTER_SPREADSHEET_ID: 'tes-id', SOS_STORE_SPREADSHEET_ID: 'store-id', SOS_ASSIGNMENTS_FILE_ID: 'snap-id',
    SOS_TEACHERS_JSON: JSON.stringify({ 'Teacher.Demo@synthetic.example.test': { label: 'Demo teacher', courses: teacherCourses } }),
    SOS_PILOT_ALLOWLIST_JSON: JSON.stringify(pilotAllowlist),
    SOS_EVIDENCE_MODE: live ? 'live' : 'demo', EVIDENCE_MAP_INGEST_URL: 'https://evidence.example.test/ingest', EVIDENCE_MAP_INGEST_SECRET: 'secret' };
  if (fresh) for (const k of Object.keys(props)) delete props[k];
  const html = content => { const o = { content, title: '', xframe: null, setTitle(t) { o.title = t; return o; }, addMetaTag() { return o; }, setXFrameOptionsMode(m) { o.xframe = m; return o; } }; return o; };
  const ctx = { ModulePolicy:require('../../../evidence-map/module-policy.js'),
    console: { log() {}, error() {} },
    Session: { getActiveUser: () => ({ getEmail: () => ctx.__email }), getEffectiveUser: () => ({ getEmail: () => 'owner.teacher@synthetic.example.test' }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: k => props[k] ?? null, setProperty: (k, v) => { props[k] = v; }, deleteProperty: k => { delete props[k]; },
      setProperties: o => Object.assign(props, o) }) },
    CacheService: { getScriptCache: () => ({ get: k => cache.get(k) ?? null, put: (k, v) => cache.set(k, v) }) },
    SpreadsheetApp: { openById: id => { if (!books[id]) throw new Error('no access'); return books[id]; }, flush() {},
      create: name => { const id = 'created-' + (++created), b = { sheets: { Sheet1: fakeSheet('Sheet1') } }; books[id] = book(b);
        const sh = b.sheets.Sheet1; sh.setName = n => { delete b.sheets.Sheet1; b.sheets[n] = sh; }; const gr = sh.getRange; sh.getRange = (...a) => typeof a[0] === 'string' ? { setValue() {} } : gr(...a);
        return { getId: () => id, getSheets: () => [sh], getName: () => name }; } },
    LockService: { getScriptLock: () => ({ tryLock: () => { locks.taken++; return true; }, waitLock() {}, releaseLock() {} }) },
    DriveApp: { getFileById: id => { assert.equal(id, 'snap-id'); return { getBlob: () => ({ getDataAsString: () => JSON.stringify(snap) }) }; } },
    UrlFetchApp: { fetch: (url, opts) => {
      fetched.push(String(url));
      if(String(url).indexOf('action=module-access')>=0){const q=new URL(url).searchParams;return {getResponseCode:()=>moduleUnavailable?503:200,getContentText:()=>JSON.stringify({schema:'learning-studio.module-controls.v1',course_id:q.get('course_id'),groups:[],rules:moduleSettings[q.get('learner_id')]||[]})};}
      let body;
      if (url === DS_SOURCE) body = releasePages.IBDS ?? JSON.stringify({ sprints: [{ id: 'ibds-26-s04', workbook_url: 'sprints/service-offline/', release_status: 'Published student workbook; timed assessment Forms released separately' }] });
      else if (url === MM_SOURCE) body = releasePages.MM12 ?? releaseCatalogue.assignments.filter(a => a.course_id === 'MM12' && a.ref.sprint_id !== 'mm12-26-s08').map(a => [a.release_match.workbook_marker, a.submission.url]).flat().join('\n');
      else if (url === COM_SOURCE) body = releasePages.COM11 ?? releaseCatalogue.assignments.filter(a => a.course_id === 'COM11').map(a => [a.release_match.workbook_marker, a.submission.url]).flat().join('\n');
      else if (url === 'https://ctwadden.github.io/digital-society-sl/sprints/service-offline/') body = releasePages.IBDS_DETAIL ?? releaseCatalogue.assignments.filter(a => a.course_id === 'IBDS').map(a => a.submission.url).join('\n');
      else if (releaseCatalogue.assignments.some(a => a.release_match.detail_url === url)) body = releasePages[url] ?? releaseCatalogue.assignments.filter(a => a.release_match.detail_url === url && !['mm12-26-s06','mm12-26-s07','mm12-26-s08'].includes(a.ref.sprint_id)).map(a => a.submission.url).join('\n');
      else return fetch ? fetch(url, opts) : (() => { throw new Error('network disabled in test'); })();
      return { getResponseCode: () => 200, getContentText: () => body };
    } },
    Utilities: { getUuid: () => crypto.randomUUID(), DigestAlgorithm: { SHA_256: 'sha256' }, Charset: { UTF_8: 'utf8' },
      computeDigest: (_a, text) => Array.from(crypto.createHash('sha256').update(text, 'utf8').digest()).map(b => (b > 127 ? b - 256 : b)) },
    HtmlService: { createHtmlOutputFromFile: n => html('FILE:' + n), createHtmlOutput: s => html(s), XFrameOptionsMode: { ALLOWALL: 'ALLOWALL' } },
    __email: email
  };
  vm.createContext(ctx);
  for (const f of ['ModulePolicy.gs', 'SosCore.gs', 'SosAdapters.gs', 'SosReleaseCatalogue.gs', 'SosCrosswalk.gs', 'SosDsQuizSpec.gs', 'Config.gs', 'SheetRepo.gs', 'Adapters.gs', 'Results.gs', 'Code.gs'])
    vm.runInContext(fs.readFileSync(path.join(DIST, f), 'utf8'), ctx, { filename: f });
  // Each google.script.run call is a new Apps Script execution: global memo state is not shared.
  const call = (as, method, args) => { ctx.__email = as; vm.runInContext('SOS_SERVICE_ = null', ctx); return ctx.rpc(method, args); };
  return { ctx, call, store, evidence, gradebook, locks, cache, props, fetched, created: () => created };
}
const A = 'student.a@synthetic.example.test', B = 'student.b@synthetic.example.test', T = 'teacher.demo@synthetic.example.test';

test('Apps Script (mocked): IBDS release is own, verified, reversible and excludes drafts and prediction fields', () => {
  const row = (id, learner, released, verified = 'Yes') => [id, learner, '', 'Readiness', 'ibds-26-quiz-w07', '', 12, 9,
    '', 'Yes', verified, 'No', '', '', '', '', '', 'PREDICTION SECRET', '', '', '', 'Submitted', 'DRAFT SECRET',
    'Review vocabulary in Q3.', 7, 'Not queued', released, '2026-09-30T12:00:00Z'];
  const w = world({ gradebookRows: [row('rec-a','syn-learner-a',false), row('rec-b','syn-learner-b',true)] });
  const own = () => w.call(A, 'studentDashboard', {}).result.courses.find(c => c.course_id === 'IBDS').released_results.items;
  assert.equal(own().length, 0, 'held own row and another learner’s released row are hidden');
  assert.equal(w.call(A, 'setResultRelease', { course_id:'IBDS', learner_id:'syn-learner-a', key:'rec-a', released:true }).error.code, 'FORBIDDEN');
  assert.equal(w.call(T, 'setResultRelease', { course_id:'IBDS', learner_id:'syn-learner-a', key:'rec-b', released:true }).error.code, 'CONFLICT');
  assert.equal(w.call(T, 'setResultRelease', { course_id:'IBDS', learner_id:'syn-learner-a', key:'rec-a', released:true }).ok, true);
  const visible = own(); assert.equal(visible.length, 1); assert.equal(visible[0].raw_earned, 9);
  assert.equal(visible[0].approved_feedback, 'Review vocabulary in Q3.');
  assert.doesNotMatch(JSON.stringify(visible), /DRAFT SECRET|PREDICTION SECRET|School task grade|rec-b/);
  assert.equal(w.call(B, 'studentDashboard', {}).result.courses.find(c => c.course_id === 'IBDS').released_results.items.some(x => x.task_id === 'ibds-26-quiz-w07'), true);
  assert.equal(w.call(T, 'setResultRelease', { course_id:'IBDS', learner_id:'syn-learner-a', key:'rec-a', released:false }).ok, true);
  assert.equal(own().length, 0, 'un-release hides a previously visible result');
});

test('Apps Script (mocked): knowledge release requires own course, teacher verification and exact TRUE', () => {
  const base = ['', A, '', 'MM12', 'mm12-26-s03-bundle', 'PS-CAM-Q1', 'Knowledge', '', '', 'answer', '0/1', '', '',
    'Approved: revisit aperture.', true, 'form-a', 'response-a', '', false, ''];
  const other = base.slice(); other[1] = B; other[16] = 'response-b'; other[18] = true;
  const unverified = base.slice(); unverified[16] = 'response-c'; unverified[14] = false; unverified[18] = true;
  const w = world({ multiCourseRoster:true, teacherCourses:['IBDS','MM12'], confirmedEvidenceRows:[base, other, unverified] });
  const own = () => w.call(A, 'studentDashboard', {}).result.courses.find(c => c.course_id === 'MM12').released_results.items;
  assert.equal(own().length, 0);
  assert.equal(w.call(T, 'setResultRelease', {course_id:'MM12',learner_id:'syn-learner-a',key:'form-a:response-c:PS-CAM-Q1',released:true}).error.code, 'INVALID');
  assert.equal(w.call(T, 'setResultRelease', {course_id:'MM12',learner_id:'syn-learner-a',key:'form-a:response-a:PS-CAM-Q1',released:true}).ok, true);
  assert.equal(own().length, 1); assert.equal(own()[0].approved_feedback, 'Approved: revisit aperture.');
  assert.equal(w.call(A, 'quizFeedback', {}).result.length, 1);
  assert.equal(w.call(T, 'setResultRelease', {course_id:'MM12',learner_id:'syn-learner-a',key:'form-a:response-a:PS-CAM-Q1',released:false}).ok, true);
  assert.equal(own().length, 0); assert.equal(w.call(A, 'quizFeedback', {}).result.length, 0);
});

test('Apps Script (mocked): DS missed prompts derive only from own confirmed receipt after release', () => {
  const source = fs.readFileSync(path.join(ROOT, '../../evidence-map/integrations/technology-evidence-system/DSCaptureConfig.gs'), 'utf8');
  const spec = JSON.parse(source.match(/const DS_CAPTURE_SPEC = (\{[^\n]+\});/)[1]);
  const form = spec.forms.find(f => f.role === 'quiz' && f.items.some(q => q.type === 'mc'));
  const item = form.items.find(q => q.type === 'mc');
  const answers = {}; form.items.filter(q => q.type === 'mc').forEach(q => { answers[q.id] = q.choices[q.correct]; });
  answers[item.id] = item.choices[(item.correct + 1) % item.choices.length];
  const row = ['rec-quiz','syn-learner-a','','Readiness',form.task_id,'',12,9,'','Yes','Yes','No','','','','','','','','','','Submitted','draft hidden','Approved feedback',7,'Not queued',false,''];
  const payload = {record_id:'rec-quiz',learner_id:'syn-learner-a',task_id:form.task_id,role:'quiz',instrument:form.instrument,content:JSON.stringify(answers)};
  const receipt = ['rec-quiz',form.task_id,1,'form-id','response-id','syn-learner-a',false,JSON.stringify(payload),'Evidence Log',5,'','','confirmed','',''];
  const w = world({gradebookRows:[row],dsReceipts:[receipt]});
  assert.equal(w.call(A,'quizFeedback',{}).result.length,0);
  assert.equal(w.call(T,'setResultRelease',{course_id:'IBDS',learner_id:'syn-learner-a',key:'rec-quiz',released:true}).ok,true);
  const misses=w.call(A,'quizFeedback',{}).result;
  assert.equal(misses.length,1); assert.match(misses[0].question,new RegExp(item.id));
  assert.doesNotMatch(JSON.stringify(misses),/correct_answer|choices|DRAFT/);
  assert.equal(w.call(T,'setResultRelease',{course_id:'IBDS',learner_id:'syn-learner-a',key:'rec-quiz',released:false}).ok,true);
  assert.equal(w.call(A,'quizFeedback',{}).result.length,0);
});

test('Apps Script (mocked): signed-out and unresolved identities are denied at doGet and rpc', () => {
  const w = world();
  for (const email of ['', 'visitor@synthetic.example.test', 'student.x@synthetic.example.test']) {
    w.ctx.__email = email;
    const page = w.ctx.doGet();
    assert.match(page.content, /Access denied/); assert.equal(page.xframe, null);
    const r = w.call(email, 'whoami', {});
    assert.equal(r.ok, false); assert.equal(r.error.code, 'DENIED', email);
  }
  w.ctx.__email = A;
  assert.equal(w.ctx.doGet().content, 'FILE:Index');
  assert.equal(w.call(A, 'nonexistentMethod', {}).error.code, 'NOT_FOUND');
  assert.equal(w.call(A, '_assignmentSummary', {}).error.code, 'NOT_FOUND');
});

test('Apps Script (mocked): pilot allowlist is an additional deny-by-default student gate', () => {
  const empty = world({ pilotAllowlist: [] });
  assert.equal(empty.call(A, 'whoami', {}).error.code, 'DENIED', 'active roster student is denied while pilot allowlist is empty');
  assert.equal(empty.call(B, 'whoami', {}).error.code, 'DENIED', 'every real student is denied by default');
  assert.equal(empty.call(T, 'whoami', {}).result.kind, 'teacher', 'teacher authorization remains separate');

  const one = world({ pilotAllowlist: ['  STUDENT.A@SYNTHETIC.EXAMPLE.TEST  ', 'student.a@synthetic.example.test'] });
  const allowed = one.call(A, 'whoami', {});
  assert.equal(allowed.ok, true, JSON.stringify(allowed.error));
  assert.equal(allowed.result.kind, 'student', 'allowlist email is normalized and deduplicated');
  assert.deepEqual(JSON.parse(JSON.stringify(allowed.result.courses)), [{ course_id: 'IBDS', title: 'IB Digital Society SL' }]);
  assert.equal(one.call(B, 'whoami', {}).error.code, 'DENIED', 'rostered but unlisted student stays denied');
  assert.equal(one.call('unrostered@synthetic.example.test', 'whoami', {}).error.code, 'DENIED', 'allowlist never replaces roster membership');

  const malformed = world();
  malformed.props.SOS_PILOT_ALLOWLIST_JSON = '{bad json';
  assert.equal(malformed.call(A, 'whoami', {}).error.code, 'DENIED', 'malformed allowlist fails closed');
});

test('Apps Script (mocked): an explicitly configured teacher is never treated as a learner from a legacy roster row', () => {
  const w = world({ teacherInRoster: true, pilotAllowlist: [] });
  const me = w.call(T, 'whoami', {});
  assert.equal(me.ok, true, JSON.stringify(me.error));
  assert.equal(me.result.kind, 'teacher');
  assert.equal(w.ctx.sosRoster_().some(row => row.student_email === T), false, 'teacher integration row is excluded from learner matching');
  assert.equal(w.call(A, 'whoami', {}).error.code, 'DENIED', 'empty pilot allowlist still denies real students');
});

test('Apps Script (mocked): roster course and active values are normalized without accepting blanks', () => {
  const w = world({ pilotAllowlist: [] });
  assert.equal(w.ctx.sosNormalizeCourseId_(' IBDS '), 'IBDS');
  assert.equal(w.ctx.sosNormalizeCourseId_('IB Digital Society'), 'IBDS');
  assert.equal(w.ctx.sosNormalizeCourseId_('IBDS 11'), 'IBDS');
  assert.equal(w.ctx.sosNormalizeCourseId_('CT11'), 'COM11');
  assert.equal(w.ctx.sosNormalizeCourseId_('Multimedia 12'), 'MM12');
  for (const value of [true, 'TRUE', ' yes ', 'Y', 1, 'active']) assert.equal(w.ctx.sosNormalizeActive_(value), true);
  for (const value of [false, '', null, undefined, 0, 'inactive']) assert.equal(w.ctx.sosNormalizeActive_(value), false);
});

test('Apps Script (mocked): vertical slice persists to owner-only SOS_ tabs with version checks', () => {
  const w = world();
  const e = w.call(A, 'createEntry', { title: 'Reflection', body: '<script>x</script>', course_id: 'IBDS', assignment_key: D09 });
  assert.equal(e.ok, true, JSON.stringify(e.error));
  assert.deepEqual(w.store.sheets.SOS_entry.data[0], ['id', 'learner_id', 'course_id', 'version', 'updated_at', 'payload_json']);
  const stale = w.call(A, 'updateEntry', { entry_id: e.result.id, base_version: 1, body: 'tab 1' });
  const conflict = w.call(A, 'updateEntry', { entry_id: e.result.id, base_version: 1, body: 'tab 2' });
  assert.equal(stale.ok, true); assert.equal(conflict.error.code, 'CONFLICT');
  const s1 = w.call(A, 'submitEntry', { entry_id: e.result.id, base_version: 2 });
  const s2 = w.call(A, 'submitEntry', { entry_id: e.result.id, base_version: 2 });
  assert.equal(s1.result.duplicate, false); assert.equal(s2.result.duplicate, true);
  assert.equal(w.store.sheets.SOS_submission.data.length, 2, 'header + exactly one submission row');
  assert.match(s1.result.submission.receipt.label, /Demo/);
  const b = w.call(B, 'getEntry', { entry_id: e.result.id });
  assert.equal(b.error.code, 'NOT_FOUND', 'Student B cannot read A');
  const forged = w.call(B, 'listEntries', { learner_id: 'syn-learner-a' });
  assert.equal(forged.error.code, 'READ_ONLY');
  const q = w.call(T, 'teacherQueue', {});
  assert.equal(q.ok, true); assert.equal(q.result.length, 1); assert.equal(q.result[0].ref.task_id, 'ibds-26-s04-d09');
  const fb = w.call(T, 'addFeedback', { entry_id: e.result.id, submission_id: s1.result.submission.id, body: 'Next: name the evidence.' });
  assert.equal(w.call(A, 'getEntry', { entry_id: e.result.id }).result.comments.length, 0);
  w.call(T, 'releaseFeedback', { comment_id: fb.result.id, base_version: 1 });
  assert.equal(w.call(A, 'getEntry', { entry_id: e.result.id }).result.state.feedback_returned.count, 1);
  assert.ok(w.locks.taken >= 6, 'writes ran under LockService');
  assert.equal(JSON.stringify(w.store.sheets).includes('@synthetic.example.test'), false, 'store holds learner_id, never email');
});

test('Apps Script (mocked): roster without learner_id column is refused rather than guessed', () => {
  const w = world();
  w.ctx.SpreadsheetApp.openById('tes-id').getSheetByName('Roster').data[0][4] = 'something_else';
  assert.equal(w.call(A, 'whoami', {}).error.code, 'DENIED');
});

test('Apps Script (mocked): live evidence adapter sends an unconfirmed reflection and confirms only a matching receipt', () => {
  const sent = [];
  const fetch = (url, opts) => {
    const body = JSON.parse(opts.payload); sent.push({ url, opts, body });
    const ev = body.events[0];
    return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ results: { [ev.event_id]: { ok: true, record_id: ev.event_id, revision_id: 'a'.repeat(64) } } }) };
  };
  const w = world({ live: true, fetch });
  const e = w.call(A, 'createEntry', { title: 'Live reflection', body: 'text', course_id: 'IBDS', assignment_key: D09 }).result;
  const s = w.call(A, 'submitEntry', { entry_id: e.id, base_version: 1 }).result;
  assert.equal(s.submission.receipt.status, 'confirmed'); assert.equal(s.submission.receipt.mode, 'live');
  const ev = sent[0].body.events[0];
  assert.equal(ev.stream, 'reflection'); assert.equal(ev.canonical_id, 'ibds-26-s04-d09'); assert.equal(ev.learner_id, 'syn-learner-a');
  assert.equal(ev.teacher_verified, false);
  for (const k of ['assessment_task_id', 'raw_mark', 'level_raw', 'band', 'student_email']) assert.equal(k in ev, false, k);
  assert.equal(JSON.stringify(ev).includes('@'), false, 'no email leaves Google');
  w.call(A, 'submitEntry', { entry_id: e.id, base_version: 1 });
  assert.equal(sent.length, 1, 'duplicate submit does not resend');

  const bad = world({ live: true, fetch: () => ({ getResponseCode: () => 200, getContentText: () => '{"results":{}}' }) });
  const e2 = bad.call(A, 'createEntry', { title: 'x', body: 'y', course_id: 'IBDS', assignment_key: D09 }).result;
  assert.equal(bad.call(A, 'submitEntry', { entry_id: e2.id, base_version: 1 }).result.submission.receipt.status, 'pending', 'unconfirmed receipt is never shown as confirmed');
});

test('Apps Script (mocked): live course-home releases are course-scoped and missing links fail closed', () => {
  const w = world({ multiCourseRoster: true });
  const a = w.call(A, 'listAssignments', {}).result;
  const b = w.call(B, 'listAssignments', {}).result;
  assert.deepEqual([...new Set(a.map(x => x.course_id))].sort(), ['IBDS', 'MM12'], JSON.stringify(w.fetched));
  assert.deepEqual([...new Set(b.map(x => x.course_id))].sort(), ['COM11', 'IBDS']);
  assert.equal(a.some(x => x.course_id === 'COM11'), false, 'student never sees another course release');
  assert.equal(w.call(A, 'listForms', {}).result.length, 6, 'each released project-specific Form link is exposed from its student page');

  const held = world({ multiCourseRoster: true, releasePages: { MM12: '<html>No released workbook link</html>' } });
  assert.equal(held.call(A, 'listAssignments', {}).result.some(x => x.course_id === 'MM12'), false, 'missing course-home link means unreleased');
  assert.equal(held.call(A, 'listAssignments', {}).result.some(x => x.course_id === 'IBDS'), true, 'one failed/held course does not hide another');

  const mm = releaseCatalogue.assignments.find(x => x.course_id === 'MM12');
  const noForm = world({ multiCourseRoster: true, releasePages: { MM12: mm.workbook_url } });
  assert.equal(noForm.call(A, 'listAssignments', {}).result.some(x => x.course_id === 'MM12'), true, 'workbook release is independent of Form release');
  assert.equal(noForm.call(A, 'listForms', {}).result.some(x => x.course_id === 'MM12'), false, 'an unpublished Form link stays hidden');
});

test('Apps Script (mocked): released work auto-populates To do once and Friday reflection names the current sprint', () => {
  const w = world({ multiCourseRoster: true });
  const first = w.call(A, 'listCards', {}).result;
  const second = w.call(A, 'listCards', {}).result;
  assert.equal(first.length, 8, 'two IBDS tasks and six MM12 projects are released to this learner');
  assert.equal(second.length, first.length, 'repeat reads do not duplicate cards');
  assert.equal(new Set(first.map(c => c.assignment_key)).size, first.length);
  assert.equal(first.every(c => c.type === 'assignment' && c.column === 'plan'), true);
  assert.equal(first.every(c => c.activity[0].action.includes('To do')), true);
  const prompts = w.call(A, 'listPrompts', { course_id: 'IBDS' }).result;
  assert.match(prompts[0].title, /^Friday reflection · Sprint 3 · Data, algorithms and recommendation$/);
});

test('Apps Script (mocked): Sprint 3 guides and To-do cards stay inside each synthetic learner course', () => {
  const w = world({ multiCourseRoster: true });
  const mm = w.call(A, 'listAssignments', {}).result;
  const com = w.call(B, 'listAssignments', {}).result;
  assert.deepEqual(JSON.parse(JSON.stringify(mm.filter(x => /^(Photo Desk|Shot on Purpose)$/.test(x.title)).map(x => x.title).sort())), ['Photo Desk', 'Shot on Purpose']);
  assert.deepEqual(JSON.parse(JSON.stringify(com.filter(x => /^(Document It|Photo Desk)$/.test(x.title)).map(x => x.title).sort())), ['Document It', 'Photo Desk']);
  assert.equal(mm.some(x => x.course_id === 'COM11'), false);
  assert.equal(com.some(x => x.course_id === 'MM12'), false);
  const mmCards = w.call(A, 'listCards', {}).result;
  const comCards = w.call(B, 'listCards', {}).result;
  assert.equal(mmCards.filter(x => x.course_id === 'MM12').length, 6);
  assert.equal(mm.some(x => x.ref?.sprint_id === 'mm12-26-s08'), false, 'unlisted Sprint 8 work stays hidden until a course-home release link exists');
  assert.deepEqual(mmCards.filter(x => x.course_id === 'MM12' && /(?:blender-bootcamp-v2|2d-animation-studio-v1)/.test(x.assignment_key)).map(x => x.assignment_key).sort(), ['MM12:mm12-2d-animation-studio-v1:-','MM12:mm12-blender-bootcamp-v2:-']);
  assert.equal(comCards.filter(x => x.course_id === 'COM11').length, 3);
  assert.equal(new Set(mmCards.map(x => x.assignment_key)).size, mmCards.length);
  assert.equal(new Set(comCards.map(x => x.assignment_key)).size, comCards.length);
});

test('Apps Script (mocked): Camera Licence gates require matching teacher-confirmed checkpoints', () => {
  const teacherForm='1Veo5GlNG8CKQ_tux1Bh8u1NzuRAAt0drurYyd0yXuF0';
  const row = (email,verified,type,step,form=teacherForm) => ['2026-09-30T12:00:00Z',email,'Synthetic','MM12','camera-lab-photo-desk-v1',
    'camera-lab-photo-desk-v1:step-'+step,type,'PS-CAM-01','MM12-1.1','','','','','',verified,form,'synthetic-'+step,''];
  const steps=[2,4,5,6,7,8,10];
  const partial=world({multiCourseRoster:true,confirmedEvidenceRows:[row(A,true,'Observation',2),row(A,false,'Observation',4),row(A,true,'Knowledge',5),row(B,true,'Observation',6)]});
  const first=partial.call(A,'studentDashboard',{}).result.courses.find(x=>x.course_id==='MM12').achievement.badges.map(x=>x.title);
  assert.ok(first.includes('Camera Licence Level 1'));
  assert.equal(first.includes('Camera Licence Level 2'),false);
  assert.equal(first.includes('Camera Licence Level 3'),false);
  const wrongForm=world({multiCourseRoster:true,confirmedEvidenceRows:[row(A,true,'Observation',2,'1_IERfxTOXOJgzP7fkggA4VADbtWz3771iyNByciDdM8')]});
  assert.equal(wrongForm.call(A,'studentDashboard',{}).result.courses.find(x=>x.course_id==='MM12').achievement.badges.some(x=>x.title==='Camera Licence Level 1'),false);
  const complete=world({multiCourseRoster:true,confirmedEvidenceRows:steps.map(n=>row(A,true,n===10?'Product':'Observation',n))});
  const badges=complete.call(A,'studentDashboard',{}).result.courses.find(x=>x.course_id==='MM12').achievement.badges.map(x=>x.title);
  assert.ok(badges.includes('Camera Licence Level 1'));
  assert.ok(badges.includes('Camera Licence Level 2'));
  assert.ok(badges.includes('Camera Licence Level 3'));
  const other=complete.call(B,'studentDashboard',{}).result.courses.find(x=>x.course_id==='COM11').achievement.badges.map(x=>x.title);
  assert.equal(other.some(x=>/^Camera Licence/.test(x)),false);
  const comRow=['2026-09-30T12:00:00Z',B,'Synthetic','COM11','camera-lab-photo-desk-v1',
    'camera-lab-photo-desk-v1:step-2','Observation','PS-CAM-01','COM11-2-1','','','','','',true,teacherForm,'synthetic-com11-step-2',''];
  const shared=world({multiCourseRoster:true,confirmedEvidenceRows:[comRow]});
  assert.equal(shared.call(B,'studentDashboard',{}).result.courses.find(x=>x.course_id==='COM11').achievement.badges.some(x=>x.title==='Camera Licence Level 1'),true);
  assert.equal(shared.call(A,'studentDashboard',{}).result.courses.find(x=>x.course_id==='MM12').achievement.badges.some(x=>x.title==='Camera Licence Level 1'),false);
});

test('Apps Script (mocked): dashboard badges use only this learner’s teacher-confirmed, crosswalk-valid evidence', () => {
  const rows = [
    ['2026-11-03T12:00:00Z', A, 'A', 'IBDS', 'IBDS-SERVICE-OFFLINE', 'ibds-26-s04-d07', 'Teacher evidence', '', 'DS-U02-005', '', '', '', '', '', true, 'form-a', 'response-a', ''],
    ['2026-11-03T12:01:00Z', A, 'A', 'IBDS', 'IBDS-SERVICE-OFFLINE', 'ibds-26-s04-d09', 'Teacher evidence', '', 'DS-U02-006', '', '', '', '', '', false, 'form-a', 'response-b', ''],
    ['2026-11-03T12:02:00Z', B, 'B', 'IBDS', 'IBDS-SERVICE-OFFLINE', 'ibds-26-s04-d09', 'Teacher evidence', '', 'DS-U02-006', '', '', '', '', '', true, 'form-b', 'response-c', ''],
    ['2026-11-03T12:03:00Z', A, 'A', 'IBDS', 'IBDS-SERVICE-OFFLINE', 'ibds-26-s04-d09', 'Knowledge', '', 'DS-U02-006', '', '1', '', '', '', true, 'form-a', 'response-d', ''],
    ['2026-11-03T12:04:00Z', A, 'A', 'IBDS', 'IBDS-SERVICE-OFFLINE', 'ibds-26-s04-d09', 'Teacher evidence', '', 'NOT-A-REAL-OUTCOME', '', '', '', '', '', true, 'form-a', 'response-e', '']
  ];
  const w = world({ confirmedEvidenceRows: rows });
  const dashboard = w.call(A, 'studentDashboard', {});
  assert.equal(dashboard.ok, true, JSON.stringify(dashboard.error));
  const ibds = dashboard.result.courses.find(x => x.course_id === 'IBDS');
  assert.deepEqual(JSON.parse(JSON.stringify(ibds.achievement.badges.map(x => x.outcome_id))), ['ds-u02-005']);
  const text = JSON.stringify(dashboard.result);
  assert.equal(text.includes('student.b@'), false);
  assert.equal(text.includes('response-c'), false);
  assert.equal(text.includes('DS-U02-006'), false, 'unconfirmed, knowledge-only and another learner rows do not award badges');
  const keys = [];
  (function collect(value) { if (!value || typeof value !== 'object') return; Object.keys(value).forEach(k => { keys.push(k); collect(value[k]); }); })(dashboard.result);
  for (const forbidden of ['auto_score', 'level', 'independence', 'teacher_note', 'prediction', 'student_email']) assert.equal(keys.includes(forbidden), false, forbidden);
});

test('Apps Script (mocked): first visit creates only the private store and connects the existing roster read-only', () => {
  const w = world({ fresh: true });
  w.ctx.__email = 'owner.teacher@synthetic.example.test';
  const page = w.ctx.doGet();
  assert.equal(page.content, 'FILE:Index', 'owner lands on the app after setup');
  assert.equal(w.created(), 1, 'only the owner-private store is created');
  assert.ok(w.props.SOS_STORE_SPREADSHEET_ID && w.props.SOS_ROSTER_SPREADSHEET_ID);
  assert.equal(w.props.SOS_ROSTER_SPREADSHEET_ID, REAL_ROSTER_ID, 'existing Technology Evidence System roster is referenced in place');
  assert.equal(w.props.SOS_PILOT_ALLOWLIST_JSON, '[]', 'student pilot access starts empty');
  assert.equal(JSON.parse(w.props.SOS_TEACHERS_JSON)['owner.teacher@synthetic.example.test'].courses.length, 3);
  w.ctx.doGet(); assert.equal(w.created(), 1, 'second visit does not create more files');
  const me = w.call('owner.teacher@synthetic.example.test', 'whoami', {});
  assert.equal(me.result.kind, 'teacher');
  assert.equal(w.call('student.x@synthetic.example.test', 'whoami', {}).error.code, 'DENIED', 'unrostered account remains denied');
});

test('Apps Script (mocked): an existing pilot store is migrated off the copied test roster without creating or copying data', () => {
  const w = world();
  delete w.props.SOS_PILOT_ALLOWLIST_JSON;
  assert.equal(w.props.SOS_ROSTER_SPREADSHEET_ID, 'tes-id', 'fixture starts on the old pilot pointer');
  w.ctx.__email = T;
  assert.equal(w.ctx.doGet().content, 'FILE:Index');
  assert.equal(w.props.SOS_ROSTER_SPREADSHEET_ID, REAL_ROSTER_ID);
  assert.equal(w.props.SOS_PILOT_ALLOWLIST_JSON, '[]');
  assert.equal(w.created(), 0, 'existing store remains and no roster copy is created');
  assert.equal(w.call(A, 'whoami', {}).error.code, 'DENIED', 'migration leaves all students denied until named');
});

test('Apps Script (mocked): teacher preview switches to a practice student and back', () => {
  const w = world();
  const T = 'teacher.demo@synthetic.example.test';
  assert.equal(w.call(A, 'setPreview', { course_id: 'IBDS' }).error.code, 'FORBIDDEN', 'students cannot preview');
  assert.equal(w.call(T, 'setPreview', { course_id: 'MM12' }).error.code, 'FORBIDDEN', 'only own courses');
  assert.equal(w.call(T, 'setPreview', { course_id: 'IBDS' }).ok, true);
  const me = w.call(T, 'whoami', {}).result;
  assert.equal(me.kind, 'student'); assert.equal(me.preview, true);
  assert.equal(w.call(T, 'listAssignments', {}).result.every(a => a.course_id === 'IBDS'), true);
  w.call(T, 'setPreview', { course_id: null });
  assert.equal(w.call(T, 'whoami', {}).result.kind, 'teacher');
});

test('Apps Script (mocked): support preferences use authorized identity, locked storage and a separate support stream', () => {
  const w = world();
  const beforeLocks = w.locks.taken;
  const saved = w.call(A, 'setStudentSupports', { course_id: 'IBDS', sprint_id: 'ibds-26-s04', supports: ['today', 'audio'] });
  assert.equal(saved.ok, true, JSON.stringify(saved.error));
  assert.deepEqual(JSON.parse(JSON.stringify(saved.result.effective)).sort(), ['audio', 'today']);
  assert.ok(w.locks.taken > beforeLocks, 'support preference write used LockService');
  assert.equal(w.call(B, 'studentSupports', { course_id: 'IBDS', sprint_id: 'ibds-26-s04' }).result.effective.length, 0,
    'another student cannot see the first student support settings');
  assert.equal(w.call(A, 'setStudentSupports', { course_id: 'IBDS', sprint_id: 'ibds-26-s04', supports: ['today'], learner_id: 'syn-learner-b' }).error.code, 'READ_ONLY',
    'a request-body learner ID is rejected');

  const event = w.call(A, 'logSupportUse', { course_id: 'IBDS', sprint_id: 'ibds-26-s04', lesson_id: 'ibds-26-s04-d01', support_id: 'audio', action: 'read_aloud' });
  assert.deepEqual(JSON.parse(JSON.stringify(event.result)), { recorded: true, stream: 'support', achievement: false });
  const stored = JSON.parse(w.store.sheets.SOS_supportevent.data[1][5]);
  assert.equal(stored.learner_id, 'syn-learner-a');
  assert.equal(stored.stream, 'support');
  assert.equal(stored.achievement, false);
  assert.equal(stored.prediction_eligible, false);
});

test('Apps Script (mocked): only an authorized teacher can assign supports or create a locked custom draft', () => {
  const w = world();
  const denied = w.call(A, 'setTeacherSupports', { learner_id: 'syn-learner-b', course_id: 'IBDS', sprint_id: 'ibds-26-s04', scope: 'sprint', supports: ['frames'] });
  assert.equal(denied.error.code, 'FORBIDDEN');
  const set = w.call(T, 'setTeacherSupports', { learner_id: 'syn-learner-a', course_id: 'IBDS', sprint_id: 'ibds-26-s04', scope: 'sprint', supports: ['frames'] });
  assert.equal(set.ok, true, JSON.stringify(set.error));
  const draft = w.call(T, 'createCustomVersionDraft', { learner_id: 'syn-learner-a', course_id: 'IBDS', sprint_id: 'ibds-26-s04', note: 'Use shorter chunks.' });
  assert.equal(draft.ok, true, JSON.stringify(draft.error));
  assert.equal(draft.result.status, 'pending_approval');
  assert.equal(draft.result.release_state, 'draft_only');
  assert.deepEqual(JSON.parse(JSON.stringify(draft.result.locks)), { question_text: true, question_ids: true, assessed_tasks: true, task_ids: true });
});

 test('Apps Script (mocked): teacher module settings use authenticated own learner and preserve journals during outage',()=>{
 const rules=[{id:'fixture-off',target_type:'sprint',target_id:'ibds-26-s04',audience_type:'student',audience_id:'syn-learner-a',state:'hidden',required:false}];
 const w=world({moduleSettings:{'syn-learner-a':rules}});
 const mine=w.call(A,'listAssignments',{learner_id:'syn-learner-b'});assert.equal(mine.ok,true);assert.equal(mine.result.length,0);
 assert.equal(w.call(B,'listAssignments',{}).result.length>0,true);
 const requests=w.fetched.filter(x=>x.includes('action=module-access'));assert.equal(new URL(requests[0]).searchParams.get('learner_id'),'syn-learner-a');
 const outage=world({moduleUnavailable:true});assert.equal(outage.call(A,'listAssignments',{}).ok,false);assert.equal(outage.call(A,'listEntries',{}).ok,true);
 });

test('Apps Script (mocked): explicit On releases an already hosted registered module while inherit keeps unlisted work hidden',()=>{
 const target=releaseCatalogue.assignments.find(a=>a.ref.sprint_id==='mm12-26-s08');assert.ok(target);
 const r={id:'fixture-on',target_type:'sprint',target_id:target.ref.sprint_id,audience_type:'student',audience_id:'syn-learner-a',state:'open',required:true};
 const fetch=(url)=>({getResponseCode:()=>url===target.workbook_url.split('#')[0]?200:404,getContentText:()=>'<html><body>Published workbook</body></html>'});
 const w=world({multiCourseRoster:true,moduleSettings:{'syn-learner-a':[r]},fetch,releasePages:{[target.workbook_url.split('#')[0]]:'<html><body>Published workbook</body></html>'}});
 assert.equal(w.call(A,'listAssignments',{}).result.some(a=>a.assignment_key===target.assignment_key),true);
 const missing=world({multiCourseRoster:true,moduleSettings:{'syn-learner-a':[r]}});assert.equal(missing.call(A,'listAssignments',{}).result.some(a=>a.assignment_key===target.assignment_key),false);
});
