/* Student OS pilot — browser client. Vanilla JS, no dependencies.
 * Runs against the local demo server (fetch /api/rpc) or inside Apps Script HtmlService (google.script.run).
 * Safety rule: user-authored text is only ever inserted with textContent / text nodes. innerHTML is never used.
 */
(function () {
  'use strict';

  var COLUMNS = ['plan', 'working', 'need_feedback', 'revise', 'complete'];
  var COLUMN_LABELS = { plan: 'To do', working: 'Working', need_feedback: 'Need feedback', revise: 'Revise', complete: 'Complete' };
  var PROMPTS = { tried: 'What did I try?', evidence: 'What evidence shows my progress?', changed: 'What changed after feedback?', next: 'What will I do next?' };
  var COURSE_TITLES = { IBDS: 'IB Digital Society SL', COM11: 'Communications Technology 11', MM12: 'Multimedia 12' };
  var S = { me: null, config: null, dirty: false, lastHash: '' };
  var isGAS = !!(window.google && window.google.script && window.google.script.run);

  /* ------------------------------------------------------------ DOM helpers (text-only) */
  function h(tag, attrs) {
    var el = document.createElement(tag);
    var a = attrs || {};
    Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v === null || v === undefined || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'style') el.style.cssText = v; // CSSOM, permitted under the strict CSP (style attributes are not)
      else if (k === 'value') el.value = v;
      else if (k === 'checked') el.checked = !!v;
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid === null || kid === undefined || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.appendChild(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  function fill(el) { el.replaceChildren(); for (var i = 1; i < arguments.length; i++) append(el, arguments[i]); return el; }
  function safeLink(url, label, cls) {
    if (typeof url === 'string' && /^https:\/\/[^\s<>"'`\\]+$/.test(url))
      return h('a', { href: url, target: '_blank', rel: 'noopener noreferrer', class: cls || null }, label || url, h('span', { class: 'visually-hidden', text: ' (opens in a new tab)' }));
    return h('span', { text: label || '' });
  }
  function paragraphs(text) {
    var parts = String(text || '').split(/\n{2,}/).filter(function (p) { return p.trim(); });
    return parts.length ? parts.map(function (p) { return h('p', { text: p }); }) : [h('p', { class: 'muted', text: 'No text yet.' })];
  }
  function chip(text, cls) { return h('span', { class: 'chip ' + (cls || '') , text: text }); }
  function courseChip(c) { return chip(c, 'course-' + c); }
  function fmt(iso) {
    if (!iso) return '';
    var d = new Date(iso); if (isNaN(d)) return iso;
    return d.toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
  }
  function mondayOf(ymd) { var d = new Date(ymd + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toISOString().slice(0, 10); }
  function fmtDate(ymd) {
    if (!ymd) return '';
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd); if (!m) return ymd;
    return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  }
  function announce(msg) { var l = document.getElementById('live'); l.textContent = ''; setTimeout(function () { l.textContent = msg; }, 30); }
  var toastTimer;
  function toast(msg) {
    var t = document.getElementById('toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.hidden = true; }, 7000);
  }
  function errMsg(e) { return (e && e.message) || 'Something went wrong. Nothing was saved.'; }
  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }
  function main() { return document.getElementById('main'); }
  function setMain() {
    var m = main(); m.replaceChildren();
    for (var i = 0; i < arguments.length; i++) append(m, arguments[i]);
    // Move focus to new content after in-app navigation, but not on first load (keeps the skip link first).
    if (!S.noFocus) m.focus({ preventScroll: true });
  }
  function empty(title, text, action) { return h('div', { class: 'empty' }, h('strong', { text: title }), h('span', { text: text }), action ? h('div', { class: 'actions' }, action) : null); }
  function panel(title, kids, extra) { return h('section', { class: 'panel', 'aria-label': title }, h('div', { class: 'panel-head' }, h('h2', { text: title }), extra || null), kids); }

  /* ------------------------------------------------------------ transport */
  function call(method, args) {
    if (isGAS) {
      return new Promise(function (resolve, reject) {
        window.google.script.run
          .withSuccessHandler(function (r) { if (r && r.ok) resolve(r.result); else reject((r && r.error) || { code: 'SERVER', message: 'No response. Nothing was saved.' }); })
          .withFailureHandler(function () { reject({ code: 'NETWORK', message: 'Could not reach Student OS. Nothing was saved — your text is still on this page.' }); })
          .rpc(method, args || {});
      });
    }
    return fetch('/api/rpc', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Student-OS': '1' }, body: JSON.stringify({ method: method, args: args || {} }) })
      .then(function (r) {
        return r.json().catch(function () { throw { code: 'NETWORK', message: 'Unexpected response. Nothing was saved.' }; })
          .then(function (j) { if (!j.ok) throw j.error; return j.result; });
      }, function () { throw { code: 'NETWORK', message: 'Could not reach Student OS. Nothing was saved — your text is still on this page.' }; });
  }
  function post(path, body) {
    return fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Student-OS': '1' }, body: JSON.stringify(body || {}) }).then(function (r) { return r.json(); });
  }

  /* ------------------------------------------------------------ shell */
  function renderChrome() {
    var who = document.getElementById('whoami'); who.replaceChildren();
    var nav = document.getElementById('nav'); nav.replaceChildren();
    if (!S.me) return;
    append(who, [h('span', { class: 'name', text: S.me.display_name }), S.me.courses.map(function (c) { return courseChip(c.course_id); }), S.me.demo ? chip('Demo', 'demo') : null]);
    if (S.me.kind === 'teacher') {
      append(who, h('select', { id: 'preview-course', 'aria-label': 'View as a practice student', onchange: function (e) { if (e.target.value) setPreview(e.target.value); } },
        h('option', { value: '' }, 'View as student…'), S.me.courses.map(function (c) { return h('option', { value: c.course_id }, c.course_id + ' practice student'); })));
    }
    if (S.me.preview) append(who, h('button', { type: 'button', class: 'primary', onclick: function () { setPreview(null); } }, 'Back to teacher view'));
    if (!isGAS) append(who, h('button', { type: 'button', onclick: function () { post('/api/signout').then(function () { S.me = null; boot(); }); } }, 'Sign out (demo)'));
    var items = S.me.kind === 'student'
      ? [['#/home', 'Home'], ['#/dashboard', 'My progress'], ['#/supports', 'My supports'], ['#/journal', 'My blog'], ['#/board', 'My board'], ['#/discussions', 'Discussions'], ['#/mistakes', 'Review list'], ['#/class', 'Class feed'], ['#/assignments', 'Assignments'], ['#/portfolio', 'Portfolio']]
      : [['#/adaptations', 'Adaptations'], ['#/results', 'Release results'], ['#/reflections', 'Reflections'], ['#/discussions', 'Discussions'], ['#/exitnotes', 'Exit notes'], ['#/review', 'Shared with me'], ['#/classfeed', 'Class feeds'], ['#/activity', 'Course activity']];
    append(nav, h('div', { class: 'nav-group', text: S.me.kind === 'student' ? 'My workspace' : 'Teacher' }));
    items.forEach(function (it) { append(nav, h('a', { href: it[0], 'data-route': it[0] }, it[1])); });
    markNav();
  }
  function markNav() {
    var cur = '#/' + (location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || '');
    document.querySelectorAll('#nav a').forEach(function (a) {
      var r = a.getAttribute('data-route');
      var match = r === cur || (cur === '#/entry' && r === '#/journal') || (cur === '#/assignment' && r === '#/assignments') || (cur === '#/reviewentry' && r === '#/review') || (cur === '#/discussion' && r === '#/discussions');
      if (match) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  }
  function setPreview(course) {
    call('setPreview', { course_id: course }).then(function () { S.me = null; location.hash = course ? '#/home' : '#/reflections'; boot(); }, function (e) { toast(errMsg(e)); });
  }
  function banner() {
    var b = document.getElementById('mode-banner');
    var text = !isGAS ? 'Local demonstration · synthetic data · not a deployed Student OS. Submission receipts are Demo.'
      : (S.me && S.me.demo ? 'Pilot with Demo adapters · submissions are not sent to the evidence system.' : '');
    if (S.me && S.me.preview) text = 'You are viewing as a practice student in ' + S.me.courses[0].course_id + '. Anything you post appears in your teacher views as “Practice student”.';
    b.hidden = !text; fill(b, h('strong', { text: S.me && S.me.preview ? 'Preview · ' : 'Pilot · ' }), text);
  }

  /* ------------------------------------------------------------ routing */
  function parseHash() {
    var raw = location.hash.replace(/^#\/?/, '');
    var q = raw.indexOf('?'), path = q >= 0 ? raw.slice(0, q) : raw, params = {};
    if (q >= 0) raw.slice(q + 1).split('&').forEach(function (kv) { var p = kv.split('='); if (p[0]) params[decodeURIComponent(p[0])] = decodeURIComponent(p[1] || ''); });
    var parts = path.split('/').map(function (p) { return decodeURIComponent(p); });
    return { name: parts[0] || '', id: parts[1] || null, params: params };
  }
  function route() {
    if (S.dirty && location.hash !== S.lastHash) {
      if (!confirm('You have unsaved changes. Leave this page without saving?')) { history.replaceState(null, '', S.lastHash); return; }
      S.dirty = false;
    }
    S.lastHash = location.hash;
    S.noFocus = !!S.initial; S.initial = false;
    markNav();
    var r = parseHash();
    if (!S.me) return;
    var student = S.me.kind === 'student';
    var views = student
      ? { home: renderHome, dashboard: renderDashboard, supports: renderSupports, journal: renderJournal, entry: renderEditor, board: renderBoard, class: renderClass, assignments: renderAssignments, assignment: renderAssignment, portfolio: renderPortfolio,
          discussions: renderDiscussions, discussion: renderDiscussion, mistakes: renderReviewList }
      : { adaptations: renderAdaptations, results: renderTeacherResults, reflections: renderReflections, review: renderReview, reviewentry: renderReviewEntry, classfeed: renderClass, activity: renderActivity,
          discussions: renderDiscussions, discussion: renderDiscussion, exitnotes: renderExitNotes };
    var fn = views[r.name];
    if (!fn) { location.replace(student ? '#/home' : '#/reflections'); return; }
    setMain(h('p', { class: 'muted', text: 'Loading…' }));
    Promise.resolve(fn(r)).catch(function (e) {
      setMain(h('h1', { text: e && e.code === 'NOT_FOUND' ? 'Not found' : 'Could not load this page' }), h('div', { class: 'banner error', text: errMsg(e) }), h('a', { href: student ? '#/home' : '#/review' }, 'Back'));
    });
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('message', function (event) {
    if (!S.supportFrame || event.source !== S.supportFrame.contentWindow || event.origin !== 'https://ctwadden.github.io' || !event.data || event.data.type !== 'student-os-support-use' || !S.me || S.me.kind !== 'student') return;
    call('logSupportUse', event.data.event || {}).catch(function () { toast('Support use could not be recorded. Your workbook is still available.'); });
  });
  window.addEventListener('beforeunload', function (ev) { if (S.dirty) { ev.preventDefault(); ev.returnValue = ''; } });

  /* ------------------------------------------------------------ plain-language helpers */
  var AUD = {
    private: { label: 'Just me', icon: 'lock', long: 'Only you can see this.' },
    teacher: { label: 'My teacher', icon: 'teacher', long: 'Shared with your teacher.' },
    class: { label: 'My teacher and class', icon: 'class', long: 'Shared with your teacher and classmates in this course.' }
  };
  function audChip(a) { var x = AUD[a || 'private']; return chip(x.label, 'aud aud-' + (a || 'private')); }
  function sharedState(e) {
    if (!e || !e.state) return { text: 'Not saved yet', tone: 'new' };
    var s = e.state.submitted;
    if (!s) return { text: 'Draft saved · only you can see it', tone: 'draft' };
    if (!s.current_version_submitted) return { text: 'Edited since you shared it — press “Update post” to share the changes. Until then your ' + (e.audience === 'class' ? 'teacher and class see' : 'teacher sees') + ' the earlier version.', tone: 'changed' };
    return { text: AUD[e.audience || 'teacher'].long + ' ' + fmt(s.at), tone: 'shared' };
  }
  function when(ymd) { return fmtDate(ymd).replace(/, \d{4}$/, ''); }

  /* ------------------------------------------------------------ student: home */
  function renderHome() {
    return call('home').then(function (d) {
      var first = d.profile.display_name.split(' ')[0];

      var sprints = d.sprints.length ? h('div', { class: 'sprints' }, d.sprints.map(function (x) {
        if (x.upcoming) return h('div', { class: 'sprint course-' + x.course_id }, h('p', { class: 'eyebrow', text: COURSE_TITLES[x.course_id] }),
          h('h2', { text: 'Next: ' + x.upcoming.title }), h('p', { class: 'small', text: 'Starts ' + when(x.upcoming.start) }));
        var pct = Math.round(100 * x.week / x.weeks);
        return h('div', { class: 'sprint course-' + x.course_id },
          h('p', { class: 'eyebrow', text: COURSE_TITLES[x.course_id] + ' · Sprint ' + x.sprint.number + ' · week ' + x.week + ' of ' + x.weeks }),
          h('h2', { text: x.sprint.title }),
          x.sprint.question ? h('p', { class: 'sprint-q', text: x.sprint.question }) : null,
          h('div', { class: 'progress', role: 'img', 'aria-label': 'Week ' + x.week + ' of ' + x.weeks }, h('span', { style: 'width:' + pct + '%' })),
          x.next ? h('p', { class: 'small muted', text: 'Up next: ' + x.next.title + ' · ' + when(x.next.start) }) : null);
      })) : null;

      var prompts = d.prompts.map(function (p) {
        var r = p.response;
        var action = r ? (r.shared ? h('a', { class: 'btn', href: '#/entry/' + encodeURIComponent(r.entry_id) }, 'Shared ✓ · view') : h('a', { class: 'btn primary', href: '#/entry/' + encodeURIComponent(r.entry_id) }, 'Keep writing'))
          : h('a', { class: 'btn primary', href: '#/entry/new?course=' + p.course_id + '&prompt=' + encodeURIComponent(p.id) }, 'Write my reflection');
        return h('section', { class: 'prompt-card' + (r && r.shared ? ' done' : ''), 'aria-label': p.title },
          h('div', { class: 'row' }, courseChip(p.course_id), chip(p.kind === 'weekly' ? 'Weekly' : p.kind === 'sprint' ? 'Sprint' : 'From your teacher'),
            p.closes_on ? h('span', { class: 'small muted', text: 'open until ' + when(p.closes_on) }) : null),
          h('h2', { text: p.title }),
          h('ul', { class: 'prompt-qs' }, p.questions.map(function (q) { return h('li', { text: q }); })),
          action);
      });

      var focus = d.focus.length ? h('ul', { class: 'focus-list' }, d.focus.map(function (c) {
        return h('li', { class: c.column === 'complete' ? 'done' : '' }, h('span', { class: 'dot', 'aria-hidden': 'true' }),
          h('a', { href: '#/board?card=' + encodeURIComponent(c.id) }, c.title),
          h('span', { class: 'small muted', text: COLUMN_LABELS[c.column] + (c.target_date ? ' · ' + when(c.target_date) : '') }));
      })) : empty('Pick your focus for this week', 'Pin up to three cards from your board — the things you most want to finish this week.', h('a', { class: 'btn', href: '#/board' }, 'Open my board'));

      var counts = h('a', { class: 'mini-board', href: '#/board', 'aria-label': 'Open my board' }, COLUMNS.map(function (k) {
        return h('div', null, h('b', { text: String(d.board_counts[k]) }), h('span', { text: COLUMN_LABELS[k] }));
      }));

      var posts = d.recent_entries.length ? h('ul', { class: 'post-list' }, d.recent_entries.map(function (e) {
        return h('li', null, h('a', { class: 'post-title', href: '#/entry/' + encodeURIComponent(e.id) }, e.title),
          h('div', { class: 'row small muted' }, courseChip(e.course_id), audChip(e.audience), h('span', { text: fmt(e.updated_at) })));
      })) : empty('Start your blog', 'Write about what you’re making, what’s working and what’s not. Keep it to yourself or share it.', h('a', { class: 'btn primary', href: '#/entry/new' }, 'Write a post'));

      var feedback = d.feedback.length ? h('ul', { class: 'list' }, d.feedback.map(function (f) {
        return h('li', null, h('blockquote', { class: 'fb-quote', text: f.body }),
          h('div', { class: 'row small' }, h('a', { href: '#/entry/' + encodeURIComponent(f.entry_id) }, 'On “' + f.entry_title + '”'),
            f.acted_on ? chip('You revised it', 'ok') : chip('Try it next', 'warn')));
      })) : h('p', { class: 'muted small', text: 'When your teacher replies to something you shared, it shows up here.' });

      var classmates = d.class_feed.length ? h('ul', { class: 'post-list' }, d.class_feed.map(function (x) {
        return h('li', null, h('a', { class: 'post-title', href: '#/class?course=' + x.course_id }, x.title), h('div', { class: 'small muted', text: x.author + ' · ' + x.course_id }));
      })) : h('p', { class: 'muted small', text: 'Posts your classmates share with the class appear here.' });

      var deadlines = d.deadlines.length ? h('ul', { class: 'list' }, d.deadlines.slice(0, 4).map(function (x) {
        return h('li', null, h('b', { text: when(x.date) }), ' · ', h('a', { href: '#/assignment/' + encodeURIComponent(x.assignment_key) }, x.title));
      })) : h('p', { class: 'muted small', text: 'No upcoming deadlines from your teachers.' });

      setMain(
        h('div', { class: 'home-head' }, h('div', null, h('h1', { text: 'Hi, ' + first }), h('p', { class: 'lede', text: 'Here’s your week.' })),
          h('a', { class: 'btn primary', href: '#/entry/new' }, '+ New post')),
        sprints,
        prompts.length ? h('div', { class: 'prompts' }, prompts) : null,
        h('section', { class: 'today', 'aria-label': 'Today' },
          h('div', { class: 'today-item' }, h('p', { class: 'eyebrow', text: 'End of class' }),
            h('div', { class: 'row' }, d.exit_notes.map(function (x) {
              return h('button', { type: 'button', class: 'exit-btn' + (x.note ? ' done' : ''), onclick: function () { exitNoteDialog(x.course_id, x.note, function () { route(); }); } },
                x.note ? '✓ ' + x.course_id + ' note sent · edit' : 'Check out of ' + x.course_id);
            }))),
          h('a', { class: 'today-item link-card', href: '#/mistakes' }, h('p', { class: 'eyebrow', text: 'Review list' }),
            h('b', { text: d.review_due ? d.review_due + ' to review today' : 'Nothing due today' }),
            d.quiz_new ? h('span', { class: 'small', text: d.quiz_new + ' new from quiz feedback' }) : null)),
        d.discussions.length ? h('section', { class: 'd-home', 'aria-label': 'Discussions' }, h('div', { class: 'panel-head' }, h('h2', { text: 'Join the discussion' }), h('a', { class: 'small', href: '#/discussions' }, 'All discussions')),
          h('div', { class: 'd-list' }, d.discussions.map(function (x) {
            return h('a', { class: 'd-card', href: '#/discussion/' + encodeURIComponent(x.id) }, h('div', { class: 'row' }, courseChip(x.course_id), chip(x.mode === 'debate' ? 'Debate' : 'Discussion'), x.responded ? chip('You responded', 'ok') : chip('Your turn', 'warn')),
              h('h3', { text: x.title }), h('p', { class: 'small muted', text: x.response_count + ' response' + (x.response_count === 1 ? '' : 's') }));
          }))) : null,
        h('div', { class: 'grid two' },
          h('div', null,
            panel('This week’s focus', focus, h('a', { class: 'small', href: '#/board' }, 'Change')),
            panel('My board', counts),
            panel('My blog', posts, h('a', { class: 'small', href: '#/journal' }, 'All posts'))),
          h('div', null,
            panel('Feedback for me', feedback),
            panel('From my class', classmates, h('a', { class: 'small', href: '#/class' }, 'Class feed')),
            panel('Forms and quizzes', d.forms.length ? h('ul', { class: 'list forms' }, d.forms.map(function (f) {
              return h('li', null, h('div', { class: 'row' }, courseChip(f.course_id), chip(f.kind === 'quiz' ? 'Quiz' : 'Form')),
                f.url ? h('p', { class: 'form-title' }, safeLink(f.url, f.title)) : h('p', { class: 'form-title', text: f.title + (f.date ? ' · ' + when(f.date) : '') }),
                h('p', { class: 'small muted', text: f.kind === 'quiz' ? f.delivery : (f.state || '') }));
            })) : h('p', { class: 'muted small', text: 'No forms or quizzes released for your courses yet.' })),
            panel('Coming up', deadlines),
            d.announcements.length ? panel('Announcements', h('ul', { class: 'list' }, d.announcements.map(function (n) {
              return h('li', null, h('b', { text: n.title }), n.demo ? ' ' : null, n.demo ? chip('Demo', 'demo') : null, h('p', { class: 'small', text: n.body }));
            }))) : null)));
    });
  }

  function renderDashboard() {
    return call('studentDashboard').then(function (d) {
      var panels = d.courses.map(function (c) {
        var workflowPct = c.workflow.assignments_total ? Math.round(100 * c.workflow.assignments_done / c.workflow.assignments_total) : 0;
        var results = c.released_results.items.length ? h('ol', { class: 'timeline' }, c.released_results.items.map(function (r) {
          return h('li', null, h('b', { text: r.title || r.task_id }),
            h('span', { text: 'Raw mark: ' + (r.raw_earned == null ? 'not scored' : r.raw_earned + (r.raw_possible == null ? '' : '/' + r.raw_possible)) + ' · ' + fmt(r.released_at) }),
            r.approved_feedback ? h('p', { text: r.approved_feedback }) : null);
        })) : h('p', { class: 'small muted', text: c.released_results.note });
        var feedback = c.feedback_waiting.length ? h('ul', { class: 'list' }, c.feedback_waiting.map(function (f) {
          return h('li', { class: 'spread' }, h('span', { text: 'Teacher feedback · ' + fmt(f.released_at) }), h('button', { type: 'button', class: 'link', onclick: function (ev) {
            ev.target.disabled = true;
            call('readFeedback', { comment_id: f.comment_id }).then(function () { location.hash = '#/entry/' + encodeURIComponent(f.entry_id); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
          } }, 'Read feedback'));
        })) : h('p', { class: 'small muted', text: 'No unread teacher feedback.' });
        var effort = h('div', { class: 'badge-grid' }, c.effort_badges.map(function (b) {
          return h('div', { class: 'badge-card effort' + (b.earned ? ' earned' : ''), 'aria-label': b.label + (b.earned ? ', earned' : ', in progress') },
            h('span', { class: 'badge-icon', 'aria-hidden': 'true', text: b.earned ? '★' : '○' }), h('b', { text: b.label }),
            h('span', { class: 'small', text: b.earned ? 'Earned from your Student OS activity' : b.current + ' of ' + b.target }));
        }));
        var skills = c.achievement.badges.length ? h('div', { class: 'badge-grid' }, c.achievement.badges.map(function (b) {
          return h('div', { class: 'badge-card skill' }, h('span', { class: 'badge-icon', 'aria-hidden': 'true', text: '✓' }), h('b', { text: b.title || b.outcome_code }),
            h('span', { class: 'small mono', text: b.outcome_id }), h('span', { class: 'small', text: b.confirmed_count + ' teacher-confirmed evidence record' + (b.confirmed_count === 1 ? '' : 's') }));
        })) : h('p', { class: 'small muted', text: 'No teacher-confirmed, crosswalk-matched competency evidence yet.' });
        var cert = c.achievement.certificate;
        var certificate = cert ? h('div', { class: 'certificate' + (cert.awarded ? ' awarded' : '') },
          h('span', { class: 'cert-mark', 'aria-hidden': 'true', text: cert.awarded ? '◆' : '◇' }),
          h('div', null, h('b', { text: cert.title + ' certificate' }), h('p', { class: 'small', text: cert.awarded ? 'Awarded: every required evidence item has been teacher-reviewed.' : cert.teacher_reviewed + ' of ' + cert.required + ' required evidence items teacher-reviewed.' }))) : null;
        return h('section', { class: 'course-dashboard course-' + c.course_id, 'aria-labelledby': 'dash-' + c.course_id },
          h('div', { class: 'panel-head' }, h('div', null, h('p', { class: 'eyebrow', text: c.course_id }), h('h2', { id: 'dash-' + c.course_id, text: c.title }))),
          h('div', { class: 'dashboard-grid' },
            h('section', { class: 'dash-block activity-data' }, h('h3', { text: 'Workflow, support and independence' }),
              h('p', { class: 'metric', text: c.workflow.assignments_done + ' / ' + c.workflow.assignments_total }), h('p', { class: 'small', text: 'released assignments moved to Complete' }),
              h('div', { class: 'progress', role: 'img', 'aria-label': workflowPct + ' percent of released assignments complete' }, h('span', { style: 'width:' + workflowPct + '%' })),
              h('dl', { class: 'metrics' }, h('dt', { text: 'Tutorial checklist steps' }), h('dd', { text: String(c.workflow.tutorial_steps_done) }),
                h('dt', { text: 'Shared self-checks' }), h('dd', { text: String(c.workflow.self_checks) }), h('dt', { text: 'Reflection streak' }), h('dd', { text: c.reflection_streak + ' week' + (c.reflection_streak === 1 ? '' : 's') })),
              h('p', { class: 'separation-note', text: c.workflow.note })),
            h('section', { class: 'dash-block' }, h('h3', { text: 'Review and feedback' }),
              h('dl', { class: 'metrics' }, h('dt', { text: 'Review items active' }), h('dd', { text: String(c.review.active) }), h('dt', { text: 'Due today' }), h('dd', { text: String(c.review.due) }),
                h('dt', { text: 'Feedback waiting to be read' }), h('dd', { text: String(c.feedback_waiting.length) })), feedback),
            h('section', { class: 'dash-block' }, h('h3', { text: 'Released results over time' }), results,
              h('p', { class: 'separation-note', text: 'Raw marks are shown only after teacher release. A raw mark is not an IB grade.' })),
            h('section', { class: 'dash-block achievement-data' }, h('h3', { text: 'Teacher-confirmed achievement' }), skills,
              h('p', { class: 'separation-note', text: c.achievement.note }))),
          h('div', { class: 'badge-section' }, h('h3', { text: 'Effort badges' }), effort), certificate);
      });
      setMain(h('p', { class: 'eyebrow', text: 'Student success dashboard' }), h('h1', { text: 'My progress' }),
        h('p', { class: 'lede', text: 'One view for what you have done, what needs attention and what your teacher has confirmed.' }),
        h('div', { class: 'banner info', text: 'Activity and support information are shown separately from achievement. Completing a tutorial, posting a reflection or earning an effort badge does not create a grade.' }), panels);
    });
  }

  /* ------------------------------------------------------------ student: blog */
  function renderJournal(r) {
    var show = r.params.show || '';
    return call('listEntries', {}).then(function (entries) {
      var list = entries.filter(function (e) { return !show || (e.audience || 'private') === show; });
      var filters = h('div', { class: 'filters', role: 'group', 'aria-label': 'Show posts' }, [['', 'All'], ['private', 'Just me'], ['teacher', 'Teacher'], ['class', 'Class']].map(function (f) {
        return h('a', { href: '#/journal' + (f[0] ? '?show=' + f[0] : ''), class: 'filter' + (show === f[0] ? ' on' : ''), 'aria-current': show === f[0] ? 'true' : null }, f[1]);
      }));
      var posts = list.length ? h('div', { class: 'feed' }, list.map(function (e) {
        var excerpt = e.body.length > 360 ? e.body.slice(0, 360).trim() + '…' : e.body;
        var answered = (e.answers || []).filter(function (x) { return x.trim(); });
        return h('article', { class: 'post' },
          h('div', { class: 'meta' }, h('time', { datetime: e.created_at, text: fmt(e.created_at) }), courseChip(e.course_id), audChip(e.audience),
            e.prompt ? chip(e.prompt.title) : null, e.state.feedback_returned ? chip('Feedback', 'ok') : null,
            e.state.submitted && !e.state.submitted.current_version_submitted ? chip('Edited since shared', 'warn') : null),
          h('h2', null, h('a', { href: '#/entry/' + encodeURIComponent(e.id) }, e.title)),
          excerpt ? h('div', { class: 'excerpt', text: excerpt }) : answered.length ? h('div', { class: 'excerpt', text: answered[0] }) : null,
          e.tags.length ? h('div', { class: 'tags' }, e.tags.map(function (t) { return h('span', { class: 'tag', text: '#' + t }); })) : null);
      })) : empty(show ? 'Nothing here yet' : 'Start your blog', 'Your blog is yours. Posts start private; you decide whether to share each one with your teacher or your class.',
        h('a', { class: 'btn primary', href: '#/entry/new' }, 'Write a post'));
      setMain(h('div', { class: 'home-head' }, h('div', null, h('h1', { text: 'My blog' }), h('p', { class: 'lede', text: 'What you’re making, trying and learning — in your own words.' })),
        h('a', { class: 'btn primary', href: '#/entry/new' }, '+ New post')), filters, posts);
    });
  }

  /* ------------------------------------------------------------ student: write / edit a post */
  function renderEditor(r) {
    var isNew = !r.id || r.id === 'new';
    return Promise.all([call('listAssignments'), isNew ? Promise.resolve(null) : call('getEntry', { entry_id: r.id }), isNew && r.params.prompt ? call('listPrompts', {}) : Promise.resolve([])]).then(function (res) {
      var assignments = res[0], entry = res[1];
      var prompt = entry ? entry.prompt : (res[2].filter(function (p) { return p.id === r.params.prompt; })[0] || null);
      if (isNew && prompt && prompt.response) { location.replace('#/entry/' + encodeURIComponent(prompt.response.entry_id)); return; }
      var requestId = uuid();
      var st = { entry: entry, busy: false };
      var initial = entry || { title: prompt ? prompt.title + ' · ' + when(prompt.opens_on) : '', body: '', tags: [], artifacts: [], prompts: {}, answers: [], showcase: false,
        course_id: (prompt && prompt.course_id) || r.params.course || (assignments.filter(function (a) { return a.assignment_key === r.params.assignment; })[0] || {}).course_id || S.me.courses[0].course_id,
        assignment_key: r.params.assignment || null, audience: 'private' };
      var courseSel, asgSel, title, body, tagsIn, showcase, answerFields = [], artifactRows, stateLine, saveBtn, postBtn, msgBox, feedbackBox, historyBox, audBox, extras;
      var audience = entry ? (entry.audience || (entry.first_submitted_at ? 'teacher' : 'private')) : (prompt ? 'teacher' : 'private');

      function markDirty() { if (!S.dirty) S.dirty = true; renderState(); }
      function renderState() {
        var s = S.dirty ? { text: 'Unsaved changes', tone: 'dirty' } : sharedState(st.entry);
        stateLine.dataset.state = s.tone; stateLine.textContent = s.text;
        var shared = st.entry && st.entry.state && st.entry.state.submitted;
        var current = shared && st.entry.state.submitted.current_version_submitted && !S.dirty;
        saveBtn.disabled = st.busy;
        var canPost = audience !== 'private' && !(current && st.entry.audience === audience);
        postBtn.disabled = st.busy || !canPost;
        postBtn.title = audience === 'private' ? 'Choose your teacher or class to share it' : '';
        postBtn.textContent = audience === 'private' ? 'Post' : !shared ? (audience === 'class' ? 'Post to class' : 'Post to teacher') : current ? (st.entry.audience === audience ? 'Shared' : 'Change who can see it') : 'Update post';
        audBox.querySelectorAll('input').forEach(function (i) { i.disabled = st.busy || (i.value === 'private' && !!shared); });
      }
      function readArtifacts() {
        return Array.prototype.map.call(artifactRows.querySelectorAll('.artifact-row'), function (row) {
          return { label: row.querySelector('.a-label').value.trim(), url: row.querySelector('.a-url').value.trim(), type: row.querySelector('.a-type').value };
        }).filter(function (a) { return a.url || a.label; });
      }
      function payload() {
        return { title: title.value, body: body.value, tags: tagsIn.value.split(',').map(function (t) { return t.trim(); }).filter(Boolean), artifacts: readArtifacts(),
          answers: answerFields.map(function (f) { return f.value; }), showcase: showcase.checked, assignment_key: asgSel.value || null };
      }
      function artifactRow(a) {
        var n = artifactRows.children.length + 1, sfx = n + '-' + requestId;
        var row = h('div', { class: 'artifact-row' });
        append(row, [
          h('div', null, h('label', { for: 'a-label-' + sfx }, 'Label'), h('input', { type: 'text', id: 'a-label-' + sfx, class: 'a-label', value: a.label || '', maxlength: 120, oninput: markDirty })),
          h('div', null, h('label', { for: 'a-url-' + sfx }, 'Link (https://)'), h('input', { type: 'url', id: 'a-url-' + sfx, class: 'a-url', value: a.url || '', placeholder: 'https://drive.google.com/…', oninput: markDirty })),
          h('div', null, h('label', { for: 'a-type-' + sfx }, 'Type'), h('select', { id: 'a-type-' + sfx, class: 'a-type', onchange: markDirty },
            [['image', 'Photo / image'], ['document', 'Document'], ['video', 'Video'], ['link', 'Link']].map(function (t) { return h('option', { value: t[0], selected: (a.type || 'image') === t[0] }, t[1]); }))),
          h('button', { type: 'button', class: 'icon', 'aria-label': 'Remove this link', onclick: function () { row.remove(); markDirty(); } }, '✕')]);
        artifactRows.appendChild(row);
      }
      function showError(e, what) {
        if (e && e.code === 'CONFLICT') {
          var cur = e.detail && e.detail.current;
          stateLine.dataset.state = 'conflict'; stateLine.textContent = 'Not saved — changed on another tab or device';
          fill(msgBox, h('div', { class: 'banner error', role: 'alert' },
            h('p', null, h('b', { text: 'This post was changed in another tab or device. ' }), 'Nothing was overwritten, and your text is still here.'),
            cur ? h('details', null, h('summary', { text: 'Show the other version' }), h('div', { class: 'prose' }, paragraphs(cur.body))) : null,
            h('div', { class: 'actions' },
              h('button', { type: 'button', class: 'primary', onclick: function () { save(cur.version); } }, 'Keep my text as version ' + (cur.version + 1)),
              h('button', { type: 'button', onclick: function () { if (confirm('Load the other version? Your unsaved text will be discarded.')) { S.dirty = false; route(); } } }, 'Load the other version'))));
        } else {
          stateLine.dataset.state = 'error'; stateLine.textContent = 'Not ' + what;
          fill(msgBox, h('div', { class: 'banner error', role: 'alert' }, h('b', { text: 'Not ' + what + '. ' }), errMsg(e), ' Your text is still here.'));
        }
        announce('Not ' + what + '. ' + errMsg(e));
      }
      function save(forceVersion) {
        if (st.busy) return Promise.reject();
        st.busy = true; renderState(); stateLine.dataset.state = 'saving'; stateLine.textContent = 'Saving…'; fill(msgBox);
        var args = payload(), p;
        if (!st.entry) { args.course_id = courseSel.value; args.client_request_id = requestId; if (prompt) args.prompt_id = prompt.id; p = call('createEntry', args); }
        else { args.entry_id = st.entry.id; args.base_version = forceVersion || st.entry.version; p = call('updateEntry', args); }
        return p.then(function (saved) {
          var created = !st.entry;
          st.entry = saved; S.dirty = false; st.busy = false; courseSel.disabled = true;
          if (created) { S.lastHash = '#/entry/' + saved.id; history.replaceState(null, '', S.lastHash); }
          heading.textContent = saved.title; refreshSide(); renderState();
          announce('Draft saved.');
          return saved;
        }, function (e) { st.busy = false; renderState(); showError(e, 'saved'); throw e; });
      }
      function doPost() {
        var go = function () {
          var e = st.entry;
          var current = e.state && e.state.submitted && e.state.submitted.current_version_submitted;
          st.busy = true; renderState(); stateLine.dataset.state = 'saving'; stateLine.textContent = 'Sharing…';
          var p = current ? call('setAudience', { entry_id: e.id, audience: audience }).then(function (x) { return { entry: x }; })
            : call('publishEntry', { entry_id: e.id, base_version: e.version, audience: audience });
          p.then(function (res) {
            st.busy = false; st.entry = res.entry; refreshSide(); renderState();
            announce(AUD[audience].long + (res.submission && res.submission.receipt ? ' ' + res.submission.receipt.label : ''));
          }, function (err) { st.busy = false; renderState(); showError(err, 'shared'); });
        };
        var run = function () { if (S.dirty || !st.entry) save().then(go, function () {}); else go(); };
        var asg = assignments.filter(function (a) { return a.assignment_key === asgSel.value; })[0];
        if (asg && !(st.entry && st.entry.state && st.entry.state.submitted)) {
          confirmDialog('Hand this in?', [h('p', null, 'This post will be shared with your teacher as your work for ', h('b', { text: asg.title }), '.'),
            h('p', { class: 'small', text: 'You can keep improving it. Each time you update it, your teacher sees the new version and the earlier ones stay saved.' }),
            S.me.demo ? h('div', { class: 'banner demo', text: 'Demo: the hand-in stays inside this pilot and is not sent to the evidence system.' }) : null], 'Share with my teacher', run);
        } else run();
      }
      function refreshSide() {
        var e = st.entry; if (!e) return;
        var s = e.state || {};
        fill(extras,
          s.teacher_reviewed ? chip('Your teacher has read it', 'ok') : null,
          s.feedback_returned ? chip('Feedback ↓', 'ok') : null,
          s.submitted && s.submitted.receipt ? chip((s.submitted.receipt.mode === 'demo' ? 'Demo receipt ' : 'Receipt ') + s.submitted.receipt.id, s.submitted.receipt.mode === 'demo' ? 'demo' : '') : null);
        fill(feedbackBox, thread(e, function () { call('getEntry', { entry_id: e.id }).then(function (fresh) { st.entry = fresh; refreshSide(); renderState(); }); }));
        fill(historyBox, e.revisions && e.revisions.length > 1 ? h('details', null, h('summary', { text: 'Earlier versions (' + (e.revisions.length - 1) + ')' }),
          h('ul', { class: 'list' }, e.revisions.slice(1).map(function (v) {
            return h('li', { class: 'spread' }, h('span', { class: 'small', text: 'Version ' + v.version + ' · ' + fmt(v.saved_at) }),
              h('button', { type: 'button', class: 'link', onclick: function () { showRevision(e.id, v.version); } }, 'View', h('span', { class: 'visually-hidden', text: ' version ' + v.version })));
          }))) : null);
      }

      courseSel = h('select', { id: 'f-course', disabled: !!entry || !!prompt, onchange: function () { fillAssignments(); markDirty(); } },
        S.me.courses.map(function (c) { return h('option', { value: c.course_id, selected: c.course_id === initial.course_id }, c.title); }));
      asgSel = h('select', { id: 'f-assignment', onchange: markDirty });
      function fillAssignments() {
        fill(asgSel, h('option', { value: '' }, 'Nothing specific'));
        assignments.filter(function (a) { return a.course_id === courseSel.value; }).forEach(function (a) {
          asgSel.appendChild(h('option', { value: a.assignment_key, selected: a.assignment_key === initial.assignment_key }, 'Work for: ' + a.title));
        });
      }
      title = h('input', { type: 'text', id: 'f-title', class: 'title-input', value: initial.title, maxlength: 200, required: true, placeholder: 'Give your post a title', oninput: markDirty });
      body = h('textarea', { id: 'f-body', class: 'body', maxlength: 20000, placeholder: prompt ? 'Anything else you want to say (optional)' : 'What are you working on? What’s going well, what’s hard, what will you try next?', oninput: markDirty });
      body.value = initial.body;
      tagsIn = h('input', { type: 'text', id: 'f-tags', value: initial.tags.join(', '), placeholder: 'photoshop, feedback, sprint5', oninput: markDirty });
      showcase = h('input', { type: 'checkbox', id: 'f-showcase', checked: initial.showcase, onchange: markDirty });
      artifactRows = h('div');
      stateLine = h('p', { class: 'state-line', role: 'status' });
      saveBtn = h('button', { type: 'submit' }, 'Save draft');
      postBtn = h('button', { type: 'button', class: 'primary', onclick: doPost }, 'Post');
      msgBox = h('div'); feedbackBox = h('div'); historyBox = h('div'); extras = h('div', { class: 'row' });
      audBox = h('fieldset', { class: 'audience' }, h('legend', { text: 'Who can see this?' }), ['private', 'teacher', 'class'].map(function (a) {
        return h('label', { class: 'aud-opt' }, h('input', { type: 'radio', name: 'aud', value: a, checked: audience === a, onchange: function () { audience = a; renderState(); } }),
          h('span', null, h('b', { text: AUD[a].label }), h('span', { class: 'small muted', text: a === 'private' ? 'Your private notebook.' : a === 'teacher' ? 'Your teacher can read and reply.' : 'Classmates in this course can read it. Teacher replies stay private.' })));
      }), h('p', { class: 'small muted', text: 'Once your teacher has a post, it stays with them. You can always take a post off the class feed.' }));
      var questionsBox = prompt ? h('div', { class: 'answers' }, h('p', { class: 'eyebrow', text: prompt.title + (prompt.kind === 'weekly' ? ' · from your teacher' : '') }),
        prompt.questions.map(function (q, i) {
          var f = h('textarea', { id: 'ans-' + i, class: 'answer', maxlength: 4000, oninput: markDirty }); f.value = (initial.answers || [])[i] || '';
          answerFields.push(f);
          return h('div', { class: 'field' }, h('label', { for: 'ans-' + i, text: q }), f);
        })) : null;
      fillAssignments();
      (initial.artifacts || []).forEach(artifactRow);

      var heading = h('h1', { class: 'visually-hidden', text: entry ? entry.title : 'New post' });
      var form = h('form', { class: 'composer', onsubmit: function (ev) { ev.preventDefault(); save().catch(function () {}); }, novalidate: true },
        msgBox,
        h('label', { for: 'f-title', class: 'visually-hidden', text: 'Title' }), title,
        h('div', { class: 'row composer-meta' },
          h('div', null, h('label', { for: 'f-course', class: 'small', text: 'Course' }), courseSel),
          h('div', null, h('label', { for: 'f-assignment', class: 'small', text: 'This post is for' }), asgSel)),
        questionsBox,
        h('label', { for: 'f-body', class: prompt ? '' : 'visually-hidden', text: prompt ? 'Anything else?' : 'Post' }), body,
        h('details', { class: 'more', open: (initial.artifacts || []).length || initial.tags.length ? true : null },
          h('summary', { text: 'Photos, links and tags' }),
          h('p', { class: 'small muted', text: 'Link photos and files from your Google Drive. Sharing is still controlled in Drive.' }),
          artifactRows, h('button', { type: 'button', onclick: function () { artifactRow({}); markDirty(); } }, '+ Add a photo or link'),
          h('div', { class: 'field', style: 'margin-top:14px' }, h('label', { for: 'f-tags', text: 'Tags' }), tagsIn),
          h('div', { class: 'row' }, showcase, h('label', { for: 'f-showcase', style: 'margin:0;font-weight:500' }, 'Include in my portfolio (teacher replies are never included)'))),
        h('div', { class: 'composer-bar' }, stateLine, h('div', { class: 'actions' }, saveBtn, postBtn)));

      setMain(heading,
        h('p', { class: 'eyebrow' }, h('a', { href: '#/journal' }, '← My blog')),
        h('div', { class: 'grid two editor-grid' },
          h('div', null, form, h('section', { class: 'panel', 'aria-label': 'Replies' }, h('h2', { text: 'Replies' }), feedbackBox)),
          h('div', null, h('section', { class: 'panel' }, audBox, extras, historyBox))));
      if (entry) refreshSide(); else fill(feedbackBox, h('p', { class: 'muted small', text: 'When you share this post, your teacher can reply here. Replies stay private.' }));
      S.dirty = false; renderState();
      if (!entry) (answerFields[0] || title).focus();
    });
  }

  function showRevision(entryId, version) {
    call('getRevision', { entry_id: entryId, version: version }).then(function (r) {
      openDialog('Version ' + r.version, [h('p', { class: 'small muted', text: 'Saved ' + fmt(r.saved_at) }), h('h3', { text: r.snapshot.title }),
        (r.snapshot.answers || []).filter(function (a) { return a.trim(); }).map(function (a) { return h('div', { class: 'prose' }, paragraphs(a)); }),
        h('div', { class: 'prose' }, paragraphs(r.snapshot.body))]);
    }, function (e) { toast(errMsg(e)); });
  }
  function thread(e, reload) {
    var teacher = S.me.kind === 'teacher';
    var tops = e.comments.filter(function (c) { return !c.parent_id; });
    if (!tops.length) return h('p', { class: 'muted small', text: teacher ? 'No replies yet.' : (e.first_submitted_at ? 'No replies from your teacher yet.' : 'When you share this post, your teacher can reply here. Replies stay private.') });
    return h('ul', { class: 'thread' }, tops.map(function (c) {
      var replies = e.comments.filter(function (x) { return x.parent_id === c.id; });
      return h('li', null, commentCard(c, reload), replies.map(function (x) { return commentCard(x, reload); }),
        !teacher && c.author_role === 'teacher' && c.status === 'released' ? replyForm(e, c, reload) : null);
    }));
  }
  function commentCard(c, reload) {
    var mine = (S.me.kind === 'student' && c.author_role === 'student') || (S.me.kind === 'teacher' && c.author_role === 'teacher');
    var box = h('div', { class: 'comment ' + (c.author_role === 'teacher' ? 'teacher' : 'reply') + (c.status === 'draft' ? ' draft' : '') },
      h('div', { class: 'who' }, h('b', { text: c.author_role === 'teacher' ? c.author_label : 'You' + (S.me.kind === 'teacher' ? '' : '') }),
        c.status === 'draft' ? chip('Draft — the student can’t see this yet', 'warn') : null, c.status === 'released' ? h('span', { text: fmt(c.released_at) }) : null,
        c.status === 'posted' ? h('span', { text: fmt(c.created_at) }) : null, c.version > 1 ? chip('Edited') : null),
      h('div', { class: 'text', text: c.body }),
      c.history && c.history.length ? h('details', { style: 'margin-top:8px' }, h('summary', { class: 'small', text: 'Earlier versions (' + c.history.length + ')' }),
        h('ul', { class: 'activity' }, c.history.map(function (v) { return h('li', null, h('span', { class: 'small muted', text: fmt(v.edited_at) + ': ' }), h('span', { text: v.body })); }))) : null);
    if (S.me.kind === 'teacher' && c.author_role === 'student') box.querySelector('.who b').textContent = 'Student reply';
    if (mine) {
      var actions = h('div', { class: 'actions' });
      append(actions, h('button', { type: 'button', class: 'link', onclick: function () { editComment(c, box, reload); } }, 'Edit'));
      if (S.me.kind === 'teacher' && c.status === 'draft') append(actions, h('button', { type: 'button', class: 'primary', onclick: function (ev) {
        ev.target.disabled = true;
        call('releaseFeedback', { comment_id: c.id, base_version: c.version }).then(function () { announce('Sent to the student.'); reload(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
      } }, 'Send to student'));
      append(box, actions);
    }
    return box;
  }
  function editComment(c, box, reload) {
    var ta = h('textarea', { id: 'edit-' + c.id, 'aria-label': 'Edit comment' }); ta.value = c.body;
    var state = h('span', { class: 'save-state', role: 'status' });
    fill(box, ta, h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'primary', onclick: function (ev) {
        ev.target.disabled = true; state.dataset.state = 'saving'; state.textContent = 'Saving…';
        call('editComment', { comment_id: c.id, base_version: c.version, body: ta.value }).then(function () { announce('Saved.'); reload(); },
          function (e) { ev.target.disabled = false; state.dataset.state = 'error'; state.textContent = 'Not saved: ' + errMsg(e); });
      } }, 'Save'), h('button', { type: 'button', onclick: reload }, 'Cancel'), state));
    ta.focus();
  }
  function replyForm(e, parent, reload) {
    var id = 'reply-' + parent.id;
    var ta = h('textarea', { id: id, class: 'reply-box' });
    var state = h('span', { class: 'save-state', role: 'status' });
    return h('div', { class: 'comment reply compose' }, h('label', { for: id, text: 'Reply to your teacher' }), ta,
      h('div', { class: 'actions' }, h('button', { type: 'button', onclick: function (ev) {
        if (!ta.value.trim()) { ta.focus(); return; }
        ev.target.disabled = true; state.dataset.state = 'saving'; state.textContent = 'Posting…';
        call('addReply', { entry_id: e.id, parent_id: parent.id, body: ta.value }).then(function () { announce('Reply posted.'); reload(); },
          function (err) { ev.target.disabled = false; state.dataset.state = 'error'; state.textContent = 'Not posted: ' + errMsg(err); });
      } }, 'Post reply'), state));
  }

  /* ------------------------------------------------------------ student + teacher: class feed */
  function renderClass(r) {
    var course = r.params.course || '';
    var teacher = S.me.kind === 'teacher';
    return call('classFeed', course ? { course_id: course } : {}).then(function (items) {
      var filters = h('div', { class: 'filters', role: 'group', 'aria-label': 'Course' }, [['', 'All my classes']].concat(S.me.courses.map(function (c) { return [c.course_id, c.course_id]; })).map(function (f) {
        return h('a', { href: '#/' + (teacher ? 'classfeed' : 'class') + (f[0] ? '?course=' + f[0] : ''), class: 'filter' + (course === f[0] ? ' on' : ''), 'aria-current': course === f[0] ? 'true' : null }, f[1]);
      }));
      var list = items.length ? h('div', { class: 'feed' }, items.map(function (x) {
        var answers = (x.answers || []).map(function (a, i) { return a.trim() ? h('div', { class: 'qa' }, h('p', { class: 'q', text: x.questions[i] || '' }), h('div', { class: 'prose' }, paragraphs(a))) : null; });
        return h('article', { class: 'post' + (x.hidden ? ' hidden-post' : '') },
          h('div', { class: 'meta' }, h('b', { text: x.mine ? 'You' : x.author }), courseChip(x.course_id), h('span', { text: fmt(x.shared_at) }), x.prompt_title ? chip(x.prompt_title) : null,
            x.hidden ? chip(teacher ? 'Hidden from class' : 'Your teacher hid this from the class feed', 'warn') : null),
          h('h2', { text: x.title }), answers, x.body ? h('div', { class: 'prose' }, paragraphs(x.body)) : null,
          x.artifacts.length ? h('ul', { class: 'artifacts' }, x.artifacts.map(function (a) { return h('li', null, safeLink(a.url, a.label)); })) : null,
          x.mine ? h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/entry/' + encodeURIComponent(x.entry_id) }, 'Edit my post'),
            h('button', { type: 'button', onclick: function (ev) { ev.target.disabled = true; call('setAudience', { entry_id: x.entry_id, audience: 'teacher' }).then(function () { announce('Taken off the class feed. Your teacher can still see it.'); route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); }); } }, 'Take off class feed')) : null,
          teacher ? h('div', { class: 'actions' }, h('button', { type: 'button', onclick: function (ev) {
            ev.target.disabled = true; call('setClassHidden', { entry_id: x.entry_id, hidden: !x.hidden }).then(function () { announce(x.hidden ? 'Shown to the class again.' : 'Hidden from the class.'); route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
          } }, x.hidden ? 'Show to class again' : 'Hide from class')) : null);
      })) : empty('Nothing shared with the class yet', teacher ? 'Posts students choose to share with their class appear here. You can hide any post.' : 'When you or your classmates choose “My teacher and class”, the post appears here. Teacher replies are never shown.');
      setMain(h('h1', { text: teacher ? 'Class feeds' : 'Class feed' }),
        h('p', { class: 'lede', text: teacher ? 'What students have chosen to share with their class.' : 'Posts your classmates chose to share. Be kind — everyone is still learning.' }), filters, list);
    });
  }

  /* ------------------------------------------------------------ exit note (end of class) */
  var CONF = ['Lost', 'Getting there', 'Got it', 'Could teach it'];
  function exitNoteDialog(course, note, done) {
    var clicked = h('textarea', { id: 'x-clicked', maxlength: 1000, placeholder: 'One thing that made sense today' }); clicked.value = note ? note.clicked : '';
    var fuzzy = h('textarea', { id: 'x-fuzzy', maxlength: 1000, placeholder: 'One thing you’re not sure about yet' }); fuzzy.value = note ? note.fuzzy : '';
    var st = h('span', { class: 'save-state', role: 'status' });
    var conf = h('fieldset', { class: 'conf' }, h('legend', { text: 'How confident do you feel?' }), CONF.map(function (c, i) {
      return h('label', { class: 'conf-opt' }, h('input', { type: 'radio', name: 'x-conf', value: String(i + 1), checked: note && note.confidence === i + 1 }), h('span', { text: c }));
    }));
    var d = openDialog('End of class · ' + COURSE_TITLES[course], [
      h('p', { class: 'small muted', text: 'Thirty seconds. It goes to your teacher — not a mark.' }),
      h('div', { class: 'field' }, h('label', { for: 'x-clicked', text: 'What clicked today?' }), clicked),
      h('div', { class: 'field' }, h('label', { for: 'x-fuzzy', text: 'What’s still fuzzy?' }), fuzzy),
      conf,
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: function (ev) {
        var picked = d.querySelector('input[name=x-conf]:checked');
        ev.target.disabled = true; st.dataset.state = 'saving'; st.textContent = 'Sending…';
        call('saveExitNote', { course_id: course, clicked: clicked.value, fuzzy: fuzzy.value, confidence: picked ? Number(picked.value) : null, base_version: note ? note.version : undefined })
          .then(function (n) { d.close(); announce('Exit note sent to your teacher.'); done(n); }, function (e) { ev.target.disabled = false; st.dataset.state = 'error'; st.textContent = 'Not sent: ' + errMsg(e); });
      } }, note ? 'Update my note' : 'Send to my teacher'), st)]);
    clicked.focus();
  }

  /* ------------------------------------------------------------ discussions */
  function mediaBlock(m) {
    if (!m) return null;
    var local = /^\/media\/[a-z0-9-]+\.(svg|png|jpg)$/.test(m.url);
    if (m.type === 'image' && (local || /^https:\/\//.test(m.url)))
      return h('figure', { class: 'd-media' }, h('img', { src: m.url, alt: m.caption || 'Image posted by your teacher', loading: 'lazy', referrerpolicy: 'no-referrer' }), m.caption ? h('figcaption', { text: m.caption }) : null);
    return h('div', { class: 'd-link' }, h('span', { class: 'eyebrow', text: m.type === 'article' ? 'Article' : m.type === 'video' ? 'Video' : 'Link' }), safeLink(m.url, m.caption || m.url), m.caption ? null : null);
  }
  function renderDiscussions(r) {
    var teacher = S.me.kind === 'teacher';
    var course = r.params.course || '';
    return call('listDiscussions', course ? { course_id: course } : {}).then(function (list) {
      var tabs = h('div', { class: 'filters', role: 'group', 'aria-label': 'Course' }, [['', 'All']].concat(S.me.courses.map(function (c) { return [c.course_id, c.course_id]; })).map(function (f) {
        return h('a', { href: '#/discussions' + (f[0] ? '?course=' + f[0] : ''), class: 'filter' + (course === f[0] ? ' on' : ''), 'aria-current': course === f[0] ? 'true' : null }, f[1]);
      }));
      var items = list.length ? h('div', { class: 'd-list' }, list.map(function (x) {
        return h('a', { class: 'd-card' + (x.open ? '' : ' closed'), href: '#/discussion/' + encodeURIComponent(x.id) },
          h('div', { class: 'row' }, courseChip(x.course_id), chip(x.mode === 'debate' ? 'Debate' : 'Discussion'), x.open ? null : chip('Closed'),
            !teacher ? (x.responded ? chip('You responded', 'ok') : x.open ? chip('Your turn', 'warn') : null) : null),
          h('h2', { text: x.title }), h('p', { class: 'small', text: x.prompt.length > 160 ? x.prompt.slice(0, 160) + '…' : x.prompt }),
          h('p', { class: 'small muted', text: x.response_count + ' response' + (x.response_count === 1 ? '' : 's') + (x.media ? ' · ' + (x.media.type === 'image' ? 'image' : x.media.type) : '') }));
      })) : empty('No discussions yet', teacher ? 'Post an article, image or question for your class to discuss or debate.' : 'When your teacher posts something to discuss, it appears here.');
      var form = null;
      if (teacher) {
        var dc = h('select', { id: 'd-course' }, S.me.courses.map(function (c) { return h('option', { value: c.course_id, selected: c.course_id === (course || S.me.courses[0].course_id) }, c.title); }));
        var dt = h('input', { type: 'text', id: 'd-title', maxlength: 160, placeholder: 'Should schools use AI detectors?' });
        var dp = h('textarea', { id: 'd-prompt', maxlength: 2000, placeholder: 'What do you want students to think about? Ask for evidence.' });
        var mtype = h('select', { id: 'd-mtype' }, [['', 'No link or image'], ['article', 'Article link'], ['image', 'Image link'], ['video', 'Video link'], ['link', 'Other link']].map(function (o) { return h('option', { value: o[0] }, o[1]); }));
        var murl = h('input', { type: 'url', id: 'd-murl', placeholder: 'https://…' });
        var mcap = h('input', { type: 'text', id: 'd-mcap', maxlength: 300, placeholder: 'Title or caption (and source)' });
        var mode = h('select', { id: 'd-mode' }, h('option', { value: 'discuss' }, 'Open discussion'), h('option', { value: 'debate' }, 'Debate — students pick a side'));
        var pos = h('input', { type: 'text', id: 'd-pos', value: 'Agree, Disagree' });
        var rf = h('input', { type: 'checkbox', id: 'd-rf', checked: true });
        var st = h('span', { class: 'save-state', role: 'status' });
        form = panel('Post a discussion', [
          h('div', { class: 'field' }, h('label', { for: 'd-course', text: 'Class' }), dc),
          h('div', { class: 'field' }, h('label', { for: 'd-title', text: 'Title' }), dt),
          h('div', { class: 'field' }, h('label', { for: 'd-prompt', text: 'Question or prompt' }), dp),
          h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'd-mtype', text: 'Attach' }), mtype), h('div', { class: 'field' }, h('label', { for: 'd-murl', text: 'Link (https://)' }), murl)),
          h('div', { class: 'field' }, h('label', { for: 'd-mcap', text: 'Caption' }), mcap),
          h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'd-mode', text: 'Format' }), mode), h('div', { class: 'field' }, h('label', { for: 'd-pos' }, 'Debate positions ', h('span', { class: 'hint', text: '(comma separated)' })), pos)),
          h('div', { class: 'row field' }, rf, h('label', { for: 'd-rf', style: 'margin:0;font-weight:500', text: 'Students post their own view before seeing others' })),
          h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: function (ev) {
            ev.target.disabled = true; st.dataset.state = 'saving'; st.textContent = 'Posting…';
            call('createDiscussion', { course_id: dc.value, title: dt.value, prompt: dp.value, media_type: mtype.value || null, media_url: mtype.value ? murl.value : null, caption: mcap.value,
              mode: mode.value, positions: mode.value === 'debate' ? pos.value.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : [], respond_first: rf.checked })
              .then(function (d) { announce('Discussion posted.'); location.hash = '#/discussion/' + encodeURIComponent(d.id); }, function (e) { ev.target.disabled = false; st.dataset.state = 'error'; st.textContent = 'Not posted: ' + errMsg(e); });
          } }, 'Post to class'), st)]);
      }
      setMain(h('h1', { text: 'Discussions' }),
        h('p', { class: 'lede', text: teacher ? 'Post an article, image or question. Students respond, give evidence and reply to each other.' : 'Read, think, take a position and back it up. Then see what your classmates said.' }),
        tabs, teacher ? h('div', { class: 'grid two' }, h('div', null, items), h('div', null, form)) : items);
    });
  }
  function renderDiscussion(r) {
    var teacher = S.me.kind === 'teacher';
    return call('getDiscussion', { discussion_id: r.id }).then(function (d) {
      var mine = d.comments.filter(function (c) { return c.mine && !c.parent_id; })[0];
      var tops = d.comments.filter(function (c) { return !c.parent_id; });
      function commentEl(c) {
        var box = h('article', { class: 'd-comment' + (c.author_role === 'teacher' ? ' by-teacher' : '') + (c.hidden ? ' hidden-post' : '') + (c.mine ? ' mine' : '') },
          h('div', { class: 'who' }, h('b', { text: c.mine ? 'You' : c.author }), c.position ? chip(c.position, 'pos') : null, h('span', { text: fmt(c.created_at) }), c.version > 1 ? chip('Edited') : null,
            c.hidden ? chip(teacher ? 'Hidden from students' : 'Hidden by your teacher', 'warn') : null),
          h('div', { class: 'text', text: c.body }),
          c.evidence_url ? h('p', { class: 'small' }, 'Evidence: ', safeLink(c.evidence_url, c.evidence_url.replace(/^https:\/\//, '').slice(0, 60))) : null);
        var actions = h('div', { class: 'actions' });
        if (c.mine) append(actions, h('button', { type: 'button', class: 'link', onclick: function () {
          var ta = h('textarea', { id: 'edit-' + c.id, 'aria-label': 'Edit your comment' }); ta.value = c.body;
          fill(box, ta, h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: function (ev) {
            ev.target.disabled = true;
            call('editDiscussionComment', { comment_id: c.id, base_version: c.version, body: ta.value }).then(function () { announce('Saved.'); route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
          } }, 'Save'), h('button', { type: 'button', onclick: route }, 'Cancel')));
          ta.focus();
        } }, 'Edit'));
        if (teacher) append(actions, h('button', { type: 'button', class: 'link', onclick: function (ev) {
          ev.target.disabled = true; call('hideDiscussionComment', { comment_id: c.id, hidden: !c.hidden }).then(function () { route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
        } }, c.hidden ? 'Show to students' : 'Hide from students'));
        if (!c.parent_id && d.open && !d.locked && !c.hidden) {
          var rid = 'r-' + c.id;
          var rta = h('textarea', { id: rid, class: 'reply-box', placeholder: 'Build on it, question it, or add evidence' });
          var rst = h('span', { class: 'save-state', role: 'status' });
          var replyBox = h('div', { class: 'd-reply', hidden: true }, h('label', { for: rid, text: 'Reply to ' + (c.mine ? 'yourself' : c.author) }), rta,
            h('div', { class: 'actions' }, h('button', { type: 'button', onclick: function (ev) {
              if (!rta.value.trim()) { rta.focus(); return; }
              ev.target.disabled = true; rst.dataset.state = 'saving'; rst.textContent = 'Posting…';
              call('postDiscussionComment', { discussion_id: d.id, parent_id: c.id, body: rta.value, client_request_id: uuid() }).then(function () { announce('Reply posted.'); route(); },
                function (e) { ev.target.disabled = false; rst.dataset.state = 'error'; rst.textContent = 'Not posted: ' + errMsg(e); });
            } }, 'Post reply'), rst));
          append(actions, h('button', { type: 'button', class: 'link', 'aria-expanded': 'false', onclick: function (ev) { replyBox.hidden = !replyBox.hidden; ev.target.setAttribute('aria-expanded', String(!replyBox.hidden)); if (!replyBox.hidden) rta.focus(); } }, 'Reply'));
          append(box, [actions, replyBox]);
        } else append(box, actions);
        var replies = d.comments.filter(function (x) { return x.parent_id === c.id; });
        if (replies.length) append(box, h('div', { class: 'd-replies' }, replies.map(commentEl)));
        return box;
      }
      var respond = null;
      if (!teacher && !mine && d.open) {
        var pos = d.mode === 'debate' ? h('fieldset', { class: 'conf' }, h('legend', { text: 'Your position' }), d.positions.map(function (p, i) {
          return h('label', { class: 'conf-opt' }, h('input', { type: 'radio', name: 'd-pos', value: p, id: 'pos-' + i }), h('span', { text: p }));
        })) : null;
        var body = h('textarea', { id: 'd-body', maxlength: 3000, placeholder: d.mode === 'debate' ? 'Why? Give a reason and one piece of evidence.' : 'What do you think? Give a reason or example.' });
        var ev = h('input', { type: 'url', id: 'd-ev', placeholder: 'https://… (optional)' });
        var st = h('span', { class: 'save-state', role: 'status' });
        var reqId = uuid();
        respond = h('section', { class: 'panel respond', 'aria-label': 'Your response' }, h('h2', { text: 'Your response' }), pos,
          h('div', { class: 'field' }, h('label', { for: 'd-body', text: d.mode === 'debate' ? 'Your argument' : 'Your thoughts' }), body),
          h('div', { class: 'field' }, h('label', { for: 'd-ev', text: 'Evidence link (optional)' }), ev),
          h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: function (e2) {
            var picked = respond.querySelector('input[name=d-pos]:checked');
            e2.target.disabled = true; st.dataset.state = 'saving'; st.textContent = 'Posting…';
            call('postDiscussionComment', { discussion_id: d.id, body: body.value, position: picked ? picked.value : undefined, evidence_url: ev.value || undefined, client_request_id: reqId })
              .then(function () { announce('Response posted. You can now see your classmates’ responses.'); route(); },
                function (err) { e2.target.disabled = false; st.dataset.state = 'error'; st.textContent = 'Not posted: ' + errMsg(err); });
          } }, 'Post my response'), st),
          d.respond_first ? h('p', { class: 'small muted', text: 'You’ll see your classmates’ responses after you post yours.' }) : null);
      }
      var board;
      if (d.locked) board = h('div', { class: 'empty' }, h('strong', { text: d.hidden_count + ' classmate' + (d.hidden_count === 1 ? ' has' : 's have') + ' responded' }), h('span', { text: 'Post your response to see theirs.' }));
      else if (!tops.length) board = h('p', { class: 'muted small', text: 'No responses yet.' });
      else if (d.mode === 'debate') {
        var cols = d.positions.map(function (p) {
          var cs = tops.filter(function (c) { return c.position === p; });
          return h('section', { class: 'd-side', 'aria-label': p }, h('h3', null, h('span', { text: p }), h('span', { class: 'count', text: String(cs.length) })), cs.length ? cs.map(commentEl) : h('p', { class: 'small muted', text: 'No one yet.' }));
        });
        var others = tops.filter(function (c) { return !c.position; });
        board = [h('div', { class: 'd-sides' }, cols), others.length ? h('section', null, h('h3', { text: 'From your teacher' }), others.map(commentEl)) : null];
      } else board = h('div', null, tops.map(commentEl));
      var teacherPanel = teacher ? panel('Participation', [
        h('ul', { class: 'list' }, d.participation.map(function (p) { return h('li', { class: 'spread' }, h('span', { text: p.learner_label }), p.responses ? h('span', { class: 'small', text: p.responses + ' response · ' + p.replies + ' repl' + (p.replies === 1 ? 'y' : 'ies') }) : chip('Not yet', 'warn')); })),
        h('div', { class: 'actions' }, h('button', { type: 'button', onclick: function (ev) {
          ev.target.disabled = true; call('setDiscussionStatus', { discussion_id: d.id, status: d.status === 'open' ? 'closed' : 'open' }).then(function () { route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
        } }, d.status === 'open' ? 'Close discussion' : 'Reopen discussion')),
        (function () {
          var ta = h('textarea', { id: 't-comment', placeholder: 'Add a teacher comment or nudge' }), st2 = h('span', { class: 'save-state', role: 'status' });
          return h('div', { class: 'field', style: 'margin-top:12px' }, h('label', { for: 't-comment', text: 'Teacher comment (visible to the class)' }), ta,
            h('div', { class: 'actions' }, h('button', { type: 'button', onclick: function (ev) {
              if (!ta.value.trim()) { ta.focus(); return; }
              ev.target.disabled = true; call('postDiscussionComment', { discussion_id: d.id, body: ta.value, client_request_id: uuid() }).then(function () { route(); }, function (e) { ev.target.disabled = false; st2.textContent = errMsg(e); });
            } }, 'Post comment'), st2));
        })()]) : null;
      setMain(h('p', { class: 'eyebrow' }, h('a', { href: '#/discussions' }, '← Discussions')),
        h('div', { class: 'row' }, courseChip(d.course_id), chip(d.mode === 'debate' ? 'Debate' : 'Discussion'), d.open ? null : chip('Closed')),
        h('h1', { text: d.title }),
        h('div', { class: teacher ? 'grid two' : '' },
          h('div', null, h('section', { class: 'panel d-prompt' }, mediaBlock(d.media), h('p', { class: 'd-q', text: d.prompt }), h('p', { class: 'small muted', text: 'Posted by ' + d.created_by })),
            respond, h('section', { class: 'd-board', 'aria-label': 'Responses' }, h('h2', { text: 'Responses' }), board)),
          teacherPanel ? h('div', null, teacherPanel) : null));
    });
  }

  /* ------------------------------------------------------------ teacher result release desk */
  function renderTeacherResults(r) {
    var course = r.params.course || 'IBDS', learner = r.params.learner || '';
    var input = h('input', { id: 'release-learner', value: learner, autocomplete: 'off', placeholder: 'Existing learner ID' });
    var picker = h('select', { id: 'release-course' }, S.me.courses.map(function (c) {
      return h('option', { value: c.course_id }, c.course_id);
    }));
    picker.value = course;
    var list = h('div', { role: 'status' });
    function load() {
      course = picker.value; learner = input.value.trim();
      if (!learner) { fill(list, h('p', { class: 'muted', text: 'Choose a student in Studio Control or enter their existing learner ID.' })); return; }
      fill(list, h('p', { text: 'Loading reviewed rows…' }));
      call('teacherResultCandidates', { course_id: course, learner_id: learner }).then(function (items) {
        fill(list, items.length ? items.map(function (item) {
          var status = h('span', { class: 'small', text: item.released ? 'Released' : 'Held' });
          var button = h('button', { type: 'button', class: item.released ? 'secondary' : 'primary',
            onclick: function () {
              var next = !item.released;
              if (next && !confirm('Release this reviewed result to this student?')) return;
              button.disabled = true;
              call('setResultRelease', { course_id: course, learner_id: learner, key: item.key, released: next }).then(function () {
                announce(next ? 'Result released to student.' : 'Result withdrawn from student view.'); load();
              }, function (e) { button.disabled = false; toast(errMsg(e)); });
            } }, item.released ? 'Un-release' : 'Release to student');
          if (!item.verified) button.disabled = true;
          return h('article', { class: 'panel' }, h('h3', { text: item.task_id }),
            h('p', { class: 'small mono', text: item.key }), status,
            item.verified ? button : h('p', { class: 'small muted', text: 'Teacher verification required before release.' }));
        }) : h('p', { class: 'muted', text: 'No result rows for this learner and course.' }));
      }, function (e) { fill(list, h('div', { class: 'banner error', text: errMsg(e) })); });
    }
    setMain(h('h1', { text: 'Release results' }), h('p', { class: 'lede', text: 'Only teacher-verified rows can be released. The Sheet checkbox and this control use the same release field.' }),
      h('div', { class: 'filters' }, h('label', null, 'Course ', picker), h('label', null, 'Learner ID ', input),
        h('button', { type: 'button', onclick: load }, 'Show reviewed rows')), list);
    load();
  }

  /* ------------------------------------------------------------ review list (things I got wrong) */
  function renderReviewList() {
    return Promise.all([call('listReview'), call('quizFeedback')]).then(function (res) {
      var items = res[0], misses = res[1];
      var due = items.filter(function (x) { return x.due; });
      var practice = null;
      if (due.length) {
        var i = 0, reveal;
        var card = h('div', { class: 'flash', 'aria-live': 'polite' });
        function show() {
          var it = due[i];
          reveal = h('div', { class: 'flash-back', hidden: true },
            it.my_mistake ? h('p', null, h('b', { text: 'What I got wrong: ' }), it.my_mistake) : null,
            it.correct_idea ? h('p', null, h('b', { text: 'The right idea: ' }), it.correct_idea) : null,
            h('div', { class: 'actions' },
              h('button', { type: 'button', class: 'primary', onclick: function () { answer('got_it'); } }, 'Got it'),
              h('button', { type: 'button', onclick: function () { answer('not_yet'); } }, 'Not yet')));
          fill(card, h('p', { class: 'eyebrow', text: (i + 1) + ' of ' + due.length + ' · ' + it.course_id + (it.source_label ? ' · ' + it.source_label : '') }),
            h('p', { class: 'flash-q', text: it.question }),
            h('p', { class: 'small muted', text: 'Say or write the answer in your head first.' }),
            h('button', { type: 'button', class: 'reveal', onclick: function (ev) { reveal.hidden = false; ev.target.hidden = true; reveal.querySelector('button').focus(); } }, 'Show the answer'), reveal);
        }
        function answer(result) {
          var it = due[i];
          call('reviewResult', { item_id: it.id, base_version: it.version, result: result }).then(function (u) {
            announce(result === 'got_it' ? 'Nice. Next review ' + when(u.due_on) + '.' : 'Okay — it will come back tomorrow.');
            i++; if (i < due.length) show(); else fill(card, h('p', { class: 'flash-q', text: 'All done for today.' }), h('button', { type: 'button', onclick: route }, 'Back to my list'));
          }, function (e) { toast(errMsg(e)); });
        }
        show();
        practice = panel('Review now', card);
      }
      var fromQuiz = misses.length ? h('ul', { class: 'list' }, misses.map(function (m) {
        return h('li', null, h('div', { class: 'row' }, courseChip(m.course_id), chip(m.quiz_title, m.demo ? 'demo' : '')),
          h('p', { class: 'q-miss', text: m.question }),
          h('p', { class: 'small' }, h('b', { text: 'You answered: ' }), m.your_answer, ' · ', h('b', { text: 'Answer: ' }), m.correct_answer),
          m.review_item_id ? chip('On your review list', 'ok') : h('button', { type: 'button', onclick: function (ev) {
            ev.target.disabled = true; call('addReviewItem', { source_id: m.source_id }).then(function () { announce('Added to your review list.'); route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
          } }, '+ Add to my review list'));
      })) : h('p', { class: 'muted small', text: 'When your teacher releases quiz feedback, questions you missed show up here.' });
      var qc = h('select', { id: 'rv-course' }, S.me.courses.map(function (c) { return h('option', { value: c.course_id }, c.title); }));
      var qq = h('input', { type: 'text', id: 'rv-q', maxlength: 1000, placeholder: 'The question or idea' });
      var qm = h('input', { type: 'text', id: 'rv-m', maxlength: 1000, placeholder: 'What I got wrong or mixed up' });
      var qr = h('textarea', { id: 'rv-r', maxlength: 2000, style: 'min-height:80px', placeholder: 'The right idea, in my own words' });
      var add = panel('Add something I keep getting wrong', [
        h('div', { class: 'field' }, h('label', { for: 'rv-course', text: 'Course' }), qc),
        h('div', { class: 'field' }, h('label', { for: 'rv-q', text: 'Question or idea' }), qq),
        h('div', { class: 'field' }, h('label', { for: 'rv-m', text: 'What I got wrong' }), qm),
        h('div', { class: 'field' }, h('label', { for: 'rv-r', text: 'The right idea' }), qr),
        h('button', { type: 'button', onclick: function (ev) {
          if (!qq.value.trim()) { qq.focus(); return; }
          ev.target.disabled = true; call('addReviewItem', { course_id: qc.value, question: qq.value, my_mistake: qm.value, correct_idea: qr.value }).then(function () { announce('Added.'); route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
        } }, 'Add to my list')]);
      var all = items.length ? h('ul', { class: 'list' }, items.map(function (it) {
        return h('li', { class: 'spread' }, h('div', null, h('b', { text: it.question }), h('div', { class: 'small muted', text: it.course_id + ' · ' + (it.due ? 'due today' : 'next review ' + when(it.due_on)) + ' · streak ' + it.stage })),
          h('button', { type: 'button', class: 'link', onclick: function (ev) {
            ev.target.disabled = true; call('updateReviewItem', { item_id: it.id, base_version: it.version, archived: true }).then(function () { route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
          } }, 'I’ve mastered this'));
      })) : null;
      setMain(h('h1', { text: 'Review list' }), h('p', { class: 'lede', text: 'The things you got wrong, coming back until they stick. Just for you — not a mark.' }),
        h('div', { class: 'grid two' }, h('div', null, practice || empty('Nothing to review today', items.length ? 'Your next review is ' + when(items[0].due_on) + '.' : 'Add questions from quiz feedback or your own notes.'),
          all ? panel('Everything on my list', all) : null), h('div', null, panel('From quiz feedback', fromQuiz), add)));
    });
  }

  /* ------------------------------------------------------------ teacher: exit notes */
  function renderExitNotes(r) {
    var course = r.params.course || S.me.courses[0].course_id;
    return call('teacherExitNotes', { course_id: course, date: r.params.date || undefined }).then(function (d) {
      var tabs = h('div', { class: 'filters', role: 'group', 'aria-label': 'Course' }, S.me.courses.map(function (c) {
        return h('a', { href: '#/exitnotes?course=' + c.course_id, class: 'filter' + (course === c.course_id ? ' on' : ''), 'aria-current': course === c.course_id ? 'true' : null }, c.title);
      }));
      var dsel = h('select', { id: 'x-date', onchange: function (e) { location.hash = '#/exitnotes?course=' + course + '&date=' + e.target.value; } },
        (d.dates.indexOf(d.date) < 0 ? [d.date].concat(d.dates) : d.dates).map(function (x) { return h('option', { value: x, selected: x === d.date }, fmtDate(x)); }));
      var max = Math.max(1, Math.max.apply(null, d.confidence.map(function (c) { return c.count; })));
      var bars = h('div', { class: 'bars' }, d.confidence.map(function (c) {
        return h('div', { class: 'bar-row' }, h('span', { text: c.label }), h('div', { class: 'bar' }, h('span', { style: 'width:' + Math.round(100 * c.count / max) + '%' })), h('b', { text: String(c.count) }));
      }));
      var notes = d.notes.length ? h('ul', { class: 'queue' }, d.notes.map(function (n) {
        return h('li', null, h('div', { class: 'row' }, h('b', { text: n.learner_label }), n.confidence ? chip(CONF[n.confidence - 1], n.confidence <= 1 ? 'warn' : '') : null),
          n.clicked ? h('p', { class: 'small' }, h('b', { text: 'Clicked: ' }), n.clicked) : null, n.fuzzy ? h('p', { class: 'small' }, h('b', { text: 'Fuzzy: ' }), n.fuzzy) : null);
      })) : empty('No exit notes for this day', 'Students send these from their home page at the end of class.');
      setMain(h('h1', { text: 'Exit notes' }), h('p', { class: 'lede', text: 'What clicked and what’s still fuzzy, straight from the end of class. Sorted with the least confident first.' }), tabs,
        h('div', { class: 'field', style: 'max-width:280px' }, h('label', { for: 'x-date', text: 'Day' }), dsel),
        h('div', { class: 'grid two' }, h('div', null, panel(d.notes.length + ' of ' + d.learners + ' students checked out', notes)), h('div', null, panel('Confidence', bars))));
    });
  }

  /* ------------------------------------------------------------ dialogs */
  function openDialog(titleText, kids, onClose) {
    var d = document.getElementById('dialog');
    fill(d, h('div', { class: 'dialog-body' },
      h('div', { class: 'dialog-head' }, h('h2', { id: 'dialog-title', text: titleText }), h('button', { type: 'button', class: 'icon', 'aria-label': 'Close', onclick: function () { d.close(); } }, '✕')), kids));
    d.onclose = function () { if (onClose) onClose(); };
    if (!d.open) d.showModal();
    return d;
  }
  function confirmDialog(titleText, kids, okLabel, onOk) {
    var d = openDialog(titleText, [kids, h('div', { class: 'actions' },
      h('button', { type: 'button', class: 'warm', onclick: function () { d.close(); onOk(); } }, okLabel),
      h('button', { type: 'button', onclick: function () { d.close(); } }, 'Cancel'))]);
    d.querySelector('button.warm').focus();
  }

  /* ------------------------------------------------------------ student: board */
  function renderBoard(r) {
    return Promise.all([call('listCards'), call('listAssignments'), call('listEntries', {})]).then(function (res) {
      var cards = res[0], pausedCards=cards.filter(function(c){return c.module_paused;}), assignments = res[1], entries = res[2];
      var thisWeek = mondayOf(S.me.today || new Date().toISOString().slice(0, 10));
      var boardEl = h('div', { class: 'board', role: 'list', 'aria-label': 'Project board columns' });
      var wip = h('p', { class: 'small wip', role: 'status' });
      var asgByKey = {}; assignments.forEach(function (a) { asgByKey[a.assignment_key] = a; });
      function byId(id) { return cards.filter(function (c) { return c.id === id; })[0]; }
      function draw(focusId) {
        boardEl.replaceChildren();
        var working = cards.filter(function (c) { return !c.module_paused&&c.column === 'working'; }).length;
        wip.textContent = working > 3 ? 'You have ' + working + ' cards in Working. Finishing one before starting another usually helps.' : '';
        COLUMNS.forEach(function (col, ci) {
          var inCol = cards.filter(function (c) { return !c.module_paused&&c.column === col; });
          var colEl = h('section', { class: 'column', role: 'listitem', 'aria-label': COLUMN_LABELS[col] + ' column, ' + inCol.length + ' cards', 'data-column': col,
            ondragover: function (ev) { ev.preventDefault(); colEl.classList.add('drop'); }, ondragleave: function () { colEl.classList.remove('drop'); },
            ondrop: function (ev) { ev.preventDefault(); colEl.classList.remove('drop'); var id = ev.dataTransfer.getData('text/plain'); var c = byId(id); if (c) move(c, col); } },
            h('h2', null, h('span', { text: COLUMN_LABELS[col] }), h('span', { class: 'count', text: String(inCol.length) })),
            inCol.length ? inCol.map(function (c) { return cardEl(c, ci); }) : h('p', { class: 'small muted', text: col === 'complete' ? 'Complete means you finished your workflow — not teacher approval.' : 'No cards.' }));
          boardEl.appendChild(colEl);
        });
        if (focusId) { var f = document.querySelector('#card-' + CSS.escape(focusId) + ' select'); if (f) f.focus(); }
      }
      function cardEl(c, ci) {
        var parent = c.parent_id ? byId(c.parent_id) : null;
        var asg = asgByKey[c.assignment_key];
        var done = c.checklist.filter(function (i) { return i.done; }).length;
        var stateEl = h('div', { class: 'card-state', role: 'status' });
        var sel = h('select', { 'aria-label': 'Move “' + c.title + '” to column', onchange: function (ev) { move(c, ev.target.value); } },
          COLUMNS.map(function (k) { return h('option', { value: k, selected: k === c.column }, COLUMN_LABELS[k]); }));
        var el = h('article', { class: 'card ' + c.type, id: 'card-' + c.id, draggable: 'true', 'data-id': c.id,
          ondragstart: function (ev) { ev.dataTransfer.setData('text/plain', c.id); ev.dataTransfer.effectAllowed = 'move'; el.classList.add('dragging'); },
          ondragend: function () { el.classList.remove('dragging'); } },
          h('div', { class: 'card-top' }, h('span', { class: 'kind', text: c.type === 'assignment' ? 'From your teacher' : 'My task' }),
            h('button', { type: 'button', class: 'pin' + (c.focus_week === thisWeek ? ' on' : ''), 'aria-pressed': c.focus_week === thisWeek ? 'true' : 'false',
              'aria-label': (c.focus_week === thisWeek ? 'Unpin “' : 'Pin “') + c.title + '” as this week’s focus', onclick: function () { pin(c); } }, c.focus_week === thisWeek ? '★ Focus' : '☆ Focus')),
          h('h3', null, h('button', { type: 'button', onclick: function () { openCard(c); } }, c.title)),
          h('div', { class: 'meta' }, h('span', null, courseChip(c.course_id)),
            parent ? h('span', { text: '↳ part of ' + parent.title }) : null,
            c.type === 'assignment' ? h('span', { text: asg && asg.deadline ? 'Teacher deadline: ' + fmtDate(asg.deadline.date) : 'No teacher deadline published' }) : null,
            c.target_date ? h('span', { text: 'My target: ' + fmtDate(c.target_date) }) : null,
            c.checklist.length ? h('span', { text: 'Checklist ' + done + '/' + c.checklist.length }) : null,
            c.links.length ? h('span', { text: c.links.length + ' linked item' + (c.links.length > 1 ? 's' : '') }) : null),
          c.checklist.length ? h('div', { class: 'progress', 'aria-hidden': 'true' }, h('span', { style: 'width:' + Math.round(100 * done / c.checklist.length) + '%' })) : null,
          h('div', { class: 'moves' },
            h('button', { type: 'button', class: 'icon', disabled: ci === 0 || null, 'aria-label': ci > 0 ? 'Back: move “' + c.title + '” to ' + COLUMN_LABELS[COLUMNS[ci - 1]] : 'Already in the first column', onclick: function () { move(c, COLUMNS[ci - 1]); } }, '◀'),
            sel,
            h('button', { type: 'button', class: 'icon', disabled: ci === COLUMNS.length - 1 || null, 'aria-label': ci < COLUMNS.length - 1 ? 'Next: move “' + c.title + '” to ' + COLUMN_LABELS[COLUMNS[ci + 1]] : 'Next: already in the last column', onclick: function () { move(c, COLUMNS[ci + 1]); } }, '▶')),
          stateEl);
        return el;
      }
      function pin(c) {
        var on = c.focus_week !== thisWeek;
        call('updateCard', { card_id: c.id, base_version: c.version, focus: on }).then(function (u) {
          cards = cards.map(function (x) { return x.id === u.id ? u : x; }); draw();
          var b = document.querySelector('#card-' + CSS.escape(u.id) + ' .pin'); if (b) b.focus();
          announce(on ? '“' + u.title + '” pinned as a focus for this week.' : 'Unpinned.');
        }, function (e) { toast(errMsg(e)); });
      }
      function move(c, to) {
        if (!to || to === c.column) return;
        var el = document.getElementById('card-' + c.id);
        if (el) { el.classList.add('busy'); el.querySelector('.card-state').textContent = 'Moving…'; el.querySelectorAll('button,select').forEach(function (b) { b.disabled = true; }); }
        call('moveCard', { card_id: c.id, base_version: c.version, to: to }).then(function (updated) {
          cards = cards.map(function (x) { return x.id === updated.id ? updated : x; });
          draw(updated.id);
          var cs = document.querySelector('#card-' + CSS.escape(updated.id) + ' .card-state'); if (cs) cs.textContent = 'Saved in ' + COLUMN_LABELS[to];
          announce('Moved “' + updated.title + '” to ' + COLUMN_LABELS[to] + '. Saved.');
        }, function (e) {
          if (e && e.code === 'CONFLICT') { toast('This card changed somewhere else. The board has been reloaded; nothing was overwritten.'); route(); return; }
          draw(c.id);
          var cs = document.querySelector('#card-' + CSS.escape(c.id) + ' .card-state'); if (cs) { cs.textContent = 'Not moved: ' + errMsg(e); }
          toast('Not moved. ' + errMsg(e)); announce('Not moved. ' + errMsg(e));
        });
      }
      function openCard(c) {
        var isAsg = c.type === 'assignment';
        var asg = asgByKey[c.assignment_key];
        var t = h('input', { type: 'text', id: 'c-title', value: c.title, maxlength: 200 });
        var desc = h('textarea', { id: 'c-desc', maxlength: 4000 }); desc.value = c.description;
        var date = h('input', { type: 'date', id: 'c-date', value: c.target_date || '' });
        var items = c.checklist.map(function (i) { return { id: i.id, text: i.text, done: i.done }; });
        var links = c.links.slice();
        var listEl = h('ul', { class: 'checklist' }), linksEl = h('ul', { class: 'list' });
        var state = h('span', { class: 'save-state', role: 'status', 'data-state': 'saved', text: 'Saved · version ' + c.version });
        function dirty() { state.dataset.state = 'dirty'; state.textContent = 'Unsaved changes'; }
        function drawItems() {
          fill(listEl, items.map(function (i, n) {
            var cb = h('input', { type: 'checkbox', id: 'ck-' + n, checked: i.done, onchange: function () { i.done = cb.checked; dirty(); } });
            return h('li', null, cb, h('label', { for: 'ck-' + n, style: 'margin:0;font-weight:400;flex:1', text: i.text }),
              h('button', { type: 'button', class: 'icon', 'aria-label': 'Remove checklist item ' + i.text, onclick: function () { items.splice(n, 1); drawItems(); dirty(); } }, '✕'));
          }));
        }
        function drawLinks() {
          fill(linksEl, links.length ? links.map(function (l, n) {
            return h('li', { class: 'spread' }, l.kind === 'entry' ? h('a', { href: '#/entry/' + encodeURIComponent(l.entry_id), onclick: function () { document.getElementById('dialog').close(); } }, 'Journal: ' + l.title) : safeLink(l.url, l.label),
              h('button', { type: 'button', class: 'link', onclick: function () { links.splice(n, 1); drawLinks(); dirty(); } }, 'Remove'));
          }) : h('li', { class: 'small muted', text: 'No journal entries or evidence linked yet.' }));
        }
        drawItems(); drawLinks();
        var newItem = h('input', { type: 'text', id: 'c-newitem', placeholder: 'Add a checklist step', maxlength: 200 });
        var entrySel = h('select', { id: 'c-entry' }, h('option', { value: '' }, 'Choose a journal entry…'),
          entries.filter(function (e) { return e.course_id === c.course_id; }).map(function (e) { return h('option', { value: e.id }, e.title); }));
        var subTitle = h('input', { type: 'text', id: 'c-subtitle', maxlength: 200 });
        var subDate = h('input', { type: 'date', id: 'c-subdate' });
        var d = openDialog(c.title, [
          h('p', { class: 'eyebrow', text: isAsg ? 'Assignment card · from your teacher' : 'Subtask' + (c.parent_id && byId(c.parent_id) ? ' of ' + byId(c.parent_id).title : '') }),
          isAsg ? h('div', { class: 'canonical' }, h('b', { text: 'Canonical assignment (read-only)' }),
            h('p', { class: 'small', style: 'margin:4px 0 0', text: 'Title, deadline, criteria and marks come from your teacher. Your notes, checklist and personal target below are yours.' }),
            h('dl', null, h('dt', { text: 'Course' }), h('dd', { text: c.ref.course_id }), h('dt', { text: 'Project' }), h('dd', { text: c.ref.project_id }),
              h('dt', { text: 'Task ID' }), h('dd', { text: c.ref.task_id || '— (project-level assignment)' }), h('dt', { text: 'Teacher deadline' }), h('dd', { text: asg && asg.deadline ? fmtDate(asg.deadline.date) : 'Not published' })),
            h('p', { style: 'margin:8px 0 0' }, h('a', { href: '#/assignment/' + encodeURIComponent(c.assignment_key), onclick: function () { d.close(); } }, 'Open the assignment'))) : null,
          !isAsg ? h('div', { class: 'field', style: 'margin-top:14px' }, h('label', { for: 'c-title', text: 'Title' }), t) : null,
          h('div', { class: 'field', style: 'margin-top:14px' }, h('label', { for: 'c-desc', text: isAsg ? 'My notes' : 'Description' }), desc),
          h('div', { class: 'field' }, h('label', { for: 'c-date' }, 'My personal target date ', h('span', { class: 'hint', text: '(not the teacher’s deadline)' })), date),
          h('fieldset', null, h('legend', { text: 'Checklist' }), listEl, h('div', { class: 'row' }, h('label', { for: 'c-newitem', class: 'visually-hidden', text: 'New checklist item' }), newItem,
            h('button', { type: 'button', onclick: function () { if (newItem.value.trim()) { items.push({ text: newItem.value.trim(), done: false }); newItem.value = ''; drawItems(); dirty(); newItem.focus(); } } }, 'Add'))),
          h('fieldset', null, h('legend', { text: 'Evidence and journal links' }), linksEl, h('div', { class: 'row' }, h('label', { for: 'c-entry', class: 'visually-hidden', text: 'Link a journal entry' }), entrySel,
            h('button', { type: 'button', onclick: function () { var e = entries.filter(function (x) { return x.id === entrySel.value; })[0]; if (e && !links.some(function (l) { return l.entry_id === e.id; })) { links.push({ kind: 'entry', entry_id: e.id, title: e.title }); drawLinks(); dirty(); } } }, 'Link'))),
          h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: function (ev) {
            var args = { card_id: c.id, base_version: c.version, description: desc.value, target_date: date.value || null, checklist: items, links: links };
            if (!isAsg) args.title = t.value;
            ev.target.disabled = true; state.dataset.state = 'saving'; state.textContent = 'Saving…';
            call('updateCard', args).then(function (u) {
              cards = cards.map(function (x) { return x.id === u.id ? u : x; }); c = u;
              state.dataset.state = 'saved'; state.textContent = 'Saved · version ' + u.version; ev.target.disabled = false; announce('Card saved.'); draw();
            }, function (e) {
              ev.target.disabled = false; state.dataset.state = e.code === 'CONFLICT' ? 'conflict' : 'error';
              state.textContent = e.code === 'CONFLICT' ? 'Not saved — this card changed elsewhere. Close and reopen the board.' : 'Not saved: ' + errMsg(e);
            });
          } }, 'Save card'), state),
          isAsg ? h('fieldset', { style: 'margin-top:18px' }, h('legend', { text: 'Add a subtask under this assignment' }),
            h('div', { class: 'fields' }, h('div', { class: 'field' }, h('label', { for: 'c-subtitle', text: 'Subtask title' }), subTitle), h('div', { class: 'field' }, h('label', { for: 'c-subdate', text: 'My target date (optional)' }), subDate)),
            h('button', { type: 'button', onclick: function (ev) {
              if (!subTitle.value.trim()) { subTitle.focus(); return; }
              ev.target.disabled = true;
              call('createCard', { parent_id: c.id, title: subTitle.value, target_date: subDate.value || null, client_request_id: uuid() }).then(function (n) {
                cards.push(n); subTitle.value = ''; subDate.value = ''; ev.target.disabled = false; draw(); announce('Subtask “' + n.title + '” added to To do. Saved.');
              }, function (e) { ev.target.disabled = false; toast('Not added. ' + errMsg(e)); });
            } }, 'Add subtask')) : null,
          h('h3', { style: 'margin-top:18px', text: 'Activity' }),
          h('ul', { class: 'activity' }, c.activity.slice().reverse().map(function (a) { return h('li', null, h('span', { class: 'muted', text: fmt(a.at) + ' · ' }), h('span', { text: a.action })); }))
        ], function () { var b = document.querySelector('#card-' + CSS.escape(c.id) + ' h3 button'); if (b) b.focus(); });
        return d;
      }

      var onBoard = {}; cards.forEach(function (c) { if (c.type === 'assignment') onBoard[c.assignment_key] = true; });
      var available = assignments.filter(function (a) { return !onBoard[a.assignment_key]; });
      var addSel = h('select', { id: 'add-asg' }, available.map(function (a) { return h('option', { value: a.assignment_key }, a.course_id + ' · ' + a.title); }));
      var toolbar = available.length ? h('div', { class: 'panel', style: 'margin-bottom:18px' }, h('div', { class: 'row', style: 'align-items:flex-end' },
        h('div', { style: 'flex:1;min-width:240px' }, h('label', { for: 'add-asg', text: 'Add an assignment to your board' }), addSel),
        h('button', { type: 'button', class: 'primary', onclick: function (ev) {
          ev.target.disabled = true;
          call('addAssignmentCard', { assignment_key: addSel.value }).then(function () { announce('Assignment added to To do.'); route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
        } }, 'Add to To do'))) : null;

      setMain(h('p', { class: 'eyebrow', text: 'Project board' }), h('h1', { text: 'My project board' }),
        h('p', { class: 'lede', text: 'Break your work into cards and move them along. Pin up to three as this week’s focus. “Complete” means you’re done with it — it isn’t a mark.' }),
        toolbar, wip,
        pausedCards.length?h('details',{class:'panel'},h('summary',{text:'Saved project history · '+pausedCards.length+' cards'}),h('p',{class:'small',text:'These modules are off or closed. Your notes, checklists and journal entries are preserved; they are not current requirements.'}),pausedCards.map(function(c){return h('p',null,h('button',{type:'button',onclick:function(){openCard(c);}},c.title));})):null,
        cards.length ? boardEl : empty('Your board is empty', 'Add an assignment above, then break it into subtasks with your own target dates.'),
        h('p', { class: 'small muted', style: 'margin-top:14px', text: 'Boards are individual in this pilot. Group boards are designed but not built (see the pilot documentation).' }));
      if (cards.length) draw();
      if (r.params.card) { var c = byId(r.params.card); if (c) openCard(c); }
    });
  }

  /* ------------------------------------------------------------ assignments */
  function renderAssignments() {
    return call('listAssignments').then(function (list) {
      var groups = S.me.courses.map(function (c) {
        var items = list.filter(function (a) { return a.course_id === c.course_id; });
        return panel(c.title, items.length ? h('ul', { class: 'list' }, items.map(function (a) {
          return h('li', { class: 'spread' }, h('div', null, h('h3', null, h('a', { href: '#/assignment/' + encodeURIComponent(a.assignment_key) }, a.title)),
            h('div', { class: 'small muted', text: a.deadline ? 'Teacher deadline: ' + fmtDate(a.deadline.date) + ' · ' + a.deadline.label : 'No deadline published in the assignment source' })),
            a.availability?chip(a.availability.state==='closed'?'Closed · history retained':a.availability.required===false?'Practice · optional':'Available'):null,
            a.release && a.release.state === 'demo_released' ? chip('Demo release', 'demo') : null);
        })) : empty('Nothing released', 'No assignment in this course has been released to you yet.'));
      });
      setMain(h('p', { class: 'eyebrow', text: 'Assignments' }), h('h1', { text: 'Assignments' }),
        h('p', { class: 'lede', text: 'Assignments come from your teacher’s existing course plan. Student OS shows them; it does not create or change them.' }), groups);
    });
  }
  function renderAssignment(r) {
    return call('getAssignment', { assignment_key: r.id }).then(function (a) {
      var ref = a.ref;
      var myEntries = a.my_entries.length ? h('ul', { class: 'list' }, a.my_entries.map(function (e) {
        var s = e.state;
        return h('li', null, h('a', { href: '#/entry/' + encodeURIComponent(e.id) }, e.title), ' ', stateChip(e.status),
          h('div', { class: 'small muted', text: [s.submitted ? 'Submitted (attempt ' + s.submitted.attempt + ')' : 'Not submitted', s.teacher_reviewed ? 'reviewed' : 'not reviewed', s.feedback_returned ? 'feedback returned' : 'no feedback yet'].join(' · ') }));
      })) : empty('No journal entries for this assignment', 'Start one to record your thinking and evidence.');
      var myCards = a.my_cards.length ? h('ul', { class: 'list' }, a.my_cards.map(function (c) {
        return h('li', null, h('a', { href: '#/board?card=' + encodeURIComponent(c.id) }, c.title), ' ', chip(COLUMN_LABELS[c.column]), c.type === 'subtask' ? chip('Subtask') : chip('Assignment card'));
      })) : empty('Not on your board yet', 'Add it to plan subtasks with your own target dates.');
      setMain(
        h('p', { class: 'eyebrow' }, COURSE_TITLES[a.course_id]),
        h('div', { class: 'spread' }, h('h1', { text: a.title }), h('div', { class: 'row' }, courseChip(a.course_id), a.release && a.release.state === 'demo_released' ? chip('Demo release', 'demo') : null)),
        a.release && a.release.state === 'demo_released' ? h('div', { class: 'banner demo', text: a.release.label }) : null,
        a.availability && a.availability.state === 'closed' ? h('p', {class:'banner',text:'This module is closed. Your saved work and results remain available; new submissions are paused.'}) : a.availability && a.availability.required === false ? h('p', {class:'banner',text:'This module is optional practice. It does not count as missing required work.'}) : null,
        h('div', { class: 'grid two' },
          h('div', null,
            panel('Purpose', [h('p', { class: 'prose', text: a.purpose }), h('p', { class: 'small muted', text: 'Source: ' + a.purpose_source })]),
            panel('Instructions', [h('ol', null, a.instructions.map(function (i) { return h('li', { text: i }); })),
              h('p', null, (function () { var link = safeLink(a.workbook_url, 'Open the workbook', 'btn primary');
                if (S.me.kind === 'student' && link && link.href && SUPPORT_SCHEDULE[a.course_id]) {
                  call('studentSupports', { course_id: a.course_id, sprint_id: ref.sprint_id }).then(function (v) { if (v.effective.length) { link.href = withSupports(link.href, v.effective); link.title = 'Opens with your supports: ' + v.effective.join(', '); } }, function () {});
                }
                return link; })()),
              h('ul', { class: 'list' }, a.resources.map(function (x) { return h('li', null, safeLink(x.url, x.label)); }))]),
            panel('Criteria', [h('p', null, h('b', { text: a.criteria.status })), a.criteria.summary ? h('p', { class: 'small', text: a.criteria.summary }) : null,
              a.criteria.items.length ? h('ul', null, a.criteria.items.map(function (c) { return h('li', null, h('code', { text: c.criterion_id }), ' · ', c.name); })) : null,
              h('p', { class: 'small muted', text: 'Criteria and marks are set by your teacher. Student OS cannot change them.' })]),
            panel('My journal entries', myEntries, h('a', { class: 'btn primary', href: '#/entry/new?assignment=' + encodeURIComponent(a.assignment_key) }, 'Start a journal entry')),
            panel('My project cards', myCards, a.my_cards.some(function (c) { return c.type === 'assignment'; }) ? null : h('button', { type: 'button', onclick: function (ev) {
              ev.target.disabled = true; call('addAssignmentCard', { assignment_key: a.assignment_key }).then(function () { announce('Added to your board.'); route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
            } }, 'Add to my board'))),
          h('div', null,
            panel('Deadline and submission', [
              h('p', null, h('b', { text: 'Teacher deadline: ' }), a.deadline ? fmtDate(a.deadline.date) : 'No deadline published in the assignment source.'),
              a.deadline ? h('p', { class: 'small muted', text: a.deadline.label }) : null,
              h('p', null, h('b', { text: 'Submission route: ' }), a.submission.method),
              a.submission.url ? h('p', null, safeLink(a.submission.url, a.submission.title || 'Open the submission form')) : null,
              a.submission.state ? h('p', { class: 'small muted', text: 'State: ' + a.submission.state }) : null,
              h('div', { class: 'banner info small', text: a.receipt_note })]),
            h('details', { class: 'panel canonical', 'aria-label': 'Canonical references' }, h('summary', { text: 'Details for your teacher' }),
              h('p', { class: 'small', text: ref.id_note }),
              h('dl', null, [['course_id', ref.course_id], ['project_id', ref.project_id], ['task_id', ref.task_id || '—'], ['sprint_id', ref.sprint_id], ['lesson_id', ref.lesson_id || '—'], ['planning_bundle_id', ref.planning_bundle_id || '—']]
                .map(function (p) { return [h('dt', { text: p[0] }), h('dd', { text: p[1] })]; })),
              h('details', { style: 'margin-top:10px' }, h('summary', { class: 'small', text: 'Source files and hashes' }),
                h('ul', { class: 'small' }, a.provenance.map(function (p) { return h('li', null, h('code', { text: p.path }), ' · sha256 ', h('code', { text: p.sha256.slice(0, 12) + '…' }), p.version ? ' · ' + p.version : ''); })))))));
    });
  }

  /* ------------------------------------------------------------ portfolio preview */
  function renderPortfolio() {
    return call('portfolioPreview').then(function (list) {
      setMain(h('p', { class: 'eyebrow', text: 'Portfolio preview' }), h('h1', { text: S.me.display_name }),
        h('div', { class: 'banner info', text: 'Preview only — nothing here is published. Your public portfolio lives in your own Google Site. Teacher feedback is never included.' }),
        list.length ? h('div', { class: 'feed' }, list.map(function (e) {
          return h('article', { class: 'post' }, h('div', { class: 'meta' }, courseChip(e.course_id), h('span', { text: fmt(e.updated_at) })), h('h2', { text: e.title }),
            h('div', { class: 'prose' }, paragraphs(e.body)),
            e.artifacts.length ? h('ul', { class: 'artifacts' }, e.artifacts.map(function (x) { return h('li', null, safeLink(x.url, x.type + ': ' + x.label)); })) : null);
        })) : empty('Nothing chosen for your portfolio', 'Tick “Include in my portfolio preview” on a journal entry you want to showcase.'));
    });
  }

  /* ------------------------------------------------------------ adaptive supports */
  /* Current workbook per course, by date (collaboration/pacing/plan_changes_2026-09-30.json). Supports are stored per sprint. */
  var MM = 'https://ctwadden.github.io/multimedia-12/', CT = 'https://ctwadden.github.io/communication-technology-11/';
  var SUPPORT_SCHEDULE = {
    IBDS: [{ from: '2026-09-03', sprint_id: 'ibds-26-s04', title: 'When the service goes offline', url: 'https://ctwadden.github.io/digital-society-sl/sprints/service-offline/#d01' }],
    MM12: [{ from: '2026-09-03', sprint_id: 'mm12-26-s01', title: 'Drop Day', url: MM + 'photoshop/studio/drop-day/?course=MM12#step-1' },
      { from: '2026-09-18', sprint_id: 'mm12-26-s02', title: 'The Brief Has Changed', url: MM + 'sprints/brief-has-changed/guide.html' },
      { from: '2026-10-05', sprint_id: 'mm12-26-s03', title: 'Shot on Purpose', url: MM + 'sprints/shot-on-purpose/guide.html' },
      { from: '2026-10-19', sprint_id: 'mm12-26-s04', title: 'Last Light', url: MM + 'sprints/last-light/guide.html' },
      { from: '2026-10-26', sprint_id: 'mm12-26-s04', title: 'Make It Matter', url: MM + 'sprints/make-it-matter/guide.html' }],
    COM11: [{ from: '2026-09-03', sprint_id: 'com11-26-s01', title: 'Drop Day', url: MM + 'photoshop/studio/drop-day/?course=COM11#step-1' },
      { from: '2026-09-18', sprint_id: 'com11-26-s02', title: 'The Brief Has Changed', url: CT + 'sprints/brief-has-changed/guide.html' },
      { from: '2026-10-05', sprint_id: 'com11-26-s03', title: 'Document It', url: CT + 'sprints/document-it/guide.html' },
      { from: '2026-10-19', sprint_id: 'com11-26-s04', title: 'Build It True', url: CT + 'sprints/build-it-true/guide.html' }]
  };
  function courseIds() { return (S.me && S.me.courses || []).map(function (c) { return typeof c === 'string' ? c : c.course_id; }); }
  function routeFor(course, sprintId) {
    var list = SUPPORT_SCHEDULE[course]; if (!list) return null;
    if (sprintId) { var m = list.filter(function (x) { return x.sprint_id === sprintId; }); if (m.length) return m[m.length - 1]; }
    var today = (S.me && S.me.today) || new Date().toISOString().slice(0, 10), cur = list[0];
    list.forEach(function (x) { if (x.from <= today) cur = x; });
    return cur;
  }
  var SUPPORT_ROUTES = { IBDS: routeFor.bind(null, 'IBDS'), MM12: routeFor.bind(null, 'MM12'), COM11: routeFor.bind(null, 'COM11') };
  /** Adds the learner's effective supports to a workbook link, so the workbook opens with the teacher/student choices switched on. */
  function withSupports(url, supports) {
    try { var u = new URL(url); if (supports && supports.length) u.searchParams.set('supports', supports.join(',')); return u.toString(); } catch (e) { return url; }
  }
  function supportPreview(supports, label, route) {
    route = route || routeFor('IBDS');
    var u = new URL(route.url), workbookOrigin = u.origin;
    u.searchParams.set('supports', (supports || []).join(','));
    var frame = h('iframe', { class: 'workbook-preview', title: label || route.title + ' workbook preview', src: u.toString() });
    S.supportFrame = frame;
    frame.addEventListener('load', function () { frame.contentWindow.postMessage({ type: 'student-os-set-supports', supports: supports || [] }, workbookOrigin); });
    return frame;
  }
  function supportChoice(option, checked, suggested, onChange) {
    var input = h('input', { type: 'checkbox', value: option.id, checked: checked, onchange: onChange });
    return h('label', { class: 'support-choice' + (suggested ? ' suggested' : '') }, input,
      h('span', null, h('b', { text: option.label }), h('span', { class: 'small muted', text: option.dimension_id + (suggested ? ' · suggested from profile' : '') })));
  }
  function renderSupports() {
    var available = courseIds().filter(function (c) { return SUPPORT_ROUTES[c]; });
    var course = available.indexOf(S.supportCourse) >= 0 ? S.supportCourse : available[0];
    if (!course) { setMain(empty('No mapped course', 'My supports is available for IBDS, MM12 and COM11 students.')); return; }
    S.supportCourse = course;
    var routeInfo = routeFor(course);
    return call('studentSupports', { course_id: course, sprint_id: routeInfo.sprint_id }).then(function (d) {
      var chosen = d.effective.slice(), preview = h('div');
      function redraw() { fill(preview, supportPreview(chosen, 'My ' + routeInfo.title + ' workbook with selected supports', routeInfo)); }
      var choices = h('div', { class: 'support-options' }, d.options.map(function (o) {
        return supportChoice(o, chosen.indexOf(o.id) >= 0, d.suggested.indexOf(o.id) >= 0, function (ev) {
          if (ev.target.checked && chosen.indexOf(o.id) < 0) chosen.push(o.id);
          if (!ev.target.checked) chosen = chosen.filter(function (x) { return x !== o.id; });
          call('setStudentSupports', { course_id: course, sprint_id: routeInfo.sprint_id, supports: chosen }).then(function (next) {
            chosen = next.effective.slice(); redraw(); announce('My supports updated. This is support information, not achievement.');
          }, function (e) { ev.target.checked = !ev.target.checked; toast(errMsg(e)); });
        });
      }));
      redraw();
      var courseTabs = h('div', { class: 'filters', role: 'group', 'aria-label': 'Course' }, available.map(function (c) {
        return h('button', { type: 'button', class: 'filter' + (c === course ? ' on' : ''), 'aria-pressed': c === course ? 'true' : 'false', onclick: function () { S.supportCourse = c; renderSupports(); } }, c);
      }));
      setMain(h('p', { class: 'eyebrow', text: 'Student OS · ' + course }), h('h1', { text: 'My supports' }), courseTabs,
        h('p', { class: 'lede', text: 'Choose tools that help you access the lesson and show your thinking. You can switch them on yourself.' }),
        h('div', { class: 'banner info', text: d.separation }),
        h('div', { class: 'adapt-layout student-adapt' }, h('aside', { class: 'adapt-drawer' }, h('h2', { text: 'Your supports' }),
          h('p', { class: 'small muted', text: 'Suggested supports come from your learning profile. You decide which optional tools help.' }), choices),
          h('section', { class: 'adapt-preview' }, h('div', { class: 'preview-head' }, h('div', null, h('p', { class: 'eyebrow', text: 'Live preview' }), h('h2', { text: routeInfo.title })), chip('Support stream only')), preview)));
    });
  }
  function renderAdaptations() {
    var courses = courseIds().filter(function (c) { return SUPPORT_SCHEDULE[c]; });
    var course = courses.indexOf(S.adaptCourse) >= 0 ? S.adaptCourse : courses[0];
    if (!course) { setMain(empty('No mapped course', 'Adaptations are available for IBDS, MM12 and COM11.')); return; }
    S.adaptCourse = course; var rt = routeFor(course);
    var courseTabs = h('div', { class: 'filters', role: 'group', 'aria-label': 'Course' }, courses.map(function (c) {
      return h('button', { type: 'button', class: 'filter' + (c === course ? ' on' : ''), 'aria-pressed': c === course ? 'true' : 'false', onclick: function () { S.adaptCourse = c; S.adaptLearner = null; route(); } }, c);
    }));
    return call('teacherAdaptations', { course_id: course, sprint_id: rt.sprint_id }).then(function (d) {
      var selected = d.learners.filter(function (x) { return x.learner_id === S.adaptLearner; })[0] || d.learners[0];
      if (!selected) { setMain(courseTabs, empty('No ' + course + ' students', 'The active roster has no students in this course.')); return; }
      S.adaptLearner = selected.learner_id; var scope = S.adaptScope || 'sprint';
      var chosen = (scope === 'all' ? selected.settings.all.teacher_supports : selected.settings.sprint.teacher_supports).slice();
      var originalScopeSupports = chosen.slice();
      var preview = h('div'), status = h('span', { class: 'save-state', role: 'status' });
      function previewSupports() { var effective = selected.effective.filter(function (x) { return originalScopeSupports.indexOf(x) < 0; }); chosen.forEach(function (x) { if (effective.indexOf(x) < 0) effective.push(x); }); fill(preview, supportPreview(effective, selected.learner_label + ' · ' + rt.title + ' workbook preview', rt)); }
      var roster = h('aside', { class: 'adapt-roster' }, h('p', { class: 'eyebrow', text: course + ' students' }), d.learners.map(function (x) {
        return h('button', { type: 'button', class: x.learner_id === selected.learner_id ? 'selected' : '', onclick: function () { S.adaptLearner = x.learner_id; route(); } },
          h('b', { text: x.learner_label }), h('span', { class: 'small', text: x.suggested.length + ' profile suggestion' + (x.suggested.length === 1 ? '' : 's') }));
      }));
      var scopeControls = h('div', { class: 'scope-controls', role: 'group', 'aria-label': 'Support scope' }, [['sprint', 'This sprint'], ['all', 'All workbooks']].map(function (x) {
        return h('button', { type: 'button', class: scope === x[0] ? 'on' : '', onclick: function () { S.adaptScope = x[0]; route(); } }, x[1]);
      }));
      var choices = h('div', { class: 'support-options' }, d.options.map(function (o) {
        return supportChoice(o, chosen.indexOf(o.id) >= 0, selected.suggested.indexOf(o.id) >= 0, function (ev) {
          if (ev.target.checked && chosen.indexOf(o.id) < 0) chosen.push(o.id);
          if (!ev.target.checked) chosen = chosen.filter(function (x) { return x !== o.id; });
          call('setTeacherSupports', { learner_id: selected.learner_id, course_id: course, sprint_id: rt.sprint_id, scope: scope, supports: chosen }).then(function () {
            status.textContent = 'Saved to support settings · never achievement'; previewSupports();
          }, function (e) { ev.target.checked = !ev.target.checked; status.textContent = errMsg(e); });
        });
      }));
      var dims = h('dl', { class: 'profile-grid' }, Object.keys(selected.profile.dimensions).map(function (id) {
        return [h('dt', { text: id }), h('dd', { text: selected.profile.dimensions[id] || 'Not recorded' })];
      }));
      var note = h('textarea', { id: 'custom-note', maxlength: 2000, placeholder: 'Describe the access or organization need. Do not rewrite questions or lower the assessed skill.' });
      var draftState = h('div', { class: 'small', role: 'status' });
      var custom = h('details', { class: 'custom-version' }, h('summary', { text: 'Custom version' }),
        h('p', { class: 'small muted', text: 'Creates a draft for teacher review. Questions, assessed tasks and all existing IDs stay locked.' }), note,
        h('button', { type: 'button', onclick: function (ev) { if (!note.value.trim()) { note.focus(); return; } ev.target.disabled = true;
          call('createCustomVersionDraft', { learner_id: selected.learner_id, course_id: course, sprint_id: rt.sprint_id, note: note.value }).then(function (r) {
            draftState.textContent = 'Draft ' + r.id.slice(0, 8) + ' · pending your approval · not released'; ev.target.disabled = false;
          }, function (e) { draftState.textContent = errMsg(e); ev.target.disabled = false; });
        } }, 'Create pending draft'), draftState);
      var drawer = h('aside', { class: 'adapt-drawer' }, h('p', { class: 'eyebrow', text: 'Adaptations' }), h('h2', { text: selected.learner_label }),
        h('p', { class: 'small muted', text: selected.profile.source }), dims, h('h3', { text: 'Support layers' }), scopeControls, choices, status, custom);
      previewSupports();
      setMain(h('p', { class: 'eyebrow', text: 'Teacher OS · local prototype' }), h('h1', { text: 'Adaptations' }), courseTabs,
        h('p', { class: 'lede', text: 'Select a student, review Evidence Map suggestions and preview the current workbook (' + rt.title + ') with their supports. Choose All workbooks to apply them to every workbook in the course.' }),
        h('div', { class: 'banner info', text: d.note + ' Custom versions remain drafts until teacher approval.' }),
        h('div', { class: 'teacher-adapt-shell' }, roster, h('div', { class: 'adapt-layout' }, drawer,
          h('section', { class: 'adapt-preview' }, h('div', { class: 'preview-head' }, h('div', null, h('p', { class: 'eyebrow', text: 'Live student preview' }), h('h2', { text: rt.title })), chip('Questions and IDs locked')), preview))));
    });
  }

  /* ------------------------------------------------------------ teacher */
  function renderReflections(r) {
    var course = r.params.course || S.me.courses[0].course_id;
    return call('teacherPrompts', { course_id: course }).then(function (d) {
      var tabs = h('div', { class: 'filters', role: 'group', 'aria-label': 'Course' }, S.me.courses.map(function (c) {
        return h('a', { href: '#/reflections?course=' + c.course_id, class: 'filter' + (course === c.course_id ? ' on' : ''), 'aria-current': course === c.course_id ? 'true' : null }, c.title);
      }));
      var cards = d.prompts.map(function (p) {
        var pct = d.learners ? Math.round(100 * p.responses.length / d.learners) : 0;
        return h('section', { class: 'prompt-card t' + (p.status === 'skipped' ? ' skipped' : ''), 'aria-label': p.title },
          h('div', { class: 'row' }, chip(p.kind === 'weekly' ? 'Weekly · Friday ' + when(p.opens_on) : p.kind === 'sprint' ? 'Sprint' : 'Pushed'), p.status === 'skipped' ? chip('Skipped this week', 'warn') : p.open ? chip('Open', 'ok') : chip('Closed'),
            p.source === 'default' ? h('span', { class: 'small muted', text: 'default questions' }) : null),
          h('h2', { text: p.title }), h('ul', { class: 'prompt-qs' }, p.questions.map(function (q) { return h('li', { text: q }); })),
          h('p', { class: 'small' }, h('b', { text: p.responses.length + ' of ' + d.learners }), ' students have shared a response'),
          h('div', { class: 'progress', 'aria-hidden': 'true' }, h('span', { style: 'width:' + pct + '%' })),
          p.responses.length ? h('ul', { class: 'resp' }, p.responses.map(function (x) { return h('li', null, h('a', { href: '#/reviewentry/' + encodeURIComponent(x.entry_id) }, x.learner_label), x.audience === 'class' ? chip('also shared with class') : null); })) : null,
          p.kind === 'weekly' ? h('div', { class: 'actions' }, h('button', { type: 'button', onclick: function (ev) {
            ev.target.disabled = true; call('skipWeekly', { course_id: course, friday: p.opens_on, skip: p.status !== 'skipped' }).then(function () { announce(p.status === 'skipped' ? 'Weekly reflection turned back on.' : 'Skipped for this week.'); route(); }, function (e) { ev.target.disabled = false; toast(errMsg(e)); });
          } }, p.status === 'skipped' ? 'Turn it back on' : 'Skip this week')) : null);
      });
      var kind = h('select', { id: 'np-kind' }, h('option', { value: 'custom' }, 'A reflection right now'), h('option', { value: 'sprint' }, 'Sprint look-back'), h('option', { value: 'weekly' }, 'Replace this Friday’s questions'));
      var title = h('input', { type: 'text', id: 'np-title', value: 'Quick reflection', maxlength: 120 });
      var qs = h('textarea', { id: 'np-qs', style: 'min-height:110px' }); qs.value = 'What did you try?\nWhat shows it worked — or not yet?\nWhat will you do next?';
      var closes = h('input', { type: 'date', id: 'np-closes' });
      var npState = h('span', { class: 'save-state', role: 'status' });
      kind.onchange = function () { title.value = kind.value === 'sprint' ? 'Sprint look-back' : kind.value === 'weekly' ? 'Friday reflection' : 'Quick reflection';
        if (kind.value === 'sprint') qs.value = 'What are you proudest of this sprint?\nWhat would you do differently?\nWhat will you carry into the next sprint?'; };
      var push = panel('Push a reflection', [
        h('p', { class: 'small', text: 'It appears on students’ home pages straight away. Responses start private; students share them with you.' }),
        h('div', { class: 'field' }, h('label', { for: 'np-kind', text: 'Type' }), kind),
        h('div', { class: 'field' }, h('label', { for: 'np-title', text: 'Title' }), title),
        h('div', { class: 'field' }, h('label', { for: 'np-qs' }, 'Questions ', h('span', { class: 'hint', text: '(one per line, up to six)' })), qs),
        h('div', { class: 'field' }, h('label', { for: 'np-closes' }, 'Open until ', h('span', { class: 'hint', text: '(optional)' })), closes),
        h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: function (ev) {
          var list = qs.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
          ev.target.disabled = true; npState.dataset.state = 'saving'; npState.textContent = 'Sending…';
          call('createPrompt', { course_id: course, kind: kind.value, title: title.value, questions: list, opens_on: d.today, closes_on: closes.value || null }).then(function () { announce('Reflection sent to ' + course + '.'); route(); },
            function (e) { ev.target.disabled = false; npState.dataset.state = 'error'; npState.textContent = 'Not sent: ' + errMsg(e); });
        } }, 'Send to ' + course), npState)]);
      var wq = h('textarea', { id: 'wk-qs', style: 'min-height:90px' }); wq.value = d.setting.questions.join('\n');
      var on = h('input', { type: 'checkbox', id: 'wk-on', checked: d.setting.enabled });
      var wState = h('span', { class: 'save-state', role: 'status' });
      var weekly = panel('Friday reflection (default)', [
        h('div', { class: 'row' }, on, h('label', { for: 'wk-on', style: 'margin:0;font-weight:500', text: 'Send a reflection every Friday' })),
        h('p', { class: 'small muted', text: 'Each Friday students get these questions. Skip a week, or replace a week’s questions, whenever you like.' }),
        h('div', { class: 'field' }, h('label', { for: 'wk-qs', text: 'Default questions' }), wq),
        h('div', { class: 'actions' }, h('button', { type: 'button', onclick: function (ev) {
          ev.target.disabled = true;
          call('setWeeklyDefault', { course_id: course, enabled: on.checked, questions: wq.value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean) }).then(function () { announce('Friday default saved.'); route(); },
            function (e) { ev.target.disabled = false; wState.dataset.state = 'error'; wState.textContent = 'Not saved: ' + errMsg(e); });
        } }, 'Save default'), wState)]);
      setMain(h('h1', { text: 'Reflections' }), h('p', { class: 'lede', text: 'Friday reflections go out automatically. Push an extra one whenever the moment is right.' }), tabs,
        h('div', { class: 'grid two' }, h('div', null, cards.length ? cards : empty('No reflection open', 'The Friday reflection is off or skipped. Push one from the right.')), h('div', null, push, weekly)));
    });
  }
  function renderReview(r) {
    var course = r.params.course || '';
    return call('teacherQueue', course ? { course_id: course } : {}).then(function (rows) {
      var tabs = h('div', { class: 'filters', role: 'group', 'aria-label': 'Course' }, [['', 'All']].concat(S.me.courses.map(function (c) { return [c.course_id, c.course_id]; })).map(function (f) {
        return h('a', { href: '#/review' + (f[0] ? '?course=' + f[0] : ''), class: 'filter' + (course === f[0] ? ' on' : ''), 'aria-current': course === f[0] ? 'true' : null }, f[1]);
      }));
      var list = rows.length ? h('ul', { class: 'queue' }, rows.map(function (x) {
        return h('li', null, h('div', { class: 'spread' },
          h('div', null, h('a', { class: 'post-title', href: '#/reviewentry/' + encodeURIComponent(x.entry_id) }, x.title),
            h('div', { class: 'row small muted' }, h('b', { text: x.learner_label }), courseChip(x.course_id),
              chip(x.kind === 'assignment' ? 'Work for: ' + x.assignment_title : x.kind === 'reflection' ? x.prompt_title : 'Blog post'), x.audience === 'class' ? chip('also shared with class') : null,
              h('span', { text: fmt(x.submitted_at) + (x.attempt > 1 ? ' · update ' + x.attempt : '') }))),
          h('div', { class: 'row' }, x.review.status === 'reviewed' ? chip('Read', 'ok') : chip('New', 'warn'), x.feedback.released ? chip('Replied', 'ok') : x.feedback.drafts ? chip('Reply drafted') : null,
            x.receipt && x.receipt.mode === 'demo' ? chip('Demo receipt', 'demo') : null)));
      })) : empty('Nothing shared yet', 'Posts and reflections students share with you appear here. Private drafts never do.');
      setMain(h('h1', { text: 'Shared with me' }), h('p', { class: 'lede', text: 'Posts, reflections and hand-ins students have shared with you. Newest first.' }), tabs, list);
    });
  }
  function renderReviewEntry(r) {
    return call('getEntry', { entry_id: r.id }).then(function (e) {
      var subs = e.submissions.slice().reverse();
      var pick = subs[0];
      var snapBox = h('div');
      function showSnap(s) {
        pick = s;
        var qs = (s.prompt && s.prompt.questions) || [];
        fill(snapBox, h('div', { class: 'row' }, h('span', { class: 'small muted', text: (s.attempt > 1 ? 'Update ' + s.attempt : 'First shared') + ' · ' + fmt(s.submitted_at) }),
          s.receipt && s.receipt.mode === 'demo' ? chip('Demo receipt · ' + s.receipt.id, 'demo') : null,
          s.review.status === 'reviewed' ? chip('Read ' + fmt(s.review.at), 'ok') : h('button', { type: 'button', onclick: function (ev) {
            ev.target.disabled = true; call('markReviewed', { submission_id: s.id }).then(function () { announce('Marked as read.'); route(); }, function (err) { ev.target.disabled = false; toast(errMsg(err)); });
          } }, 'Mark as read')),
          h('h2', { style: 'margin-top:12px', text: s.snapshot.title }),
          (s.snapshot.answers || []).map(function (a, i) { return a.trim() ? h('div', { class: 'qa' }, h('p', { class: 'q', text: qs[i] || '' }), h('div', { class: 'prose' }, paragraphs(a))) : null; }),
          s.snapshot.body ? h('div', { class: 'prose' }, paragraphs(s.snapshot.body)) : null,
          Object.keys(s.snapshot.prompts || {}).map(function (k) { return h('div', { class: 'qa' }, h('p', { class: 'q', text: PROMPTS[k] }), h('div', { class: 'prose' }, paragraphs(s.snapshot.prompts[k]))); }),
          s.snapshot.artifacts.length ? h('ul', { class: 'artifacts' }, s.snapshot.artifacts.map(function (x) { return h('li', null, safeLink(x.url, x.label)); })) : null);
      }
      var fbText = h('textarea', { id: 'fb-body', maxlength: 4000, placeholder: 'What’s working, one thing to try next, and where to show it.' });
      var fbState = h('span', { class: 'save-state', role: 'status' });
      showSnap(pick);
      setMain(h('p', { class: 'eyebrow' }, h('a', { href: '#/review' }, '← Shared with me')),
        h('h1', { text: e.learner_label }),
        h('p', { class: 'lede' }, courseChip(e.course_id), ' ', e.ref ? 'Work for ' + e.ref.title : e.prompt ? e.prompt.title : 'Blog post', e.audience === 'class' ? ' · also shared with the class' : ''),
        h('div', { class: 'grid two' },
          h('div', null, h('section', { class: 'panel' }, subs.length > 1 ? h('div', { class: 'row', style: 'margin-bottom:10px' }, subs.map(function (s) { return h('button', { type: 'button', onclick: function () { showSnap(s); } }, s.attempt > 1 ? 'Update ' + s.attempt : 'First version'); })) : null, snapBox),
            h('section', { class: 'panel', 'aria-label': 'Replies' }, h('h2', { text: 'Replies' }), thread(e, route))),
          h('div', null, panel('Reply', [
            h('p', { class: 'small', text: 'Private to this student — never shown to the class or in their portfolio. It saves as a draft; press “Send to student” when ready.' }),
            h('div', { class: 'field' }, h('label', { for: 'fb-body', text: 'Your reply' }), fbText),
            h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onclick: function (ev) {
              if (!fbText.value.trim()) { fbText.focus(); return; }
              ev.target.disabled = true; fbState.dataset.state = 'saving'; fbState.textContent = 'Saving…';
              call('addFeedback', { entry_id: e.id, submission_id: pick.id, body: fbText.value }).then(function () { announce('Reply saved as a draft. The student can’t see it yet.'); route(); },
                function (err) { ev.target.disabled = false; fbState.dataset.state = 'error'; fbState.textContent = 'Not saved: ' + errMsg(err); });
            } }, 'Save draft reply'), fbState)]),
            panel('Good to know', h('ul', { class: 'small' }, h('li', { text: 'Marking as read and replying are separate.' }), h('li', { text: 'Nothing here is a mark. Achievement stays in the Evidence Map.' }))))));
    });
  }
  function renderActivity(r) {
    var course = r.params.course || S.me.courses[0].course_id;
    return call('teacherActivity', { course_id: course }).then(function (rows) {
      var sel = h('select', { id: 'a-course', onchange: function (e) { location.hash = '#/activity?course=' + e.target.value; } },
        S.me.courses.map(function (c) { return h('option', { value: c.course_id, selected: c.course_id === course }, c.title); }));
      setMain(h('p', { class: 'eyebrow', text: 'Teacher' }), h('h1', { text: 'Course activity' }),
        h('div', { class: 'banner info', text: 'Workflow activity only: submissions and board columns. This is not achievement, a mark or a prediction input. Private journal drafts are not shown.' }),
        h('div', { class: 'field', style: 'max-width:320px' }, h('label', { for: 'a-course', text: 'Course' }), sel),
        rows.length ? h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, ['Student', 'Submissions', 'Reviewed'].concat(COLUMNS.map(function (c) { return COLUMN_LABELS[c]; })).concat(['Asking for feedback']).map(function (t) { return h('th', { scope: 'col', text: t }); }))),
          h('tbody', null, rows.map(function (x) {
            return h('tr', null, h('td', { text: x.learner_label }), h('td', { text: String(x.submissions) }), h('td', { text: String(x.reviewed) }),
              COLUMNS.map(function (c) { return h('td', { text: String(x.board[c]) }); }), h('td', { text: x.need_feedback.map(function (n) { return n.title; }).join('; ') || '—' }));
          })))) : empty('No active learners', 'The roster has no active learners in this course.'));
    });
  }

  /* ------------------------------------------------------------ sign-in / denied */
  function renderSignin() {
    setMain(h('div', { class: 'signin' },
      h('p', { class: 'eyebrow', text: 'Local demonstration' }), h('h1', { text: 'Choose a synthetic account' }),
      h('p', { class: 'lede', text: 'In the proposed Google version, your school sign-in identifies you and the server checks the existing roster. Here, a demo sign-in stands in for that step. Every account below is synthetic.' }),
      h('div', { class: 'accounts' }, (S.config.accounts || []).map(function (a) {
        return h('button', { type: 'button', onclick: function () { post('/api/demo-signin', { account_id: a.account_id }).then(function () { boot(); }); } }, a.label);
      }))));
  }
  function renderDenied(e) {
    setMain(h('div', { class: 'signin' }, h('h1', { text: 'Access denied' }), h('div', { class: 'banner error', text: errMsg(e) }),
      h('p', { text: 'Student OS only opens for signed-in school accounts on an active class roster. Nothing private was loaded.' }),
      !isGAS ? h('button', { type: 'button', onclick: function () { post('/api/signout').then(function () { S.me = null; boot(); }); } }, 'Back to demo sign-in') : null));
  }

  function boot() {
    var cfg = isGAS ? Promise.resolve({ mode: 'apps-script' }) : fetch('/api/config', { credentials: 'same-origin' }).then(function (r) { return r.json(); });
    cfg.then(function (c) {
      S.config = c;
      return call('whoami').then(function (me) {
        S.me = me; banner(); renderChrome(); S.initial = true;
        if (!location.hash || location.hash === '#' || location.hash === '#/') location.replace(me.kind === 'student' ? '#/home' : '#/reflections');
        else route();
      }, function (e) {
        S.me = null; banner(); renderChrome();
        if (!isGAS && e && e.code === 'DENIED' && /Sign in/.test(e.message) ) renderSignin(); else renderDenied(e);
      });
    }).catch(function () { setMain(h('div', { class: 'banner error', text: 'Student OS could not start. Check your connection and reload.' })); });
  }
  boot();
})();
