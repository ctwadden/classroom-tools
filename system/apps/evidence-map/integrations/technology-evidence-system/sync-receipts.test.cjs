const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(__dirname+'/TechnologyEvidenceMapSync.gs','utf8');
function sheet(rows){
  return {rows:structuredClone(rows), getLastRow(){return this.rows.length;},
    appendRow(row){this.rows.push([...row]);},
    getRange(row,col,count=1,width=1){const self=this;return {
      getValues(){return Array.from({length:count},(_,r)=>Array.from({length:width},(_,c)=>self.rows[row+r-1]?.[col+c-1]??''));},
      setValues(values){values.forEach((v,r)=>v.forEach((x,c)=>{self.rows[row+r-1]??=[];self.rows[row+r-1][col+c-1]=x;}));return this;},
      setValue(value){return this.setValues([[value]]);},setFontWeight(){return this;},setBackground(){return this;},setFontColor(){return this;}
    };}};
}
function setup(sh=sheet([])){
  const ctx=vm.createContext({SpreadsheetApp:{getActive:()=>({getSheetByName:()=>sh})}});
  vm.runInContext(source,ctx);return ctx;
}
const event={event_id:'test-event',source_form_id:'qa-form',source_response_id:'qa-response',canonical_id:'TA-OBS01',stream:'evidence',learner_id:'qa-learner',source_revision:2};
const good={ok:true,record_id:event.event_id,revision_id:'a'.repeat(64)};
test('only an exact successful event receipt confirms delivery',()=>{
  const c=setup();
  assert.equal(c.emValidReceipt_(event,good),true);
  for(const r of [null,{}, {ok:true}, {...good,ok:'true'}, {...good,record_id:'other-event'}, {...good,revision_id:'bad'}, {...good,ok:false}])
    assert.equal(c.emValidReceipt_(event,r),false);
});
test('missing and mismatched receipts remain pending, then retry updates the same row',()=>{
  const sh=sheet([[]]);const c=setup(sh),idx={};
  c.emReceipts_(sh,idx,[event],{[event.event_id]:{...good,record_id:'other-event'}});
  assert.equal(sh.rows[1][6],'pending');assert.equal(sh.rows[1][9],'');assert.equal(sh.rows[1][11],'');assert.match(sh.rows[1][10],/receipt/);
  c.emReceipts_(sh,idx,[event],{[event.event_id]:good});
  assert.equal(sh.rows.length,2);assert.equal(sh.rows[1][6],'ok');assert.equal(sh.rows[1][7],2);assert.equal(sh.rows[1][11],good.revision_id);assert.equal(sh.rows[1][12],2);
  assert.equal(c.emAlreadyConfirmed_(event,c.emSyncIndex_(sh)[event.event_id]),true);
});
test('historical ok rows need one receipt; changed source revisions need a retry',()=>{
  const c=setup();
  assert.equal(c.emAlreadyConfirmed_(event,{status:'ok',attempts:3}),false);
  const entry={...good,status:'ok',source_revision:2};
  assert.equal(c.emAlreadyConfirmed_(event,entry),true);
  assert.equal(c.emAlreadyConfirmed_({...event,source_revision:3},entry),false);
});
test('header migration preserves existing data and unrelated extra columns',()=>{
  const c=setup();const headers=vm.runInContext('EM.SYNC_HEADERS',c);
  const row=Array.from({length:14},(_,i)=>i<11?'historical-'+i:i===13?'keep':'');
  const sh=sheet([[...headers.slice(0,11),'','','teacher_notes'],row]);const s=setup(sh);
  s.emSyncSheet_();assert.deepEqual(sh.rows[0].slice(0,13),Array.from(headers));assert.deepEqual(sh.rows[1],row);assert.equal(sh.rows[0][13],'teacher_notes');
});
test('an occupied extension or unexpected header is rejected before any write',()=>{
  const headers=Array.from(vm.runInContext('EM.SYNC_HEADERS',setup()));
  for(const rows of [[['unexpected',...headers.slice(1)]],[[...headers.slice(0,11),'custom_notes']],[headers.slice(0,11),[...Array(11).fill(''),'keep']]]){
    const sh=sheet(rows),before=JSON.stringify(sh.rows);assert.throws(()=>setup(sh).emSyncSheet_());assert.equal(JSON.stringify(sh.rows),before);
  }
});
test('batch sync retries old unverified success once and counts only valid receipts',()=>{
  const sh=sheet([[]]);const c=setup(sh);let posts=0;
  c.emConfigured_=()=>true;c.emSyncSheet_=()=>sh;c.emReadEvidenceLog_=()=>[event];c.emBuildEvent_=x=>x;
  c.emPost_=()=>{posts++;return {[event.event_id]:posts===1?{ok:true}:good};};
  assert.equal(c.emSyncAll_(false,true).confirmed,0);
  assert.equal(c.emSyncAll_(false,true).confirmed,1);
  assert.equal(c.emSyncAll_(false,true).attempted,0);assert.equal(posts,2);
});
test('transport failure leaves pending receipt while the Form hook returns normally',()=>{
  const sh=sheet([[]]);const c=setup(sh);
  c.emConfigured_=()=>true;c.emSyncSheet_=()=>sh;c.emBuildEvent_=x=>x;c.emPost_=()=>{throw new Error('temporarily unavailable');};
  assert.doesNotThrow(()=>c.emOnEvidenceAppended_(event));assert.equal(sh.rows[1][6],'pending');assert.match(sh.rows[1][10],/unavailable/);
});
test('bound deployment copy matches reviewed source',()=>assert.equal(fs.readFileSync(__dirname+'/bound-project/TechnologyEvidenceMapSync.js','utf8'),source));
