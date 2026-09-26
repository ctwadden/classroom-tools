/**
 * Phase 2 Evidence Router
 * Technology Evidence System
 *
 * Purpose
 * -------
 * Replace the per-Google-Form submit-trigger pattern with ONE spreadsheet
 * onFormSubmit trigger for the Technology Evidence System workbook.
 *
 * Why
 * ---
 * The 2026-09-22 Drop Day generation reached Apps Script's project trigger
 * limit ("This script has too many triggers"). The old architecture creates
 * two installable triggers per project. This file removes that scaling limit.
 *
 * This file is additive. It deliberately calls the existing append_(row)
 * function so the existing TechnologyEvidenceMapSync hook remains in the
 * evidence write path.
 */

var PHASE2 = {
  PROJECT_ID: "PS-DROP-DAY",
  SHEET_PROJECTS: "Projects",
  SHEET_REGISTRY: "Form Registry",
  SHEET_MAP: "Form Item Map",
  SHEET_EVIDENCE: "Evidence_Log",
  SHEET_LOG: "Automation Log",
  SHEET_SYNC: "Evidence Map Sync",
  ROUTER_HANDLER: "onAssessmentSpreadsheetSubmit",
  LEGACY_STUDENT_HANDLER: "onStudentSubmit",
  LEGACY_TEACHER_HANDLER: "onTeacherSubmit",
  LEVEL_OPTIONS: [
    "IE - Insufficient Evidence",
    "1 - Beginning",
    "2 - Developing",
    "3 - Secure",
    "4 - Extending"
  ],
  SUPPORT_OPTIONS: [
    "Guided",
    "Supported",
    "Independent",
    "Transfer"
  ]
};


/**
 * RUN THIS ONCE AFTER ADDING THIS FILE.
 *
 * Safe sequence:
 * 1. repair Drop Day response-sheet identities
 * 2. install the one spreadsheet form-submit router
 * 3. remove the old per-form submit triggers
 * 4. repair Form Item Map form_type values
 * 5. update the Drop Day teacher form vocabulary
 * 6. repair the Projects row to Forms current
 * 7. run a preflight and log the result
 */
function phase2CompleteDropDay() {
  var ss = SpreadsheetApp.getActive();

  phase2RepairDropDayResponseSheets_();
  phase2InstallSingleSubmitRouter_();
  phase2RepairFormItemMapTypes_();
  phase2PatchDropDayTeacherForm_();
  phase2RepairDropDayProjectRow_();

  var report = phase2DropDayPreflight_();
  phase2Log_("INFO", "Drop Day Phase 2 repair completed", JSON.stringify(report));
  SpreadsheetApp.getUi().alert(
    "Drop Day Phase 2",
    phase2FormatPreflight_(report),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}


/**
 * Spreadsheet form-submit router.
 *
 * This fires for every Form response tab linked to the Technology Evidence
 * System spreadsheet. It resolves the active form/project, normalizes the
 * response to Evidence_Log, and then calls the EXISTING append_(row).
 *
 * Because append_ is preserved, any existing Evidence Map sync hook attached
 * to append_ continues to run.
 */
function deprecatedPhase2SpreadsheetSubmit(e) {
  try {
    if (!e || !e.range) throw new Error("Missing spreadsheet form-submit event.");

    var ss = SpreadsheetApp.getActive();
    var sourceSheet = e.range.getSheet();
    var sourceResponseId = "sheet:" + sourceSheet.getSheetId() + ":row:" + e.range.getRow();
    var ctx = phase2ResolveSubmissionContext_(e);

    if (!ctx) {
      phase2Log_("WARN", "Ignored form response: no active registry match", sourceSheet.getName());
      return;
    }

    if (phase2EvidenceResponseExists_(ctx.form_id, sourceResponseId)) {
      phase2Log_("INFO", "Duplicate response ignored", ctx.form_id + " | " + sourceResponseId);
      return;
    }

    if (ctx.form_type === "teacher") {
      phase2HandleTeacherSheetSubmit_(e, ctx, sourceResponseId);
    } else {
      phase2HandleStudentSheetSubmit_(e, ctx, sourceResponseId);
    }

  } catch (err) {
    phase2Log_("ERROR", err.stack || err.message || String(err), "onAssessmentSpreadsheetSubmit");
    throw err;
  }
}


/**
 * Called from buildProject_ after forms are registered.
 * It is safe to call repeatedly.
 */
function deprecatedPhase2EnsureTrigger_() {
  var ss = SpreadsheetApp.getActive();
  var triggers = ScriptApp.getProjectTriggers();
  var keep = null;

  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === PHASE2.ROUTER_HANDLER &&
        t.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT) {
      if (!keep) keep = t;
      else ScriptApp.deleteTrigger(t);
    }
  });

  if (!keep) {
    ScriptApp.newTrigger(PHASE2.ROUTER_HANDLER)
      .forSpreadsheet(ss)
      .onFormSubmit()
      .create();
  }
}


