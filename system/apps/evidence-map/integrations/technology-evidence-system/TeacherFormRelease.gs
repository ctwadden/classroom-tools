/** Approved Truck Ad release. Manual functions only; never attached to a trigger. */
const TFR={key:'TRUCK_TEACHER_RELEASE_20260925',oldTeacher:'1nnWFXa7JEZO8PqBucxDdRT82YE2dVEf1xVtbobbcvDw',student:'1da4cFPV-iUuk5ay1uA9y9Ay0z0GMUk-fLLPO8bnzJ5A',spec:{
  "spec_version": 1,
  "project_id": "PS-TRUCK-AD",
  "project_title": "Truck Ad",
  "course_configs": [
    {
      "course_id": "MM12",
      "module_id": "M1",
      "outcome_codes": [
        "1.1",
        "1.3",
        "1.4",
        "1.5"
      ]
    },
    {
      "course_id": "COM11",
      "module_id": "M4",
      "outcome_codes": [
        "1.4",
        "4.1",
        "4.2",
        "4.3",
        "4.4",
        "4.5"
      ]
    }
  ],
  "student_form": {
    "description": "Complete the Truck Ad knowledge check, identify evidence of your technical/design learning, and answer the transfer prompt."
  },
  "knowledge_check": {
    "items": [
      {
        "id": "TA-KC-01",
        "type": "multiple_choice",
        "prompt": "Why should the truck be converted to a Smart Object before applying supported filters?",
        "choices": [
          "It automatically increases image resolution",
          "It keeps the original pixels and lets supported filters remain editable",
          "It automatically removes the background",
          "It changes the document to CMYK"
        ],
        "correct_index": 1,
        "points": 1,
        "correct_feedback": "Correct - Smart Objects preserve source pixels and let supported filters remain editable as Smart Filters.",
        "incorrect_feedback": "Review the Smart Object / Smart Filter relationship.",
        "skill_ids": [
          "PS-SMO-01",
          "PS-FLT-01"
        ],
        "outcome_codes": [
          "MM12 1.1",
          "CT11 4.4"
        ],
        "step_id": "TA-S02"
      },
      {
        "id": "TA-KC-02",
        "type": "multiple_choice",
        "prompt": "When painting on a Smart Filter mask, what does black paint do?",
        "choices": [
          "Makes the filter stronger",
          "Hides the filter effect in the painted area",
          "Deletes the original pixels",
          "Changes the filter to grayscale"
        ],
        "correct_index": 1,
        "points": 1,
        "skill_ids": [
          "PS-FLT-01",
          "PS-LAY-01"
        ],
        "outcome_codes": [
          "MM12 1.1",
          "CT11 4.4"
        ],
        "step_id": "TA-S04"
      },
      {
        "id": "TA-KC-03",
        "type": "multiple_choice",
        "prompt": "Why is Multiply a logical starting blend mode for a light paper texture?",
        "choices": [
          "It lets darker texture detail affect the image while lighter areas recede",
          "It always makes an image sharper",
          "It removes all colour from the texture",
          "It automatically matches perspective"
        ],
        "correct_index": 0,
        "points": 1,
        "skill_ids": [
          "PS-BLD-02"
        ],
        "outcome_codes": [
          "MM12 1.1",
          "CT11 4.4"
        ],
        "step_id": "TA-S05"
      },
      {
        "id": "TA-KC-04",
        "type": "multiple_choice",
        "prompt": "The bull becomes the first thing you notice instead of the truck. What is the main design problem?",
        "choices": [
          "Resolution",
          "Visual hierarchy",
          "File naming",
          "Colour mode"
        ],
        "correct_index": 1,
        "points": 1,
        "skill_ids": [
          "GD-HIE-01",
          "PS-DES-01"
        ],
        "outcome_codes": [
          "MM12 1.4",
          "CT11 4.1"
        ],
        "step_id": "TA-S13"
      },
      {
        "id": "TA-KC-05",
        "type": "multiple_choice",
        "prompt": "What is the main communication purpose of the bull?",
        "choices": [
          "To demonstrate masking only",
          "To act as a visual metaphor for strength/toughness",
          "To make the image symmetrical",
          "To fill empty space"
        ],
        "correct_index": 1,
        "points": 1,
        "skill_ids": [
          "GD-MET-01",
          "GD-AUD-01"
        ],
        "outcome_codes": [
          "MM12 1.5",
          "CT11 4.4"
        ],
        "step_id": "TA-S08"
      },
      {
        "id": "TA-KC-06",
        "type": "multiple_choice",
        "prompt": "Which approach is most likely to create a professional-looking type block?",
        "choices": [
          "Place every word wherever there is empty space",
          "Use shared alignment edges/guides and deliberate size relationships",
          "Use a different font for every line",
          "Centre every line automatically"
        ],
        "correct_index": 1,
        "points": 1,
        "skill_ids": [
          "PS-TYP-01",
          "GD-ALN-01",
          "GD-TYP-01"
        ],
        "outcome_codes": [
          "MM12 1.4",
          "CT11 4.3"
        ],
        "step_id": "TA-S09"
      },
      {
        "id": "TA-KC-07",
        "type": "multiple_choice",
        "prompt": "Which file best demonstrates editable masks, Smart Filters and live type?",
        "choices": [
          "A screenshot",
          "A flattened JPEG",
          "The layered PSD",
          "A thumbnail"
        ],
        "correct_index": 2,
        "points": 1,
        "skill_ids": [
          "PS-SMO-01",
          "PS-TYP-01",
          "PS-OUT-01"
        ],
        "outcome_codes": [
          "MM12 1.3",
          "CT11 4.4"
        ],
        "step_id": "TA-S15"
      },
      {
        "id": "TA-KC-08",
        "type": "multiple_choice",
        "prompt": "If the truck were advertised to a different target audience, what should be reconsidered first?",
        "choices": [
          "Only the filename",
          "The visual language, message, type, colour and supporting imagery",
          "Only layer order",
          "Nothing"
        ],
        "correct_index": 1,
        "points": 1,
        "skill_ids": [
          "GD-AUD-01",
          "GD-COL-01",
          "GD-TYP-01",
          "PS-DES-01"
        ],
        "outcome_codes": [
          "MM12 1.5",
          "CT11 1.4",
          "CT11 4.4"
        ],
        "step_id": "TA-S14"
      }
    ]
  },
  "skill_reflection": {
    "technical_skills": [
      {
        "id": "PS-SMO-01",
        "label": "Smart Objects"
      },
      {
        "id": "PS-FLT-01",
        "label": "Smart Filters / filter masks"
      },
      {
        "id": "PS-LAY-01",
        "label": "Layer Masks"
      },
      {
        "id": "PS-BLD-02",
        "label": "Blending Modes"
      },
      {
        "id": "PS-TYP-01",
        "label": "Photoshop Typography"
      },
      {
        "id": "PS-OUT-01",
        "label": "Export / Output"
      }
    ],
    "design_skills": [
      {
        "id": "GD-HIE-01",
        "label": "Visual hierarchy"
      },
      {
        "id": "GD-ALN-01",
        "label": "Alignment"
      },
      {
        "id": "GD-COL-01",
        "label": "Colour relationships"
      },
      {
        "id": "GD-TYP-01",
        "label": "Typography as communication"
      },
      {
        "id": "GD-AUD-01",
        "label": "Audience and purpose"
      },
      {
        "id": "GD-MET-01",
        "label": "Visual metaphor"
      },
      {
        "id": "GD-CRIT-01",
        "label": "Critique and revision"
      }
    ],
    "independence_options": [
      "Followed the example closely",
      "Needed some prompts/checkpoints",
      "Worked independently",
      "Adapted or extended the skill"
    ]
  },
  "transfer": {
    "id": "TA-TRF-01",
    "prompt": "The same truck is now marketed to a different audience. Identify one technical skill you would keep and one design strategy you would change. Explain why.",
    "skill_ids": [
      "GD-AUD-01",
      "PS-DES-01"
    ],
    "outcome_codes": [
      "MM12 1.5",
      "CT11 1.4",
      "CT11 4.4"
    ]
  },
  "teacher_evidence": {
    "checkpoints": [
      {
        "evidence_id": "TA-OBS-01",
        "evidence_type": "Observation",
        "title": "Smart Filter mask repair",
        "skill_ids": [
          "PS-FLT-01",
          "PS-LAY-01"
        ],
        "outcome_codes": [
          "MM12 1.1",
          "CT11 4.4"
        ]
      },
      {
        "evidence_id": "TA-CON-01",
        "evidence_type": "Conversation",
        "title": "Blend-mode reasoning",
        "skill_ids": [
          "PS-BLD-02"
        ],
        "outcome_codes": [
          "MM12 1.1",
          "MM12 1.4",
          "CT11 4.1",
          "CT11 4.4"
        ]
      },
      {
        "evidence_id": "TA-OBS-02",
        "evidence_type": "Observation",
        "title": "Typography / hierarchy revision",
        "skill_ids": [
          "PS-TYP-01",
          "GD-HIE-01",
          "GD-ALN-01"
        ],
        "outcome_codes": [
          "MM12 1.4",
          "CT11 4.1",
          "CT11 4.3"
        ]
      },
      {
        "evidence_id": "TA-CON-02",
        "evidence_type": "Conversation",
        "title": "Audience / message defence",
        "skill_ids": [
          "GD-AUD-01",
          "GD-MET-01"
        ],
        "outcome_codes": [
          "MM12 1.5",
          "CT11 1.4",
          "CT11 4.4"
        ]
      },
      {
        "evidence_id": "TA-PRO-02",
        "evidence_type": "Product",
        "title": "Final advertisement",
        "skill_ids": [
          "PS-DES-01",
          "PS-BLD-02",
          "PS-TYP-01",
          "GD-HIE-01",
          "GD-AUD-01"
        ],
        "outcome_codes": [
          "MM12 1.4",
          "MM12 1.5",
          "CT11 4.1",
          "CT11 4.4"
        ]
      },
      {
        "evidence_id": "TA-QA-01",
        "evidence_type": "Observation+Conversation",
        "title": "Critique and revision",
        "skill_ids": [
          "GD-CRIT-01",
          "PS-DES-01"
        ],
        "outcome_codes": [
          "MM12 1.4",
          "CT11 1.4",
          "CT11 4.1"
        ]
      },
      {
        "evidence_id": "TA-PRO-01",
        "evidence_type": "Product",
        "title": "Inspect the layered product at 100%",
        "skill_ids": [
          "PS-SMO-01",
          "PS-FLT-01",
          "GD-CRIT-01"
        ],
        "outcome_codes": [
          "MM12 1.1",
          "MM12 1.3"
        ]
      }
    ],
    "criterion_choices": [
      {
        "choice_label": "MM12 \u2022 Editable image construction \u2014 Smart Filter mask repair",
        "course_id": "MM12",
        "checkpoint_id": "TA-OBS-01",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C1",
        "outcome_codes": [
          "MM12-1.1",
          "MM12-1.3"
        ],
        "skill_ids": [
          "PS-FLT-01",
          "PS-LAY-01"
        ]
      },
      {
        "choice_label": "MM12 \u2022 Editable image construction \u2014 Blend-mode reasoning",
        "course_id": "MM12",
        "checkpoint_id": "TA-CON-01",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C1",
        "outcome_codes": [
          "MM12-1.1",
          "MM12-1.3"
        ],
        "skill_ids": [
          "PS-BLD-02"
        ]
      },
      {
        "choice_label": "MM12 \u2022 Editable image construction \u2014 Inspect the layered product at 100%",
        "course_id": "MM12",
        "checkpoint_id": "TA-PRO-01",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C1",
        "outcome_codes": [
          "MM12-1.1",
          "MM12-1.3"
        ],
        "skill_ids": [
          "PS-SMO-01",
          "PS-FLT-01"
        ]
      },
      {
        "choice_label": "MM12 \u2022 Hierarchy and visual design \u2014 Typography / hierarchy revision",
        "course_id": "MM12",
        "checkpoint_id": "TA-OBS-02",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C2",
        "outcome_codes": [
          "MM12-1.4"
        ],
        "skill_ids": [
          "PS-TYP-01",
          "GD-HIE-01",
          "GD-ALN-01"
        ]
      },
      {
        "choice_label": "MM12 \u2022 Hierarchy and visual design \u2014 Final advertisement",
        "course_id": "MM12",
        "checkpoint_id": "TA-PRO-02",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C2",
        "outcome_codes": [
          "MM12-1.4"
        ],
        "skill_ids": [
          "PS-TYP-01",
          "GD-HIE-01"
        ]
      },
      {
        "choice_label": "MM12 \u2022 Hierarchy and visual design \u2014 Critique and revision",
        "course_id": "MM12",
        "checkpoint_id": "TA-QA-01",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C2",
        "outcome_codes": [
          "MM12-1.4"
        ],
        "skill_ids": [
          "GD-CRIT-01"
        ]
      },
      {
        "choice_label": "MM12 \u2022 Communicating a message for an audience \u2014 Audience / message defence",
        "course_id": "MM12",
        "checkpoint_id": "TA-CON-02",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C3",
        "outcome_codes": [
          "MM12-1.5"
        ],
        "skill_ids": [
          "GD-AUD-01",
          "GD-MET-01"
        ]
      },
      {
        "choice_label": "MM12 \u2022 Communicating a message for an audience \u2014 Final advertisement",
        "course_id": "MM12",
        "checkpoint_id": "TA-PRO-02",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C3",
        "outcome_codes": [
          "MM12-1.5"
        ],
        "skill_ids": [
          "PS-DES-01",
          "GD-AUD-01"
        ]
      },
      {
        "choice_label": "MM12 \u2022 Communicating a message for an audience \u2014 Critique and revision",
        "course_id": "MM12",
        "checkpoint_id": "TA-QA-01",
        "rubric_id": "MM12-TRUCK-AD-R1",
        "rubric_version": "2026-09-25.2",
        "criterion_id": "TA-MM-C3",
        "outcome_codes": [
          "MM12-1.5"
        ],
        "skill_ids": [
          "GD-CRIT-01",
          "PS-DES-01"
        ]
      },
      {
        "choice_label": "COM11 \u2022 General evidence \u2014 Smart Filter mask repair",
        "course_id": "COM11",
        "checkpoint_id": "TA-OBS-01",
        "unbound": true
      },
      {
        "choice_label": "COM11 \u2022 General evidence \u2014 Blend-mode reasoning",
        "course_id": "COM11",
        "checkpoint_id": "TA-CON-01",
        "unbound": true
      },
      {
        "choice_label": "COM11 \u2022 General evidence \u2014 Typography / hierarchy revision",
        "course_id": "COM11",
        "checkpoint_id": "TA-OBS-02",
        "unbound": true
      },
      {
        "choice_label": "COM11 \u2022 General evidence \u2014 Audience / message defence",
        "course_id": "COM11",
        "checkpoint_id": "TA-CON-02",
        "unbound": true
      },
      {
        "choice_label": "COM11 \u2022 General evidence \u2014 Final advertisement",
        "course_id": "COM11",
        "checkpoint_id": "TA-PRO-02",
        "unbound": true
      },
      {
        "choice_label": "COM11 \u2022 General evidence \u2014 Critique and revision",
        "course_id": "COM11",
        "checkpoint_id": "TA-QA-01",
        "unbound": true
      }
    ]
  },
  "release_status": "approved by Chad after rubric and Form review",
  "teacher_form_version": "2.0"
}};
function tfrPermissions_(id){
  const url='https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'/permissions?includePermissionsForView=published&fields=permissions(id,type,role,view,emailAddress,domain)';
  const r=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
  if(r.getResponseCode()!==200)throw new Error('Could not verify teacher Form access: HTTP '+r.getResponseCode());
  return JSON.parse(r.getContentText()).permissions||[];
}
function tfrPrivate_(form){
  if(form.isPublished())throw new Error('Prepare responder restrictions before publication.');
  const id=form.getId();
  for(const permission of tfrPermissions_(id)){
    if(permission.type==='anyone'||permission.type==='domain'){
      const r=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+id+'/permissions/'+encodeURIComponent(permission.id),{method:'delete',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
      if(r.getResponseCode()!==204)throw new Error('Could not restrict the new teacher Form.');
    }else if(permission.role!=='owner'&&permission.emailAddress!=='cwadden@gnspes.ca')throw new Error('Unexpected collaborator on the new teacher Form; review before publishing.');
  }
  if(tfrPermissions_(id).some(p=>p.type==='anyone'||p.type==='domain'))throw new Error('Teacher Form still has broad responder access.');
}
function prepareTruckAdTeacherRelease(){
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const ss=ecSheet_();SpreadsheetApp.setActiveSpreadsheet(ss);const props=PropertiesService.getScriptProperties();
    const active=getActiveProjectFormPair_('PS-TRUCK-AD');if(!active.student||active.student.form_id!==TFR.student)throw new Error('Student Form changed; inspect before continuing.');
    const prior=props.getProperty(TFR.key);
    if(prior){console.log(prior);return JSON.parse(prior);}
    if(!active.teacher||active.teacher.form_id!==TFR.oldTeacher)throw new Error('Teacher Form changed; inspect before continuing.');
    const approved=fbPreflight_(TFR.spec);ecPublishedRubrics_(approved);
    const form=FormApp.create('Truck Ad - Teacher Evidence Capture v2',false);
    const state={form_id:form.getId(),edit_url:form.getEditUrl(),status:'building',teacher_form_version:'2.0',project_spec_version:1};props.setProperty(TFR.key,JSON.stringify(state));
    tfrPrivate_(form);
    const built=buildTeacherForm_(ss,TFR.spec,form);
    if(!built.responseSheetName)throw new Error('Response tab not yet resolved. Keep the old Form active.');
    form.setPublishingSummary(false);
    state.response_sheet_name=built.responseSheetName;state.form_url=form.getPublishedUrl();state.status='prepared';
    props.setProperty(TFR.key,JSON.stringify(state));console.log(JSON.stringify(state));return state;
  }finally{lock.releaseLock();}
}
function activateTruckAdTeacherRelease(){
  const lock=LockService.getScriptLock();lock.waitLock(5000);
  try{
    const ss=ecSheet_();SpreadsheetApp.setActiveSpreadsheet(ss);const props=PropertiesService.getScriptProperties(),state=JSON.parse(props.getProperty(TFR.key)||'null');
    if(!state||!['prepared','active'].includes(state.status))throw new Error('Finish preparing the Form first.');
    const form=FormApp.openById(state.form_id);fbPreflight_(TFR.spec);
    const active=getActiveProjectFormPair_('PS-TRUCK-AD');if(active.student.form_id!==TFR.student)throw new Error('Student Form changed.');
    if(![TFR.oldTeacher,state.form_id].includes(active.teacher.form_id))throw new Error('Teacher Form changed.');
    if(tfrPermissions_(state.form_id).some(p=>p.type==='anyone'||p.type==='domain'||(p.role!=='owner'&&p.emailAddress!=='cwadden@gnspes.ca')))throw new Error('Teacher responder access requires review.');
    if(!form.isPublished())form.setPublished(true);
    if(!form.isPublished()||!form.isAcceptingResponses())throw new Error('Form is not open for responses.');
    // Keep project spec version 1: only the teacher release changed, not the student assessment.
    if(active.teacher.form_id!==state.form_id)registerForm_(ss,TFR.spec,'teacher',form,state.response_sheet_name);
    const project=ss.getSheetByName(TS.SHEETS.PROJECTS),rows=project.getDataRange().getValues(),idx=rows.findIndex(r=>r[0]==='PS-TRUCK-AD');
    if(idx<1)throw new Error('Project registration missing.');
    project.getRange(idx+1,9).setValue(form.getPublishedUrl());project.getRange(idx+1,10).setValue(new Date());
    state.status='active';state.form_url=form.getPublishedUrl();props.setProperty(TFR.key,JSON.stringify(state));
    const pair=getActiveProjectFormPair_('PS-TRUCK-AD',1);if(pair.student.form_id!==TFR.student||pair.teacher.form_id!==state.form_id)throw new Error('Registry readback mismatch.');
    console.log(JSON.stringify({...state,published:form.isPublished(),accepting:form.isAcceptingResponses(),student_form_unchanged:true,public_or_domain_access:false}));return state;
  }finally{lock.releaseLock();}
}

