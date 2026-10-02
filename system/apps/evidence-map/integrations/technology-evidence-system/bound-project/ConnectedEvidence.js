/** Connected classroom bridge. Existing Sheet, existing Forms, existing learner secret. */
const EC = {
  VERSION: '1.0',
  URL: 'https://outcome-evidence-map.netlify.app/.netlify/functions/evidence-bridge',
  SHEET_ID: '1hGXzxde_q7UmKUFYKub3N_j_bFTMRrZqIUxTCIpciwc',
  PROGRESS: 'Evidence Map Progress',
  HEADERS: ['course_id','learner_id','student_name','outcome_id','outcome_code','ps_outcome_code','achievement','support_context','teacher_comment','review_status','evidence_ids','revision_ids','reviewer','reviewed_at','mirrored_at'],
  FIELD_EVIDENCE: 'Field Evidence',
  FIELD_HEADERS: ["course_id", "learner_id", "student_name", "project_id", "event_id", "source_revision", "revision_id", "canonical_id", "step_id", "rubric_id", "rubric_version", "criterion_id", "outcome_codes", "skill_ids", "evidence_methods", "captured_at", "evidence_note", "student_response", "artifact_url", "suggested_achievement", "support_context", "voice_note_id", "transcript_text", "transcript_reviewed", "comment_draft_id", "source", "conflict", "review_status", "mirrored_at"],
  RUBRIC_HEADERS: ["course_id", "rubric_title", "criterion_name", "beginning", "developing", "secure", "extending", "collection_guidance", "outcome_codes", "status", "project_id", "rubric_id", "rubric_version", "criterion_id", "skill_ids", "capture_ready", "review_note", "source_updated_at"],
  RUN: 'runConnectedEvidenceSync'
};