/**
 * One-time migration from many Form triggers to one Spreadsheet trigger.
 *
 * It first removes obsolete/inactive legacy triggers to free a slot.
 * Then it installs the spreadsheet router.
 * Only after the router exists does it remove the remaining legacy form
 * triggers, avoiding a submission-processing gap during normal migration.
 */
function phase2InstallSingleSubmitRouter_() {
  var active = phase2ActiveFormIndex_();
  var triggers = ScriptApp.getProjectTriggers();

  // First free slots by deleting legacy triggers that point to inactive forms.
  triggers.forEach(function(t) {
    var h = t.getHandlerFunction();
    if (h !== PHASE2.LEGACY_STUDENT_HANDLER && h !== PHASE2.LEGACY_TEACHER_HANDLER) return;

    var sid = phase2TriggerSourceId_(t);
    if (sid && !active[sid]) ScriptApp.deleteTrigger(t);
  });

  // Install/ensure the scalable router while active legacy triggers still exist.
  ensureAssessmentSpreadsheetTrigger_();

  // Now remove all legacy per-form submission triggers.
  ScriptApp.getProjectTriggers().forEach(function(t) {
    var h = t.getHandlerFunction();
    if (h === PHASE2.LEGACY_STUDENT_HANDLER || h === PHASE2.LEGACY_TEACHER_HANDLER) {
      ScriptApp.deleteTrigger(t);
    }
  });

  phase2Log_("INFO", "Installed single spreadsheet form-submit router",
             PHASE2.ROUTER_HANDLER);
}


/**
 * Resolve the response to an active Form Registry row.
 *
 * Preferred:
 *   exact response_sheet_name match
 *
 * Fallback:
 *   teacher -> checkpoint ID finds the project/form
 *   student -> Form item-title overlap finds the form
 *
 * Once inferred, the response sheet name is written back to Form Registry.
 */
function phase2ResolveSubmissionContext_(e) {
  var sheetName = e.range.getSheet().getName();
  var active = phase2RegistryRows_(true);

  var exact = active.filter(function(r) {
    return String(r.response_sheet_name || "") === sheetName;
  });
  if (exact.length === 1) return exact[0];

  var named = e.namedValues || {};
  var checkpoint = phase2NamedValue_(named, "Evidence checkpoint");

  if (checkpoint) {
    var checkpointId = String(checkpoint).split(" - ")[0].trim();

    for (var i = 0; i < active.length; i++) {
      if (active[i].form_type !== "teacher") continue;
      var spec = phase2SpecForRegistryRow_(active[i]);
      var cps = (((spec || {}).teacher_evidence || {}).checkpoints || []);
      if (cps.some(function(c) { return String(c.evidence_id) === checkpointId; })) {
        phase2SetRegistryResponseSheet_(active[i].row_number, sheetName);
        active[i].response_sheet_name = sheetName;
        return active[i];
      }
    }
  }

  // Student-form fallback: compare event column titles with active form titles.
  var eventTitles = Object.keys(named);
  var best = null;
  var bestScore = 0;

  active.forEach(function(r) {
    if (r.form_type !== "student") return;
    try {
      var form = FormApp.openById(r.form_id);
      var titles = phase2InputItems_(form).map(function(x) { return x.title; });
      var score = titles.filter(function(t) { return eventTitles.indexOf(t) >= 0; }).length;
      if (score > bestScore) {
        bestScore = score;
        best = r;
      }
    } catch (err) {
      phase2Log_("WARN", "Could not inspect form while resolving submission",
                 r.form_id + " | " + err.message);
    }
  });

  if (best && bestScore >= 2) {
    phase2SetRegistryResponseSheet_(best.row_number, sheetName);
    best.response_sheet_name = sheetName;
    return best;
  }

  return null;
}


