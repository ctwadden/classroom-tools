const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const C=require('../studio-core.js');
const D=JSON.parse(fs.readFileSync(__dirname+'/../outputs/gold-standard-2026/Consolidated_Course_Data.json'));
const sample=JSON.parse(fs.readFileSync(__dirname+'/../help/Student_Claims_Example.json'));
const roster=[{id:'WORKBOOK-TEST-01'},{id:'WORKBOOK-TEST-02'}];
const read=(p,existing=[])=>C.claimPreview(p,D.skills,roster,'MM12',existing);
const change=patch=>({...sample,claims:[{...sample.claims[0],...patch}]});

test('documented combined file accepts multiple students, skills, nullable ratings and optional learned',()=>{
  const before=JSON.stringify(sample),r=read(sample);
  assert.deepEqual(r.errors,[]);assert.equal(r.rows.length,2);assert.equal(r.duplicates,0);
  assert.equal(JSON.stringify(sample),before);assert.notEqual(r.rows[0],sample.claims[0]);
  for(const support of C.SUPPORT)assert.deepEqual(read(change({support})).errors,[]);
  for(const selfRating of [1,2,3,4,null])assert.deepEqual(read(change({selfRating})).errors,[]);
  assert.deepEqual(read(change({skill:'all-skill-feedback',next:''})).errors,[]);
});
test('roster, course, skill and field types stay strict',()=>{
  for(const patch of [
    {student:'workbook-test-01'},{student:' WORKBOOK-TEST-01'},
    {student:'someone@example.test'},{course:'IBDS'},
    {skill:'mm12-unknown'},{skill:'ibds-skill-sources'},
    {selfRating:0},{selfRating:5},{selfRating:1.5},{selfRating:'3'},{selfRating:undefined},
    {support:'None|Access supports only'},{date:'2026-02-30'},
    {note:' '},{artifact:''},{attempt:''},{next:undefined},{learned:null},{note:'x'.repeat(50001)}
  ])assert.ok(read(change(patch)).errors.length,JSON.stringify(patch));
});
test('envelope, bounded batches, dangerous keys and duplicate IDs are rejected',()=>{
  for(const p of [null,[],{...sample,app:'other'},{...sample,schema:'1'},
    {...sample,claims:[null]},{...sample,claims:[sample.claims[0],sample.claims[0]]},
    {...sample,claims:Array.from({length:2001},(_,i)=>({...sample.claims[0],id:String(i)}))},
    JSON.parse(JSON.stringify(sample).replace('"schema":1','"schema":1,"__proto__":{}'))
  ])assert.ok(read(p).errors.length);
  assert.deepEqual(read({...sample,claims:[]}).errors,[]);
  assert.deepEqual(read({...sample,claims:Array.from({length:2000},(_,i)=>({...sample.claims[0],id:String(i)}))}).errors,[]);
});
test('existing IDs are skipped globally without mutating prior records; mixed batches retain only new rows',()=>{
  const old=[{claimId:sample.claims[0].id,course:'IBDS',student:'another-student'}],before=JSON.stringify(old);
  const r=read(sample,old);assert.equal(r.duplicates,1);assert.deepEqual(r.rows,[sample.claims[1]]);
  assert.equal(JSON.stringify(old),before);
  assert.ok(read(change({student:'wrong'}),old).errors.length);
});
