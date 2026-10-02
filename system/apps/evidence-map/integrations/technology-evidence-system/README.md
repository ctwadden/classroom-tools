# Technology Evidence System → Outcome Evidence Map integration

Additive, non-destructive bridge. Google Forms/Sheet stays the intake/normalize/audit/recovery layer; the Evidence Map is the one teacher-facing student-learning system. Nothing here is "done" until the end-to-end test below passes on a live deployment.

## Pieces
- **`TechnologyEvidenceMapSync.gs`** — paste into the **same Apps Script project bound to the `Technology Evidence System` sheet** (alongside `Code.gs`/`Dashboard.gs`). Pushes each `Evidence_Log` append to the Evidence Map; failures become PENDING and retry; a Netlify outage never loses a form submission.
- **`netlify/functions/ingest-learning-events.js`** — authenticated, idempotent ingest → Netlify Blobs store `learning-events`.
- **`OUTCOME_CODE_MAP.json`**, **`SKILL_CROSSWALK.json`** — the id contracts the endpoint consumes.

## Install — Apps Script side
1. Add `TechnologyEvidenceMapSync.gs` to the project.
2. **Project Settings → Script Properties:**
   - `EVIDENCE_MAP_INGEST_URL` = `https://outcome-evidence-map.netlify.app/.netlify/functions/ingest-learning-events`
   - `EVIDENCE_MAP_INGEST_SECRET` = a long random string (same value on both sides)
   - `LEARNER_ID_SECRET` = a long random string (Google-only; never leaves Apps Script)
3. In **`appendEvidence_`** (`Code.gs`), add ONE line after `sh.appendRow(...)`:
   ```js
   try { emOnEvidenceAppended_(obj); } catch (e) { logError_('WARN', e.message, 'emSync'); }
   ```
4. In **`onOpen`** menu, add:
   ```js
   .addSeparator()
   .addItem('Sync pending Evidence Map events', 'syncPendingEvidenceToEvidenceMap')
   .addItem('Resync ALL Evidence Map events', 'resyncAllEvidenceToEvidenceMap')
   .addItem('Backfill Knowledge scores', 'backfillKnowledgeScores')
   ```
No other change. Existing forms, submit handlers and `Evidence_Log` are untouched.

## Install — Netlify side
1. **Environment variable:** `EVIDENCE_MAP_INGEST_SECRET` = same value as the Apps Script property.
2. **Netlify Blobs** must be enabled (store `learning-events`). If the build doesn't already include it, add `@netlify/blobs` to `package.json` dependencies.
3. Deploy. The endpoint rejects any request without `Authorization: Bearer <secret>` — never a public write.

## Event contract (`.gs` emits → endpoint stores)
```
{ stream: knowledge|evidence|reflection|transfer|support,
  event_id = sha256(source_form_id:source_response_id:canonical_id),   // idempotent
  learner_id = HMAC(email),  course_id, project_id, canonical_id,
  tutorial_skill_ids: [PS-*/GD-*/BL-*],   // preserved; resolved via SKILL_CROSSWALK
  outcome_codes_raw: "MM12 1.1;CT11 4.4", // endpoint normalizes + keeps raw
  evidence_type_raw, response_value, level_raw, independence_raw, teacher_verified,
  source_form_id, source_response_id, timestamp,
  is_correct, points_earned, points_possible }   // knowledge only
```

## Fixed mappings (authoritative, from `TS.LEVELS` / `TS.INDEPENDENCE`)
- **Achievement level → band** (endpoint, *suggested* — teacher confirms; never auto-graded):
  `IE → no update · 1 → Beginning · 2 → Developing · 3 → Secure · 4 → Extending`
- **Independence → support signal** (unconfirmed; never changes achievement):
  `Significant support → Guided · Prompts/checkpoints → Supported · Independent → Independent · Adapted/transferred → Transfer`
- **Legacy outcome codes** normalized on ingest, raw preserved: `MM12 1.1 → MM12-1.1 → mm12-o5`, `CT11 4.4 → COM11-4-4 → communications-technology-11-4-4`.
- **Knowledge is NOT product evidence** — stored as its own stream with `is_correct`/points; changes no competency, no grade.
- **Transfer candidate** stays pending teacher verification (never auto-Extending).

## End-to-end test (run before calling this complete)
For each of (1) a Knowledge MC answer, (2) a teacher Observation/Conversation, (3) a Transfer candidate, (4) a support signal if enabled:
```
test Google Form  →  Apps Script (appendEvidence_)  →  Evidence_Log
   →  emOnEvidenceAppended_  →  Bearer ingest  →  Netlify Blobs  →  Evidence Map shows correct learner/outcome
```
Confirm in the `Evidence Map Sync` tab that each event row shows `status = ok` with an `evidence_map_record_id`. Send the same form response twice → exactly one stored event (idempotency). Take Netlify down → submission still succeeds and the row is `pending`; run **Sync pending** → it becomes `ok`.

## Verified delivery receipts — 25 September 2026

