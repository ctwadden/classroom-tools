import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const ROOT='/Users/cdawg/evidence_map_2026',BASE=(process.env.EVIDENCE_MAP_URL||'http://127.0.0.1:8796')+'/dist';
const b=await chromium.launch({headless:true}),c=await b.newContext(),p=await c.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.goto(BASE+'/');await p.locator('.studio h2').waitFor();assert.equal(await p.locator('#courseSel option').count(),4);
const pages=['help/index.html','outputs/gold-standard-2026/Creative_Photoshop_Library.html','outputs/gold-standard-2026/Photoshop_Pilot_Checklist.html'];
let links=0;
for(const file of pages){await p.goto(BASE+'/'+file);const urls=await p.locator('a[href]').evaluateAll(a=>a.map(x=>x.href).filter(x=>x.startsWith(location.origin)));for(const u of new Set(urls)){assert.ok((await c.request.get(u)).ok(),u);links++;}for(const width of [390,1440]){await p.setViewportSize({width,height:950});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),file+' '+width);}await p.screenshot({path:'/private/tmp/evidence-map-runtime/'+file.split('/').at(-1)+'.png'});}
await p.goto(BASE+'/outputs/gold-standard-2026/Creative_Photoshop_Library.html');assert.equal(await p.locator('article[id^="project-"]').count(),12);
await p.goto('file://'+ROOT+'/private/German_Photoshop_English_Companion.html');assert.match(await p.locator('h1').innerText(),/English/);await p.setViewportSize({width:390,height:900});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));await p.screenshot({path:'/private/tmp/evidence-map-runtime/english-companion.png'});
assert.equal((await c.request.get(BASE+'/private/German_Photoshop_English_Companion.html')).status(),404);
assert.deepEqual(errors,[]);console.log(JSON.stringify({status:'pass',publicPages:pages.length,localLinks:links,creativeProjects:12,privateCompanionExcluded:true,errors}));await b.close();
