/** MM12 Sprint 8 Forms use the existing project registry and single submit router. */
const S8_GUIDE_FORMS={
  sheet:'1hGXzxde_q7UmKUFYKub3N_j_bFTMRrZqIUxTCIpciwc',
  base:'https://raw.githubusercontent.com/ctwadden/classroom-tools/technology-learning-system-v3/',
  version:'2026-10-02.1',
  entries:[
    ['mm12-into-the-world-v1','system/projects/multimedia/into-the-world/assessment/forms-spec.json','mm12-26-s08-bundle'],
    ['mm12-vfx-shot-library-v1','system/projects/multimedia/vfx-shot-library/assessment/forms-spec.json','mm12-26-s08-bundle']
  ]
};

function releaseSprint8GuideForms(){
  const ss=SpreadsheetApp.openById(S8_GUIDE_FORMS.sheet);
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='onAssessmentSpreadsheetSubmit'&&t.getEventType()===ScriptApp.EventType.ON_FORM_SUBMIT);
  if(triggers.length!==1)throw new Error('Expected exactly one existing spreadsheet submit router.');
  const result=[];
  for(const [id,path,bundle] of S8_GUIDE_FORMS.entries){
    const url=S8_GUIDE_FORMS.base+path,raw=fetchText_(url),spec=JSON.parse(raw);
    if(spec.project_id!==id||spec.spec_version!==S8_GUIDE_FORMS.version||spec.teacher_evidence?.owner_only!==true||spec.assessment_bundle_by_course?.MM12!==bundle)
      throw new Error('Sprint 8 source contract mismatch: '+id);
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
      throw new Error('Owner-only teacher Form not verified: '+id);
    const sh=ss.getSheetByName(TS.SHEETS.PROJECTS),rows=sh.getDataRange().getValues(),at=rows.findIndex((r,i)=>i>0&&r[0]===id);
    if(at<1)throw new Error('Project row missing: '+id);
    sh.getRange(at+1,7,1,4).setValues([['Forms current; student closed; planned opening 2026-12-16',student.getPublishedUrl(),teacher.getPublishedUrl(),new Date()]]);
    result.push({id,bundle,student_id:student.getId(),student_url:student.getPublishedUrl(),student_accepting:student.isAcceptingResponses(),teacher_id:teacher.getId(),teacher_url:teacher.getPublishedUrl(),teacher_owner_only:true,open_date:'2026-12-16',response_sheets:[pair.student.response_sheet_name,pair.teacher.response_sheet_name]});
  }
  return {forms:result,router_triggers:triggers.length};
}
function qaS8CoreStudent(){return s4QASubmit_('mm12-into-the-world-v1','student',S8_GUIDE_FORMS.version);}
function qaS8CoreTeacher(){return s4QASubmit_('mm12-into-the-world-v1','teacher',S8_GUIDE_FORMS.version);}
function qaS8LibraryStudent(){return s4QASubmit_('mm12-vfx-shot-library-v1','student',S8_GUIDE_FORMS.version);}
function qaS8LibraryTeacher(){return s4QASubmit_('mm12-vfx-shot-library-v1','teacher',S8_GUIDE_FORMS.version);}
