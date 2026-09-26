/**
 * Truck Standard Google Assessment Generator
 * Canonical flow: forms-spec.json -> Student Quiz + Teacher Evidence Form -> Evidence_Log.
 *
 * Install this bound to ONE Google Sheet named Technology Evidence System.
 */

const TS = {
  SHEETS: {
    CONFIG: 'Config',
    PROJECTS: 'Projects',
    REGISTRY: 'Form Registry',
    ITEM_MAP: 'Form Item Map',
    EVIDENCE: 'Evidence_Log',
    ROSTER: 'Roster',
    ERRORS: 'Automation Log'
  },
  CONFIG_KEYS: {
    SPECS_FOLDER_ID: 'ASSESSMENT_SPECS_FOLDER_ID',
    SPEC_REGISTRY_URL: 'SPEC_REGISTRY_URL',
    LAUNCHER_URL: 'ASSESSMENT_LAUNCHER_URL',
    TIMEZONE: 'TIMEZONE'
  },
  // Academic achievement and learner support are separate dimensions.
  LEVELS: ['IE - Insufficient Evidence','1 - Beginning','2 - Developing','3 - Secure','4 - Extending'],
  INDEPENDENCE: ['Guided','Supported','Independent','Transfer'],
  ROUTER_HANDLER: 'onAssessmentSpreadsheetSubmit'
};

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Truck Standard')
    .addItem('1. Initialize evidence system', 'setupTechnologyEvidenceSystem')
    .addItem('2A. Sync specs from GitHub', 'syncAssessmentSpecsFromGitHub')
    .addItem('2B. Sync specs from Drive', 'syncAssessmentSpecs')
    .addItem('3. Generate forms for synced specs', 'generateFormsForPendingSpecs')
    .addSeparator()
    .addItem('Open visual teacher dashboard', 'showTeacherDashboard')
    .addItem('Connect Evidence Map and roster', 'installConnectedEvidence')
    .addItem('Refresh connected progress', 'runConnectedEvidenceSync')
    .addSeparator()
    .addItem('Refresh teacher-form rosters', 'refreshTeacherFormRosters')
    .addItem('Rebuild Evidence_Log from form responses', 'rebuildEvidenceLogFromForms')
    .addSeparator()
    .addItem('Sync pending Evidence Map events', 'syncPendingEvidenceToEvidenceMap')
    .addItem('Resync ALL Evidence Map events', 'resyncAllEvidenceToEvidenceMap')
    .addItem('Backfill Knowledge scores', 'backfillKnowledgeScores')
    .addSeparator()
    .addItem('Phase 2 - Complete Drop Day', 'completeDropDayPhase2')
    .addItem('Phase 2 - Preflight Drop Day', 'dropDayPhase2Preflight')
    .addToUi();
}

function setupTechnologyEvidenceSystem() {
  const ss = SpreadsheetApp.getActive();
  ensureSheet_(ss, TS.SHEETS.CONFIG, ['Key','Value','Notes']);
  ensureSheet_(ss, TS.SHEETS.PROJECTS, ['project_id','project_title','spec_version','spec_file_id','spec_file_name','spec_hash','status','student_form_url','teacher_form_url','last_synced']);
  ensureSheet_(ss, TS.SHEETS.REGISTRY, ['project_id','spec_version','form_type','form_id','form_url','response_sheet_name','active','created_at']);
  ensureSheet_(ss, TS.SHEETS.ITEM_MAP, ['form_id','item_id','project_id','form_type','canonical_id','evidence_type','skill_ids','outcome_codes','step_id','field_role']);
  ensureSheet_(ss, TS.SHEETS.EVIDENCE, ['timestamp','student_email','student_name','course_id','project_id','canonical_id','evidence_type','skill_ids','outcome_codes','response_value','auto_score','level','independence','teacher_note','teacher_verified','source_form_id','source_response_id']);
  ensureSheet_(ss, TS.SHEETS.ROSTER, ['student_name','student_email','course_id','active']);
  ensureSheet_(ss, TS.SHEETS.ERRORS, ['timestamp','level','message','context']);

  const cfg = ss.getSheetByName(TS.SHEETS.CONFIG);
  const existing = cfg.getLastRow() > 1 ? cfg.getRange(2,1,cfg.getLastRow()-1,1).getValues().flat() : [];
  const configRows = [];
  if (!existing.includes(TS.CONFIG_KEYS.SPECS_FOLDER_ID)) configRows.push([TS.CONFIG_KEYS.SPECS_FOLDER_ID,'','Optional Drive folder containing self-contained forms-spec.json files']);
  if (!existing.includes(TS.CONFIG_KEYS.SPEC_REGISTRY_URL)) configRows.push([TS.CONFIG_KEYS.SPEC_REGISTRY_URL,'','Preferred: raw GitHub URL to project-spec-registry.json']);
  if (!existing.includes(TS.CONFIG_KEYS.LAUNCHER_URL)) configRows.push([TS.CONFIG_KEYS.LAUNCHER_URL,'','After web-app deployment, paste the /exec URL here']);
  if (!existing.includes(TS.CONFIG_KEYS.TIMEZONE)) configRows.push([TS.CONFIG_KEYS.TIMEZONE, Session.getScriptTimeZone() || 'America/Halifax','Used for timestamps']);
  if (configRows.length) cfg.getRange(cfg.getLastRow()+1,1,configRows.length,3).setValues(configRows);
  SpreadsheetApp.getUi().alert('Technology Evidence System initialized. Preferred flow: set SPEC_REGISTRY_URL to the GitHub project registry, then Sync specs from GitHub.');
}

function syncAssessmentSpecsFromGitHub() {
  const ss = SpreadsheetApp.getActive();
  const registryUrl = getConfig_(TS.CONFIG_KEYS.SPEC_REGISTRY_URL);
  if (!registryUrl) throw new Error('Missing SPEC_REGISTRY_URL in Config.');
  const registry = JSON.parse(fetchText_(registryUrl));
  if (!Array.isArray(registry.projects)) throw new Error('project-spec-registry.json must contain a projects array.');
  let synced = 0;
  registry.projects.forEach(entry => {
    if (entry.active === false) return;
    const raw = fetchText_(entry.forms_spec_url);
    const spec = JSON.parse(raw);
    validateSpec_(spec);
    upsertProjectSpecFromUrl_(ss, spec, entry.forms_spec_url, sha256_(raw));
    synced++;
  });
  SpreadsheetApp.getUi().alert(`Synced ${synced} assessment specification file(s) from GitHub.`);
}

function fetchText_(url) {
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions:true, followRedirects:true});
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error(`Could not fetch ${url} (HTTP ${code})`);
  return response.getContentText('UTF-8');
}

