(function(root){
 'use strict';
 const obj=x=>x!==null&&typeof x==='object'&&!Array.isArray(x),str=x=>typeof x==='string'&&x.length<=50000;
 const date=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(x)&&!isNaN(Date.parse(x))&&new Date(x+'T12:00:00Z').toISOString().slice(0,10)===x;
 const safe=(x,d=0)=>d<40&&(!x||typeof x!=='object'||Object.entries(x).every(([k,v])=>!['__proto__','prototype','constructor'].includes(k)&&safe(v,d+1)));
 function validate(d,courses,contracts,top,studioValidator){
  const errors=[],known=cid=>courses[contracts[cid]||cid],cidOf=cid=>contracts[cid]||cid;
  const outcome=(cid,key)=>[...(courses[cid]?.modules||[]),...(courses[cid]?.legacyModules||[])].some(m=>m.outcomes.some(o=>key===m.tag+'|'+o.id));
  const record=(e,cid)=>obj(e)&&(typeof e.ref==='string'?Object.keys(e).every(k=>['ref'].includes(k)):['Pro','Obs','Con'].includes(e.f)&&str(e.note)&&date(e.date)&&(e.level===undefined||Number.isInteger(e.level)&&e.level>=0&&e.level<=top(cid))&&(e.plus===undefined||typeof e.plus==='boolean')&&(e.criteria===undefined||obj(e.criteria)&&Object.entries(e.criteria).every(([k,v])=>/^\d+$/.test(k)&&Number.isInteger(v)&&v>=0&&v<=top(cid))));
  if(!obj(d)||d.schema!==1||d.app!=='outcome-evidence-map'||!safe(d)||!Array.isArray(d.courses)||!obj(d.students)||!Array.isArray(d.evidence)||!Array.isArray(d.judgments))return ['Choose a supported full Evidence Map backup.'];
  const declared=new Set();for(const c of d.courses){const cid=c?.key||cidOf(c?.course_id);if(!known(cid)||declared.has(cid)){errors.push('Unknown or duplicate course.');continue;}declared.add(cid);}
  for(const [cid,rows] of Object.entries(d.students)){if(!known(cid)||!Array.isArray(rows)){errors.push('Invalid roster.');continue;}const ids=new Set();for(const s of rows){if(!obj(s)||!str(s.student_id)||!s.student_id||!str(s.name)||!s.name.trim()||ids.has(s.student_id)||s.imported!==undefined&&typeof s.imported!=='boolean')errors.push('Invalid or duplicate learner.');ids.add(s?.student_id);}}
  if(d.legacy_state!==undefined){if(!obj(d.legacy_state))errors.push('Invalid legacy state.');else for(const [cid,students] of Object.entries(d.legacy_state)){
    if(cid==='_ui'){if(!obj(students))errors.push('Invalid report settings.');continue;}
    if(!known(cid)||!obj(students)){errors.push('Invalid outcome course.');continue;}
    for(const [sid,cells] of Object.entries(students)){if(!sid||!obj(cells)){errors.push('Invalid learner outcome state.');continue;}for(const [key,c] of Object.entries(cells)){
      if(!outcome(cid,key)||!obj(c)||!Number.isInteger(c.level)||c.level<0||c.level>top(cid)||!Array.isArray(c.evidence)||c.evidence.some(e=>!record(e,cid))||c.conf!==undefined&&(!Number.isInteger(c.conf)||c.conf<0||c.conf>3))errors.push('Invalid nested outcome evidence: '+cid+' / '+key);
      else for(const e of c.evidence.filter(e=>e.ref)){const event=d.studio?.evidence?.find(x=>x.id===e.ref);if(!event||event.course!==cid||event.student!==sid||!event.verified||!event.outcomeLinks?.some(l=>l.key===key))errors.push('Missing or mismatched shared evidence: '+e.ref);}
    }}
  }}
  for(const e of d.evidence){const cid=cidOf(e?.course_id);if(!obj(e)||!known(cid)||!str(e.student_id)||!str(e.note)||!date(e.date)||!['Pro','Obs','Con'].includes(e.form))errors.push('Invalid portable evidence.');}
  for(const j of d.judgments){const cid=cidOf(j?.course_id);if(!obj(j)||!known(cid)||!str(j.student_id)||!Number.isInteger(j.level)||j.level<0||j.level>top(cid)||![...courses[cid].modules,...(courses[cid].legacyModules||[])].some(m=>m.outcomes.some(o=>o.id===(j.internal_outcome||j.outcome_id))))errors.push('Invalid portable judgment.');}
  for(const name of ['assessed_overrides','rubrics','term_starts','due_overrides','export_status','report_comments','report_marks'])if(d[name]!==undefined&&!obj(d[name]))errors.push('Invalid '+name+'.');
  if(obj(d.term_starts)&&Object.entries(d.term_starts).some(([cid,v])=>!known(cid)||!date(v)))errors.push('Invalid term date.');
  if(obj(d.due_overrides)&&Object.entries(d.due_overrides).some(([cid,v])=>!known(cid)||!obj(v)||Object.values(v).some(x=>!date(x))))errors.push('Invalid due date.');
  if(obj(d.rubrics)&&Object.entries(d.rubrics).some(([cid,v])=>!known(cid)||!obj(v)||Object.values(v).some(r=>!Array.isArray(r)||r.some(c=>!obj(c)||!str(c.label)||c.lv!==undefined&&(!obj(c.lv)||Object.values(c.lv).some(x=>!str(x)))))))errors.push('Invalid rubric structure.');
  if(obj(d.assessed_overrides)&&Object.entries(d.assessed_overrides).some(([cid,v])=>!known(cid)||!obj(v)||Object.values(v).some(x=>!Array.isArray(x)||x.some(id=>!str(id)))))errors.push('Invalid assessed overrides.');
  if(d.studio)errors.push(...studioValidator(d.studio));
  return [...new Set(errors)];
 }
 const api={validate,date};if(typeof module==='object'&&module.exports)module.exports=api;else root.BackupCore=api;
})(typeof window==='undefined'?globalThis:window);
