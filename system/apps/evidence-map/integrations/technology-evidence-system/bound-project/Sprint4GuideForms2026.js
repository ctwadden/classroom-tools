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
