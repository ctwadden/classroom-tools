// Reuse the audited course plan; do not regenerate dates or invent teaching assets.
const fs = require('node:fs');
const vm = require('node:vm');
const { rubricReadiness } = require('../netlify/functions/_shared/rubric-rules.cjs');
const context = { window: {} }; vm.createContext(context);
vm.runInContext(fs.readFileSync('studio-data.js', 'utf8'), context);
const studio = context.window.STUDIO_DATA;
const plan = JSON.parse(fs.readFileSync('outputs/connected-course-map-2026-09-23/Course_Map.json', 'utf8'));
const original = JSON.parse(fs.readFileSync('OUTCOME_CODE_MAP.json', 'utf8'));
const outcomes = original.rows.map(row => ({ ...row,
  aliases: [row.outcome_id],
  outcome_id: row.course_id === 'MM12' ? 'ns-mm12-2015-' + row.display_code : row.outcome_id
}));
// Use readable planning labels in the dashboard instead of the old cut-off sentences.
// The official codes, aliases and assessment mappings are unchanged.
const visualTitles = {
  '1.1':'Image techniques and editing', '1.2':'Image context and meaning', '1.3':'Image production workflow',
  '1.4':'Art and design principles for images', '1.5':'Communicating through images',
  '2.1':'Motion graphics techniques', '2.2':'Motion graphics context and meaning', '2.3':'Motion graphics production workflow',
  '2.4':'Art and design principles for motion', '2.5':'Communicating through motion graphics'
};
outcomes.forEach(o => { if(o.course_id==='MM12' && visualTitles[o.display_code]) o.outcome_title=visualTitles[o.display_code]; });
// Missing sound/integrated codes are explicit official codes, not positional migrations of old IDs.
const titles = {3:['Sound capture and editing','Sound context and meaning','Sound workflow','Sonic design decisions','Audio message'],4:['Audience and purpose','Multimedia context and meaning','Collaborative production','Individual portfolio','Career pathways']};
for (const m of [3,4]) for(let n=1;n<=5;n++) {
  const code = `${m}.${n}`;
  if (!outcomes.some(o=>o.course_id==='MM12'&&o.display_code===code)) outcomes.push({course_id:'MM12',outcome_id:`ns-mm12-2015-${code}`,outcome_code:`MM12-${code}`,ps_outcome_code:`MM12-${code}`,display_code:code,outcome_title:titles[m][n-1],aliases:[]});
}
['Digital 3D modelling','Orthographic and isometric views','Technical symbols and language'].forEach((title,i)=>{
  const n=i+1;outcomes.push({course_id:'COM11',outcome_id:`communications-technology-11-3-${n}`,outcome_code:`COM11-3-${n}`,ps_outcome_code:`CT11-3-${n}`,display_code:`3.${n}`,outcome_title:title,aliases:[]});
});
outcomes.forEach(o=>{
  o.authority=o.course_id==='IBDS'?'Local capability mapped to IB syllabus; not an IB-issued outcome ID':'Nova Scotia curriculum code; short planning title';
  o.active_in_plan=o.course_id!=='COM11'||[1,2,3,4,6].includes(Number(o.display_code.split('.')[0]));
});
const rubrics = studio.rubrics.map(r => ({...r, version:'legacy-2026-09-13', status:'draft',
  review_note:'Recovered existing rubric. Review terminology, support language and outcome links before approving for field capture.'}));
rubrics.push(...JSON.parse(fs.readFileSync('teaching/connected-rubrics.json','utf8')));
for(const r of rubrics){
  r.title=r.title||`Citrus Rush — ${r.course} recovered rubric`;
  r.original_version=r.version;
  if(r.version.startsWith('legacy'))r.version='2026-09-23-adapted.1';
  r.bands=['Beginning','Developing','Secure','Extending'];
  r.criteria=r.criteria.map(c=>{
    const descriptors={...c.descriptors};
    if(!descriptors.Extending)descriptors.Extending=descriptors.Transferring||descriptors.Transfer;
    delete descriptors.Transferring;delete descriptors.Transfer;
    const tokens=c.outcome_codes||c.outcome_ids||[];
    const mapped=tokens.map(t=>outcomes.find(o=>o.course_id===r.course&&[o.outcome_id,o.outcome_code,o.display_code,...o.aliases].includes(t)));
    return {...c,descriptors,outcome_codes:mapped.map((o,i)=>o?o.outcome_code:tokens[i]),mapping_ready:mapped.length>0&&mapped.every(Boolean)};
  });
}
const result = {schema_version:'1.0', plan_version:plan.plan_version, courses:plan.courses,
  outcomes, rubrics, skills:studio.skills, crosswalk:JSON.parse(fs.readFileSync('SKILL_CROSSWALK.json','utf8')),
  assignment_links:JSON.parse(fs.readFileSync('teaching/assignment-links.json','utf8')),
  project_steps:JSON.parse(fs.readFileSync('teaching/project-steps.json','utf8')),
  course_map_url:'/outputs/connected-course-map-2026-09-23/index.html',
  sprint_counts:{MM12:9,COM11:9,IBDS:16},
  teaching_package_status:'Course sequence is mapped. Existing teaching assets and draft rubrics are retained; full-year lesson packages are not complete.'};
for (const r of rubrics) Object.assign(r, rubricReadiness(r, result));
fs.writeFileSync('connected-catalogue.json',JSON.stringify(result,null,2)+'\n');
fs.writeFileSync('field-app/src/data/connected-catalogue.json',JSON.stringify(result,null,2)+'\n');
console.log(`Connected catalogue: ${outcomes.length} outcomes; ${rubrics.length} recovered draft rubrics; 34 planned sprints.`);
