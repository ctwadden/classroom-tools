(function (root) {
  'use strict';
  const dimensions = {
    'LI-D01': 'Get Started', 'LI-D02': 'Understand Directions', 'LI-D03': 'Find / Submit / Navigate Resources',
    'LI-D04': 'Make This Work for Me / Access Format', 'LI-D05': 'Troubleshoot',
    'LI-D06': 'Ask for Help Effectively', 'LI-D07': 'Self-Check', 'LI-D08': 'Plan and Organize'
  };
  const levels = ['Guided', 'Supported', 'Independent', 'Transfer'];
  const results = ['Helped', 'Partly helped', 'Did not help', 'Not checked yet'];
  function skillEvidence(events, catalogue, course, learner) {
    const rows = new Map();
    for (const e of events.filter(e => e.course_id === course && e.learner_id === learner && e.stream !== 'support')) {
      for (const id of new Set(e.tutorial_skill_ids || [])) {
        const link = catalogue.crosswalk?.crosswalk?.find(s => s.tutorial_skill_id === id);
        const skill = catalogue.skills?.find(s => s.id === id && (!s.course || s.course === course));
        if (!rows.has(id)) rows.set(id, { id, name: link?.tutorial_label || skill?.name || id, registered: !!(link || skill),
          competencies: (link?.evidence_skill_ids || []).map(id => catalogue.skills?.find(s => s.id === id && s.course === course)).filter(Boolean), events: [] });
        rows.get(id).events.push(e);
      }
    }
    return [...rows.values()].map(r => ({ ...r, events: r.events.sort((a,b) => String(a.timestamp).localeCompare(String(b.timestamp))),
      projects: [...new Set(r.events.map(e => e.project_id))] })).sort((a,b) => a.name.localeCompare(b.name));
  }
  function supportHistory(events, course, learner) {
    const source = events.filter(e => e.course_id === course && e.learner_id === learner);
    const rows = Object.entries(dimensions).map(([id, name]) => {
      const records = source.filter(e => e.stream === 'support' && !e.conflict && e.support_detail?.dimension_id === id &&
        Number.isInteger(e.support_detail.level) && e.support_detail.level >= 1 && e.support_detail.level <= 4)
        .sort((a,b) => String(a.timestamp).localeCompare(String(b.timestamp)));
      return { id, name, baseline: records[0] || null, latest: records.at(-1) || null, recent: records.slice(-5), count: records.length };
    });
    const unclassified = source.filter(e => (e.stream === 'support' || e.support_signal) && (!e.support_detail || e.conflict));
    return { dimensions: rows, unclassified };
  }
  const api = { dimensions, levels, results, skillEvidence, supportHistory };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LearningProfile = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
