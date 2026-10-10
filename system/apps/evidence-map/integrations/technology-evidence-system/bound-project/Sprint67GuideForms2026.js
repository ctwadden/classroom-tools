/** MM12 S6/S7 use the same Form generator and single spreadsheet router as Sprint 4. */
const S67_GUIDE_FORMS={
  sheet:'1hGXzxde_q7UmKUFYKub3N_j_bFTMRrZqIUxTCIpciwc',
  base:'https://raw.githubusercontent.com/ctwadden/classroom-tools/technology-learning-system-v3/',
  version:'2026-10-01.1',
  entries:[
    ['mm12-blender-bootcamp-v2','system/projects/multimedia/blender-bootcamp/assessment/forms-spec.json','mm12-26-s06-bundle','2026-11-18'],
    ['mm12-2d-animation-studio-v1','system/projects/multimedia/2d-animation-studio/assessment/forms-spec.json','mm12-26-s07-bundle','2026-12-01']
  ]
};

function releaseSprint67GuideForms(){
  const ss=SpreadsheetApp.openById(S67_GUIDE_FORMS.sheet);
  const triggers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()==='onAssessmentSpreadsheetSubmit'&&t.getEventType()===ScriptApp.EventType.ON_FORM_SUBMIT);
  if(triggers.length!==1)throw new Error('Expected exactly one existing spreadsheet submit router.');
  const result=[];
  for(const [id,path,bundle,openDate] of S67_GUIDE_FORMS.entries){
    const url=S67_GUIDE_FORMS.base+path,raw=fetchText_(url),spec=JSON.parse(raw);
    if(spec.project_id!==id||spec.spec_version!==S67_GUIDE_FORMS.version||spec.teacher_evidence?.owner_only!==true||spec.assessment_bundle_by_course?.MM12!==bundle)
      throw new Error('S6/S7 source contract mismatch: '+id);
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
    sh.getRange(at+1,7,1,4).setValues([['Forms current; student closed; planned opening '+openDate,student.getPublishedUrl(),teacher.getPublishedUrl(),new Date()]]);
    result.push({id,bundle,student_id:student.getId(),student_url:student.getPublishedUrl(),student_accepting:student.isAcceptingResponses(),teacher_id:teacher.getId(),teacher_url:teacher.getPublishedUrl(),teacher_owner_only:true,open_date:openDate,response_sheets:[pair.student.response_sheet_name,pair.teacher.response_sheet_name]});
  }
  return {forms:result,router_triggers:triggers.length};
}
function qaS6Student(){return s4QASubmit_('mm12-blender-bootcamp-v2','student',S67_GUIDE_FORMS.version);}
function qaS6Teacher(){return s4QASubmit_('mm12-blender-bootcamp-v2','teacher',S67_GUIDE_FORMS.version);}
function qaS7Student(){return s4QASubmit_('mm12-2d-animation-studio-v1','student',S67_GUIDE_FORMS.version);}
function qaS7Teacher(){return s4QASubmit_('mm12-2d-animation-studio-v1','teacher',S67_GUIDE_FORMS.version);}
