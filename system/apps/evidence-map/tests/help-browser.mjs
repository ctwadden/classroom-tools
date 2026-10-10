import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const ROOT=process.env.EVIDENCE_MAP_ROOT||'/Users/cdawg/evidence_map_2026';
const BASE=process.env.EVIDENCE_MAP_URL||'http://127.0.0.1:8796';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(BASE+'/help/index.html');assert.equal(await p.locator('.topic').count(),11);
const hrefs=await p.locator('a[href],img[src],link[href],script[src]').evaluateAll(nodes=>nodes.map(n=>n.href||n.src).filter(u=>u.startsWith(location.origin)));
let linksChecked=0;for(const url of new Set(hrefs)){if(url.includes('#')){const u=new URL(url);if(u.pathname==='/help/index.html'&&u.hash)assert.equal(await p.locator(u.hash).count(),1);}const res=await context.request.get(url);assert.ok(res.ok(),url);linksChecked++;}
await p.fill('#search','quota');assert.equal(await p.locator('.topic:visible').count(),0);assert.equal(await p.locator('#noResults').isVisible(),true);
await p.fill('#search','Photoshop');assert.ok(await p.locator('.topic:visible').count()>0);assert.ok(await p.locator('.topic:visible').count()<11);
await p.locator('nav a[href="#workbooks"]').click();assert.equal(await p.inputValue('#search'),'');assert.equal(await p.locator('.topic:visible').count(),11);
await p.locator('#search').focus();await p.keyboard.type('backup');await p.keyboard.press('Escape');await p.fill('#search','');
await p.locator('#troubleshooting summary').first().focus();await p.keyboard.press('Enter');assert.equal(await p.locator('#troubleshooting details').first().getAttribute('open'),'');
await p.goto(BASE+'/help/index.html');await p.screenshot({path:ROOT+'/help/assets/guide-desktop.png'});
for(const width of [390,768,1440]){await p.setViewportSize({width,height:900});await p.goto(BASE+'/help/index.html');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,'overflow '+width);}
await p.setViewportSize({width:390,height:844});await p.screenshot({path:ROOT+'/help/assets/guide-mobile.png'});
await p.goto('file://'+ROOT+'/help/index.html');await p.fill('#search','rubric');assert.ok(await p.locator('.topic:visible').count()>0);assert.ok(await p.locator('.topic:visible').count()<11);
await p.emulateMedia({media:'print'});assert.equal(await p.locator('.topic:visible').count(),11);await p.emulateMedia({media:'screen'});
await p.goto(BASE);await p.selectOption('#courseSel','MM12');for(const r of ['studio','skills','profile','diagnostic','groups','courseplan','library']){await p.selectOption('#areaNav',r);assert.equal(await p.getByRole('link',{name:'How to use this tool',exact:true}).count(),1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,'app mobile '+r);}
const shots=await context.newPage({viewport:{width:1440,height:1050}});await shots.addInitScript(()=>localStorage.setItem('tos_rosters_v1',JSON.stringify({MM12:[{id:'DEMO-1',name:'Demo Learner',grade:12,color:'#123456'}]})));await shots.goto(BASE);await shots.selectOption('#courseSel','MM12');
for(const r of ['studio','skills','profile','diagnostic','groups','library']){await shots.locator('#nav a[data-route="'+r+'"]').click();if(r==='groups')await shots.click('#generateTeams');await shots.screenshot({path:ROOT+'/help/assets/'+r+'.png'});}
assert.deepEqual(errors,[]);
const report={status:'pass',date:'2026-09-14',localLinks:linksChecked,topics:11,widths:[390,768,1440],checks:['local links and anchors','search match and no-match','navigation clears filter','keyboard disclosure','offline file search','print includes filtered topics','seven app help links','mobile app header regression'],errors};
await fs.writeFile(ROOT+'/help/guide-test-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));await browser.close();
