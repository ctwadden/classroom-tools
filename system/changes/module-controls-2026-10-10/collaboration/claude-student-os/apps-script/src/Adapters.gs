/**
 * Apps Script adapters. Assignment release is read server-side from the same public course-home
 * sources that publish work to students. The generated catalogue contains student-safe metadata,
 * but it does not decide release state.
 */
function sosAdapters_(cfg) {
  var feed = sosLiveReleaseFeed_(), moduleConfigs={}, explicitItems={};
  var demoEvidence = SOSAdapters.demoAdapters({ assignments: [] }, { announcements: [], quiz_feedback: [] }).evidence;
  return {
    demo: cfg.evidenceMode !== 'live',
    labels: {
      assignments: 'Published course content with shared teacher module controls.',
      evidence: cfg.evidenceMode === 'live' ? 'Reflections are sent to the evidence system as unconfirmed reflection evidence.' : 'Demo: submissions stay inside Student OS.',
      announcements: 'Teacher-released class feed.'
    },
    assignments: {
      demo: false,
      autoBoard: true,
      listQuizzes: function () { return []; },
      listReleased: function (courses, identity) {
        var configs={};
        if(identity && identity.kind==='student') courses.forEach(function(c){var k=identity.learner_id+'|'+c;configs[c]=moduleConfigs[k]||(moduleConfigs[k]=sosModuleSettings_(cfg,identity,c));});
        var items=feed.assignments.filter(function(a){return courses.indexOf(a.course_id)>=0;});
        if(identity && identity.kind==='student')(SOS_RELEASE_CATALOGUE.assignments||[]).forEach(function(a){
          if(courses.indexOf(a.course_id)<0||items.some(function(x){return x.assignment_key===a.assignment_key;}))return;
          var p=ModulePolicy.resolve(configs[a.course_id],a.ref,identity.learner_id);
          if(p.state!=='open')return;
          if(!(a.assignment_key in explicitItems))explicitItems[a.assignment_key]=sosExplicitModuleRelease_(a);
          if(explicitItems[a.assignment_key])items.push(explicitItems[a.assignment_key]);
        });
        return items.map(function(a){
          if(!identity || identity.kind!=='student')return sosClone_(a);
          var policy=ModulePolicy.resolve(configs[a.course_id],a.ref,identity.learner_id);
          return ModulePolicy.apply(a,policy);
        }).filter(Boolean);
      }
    },
    evidence: cfg.evidenceMode === 'live' ? {
      demo: false,
      label: 'Receipts are confirmed only when the evidence system returns a matching revision.',
      submit: function (sub) { return sosSendReflection_(cfg, sub); }
    } : demoEvidence,
    quizzes: { demo: false, releasedMisses: function (learnerId, courses) {
      return sosReleasedResults_(cfg, learnerId, courses).reduce(function (all, result) {
        return all.concat((result.missed_questions || []).map(function (question, index) {
          return { source_id: result.source_id + ':miss:' + index, course_id: result.course_id,
            source_label: result.title, question: question };
        }));
      }, []);
    } },
    results: { demo: false, listReleased: function (learnerId, courses) { return sosReleasedResults_(cfg, learnerId, courses); } },
    // Read-only, teacher-confirmed evidence. This returns identifiers and confirmation dates only:
    // never marks, feedback, levels, support data, prediction fields or another learner's rows.
    achievements: { demo: false, listConfirmed: function (learnerId, courses) { return sosConfirmedEvidence_(cfg, learnerId, courses); } },
    supports: {
      preset: function (learnerId, courseId, sprintId, scope) { return sosEvidenceSupportPreset_(cfg, learnerId, courseId, sprintId, scope); }
    },
    calendar: {
      sprints: function (courses) {
        return (SOS_RELEASE_CATALOGUE.sprints || []).filter(function (x) { return courses.indexOf(x.course_id) >= 0; }).map(sosClone_);
      }
    },
    announcements: {
      demo: false,
      list: function (courses) { return sosAnnouncements_(cfg).filter(function (n) { return courses.indexOf(n.course_id) >= 0; }); }
    }
  };
}

/** Availability is read with the existing Google integration credential; never from browser identity fields. */
function sosModuleSettings_(cfg,identity,course) {
  if(!cfg.ingestUrl || !cfg.ingestSecret) throw SOS.SosError('SERVER','Module controls are not connected. Your saved work remains available.',503);
  var base=String(cfg.ingestUrl).split('?')[0];
  var query='action=module-access&course_id='+encodeURIComponent(course)+(identity.preview?'&preview=class':'&learner_id='+encodeURIComponent(identity.learner_id));
  var response=UrlFetchApp.fetch(base+'?'+query,{method:'get',muteHttpExceptions:true,followRedirects:true,headers:{Authorization:'Bearer '+cfg.ingestSecret}});
  if(response.getResponseCode()!==200)throw SOS.SosError('SERVER','Module availability could not be confirmed. Your saved work remains available; retry after refresh.',503);
  var config=JSON.parse(response.getContentText()||'{}');
  if(config.schema!=='learning-studio.module-controls.v1'||config.course_id!==course||!Array.isArray(config.rules)||!Array.isArray(config.groups))throw SOS.SosError('SERVER','Invalid module settings response.',503);
  return config;
}

