const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const K=require('../catalogue-core.js');
const C=require('../studio-core.js');
const data=JSON.parse(fs.readFileSync(require('node:path').join(__dirname,'../outputs/gold-standard-2026/Consolidated_Course_Data.json')));
const local=[{id:'1.1',code:'1.1',key:'M1|1.1',title:'I can edit an image',authority:'Local display'}];
test('real catalogue exposes unresolved rubrics without inventing replacements',()=>{
  const mm=K.bundles(data,'MM12',local),ds=K.bundles(data,'IBDS');
  assert.equal(mm.length,27);assert.equal(mm.filter(b=>!b.rubric).length,25);
  assert.equal(ds.length,57);assert.equal(ds.filter(b=>!b.rubric).length,57);
  assert.equal([...mm,...ds].filter(b=>b.ready).length,0);
  assert.ok(mm.find(b=>b.assignment.id==='mm12-26-s01-a2').issues.some(i=>i.code==='version'));
});
test('changed assignments follow all dated lesson links including the next sprint',()=>{
  const b=K.bundles(data,'MM12',local).find(b=>b.assignment.id==='mm12-26-s01-a2');
  assert.deepEqual(b.sprintIds,['MM12-S01','MM12-S02']);
  assert.equal(K.sprintId({sprint_id:'mm12-26-s01'}),'MM12-S01');
  assert.equal(K.sprintId({id:'unrelated'}),null);
  const changed=data.lessons.map(l=>l.id===b.lessons[0].id?{...l,title:'Teacher revised this lesson'}:l);
  assert.match(K.brief(K.bundles(data,'MM12',local,changed).find(x=>x.assignment.id===b.assignment.id)),/Teacher revised this lesson/);
});
test('outcomes resolve across code identifiers while absent DS targets remain unresolved',()=>{
  assert.equal(K.outcome(data,'MM12','ns-mm12-2015-1.1',local).key,'M1|1.1');
  const dsLocal=[{id:'ds-u02-003',code:'ds-u02-003',key:'U2|ds-u02-003',title:'Local inquiry target',authority:'Local'}];
  assert.equal(K.outcome(data,'IBDS','ds-u02-003',dsLocal).resolved,true);
  assert.equal(K.outcome(data,'IBDS','ds-plan-ai',dsLocal).resolved,false);
  assert.equal(K.outcome(data,'MM12','ns-mm12-2015-1.1',[]).key,null);
});
test('missing lessons and cross-course rubrics cannot produce a ready bundle',()=>{
  const a={id:'test',course:'MM12',title:'Test',rubric:'COM11-R01',outcome_ids:['absent'],lesson_ids:['missing']};
  const b=K.bundle(data,'MM12',a,[],data.lessons);
  assert.equal(b.rubric,null);assert.deepEqual(b.missingLessons,['missing']);assert.equal(b.ready,false);
  assert.deepEqual(b.issues.map(i=>i.code),['rubric','lessons','outcomes','materials']);
});
test('a taught flag or file reference alone cannot verify teaching materials',()=>{
  const copy=structuredClone(data),a=copy.assessments.find(a=>a.id==='mm12-26-s01-a2');
  a.display_name=a.title;
  copy.lessons.forEach(l=>{l.taught=true;l.ready=true;});
  const p={assignmentId:a.id,course:a.course};
  for(const [key] of K.REQUIREMENTS)p[key]={reference:'some-file.html',status:'verified'};
  copy.packages=[p];
  assert.equal(K.bundle(copy,'MM12',a,[],copy.lessons).ready,false);
  for(const [key] of K.REQUIREMENTS)Object.assign(p[key],{reviewedBy:'Synthetic teacher',reviewedOn:'2026-09-14'});
  assert.equal(K.bundle(copy,'MM12',a,[],copy.lessons).ready,true);
  delete p.retest;assert.equal(K.bundle(copy,'MM12',a,[],copy.lessons).ready,false);
});
test('evidence links are course-scoped and prefer explicit assignment provenance',()=>{
  const b=K.bundles(data,'MM12')[0],id=b.assignment.id;
  const rows=[{course:'MM12',attempt:id},{course:'IBDS',attempt:id},{course:'MM12',assignmentId:'other',attempt:id},{course:'MM12',assignmentId:id,attempt:id+'/retest'}];
  assert.deepEqual(K.evidenceFor(b,rows),[rows[0],rows[3]]);
  assert.ok(!K.brief(b).includes('student_id'));
});
test('assignment provenance is validated without breaking existing record backups',()=>{
  const state=C.blankState(),skill=data.skills.find(s=>s.course==='MM12').id;
  const record={id:'test',course:'MM12',student:'synthetic',skill,date:'2026-09-14',method:'Observation',level:null,support:'None',attempt:'test',note:'Observed a mask repair',verified:true,createdAt:'2026-09-14T12:00:00Z'};
  state.evidence.push(record);assert.deepEqual(C.validateState(state,data.skills),[]);
  Object.assign(record,{assignmentId:'test',catalogueVersion:'v1',rubricId:null});assert.deepEqual(C.validateState(state,data.skills),[]);
  record.catalogueVersion={};assert.match(C.validateState(state,data.skills).join(' '),/assignment provenance/);
});
