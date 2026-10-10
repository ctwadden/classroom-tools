// Contract tests for the reader's applyFilters — run: node tests/get-learning-events.test.js
const { applyFilters } = require('../netlify/functions/_shared/evidence-core.cjs');
let pass = 0, fail = 0;
function eq(got, want, msg) { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; } else { fail++; console.log('FAIL', msg, '\n  got ', g, '\n  want', w); } }

const rows = [
  { learner_id: 'L1', course_id: 'MM12', project_id: 'PS-AD', stream: 'evidence', outcomes: [{ outcome_code: 'MM12-1.5', outcome_id: 'mm12-o5' }], timestamp: '2026-09-20' },
  { learner_id: 'L1', course_id: 'MM12', project_id: 'PS-AD', stream: 'knowledge', outcomes: [{ outcome_code: 'MM12-1.1', outcome_id: 'mm12-o1' }], timestamp: '2026-09-18' },
  { learner_id: 'L2', course_id: 'COM11', project_id: 'CT-DOC', stream: 'evidence', outcomes: [{ outcome_code: 'COM11-4-4', outcome_id: 'communications-technology-11-4-4' }], received_at: '2026-08-01T00:00:00Z' }
];
const none = {};
function f(o) { return Object.assign({ learner_id: '', course_id: '', project_id: '', outcome_code: '', outcome_id: '', stream: '', from: '', to: '' }, o); }

eq(applyFilters(rows, f(none)).length, 3, 'no filters -> all');
eq(applyFilters(rows, f({ learner_id: 'L1' })).length, 2, 'by learner');
eq(applyFilters(rows, f({ course_id: 'COM11' })).length, 1, 'by course');
eq(applyFilters(rows, f({ stream: 'knowledge' })).length, 1, 'by stream');
eq(applyFilters(rows, f({ project_id: 'PS-AD' })).length, 2, 'by project');
eq(applyFilters(rows, f({ outcome_id: 'mm12-o5' })).length, 1, 'by outcome_id');
eq(applyFilters(rows, f({ outcome_code: 'COM11-4-4' })).length, 1, 'by outcome_code (case exact)');
eq(applyFilters(rows, f({ from: '2026-09-01' })).length, 2, 'from date (uses timestamp)');
eq(applyFilters(rows, f({ to: '2026-08-31' })).length, 1, 'to date (falls back to received_at)');
eq(applyFilters(rows, f({ from: '2026-09-19', to: '2026-09-21' })).length, 1, 'date window');
eq(applyFilters(rows, f({ learner_id: 'L1', stream: 'evidence' })).length, 1, 'combined filters AND');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