function ecSheet_(){return SpreadsheetApp.openById(EC.SHEET_ID);}
function ecFetch_(action,payload,course,params){
  const secret=emProp_(EM.PROPS.secret);if(!secret)throw new Error('Existing Evidence Map ingest secret is missing.');
  let url=EC.URL+'?action='+encodeURIComponent(action)+(course?'&course_id='+encodeURIComponent(course):'');
  Object.keys(params||{}).forEach(k=>{if(params[k]!=null&&params[k]!=='')url+='&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k]);});
  const options={method:payload?'post':'get',headers:{Authorization:'Bearer '+secret},muteHttpExceptions:true};
  if(payload){options.contentType='application/json';options.payload=JSON.stringify(payload);}
  const res=UrlFetchApp.fetch(url,options);if(res.getResponseCode()!==200)throw new Error('Evidence Map '+action+' returned HTTP '+res.getResponseCode());
  return JSON.parse(res.getContentText());
}

/** Only exact linked Form identity is accepted. No title overlap or tab-number guessing. */
function ecResolveSubmission_(e){
  const sh=e.range.getSheet(),url=sh.getFormUrl();if(!url)return null;
  const formId=FormApp.openByUrl(url).getId();
  const matches=getRegistryRows_(true).filter(r=>r.form_id===formId);
  if(matches.length!==1)return null;
  const match=matches[0];if(match.response_sheet_name!==sh.getName())setRegistryResponseSheet_(match.row_number,sh.getName());
  return Object.assign({},match,{response_sheet_name:sh.getName()});
}
function ecRepairBindings_(){
  const ss=ecSheet_(),rows=getRegistryRows_(true);let count=0;
  ss.getSheets().forEach(sh=>{const url=sh.getFormUrl();if(!url)return;const id=FormApp.openByUrl(url).getId();const matches=rows.filter(r=>r.form_id===id);
    if(matches.length===1){setRegistryResponseSheet_(matches[0].row_number,sh.getName());count++;}
  });return count;
}

/** Add a durable learner_id beside the four existing roster columns; never rotate the HMAC secret. */
function ecRoster_(){
  if(!emProp_(EM.PROPS.idSecret))throw new Error('Preserve and configure the existing LEARNER_ID_SECRET.');
  const sh=ecSheet_().getSheetByName('Roster');if(!sh)throw new Error('Existing Roster is missing.');
  const rows=sh.getDataRange().getValues(),headers=rows[0].map(String);
  for(const name of ['student_name','student_email','course_id','active'])if(headers.indexOf(name)<0)throw new Error('Roster header missing: '+name);
  let column=headers.indexOf('learner_id');
  if(column<0){column=headers.length;sh.getRange(1,column+1).setValue('learner_id');headers.push('learner_id');}
  const h=name=>headers.indexOf(name),emailIds={},result=[];
  rows.slice(1).forEach((r,i)=>{
    const email=String(r[h('student_email')]||'').trim().toLowerCase(),course=String(r[h('course_id')]||'').trim().replace(/^CT11$/,'COM11');
    if(!email||!['MM12','COM11','IBDS'].includes(course))return;
    const existing=String(r[column]||'').trim(),learner=existing||emailIds[email]||emLearnerId_(email);
    if(emailIds[email]&&emailIds[email]!==learner)throw new Error('Conflicting learner IDs in Roster; reconcile before syncing.');
    emailIds[email]=learner;if(!existing)sh.getRange(i+2,column+1).setValue(learner);
    result.push({course_id:course,learner_id:learner,display_name:String(r[h('student_name')]||''),active:r[h('active')]===true||String(r[h('active')]).toLowerCase()==='true',powerschool_id:h('powerschool_id')>=0?String(r[h('powerschool_id')]||''):''});
  });return result;
}
function ecLearnerId_(email){
  const sh=ecSheet_().getSheetByName('Roster');if(!sh)return emLearnerId_(email);
  const v=sh.getDataRange().getValues(),h=v.shift().map(String),ei=h.indexOf('student_email'),li=h.indexOf('learner_id');
  const row=v.find(r=>String(r[ei]||'').trim().toLowerCase()===String(email||'').trim().toLowerCase());
  return row&&li>=0&&row[li]?String(row[li]):emLearnerId_(email);
}
function ecStep_(o){
  if(o.step_id)return String(o.step_id);
  const sh=ecSheet_().getSheetByName(TS.SHEETS.ITEM_MAP);if(!sh||sh.getLastRow()<2)return '';
  const rows=sh.getDataRange().getValues(),h=rows.shift().map(String);
  const hits=rows.filter(r=>String(r[h.indexOf('form_id')])===String(o.source_form_id)&&String(r[h.indexOf('canonical_id')])===String(o.canonical_id));
  return hits.length===1?String(hits[0][h.indexOf('step_id')]||''):'';
}
function ecSafeCell_(v){const s=String(v==null?'':v);return /^[\s]*[=+@-]/.test(s)?"'"+s:s;}
function ecMirror_(progress,roster){
  const ss=ecSheet_();let sh=ss.getSheetByName(EC.PROGRESS);if(!sh)sh=ss.insertSheet(EC.PROGRESS);
  const names={};roster.forEach(r=>names[r.course_id+'/'+r.learner_id]=r.display_name);
  const now=new Date().toISOString();
  const rows=progress.map(r=>[r.course_id,r.learner_id,names[r.course_id+'/'+r.learner_id]||'',r.outcome_id,r.outcome_code,r.ps_outcome_code,r.achievement||'',r.support||'',r.comment||'',r.status,(r.evidence_ids||[]).join(';'),(r.revision_ids||[]).join(';'),r.reviewer||'',r.updated_at||'',now].map(ecSafeCell_));
  // Read-only mirror. Never append to Evidence_Log and never produce a second judgment.
  const previous=sh.getLastRow();sh.getRange(1,1,1,EC.HEADERS.length).setValues([EC.HEADERS]);
  if(rows.length)sh.getRange(2,1,rows.length,EC.HEADERS.length).setValues(rows);
  if(previous>rows.length+1)sh.getRange(rows.length+2,1,previous-rows.length-1,EC.HEADERS.length).clearContent();
  sh.setFrozenRows(1);sh.getRange(1,1,1,EC.HEADERS.length).setFontWeight('bold').setBackground('#153140').setFontColor('#ffffff');
  sh.setColumnWidths(1,EC.HEADERS.length,150);sh.setColumnWidth(9,360);sh.getRange(1,1,Math.max(2,rows.length+1),EC.HEADERS.length).setWrap(true);
}
function ecFieldMirror_(fieldEvents, roster) {
  const ss = ecSheet_();
  let sh = ss.getSheetByName(EC.FIELD_EVIDENCE);
  if (!sh) sh = ss.insertSheet(EC.FIELD_EVIDENCE);

  const names = {};
  roster.forEach(function(r) {
    names[r.course_id + '/' + r.learner_id] = r.display_name;
  });

  // Read existing headers from row 1 to map by header name
  const lastRow = sh.getLastRow();
  let colMap = {};
  if (lastRow >= 1) {
    const headerRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), EC.FIELD_HEADERS.length)).getValues()[0];
    headerRow.forEach(function(h, idx) {
      if (h) colMap[String(h).trim()] = idx;
    });
  }

  // Ensure all 29 headers exist
  let missingHeaders = [];
  EC.FIELD_HEADERS.forEach(function(h, idx) {
    if (colMap[h] === undefined) {
      missingHeaders.push(h);
    }
  });

  if (lastRow >= 1 && missingHeaders.length) throw new Error('Field Evidence headers changed. Restore the prepared 29 headers before syncing.');
  if (lastRow < 1) {
    sh.getRange(1, 1, 1, EC.FIELD_HEADERS.length).setValues([EC.FIELD_HEADERS]);
    EC.FIELD_HEADERS.forEach(function(h, idx) {
      colMap[h] = idx;
    });
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, EC.FIELD_HEADERS.length).setFontWeight('bold').setBackground('#153140').setFontColor('#ffffff');
  }

  const numCols = Math.max(sh.getLastColumn(), EC.FIELD_HEADERS.length);

  // Read existing keys to upsert (key: course_id + '::' + event_id -> row index)
  const existingMap = new Map();
  const existingRows = new Map();
  if (lastRow > 1) {
    const courseCol = colMap['course_id'] !== undefined ? colMap['course_id'] : 0;
    const eventCol = colMap['event_id'] !== undefined ? colMap['event_id'] : 4;
    const revCol = colMap['source_revision'] !== undefined ? colMap['source_revision'] : 5;
    const dataRange = sh.getRange(2, 1, lastRow - 1, numCols).getValues();
    dataRange.forEach(function(row, idx) {
      const k = String(row[courseCol]) + '::' + String(row[eventCol]);
      existingMap.set(k, { rowIndex: idx + 2, rev: Number(row[revCol]) || 1 });
      existingRows.set(k,row);
    });
  }

  const now = new Date().toISOString();
  const appendRows = [];

  fieldEvents.forEach(function(e) {
    const key = e.course_id + '::' + e.event_id;
    const studentName = names[e.course_id + '/' + e.learner_id] || '';
    
    // Conflicted records never display an unconfirmed score
    const displayLevel = e.conflict ? 'CONFLICT' : (e.suggested_band || e.band || e.level_raw || '');
    const supportCtx = e.support_detail ? JSON.stringify(e.support_detail) : e.support_band || (e.support_signal && e.support_signal.band) || e.independence_raw || '';
    const outcomeCodes = e.outcome_codes_raw || (Array.isArray(e.outcomes) ? e.outcomes.map(function(o){ return o.outcome_code || o.raw; }).join(';') : '');
    const skillIds = Array.isArray(e.tutorial_skill_ids) ? e.tutorial_skill_ids.join(';') : (e.skill_ids || '');
    const methods = e.evidence_type_raw || (Array.isArray(e.methods) ? e.methods.join('+') : '');

    const recordData = {
      'course_id': e.course_id,
      'learner_id': e.learner_id,
      'student_name': studentName,
      'project_id': e.project_id || '',
      'event_id': e.event_id,
      'source_revision': e.source_revision || 1,
      'revision_id': e.revision_id || '',
      'canonical_id': e.canonical_id || e.criterion_id || '',
      'step_id': e.step_id || '',
      'rubric_id': e.rubric_id || '',
      'rubric_version': e.rubric_version || '',
      'criterion_id': e.criterion_id || '',
      'outcome_codes': outcomeCodes,
      'skill_ids': skillIds,
      'evidence_methods': methods,
      'captured_at': e.timestamp || '',
      'evidence_note': e.teacher_note || '',
      'student_response': e.response_value || '',
      'artifact_url': e.artifact_url || '',
      'suggested_achievement': displayLevel,
      'support_context': supportCtx,
      'voice_note_id': e.voice_note_id || '',
      'transcript_text': e.transcript_text || '',
      'transcript_reviewed': e.transcript_reviewed ? 'TRUE' : 'FALSE',
      'comment_draft_id': e.comment_draft_id || '',
      'source': e.source || 'field',
      'conflict': e.conflict ? 'CONFLICT' : 'OK',
      'review_status': e.conflict ? 'conflict' : 'unreviewed',
      'mirrored_at': now
    };

    const rowArray = existingRows.has(key) ? existingRows.get(key).slice() : new Array(numCols).fill('');
    EC.FIELD_HEADERS.forEach(function(h) {
      const val = recordData[h] !== undefined ? recordData[h] : '';
      rowArray[colMap[h]] = ecSafeCell_(val);
    });

    if (existingMap.has(key)) {
      const existing = existingMap.get(key);
      if ((e.source_revision || 1) >= existing.rev) {
        sh.getRange(existing.rowIndex, 1, 1, numCols).setValues([rowArray]);
      }
    } else {
      appendRows.push(rowArray);
    }
  });

  if (appendRows.length > 0) {
    const startRow = lastRow < 2 ? 2 : lastRow + 1;
    sh.getRange(startRow, 1, appendRows.length, numCols).setValues(appendRows);
  }
}

