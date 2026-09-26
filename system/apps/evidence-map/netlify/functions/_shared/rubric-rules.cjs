// One readiness rule for catalogue generation, approval and field capture.
function rubricReadiness(rubric, catalogue) {
  const issues = [];
  const skills = new Set([
    ...(catalogue.skills || []).filter(s => !s.course || s.course === rubric.course || s.course === 'ALL').map(s => s.id || s.skill_id),
    ...(catalogue.crosswalk?.crosswalk || []).map(s => s.tutorial_skill_id)
  ]);
  if (!rubric.criteria?.length) issues.push('Add task criteria.');
  for (const c of rubric.criteria || []) {
    if (!c.id || !c.name) issues.push('Each criterion needs an ID and name.');
    if (!['Beginning', 'Developing', 'Secure', 'Extending'].every(b => c.descriptors?.[b]?.trim())) issues.push(`${c.id}: complete all four descriptors.`);
    if (!c.outcome_codes?.length || c.outcome_codes.some(code => !catalogue.outcomes.some(o => o.course_id === rubric.course && o.outcome_code === code))) issues.push(`${c.id}: resolve the course outcome mapping.`);
    if (!c.skill_ids?.length) issues.push(`${c.id}: link the taught skills.`);
    else if (c.skill_ids.some(id => !skills.has(id))) issues.push(`${c.id}: resolve unknown skill IDs.`);
    if (!c.collection?.trim()) issues.push(`${c.id}: specify the evidence to collect.`);
  }
  return { review_ready: issues.length === 0, capture_ready: rubric.status === 'approved' && issues.length === 0, readiness_issues: [...new Set(issues)] };
}
module.exports = { rubricReadiness };
