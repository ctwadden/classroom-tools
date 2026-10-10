from pathlib import Path
import json,re,shutil,sys

ROOT=Path(__file__).resolve().parents[1]
# The checked-in consolidated catalogue is the reproducible default build input.
# Reconciliation from a private intake is an explicit opt-in maintenance operation.
if '--private-intake' not in sys.argv:
    canonical=ROOT/'outputs/gold-standard-2026/Consolidated_Course_Data.json'
    payload=json.loads(canonical.read_text())
    assert all(k in payload for k in ['skills','lessons','outcomes','diagnosticRubrics'])
    (ROOT/'studio-data.js').write_text('window.STUDIO_DATA = '+json.dumps(payload,ensure_ascii=False).replace('</','<\\/')+';\n')
    print('Built Studio data from the versioned consolidated catalogue')
    raise SystemExit(0)
INTAKE=Path(sys.argv[sys.argv.index('--private-intake')+1])
OUT=ROOT/'outputs/gold-standard-2026'
OUT.mkdir(parents=True,exist_ok=True)
texts=json.loads((INTAKE/'texts.json').read_text())
books=json.loads((INTAKE/'sheets.json').read_text())
catalog=json.loads((INTAKE/'catalog.json').read_text())
def source(suffix):return next(v for k,v in texts.items() if k.endswith(suffix))
base=json.loads(source('Course_System.json'))
revision=json.loads(source('Studio_Revision.json'))
advertising=json.loads(source('Advertising_Sprint.json'))
daily=next(v for k,v in books.items() if k.endswith('Daily_Lessons_and_Planned_Gradebooks.xlsx'))
def sheet(name):return next(s['values'] for s in daily if s['name']==name)
def date(v):return str(v)[:10] if v else None
lessons=[]
for course in ['MM12','COM11','IBDS']:
    md=source({'MM12':'Multimedia_12_Day_by_Day.md','COM11':'Communication_11_Day_by_Day.md','IBDS':'IB_Digital_Society_Day_by_Day.md'}[course])
    sections=re.split(r'^### Day (\d+) — .*?\n',md,flags=re.M)
    details={int(sections[i]):sections[i+1] for i in range(1,len(sections),2)}
    for r in sheet(course+' Lessons')[4:]:
        if not r[2]:continue
        lessons.append(dict(id=r[2],course=course,date=date(r[0]),day=r[1],title=r[3],minutes=70,student_work=r[5],new_learning=r[6],builds_on=r[7],prepares_for=r[8],independent_check=r[9],assessment_ids=r[10],materials_status='Planning draft',formal_ia_minutes=r[13] or 0,detail=details.get(r[1],''),source='Daily Lessons and Planned Gradebooks',sequence='dated'))
changes=[]
for l in revision['lessons']:
    old=next(x for x in lessons if x['id']==l['id'])
    changes.append({'id':l['id'],'course':l['course'],'before':old['title'],'after':l['title'],'reason':'Citrus revision matches the dated base IDs and provides five explicit studio builds.'})
    old.update(l);old.update(sequence='dated',source='Studio Revision; dated base retained',minutes=l['allocated_minutes'],detail='',materials_status='Needs photographs and genuine demonstration captures')
for l in base['lessons']:lessons.append({**l,'sequence':'architecture','source':'Course System v2','date':None})
for l in advertising['lessons']:lessons.append({**l,'sequence':'sneaker','source':'Studio Advertising Release','materials_status':'Alternative; Photoshop rehearsal and captures outstanding','steps':[s for s in advertising['steps'] if s['id'] in l['step_ids']]})
assessments=[]
for r in sheet('Assessments')[4:]:
    if not r[0]:continue
    assessments.append(dict(id=r[0],course=r[1],date=date(r[2]),title=r[3],purpose=r[4],method=r[5],score_mode=r[6],maximum=r[7],status='Awaiting evidence',outcome_ids=[v for v in str(r[9]).split('|') if v],rubric=r[10],prediction_role=r[11],display_name=r[12],lesson_ids=str(r[13] or '').split('; '),score=None))
for a in revision['assessments']:
    old=next(x for x in assessments if x['id']==a['id'])
    old.update(title=a['title'],date=a['due_date'],rubric=a['rubric_id'],outcome_ids=a['assessed_outcome_ids'],lesson_ids=a['lesson_ids'],bundle=a['evidence_bundle_id'],counting_rule=a['counting_rule'])

