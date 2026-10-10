/** Photo Desk + Document It use the existing generator and one spreadsheet submit router. */
const GUIDE_FORMS_2026={
  sheet:'1hGXzxde_q7UmKUFYKub3N_j_bFTMRrZqIUxTCIpciwc',
  ids:['camera-lab-photo-desk-v1','com11-s03-document-it-v1'],
  paths:{
    'camera-lab-photo-desk-v1':'system/projects/multimedia/photo-desk/assessment/forms-spec.json',
    'com11-s03-document-it-v1':'system/projects/communication/document-it/assessment/forms-spec.json'
  },
  base:'https://raw.githubusercontent.com/ctwadden/classroom-tools/technology-learning-system-v3/'
};
function guideEvidenceProject_(spec,courseId,email,role,name){
  const map=spec&&spec.assessment_bundle_by_course;
  if(!map)return spec.project_id;
  const course=String(courseId||'').trim(),emailNorm=String(email||'').trim().toLowerCase();
  if(!Object.prototype.hasOwnProperty.call(map,course))throw new Error('Unrecognized course for shared guide; response retained in Form tab.');
  const ss=SpreadsheetApp.openById(GUIDE_FORMS_2026.sheet);
  const roster=getRoster_(ss,spec.course_configs||[]);
  const match=roster.find(r=>r.email.toLowerCase()===emailNorm&&r.course===course);
  // The owner may run labelled synthetic submissions. This is never a learner identity.
  const synthetic=emailNorm==='cwadden@gnspes.ca'&&(role==='student'||/^QA TEST\b/.test(String(name||'')));
  if(!match&&!synthetic)throw new Error('Email/course not in the active Roster; raw response retained.');
  if(role==='teacher'&&match&&!synthetic&&match.name!==String(name||''))throw new Error('Teacher learner choice does not match the Roster.');
  return map[course];
}
function guideOutcomeCodes_(codes,courseId,spec){
  if(!spec||!spec.assessment_bundle_by_course)return String(codes||'');
  return String(codes||'').split(';').filter(code=>code.startsWith(String(courseId||'')+'-')).join(';');
}
function releasePhotoDeskDocumentItForms(){
  const ss=SpreadsheetApp.openById(GUIDE_FORMS_2026.sheet),triggerCount=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='onAssessmentSpreadsheetSubmit'&&t.getEventType()===ScriptApp.EventType.ON_FORM_SUBMIT).length;
  if(triggerCount!==1)throw new Error('Expected exactly one installed spreadsheet submit router. No Forms created.');
  const out=[];
  GUIDE_FORMS_2026.ids.forEach(id=>{
    const url=GUIDE_FORMS_2026.base+GUIDE_FORMS_2026.paths[id],raw=fetchText_(url),spec=JSON.parse(raw);
    if(spec.project_id!==id)throw new Error('Guide Form identity mismatch: '+id);
    validateSpec_(spec);
    let pair=getActiveProjectFormPair_(id,spec.spec_version);
    if(!(pair.student&&pair.teacher)){
      upsertProjectSpecFromUrl_(ss,spec,url,sha256_(raw));
      generateProjectForms_(ss,spec);
      pair=getActiveProjectFormPair_(id,spec.spec_version);
    }
    if(!(pair.student&&pair.teacher))throw new Error('Form registration incomplete: '+id);
    const student=FormApp.openById(pair.student.form_id),teacher=FormApp.openById(pair.teacher.form_id);
    // Verified email is set and checked in Forms response settings. Calling
    // setCollectEmail(true) here would downgrade it to responder-entered email.
    student.setRequireLogin(true);
    teacher.setRequireLogin(true);
    const level=teacher.getItems(FormApp.ItemType.MULTIPLE_CHOICE).map(i=>i.asMultipleChoiceItem()).find(i=>i.getTitle()==='Current evidence level');
    if(!level)throw new Error('Teacher achievement field missing: '+id);
    level.setChoiceValues(['Beginning','Developing','Secure','Extending','IE']);
    const sh=ss.getSheetByName(TS.SHEETS.PROJECTS),rows=sh.getDataRange().getValues();
    const at=rows.findIndex((r,i)=>i>0&&r[0]===id);
    if(at>0)sh.getRange(at+1,7,1,4).setValues([['Forms current',student.getPublishedUrl(),teacher.getPublishedUrl(),new Date()]]);
    // Project and Form Registry are the durable readback; avoid a second Forms edit/read call here.
    out.push({source_project_id:id,student_url:pair.student.form_url,teacher_url:pair.teacher.form_url,student_form_id:pair.student.form_id,teacher_form_id:pair.teacher.form_id});
  });
  return {forms:out,router_triggers:ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='onAssessmentSpreadsheetSubmit').length};
}
function readPhotoDeskDocumentItForms(){
  const ss=SpreadsheetApp.openById(GUIDE_FORMS_2026.sheet),sh=ss.getSheetByName(TS.SHEETS.REGISTRY),rows=sh.getDataRange().getValues().slice(1);
  return GUIDE_FORMS_2026.ids.map(id=>({source_project_id:id,forms:rows.filter(r=>r[0]===id&&String(r[6]).toLowerCase()==='true').map(r=>({type:r[2],id:r[3],url:r[4],response_sheet:r[5]}))}));
}
// Recover only the labelled synthetic response after a transient lock timeout.
// The normal router's source-row ID and append deduplication prevent duplicate events.
function replayPhotoDeskQARow(){
  const ss=SpreadsheetApp.openById(GUIDE_FORMS_2026.sheet),sh=ss.getSheetByName('Form Responses 65');
  const headers=sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0];
  const values=sh.getRange(2,1,1,sh.getLastColumn()).getValues()[0];
  if(!values.some(v=>String(v).startsWith('QA TEST')) || !values.some(v=>String(v)==='cwadden@gnspes.ca'))
    throw new Error('QA row identity changed; no replay attempted.');
  const namedValues={};headers.forEach((h,i)=>{if(h)namedValues[String(h)]=[String(values[i]??'')];});
  onAssessmentSpreadsheetSubmit({range:sh.getRange(2,1),namedValues});
}
