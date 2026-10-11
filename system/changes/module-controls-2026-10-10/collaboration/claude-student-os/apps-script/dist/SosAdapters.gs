/* Student OS adapters — the ONLY boundary between Student OS and the existing system.
 *
 * Interfaces (both demo and proposed live implementations satisfy these):
 *   assignments.listReleased(courseIds) -> [assignment]        read released assignments (existing IDs)
 *   evidence.submit(submission)         -> receipt              send a reflection/evidence REFERENCE; idempotent by submission.id
 *   announcements.list(courseIds)       -> [announcement]       teacher-released class feed
 * Each adapter exposes `demo` (boolean) and `label` (shown in the UI). Mock receipts always say “Demo”.
 */
(function (root) {
  'use strict';

  function demoAdapters(snapshot, fixtures) {
    var released = (snapshot.assignments || []).filter(function (a) { return a.release && a.release.state === 'demo_released'; });
    var receipts = {};
    return {
      demo: true,
      labels: {
        assignments: 'Demo: assignment snapshot built from existing sources; release flags are demo only.',
        evidence: 'Demo: submissions stay inside this pilot. Nothing is sent to the Technology Evidence System or Evidence Map.',
        announcements: 'Demo: synthetic announcements.'
      },
      assignments: {
        demo: true,
        listQuizzes: function (courses) {
          return (snapshot.quizzes || []).filter(function (q) { return q.release && q.release.state === 'demo_released' && courses.indexOf(q.course_id) >= 0; })
            .map(function (q) { return JSON.parse(JSON.stringify(q)); });
        },
        listReleased: function (courses) {
          return released.filter(function (a) { return courses.indexOf(a.course_id) >= 0; }).map(function (a) { return JSON.parse(JSON.stringify(a)); });
        }
      },
      evidence: {
        demo: true,
        label: 'Demo receipt — stored in this pilot only',
        submit: function (sub) {
          if (!receipts[sub.id]) receipts[sub.id] = { mode: 'demo', id: 'DEMO-' + sub.id.slice(4, 16).toUpperCase(),
            label: 'Demo receipt — not sent to the Technology Evidence System or Evidence Map', at: sub.submitted_at };
          return JSON.parse(JSON.stringify(receipts[sub.id]));
        }
      },
      quizzes: {
        demo: true,
        releasedMisses: function (learnerId, courses) {
          return (fixtures.quiz_feedback || []).filter(function (m) { return m.learner_id === learnerId && courses.indexOf(m.course_id) >= 0; })
            .map(function (m) { var o = JSON.parse(JSON.stringify(m)); delete o.learner_id; o.demo = true; return o; });
        }
      },
      results: {
        demo: true,
        listReleased: function (learnerId, courses) {
          return (fixtures.released_results || []).filter(function (r) { return r.learner_id === learnerId && courses.indexOf(r.course_id) >= 0 && r.released === true; })
            .map(function (r) { return JSON.parse(JSON.stringify(r)); });
        }
      },
      achievements: {
        demo: true,
        listConfirmed: function (learnerId, courses) {
          return (fixtures.confirmed_evidence || []).filter(function (e) { return e.learner_id === learnerId && courses.indexOf(e.course_id) >= 0 && e.teacher_confirmed === true; })
            .map(function (e) { return JSON.parse(JSON.stringify(e)); });
        }
      },
      profiles: {
        demo: true,
        list: function (learnerId, courses) {
          return (fixtures.learning_profiles || []).filter(function (p) { return p.learner_id === learnerId && courses.indexOf(p.course_id) >= 0; })
            .map(function (p) { return JSON.parse(JSON.stringify(p)); });
        }
      },
      calendar: {
        sprints: function (courses) {
          return (snapshot.sprints || []).filter(function (x) { return courses.indexOf(x.course_id) >= 0; }).map(function (x) { return JSON.parse(JSON.stringify(x)); });
        }
      },
      announcements: {
        demo: true,
        list: function (courses) {
          return (fixtures.announcements || []).filter(function (n) { return courses.indexOf(n.course_id) >= 0; })
            .map(function (n) { var o = JSON.parse(JSON.stringify(n)); o.demo = true; return o; });
        }
      }
    };
  }

  var API = { demoAdapters: demoAdapters };
  if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.SOSAdapters = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
