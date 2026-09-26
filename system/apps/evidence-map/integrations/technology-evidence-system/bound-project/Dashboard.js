/**
 * Technology Evidence System - Visual Teacher Dashboard
 *
 * Teacher-only interface opened from the bound spreadsheet.
 * It does not publish student evidence to the public assessment launcher.
 */

function showTeacherDashboard() {
  const html = HtmlService.createTemplateFromFile('TeacherDashboard')
    .evaluate()
    .setWidth(1240)
    .setHeight(820);
  SpreadsheetApp.getUi().showModelessDialog(html, 'Technology Evidence Dashboard');
}

function getTeacherDashboardData(filters) {
  filters = filters || {};
  const ss = SpreadsheetApp.getActive();
  const roster = dashboardRows_(ss, TS.SHEETS.ROSTER);
  const evidence = dashboardRows_(ss, TS.SHEETS.EVIDENCE);
  const projects = dashboardRows_(ss, TS.SHEETS.PROJECTS);

  const projectTitles = {};
  projects.forEach(r => {
    const id = String(r.project_id || '').trim();
    if (id) projectTitles[id] = String(r.project_title || id);
  });

  const activeRoster = roster.filter(r => dashboardBool_(r.active));
  const allCourses = dashboardUnique_(activeRoster.map(r => String(r.course_id || '').trim()).filter(Boolean));
  const allProjects = dashboardUnique_(evidence.map(r => String(r.project_id || '').trim()).filter(Boolean));
  const allStudents = activeRoster.map(r => ({
    name: String(r.student_name || '').trim(),
    email: String(r.student_email || '').trim(),
    course: String(r.course_id || '').trim()
  })).filter(r => r.email || r.name);

  const courseFilter = String(filters.course || '').trim();
  const projectFilter = String(filters.project || '').trim();
  const studentFilter = String(filters.student || '').trim().toLowerCase();

  const visibleRoster = activeRoster.filter(r => {
    const course = String(r.course_id || '').trim();
    const key = `${String(r.student_name || '')} ${String(r.student_email || '')}`.toLowerCase();
    return (!courseFilter || course === courseFilter) && (!studentFilter || key.includes(studentFilter));
  });

  const visibleEvidence = evidence.filter(r => {
    const course = String(r.course_id || '').trim();
    const project = String(r.project_id || '').trim();
    const key = `${String(r.student_name || '')} ${String(r.student_email || '')}`.toLowerCase();
    return (!courseFilter || course === courseFilter) &&
           (!projectFilter || project === projectFilter) &&
           (!studentFilter || key.includes(studentFilter));
  });

  const verified = visibleEvidence.filter(r => dashboardBool_(r.teacher_verified));
  const supporting = visibleEvidence.filter(r => !dashboardBool_(r.teacher_verified));

  const evidenceMix = {
    Observation: 0,
    Conversation: 0,
    Product: 0,
    Knowledge: 0,
    Reflection: 0,
    Transfer: 0,
    Other: 0
  };
  visibleEvidence.forEach(r => {
    const t = dashboardEvidenceBucket_(r.evidence_type);
    evidenceMix[t] = (evidenceMix[t] || 0) + 1;
  });

  const rosterByEmail = {};
  activeRoster.forEach(r => {
    const email = String(r.student_email || '').trim().toLowerCase();
    if (email) rosterByEmail[email] = r;
  });

  const studentMap = {};
  visibleRoster.forEach(r => {
    const email = String(r.student_email || '').trim().toLowerCase();
    const key = email || `name:${String(r.student_name || '').trim().toLowerCase()}`;
    studentMap[key] = dashboardStudentSeed_(r);
  });

  visibleEvidence.forEach(r => {
    const email = String(r.student_email || '').trim().toLowerCase();
    const rosterRow = rosterByEmail[email] || null;
    const name = String(r.student_name || rosterRow?.student_name || '').trim();
    const course = String(r.course_id || rosterRow?.course_id || '').trim();
    const key = email || `name:${name.toLowerCase()}`;
    if (!studentMap[key]) studentMap[key] = dashboardStudentSeed_({student_name:name, student_email:email, course_id:course});
    const s = studentMap[key];
    s.totalEvidence++;
    const bucket = dashboardEvidenceBucket_(r.evidence_type);
    s.allTypes[bucket] = (s.allTypes[bucket] || 0) + 1;
    if (dashboardBool_(r.teacher_verified)) {
      s.verifiedCount++;
      s.verifiedTypes[bucket] = (s.verifiedTypes[bucket] || 0) + 1;
      const level = dashboardLevel_(r.level);
      if (level.code) s.levelCounts[level.code] = (s.levelCounts[level.code] || 0) + 1;
      if (level.rank > s.highestRank) {
        s.highestRank = level.rank;
        s.highestLevel = level.label;
      }
      if (level.rank === 4) s.transferSignals++;
    }
    const date = dashboardDate_(r.timestamp);
    if (date && (!s.lastEvidenceDate || date > s.lastEvidenceDate)) s.lastEvidenceDate = date;
  });

  const studentSummaries = Object.values(studentMap).map(s => {
    const core = ['Observation','Conversation','Product'];
    const present = core.filter(t => (s.verifiedTypes[t] || 0) > 0);
    const missing = core.filter(t => (s.verifiedTypes[t] || 0) === 0);
    s.reviewReady = s.verifiedCount >= 3 && present.length >= 2;
    s.status = s.verifiedCount === 0 ? 'Needs evidence' : (s.reviewReady ? 'Review ready' : 'Building evidence');
    s.missing = missing;
    s.lastEvidence = s.lastEvidenceDate ? dashboardFormatDate_(s.lastEvidenceDate) : '—';
    delete s.lastEvidenceDate;
    delete s.highestRank;
    return s;
  }).sort((a,b) => {
    const order = {'Needs evidence':0,'Building evidence':1,'Review ready':2};
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.name.localeCompare(b.name);
  });

  const projectMap = {};
  visibleEvidence.forEach(r => {
    const id = String(r.project_id || '').trim() || 'UNKNOWN';
    if (!projectMap[id]) projectMap[id] = {
      id,
      title: projectTitles[id] || id,
      totalEvidence: 0,
      verifiedEvidence: 0,
      students: {},
      Observation: 0,
      Conversation: 0,
      Product: 0,
      Knowledge: 0,
      Reflection: 0,
      Transfer: 0,
      lastDate: null
    };
    const p = projectMap[id];
    p.totalEvidence++;
    const email = String(r.student_email || '').trim().toLowerCase();
    if (email) p.students[email] = true;
    const bucket = dashboardEvidenceBucket_(r.evidence_type);
    p[bucket] = (p[bucket] || 0) + 1;
    if (dashboardBool_(r.teacher_verified)) p.verifiedEvidence++;
    const date = dashboardDate_(r.timestamp);
    if (date && (!p.lastDate || date > p.lastDate)) p.lastDate = date;
  });
  const projectSummaries = Object.values(projectMap).map(p => ({
    id:p.id,
    title:p.title,
    totalEvidence:p.totalEvidence,
    verifiedEvidence:p.verifiedEvidence,
    students:Object.keys(p.students).length,
    Observation:p.Observation,
    Conversation:p.Conversation,
    Product:p.Product,
    Knowledge:p.Knowledge,
    Reflection:p.Reflection,
    Transfer:p.Transfer,
    lastUpdated:p.lastDate ? dashboardFormatDate_(p.lastDate) : '—'
  })).sort((a,b) => b.verifiedEvidence - a.verifiedEvidence || a.title.localeCompare(b.title));

  const skillMap = {};
  verified.forEach(r => {
    const email = String(r.student_email || '').trim().toLowerCase();
    dashboardSplitIds_(r.skill_ids).forEach(id => {
      if (!skillMap[id]) skillMap[id] = {id, evidence:0, students:{}, levels:{}};
      const s = skillMap[id];
      s.evidence++;
      if (email) s.students[email] = true;
      const level = dashboardLevel_(r.level);
      if (level.code) s.levels[level.code] = (s.levels[level.code] || 0) + 1;
    });
  });
  const skillSummaries = Object.values(skillMap).map(s => ({
    id:s.id,
    evidence:s.evidence,
    students:Object.keys(s.students).length,
    levels:s.levels,
    coverage: visibleRoster.length ? Math.round((Object.keys(s.students).length / visibleRoster.length) * 100) : 0
  })).sort((a,b) => b.students - a.students || b.evidence - a.evidence).slice(0,16);

  const recent = verified.map(r => ({
    timestamp: dashboardFormatDateTime_(dashboardDate_(r.timestamp)),
    student: String(r.student_name || rosterByEmail[String(r.student_email || '').toLowerCase()]?.student_name || r.student_email || ''),
    course: String(r.course_id || ''),
    project: projectTitles[String(r.project_id || '')] || String(r.project_id || ''),
    evidenceId: String(r.canonical_id || ''),
    type: dashboardEvidenceBucket_(r.evidence_type),
    level: String(r.level || ''),
    independence: String(r.independence || ''),
    note: String(r.teacher_note || r.response_value || '')
  })).sort((a,b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0,15);

  const reviewReady = studentSummaries.filter(s => s.reviewReady).length;
  const needsEvidence = studentSummaries.filter(s => s.verifiedCount === 0).length;
  const building = studentSummaries.filter(s => s.verifiedCount > 0 && !s.reviewReady).length;
  const verifiedStudents = studentSummaries.filter(s => s.verifiedCount > 0).length;

  return {
    confirmedProgress: dashboardRows_(ss, 'Evidence Map Progress').filter(r => (!courseFilter || String(r.course_id) === courseFilter) && (!studentFilter || String(r.student_name || '').toLowerCase().includes(studentFilter))),
    generatedAt: Utilities.formatDate(new Date(), getConfig_(TS.CONFIG_KEYS.TIMEZONE) || Session.getScriptTimeZone() || 'America/Halifax', 'MMM d, yyyy h:mm a'),
    filters: {course:courseFilter, project:projectFilter, student:studentFilter},
    options: {
      courses: allCourses,
      projects: allProjects.map(id => ({id, title:projectTitles[id] || id})).sort((a,b)=>a.title.localeCompare(b.title)),
      students: allStudents.sort((a,b)=>a.name.localeCompare(b.name))
    },
    kpis: {
      activeStudents: visibleRoster.length,
      verifiedStudents,
      verifiedEvidence: verified.length,
      supportingEvidence: supporting.length,
      reviewReady,
      building,
      needsEvidence
    },
    evidenceMix,
    projects: projectSummaries,
    students: studentSummaries,
    skills: skillSummaries,
    recent,
    notes: [
      'Review ready means the student has at least 3 teacher-verified records across at least 2 of Observation / Conversation / Product. It is not an automatic competency judgement.',
      'Knowledge checks, reflections and self-ratings are supporting evidence and do not auto-confirm competency.'
    ]
  };
}

function activateEvidenceLogSheet() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(TS.SHEETS.EVIDENCE);
  if (sh) ss.setActiveSheet(sh);
}