function ecPublishedRubrics_(rubrics){
  if(!rubrics.length)return;
  const sh=ecSheet_().getSheetByName('Rubric Library');if(!sh)throw new Error('Prepared Rubric Library tab is missing');
  const width=sh.getLastColumn(),head=sh.getRange(1,1,1,width).getValues()[0],index={};head.forEach((h,i)=>index[String(h).trim()]=i);
  for(const h of EC.RUBRIC_HEADERS)if(index[h]===undefined)throw new Error('Rubric Library header missing: '+h);
  const rows=sh.getLastRow()>1?sh.getRange(2,1,sh.getLastRow()-1,width).getValues():[],positions={};
  const key=r=>[r[index.course_id],r[index.rubric_id],r[index.rubric_version],r[index.criterion_id]].join('|');rows.forEach((r,i)=>positions[key(r)]=i);
  for(const rubric of rubrics){
    if(rubric.status!=='approved')continue;
    for(const criterion of rubric.criteria||[]){
      const values={course_id:rubric.course,rubric_title:rubric.title,criterion_name:criterion.name,beginning:criterion.descriptors.Beginning,developing:criterion.descriptors.Developing,secure:criterion.descriptors.Secure,extending:criterion.descriptors.Extending,collection_guidance:criterion.collection||'',outcome_codes:(criterion.outcome_codes||[]).join(';'),status:'approved',project_id:rubric.project_id,rubric_id:rubric.id,rubric_version:rubric.version,criterion_id:criterion.id,skill_ids:(criterion.skill_ids||[]).join(';'),capture_ready:rubric.capture_ready?'TRUE':'FALSE',review_note:rubric.review_note||'',source_updated_at:rubric.approved_at||''};
      const id=[rubric.course,rubric.id,rubric.version,criterion.id].join('|'),position=positions[id];
      const row=position===undefined?new Array(width).fill(''):rows[position].slice();
      EC.RUBRIC_HEADERS.forEach(h=>row[index[h]]=ecSafeCell_(values[h]));
      if(position===undefined){positions[id]=rows.length;rows.push(row);}else rows[position]=row;
    }
  }
  if(rows.length)sh.getRange(2,1,rows.length,width).setValues(rows);
}
function ecSyncField_(roster){
  const props=PropertiesService.getScriptProperties(),deadline=Date.now()+120000;let total=0,pages=0;
  for(const course of ['MM12','COM11','IBDS']){
    const key='FIELD_MIRROR_CURSOR_'+course;let cursor=props.getProperty(key)||'';
    do{
      if(Date.now()>deadline||pages>=18)return {count:total,continuing:true};
      let page;
      try{page=ecFetch_('field-events',null,course,{cursor:cursor,limit:100});}
      catch(e){if(String(e.message).indexOf('409')>=0)props.deleteProperty(key);throw e;}
      pages++;ecFieldMirror_(page.events||[],roster);
      // Acknowledge only after the Sheet has durably accepted this page.
      SpreadsheetApp.flush();
      if(page.events&&page.events.length)ecFetch_('mirror-status',{course_id:course,receipts:page.events.map(e=>({event_id:e.event_id,revision_id:e.revision_id}))});
      total+=(page.events||[]).length;cursor=page.has_more?page.next_cursor||'':'';
      if(page.has_more&&!cursor)throw new Error('Field pagination omitted its next cursor');
      if(cursor)props.setProperty(key,cursor);else props.deleteProperty(key);
    }while(cursor);
  }
  return {count:total,continuing:false};
}
function runConnectedEvidenceSync(){
  const lock=LockService.getScriptLock();if(!lock.tryLock(5000))return {status:'busy'};
  try{
    SpreadsheetApp.setActiveSpreadsheet(ecSheet_());
    const roster=ecRoster_();let progress=[],rubrics=[];
    for(const c of ['MM12','COM11','IBDS']){
      ecFetch_('roster',{course_id:c,learners:roster.filter(r=>r.course_id===c)});
      progress=progress.concat(ecFetch_('progress',null,c).progress||[]);
      rubrics=rubrics.concat(ecFetch_('rubrics',null,c).rubrics||[]);
    }
    const sync=emSyncAll_(false,true);ecMirror_(progress,roster);
    const field=ecSyncField_(roster);ecPublishedRubrics_(rubrics);
    PropertiesService.getScriptProperties().setProperty('CONNECTED_LAST_SYNC',new Date().toISOString());
    logError_('INFO','Connected sync completed: '+roster.length+' roster memberships; '+progress.length+' judgments; '+field.count+' field captures mirrored.','connected-v1');
    return {status:'ok',roster_memberships:roster.length,judgments:progress.length,field_captures:field.count,field_continuing:field.continuing,evidence:sync};
  }catch(e){logError_('ERROR',e.message,'connected-v1');throw e;}finally{lock.releaseLock();}
}

