/**
 * Truck Standard Google Assessment Generator
 * forms-spec.json -> Student Quiz + Teacher Evidence Form -> Evidence_Log
 */
const TS={S:{CONFIG:"Config",PROJECTS:"Projects",REG:"Form Registry",MAP:"Form Item Map",EVID:"Evidence_Log",ROSTER:"Roster",LOG:"Automation Log"},LEVELS:["IE - Insufficient Evidence","1 - Guided / Emerging","2 - Developing","3 - Competent / Independent","4 - Transfer / Extend"],IND:["Significant support","Prompts / checkpoints","Independent","Adapted / transferred"]};

function onOpen(){
  SpreadsheetApp.getUi().createMenu("Truck Standard")
    .addItem("1. Initialize","setupTechnologyEvidenceSystem")
    .addItem("2A. Sync specs from GitHub","syncAssessmentSpecsFromGitHub")
    .addItem("2B. Sync specs from Drive","syncAssessmentSpecs")
    .addItem("3. Generate pending forms","generateFormsForPendingSpecs")
    .addToUi();
}
function setupTechnologyEvidenceSystem(){
  var ss=SpreadsheetApp.getActive();
  ensure_(ss,TS.S.CONFIG,["Key","Value","Notes"]);
  ensure_(ss,TS.S.PROJECTS,["project_id","project_title","spec_version","spec_file_id","spec_hash","status","student_form_url","teacher_form_url","last_synced"]);
  ensure_(ss,TS.S.REG,["project_id","spec_version","form_type","form_id","form_url","active","created_at"]);
  ensure_(ss,TS.S.MAP,["form_id","item_id","project_id","canonical_id","evidence_type","skill_ids","outcome_codes","step_id","field_role"]);
  ensure_(ss,TS.S.EVID,["timestamp","student_email","student_name","course_id","project_id","canonical_id","evidence_type","skill_ids","outcome_codes","response_value","auto_score","level","independence","teacher_note","teacher_verified","source_form_id","source_response_id"]);
  ensure_(ss,TS.S.ROSTER,["student_name","student_email","course_id","active"]);
  ensure_(ss,TS.S.LOG,["timestamp","level","message","context"]);
  var c=ss.getSheetByName(TS.S.CONFIG);
  if(c.getLastRow()<2){c.appendRow(["ASSESSMENT_SPECS_FOLDER_ID","","Optional Drive folder containing forms-spec.json files"]);c.appendRow(["SPEC_REGISTRY_URL","","Preferred: raw GitHub URL to project-spec-registry.json"]);c.appendRow(["ASSESSMENT_LAUNCHER_URL","","After web-app deployment, paste the /exec URL here"]);}
}
function syncAssessmentSpecsFromGitHub(){
  var ss=SpreadsheetApp.getActive(),url=cfg_("SPEC_REGISTRY_URL");
  if(!url)throw new Error("Set SPEC_REGISTRY_URL in Config.");
  var registry=JSON.parse(fetchText_(url)),n=0;
  if(!registry.projects||!Array.isArray(registry.projects))throw new Error("Registry must contain projects array.");
  registry.projects.forEach(function(entry){
    if(entry.active===false)return;
    var raw=fetchText_(entry.forms_spec_url),spec=JSON.parse(raw); validate_(spec);
    upsertSpecUrl_(ss,spec,entry.forms_spec_url,sha_(raw)); n++;
  });
  SpreadsheetApp.getUi().alert("Synced "+n+" spec(s) from GitHub.");
}
function fetchText_(url){
  var r=UrlFetchApp.fetch(url,{muteHttpExceptions:true,followRedirects:true}),c=r.getResponseCode();
  if(c<200||c>=300)throw new Error("Could not fetch "+url+" (HTTP "+c+")");
  return r.getContentText("UTF-8");
}
function syncAssessmentSpecs(){
  var ss=SpreadsheetApp.getActive(),folderId=cfg_("ASSESSMENT_SPECS_FOLDER_ID");
  if(!folderId)throw new Error("Set ASSESSMENT_SPECS_FOLDER_ID in Config.");
  var it=DriveApp.getFolderById(folderId).getFiles(),n=0;
  while(it.hasNext()){
    var f=it.next(); if(!/forms-spec\.json$/i.test(f.getName()))continue;
    var raw=f.getBlob().getDataAsString("UTF-8"),spec=JSON.parse(raw); validate_(spec);
    upsertSpec_(ss,spec,f,sha_(raw)); n++;
  }
  SpreadsheetApp.getUi().alert("Synced "+n+" spec(s).");
}
function generateFormsForPendingSpecs(){
  var ss=SpreadsheetApp.getActive(),sh=ss.getSheetByName(TS.S.PROJECTS);
  if(!sh||sh.getLastRow()<2)return;
  var rows=sh.getRange(2,1,sh.getLastRow()-1,9).getValues(),made=0;
  rows.forEach(function(r,i){
    if(!r[0]||!r[3]||r[5]==="Forms current")return;
    try{
      var src=String(r[3]||""),raw=/^https?:\/\//i.test(src)?fetchText_(src):DriveApp.getFileById(src).getBlob().getDataAsString("UTF-8"),spec=JSON.parse(raw);
      var urls=buildProject_(ss,spec);
      sh.getRange(i+2,6,1,4).setValues([["Forms current",urls.student,urls.teacher,new Date()]]);
      made++;
    }catch(err){sh.getRange(i+2,6).setValue("ERROR");log_("ERROR",err.message,r[0]);}
  });
  SpreadsheetApp.getUi().alert("Generated "+made+" project form set(s).");
}
function buildProject_(ss,spec){
  validate_(spec);
  var sf=studentForm_(ss,spec),tf=teacherForm_(ss,spec);
  register_(ss,spec,"student",sf); register_(ss,spec,"teacher",tf);
  ScriptApp.newTrigger("onStudentSubmit").forForm(sf).onFormSubmit().create();
  ScriptApp.newTrigger("onTeacherSubmit").forForm(tf).onFormSubmit().create();
  return {student:sf.getPublishedUrl(),teacher:tf.getPublishedUrl()};
}
function doGet(e){
  try{
    var project=(e&&e.parameter&&e.parameter.project)||"",type=((e&&e.parameter&&e.parameter.type)||"student").toLowerCase();
    if(!project)return HtmlService.createHtmlOutput("<h2>Truck Standard Assessment Launcher</h2><p>Missing project parameter.</p>");
    var sh=SpreadsheetApp.getActive().getSheetByName(TS.S.REG);
    if(!sh||sh.getLastRow()<2)return HtmlService.createHtmlOutput("<p>No generated forms are registered yet.</p>");
    var rows=sh.getRange(2,1,sh.getLastRow()-1,7).getValues().filter(function(r){return r[0]===project&&String(r[2]).toLowerCase()===type&&(r[5]===true||String(r[5]).toLowerCase()==="true");});
    if(!rows.length)return HtmlService.createHtmlOutput("<h3>Assessment not ready</h3><p>No active "+type+" form is registered for "+project+".</p>");
    var url=String(rows[rows.length-1][4]);
    return HtmlService.createHtmlOutput('<p>Opening assessment...</p><script>window.top.location.replace('+JSON.stringify(url)+');<\\/script><p><a href="'+url+'">Open form</a></p>');
  }catch(err){return HtmlService.createHtmlOutput("<h3>Assessment launcher error</h3><pre>"+err.message+"</pre>");}
}
function studentForm_(ss,spec){
  var f=FormApp.create(spec.project_title+" - Knowledge + Reflection");
  f.setCollectEmail(true).setProgressBar(true).setIsQuiz(true).setConfirmationMessage("Submitted. Return to the project tutorial.");
  if((spec.course_configs||[]).length>1){
    var ci=f.addListItem().setTitle("Course / class").setChoiceValues(spec.course_configs.map(function(c){return c.course_id+(c.module_id?" - "+c.module_id:"");})).setRequired(true);
    map_(ss,f,ci,spec,"META-COURSE","Metadata",[],[],"","course_id");
  }
  f.addSectionHeaderItem().setTitle("1 - Knowledge Check");
  (spec.knowledge_check.items||[]).forEach(function(q){
    var it=f.addMultipleChoiceItem().setTitle(q.prompt).setRequired(true).setPoints(q.points||1);
    it.setChoices(q.choices.map(function(c,idx){return it.createChoice(c,idx===q.correct_index);}));
    map_(ss,f,it,spec,q.id,"Knowledge",q.skill_ids,q.outcome_codes,q.step_id||"","knowledge");
  });
  f.addSectionHeaderItem().setTitle("2 - Skills Used");
  skillBlock_(ss,f,spec,"technical","Technical skill that mattered most",spec.skill_reflection.technical_skills||[],false);
  skillBlock_(ss,f,spec,"design","Design / communication skill that mattered most",spec.skill_reflection.design_skills||[],false);
  skillBlock_(ss,f,spec,"growth","Skill you want to improve next",(spec.skill_reflection.technical_skills||[]).concat(spec.skill_reflection.design_skills||[]),true);
  f.addSectionHeaderItem().setTitle("3 - Transfer");
  var tr=f.addParagraphTextItem().setTitle(spec.transfer.prompt).setRequired(true);
  map_(ss,f,tr,spec,spec.transfer.id,"Transfer candidate",spec.transfer.skill_ids||[],spec.transfer.outcome_codes||[],"","transfer");
  f.setDestination(FormApp.DestinationType.SPREADSHEET,ss.getId());
  return f;
}
function skillBlock_(ss,f,spec,role,title,skills,growth){
  var p=f.addListItem().setTitle(title).setChoiceValues(skills.map(function(s){return s.id+" - "+s.label;})).setRequired(true);
  map_(ss,f,p,spec,spec.project_id+"-REF-"+role.toUpperCase()+"-SKILL","Reflection",skills.map(function(s){return s.id;}),[],"",role+"_skill");
  if(growth)return;
  var w=f.addParagraphTextItem().setTitle(title+": where did you use it, why, and what evidence shows it?").setRequired(true);
  map_(ss,f,w,spec,spec.project_id+"-REF-"+role.toUpperCase()+"-WHY","Reflection",skills.map(function(s){return s.id;}),[],"",role+"_reason");
  var ind=f.addMultipleChoiceItem().setTitle(title+": how independently did you use it?").setChoiceValues(spec.skill_reflection.independence_options||["Followed the example closely","Needed some prompts/checkpoints","Worked independently","Adapted or extended the skill"]).setRequired(true);
  map_(ss,f,ind,spec,spec.project_id+"-REF-"+role.toUpperCase()+"-IND","Reflection",skills.map(function(s){return s.id;}),[],"",role+"_independence");
}
function teacherForm_(ss,spec){
  var f=FormApp.create(spec.project_title+" - Teacher Evidence Capture");
  f.setDescription("Fast Obs / Con / Pro capture. Student self-reports never auto-confirm competency.");
  var roster=getRoster_(ss,spec.course_configs||[]);
  var st=f.addListItem().setTitle("Student").setChoiceValues(roster.length?roster:["ROSTER NOT LOADED"]).setRequired(true);
  map_(ss,f,st,spec,"META-STUDENT","Metadata",[],[],"","student");
  var cps=spec.teacher_evidence.checkpoints||[];
  var cp=f.addListItem().setTitle("Evidence checkpoint").setChoiceValues(cps.map(function(c){return c.evidence_id+" - "+c.title;})).setRequired(true);
  map_(ss,f,cp,spec,"META-CHECKPOINT","Metadata",[],[],"","checkpoint");
  var lv=f.addMultipleChoiceItem().setTitle("Current evidence level").setChoiceValues(TS.LEVELS).setRequired(true);
  map_(ss,f,lv,spec,"META-LEVEL","Metadata",[],[],"","level");
  var ind=f.addMultipleChoiceItem().setTitle("Independence observed").setChoiceValues(TS.IND).setRequired(true);
  map_(ss,f,ind,spec,"META-INDEPENDENCE","Metadata",[],[],"","independence");
  var note=f.addParagraphTextItem().setTitle("Evidence note - what did the student actually do or explain?").setRequired(true);
  map_(ss,f,note,spec,"META-NOTE","Metadata",[],[],"","teacher_note");
  f.setDestination(FormApp.DestinationType.SPREADSHEET,ss.getId());
  return f;
}
function onStudentSubmit(e){
  try{
    var f=e.source,r=e.response,p=projectByForm_(f.getId()),email=r.getRespondentEmail()||"",course="";
    var irs=r.getItemResponses();
    irs.forEach(function(ir){
      var m=meta_(f.getId(),ir.getItem().getId()); if(!m)return;
      if(m.field_role==="course_id"){course=String(ir.getResponse()).split(" - ")[0];return;}
      if(m.evidence_type==="Knowledge"||m.evidence_type==="Transfer candidate")
        append_([r.getTimestamp(),email,"",course,p.project_id,m.canonical_id,m.evidence_type,m.skill_ids,m.outcome_codes,String(ir.getResponse()),m.evidence_type==="Knowledge"?safeScore_(ir):"","","",m.evidence_type==="Transfer candidate"?"Teacher verification required before Level 4 evidence.":"",false,f.getId(),r.getId()]);
    });
    var refl=irs.map(function(ir){var m=meta_(f.getId(),ir.getItem().getId());return m&&m.evidence_type==="Reflection"?ir.getItem().getTitle()+": "+String(ir.getResponse()):"";}).filter(String).join("\n");
    if(refl)append_([r.getTimestamp(),email,"",course,p.project_id,p.project_id+"-REFLECTION","Reflection","","",refl,"","","","Student self-report; teacher follow-up may verify.",false,f.getId(),r.getId()]);
  }catch(err){log_("ERROR",err.stack||err.message,"onStudentSubmit");}
}
function onTeacherSubmit(e){
  try{
    var f=e.source,r=e.response,p=projectByForm_(f.getId()),v={};
    r.getItemResponses().forEach(function(ir){var m=meta_(f.getId(),ir.getItem().getId());if(m)v[m.field_role]=String(ir.getResponse());});
    var sb=(v.student||"").split(" | "),id=(v.checkpoint||"").split(" - ")[0];
    var cp=(p.spec.teacher_evidence.checkpoints||[]).filter(function(c){return c.evidence_id===id;})[0]||{};
    append_([r.getTimestamp(),sb[1]||"",sb[0]||"",sb[2]||"",p.project_id,id,cp.evidence_type||"Teacher evidence",(cp.skill_ids||[]).join(";"),(cp.outcome_codes||[]).join(";"),v.checkpoint||"","",v.level||"",v.independence||"",v.teacher_note||"",true,f.getId(),r.getId()]);
  }catch(err){log_("ERROR",err.stack||err.message,"onTeacherSubmit");}
}
function ensure_(ss,n,h){var s=ss.getSheetByName(n)||ss.insertSheet(n);if(s.getLastRow()===0)s.getRange(1,1,1,h.length).setValues([h]);s.setFrozenRows(1);return s;}
function cfg_(k){var s=SpreadsheetApp.getActive().getSheetByName(TS.S.CONFIG),v=s.getRange(2,1,Math.max(1,s.getLastRow()-1),2).getValues(),r=v.filter(function(x){return x[0]===k;})[0];return r?String(r[1]).trim():"";}
function validate_(s){["spec_version","project_id","project_title","knowledge_check","skill_reflection","transfer","teacher_evidence"].forEach(function(k){if(s[k]===undefined)throw new Error("forms-spec missing "+k);});}
function sha_(t){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,t,Utilities.Charset.UTF_8).map(function(b){b=b<0?b+256:b;return ("0"+b.toString(16)).slice(-2);}).join("");}
function upsertSpec_(ss,spec,file,hash){var sh=ss.getSheetByName(TS.S.PROJECTS),rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,9).getValues():[],i=rows.findIndex(function(r){return r[0]===spec.project_id;}),row=[spec.project_id,spec.project_title,spec.spec_version,file.getId(),hash,"Needs form generation","","",new Date()];if(i>=0){if(rows[i][4]===hash&&rows[i][5]==="Forms current")row[5]="Forms current";row[6]=rows[i][6];row[7]=rows[i][7];sh.getRange(i+2,1,1,9).setValues([row]);}else sh.appendRow(row);}
function upsertSpecUrl_(ss,spec,url,hash){var sh=ss.getSheetByName(TS.S.PROJECTS),rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,9).getValues():[],i=rows.findIndex(function(r){return r[0]===spec.project_id;}),row=[spec.project_id,spec.project_title,spec.spec_version,url,hash,"Needs form generation","","",new Date()];if(i>=0){if(rows[i][4]===hash&&rows[i][5]==="Forms current")row[5]="Forms current";row[6]=rows[i][6];row[7]=rows[i][7];sh.getRange(i+2,1,1,9).setValues([row]);}else sh.appendRow(row);}
function map_(ss,f,it,spec,id,type,skills,outs,step,role){ss.getSheetByName(TS.S.MAP).appendRow([f.getId(),String(it.getId()),spec.project_id,id,type,(skills||[]).join(";"),(outs||[]).join(";"),step||"",role||""]);}
function register_(ss,spec,type,f){ss.getSheetByName(TS.S.REG).appendRow([spec.project_id,spec.spec_version,type,f.getId(),f.getPublishedUrl(),true,new Date()]);PropertiesService.getScriptProperties().setProperty("SPEC_"+f.getId(),JSON.stringify(spec));}
function projectByForm_(id){var x=PropertiesService.getScriptProperties().getProperty("SPEC_"+id);if(!x)return null;var s=JSON.parse(x);return {project_id:s.project_id,spec:s};}
function meta_(fid,iid){var sh=SpreadsheetApp.getActive().getSheetByName(TS.S.MAP),rows=sh.getRange(2,1,Math.max(1,sh.getLastRow()-1),9).getValues(),r=rows.filter(function(x){return String(x[0])===String(fid)&&String(x[1])===String(iid);})[0];return r?{canonical_id:r[3],evidence_type:r[4],skill_ids:r[5],outcome_codes:r[6],step_id:r[7],field_role:r[8]}:null;}
function getRoster_(ss,cfgs){var sh=ss.getSheetByName(TS.S.ROSTER);if(!sh||sh.getLastRow()<2)return[];var allowed=cfgs.map(function(c){return c.course_id;});return sh.getRange(2,1,sh.getLastRow()-1,4).getValues().filter(function(r){return r[0]&&r[1]&&(r[3]===true||String(r[3]).toLowerCase()==="true")&&(!allowed.length||allowed.indexOf(String(r[2]))>=0);}).map(function(r){return r[0]+" | "+r[1]+" | "+r[2];});}
function append_(row){SpreadsheetApp.getActive().getSheetByName(TS.S.EVID).appendRow(row);}
function safeScore_(ir){try{return ir.getScore();}catch(e){return "";}}
function log_(l,m,c){SpreadsheetApp.getActive().getSheetByName(TS.S.LOG).appendRow([new Date(),l,m,c]);}
