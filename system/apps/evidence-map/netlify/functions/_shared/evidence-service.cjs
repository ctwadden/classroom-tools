const crypto = require('node:crypto');
const C = require('./evidence-core.cjs');
const equal = (a,b) => typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
function deploymentEnv(hostname,read){
  const production=hostname==='outcome-evidence-map.netlify.app';
  return name=>name==='CONTEXT'?(production?'production':'deploy-preview'):
    !production&&name==='DEPLOY_ID'?hostname.split('--')[0].replace(/[^a-zA-Z0-9-]/g,'-'):
    read(!production&&/^EVIDENCE_MAP_(INGEST|READ|TEACHER)_SECRET$/.test(name)?name.replace('EVIDENCE_MAP_','EVIDENCE_MAP_PREVIEW_'):name);
}
function openStore(env,name,getStore) {
  // Previews use a separate store; live student records never become test fixtures.
  const context=env('CONTEXT');const suffix=context&&context!=='production'?'-preview-'+(env('DEPLOY_ID')||'local'):'';
  const options={name:name+suffix,consistency:'strong'};
  const token=env('NETLIFY_BLOBS_TOKEN')||env('NETLIFY_API_TOKEN');
  if(token){options.siteID=env('SITE_ID')||env('NETLIFY_SITE_ID')||'e2fe77c9-f0e4-406f-9c4a-fb3b6d359a64';options.token=token;}
  return getStore(options);
}
function signedSession(secret,expires){const body=Buffer.from(JSON.stringify({expires})).toString('base64url');return body+'.'+crypto.createHmac('sha256',secret).update(body).digest('base64url');}
function sessionOK(req,secret){
  if(!secret)return false;const cookie=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('em_teacher='));if(!cookie)return false;
  try{const token=cookie.slice(11),[body]=token.split('.'),p=JSON.parse(Buffer.from(body,'base64url').toString());return p.expires>Date.now()&&equal(token,signedSession(secret,p.expires));}catch{return false;}
}
function sessionExpiry(req,secret){
  if(!sessionOK(req,secret))return null;
  const cookie=(req.headers.get('cookie')||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('em_teacher='));
  return JSON.parse(Buffer.from(cookie.slice(11).split('.')[0],'base64url').toString()).expires;
}
function role(req,env){
  const auth=req.headers.get('authorization')||'';
  for(const [name,key] of [['teacher','EVIDENCE_MAP_TEACHER_SECRET'],['google','EVIDENCE_MAP_INGEST_SECRET'],['reader','EVIDENCE_MAP_READ_SECRET']])if(env(key)&&equal(auth,'Bearer '+env(key)))return name;
  return sessionOK(req,env('EVIDENCE_MAP_TEACHER_SECRET'))?'teacher':null;
}
async function records(store,prefix){const result=await store.list({prefix});const out=[];const keys=(result.blobs||[]).map(b=>b.key);for(let i=0;i<keys.length;i+=25)out.push(...await Promise.all(keys.slice(i,i+25).map(k=>store.get(k,{type:'json'}))));return out.filter(Boolean);}
async function eventsFor(store,legacy,c){
  const current=await records(store,'events/'+c+'/');
  const refs=await records(legacy,'idx/'+c+'/');const old=[];
  for(let i=0;i<refs.length;i+=25)old.push(...await Promise.all(refs.slice(i,i+25).map(r=>legacy.get(r.event_id,{type:'json'}))));
  const known=new Set(current.map(e=>e.event_id));
  for(const e of old.filter(Boolean)){if(known.has(e.event_id))continue;oldEvent(e);current.push(e);}
  return C.eventHeads(current).map(C.scopeEventToCourse);
}
function oldEvent(e){e.source_teacher_claim=C.bool(e.teacher_verified);e.teacher_verified=false;e.source='google_legacy';e.methods=C.methods(e.evidence_type_raw);e.outcomes=(e.outcomes||[]).map(o=>{const hit=C.outcome(o.outcome_code||o.outcome_id,e.course_id);return {...o,outcome_id:hit?hit.outcome_id:null};});e.mapping_status=e.outcomes.some(o=>!o.outcome_id)?'needs_mapping':'mapped';return e;}
async function ingest(store,items,source){
  if(!Array.isArray(items)||!items.length||items.length>100)C.fail('Send 1–100 events per request');
  const results={};
  for(const input of items){let name=String(input?.event_id||'invalid');try{const r=C.normalizeEvent(input,source);const key=`events/${r.course_id}/${r.learner_id}/${r.event_id}/${r.revision_id}`;
    const existing=await store.get(key,{type:'json'});if(!existing)await store.setJSON(key,{...r,received_at:new Date().toISOString()});
    results[name]={ok:true,record_id:r.event_id,revision_id:r.revision_id,dedup:!!existing,mapping_status:r.mapping_status};
  }catch(e){results[name]={ok:false,error:e.message};}}
  return {results};
}
function makeService({env,store,legacy,now=()=>Date.now()}) {
  const presentRubrics = rows => rows.map(r => ({...r,...C.rubricReadiness(r,C.catalogue)}));
  const json=(x,status=200,headers={})=>new Response(JSON.stringify(x),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
  return async function handle(req){
    try {
      const url=new URL(req.url),action=url.searchParams.get('action')||'snapshot',actor=role(req,env);
      if(!['GET','POST'].includes(req.method))return json({error:'Method not allowed'},405);
      if(req.method==='POST'&&req.headers.get('origin')&&req.headers.get('origin')!==url.origin)return json({error:'Same-origin connection required'},403);
      let body={};if(req.method==='POST'){const raw=await req.text();if(raw.length>1500000)C.fail('Request too large',413);try{body=JSON.parse(raw);}catch{C.fail('Invalid JSON');}}
      if(action==='login'&&req.method==='POST'){
        const secret=env('EVIDENCE_MAP_TEACHER_SECRET');if(!secret)return json({error:'Teacher access is not configured'},503);
        if(!equal(body.access_key,secret))return json({error:'Invalid teacher access key'},401);
        return json({ok:true,role:'teacher'},200,{'Set-Cookie':`em_teacher=${signedSession(secret,now()+4*3600000)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=14400`});
      }
      if(action==='logout')return json({ok:true},200,{'Set-Cookie':'em_teacher=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0'});
      if(!actor)return json({error:'Teacher sign-in required'},401);
      if(action==='status')return json({schema_version:'1.0',role:actor,plan_version:C.catalogue.plan_version,reporting:'standards_teacher_comments',expires_at:sessionExpiry(req,env('EVIDENCE_MAP_TEACHER_SECRET'))});
      if(action==='field-events'&&req.method==='GET'){
        if(actor!=='google')C.fail('Google integration role required',403);
        const c=C.course(url.searchParams.get('course_id')),limit=Number(url.searchParams.get('limit')||100),cursor=url.searchParams.get('cursor')||'';
        if(!Number.isInteger(limit)||limit<1||limit>500)C.fail('Page limit must be 1–500');
        const all=(await eventsFor(store,legacy,c)).filter(e=>e.source==='field').sort((a,b)=>a.event_id.localeCompare(b.event_id));
        const position=cursor?all.findIndex(e=>e.event_id===cursor):-1;
        if(cursor&&position<0)C.fail('Field cursor changed. Restart the mirror safely.',409);
        const page=all.slice(position+1,position+1+limit),more=position+1+limit<all.length;
        return json({schema_version:'1.0',course_id:c,events:page,has_more:more,next_cursor:more?page.at(-1).event_id:null,total_field_events:all.length,generated_at:new Date(now()).toISOString()});
      }
      if(action==='rubrics'&&req.method==='GET'){
        if(!['google','teacher'].includes(actor))C.fail('Teacher or Google integration access required',403);
        const c=C.course(url.searchParams.get('course_id'));return json({course_id:c,rubrics:presentRubrics(await records(store,'rubrics/'+c+'/'))});
      }
      if(action==='rubric-publish'&&req.method==='POST'){
        if(actor!=='teacher')C.fail('Teacher access required',403);
        const r=C.normalizeRubric(body),key=`rubrics/${r.course}/${r.id}/${r.version}`;
        const existing=await store.get(key,{type:'json'});if(existing)return json({ok:true,rubric:existing,dedup:true});
        const published={...r,approved_at:new Date(now()).toISOString()};await store.setJSON(key,published);return json({ok:true,rubric:published});
      }
      if(action==='mirror-status'&&req.method==='POST'){
        if(actor!=='google')C.fail('Google integration role required',403);
        const c=C.course(body.course_id);if(!Array.isArray(body.receipts)||body.receipts.length>500)C.fail('Invalid mirror receipts');
        for(const r of body.receipts)await store.setJSON(`mirror/${c}/${C.id(r.event_id)}`,{event_id:C.id(r.event_id),revision_id:C.id(r.revision_id),mirrored_at:new Date(now()).toISOString()});
        return json({ok:true,count:body.receipts.length});
      }
      if(action==='mirror-status'&&req.method==='GET'){
        if(actor!=='teacher')C.fail('Teacher access required',403);
        const c=C.course(url.searchParams.get('course_id'));return json({course_id:c,receipts:await records(store,'mirror/'+c+'/')});
      }
      if(action==='support-checkin'&&req.method==='POST'){
        if(actor!=='teacher')C.fail('Teacher access required',403);
        const e=body.event||{},c=C.course(e.course_id);
        const roster=await store.get('roster/'+c,{type:'json'});
        if(!roster?.learners.some(l=>l.learner_id===e.learner_id&&l.active))C.fail('Choose an active learner from this course roster');
        const projects=C.catalogue.assignment_links.sprints.filter(s=>s.sprint_id.startsWith(c.toLowerCase()+'-')).flatMap(s=>s.projects||[]);
        if(!projects.some(p=>p.project_id===e.project_id))C.fail('Choose an assignment registered for this course');
        if(!C.catalogue.project_steps?.[e.project_id]?.some(s=>s.step_id===e.step_id))C.fail('Choose a registered step for this assignment');
        if(e.stream!=='support'||!e.support_detail||e.canonical_id!==e.support_detail.dimension_id)C.fail('Record a separate dimension support check-in');
        if(e.level_raw||e.rubric_id||e.criterion_id||e.outcome_ids?.length||e.outcome_codes_raw||e.tutorial_skill_ids?.length)C.fail('A support check-in cannot assign achievement or competency');
        return json(await ingest(store,[e],'field'));
      }
      if(action==='events'&&req.method==='POST'){
        if(actor!=='google'&&actor!=='teacher')C.fail('Write access required',403);
        if(!Array.isArray(body.events)||!body.events.length||body.events.length>100)C.fail('Send 1–100 events per request');
        if(actor==='teacher')for(const e of body.events){
          const releases=await records(store,'rubrics/');const rubric=releases.find(r=>r.id===e.rubric_id&&r.version===e.rubric_version);
          if(!rubric||rubric.status!=='approved')C.fail('Download and select an approved rubric version before field capture');
          const roster=await store.get('roster/'+C.course(e.course_id),{type:'json'});
          if(!roster?.learners.some(l=>l.learner_id===e.learner_id&&l.active))C.fail('Choose an active learner from this course roster');
          if(e.project_id!==rubric.project_id)C.fail('Capture project must match its approved rubric');
          if(e.stream!=='evidence'||!C.methods(e.evidence_type_raw).length)C.fail('Choose Observation, Conversation or Product evidence');
          const criterion=rubric.criteria.find(c=>c.id===e.criterion_id);
          if(rubric.course!==e.course_id||!criterion)C.fail('Unknown rubric criterion for course');
          if(!C.rubricReadiness(rubric,C.catalogue).review_ready)C.fail('This rubric needs complete skill and evidence mappings before new capture');
          if(!Array.isArray(e.tutorial_skill_ids)||!e.tutorial_skill_ids.length||e.tutorial_skill_ids.some(s=>!criterion.skill_ids.includes(s)))C.fail('Capture skills must match the selected rubric criterion');
          const codes=(criterion.outcome_codes||[]).map(code=>C.outcome(code,e.course_id)||C.outcome(e.course_id+'-'+code,e.course_id));
          if(!codes.length||codes.some(o=>!o))C.fail('Rubric outcome mapping needs review');
          const submitted=C.normOutcomes(e.outcome_ids||e.outcome_codes_raw,e.course_id);
          if(!submitted.length||submitted.some(o=>!codes.some(c=>c.outcome_id===o.outcome_id)))C.fail('Capture outcomes must match the selected rubric criterion');
        }
        return json(await ingest(store,body.events,actor==='google'?'google':'field'));
      }
      if(action==='roster'&&req.method==='POST'){
        if(actor!=='google')C.fail('Google owns the roster',403);
        const c=C.course(body.course_id);if(!Array.isArray(body.learners)||body.learners.length>1000)C.fail('Invalid roster');
        const learners=body.learners.map(l=>({learner_id:C.id(l.learner_id),display_name:C.str(l.display_name,160),active:C.bool(l.active),powerschool_id:C.str(l.powerschool_id,100)}));
        if(new Set(learners.map(l=>l.learner_id)).size!==learners.length)C.fail('Duplicate learner IDs in roster');
        await store.setJSON('roster/'+c,{course_id:c,learners,updated_at:new Date(now()).toISOString(),source:'google'});return json({ok:true,count:learners.length});
      }
      const c=C.course(url.searchParams.get('course_id')||body.course_id);
      if(action==='progress'&&req.method==='GET')return json({schema_version:'1.0',progress:C.progress(await records(store,'reviews/'+c+'/')),source:'evidence_map',generated_at:new Date(now()).toISOString()});
      if(actor==='google')C.fail('Teacher access required',403);
      if(action==='review'&&req.method==='POST'){
        if(actor!=='teacher')C.fail('Teacher access required',403);
        const learner=C.id(body.learner_id),o=C.outcome(body.outcome_id,c);if(!o)C.fail('Unknown outcome');
        const prefix=`reviews/${c}/${learner}/${o.outcome_id}/`,previous=await records(store,prefix);
        const already=previous.find(r=>r.review_id===body.review_id);
        if(already){const a={...body,parents:already.parents};const r=C.normalizeReview(a,previous.filter(p=>already.parents.includes(p.revision_id)),await eventsFor(store,legacy,c),env('EVIDENCE_MAP_TEACHER_LABEL')||'Teacher');if(r.revision_id!==already.revision_id)C.fail('Review ID reused with different content',409);return json({ok:true,revision_id:already.revision_id,dedup:true});}
        const r=C.normalizeReview(body,previous,await eventsFor(store,legacy,c),env('EVIDENCE_MAP_TEACHER_LABEL')||'Teacher');
        await store.setJSON(prefix+r.revision_id,{...r,reviewed_at:new Date(now()).toISOString()});
        // Append-only branches preserve concurrent decisions. A collision is shown for review, never silently overwritten.
        const heads=C.reviewHeads(await records(store,prefix));return json({ok:true,revision_id:r.revision_id,conflict:heads.length>1});
      }
      if(action==='rubric'&&req.method==='POST'){
        if(actor!=='teacher')C.fail('Teacher access required',403);const r=C.catalogue.rubrics.find(r=>r.id===body.rubric_id&&r.course===c);if(!r)C.fail('Unknown rubric');
        if(body.confirmed!==true)C.fail('Review the rubric before approving it');
        if(body.rubric_version!==r.version)C.fail('The rubric version changed. Reload and review the current version.',409);
        const readiness=C.rubricReadiness(r,C.catalogue);if(!readiness.review_ready)C.fail(readiness.readiness_issues.join(' '));
        const approved={...r,status:'approved',capture_ready:true,approved_at:new Date(now()).toISOString()};await store.setJSON(`rubrics/${c}/${r.id}/${r.version}`,approved);return json({ok:true,rubric:approved});
      }
      if(action==='snapshot'&&req.method==='GET'){
        const [events,reviews,roster,rubrics]=await Promise.all([eventsFor(store,legacy,c),records(store,'reviews/'+c+'/'),store.get('roster/'+c,{type:'json'}),records(store,'rubrics/'+c+'/')]);
        const visibleRoster=roster||{learners:[],updated_at:null};
        if(actor!=='teacher')visibleRoster.learners=visibleRoster.learners.map(l=>({learner_id:l.learner_id,active:l.active}));
        return json({schema_version:'1.0',role:actor,course_id:c,events,progress:C.progress(reviews),roster:visibleRoster,rubrics:presentRubrics(rubrics),plan_version:C.catalogue.plan_version,generated_at:new Date(now()).toISOString()});
      }
      C.fail('Unknown action or method',404);
    }catch(e){return json({error:e.status?e.message:'Connection could not complete. Retry; unsent work remains on this device.'},e.status||503);}
  };
}
module.exports={makeService,deploymentEnv,openStore,records,eventsFor,ingest,role,signedSession};
