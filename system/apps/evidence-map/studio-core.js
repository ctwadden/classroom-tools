(function(root){
  'use strict';
  const COURSES=['MM12','COM11','IBDS','CP12'];
  const LEVELS=['Insufficient evidence','Beginning','Developing','Independent','Transfer'];
  const SUPPORT=['None','Access supports only','Instructional hints','Modelled together'];
  const clone=x=>JSON.parse(JSON.stringify(x));
  const validDate=s=>typeof s==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s)) && new Date(s+'T12:00:00Z').toISOString().slice(0,10)===s;
  const textValue=x=>typeof x==='string'&&x.length<=50000;
  const filled=x=>textValue(x)&&x.trim().length>0;
  const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
  const unsafe=(x,depth=0)=>depth>30||(x&&typeof x==='object'&&Object.entries(x).some(([k,v])=>['__proto__','prototype','constructor'].includes(k)||unsafe(v,depth+1)));
  const band=n=>Number.isInteger(n)&&n>=1&&n<=4;
  function blankState(){return {schema:1,profiles:{},evidence:[],diagnostics:[],groups:{},planEdits:{},planHistory:[],importedLessons:[],voids:[]};}
  function diagnosticResult(d){
    const r=d.ratings||[];
    if(r.length!==4||!r.every(band))return {total:null,suggested:null,reason:'Four criterion ratings are required.'};
    const total=r.reduce((a,b)=>a+b,0),raw=Math.min(...r);
    if(!filled(d.artifact)||!filled(d.observation)||!filled(d.explanation)||!SUPPORT.includes(d.support))return {total,suggested:null,reason:'Add the artifact, observed action and individual explanation.'};
    const cap=['Instructional hints','Modelled together'].includes(d.support)?2:4;
    return {total,suggested:Math.min(raw,cap),reason:cap===2?'Instructional help recorded; independent transfer needs a new attempt.':'Lowest of four core criteria; a local support-planning rule.'};
  }
  function activeRecords(list,state){const gone=new Set((state.voids||[]).map(v=>v.record));return list.filter(x=>!gone.has(x.id));}
  function currentReadiness(state,course,student,today,days=42){
    const attempts=activeRecords(state.diagnostics,state).filter(x=>x.course===course&&x.student===student&&x.verified&&band(x.teacherBand)&&diagnosticResult(x).suggested!==null).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));
    const last=attempts[0];if(!last)return {band:null,status:'Not assessed',attempts:0};
    const age=Math.floor((Date.parse(today)-Date.parse(last.date))/86400000);
    if(age<0||age>days||(last.reviewDate&&last.reviewDate<today))return {band:null,previous:last.teacherBand,status:'Review due',attempts:attempts.length,date:last.date};
    const independent=attempts.filter(a=>!['Instructional hints','Modelled together'].includes(a.support));
    const repeated=new Set(independent.map(a=>a.date)).size>=2;
    return {band:last.teacherBand,status:repeated?'Reviewed':'Provisional',attempts:attempts.length,date:last.date,record:last.id};
  }
  function validateState(input,skills){
    const errors=[];
    if(!object(input)||input.schema!==1||unsafe(input))return ['Unsupported studio backup schema.'];
    for(const k of ['profiles','groups','planEdits'])if(!input[k]||typeof input[k]!=='object'||Array.isArray(input[k]))errors.push('Invalid '+k+'.');
    for(const k of ['evidence','diagnostics','planHistory','importedLessons','voids'])if(!Array.isArray(input[k]))errors.push('Invalid '+k+'.');
    if(errors.length)return errors;
    const known=new Set((skills||[]).map(x=>x.id)); const ids=new Set();
    for(const [type,items] of [['evidence',input.evidence],['diagnostics',input.diagnostics]]){
      if(items.length>50000){errors.push('Too many '+type+' records.');continue;}
      items.forEach((x,i)=>{
        const pre=type+' row '+(i+1)+': ';
        if(!object(x)){errors.push(pre+'invalid record.');return;}
        if(!x.id||typeof x.id!=='string'||ids.has(x.id))errors.push(pre+'missing or duplicate ID.');ids.add(x.id);
        if(!COURSES.includes(x.course)||typeof x.student!=='string'||!x.student||!validDate(x.date))errors.push(pre+'course, student and valid date required.');
        if(typeof x.createdAt!=='string'||isNaN(Date.parse(x.createdAt))||typeof x.verified!=='boolean')errors.push(pre+'timestamp and verification required.');
        for(const key of ['artifact','note','next','attempt','access','observation','explanation','rationale','learned'])if(x[key]!==undefined&&!textValue(x[key]))errors.push(pre+'invalid '+key+'.');
        if(!SUPPORT.includes(x.support))errors.push(pre+'invalid support condition.');
        if(x.assignmentId!==undefined&&(!filled(x.assignmentId)||!filled(x.catalogueVersion)||(x.rubricId!==null&&!filled(x.rubricId))))errors.push(pre+'invalid assignment provenance.');
        if(x.outcomeLinks!==undefined&&(!Array.isArray(x.outcomeLinks)||x.outcomeLinks.some(l=>!object(l)||!filled(l.key)||(l.level!==null&&(!Number.isInteger(l.level)||l.level<1||l.level>(x.course==='IBDS'?7:4)))||!filled(l.at))))errors.push(pre+'invalid outcome links.');
        if(x.revisions!==undefined&&(!Array.isArray(x.revisions)||x.revisions.some(r=>!object(r)||!textValue(r.artifact)||!filled(r.at))))errors.push(pre+'invalid evidence revision history.');
        if(type==='evidence'){
          if((!known.has(x.skill)&&!(x.skill===null&&Array.isArray(x.outcomeLinks)&&x.outcomeLinks.length))||(x.level!==null&&!band(x.level)))errors.push(pre+'unknown skill or invalid level.');
          if(x.claimedLevel!==undefined&&x.claimedLevel!==null&&!band(x.claimedLevel))errors.push(pre+'invalid self-rating.');
          const sk=(skills||[]).find(s=>s.id===x.skill);if(sk&&sk.course!=='ALL'&&sk.course!==x.course)errors.push(pre+'skill belongs to another course.');
          if(!['Product','Observation','Conversation'].includes(x.method)||!filled(x.note)||!filled(x.attempt))errors.push(pre+'method and specific evidence required.');
        }else{
          if(!Array.isArray(x.ratings)||x.ratings.length!==4||x.ratings.some(v=>v!==null&&!band(v)))errors.push(pre+'invalid criterion profile.');
          if(x.reviewDate!==null&&x.reviewDate!==undefined&&(!validDate(x.reviewDate)||x.reviewDate<x.date))errors.push(pre+'review date must be on or after the attempt.');
          if(x.teacherBand!==null&&!band(x.teacherBand))errors.push(pre+'invalid readiness band.');
          if(x.teacherBand!==null&&(!x.verified||!x.rationale||diagnosticResult(x).suggested===null))errors.push(pre+'readiness needs complete evidence, verification and rationale.');
          if(x.teacherBand>2&&['Instructional hints','Modelled together'].includes(x.support))errors.push(pre+'a supported attempt cannot establish independent readiness.');
          if(!['PS-A','PS-B','DS-A','DS-B'].includes(x.task)||(x.course==='IBDS')!==x.task.startsWith('DS'))errors.push(pre+'task and course do not match.');
        }
      });
    }
    for(const [course,g] of Object.entries(input.groups)){
      if(!COURSES.includes(course))errors.push('Unknown seating course.');
      if(!g||!Array.isArray(g.teams)||g.teams.some(t=>!Array.isArray(t))){errors.push('Invalid seating plan.');continue;}
      const a=g.teams.flat();if(a.some(x=>typeof x!=='string')||new Set(a).size!==a.length)errors.push('Seating plan contains missing or duplicate students.');
    }
    for(const v of input.voids)if(!v||!ids.has(v.record)||typeof v.reason!=='string'||!v.reason)errors.push('Invalid correction record.');
    for(const [id,p] of Object.entries(input.profiles))if(!object(p)||!COURSES.includes(id.split(':')[0])||!id.split(':').slice(1).join(':')||['goal','supports','next'].some(k=>p[k]!==undefined&&!textValue(p[k])))errors.push('Invalid learner profile.');
    const checkLessons=rows=>{if(!Array.isArray(rows)||rows.length>2000){errors.push('Invalid imported lesson collection.');return;}const lessonIDs=new Set();for(const l of rows){if(!object(l)||!filled(l.id)||lessonIDs.has(l.id)||!COURSES.includes(l.course)||!filled(l.title)){errors.push('Invalid imported lesson.');continue;}lessonIDs.add(l.id);errors.push(...lessonErrors(l));}};
    const checkEdits=edits=>{if(!object(edits)){errors.push('Invalid planning edits.');return;}for(const [id,v] of Object.entries(edits))if(!id||!object(v)||(v.date!==null&&v.date!==undefined&&!validDate(v.date))||(v.title!==undefined&&!filled(v.title))||(v.teacher_note!==undefined&&!textValue(v.teacher_note))||(v.taught!==undefined&&typeof v.taught!=='boolean'))errors.push('Invalid lesson edit.');};
    checkLessons(input.importedLessons);checkEdits(input.planEdits);
    if(input.planHistory.length>5)errors.push('Planning history exceeds five changes.');
    for(const h of input.planHistory){if(!object(h)){errors.push('Invalid planning history.');continue;}checkLessons(h.lessons);checkEdits(h.edits);}
    return errors.slice(0,15);
  }
  function makeTeams(students){
    if(!students.length)return [];
    if(new Set(students.map(x=>x.id)).size!==students.length)throw Error('Duplicate student IDs.');
    const count=Math.max(1,Math.round(students.length/4));
    const teams=Array.from({length:count},()=>[]);
    const ranked=students.filter(x=>band(x.band)).sort((a,b)=>b.band-a.band||a.id.localeCompare(b.id));
    const unknown=students.filter(x=>!band(x.band));
    ranked.forEach((s,i)=>{const block=Math.floor(i/count),col=i%count;teams[block%2?count-1-col:col].push(s.id);});
    unknown.forEach(s=>{const min=Math.min(...teams.map(t=>t.length));teams.find(t=>t.length===min).push(s.id);});
    // Rebalance incomplete quartile passes before making a spatial layout.
    while(Math.max(...teams.map(t=>t.length))-Math.min(...teams.map(t=>t.length))>1){const big=teams.reduce((a,b)=>a.length>b.length?a:b);const small=teams.reduce((a,b)=>a.length<b.length?a:b);small.push(big.pop());}
    return teams.map(t=>t.length===4?[t[0],t[1],t[2],t[3]]:t);
  }
  function swap(teams,a,b){const out=clone(teams);const x=out[a[0]]?.[a[1]],y=out[b[0]]?.[b[1]];if(x===undefined||y===undefined)throw Error('Choose two occupied seats.');out[a[0]][a[1]]=y;out[b[0]][b[1]]=x;return out;}
  function safeCell(x){const s=String(x??'');return /^[\s]*[=+@-]/.test(s)?"'"+s:s;}
  function csv(rows){return '\uFEFF'+rows.map(r=>r.map(x=>'"'+safeCell(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');}
  function lessonErrors(l){
    const errors=[];
    if(!object(l))return ['Invalid lesson record.'];
    const mins=l.minutes??l.allocated_minutes??70;
    if(!Number.isInteger(mins)||mins<1||mins>480)errors.push('Invalid lesson duration.');
    for(const key of ['agenda','timing','build_steps','steps'])if(l[key]!==undefined&&(!Array.isArray(l[key])||l[key].some(x=>!object(x))))errors.push('Invalid '+key+' array.');
    for(const key of ['agenda','timing'])if(Array.isArray(l[key])&&l[key].length&&(l[key].some(x=>!object(x)||!Number.isFinite(x.minutes)||x.minutes<0)||l[key].reduce((n,x)=>n+(x?.minutes||0),0)!==mins))errors.push(l.id+': agenda does not match period length.');
    const date=l.date||l.planned_date||null;if(date&&!validDate(date))errors.push(l.id+': invalid date.');
    return errors;
  }
  function planPreview(payload,existing){
    const errors=[],warnings=[];let rows=[];
    if(!object(payload)||unsafe(payload)||!['teachos.course-system.v2','teachos.studio-sequence-revision.v1','teachos.advertising-sprint.v1'].includes(payload.schema))return {errors:['Unsupported planning schema. Use Course_System, Studio_Revision or Advertising_Sprint.'],rows:[]};
    for(const key of ['students','evidence','judgments','judgements','predictions'])if(payload[key]!==undefined&&payload[key]!==null&&JSON.stringify(payload[key])!=='[]')errors.push('Planning imports cannot contain '+key+'.');
    if(!Array.isArray(payload.lessons)||payload.lessons.length>2000)return {errors:['A bounded lessons array is required.'],rows:[]};
    const seen=new Set();
    payload.lessons.forEach(l=>{
      if(!object(l)){errors.push('Invalid lesson record.');return;}
      if(!filled(l.id)||seen.has(l.id))errors.push('Missing or duplicate lesson ID.');seen.add(l.id);
      if(!COURSES.includes(l.course)||!filled(l.title))errors.push('Each lesson needs a course and title.');
      if([l.score,l.level,l.assessed_at].some(v=>v!==undefined&&v!==null))errors.push('Planned scores, levels and assessment dates must be null.');
      errors.push(...lessonErrors(l));
      const mins=l.minutes??l.allocated_minutes??70,date=l.date||l.planned_date||null;
      const prior=existing.find(x=>x.id===l.id);
      rows.push({...clone(l),minutes:mins,date,source:'Imported '+payload.schema,change:prior?'Changed':'Added',priorTitle:prior?.title||''});
    });
    if(payload.schema==='teachos.studio-sequence-revision.v1'&&rows.some(l=>!existing.some(e=>e.id===l.id)))errors.push('Citrus revision requires the matching dated base lesson IDs.');
    warnings.push('Lesson content only. Assessments and curriculum references remain in the reviewed source register.');
    return {errors:[...new Set(errors)],warnings,rows};
  }
  function claimPreview(payload,skills,roster,course,existing){
    const errors=[],rows=[];
    if(!object(payload)||unsafe(payload)||payload.app!=='evidence-map-student-passport'||payload.schema!==1||!Array.isArray(payload.claims)||payload.claims.length>2000)return {errors:['Choose a student skill passport JSON export.'],rows};
    const seen=new Set(),old=new Set((existing||[]).map(e=>e.claimId).filter(Boolean));
    for(const c of payload.claims){
      if(!object(c)||!filled(c.id)||seen.has(c.id)){errors.push('Missing or duplicate claim ID.');continue;}seen.add(c.id);
      const skill=skills.find(s=>s.id===c.skill);
      if(c.course!==course||!roster.some(s=>s.id===c.student))errors.push('Claim course and student ID must match the selected class roster.');
      if(!skill||(skill.course!=='ALL'&&skill.course!==course))errors.push('Unknown skill or skill from another course.');
      if(!validDate(c.date)||!filled(c.note)||!filled(c.attempt)||!filled(c.artifact)||!SUPPORT.includes(c.support)||(c.selfRating!==null&&!band(c.selfRating))||(c.learned!==undefined&&!textValue(c.learned))||['next','artifact','note','attempt'].some(k=>!textValue(c[k])))errors.push('A claim needs a valid date, task, specific action, evidence reference and valid conditions.');
      if(!old.has(c.id))rows.push(clone(c));
    }
    return {errors:[...new Set(errors)],rows,duplicates:payload.claims.length-rows.length};
  }
  const api={COURSES,LEVELS,SUPPORT,clone,band,validDate,blankState,diagnosticResult,currentReadiness,activeRecords,validateState,makeTeams,swap,csv,planPreview,claimPreview};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.StudioCore=api;
})(typeof window!=='undefined'?window:globalThis);
