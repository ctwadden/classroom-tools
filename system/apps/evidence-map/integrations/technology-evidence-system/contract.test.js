// Contract tests for the ingest layer — run: node integrations/technology-evidence-system/contract.test.js
// Tests the REAL endpoint helpers against the committed OUTCOME_CODE_MAP / SKILL_CROSSWALK.
const { normOutcomes, bandOf, supportOf, STREAMS } = require('../../netlify/functions/_shared/evidence-core.cjs');
let pass = 0, fail = 0;
function eq(got, want, msg) { const g = JSON.stringify(got), w = JSON.stringify(want); if (g === w) { pass++; } else { fail++; console.log('FAIL', msg, '\n  got ', g, '\n  want', w); } }

// 1. Outcome-code contract: legacy + canonical resolve to the correct internal outcome_id.
eq(normOutcomes('MM12 1.1').map(o => [o.outcome_code, o.outcome_id]), [['MM12-1.1', 'ns-mm12-2015-1.1']], 'MM12 1.1 -> mm12-o1');
eq(normOutcomes('CT11 4.4').map(o => [o.outcome_code, o.outcome_id]), [['COM11-4-4', 'communications-technology-11-4-4']], 'CT11 legacy -> COM11 canonical');
eq(normOutcomes('COM11-4-4').map(o => o.outcome_id), ['communications-technology-11-4-4'], 'COM11-4-4 canonical -> outcome_id');
eq(normOutcomes('DS-U04-003').map(o => o.outcome_id), ['ds-u04-003'], 'DS canonical -> outcome_id');
eq(normOutcomes('MM12 1.1;CT11 4.4').length, 2, 'multi outcome split');
eq(normOutcomes('MM12 9.9').map(o => o.outcome_id), [null], 'unknown outcome -> null (rejected, not invented)');

// 2. Level -> band (suggested; teacher confirms). IE = no update.
eq(bandOf('IE - Insufficient Evidence'), null, 'IE -> no band');
eq(bandOf('1 - Guided / Emerging'), 'Beginning', '1 -> Beginning');
eq(bandOf('2 - Developing'), 'Developing', '2 -> Developing');
eq(bandOf('3 - Competent / Independent'), 'Secure', '3 -> Secure');
eq(bandOf('4 - Transfer / Extend'), 'Extending', '4 -> Extending');

// 3. Independence -> support band (unconfirmed).
eq(supportOf('Significant support'), 'Guided', 'support Guided');
eq(supportOf('Prompts / checkpoints'), 'Supported', 'support Supported');
eq(supportOf('Independent'), 'Independent', 'support Independent');
eq(supportOf('Adapted / transferred'), 'Transfer', 'support Transfer');

// 4. Streams whitelist.
eq(['knowledge', 'evidence', 'reflection', 'transfer', 'support'].every(s => STREAMS.has(s)), true, 'five streams present');
eq(STREAMS.has('product'), false, 'raw evidence_type is not a stream (mapped in .gs)');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
