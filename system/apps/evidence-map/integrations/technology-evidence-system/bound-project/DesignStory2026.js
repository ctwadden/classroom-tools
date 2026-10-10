/** Design a Story project-specific intake. Additive module; existing single router and history remain unchanged. */
const DESIGN_STORY_2026 = {
  id:'mm12-design-story-v1',version:'2026-10-10.1',
  specUrl:'https://raw.githubusercontent.com/ctwadden/classroom-tools/technology-learning-system-v3/system/projects/multimedia/design-a-story/assessment/forms-spec.json',
  key:'DESIGN_STORY_FORMS_2026_10_10'
};
function designStorySpec_(){
  const raw=fetchText_(DESIGN_STORY_2026.specUrl),spec=JSON.parse(raw);
  if(spec.project_id!==DESIGN_STORY_2026.id||spec.spec_version!==DESIGN_STORY_2026.version)throw new Error('Design a Story spec identity/version changed.');
  validateSpec_(spec);return {raw,spec};
}
function preflightDesignStoryForms(){
  const ss=ecSheet_();SpreadsheetApp.setActiveSpreadsheet(ss);
  const loaded=designStorySpec_(),spec=loaded.spec;
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='onAssessmentSpreadsheetSubmit'&&t.getEventType()===ScriptApp.EventType.ON_FORM_SUBMIT);
  if(triggers.length!==1)throw new Error('Expected exactly one existing spreadsheet submit router.');
  if(!emConfigured_())throw new Error('Existing Evidence Map connection missing.');
  const live=ecFetch_('rubrics',null,'MM12'),rubrics=live.rubrics||[];
  const relevant=rubrics.filter(r=>r.project_id===spec.project_id);
  const out={project_id:spec.project_id,version:spec.spec_version,router_triggers:triggers.length,
    bridge_status:ecFetch_('status',null,'MM12'),existing_pair:getActiveProjectFormPair_(spec.project_id,spec.spec_version),
    project_rubrics:relevant.map(r=>({id:r.id,version:r.version,status:r.status,capture_ready:r.capture_ready})),
    knowledge_questions:spec.knowledge_check.items.length,student_routes:spec.student_routes.map(r=>r.label),teacher_checkpoints:spec.teacher_evidence.checkpoints.length};
  console.log(JSON.stringify(out));return out;
}
function designStoryStudent_(ss,spec,form){
  form.setDescription(spec.student_form.description).setCollectEmail(true).setRequireLogin(true).setProgressBar(true);
  form.setPublishingSummary(false).setConfirmationMessage('Your checkpoint response has been submitted to your teacher. Keep your editable source and exported response record. Teacher feedback and review determine achievement.');
  const course=form.addListItem().setTitle('Course / class').setChoiceValues(['MM12 - M1']).setRequired(true);
  mapItem_(ss,form,course,spec,'META-COURSE','Metadata',[],[],'','course_id');
  const purpose=form.addMultipleChoiceItem().setTitle('Checkpoint to submit').setRequired(true);
  mapItem_(ss,form,purpose,spec,'META-PURPOSE','Metadata',[],[],'','purpose');
  const pages=[];
  spec.student_routes.forEach((route,index)=>{
    const page=form.addPageBreakItem().setTitle(route.title);pages.push(page);
    // Navigation applies to the section preceding this break. The MC choices override page one.
    if(index>0)page.setGoToPage(FormApp.PageNavigationType.SUBMIT);
    route.items.forEach(q=>{
      const item=form.addParagraphTextItem().setTitle(q.id+' — '+(q.title||q.prompt)).setRequired(true);
      if(q.title)item.setHelpText(q.prompt);
      mapItem_(ss,form,item,spec,q.id,q.evidence_type,q.skill_ids,q.outcome_codes,q.step_id,'response',q.lesson_id||'');
    });
  });
  purpose.setChoices(spec.student_routes.map((r,i)=>purpose.createChoice(r.label,pages[i])));
  const responseSheetName=attachFormDestination_(ss,form);
  form.setPublished(true);
  return {form,responseSheetName};
}
function releaseDesignStoryForms(){
  const lock=LockService.getScriptLock();lock.waitLock(10000);
  try{
    const loaded=designStorySpec_(),spec=loaded.spec,ss=ecSheet_();SpreadsheetApp.setActiveSpreadsheet(ss);
    const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='onAssessmentSpreadsheetSubmit'&&t.getEventType()===ScriptApp.EventType.ON_FORM_SUBMIT);
    if(triggers.length!==1)throw new Error('Existing single submit router required.');
    const props=PropertiesService.getScriptProperties();let state=JSON.parse(props.getProperty(DESIGN_STORY_2026.key)||'{}');
    let pair=getActiveProjectFormPair_(spec.project_id,spec.spec_version);
    upsertProjectSpecFromUrl_(ss,spec,DESIGN_STORY_2026.specUrl,sha256_(loaded.raw));
    if(!pair.student){
      if(state.student_id)throw new Error('A student Form was already prepared; inspect it before recovery. No duplicate created.');
      const form=FormApp.create(spec.project_title+' — Knowledge + Reflection',false);
      state.student_id=form.getId();state.student_status='building';props.setProperty(DESIGN_STORY_2026.key,JSON.stringify(state));
      const built=designStoryStudent_(ss,spec,form);registerForm_(ss,spec,'student',form,built.responseSheetName);
      state.student_status='registered';props.setProperty(DESIGN_STORY_2026.key,JSON.stringify(state));
    }
    pair=getActiveProjectFormPair_(spec.project_id,spec.spec_version);
    if(!pair.teacher){
      if(state.teacher_id)throw new Error('A teacher Form was already prepared; inspect it before recovery. No duplicate created.');
      const form=FormApp.create(spec.project_title+' — Teacher Evidence Capture',false);
      state.teacher_id=form.getId();state.teacher_status='building';props.setProperty(DESIGN_STORY_2026.key,JSON.stringify(state));
      tfrPrivate_(form);form.setCollectEmail(true).setRequireLogin(true).setPublishingSummary(false);
      const built=buildTeacherForm_(ss,spec,form);
      const level=form.getItems(FormApp.ItemType.MULTIPLE_CHOICE).map(i=>i.asMultipleChoiceItem()).find(i=>i.getTitle()==='Current evidence level');
      level.setChoiceValues(['Beginning','Developing','Secure','Extending','IE']).setHelpText('General evidence suggestion only: no approved project rubric is attached. Teacher review is required; keep support separate.\n\n'+spec.teacher_evidence.checkpoints.map(c=>c.evidence_id+': '+c.look_for).join('\n\n'));
      registerForm_(ss,spec,'teacher',form,built.responseSheetName);
      state.teacher_status='registered';props.setProperty(DESIGN_STORY_2026.key,JSON.stringify(state));
    }
    pair=getActiveProjectFormPair_(spec.project_id,spec.spec_version);
    if(!pair.student||!pair.teacher)throw new Error('Form pair incomplete.');
    const sh=ss.getSheetByName(TS.SHEETS.PROJECTS),rows=sh.getDataRange().getValues(),at=rows.findIndex((r,i)=>i>0&&r[0]===spec.project_id);
    sh.getRange(at+1,7,1,4).setValues([['Forms current',pair.student.form_url,pair.teacher.form_url,new Date()]]);
    return readDesignStoryForms();
  }finally{lock.releaseLock();}
}
function readDesignStoryForms(){
  const pair=getActiveProjectFormPair_(DESIGN_STORY_2026.id,DESIGN_STORY_2026.version);
  const out={project_id:DESIGN_STORY_2026.id,forms:['student','teacher'].filter(role=>pair[role]).map(role=>{
    const r=pair[role],f=FormApp.openById(r.form_id);return {role,id:r.form_id,url:r.form_url,edit_url:f.getEditUrl(),response_sheet:r.response_sheet_name,
      published:f.isPublished(),accepting:f.isAcceptingResponses(),destination_id:f.getDestinationId(),items:f.getItems().length,
      collect_email:f.collectsEmail(),permissions:role==='teacher'?tfrPermissions_(f.getId()).map(p=>({type:p.type,role:p.role,email:p.emailAddress})):undefined};
  })};console.log(JSON.stringify(out));return out;
}
function qaDesignStoryStudent(){
  const pair=getActiveProjectFormPair_(DESIGN_STORY_2026.id,DESIGN_STORY_2026.version),form=FormApp.openById(pair.student.form_id);
  let response=form.createResponse();
  const ids=new Set(designStorySpec_().spec.knowledge_check.items.map(q=>q.id));
  form.getItems().forEach(item=>{
    if(item.getTitle()==='Course / class')response=response.withItemResponse(item.asListItem().createResponse('MM12 - M1'));
    else if(item.getTitle()==='Checkpoint to submit')response=response.withItemResponse(item.asMultipleChoiceItem().createResponse('Knowledge check'));
    else if(item.getType()===FormApp.ItemType.PARAGRAPH_TEXT&&ids.has(item.getTitle().split(' — ')[0]))response=response.withItemResponse(item.asParagraphTextItem().createResponse('QA TEST — synthetic knowledge-route check only; no student work or achievement.'));
  });
  const out={role:'student',form_response_id:response.submit().getId(),label:'QA TEST',route:'Knowledge check'};console.log(JSON.stringify(out));return out;
}
function qaDesignStoryTeacher(){const out=s4QASubmit_(DESIGN_STORY_2026.id,'teacher',DESIGN_STORY_2026.version);console.log(JSON.stringify(out));return out;}
function syncDesignStoryQA(){
  const ss=ecSheet_();SpreadsheetApp.setActiveSpreadsheet(ss);
  const rows=emReadEvidenceLog_().filter(o=>o.project_id===DESIGN_STORY_2026.id&&String(o.student_email).toLowerCase()==='cwadden@gnspes.ca'&&/QA TEST/.test(String(o.response_value)+' '+String(o.teacher_note)));
  const events=rows.map(emBuildEvent_).filter(Boolean),sh=emSyncSheet_(),idx=emSyncIndex_(sh),pending=events.filter(ev=>!emAlreadyConfirmed_(ev,idx[ev.event_id]));
  if(pending.length){const results=emPost_(pending);emReceipts_(sh,idx,pending,results);}
  const out={project_id:DESIGN_STORY_2026.id,qa_evidence_rows:rows.length,receipts:events.map(ev=>({event_id:ev.event_id,canonical_id:ev.canonical_id,stream:ev.stream,source_response_id:ev.source_response_id,status:idx[ev.event_id]&&idx[ev.event_id].status,revision_id:idx[ev.event_id]&&idx[ev.event_id].revision_id})),learner_id:events.length?events[0].learner_id:''};
  console.log(JSON.stringify(out));return out;
}
