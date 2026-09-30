/** Three Sprint 4 guides, using the existing Projects/Registry/Item Map and submit router. */
const S4_GUIDE_FORMS={
  sheet:'1hGXzxde_q7UmKUFYKub3N_j_bFTMRrZqIUxTCIpciwc',
  base:'https://raw.githubusercontent.com/ctwadden/classroom-tools/technology-learning-system-v3/',
  entries:[
    ['last-light-v1','system/projects/multimedia/last-light/assessment/forms-spec.json','2026-10-19'],
    ['make-it-matter-v2','system/projects/multimedia/make-it-matter/assessment/forms-spec.json','2026-10-26'],
    ['com11-build-it-true-v2','system/projects/communication/build-it-true/assessment/forms-spec.json','2026-10-19']
  ]
};

function s4RestrictOwner_(form){
  for(const p of tfrPermissions_(form.getId())){
    if(p.role==='owner'){
      if(p.emailAddress&&p.emailAddress!=='cwadden@gnspes.ca')throw new Error('Unexpected teacher Form owner.');
      continue;
    }
    const url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(form.getId())+'/permissions/'+encodeURIComponent(p.id);
    const r=UrlFetchApp.fetch(url,{method:'delete',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
    if(r.getResponseCode()!==204)throw new Error('Could not remove non-owner teacher Form access; HTTP '+r.getResponseCode());
  }
  if(tfrPermissions_(form.getId()).some(p=>p.type==='anyone'||p.type==='domain'||(p.role!=='owner'&&p.emailAddress!=='cwadden@gnspes.ca')))
    throw new Error('Teacher Form still has non-owner responder access.');
}

function releaseSprint4GuideForms(){
  const ss=SpreadsheetApp.openById(S4_GUIDE_FORMS.sheet);
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='onAssessmentSpreadsheetSubmit'&&t.getEventType()===ScriptApp.EventType.ON_FORM_SUBMIT);
  if(triggers.length!==1)throw new Error('Expected the one existing spreadsheet submit router.');
  const result=[];
  for(const [id,path,openDate] of S4_GUIDE_FORMS.entries){
    const url=S4_GUIDE_FORMS.base+path,raw=fetchText_(url),spec=JSON.parse(raw);
    if(spec.project_id!==id||spec.teacher_evidence?.owner_only!==true||spec.assessment_bundle_by_course?.[spec.course_configs[0].course_id]!==({MM12:'mm12-26-s04-bundle',COM11:'com11-26-s04-bundle'})[spec.course_configs[0].course_id])
      throw new Error('Sprint 4 source contract mismatch: '+id);
    validateSpec_(spec);
    let pair=getActiveProjectFormPair_(id,spec.spec_version);
    if(!(pair.student&&pair.teacher)){
      upsertProjectSpecFromUrl_(ss,spec,url,sha256_(raw));
      generateProjectForms_(ss,spec);
      pair=getActiveProjectFormPair_(id,spec.spec_version);
    }
    if(!(pair.student&&pair.teacher))throw new Error('Form pair missing after registration: '+id);
    const student=FormApp.openById(pair.student.form_id),teacher=FormApp.openById(pair.teacher.form_id);
    student.setRequireLogin(true);
    student.setAcceptingResponses(false);
    teacher.setRequireLogin(true);
    s4RestrictOwner_(teacher);
    const level=teacher.getItems(FormApp.ItemType.MULTIPLE_CHOICE).map(i=>i.asMultipleChoiceItem()).find(i=>i.getTitle()==='Current evidence level');
    if(!level)throw new Error('Teacher level missing: '+id);
    level.setChoiceValues(['Beginning','Developing','Secure','Extending','IE']);
    const permissions=tfrPermissions_(teacher.getId());
    if(permissions.some(p=>p.type==='anyone'||p.type==='domain'||(p.role!=='owner'&&p.emailAddress!=='cwadden@gnspes.ca')))
      throw new Error('Owner-only teacher access not verified: '+id);
    const project=ss.getSheetByName(TS.SHEETS.PROJECTS),rows=project.getDataRange().getValues(),at=rows.findIndex((r,i)=>i>0&&r[0]===id);
    if(at<1)throw new Error('Project row missing: '+id);
    project.getRange(at+1,7,1,4).setValues([['Forms current; student closed until '+openDate,student.getPublishedUrl(),teacher.getPublishedUrl(),new Date()]]);
    result.push({id,student_id:student.getId(),student_url:student.getPublishedUrl(),student_accepting:student.isAcceptingResponses(),teacher_id:teacher.getId(),teacher_url:teacher.getPublishedUrl(),teacher_owner_only:true,teacher_accepting:teacher.isAcceptingResponses(),open_date:openDate,response_sheets:[pair.student.response_sheet_name,pair.teacher.response_sheet_name]});
  }
  return {forms:result,router_triggers:triggers.length};
}

function readSprint4GuideForms(){
  const ss=SpreadsheetApp.openById(S4_GUIDE_FORMS.sheet),sh=ss.getSheetByName(TS.SHEETS.REGISTRY),rows=sh.getDataRange().getValues().slice(1);
  return S4_GUIDE_FORMS.entries.map(([id,,openDate])=>({id,open_date:openDate,forms:rows.filter(r=>r[0]===id&&String(r[6]).toLowerCase()==='true').map(r=>({type:r[2],form_id:r[3],form_url:r[4],response_sheet:r[5]}))}));
}

function s4QASubmit_(projectId,role){
  const pair=getActiveProjectFormPair_(projectId,'2026-09-30.1');
  const reg=role==='student'?pair.student:pair.teacher;
  if(!reg)throw new Error('QA Form not registered: '+projectId+' '+role);
  const ss=SpreadsheetApp.openById(S4_GUIDE_FORMS.sheet),form=FormApp.openById(reg.form_id),sh=ss.getSheetByName(reg.response_sheet_name);
  if(!sh)throw new Error('QA response tab missing.');
  const wasAccepting=form.isAcceptingResponses(),before=sh.getLastRow();
  const qaLabel='QA TEST — NOT A STUDENT | cwadden@gnspes.ca | '+(projectId.startsWith('com11')?'COM11':'MM12');
  let studentItem=null,oldChoices=[];
  try{
    if(role==='student')form.setAcceptingResponses(true);
    else{
      s4RestrictOwner_(form);
      studentItem=form.getItems(FormApp.ItemType.LIST).map(i=>i.asListItem()).find(i=>i.getTitle()==='Student');
      if(!studentItem)throw new Error('Teacher Student choice missing.');
      oldChoices=studentItem.getChoices().map(c=>c.getValue());
      studentItem.setChoiceValues(oldChoices.concat([qaLabel]));
    }
    let response=form.createResponse();
    for(const item of form.getItems()){
      const type=item.getType(),title=item.getTitle();
      if(type===FormApp.ItemType.LIST){
        const field=item.asListItem(),choices=field.getChoices().map(c=>c.getValue());
        const value=title==='Student'?qaLabel:choices[0];
        if(!value)throw new Error('QA choice missing: '+title);
        response=response.withItemResponse(field.createResponse(value));
      }else if(type===FormApp.ItemType.MULTIPLE_CHOICE){
        const field=item.asMultipleChoiceItem(),choices=field.getChoices().map(c=>c.getValue());
        const value=title==='Current evidence level'?'IE':title==='Support dimension (optional)'?'Not recorded':title==='Support level (optional)'?'Not recorded':title==='Did the support help? (optional)'?'Not recorded':choices[0];
        response=response.withItemResponse(field.createResponse(value));
      }else if(type===FormApp.ItemType.PARAGRAPH_TEXT){
        response=response.withItemResponse(item.asParagraphTextItem().createResponse('QA TEST — synthetic response only; no learner work or achievement.'));
      }else if(type===FormApp.ItemType.TEXT){
        response=response.withItemResponse(item.asTextItem().createResponse('QA TEST'));
      }
    }
    const submitted=response.submit();
    for(let n=0;n<8&&sh.getLastRow()<=before;n++){SpreadsheetApp.flush();Utilities.sleep(500);}
    if(sh.getLastRow()!==before+1)throw new Error('QA Form response tab did not gain exactly one row.');
    const row=before+1,values=sh.getRange(row,1,1,sh.getLastColumn()).getValues()[0],headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
    const namedValues={};headers.forEach((h,i)=>{if(h)namedValues[String(h)]=[String(values[i]??'')];});
    const email=findEmailValue_(namedValues).trim().toLowerCase();
    if(email!=='cwadden@gnspes.ca')throw new Error('QA verified email missing; row retained without manual evidence routing.');
    // A scripted FormResponse fires the installed spreadsheet submit trigger.
    // Do not manually invoke the router at the same time: it can double-write.
    const log=ss.getSheetByName(TS.SHEETS.EVIDENCE),source='sheet:'+sh.getSheetId()+':row:'+row;
    for(let n=0;n<20;n++){
      SpreadsheetApp.flush();
      const found=log.getDataRange().getValues().slice(1).some(r=>String(r[16])===source&&String(r[15])===reg.form_id);
      if(found)break;
      Utilities.sleep(500);
    }
    const all=log.getDataRange().getValues();
    const matching=all.slice(1).filter(r=>String(r[16])===source&&String(r[15])===reg.form_id);
    return {project_id:projectId,role,form_id:reg.form_id,response_sheet:reg.response_sheet_name,response_row:row,source_response_id:source,evidence_rows:matching.length,verified_email:true,form_response_id:submitted.getId()};
  }finally{
    if(role==='student')form.setAcceptingResponses(wasAccepting);
    if(studentItem)studentItem.setChoiceValues(oldChoices);
  }
}
function qaS4LastLightStudent(){return s4QASubmit_('last-light-v1','student');}
function qaS4LastLightTeacher(){return s4QASubmit_('last-light-v1','teacher');}
function qaS4MakeItMatterStudent(){return s4QASubmit_('make-it-matter-v2','student');}
function qaS4MakeItMatterTeacher(){return s4QASubmit_('make-it-matter-v2','teacher');}
function qaS4BuildItTrueStudent(){return s4QASubmit_('com11-build-it-true-v2','student');}
function qaS4BuildItTrueTeacher(){return s4QASubmit_('com11-build-it-true-v2','teacher');}
function replayS4LastLightTeacherQA(){
  const reg=getActiveProjectFormPair_('last-light-v1','2026-09-30.1').teacher;
  const sh=SpreadsheetApp.openById(S4_GUIDE_FORMS.sheet).getSheetByName(reg.response_sheet_name);
  const row=2,headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0],values=sh.getRange(row,1,1,sh.getLastColumn()).getValues()[0];
  if(!String(values[1]).startsWith('QA TEST — NOT A STUDENT | cwadden@gnspes.ca | MM12') || String(values[values.length-1]).toLowerCase()!=='cwadden@gnspes.ca')
    throw new Error('Retained QA row identity changed; no replay attempted.');
  const namedValues={};headers.forEach((h,i)=>{if(h)namedValues[String(h)]=[String(values[i]??'')];});
  onAssessmentSpreadsheetSubmit({range:sh.getRange(row,1),namedValues});
  return {form_id:reg.form_id,source_response_id:'sheet:'+sh.getSheetId()+':row:'+row};
}