skills=[]
def add(course,key,name,codes,proof,repair,transfer,domain='Course skill'):
    skills.append(dict(id=(course.lower()+'-skill-'+key),course=course,name=name,outcome_codes=codes,domain=domain,evidence=proof,next_step=repair,descriptors=[f'Required evidence is not yet demonstrated: {proof}',f'Parts of the task work; the learner uses specific prompts to complete or explain the decision.',f'Independently demonstrates: {proof}',transfer],authority='Teacher-designed skill; proposed outcome links, not official rubric wording'))
mm=[
('layers','Editable layers and masks',['1.1','1.3'],'Selects the intended layer or mask, hides and restores an area, and reopens a layered master.','Practise one conceal/restore repair on the correct thumbnail.','Repairs a changed edge or overlap and explains why the chosen control works.'),
('hierarchy','Visual hierarchy and typography',['1.4','1.5'],'Makes the message, supporting information and action readable in the intended order.','Change one size, contrast or spacing variable and repeat the reader test.','Recomposes for a different format while preserving and defending the reading order.'),
('integration','Image integration and lighting',['1.1','1.4'],'Uses consistent overlap, relative scale and light cues to place a subject in a scene.','Identify one conflicting light or depth cue before editing.','Adapts to a new source angle or light direction and explains the trade-off.'),
('capture','Original image capture',['1.1','1.3'],'Produces a focused, intentionally exposed source image and explains its intended use.','Compare two exposures or light positions using a stable camera.','Adjusts capture decisions for a changed production brief and defends the selected source.'),
('meaning','Context and representation',['1.2','4.2'],'Uses visible features and source context to explain how an image represents an idea.','Separate what is visible from an inference about audience response.','Compares two contextual readings and explains the limits of the evidence.'),
('motion','Motion and timing',['2.1','2.4','2.5'],'Uses timed movement and transitions to communicate an intended sequence.','Compare two timings and predict how the emphasis changes.','Adapts timing to a changed duration while retaining the communication goal.'),
('motion-workflow','Motion production workflow',['2.3'],'Organises a timeline and assets and checks a rendered output against the brief.','Name sources, locate a missing asset and inspect the actual render.','Diagnoses a changed frame size or duration requirement and delivers a working revision.'),
('audio','Sound capture and editing',['3.1','3.3'],'Creates an intelligible sound sequence with deliberate edits and usable levels.','Record a short test, listen for the fault and change one cause.','Repairs an unfamiliar noise or timing problem and explains the compromise.'),
('sound-meaning','Sound and image relationships',['3.2','3.4','3.5'],'Explains how a sound choice changes the meaning of the same image sequence.','Compare the same scene with two sound treatments.','Creates and defends an alternate sound treatment for a new audience or mood.'),
('delivery','Production delivery and source log',['1.3','2.3','3.3','4.4'],'Delivers editable sources, a checked viewing copy and a usable asset/source log.','Reopen the exported file and verify dimensions, links and source credits.','Solves a changed delivery requirement without losing the editable master or provenance.'),
('collaboration','Individual contribution to a production',['4.3'],'Identifies their own contribution and supplies a version or observed action that demonstrates it.','Allocate a small production responsibility and record the handoff.','Coordinates an unfamiliar dependency and shows how others can continue from the handoff.'),
('portfolio','Portfolio and next pathway',['4.4','4.5'],'Selects contrasting work, explains growth and connects one skill to an actual pathway.','Choose a before/after pair and name the next action.','Recurates for a different audience and supports a realistic next training or career decision.')]
com=[
('brief','Audience and design brief',['1.4'],'States the audience, intended action and a testable success criterion.','Ask a peer to interpret the message before explaining it.','Revises a design for a changed audience and explains why the earlier solution no longer fits.'),
('mask','Editable image and text construction',['4.4'],'Keeps image and text editable and repairs a relevant mask or layer.','Practise selecting the correct layer and restoring one hidden area.','Transfers the process from an advertisement to a label or sign with a new layout constraint.'),
('type','Typography and hierarchy',['4.1','4.3'],'Uses legible type, contrast and spacing to give the design a clear reading order.','Test the smallest text at the real viewing size.','Adapts typography for a new viewing distance and justifies the changes.'),
('colour','Colour choices',['4.2'],'Selects a colour relationship and checks that foreground content remains readable.','Compare the design in greyscale and adjust contrast.','Changes a palette for a new brief while preserving readable information.'),
('camera','Camera care and composition',['2.1','2.2'],'Handles the camera and tripod correctly and makes an intentional composition.','Rehearse care and a stable framing procedure under supervision.','Selects and defends a different capture setup for a changed subject.'),
('light','Lighting comparison',['2.3'],'Records two light setups and explains the visible effect on the subject.','Change one light variable while keeping camera and subject fixed.','Selects a setup for a new mood or surface and explains a limitation.'),
('output','Image resolution and export',['2.4','4.5'],'Chooses dimensions and a file format for the actual destination and checks the export.','Reopen the viewing copy and compare its properties with the brief.','Adapts a design to another delivery context and explains quality/file-size trade-offs.'),
('scale','Technical modelling and scale',['3.1','3.2','3.3'],'Creates a dimensioned model or drawing whose units and views agree.','Check one real dimension against the drawing before producing material.','Adapts a component to a new size and checks fit without silently changing units.'),
('safety','Tool-specific safety demonstration',['1.7'],'Demonstrates the named tool procedure, required protection and stop condition under teacher observation.','Reteach the exact missed safety action and observe another attempt.','Identifies a changed unsafe condition and stops or seeks authorisation before continuing.'),
('prototype','Prototype, fit and revision',['1.3','1.4'],'Measures a prototype against a success criterion and documents one justified revision.','Test a small paper or material coupon before the full build.','Explains a failed fit or function and changes the relevant dimension or process.'),
('lifecycle','Materials and life cycle',['1.5','1.6'],'Compares sourcing, use and end-of-life consequences of a design material or device.','Trace one material through production, use and disposal.','Uses evidence to defend a different material choice under a changed constraint.'),
('portfolio','Documenting production and pathways',['1.2','1.3'],'Keeps process evidence and explains a personal skill goal connected to a pathway.','Select a process photo and annotate the decision it proves.','Curates evidence for a new audience and identifies a realistic next training step.')]
ds=[
('mechanism','Explain a digital mechanism',['3.1','3.2','2.6'],'Traces input, processing, output and a meaningful feedback or decision point.','Draw the steps and identify where a human rule enters the system.','Transfers the mechanism explanation to an unfamiliar system and states a limitation.'),
('data','Data quality and representation',['3.1','2.3'],'Distinguishes recorded data, a derived inference and an omitted perspective.','Identify one way collection or labelling can change the result.','Predicts how a new collection rule would change a stakeholder outcome.'),
('algorithm','Rules, thresholds and trade-offs',['3.2','2.4','2.7'],'Applies a stated decision rule and explains who experiences each type of error.','Trace one case just below and one just above the threshold.','Explains the costs of changing the rule without calling a score a probability.'),
('network','Computers, networks and dependencies',['3.3','3.4','2.6'],'Explains how a dependency or access control changes the delivery of a digital service.','Map one service path and identify a failure point.','Predicts effects of an unfamiliar outage or access change with a clear causal chain.'),
('sources','Source credibility and provenance',['3.5','4.5'],'Identifies author, purpose, date, evidence and a limitation of a source.','Separate a supported claim from a promotional or unsupported statement.','Weighs conflicting sources and states what further evidence would change the conclusion.'),
('stakeholders','Stakeholder consequences',['2.4','2.7','4.7'],'Links a digital-system feature to a specific consequence for named stakeholders.','Replace a list of benefits/risks with one because/therefore explanation.','Explains an unequal effect and tests a plausible mitigation against another stakeholder.'),
('concepts','Use concepts to explain',['2.1','2.4','2.6','2.7'],'Uses a relevant concept to explain a relationship within the case.','Explain how power, systems or values changes the interpretation.','Connects two concepts without merely listing their names and defends the connection.'),
('judgement','Evidence-based judgement',['2.7','4.7'],'Makes a supported judgement and names a condition under which it should change.','Link claim, case evidence, reasoning and qualification.','Weighs competing criteria and explains why one carries more weight in a changed context.'),
('synthesis','Synthesis across sources',['3.5','4.5'],'Combines two sources around one claim while distinguishing their contributions.','Write a sentence showing agreement, tension or complementarity between sources.','Builds a qualified conclusion that neither source supports on its own.'),
('inquiry','Focused inquiry and ethics',['2.6','2.7','4.5'],'Frames a bounded inquiry around a real system, stakeholders and an evidence need.','Narrow the place, system, group or period and identify what can be investigated.','Refines the question when evidence exposes an assumption without changing to an unbounded topic.'),
('futures','Trends and plausible futures',['2.1','3.6','3.7'],'Distinguishes a sourced trend from a prediction and states its assumptions.','Identify the mechanism that could extend or interrupt a trend.','Compares plausible scenarios and explains the evidence that would favour each.'),
('communication','Communicate and defend reasoning',['3.5','4.5'],'Communicates a causal argument and answers a neutral follow-up using evidence.','Annotate one claim and rehearse pointing to its supporting evidence.','Adapts the explanation to a new audience or question without losing accuracy.')]
for c,rows in [('MM12',mm),('COM11',com),('IBDS',ds)]:
    for args in rows:add(c,*args)