/** Run once from the bound editor. One form-submit router + one bounded retry/mirror timer. */
function installConnectedEvidence(){
  SpreadsheetApp.setActiveSpreadsheet(ecSheet_());
  if(!emConfigured_())throw new Error('The three existing integration Script Properties must be set first.');
  emPropBackup_();
  PropertiesService.getScriptProperties().setProperty(EM.PROPS.url,EC.URL+'?action=events');
  const bindings=ecRepairBindings_();ensureAssessmentSpreadsheetTrigger_();
  const timers=ScriptApp.getProjectTriggers().filter(t=>t.getHandlerFunction()===EC.RUN);
  if(!timers.length)ScriptApp.newTrigger(EC.RUN).timeBased().everyMinutes(5).create();
  timers.slice(1).forEach(t=>ScriptApp.deleteTrigger(t));
  emSyncAll_(true,true);
  const result=runConnectedEvidenceSync();console.log(JSON.stringify({bindings,...result}));return result;
}
function emPropBackup_(){const p=PropertiesService.getScriptProperties();if(!p.getProperty('EVIDENCE_MAP_PREVIOUS_INGEST_URL'))p.setProperty('EVIDENCE_MAP_PREVIOUS_INGEST_URL',p.getProperty(EM.PROPS.url)||'');}
