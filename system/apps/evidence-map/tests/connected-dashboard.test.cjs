const test = require('node:test');
const assert = require('node:assert/strict');
const Core = require('../connected-dashboard-core.js');
const outcome = { outcome_id: 'mm-a' };
const event = (id, changes = {}) => ({ event_id: id, learner_id: 'a', stream: 'evidence', mapping_status: 'mapped',
  methods: ['Observation', 'Conversation'], outcomes: [outcome], band: 'Extending', support_signal: { band: 'Guided' }, ...changes });
const snapshot = changes => ({ roster: { learners: [{ learner_id: 'a', display_name: 'Fictional Alpha', active: true },
  { learner_id: 'b', display_name: 'Fictional Beta', active: true }] }, events: [], progress: [], ...changes });

test('captured achievement suggestions and support never create outcome judgments', () => {
  const summary = Core.summarise(snapshot({ events: [event('one')] }), [outcome]);
  assert.equal(summary.assessable.length, 1);
  assert.equal(summary.confirmed.length, 0);
  assert.equal(summary.bands.Extending, 0);
  assert.equal(summary.students[0].unreviewed, 1);
});
test('one multi-method record counts once in coverage and once in each method', () => {
  const summary = Core.summarise(snapshot({ events: [event('one')] }), [outcome]);
  assert.deepEqual(summary.methods, { Observation: 1, Conversation: 1, Product: 0 });
  assert.equal(summary.students[0].covered, 1);
  assert.equal(summary.students[1].eligible, 0);
});
test('diagnostics, practice, conflicts and unmapped events do not inflate assessable coverage', () => {
  const events = [event('knowledge', { stream: 'knowledge' }), event('practice', { stream: 'practice' }),
    event('conflict', { conflict: true }), event('unmapped', { mapping_status: 'needs_mapping' }),
    event('unlinked', { mapping_status: 'unlinked' }), event('reflection', { stream: 'reflection' })];
  const summary = Core.summarise(snapshot({ events }), [outcome]);
  assert.equal(summary.events.length, 6);
  assert.equal(summary.assessable.length, 0);
  assert.equal(summary.issues, 3);
  assert.equal(summary.students[0].covered, 0);
});
test('IE remains an explicit confirmed evidence gap and conflicts are withheld', () => {
  const progress = [{ learner_id: 'a', outcome_id: 'mm-a', status: 'teacher_confirmed', achievement: 'IE' },
    { learner_id: 'b', outcome_id: 'mm-a', status: 'conflict', achievement: 'Secure' }];
  const summary = Core.summarise(snapshot({ progress }), [outcome]);
  assert.equal(summary.bands.IE, 1);
  assert.equal(summary.bands.Secure, 0);
  assert.equal(summary.conflicts.length, 1);
  assert.equal(Core.reviewRows(snapshot({ progress })).length, 1);
});
test('a missing roster is empty, and genuine orphaned records get a pending link', () => {
  assert.deepEqual(Core.roster(snapshot({ roster: { learners: [] } })), []);
  const rows = Core.roster(snapshot({ roster: { learners: [] }, events: [event('one'), event('two')] }));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].roster_pending, true);
  assert.equal(rows[0].learner_id, 'a');
});
test('inactive roster students are not silently reintroduced through old records', () => {
  const source = snapshot({ roster: { learners: [{ learner_id: 'a', display_name: 'Inactive test', active: false }] }, events: [event('one')] });
  assert.equal(Core.summarise(source, [outcome]).students.length, 0);
  assert.equal(Core.summarise(source, [outcome]).events.length, 0);
});
test('CSV preserves school IDs and teacher comments, excludes support and unconfirmed grades', () => {
  const source = snapshot({ roster: { learners: [{ learner_id: 'a', display_name: 'Test', powerschool_id: '00123' }] }, progress: [
    { learner_id: 'a', course_id: 'MM12', outcome_id: 'mm-a', status: 'teacher_confirmed', achievement: 'Extending',
      support: 'Guided', comment: 'Explains "why", then revises.', ps_outcome_code: 'MM12-1.1' },
    { learner_id: 'b', course_id: 'MM12', status: 'conflict', achievement: 'Beginning', comment: 'Withhold this' }] });
  const csv = Core.reviewCSV(source);
  assert.match(csv, /"00123"/);
  assert.match(csv, /Explains ""why"", then revises/);
  assert.doesNotMatch(csv, /Guided|Withhold this|Beginning/);
  assert.match(csv, /not an assignment score import/);
});
test('CSV neutralises formula-looking comments, including leading spaces', () => {
  const csv = Core.reviewCSV(snapshot({ progress: [{ status: 'teacher_confirmed', comment: '  =SUM(1,2)' }] }));
  assert.match(csv, /"'  =SUM\(1,2\)"/);
});

