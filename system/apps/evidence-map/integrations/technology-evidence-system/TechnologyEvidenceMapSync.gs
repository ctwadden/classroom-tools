/**
 * TechnologyEvidenceMapSync.gs
 * Add this file to the SAME Apps Script project bound to the "Technology Evidence System"
 * sheet (alongside Code.gs / Dashboard.gs). It is ADDITIVE and NON-DESTRUCTIVE:
 * every normalized Evidence_Log append is pushed to the Outcome Evidence Map ingest
 * endpoint, best-effort. A push failure (e.g. Netlify down) writes a PENDING receipt and
 * is retried later — it NEVER throws back into appendEvidence_, so a form submission is
 * never lost. Reuses the existing sheet handles/constants (TS, sha256_, logError_).
 *
 * INSTALL (see integrations/technology-evidence-system/README.md):
 *  1. Paste this file into the project.
 *  2. Project Settings → Script Properties: EVIDENCE_MAP_INGEST_URL, EVIDENCE_MAP_INGEST_SECRET, LEARNER_ID_SECRET.
 *  3. In appendEvidence_ (Code.gs), add ONE line after sh.appendRow(...):
 *        try { emOnEvidenceAppended_(obj); } catch (e) { logError_('WARN', e.message, 'emSync'); }
 *  4. In onOpen (Code.gs) menu, add:
 *        .addSeparator()
 *        .addItem('Sync pending Evidence Map events', 'syncPendingEvidenceToEvidenceMap')
 *        .addItem('Resync ALL Evidence Map events', 'resyncAllEvidenceToEvidenceMap')
 *        .addItem('Backfill Knowledge scores', 'backfillKnowledgeScores')
 */

const EM = {
  SYNC_SHEET: 'Evidence Map Sync',
  SYNC_HEADERS: ['event_id','source_form_id','source_response_id','canonical_id','stream','learner_id','status','attempt_count','last_attempt_at','evidence_map_record_id','error_message','revision_id','source_revision'],
  PROPS: { url:'EVIDENCE_MAP_INGEST_URL', secret:'EVIDENCE_MAP_INGEST_SECRET', idSecret:'LEARNER_ID_SECRET' },
  // Evidence_Log evidence_type -> Evidence Map stream. Metadata rows are never appended, so never seen here.
  STREAMS: { 'support':'support','knowledge':'knowledge','reflection':'reflection','transfer candidate':'transfer',
             'observation':'evidence','conversation':'evidence','product':'evidence','observation+conversation':'evidence','teacher evidence':'evidence' },
  BATCH: 100
};