function phase2HandleStudentSheetSubmit_(e, ctx, sourceResponseId) {
  var form = FormApp.openById(ctx.form_id);
  var spec = phase2SpecForRegistryRow_(ctx);
  if (!spec) throw new Error("No forms spec available for " + ctx.project_id);

  var named = e.namedValues || {};
  var timestamp = phase2SubmissionTimestamp_(e);
  var email = phase2NamedValue_(named, "Email Address");
  var course = phase2NamedValue_(named, "Course / class");
  course = course ? String(course).split(" - ")[0] : "";

  var reflectionLines = [];

  phase2InputItems_(form).forEach(function(info) {
    var response = phase2NamedValue_(named, info.title);
    if (response === null || response === undefined || response === "") return;

    var m = phase2Meta_(ctx.form_id, info.id);
    if (!m) return;

    if (m.field_role === "course_id") return;

    if (m.evidence_type === "Knowledge" || m.evidence_type === "Transfer candidate") {
      var autoScore = m.evidence_type === "Knowledge"
        ? phase2AutoScore_(info.item, response)
        : "";

      var teacherNote = m.evidence_type === "Transfer candidate"
        ? "Teacher verification required before Extending evidence."
        : "";

      phase2AppendEvidence_([
        timestamp,
        email || "",
        "",
        course || "",
        ctx.project_id,
        m.canonical_id,
        m.evidence_type,
        m.skill_ids || "",
        m.outcome_codes || "",
        String(response),
        autoScore,
        "",
        "",
        teacherNote,
        false,
        ctx.form_id,
        sourceResponseId
      ]);
      return;
    }

    if (m.evidence_type === "Reflection") {
      reflectionLines.push(info.title + ": " + String(response));
    }
  });

  if (reflectionLines.length) {
    phase2AppendEvidence_([
      timestamp,
      email || "",
      "",
      course || "",
      ctx.project_id,
      ctx.project_id + "-REFLECTION",
      "Reflection",
      "",
      "",
      reflectionLines.join("\n"),
      "",
      "",
      "",
      "Student self-report; use to guide teacher follow-up.",
      false,
      ctx.form_id,
      sourceResponseId
    ]);
  }
}


function phase2HandleTeacherSheetSubmit_(e, ctx, sourceResponseId) {
  var spec = phase2SpecForRegistryRow_(ctx);
  if (!spec) throw new Error("No forms spec available for " + ctx.project_id);

  var named = e.namedValues || {};
  var timestamp = phase2SubmissionTimestamp_(e);

  var student = phase2NamedValue_(named, "Student");
  var checkpoint = phase2NamedValue_(named, "Evidence checkpoint");
  var level = phase2NamedValue_(named, "Current evidence level");
  var independence = phase2NamedValue_(named, "Independence observed");
  var note = phase2NamedValue_(named, "Evidence note - what did the student actually do or explain?");

  var sb = String(student || "").split(" | ");
  var checkpointId = String(checkpoint || "").split(" - ")[0].trim();

  var cps = (((spec || {}).teacher_evidence || {}).checkpoints || []);
  var cp = cps.filter(function(c) {
    return String(c.evidence_id) === checkpointId;
  })[0] || {};

  phase2AppendEvidence_([
    timestamp,
    sb[1] || "",
    sb[0] || "",
    sb[2] || "",
    ctx.project_id,
    checkpointId,
    cp.evidence_type || "Teacher evidence",
    (cp.skill_ids || []).join(";"),
    (cp.outcome_codes || []).join(";"),
    checkpoint || "",
    "",
    level || "",
    independence || "",
    note || "",
    true,
    ctx.form_id,
    sourceResponseId
  ]);
}


/**
 * Always route through the existing append_ function when available.
 * That preserves the current Evidence Map sync hook.
 */
function phase2AppendEvidence_(row) {
  if (typeof append_ === "function") {
    append_(row);
    return;
  }

  // Fallback only if this patch is installed before the generator source.
  var sh = SpreadsheetApp.getActive().getSheetByName(PHASE2.SHEET_EVIDENCE);
  if (!sh) throw new Error("Evidence_Log not found and append_ is unavailable.");
  sh.appendRow(row);
}


