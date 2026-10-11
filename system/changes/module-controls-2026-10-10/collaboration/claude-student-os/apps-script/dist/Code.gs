/**
 * Student OS — Apps Script pilot source. The production deployment may lag this local source;
 * check SYSTEM_COORDINATION.md and the release audit before pushing or redeploying.
 *
 * Deployment model (see DATA_CONTRACT.md §Authentication):
 *   Standalone project owned by the teacher account · Execute as: Me (USER_DEPLOYING) · Access: anyone in the school domain.
 *   Students never receive access to any spreadsheet. The script reads the EXISTING Roster server-side and stores
 *   Student OS records in a private, owner-only store. Identity = Session.getActiveUser().getEmail(), which Google
 *   documents as available when the user and script owner are in the same Workspace domain. This must be proven
 *   with two designated school accounts before any class use; an empty email always denies.
 *
 * Files: Code.gs (entry points) · Config.gs · SheetRepo.gs · Adapters.gs · SosCore.gs / SosAdapters.gs (generated copies
 * of core/*.js — do not edit here) · Index.html (generated from web/).
 */

var SOS_RPC_METHODS = ['setPreview', 'whoami', 'home', 'studentDashboard', 'readFeedback', 'listAssignments', 'getAssignment', 'listEntries', 'getEntry', 'getRevision', 'createEntry', 'updateEntry',
  'submitEntry', 'addReply', 'editComment', 'listCards', 'addAssignmentCard', 'createCard', 'updateCard', 'moveCard', 'portfolioPreview',
  'listForms', 'saveExitNote', 'myExitNotes', 'teacherExitNotes', 'quizFeedback', 'listReview', 'addReviewItem', 'updateReviewItem', 'reviewResult', 'createDiscussion', 'setDiscussionStatus', 'listDiscussions', 'getDiscussion', 'postDiscussionComment', 'editDiscussionComment', 'hideDiscussionComment', 'setAudience', 'publishEntry', 'classFeed', 'setClassHidden', 'listPrompts', 'teacherPrompts', 'createPrompt', 'skipWeekly', 'setWeeklyDefault', 'feedbackInbox', 'teacherQueue', 'markReviewed', 'addFeedback', 'releaseFeedback', 'teacherActivity',
  'studentSupports', 'setStudentSupports', 'logSupportUse', 'teacherAdaptations', 'setTeacherSupports', 'createCustomVersionDraft',
  'teacherResultCandidates', 'setResultRelease'];

function doGet(request) {
  if (request && request.parameter && request.parameter.check === 'signin') return sosSignInCheckPage_();
  var identity, setupError = null;
  try { sosEnsureSetup_(); } catch (e) { setupError = e; console.error('Student OS setup failed: ' + (e && e.stack || e)); }
  try {
    identity = sosIdentity_();
  } catch (e) {
    if (setupError) return sosDeniedPage_('Student OS could not finish its first-time setup: ' + (setupError.message || setupError) + '. Open the Apps Script editor and run setupStudentOS once.');
    return sosDeniedPage_(e && e.name === 'SosError' ? e.message : 'Student OS could not confirm your school account.');
  }
  var out = HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Student OS · Learning Studio')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
  // Embedding in a Google Site requires ALLOWALL; keep it off until the embed test is approved (CR-SOS-5).
  if (sosConfig_().allowEmbed) out.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return out;
}

/** Single RPC entry point for google.script.run. Never throws: returns {ok,result} or {ok:false,error}. */
function rpc(method, args) {
  try {
    // This pre-access check uses Google's real session and returns only the caller's identity.
    // It neither opens the workspace nor accepts a learner/email supplied by the browser.
    if (method === 'checkSchoolSignIn') {
      if (args && (typeof args !== 'object' || Array.isArray(args) || Object.keys(args).length)) throw SOS.SosError('INVALID', 'The account check does not accept identity fields.', 400);
      return { ok: true, result: sosCheckSchoolSignIn_() };
    }
    if (SOS_RPC_METHODS.indexOf(method) < 0) throw SOS.SosError('NOT_FOUND', 'Unknown action.', 404);
    if (args !== undefined && (args === null || typeof args !== 'object' || Array.isArray(args))) throw SOS.SosError('INVALID', 'Invalid request.', 400);
    if (method === 'setPreview') return { ok: true, result: sosSetPreview_(args || {}) };
    if (method === 'teacherResultCandidates') return { ok: true, result: sosTeacherResultCandidates_(sosRealIdentity_(), args || {}) };
    if (method === 'setResultRelease') return { ok: true, result: sosSetResultRelease_(sosRealIdentity_(), args || {}) };
    var identity = sosIdentity_(); // resolved on EVERY call from the authenticated session, never from args
    var service = sosService_();
    return { ok: true, result: service[method](identity, args || {}) };
  } catch (e) {
    if (!e || e.name !== 'SosError') console.error('Student OS error in ' + method + ': ' + (e && e.stack || e));
    return SOS.errorPayload(e);
  }
}

