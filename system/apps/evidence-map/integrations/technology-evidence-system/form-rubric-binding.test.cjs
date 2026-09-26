const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto');
const root=__dirname,spec=require('../../teaching/reviews/Truck_Ad_forms-spec_v2_DRAFT.json'),rubric=require('../../teaching/connected-rubrics.json').find(r=>r.id==='MM12-TRUCK-AD-R1'),approved={...rubric,status:'approved',capture_ready:true},choice=spec.teacher_evidence.criterion_choices[0];
const headers=['timestamp','student_email','student_name','course_id','project_id','canonical_id','evidence_type','skill_ids','outcome_codes','response_value','auto_score','level','independence','teacher_note','teacher_verified','source_form_id','source_response_id'];
function sheet(rows=[headers]){return {rows:structuredClone(rows),getLastRow(){return this.rows.length;},appendRow(r){this.rows.push([...r]);},getRange(row,col,count=1,width=1){const sh=this;return {getValues(){return Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>sh.rows[row+i-1]?.[col+j-1]??''));},setValues(v){v.forEach((r,i)=>r.forEach((x,j)=>{sh.rows[row+i-1]??=[];sh.rows[row+i-1][col+j-1]=x;}));return this;},setValue(v){return this.setValues([[v]]);},setFontWeight(){return this;},setBackground(){return this;},setFontColor(){return this;}};}};}
function setup(sh=sheet()){
 const c=vm.createContext({Date,console,SpreadsheetApp:{getActive:()=>({getSheetByName:()=>sh})}});
 for(const n of ['TechnologyEvidenceMapSync','FormRubricBinding'])vm.runInContext(fs.readFileSync(root+'/'+n+'.gs','utf8'),c);
 vm.runInContext(fs.readFileSync(root+'/bound-project/Code.js','utf8'),c);
 c.sha256_=s=>crypto.createHash('sha256').update(s).digest('hex');c.ecLearnerId_=()=> 'synthetic-learner';c.ecStep_=()=> 'TA-S04';c.ecFetch_=()=>({rubrics:[approved]});c.logError_=()=>{};c.emKnowledge_=()=>({});return c;
}
function source(c,selected=choice){return {timestamp:'2026-09-25T18:00:00Z',student_email:'qa@example.invalid',student_name:'SYNTHETIC QA',course_id:selected.course_id,project_id:spec.project_id,canonical_id:selected.checkpoint_id,evidence_type:'Observation',skill_ids:(selected.skill_ids||[]).join(';'),outcome_codes:(selected.outcome_codes||[]).join(';'),response_value:'Synthetic observation',auto_score:'',level:'3 - Secure',independence:'Supported',teacher_note:'Synthetic check',teacher_verified:true,source_form_id:'synthetic-form',source_response_id:'synthetic-response',rubric_context_json:c.fbContext_(spec,selected)};}
test('all prepared choices use the exact rubric, existing checkpoint IDs and sampled skills',()=>assert.doesNotThrow(()=>setup().fbValidateChoices_(spec,[approved])));
test('draft, missing, wrong-version or incomplete approvals stop before Form creation',()=>{
 for(const r of [[],[rubric],[{...approved,version:'other'}],[{...approved,capture_ready:false}]]){const c=setup();c.ecFetch_=()=>({rubrics:r});let creates=0;c.FormApp={create:()=>{creates++;}};assert.throws(()=>c.buildTeacherForm_({},spec),/approved/);assert.equal(creates,0);}
});
test('unknown or ambiguous mappings fail preflight',()=>{
 for(const patch of [{checkpoint_id:'missing'},{skill_ids:['UNKNOWN']},{outcome_codes:['COM11-4-4']},{criterion_id:'missing'},{choice_label:spec.teacher_evidence.criterion_choices[1].choice_label}]){const s=structuredClone(spec);Object.assign(s.teacher_evidence.criterion_choices[0],patch);assert.throws(()=>setup().fbValidateChoices_(s,[approved]));}
});
test('shared checkpoint requires one explicit criterion in the student course',()=>{
 const c=setup(),choices=spec.teacher_evidence.criterion_choices.filter(x=>x.checkpoint_id==='TA-PRO-02'&&x.course_id==='MM12');assert.equal(choices.length,2);
 assert.notEqual(c.fbSelection_(spec,choices[0].choice_label,'MM12').criterion_id,c.fbSelection_(spec,choices[1].choice_label,'MM12').criterion_id);
 assert.throws(()=>c.fbSelection_(spec,choices[0].choice_label,'COM11'),/course/);assert.throws(()=>c.fbSelection_(spec,'TA-PRO-02 - Final advertisement','MM12'),/course/);
});
test('legacy Forms and COM11 general evidence stay unbound',()=>{
 const c=setup(),legacy=require('../../teaching/Truck_Ad_forms-spec.json');assert.equal(c.fbSelection_(legacy,'TA-OBS-01 - Existing','MM12'),null);
 const general=spec.teacher_evidence.criterion_choices.find(x=>x.course_id==='COM11');assert.equal(c.fbContext_(spec,general),'');assert.equal(c.emBuildEvent_(source(c,general)).source_revision,2);
});
test('teacher routing carries only the selected criterion and its mapped outcomes',()=>{
 const c=setup();c.getProjectByFormId_=()=>({spec});c.getSpreadsheetSubmitTimestamp_=()=> '2026-09-25T18:00:00Z';c.evidenceEventExists_=()=>false;let got;c.appendEvidence_=o=>got=o;
 c.routeTeacherSpreadsheetSubmit_({namedValues:{Student:['SYNTHETIC QA | qa@example.invalid | MM12'],'Evidence checkpoint':[choice.choice_label],'Current evidence level':['3 - Secure'],'Independence observed':['Supported']}},{form_id:'synthetic-form',project_id:spec.project_id},'synthetic-response');
 assert.equal(got.canonical_id,choice.checkpoint_id);assert.equal(JSON.parse(got.rubric_context_json).criterion_id,choice.criterion_id);assert.equal(got.outcome_codes,choice.outcome_codes.join(';'));assert.equal(got.skill_ids,choice.skill_ids.join(';'));
});
test('Sheet storage and dashboard normalization retain context without confirming achievement',()=>{
 const sh=sheet(),c=setup(sh);c.emOnEvidenceAppended_=()=>{};c.appendEvidence_(source(c));assert.equal(sh.rows[0][17],'rubric_context_json');const o={};sh.rows[0].forEach((k,i)=>o[k]=sh.rows[1][i]);const ev=c.emBuildEvent_(o);
 const normalized=require('../../netlify/functions/_shared/evidence-core.cjs').normalizeEvent(JSON.parse(JSON.stringify(ev)),'google');
 for(const k of ['rubric_id','rubric_version','criterion_id'])assert.equal(normalized[k],choice[k]);assert.equal(normalized.teacher_verified,false);assert.equal(ev.source_revision,3);
});
test('replay freezes the first context and does not append duplicates',()=>{
 const sh=sheet(),c=setup(sh);let delivered;c.emOnEvidenceAppended_=o=>delivered=o;c.appendEvidence_(source(c));const original=sh.rows[1][17],altered=source(c);altered.rubric_context_json=original.replace('2026-09-25.2','future');c.appendEvidence_(altered);assert.equal(sh.rows.length,2);assert.equal(sh.rows[1][17],original);assert.equal(delivered.rubric_context_json,original);
});
test('historical rows never acquire a newer rubric on replay',()=>{
 const sh=sheet(),c=setup(sh);let delivered;c.emOnEvidenceAppended_=o=>delivered=o;const old=source(c);delete old.rubric_context_json;c.appendEvidence_(old);c.appendEvidence_(source(c));assert.equal(sh.rows[0].length,17);assert.equal(sh.rows[1].length,17);assert.equal(delivered.rubric_context_json,'');assert.equal(c.emBuildEvent_(delivered).source_revision,2);
});
test('knowledge, reflection, transfer and support cannot carry academic criterion context',()=>{
 const c=setup();for(const type of ['Knowledge','Reflection','Support','Transfer candidate'])assert.throws(()=>c.fbEventContext_({...source(c),evidence_type:type}),/Only teacher/);
});
test('occupied extension columns and mismatched event identities are rejected',()=>{
 const sh=sheet([[...headers,'custom_notes']]),before=JSON.stringify(sh.rows);assert.throws(()=>setup(sh).fbEnsureLogContext_(sh));assert.equal(JSON.stringify(sh.rows),before);
 const c=setup();for(const patch of [{course_id:'COM11'},{project_id:'PS-DROP-DAY'},{canonical_id:'TA-CON-02'}])assert.throws(()=>c.fbEventContext_({...source(c),...patch}),/match/);
});
test('deployable helper copies match source',()=>{for(const n of ['FormRubricBinding','TechnologyEvidenceMapSync'])assert.equal(fs.readFileSync(root+'/'+n+'.gs','utf8'),fs.readFileSync(root+'/bound-project/'+n+'.js','utf8'));});
test('the Form includes the approved descriptors beside the level choice',()=>{
 const c=setup(),text=c.fbGuidance_([approved]);for(const criterion of approved.criteria)for(const band of ['Beginning','Developing','Secure','Extending'])assert.ok(text.includes(criterion.descriptors[band]));assert.ok(text.includes(approved.version));
});
test('pair generation validates approval before creating even the student Form',()=>{
 const c=setup();c.validateSpec_=()=>{};c.ecFetch_=()=>({rubrics:[]});let created=0;c.buildStudentForm_=()=>{created++;};assert.throws(()=>c.generateProjectForms_({},spec),/approved/);assert.equal(created,0);
});
test('release builds into an already restricted unpublished Form without creating another',()=>{
 const c=setup(),items=[];const form={setDescription(){return this;},setProgressBar(){return this;},setConfirmationMessage(){return this;},addListItem(){return item();},addMultipleChoiceItem(){return item();},addParagraphTextItem(){return item();}};
 function item(){const i={setTitle(v){this.title=v;return this;},setChoiceValues(v){this.choices=v;return this;},setRequired(){return this;},setHelpText(v){this.help=v;return this;}};items.push(i);return i;}
 c.FormApp={create:()=>{throw Error('must reuse restricted Form');}};c.getRoster_=()=>[{name:'QA',email:'qa@example.invalid',course:'MM12'}];c.mapItem_=()=>{};c.attachFormDestination_=()=> 'QA responses';
 const result=c.buildTeacherForm_({},spec,form);assert.equal(result.form,form);assert.equal(items.find(i=>i.title==='Evidence checkpoint').choices.length,15);assert.ok(items.find(i=>i.title==='Current evidence level').help.includes(approved.criteria[0].descriptors.Secure));
});
