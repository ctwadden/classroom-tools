const { test } = require('node:test');
const assert = require('node:assert/strict');
const Profile = require('../learning-profile.js');
const C = require('../netlify/functions/_shared/evidence-core.cjs');
const { makeService } = require('../netlify/functions/_shared/evidence-service.cjs');
const rubric = C.catalogue.rubrics.find(r => r.id === 'MM12-TRUCK-AD-R1');
const support = changes => ({event_id:'support-fixture',source_revision:1,course_id:'MM12',learner_id:'fixture-learner',project_id:'PS-TRUCK-AD',step_id:'TA-S04',canonical_id:'LI-D02',stream:'support',timestamp:'2026-09-25T13:00:00Z',support_detail:{dimension_id:'LI-D02',level:2,context:'Read a mask repair brief',barrier:'Lost the order',strategy:'Three-item checklist',result:'Helped',next_action:'Try the next brief with the checklist available'},...changes});
function harness() {
  const data = new Map(), store = {get:async k=>structuredClone(data.get(k)||null),setJSON:async(k,v)=>data.set(k,structuredClone(v)),list:async({prefix=''})=>({blobs:[...data.keys()].filter(k=>k.startsWith(prefix)).map(key=>({key}))})};
  const handle=makeService({store,legacy:store,env:k=>({EVIDENCE_MAP_TEACHER_SECRET:'teacher',EVIDENCE_MAP_INGEST_SECRET:'google'})[k]});
  const call=async(action,body,role='teacher')=>{const res=await handle(new Request('https://fixture.test/?course_id=MM12&action='+action,{method:body?'POST':'GET',headers:{authorization:'Bearer '+role,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}));return {status:res.status,data:await res.json()};};
  return {call,data};
}
test('catalogue drafts never claim capture readiness; Truck maps its actual checkpoints and skills',()=>{
  assert.equal(rubric.review_ready,true);assert.equal(rubric.capture_ready,false);
  assert.ok(rubric.criteria.every(c=>c.skill_ids.length && c.step_ids.length && c.checkpoint_ids.length));
  assert.ok(rubric.criteria[2].skill_ids.includes('GD-AUD-01'));
  assert.ok(C.catalogue.rubrics.every(r=>!r.capture_ready));
  assert.ok(C.catalogue.rubrics.find(r=>r.id==='MM12-R01').readiness_issues.some(x=>x.includes('skills')));
});
test('an author cannot approve an empty, unknown or foreign-course skill mapping',()=>{
  const r={...structuredClone(rubric),id:'NEW-FIXTURE',confirmed:true};
  r.criteria[0].skill_ids=[];assert.throws(()=>C.normalizeRubric(r),/taught skills/);
  r.criteria[0].skill_ids=['MADE-UP'];assert.throws(()=>C.normalizeRubric(r),/unknown skill/);
  const foreign=C.catalogue.skills.find(s=>s.course==='IBDS');r.criteria[0].skill_ids=[foreign.id];assert.throws(()=>C.normalizeRubric(r),/unknown skill/);
});
test('approval requires the exact version shown to the teacher',async()=>{
  const h=harness();assert.equal((await h.call('rubric',{course_id:'MM12',rubric_id:rubric.id,rubric_version:'old',confirmed:true})).status,409);
  const r=await h.call('rubric',{course_id:'MM12',rubric_id:rubric.id,rubric_version:rubric.version,confirmed:true});
  assert.equal(r.status,200);assert.equal(r.data.rubric.capture_ready,true);
});
test('skill history separates learners/courses, retains unknown mappings and labels knowledge as knowledge',()=>{
  const base={course_id:'MM12',learner_id:'fixture',tutorial_skill_ids:['PS-LAY-01'],timestamp:'2026-09-01'};
  const rows=Profile.skillEvidence([{...base,project_id:'PS-DROP-DAY',stream:'knowledge',is_correct:true},{...base,project_id:'PS-TRUCK-AD',stream:'evidence'}, {...base,learner_id:'another',project_id:'private'}, {...base,course_id:'COM11',project_id:'foreign'}, {...base,project_id:'unmapped',tutorial_skill_ids:['UNKNOWN']}],C.catalogue,'MM12','fixture');
  const skill=rows.find(r=>r.id==='PS-LAY-01');assert.equal(skill.projects.length,2);assert.equal(skill.events[0].stream,'knowledge');assert.equal(skill.competencies.some(c=>c.course==='COM11'),false);assert.equal(skill.achievement,undefined);assert.equal(rows.find(r=>r.id==='UNKNOWN').registered,false);
});
test('support history keeps dimensions, task context and outcomes without a global student score',()=>{
  const first=C.normalizeEvent(support(),'field');const second=C.normalizeEvent(support({event_id:'second',timestamp:'2026-09-26T13:00:00Z',support_detail:{...support().support_detail,level:3,result:'Not checked yet',context:'A harder brief'}}),'field');
  const history=Profile.supportHistory([first,second,{...first,event_id:'legacy',support_detail:undefined},{...first,learner_id:'other'}],'MM12','fixture-learner');
  const d=history.dimensions.find(d=>d.id==='LI-D02');assert.equal(d.baseline.support_detail.level,2);assert.equal(d.latest.support_detail.level,3);assert.equal(d.latest.support_detail.context,'A harder brief');assert.equal(history.unclassified.length,1);assert.equal(history.overall,undefined);assert.equal(second.band,null);assert.equal(second.outcomes.length,0);
});
test('authenticated support saves with a receipt, deduplicates and never creates a grade',async()=>{
  const h=harness();await h.call('roster',{course_id:'MM12',learners:[{learner_id:'fixture-learner',display_name:'Synthetic fixture',active:true}]},'google');
  const body={event:support()};assert.equal((await h.call('support-checkin',body,'google')).status,403);
  const saved=await h.call('support-checkin',body);assert.equal(saved.status,200);assert.ok(saved.data.results['support-fixture'].revision_id);
  assert.equal((await h.call('support-checkin',body)).data.results['support-fixture'].dedup,true);
  const snap=(await h.call('snapshot')).data;assert.equal(snap.events.length,1);assert.equal(snap.progress.length,0);assert.equal(snap.events[0].support_detail.strategy,'Three-item checklist');
  assert.equal((await h.call('field-events',null,'google')).data.events.length,1);
});
test('support capture rejects wrong learner/project/step and any achievement payload',async()=>{
  const h=harness();await h.call('roster',{course_id:'MM12',learners:[{learner_id:'fixture-learner',display_name:'Synthetic fixture',active:true}]},'google');
  for(const change of [{learner_id:'another'},{project_id:'PS-DROP-DAY',step_id:'TA-S04'},{step_id:'TA-S99'},{level_raw:'Secure'},{tutorial_skill_ids:['PS-LAY-01']}])assert.equal((await h.call('support-checkin',{event:support(change)})).status,400);
  assert.throws(()=>C.normalizeEvent(support({support_detail:{...support().support_detail,level:5}})),/level 1–4/);
  assert.throws(()=>C.normalizeEvent(support({support_detail:{...support().support_detail,dimension_id:'LI-D99'}})),/dimension/);
});
test('incomplete previously approved rubrics are held in views without altering stored history',async()=>{
  const h=harness(),old={...structuredClone(rubric),status:'approved',capture_ready:true,version:'old-approved'};old.criteria[0].skill_ids=[];
  h.data.set('rubrics/MM12/'+old.id+'/'+old.version,old);
  const shown=(await h.call('snapshot')).data.rubrics[0];assert.equal(shown.status,'approved');assert.equal(shown.capture_ready,false);assert.equal(h.data.get('rubrics/MM12/'+old.id+'/'+old.version).capture_ready,true);
});
test('support check-ins and their revisions leave a confirmed Secure achievement unchanged',async()=>{
  const h=harness();await h.call('roster',{course_id:'MM12',learners:[{learner_id:'fixture-learner',display_name:'Synthetic fixture',active:true}]},'google');
  await h.call('events',{events:[{event_id:'achievement-proof',course_id:'MM12',learner_id:'fixture-learner',project_id:'PS-TRUCK-AD',canonical_id:'TA-OBS-01',stream:'evidence',outcome_codes_raw:'MM12-1.1',evidence_type_raw:'Observation',timestamp:'2026-09-25T12:00:00Z',teacher_note:'Synthetic: selected and justified the mask.'}]},'google');
  const review={review_id:'confirmed-fixture',course_id:'MM12',learner_id:'fixture-learner',outcome_id:'ns-mm12-2015-1.1',achievement:'Secure',comment:'Refine the contact shadow, then bring back both versions.',rationale:'Explained the choice of mask.',evidence_ids:['achievement-proof'],parents:[]};
  assert.equal((await h.call('review',review)).status,200);const before=(await h.call('snapshot')).data.progress;
  await h.call('support-checkin',{event:support()});await h.call('support-checkin',{event:support({source_revision:2,support_detail:{...support().support_detail,level:1,result:'Partly helped'}})});
  assert.deepEqual((await h.call('snapshot')).data.progress,before);
});
