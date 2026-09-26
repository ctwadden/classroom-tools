import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {Workbook,SpreadsheetFile} from '@oai/artifact-tool';
const ROOT='/Users/cdawg/evidence_map_2026',OUT=ROOT+'/outputs/gold-standard-2026/Workbook_Experience',QA='/private/tmp/evidence-map-runtime/workbook-experience';
await fs.mkdir(OUT,{recursive:true});await fs.mkdir(QA,{recursive:true});
const D=JSON.parse(await fs.readFile(ROOT+'/outputs/gold-standard-2026/Consolidated_Course_Data.json','utf8'));
const FONT='Helvetica Neue',NAVY='#172B4D',TEAL='#167D8D',INK='#24384C',MUTED='#61758A',PALE='#F3F6FA',INPUT='#FFF2CD';
const bandColours=['#F1DEDD','#F7E8BB','#D9EEE4','#DEE7FA'],col=n=>{let s='';for(n++;n;n=Math.floor((n-1)/26))s=String.fromCharCode(65+(n-1)%26)+s;return s;};
const courses=['MM12','COM11','IBDS'],names=['Home','Class View','Student View','Seating','Assignments','Skill Log','Reviews','Benchmarks','Roster','Skills','Routes','Guide'];
const configs={
 MM12:{skill:'mm12-skill-layers',outcome:'ns-mm12-2015-1.1',title:'Editable poster and mask repair',can:'I can combine images and text while preserving an editable source.',a:'PS-A',b:'PS-B',do:'Restored the poster edge through its layer mask.',learn:'Black conceals the layer; white reveals it without deleting source pixels.',change:'Adapt the poster for a new audience and repair a different edge fault.'},
 COM11:{skill:'com11-skill-brief',outcome:'com11-1.4',title:'An audience-led event campaign',can:'I can use a design brief to make and justify communication choices.',a:'COM-A',b:'COM-B',do:'Revised the headline and layout for the stated audience.',learn:'The audience changes which information should be noticed first.',change:'Adapt the message for a different audience and justify the hierarchy.'},
 IBDS:{skill:'ibds-skill-mechanism',outcome:'local-ds-mechanism',title:'Explain and evaluate a digital decision',can:'I can explain how an input and rule produce an output and affect people.',a:'DS-A',b:'DS-B',do:'Traced the fictional system from input through its decision rule to a consequence.',learn:'An inaccurate input can change who benefits from the same rule.',change:'Change an input or threshold and evaluate who gains or loses.'}
};
const people=[
 ['MM01','Alex Rowan','MM12',1,2,'Yes',1,3,'Front'],
 ['MM02','Jamie Lake','MM12',2,3,'No',1,2,'Front'],
 ['MM03','Riley Moss','MM12',3,3,'No',1,4,'Front'],
 ['MM04','Morgan Vale','MM12',3,4,'Yes',1,1,'Front'],
 ['MM05','Casey Hart','MM12',1,1,'Yes',2,3,'Front'],
 ['MM06','Taylor Reed','MM12',2,2,'Yes',2,2,'Front'],
 ['MM07','Jordan Pine','MM12',2,3,'No',2,4,'Front'],
 ['MM08','Quinn Stone','MM12',3,4,'No',2,1,'Front'],
 ['MM09','Sam Brook','MM12',1,2,'Yes',3,3,'Middle'],
 ['MM10','Drew Field','MM12',2,3,'No',3,2,'Middle'],
 ['MM11','Robin Ash','MM12',3,4,'No',3,1,'Middle'],
 ['MM12','Avery Fern','MM12',null,null,'No',3,4,'Middle'],
 ['CO01','Lee Orchard','COM11',1,2,'Yes',1,3,'Front'],
 ['CO02','Sky Alder','COM11',2,3,'No',1,2,'Front'],
 ['CO03','Rowan Hill','COM11',3,3,'No',1,4,'Front'],
 ['CO04','Ellis Bay','COM11',3,4,'No',1,1,'Front'],
 ['DS01','Emery Birch','IBDS',1,2,'Yes',1,3,'Front'],
 ['DS02','Finley Cove','IBDS',2,3,'No',1,2,'Front'],
 ['DS03','Reese Glen','IBDS',3,3,'No',1,4,'Front'],
 ['DS04','Sage Elm','IBDS',3,4,'No',1,1,'Front']
];
const routeRows=courses.flatMap(course=>[
 [course+'-check',course,'', 'Meet and sample','Collect a short individual attempt before choosing support.','Ask the learner to explain one decision.','Keep the core outcome visible.','No current band'],
 ...[1,2,3,4].map((band,i)=>[course+'-'+band,course,band,['Guided steps','Supported choice','Independent brief','Transfer challenge'][i],
 ['One illustrated action per section; teacher checkpoints; worked example.','A checklist, partial example and optional troubleshooting hints.','A concise brief, source references and self-check prompts.','A changed audience or constraint, competing solutions and a design defence.'][i],
 course==='COM11'?['Identify audience, purpose and one success criterion using a worked brief.','Complete a partial brief; compare two headlines against the audience.','Develop an audience-led message and justify its hierarchy.','Adapt the message for a changed audience and defend the trade-offs.'][i]:course==='IBDS'?['Use an input → rule → output diagram and one stakeholder.','Complete a partially filled mechanism map; compare two consequences.','Explain and evaluate a new case with evidence.','Test a counterexample and defend a qualified conclusion.'][i]:['Use the mask thumbnail and repair one boundary after a model.','Choose an image; follow checkpoints and diagnose one supplied fault.','Meet the brief, keep the PSD editable and explain a repair.','Handle a changed condition and justify a purposeful refinement.'][i],
 'Same core learning target; vary support and application complexity.','Teacher reviews the suggestion'])
]);
const demoLogs=[],demoReviews=[],demoBench=[],packets=[];
for(const person of people){
 const [id,name,course,initial,current]=person,c=configs[course];if(initial===null)continue;
 for(const [phase,band,date,task] of [['Baseline',initial,'2026-09-15',c.a],['Revisit',current,'2026-10-20',c.b]]){
  const refs=[];const help=band===1?'Modelled':band===2?'Hints':'None';
  for(const [j,method] of ['Product','Observation','Conversation'].entries()){
   const eid=id+'-'+(phase==='Baseline'?'A':'B')+'-'+(j+1);refs.push(eid);
   const action=j===0?(course==='IBDS'?'Submitted a labelled mechanism map and a stakeholder comparison.':'Submitted an editable layout with the required message and source record.'):j===1?c.do:('Explained the revision: '+c.learn);
   const feedback=band<3?'Practise the next repair with one fewer instructional prompt.':band===3?'Try the changed condition and explain the trade-off.':'Compare another solution and justify the choice.';
   const url='http://127.0.0.1:8796/outputs/gold-standard-2026/Workbook_Experience/Evidence_Packets.html#'+eid;
   demoLogs.push([eid,id,new Date(date+'T12:00:00Z'),task,c.skill,action,c.learn,url,Math.min(4,band+(j===0?1:0))]);
   demoReviews.push([eid,method,band,'Yes',c.outcome,course==='IBDS'?null:band,feedback,help,new Date(date+'T12:00:00Z')]);
   packets.push({eid,id,name,course,phase,method,band,action,learn:c.learn,feedback,help});
  }
  demoBench.push([id+'-'+(phase==='Baseline'?'A':'B'),id,new Date(date+'T12:00:00Z'),task,band,band,Math.min(4,band+1),band,help,id==='MM04'?'Text-to-speech for the brief':'',...refs,band,'Fictional example: '+(band<3?'instructional prompts still needed.':'independent actions and explanation observed.'),'Yes']);
 }
}
const esc=s=>String(s).replace(/[&<>"]/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[x]));
const checks=[];
async function build(mode){
 const demo=mode==='Demo',wb=Workbook.create(),S=Object.fromEntries(names.map(n=>[n,wb.worksheets.add(n)]));
 const asof=new Date((demo?'2026-11-06':'2026-09-14')+'T12:00:00Z'),capacity=40,logEnd=206,benchEnd=86,rosterEnd=46;
 const rr=c=>"'Roster'!$"+c+"$7:$"+c+"$"+rosterEnd,br=c=>"'Benchmarks'!$"+c+"$7:$"+c+"$"+benchEnd,lr=c=>"'Skill Log'!$"+c+"$7:$"+c+"$"+logEnd,vr=c=>"'Reviews'!$"+c+"$7:$"+c+"$"+logEnd;
 const val=(sh,cell,v)=>S[sh].getRange(cell).values=[[v]],formula=(sh,cell,f)=>S[sh].getRange(cell).formulas=[[f]];
 function merge(sh,r,text,fill=null,size=11,bold=false){const g=S[sh].getRange(r);g.merge();g.values=[[text]];g.format={font:{name:FONT,size,color:INK,bold},wrapText:true,verticalAlignment:'center'};if(fill)g.format.fill=fill;return g;}
 function input(sh,r){S[sh].getRange(r).format.fill=INPUT;S[sh].getRange(r).format.font.color='#174DB2';}
 function list(sh,r,values){S[sh].getRange(r).dataValidation={rule:{type:'list',values}};}
 function bandFormat(sh,r,validate=false){if(validate)S[sh].dataValidations.add({range:r,rule:{type:'whole',operator:'between',formula1:1,formula2:4}});for(let n=1;n<=4;n++)S[sh].getRange(r).conditionalFormats.add('cellIs',{operator:'equal',formula:n,format:{fill:bandColours[n-1],font:{bold:true,color:INK}}});}
 function title(sh,t,sub,end='L'){merge(sh,'A1:'+end+'2',t,null,25,true);merge(sh,'A3:'+end+'3',sub,null,10);S[sh].getRange('A3:'+end+'3').format.font.color=MUTED;S[sh].getRange('A3:'+end+'3').format.borders={bottom:{style:'thin',color:'#C7D4E4'}};}
 function nav(sh,cell,target,label=target){val(sh,cell,'Open tab: '+target);S[sh].getRange(cell).format={font:{name:FONT,size:11,bold:true,color:TEAL},wrapText:true};}

 function table(sh,headers,rows,widths,rowsHeight=46,minRows=0){
  const last=6+Math.max(rows.length,minRows,1),end=col(headers.length-1);
  S[sh].getRange('A6:'+end+'6').values=[headers];S[sh].getRange('A6:'+end+'6').format={fill:NAVY,font:{name:FONT,color:'#FFFFFF',bold:true,size:10},wrapText:true,rowHeight:34};
  if(rows.length)S[sh].getRange('A7:'+end+(rows.length+6)).values=rows;
  S[sh].getRange('A7:'+end+last).format={rowHeight:rowsHeight,wrapText:true,verticalAlignment:'top'};
  for(let r=7;r<=last;r++)if(r%2)S[sh].getRange('A'+r+':'+end+r).format.fill='#F0F4F9';
  widths.forEach((w,i)=>S[sh].getRange(col(i)+':'+col(i)).format.columnWidth=w);
  S[sh].tables.add('A6:'+end+last,true,sh.replaceAll(' ','')+'Data').showFilterButton=true;
  S[sh].freezePanes.freezeRows(6);S[sh].freezePanes.freezeColumns(1);
 }
 for(const name of names){const s=S[name];s.showGridLines=false;s.getRange('A1:X90').format.font={name:FONT,size:11,color:INK};s.getRange('A1:L44').format.rowHeight=25;s.getRange('A:L').format.columnWidth=11;s.tabColor=['Home','Class View','Student View','Seating'].includes(name)?TEAL:['Skill Log','Reviews','Benchmarks','Roster'].includes(name)?'#BB8B38':'#73839A';}
 const students=demo?people.map(([id,name,course,a,b,near,team,seat,zone])=>[id,name,course,near,b===4?'Defend a changed design decision.':b===null?'Arrange an individual baseline.':'Practise a repair with fewer prompts.','Yes',team,seat,zone]):[['TRY01','Practice Learner','MM12','Yes','Record one observed repair.','Yes',1,3,'Front']];
 const assignments=courses.flatMap(course=>{const c=configs[course];return [[c.a,course,c.title,c.skill,c.outcome,c.can,'Baseline',c.change],[c.b,course,c.title+' — changed brief',c.skill,c.outcome,c.can,'Revisit',c.change]];});
 title('Assignments','Assignment connections','Each task joins a course, skill, outcome and observable performance. These are demonstration briefs.','H');
 table('Assignments',['Task ID','Course','Assignment','Skill ID','Outcome / target ID','I-can statement','Stage','Independent change'],assignments,[15,12,32,32,30,47,15,45],84);
 title('Skill Log','What the learner did and learned',demo?'Fictional entries. Each evidence ID is also used in Reviews and Benchmarks.':'Enter an evidence ID once. Add a product, an observation and a conversation as distinct entries.','I');
 table('Skill Log',['Evidence ID','Student ID','Date','Task ID','Skill ID','What I did','What I learned','Evidence reference','Self-rating'],demo?demoLogs:[],[20,15,15,15,30,48,48,42,13],75,200);
 input('Skill Log','A7:I206');list('Skill Log','D7:D206',assignments.map(a=>a[0]));list('Skill Log','E7:E206',Object.values(configs).map(c=>c.skill));bandFormat('Skill Log','I7:I206',true);S['Skill Log'].getRange('C7:C206').setNumberFormat('dd mmm yyyy');
 val('Skill Log','J6','Row helper');for(let r=7;r<=logEnd;r++)formula('Skill Log','J'+r,'=IF(A'+r+'="","",ROW())');
 title('Reviews','Teacher review of the same evidence','Use the evidence ID from Skill Log. Skill and outcome judgments stay separate. IB outcome judgments are intentionally blank in the demo.','K');
 table('Reviews',['Evidence ID','Method','Skill level','Verified','Outcome / target ID','Outcome judgment','Feedback / next step','Instructional help','Review date','Student (linked)','Review accepted'],demo?demoReviews.map(r=>[...r,null,null]):[],[20,18,13,13,29,17,50,20,15,17,19],72,200);
 input('Reviews','A7:I206');list('Reviews','B7:B206',['Product','Observation','Conversation']);list('Reviews','D7:D206',['Yes','No']);list('Reviews','H7:H206',['None','Hints','Modelled']);bandFormat('Reviews','C7:C206',true);S.Reviews.dataValidations.add({range:'F7:F206',rule:{type:'whole',operator:'between',formula1:1,formula2:7}});S.Reviews.getRange('I7:I206').setNumberFormat('dd mmm yyyy');
 for(let r=7;r<=logEnd;r++){
  formula('Reviews','J'+r,'=IF(A'+r+'="","",IF(COUNTIF('+lr('A')+',A'+r+')<>1,"Check evidence ID",INDEX('+lr('B')+',MATCH(A'+r+','+lr('A')+',0))))');
  formula('Reviews','K'+r,'=IF(A'+r+'="","",IF(AND(COUNTIF($A$7:$A$206,A'+r+')=1,COUNTIF('+lr('A')+',A'+r+')=1,D'+r+'="Yes",OR(B'+r+'="Product",B'+r+'="Observation",B'+r+'="Conversation"),ISNUMBER(I'+r+'),I'+r+'<=Home!$J$4,OR(C'+r+'="",AND(ISNUMBER(C'+r+'),C'+r+'=INT(C'+r+'),C'+r+'>=1,C'+r+'<=4))),"Yes","Needs review"))');
 }
 title('Benchmarks','Benchmark attempts','Four criterion ratings plus three verified evidence references. Yellow cells are inputs; right-hand columns explain eligibility.','P');
 table('Benchmarks',['Attempt ID','Student ID','Date','Task ID','Plan / interpret','Technique / reasoning','Check / repair','Explain / transfer','Instructional help','Access supports','Product ID','Observation ID','Conversation ID','Teacher band','Teacher rationale','Verified','Task score /16','Suggested band','Eligible band','Evidence complete','Date / task match','Row helper'],demo?demoBench.map(r=>[...r,...Array(6).fill(null)]):[],[17,14,15,14,15,17,15,17,20,25,18,18,18,16,44,13,16,17,16,20,20,13],64,80);
 input('Benchmarks','A7:P86');bandFormat('Benchmarks','E7:H86',true);bandFormat('Benchmarks','N7:N86',true);list('Benchmarks','I7:I86',['None','Hints','Modelled']);list('Benchmarks','P7:P86',['Yes','No']);list('Benchmarks','D7:D86',assignments.map(a=>a[0]));S.Benchmarks.getRange('C7:C86').setNumberFormat('dd mmm yyyy');
 for(let r=7;r<=benchEnd;r++){
  formula('Benchmarks','Q'+r,'=IF(AND(COUNT(E'+r+':H'+r+')=4,MIN(E'+r+':H'+r+')>=1,MAX(E'+r+':H'+r+')<=4,E'+r+'=INT(E'+r+'),F'+r+'=INT(F'+r+'),G'+r+'=INT(G'+r+'),H'+r+'=INT(H'+r+')),SUM(E'+r+':H'+r+'),"")');
  formula('Benchmarks','R'+r,'=IF(AND(ISNUMBER(Q'+r+'),OR(I'+r+'="None",I'+r+'="Hints",I'+r+'="Modelled")),MIN(MIN(E'+r+':H'+r+'),IF(I'+r+'="None",4,2)),"")');
  const refs=['K','L','M'].flatMap((c,i)=>['COUNTIFS('+lr('A')+','+c+r+','+lr('B')+',B'+r+','+lr('D')+',D'+r+','+lr('H')+',"<>",'+lr('C')+',">0",'+lr('C')+',"<="&C'+r+')=1','COUNTIFS('+vr('A')+','+c+r+','+vr('B')+',"'+['Product','Observation','Conversation'][i]+'",'+vr('K')+',"Yes")=1']);
  formula('Benchmarks','T'+r,'=IF(A'+r+'="","",AND('+refs.join(',')+'))');
  formula('Benchmarks','U'+r,'=IF(A'+r+'="","",IF(AND(COUNTIF('+rr('A')+',B'+r+')=1,COUNTIF(Assignments!$A$7:$A$12,D'+r+')=1),AND(ISNUMBER(C'+r+'),C'+r+'>0,C'+r+'<=Home!$J$4,INDEX('+rr('C')+',MATCH(B'+r+','+rr('A')+',0))=INDEX(Assignments!$B$7:$B$12,MATCH(D'+r+',Assignments!$A$7:$A$12,0))),FALSE))');
  formula('Benchmarks','S'+r,'=IF(AND(A'+r+'<>"",COUNTIF($A$7:$A$86,A'+r+')=1,T'+r+'=TRUE,U'+r+'=TRUE,P'+r+'="Yes",ISNUMBER(R'+r+'),ISNUMBER(N'+r+'),N'+r+'=INT(N'+r+'),N'+r+'>=1,N'+r+'<=4,O'+r+'<>"",OR(I'+r+'="None",N'+r+'<=2)),N'+r+',"")');
  formula('Benchmarks','V'+r,'=IF(A'+r+'="","",ROW())');
 }
 title('Roster','Learners and teaching decisions','Fictional or practice records only. Near-teacher preference, table and seat are teacher decisions. Calculated columns begin at J.','I');
 table('Roster',['Student ID','Name','Course','Near teacher?','Next teaching move','Active','Table','Seat','Table zone','First date','First row','First band','Latest date','Latest row','Current band','Review state','Skill uses','Verified reviews','Route key','Resource route','Course order','Course key','Latest recorded band','Next review'],students.map(r=>[...r,...Array(15).fill(null)]),[15,22,12,16,42,11,10,10,14,...Array(15).fill(18)],52,40);
 input('Roster','A7:I46');list('Roster','C7:C46',courses);list('Roster','D7:D46',['Yes','No']);list('Roster','F7:F46',['Yes','No']);list('Roster','I7:I46',['Front','Middle','Back']);S.Roster.dataValidations.add({range:'G7:G46',rule:{type:'whole',operator:'between',formula1:1,formula2:3}});S.Roster.dataValidations.add({range:'H7:H46',rule:{type:'whole',operator:'between',formula1:1,formula2:4}});
 for(let r=7;r<=rosterEnd;r++){
  const count='COUNTIFS('+br('B')+',A'+r+','+br('S')+',">=1")';
  for(const [c,fn] of [['J','MINIFS'],['M','MAXIFS']])formula('Roster',c+r,'=IF(OR(A'+r+'="",'+count+'=0),"",_xlfn.'+fn+'('+br('C')+','+br('B')+',A'+r+','+br('S')+',">=1"))');
  for(const [c,datecol] of [['K','J'],['N','M']])formula('Roster',c+r,'=IF(ISNUMBER('+datecol+r+'),_xlfn.MAXIFS('+br('V')+','+br('B')+',A'+r+','+br('C')+','+datecol+r+','+br('S')+',">=1"),"")');
  formula('Roster','L'+r,'=IF(ISNUMBER(K'+r+'),INDEX('+br('S')+',K'+r+'-6),"")');
  formula('Roster','W'+r,'=IF(ISNUMBER(N'+r+'),INDEX('+br('S')+',N'+r+'-6),"")');
  formula('Roster','O'+r,'=IF(AND(ISNUMBER(M'+r+'),Home!$J$4-M'+r+'<=Guide!$B$4),W'+r+',"")');
  formula('Roster','P'+r,'=IF(A'+r+'="","",IF(NOT(ISNUMBER(M'+r+')),"Not assessed",IF(O'+r+'="","Review due",IF('+count+'>=2,"Revisited","Provisional"))))');
  formula('Roster','Q'+r,'=IF(A'+r+'="","",COUNTIF('+lr('B')+',A'+r+'))');
  formula('Roster','R'+r,'=IF(A'+r+'="","",COUNTIFS('+vr('J')+',A'+r+','+vr('K')+',"Yes"))');
  formula('Roster','S'+r,'=IF(A'+r+'="","",C'+r+'&"-"&IF(O'+r+'="","check",O'+r+'))');
  formula('Roster','T'+r,'=IF(A'+r+'="","",IF(COUNTIF(Routes!$A$7:$A$21,S'+r+')=1,INDEX(Routes!$D$7:$D$21,MATCH(S'+r+',Routes!$A$7:$A$21,0)),"Check course"))');
  formula('Roster','U'+r,'=IF(A'+r+'="","",COUNTIF($C$7:C'+r+',C'+r+'))');
  formula('Roster','V'+r,'=IF(A'+r+'="","",C'+r+'&"-"&U'+r+')');
  formula('Roster','X'+r,'=IF(ISNUMBER(M'+r+'),M'+r+'+Guide!$B$4,"")');
 }
 for(const c of ['J','M','X'])S.Roster.getRange(c+'7:'+c+'46').setNumberFormat('dd mmm yyyy');for(const c of ['L','O','W'])bandFormat('Roster',c+'7:'+c+'46');
 title('Skills','Skills and assessment criteria','Local skill descriptors. The core target stays visible when the amount of teaching support changes.','G');
 table('Skills',['Skill ID','Course','Skill','Level 1','Level 2','Level 3','Level 4'],Object.values(configs).map(c=>{const sk=D.skills.find(s=>s.id===c.skill);return [sk.id,sk.course,sk.name,...sk.descriptors];}),[31,12,32,42,42,42,42],140);
 merge('Skills','A12:G12','Benchmark criteria used across the demonstration',NAVY,13,true).format.font.color='#FFFFFF';
 const criterion=[['Plan / interpret','Identify the brief, requirements, audience or inquiry focus.'],['Technique / reasoning','Carry out the relevant technical process or explain the digital mechanism.'],['Check / repair','Find an error or weakness, make a correction and inspect its effect.'],['Explain / transfer','Explain a choice and respond to a changed condition.']];
 for(let i=0;i<4;i++){merge('Skills','A'+(14+i*2)+':B'+(15+i*2),criterion[i][0],PALE,12,true);merge('Skills','C'+(14+i*2)+':G'+(15+i*2),criterion[i][1],PALE);}
 title('Routes','Resource routes','Editable teaching suggestions selected from the current course-specific band. The teacher can choose a different route.','H');
 table('Routes',['Route key','Course','Band','Route name','Workbook support','Task adaptation','Shared expectation','Decision'],routeRows,[20,12,10,24,50,55,42,29],91);input('Routes','D7:H21');
 title('Home',demo?'Evidence Map — worked classroom':'Evidence Map — try it yourself',demo?'Fictional semester demonstration. Change a yellow input and follow its effect through the workbook.':'One practice learner is ready. Set the review date to today, then try the exercise below.');
 val('Home','A4','Course');val('Home','B4','MM12');list('Home','B4',courses);input('Home','B4');val('Home','H4','Review date');val('Home','J4',asof);S.Home.getRange('J4:L4').merge();input('Home','J4:L4');S.Home.getRange('J4').setNumberFormat('dd mmm yyyy');
 const cards=[['A6:C6','A7:C8','Active learners','=COUNTIFS('+rr('C')+',$B$4,'+rr('F')+',"Yes")'],['D6:F6','D7:F8','Verified evidence','=SUMIF('+rr('C')+',$B$4,'+rr('R')+')'],['G6:I6','G7:I8','Current bands','=COUNTIFS('+rr('C')+',$B$4,'+rr('O')+',">=1")'],['J6:L6','J7:L8','Near-teacher requests','=COUNTIFS('+rr('C')+',$B$4,'+rr('D')+',"Yes",'+rr('F')+',"Yes")']];
 for(const [label,num,text,f] of cards){merge('Home',label,text,PALE,10,true);merge('Home',num,'',PALE,25,true);formula('Home',num.split(':')[0],f);}
 merge('Home','A10:L10','Explore the connected views',NAVY,12,true).format.font.color='#FFFFFF';
 for(const [cell,target,label] of [['A12','Class View','Class overview'],['D12','Student View','One learner’s story'],['G12','Seating','Classroom seating'],['J12','Guide','How it connects']]){const c=cell.charAt(0);S.Home.getRange(cell+':'+col(c.charCodeAt(0)-65+2)+'13').merge();nav('Home',cell,target,label);}
 merge('Home','A14:E14','Current support distribution',null,13,true);S.Home.getRange('A16:B21').values=[['Band / state','Learners'],['1 — Supported',null],['2 — Developing',null],['3 — Independent',null],['4 — Extending',null],['No current band',null]];
 for(let i=1;i<=4;i++)formula('Home','B'+(16+i),'=COUNTIFS('+rr('C')+',$B$4,'+rr('F')+',"Yes",'+rr('O')+','+i+')');
 formula('Home','B21','=A7-SUM(B17:B20)');S.Home.getRange('A16:B16').format.font.bold=true;S.Home.getRange('A16:A21').format.columnWidth=18;
 const chart=S.Home.charts.add('bar',S.Home.getRange('A16:B21'));chart.title='Learners by current support band';chart.hasLegend=false;chart.titleTextStyle.fontSize=13;chart.titleTextStyle.typeface=FONT;chart.series.items[0].fill=TEAL;chart.setPosition('D15','L25');chart.xAxis={axisType:'textAxis',textStyle:{typeface:FONT,fontSize:10}};chart.yAxis={numberFormatCode:'0.0',numberFormatSourceLinked:false,textStyle:{typeface:FONT,fontSize:10}};
 merge('Home','A27:L27',demo?'Try these changes in the demo':'A five-minute practice exercise',NAVY,12,true).format.font.color='#FFFFFF';
 const steps=demo?[
 '1. Open Student View. Alex Rowan (MM01) moves from 1 to 2; the route changes to Supported choice.',
 '2. In Benchmarks, clear Alex’s revisit criterion E8. His revisit becomes ineligible; the views fall back to the earlier evidence and its review date.',
 '3. Restore E8 to 2. In Roster, change Alex’s near-teacher preference D7 to No. The proximity count and seating note update.',
 '4. In Skill Log, edit Alex’s latest reflection G12. Read the changed sentence in Student View.',
 '5. Choose IBDS in Home. Skill/readiness bands remain local 1–4; the demo does not manufacture an IB outcome grade.'
 ]:[
 '1. Set Home’s review date to today. In Skill Log rows 7–9: IDs TRY-P / TRY-O / TRY-C, student TRY01, today’s date, task PS-A, skill mm12-skill-layers.',
 '2. Add what the learner did, what they learned and an evidence reference. Self-ratings are optional.',
 '3. In Reviews rows 7–9, use the same IDs, methods Product / Observation / Conversation, verified Yes and today’s review date.',
 '4. In Benchmarks row 7, enter TRY-A, TRY01, today’s date, PS-A, four ratings of 2, help Hints, the three evidence IDs, teacher band 2, a rationale and verified Yes.',
 '5. Return to Home and Student View. A current band of 2 and the Supported choice route should appear. Leave incomplete evidence blank.'
 ];
 for(let i=0;i<steps.length;i++)merge('Home','A'+(29+i*2)+':L'+(30+i*2),steps[i],i%2?null:PALE,11);
 merge('Home','A40:L42','Yellow cells are editable. Names, judgments and evidence in the demo are fictional. These files are independent of the application and the earlier Google Sheet: there is no automatic synchronisation. Use the named sheet tabs along the bottom to navigate. The demo’s November review date keeps its fictional semester stable; update the practice review date when trying it later.',null,10);
 title('Class View','Class overview','Course follows Home. Colour shows a current local band; blank means there is no current eligible judgment.','J');
 val('Class View','A4','Course');formula('Class View','B4','=Home!B4');S['Class View'].getRange('I4:J4').merge();nav('Class View','I4','Home','Change course');
 table('Class View',['Student ID','Learner','First band','Current band','Change','Skill uses','Verified evidence','Near teacher?','Resource route','Next teaching move'],[],[15,22,11,12,11,12,14,16,25,38],44,40);
 for(let r=7;r<=46;r++){const key='Home!$B$4&"-"&'+(r-6),found='COUNTIF('+rr('V')+','+key+')=1',ix='MATCH('+key+','+rr('V')+',0)';
  for(const [c,src] of [['A','A'],['B','B'],['C','L'],['D','O'],['F','Q'],['G','R'],['H','D'],['I','T'],['J','E']])formula('Class View',c+r,'=IF('+found+',IF(INDEX('+rr(src)+','+ix+')="","",INDEX('+rr(src)+','+ix+')),"")');
  formula('Class View','E'+r,'=IF(AND(ISNUMBER(C'+r+'),ISNUMBER(D'+r+')),D'+r+'-C'+r+',"")');}
 bandFormat('Class View','C7:D46');S['Class View'].getRange('E7:E46').setNumberFormat('+0;-0;0');
 title('Student View','A learner’s evidence story','Select a student ID. The displayed evidence and recommendations follow the linked records.');
 val('Student View','A4','Student ID');val('Student View','B4',demo?'MM01':'TRY01');S['Student View'].getRange('B4').dataValidation={rule:{type:'list',formula1:'Roster!$A$7:$A$46'}};input('Student View','B4');S['Student View'].getRange('J4:L4').merge();nav('Student View','J4','Class View');
 const ix='MATCH($B$4,'+rr('A')+',0)',has='COUNTIF('+rr('A')+',$B$4)=1',lookup=c=>'IF('+has+',INDEX('+rr(c)+','+ix+'),"")';
 merge('Student View','A6:F8','',PALE,23,true);formula('Student View','A6','='+lookup('B'));merge('Student View','G6:I6','Current band',PALE,10,true);merge('Student View','G7:I8','',PALE,25,true);formula('Student View','G7','=IF('+has+',IF(INDEX('+rr('O')+','+ix+')="","Not assessed",INDEX('+rr('O')+','+ix+')),"")');bandFormat('Student View','G7');
 merge('Student View','J6:L6','Verified evidence',PALE,10,true);merge('Student View','J7:L8','',PALE,25,true);formula('Student View','J7','='+lookup('R'));
 merge('Student View','A10:L10','Support recommendation',NAVY,12,true).format.font.color='#FFFFFF';merge('Student View','A11:D12','',PALE,15,true);formula('Student View','A11','='+lookup('T'));
 merge('Student View','E11:L13','',PALE,11);formula('Student View','E11','=IF('+has+',INDEX(Routes!$E$7:$E$21,MATCH(INDEX('+rr('S')+','+ix+'),Routes!$A$7:$A$21,0)),"")');
 S['Student View'].getRange('A15:C17').values=[['Benchmark','Date','Teacher band'],['First eligible',null,null],['Latest eligible',null,null]];
 for(const [cell,src] of [['B16','J'],['C16','L'],['B17','M'],['C17','W']])formula('Student View',cell,'=IF('+has+',IF(INDEX('+rr(src)+','+ix+')="","",INDEX('+rr(src)+','+ix+')),"")');
 S['Student View'].getRange('B16:B17').setNumberFormat('dd mmm yyyy');bandFormat('Student View','C16:C17');
 merge('Student View','A19:E22','',PALE,11);formula('Student View','A19','=IF('+has+',"Next teaching move: "&INDEX('+rr('E')+','+ix+'),"")');
 const growth=S['Student View'].charts.add('line',[S['Student View'].getRange('A15:A17'),S['Student View'].getRange('C15:C17')]);growth.title='Recorded benchmark bands';growth.hasLegend=false;growth.titleTextStyle.typeface=FONT;growth.titleTextStyle.fontSize=12;growth.series.items[0].fill=TEAL;growth.setPosition('F15','L24');growth.xAxis={axisType:'textAxis',textStyle:{typeface:FONT,fontSize:10}};growth.yAxis={numberFormatCode:'0.0',numberFormatSourceLinked:false,textStyle:{typeface:FONT,fontSize:10}};
 merge('Student View','A25:L25','Latest entered skill claim and teacher response',NAVY,12,true).format.font.color='#FFFFFF';
 formula('Student View','L26','=IF(COUNTIF('+lr('B')+',$B$4)=0,"",_xlfn.MAXIFS(\'Skill Log\'!$J$7:$J$206,'+lr('B')+',$B$4))');val('Student View','J26','Linked row');
 const logIndex='$L$26-6';
 for(const [r,label,src] of [[27,'Evidence ID','A'],[29,'What I did','F'],[32,'What I learned','G'],[35,'Evidence reference','H']]){
  merge('Student View','A'+r+':C'+(r+1),label,PALE,11,true);merge('Student View','D'+r+':L'+(r+1),'',PALE,11);formula('Student View','D'+r,'=IF(ISNUMBER($L$26),INDEX('+lr(src)+','+logIndex+'),"No claim entered yet")');
 }
 merge('Student View','A38:C40','Teacher feedback',PALE,11,true);merge('Student View','D38:L40','',PALE,11);formula('Student View','D38','=IF(ISNUMBER($L$26),IF(COUNTIF('+vr('A')+',$D$27)=1,INDEX('+vr('G')+',MATCH($D$27,'+vr('A')+',0)),"Awaiting teacher review"),"")');
 merge('Student View','A42:L42','Assignment and assessment connection',NAVY,12,true).format.font.color='#FFFFFF';
 const taskLookup='INDEX('+lr('D')+',$L$26-6)',assignmentIndex='MATCH('+taskLookup+',Assignments!$A$7:$A$12,0)';
 for(const [r,label,column] of [[43,'Assignment','C'],[46,'I-can statement','F'],[49,'Outcome / target','E']]){merge('Student View','A'+r+':C'+(r+1),label,PALE,11,true);merge('Student View','D'+r+':L'+(r+1),'',PALE,11);formula('Student View','D'+r,'=IF(ISNUMBER($L$26),IFERROR(INDEX(Assignments!$'+column+'$7:$'+column+'$12,'+assignmentIndex+'),"Check task ID"),"Enter your first claim")');}
 merge('Student View','A52:L54','Open Reviews for the separate skill and outcome judgments, and Skills for the rubric descriptors. A self-rating or readiness band does not assign an outcome grade. Paste the evidence reference above into your browser while the local app is running, or find its ID in Evidence_Packets.html.',null,10);
 S['Student View'].getRange('A41:L54').format.rowHeight=25;
 title('Seating','Teacher-reviewed seating','Course follows Home. Table and seat choices come from Roster; this workbook does not assign students automatically.');
 merge('Seating','A5:L6','TEACHER / BOARD — front of classroom',NAVY,14,true).format.font.color='#FFFFFF';
 const teamCards=[{team:1,start:8},{team:2,start:18},{team:3,start:28}];
 for(const {team,start} of teamCards){merge('Seating','A'+start+':L'+start,'Table '+team,PALE,13,true);
  for(const [seat,range] of [[1,'A'+(start+1)+':F'+(start+3)],[2,'G'+(start+1)+':L'+(start+3)],[3,'A'+(start+4)+':F'+(start+6)],[4,'G'+(start+4)+':L'+(start+6)]]){
   merge('Seating',range,'',null,13,true);const key='Home!$B$4&"-"&'+((team-1)*4+seat);
   // Teacher-selected seats may differ from roster order. SUMIFS finds the unique matching roster row.
   const count='COUNTIFS('+rr('C')+',Home!$B$4,'+rr('G')+','+team+','+rr('H')+','+seat+')',row='SUMIFS('+rr('U')+','+rr('C')+',Home!$B$4,'+rr('G')+','+team+','+rr('H')+','+seat+')';
   const match='MATCH(Home!$B$4&"-"&'+row+','+rr('V')+',0)';
   formula('Seating',range.split(':')[0],'=IF('+count+'=0,"Seat '+seat+' — empty",IF('+count+'>1,"Resolve duplicate seat",INDEX('+rr('B')+','+match+')&CHAR(10)&"Seat '+seat+' · "&INDEX('+rr('I')+','+match+')&CHAR(10)&"Near teacher: "&INDEX('+rr('D')+','+match+')))');}
 }
 merge('Seating','A37:L40','Teacher planning view. A near-teacher request does not move a seat automatically: review the table zone. The Demo workbook includes Sam at a Middle table with a Yes request as a mismatch to resolve. Readiness numbers are omitted from this view. Use a separate student-facing plan when sharing.',PALE,10);
 title('Guide','How the workbook connects','Reference and operating notes. Read this once, then use the four front sheets.','B');
 val('Guide','A4','Review interval');val('Guide','B4',42);val('Guide','A4','Review interval (days)');input('Guide','B4');S.Guide.dataValidations.add({range:'B4',rule:{type:'whole',operator:'between',formula1:1,formula2:365}});
 const notes=[
 ['1. Assignment','Assignments defines the task, skill, I-can statement and outcome. Skill IDs match the application catalogue. COM11 and IBDS target IDs here are local demo identifiers; do not import them as official curriculum IDs.'],
 ['2. Learner claim','Skill Log records what the learner did and learned. One evidence ID identifies one claim or performance. Self-rating stays separate from the teacher’s judgment.'],
 ['3. Teacher review','Reviews uses that same evidence ID to record method, verification, feedback and separate skill/outcome judgments. The underlying artifact reference stays in Skill Log.'],
 ['4. Benchmark','Benchmarks references Product, Observation and Conversation IDs for the named learner and assignment. Four observed criteria produce a task total; the teacher enters a band and rationale. These are local support judgments, not validated Kagan scores or percentages.'],
 ['5. Current view','Roster selects the latest eligible date; the last row breaks a same-day tie. Bands expire after the interval above. Class View, Student View and Home read these formulas. Revisited means two eligible attempts, not psychometric validation.'],
 ['6. Resource route','Routes offers a starting support level. Keep access supports and the core learning goal. A teacher can change the chosen support. Extending means purposeful transfer, not extra decoration or extra pages.'],
 ['7. Seats','Roster has manual table, seat, zone and near-teacher preferences. Seating visualises those decisions. High and low readiness can share a four-person team; avoid treating the most independent student as a permanent tutor.'],
 ['Practice cells','Home lists the exact entries for TRY01. Keep the review date aligned with your test dates. Add roster IDs before evidence. Enter new records in the prepared ranges: 40 learners, 200 claims/reviews and 80 attempts. The seating example has three four-person tables per course. Extend formulas and validation if more rows are needed.'],
 ['Blank and invalid data','Blank evidence does not become level 1. Duplicate IDs, mismatched tasks, unverified methods and missing criterion ratings keep an attempt ineligible. The right side of Benchmarks explains why.'],
 ['Sharing and storage','Demo names and evidence are fictional. Keep a real class workbook private. Save a separate copy before experiments. Excel and Google Sheets do not automatically sync with the Evidence Map application. Use the named sheet tabs along the bottom to navigate.'],
 ['Outcome authority','NS Multimedia source: https://curriculum.novascotia.ca/sites/default/files/documents/outcomes-indicators-files/Multimedia%2012%20Outcomes%20(2015).pdf . IB guide: https://ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/digital-society-guide.pdf . Demo descriptions are teaching interpretations.'],
 ['Grouping reference','Kagan TeamTools manual, pp. 11–12 and 20: https://www.kaganonline.com/catalog/software_documentation/Manual-TeamTools.pdf . Our criterion bands are local teaching rules; the source’s grouping mechanism is not a validation of them.'],
 ['Design and sources','Reference: the teacher’s four shared skill-tracking Google Sheets and the existing Evidence Map catalogue. The demo invents all student work. Typeface: Helvetica Neue, with Excel/Sheets substitution where unavailable. Workbook support follows https://udlguidelines.cast.org/engagement/effort-persistence/challenge-support/ .']
 ];
 table('Guide',['Step / topic','Use and meaning'],notes,[28,115],88);
 // Verify the actual linked workflow, with synthetic tests removed before export.
 const results={mode};
 if(demo){
  assert.equal(S.Home.getRange('A7').values[0][0],12);assert.equal(S.Home.getRange('D7').values[0][0],66);assert.equal(S.Roster.getRange('L7').values[0][0],1);assert.equal(S.Roster.getRange('O7').values[0][0],2);assert.equal(S['Student View'].getRange('A11').values[0][0],'Supported choice');
  const before=S.Benchmarks.getRange('E8').values;S.Benchmarks.getRange('E8').values=[[null]];assert.equal(S.Benchmarks.getRange('S8').values[0][0],'');assert.equal(S.Roster.getRange('O7').values[0][0],'');S.Benchmarks.getRange('E8').values=before;assert.equal(S.Roster.getRange('O7').values[0][0],2);
  const old=S['Skill Log'].getRange('G12').values;S['Skill Log'].getRange('G12').values=[['Changed reflection test']];assert.equal(S['Student View'].getRange('D32').values[0][0],'Changed reflection test');S['Skill Log'].getRange('G12').values=old;
  const wrong=S.Benchmarks.getRange('K8').values;S.Benchmarks.getRange('K8').values=[['MM02-B-1']];assert.equal(S.Benchmarks.getRange('S8').values[0][0],'');S.Benchmarks.getRange('K8').values=wrong;
  val('Home','B4','IBDS');assert.equal(S.Home.getRange('A7').values[0][0],4);assert.equal(S.Home.getRange('D7').values[0][0],24);val('Home','B4','MM12');
  assert.equal(S.Roster.getRange('O10').values[0][0],4);results.workflowChecks='criterion removal, reflection edit, mismatched evidence, course switch and access support separation passed';results.learners=students.length;results.claims=demoLogs.length;results.attempts=demoBench.length;
 }else{
  assert.equal(S.Home.getRange('A7').values[0][0],1);assert.equal(S.Home.getRange('D7').values[0][0],0);assert.equal(S.Roster.getRange('O7').values[0][0],'');
  const ids=['TRY-P','TRY-O','TRY-C'];
  S['Skill Log'].getRange('A7:I9').values=ids.map(id=>[id,'TRY01',asof,'PS-A','mm12-skill-layers','Repaired the mask.','The mask preserves the original.','Practice evidence reference',3]);
  S.Reviews.getRange('A7:I9').values=ids.map((id,i)=>[id,['Product','Observation','Conversation'][i],2,'Yes','ns-mm12-2015-1.1',2,'Try with one fewer prompt.','Hints',asof]);
  S.Benchmarks.getRange('A7:P7').values=[['TRY-A','TRY01',asof,'PS-A',2,2,2,2,'Hints','',...ids,2,'Hints were needed to choose the mask.','Yes']];
  assert.equal(S.Roster.getRange('O7').values[0][0],2);assert.equal(S['Student View'].getRange('A11').values[0][0],'Supported choice');assert.equal(S.Home.getRange('D7').values[0][0],3);
  val('Skill Log','H7',null);assert.equal(S.Benchmarks.getRange('S7').values[0][0],'');val('Skill Log','H7','Practice evidence reference');assert.equal(S.Roster.getRange('O7').values[0][0],2);
  val('Benchmarks','N7',4);assert.equal(S.Benchmarks.getRange('S7').values[0][0],'');val('Benchmarks','N7',2);
  val('Skill Log','A10','TRY-P');assert.equal(S.Benchmarks.getRange('S7').values[0][0],'');val('Skill Log','A10',null);assert.equal(S.Roster.getRange('O7').values[0][0],2);
  S['Skill Log'].getRange('A7:I9').values=Array.from({length:3},()=>Array(9).fill(null));S.Reviews.getRange('A7:I9').values=Array.from({length:3},()=>Array(9).fill(null));S.Benchmarks.getRange('A7:P7').values=[Array(16).fill(null)];
  assert.equal(S.Home.getRange('D7').values[0][0],0);assert.equal(S.Roster.getRange('O7').values[0][0],'');results.practiceWorkflow='passed; test inputs removed';
 }

 const errors=await wb.inspect({kind:'match',searchTerm:'#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A|#NUM!|#NULL!|#SPILL!|#CALC!',options:{useRegex:true,maxResults:20},summary:'formula errors'});
 await fs.writeFile(QA+'/'+mode+'-formula-inspection.txt',errors.ndjson);
 for(const name of names){const vals=S[name].getUsedRange().values;const bad=vals.flat().filter(v=>typeof v==='string'&&/^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/.test(v));assert.deepEqual(bad,[],name);assert.equal(vals.flat().some(v=>typeof v==='string'&&v.includes('is not implemented')),false,name+' unsupported function');}
 const summaries=await wb.inspect({kind:'table',range:'Home!A6:L8',include:'values,formulas',tableMaxRows:3,tableMaxCols:12});await fs.writeFile(QA+'/'+mode+'-summary.txt',summaries.ndjson);
 for(const name of names){if(!demo&&!['Home','Student View'].includes(name))continue;const end={Home:'L42','Class View':'J19','Student View':'L54',Seating:'L40',Assignments:'H9','Skill Log':'I10',Reviews:'K10',Benchmarks:'V9',Roster:'I11',Skills:'G10',Routes:'H10',Guide:'B10'}[name];const img=await wb.render({sheetName:name,range:'A1:'+end,scale:1,format:'png'});await fs.writeFile(QA+'/'+mode+'-'+name.replaceAll(' ','-')+'.png',new Uint8Array(await img.arrayBuffer()));}
 await (await SpreadsheetFile.exportXlsx(wb)).save(OUT+'/Evidence_Map_'+mode+'.xlsx');
 checks.push(results);console.log('Built '+mode,JSON.stringify(results));
}
await build('Demo');await build('Practice');await fs.writeFile(QA+'/checks.json',JSON.stringify(checks,null,2));
const style='<style>body{font:17px/1.6 system-ui;background:#f3f6fa;color:#24384c;margin:0}main{max-width:1100px;padding:36px 24px;margin:auto}h1{font-size:44px;line-height:1.12}h2{font-size:27px}a{color:#167d8d}section,article{padding:24px;background:white;border:1px solid #d3ddea;border-radius:12px;margin:20px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}.button{display:inline-block;background:#172b4d;color:white;padding:12px 20px;text-decoration:none;border-radius:7px}img{max-width:100%;height:auto}small{color:#61758a}@media(max-width:700px){.grid{grid-template-columns:1fr}h1{font-size:34px}}</style>';
await fs.writeFile(OUT+'/Evidence_Packets.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fictional evidence packets</title>'+style+'<main><a href="index.html">Workbook tour</a><h1>Fictional evidence packets</h1><p>These worked examples explain the workbook. They are invented performances and teacher notes, not actual student submissions or Photoshop production files.</p>'+packets.map(p=>'<article id="'+p.eid+'"><small>'+p.eid+' · '+p.course+' · '+p.phase+'</small><h2>'+p.name+' — '+p.method+'</h2><p><b>Performance:</b> '+esc(p.action)+'</p><p><b>Learning reflection:</b> '+esc(p.learn)+'</p><p><b>Teacher response:</b> '+esc(p.feedback)+'</p><p>Illustrative skill level '+p.band+'; instructional help: '+p.help+'. The workbook stores the separate outcome judgment in Reviews.</p></article>').join('')+'</main></html>');
await fs.copyFile(QA+'/Demo-Home.png',OUT+'/Demo_Overview.png');
await fs.copyFile(QA+'/Demo-Student-View.png',OUT+'/Demo_Student_View.png');
await fs.writeFile(OUT+'/index.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Try the Evidence Map workbooks</title>'+style+'<main><a href="../../../help/index.html#workbooks">← Field guide</a><h1>See the whole learning cycle.</h1><p>Explore a fully worked classroom, then try the same connected workbook with one practice learner. The files use formulas, editable charts, course selectors and linked evidence IDs.</p><div class="grid"><section><h2>Explore the demo</h2><p>20 fictional learners across MM12, COM11 and Digital Society. Follow 114 evidence entries and 38 benchmark attempts into resource routes and teacher-reviewed seating.</p><a class="button" href="Evidence_Map_Demo.xlsx" download>Download complete demo</a></section><section><h2>Try it yourself</h2><p>A practice learner is ready, with clear instructions for your first three evidence entries and one benchmark. The formulas and reference sheets are already connected.</p><a class="button" href="Evidence_Map_Practice.xlsx" download>Download practice workbook</a></section></div><h2>Start with Alex</h2><ol><li>Open the Demo workbook’s Home sheet. Choose MM12.</li><li>Open Student View and select MM01. Alex moves from a baseline band of 1 to a revisit band of 2.</li><li>Read the latest claim, reflection and teacher response. Follow its evidence ID into Skill Log, Reviews and Benchmarks.</li><li>Change a criterion or a near-teacher preference using the Home exercises. Watch the linked views respond.</li><li>Use the Practice workbook’s five-minute exercise to enter your own example.</li></ol><img src="Demo_Overview.png" alt="Demo workbook overview with course selector, class totals and support distribution chart"><h2>One learner, connected records</h2><img src="Demo_Student_View.png" alt="Student view showing benchmark growth, support route, evidence and feedback"><section><h2>Keep the meaning clear</h2><p>Every demonstration learner and performance is fictional. Self-ratings, teacher skill judgments, outcome judgments and readiness bands remain separate. Resource routes are suggestions for teacher review. Seats are manually chosen. The demo is not a validated Kagan assessment.</p><p>Workbooks do not automatically sync with the application or the earlier Google Sheet. Use the named sheet tabs in Excel or Google Sheets. Evidence links open these <a href="Evidence_Packets.html">fictional packets</a> while the local application server is running. You can also open Evidence_Packets.html from this folder and find an evidence ID.</p></section></main></html>');
console.log('Built workbook tour and fictional evidence packets.');