shared=[('turns','Balanced participation','Takes an agreed turn and makes space for another contribution.','Use a visible turn order and a brief think/write pause.','Helps the team restore balanced participation without taking over.'),('coach','Coach without taking over','Asks a useful question while the partner controls their own work.','Use a question or checkpoint before offering a solution.','Adapts coaching to a new difficulty and checks that the partner can act independently.'),('feedback','Use feedback and revise','Identifies feedback, makes a relevant change and explains its effect.','Record one before/after comparison and the reason for the edit.','Tests conflicting feedback and defends the revision against the brief.'),('goal','Plan a small next step','Names a feasible next action and the evidence that will show it happened.','Choose one action for the next lesson and a check date.','Revises the goal using evidence and explains what support helped.')]
for key,name,proof,repair,transfer in shared:add('ALL',key,name,[],proof,repair,transfer,'Learning and cooperation')

rubrics={
'PS':[
{'name':'Editable control','skills':['layers','mask'],'bands':['The file cannot yet be revised at the required layer or mask.','The edit works in part; a relevant repair needs an instructional hint.','The student selects the right control, hides/restores the required area and preserves editable content.','The student adapts the mask or layer arrangement to the changed condition and explains the choice.']},
{'name':'Message and hierarchy','skills':['hierarchy','type'],'bands':['The event or main message cannot be read from the submitted design.','The event is identifiable but competing elements or unreadable detail weaken the message.','The intended audience can identify the event, supporting detail and action in a deliberate reading order.','A changed communication priority retains a clear message through a justified recomposition.']},
{'name':'Diagnosis and revision','skills':['delivery','prototype'],'bands':['The visible fault is not located and the attempted edit does not address it.','A relevant change occurs after a hint; its effect is only partly checked.','The student identifies the fault, changes a relevant cause and checks the before/after result.','The student diagnoses a new but related fault, tests a repair and explains a trade-off.']},
{'name':'Explain and transfer','skills':['delivery','brief'],'bands':['The student cannot yet connect the chosen control or design to its effect.','The explanation names a tool or preference but needs prompts to connect cause and effect.','The student points to the actual file and explains how a decision produces its visible effect.','The student predicts a changed-condition result, performs the change and explains the result accurately.']}],
'DS':[
{'name':'Mechanism','bands':['The input-to-decision explanation is missing or reverses the stated rule.','Some steps are correct but a causal link requires a prompt.','The input, rule, output and human decision point are explained accurately.','A changed rule is traced accurately and the explanation identifies the model limit.']},
{'name':'Source use','bands':['A claim is repeated without identifying supporting source information.','A source is identified but credibility or limitation is generic.','A specific source feature supports the claim and a relevant limitation is identified.','The sources’ different contributions and limitations are weighed, and a further evidence need is justified.']},
{'name':'Stakeholder reasoning','bands':['An effect is named without connecting it to the digital decision.','A simple consequence is partly connected to the mechanism.','A mechanism feature is linked to different consequences for two stakeholders.','A changed threshold is used to explain redistribution of benefit and error costs.']},
{'name':'Qualified judgement','bands':['A preference is asserted without evidence or a reason.','A reason is present but little case evidence or qualification is used.','The judgement uses case evidence and a condition that could change it.','Competing priorities are weighed and a plausible alternative is tested under a changed condition.']}]
}

