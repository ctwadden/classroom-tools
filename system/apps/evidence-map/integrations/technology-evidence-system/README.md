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
