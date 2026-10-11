/**
 * Sheet-backed repository implementing the core repo interface:
 *   get(kind,id) · list(kind,{learner_id}) · insert(kind,rec) · update(kind,rec,expectedVersion) · withLock(fn)
 * One owner-only tab per kind: SOS_entry, SOS_revision, SOS_submission, SOS_comment, SOS_card, SOS_audit, SOS_prompt, SOS_setting, SOS_exit, SOS_review, SOS_discussion, SOS_dcomment.
 * Columns: id | learner_id | course_id | version | updated_at | payload_json
 * All writes run under LockService.getScriptLock(); updates compare the stored version (optimistic concurrency).
 * Tabs are created on first use with an exact header check — an unexpected header stops the write.
 */
var SOS_REPO_HEADER = ['id', 'learner_id', 'course_id', 'version', 'updated_at', 'payload_json'];
var SOS_REPO_KINDS = ['entry', 'revision', 'submission', 'comment', 'feedbackread', 'card', 'audit', 'prompt', 'setting', 'exit', 'review', 'discussion', 'dcomment',
  'supportsetting', 'supportevent', 'customversion'];
var SOS_MAX_PAYLOAD = 49000; // Sheets cell limit is 50,000 characters

function SheetRepo_(spreadsheetId) {
  var ss = SpreadsheetApp.openById(spreadsheetId);
  var sheets = {}, memo = {}, depth = 0, lock = null;

  function sheet(kind) {
    if (SOS_REPO_KINDS.indexOf(kind) < 0) throw SOS.SosError('SERVER', 'Unknown record kind.', 500);
    if (sheets[kind]) return sheets[kind];
    var name = 'SOS_' + kind, sh = ss.getSheetByName(name);
    if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, SOS_REPO_HEADER.length).setValues([SOS_REPO_HEADER]); sh.setFrozenRows(1); }
    var head = sh.getRange(1, 1, 1, SOS_REPO_HEADER.length).getValues()[0].map(String);
    if (head.join('|') !== SOS_REPO_HEADER.join('|')) throw SOS.SosError('SERVER', 'Store tab ' + name + ' has an unexpected header; nothing was written.', 500);
    sheets[kind] = sh;
    return sh;
  }
  function rows(kind) {
    if (memo[kind]) return memo[kind];
    var sh = sheet(kind), n = sh.getLastRow() - 1;
    var values = n > 0 ? sh.getRange(2, 1, n, SOS_REPO_HEADER.length).getValues() : [];
    memo[kind] = values.map(function (r, i) { return { row: i + 2, id: String(r[0]), learner_id: String(r[1]), version: Number(r[3]), json: String(r[5]) }; });
    return memo[kind];
  }
  function find(kind, id) {
    var list = rows(kind);
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i];
    return null;
  }
  function serialize(rec) {
    var json = JSON.stringify(rec);
    if (json.length > SOS_MAX_PAYLOAD) throw SOS.SosError('INVALID', 'This entry is too long to store. Shorten it or move long text into a linked Doc.', 413);
    return [rec.id, rec.learner_id || '', rec.course_id || '', rec.version || 1, rec.updated_at || rec.at || rec.saved_at || rec.submitted_at || new Date().toISOString(), json];
  }
  function requireLock() { if (depth < 1) throw SOS.SosError('SERVER', 'Write attempted without the lock.', 500); }

  return {
    get: function (kind, id) { var r = find(kind, id); return r ? JSON.parse(r.json) : null; },
    list: function (kind, filter) {
      return rows(kind).filter(function (r) { return !filter || !filter.learner_id || r.learner_id === filter.learner_id; })
        .map(function (r) { return JSON.parse(r.json); });
    },
    insert: function (kind, rec) {
      requireLock();
      if (find(kind, rec.id)) throw SOS.SosError('DUPLICATE', 'Record already exists.', 409);
      var sh = sheet(kind), values = serialize(rec);
      sh.appendRow(values);
      memo[kind] = null;
    },
    update: function (kind, rec, expected) {
      requireLock();
      memo[kind] = null; // re-read inside the lock: another execution may have written since this request began
      var cur = find(kind, rec.id);
      if (!cur) throw SOS.SosError('NOT_FOUND', 'Not found, or not available to you.', 404);
      if (cur.version !== expected) throw SOS.SosError('CONFLICT', 'Record changed; nothing was overwritten.', 409);
      sheet(kind).getRange(cur.row, 1, 1, SOS_REPO_HEADER.length).setValues([serialize(rec)]);
      memo[kind] = null;
    },
    withLock: function (fn) {
      if (depth === 0) {
        lock = LockService.getScriptLock();
        if (!lock.tryLock(20000)) throw SOS.SosError('BUSY', 'Student OS is busy. Nothing was saved — try again in a moment.', 503);
        memo = {}; // fresh reads for this critical section
      }
      depth++;
      try { return fn(); }
      finally {
        depth--;
        if (depth === 0) { SpreadsheetApp.flush(); lock.releaseLock(); lock = null; }
      }
    }
  };
}
