const crypto=require('node:crypto');
const Policy=require('../../../module-policy.js');
const Plan=require('../../../outputs/connected-course-map-2026-09-23/Course_Map.json');
const schema='learning-studio.module-controls.v1';
const clone=x=>JSON.parse(JSON.stringify(x));
function targets(catalogue,course){
 const sprints=Plan.sprints.filter(s=>s.course===course).map(s=>({type:'sprint',id:s.id,title:s.title,sprint_id:s.id,project_id:null}));
 const projects=new Map();
 for(const s of catalogue.assignment_links.sprints.filter(s=>s.sprint_id.startsWith(course.toLowerCase()+'-')))
  for(const p of s.projects||[])if(!projects.has(p.project_id))projects.set(p.project_id,{type:'project',id:p.project_id,title:p.title,sprint_id:s.sprint_id,project_id:p.project_id});
 for(const p of catalogue.assignment_links.additional_projects||[])if(p.course_id===course&&!projects.has(p.project_id))projects.set(p.project_id,{type:'project',id:p.project_id,title:p.title,sprint_id:p.sprint_id||null,project_id:p.project_id});
 return sprints.concat([...projects.values()]);
}
async function read(store,course,records){
 const revisions=await records(store,'module-controls/'+course+'/');
 const parentIds=new Set(revisions.flatMap(r=>r.parents||[]));
 const heads=revisions.filter(r=>!parentIds.has(r.revision_id)).sort((a,b)=>a.revision_id.localeCompare(b.revision_id));
 const current=heads.at(-1)||{schema,course_id:course,groups:[],rules:[]};
 return {...clone(current),revision_ids:heads.map(r=>r.revision_id),conflict:heads.length>1,branches:heads.length>1?heads:[]};
}
function normalise(input,course,roster,catalogue,fail){
 if(!Array.isArray(input.groups)||input.groups.length>100||!Array.isArray(input.rules)||input.rules.length>2000)fail('Invalid module settings');
 const active=new Set((roster?.learners||[]).filter(l=>l.active).map(l=>l.learner_id));
 const id=x=>{if(typeof x!=='string'||!/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,179}$/.test(x))fail('Invalid setting identifier');return x;};
 const unique=(xs,label)=>{if(new Set(xs).size!==xs.length)fail('Duplicate '+label);};
 const groups=input.groups.map(g=>{
  id(g.id);if(typeof g.name!=='string'||!g.name.trim()||g.name.length>100)fail('Name the group');
  if(!Array.isArray(g.members)||!g.members.length||g.members.some(m=>!active.has(m)))fail('Choose active students from this class');unique(g.members,'group members');
  return {id:g.id,name:g.name.trim(),members:[...g.members].sort()};
 });unique(groups.map(g=>g.id),'groups');
 const groupIds=new Set(groups.map(g=>g.id)),known=new Set(targets(catalogue,course).map(t=>t.type+':'+t.id));
 const rules=input.rules.map(r=>{
  if(!known.has(r.target_type+':'+r.target_id))fail('Choose a registered unit or project in this course');
  if(!['class','group','student'].includes(r.audience_type))fail('Choose class, group or student');
  if(r.audience_type==='class'&&r.audience_id!==course||r.audience_type==='group'&&!groupIds.has(r.audience_id)||r.audience_type==='student'&&!active.has(r.audience_id))fail('Audience does not belong to this class');
  if(!['open','hidden','closed'].includes(r.state)||typeof r.required!=='boolean')fail('Invalid availability or requirement');
  return {id:id(r.id),target_type:r.target_type,target_id:id(r.target_id),audience_type:r.audience_type,audience_id:id(r.audience_id),state:r.state,required:r.state==='open'&&r.required};
 });unique(rules.map(r=>r.id),'rules');unique(rules.map(r=>[r.target_type,r.target_id,r.audience_type,r.audience_id].join('|')),'audience settings');
 return {schema,course_id:course,groups,rules};
}
async function save(store,course,input,roster,catalogue,records,fail,now){
 const current=await read(store,course,records),parents=current.revision_ids;
 if(!Array.isArray(input.base_revisions)||JSON.stringify([...input.base_revisions].sort())!==JSON.stringify(parents))fail('Settings changed elsewhere. Reload before saving; nothing was overwritten.',409);
 if(current.conflict&&input.resolve_conflict!==true)fail('Review the concurrent settings before resolving them.',409);
 const config=normalise(input,course,roster,catalogue,fail);
 const revision={...config,parents,updated_at:new Date(now()).toISOString(),change_id:crypto.randomUUID()};
 revision.revision_id=crypto.createHash('sha256').update(JSON.stringify(revision)).digest('hex');
 await store.setJSON('module-controls/'+course+'/'+revision.revision_id,revision);
 return read(store,course,records);
}
function effective(config,target,learnerId){return config.conflict?{state:'hidden',required:false,source:'conflict',rule_ids:[],overlap:true}:Policy.resolve(config,{sprint_id:target.sprint_id,project_id:target.project_id},learnerId);}
module.exports={targets,read,save,effective,normalise};
