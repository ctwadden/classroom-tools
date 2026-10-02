from pathlib import Path
p=Path(__file__).resolve().parents[1]/'index.html'
s=p.read_text()
s=s.replace('    return data;\n  }\n  function exportJSON()', '    data.studio=window.EvidenceStudio.exportState();\n    return data;\n  }\n  function exportJSON()')
s=s.replace('      if(!confirm("Import this backup?', '      if(d.studio){const errors=window.EvidenceStudio.validateState(d.studio);if(errors.length){toast("Invalid studio backup: "+errors[0]);return;}}\n      if(!confirm("Import this backup?')
s=s.replace('      save(); saveRosters();\n      renderSelectors();', '      save(); saveRosters();\n      if(d.studio)window.EvidenceStudio.restoreState(d.studio);\n      student=STUDENTS[course][0]?.id;\n      renderSelectors();')
s=s.replace('course=e.target.value;student=STUDENTS[course][0].id;', 'course=e.target.value;window.EvidenceStudio.resetView();student=STUDENTS[course][0].id;')
s=s.replace('course=t.dataset.course;student=STUDENTS[course][0].id;', 'course=t.dataset.course;window.EvidenceStudio.resetView();student=STUDENTS[course][0].id;')
s=s.replace('return t+". Judgment is triangulated across product, conversation and observation.";', 'return t+". Review the recorded evidence and agree a next step.";')
s=s.replace('Note that evidence is triangulated across product, conversation and observation.', 'Do not claim multiple evidence methods unless the supplied information establishes them.')
s=s.replace('Every row is backed by stored evidence — nothing here is invented.', 'Legacy outcome review. Sample rosters contain demonstration data. Use task-specific evidence in the new studio before deciding marks.')
s=s.replace('PowerTeacher Pro — import files','School export mapping requires verification')
start=s.find('Workflow: create the assignment in PowerTeacher Pro')
end=s.find('</div>',start)
if start>=0:s=s[:start]+'These files are review snapshots. A school-specific PowerTeacher template and an approved reporting policy are required before grade import. Local readiness bands, observed skill levels and IB grades have different meanings. No automatic percentage conversion is configured.'+s[end:]
s=s.replace('const conv=isPlusScale(cid)?"Beginning 60 · Developing 70 · Secure 80 · Extending 90 · + adds 5":"IB grade × 100 ÷ 7";', 'const conv="Teacher reporting policy required";')
s=s.replace('Proposed course mark <span class="aiflag">calculated · you approve</span>', 'Teacher course mark <span class="aiflag">manual judgement</span>')
s=s.replace('/ 100 — averaged from ${scaleName(cid)} levels (${conv}). ${propMark!=null?"proposed "+propMark:"no judgments yet"}. You confirm.', '/ 100 — enter only under your approved reporting policy. Readiness bands and IB 1–7 levels are not converted to percentages. Existing teacher marks are preserved.')
s=s.replace('id="dlScores">${dlIcon}Score CSV','id="dlScores">${dlIcon}Blank score review CSV')
s=s.replace('csvq("Percent"),csvq(100)', 'csvq("Unconfigured — school review required"),csvq("")')
s=s.replace('const csvq=v=>`"${String(v==null?"":v).replace(/"/g,\'""\')}"`;', 'const csvq=v=>`"${window.StudioCore.csv([[v]]).slice(2,-1)}"`;')
# The original imported map is preserved. Clearly quarantine inaccurate Sound wording/IDs.
needle='  buildOidMap(); SKILLS=buildSkills();'
replacement='''  COURSES.MM12.modules.filter(m=>m.tag==="M3").forEach(m=>{m.name="Sound — legacy mapping under review";m.outcomes.forEach(o=>{o.pending=true;o.official="LEGACY TRANSCRIPTION — verify the published five-outcome sound framework before grading. Stored wording: "+o.official;});});
  buildOidMap(); SKILLS=buildSkills();'''
s=s.replace(needle,replacement)
# Label old course-planning views without replacing their stored assessment associations.
needle='    const cid=course, outs=allOutcomes(cid);\n'
s=s.replace('New-course form — wired in the real build','Course creation is not available in this local version. Use the existing course roster import.')
# Preserve raw values in data while escaping untrusted names and notes at rendering boundaries.
for token in ['s.name','r.note','e.note']:
    s=s.replace('${'+token+'}', '${escH('+token+')}')
s=s.replace('a.className=route===r?"active":""; a.dataset.route=r;', 'a.className=route===r?"active":""; a.dataset.route=r; a.href="#"+r;')
p.write_text(s)
print('Legacy integration patched')
