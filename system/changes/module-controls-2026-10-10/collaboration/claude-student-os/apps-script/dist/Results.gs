/** Teacher-controlled result release. These two existing Sheets are the only release authorities. */
var SOS_DS_GRADEBOOK_ID = '1S-XxuBfuvq9vM3Ms6DvYRVsrA6gziaviUJ4YVJM_4AY';
var SOS_RELEASE_HEADER = 'Released to student';
var SOS_RELEASE_AT_HEADER = 'Released at';

function sosReleased_(value) { return value === true; }
function sosVerified_(value) { return value === true || /^(true|yes)$/i.test(String(value || '').trim()); }
function sosResultHeaders_(sheet, row) {
  var head = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var col = function (name) { var n = head.indexOf(name); if (n < 0) throw SOS.SosError('SERVER', 'Result source is missing ' + name, 500); return n; };
  col(SOS_RELEASE_HEADER); col(SOS_RELEASE_AT_HEADER);
  return col;
}
function sosResultDate_(value) { return value instanceof Date ? value.toISOString() : String(value || ''); }
function sosRaw_(value) {
  if (value === '' || value === null || value === undefined) return null;
  var n = Number(value); return isFinite(n) && n >= 0 ? n : null;
}
function sosScore_(value) {
  var match = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(String(value || '').trim());
  if (match) return { earned: Number(match[1]), possible: Number(match[2]) };
  var n = sosRaw_(value); return n === null ? null : { earned: n, possible: 1 };
}
function sosGradebookSheet_() { return SpreadsheetApp.openById(SOS_DS_GRADEBOOK_ID).getSheetByName('Evidence Log'); }
function sosKnowledgeSheet_(cfg) { return SpreadsheetApp.openById(cfg.rosterSpreadsheetId).getSheetByName('Evidence_Log'); }
function sosDsMisses_(cfg, learnerId, evidenceId, taskId) {
  var receipts = SpreadsheetApp.openById(cfg.rosterSpreadsheetId).getSheetByName('DS Capture Receipts');
  if (!receipts || receipts.getLastRow() < 2) return [];
  var c = sosResultHeadersLite_(receipts), rows = receipts.getDataRange().getValues(); rows.shift();
  var row = rows.filter(function (r) { return String(r[c('record_id')]) === evidenceId && String(r[c('learner_id')]) === learnerId &&
    String(r[c('task_id')]) === taskId && String(r[c('status')]) === 'confirmed' && r[c('qa')] !== true; });
  if (row.length !== 1) return [];
  var payload; try { payload = JSON.parse(String(row[0][c('payload_json')] || '')); } catch (e) { return []; }
  if (payload.role !== 'quiz' || payload.record_id !== evidenceId || payload.learner_id !== learnerId || payload.task_id !== taskId) return [];
  var forms = SOS_DS_QUIZ_FORMS.filter(function (f) { return f.instrument === payload.instrument && f.task_id === taskId; });
  if (forms.length !== 1) return [];
  var answers; try { answers = JSON.parse(String(payload.content || '')); } catch (e) { return []; }
  return forms[0].items.filter(function (q) { return String(answers[q.id] == null ? '' : answers[q.id]).trim() !== String(q.choices[q.correct] == null ? '' : q.choices[q.correct]).trim(); })
    .map(function (q) { return q.id + ' · ' + q.prompt; });
}
function sosResultHeadersLite_(sheet) {
  var h = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  return function (name) { var n = h.indexOf(name); if (n < 0) throw SOS.SosError('SERVER', 'Receipt source is missing ' + name, 500); return n; };
}