function activateRosterSheet() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName(TS.SHEETS.ROSTER);
  if (sh) ss.setActiveSheet(sh);
}

function dashboardRows_(ss, sheetName) {
  const sh = ss.getSheetByName(sheetName);
  if (!sh || sh.getLastRow() < 2 || sh.getLastColumn() < 1) return [];
  const values = sh.getDataRange().getValues();
  const headers = values.shift().map(h => String(h).trim());
  return values.filter(r => r.some(v => v !== '' && v !== null)).map(row => {
    const obj = {};
    headers.forEach((h,i) => obj[h] = row[i]);
    return obj;
  });
}

function dashboardBool_(v) {
  return v === true || String(v).trim().toLowerCase() === 'true' || String(v).trim() === '1';
}

function dashboardUnique_(arr) {
  return [...new Set(arr)].sort();
}

function dashboardSplitIds_(value) {
  return String(value || '').split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

function dashboardEvidenceBucket_(value) {
  const v = String(value || '').toLowerCase();
  if (v.includes('observation')) return 'Observation';
  if (v.includes('conversation')) return 'Conversation';
  if (v.includes('product')) return 'Product';
  if (v.includes('knowledge')) return 'Knowledge';
  if (v.includes('reflection')) return 'Reflection';
  if (v.includes('transfer')) return 'Transfer';
  return 'Other';
}

function dashboardLevel_(value) {
  const text = String(value || '').trim();
  if (!text) return {code:'', rank:0, label:''};
  if (/^4\b/.test(text)) return {code:'4', rank:4, label:text};
  if (/^3\b/.test(text)) return {code:'3', rank:3, label:text};
  if (/^2\b/.test(text)) return {code:'2', rank:2, label:text};
  if (/^1\b/.test(text)) return {code:'1', rank:1, label:text};
  if (/^IE\b/i.test(text)) return {code:'IE', rank:0, label:text};
  return {code:'', rank:0, label:text};
}

function dashboardDate_(value) {
  if (!value) return null;
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value)) return value;
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function dashboardFormatDate_(date) {
  if (!date) return '—';
  return Utilities.formatDate(date, getConfig_(TS.CONFIG_KEYS.TIMEZONE) || Session.getScriptTimeZone() || 'America/Halifax', 'MMM d');
}

function dashboardFormatDateTime_(date) {
  if (!date) return '—';
  return Utilities.formatDate(date, getConfig_(TS.CONFIG_KEYS.TIMEZONE) || Session.getScriptTimeZone() || 'America/Halifax', 'MMM d, h:mm a');
}

function dashboardStudentSeed_(r) {
  return {
    name: String(r.student_name || r.student_email || 'Unknown student').trim(),
    email: String(r.student_email || '').trim(),
    course: String(r.course_id || '').trim(),
    totalEvidence: 0,
    verifiedCount: 0,
    allTypes: {},
    verifiedTypes: {},
    levelCounts: {},
    transferSignals: 0,
    highestLevel: '',
    highestRank: 0,
    lastEvidenceDate: null
  };
}