// One labelled, unrostered IE submission exercises the actual browser/trigger route.
const TFR_QA='INTEGRATION QA — NOT A STUDENT | integration-qa@example.invalid | MM12';
function tfrActiveForm_(){
  const state=JSON.parse(PropertiesService.getScriptProperties().getProperty(TFR.key)||'null');
  if(!state||state.status!=='active')throw new Error('Activate the release first.');
  const pair=getActiveProjectFormPair_('PS-TRUCK-AD',1);
  if(pair.student.form_id!==TFR.student||pair.teacher.form_id!==state.form_id)throw new Error('Registry changed.');
  if(tfrPermissions_(state.form_id).some(p=>p.type==='anyone'||p.type==='domain'||(p.role!=='owner'&&p.emailAddress!=='cwadden@gnspes.ca')))throw new Error('Private teacher access required.');
  return FormApp.openById(state.form_id);
}
function prepareTruckAdDeliveryCheck(){
  const form=tfrActiveForm_();
  const item=form.getItems(FormApp.ItemType.LIST).filter(i=>i.getTitle()==='Student');
  if(item.length!==1)throw new Error('Student question changed.');
  const list=item[0].asListItem(),choices=list.getChoices().map(c=>c.getValue());
  if(!choices.includes(TFR_QA))list.setChoiceValues(choices.concat([TFR_QA]));
  console.log(JSON.stringify({qa_option_ready:true,roster_unchanged:true,form_id:form.getId()}));
}
function finishTruckAdDeliveryCheck(){
  const form=tfrActiveForm_();
  const items=form.getItems(FormApp.ItemType.LIST).filter(i=>i.getTitle()==='Student');
  if(items.length!==1)throw new Error('Student question changed.');
  const list=items[0].asListItem(),choices=list.getChoices().map(c=>c.getValue());
  if(choices.includes(TFR_QA))list.setChoiceValues(choices.filter(v=>v!==TFR_QA));
  // Retain the old Form and its responses; close stale links with a replacement notice.
  const old=FormApp.openById(TFR.oldTeacher);
  old.setCustomClosedFormMessage('This teacher capture Form has been replaced. Use '+form.getPublishedUrl());
  old.setAcceptingResponses(false);
  console.log(JSON.stringify({qa_option_removed:!list.getChoices().some(c=>c.getValue()===TFR_QA),old_teacher_accepting:old.isAcceptingResponses(),new_teacher_accepting:form.isAcceptingResponses(),student_form_unchanged:true}));
}
