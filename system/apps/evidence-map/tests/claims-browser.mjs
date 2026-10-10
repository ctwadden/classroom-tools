import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const BASE=process.env.EVIDENCE_MAP_URL||'http://127.0.0.1:8796';
const ROOT=process.env.EVIDENCE_MAP_ROOT||process.cwd();
const sample=JSON.parse(await fs.readFile(ROOT+'/help/Student_Claims_Example.json','utf8'));
const roster=sample.claims.map((c,i)=>({id:c.student,name:'Synthetic Claim Learner '+(i+1),grade:12,color:'#123456'}));
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route('https://fonts.googleapis.com/**',r=>r.abort());
  await context.route('https://fonts.gstatic.com/**',r=>r.abort());
  await context.addInitScript(r=>{
    if(!localStorage.getItem('claims-test-seeded')){
      localStorage.setItem('tos_rosters_v1',JSON.stringify({MM12:r,COM11:r,IBDS:r}));
      localStorage.setItem('claims-test-seeded','true');
    }
  },roster);
  const page=await context.newPage(),errors=[],posts=[];
  context.on('request',r=>{if(r.method()!=='GET')posts.push(r.url());});
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(BASE+'/?view=skills');await page.locator('#claimFile').waitFor();
  await page.selectOption('#courseSel','MM12');
  const state=()=>page.evaluate(()=>window.EvidenceStudio.exportState());
  const durable=()=>page.evaluate(()=>localStorage.getItem('em_app_store_v2'));
  const upload=async payload=>{
    await page.setInputFiles('#claimFile',{name:'combined.json',mimeType:'application/json',buffer:Buffer.from(typeof payload==='string'?payload:JSON.stringify(payload))});
    await page.waitForFunction(()=>{const s=document.querySelector('#claimPreview')?.textContent;return s&&s!=='Checking claims…';});
  };
  const changed=(patch,id='new-test')=>({...sample,claims:[{...sample.claims[0],id,...patch}]});
  await upload(sample);
  assert.match(await page.locator('#claimPreview').innerText(),/2 new student claims for 2 students in MM12/);
  assert.equal((await state()).evidence.length,0,'preview must not save');
  await page.click('#applyClaims');
  assert.match(await page.locator('#claimPreview').innerText(),/Imported 2 claims for 2 students/);
  const saved=await state();assert.equal(saved.evidence.length,2);
  for(const [i,e] of saved.evidence.entries()){
    const c=sample.claims[i];
    for(const k of ['student','course','skill','date','attempt','artifact','note','next','support'])assert.equal(e[k],c[k]);
    assert.equal(e.claimId,c.id);assert.notEqual(e.id,c.id);
    assert.equal(e.claimedLevel,c.selfRating);assert.equal(e.level,null);assert.equal(e.verified,false);
    assert.equal(e.method,'Product');assert.equal(e.demo,false);assert.equal(e.learned,c.learned||'');
  }
  const envelope=JSON.parse(await durable());
  assert.equal(envelope.revision,1,'one atomic commit for entire batch');
  assert.deepEqual(JSON.parse(envelope.values.em_studio_v1),saved);
  await page.reload();await page.locator('#claimFile').waitFor();assert.deepEqual(await state(),saved);
  await upload(sample);assert.equal(await page.locator('#applyClaims').isDisabled(),true);
  assert.match(await page.locator('#claimPreview').innerText(),/2 already imported/);
  const before=await durable();
  for(const payload of ['{broken',changed({student:'unknown'}),changed({course:'IBDS'}),changed({skill:'ibds-skill-sources'}),changed({selfRating:'3'}),changed({date:'2999-01-01'}),{...sample,claims:[sample.claims[0],sample.claims[0]]},{...sample,claims:[{...sample.claims[0],id:'valid-new'}, {...sample.claims[1],id:'bad-new',student:'not-on-roster'}]}]){
    await upload(payload);assert.match(await page.locator('#claimPreview').innerText(),/Import blocked/);
    assert.equal(await page.locator('#applyClaims').count(),0);assert.equal(await durable(),before);
  }
  await upload(' '.repeat(2000001));assert.match(await page.locator('#claimPreview').innerText(),/2 MB/);assert.equal(await durable(),before);
  // Single-student exports still use the same path; strings are displayed as text.
  await upload(changed({note:'<img src=x onerror="window.claimInjection=true">'}));
  assert.equal(await page.locator('#claimPreview img').count(),0);
  await page.click('#applyClaims');assert.equal((await state()).evidence.length,3);
  assert.equal(await page.evaluate(()=>window.claimInjection),undefined);
  // A retry with existing + new IDs commits only the new record.
  await upload({...sample,claims:[sample.claims[0],{...sample.claims[1],id:'fourth'}]});
  assert.match(await page.locator('#claimPreview').innerText(),/1 new student claims.*1 already imported/s);
  await page.click('#applyClaims');assert.equal((await state()).evidence.length,4);
  // No cross-course import even when the other course uses the same student IDs.
  await page.selectOption('#courseSel','COM11');await upload(sample);
  assert.match(await page.locator('#claimPreview').innerText(),/Import blocked/);
  await page.selectOption('#courseSel','MM12');
  // Quota failures preserve both memory and durable records, then allow retry.
  await upload(changed({},'quota-test'));const preQuota=await durable();
  await page.evaluate(()=>{window.claimTestSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k==='em_app_store_v2')throw new DOMException('Quota exceeded','QuotaExceededError');return window.claimTestSetItem.call(this,k,v);};});
  await page.click('#applyClaims');assert.equal((await state()).evidence.length,4);assert.equal(await durable(),preQuota);
  assert.equal(await page.locator('#storageWarning').count(),1);
  await page.evaluate(()=>{Storage.prototype.setItem=window.claimTestSetItem;});
  await page.click('#applyClaims');assert.equal((await state()).evidence.length,5);
  await page.reload();await page.locator('#claimFile').waitFor();
  // Another tab's commit cannot be overwritten by a stale preview.
  await upload(changed({},'stale-test'));const other=await context.newPage();await other.goto(BASE+'/?view=skills');await other.locator('#claimFile').waitFor();
  await other.evaluate(()=>{const n=window.EvidenceStudio.exportState();n.profiles['MM12:WORKBOOK-TEST-01']={goal:'Other tab kept'};if(!window.EvidenceStudio.restoreState(n))throw Error('Other tab failed');});
  const newer=await durable();await page.click('#applyClaims');assert.equal(await durable(),newer);
  assert.match(await page.locator('.toast').innerText(),/Another tab changed/);
  await other.close();await page.reload();await page.locator('#claimFile').waitFor();
  assert.equal((await state()).profiles['MM12:WORKBOOK-TEST-01'].goal,'Other tab kept');
  // Teacher profile sees the record under the exact student/skill and preserves inspection action.
  await page.locator('#nav a[data-route="profile"]').click();
  assert.match(await page.locator('.studio').innerText(),/matched the planet lighting/);
  assert.ok(await page.locator('[data-review-claim]').count());
  await page.locator('#nav a[data-route="skills"]').click();
  const guide=await context.request.get(BASE+'/help/Student_Claims_Integration.md');assert.equal(guide.status(),200);
  await upload(sample);await page.setViewportSize({width:390,height:844});
  const dims=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(dims.scroll<=dims.width+1,JSON.stringify(dims));
  assert.equal(await page.getByLabel('Import student claims',{exact:true}).count(),1);
  assert.deepEqual(posts,[],'claims import must not send network data');assert.deepEqual(errors,[]);
  console.log('PASS: combined and single-file claims, exact storage mapping, reload, duplicates, whole-batch rejection, limits, course isolation, quota/retry, stale-tab guard, profile visibility, mobile layout, no network posting.');
}finally{await browser.close();}
