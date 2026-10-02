import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '@oai/artifact-tool';
const ROOT='/Users/cdawg/evidence_map_2026';
const OUT=ROOT+'/outputs/gold-standard-2026';
const D=JSON.parse(await fs.readFile(OUT+'/Consolidated_Course_Data.json','utf8'));
const wb=Workbook.create();
const names=['Start Here','Roster','Skills','Student Log','Evidence','Diagnostics','Diagnostic Rubric','Profiles','Seating','Lessons','Assessments','Outcome Register','Sources'];
const S=Object.fromEntries(names.map(n=>[n,wb.worksheets.add(n)]));
const col=n=>{let s='';for(n++;n>0;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
let tableNum=0;
function table(name,title,note,headers,rows,widths,height=42){
 const sh=S[name],end=col(headers.length-1),last=Math.max(5,rows.length+4);
 sh.showGridLines=false;sh.tabColor='#1B6B70';
 sh.getRange(`A1:${end}${last}`).format.font={name:'Arial',size:11,color:'#203443'};
 sh.getRange(`A1:${end}1`).merge();sh.getRange('A1').values=[[title]];sh.getRange(`A1:${end}1`).format={fill:'#123D46',font:{name:'Arial',size:19,bold:true,color:'#FFFFFF'},rowHeight:38};
 sh.getRange(`A2:${end}2`).merge();sh.getRange('A2').values=[[note]];sh.getRange(`A2:${end}2`).format={wrapText:true,rowHeight:44,font:{italic:true,color:'#52616B'}};
 sh.getRange(`A4:${end}4`).values=[headers];sh.getRange(`A4:${end}4`).format={fill:'#1B6B70',font:{bold:true,color:'#FFFFFF'},wrapText:true,rowHeight:34};
 if(rows.length)sh.getRange(`A5:${end}${last}`).values=rows;
 sh.getRange(`A5:${end}${last}`).format.wrapText=true;sh.getRange(`A5:${end}${last}`).format.verticalAlignment='top';sh.getRange(`A5:${end}${last}`).format.rowHeight=height;
 widths.forEach((w,i)=>sh.getRange(`${col(i)}:${col(i)}`).format.columnWidth=w);
 const t=sh.tables.add(`A4:${end}${last}`,true,'Register'+(++tableNum));t.showFilterButton=true;
 sh.freezePanes.freezeRows(4);sh.freezePanes.freezeColumns(name==='Diagnostics'?3:1);
 return sh;
}
const blank=(n,c)=>Array.from({length:n},()=>Array(c).fill(null));
const list=(sh,range,values)=>sh.getRange(range).dataValidation={rule:{type:'list',values}};
const input=(sh,range)=>sh.getRange(range).format.font.color='#1457AD';
function levels(sh,range){sh.dataValidations.add({range,rule:{type:'whole',operator:'between',formula1:1,formula2:4}});for(let n=1;n<=4;n++)sh.getRange(range).conditionalFormats.add('cellIs',{operator:'equal',formula:n,format:{fill:['#FCEDE3','#FFF4CC','#DEF0EB','#D9E8F5'][n-1]}});}
function formula(sh,cell,expression,end){
  const first=Number(cell.match(/\d+$/)[0]),last=end||first;
  // Artifact fillDown rewrites A1-looking text inside string literals (e.g. "MM12").
  // Translate only unquoted cell references; preserve absolute rows and all literals.
  const formulas=Array.from({length:last-first+1},(_,offset)=>[expression.split(/("(?:[^"]|"")*")/g).map((part,i)=>i%2?part:part.replace(/(\$?[A-Z]{1,3})(\$?)([1-9]\d*)\b/g,(m,c,absolute,row)=>c+absolute+(absolute?row:Number(row)+offset))).join('')]);
  sh.getRange(cell+':'+cell.replace(/\d+$/,String(last))).formulas=formulas;
}
const info=[
['Start','Enter the class roster once. Use Student Log for learner claims. Use Evidence for teacher observations. Read the diagnostic guide before assigning a band.'],
['Three separate quantities','Task score: 4–16 from four observed criteria. Readiness: a teacher-reviewed 1–4 local band. Seat number: a turn/position identifier. None converts automatically to a percentage or IB grade.'],
['Unassessed','Leave missing ratings blank. Do not use zero for absence, access barriers or missing evidence. Incomplete diagnostic evidence produces no suggested band.'],
['Score interpretation','The suggested readiness band is the lowest of four core criteria. It is a conservative support-planning rule designed for this pilot, not a validated Kagan instrument.'],
['Assistance','Record help during the scored individual attempt. Common prior teaching is expected. Instructional hints or modelling limit this attempt to band 1 or 2. Access supports alone do not lower a band.'],
['Reassessment','Use an equivalent task after targeted practice, ideally 2–3 weeks later. Keep every attempt. Profiles use the latest eligible date, then the last row on that date. Review after 42 days or the recorded review date.'],
['Student self-rating','Self-ratings are claims for reflection. A self-rating does not populate teacher achievement or grouping. Keep learners’ logs separate from public class displays.'],
['Grouping','Use a current course-specific profile, teacher review, access needs and relationships. Aim for mixed teams and rotate roles. Readiness is not tool-safety clearance.'],
['Excel inputs','Blue text identifies entry cells. Diagnostic totals and profile summaries are formulas. The prepared ranges support 90 roster rows, 300 evidence rows and 150 diagnostic attempts. Extend formulas/validation if growing beyond them.'],
['App connection','This workbook and the supplied originals are downloadable from Resource Library. Workbook edits do not automatically update browser data. The app exports CSV snapshots and JSON backups.'],
['Course plan','332 dated lessons are preserved. Ten matching studio lessons and four assessment records use the Citrus revision. Date-neutral and sneaker alternatives remain in the app. Dates require school-calendar confirmation.'],
['Curriculum reconciliation','The published Multimedia framework has five Sound outcomes. The app now uses five active Sound outcomes and stable code-based IDs. Historical Sound records retain their original keys in Student OS for individual review.'],
['IB Digital Society','The 1–4 diagnostic is a local reasoning profile. Official IA criteria and exam markschemes are separate. SL component estimates use actual marks/maxima and the applicable guide; do not calculate grades from skill scores.'],
['Source files','Original workbooks are preserved unchanged in the same output folder. The source manifest identifies all 95 local entries and 40 exact duplicates. Books stay in their original locations.'],
['Privacy','This is a teacher workbook. Use an individual Student Log copy for each learner. Do not share the class roster, private supports or diagnostic bands as a public tracker.'],
['Practical pilot','Class 1: establish prerequisites and model. Class 2: collect individual attempts and sample live actions. Class 3: mixed teams practise and rotate. Class 4: targeted repair. Class 5: brief check, then delayed retest 2–3 weeks later.']
];
table('Start Here','Evidence Map and Skills','MM12, Communications Technology 11 and IB Digital Society · September 2026 · Teacher working workbook',['Topic','How to use it'],info,[27,105],62);
S['Start Here'].freezePanes.unfreeze();
table('Roster','Class roster','Use a unique student ID within each course. Enter only the information needed for teaching. Do not reuse IDs within a course.',['Course','Student ID','Display name','Section','Active'],blank(90,5),[15,22,31,15,15],25);
list(S.Roster,'A5:A94',['MM12','COM11','IBDS']);list(S.Roster,'E5:E94',['Yes','No']);input(S.Roster,'A5:E94');
table('Skills','Course skill reference','Teacher-designed skills with proposed curriculum links. IB codes are syllabus references. Four shared habits remain separate from achievement.',['Skill ID','Course','Skill','Domain','Outcome codes','What counts as evidence','Next teaching move','Beginning 1','Developing 2','Independent 3','Transfer 4'],D.skills.map(s=>[s.id,s.course,s.name,s.domain,s.outcome_codes.join(', '),s.evidence,s.next_step,...s.descriptors]),[31,12,32,25,20,48,43,46,46,46,46],125);
table('Student Log','My skill-use log','Use one private copy per learner. Log one meaningful skill use, link evidence and choose a next action. Self-rating is reflection, not a grade.',['Date','Course','Student ID','Task / project','Skill ID','What I did','Evidence location','Self-rating 1–4','Help I used','Next action','What I learned'],blank(150,11),[15,12,20,25,32,55,42,17,40,45,55],42);
list(S['Student Log'],'B5:B154',['MM12','COM11','IBDS']);levels(S['Student Log'],'H5:H154');S['Student Log'].getRange('A5:A154').setNumberFormat('yyyy-mm-dd');input(S['Student Log'],'A5:K154');
table('Evidence','Teacher skill evidence','Record an actual observation, conversation or inspected product. Several methods may support one judgment. Outcome column: MM12/COM11 1–4; IBDS 1–7 course scale, not IA marks. Leave blank unless separately reviewed.',['Record ID','Course','Student ID','Skill ID','Date','Method','Teacher level','Conditions','Task / attempt','Artifact location','What I observed','Next step','Teacher verified','What the learner learned','Linked outcome key','Outcome judgment (course scale)'],blank(300,16),[24,12,21,31,15,20,17,27,26,36,58,45,20,55,35,24],42);
list(S.Evidence,'B5:B304',['MM12','COM11','IBDS']);list(S.Evidence,'F5:F304',['Product','Observation','Conversation']);list(S.Evidence,'H5:H304',['None','Access supports only','Instructional hints','Modelled together']);list(S.Evidence,'M5:M304',['Yes','No']);levels(S.Evidence,'G5:G304');S.Evidence.getRange('E5:E304').setNumberFormat('yyyy-mm-dd');input(S.Evidence,'A5:P304');S.Evidence.dataValidations.add({range:'P5:P304',rule:{type:'whole',operator:'between',formula1:1,formula2:7}});
table('Diagnostics','Diagnostic attempts','Complete four observed criteria, artifact, live action and explanation before a readiness band. Preserve each attempt. Readiness is for the named task family only.',['Attempt ID','Course','Student ID','Task version','Date','Criterion 1','Criterion 2','Criterion 3','Criterion 4','Conditions','Artifact reference','Observed action','Explanation evidence','Access supports','Teacher verified','Task score /16','Suggested band','Teacher band','Rationale / next action','Next review date','Eligible band','Course + student key','Independent sample','Row helper'],blank(150,24),[24,12,22,17,15,15,15,15,15,27,37,48,48,37,20,18,18,18,52,18,17,28,21,14],44);
const dg=S.Diagnostics;input(dg,'A5:O154');input(dg,'R5:T154');levels(dg,'F5:I154');levels(dg,'R5:R154');list(dg,'B5:B154',['MM12','COM11','IBDS']);list(dg,'D5:D154',['PS-A','PS-B','DS-A','DS-B']);list(dg,'J5:J154',['None','Access supports only','Instructional hints','Modelled together']);list(dg,'O5:O154',['Yes','No']);dg.getRange('E5:E154').setNumberFormat('yyyy-mm-dd');dg.getRange('T5:T154').setNumberFormat('yyyy-mm-dd');
formula(dg,'P5','=IF(AND(COUNT(F5:I5)=4,MIN(F5:I5)>=1,MAX(F5:I5)<=4,F5=INT(F5),G5=INT(G5),H5=INT(H5),I5=INT(I5)),SUM(F5:I5),"")',154);
formula(dg,'Q5','=IF(AND(ISNUMBER(P5),K5<>"",L5<>"",M5<>"",OR(J5="None",J5="Access supports only",J5="Instructional hints",J5="Modelled together")),MIN(MIN(F5:I5),IF(OR(J5="Instructional hints",J5="Modelled together"),2,4)),"")',154);
formula(dg,'U5','=IF(AND(A5<>"",COUNTIF($A$5:$A$154,A5)=1,OR(B5="MM12",B5="COM11",B5="IBDS"),C5<>"",COUNTIFS(Roster!$A$5:$A$94,B5,Roster!$B$5:$B$94,C5)=1,OR(AND(B5="IBDS",OR(D5="DS-A",D5="DS-B")),AND(B5<>"IBDS",OR(D5="PS-A",D5="PS-B"))),ISNUMBER(E5),E5>0,E5<=TODAY(),OR(T5="",AND(ISNUMBER(T5),T5>=E5)),O5="Yes",ISNUMBER(Q5),ISNUMBER(R5),R5=INT(R5),R5>=1,R5<=4,S5<>"",OR(J5="None",J5="Access supports only",R5<=2)),R5,"")',154);
formula(dg,'V5','=IF(OR(B5="",C5=""),"",B5&"|"&C5)',154);
formula(dg,'W5','=IF(AND(ISNUMBER(U5),OR(J5="None",J5="Access supports only")),1,"")',154);
formula(dg,'X5','=IF(A5="","",ROW())',154);
table('Diagnostic Rubric','Diagnostic scoring anchors','The four Photoshop criteria apply to PS-A and PS-B. The four Digital Society criteria apply to DS-A and DS-B. Insufficient evidence is blank.',['Task family','Criterion','Beginning 1','Developing 2','Independent 3','Transfer 4'],Object.entries(D.diagnosticRubrics).flatMap(([k,rs])=>rs.map(r=>[k,r.name,...r.bands])),[18,27,46,46,46,49],115);
table('Profiles','Current readiness profiles','Roster-linked. Latest eligible assessment date wins; the last eligible row resolves same-day attempts. A profile expires after 42 days or its earlier next-review date.',['Course','Student ID','Name','Latest date','Latest row','Current band','Eligible attempts','First independent date','Last independent date','Review status','Goal','Useful supports','Next action'],blank(90,13),[13,21,31,16,14,17,20,23,23,26,46,48,48],42);
const pf=S.Profiles;input(pf,'K5:M94');
formula(pf,'A5','=IF(Roster!A5="","",Roster!A5)',94);formula(pf,'B5','=IF(Roster!B5="","",Roster!B5)',94);formula(pf,'C5','=IF(Roster!C5="","",Roster!C5)',94);
formula(pf,'D5','=IF(OR(A5="",B5=""),"",IF(COUNTIFS(Diagnostics!$V$5:$V$154,A5&"|"&B5,Diagnostics!$U$5:$U$154,">=1")=0,"",_xlfn.MAXIFS(Diagnostics!$E$5:$E$154,Diagnostics!$V$5:$V$154,A5&"|"&B5,Diagnostics!$U$5:$U$154,">=1")))',94);
formula(pf,'E5','=IF(ISNUMBER(D5),_xlfn.MAXIFS(Diagnostics!$X$5:$X$154,Diagnostics!$V$5:$V$154,A5&"|"&B5,Diagnostics!$E$5:$E$154,D5,Diagnostics!$U$5:$U$154,">=1"),"")',94);
formula(pf,'F5','=IF(ISNUMBER(E5),IF(OR(TODAY()-D5>42,AND(INDEX(Diagnostics!$T$5:$T$154,E5-4)>0,INDEX(Diagnostics!$T$5:$T$154,E5-4)<TODAY())),"",INDEX(Diagnostics!$U$5:$U$154,E5-4)),"")',94);
formula(pf,'G5','=IF(OR(A5="",B5=""),"",COUNTIFS(Diagnostics!$V$5:$V$154,A5&"|"&B5,Diagnostics!$U$5:$U$154,">=1"))',94);
formula(pf,'H5','=IF(OR(A5="",B5=""),"",IF(COUNTIFS(Diagnostics!$V$5:$V$154,A5&"|"&B5,Diagnostics!$W$5:$W$154,1)=0,"",_xlfn.MINIFS(Diagnostics!$E$5:$E$154,Diagnostics!$V$5:$V$154,A5&"|"&B5,Diagnostics!$W$5:$W$154,1)))',94);
formula(pf,'I5','=IF(ISNUMBER(H5),_xlfn.MAXIFS(Diagnostics!$E$5:$E$154,Diagnostics!$V$5:$V$154,A5&"|"&B5,Diagnostics!$W$5:$W$154,1),"")',94);
formula(pf,'J5','=IF(B5="","",IF(NOT(ISNUMBER(D5)),"Not assessed",IF(NOT(ISNUMBER(F5)),"Review due",IF(AND(ISNUMBER(H5),ISNUMBER(I5),I5>H5),"Reviewed","Provisional"))))',94);
for(const c of ['D','H','I'])pf.getRange(c+'5:'+c+'94').setNumberFormat('yyyy-mm-dd');levels(pf,'F5:F94');
table('Seating','Reviewed seating plan','Manual teacher planning. Export only names, teams and seat positions for students. Do not distribute readiness bands or support notes.',['Date','Course','Student ID','Team','Seat','Role this round','Teacher note'],blank(90,7),[16,13,24,14,14,29,62],33);input(S.Seating,'A5:G94');list(S.Seating,'B5:B94',['MM12','COM11','IBDS']);list(S.Seating,'F5:F94',['Operator','Coach','Checker','Explainer']);S.Seating.getRange('A5:A94').setNumberFormat('yyyy-mm-dd');
table('Lessons','Dated teaching sequence','332 inherited dates with ten Citrus lesson revisions. Dates are planned until taught. The app retains the full notes and both alternative sequences.',['Course','Date','Day','Lesson ID','Title','Minutes','Builds on','New learning','Prepares for','Evidence opportunity','Material state','Source'],D.lessons.filter(l=>l.sequence==='dated').map(l=>[l.course,l.date?new Date(l.date+'T12:00:00Z'):null,l.day,l.id,l.title,l.minutes,l.builds_on,l.new_learning,l.prepares_for,l.observation||l.independent_check,l.materials_status,l.source]),[12,16,10,28,47,12,55,55,55,55,44,33],100);S.Lessons.getRange('B5:B336').setNumberFormat('yyyy-mm-dd');
table('Assessments','Planned assessment register','No student scores. O/C/P are evidence methods within a bundle. Imported legacy curriculum references require meaning-based reconciliation before official gradebook export.',['Assessment ID','Course','Planned date','Title','Purpose','Primary method','Outcome references','Rubric','Prediction role','Evidence bundle','Score'],D.assessments.map(a=>[a.id,a.course,a.date?new Date(a.date+'T12:00:00Z'):null,a.title,a.purpose,a.method,a.outcome_ids.join(', '),a.rubric,a.prediction_role,a.bundle||a.id,null]),[29,12,16,47,18,19,57,40,43,29,13],72);S.Assessments.getRange('C5:C115').setNumberFormat('yyyy-mm-dd');
table('Outcome Register','Curriculum references','Planning paraphrases retain published source codes. MM12 uses stable code-based IDs matching the app. IB targets are local. Official wording remains in the source guides.',['Course','Portable reference','Code','Planning description','Authority','School/session check'],D.outcomes.map(o=>[o.course,o.id,o.code,o.label,o.authority,o.current_school_adoption]),[12,39,14,61,57,37],64);
const friends=[['Game Design teacher tracker','https://docs.google.com/spreadsheets/d/1K-fML0AoprirJZeSEcAQsurRXlvQkP4rXhB45M8T3Ak/edit','Instructions A1:F24; S10 A1:Z4. Adopt phase/checkpoint structure, not public diagnostic data.'],['Film skill tracker','https://docs.google.com/spreadsheets/d/1StgFsR9ZrF6yYH6l2dMU_E6rgUO2_yQuiOIrtQx8n-0/edit','Skill Reference A1:J20; Skill Log A1:N3. Adopt dated skill-use claims and evidence links.'],['Game Design skill tracker','https://docs.google.com/spreadsheets/d/1kKPdm8s34fiFKt4T7uxY15hwCxPbKANs3Lk3t0nuClY/edit','Instructions A1:F30; Skill Reference A1:J18. Keep self-rating distinct from teacher judgment.'],['Film teacher tracker','https://docs.google.com/spreadsheets/d/1s11yODDCIjYryU5sfQSh80M7jw_hnHaa5OvJZDWCdH8/edit','Instructions A1:F25. Reference only; no student records copied.']];
table('Sources','Sources and reference decisions','Source documents informed the design. Embedded instructions did not authorise publication, grading or data sharing. Research and tracker links reviewed 13 September; Photoshop catalogue updated 14 September 2026.',['Source','Location','Use and limit'],[...D.research.map(s=>[s.title,s.url,s.use]),...friends,...JSON.parse(await fs.readFile(OUT+'/Photoshop_Source_Catalog.json','utf8')).sources.map(s=>[s.title,s.url||s.location,s.role+'. '+s.read]),['How Teens Win (2024)','User-supplied EPUB; chapters 2, 12–14 and contents sampled','Use learner-owned small goals and reflection. This is not a validated assessment or grouping instrument.'],['Course System v2','Course_System.json','34-sprint architecture and 30 opening tickets. Source for the proposed curriculum code register.'],['Dated teaching plan','Daily_Lessons_and_Planned_Gradebooks.xlsx','332 dates and 111 planned assessment records; no student data.'],['Citrus revision','Studio_Revision.json','Ten matching lesson replacements and four assessment revisions. Preserve older titles in Source Manifest and originals.'],['Sneaker campaign','Studio_Advertising_Release.zip','Alternative seven-class sequence, not an automatic extra assessment.'],['Source inventory','Source_Manifest.json','95 entries, 55 distinct files, 40 exact duplicates. Originals retained.']],[49,79,91],78);

// Verify representative formula behavior in a disposable in-memory sample, then restore blank inputs.
const localNow=new Date();
const todaySerial=Math.floor(Date.UTC(localNow.getFullYear(),localNow.getMonth(),localNow.getDate())/86400000)+25569;
S.Roster.getRange('A5:E5').values=[['MM12','QA-001','Synthetic verification row','A','Yes']];
dg.getRange('A5:O5').values=[['QA-ATTEMPT','MM12','QA-001','PS-A',todaySerial,3,3,3,3,'None','sample.psd','Repaired mask','Explained changed hierarchy','','Yes']];dg.getRange('R5:T5').values=[[3,'Meets all observed independent criteria',null]];
const checks={score:dg.getRange('P5').values[0][0],suggested:dg.getRange('Q5').values[0][0],eligible:dg.getRange('U5').values[0][0],profile:pf.getRange('F5').values[0][0]};
if(checks.score!==12||checks.suggested!==3||checks.eligible!==3||checks.profile!==3)throw Error('Diagnostic formula checks failed: '+JSON.stringify(checks));
dg.getRange('J5').values=[['Instructional hints']];if(dg.getRange('Q5').values[0][0]!==2||dg.getRange('U5').values[0][0]!=='')throw Error('Supported attempt gating failed');
dg.getRange('F5').values=[[null]];if(dg.getRange('P5').values[0][0]!==''||dg.getRange('Q5').values[0][0]!=='')throw Error('Missing evidence gating failed');
// Exercise expiry, course/task mismatch, duplicate IDs and repeated independent dates.
dg.getRange('F5').values=[[3]];dg.getRange('J5').values=[['None']];
dg.getRange('T5').values=[[todaySerial-1]];if(dg.getRange('U5').values[0][0]!=='')throw Error('Review date before attempt must be ineligible');
dg.getRange('E5').values=[[todaySerial-2]];if(pf.getRange('F5').values[0][0]!==''||pf.getRange('J5').values[0][0]!=='Review due')throw Error('Review expiry failed');
dg.getRange('T5').values=[[null]];dg.getRange('D5').values=[['DS-A']];if(dg.getRange('U5').values[0][0]!=='')throw Error('Task/course matching failed');
dg.getRange('D5').values=[['PS-A']];dg.getRange('A6').values=[['QA-ATTEMPT']];if(dg.getRange('U5').values[0][0]!=='')throw Error('Duplicate ID protection failed');
dg.getRange('A6:O6').values=[['QA-RETEST','MM12','QA-001','PS-B',todaySerial,4,4,4,4,'None','retest.psd','New repair','Explains transfer','','Yes']];dg.getRange('R6:T6').values=[[4,'Independent changed condition',null]];
if(pf.getRange('F5').values[0][0]!==4||pf.getRange('J5').values[0][0]!=='Reviewed')throw Error('Reassessment history failed');
dg.getRange('A6:O6').clear({applyTo:'contents'});dg.getRange('R6:T6').clear({applyTo:'contents'});
S.Roster.getRange('A5:E5').clear({applyTo:'contents'});dg.getRange('A5:O5').clear({applyTo:'contents'});dg.getRange('R5:T5').clear({applyTo:'contents'});
const verify=names.flatMap(name=>S[name].getUsedRange().values.flatMap((row,i)=>row.flatMap((v,j)=>typeof v==='string'&&/^#(REF!|DIV\/0!|VALUE!|NAME\?|NUM!)/.test(v)?[{sheet:name,cell:col(j)+(i+1),value:v}]:[])));
if(verify.length)throw Error('Workbook has formula errors: '+JSON.stringify(verify.slice(0,5)));
await fs.writeFile('/private/tmp/evidence-map-runtime/workbook-checks.json',JSON.stringify({checks,inspection:verify},null,2));
for(const name of names){
  const end={"Start Here":"B","Roster":"E","Skills":"K","Student Log":"K","Evidence":"P","Diagnostics":"X","Diagnostic Rubric":"F","Profiles":"M","Seating":"G","Lessons":"L","Assessments":"K","Outcome Register":"F","Sources":"C"}[name];
  const preview=await wb.render({sheetName:name,range:`A1:${end}${name==='Start Here'?10:6}`,scale:1,format:'png'});
  await fs.writeFile('/private/tmp/evidence-map-runtime/sheet-'+name.replaceAll(' ','-')+'.png',new Uint8Array(await preview.arrayBuffer()));
  console.log('Rendered '+name);
}
const xlsx=await SpreadsheetFile.exportXlsx(wb);await xlsx.save(OUT+'/Evidence_Map_and_Skills.xlsx');
console.log(JSON.stringify({output:OUT+'/Evidence_Map_and_Skills.xlsx',sheets:names.length,checks}));
