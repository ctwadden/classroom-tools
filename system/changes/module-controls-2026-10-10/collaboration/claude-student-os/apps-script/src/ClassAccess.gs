/** Pre-access identity proof. Never reads a journal, gradebook, submission or feedback. */
function sosSchoolIdentity_() {
  var email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  var cfg = sosConfig_();
  var identity = SOS.resolveIdentity(email, sosRoster_(), cfg.teachers);
  if (identity.kind !== 'student') throw SOS.SosError('FORBIDDEN', 'This check needs a student school account. Teacher preview does not count.', 403);
  return { email: email, identity: identity, cfg: cfg };
}

function sosCheckSchoolSignIn_() {
  var own = sosSchoolIdentity_(), at = new Date().toISOString();
  PropertiesService.getScriptProperties().setProperty('SOS_SIGNIN_CHECK:' + sosSha256_(own.email), JSON.stringify({
    schema: 1, learner_id: own.identity.learner_id, courses: own.identity.courses, checked_at: at
  }));
  return { display_name: own.identity.display_name, courses: own.identity.courses, checked_at: at,
    workspace_enabled: own.cfg.pilotAllowlist.indexOf(own.email) >= 0,
    message: 'Google supplied your school identity and it matched one active learner. No work or marks were loaded.' };
}

function sosSignInCheckPage_() {
  return HtmlService.createHtmlOutputFromFile('SignInCheck').setTitle('Student OS · School account check')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Count-only owner report. Hashes existing storage without creating tabs or reading work into logs. */
function auditStudentClassAccess() {
  var teacher = sosRealIdentity_();
  if (teacher.kind !== 'teacher') throw SOS.SosError('FORBIDDEN', 'Teacher access check only.', 403);
  var cfg = sosConfig_(), roster = sosRoster_(), props = PropertiesService.getScriptProperties();
  var report = { courses: {}, evidence_mode: cfg.evidenceMode, store: {} };
  teacher.courses.forEach(function (course) {
    var emails = {}, eligible = 0, checked = 0, enabled = 0, conflicts = 0;
    roster.filter(function (r) { return r.active && r.course_id === course; }).forEach(function (r) { emails[r.student_email] = true; });
    Object.keys(emails).forEach(function (email) {
      try {
        var identity = SOS.resolveIdentity(email, roster, cfg.teachers); eligible++;
        if (cfg.pilotAllowlist.indexOf(email) >= 0) enabled++;
        if (sosValidSignInProof_(props.getProperty('SOS_SIGNIN_CHECK:' + sosSha256_(email)), identity)) checked++;
      } catch (e) { conflicts++; }
    });
    report.courses[course] = { eligible_students: eligible, checked_school_sessions: checked, enabled_students: enabled, roster_conflicts: conflicts };
  });
  var ss = SpreadsheetApp.openById(cfg.storeId);
  SOS_REPO_KINDS.forEach(function (kind) {
    var sh = ss.getSheetByName('SOS_' + kind);
    var values = sh ? sh.getDataRange().getValues() : [];
    report.store[kind] = { rows: Math.max(0, values.length - 1), sha256: sosSha256_(JSON.stringify(values)) };
  });
  console.log(JSON.stringify(report)); return report;
}

function sosValidSignInProof_(raw, identity) {
  try {
    var p = JSON.parse(raw || 'null'), age = p && Date.now() - Date.parse(p.checked_at);
    return !!p && p.schema === 1 && p.learner_id === identity.learner_id && age >= 0 && age < 86400000 &&
      Array.isArray(p.courses) && identity.courses.every(function (c) { return p.courses.indexOf(c) >= 0; });
  } catch (e) { return false; }
}

/** Editor-only launch preparation: two genuine sessions are necessary, not sufficient for class release.
 * No public RPC can enroll a class. The coordinator still verifies drafts, isolation and module behavior.
 * The existing email allowlist opens all of each learner's existing roster courses; it never grants another learner's data.
 */
function sosPrepareClassAccess_(course) {
  var teacher = sosRealIdentity_();
  if (teacher.kind !== 'teacher' || teacher.courses.indexOf(course) < 0) throw SOS.SosError('FORBIDDEN', 'This class is not assigned to you.', 403);
  var cfg = sosConfig_(), roster = sosRoster_(), emails = {}, checked = 0, props = PropertiesService.getScriptProperties();
  roster.filter(function (r) { return r.active && r.course_id === course; }).forEach(function (r) {
    var identity = SOS.resolveIdentity(r.student_email, roster, cfg.teachers);
    emails[r.student_email] = identity;
  });
  Object.keys(emails).forEach(function (email) {
    if (sosValidSignInProof_(props.getProperty('SOS_SIGNIN_CHECK:' + sosSha256_(email)), emails[email])) checked++;
  });
  if (checked < 2) throw SOS.SosError('DENIED', 'Two students must complete the school-account check in the last 24 hours before class access can be prepared.', 401);
  // Return privately to the owner/coordinator; do not log this email list or expose it in a web response.
  return { course_id: course, checked_sessions: checked, prior_allowlist: cfg.pilotAllowlist,
    proposed_allowlist: cfg.pilotAllowlist.concat(Object.keys(emails).filter(function (email) { return cfg.pilotAllowlist.indexOf(email) < 0; })) };
}