const plan = require('../outputs/connected-course-map-2026-09-23/Course_Map.json');
const catalogue = require('../connected-catalogue.json');
test('current assignment packages retain the 9 / 9 / 16 sequence and actual lesson joins', () => {
  for (const [course, count] of [['MM12',9],['COM11',9],['IBDS',16]]) {
    const rows = plan.sprints.filter(s => s.course === course);
    assert.equal(rows.length, count);
    for (const s of rows) {
      const pkg = Core.assignmentPackage(plan, catalogue, s.id);
      assert.equal(pkg.sprint.assessment_id, s.assessment_id);
      assert.ok(pkg.lessons.every(l => l.course === course && l.sprint_id === s.id));
      assert.match(pkg.status, /not a completed teaching package/);
    }
  }
});
test('Truck package links exact course rubric and preserves draft versus approved versions', () => {
  const rubric = catalogue.rubrics.find(r => r.id === 'MM12-TRUCK-AD-R1');
  const pkg = Core.assignmentPackage(plan, catalogue, 'mm12-26-s02', [
    {...rubric,status:'approved'}, {...rubric,version:'newer',status:'approved'},
    {...rubric,course:'COM11',id:'foreign-rubric',status:'approved'}
  ]);
  assert.equal(pkg.rubrics.length,2);
  assert.ok(pkg.rubrics.every(r => r.course === 'MM12' && r.status === 'approved'));
  assert.equal(catalogue.rubrics.find(r => r.id === rubric.id).status,'draft');
  assert.match(pkg.projects[0].workbook_url,/Truck_Ad_Complete_Guide_v2_RC2.html$/);
  assert.match(pkg.projects[0].coach_url,/gemini.google.com/);
});
test('assignment evidence requires exact project and course, never title similarity', () => {
  const pkg = Core.assignmentPackage(plan, catalogue, 'mm12-26-s02');
  const events = [event('truck',{course_id:'MM12',project_id:'PS-TRUCK-AD'}),
    event('other-course',{course_id:'COM11',project_id:'PS-TRUCK-AD'}),
    event('same-title',{course_id:'MM12',project_id:'DIFFERENT',teacher_note:'Truck Ad'})];
  assert.deepEqual(Core.assignmentEvidence(pkg,{course_id:'MM12',events}).map(e=>e.event_id),['truck']);
  assert.deepEqual(Core.assignmentEvidence(pkg,{course_id:'COM11',events}),[]);
});
test('an unregistered package stays unresolved instead of borrowing a generic rubric', () => {
  const pkg = Core.assignmentPackage(plan,catalogue,'mm12-26-s03');
  assert.equal(pkg.projects.length,0);
  assert.equal(pkg.rubrics.length,0);
  assert.match(Core.workbookBrief(pkg),/Do not invent a project ID/);
});
test('workbook brief carries teaching flow, registered skills, checks and return contracts', () => {
  const pkg = Core.assignmentPackage(plan,catalogue,'mm12-26-s02');
  const brief = Core.workbookBrief(pkg);
  for(const text of ['mm12-26-s02-bundle','PS-TRUCK-AD','TA-MM-C1','forms-spec.json','coach-context.json',
    'mm12-26-s02-d09','Builds on','Carries forward','Knowledge','immutable','No student records']) assert.ok(brief.includes(text),text);
  assert.ok(pkg.skills.some(s=>s.id==='GD-HIE-01' && s.name!=='GD-HIE-01'));
  assert.doesNotMatch(brief,/learner_id|student_name|student_email|access_key/);
});
test('IBDS briefs preserve separate disciplinary and formal assessment rules', () => {
  const pkg = Core.assignmentPackage(plan,catalogue,'ibds-26-s01');
  assert.match(Core.workbookBrief(pkg),/local practice rubrics from official Paper\/IA instruments/);
  assert.equal(pkg.rubrics.some(r=>r.course==='MM12'),false);
});