files=[]
for name in ['Daily_Lessons_and_Planned_Gradebooks.xlsx','IB_DS_Full_Year_Plan_and_Prediction.xlsx','Semester_Assessment_and_Evidence_Map.xlsx']:
    source=Path('/Users/cdawg/Downloads')/name
    if source.exists():shutil.copy2(source,OUT/name)
    elif not (OUT/name).exists():raise FileNotFoundError(name)
    files.append({'name':name.replace('_',' ').replace('.xlsx',''),'path':'outputs/gold-standard-2026/'+name,'kind':'Original Excel reference','note':'Preserved unchanged; use the consolidated workbook for the current skill/diagnostic system.'})
refs=OUT/'reference-notes';refs.mkdir(exist_ok=True)
for i,(label,content) in enumerate(texts.items()):
    if not label.endswith('.md'):continue
    name=f'{i+1:02d}-'+Path(label).name
    (refs/name).write_text(content)
    files.append({'name':Path(label).stem.replace('_',' '),'path':'outputs/gold-standard-2026/reference-notes/'+name,'kind':'Source notes','note':'Preserved reference. Embedded prompts are proposals, not automatically executed instructions.'})
sources=[{'name':Path(c['source']).name,'source':c['source'],'sha256':c.get('sha256',''),'bytes':c.get('bytes',0),'duplicate_of':c.get('duplicate_of'),'status':'Duplicate preserved in original location' if c.get('duplicate_of') else 'Inventoried and extracted' if c.get('extracted') or c.get('sheets') or c['source'].endswith(('.pdf','.docx','.epub')) else 'Archive or supporting entry'} for c in catalog]
data={'version':'2026-09-13','periodMinutes':70,'skills':skills,'diagnosticRubrics':rubrics,'lessons':lessons,'assessments':assessments,'sprints':base['sprints'],'outcomes':base['outcomes'],'rubrics':base['rubrics']+revision['rubrics'],'changes':changes,'sources':sources,'files':files,'counts':{'sourceEntries':len(catalog),'uniqueSources':len({x.get('sha256') for x in catalog}),'duplicates':sum('duplicate_of' in x for x in catalog),'activeLessons':sum(l['sequence']=='dated' for l in lessons),'skills':len(skills)},'research':[
{'title':'Kagan: principles of cooperative learning','url':'https://www.kaganonline.com/free_articles/dr_spencer_kagan/345/The-P-and-I-of-PIES-Powerful-Principles-for-Success','use':'Shared benefit, individual evidence, balanced turns and many active pairs.'},
{'title':'Kagan: heterogeneous teams','url':'https://www.kaganonline.com/free_articles/dr_spencer_kagan/396/10-Reasons-to-Use-Heterogeneous-Teams','use':'Teacher-designed mixed teams. This is the provider’s rationale, not independent validation of this diagnostic.'},
{'title':'Kagan: TeamTools manual','url':'https://www.kaganonline.com/catalog/software_documentation/Manual-TeamTools.pdf','use':'Score input, relative achievement groups and private teacher review. Our criterion bands are a separate local instrument.'},
{'title':'Kagan: pairs and teams','url':'https://www.kaganonline.com/free_articles/dr_spencer_kagan/532/Pairs_vs._Teams','use':'Use a base team of four and frequent partner work with balanced turns.'},
{'title':'Learning styles: Concepts and evidence','url':'https://journals.sagepub.com/doi/pdf/10.1111/j.1539-6053.2009.01038.x','use':'Do not infer a fixed learning style or match assessment to a style label. Record access needs and useful supports.'},
{'title':'Nova Scotia Multimedia 12','url':'https://curriculum.novascotia.ca/english-programs/course/multimedia-12','use':'Official curriculum source. Sound has five numbered outcomes in the linked 2015 framework; legacy app sound mapping needs review.'},
{'title':'Nova Scotia Communications Technology 11 outcomes','url':'https://curriculum.novascotia.ca/sites/default/files/documents/outcomes-indicators-files/Communications%20Technology%2011%20Outcomes%20%282015%29.pdf','use':'Proposed local skills linked to official codes; selected course route requires teacher confirmation.'},
{'title':'IB Digital Society guide','url':'https://ibo.org/globalassets/new-structure/university-admission/pdfs/subject-guides/digital-society-guide.pdf','use':'SL component weighting is distinct from a diagnostic rubric. Confirm the applicable session guide and boundaries.'},
{'title':'Adobe: layer masks','url':'https://helpx.adobe.com/photoshop/desktop/create-masks/layer-masks/add-layer-masks.html','use':'Current mask controls; classroom rehearsal on Photoshop 27.10 is recorded separately.'},
{'title':'Show Your Work: Assessment in the Age of AI','url':'https://stars.library.ucf.edu/oer/12/','use':'Yee, Uttich, Giltner and Bojanowski (2026). Local PDF inspected: process revisions and individual performance/explanation.'}
]}
(ROOT/'studio-data.js').write_text('window.STUDIO_DATA = '+json.dumps(data,ensure_ascii=False).replace('</','<\\/')+';\n')
(OUT/'Consolidated_Course_Data.json').write_text(json.dumps(data,indent=2,ensure_ascii=False))
(OUT/'Source_Manifest.json').write_text(json.dumps(sources,indent=2,ensure_ascii=False))
print(json.dumps(data['counts']))