function emProp_(k){ return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function emConfigured_(){ return !!(emProp_(EM.PROPS.url) && emProp_(EM.PROPS.secret) && emProp_(EM.PROPS.idSecret)); }

/** Pseudonymous learner id — HMAC(normalized email, secret). Email never leaves Google. */
function emLearnerId_(email){
  const norm = String(email||'').trim().toLowerCase();
  if(!norm) return '';
  const sig = Utilities.computeHmacSha256Signature(norm, emProp_(EM.PROPS.idSecret));
  return 'lrn_' + sig.map(b=>(b<0?b+256:b).toString(16).padStart(2,'0')).join('').slice(0,32);
}
function emStreamOf_(evidenceType){ return EM.STREAMS[String(evidenceType||'').trim().toLowerCase()] || null; }
function emEventId_(formId, responseId, canonicalId){ return sha256_(String(formId)+':'+String(responseId)+':'+String(canonicalId)); }

/** Knowledge correctness from the stored forms-spec (Google side has correct_index). */
function emKnowledge_(formId, canonicalId, responseValue){
  try{
    const raw = PropertiesService.getScriptProperties().getProperty('SPEC_'+formId);
    if(!raw) return {};
    const spec = JSON.parse(raw);
    const q = ((spec.knowledge_check && spec.knowledge_check.items) || []).find(x=>String(x.id)===String(canonicalId));
    if(!q || q.type!=='multiple_choice') return {};
    const correct = (q.choices||[])[q.correct_index];
    const is_correct = correct!=null && String(responseValue).trim()===String(correct).trim();
    return { is_correct: is_correct, points_earned: is_correct ? (q.points||1) : 0, points_possible: (q.points||1) };
  }catch(e){ return {}; }
}

/** Build an ingest event from an Evidence_Log-shaped object. Sends RAW outcome/level/independence; the endpoint normalizes + keeps raw. */
function emBuildEvent_(o){
  const stream = emStreamOf_(o.evidence_type);
  if(!stream) return null;
  const ev = {
    stream: stream,
    event_id: emEventId_(o.source_form_id, o.source_response_id, o.canonical_id),
    learner_id: typeof ecLearnerId_ === 'function' ? ecLearnerId_(o.student_email) : emLearnerId_(o.student_email),
    source_revision: 2,
    teacher_note: String(o.teacher_note||''),
    step_id: typeof ecStep_ === 'function' ? ecStep_(o) : String(o.step_id||''),
    course_id: String(o.course_id||''),
    project_id: String(o.project_id||''),
    canonical_id: String(o.canonical_id||''),
    tutorial_skill_ids: String(o.skill_ids||'').split(/[;,]/).map(s=>s.trim()).filter(Boolean),
    outcome_codes_raw: String(o.outcome_codes||''),
    evidence_type_raw: String(o.evidence_type||''),
    response_value: String(o.response_value||''),
    level_raw: String(o.level||''),
    independence_raw: String(o.independence||''),
    teacher_verified: o.teacher_verified===true || String(o.teacher_verified).toLowerCase()==='true',
    source_form_id: String(o.source_form_id||''),
    source_response_id: String(o.source_response_id||''),
    timestamp: (o.timestamp instanceof Date) ? o.timestamp.toISOString() : String(o.timestamp||'')
  };
  const context=typeof fbEventContext_==='function'?fbEventContext_(o):null;
  if(context){ev.rubric_id=context.rubric_id;ev.rubric_version=context.rubric_version;ev.criterion_id=context.criterion_id;ev.source_revision=3;}
  if(stream==='knowledge') Object.assign(ev, emKnowledge_(o.source_form_id, o.canonical_id, o.response_value));
  return ev;
}

function emSyncSheet_(){
  const ss=SpreadsheetApp.getActive();
  let sh=ss.getSheetByName(EM.SYNC_SHEET);
  if(!sh){ sh=ss.insertSheet(EM.SYNC_SHEET); sh.getRange(1,1,1,EM.SYNC_HEADERS.length).setValues([EM.SYNC_HEADERS]); sh.setFrozenRows(1);
    sh.getRange(1,1,1,EM.SYNC_HEADERS.length).setFontWeight('bold').setBackground('#153140').setFontColor('#ffffff'); }
  else {
    const headers=sh.getRange(1,1,1,EM.SYNC_HEADERS.length).getValues()[0];
    // Preserve the original eleven columns. Only extend an exact known layout.
    EM.SYNC_HEADERS.forEach((name,i)=>{
      if(headers[i]!==name && !(i>=11 && headers[i]==='')) throw new Error('Evidence Map Sync header mismatch at column '+(i+1));
      if(i>=11 && headers[i]==='' && sh.getLastRow()>1 && sh.getRange(2,i+1,sh.getLastRow()-1,1).getValues().some(r=>r[0]!==''))
        throw new Error('Evidence Map Sync extension column is already in use: '+(i+1));
    });
    EM.SYNC_HEADERS.slice(11).forEach((name,j)=>{
      if(headers[j+11]==='') sh.getRange(1,j+12).setValue(name).setFontWeight('bold').setBackground('#153140').setFontColor('#ffffff');
    });
  }
  return sh;
}
function emSyncIndex_(sh){ const idx={}; if(sh.getLastRow()<2) return idx;
  const v=sh.getRange(2,1,sh.getLastRow()-1,EM.SYNC_HEADERS.length).getValues();
  v.forEach((r,i)=>{ idx[r[0]]={row:i+2,status:r[6],attempts:Number(r[7])||0,record_id:r[9],revision_id:r[11],source_revision:r[12]}; }); return idx; }

function emValidReceipt_(ev,r){
  return !!r && r.ok===true && r.record_id===ev.event_id && /^[a-f0-9]{64}$/.test(String(r.revision_id||''));
}
function emAlreadyConfirmed_(ev,entry){
  return !!entry && entry.status==='ok' && Number(entry.source_revision)===ev.source_revision &&
    emValidReceipt_(ev,{ok:true,record_id:entry.record_id,revision_id:entry.revision_id});
}

function emPost_(events){
  const res=UrlFetchApp.fetch(emProp_(EM.PROPS.url), { method:'post', contentType:'application/json', muteHttpExceptions:true,
    headers:{ Authorization:'Bearer '+emProp_(EM.PROPS.secret) }, payload: JSON.stringify({ events: events }) });
  const code=res.getResponseCode(); let body={}; try{ body=JSON.parse(res.getContentText()); }catch(e){}
  if(code<200||code>=300) throw new Error('ingest HTTP '+code+' '+res.getContentText().slice(0,200));
  return body.results || {};
}
function emReceipts_(sh, idx, events, results){
  const now=new Date();
  events.forEach(ev=>{ const r=(results||{})[ev.event_id]||{}; const valid=emValidReceipt_(ev,r); const status=valid?'ok':'pending';
    const attempts=(idx[ev.event_id] ? (idx[ev.event_id].attempts||0) : 0)+1;
    const error=valid?'':String(r.error||'Missing or mismatched Evidence Map revision receipt').slice(0,300);
    const rowData=[ev.event_id,ev.source_form_id,ev.source_response_id,ev.canonical_id,ev.stream,ev.learner_id,status,attempts,now,valid?r.record_id:'',error,valid?r.revision_id:'',ev.source_revision];
    let row=idx[ev.event_id] && idx[ev.event_id].row;
    if(row) sh.getRange(row,1,1,EM.SYNC_HEADERS.length).setValues([rowData]);
    else { sh.appendRow(rowData); row=sh.getLastRow(); }
    idx[ev.event_id]={row:row,status:status,attempts:attempts,record_id:rowData[9],revision_id:rowData[11],source_revision:ev.source_revision};
  });
}

/** HOOK — call immediately after appendEvidence_ appends a row. Best-effort; never throws. */
function emOnEvidenceAppended_(o){
  try{
    if(!emConfigured_()) return;
    const ev=emBuildEvent_(o); if(!ev) return;
    const sh=emSyncSheet_(); const idx=emSyncIndex_(sh);
    if(emAlreadyConfirmed_(ev,idx[ev.event_id])) return;
    let results;
    try{ results=emPost_([ev]); }catch(e){ results={}; results[ev.event_id]={ok:false,error:String(e.message).slice(0,300)}; }
    emReceipts_(sh, idx, [ev], results);
  }catch(e){ /* swallow — a sync problem must never break the form submission */ }
}

function emReadEvidenceLog_(){
  const sh=SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.EVIDENCE);
  if(!sh||sh.getLastRow()<2) return [];
  const vals=sh.getDataRange().getValues(); const h=vals.shift().map(x=>String(x).trim());
  return vals.filter(r=>r.some(v=>v!==''&&v!==null)).map(r=>{ const o={}; h.forEach((k,i)=>o[k]=r[i]); return o; });
}