/**
 * Patch the current Drop Day teacher form to the locked terminology.
 */
function phase2PatchDropDayTeacherForm_() {
  var rows = phase2RegistryRows_(true).filter(function(r) {
    return r.project_id === PHASE2.PROJECT_ID && r.form_type === "teacher";
  });
  if (!rows.length) throw new Error("No active Drop Day teacher form registered.");

  var row = rows[rows.length - 1];
  var form = FormApp.openById(row.form_id);

  form.getItems().forEach(function(item) {
    var title = item.getTitle ? item.getTitle() : "";

    if (title === "Current evidence level" &&
        item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      item.asMultipleChoiceItem()
        .setChoiceValues(PHASE2.LEVEL_OPTIONS)
        .setRequired(true);
    }

    if (title === "Independence observed" &&
        item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      item.asMultipleChoiceItem()
        .setChoiceValues(PHASE2.SUPPORT_OPTIONS)
        .setRequired(true);
    }
  });

  phase2Log_("INFO", "Updated Drop Day teacher evidence/support vocabulary", row.form_id);
}


/**
 * Repair the Drop Day Form Registry response sheet names.
 *
 * Student form is matched from its unique Knowledge question titles.
 * Teacher form is normally the immediately following generated response tab.
 * A header-based teacher fallback is used if necessary.
 */
function phase2RepairDropDayResponseSheets_() {
  var rows = phase2RegistryRows_(true).filter(function(r) {
    return r.project_id === PHASE2.PROJECT_ID;
  });
  if (!rows.length) return;

  var student = rows.filter(function(r) { return r.form_type === "student"; })[0];
  var teacher = rows.filter(function(r) { return r.form_type === "teacher"; })[0];
  if (!student || !teacher) return;

  var studentSheet = phase2FindStudentResponseSheet_(student.form_id);
  if (studentSheet) {
    phase2SetRegistryResponseSheet_(student.row_number, studentSheet.getName());
  }

  var teacherSheet = null;
  if (studentSheet) {
    var n = phase2ResponseNumber_(studentSheet.getName());
    if (n !== null) {
      teacherSheet = SpreadsheetApp.getActive().getSheetByName("Form Responses " + (n + 1));
      if (teacherSheet && !phase2LooksLikeTeacherResponseSheet_(teacherSheet)) teacherSheet = null;
    }
  }

  if (!teacherSheet) {
    var responseSheets = SpreadsheetApp.getActive().getSheets().filter(function(s) {
      return phase2LooksLikeTeacherResponseSheet_(s);
    });
    // Drop Day is currently the most recently generated project.
    if (responseSheets.length) teacherSheet = responseSheets[responseSheets.length - 1];
  }

  if (teacherSheet) {
    phase2SetRegistryResponseSheet_(teacher.row_number, teacherSheet.getName());
  }
}


/**
 * Existing Form Item Map snapshots show teacher-form rows labelled "student".
 * Repair form_type dynamically from Form Registry.
 */
function phase2RepairFormItemMapTypes_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PHASE2.SHEET_MAP);
  if (!sh || sh.getLastRow() < 2) return;

  var headers = phase2HeaderIndex_(sh);
  if (headers.form_type === undefined) return; // Older schema without this column.

  var reg = phase2RegistryRows_(false);
  var typeByForm = {};
  reg.forEach(function(r) { typeByForm[String(r.form_id)] = r.form_type; });

  var values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  var changed = false;

  values.forEach(function(row) {
    var formId = String(row[headers.form_id] || "");
    if (!formId || !typeByForm[formId]) return;
    if (String(row[headers.form_type] || "") !== typeByForm[formId]) {
      row[headers.form_type] = typeByForm[formId];
      changed = true;
    }
  });

  if (changed) {
    sh.getRange(2, 1, values.length, values[0].length).setValues(values);
    phase2Log_("INFO", "Repaired Form Item Map form_type values", "");
  }
}


/**
 * Repair the Drop Day Projects row because form creation succeeded before the
 * trigger-limit error was thrown.
 */
