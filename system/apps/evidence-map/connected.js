(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const Core = window.EvidenceDashboard, Profile = window.LearningProfile, API = '/.netlify/functions/evidence-bridge';
  const views = {
    overview: ['Overview', 'Your classroom, connected.', 'See the learning. Choose the next teaching move.'],
    learners: ['Students & outcomes', 'A clearer picture of each learner.', 'Bring the evidence together, then make the outcome judgment.'],
    rubrics: ['Rubric library', 'The same criteria, everywhere.', 'One version shared by the lesson, the classroom capture and the evidence review.'],
    plans: ['Semester & year plan', 'See how the learning connects.', 'Build the skill. Apply it. Explain it. Transfer it to a new situation.'],
    assignments: ['Assignments & workbooks', 'Build once. Teach, capture and report.', 'The course plan, workbook brief, shared rubric and classroom evidence belong together.'],
    reporting: ['Reporting', 'From evidence to a considered judgment.', 'Teacher-confirmed outcomes and comments, prepared for your reporting workflow.']
  };
  const initial = new URLSearchParams(location.search).get('course');
  const initialView = new URLSearchParams(location.search).get('view');
  const initialSprint = new URLSearchParams(location.search).get('sprint');
  const state = { course: ['MM12', 'COM11', 'IBDS'].includes(initial) ? initial : 'MM12', view: views[initialView] ? initialView : 'overview', assignment: initialSprint || '',
    catalogue: null, plan: null, snapshot: null, summary: null, learner: '', outcome: '', saving: false,
    request: 0, editing: null, drafts: new Map(), supportDrafts: new Map(), supportKey: '', rubricRows: [] };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const empty = (title, note = '') => `<div class="empty"><strong>${esc(title)}</strong>${note ? `<p>${esc(note)}</p>` : ''}</div>`;
  const stat = (label, number, note) => `<div class="stat-card"><span class="stat-label">${esc(label)}</span><strong>${esc(number)}</strong><small>${esc(note)}</small></div>`;
  const band = achievement => `<span class="tag band-${Core.bands.includes(achievement) ? achievement.toLowerCase() : 'ie'}">${esc(achievement || 'Not reviewed')}</span>`;
  const date = value => value ? new Date(value.length === 10 ? value + 'T12:00:00' : value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'Date not recorded';
  const initials = name => name.split(/\s+/).filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
  const outcomes = () => (state.catalogue?.outcomes || []).filter(o => o.course_id === state.course && o.active_in_plan !== false);
  const outcomeName = id => state.catalogue?.outcomes.find(o => o.outcome_id === id)?.outcome_title || 'Outcome mapping pending';
  const studentEvents = () => (state.snapshot?.events || []).filter(e => e.learner_id === state.learner);
  const studentProgress = () => (state.snapshot?.progress || []).filter(p => p.learner_id === state.learner);
  const projectName = event => state.catalogue?.rubrics.find(r => r.id === event.rubric_id)?.title ||
    (event.project_id === 'PS-TRUCK-AD' ? 'Truck Ad' : event.project_id || 'Classroom capture');
  const localDay = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  function message(text, error = false) { $('#status').textContent = text; $('#status').className = 'status' + (error ? ' error' : ''); }
  async function api(action, body, course = state.course) {
    const response = await fetch(API + '?' + new URLSearchParams({ action, course_id: course }), {
      method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store',
      headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {})
    });
    const result = await response.json();
    if (!response.ok) { const error = new Error(result.error || 'Connection unavailable'); error.status = response.status; throw error; }
    return result;
  }
  function download(data, name, type = 'application/json') {
    const url = URL.createObjectURL(new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type }));
    const a = document.createElement('a'); a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function syncLocation() {
    const url = new URL(location.href);
    url.searchParams.set('course', state.course); url.searchParams.set('view', state.view);
    if (state.view === 'assignments' && state.assignment) url.searchParams.set('sprint', state.assignment);
    else url.searchParams.delete('sprint');
    history.replaceState(null, '', url);
  }
  function showView(view, focus = false) {
    if (!views[view]) view = 'overview';
    state.view = view;
    syncLocation();
    $$('.main-nav button').forEach(b => b.dataset.view === view ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
    $$('[data-panel]').forEach(p => { p.hidden = p.dataset.panel !== view; });
    $('#view-label').textContent = views[view][0]; $('#page-title').textContent = views[view][1]; $('#page-intro').textContent = views[view][2];
    $('#signed-out-overview').hidden = !!state.snapshot || ['rubrics', 'plans', 'assignments'].includes(view);
    if (focus) { $('#main').focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: 'instant' }); }
  }

  function clearPrivate() {
    state.snapshot = null; state.summary = null; state.editing = null;
    $('#classroom').hidden = true; $('#signout').hidden = true; $('#refresh').hidden = true;
    ['class-stats', 'evidence-chart', 'achievement-chart', 'attention', 'student-grid', 'connections', 'learner-heading',
      'summary', 'outcome-map', 'evidence', 'evidence-choices', 'progress', 'report-stats', 'report-table', 'assignment-evidence', 'skill-history', 'support-history', 'support-save-status'].forEach(id => { $('#' + id).replaceChildren(); });
    state.supportKey = ''; $('#support-checkin').reset(); $('#support-project').replaceChildren(); $('#support-step').replaceChildren();
    $('#learner').replaceChildren(); $('#outcome').replaceChildren(); $('#review').reset(); $('#student-search').value = '';
    assignmentView();
  }
  async function load() {
    const request = ++state.request, course = state.course;
    stashDraft(); clearPrivate(); showView(state.view); $('#access').hidden = true;
    $('#connection-label').textContent = 'Connecting'; $('#connection-label').className = 'connection-label';
    message('Refreshing the shared classroom records…');
    try {
      const snapshot = await api('snapshot', undefined, course);
      if (request !== state.request || course !== state.course) return;
      if (snapshot.course_id !== course) throw new Error('The server returned a different course. Refresh before continuing.');
      state.snapshot = snapshot; state.summary = Core.summarise(snapshot, outcomes());
      if (!state.summary.students.some(l => l.learner_id === state.learner)) state.learner = state.summary.students[0]?.learner_id || '';
      $('#learner').innerHTML = state.summary.students.map(l => `<option value="${esc(l.learner_id)}">${esc(l.display_name)}${l.roster_pending ? ' · ' + esc(l.learner_id) : ''}</option>`).join('');
      $('#learner').value = state.learner;
      $('#classroom').hidden = false; $('#signout').hidden = false; $('#refresh').hidden = false; $('#access').hidden = true;
      $('#connection-label').textContent = 'Cloud connected'; $('#connection-label').className = 'connection-label live';
      const synced = snapshot.roster.updated_at;
      message(synced ? 'Cloud records loaded · Google roster last synced ' + new Date(synced).toLocaleString() : 'Cloud records loaded · This course’s Google roster has not synced yet.');
      renderOverview(); renderLearner(); renderReporting(); showView(state.view);
    } catch (error) {
      if (request !== state.request || course !== state.course) return;
      clearPrivate();
      $('#access').hidden = error.status !== 401;
      $('#connection-label').textContent = error.status === 401 ? 'Teacher sign-in' : 'Connection unavailable';
      if (error.status === 401) { state.drafts.clear(); state.supportDrafts.clear(); message('Sign in to view student information. Course plans and rubric drafts remain available.'); }
      else { message(error.message + ' · No cached student data is displayed.', true); $('#refresh').hidden = false; }
      showView(state.view);
    }
    rubricView();
  }

  function renderOverview() {
    const s = state.summary, os = outcomes();
    $('#class-stats').innerHTML = stat('Students in this view', s.students.length, `${s.students.filter(l => l.roster_pending).length} roster links pending`) +
      stat('Evidence records', s.events.length, `${s.assessable.length} eligible for outcome review`) +
      stat('Confirmed outcomes', s.confirmed.length, 'Teacher decisions · includes IE') +
      stat('Students to follow up', s.students.filter(l => !l.eligible || l.unreviewed || l.issues).length, 'Evidence gaps, unreviewed outcomes or conflicts');
    const maximum = Math.max(1, ...Object.values(s.methods));
    $('#evidence-chart').innerHTML = Core.methods.map(method => `<div class="chart-row"><div class="chart-label"><span><i class="method-icon">${method[0]}</i>${method}</span><b>${s.methods[method]}</b></div><div class="track" aria-hidden="true"><div class="fill ${method.toLowerCase()}" style="width:${s.methods[method] / maximum * 100}%"></div></div></div>`).join('') +
      `<p class="chart-note">${s.events.length - s.assessable.length} other records: diagnostics, reflection, practice or records awaiting resolution.</p>`;
    $('#achievement-chart').innerHTML = s.confirmed.length ? `<p><strong class="chart-total">${s.confirmed.length}</strong><span class="subtle">confirmed outcome decisions</span></p><div class="distribution" aria-hidden="true">${Core.bands.map(b => `<span class="color-${b.toLowerCase()}" style="width:${s.bands[b] / s.confirmed.length * 100}%"></span>`).join('')}</div>${Core.bands.map(b => `<div class="legend-row"><span class="legend-name"><i class="legend-dot color-${b.toLowerCase()}" aria-hidden="true"></i>${b === 'IE' ? 'IE · evidence gap' : b}</span><b>${s.bands[b]}</b></div>`).join('')}` :
      empty('No outcome judgments yet', 'Collected evidence will appear in the chart alongside this one. Achievement appears here only after you confirm an outcome.');
    const focus = [
      [s.students.filter(l => !l.eligible).length, 'Students without eligible evidence', 'Choose a focused observation or conversation in the next lesson.', 'no-evidence'],
      [s.students.filter(l => l.unreviewed).length, 'Students with outcomes ready to review', 'There is linked evidence, but no confirmed decision on at least one outcome.', 'needs-review'],
      [s.issues, 'Records needing mapping or resolution', 'Resolve these before using them in a reporting decision.', 'attention']
    ];
    $('#attention').innerHTML = focus.map(([n, title, text, filter]) => `<div class="focus-row"><span class="focus-count">${n}</span><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div><button class="text-button" data-filter="${filter}" aria-label="Show ${esc(title.toLowerCase())}">View →</button></div>`).join('');
    $('#roster-count').textContent = `${s.students.length} students · ${os.length} planned ${state.course === 'IBDS' ? 'capabilities' : 'outcomes'}`;
    renderStudentCards();
    const linked = !!state.snapshot.roster.updated_at;
    $('#connections').innerHTML = [
      ['Google Sheet', linked ? 'Roster received' : 'Roster pending', linked ? 'Roster and intake feed this view. Teacher-confirmed progress returns through the installed Google sync.' : 'Sync this course’s roster from the existing Google Sheet.', linked],
      ['iPad companion', 'Shared classroom connection', 'Open iPad field capture from the sidebar. It uses this sign-in, roster and approved rubrics. A physical iPad offline check remains.', true],
      ['Shared rubrics', `${state.snapshot.rubrics.length} approved`, 'Only explicitly approved versions are available for classroom capture.', !!state.snapshot.rubrics.length],
      ['PowerSchool', 'Review export available', 'Local template, student IDs and standards/grade-scale mapping still need verification.', false]
    ].map(([name, status, detail, ready]) => `<div class="connection-item"><h3>${esc(name)}</h3><span class="tag ${ready ? '' : 'warn'}">${esc(status)}</span><p>${esc(detail)}</p></div>`).join('');
    planView();
  }
  function renderStudentCards() {
    if (!state.summary) return;
    const query = $('#student-search').value.trim().toLowerCase(), filter = $('#student-filter').value, total = outcomes().length;
    const rows = state.summary.students.filter(l => (!query || (l.display_name + ' ' + l.learner_id).toLowerCase().includes(query)) &&
      (filter === 'all' || filter === 'no-evidence' && !l.eligible || filter === 'needs-review' && l.unreviewed || filter === 'attention' && l.issues));
    $('#student-grid').innerHTML = rows.map(l => `<button class="student-card" data-student="${esc(l.learner_id)}" aria-label="Open ${esc(l.display_name)}"><div class="student-card-head"><span class="avatar" aria-hidden="true">${esc(initials(l.display_name))}</span><div><h3>${esc(l.display_name)}</h3><small>${l.roster_pending ? esc(l.learner_id) + ' · match roster' : `${l.events.length} records · ${l.confirmed} confirmed outcomes`}</small></div></div><div class="student-meta"><span>Evidence coverage</span><strong>${l.covered} / ${total} outcomes</strong></div><div class="track coverage-track" aria-hidden="true"><div class="fill" style="width:${total ? l.covered / total * 100 : 0}%"></div></div><div class="student-badges">${Core.methods.map(m => `<span class="tag neutral" title="${m}">${m[0]} ${l.methods[m]}</span>`).join('')}<span class="tag ${l.issues || !l.eligible ? 'warn' : 'neutral'}">${l.issues ? 'Needs resolution' : l.unreviewed ? 'Review evidence' : !l.eligible ? 'Evidence needed' : 'Outcomes reviewed'}</span></div></button>`).join('') || empty(state.summary.students.length ? 'No students match this view' : 'This course has no roster yet', state.summary.students.length ? 'Try another filter or search.' : 'Add this class to the existing Google roster, then run its sync. No demonstration students are substituted.');
  }

  function renderLearner() {
    if (!state.snapshot) return;
    const learner = state.summary.students.find(l => l.learner_id === state.learner), es = studentEvents(), ps = studentProgress(), os = outcomes();
    $('#learner-heading').innerHTML = learner ? `<div class="learner-title"><span class="avatar" aria-hidden="true">${esc(initials(learner.display_name))}</span><div><h2>${esc(learner.display_name)}</h2><p>${esc(state.catalogue.courses[state.course])} · ${learner.roster_pending ? 'Roster link pending' : 'Shared Google roster'}</p></div></div>` : empty('Choose a student when the roster is ready');
    $('#summary').innerHTML = stat('Evidence records', es.length, `${es.filter(Core.eligible).length} eligible for outcome review`) + stat('Confirmed outcomes', ps.filter(p => p.status === 'teacher_confirmed').length, 'Achievement decided by the teacher') + stat('Needs resolution', learner?.issues || 0, 'Mapping issues and conflicting records');
    if (!os.some(o => o.outcome_id === state.outcome)) state.outcome = os[0]?.outcome_id || '';
    $('#outcome').innerHTML = os.map(o => `<option value="${esc(o.outcome_id)}">${esc(o.display_code + ' · ' + o.outcome_title)}</option>`).join('');
    $('#outcome').value = state.outcome;
    $('#outcome-map').innerHTML = os.map(o => {
      const p = ps.find(p => p.outcome_id === o.outcome_id), count = es.filter(e => Core.eligible(e) && e.outcomes.some(x => x.outcome_id === o.outcome_id)).length;
      return `<button class="outcome-tile" data-outcome="${esc(o.outcome_id)}" aria-pressed="${o.outcome_id === state.outcome}"><div><small>${esc(o.display_code)}</small><div class="outcome-name">${esc(o.outcome_title)}</div></div><div class="outcome-bottom">${p?.status === 'conflict' ? '<span class="tag warn">Held for review</span>' : band(p?.status === 'teacher_confirmed' ? p.achievement : '')}<small>${count} records</small></div></button>`;
    }).join('');
    $('#evidence').innerHTML = es.slice().sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp))).map(e => `<article class="event"><h3>${esc(projectName(e))}</h3><p class="subtle">${esc(date(e.timestamp))}${e.step_id ? ' · ' + esc(e.step_id) : ''}</p><div class="event-tags">${(e.methods?.length ? e.methods : [e.stream]).map(m => `<span class="tag neutral">${esc(m)}</span>`).join('')}${e.conflict ? '<span class="tag warn">Conflicting revisions</span>' : ''}${e.stream === 'evidence' && e.mapping_status !== 'mapped' ? '<span class="tag warn">Outcome link needs review</span>' : ''}</div><p>${esc(e.teacher_note || e.response_value || (e.support_detail ? e.support_detail.context + ' · ' + e.support_detail.strategy + ' · ' + e.support_detail.result : 'No written note attached.'))}</p><p class="subtle">${esc((e.outcomes || []).map(o => o.outcome_id ? outcomeName(o.outcome_id) : o.raw).join(' · '))}</p>${e.stream === 'knowledge' ? `<p class="subtle">Knowledge check: ${e.is_correct == null ? 'unscored' : e.is_correct ? 'correct' : 'incorrect'} · diagnostic information</p>` : ''}<p class="subtle">${e.band ? 'Capture suggestion: ' + esc(e.band) + '. ' : ''}${e.support_signal ? 'Support reported: ' + esc(e.support_signal.band || e.support_signal.raw) + '. ' : ''}This record does not set an outcome grade.</p><button class="text-button" data-copy-note="${esc(e.event_id)}">Copy evidence note</button><details><summary>Record reference</summary>${esc(e.canonical_id)} · ${esc(e.event_id)}</details></article>`).join('') || empty('No evidence for this student yet', 'Google intake and approved iPad captures will appear here.');
    $('#progress').innerHTML = ps.length ? `<table><thead><tr><th>Outcome</th><th>Achievement</th><th>Support context</th><th>Teacher comment</th><th>State</th></tr></thead><tbody>${ps.map(p => `<tr><td>${esc(outcomeName(p.outcome_id))}<small>${esc(p.outcome_code)}</small></td><td>${p.status === 'teacher_confirmed' ? band(p.achievement) : 'Held for review'}</td><td>${esc(p.support || 'Not recorded')}</td><td class="comment-cell">${esc(p.comment)}</td><td>${p.status === 'teacher_confirmed' ? 'Teacher confirmed' : 'Conflict · resolve before reporting'}</td></tr>`).join('')}</tbody></table>` : empty('No recorded outcome decisions', 'Review the evidence and confirm a judgment when appropriate.');
    renderProfile(); reviewContext(); setBusy(state.saving);
  }

  function renderProfile() {
    const rows = Profile.skillEvidence(state.snapshot.events, state.catalogue, state.course, state.learner);
    $('#skill-history').innerHTML = rows.map(r => `<details class="criterion"><summary>${esc(r.name)} · ${r.projects.length} assignment${r.projects.length === 1 ? '' : 's'}</summary><p class="subtle">${esc(r.id)} · ${r.registered ? 'Registered skill' : 'Registry link needs review'} · ${r.competencies.length ? esc(r.competencies.map(c => c.name || c.title || c.id).join(' · ')) : 'No separate course competency crosswalk confirmed; inspect the linked outcomes.'}</p>${r.events.map(e => `<article class="event"><strong>${esc(projectName(e))} · ${esc(date(e.timestamp))}</strong><p>${esc(e.teacher_note || e.response_value || e.canonical_id)}</p><p class="subtle">${esc(e.methods?.join(' + ') || e.stream)} · ${e.conflict ? 'Conflicting evidence — resolve first' : e.stream === 'knowledge' ? `Knowledge: ${e.is_correct == null ? 'unscored' : e.is_correct ? 'correct' : 'needs follow-up'}` : 'Evidence to inspect, not a confirmed skill level'}${e.step_id ? ' · ' + esc(e.step_id) : ''}</p></article>`).join('')}</details>`).join('') || empty('No skill-linked evidence yet', 'Mapped knowledge responses and classroom evidence will appear here across assignments. Unmapped records remain in the evidence list below.');
    const history = Profile.supportHistory(state.snapshot.events, state.course, state.learner);
    const label = e => `${e.support_detail.level} ${Profile.levels[e.support_detail.level - 1]}`;
    $('#support-history').innerHTML = history.dimensions.filter(d => d.count).map(d => `<details class="criterion"><summary>${esc(d.name)} · latest ${esc(label(d.latest))}</summary><p>Baseline ${esc(label(d.baseline))} (${esc(date(d.baseline.timestamp))}) → latest ${esc(label(d.latest))} (${esc(date(d.latest.timestamp))})</p><p class="subtle">${d.count} recorded observations. Compare the task context before interpreting a change; these records do not automatically change the support plan.</p>${d.recent.map(e => `<article class="event"><strong>${esc(date(e.timestamp))} · ${esc(label(e))}</strong><p>${esc(e.project_id)} · ${esc(e.step_id)} · ${esc(e.support_detail.context)}</p><p><strong>Difficulty:</strong> ${esc(e.support_detail.barrier || 'Not recorded')}</p><p><strong>Support:</strong> ${esc(e.support_detail.strategy)} · ${esc(e.support_detail.result)}</p><p><strong>Next:</strong> ${esc(e.support_detail.next_action || 'Teacher follow-up needed')}</p></article>`).join('')}</details>`).join('') || empty('No dimension-based support observations yet', 'Record what helped with directions, troubleshooting or another specific dimension. Earlier general support labels have not been assigned to a dimension automatically.');
    if (history.unclassified.length) $('#support-history').insertAdjacentHTML('beforeend', `<p class="notice">${history.unclassified.length} earlier support labels or conflicted records need context before inclusion in dimension growth.</p>`);
    const key = `${state.course}/${state.learner}`;
    if (key !== state.supportKey) {
      state.supportKey = key; $('#support-checkin').reset(); $('#support-save-status').textContent = '';
      const projects = state.catalogue.assignment_links.sprints.filter(s => s.sprint_id.startsWith(state.course.toLowerCase() + '-')).flatMap(s => s.projects || []);
      $('#support-project').innerHTML = [...new Map(projects.filter(p => state.catalogue.project_steps?.[p.project_id]).map(p => [p.project_id, p])).values()].map(p => `<option value="${esc(p.project_id)}">${esc(p.title)}</option>`).join('');
      $('#support-dimension').innerHTML = Object.entries(Profile.dimensions).map(([id, name]) => `<option value="${id}">${esc(name)}</option>`).join('');
      const draft = state.supportDrafts.get(key);
      if (draft?.values) for (const [id, value] of Object.entries(draft.values)) if (id !== 'support-step') $('#' + id).value = value;
      supportSteps(); if (draft?.values) $('#support-step').value = draft.values['support-step'];
    }
  }
  function supportSteps() {
    $('#support-step').innerHTML = (state.catalogue.project_steps?.[$('#support-project').value] || []).map(s => `<option value="${esc(s.step_id)}">${esc(s.step_id + ' · ' + s.title)}</option>`).join('');
  }
  function stashSupport() {
    if (!state.supportKey) return;
    const old = state.supportDrafts.get(state.supportKey);
    const values = Object.fromEntries($$('#support-checkin input, #support-checkin select, #support-checkin textarea').map(el => [el.id, el.value]));
    state.supportDrafts.set(state.supportKey, { values, event_id: old?.event_id || crypto.randomUUID(), revision: (old?.revision || 1) + (old?.attempted && JSON.stringify(values) !== JSON.stringify(old.values) ? 1 : 0), attempted: old?.attempted || false, timestamp: old?.timestamp || new Date().toISOString() });
  }

  // Drafts live only in this signed-in page and are keyed to the complete review context.
  // Their original revision parents are retained, so refreshing cannot conceal a concurrent edit.
  function draftKey() { return `${state.course}\u0000${state.learner}\u0000${state.outcome}`; }
  function stashDraft(changed = false) {
    if (!state.editing || !state.learner) return;
    const prior = state.drafts.get(state.editing.key);
    if (!changed && !prior) return;
    state.drafts.set(state.editing.key, { achievement: $('#achievement').value, support: $('#support').value,
      comment: $('#comment').value, rationale: $('#rationale').value,
      evidence_ids: $$('#evidence-choices input:checked').map(x => x.value),
      parents: state.editing.parents, review_id: changed ? null : prior?.review_id || null });
    $('#draft-status').textContent = 'Unsaved draft kept for this student and outcome. Sign-out clears it.';
  }
  function reviewContext() {
    state.outcome = $('#outcome').value;
    const p = studentProgress().find(p => p.outcome_id === state.outcome), key = draftKey(), draft = state.drafts.get(key);
    state.editing = { key, parents: draft?.parents || p?.revision_ids || [] };
    $('#achievement').value = draft?.achievement || p?.achievement || 'IE';
    $('#support').value = draft?.support ?? p?.support ?? '';
    $('#comment').value = draft?.comment ?? p?.comment ?? ''; $('#rationale').value = draft?.rationale || '';
    const selected = draft?.evidence_ids || p?.evidence_ids || [];
    $('#evidence-choices').innerHTML = studentEvents().filter(e => Core.eligible(e) && e.outcomes.some(o => o.outcome_id === state.outcome)).map(e => `<label><input type="checkbox" value="${esc(e.event_id)}" ${selected.includes(e.event_id) ? 'checked' : ''}><span>${esc(projectName(e))} · ${esc(e.methods?.join(' + ') || e.stream)}<small>${esc(date(e.timestamp))} · ${esc(e.teacher_note || e.canonical_id)}</small></span></label>`).join('') || '<p class="subtle">No eligible evidence linked to this outcome yet. IE records an evidence gap.</p>';
    $('#draft-status').textContent = draft ? 'Unsaved draft restored for this student and outcome.' : 'Draft changes stay with this student and outcome during your session.';
    $$('[data-outcome]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.outcome === state.outcome)));
  }
  function renderReporting() {
    const rows = Core.reviewRows(state.snapshot);
    $('#report-stats').innerHTML = stat('Confirmed decisions', rows.length, 'Available in the review CSV') + stat('Comments written', rows.filter(p => p.comment?.trim()).length, 'Teacher-written reporting comments') + stat('Decisions without school ID', rows.filter(p => !p.powerschool_id).length, 'Match before any gradebook transfer');
    $('#export').disabled = !rows.length;
    $('#report-table').innerHTML = rows.length ? `<table><thead><tr><th>Student</th><th>Outcome</th><th>Achievement</th><th>Teacher comment</th><th>Reviewed</th></tr></thead><tbody>${rows.map(p => `<tr><td>${esc(p.display_name)}<small>${p.powerschool_id ? 'School ID: ' + esc(p.powerschool_id) : 'School ID needed'}</small></td><td>${esc(outcomeName(p.outcome_id))}<small>${esc(p.ps_outcome_code || 'Local standard mapping needed')}</small></td><td>${band(p.achievement)}</td><td class="comment-cell">${esc(p.comment || 'No reporting comment yet')}${p.comment ? `<button class="text-button" data-copy-report="${rows.indexOf(p)}" aria-label="Copy reporting comment for ${esc(p.display_name)}">Copy comment</button>` : ''}</td><td>${esc(date(p.updated_at))}</td></tr>`).join('')}</tbody></table>` : empty('No judgments ready for the review register', 'Confirm outcomes in Students & outcomes. Captures and draft suggestions are not exported as grades.');
  }

  function rubricView() {
    if (!state.catalogue) return;
    const released = state.snapshot?.rubrics || [], catalogue = state.catalogue.rubrics.filter(r => r.course === state.course);
    const byVersion = new Map(catalogue.map(r => [r.id + '@' + r.version, { rubric: r, approved: false }]));
    released.forEach(r => byVersion.set(r.id + '@' + r.version, { rubric: r, approved: r.status === 'approved' }));
    state.rubricRows = [...byVersion.values()];
    assignmentView();
    const approvedCount = state.rubricRows.filter(r => r.approved).length;
    $('#rubric-counts').innerHTML = `<span class="tag">${approvedCount} approved${state.snapshot ? '' : ' visible after sign-in'}</span><span class="tag warn">${state.rubricRows.length - approvedCount} ${state.snapshot ? 'need review' : 'catalogue drafts'}</span>`;
    $('#rubrics').innerHTML = state.rubricRows.map(({ rubric: r, approved }, i) => `<details class="card rubric"><summary><div><h3>${esc(r.title)}</h3><small>${r.criteria.length} criteria · Version ${esc(r.version)}</small></div><span class="tag ${approved ? '' : 'warn'}">${approved ? 'Approved for capture' : 'Teacher review required'}</span></summary><div class="rubric-body"><p>${esc(r.review_note || 'Review the descriptors before using this version.')}</p>${r.criteria.map(c => `<div class="criterion"><h3>${esc(c.name)}</h3><p class="subtle">${esc((c.outcome_codes || []).join(' · '))}</p><p><strong>Collect through O / C / P:</strong> ${esc(c.collection || 'Collection guidance still needs authoring.')}</p>${c.skill_ids?.length ? `<p class="subtle">Skills: ${esc(c.skill_ids.map(skillName).join(' · '))}</p>` : ''}<div class="descriptor-grid">${Object.entries(c.descriptors || {}).map(([b, t]) => `<div class="descriptor"><strong>${esc(b)}</strong><p>${esc(t)}</p></div>`).join('')}</div></div>`).join('')}${!r.review_ready && !approved ? `<p class="rubric-warning">${esc((r.readiness_issues || ['Complete descriptors, skill and outcome mappings before approval.']).join(' '))}</p>` : ''}<div class="button-row"><button class="secondary" data-download="${i}">Download ${approved ? 'approved' : 'draft'} rubric</button>${state.snapshot?.role === 'teacher' && !approved && r.review_ready ? `<button class="primary" data-approve="${i}">I reviewed this version · approve for capture</button>` : ''}</div></div></details>`).join('') || empty('No rubric registered for this course yet');
  }
  function planView() {
    assignmentView();
    $('#plan-heading').textContent = state.catalogue?.courses[state.course] || 'The connected course sequence';
    $('#plan-status').textContent = state.catalogue?.teaching_package_status || 'Loading the teaching sequence…';
    if (!state.plan) { $('#current-plan').innerHTML = empty('Course plan loading'); return; }
    const sprints = state.plan.sprints.filter(s => s.course === state.course), lessons = state.plan.lessons.filter(l => l.course === state.course), today = localDay();
    const current = sprints.find(s => s.start <= today && s.end >= today), upcoming = current || sprints.find(s => s.start > today) || sprints.at(-1);
    $('#plan-overview').textContent = state.plan.overview[state.course];
    $('#plan-numbers').innerHTML = [[sprints.length, 'connected sprints'], [lessons.length, 'dated lesson plans'], [state.course === 'IBDS' ? 'Sept–May' : 'Semester', 'planned teaching window']].map(([n, label]) => `<div class="plan-number"><strong>${esc(n)}</strong>${esc(label)}</div>`).join('');
    $('#current-plan').innerHTML = upcoming ? `<p class="plan-date">${current ? 'Scheduled now' : upcoming.start > today ? 'Next in the calendar' : 'Last planned sprint'} · Sprint ${upcoming.number} · ${date(upcoming.start)}–${date(upcoming.end)}</p><h3>${esc(upcoming.title)}</h3><p>${esc(upcoming.brief)}</p><p class="subtle">${esc(upcoming.periods)} planned lessons · Calendar placement does not mean the teaching package is finished.</p>` : empty('No sequence registered');
    $('#sprint-list').innerHTML = sprints.map(s => `<article class="card sprint-card ${s === current ? 'current' : ''}"><div class="sprint-heading"><span class="sprint-number">${String(s.number).padStart(2, '0')}</span><div><h3>${esc(s.title)}</h3><small>${date(s.start)}–${date(s.end)} · ${s.periods} planned lessons${s.formal_ia_minutes ? ' · ' + s.formal_ia_minutes / 60 + ' formal IA hours' : ''}</small></div></div><p>${esc(s.brief)}</p><div class="sprint-detail-row"><strong>Builds on</strong>${esc(s.builds_on)}</div><div class="sprint-detail-row"><strong>Evidence to look for</strong>${esc(s.product)}</div><details><summary>Learning, observation & transfer</summary>${[['New learning', s.new_learning], ['Observation', s.observation], ['Conversation', s.conversation], ['Transfer', s.transfer], ['Teacher review focus', s.review_focus], ['Carries forward', s.carry_forward]].map(([label, text]) => `<div class="sprint-detail-row"><strong>${label}</strong>${esc(text)}</div>`).join('')}<p class="subtle">Planned outcome references: ${esc((s.outcome_refs || []).join(' · '))}</p></details><button class="text-button" data-assignment="${esc(s.id)}">Open assignment & workbook brief →</button></article>`).join('');
  }

  function skillName(id) {
    return state.catalogue?.crosswalk?.crosswalk?.find(s => s.tutorial_skill_id === id)?.tutorial_label ||
      state.catalogue?.skills.find(s => s.id === id)?.name || id;
  }
  function currentPackage() {
    return state.catalogue && Core.assignmentPackage(state.plan, state.catalogue, state.assignment, state.snapshot?.rubrics || []);
  }
  function assignmentView() {
    if (!state.plan || !state.catalogue) return;
    const sprints = state.plan.sprints.filter(s => s.course === state.course), today = localDay();
    if (!sprints.some(s => s.id === state.assignment)) state.assignment = (sprints.find(s => s.start <= today && s.end >= today) || sprints[0])?.id || '';
    $('#assignment-picker').innerHTML = sprints.map(s => `<option value="${esc(s.id)}">Sprint ${s.number} · ${esc(s.title)}</option>`).join('');
    $('#assignment-picker').value = state.assignment;
    if (state.view === 'assignments') syncLocation();
    $('#assignment-shortcuts').innerHTML = sprints.filter(s => state.catalogue.assignment_links?.sprints.find(link => link.sprint_id === s.id)?.resources?.length)
      .map(s => `<button class="text-button" data-assignment="${esc(s.id)}">Open ${esc(s.title)} tutorials →</button>`).join('');
    const pkg = currentPackage();
    if (!pkg) { $('#assignment-package').innerHTML = empty('No planned assignment bundle for this course'); return; }
    const s = pkg.sprint, approved = pkg.rubrics.filter(r => r.status === 'approved');
    const teachingResources = [...pkg.projects, ...pkg.resources].sort((a, b) => (a.order || 0) - (b.order || 0));
    const guideCount = teachingResources.filter(r => r.workbook_url).length;
    const knownLink = (label, url) => typeof url === 'string' && /^https:\/\//.test(url) ? `<a class="text-link" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} ↗</a>` : `<span class="tag warn">${esc(label)} link to register</span>`;
    $('#workbook-brief').value = Core.workbookBrief(pkg);
    $('#assignment-package').innerHTML = `<section class="card"><p class="eyebrow">SPRINT ${s.number} · ${date(s.start)}–${date(s.end)}</p><h2>${esc(s.title)}</h2><p>${esc(s.brief)}</p><div class="stat-grid compact-stats">${stat('Planned lessons', pkg.lessons.length, 'Daily teaching sequence')}${stat('Teaching guides', guideCount, 'Existing tutorials linked below')}${stat('Shared task rubrics', pkg.rubrics.length, `${approved.length} approved versions`)}</div><p class="notice">${guideCount ? `${guideCount} existing teaching guides are available below. Rubric and evidence connections still need review; see each resource’s notes.` : esc(pkg.status) + '. The workbook-maker prompt carries the actual plan and identifies unresolved links.'}</p><div class="three-columns">${[['Builds on', s.builds_on], ['New learning', s.new_learning], ['Prepares for', s.carry_forward]].map(([label, value]) => `<div><h3>${label}</h3><p>${esc(value)}</p></div>`).join('')}</div></section>` +
      `<section class="card" id="assignment-resources"><p class="eyebrow">EXISTING LESSONS · TUTORIALS · WORKBOOKS</p><h2>Your teaching resources</h2>${teachingResources.map(p => `<article class="criterion"><h3>${esc(p.title)}</h3><p>${esc(p.role)}</p><div class="button-row">${knownLink(p.project_id ? 'Open workbook' : 'Open tutorial', p.workbook_url)}${p.pdf_url ? knownLink('Saved PDF guide', p.pdf_url) : ''}${p.project_id ? knownLink('Open coach', p.coach_url) + knownLink('Knowledge + reflection', p.assessment_url) : ''}${p.source_url ? knownLink('Original project manifest', p.source_url) : ''}${p.original_rubric_url ? knownLink('Original O/C/P rubrics', p.original_rubric_url) : ''}</div><p class="subtle">${esc(p.preparation)}</p>${p.source_checkpoints?.length ? `<details><summary>Original workbook checkpoints (${p.source_checkpoints.length})</summary>${p.source_checkpoints.map(c => `<p><strong>${esc(c.evidence_type)} · ${esc(c.title)}</strong><br><span class="subtle">${esc(c.skill_ids.map(skillName).join(' · '))}</span></p>`).join('')}<p class="subtle">The original checkpoint IDs are retained in the workbook prompt. Linking them to the shared rubric criteria requires review; no retrospective scores are inferred.</p></details>` : ''}</article>`).join('') || empty('Project resources still need registration', 'The prompt includes the planned lessons. Returning the workbook also needs its project manifest, published links, Forms specification and rubric mapping.')}</section>` +
      `<div class="dashboard-grid"><section class="card"><p class="eyebrow">TEACH → PRACTISE → DEMONSTRATE</p><h2>Evidence designed with the task</h2>${[['Observation', s.observation], ['Conversation', s.conversation], ['Product', s.product], ['Changed brief / transfer', s.transfer], ['Teacher sampling', s.review_focus]].map(([label, value]) => `<div class="sprint-detail-row"><strong>${label}</strong>${esc(value)}</div>`).join('')}<p class="subtle">Use suitable O/C/P evidence against the shared criteria. Every checkpoint does not need three separate marks.</p></section>` +
      `<section class="card"><p class="eyebrow">THE LEARNING TARGETS</p><h2>Outcomes and skills</h2>${pkg.targets.map(o => `<p><strong>${esc(o.display_code)} · ${esc(o.outcome_title)}</strong>${!o.outcome_id ? '<span class="tag warn">Mapping needed</span>' : ''}</p>`).join('')}<details><summary>Planned skills (${pkg.skills.length})</summary><ul>${pkg.skills.map(skill => `<li>${esc(skill.name)}${skill.registered ? '' : ' · registry review needed'}</li>`).join('')}</ul></details>${state.course === 'IBDS' ? '<p class="subtle">Local capability references support the plan; they are not IB-issued outcome IDs or official markbands.</p>' : ''}</section></div>` +
      `<section class="card"><div class="section-head"><div><p class="eyebrow">SAME RUBRIC IN CLASS AND ON THE IPAD</p><h2>Task criteria and look-fors</h2></div><button class="text-button" data-go="rubrics">Review rubric versions →</button></div>${pkg.rubrics.map(r => `<details class="criterion"><summary>${esc(r.title)} · ${r.status === 'approved' ? 'Approved version' : 'Draft to review'}</summary><p class="subtle">Version ${esc(r.version)}</p>${r.criteria.map(c => `<h3>${esc(c.name)}</h3><p><strong>Collect:</strong> ${esc(c.collection || 'Collection guidance still needed.')}</p><p class="subtle">${esc((c.skill_ids || []).map(skillName).join(' · '))}</p><div class="descriptor-grid">${Object.entries(c.descriptors || {}).map(([level, descriptor]) => `<div class="descriptor"><strong>${esc(level)}</strong><p>${esc(descriptor)}</p></div>`).join('')}</div>`).join('')}</details>`).join('') || empty('Task rubric still needs a verified link', 'An older generic rubric is not automatically the rubric for this assignment. Finish the exact criteria and outcome mapping in the teaching package.')}</section>` +
      `<section class="card"><p class="eyebrow">THE DAILY FLOW</p><h2>Lessons, labs and exercises</h2>${pkg.lessons.map(l => `<details class="criterion"><summary>${esc(date(l.date))} · ${esc(l.title)}</summary><p><strong>Students:</strong> ${esc(l.student_action)}</p><p><strong>Produce:</strong> ${esc(l.artifact)}</p><p><strong>Teacher check:</strong> ${esc(l.teacher_check)}</p><p><strong>Next:</strong> ${esc(l.next_step)}</p></details>`).join('')}</section>`;
    if (!state.snapshot) { $('#assignment-evidence').innerHTML = empty('Sign in to see this assignment’s students and evidence', 'The workbook-maker prompt contains teaching specifications only.'); return; }
    const events = Core.assignmentEvidence(pkg, state.snapshot), eligible = events.filter(Core.eligible);
    const learnerName = id => state.snapshot.roster.learners.find(l => l.learner_id === id)?.display_name || 'Roster link pending';
    const criterionName = e => pkg.rubrics.find(r => r.id === e.rubric_id && r.version === e.rubric_version)?.criteria.find(c => c.id === e.criterion_id)?.name;
    const skillCounts = pkg.skills.map(skill => ({ ...skill, count: eligible.filter(e => e.tutorial_skill_ids?.includes(skill.id)).length }));
    $('#assignment-evidence').innerHTML = `<p>${events.length} linked records · ${eligible.length} eligible O/C/P or transfer records · ${events.filter(e => e.stream === 'knowledge').length} knowledge checks · ${events.filter(e => e.stream === 'reflection').length} reflections.</p><p class="subtle">Records are joined by the registered project and course. The latest 40 are shown below. Knowledge and reflection inform teaching; counts and skill tags do not establish mastery.</p><details><summary>Skill evidence coverage</summary>${skillCounts.map(skill => `<div class="legend-row"><span>${esc(skill.name)}</span><b>${skill.count} records</b></div>`).join('')}<p class="subtle">These counts show explicit skill tags on eligible evidence. Untagged records need review; they do not prove that the learner lacks the skill.</p></details>` +
      (events.length ? events.slice().sort((a,b) => String(b.timestamp).localeCompare(String(a.timestamp))).slice(0,40).map(e => `<article class="event"><h3>${esc(learnerName(e.learner_id))}</h3><p class="subtle">${esc(date(e.timestamp))} · ${esc(criterionName(e) || 'Criterion not linked on this record')}</p><div class="event-tags">${(e.methods?.length ? e.methods : [e.stream]).map(m => `<span class="tag neutral">${esc(m)}</span>`).join('')}${e.conflict || e.mapping_status !== 'mapped' ? '<span class="tag warn">Mapping or revision review needed</span>' : ''}</div><p>${esc(e.teacher_note || e.response_value || 'No written note')}</p><button class="text-button" data-copy-note="${esc(e.event_id)}">Copy evidence note</button><button class="text-button" data-student="${esc(e.learner_id)}">Review this student’s outcomes →</button></article>`).join('') : empty('No records joined to this bundle yet', pkg.projects.length ? 'Use a registered project and an approved matching rubric. Existing Google and iPad records appear here after refresh.' : 'Register the assignment project before evidence can be joined; no records are guessed from similar titles.'));
  }
  async function copyText(text, fallback) {
    try { if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable'); await navigator.clipboard.writeText(text); message('Copied. Review the text in its destination before using it.'); }
    catch { fallback(); message('Clipboard access was unavailable. The text is selected so you can copy it manually.'); }
  }
  $('#assignment-picker').addEventListener('change', () => { state.assignment = $('#assignment-picker').value; assignmentView(); });
  $('#copy-workbook-brief').addEventListener('click', () => copyText($('#workbook-brief').value, () => { $('#brief-preview').open = true; $('#workbook-brief').focus(); $('#workbook-brief').select(); }));
  $('#download-workbook-brief').addEventListener('click', () => { const pkg = currentPackage(); if (pkg) download(Core.workbookBrief(pkg), pkg.sprint.assessment_id + '-workbook-prompt.md', 'text/markdown;charset=utf-8'); });
  $('#report-table').addEventListener('click', event => {
    const button = event.target.closest('[data-copy-report]'); if (!button || !state.snapshot) return;
    const row = Core.reviewRows(state.snapshot)[Number(button.dataset.copyReport)]; if (!row?.comment) return;
    copyText(row.comment, () => { const area = document.createElement('textarea'); area.readOnly = true; area.setAttribute('aria-label', 'Reporting comment ready to copy'); area.value = row.comment; button.parentElement.append(area); area.focus(); area.select(); });
  });

  function setBusy(busy) {
    $$('[data-course], #learner, #refresh, #signout, #review input, #review select, #review textarea, #save-review, [data-approve], #support-checkin input, #support-checkin select, #support-checkin textarea, #support-checkin button').forEach(el => { el.disabled = busy; });
    if (!busy) { $('#save-review').disabled = state.snapshot?.role !== 'teacher' || !state.learner; $('#support-checkin button').disabled = state.snapshot?.role !== 'teacher' || !state.learner || !$('#support-project').value; }
  }
  document.addEventListener('click', event => {
    const go = event.target.closest('[data-view], [data-go]');
    if (go) showView(go.dataset.view || go.dataset.go, true);
    const copyNote = event.target.closest('[data-copy-note]');
    if (copyNote && state.snapshot) {
      const record = state.snapshot.events.find(e => e.event_id === copyNote.dataset.copyNote && e.course_id === state.course);
      const text = record?.teacher_note || record?.response_value;
      if (text) copyText(text, () => { const area = document.createElement('textarea'); area.readOnly = true; area.setAttribute('aria-label', 'Evidence note ready to copy'); area.value = text; copyNote.parentElement.append(area); area.focus(); area.select(); });
      else message('This record has no written note to copy.');
    }
    const assignment = event.target.closest('[data-assignment]');
    if (assignment) { state.assignment = assignment.dataset.assignment; assignmentView(); showView('assignments', true); }
    const student = event.target.closest('[data-student]');
    if (student && !state.saving) { stashDraft(); state.learner = student.dataset.student; $('#learner').value = state.learner; renderLearner(); showView('learners', true); }
    const outcome = event.target.closest('[data-outcome]');
    if (outcome && !state.saving) { stashDraft(); $('#outcome').value = outcome.dataset.outcome; reviewContext(); $('#review-card').scrollIntoView({ block: 'start' }); $('#outcome').focus({ preventScroll: true }); }
    const filter = event.target.closest('[data-filter]');
    if (filter) { $('#student-filter').value = filter.dataset.filter; $('#student-search').value = ''; renderStudentCards(); $('#student-filter').scrollIntoView({ block: 'center' }); $('#student-filter').focus({ preventScroll: true }); }
  });
  $$('[data-course]').forEach(b => b.addEventListener('click', async () => {
    if (state.saving || b.dataset.course === state.course) return;
    stashDraft(); state.editing = null; state.course = b.dataset.course; state.learner = ''; state.outcome = ''; state.snapshot = null;
    $('#student-filter').value = 'all';
    $$('[data-course]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    rubricView(); planView(); await load();
  }));
  $('#student-search').addEventListener('input', renderStudentCards); $('#student-filter').addEventListener('change', renderStudentCards);
  $('#learner').addEventListener('change', () => { stashDraft(); state.learner = $('#learner').value; renderLearner(); });
  $('#outcome').addEventListener('change', () => { stashDraft(); reviewContext(); });
  $('#review').addEventListener('input', () => stashDraft(true));
  $('#review').addEventListener('change', () => stashDraft(true));
  $('#support-project').addEventListener('change', () => { supportSteps(); stashSupport(); });
  $('#support-checkin').addEventListener('input', stashSupport);
  $('#support-checkin').addEventListener('change', stashSupport);
  $('#support-checkin').addEventListener('submit', async event => {
    event.preventDefault(); if (state.saving || !state.learner || state.snapshot?.role !== 'teacher') return;
    stashSupport(); const key = state.supportKey, draft = state.supportDrafts.get(key), v = draft.values;
    const record = { event_id: draft.event_id, source_revision: draft.revision, course_id: state.course, learner_id: state.learner,
      project_id: v['support-project'], step_id: v['support-step'], canonical_id: v['support-dimension'], stream: 'support', timestamp: draft.timestamp,
      support_detail: { dimension_id: v['support-dimension'], level: Number(v['support-level']), context: v['support-task'],
        barrier: v['support-barrier'], strategy: v['support-strategy'], result: v['support-result'], next_action: v['support-next'] } };
    draft.attempted = true; state.saving = true; setBusy(true);
    try {
      const response = await api('support-checkin', { event: record });
      const receipt = response.results?.[record.event_id];
      if (!receipt?.ok || !receipt.revision_id) throw new Error(receipt?.error || 'No verified receipt. Your check-in remains in this session.');
      state.supportDrafts.delete(key); state.supportKey = ''; await load();
      $('#support-save-status').textContent = 'Saved with a verified receipt. Academic achievement is unchanged.';
      message('Support check-in saved with a verified receipt. Academic achievement is unchanged.');
    } catch (error) { $('#support-save-status').textContent = error.message + ' Your support draft remains with this student.'; message($('#support-save-status').textContent, true); }
    finally { state.saving = false; setBusy(false); }
  });
  $('#refresh').addEventListener('click', load);
  $('#login').addEventListener('submit', async event => {
    event.preventDefault(); const button = $('#login button'); button.disabled = true;
    try { await api('login', { access_key: $('#access-key').value }); $('#access-key').value = ''; await load(); }
    catch (error) { message(error.message, true); }
    finally { button.disabled = false; }
  });
  window.addEventListener('storage',event=>{if(event.key==='em_teacher_signed_out'){++state.request;state.drafts.clear(); state.supportDrafts.clear();state.editing=null;clearPrivate();rubricView();showView(state.view);}});
  $('#signout').addEventListener('click', async () => {
    if (state.saving) return;
    localStorage.setItem('em_teacher_signed_out',String(Date.now()));
    ++state.request; state.drafts.clear(); state.supportDrafts.clear(); state.editing = null; clearPrivate(); rubricView(); showView(state.view);
    try { await api('logout', {}); await load(); }
    catch (error) { message('Student information cleared from this page. Sign-out could not reach the server; close this tab to end this view.', true); $('#connection-label').textContent = 'Session not verified'; }
  });
  $('#review').addEventListener('submit', async event => {
    event.preventDefault(); if (state.saving || !state.learner || state.snapshot?.role !== 'teacher') return;
    stashDraft(!state.drafts.has(state.editing.key)); const key = state.editing.key, draft = state.drafts.get(key);
    draft.review_id ||= crypto.randomUUID();
    const body = { ...draft, course_id: state.course, learner_id: state.learner, outcome_id: state.outcome, support: draft.support || null };
    state.saving = true; setBusy(true);
    try {
      const result = await api('review', body);
      state.drafts.delete(key); state.editing = null;
      await load();
      message(result.conflict ? 'Saved; another decision also exists. Resolve the conflict before reporting.' : 'Teacher judgment saved. Google will mirror it at the next sync.');
    } catch (error) { message(error.message + ' Your draft remains with this student and outcome.', true); }
    finally { state.saving = false; setBusy(false); }
  });
  $('#rubrics').addEventListener('click', async event => {
    const button = event.target.closest('[data-download], [data-approve]'); if (!button || state.saving) return;
    const item = state.rubricRows[Number(button.dataset.download ?? button.dataset.approve)]; if (!item) return;
    const r = item.rubric;
    if (button.hasAttribute('data-download')) { download(r, r.id + '-' + r.version + (item.approved ? '-approved' : '-draft') + '.json'); return; }
    state.saving = true; setBusy(true);
    try { await api('rubric', { course_id: state.course, rubric_id: r.id, rubric_version: r.version, confirmed: true }); await load(); message('This rubric version is approved and available for classroom capture.'); }
    catch (error) { message(error.message, true); }
    finally { state.saving = false; setBusy(false); }
  });
  $('#export').addEventListener('click', () => { if (state.snapshot) download(Core.reviewCSV(state.snapshot), 'standards-review-' + state.course + '.csv', 'text/csv;charset=utf-8'); });

  $('#today').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  $$('[data-course]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.course === state.course)));
  if (location.hostname.includes('--outcome-evidence-map.netlify.app')) {
    const notice = document.createElement('div'); notice.className = 'preview-notice'; notice.textContent = 'Dashboard preview · isolated test records · not the live classroom'; document.body.prepend(notice);
  }
  fetch('/connected-catalogue.json').then(r => { if (!r.ok) throw new Error('Course catalogue unavailable'); return r.json(); }).then(catalogue => {
    state.catalogue = catalogue; rubricView(); planView(); return load();
  }).catch(error => message(error.message, true));
  fetch('/outputs/connected-course-map-2026-09-23/Course_Map.json').then(r => { if (!r.ok) throw new Error('Daily plan unavailable'); return r.json(); }).then(plan => { state.plan = plan; planView(); }).catch(() => { $('#plan-status').textContent = 'Course plan could not be loaded. Open the full daily plan using the link below.'; $('#current-plan').innerHTML = empty('Open the daily plan for the sequence'); });
})();
