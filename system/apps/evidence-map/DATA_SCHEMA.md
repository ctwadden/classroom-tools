# Evidence Map — canonical data schema (join contract)

Read from the live code on 2026-09-20: `index.html` (SKILLS_RAW, _SCALES, RUBOUT, MODE_RUBRIC, EvidenceStudio, export/import), `app-storage.js` (storage layer), `backup-core.js` (backup validator). This file is the source of truth for how the workbook's evidence IDs, Google-Form results, and a future coach signal JOIN to the same skills. **Preserve these IDs; do not fork.**

## 0. Two divergences to fix on the *external* side (not in the app)
- **Band name:** level 3 is **`Secure`**, not "Meeting." "Meeting" (v6) appears nowhere in the app. Conform the workbook to **Beginning · Developing · Secure · Extending**.
- **Skill-ID vocabulary:** `PHOTOSHOP_SKILLS` / `DESIGN_FOUNDATIONS_SKILLS` **do not exist** in the Evidence Map. The canonical vocabulary is `SKILLS_RAW` skill_ids: `ct-*` (Comm Tech 11), `mm-*` (Multimedia 12), `ds-*` (Digital Society). Any external skill must use these exact ids.

## 1. Skill card (SKILLS_RAW, in index.html)
Fields: `skill_id`, `course_id`, `domain`, `rung` (`F`|`G`|`I`|`A` = Foundations/Guided/Independent/Applied), `title`, `description`, `outcome_ids` (contract outcome ids the skill serves), `prerequisites` (array of skill_ids).
```json
{"skill_id":"ct-design-brief","course_id":"ns-communications-technology-11","domain":"design-process",
 "rung":"F","title":"Write a design brief",
 "description":"Read a design problem and state audience, purpose, and one constraint in a one-line brief.",
 "outcome_ids":["communications-technology-11-1-4","communications-technology-11-1-1"],"prerequisites":[]}
```
`course_id` ↔ internal cid: `ns-communications-technology-11`↔`COM11`, `ns-multimedia-12`↔`MM12`, `ib-digital-society-sl`↔`IBDS` (via CONTRACT2CID). A combo skill lists ≥2 `prerequisites` (e.g., `ct-brand-identity` needs `ct-compose-message`,`ct-export-output`).

## 2. Achievement scale / bands (_SCALES)
- `mastery-1-4` (MM12, COM11): `1 Beginning · 2 Developing · 3 Secure · 4 Extending`, plus a boolean `plus` modifier (2+/3+) and optional per-criterion map `criteria{criterionIndex:level}`.
- `ib-1-7` (IBDS): `IB 1 … IB 7`.
- `level` is an integer `0..top(cid)` where 0 = Not assessed. `conf` (teacher confidence in the judgment) is `0..3`.

## 3. Evidence records + O/C/P
Three layers exist; all keyed by **`student_id` (pseudonymous learner id — the roster id / PowerSchool number), never an email.**

**(a) Studio shared evidence** — the canonical verifiable event (`em_studio_v1` → `EvidenceStudio.evidence[]`):
```js
{ id:UUID,               // ← evidence_id (the stable join key)
  course:cid, student:student_id,
  skill:null,            // ← skill slot EXISTS but is not populated at capture yet
  method:'Product'|'Observation'|'Conversation',   // O/C/P
  level:int|null, support:'None',                    // ← support slot EXISTS (see §5)
  attempt, artifact, note, next, learned, date, createdAt, verified:bool,
  outcomeLinks:[ {key:'MODULETAG|outcome_id', level, criteria, rubricVersion, at} ] }  // links to OUTCOMES
```
**(b) Nested outcome cell** (`tos_evidence_v1` → `store[cid][student_id][outcomeKey]`), `outcomeKey = moduleTag + '|' + outcome.id`:
```js
{ level:0..top, conf:0..3, evidence:[
   {ref:evidence_id}                                             // pointer to a studio event, OR
 | {f:'Pro'|'Obs'|'Con', note, date, level?, plus?, criteria?, skill_id?, skill_rung?} ] }
```
**(c) Portable backup evidence** (`export d.evidence[]`): `{course_id, student_id, form:'Pro'|'Obs'|'Con', note, date, level, level_label, confidence, skill_id, skill_rung}`.

### THE JOIN (read this)
Evidence attaches to **outcomes** (`outcomeLinks[].key`), and skills map to outcomes (`SKILLS_RAW.outcome_ids`). So today the reliable path is:
`skill_id → SKILLS_RAW.outcome_ids → outcome key "TAG|outcome_id" → evidence`.
The `skill`/`skill_id`/`skill_rung` fields are **plumbed in the portable format but not written at capture** (studio `skill` is `null`). To join a workbook/Form/coach signal to a skill: (1) emit the **outcome key or outcome_id** and join through it now, and/or (2) populate the existing `skill` slot at capture — no new field, no fork. (Not changed here; flag if you want it wired.)