function phase2RepairDropDayProjectRow_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(PHASE2.SHEET_PROJECTS);
  if (!sh || sh.getLastRow() < 2) return;

  var h = phase2HeaderIndex_(sh);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  var active = phase2RegistryRows_(true).filter(function(r) {
    return r.project_id === PHASE2.PROJECT_ID;
  });
  var student = active.filter(function(r) { return r.form_type === "student"; })[0];
  var teacher = active.filter(function(r) { return r.form_type === "teacher"; })[0];

  if (!student || !teacher) return;

  rows.forEach(function(row, idx) {
    if (String(row[h.project_id] || "") !== PHASE2.PROJECT_ID) return;

    if (h.status !== undefined) row[h.status] = "Forms current";
    if (h.student_form_url !== undefined) row[h.student_form_url] = student.form_url;
    if (h.teacher_form_url !== undefined) row[h.teacher_form_url] = teacher.form_url;
    if (h.last_synced !== undefined) row[h.last_synced] = new Date();

    sh.getRange(idx + 2, 1, 1, row.length).setValues([row]);
  });

  phase2Log_("INFO", "Repaired Drop Day Projects row", PHASE2.PROJECT_ID);
}


/**
 * Public diagnostic you can run after phase2CompleteDropDay().
 */
function phase2DropDayPreflight() {
  var report = phase2DropDayPreflight_();
  SpreadsheetApp.getUi().alert(
    "Drop Day Phase 2 Preflight",
    phase2FormatPreflight_(report),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  return report;
}


function phase2DropDayPreflight_() {
  var props = PropertiesService.getScriptProperties();
  var reg = phase2RegistryRows_(true).filter(function(r) {
    return r.project_id === PHASE2.PROJECT_ID;
  });

  var project = phase2ProjectRow_(PHASE2.PROJECT_ID);
  var triggers = ScriptApp.getProjectTriggers();

  var routerCount = triggers.filter(function(t) {
    return t.getHandlerFunction() === PHASE2.ROUTER_HANDLER &&
           t.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT;
  }).length;

  var legacyCount = triggers.filter(function(t) {
    var h = t.getHandlerFunction();
    return h === PHASE2.LEGACY_STUDENT_HANDLER || h === PHASE2.LEGACY_TEACHER_HANDLER;
  }).length;

  var student = reg.filter(function(r) { return r.form_type === "student"; })[0] || {};
  var teacher = reg.filter(function(r) { return r.form_type === "teacher"; })[0] || {};

  return {
    project_id: PHASE2.PROJECT_ID,
    project_status: project ? project.status : "missing",
    active_student_form: !!student.form_id,
    active_teacher_form: !!teacher.form_id,
    student_response_sheet: student.response_sheet_name || "",
    teacher_response_sheet: teacher.response_sheet_name || "",
    spreadsheet_router_count: routerCount,
    legacy_form_trigger_count: legacyCount,
    ingest_url_set: !!props.getProperty("EVIDENCE_MAP_INGEST_URL"),
    ingest_secret_set: !!props.getProperty("EVIDENCE_MAP_INGEST_SECRET"),
    learner_id_secret_set: !!props.getProperty("LEARNER_ID_SECRET"),
    evidence_map_sync_sheet: !!SpreadsheetApp.getActive().getSheetByName(PHASE2.SHEET_SYNC),
    ready_for_four_live_tests:
      !!student.form_id &&
      !!teacher.form_id &&
      routerCount === 1 &&
      legacyCount === 0 &&
      !!props.getProperty("EVIDENCE_MAP_INGEST_URL") &&
      !!props.getProperty("EVIDENCE_MAP_INGEST_SECRET") &&
      !!props.getProperty("LEARNER_ID_SECRET")
  };
}


function phase2FormatPreflight_(r) {
  return [
    "Project: " + r.project_id,
    "Projects row: " + r.project_status,
    "Student form: " + (r.active_student_form ? "OK" : "MISSING"),
    "Teacher form: " + (r.active_teacher_form ? "OK" : "MISSING"),
    "Student response tab: " + (r.student_response_sheet || "UNRESOLVED"),
    "Teacher response tab: " + (r.teacher_response_sheet || "UNRESOLVED"),
    "Spreadsheet submit router: " + r.spreadsheet_router_count,
    "Legacy form triggers: " + r.legacy_form_trigger_count,
    "EVIDENCE_MAP_INGEST_URL: " + (r.ingest_url_set ? "SET" : "MISSING"),
    "EVIDENCE_MAP_INGEST_SECRET: " + (r.ingest_secret_set ? "SET" : "MISSING"),
    "LEARNER_ID_SECRET: " + (r.learner_id_secret_set ? "SET" : "MISSING"),
    "Evidence Map Sync tab: " + (r.evidence_map_sync_sheet ? "OK" : "MISSING"),
    "",
    "Ready for 4 live tests: " + (r.ready_for_four_live_tests ? "YES" : "NO")
  ].join("\n");
}


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function phase2RegistryRows_(activeOnly) {
  var sh = SpreadsheetApp.getActive().getSheetByName(PHASE2.SHEET_REGISTRY);
  if (!sh || sh.getLastRow() < 2) return [];

  var h = phase2HeaderIndex_(sh);
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  return vals.map(function(row, i) {
    return {
      row_number: i + 2,
      project_id: String(row[h.project_id] || ""),
      spec_version: row[h.spec_version],
      form_type: String(row[h.form_type] || "").toLowerCase(),
      form_id: String(row[h.form_id] || ""),
      form_url: String(row[h.form_url] || ""),
      response_sheet_name: h.response_sheet_name === undefined ? "" : String(row[h.response_sheet_name] || ""),
      active: phase2Truth_(row[h.active])
    };
  }).filter(function(r) {
    return r.form_id && (!activeOnly || r.active);
  });
}


function phase2ActiveFormIndex_() {
  var out = {};
  phase2RegistryRows_(true).forEach(function(r) {
    out[r.form_id] = r.form_type;
  });
  return out;
}


function phase2HeaderIndex_(sh) {
  var values = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var out = {};
  values.forEach(function(v, i) {
    if (v !== "" && v !== null && v !== undefined) out[String(v).trim()] = i;
  });
  return out;
}


function phase2Meta_(formId, itemId) {
  var sh = SpreadsheetApp.getActive().getSheetByName(PHASE2.SHEET_MAP);
  if (!sh || sh.getLastRow() < 2) return null;

  var h = phase2HeaderIndex_(sh);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][h.form_id]) === String(formId) &&
        String(rows[i][h.item_id]) === String(itemId)) {
      return {
        canonical_id: rows[i][h.canonical_id],
        evidence_type: rows[i][h.evidence_type],
        skill_ids: rows[i][h.skill_ids],
        outcome_codes: rows[i][h.outcome_codes],
        step_id: rows[i][h.step_id],
        field_role: rows[i][h.field_role]
      };
    }
  }
  return null;
}