/** Read a teacher preset from the protected Evidence Map using the existing server-to-server credential. */
function sosEvidenceSupportPreset_(cfg, learnerId, courseId, sprintId, scope) {
  // Support presets are independent of reflection-submission mode. The pilot may keep reflection
  // delivery in Demo while still reading teacher-authored support settings server to server.
  if (!cfg.ingestUrl || !cfg.ingestSecret) return [];
  try {
    var base = String(cfg.ingestUrl).split('?')[0];
    var query = ['action=support-settings','course_id=' + encodeURIComponent(courseId),'learner_id=' + encodeURIComponent(learnerId),
      'sprint_id=' + encodeURIComponent(sprintId || 'all'),'scope=' + encodeURIComponent(scope || 'sprint')].join('&');
    var res = UrlFetchApp.fetch(base + '?' + query, { method: 'get', muteHttpExceptions: true, followRedirects: true,
      headers: { Authorization: 'Bearer ' + cfg.ingestSecret } });
    if (res.getResponseCode() !== 200) return [];
    var body = JSON.parse(res.getContentText() || '{}');
    return body && body.settings && Array.isArray(body.settings.supports) ? body.settings.supports : [];
  } catch (e) { console.error('Student OS support preset read failed: ' + e); return []; }
}

function sosList_(value) {
  return String(value || '').split(/[;,]/).map(function (x) { return x.trim(); }).filter(Boolean);
}

/** Resolve one roster learner to their email entirely on the server. */
function sosLearnerEmail_(learnerId, courses) {
  var rows = sosRoster_().filter(function (r) { return r.learner_id === learnerId && courses.indexOf(String(r.course_id).replace(/^CT11$/, 'COM11')) >= 0; });
  var emails = {}; rows.forEach(function (r) { emails[r.student_email] = true; });
  var list = Object.keys(emails);
  return list.length === 1 ? list[0] : null;
}

function sosNormalizeOutcome_(course, raw) {
  var value = String(raw || '').trim();
  if (!value) return null;
  var compact = value.replace(/^CT11[ .-]/i, 'COM11-').replace(/^COM11[ .]/i, 'COM11-').replace(/^MM12[ .]/i, 'MM12-');
  return SOS_OUTCOME_REGISTRY.byAlias[value] || SOS_OUTCOME_REGISTRY.byAlias[compact] || null;
}

/**
 * Read the existing Technology Evidence System Evidence_Log in place. Teacher confirmation is
 * necessary, but only an existing crosswalk outcome can produce a competency badge.
 */
function sosConfirmedEvidence_(cfg, learnerId, courses) {
  var email = sosLearnerEmail_(learnerId, courses);
  if (!email) return [];
  var sh = SpreadsheetApp.openById(cfg.rosterSpreadsheetId).getSheetByName('Evidence_Log');
  if (!sh || sh.getLastRow() < 2) return [];
  var rows = sh.getDataRange().getValues(), head = rows.shift().map(String), col = function (n) { return head.indexOf(n); };
  ['timestamp','student_email','course_id','project_id','canonical_id','evidence_type','skill_ids','outcome_codes','teacher_verified','source_form_id','source_response_id'].forEach(function (n) {
    if (col(n) < 0) throw SOS.SosError('SERVER', 'Evidence source column missing: ' + n, 500);
  });
  return rows.filter(function (r) {
    var course = String(r[col('course_id')] || '').replace(/^CT11$/, 'COM11');
    var type = String(r[col('evidence_type')] || '').toLowerCase();
    var confirmed = r[col('teacher_verified')] === true || String(r[col('teacher_verified')]).toLowerCase() === 'true';
    return String(r[col('student_email')] || '').trim().toLowerCase() === email && courses.indexOf(course) >= 0 && confirmed &&
      ['knowledge','reflection','support','transfer','transfer candidate'].indexOf(type) < 0;
  }).map(function (r) {
    var course = String(r[col('course_id')] || '').replace(/^CT11$/, 'COM11'), outcomes = {}, direct = sosList_(r[col('outcome_codes')]);
    direct.forEach(function (raw) { var o = sosNormalizeOutcome_(course, raw); if (o && o.course_id === course) outcomes[o.outcome_id] = o; });
    sosList_(r[col('skill_ids')]).forEach(function (skillId) {
      var mapped = SOS_SKILL_CROSSWALK.byTutorialSkill[skillId] || [];
      mapped.forEach(function (raw) { var o = sosNormalizeOutcome_(course, raw); if (o && o.course_id === course) outcomes[o.outcome_id] = o; });
    });
    var at = r[col('timestamp')];
    return { learner_id: learnerId, course_id: course, project_id: String(r[col('project_id')] || ''), canonical_id: String(r[col('canonical_id')] || ''),
      task_id: String(r[col('canonical_id')] || ''), confirmed_at: at instanceof Date ? at.toISOString() : String(at || ''), teacher_confirmed: true,
      evidence_type: String(r[col('evidence_type')] || ''), skill_ids: sosList_(r[col('skill_ids')]),
      camera_capture_verified: String(r[col('source_form_id')] || '') === '1Veo5GlNG8CKQ_tux1Bh8u1NzuRAAt0drurYyd0yXuF0',
      outcomes: Object.keys(outcomes).map(function (k) { return outcomes[k]; }) };
  }).filter(function (e) { return e.outcomes.length > 0; });
}