/** Retry rows without a valid receipt for this source revision. Stable event IDs make replay idempotent. */
function emSyncAll_(force, silent){
  if(!emConfigured_()){ SpreadsheetApp.getUi().alert('Set EVIDENCE_MAP_INGEST_URL, EVIDENCE_MAP_INGEST_SECRET and LEARNER_ID_SECRET in Script Properties first.'); return; }
  const sh=emSyncSheet_(); let idx=emSyncIndex_(sh);
  const events=emReadEvidenceLog_().map(emBuildEvent_).filter(Boolean).filter(ev=> force || !emAlreadyConfirmed_(ev,idx[ev.event_id]));
  let okc=0; const deadline=Date.now()+210000;
  for(let i=0;i<events.length && Date.now()<deadline;i+=EM.BATCH){
    const batch=events.slice(i,i+EM.BATCH); let results;
    try{ results=emPost_(batch); }catch(e){ results={}; batch.forEach(ev=>results[ev.event_id]={ok:false,error:String(e.message).slice(0,300)}); }
    emReceipts_(sh, idx, batch, results);
    okc+=batch.filter(ev=>emValidReceipt_(ev,(results||{})[ev.event_id])).length;
  }
  if(!silent)SpreadsheetApp.getUi().alert('Evidence Map sync: '+okc+'/'+events.length+' events confirmed. Pending rows will retry.');
  return {confirmed:okc,attempted:events.length};
}
function syncPendingEvidenceToEvidenceMap(){ emSyncAll_(); }
function resyncAllEvidenceToEvidenceMap(){ emSyncAll_(true); }

/** §8 — recompute auto_score on Knowledge rows with a blank score, from the forms-spec. Preserves rows. */
function backfillKnowledgeScores(){
  const sh=SpreadsheetApp.getActive().getSheetByName(TS.SHEETS.EVIDENCE);
  if(!sh||sh.getLastRow()<2) return;
  const vals=sh.getDataRange().getValues(); const h=vals[0].map(x=>String(x).trim()); const col=n=>h.indexOf(n);
  let fixed=0;
  for(let i=1;i<vals.length;i++){ const row=vals[i];
    if(String(row[col('evidence_type')]).toLowerCase()!=='knowledge') continue;
    if(String(row[col('auto_score')]).trim()!=='') continue;
    const k=emKnowledge_(row[col('source_form_id')], row[col('canonical_id')], row[col('response_value')]);
    if(k.points_earned!=null){ sh.getRange(i+1, col('auto_score')+1).setValue(k.points_earned+'/'+k.points_possible); fixed++; } }
  SpreadsheetApp.getUi().alert('Backfilled '+fixed+' Knowledge score(s) from forms-spec. Run Resync to push.');
}