function phase2ProjectRow_(projectId) {
  var sh = SpreadsheetApp.getActive().getSheetByName(PHASE2.SHEET_PROJECTS);
  if (!sh || sh.getLastRow() < 2) return null;

  var h = phase2HeaderIndex_(sh);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  for (var i = 0; i < rows.length; i++) {
    if (String(rows[i][h.project_id] || "") === projectId) {
      return {
        row_number: i + 2,
        project_id: projectId,
        status: h.status === undefined ? "" : String(rows[i][h.status] || ""),
        spec_file_id: h.spec_file_id === undefined ? "" : String(rows[i][h.spec_file_id] || "")
      };
    }
  }
  return null;
}


function phase2SpecForRegistryRow_(r) {
  var props = PropertiesService.getScriptProperties();
  var key = "SPEC_" + r.form_id;
  var stored = props.getProperty(key);
  if (stored) {
    try { return JSON.parse(stored); } catch (ignore) {}
  }

  var p = phase2ProjectRow_(r.project_id);
  if (!p || !p.spec_file_id) return null;

  var raw;
  if (/^https?:\/\//i.test(p.spec_file_id)) {
    var res = UrlFetchApp.fetch(p.spec_file_id, {muteHttpExceptions: true, followRedirects: true});
    if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
      throw new Error("Could not load forms spec for " + r.project_id);
    }
    raw = res.getContentText("UTF-8");
  } else {
    raw = DriveApp.getFileById(p.spec_file_id).getBlob().getDataAsString("UTF-8");
  }

  var spec = JSON.parse(raw);
  props.setProperty(key, JSON.stringify(spec));
  return spec;
}