/** Never copy a whole source row to the client. Filter identity, course, verification and release first. */
function sosReleasedResults_(cfg, learnerId, courses) {
  var email = sosLearnerEmail_(learnerId, courses);
  if (!email) return [];
  var out = [];
  if (courses.indexOf('IBDS') >= 0) {
    var ds = sosGradebookSheet_();
    if (ds && ds.getLastRow() >= 5) {
      var dc = sosResultHeaders_(ds, 4), values = ds.getRange(5, 1, ds.getLastRow() - 4, ds.getLastColumn()).getValues();
      values.forEach(function (r) {
        if (String(r[dc('Student ID')] || '').trim() !== learnerId || !sosReleased_(r[dc(SOS_RELEASE_HEADER)]) || !sosVerified_(r[dc('Teacher verified?')])) return;
        var evidenceId = String(r[dc('Evidence ID')] || '').trim(), taskId = String(r[dc('Task ID')] || '').trim();
        if (!evidenceId || !taskId) return;
        out.push({ learner_id: learnerId, course_id: 'IBDS', task_id: taskId, source_id: evidenceId, title: taskId,
          raw_earned: sosRaw_(r[dc('Raw mark')]), raw_possible: sosRaw_(r[dc('Maximum')]),
          approved_feedback: String(r[dc('Teacher-approved feedback')] || ''), missed_questions: sosDsMisses_(cfg, learnerId, evidenceId, taskId),
          released_at: sosResultDate_(r[dc(SOS_RELEASE_AT_HEADER)]), released: true });
      });
    }
  }
  if (courses.indexOf('MM12') >= 0 || courses.indexOf('COM11') >= 0) {
    var sh = sosKnowledgeSheet_(cfg);
    if (sh && sh.getLastRow() >= 2) {
      var c = sosResultHeaders_(sh, 1), rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
      rows.forEach(function (r) {
        var course = sosNormalizeCourseId_(r[c('course_id')]);
        if (courses.indexOf(course) < 0 || course === 'IBDS' || String(r[c('student_email')] || '').trim().toLowerCase() !== email ||
            !sosReleased_(r[c(SOS_RELEASE_HEADER)]) || !sosVerified_(r[c('teacher_verified')]) || String(r[c('evidence_type')]).toLowerCase() !== 'knowledge') return;
        var task = String(r[c('canonical_id')] || '').trim(), project = String(r[c('project_id')] || '').trim();
        var score = sosScore_(r[c('auto_score')]);
        if (!task || !project || !score) return;
        var source = [r[c('source_form_id')], r[c('source_response_id')], task].map(String).join(':');
        out.push({ learner_id: learnerId, course_id: course, task_id: task, source_id: source, title: project + ' · ' + task,
          raw_earned: score.earned, raw_possible: score.possible, approved_feedback: String(r[c('teacher_note')] || ''),
          missed_questions: score.earned < score.possible ? ['Review question ' + task] : [],
          released_at: sosResultDate_(r[c(SOS_RELEASE_AT_HEADER)]), released: true });
      });
    }
  }
  return out;
}

/** Teacher-only list for the selected roster learner; no draft feedback or prediction fields. */
function sosTeacherResultCandidates_(id, args) {
  if (id.kind !== 'teacher') throw SOS.SosError('FORBIDDEN', 'Teacher account required.', 403);
  var course = sosNormalizeCourseId_(args.course_id), learner = String(args.learner_id || '').trim();
  if (id.courses.indexOf(course) < 0 || !learner || !sosLearnerEmail_(learner, [course])) throw SOS.SosError('FORBIDDEN', 'Learner is not in this course.', 403);
  var cfg = sosConfig_(), sh = course === 'IBDS' ? sosGradebookSheet_() : sosKnowledgeSheet_(cfg), header = course === 'IBDS' ? 4 : 1;
  if (!sh || sh.getLastRow() <= header) return [];
  var c = sosResultHeaders_(sh, header), rows = sh.getRange(header + 1, 1, sh.getLastRow() - header, sh.getLastColumn()).getValues();
  var email = sosLearnerEmail_(learner, [course]);
  return rows.map(function (r, i) {
    var match = course === 'IBDS' ? String(r[c('Student ID')] || '').trim() === learner :
      sosNormalizeCourseId_(r[c('course_id')]) === course && String(r[c('student_email')] || '').trim().toLowerCase() === email && String(r[c('evidence_type')]).toLowerCase() === 'knowledge';
    if (!match) return null;
    var key = course === 'IBDS' ? String(r[c('Evidence ID')] || '') : [r[c('source_form_id')], r[c('source_response_id')], r[c('canonical_id')]].map(String).join(':');
    if (!key) return null;
    return { source: course === 'IBDS' ? 'ds' : 'knowledge', key: key, course_id: course, learner_id: learner,
      task_id: String(r[c(course === 'IBDS' ? 'Task ID' : 'canonical_id')] || ''),
      verified: sosVerified_(r[c(course === 'IBDS' ? 'Teacher verified?' : 'teacher_verified')]),
      released: sosReleased_(r[c(SOS_RELEASE_HEADER)]), released_at: sosResultDate_(r[c(SOS_RELEASE_AT_HEADER)]) };
  }).filter(Boolean);
}