The sync log retains the original eleven columns and appends `revision_id` and
`source_revision`. A delivery is confirmed only when the response contains literal
`ok: true`, the requested event ID, and a 64-character hexadecimal revision ID.
A missing, malformed or mismatched receipt stays pending. Previously successful
rows without a revision receipt retry once using their existing event IDs and
source revision; the dashboard deduplicates them. Unknown headers or occupied
extension columns stop migration rather than overwrite Sheet content.

Validation: `node --test integrations/technology-evidence-system/sync-receipts.test.cjs`.
The installed Google code confirmed all 12 existing events; each receipt matched
its exact dashboard revision. Before/after snapshots showed unchanged roster,
evidence and judgments. Four synthetic field records were also mirrored twice
by the installed Google runtime into the separate `Integration QA Field` tab:
revision IDs, rubric identity and structured support survived without duplicate
rows. This fixture test did not exercise the Netlify-to-Google network fetch or
a new Form submission. The temporary test function was removed after validation.

Form events still carry the recorded checkpoint, skill and outcome references;
existing Form Item Map / Evidence_Log schemas do not establish the rubric version
and criterion actually used. Do not attach a newer draft rubric retrospectively.
Future binding requires an explicitly approved assignment/rubric version and a
versioned Form mapping; knowledge/reflection entries must remain distinct from
teacher-confirmed achievement. The repaired receipt alone does not establish
rubric alignment or academic competence.

## Criterion-bound teacher Forms

`FormRubricBinding.gs` supports optional frozen `teacher_evidence.criterion_choices`
in a Form specification. Each label selects exactly one course, checkpoint and
criterion. A shared checkpoint never duplicates one level across multiple criteria.
Explicit `unbound: true` choices preserve general evidence for courses whose
rubric is still draft. Legacy specifications keep their existing behavior.

Generation checks the exact approved, capture-ready rubric from Evidence Map
before creating a Form, including checkpoint, outcome and sampled-skill links.
The registered `SPEC_<form_id>` snapshot preserves the choices used by that Form.
The teacher response stores its context in an additive `rubric_context_json`
column at the end of Evidence_Log (created only on the first bound response).
Unknown headers or an occupied extension column stop the write. Existing rows
keep their original context on replay. Only bound O/C/P events use source revision
3 and carry rubric/version/criterion fields; legacy events remain revision 2.
Knowledge, reflection, transfer candidates and support cannot acquire this context.
Google provenance still does not confirm dashboard achievement.

The original review is preserved in `teaching/reviews/Truck_Ad_Rubric_Review.html`
and `Truck_Ad_forms-spec_v2_DRAFT.json`. Chad approved MM12-TRUCK-AD-R1 version
2026-09-25.2 and its 15 choices on 25 September 2026. The approved teacher-only
release is `teaching/reviews/Truck_Ad_teacher_release_v2.json`.

`TeacherFormRelease.gs` provides guarded, manual preparation and activation. It
builds an unpublished Form, restricts responder access to the school owner, verifies
the exact approved rubric, then publishes and switches only the teacher registry.
The existing student knowledge/reflection Form and historical responses remain.
The teacher release has `teacher_form_version: 2.0`; the project `spec_version: 1`
is deliberately retained so the unchanged student pair still satisfies the existing
generator's reuse check. Do not regenerate the pair from the old source spec.
The new teacher's frozen `SPEC_<form_id>` holds its exact criterion choices.

Activated teacher Form: `1x2BEb_IQOiSqAk9lAbzGuT68cPKot1sWvXCRhGpBfek`,
response tab `Form Responses 23` (gid 781008343). The preceding teacher Form is
inactive and closed to new responses with a replacement notice; its responses
remain intact. The student Form `1da4cFPV-iUuk5ay1uA9y9Ay0z0GMUk-fLLPO8bnzJ5A`
is unchanged. COM11 retains six explicitly general evidence choices; approval of
the MM12 rubric does not approve a COM11 rubric.

A browser submission under `INTEGRATION QA — NOT A STUDENT` was traced from the
response tab through Evidence_Log to the production dashboard on 25 September.
It selected TA-QA-01 / TA-MM-C2, rubric 2026-09-25.2, IE, source revision 3.
Receipt/event ID: `8ee694daa3ba9a1736582c7afaa565be856bc40795dc71d16f588cfc91348da0`.
Revision: `7120977a619b1ac96721cb612681ef5102ccde192ee0bba521a2f6313de2fe22`.
The unrostered QA record is intentionally retained and labelled; it has no band or
confirmed judgment. Its temporary Form option was removed after the check. Never
use the manual QA helpers as triggers or submit a test against a real student.
The source field `teacher_verified` is provenance; normalization correctly keeps
the dashboard `teacher_verified: false` until actual teacher review.

Run `node --test integrations/technology-evidence-system/form-rubric-binding.test.cjs`
for the binding contract and `node --test tests/*.test.cjs integrations/technology-evidence-system/*.test.cjs`
for related regression checks. A passing local test does not certify a newly
created Google Form or a physical iPad offline/reconnect workflow.