function sosRealIdentity_() {
  var email = '';
  try { email = Session.getActiveUser().getEmail(); } catch (e) { email = ''; }
  var cfg = sosConfig_();
  var normalizedEmail = String(email || '').trim().toLowerCase();
  var identity = SOS.resolveIdentity(normalizedEmail, sosRoster_(), cfg.teachers);
  if (identity.kind === 'student' && cfg.pilotAllowlist.indexOf(normalizedEmail) < 0) {
    throw SOS.SosError('DENIED', 'Student OS pilot access has not been enabled for this account. Nothing private was loaded.', 401);
  }
  return identity;
}
/** Teacher "view as student": a server-side setting per teacher, never taken from the request as identity. */
function sosIdentity_() {
  var id = sosRealIdentity_();
  if (id.kind === 'teacher') {
    var c = PropertiesService.getScriptProperties().getProperty('SOS_PREVIEW:' + id.email);
    if (c && id.courses.indexOf(c) >= 0) return SOS.previewIdentity(id, c);
  }
  return id;
}
function sosSetPreview_(args) {
  var id = sosRealIdentity_();
  if (id.kind !== 'teacher') throw SOS.SosError('FORBIDDEN', 'Only a teacher can preview the student view.', 403);
  var p = PropertiesService.getScriptProperties(), key = 'SOS_PREVIEW:' + id.email;
  if (!args.course_id) { p.deleteProperty(key); return { course_id: null }; }
  if (id.courses.indexOf(args.course_id) < 0) throw SOS.SosError('FORBIDDEN', 'That course is not assigned to you.', 403);
  p.setProperty(key, args.course_id);
  return { course_id: args.course_id };
}

var SOS_SERVICE_ = null;
function sosService_() {
  if (SOS_SERVICE_) return SOS_SERVICE_;
  var cfg = sosConfig_();
  SOS_SERVICE_ = SOS.createService({
    repo: SheetRepo_(cfg.storeId),
    adapters: sosAdapters_(cfg),
    roster: sosRoster_(),
    sha256: sosSha256_,
    uuid: function () { return Utilities.getUuid(); },
    now: function () { return new Date().toISOString(); }
  });
  return SOS_SERVICE_;
}

function sosSha256_(text) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

/** Canonicalizes the existing course values at the Student OS read boundary. */
function sosNormalizeCourseId_(value) {
  var raw = String(value || '').trim();
  var compact = raw.toUpperCase().replace(/[^A-Z0-9]+/g, '');
  if (compact === 'IBDS' || compact === 'IBDS11' || compact === 'IBDSSL' || compact === 'IBDIGITALSOCIETY' || compact === 'DIGITALSOCIETY') return 'IBDS';
  if (compact === 'MM12' || compact === 'MULTIMEDIA12') return 'MM12';
  if (compact === 'COM11' || compact === 'COMM11' || compact === 'CT11' || compact === 'COMMUNICATIONTECHNOLOGY11') return 'COM11';
  return raw.toUpperCase();
}

function sosNormalizeActive_(value) {
  if (value === true) return true;
  var token = String(value === null || value === undefined ? '' : value).trim().toLowerCase();
  return token === 'true' || token === 'yes' || token === 'y' || token === '1' || token === 'active';
}

/**
 * Reads the EXISTING Technology Evidence System Roster (read-only). Requires the learner_id column that
 * ConnectedEvidence.js ecRoster_() already maintains. Rows without learner_id are ignored (never guessed).
 * Cached for 60 seconds so a deactivated learner loses access within a minute.
 */
function sosRoster_() {
  var cfg = sosConfig_();
  var cache = CacheService.getScriptCache();
  var cacheKey = 'sos-roster-v3:' + cfg.rosterSpreadsheetId;
  var hit = cache.get(cacheKey);
  if (hit) return JSON.parse(hit);
  var sh = SpreadsheetApp.openById(cfg.rosterSpreadsheetId).getSheetByName('Roster');
  if (!sh) throw SOS.SosError('DENIED', 'Student OS is not configured (roster missing).', 401);
  var values = sh.getDataRange().getValues();
  var head = values.shift().map(String);
  var col = function (n) { return head.indexOf(n); };
  ['student_name', 'student_email', 'course_id', 'active', 'learner_id'].forEach(function (n) {
    if (col(n) < 0) throw SOS.SosError('DENIED', 'Student OS is not configured (roster column ' + n + ' missing).', 401);
  });
  var rows = values.map(function (r) {
    return { student_name: String(r[col('student_name')] || ''), student_email: String(r[col('student_email')] || '').trim().toLowerCase(),
      course_id: sosNormalizeCourseId_(r[col('course_id')]), active: sosNormalizeActive_(r[col('active')]),
      learner_id: String(r[col('learner_id')] || '').trim() };
  }).filter(function (r) {
    // A teacher may have a legacy integration/QA row in the shared Roster. Explicit teacher authorization wins,
    // and that account is removed from learner matching and class totals. This does not grant student access:
    // every other student still needs an active Roster row and the separate pilot allowlist.
    return r.student_email && r.learner_id && !Object.prototype.hasOwnProperty.call(cfg.teachers, r.student_email);
  });
  try { cache.put(cacheKey, JSON.stringify(rows), 60); } catch (e) { /* too large to cache: read each time */ }
  return rows;
}