function sosClone_(value) { return JSON.parse(JSON.stringify(value)); }

/** Fetch one fixed, public release source. A failure is fail-closed: no item from that source is released. */
function sosReleaseText_(url) {
  var res = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  if (res.getResponseCode() !== 200) throw new Error('Release source returned HTTP ' + res.getResponseCode());
  return res.getContentText();
}

/**
 * Authoritative release sources:
 * - IBDS: course-home/sprints.json in the published course GitHub repository. A sprint is released
 *   only when it has a workbook_url and its release_status begins "Published student workbook".
 * - MM12 / COM11: the live course-home HTML. A project is released only while its exact workbook
 *   link is present. Its Form link is exposed only while that exact link is present on the same
 *   student page (or, for IBDS, inside the released workbook page).
 */
function sosLiveReleaseFeed_() {
  if (!SOS_RELEASE_CATALOGUE || SOS_RELEASE_CATALOGUE.schema !== 'student-os.release-catalogue.v1')
    throw SOS.SosError('SERVER', 'Student OS release catalogue is unavailable.', 500);
  var cache = CacheService.getScriptCache(), hit = cache.get('sos-live-release-v1');
  if (hit) return JSON.parse(hit);
  var texts = {}, ds = null;
  Object.keys(SOS_RELEASE_CATALOGUE.sources || {}).forEach(function (course) {
    var url = SOS_RELEASE_CATALOGUE.sources[course];
    try {
      texts[url] = sosReleaseText_(url);
      if (course === 'IBDS') ds = JSON.parse(texts[url]);
    } catch (e) { console.error('Student OS release source unavailable for ' + course + ': ' + e); texts[url] = ''; }
  });
  var detailTexts = {}, released = [];
  (SOS_RELEASE_CATALOGUE.assignments || []).forEach(function (candidate) {
    var match = candidate.release_match || {}, ok = false, releaseLabel = '';
    if (match.kind === 'ds_sprint' && ds && Array.isArray(ds.sprints)) {
      var sprint = ds.sprints.filter(function (s) { return s.id === match.sprint_id; })[0];
      ok = !!(sprint && sprint.workbook_url === match.workbook_path && /^Published student workbook\b/.test(String(sprint.release_status || '')));
      releaseLabel = sprint ? String(sprint.release_status || '') : '';
    } else if (match.kind === 'course_home_link') {
      ok = !!texts[match.source_url] && texts[match.source_url].replace(/&amp;/g, '&').indexOf(match.workbook_marker) >= 0;
      releaseLabel = 'Published on the student course home';
    }
    if (!ok) return;
    var item = sosClone_(candidate); delete item.release_match;
    item.release = { state: 'released', label: releaseLabel, source_url: match.source_url };
    if (item.submission && item.submission.url) {
      var formSource = match.detail_url || match.source_url;
      if (!(formSource in detailTexts)) {
        try { detailTexts[formSource] = formSource === match.source_url ? texts[formSource] : sosReleaseText_(formSource); }
        catch (e) { console.error('Student OS Form-link source unavailable: ' + e); detailTexts[formSource] = ''; }
      }
      if (detailTexts[formSource].replace(/&amp;/g, '&').indexOf(item.submission.url) < 0) {
        item.submission.url = null;
        item.submission.state = 'Submission Form is not released on the student page.';
      } else item.submission.state = 'Released on the student page.';
    }
    released.push(item);
  });
  var feed = { schema: 'student-os.live-release.v1', assignments: released };
  try { cache.put('sos-live-release-v1', JSON.stringify(feed), 60); } catch (e) { /* read sources again next request */ }
  return feed;
}

/**
 * Owner-run authorization/diagnostic entry point. Running this once in the Apps Script editor
 * grants the web app permission to read the fixed public release sources after the manifest gains
 * the external-request scope. It returns counts only; no student or course data is written.
 */