function phase2InputItems_(form) {
  var allowed = {};
  [
    FormApp.ItemType.MULTIPLE_CHOICE,
    FormApp.ItemType.LIST,
    FormApp.ItemType.TEXT,
    FormApp.ItemType.PARAGRAPH_TEXT,
    FormApp.ItemType.CHECKBOX,
    FormApp.ItemType.SCALE,
    FormApp.ItemType.DATE,
    FormApp.ItemType.TIME,
    FormApp.ItemType.DURATION,
    FormApp.ItemType.GRID,
    FormApp.ItemType.CHECKBOX_GRID
  ].forEach(function(t) { allowed[String(t)] = true; });

  return form.getItems().filter(function(item) {
    return allowed[String(item.getType())];
  }).map(function(item) {
    return {
      id: String(item.getId()),
      title: item.getTitle(),
      item: item
    };
  });
}


function phase2FindStudentResponseSheet_(formId) {
  var form = FormApp.openById(formId);
  var titles = phase2InputItems_(form).map(function(x) { return x.title; });
  var ss = SpreadsheetApp.getActive();

  var best = null;
  var bestScore = -1;

  ss.getSheets().forEach(function(sh) {
    if (!/^Form Responses \d+$/i.test(sh.getName())) return;
    if (sh.getLastColumn() < 2) return;

    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
    var score = titles.filter(function(t) { return headers.indexOf(t) >= 0; }).length;

    if (score > bestScore) {
      bestScore = score;
      best = sh;
    }
  });

  return bestScore >= 2 ? best : null;
}


function phase2LooksLikeTeacherResponseSheet_(sh) {
  if (!sh || sh.getLastColumn() < 5) return false;
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0];
  return headers.indexOf("Student") >= 0 &&
         headers.indexOf("Evidence checkpoint") >= 0 &&
         headers.indexOf("Current evidence level") >= 0 &&
         headers.indexOf("Independence observed") >= 0;
}


function phase2ResponseNumber_(name) {
  var m = String(name || "").match(/^Form Responses (\d+)$/i);
  return m ? Number(m[1]) : null;
}


function phase2SetRegistryResponseSheet_(rowNumber, sheetName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(PHASE2.SHEET_REGISTRY);
  var h = phase2HeaderIndex_(sh);
  if (h.response_sheet_name === undefined) return;
  sh.getRange(rowNumber, h.response_sheet_name + 1).setValue(sheetName);
}


function phase2EvidenceResponseExists_(formId, sourceResponseId) {
  var sh = SpreadsheetApp.getActive().getSheetByName(PHASE2.SHEET_EVIDENCE);
  if (!sh || sh.getLastRow() < 2) return false;

  var h = phase2HeaderIndex_(sh);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();

  return rows.some(function(r) {
    return String(r[h.source_form_id] || "") === String(formId) &&
           String(r[h.source_response_id] || "") === String(sourceResponseId);
  });
}


function phase2AutoScore_(item, response) {
  try {
    if (item.getType() !== FormApp.ItemType.MULTIPLE_CHOICE) return "";
    var choices = item.asMultipleChoiceItem().getChoices();

    for (var i = 0; i < choices.length; i++) {
      if (String(choices[i].getValue()) === String(response)) {
        try { return choices[i].isCorrectAnswer() ? 1 : 0; }
        catch (ignore) { return ""; }
      }
    }
  } catch (ignoreOuter) {}
  return "";
}


function phase2NamedValue_(namedValues, title) {
  if (!namedValues || namedValues[title] === undefined) return null;
  var v = namedValues[title];
  if (Array.isArray(v)) return v.length ? v[0] : "";
  return v;
}


function phase2SubmissionTimestamp_(e) {
  try {
    var cell = e.range.getSheet().getRange(e.range.getRow(), 1);
    var v = cell.getValue();
    if (v instanceof Date) return v;
    if (v) return new Date(v);
  } catch (ignore) {}
  return new Date();
}


function phase2TriggerSourceId_(trigger) {
  try { return trigger.getTriggerSourceId(); }
  catch (ignore) { return ""; }
}


function phase2Truth_(v) {
  return v === true || String(v).toLowerCase() === "true";
}


function phase2Log_(level, message, context) {
  var sh = SpreadsheetApp.getActive().getSheetByName(PHASE2.SHEET_LOG);
  if (!sh) return;
  sh.appendRow([new Date(), level, message, context || ""]);
}