function syncAssessmentSpecs() {
  const ss = SpreadsheetApp.getActive();
  const folderId = getConfig_(TS.CONFIG_KEYS.SPECS_FOLDER_ID);
  if (!folderId) throw new Error('Missing ASSESSMENT_SPECS_FOLDER_ID in Config.');

  const folder = DriveApp.getFolderById(folderId);
  const files = folder.getFiles();
  let synced = 0;
  while (files.hasNext()) {
    const file = files.next();
    if (!/forms-spec\.json$/i.test(file.getName())) continue;
    const raw = file.getBlob().getDataAsString('UTF-8');
    const spec = JSON.parse(raw);
    validateSpec_(spec);
    const hash = sha256_(raw);
    upsertProjectSpec_(ss, spec, file, hash);
    synced++;
  }
  SpreadsheetApp.getUi().alert(`Synced ${synced} assessment specification file(s).`);
}

function generateFormsForPendingSpecs() {
  const ss = SpreadsheetApp.getActive();
  const projectSheet = ss.getSheetByName(TS.SHEETS.PROJECTS);
  if (!projectSheet || projectSheet.getLastRow() < 2) return;

  // Ensure the scalable router exists before any new form set is generated.
  installScalableEvidenceRouter();

  const rows = projectSheet.getRange(2,1,projectSheet.getLastRow()-1,10).getValues();
  let generated = 0;
  let repaired = 0;

  rows.forEach((row, i) => {
    const [projectId,title,version,fileId,,,status] = row;
    if (!projectId || !fileId) return;
    if (status === 'Forms current') return;

    try {
      // If form creation already succeeded and only trigger creation failed,
      // repair the project row rather than creating another duplicate form pair.
      const pair = getActiveProjectFormPair_(projectId, version);
      if (String(status || '').startsWith('ERROR') && pair.student && pair.teacher) {
        projectSheet.getRange(i+2,7,1,4).setValues([[
          'Forms current',
          pair.student.form_url,
          pair.teacher.form_url,
          new Date()
        ]]);
        repaired++;
        return;
      }

      const raw = /^https?:\/\//i.test(String(fileId))
        ? fetchText_(String(fileId))
        : DriveApp.getFileById(fileId).getBlob().getDataAsString('UTF-8');

      const spec = JSON.parse(raw);
      const urls = generateProjectForms_(ss, spec);

      projectSheet.getRange(i+2,7,1,4).setValues([[
        'Forms current',
        urls.studentUrl,
        urls.teacherUrl,
        new Date()
      ]]);
      generated++;

    } catch (err) {
      projectSheet.getRange(i+2,7).setValue('ERROR - see Automation Log');
      logError_('ERROR', err.stack || err.message, `${projectId} v${version}`);
    }
  });

  SpreadsheetApp.getUi().alert(
    `Generated ${generated} project form set(s). Repaired ${repaired} existing form set(s).`
  );
}

