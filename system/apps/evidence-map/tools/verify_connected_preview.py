"""Exercise the deployed preview with fictional data. Never writes production records."""
import json, pathlib, urllib.request, urllib.error, uuid
root=pathlib.Path(__file__).resolve().parents[1]
deploy=json.loads((root/'private/connected-preview-deploy.json').read_text())
base=deploy['deploy_url']
assert '--outcome-evidence-map.netlify.app' in base, 'Preview URL required'
secrets=json.loads((root/'private/preview-test-keys.json').read_text())
keys={'teacher':secrets['EVIDENCE_MAP_TEACHER_SECRET'],'google':secrets['EVIDENCE_MAP_INGEST_SECRET'],'reader':secrets['EVIDENCE_MAP_READ_SECRET']}
results=[]
def call(action,body=None,role='teacher'):
    req=urllib.request.Request(base+'/.netlify/functions/evidence-bridge?action='+action+'&course_id=MM12',data=json.dumps(body).encode() if body is not None else None,headers={'Authorization':'Bearer '+keys[role],'Content-Type':'application/json'})
    try:
        with urllib.request.urlopen(req,timeout=40) as res:return res.status,json.load(res)
    except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
def check(name,ok):
    results.append({'check':name,'passed':bool(ok)});print(name, 'PASS' if ok else 'FAIL',flush=True)
    assert ok,name
run=uuid.uuid4().hex[:12];learner='lrn_fixture_'+run;eid='fixture_'+run
code,body=call('roster',{'course_id':'MM12','learners':[{'learner_id':learner,'display_name':'Fictional connection test','active':True}]},'google');check('Google roster accepted in preview',code==200)
event={'event_id':eid,'source_revision':2,'learner_id':learner,'course_id':'MM12','project_id':'PS-TRUCK-AD','canonical_id':'TA-OBS-01','stream':'evidence','outcome_codes_raw':'MM12-1.1','evidence_type_raw':'Observation+Conversation','teacher_note':'Fictional: repaired and explained the editable mask.','step_id':'TA-S03','level_raw':'3 - Secure','independence_raw':'Guided','teacher_verified':'false','timestamp':'2026-09-23T12:00:00Z'}
code,r=call('events',{'events':[event]},'google');check('Evidence note and step accepted',code==200 and r['results'][eid]['ok'])
code,r=call('events',{'events':[event]},'google');check('Retry is idempotent',r['results'][eid]['dedup'])
code,s=call('snapshot');es=[e for e in s.get('events',[]) if e['event_id']==eid];check('One record with both O and C methods',len(es)==1 and es[0]['methods']==['Observation','Conversation']);check('False verification remains false',es[0]['teacher_verified'] is False);check('No grade created by intake',not any(p['learner_id']==learner for p in s['progress']))
review={'review_id':'review_'+run,'learner_id':learner,'course_id':'MM12','outcome_id':'ns-mm12-2015-1.1','achievement':'Extending','support':'Guided','rationale':'Fictional test of explicit teacher judgment with support separate.','comment':'Fictional comment for connection testing.','evidence_ids':[eid],'parents':[]}
code,r=call('review',review,'reader');check('Reader cannot write grades',code==403)
code,r=call('review',review);check('Teacher judgment persists',code==200 and r['ok'])
code,r=call('progress',role='google');p=next(p for p in r['progress'] if p['learner_id']==learner);check('Google sees the same judgment and comment',p['achievement']=='Extending' and p['support']=='Guided' and p['comment']==review['comment'])
code,r=call('review',review);check('Review retry is idempotent',code==200 and r['dedup'])
review['review_id']='stale_'+run;code,r=call('review',review);check('Stale device write rejected',code==409)
code,r=call('rubric',{'course_id':'MM12','rubric_id':'MM12-TRUCK-AD-R1','confirmed':True});check('Teacher-reviewed rubric downloadable',code==200)
field={**event,'event_id':'field_'+run,'source_revision':1,'rubric_id':'MM12-TRUCK-AD-R1','rubric_version':'2026-09-23.1','criterion_id':'TA-MM-C1'}
code,r=call('events',{'events':[field]});check('iPad contract capture accepted',code==200 and r['results'][field['event_id']]['ok'])
report={'preview_url':base,'deploy_id':deploy['deploy_id'],'fictional_test_only':True,'checks':results,'production_student_records_written':False}
(root/'outputs/connected-system-handoff-2026-09-23/DEPLOYED_PREVIEW_TESTS.json').write_text(json.dumps(report,indent=2)+'\n')
print('All deployed preview checks passed.',flush=True)
