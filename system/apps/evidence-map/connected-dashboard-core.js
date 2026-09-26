(function (root) {
  'use strict';
  const bands = ['Beginning', 'Developing', 'Secure', 'Extending', 'IE'];
  const methods = ['Observation', 'Conversation', 'Product'];
  const eligible = event => !event.conflict && event.mapping_status === 'mapped' &&
    ['evidence', 'transfer'].includes(event.stream) && (event.outcomes || []).some(o => o.outcome_id);

  function roster(snapshot) {
    const supplied = snapshot.roster?.learners || [];
    const known = new Set(supplied.map(l => l.learner_id));
    const learners = supplied.filter(l => l.active !== false).map(l => ({ ...l }));
    for (const record of [...(snapshot.events || []), ...(snapshot.progress || [])]) {
      if (!known.has(record.learner_id)) {
        learners.push({ learner_id: record.learner_id, display_name: 'Roster link pending', roster_pending: true });
        known.add(record.learner_id);
      }
    }
    return learners.sort((a, b) => a.display_name.localeCompare(b.display_name));
  }

  function summarise(snapshot, outcomes) {
    const learners = roster(snapshot), active = new Set(learners.map(l => l.learner_id));
    const events = (snapshot.events || []).filter(e => active.has(e.learner_id));
    const progress = (snapshot.progress || []).filter(p => active.has(p.learner_id));
    const assessable = events.filter(eligible), confirmed = progress.filter(p => p.status === 'teacher_confirmed');
    const mappedIssues = events.filter(e => e.conflict || (['evidence', 'transfer'].includes(e.stream) && e.mapping_status !== 'mapped'));
    const conflicts = progress.filter(p => p.status === 'conflict');
    const activeOutcomes = new Set(outcomes.map(o => o.outcome_id));
    const students = learners.map(l => {
      const es = events.filter(e => e.learner_id === l.learner_id);
      const ae = assessable.filter(e => e.learner_id === l.learner_id);
      const decisions = confirmed.filter(p => p.learner_id === l.learner_id);
      const covered = new Set(ae.flatMap(e => (e.outcomes || []).map(o => o.outcome_id)).filter(id => activeOutcomes.has(id)));
      const unreviewed = [...covered].filter(id => !decisions.some(p => p.outcome_id === id));
      return { ...l, events: es, eligible: ae.length, covered: covered.size, confirmed: decisions.length,
        unreviewed: unreviewed.length,
        issues: mappedIssues.filter(e => e.learner_id === l.learner_id).length + conflicts.filter(p => p.learner_id === l.learner_id).length,
        methods: Object.fromEntries(methods.map(m => [m, ae.filter(e => (e.methods || []).includes(m)).length])) };
    });
    return { students, events, assessable, confirmed, conflicts, issues: mappedIssues.length + conflicts.length,
      methods: Object.fromEntries(methods.map(m => [m, assessable.filter(e => (e.methods || []).includes(m)).length])),
      bands: Object.fromEntries(bands.map(b => [b, confirmed.filter(p => p.achievement === b).length])) };
  }

  function reviewRows(snapshot) {
    return (snapshot.progress || []).filter(p => p.status === 'teacher_confirmed').map(p => {
      const learner = (snapshot.roster?.learners || []).find(l => l.learner_id === p.learner_id);
      return { ...p, display_name: learner?.display_name || 'Roster link pending', powerschool_id: learner?.powerschool_id || '' };
    });
  }

  function reviewCSV(snapshot) {
    const cell = value => '"' + String(value ?? '').replace(/^(\s*)([=+@-])/, "'$1$2").replace(/"/g, '""') + '"';
    const rows = [['course_id', 'learner_id', 'powerschool_student_id', 'outcome_id', 'reference_outcome_code', 'achievement', 'teacher_comment', 'reviewed_at', 'export_status']];
    for (const p of reviewRows(snapshot)) rows.push([p.course_id, p.learner_id, p.powerschool_id, p.outcome_id,
      p.ps_outcome_code, p.achievement, p.comment, p.updated_at,
      'TEACHER REVIEW — course-outcome judgment; not an assignment score import']);
    return rows.map(r => r.map(cell).join(',')).join('\r\n');
  }
  function assignmentPackage(plan, catalogue, sprintId, approved = []) {
    const sprint = (plan?.sprints || []).find(s => s.id === sprintId);
    if (!sprint) return null;
    const links = (catalogue.assignment_links?.sprints || []).find(s => s.sprint_id === sprintId);
    const projects = links?.projects || [], resources = links?.resources || [];
    const projectIds = new Set(projects.map(p => p.project_id));
    const rubricIds = new Set(projects.flatMap(p => p.rubric_ids || []));
    const releases = new Map();
    (catalogue.rubrics || []).filter(r => r.course === sprint.course && (rubricIds.has(r.id) || projectIds.has(r.project_id)))
      .forEach(r => releases.set(r.id + '@' + r.version, { ...r, status: 'draft' }));
    approved.filter(r => r.course === sprint.course && r.status === 'approved' && (rubricIds.has(r.id) || projectIds.has(r.project_id)))
      .forEach(r => releases.set(r.id + '@' + r.version, r));
    const targets = (sprint.outcome_refs || []).map(ref => (catalogue.outcomes || []).find(o =>
      o.course_id === sprint.course && [o.outcome_id, o.outcome_code, o.display_code, ...(o.aliases || [])].includes(ref)) ||
      { outcome_id: null, display_code: ref, outcome_title: 'Outcome mapping needs review', authority: 'Unresolved' });
    const skills = (sprint.skills || []).map(id => {
      const row = catalogue.crosswalk?.crosswalk?.find(s => s.tutorial_skill_id === id);
      const skill = (catalogue.skills || []).find(s => s.course === sprint.course && s.id === id);
      return { id, name: row?.tutorial_label || skill?.name || id, registered: !!(row || skill) };
    });
    const lessons = (plan.lessons || []).filter(l => l.course === sprint.course && l.sprint_id === sprint.id);
    return { sprint, projects, resources, rubrics: [...releases.values()], targets, skills, lessons,
      plan_version: plan.plan_version, status: 'Preparation required — the planned bundle is not a completed teaching package' };
  }

  function assignmentEvidence(pkg, snapshot) {
    if (!pkg || snapshot?.course_id !== pkg.sprint.course) return [];
    const projects = new Set(pkg.projects.map(p => p.project_id));
    return (snapshot.events || []).filter(e => e.course_id === pkg.sprint.course && projects.has(e.project_id));
  }

  function workbookBrief(pkg) {
    if (!pkg) return '';
    const s = pkg.sprint;
    return `# Build the connected teaching package: ${s.title}\n\n` +
      `Course: ${s.course}\nSprint: ${s.id}\nAssessment bundle: ${s.assessment_id}\nPlan version: ${pkg.plan_version}\n` +
      `Teaching window: ${s.start} to ${s.end}; ${s.periods} planned lessons. These are planning dates, not proof of readiness.\n\n` +
      'Continue the existing ChatGPT workbook-maker conversation. Preserve the Truck Ad workbook quality and Learning Studio Workbook Standard v2. Build this assignment inside its existing course sequence.\n' +
      'Standard: https://outcome-evidence-map.netlify.app/outputs/connected-system-handoff-2026-09-23/LEARNING_STUDIO_WORKBOOK_STANDARD_v2.md\n' +
      'Interface: https://outcome-evidence-map.netlify.app/outputs/connected-system-handoff-2026-09-23/INTERFACE_CONTRACT.json\n\n' +
      '## Teaching purpose and flow\n' +
      [['Purpose', s.brief], ['Builds on', s.builds_on], ['New learning', s.new_learning], ['Carries forward', s.carry_forward],
        ['Independent product', s.product], ['Observation', s.observation], ['Conversation', s.conversation], ['Transfer', s.transfer],
        ['Teacher sampling', s.review_focus], ['Support', s.support], ['Extension', s.extension]]
        .map(([label, value]) => `- ${label}: ${value || 'Specify before use.'}`).join('\n') + '\n\n' +
      '## Existing identities, outcomes, skills and rubric versions\n' +
      'Retain supplied IDs. Do not invent a project ID, outcome equivalence, live Form URL or rubric approval to fill a gap. Return unresolved registrations explicitly. Existing rubric versions are immutable; substantive changes require a new release.\n\n' +
      'Use the existing tutorials and their source assets below before creating replacement content. A teaching-resource link alone does not register an evidence project.\n\n' +
      JSON.stringify({ projects: pkg.projects, resources: pkg.resources, outcomes: pkg.targets, skills: pkg.skills, rubrics: pkg.rubrics }, null, 2) + '\n\n' +
      '## Planned lessons to develop\n' + JSON.stringify(pkg.lessons, null, 2) + '\n\n' +
      '## Required connected output\n' +
      '- Student workbook HTML and matching printable version; real starter assets, checks, repair help, practice and an unfamiliar transfer task.\n' +
      '- Teacher preparation notes, timing, expected responses, examples, conversation prompts and answer guidance; keep teacher answers separate.\n' +
      '- Outcome/skill/criterion map linking the teaching, practice and independent evidence. One coherent task rubric with suitable Observation, Conversation and Product look-fors; do not require three separate grades for each criterion.\n' +
      '- Knowledge and bounded reflection checks with forms-spec.json, canonical item IDs and correct answers/feedback. Reuse the existing Google intake; do not create new storage, public roster files or per-assignment triggers.\n' +
      '- Coach context for the same steps and IDs: assessed thinking, allowed scaffolding and prohibited answer substitution. No student records belong in the coach context.\n' +
      '- project-manifest.yml, Step_Map.csv, coach-context.json, forms-spec.json, evidence-map.md, course-catalog-entry.json, asset/source provenance and a QA record. Return versioned files and the registration changes together.\n' +
      '- A reporting description and evidence-based comment scaffold with a strength and next step. Teacher-confirmed outcome achievement and support remain separate; no automatic percentage or IB grade.\n\n' +
      (s.course === 'IBDS' ? 'Use the Digital Society reasoning structure. Verify the current syllabus and distinguish local practice rubrics from official Paper/IA instruments. Include mechanism explanation, sources, analysis, alternatives and justified judgment; never fabricate an official paper or markscheme.\n' : 'Teach SELECT FIRST → ACTIONS → WHY → CHECK → FIX. Preserve the strong Truck Ad explanations and meaningful design decisions; do not merely reskin an unrelated workbook.\n') +
      '\n## Completion check\nA workbook file alone is not completion. Verify assets, links, instruction, timing, rubric alignment and return metadata. Evidence Map remains the main dashboard; Google owns roster and intake; /field/ captures against the same approved rubric. Report unfinished work honestly. No student records or credentials are included in this brief.\n';
  }
  const api = { bands, methods, eligible, roster, summarise, reviewRows, reviewCSV, assignmentPackage, assignmentEvidence, workbookBrief };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.EvidenceDashboard = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
