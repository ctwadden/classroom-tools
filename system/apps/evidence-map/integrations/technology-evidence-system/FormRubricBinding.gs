/** Optional, version-frozen criterion choices for newly generated teacher Forms. */
function fbCourse_(course){return String(course||'').replace(/^CT11$/,'COM11');}
function fbChoices_(spec){return spec.teacher_evidence && spec.teacher_evidence.criterion_choices || [];}
function fbValidateChoices_(spec,approved){
  const choices=fbChoices_(spec);if(!choices.length)return;
  const labels=new Set(),courses=new Set((spec.course_configs||[]).map(c=>fbCourse_(c.course_id)));
  const checkpoints=spec.teacher_evidence.checkpoints||[];
  choices.forEach(choice=>{
    if(!choice.choice_label||labels.has(choice.choice_label))throw new Error('Criterion choices need unique labels.');
    labels.add(choice.choice_label);
    if(!courses.has(choice.course_id))throw new Error('Unknown criterion-choice course.');
    const cp=checkpoints.find(c=>c.evidence_id===choice.checkpoint_id);
    if(!cp)throw new Error('Unknown criterion-choice checkpoint: '+choice.checkpoint_id);
    if(emStreamOf_(cp.evidence_type)!=='evidence')throw new Error('Criterion choices require O/C/P checkpoints.');
    if(choice.unbound===true){
      if(choice.rubric_id||choice.rubric_version||choice.criterion_id)throw new Error('General evidence cannot claim a rubric.');
      return;
    }
    const matches=approved.filter(r=>r.course===choice.course_id&&r.project_id===spec.project_id&&r.id===choice.rubric_id&&r.version===choice.rubric_version&&r.status==='approved'&&r.capture_ready===true);
    if(matches.length!==1)throw new Error('Exact approved, capture-ready rubric required: '+choice.rubric_id+' '+choice.rubric_version);
    const criterion=matches[0].criteria.find(c=>c.id===choice.criterion_id);
    if(!criterion)throw new Error('Unknown rubric criterion.');
    if(!(criterion.checkpoint_ids||[]).includes(choice.checkpoint_id))throw new Error('Checkpoint is not mapped to the selected criterion.');
    if(!Array.isArray(choice.outcome_codes)||!choice.outcome_codes.length||choice.outcome_codes.some(c=>!criterion.outcome_codes.includes(c)))throw new Error('Criterion outcome mismatch.');
    if(!Array.isArray(choice.skill_ids)||!choice.skill_ids.length||choice.skill_ids.some(s=>!criterion.skill_ids.includes(s)||!(cp.skill_ids||[]).includes(s)))throw new Error('Criterion/checkpoint skill mismatch.');
  });
  courses.forEach(course=>{if(!choices.some(c=>c.course_id===course))throw new Error('Teacher choices omit course '+course);});
}
function fbPreflight_(spec){
  const choices=fbChoices_(spec);if(!choices.length)return;
  const courses=[...new Set(choices.filter(c=>c.unbound!==true).map(c=>c.course_id))];
  let approved=[];courses.forEach(course=>{approved=approved.concat(ecFetch_('rubrics',null,course).rubrics||[]);});
  fbValidateChoices_(spec,approved);
  return approved;
}
function fbGuidance_(rubrics){
  return rubrics.map(r=>r.course+' · '+r.title+' · '+r.version+'\n'+r.criteria.map(c=>c.name+'\n'+['Beginning','Developing','Secure','Extending'].map(b=>b+': '+c.descriptors[b]).join('\n')).join('\n\n')).join('\n\n');
}
function fbSelection_(spec,label,course){
  const choices=fbChoices_(spec);if(!choices.length)return null;
  const matches=choices.filter(c=>c.choice_label===String(label));
  if(matches.length!==1||matches[0].course_id!==fbCourse_(course))throw new Error('Choose evidence for the selected student’s course. The response is preserved in the Form response sheet.');
  return matches[0];
}
function fbContext_(spec,choice){
  if(!choice||choice.unbound===true)return '';
  return JSON.stringify({course_id:choice.course_id,project_id:spec.project_id,checkpoint_id:choice.checkpoint_id,rubric_id:choice.rubric_id,rubric_version:choice.rubric_version,criterion_id:choice.criterion_id});
}
function fbEventContext_(o){
  if(!o.rubric_context_json)return null;
  if(emStreamOf_(o.evidence_type)!=='evidence')throw new Error('Only teacher O/C/P evidence can carry criterion context.');
  const c=JSON.parse(o.rubric_context_json);
  if(c.course_id!==fbCourse_(o.course_id)||c.project_id!==o.project_id||c.checkpoint_id!==o.canonical_id)throw new Error('Stored criterion context does not match the evidence.');
  for(const k of ['rubric_id','rubric_version','criterion_id'])if(typeof c[k]!=='string'||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,139}$/.test(c[k]))throw new Error('Invalid stored '+k);
  return c;
}
function fbEnsureLogContext_(sh){
  const required=['timestamp','student_email','student_name','course_id','project_id','canonical_id','evidence_type','skill_ids','outcome_codes','response_value','auto_score','level','independence','teacher_note','teacher_verified','source_form_id','source_response_id'];
  const head=sh.getRange(1,1,1,18).getValues()[0];
  if(required.some((h,i)=>head[i]!==h))throw new Error('Evidence_Log headers changed; criterion metadata was not written.');
  if(head[17]==='rubric_context_json')return;
  if(head[17]!==''||(sh.getLastRow()>1&&sh.getRange(2,18,sh.getLastRow()-1,1).getValues().some(r=>r[0]!=='')))throw new Error('Evidence_Log context column is occupied.');
  sh.getRange(1,18).setValue('rubric_context_json').setFontWeight('bold').setBackground('#153140').setFontColor('#ffffff');
}