function authorizeStudentOsReleaseFeed() {
  // Keep this direct call uncaught so Apps Script requests the required owner authorization.
  var probe = UrlFetchApp.fetch(SOS_RELEASE_CATALOGUE.sources.IBDS, { muteHttpExceptions: true, followRedirects: true });
  if (probe.getResponseCode() !== 200) throw new Error('Release-source authorization probe returned HTTP ' + probe.getResponseCode());
  CacheService.getScriptCache().remove('sos-live-release-v1');
  var feed = sosLiveReleaseFeed_();
  return { schema: feed.schema, released_count: feed.assignments.length };
}

/** Teacher-maintained announcements tab in the owner-only store: id | course_id | kind | title | body | posted | released */
function sosAnnouncements_(cfg) {
  var sh = SpreadsheetApp.openById(cfg.storeId).getSheetByName('SOS_announcements');
  if (!sh || sh.getLastRow() < 2) return [];
  var v = sh.getDataRange().getValues(), head = v.shift().map(String), c = function (n) { return head.indexOf(n); };
  return v.filter(function (r) { return r[c('released')] === true || String(r[c('released')]).toLowerCase() === 'true'; }).map(function (r) {
    return { id: String(r[c('id')]), course_id: String(r[c('course_id')]), kind: String(r[c('kind')]) === 'prompt' ? 'prompt' : 'announcement',
      title: String(r[c('title')]), body: String(r[c('body')]), posted: r[c('posted')] instanceof Date ? r[c('posted')].toISOString().slice(0, 10) : String(r[c('posted')]) };
  });
}

/** CR-SOS-3: unchanged. This path remains off while SOS_EVIDENCE_MODE is demo. */
function sosReflectionEvent_(sub) {
  var ref = sub.ref || {};
  var text = [sub.snapshot.title, sub.snapshot.body].concat(Object.keys(sub.snapshot.prompts || {}).map(function (k) { return SOS.PROMPTS[k] + ' ' + sub.snapshot.prompts[k]; })).join('\n\n');
  return {
    stream: 'reflection', event_id: sosSha256_('student-os:' + sub.id), source_revision: 1, origin: 'student_os',
    learner_id: sub.learner_id, course_id: sub.course_id, project_id: ref.project_id,
    canonical_id: ref.task_id || (ref.project_id + '-REFLECTION'),
    response_value: text.slice(0, 12000), artifact_url: (sub.snapshot.artifacts[0] || {}).url || '',
    teacher_verified: false, source_form_id: 'student-os', source_response_id: sub.id, timestamp: sub.submitted_at
  };
}
function sosSendReflection_(cfg, sub) {
  var event = sosReflectionEvent_(sub);
  var pending = { mode: 'live', status: 'pending', id: event.event_id.slice(0, 16), label: 'Saved in Student OS · not yet confirmed by the evidence system', at: sub.submitted_at };
  if (!cfg.ingestUrl || !cfg.ingestSecret) return pending;
  try {
    var res = UrlFetchApp.fetch(cfg.ingestUrl, { method: 'post', contentType: 'application/json', muteHttpExceptions: true,
      headers: { Authorization: 'Bearer ' + cfg.ingestSecret }, payload: JSON.stringify({ events: [event] }) });
    var body = JSON.parse(res.getContentText() || '{}');
    var r = body && body.results && body.results[event.event_id];
    if (res.getResponseCode() === 200 && r && r.ok === true && r.record_id === event.event_id && /^[a-f0-9]{64}$/.test(String(r.revision_id)))
      return { mode: 'live', status: 'confirmed', id: r.revision_id.slice(0, 16), revision_id: r.revision_id, label: 'Evidence system receipt (reflection, unconfirmed evidence)', at: sub.submitted_at };
  } catch (e) { console.error('Student OS evidence send failed: ' + e); }
  return pending;
}

/** An explicit teacher On setting can release a registered, already hosted workbook independently of the public course-home list. */
function sosExplicitModuleRelease_(candidate) {
  try {
    var url=String(candidate.workbook_url||'').split('#')[0];
    if(!/^https:\/\/(ctwadden\.github\.io|outcome-evidence-map\.netlify\.app)\//.test(url))return null;
    var page=sosReleaseText_(url);if(!/<(?:html|!doctype)\b/i.test(page))return null;
    var item=sosClone_(candidate);delete item.release_match;
    item.release={state:'released',label:'Released to you by your teacher'};
    if(item.submission&&item.submission.url&&page.replace(/&amp;/g,'&').indexOf(item.submission.url)<0){item.submission.url=null;item.submission.state='Use the verified submission route in the workbook; this Form link was not confirmed on its page.';}
    return item;
  } catch(e) {return null;}
}