/** Count-only roster diagnostic. Never returns names, emails or learner IDs. */
function sosRosterDiagnostics() {
  var cfg = sosConfig_();
  var sh = SpreadsheetApp.openById(cfg.rosterSpreadsheetId).getSheetByName('Roster');
  if (!sh) throw new Error('Roster tab missing.');
  var values = sh.getDataRange().getValues();
  var head = values.shift().map(String);
  var col = function (n) { return head.indexOf(n); };
  var required = ['student_email', 'course_id', 'active', 'learner_id'];
  var missingColumns = required.filter(function (n) { return col(n) < 0; });
  if (missingColumns.length) return { missing_columns: missingColumns, total_rows: values.length };
  var byCourse = {}, byActive = {}, blankLearnerId = 0, blankEmail = 0, ibdsLike = 0, currentAcceptedIbds = 0;
  values.forEach(function (r) {
    var course = String(r[col('course_id')] || '').trim();
    var courseLabel = course || '[blank]';
    var courseKey = course.toUpperCase().replace(/[^A-Z0-9]+/g, '');
    if (courseKey.indexOf('IBDS') !== 0 && courseKey.indexOf('DIGITALSOCIETY') < 0) return;
    ibdsLike += 1;
    byCourse[courseLabel] = (byCourse[courseLabel] || 0) + 1;
    var rawActive = r[col('active')];
    var activeLabel = rawActive === '' || rawActive === null ? '[blank]' : String(rawActive).trim() || '[blank]';
    byActive[activeLabel] = (byActive[activeLabel] || 0) + 1;
    if (!String(r[col('learner_id')] || '').trim()) blankLearnerId += 1;
    if (!String(r[col('student_email')] || '').trim()) blankEmail += 1;
    if (course === 'IBDS' && sosNormalizeActive_(rawActive) && String(r[col('learner_id')] || '').trim() && String(r[col('student_email')] || '').trim()) currentAcceptedIbds += 1;
  });
  var result = { missing_columns: [], total_rows: values.length, ibds_like_rows: ibdsLike, course_id_counts: byCourse,
    active_value_counts: byActive, blank_learner_id: blankLearnerId, blank_student_email: blankEmail,
    current_exact_filter_count: currentAcceptedIbds, pilot_allowlist_count: cfg.pilotAllowlist.length };
  console.log(JSON.stringify(result));
  return result;
}

function sosDeniedPage_(message) {
  var safe = String(message).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; });
  return HtmlService.createHtmlOutput('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<div style="font:17px/1.6 system-ui;max-width:560px;margin:60px auto;padding:0 20px"><h1 style="font-family:Georgia,serif">Access denied</h1>' +
    '<p>' + safe + '</p><p>Student OS opens only for signed-in school accounts on an active class roster. Nothing private was loaded.</p></div>')
    .setTitle('Student OS · Access denied');
}

/** Teacher-only, read-only connection receipt. No credentials or learner records are logged. */
function auditModuleConnection() {
  var id=sosRealIdentity_();
  if(id.kind!=='teacher')throw SOS.SosError('FORBIDDEN','Teacher connection check only.',403);
  var cfg=sosConfig_(),base=String(cfg.ingestUrl||'').split('?')[0];
  if(!base||!cfg.ingestSecret)throw new Error('Existing evidence integration is not configured.');
  var status=UrlFetchApp.fetch(base+'?action=status',{muteHttpExceptions:true,headers:{Authorization:'Bearer '+cfg.ingestSecret}});
  if(status.getResponseCode()!==200)throw new Error('Existing evidence connection did not authenticate: HTTP '+status.getResponseCode());
  var report={pilot_accounts_enabled:cfg.pilotAllowlist.length,integration_role:JSON.parse(status.getContentText()).role,courses:{}};
  id.courses.forEach(function(c){
    var access=UrlFetchApp.fetch(base+'?action=module-access&course_id='+encodeURIComponent(c)+'&preview=class',{muteHttpExceptions:true,headers:{Authorization:'Bearer '+cfg.ingestSecret}});
    var settings=access.getResponseCode()===200?JSON.parse(access.getContentText()):null;
    report.courses[c]={module_status:access.getResponseCode(),module_connected:!!settings&&settings.schema==='learning-studio.module-controls.v1',class_rules:settings?settings.rules.length:null};
  });
  console.log(JSON.stringify(report));return report;
}