## 4. Storage + ingest (what's actual today)
Storage: one atomic value `em_app_store_v2` = `{schema:2, revision, committedAt, values:{…}}` wrapping legacy keys: `tos_evidence_v1` (nested cells), `em_studio_v1` (studio events), `tos_rosters_v1`, `tos_assessed_v1`, `tos_rubrics_v1`, `tos_termstart_v1`, `tos_duedates_v1`.
**Ingest paths that exist:** (a) manual capture in the app UI (writes a studio event + nested cell), (b) full JSON backup import (schema:1, validated by `backup-core.js`), (c) roster paste / CSV → `tos_rosters_v1` (`{student_id, name, imported?}`).
**Not built:** Google Form → Sheet, `no-cors` collector, `gviz`. The only network call is `/api/gemini` (AI draft proxy). The Form/collector pipeline is **planned, not wired** — design it to emit the §3 fields.
**Planned vs actual:** plan = activities/sprints + `assessed_overrides` + `term_starts`/`due_overrides` + `rubrics`; actual evidence = `studio.evidence` + nested `legacy_state` + `judgments` (teacher-confirmed final levels). Separate stores; no planning-vs-real import split for evidence.

## 5. Support dimension (forward-looking — where it lives, not built)
A second dimension (support needed: **Guided / Supported / Independent / Transfer**, kept separate from the grade) attaches as a **value on the existing `support` field of the studio evidence record** (§3a; currently defaults to `'None'`). It is per-evidence, parallel to `level` — *not* a field on the skill card (cards are definitions), *not* a separate record. To carry it through: also add `support` to portable evidence (§3c) and to `backup-core.js` validation, and surface it in a **separate view/report axis**. Coach chat + workbook should emit `support` as one of the four band values on the same evidence event that carries the O/C/P `method` and the outcome/skill join.

## Backup file (schema:1) — the handoff envelope
`{schema:1, app:'outcome-evidence-map', courses[], students{cid:[{student_id,name,imported?}]}, evidence[], judgments[{course_id,student_id,level,internal_outcome|outcome_id}], legacy_state{cid:{sid:{outcomeKey:cell}}}, studio{evidence:[…]}, assessed_overrides, rubrics{cid:{rubKey:[{label,lv{level:desc}}]}}, term_starts, due_overrides, export_status, report_comments, report_marks}`.

---
# Integration contract — Technology Evidence System → Evidence Map (2026-09-21)
Reference: CLAUDE_CODE_EVIDENCE_MAP_TECHNOLOGY_EVIDENCE_INTEGRATION_PROMPT.md. Companion files: `OUTCOME_CODE_MAP.csv/.json`, `SKILL_CROSSWALK.csv/.json`.

## ID fields — distinct, never overloaded (prompt §5)
- `course_id`: **COM11 / MM12 / IBDS** (internal). CT11 is NOT a course_id.
- `outcome_id`: internal machine key — `communications-technology-11-4-4` · `mm12-o5` · `ds-u04-003`.
- `outcome_code`: canonical cross-system code every producer emits — `COM11-4-4` · `MM12-1.5` · `DS-U04-003`.
- `ps_outcome_code`: PowerSchool alias ONLY — `CT11-4-4` (COM only; = outcome_code for MM/DS).
- `display_code`: `4.4` · `1.5` · `U4.3`.
Resolution: producer emits `outcome_code` → `OUTCOME_CODE_MAP` → `outcome_id` (the join). Legacy `"MM12 1.1"` / `"CT11 4.4"` normalize to `MM12-1.1` / `COM11-4-4` on ingest; keep the raw value for audit.

## Streams (prompt §10) — five first-class, separate reducers
`knowledge` · `evidence` (Obs/Con/Pro) · `reflection` · `transfer` · `support`.
**Knowledge is NOT product evidence** (prompt §7 — the earlier MC→level→Product proposal is REJECTED). Knowledge/reflection/transfer/support never create competency level, mastery, or a grade automatically. Support never alters achievement. Teacher judgement stays separate.

### knowledge event (diagnostic only)
`{stream:"knowledge", event_id, learner_id, course_id, project_id, canonical_question_id, step_id, outcome_code, outcome_id, tutorial_skill_ids[], is_correct, points_earned, points_possible, response_value, source_form_id, source_response_id, timestamp}` — dashboard shows it beside competency evidence; changes no level.

### achievement (evidence) ingest — teacher-verified O/C/P, level→band (prompt §13)
`IE → insufficient evidence (no update) · 1→Beginning · 2→Developing · 3→Secure · 4→Extending`. Preserve original level text, teacher_note, teacher_verified, source ids, project, skill_ids, outcome_codes, timestamp. Adds evidence; does NOT auto-change the competency card judgment.

### transfer → candidate, pending teacher review; NEVER auto-Extending. reflection/support → unconfirmed signals; teacher-confirmed workflow only.

## Identity (prompt §9) — pseudonymous
`learner_id = HMAC(normalized_email, secret)`; secret in Apps Script Properties / server secret store, never in GitHub or the sheet. **student_email stays in the Google layer; the Evidence Map ingest receives `learner_id` only.** Assistant Coach receives learner_id only.

## Ingest (prompt §10-11) — authenticated, idempotent, server-to-server
`POST /.netlify/functions/ingest-learning-events` (Bearer secret; never a public write). Batched; validate against schema; reject unknown ids (no silent invention). `event_id = hash(source_form_id:source_response_id:canonical_id)` — resend = one logical event.

## Hard guardrails (prompt §21)
No secret in browser/GitHub · no student email to Coach or Evidence Map · no unauthenticated writes · no PII in public catalogs · no grade from Knowledge · no support band as achievement · no destructive deletion of raw Google responses. **BLOCKER (2026-09-21): the Technology Evidence System sheet is shared "Anyone with link = Editor" and contains student emails — lock to Restricted before any PII migration.**