function sosSetResultRelease_(id, args) {
  if (id.kind !== 'teacher') throw SOS.SosError('FORBIDDEN', 'Teacher account required.', 403);
  if (typeof args.released !== 'boolean') throw SOS.SosError('INVALID', 'Choose release or withdraw.', 400);
  var course = sosNormalizeCourseId_(args.course_id), learner = String(args.learner_id || '').trim(), key = String(args.key || '');
  if (id.courses.indexOf(course) < 0 || !learner || !key || !sosLearnerEmail_(learner, [course])) throw SOS.SosError('FORBIDDEN', 'Learner is not in this course.', 403);
  var cfg = sosConfig_(), sh = course === 'IBDS' ? sosGradebookSheet_() : sosKnowledgeSheet_(cfg), header = course === 'IBDS' ? 4 : 1;
  if (!sh) throw SOS.SosError('SERVER', 'Result source is unavailable.', 500);
  var c = sosResultHeaders_(sh, header), rows = sh.getRange(header + 1, 1, Math.max(0, sh.getLastRow() - header), sh.getLastColumn()).getValues();
  var email = sosLearnerEmail_(learner, [course]), hit = -1;
  rows.forEach(function (r, i) {
    var rowKey = course === 'IBDS' ? String(r[c('Evidence ID')] || '') : [r[c('source_form_id')], r[c('source_response_id')], r[c('canonical_id')]].map(String).join(':');
    if (rowKey !== key) return;
    var owned = course === 'IBDS' ? String(r[c('Student ID')] || '').trim() === learner :
      sosNormalizeCourseId_(r[c('course_id')]) === course && String(r[c('student_email')] || '').trim().toLowerCase() === email && String(r[c('evidence_type')]).toLowerCase() === 'knowledge';
    if (!owned || hit >= 0) throw SOS.SosError('CONFLICT', 'Result identity is ambiguous.', 409);
    if (args.released && !sosVerified_(r[c(course === 'IBDS' ? 'Teacher verified?' : 'teacher_verified')])) throw SOS.SosError('INVALID', 'Teacher verification is required before release.', 400);
    hit = i + header + 1;
  });
  if (hit < 0) throw SOS.SosError('NOT_FOUND', 'Result row was not found.', 404);
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var cell = sh.getRange(hit, c(SOS_RELEASE_HEADER) + 1), stamp = sh.getRange(hit, c(SOS_RELEASE_AT_HEADER) + 1);
    var current = sh.getRange(hit, 1, 1, sh.getLastColumn()).getValues()[0];
    var currentKey = course === 'IBDS' ? String(current[c('Evidence ID')] || '') :
      [current[c('source_form_id')], current[c('source_response_id')], current[c('canonical_id')]].map(String).join(':');
    var currentOwner = course === 'IBDS' ? String(current[c('Student ID')] || '').trim() === learner :
      sosNormalizeCourseId_(current[c('course_id')]) === course && String(current[c('student_email')] || '').trim().toLowerCase() === email;
    if (currentKey !== key || !currentOwner) throw SOS.SosError('CONFLICT', 'Result row changed during release. Reload it.', 409);
    if (args.released && !sosVerified_(current[c(course === 'IBDS' ? 'Teacher verified?' : 'teacher_verified')]))
      throw SOS.SosError('INVALID', 'Teacher verification is required before release.', 400);
    cell.setValue(args.released); stamp.setValue(args.released ? new Date() : '');
  } finally { lock.releaseLock(); }
  return { course_id: course, task_id: rows[hit - header - 1][c(course === 'IBDS' ? 'Task ID' : 'canonical_id')], released: args.released };
}

/** Installable edit trigger: a teacher's checkbox edit receives/clears the audit timestamp. */
function sosReleaseSheetEdited_(e) {
  if (!e || !e.range || e.range.getNumRows() !== 1 || e.range.getNumColumns() !== 1) return;
  var sheet = e.range.getSheet(), ss = sheet.getParent(), id = ss.getId();
  var header = id === SOS_DS_GRADEBOOK_ID && sheet.getName() === 'Evidence Log' ? 4 :
    id === SOS_CANONICAL_ROSTER_SPREADSHEET_ID && sheet.getName() === 'Evidence_Log' ? 1 : 0;
  if (!header || e.range.getRow() <= header) return;
  var c = sosResultHeaders_(sheet, header);
  if (e.range.getColumn() !== c(SOS_RELEASE_HEADER) + 1) return;
  sheet.getRange(e.range.getRow(), c(SOS_RELEASE_AT_HEADER) + 1).setValue(sosReleased_(e.range.getValue()) ? new Date() : '');
}
function installStudentResultReleaseTriggers() {
  var id = sosRealIdentity_(); if (id.kind !== 'teacher') throw SOS.SosError('FORBIDDEN', 'Teacher account required.', 403);
  var ids = [SOS_DS_GRADEBOOK_ID, SOS_CANONICAL_ROSTER_SPREADSHEET_ID];
  var existing = ScriptApp.getProjectTriggers().filter(function (t) { return t.getHandlerFunction() === 'sosReleaseSheetEdited_'; });
  existing.forEach(function (t) { ScriptApp.deleteTrigger(t); });
  ids.forEach(function (sheetId) { ScriptApp.newTrigger('sosReleaseSheetEdited_').forSpreadsheet(sheetId).onEdit().create(); });
  return { installed: ids.length };
}
