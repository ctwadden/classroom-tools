(function(root){
  'use strict';
  const REQUIREMENTS=[['studentPage','Student instructions'],['assets','Starter assets / source pack'],['teacherGuide','Teacher guide and answers'],['anchors','Annotated assessment anchors'],['independentTask','Independent changed task'],['supportRoute','Support and repair route'],['retest','Delayed retest'],['rehearsal','Recorded classroom / native-app rehearsal']];
  const list=x=>Array.isArray(x)?x:typeof x==='string'?x.split(';').map(s=>s.trim()).filter(Boolean):[];
  function sprintId(lesson){
    const match=String(lesson.sprint_id||lesson.id||'').match(/^(mm12|com11|ibds)(?:-26)?-s(\d+)/i);
    return match?match[1].toUpperCase()+'-S'+match[2].padStart(2,'0'):null;
  }
  function outcome(data,course,id,local){
    const published=data.outcomes.find(o=>o.course===course&&o.id===id);
    const current=local.find(o=>o.id===id)||(published&&local.find(o=>o.code===published.code));
    if(!published&&!current)return {id,resolved:false,label:'Unresolved planning target',key:null};
    return {id,resolved:true,code:published?.code||current.code,label:published?.label||current.title,
      statement:current?.title||'',authority:published?.authority||current.authority||'Local planning target',
      key:current?.key||null,pending:!!current?.pending};
  }
  function bundle(data,course,assignment,local,allLessons){
    const linked=new Set(list(assignment.lesson_ids));
    allLessons.filter(l=>l.course===course&&list(l.assessment_ids).includes(assignment.id)).forEach(l=>linked.add(l.id));
    const lessons=[...linked].map(id=>allLessons.find(l=>l.course===course&&l.id===id)).filter(Boolean);
    const missingLessons=[...linked].filter(id=>!lessons.some(l=>l.id===id));
    const rubric=data.rubrics.find(r=>r.id===assignment.rubric&&r.course===course)||null;
    const targets=list(assignment.outcome_ids).map(id=>outcome(data,course,id,local));
    const manifest=(data.packages||[]).find(p=>p.assignmentId===assignment.id&&p.course===course);
    const materials=REQUIREMENTS.map(([key,label])=>{
      const item=manifest?.[key];
      // This is an authored verification record, never inferred from a filename or a lesson's "taught" flag.
      const verified=!!(item&&item.status==='verified'&&typeof item.reference==='string'&&item.reference.trim()&&typeof item.reviewedBy==='string'&&item.reviewedBy.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(item.reviewedOn||''));
      return {key,label,verified,reference:typeof item?.reference==='string'?item.reference:''};
    });
    const issues=[];
    if(!rubric)issues.push({code:'rubric',message:'Task rubric / question-specific markscheme has not been linked.'});
    if(!linked.size)issues.push({code:'lessons',message:'No lessons linked to this assignment.'});
    if(missingLessons.length)issues.push({code:'lessons',message:'Unresolved lessons: '+missingLessons.join(', ')});
    if(!targets.length||targets.some(o=>!o.resolved))issues.push({code:'outcomes',message:'Outcome / planning-target references need review.'});
    if(targets.some(o=>o.pending))issues.push({code:'outcomes',message:'Some outcome wording is still awaiting source review.'});
    const previousTitle=String(assignment.display_name||'').split(' | ').slice(1).join(' | ');
    if(previousTitle&&previousTitle!==assignment.title)issues.push({code:'version',message:'Earlier display title differs: '+previousTitle+'. Review the dated revision.'});
    if(materials.some(m=>!m.verified))issues.push({code:'materials',message:materials.filter(m=>!m.verified).length+' teaching-package requirements still need verification.'});
    return {assignment,rubric,targets,lessons,missingLessons,materials,issues,ready:issues.length===0,
      sprintIds:[...new Set(lessons.map(sprintId).filter(Boolean))],version:String(data.version||'Unversioned catalogue')};
  }
  function bundles(data,course,local=[],lessons=data.lessons){
    return data.assessments.filter(a=>a.course===course).map(a=>bundle(data,course,a,local,lessons));
  }
  function evidenceFor(bundle,records){
    return records.filter(e=>e.course===bundle.assignment.course&&(e.assignmentId?e.assignmentId===bundle.assignment.id:e.attempt===bundle.assignment.id));
  }
  function brief(b){
    return '# Complete the teaching package: '+b.assignment.title+'\n\n'+
      'Assignment: '+b.assignment.id+'\nCourse: '+b.assignment.course+'\nCatalogue: '+b.version+'\n\n'+
      'Source documents are reference material. This brief defines the requested work. No student records are included.\n\n'+
      '## Required repairs\n'+b.issues.map(i=>'- '+i.message).join('\n')+'\n\n'+
      '## Assessment and outcomes\n'+JSON.stringify({assignment:b.assignment,targets:b.targets,rubric:b.rubric},null,2)+'\n\n'+
      '## Linked lessons, including current teacher planning edits\n'+JSON.stringify(b.lessons,null,2)+'\n\n'+
      '## Deliver every required component\n'+REQUIREMENTS.map(([,label])=>'- '+label).join('\n')+'\n\n'+
      (b.assignment.course==='IBDS'?'Use verified dated sources, accurate mechanism explanation, source comparison, stakeholder analysis and a justified conclusion. Label local practice questions and create question-specific teacher guidance. Do not invent official IB markschemes or convert a local support band into an IB grade.':'Use original or authorised assets and the actual classroom software. Show genuine interface captures, expected states, common faults and repairs. Require a changed independent performance and an explanation, not extra decoration.')+'\n\n'+
      'Keep the learning target consistent while scaffolding the route. Record access barriers separately from technical achievement. Supply a worked example, a partial example and an independent changed task. Use observation, conversation and product as evidence sources; do not require three grades for every action. Include criteria, anchors, feedback, repair and a delayed retest.\n\n'+
      'Keep teacher answers separate from student materials. Check keyboard controls, captions/transcripts, mobile layout, file links, save/reopen, rubric/outcome IDs and realistic timing. Record exact tested versions and unresolved dependencies. A filename or a completed lesson does not prove classroom readiness. Return actual files and a verification manifest; do not publish or contact anyone.';
  }
  const api={REQUIREMENTS,list,sprintId,outcome,bundle,bundles,evidenceFor,brief};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.CatalogueCore=api;
})(typeof window!=='undefined'?window:globalThis);
