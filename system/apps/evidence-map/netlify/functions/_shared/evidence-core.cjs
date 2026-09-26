const crypto = require('node:crypto');
const catalogue = require('../../../connected-catalogue.json');
const { rubricReadiness } = require('./rubric-rules.cjs');
const Profile = require('../../../learning-profile.js');
const STREAMS = new Set(['knowledge','evidence','reflection','transfer','support']);
const BANDS = ['IE','Beginning','Developing','Secure','Extending'];
const SUPPORT = ['Guided','Supported','Independent','Transfer'];
const fail = (message, status=400) => { const e=new Error(message); e.status=status; throw e; };
const str = (v,max=4000) => { if(v==null)return ''; if(typeof v!=='string')fail('Expected text'); if(v.length>max)fail('Text exceeds limit');return v.trim(); };
const id = v => { const s=str(v,140); if(!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(s))fail('Invalid or missing ID'); return s; };
const course = v => { const c=v==='CT11'?'COM11':v;if(!['MM12','COM11','IBDS'].includes(c))fail('Unknown course');return c; };
const bool = v => v === true || v === 'true' || v === 'TRUE';
const list = v => Array.isArray(v)?v:typeof v==='string'?v.split(/[;,]/).map(s=>s.trim()).filter(Boolean):[];
const stable = x => JSON.stringify(x, function(k,v){return v&&typeof v==='object'&&!Array.isArray(v)?Object.keys(v).sort().reduce((a,k)=>(a[k]=v[k],a),{}):v;});
const hash = x => crypto.createHash('sha256').update(stable(x)).digest('hex');
function outcome(token,c) {
  const t=String(token||'').trim().replace(/\s+/g,'-').toUpperCase().replace(/^CT11-/,'COM11-').replace(/^(COM11-\d+)\.(\d+)$/,'$1-$2');
  return catalogue.outcomes.find(o=>(!c||o.course_id===c)&&[o.outcome_id,o.outcome_code,o.ps_outcome_code,...(o.aliases||[])].some(a=>String(a).toUpperCase()===t));
}
function normOutcomes(raw,c) { return list(raw).map(t=>{const o=outcome(t,c); return {raw:t,outcome_code:o?o.outcome_code:t,outcome_id:o?o.outcome_id:null};}); }
function bandOf(raw){const s=String(raw||'').trim();if(BANDS.includes(s))return s==='IE'?null:s; const m=s.match(/^(IE|[1-4])(?:\b|\s*-)/i);return m?({IE:null,1:'Beginning',2:'Developing',3:'Secure',4:'Extending'})[m[1].toUpperCase()]:null;}
function supportOf(raw){const s=String(raw||'').trim().toLowerCase();return SUPPORT.find(x=>x.toLowerCase()===s)||({'significant support':'Guided','prompts / checkpoints':'Supported','prompts/checkpoints':'Supported','adapted / transferred':'Transfer','adapted/transferred':'Transfer'})[s]||null;}
function methods(raw){const s=String(raw||'').toLowerCase();return ['Observation','Conversation','Product'].filter(m=>s.includes(m.toLowerCase()));}
// Shared workbook checkpoints may name outcomes from several courses. Retain the
// template references, but only assess outcomes belonging to this event's course.
function scopeEventToCourse(e){
  const current=[],other=[];
  for(const reference of [...(e.outcomes||[]),...(e.other_course_outcomes||[])]){
    const hit=outcome(reference.raw||reference.outcome_code||reference.outcome_id);
    const mapped={...reference,outcome_id:hit?hit.outcome_id:null,outcome_code:hit?hit.outcome_code:reference.outcome_code};
    if(hit&&hit.course_id!==e.course_id)other.push({...mapped,course_id:hit.course_id});else current.push(mapped);
  }
  return {...e,outcomes:current,other_course_outcomes:other,mapping_status:current.some(o=>!o.outcome_id)?'needs_mapping':current.length?'mapped':'unlinked'};
}
function normalizeEvent(e,source='google') {
  if(!e||!STREAMS.has(e.stream))fail('Unknown evidence stream');
  const c=course(e.course_id); const revision=Number(e.source_revision||1);
  if(!Number.isInteger(revision)||revision<1)fail('Invalid source revision');
  const os=normOutcomes(e.outcome_ids||e.outcome_codes_raw,c);
  const record={schema_version:'1.0',event_id:id(e.event_id),source_revision:revision,stream:e.stream,
    learner_id:id(e.learner_id),course_id:c,project_id:id(e.project_id),canonical_id:id(e.canonical_id),
    step_id:str(e.step_id,140),rubric_id:str(e.rubric_id,140),rubric_version:str(e.rubric_version,80),
    criterion_id:str(e.criterion_id,140),tutorial_skill_ids:list(e.tutorial_skill_ids).map(id),outcomes:os,
    mapping_status:os.some(o=>!o.outcome_id)?'needs_mapping':'mapped',
    evidence_type_raw:str(e.evidence_type_raw,80),methods:methods(e.evidence_type_raw),
    response_value:str(e.response_value,12000),teacher_note:str(e.teacher_note,12000),
    // A Form's assertion is provenance, not an authenticated teacher decision.
    teacher_verified:false,source_teacher_claim:bool(e.teacher_verified),source,
    source_form_id:str(e.source_form_id,140),source_response_id:str(e.source_response_id,180),
    timestamp:str(e.timestamp,80),level_raw:str(e.level_raw,100),band:e.stream==='evidence'?bandOf(e.level_raw):null,
    artifact_url:str(e.artifact_url,1800),support_signal:e.independence_raw?{raw:str(e.independence_raw,160),band:supportOf(e.independence_raw),confirmed:false}:null};
  // Optional additions never change the revision hash of historical Form events.
  if(e.support_detail){
    if(e.stream!=='support')fail('Dimension support must use the separate support stream');
    const d=e.support_detail;
    if(!Profile.dimensions[d.dimension_id]||!Number.isInteger(d.level)||d.level<1||d.level>4)fail('Choose a support dimension and level 1–4');
    if(!Profile.results.includes(d.result))fail('Record whether the support helped');
    record.support_detail={dimension_id:d.dimension_id,level:d.level,context:str(d.context,240),barrier:str(d.barrier,1000),strategy:str(d.strategy,1000),result:d.result,next_action:str(d.next_action,1000)};
    if(!record.support_detail.context||!record.support_detail.strategy)fail('Record the task context and strategy used');
    record.support_signal={raw:String(d.level),band:Profile.levels[d.level-1],confirmed:source==='field'};
  }
  for(const key of ['assessment_session_id','voice_note_id','comment_draft_id']) if(e[key])record[key]=id(e[key]);
  if(e.transcript_text){
    if(source==='field'&&!bool(e.transcript_reviewed))fail('Review the transcript before attaching it to evidence');
    record.transcript_text=str(e.transcript_text,12000);
  }
  if(e.transcript_reviewed!=null&&e.transcript_reviewed!=='')record.transcript_reviewed=bool(e.transcript_reviewed);
  if(!record.timestamp||!Number.isFinite(Date.parse(record.timestamp)))fail('A valid timestamp is required');
  if(record.artifact_url&&!/^https:\/\//i.test(record.artifact_url))fail('Artifact links must use HTTPS');
  if(e.stream==='knowledge') {
    record.is_correct=typeof e.is_correct==='boolean'?e.is_correct:null;
    record.points_earned=e.points_earned==null?null:Number(e.points_earned);
    record.points_possible=e.points_possible==null?null:Number(e.points_possible);
    if(record.points_earned!==null&&(!Number.isFinite(record.points_earned)||!Number.isFinite(record.points_possible)||record.points_possible<=0||record.points_earned<0||record.points_earned>record.points_possible))fail('Invalid knowledge score');
  }
  // Keep the source-normalization hash stable when improving derived course views.
  record.revision_id=hash(record);return scopeEventToCourse(record);
}
function eventHeads(rows){
  const groups=new Map(); for(const r of rows){const k=r.event_id;if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  return [...groups.values()].map(rs=>{const n=Math.max(...rs.map(r=>r.source_revision||1));const heads=rs.filter(r=>(r.source_revision||1)===n);const unique=[...new Map(heads.map(r=>[r.revision_id||hash(r),r])).values()];return {...unique[0],conflict:unique.length>1};});
}
function reviewHeads(rows){const parents=new Set(rows.flatMap(r=>r.parents||[]));return rows.filter(r=>!parents.has(r.revision_id));}
function progress(rows){
  const groups=new Map(); for(const r of rows){const k=[r.course_id,r.learner_id,r.outcome_id].join('/');if(!groups.has(k))groups.set(k,[]);groups.get(k).push(r);}
  return [...groups.values()].map(rs=>{const heads=reviewHeads(rs);const r=heads[0];return {course_id:r.course_id,learner_id:r.learner_id,outcome_id:r.outcome_id,outcome_code:r.outcome_code,ps_outcome_code:r.ps_outcome_code,
    achievement:heads.length===1?r.achievement:null,support:heads.length===1?r.support:null,comment:heads.length===1?r.comment:'',evidence_ids:heads.length===1?r.evidence_ids:[],updated_at:r.reviewed_at,reviewer:r.reviewer,
    status:heads.length===1?'teacher_confirmed':'conflict',revision_ids:heads.map(h=>h.revision_id),reporting:'standards_teacher_comments'};});
}
function normalizeReview(input,rows,events,reviewer){
  const c=course(input.course_id), learner=id(input.learner_id), o=outcome(input.outcome_id,c);if(!o)fail('Unknown outcome for course');
  if(!BANDS.includes(input.achievement))fail('Select an achievement band or IE');
  if(input.support!=null&&!SUPPORT.includes(input.support))fail('Unknown support context');
  const ids=list(input.evidence_ids).map(id);if(input.achievement!=='IE'&&!ids.length)fail('Select supporting evidence');
  for(const eid of ids){const e=events.find(e=>e.event_id===eid);if(!e||e.conflict||e.learner_id!==learner||e.course_id!==c||!['evidence','transfer'].includes(e.stream)||!e.outcomes.some(x=>x.outcome_id===o.outcome_id))fail('Evidence must belong to this learner, course and outcome and be an observation, conversation, product or reviewed transfer');}
  const parents=list(input.parents).map(id).sort();const current=reviewHeads(rows).map(r=>r.revision_id).sort();
  if(stable(parents)!==stable(current))fail('This outcome changed on another device. Reload and review all current decisions.',409);
  const r={schema_version:'1.0',review_id:id(input.review_id),course_id:c,learner_id:learner,outcome_id:o.outcome_id,outcome_code:o.outcome_code,ps_outcome_code:o.ps_outcome_code,
    achievement:input.achievement,support:input.support||null,comment:str(input.comment,3000),rationale:str(input.rationale,3000),evidence_ids:ids.sort(),parents,reviewer};
  if(!r.rationale)fail('Record a brief reason for the outcome judgment');r.revision_id=hash(r);return r;
}
function normalizeRubric(input){
  const c=course(input.course||input.course_id);
  if(input.confirmed!==true)fail('Review all criteria and explicitly confirm this release');
  if(!Array.isArray(input.criteria)||!input.criteria.length||input.criteria.length>30)fail('A rubric needs 1–30 criteria');
  const r={id:id(input.id),course:c,project_id:id(input.project_id),title:str(input.title,240),bands:BANDS.slice(1),criteria:input.criteria.map(x=>{
    const descriptors={};for(const band of BANDS.slice(1)){descriptors[band]=str(x.descriptors?.[band],1800);if(!descriptors[band])fail('Complete all four performance descriptors');}
    const codes=list(x.outcome_codes).map(code=>outcome(code,c)||outcome(c+'-'+code,c));if(!codes.length||codes.some(o=>!o))fail('Each criterion needs official outcomes belonging to this course');
    const criterion={id:id(x.id),name:str(x.name,240),outcome_codes:[...new Set(codes.map(o=>o.outcome_code))],descriptors,collection:str(x.collection,1800),skill_ids:list(x.skill_ids).map(id),mapping_ready:true};
    if(!criterion.name)fail('Name each criterion');
    return criterion;
  }),status:'approved',capture_ready:true,support_rule:'Support is recorded separately and does not cap achievement.',powerschool:'Teacher confirms outcome judgments and reporting comments in Evidence Map.'};
  if(!r.title)fail('Name the assignment');
  const readiness=rubricReadiness(r,catalogue);if(!readiness.review_ready)fail(readiness.readiness_issues.join(' '));
  if(new Set(r.criteria.map(x=>x.id)).size!==r.criteria.length)fail('Criterion IDs must be unique');
  if(catalogue.rubrics.some(x=>x.id===r.id))fail('Duplicate and adapt a catalogue rubric under a new ID');
  // Content-addressed versions prevent concurrent releases overwriting one another.
  r.version='v1.'+hash(r).slice(0,24);return r;
}
function applyFilters(rows,f){return rows.filter(r=>(!f.learner_id||r.learner_id===f.learner_id)&&(!f.course_id||r.course_id===f.course_id)&&(!f.project_id||r.project_id===f.project_id)&&(!f.stream||r.stream===f.stream)&&(!f.outcome_id||r.outcomes?.some(o=>o.outcome_id===f.outcome_id))&&(!f.outcome_code||r.outcomes?.some(o=>o.outcome_code===f.outcome_code))&&(!f.from||String(r.timestamp||r.received_at).slice(0,10)>=f.from)&&(!f.to||String(r.timestamp||r.received_at).slice(0,10)<=f.to));}
module.exports={catalogue,rubricReadiness,STREAMS,BANDS,SUPPORT,fail,str,id,course,bool,stable,hash,outcome,normOutcomes,bandOf,supportOf,methods,normalizeEvent,normalizeRubric,scopeEventToCourse,eventHeads,reviewHeads,progress,normalizeReview,applyFilters};