function doGet(e) {
  try {
    const project = e?.parameter?.project || '';
    const type = String(e?.parameter?.type || 'student').toLowerCase();
    if (!project) return HtmlService.createHtmlOutput('<h2>Truck Standard Assessment Launcher</h2><p>Missing project parameter.</p>');
    const sh = SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.REGISTRY);
    if (!sh || sh.getLastRow() < 2) return HtmlService.createHtmlOutput('<p>No generated forms are registered yet.</p>');
    const rows = sh.getRange(2,1,sh.getLastRow()-1,8).getValues()
      .filter(r => r[0] === project && String(r[2]).toLowerCase() === type && (r[6] === true || String(r[6]).toLowerCase() === 'true'));
    if (!rows.length) return HtmlService.createHtmlOutput(`<h3>Assessment not ready</h3><p>No active ${escapeHtml_(type)} form is registered for ${escapeHtml_(project)}.</p>`);
    const url = String(rows[rows.length-1][4]);
    return HtmlService.createHtmlOutput(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><p>Opening assessment...</p><script>window.top.location.replace(${JSON.stringify(url)});<\/script><p><a href="${escapeAttr_(url)}">Open form</a></p>`);
  } catch (err) {
    return HtmlService.createHtmlOutput(`<h3>Assessment launcher error</h3><pre>${escapeHtml_(err.message)}</pre>`);
  }
}

function escapeHtml_(value) {
  return String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}
function escapeAttr_(value) { return escapeHtml_(value).replace(/'/g,'&#39;'); }

function generateProjectForms_(ss, spec) {
  validateSpec_(spec);
  fbPreflight_(spec); // Fail before creating either Form when a referenced rubric is not approved.

  const studentBuild = buildStudentForm_(ss, spec);
  const teacherBuild = buildTeacherForm_(ss, spec);

  registerForm_(ss, spec, 'student', studentBuild.form, studentBuild.responseSheetName);
  registerForm_(ss, spec, 'teacher', teacherBuild.form, teacherBuild.responseSheetName);

  // ONE spreadsheet-level form submit trigger serves every project.
  ensureAssessmentSpreadsheetTrigger_();

  return {
    studentUrl: studentBuild.form.getPublishedUrl(),
    teacherUrl: teacherBuild.form.getPublishedUrl()
  };
}

function buildStudentForm_(ss, spec) {
  const title = `${spec.project_title} - Knowledge + Reflection`;
  const form = FormApp.create(title);
  form.setDescription(spec.student_form?.description || 'Complete the knowledge check, identify evidence of your learning, and finish the short transfer reflection.');
  form.setCollectEmail(true);
  form.setProgressBar(true);
  form.setIsQuiz(true);
  form.setConfirmationMessage('Submitted. Return to the project tutorial and continue with your final evidence/submission instructions.');

  const courses = spec.course_configs || [];
  if (courses.length > 1) {
    const item = form.addListItem().setTitle('Course / class');
    item.setChoiceValues(courses.map(c => `${c.course_id}${c.module_id ? ' - '+c.module_id : ''}`));
    mapItem_(ss, form, item, spec, 'META-COURSE', 'Metadata', [], [], '', 'course_id');
  }

  form.addSectionHeaderItem().setTitle('1 - Knowledge Check');
  (spec.knowledge_check?.items || []).forEach(q => {
    if (q.type !== 'multiple_choice') return;
    const item = form.addMultipleChoiceItem();
    item.setTitle(q.prompt).setRequired(true).setPoints(q.points || 1);
    item.setChoices((q.choices || []).map((choice, idx) => item.createChoice(choice, idx === q.correct_index)));
    if (q.correct_feedback) item.setFeedbackForCorrect(FormApp.createFeedback().setText(q.correct_feedback).build());
    if (q.incorrect_feedback) item.setFeedbackForIncorrect(FormApp.createFeedback().setText(q.incorrect_feedback).build());
    mapItem_(ss, form, item, spec, q.id, 'Knowledge', q.skill_ids, q.outcome_codes, q.step_id || '', 'knowledge');
  });

  form.addSectionHeaderItem().setTitle('2 - Skills Used');
  const sr = spec.skill_reflection || {};
  addSkillReflectionBlock_(ss, form, spec, 'technical', 'Technical skill that mattered most', sr.technical_skills || []);
  addSkillReflectionBlock_(ss, form, spec, 'design', 'Design / communication skill that mattered most', sr.design_skills || []);
  addSkillReflectionBlock_(ss, form, spec, 'growth', 'Skill you want to improve next', [...(sr.technical_skills || []), ...(sr.design_skills || [])], true);

  form.addSectionHeaderItem().setTitle('3 - Transfer');
  const transfer = spec.transfer || {};
  const tr = form.addParagraphTextItem().setTitle(transfer.prompt || 'How could one of these skills transfer to a changed brief or new context?').setRequired(true);
  mapItem_(ss, form, tr, spec, transfer.id || `${spec.project_id}-TRANSFER`, 'Transfer candidate', transfer.skill_ids || [], transfer.outcome_codes || [], '', 'transfer');

  const responseSheetName = attachFormDestination_(ss, form);
  return {form, responseSheetName};
}

function addSkillReflectionBlock_(ss, form, spec, role, title, skills, growthOnly=false) {
  const choices = skills.map(s => `${s.id} - ${s.label}`);
  const pick = form.addListItem().setTitle(title).setChoiceValues(choices).setRequired(true);
  mapItem_(ss, form, pick, spec, `${spec.project_id}-REF-${role.toUpperCase()}-SKILL`, 'Reflection', skills.map(s=>s.id), [], '', `${role}_skill`);
  if (!growthOnly) {
    const where = form.addParagraphTextItem().setTitle(`${title}: where did you use it, why was it appropriate, and what evidence in your file shows it?`).setRequired(true);
    mapItem_(ss, form, where, spec, `${spec.project_id}-REF-${role.toUpperCase()}-WHY`, 'Reflection', skills.map(s=>s.id), [], '', `${role}_reason`);
    const independence = form.addMultipleChoiceItem().setTitle(`${title}: how independently did you use it?`).setChoiceValues(spec.skill_reflection.independence_options || ['Followed the example closely','Needed some prompts/checkpoints','Worked independently','Adapted or extended the skill']).setRequired(true);
    mapItem_(ss, form, independence, spec, `${spec.project_id}-REF-${role.toUpperCase()}-IND`, 'Reflection', skills.map(s=>s.id), [], '', `${role}_independence`);
  }
}

function buildTeacherForm_(ss, spec, preparedForm) {
  const approvedRubrics=fbPreflight_(spec)||[];
  const form = preparedForm || FormApp.create(`${spec.project_title} - Teacher Evidence Capture`);
  form.setDescription('Fast teacher capture for Observation, Conversation and Product evidence. Student self-reports do not auto-confirm competency.');
  form.setProgressBar(true);
  form.setConfirmationMessage('Evidence saved.');

  const roster = getRoster_(ss, spec.course_configs || []);
  const student = form.addListItem().setTitle('Student').setChoiceValues(roster.length ? roster.map(r => `${r.name} | ${r.email} | ${r.course}`) : ['ROSTER NOT LOADED']).setRequired(true);
  mapItem_(ss, form, student, spec, 'META-STUDENT', 'Metadata', [], [], '', 'student');

  const checkpoints = spec.teacher_evidence?.checkpoints || [];
  const checkpoint = form.addListItem().setTitle('Evidence checkpoint').setChoiceValues(fbChoices_(spec).length ? fbChoices_(spec).map(c=>c.choice_label) : checkpoints.map(c => `${c.evidence_id} - ${c.title}`)).setRequired(true);
  if(fbChoices_(spec).length)checkpoint.setHelpText("Select one criterion for this observation, conversation or product. Use another capture if assessing a second criterion. General evidence has no approved rubric attached.");
  mapItem_(ss, form, checkpoint, spec, 'META-CHECKPOINT', 'Metadata', [], [], '', 'checkpoint');

  const level = form.addMultipleChoiceItem().setTitle('Current evidence level').setChoiceValues(TS.LEVELS).setRequired(true);
  if(approvedRubrics.length)level.setHelpText('Judge only the selected criterion. IE means insufficient evidence. Support is recorded separately.\n\n'+fbGuidance_(approvedRubrics));
  mapItem_(ss, form, level, spec, 'META-LEVEL', 'Metadata', [], [], '', 'level');

  const independence = form.addMultipleChoiceItem().setTitle('Independence observed').setChoiceValues(TS.INDEPENDENCE).setRequired(true);
  mapItem_(ss, form, independence, spec, 'META-INDEPENDENCE', 'Metadata', [], [], '', 'independence');

  const note = form.addParagraphTextItem().setTitle('Evidence note - what did the student actually do or explain?').setRequired(true);
  mapItem_(ss, form, note, spec, 'META-NOTE', 'Metadata', [], [], '', 'teacher_note');

  const responseSheetName = attachFormDestination_(ss, form);
  return {form, responseSheetName};
}

function onStudentAssessmentSubmit(e) {
  try {
    const form = e.source;
    const response = e.response;
    const project = getProjectByFormId_(form.getId());
    if (!project) throw new Error(`Unknown student form ${form.getId()}`);
    const email = response.getRespondentEmail() || '';
    const itemResponses = response.getItemResponses();
    let courseId = '';

    itemResponses.forEach(ir => {
      const meta = getItemMeta_(form.getId(), ir.getItem().getId());
      if (!meta) return;
      if (meta.field_role === 'course_id') {
        courseId = String(ir.getResponse()).split(' - ')[0];
        return;
      }
      if (meta.evidence_type === 'Knowledge') {
        appendEvidence_({timestamp: response.getTimestamp(), student_email: email, student_name: '', course_id: courseId, project_id: project.project_id, canonical_id: meta.canonical_id, evidence_type: 'Knowledge', skill_ids: meta.skill_ids, outcome_codes: meta.outcome_codes, response_value: stringifyResponse_(ir.getResponse()), auto_score: scoreQuizItem_(ir), level: '', independence: '', teacher_note: '', teacher_verified: false, source_form_id: form.getId(), source_response_id: response.getId()});
      } else if (meta.evidence_type === 'Transfer candidate') {
        appendEvidence_({timestamp: response.getTimestamp(), student_email: email, student_name: '', course_id: courseId, project_id: project.project_id, canonical_id: meta.canonical_id, evidence_type: 'Transfer candidate', skill_ids: meta.skill_ids, outcome_codes: meta.outcome_codes, response_value: stringifyResponse_(ir.getResponse()), auto_score: '', level: '', independence: '', teacher_note: 'Teacher verification required before Extending evidence.', teacher_verified: false, source_form_id: form.getId(), source_response_id: response.getId()});
      }
    });

    // Store the whole reflection as one supporting record for easier review.
    const reflectionText = itemResponses.filter(ir => {
      const m = getItemMeta_(form.getId(), ir.getItem().getId());
      return m && m.evidence_type === 'Reflection';
    }).map(ir => `${ir.getItem().getTitle()}: ${stringifyResponse_(ir.getResponse())}`).join('\n');
    if (reflectionText) appendEvidence_({timestamp: response.getTimestamp(), student_email: email, student_name: '', course_id: courseId, project_id: project.project_id, canonical_id: `${project.project_id}-REFLECTION`, evidence_type: 'Reflection', skill_ids: '', outcome_codes: '', response_value: reflectionText, auto_score: '', level: '', independence: '', teacher_note: 'Student self-report; use to guide teacher follow-up.', teacher_verified: false, source_form_id: form.getId(), source_response_id: response.getId()});
  } catch (err) { logError_('ERROR', err.stack || err.message, 'onStudentAssessmentSubmit'); }
}

function onTeacherEvidenceSubmit(e) {
  try {
    const form = e.source;
    const response = e.response;
    const project = getProjectByFormId_(form.getId());
    if (!project) throw new Error(`Unknown teacher form ${form.getId()}`);
    const vals = {};
    response.getItemResponses().forEach(ir => {
      const meta = getItemMeta_(form.getId(), ir.getItem().getId());
      if (meta) vals[meta.field_role] = stringifyResponse_(ir.getResponse());
    });
    const studentBits = (vals.student || '').split(' | ');
    const choice=fbSelection_(project.spec,vals.checkpoint,studentBits[2]);
    const checkpointId = choice ? choice.checkpoint_id : (vals.checkpoint || '').split(' - ')[0];
    const cp = (project.spec.teacher_evidence?.checkpoints || []).find(c => c.evidence_id === checkpointId) || {};
    appendEvidence_({timestamp: response.getTimestamp(), student_email: studentBits[1] || '', student_name: studentBits[0] || '', course_id: studentBits[2] || '', project_id: project.project_id, canonical_id: checkpointId, evidence_type: cp.evidence_type || 'Teacher evidence', skill_ids: (choice && !choice.unbound ? choice.skill_ids : cp.skill_ids || []).join(';'), outcome_codes: (choice && !choice.unbound ? choice.outcome_codes : cp.outcome_codes || []).join(';'), rubric_context_json: fbContext_(project.spec,choice), response_value: vals.checkpoint || '', auto_score: '', level: vals.level || '', independence: vals.independence || '', teacher_note: vals.teacher_note || '', teacher_verified: true, source_form_id: form.getId(), source_response_id: response.getId()});
  } catch (err) { logError_('ERROR', err.stack || err.message, 'onTeacherEvidenceSubmit'); }
}

function refreshTeacherFormRosters() {
  const ss = SpreadsheetApp.getActive();
  const registry = ss.getSheetByName(TS.SHEETS.REGISTRY);
  if (!registry || registry.getLastRow() < 2) return;
  const rows = registry.getRange(2,1,registry.getLastRow()-1,8).getValues();
  let count = 0;
  rows.filter(r => r[2] === 'teacher' && r[6] === true).forEach(r => {
    const form = FormApp.openById(r[3]);
    const project = getProjectByFormId_(r[3]);
    if (!project) return;
    const roster = getRoster_(ss, project.spec.course_configs || []);
    const item = form.getItems(FormApp.ItemType.LIST).map(i=>i.asListItem()).find(i=>i.getTitle()==='Student');
    if (item && roster.length) { item.setChoiceValues(roster.map(x=>`${x.name} | ${x.email} | ${x.course}`)); count++; }
  });
  SpreadsheetApp.getUi().alert(`Refreshed ${count} teacher form roster(s).`);
}

function rebuildEvidenceLogFromForms() {
  SpreadsheetApp.getUi().alert('Safety note: Evidence_Log is append-only by design. Automatic rebuild is intentionally disabled to avoid duplicating or overwriting teacher-confirmed evidence. Use raw form response tabs for audit/recovery.');
}


// ============================================================================
// PHASE 2 - SCALABLE EVIDENCE ROUTER
// ============================================================================

/**
 * One spreadsheet-level onFormSubmit trigger replaces the old pattern of
 * two installable triggers per project. This avoids Apps Script trigger limits
 * as the workbook library grows.
 */
function ensureAssessmentSpreadsheetTrigger_() {
  const ss = SpreadsheetApp.getActive();
  const existing = ScriptApp.getProjectTriggers().filter(t =>
    t.getHandlerFunction() === TS.ROUTER_HANDLER &&
    t.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
  );

  // Keep only one router trigger.
  existing.slice(1).forEach(t => ScriptApp.deleteTrigger(t));

  if (!existing.length) {
    ScriptApp.newTrigger(TS.ROUTER_HANDLER)
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
  }
}


/**
 * Safe one-time migration from legacy per-Form triggers to the single router.
 * If the project is already at the trigger limit, one legacy trigger is
 * removed first to make room for the router, then the remaining legacy
 * triggers are removed immediately.
 */
function installScalableEvidenceRouter() {
  const legacyHandlers = new Set([
    'onStudentAssessmentSubmit',
    'onTeacherEvidenceSubmit',
    'onStudentSubmit',
    'onTeacherSubmit'
  ]);

  let triggers = ScriptApp.getProjectTriggers();
  let router = triggers.find(t =>
    t.getHandlerFunction() === TS.ROUTER_HANDLER &&
    t.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
  );

  if (!router) {
    const legacy = triggers.filter(t => legacyHandlers.has(t.getHandlerFunction()));

    // Free exactly one slot if necessary. The new router is created immediately.
    if (legacy.length) ScriptApp.deleteTrigger(legacy[0]);

    try {
      ScriptApp.newTrigger(TS.ROUTER_HANDLER)
        .forSpreadsheet(SpreadsheetApp.getActive())
        .onFormSubmit()
        .create();
    } catch (err) {
      throw new Error(
        'Could not install the scalable spreadsheet submit router. ' +
        'Delete one obsolete installable trigger in Apps Script > Triggers, then run this again. ' +
        'Original error: ' + err.message
      );
    }
  }

  // Once the router exists, old per-Form submission triggers are unnecessary.
  ScriptApp.getProjectTriggers().forEach(t => {
    if (legacyHandlers.has(t.getHandlerFunction())) {
      ScriptApp.deleteTrigger(t);
    }
  });

  // Collapse duplicate router triggers if they exist.
  const routers = ScriptApp.getProjectTriggers().filter(t =>
    t.getHandlerFunction() === TS.ROUTER_HANDLER &&
    t.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
  );
  routers.slice(1).forEach(t => ScriptApp.deleteTrigger(t));
}


/**
 * The single spreadsheet form-submit handler.
 */
function onAssessmentSpreadsheetSubmit(e) {
  const lock=LockService.getScriptLock();lock.waitLock(25000);
  try {
    if(!e||!e.range)throw new Error('Missing spreadsheet submission event.');
    const ctx=resolveSpreadsheetSubmissionContext_(e);
    if(!ctx){logError_('WARN','Unresolved form identity; raw response retained.',e.range.getSheet().getName());return;}
    const responseId=`sheet:${e.range.getSheet().getSheetId()}:row:${e.range.getRow()}`;
    if(ctx.form_type==='teacher')routeTeacherSpreadsheetSubmit_(e,ctx,responseId);
    else routeStudentSpreadsheetSubmit_(e,ctx,responseId);
  }catch(err){logError_('ERROR',err.message,'onAssessmentSpreadsheetSubmit');throw err;}
  finally{lock.releaseLock();}
}

function routeStudentSpreadsheetSubmit_(e, ctx, sourceResponseId) {
  const form = FormApp.openById(ctx.form_id);
  const project = getProjectByFormId_(ctx.form_id);
  if (!project) throw new Error(`Could not resolve project spec for ${ctx.form_id}`);

  const named = e.namedValues || {};
  const timestamp = getSpreadsheetSubmitTimestamp_(e);
  const email = findEmailValue_(named);

  let courseId = '';
  const courseValue = getNamedValue_(named, 'Course / class');
  if (courseValue) courseId = String(courseValue).split(' - ')[0].trim();

  const reflectionLines = [];

  getInputFormItems_(form).forEach(info => {
    const response = getNamedValue_(named, info.title);
    if (response === null || response === undefined || response === '') return;

    const meta = getItemMeta_(ctx.form_id, info.id);
    if (!meta) return;

    if (meta.field_role === 'course_id') return;

    if (meta.evidence_type === 'Knowledge') {
      if (!evidenceEventExists_(ctx.form_id, sourceResponseId, meta.canonical_id)) {
        appendEvidence_({
          timestamp,
          student_email: email,
          student_name: '',
          course_id: courseId,
          project_id: ctx.project_id,
          canonical_id: meta.canonical_id,
          evidence_type: 'Knowledge',
          skill_ids: meta.skill_ids,
          outcome_codes: meta.outcome_codes,
          response_value: String(response),
          auto_score: scoreMultipleChoiceResponse_(info.item, response),
          level: '',
          independence: '',
          teacher_note: '',
          teacher_verified: false,
          source_form_id: ctx.form_id,
          source_response_id: sourceResponseId
        });
      }
      return;
    }

    if (meta.evidence_type === 'Transfer candidate') {
      if (!evidenceEventExists_(ctx.form_id, sourceResponseId, meta.canonical_id)) {
        appendEvidence_({
          timestamp,
          student_email: email,
          student_name: '',
          course_id: courseId,
          project_id: ctx.project_id,
          canonical_id: meta.canonical_id,
          evidence_type: 'Transfer candidate',
          skill_ids: meta.skill_ids,
          outcome_codes: meta.outcome_codes,
          response_value: String(response),
          auto_score: '',
          level: '',
          independence: '',
          teacher_note: 'Teacher verification required before Extending evidence.',
          teacher_verified: false,
          source_form_id: ctx.form_id,
          source_response_id: sourceResponseId
        });
      }
      return;
    }

    if (meta.evidence_type === 'Reflection') {
      reflectionLines.push(`${info.title}: ${String(response)}`);
    }
  });

  const reflectionId = `${ctx.project_id}-REFLECTION`;
  if (reflectionLines.length &&
      !evidenceEventExists_(ctx.form_id, sourceResponseId, reflectionId)) {
    appendEvidence_({
      timestamp,
      student_email: email,
      student_name: '',
      course_id: courseId,
      project_id: ctx.project_id,
      canonical_id: reflectionId,
      evidence_type: 'Reflection',
      skill_ids: '',
      outcome_codes: '',
      response_value: reflectionLines.join('\n'),
      auto_score: '',
      level: '',
      independence: '',
      teacher_note: 'Student self-report; use to guide teacher follow-up.',
      teacher_verified: false,
      source_form_id: ctx.form_id,
      source_response_id: sourceResponseId
    });
  }
}


function routeTeacherSpreadsheetSubmit_(e, ctx, sourceResponseId) {
  const project = getProjectByFormId_(ctx.form_id);
  if (!project) throw new Error(`Could not resolve project spec for ${ctx.form_id}`);

  const named = e.namedValues || {};
  const timestamp = getSpreadsheetSubmitTimestamp_(e);

  const student = getNamedValue_(named, 'Student') || '';
  const checkpoint = getNamedValue_(named, 'Evidence checkpoint') || '';
  const level = getNamedValue_(named, 'Current evidence level') || '';
  const independence = getNamedValue_(named, 'Independence observed') || '';
  const note = getNamedValue_(named, 'Evidence note - what did the student actually do or explain?') || '';

  const studentBits = String(student).split(' | ');
  const choice=fbSelection_(project.spec,checkpoint,studentBits[2]);
  const checkpointId = choice ? choice.checkpoint_id : String(checkpoint).split(' - ')[0].trim();

  if (!checkpointId) throw new Error('Teacher submission did not contain an Evidence checkpoint.');

  if (evidenceEventExists_(ctx.form_id, sourceResponseId, checkpointId)) return;

  const cp = (project.spec.teacher_evidence?.checkpoints || [])
    .find(c => String(c.evidence_id) === checkpointId) || {};

  appendEvidence_({
    timestamp,
    student_email: studentBits[1] || '',
    student_name: studentBits[0] || '',
    course_id: studentBits[2] || '',
    project_id: ctx.project_id,
    canonical_id: checkpointId,
    evidence_type: cp.evidence_type || 'Teacher evidence',
    skill_ids: (choice && !choice.unbound ? choice.skill_ids : cp.skill_ids || []).join(';'),
    outcome_codes: (choice && !choice.unbound ? choice.outcome_codes : cp.outcome_codes || []).join(';'),
    rubric_context_json: fbContext_(project.spec,choice),
    response_value: String(checkpoint),
    auto_score: '',
    level: String(level),
    independence: String(independence),
    teacher_note: String(note),
    teacher_verified: true,
    source_form_id: ctx.form_id,
    source_response_id: sourceResponseId
  });
}


/**
 * Resolve a spreadsheet response row back to the active generated Form.
 */
function resolveSpreadsheetSubmissionContext_(e) {
  return ecResolveSubmission_(e);
}

/**
 * Connect a new Form to the Technology Evidence System spreadsheet and return
 * the exact new response-tab name.
 */
function attachFormDestination_(ss, form) {
  const beforeIds = new Set(ss.getSheets().map(sh => sh.getSheetId()));

  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());

  // Response tab creation can lag slightly. Poll briefly and deterministically.
  for (let attempt = 0; attempt < 8; attempt++) {
    SpreadsheetApp.flush();
    const created = ss.getSheets()
      .filter(sh => !beforeIds.has(sh.getSheetId()))
      .filter(sh => /^Form Responses/i.test(sh.getName()));

    if (created.length) return created[created.length - 1].getName();
    Utilities.sleep(250);
  }

  // This does not block form creation; the repair routine can map it later.
  return '';
}


/**
 * Repair response_sheet_name for active forms created before the scalable
 * router rewrite.
 */
function repairActiveRegistryResponseSheets_() {
  const ss = SpreadsheetApp.getActive();
  const active = getRegistryRows_(true);

  const used = new Set(
    active.map(r => r.response_sheet_name).filter(Boolean)
  );

  // First resolve student forms using unique question titles.
  active.filter(r => r.form_type === 'student').forEach(reg => {
    if (reg.response_sheet_name &&
        ss.getSheetByName(reg.response_sheet_name) &&
        responseSheetMatchesForm_(ss.getSheetByName(reg.response_sheet_name), reg.form_id)) {
      return;
    }

    const match = findBestStudentResponseSheet_(reg.form_id, used);
    if (match) {
      setRegistryResponseSheet_(reg.row_number, match.getName());
      used.add(match.getName());
      reg.response_sheet_name = match.getName();
    }
  });

  // Teacher form follows its project's student response sheet in this generator.
  active.filter(r => r.form_type === 'teacher').forEach(reg => {
    const student = active.find(r =>
      r.project_id === reg.project_id &&
      r.form_type === 'student' &&
      r.active
    );

    if (!student?.response_sheet_name) return;

    const n = responseSheetNumber_(student.response_sheet_name);
    if (n === null) return;

    const candidate = ss.getSheetByName(`Form Responses ${n + 1}`);
    if (candidate && looksLikeTeacherResponseSheet_(candidate)) {
      setRegistryResponseSheet_(reg.row_number, candidate.getName());
      used.add(candidate.getName());
      reg.response_sheet_name = candidate.getName();
    }
  });
}


function responseSheetMatchesForm_(sheet, formId) {
  if (!sheet || sheet.getLastColumn() < 2) return false;
  try {
    const form = FormApp.openById(formId);
    const titles = getInputFormItems_(form).map(x => x.title);
    const headers = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];
    const matches = titles.filter(t => headers.includes(t)).length;
    return matches >= Math.min(2, titles.length);
  } catch (err) {
    return false;
  }
}


function findBestStudentResponseSheet_(formId, usedNames) {
  const ss = SpreadsheetApp.getActive();
  const form = FormApp.openById(formId);
  const titles = getInputFormItems_(form).map(x => x.title);

  let best = null;
  let bestScore = 0;

  ss.getSheets().forEach(sh => {
    if (!/^Form Responses \d+$/i.test(sh.getName())) return;
    if (usedNames?.has(sh.getName())) return;
    if (sh.getLastColumn() < 2) return;

    const headers = sh.getRange(1,1,1,sh.getLastColumn()).getDisplayValues()[0];
    const score = titles.filter(t => headers.includes(t)).length;

    if (score > bestScore) {
      best = sh;
      bestScore = score;
    }
  });

  return bestScore >= 2 ? best : null;
}


function looksLikeTeacherResponseSheet_(sheet) {
  if (!sheet || sheet.getLastColumn() < 5) return false;
  const h = sheet.getRange(1,1,1,sheet.getLastColumn()).getDisplayValues()[0];

  return h.includes('Student') &&
         h.includes('Evidence checkpoint') &&
         h.includes('Current evidence level') &&
         h.includes('Independence observed');
}


function responseSheetNumber_(name) {
  const m = String(name || '').match(/^Form Responses (\d+)$/i);
  return m ? Number(m[1]) : null;
}


function setRegistryResponseSheet_(rowNumber, sheetName) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.REGISTRY);
  sh.getRange(rowNumber, 6).setValue(sheetName);
}


function getRegistryRows_(activeOnly=true) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.REGISTRY);
  if (!sh || sh.getLastRow() < 2) return [];

  return sh.getRange(2,1,sh.getLastRow()-1,8).getValues()
    .map((r,i) => ({
      row_number: i + 2,
      project_id: String(r[0] || ''),
      spec_version: r[1],
      form_type: String(r[2] || '').toLowerCase(),
      form_id: String(r[3] || ''),
      form_url: String(r[4] || ''),
      response_sheet_name: String(r[5] || ''),
      active: r[6] === true || String(r[6]).toLowerCase() === 'true',
      created_at: r[7]
    }))
    .filter(r => r.form_id && (!activeOnly || r.active));
}


function getActiveProjectFormPair_(projectId, specVersion) {
  const rows = getRegistryRows_(true).filter(r =>
    r.project_id === projectId &&
    (specVersion === undefined || String(r.spec_version) === String(specVersion))
  );

  return {
    student: rows.find(r => r.form_type === 'student') || null,
    teacher: rows.find(r => r.form_type === 'teacher') || null
  };
}


function repairItemMapFormTypes_() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(TS.SHEETS.ITEM_MAP);
  if (!sh || sh.getLastRow() < 2) return;

  const rows = sh.getRange(2,1,sh.getLastRow()-1,10).getValues();
  const typeByForm = {};

  getRegistryRows_(false).forEach(r => {
    typeByForm[r.form_id] = r.form_type;
  });

  let changed = false;
  rows.forEach(r => {
    const expected = typeByForm[String(r[0] || '')];
    if (expected && String(r[3] || '') !== expected) {
      r[3] = expected;
      changed = true;
    }
  });

  if (changed) {
    sh.getRange(2,1,rows.length,10).setValues(rows);
    logError_('INFO', 'Repaired Form Item Map form_type values.', '');
  }
}


function patchTeacherFormsToCanonicalBands_(projectId) {
  getRegistryRows_(true)
    .filter(r => r.project_id === projectId && r.form_type === 'teacher')
    .forEach(reg => {
      const form = FormApp.openById(reg.form_id);

      form.getItems().forEach(item => {
        if (item.getType() !== FormApp.ItemType.MULTIPLE_CHOICE) return;

        if (item.getTitle() === 'Current evidence level') {
          item.asMultipleChoiceItem()
            .setChoiceValues(TS.LEVELS)
            .setRequired(true);
        }

        if (item.getTitle() === 'Independence observed') {
          item.asMultipleChoiceItem()
            .setChoiceValues(TS.INDEPENDENCE)
            .setRequired(true);
        }
      });
    });
}


function repairProjectStatusFromRegistry_(projectId) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(TS.SHEETS.PROJECTS);
  if (!sh || sh.getLastRow() < 2) return;

  const pair = getActiveProjectFormPair_(projectId);
  if (!pair.student || !pair.teacher) return;

  const rows = sh.getRange(2,1,sh.getLastRow()-1,10).getValues();

  rows.forEach((row,i) => {
    if (String(row[0]) !== projectId) return;

    row[6] = 'Forms current';
    row[7] = pair.student.form_url;
    row[8] = pair.teacher.form_url;
    row[9] = new Date();

    sh.getRange(i+2,1,1,10).setValues([row]);
  });
}


function evidenceEventExists_(formId, responseId, canonicalId) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.EVIDENCE);
  if (!sh || sh.getLastRow() < 2) return false;

  const rows = sh.getRange(2,1,sh.getLastRow()-1,17).getValues();

  return rows.some(r =>
    String(r[15] || '') === String(formId) &&
    String(r[16] || '') === String(responseId) &&
    String(r[5] || '') === String(canonicalId)
  );
}


function getInputFormItems_(form) {
  const allowed = new Set([
    String(FormApp.ItemType.MULTIPLE_CHOICE),
    String(FormApp.ItemType.LIST),
    String(FormApp.ItemType.TEXT),
    String(FormApp.ItemType.PARAGRAPH_TEXT),
    String(FormApp.ItemType.CHECKBOX),
    String(FormApp.ItemType.SCALE)
  ]);

  return form.getItems()
    .filter(item => allowed.has(String(item.getType())))
    .map(item => ({
      id: String(item.getId()),
      title: item.getTitle(),
      item
    }));
}


function scoreMultipleChoiceResponse_(item, response) {
  try {
    if (item.getType() !== FormApp.ItemType.MULTIPLE_CHOICE) return '';
    const choices = item.asMultipleChoiceItem().getChoices();

    for (const choice of choices) {
      if (String(choice.getValue()) === String(response)) {
        try { return choice.isCorrectAnswer() ? 1 : 0; }
        catch (err) { return ''; }
      }
    }
  } catch (err) {}
  return '';
}


function getNamedValue_(namedValues, title) {
  if (!namedValues || namedValues[title] === undefined) return null;
  const value = namedValues[title];
  return Array.isArray(value) ? (value[0] ?? '') : value;
}


function findEmailValue_(namedValues) {
  for (const key of Object.keys(namedValues || {})) {
    if (/email/i.test(key)) {
      const value = getNamedValue_(namedValues, key);
      if (value) return String(value);
    }
  }
  return '';
}


function getSpreadsheetSubmitTimestamp_(e) {
  try {
    const value = e.range.getSheet().getRange(e.range.getRow(),1).getValue();
    if (value instanceof Date) return value;
    if (value) return new Date(value);
  } catch (err) {}
  return new Date();
}


function loadProjectSpec_(projectId) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(TS.SHEETS.PROJECTS);
  if (!sh || sh.getLastRow() < 2) return null;

  const row = sh.getRange(2,1,sh.getLastRow()-1,10).getValues()
    .find(r => String(r[0]) === String(projectId));

  if (!row || !row[3]) return null;

  const source = String(row[3]);
  const raw = /^https?:\/\//i.test(source)
    ? fetchText_(source)
    : DriveApp.getFileById(source).getBlob().getDataAsString('UTF-8');

  const spec = JSON.parse(raw);
  validateSpec_(spec);
  return spec;
}


/**
 * Phase 2 one-click repair for the existing Drop Day form pair.
 */
function completeDropDayPhase2() {
  setupTechnologyEvidenceSystem();

  repairActiveRegistryResponseSheets_();
  repairItemMapFormTypes_();
  installScalableEvidenceRouter();
  patchTeacherFormsToCanonicalBands_('PS-DROP-DAY');
  repairProjectStatusFromRegistry_('PS-DROP-DAY');

  const report = getDropDayPhase2Preflight_();
  logError_('INFO', 'Drop Day Phase 2 repair completed.', JSON.stringify(report));

  SpreadsheetApp.getUi().alert(
    'Drop Day Phase 2',
    formatDropDayPreflight_(report),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


function dropDayPhase2Preflight() {
  const report = getDropDayPhase2Preflight_();

  SpreadsheetApp.getUi().alert(
    'Drop Day Phase 2 Preflight',
    formatDropDayPreflight_(report),
    SpreadsheetApp.getUi().ButtonSet.OK
  );

  return report;
}


function getDropDayPhase2Preflight_() {
  const projectId = 'PS-DROP-DAY';
  const pair = getActiveProjectFormPair_(projectId);
  const props = PropertiesService.getScriptProperties();
  const triggers = ScriptApp.getProjectTriggers();

  const routerCount = triggers.filter(t =>
    t.getHandlerFunction() === TS.ROUTER_HANDLER &&
    t.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
  ).length;

  const legacyHandlers = new Set([
    'onStudentAssessmentSubmit',
    'onTeacherEvidenceSubmit',
    'onStudentSubmit',
    'onTeacherSubmit'
  ]);

  const legacyCount = triggers.filter(t =>
    legacyHandlers.has(t.getHandlerFunction())
  ).length;

  const ss = SpreadsheetApp.getActive();
  const projectSheet = ss.getSheetByName(TS.SHEETS.PROJECTS);
  let projectStatus = 'missing';

  if (projectSheet && projectSheet.getLastRow() > 1) {
    const row = projectSheet.getRange(2,1,projectSheet.getLastRow()-1,10)
      .getValues()
      .find(r => String(r[0]) === projectId);
    if (row) projectStatus = String(row[6] || '');
  }

  return {
    project_id: projectId,
    project_status: projectStatus,
    student_form: !!pair.student,
    teacher_form: !!pair.teacher,
    student_response_sheet: pair.student?.response_sheet_name || '',
    teacher_response_sheet: pair.teacher?.response_sheet_name || '',
    router_count: routerCount,
    legacy_trigger_count: legacyCount,
    evidence_map_sync_sheet: !!ss.getSheetByName('Evidence Map Sync'),
    ingest_url_set: !!props.getProperty('EVIDENCE_MAP_INGEST_URL'),
    ingest_secret_set: !!props.getProperty('EVIDENCE_MAP_INGEST_SECRET'),
    learner_id_secret_set: !!props.getProperty('LEARNER_ID_SECRET')
  };
}


function formatDropDayPreflight_(r) {
  const ready =
    r.project_status === 'Forms current' &&
    r.student_form &&
    r.teacher_form &&
    !!r.student_response_sheet &&
    !!r.teacher_response_sheet &&
    r.router_count === 1 &&
    r.legacy_trigger_count === 0 &&
    r.ingest_url_set &&
    r.ingest_secret_set &&
    r.learner_id_secret_set;

  return [
    `Project: ${r.project_id}`,
    `Projects row: ${r.project_status}`,
    `Student form: ${r.student_form ? 'OK' : 'MISSING'}`,
    `Teacher form: ${r.teacher_form ? 'OK' : 'MISSING'}`,
    `Student response tab: ${r.student_response_sheet || 'UNRESOLVED'}`,
    `Teacher response tab: ${r.teacher_response_sheet || 'UNRESOLVED'}`,
    `Spreadsheet submit router: ${r.router_count}`,
    `Legacy form triggers: ${r.legacy_trigger_count}`,
    `Evidence Map Sync tab: ${r.evidence_map_sync_sheet ? 'OK' : 'MISSING'}`,
    `EVIDENCE_MAP_INGEST_URL: ${r.ingest_url_set ? 'SET' : 'MISSING'}`,
    `EVIDENCE_MAP_INGEST_SECRET: ${r.ingest_secret_set ? 'SET' : 'MISSING'}`,
    `LEARNER_ID_SECRET: ${r.learner_id_secret_set ? 'SET' : 'MISSING'}`,
    '',
    `Ready for live Drop Day tests: ${ready ? 'YES' : 'NO'}`
  ].join('\n');
}

// ---------- helpers ----------
function ensureSheet_(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.getRange(1,1,1,headers.length).setValues([headers]);
  sh.setFrozenRows(1);
  sh.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#153140').setFontColor('#ffffff');
  return sh;
}

function getConfig_(key) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.CONFIG);
  if (!sh || sh.getLastRow() < 2) return '';
  const rows = sh.getRange(2,1,sh.getLastRow()-1,2).getValues();
  const found = rows.find(r => r[0] === key);
  return found ? String(found[1]).trim() : '';
}

function validateSpec_(spec) {
  ['spec_version','project_id','project_title','knowledge_check','skill_reflection','teacher_evidence'].forEach(k => { if (spec[k] === undefined) throw new Error(`forms-spec missing required key: ${k}`); });
  if (!Array.isArray(spec.knowledge_check.items)) throw new Error('knowledge_check.items must be an array');
  if (!Array.isArray(spec.teacher_evidence.checkpoints)) throw new Error('teacher_evidence.checkpoints must be an array');
}

function sha256_(text) {
  const digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  return digest.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2,'0')).join('');
}

function upsertProjectSpec_(ss, spec, file, hash) {
  const sh = ss.getSheetByName(TS.SHEETS.PROJECTS);
  const rows = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,10).getValues() : [];
  const idx = rows.findIndex(r => r[0] === spec.project_id);
  const row = [spec.project_id,spec.project_title,spec.spec_version,file.getId(),file.getName(),hash,'Needs form generation','','',new Date()];
  if (idx >= 0) {
    const existing = rows[idx];
    if (existing[5] === hash && existing[6] === 'Forms current') row[6] = 'Forms current';
    row[7] = existing[7]; row[8] = existing[8];
    sh.getRange(idx+2,1,1,10).setValues([row]);
  } else sh.appendRow(row);
}

function upsertProjectSpecFromUrl_(ss, spec, sourceUrl, hash) {
  const sh = ss.getSheetByName(TS.SHEETS.PROJECTS);
  const rows = sh.getLastRow() > 1 ? sh.getRange(2,1,sh.getLastRow()-1,10).getValues() : [];
  const idx = rows.findIndex(r => r[0] === spec.project_id);
  const name = sourceUrl.split('/').pop() || 'forms-spec.json';
  const row = [spec.project_id,spec.project_title,spec.spec_version,sourceUrl,name,hash,'Needs form generation','','',new Date()];
  if (idx >= 0) {
    const existing = rows[idx];
    if (existing[5] === hash && existing[6] === 'Forms current') row[6] = 'Forms current';
    row[7] = existing[7]; row[8] = existing[8];
    sh.getRange(idx+2,1,1,10).setValues([row]);
  } else sh.appendRow(row);
}

function mapItem_(ss, form, item, spec, canonicalId, evidenceType, skillIds, outcomeCodes, stepId, fieldRole) {
  ss.getSheetByName(TS.SHEETS.ITEM_MAP).appendRow([form.getId(),String(item.getId()),spec.project_id, evidenceType==='Metadata' ? (form.getTitle().includes('Teacher')?'teacher':'student') : (form.getTitle().includes('Teacher')?'teacher':'student'),canonicalId,evidenceType,(skillIds||[]).join(';'),(outcomeCodes||[]).join(';'),stepId||'',fieldRole||'']);
}

function registerForm_(ss, spec, type, form, responseSheetName) {
  // Deactivate previous same-type forms for this project.
  const sh = ss.getSheetByName(TS.SHEETS.REGISTRY);
  if (sh.getLastRow() > 1) {
    const rows = sh.getRange(2,1,sh.getLastRow()-1,8).getValues();
    rows.forEach((r,i) => {
      if (r[0] === spec.project_id &&
          String(r[2]).toLowerCase() === String(type).toLowerCase() &&
          (r[6] === true || String(r[6]).toLowerCase() === 'true')) {
        sh.getRange(i+2,7).setValue(false);
      }
    });
  }

  sh.appendRow([
    spec.project_id,
    spec.spec_version,
    type,
    form.getId(),
    form.getPublishedUrl(),
    responseSheetName || '',
    true,
    new Date()
  ]);

  PropertiesService.getScriptProperties()
    .setProperty(`SPEC_${form.getId()}`, JSON.stringify(spec));
}

function findNewestResponseSheetName_(ss) {
  const sheets = ss.getSheets();
  const responseSheets = sheets.filter(s => /Form Responses/i.test(s.getName()));
  return responseSheets.length ? responseSheets[responseSheets.length-1].getName() : '';
}

function getProjectByFormId_(formId) {
  const props = PropertiesService.getScriptProperties();
  const raw = props.getProperty(`SPEC_${formId}`);
  if (raw) {
    const spec = JSON.parse(raw);
    return {project_id: spec.project_id, spec};
  }

  // Recovery path for older forms whose Script Property was lost.
  const registry = getRegistryRows_(false);
  const reg = registry.find(r => String(r.form_id) === String(formId));
  if (!reg) return null;

  const spec = loadProjectSpec_(reg.project_id);
  if (!spec) return null;

  props.setProperty(`SPEC_${formId}`, JSON.stringify(spec));
  return {project_id: spec.project_id, spec};
}

function getItemMeta_(formId, itemId) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.ITEM_MAP);
  if (!sh || sh.getLastRow() < 2) return null;
  const rows = sh.getRange(2,1,sh.getLastRow()-1,10).getValues();
  const r = rows.find(x => String(x[0]) === String(formId) && String(x[1]) === String(itemId));
  if (!r) return null;
  return {canonical_id:r[4], evidence_type:r[5], skill_ids:r[6], outcome_codes:r[7], step_id:r[8], field_role:r[9]};
}

function getRoster_(ss, courseConfigs) {
  const sh = ss.getSheetByName(TS.SHEETS.ROSTER);
  if (!sh || sh.getLastRow() < 2) return [];
  const allowed = new Set(courseConfigs.map(c=>c.course_id));
  return sh.getRange(2,1,sh.getLastRow()-1,4).getValues()
    .filter(r => r[0] && r[1] && (r[3] === true || String(r[3]).toLowerCase()==='true') && (!allowed.size || allowed.has(String(r[2]))))
    .map(r => ({name:String(r[0]), email:String(r[1]), course:String(r[2])}));
}

function appendEvidence_(obj) {
  const sh = SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.EVIDENCE);
  // Existing responses keep their original context, even when a Form/spec changes later.
  const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,18).getValues():[];
  const existing=rows.find(r=>String(r[5])===String(obj.canonical_id)&&String(r[15])===String(obj.source_form_id)&&String(r[16])===String(obj.source_response_id));
  if(existing){obj=Object.assign({},obj,{rubric_context_json:existing[17]||''});}
  else {
    if(obj.rubric_context_json){fbEventContext_(obj);fbEnsureLogContext_(sh);}
    const row=[obj.timestamp,obj.student_email,obj.student_name,obj.course_id,obj.project_id,obj.canonical_id,obj.evidence_type,obj.skill_ids,obj.outcome_codes,obj.response_value,obj.auto_score,obj.level,obj.independence,obj.teacher_note,obj.teacher_verified,obj.source_form_id,obj.source_response_id];
    if(obj.rubric_context_json)row.push(obj.rubric_context_json);
    sh.appendRow(row);
  }
  try { emOnEvidenceAppended_(obj); } catch (e) { logError_('WARN', e.message, 'emSync'); }
}


function scoreQuizItem_(itemResponse) {
  try { return itemResponse.getScore(); } catch (e) { return ''; }
}

function stringifyResponse_(value) {
  return Array.isArray(value) ? value.join('; ') : String(value ?? '');
}

function deleteTriggersForForm_(formId) {
  ScriptApp.getProjectTriggers().forEach(t => {
    try {
      if (t.getTriggerSourceId && t.getTriggerSourceId() === formId) ScriptApp.deleteTrigger(t);
    } catch (e) {}
  });
}

function logError_(level, message, context) {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(TS.SHEETS.ERRORS) || ensureSheet_(ss, TS.SHEETS.ERRORS, ['timestamp','level','message','context']);
  sh.appendRow([new Date(),level,message,context]);
}
