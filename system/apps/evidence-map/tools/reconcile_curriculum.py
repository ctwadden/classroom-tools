from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
mmurl='https://curriculum.novascotia.ca/sites/default/files/documents/outcomes-indicators-files/Multimedia%2012%20Outcomes%20(2015).pdf'
iburl='https://ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/digital-society-guide.pdf'
# Text carried from the supplied legacy course source; the split contextual clause is rejoined.
sound=[('3.2','3.1','I can create and edit sound from music, narration and effects.'),('3.3','3.2','I can explain how sound conveys meaning and relates to other media.'),('3.5','3.3','I can explain my sound production and application workflow.'),('3.6','3.4','I can apply art and design principles to a sound product.'),('3.7','3.5','I can construct sound that communicates an idea.')]
# Local learning targets, explicitly distinct from official IB wording or assessment criteria.
drafts={
'ds-u02-001':'Explain change and expression using a specific digital-society example.',
'ds-u08-001':'Explain an AI system through its inputs, processing and outputs.',
'ds-u08-002':'Distinguish training from inference in an AI example.',
'ds-u08-003':'Compare human decisions and automated decisions in a specific case.',
'ds-u08-004':'Trace a bias risk from data or design to a stakeholder impact.',
'ds-u08-005':'Evaluate an AI intervention using benefits, limitations and evidence.',
'ds-u08-006':'Justify a response to an AI dilemma and identify remaining uncertainty.',
'ds-u09-001':'Analyse the environmental effects of a digital system across its life cycle.',
'ds-u09-002':'Evaluate how a digital system changes access to health services.',
'ds-u09-003':'Explain how digital tools influence learning and the creation of knowledge.',
'ds-u09-004':'Compare stakeholder benefits and costs within a selected context.',
'ds-u09-005':'Support a contextual judgment with relevant evidence and acknowledge its limits.',
'ds-u10-001':'Explain how a digital system changes participation in a political process.',
'ds-u10-002':'Analyse how surveillance redistributes power in a specific case.',
'ds-u10-003':'Compare stakeholder claims about privacy, access and expression.',
'ds-u10-004':'Evaluate a platform or public-policy response to a digital-society issue.',
'ds-u10-005':'Explain how digital access can include or exclude a community.',
'ds-u10-006':'Trace a digital-system decision to an effect on identity or relationships.',
'ds-u10-007':'Compare alternative responses using explicit criteria and evidence.',
'ds-u10-008':'Reach a qualified conclusion that addresses competing stakeholder perspectives.',
'ds-u12-001':'Frame a focused inquiry around a specific digital system and its implications.',
'ds-u12-002':'Connect the inquiry focus to relevant course concepts and contexts.',
'ds-u12-004':'Develop analysis that connects source evidence to impacts and implications.',
'ds-u12-005':'Evaluate alternative perspectives and explain the limits of the conclusion.',
'ds-u12-006':'Discuss a plausible future development using evidence and stated uncertainty.',
'ds-u12-007':'Communicate a coherent inquiry with traceable sources and purposeful media.'}
x={'reviewedAt':'2026-09-14','mmSource':mmurl,'mmPrintedPage':303,'mmPdfPage':4,'ibSource':iburl,'ibEdition':'First assessment 2024; public guide updated February 2023','soundCrosswalk':[{'legacy':old,'current':code,'decision':'Review historical evidence individually; do not move grades automatically.'} for old,code,_ in sound]+[{'legacy':'3.4','current':'3.2','decision':'Split clause of contextual outcome; combine only after reviewing the actual evidence.'},{'legacy':'3.1','current':None,'decision':'Foundational sound-elements target; no separate numbered match in the five-outcome framework.'}],'localIBTargets':drafts}
js='''(function(root){'use strict';const review=DATA;
function apply(courses,activities,sprints){
 const mm=courses.MM12,old=mm.modules.find(m=>m.tag==='M3');mm.legacyModules=[JSON.parse(JSON.stringify(old))];mm.legacyModules[0].outcomes.forEach(o=>o.archived=true);
 const plans=SOUND;
 const current=plans.map(([id,code,friendly])=>{const original=old.outcomes.find(o=>o.id===id);let wording=original.official;if(code==='3.2')wording+=' by examining their form and content; and relationship or potential relationship to other multimedia elements';return {id:'sound-2015-'+code,displayCode:code,oid:'ns-mm12-2015-'+code,title:friendly.replace('I can ','').slice(0,60),official:wording,friendly,look:original.look,authority:'NS published outcome; source checked 2026-09-14',source:review.mmSource,sourcePage:'printed 303 / PDF 4',pending:false};});
 mm.modules=mm.modules.map(m=>m.tag==='M3'?{tag:'M3C',name:'Sound — five published outcomes',outcomes:current}:m);
 mm.modules.forEach(m=>m.outcomes.forEach(o=>{o.oid='ns-mm12-2015-'+(o.displayCode||o.id);}));
 const mappings=Object.fromEntries(review.soundCrosswalk.map(x=>[x.legacy,x.current?'sound-2015-'+x.current:null]));
 activities.MM12.forEach(a=>{a.links=a.links.filter(l=>!(l.o in mappings)||mappings[l.o]).map(l=>({...l,o:l.o in mappings?mappings[l.o]:l.o}));a.links=a.links.filter((l,i,all)=>all.findIndex(x=>x.o===l.o)===i);if(a.assessed)a.assessed=[...new Set(a.assessed.map(id=>id in mappings?mappings[id]:id).filter(Boolean))];if(a.module==='M3')a.module='M3C';});
 sprints.MM12.forEach(sp=>{if(Array.isArray(sp.taught))sp.taught=[...new Set(sp.taught.map(id=>id in mappings?mappings[id]:id).filter(Boolean))];});
 courses.IBDS.source='Local learning targets mapped to the IB Digital Society guide. These are not verbatim IB outcomes or official markschemes.';
 courses.IBDS.modules.forEach(m=>m.outcomes.forEach(o=>{o.priorWording=o.official;if(review.localIBTargets[o.id]){o.official=review.localIBTargets[o.id];o.friendly='I can '+o.official.charAt(0).toLowerCase()+o.official.slice(1);o.title=o.official.slice(0,62);o.look=['Explains the mechanism or concept accurately','Uses relevant evidence and addresses limitations'];}o.pending=false;o.authority='Local learning target — not official IB wording';o.source=review.ibSource;const unit=o.id.slice(3,6);o.sourcePage=({u01:'Section 1.1; printed 24',u02:'Concepts 2.1–2.7; printed 25–28',u03:'Content 3.1; printed 29–30',u04:'Content 3.2 and 3.6; printed 30, 33',u05:'Content 3.3; printed 30–31',u06:'Content 3.4; printed 31–32',u07:'Content 3.5; printed 32',u08:'Content 3.6; printed 33',u09:'Contexts 4.3–4.5; printed 36–37',u10:'Contexts 4.6–4.7; printed 37–38',u12:'Internal assessment; printed 57–65'})[unit]||'See source guide';}));
 return review;
}
root.CurriculumReview={apply,review};})(window);
'''.replace('DATA',json.dumps(x,ensure_ascii=False)).replace('SOUND',json.dumps(sound,ensure_ascii=False))
(ROOT/'curriculum-review.js').write_text(js)
(ROOT/'help/Curriculum_Reconciliation.json').write_text(json.dumps(x,ensure_ascii=False,indent=2))
# The planning source already uses the published five Sound codes. Re-key by those
# reviewed codes, never by the old application's ordinal portable IDs.
path=ROOT/'outputs/gold-standard-2026/Consolidated_Course_Data.json'
data=json.loads(path.read_text()); mapping={o['id']:'ns-mm12-2015-'+o['code'] for o in data['outcomes'] if o['course']=='MM12'}
def remap(value):
 if isinstance(value,str):return mapping.get(value,value)
 if isinstance(value,list):return [remap(v) for v in value]
 if isinstance(value,dict):return {k:remap(v) for k,v in value.items()}
 return value
data=remap(data)
for o in data['outcomes']:
 if o['course']=='MM12':o['authority']='NS published code; planning paraphrase; source checked 2026-09-14';o['source_url']=mmurl
 if o['course']=='IBDS':o['authority']='Local planning target mapped to IB guide; not verbatim official wording';o['source_url']=iburl
path.write_text(json.dumps(data,ensure_ascii=False,indent=2))
