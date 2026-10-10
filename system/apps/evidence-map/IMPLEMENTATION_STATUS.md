# Connected teaching system — implementation record

Updated 2026-09-24. This file records implemented work and remaining work; it is not a claim that every lesson exists.

## Decisions retained

- Netlify Evidence Map is the teacher dashboard and owner of explicit outcome judgments.
- The existing Technology Evidence System Google Sheet owns the roster and Forms intake. Its learner IDs remain stable. Progress returns from Netlify to a separate mirror, never back into the intake log.
- The existing AI Studio AssessTrack app becomes an iPad observation/conversation client of the same catalogue, rubrics and evidence service.
- GitHub holds Learning Studio Workbook Standard v2 materials. Preserve Truck Ad, Drop Day, Below the Surface and On the Cover resources.
- MM12: 9 sprints; COM11: 9; IBDS: 16, September–May. Preserve `outputs/connected-course-map-2026-09-23` and its daily plan.
- PowerSchool: **outcome/standards grades with teacher-written comments**, confirmed by the teacher on 2026-09-23. No automatic percentage conversion, support penalty or predicted IB 7.

## Connection deployed and verified

- Live dashboard: https://outcome-evidence-map.netlify.app/connected.html. Production deploy `6ab46ae3df8d4b397bae6c54` established the connection on September 23, 2026. Final verified deploy `6ab47094ef4abbb33f324d64` includes the shared-course mapping fix, isolated preview authentication, handoff page and home-page redirect.
- Bound Google Apps Script source backed up, updated and installed in the existing project. Installer completed at 9:14 PM Atlantic: 16 exact Form bindings repaired; 50 roster memberships connected.
- Production readback: MM12 18 roster memberships and 12 existing evidence events; COM11 32 memberships and no events; IBDS has no roster memberships or events yet. No teacher-confirmed judgments existed at verification, and no live student judgments were created during testing.
- Roster has durable `learner_id`; **Evidence Map Progress** exists with separate achievement, support, comment and revision columns. Google reads the same teacher judgments from Netlify rather than calculating a second grade.
- Apps Script trigger page verified exactly one spreadsheet Form-submit router plus one five-minute sync/retry timer. The timer had run successfully with 0% errors at verification. There is no per-project trigger growth.
- Shared Truck Ad checkpoint mappings now select the event’s course while retaining other-course template references. Existing source revisions are preserved. Final live readback showed 11 course-mapped records and one unlinked reflection, with no unresolved outcome mappings.
- The deployed, isolated preview passed 13 round-trip checks using fictional learners: intake, retry deduplication, O+C retention, explicit teacher review, Google progress readback, authorization rejection, stale-review rejection and approved-rubric field capture. The live API and Google installer were separately verified without creating student grades. Preview authentication uses distinct EVIDENCE_MAP_PREVIEW_* credentials and never falls back to live credentials.
- Local checks: 24 new connection/Google tests plus 61 existing checks passed. The teacher UI was checked in the browser before the final navigation/documentation changes. Chrome later blocked further automation because another extension UI was open; final responsive visual recheck was not completed. The final live API and public URLs were verified separately.
- Nine rubric definitions are downloadable, including two new Truck Ad rubrics. They require explicit teacher review before field capture; IBDS-R01 remains blocked from approval until its criterion mapping is complete.
- Exact iPad continuation prompt and implemented interface: `outputs/connected-system-handoff-2026-09-23/`. PowerSchool handoff continues the earlier Conversation_Assessment guidance.

## Operational limits and next work

The existing AI Studio app has been inspected but not modified; it is not yet the connected offline iPad client. Give AI Studio the handoff prompt and interface contract. No audio/transcription or model API is implemented in this release.

This is one teacher workspace. It is not a multi-teacher access system. Existing browser-local planner records have not been silently matched to live learners by name. PowerSchool export is a review CSV, pending local IDs, score mappings and the actual import template. The service has bounded requests, retries and constant trigger count; full-year load/performance has not been certified.

Historical evidence revisions are retained, but a later correction to an evidence event does not automatically reverse an earlier teacher judgment. Review corrected evidence and deliberately revise the affected judgment. The original Apps Script browser tab had unsaved edits when this work began; it was left untouched. Reload that old editor before editing so it does not overwrite the installed source.

## Teaching production still required

The 34 sprint sequence and 332 dated lesson entries are planning records. Recoverable Photoshop packages exist. They do not constitute a completed MM12/COM11 semester or IBDS full-year teaching package. Each finished package needs content, student activities, assets, teacher preparation notes, aligned rubric, assessment/answer guidance, and checks appropriate to its use.

IBDS still needs the chapter/source-to-day teaching materials, labs, slide decks, Paper 1/2 practice and mark guidance, IA checkpoints, original mocks and daily teacher briefings. Official exam dates and local reporting codes must be verified before final scheduling/export. Keep these tasks visible; do not label generated planning rows as ready-to-teach packages.

## New workbook and PowerTeacher references

The teacher supplied the shared ChatGPT conversation `https://chatgpt.com/share/6ab46105-d168-83ea-9a8f-03c60bf6dbf8` and `/Users/cdawg/Downloads/PowerTeacher_Pro_CSV_Workflow (1).docx`. Both were read. The workbook handoff now explicitly preserves Learning Studio v2, Drop Day/Fresh Impact teaching quality, Truck architecture, the same-workbook support view, and IBDS's separate reasoning structure. Historical prompts in those sources are reference material, not new execution authority.

PowerSchool's official documentation confirms an existing-assignment Score Template route. That differs from exporting course-level outcome judgments; direct standards/comment CSV import remains unverified. The Word guide contains no actual template. Its Percent/Points example does not override the teacher's confirmed standards grading. The app export label, reporting handoff, AI Studio prompt and interface metadata now reflect that distinction. The next required input is an exported Score Template (anonymized is sufficient for structure), including metadata rows and the actual score-type/grade-scale settings. No PowerSchool grades were changed.

Details: `outputs/connected-system-handoff-2026-09-23/SOURCE_RECONCILIATION.md`.

Reference reconciliation published in production deploy `6ab47362d6ba04bf4211efc3`. The live handoff was verified in the browser. JavaScript syntax, local page links, contract metadata and the refreshed handoff bundle passed checks.

## iPad O/C/P build prompt

The teacher requested a Google AI Studio prompt for capturing Observation, Conversation and Product evidence into the connected system. `outputs/connected-system-handoff-2026-09-23/GOOGLE_AI_STUDIO_PROMPT.md` now covers all three methods, HTTPS product references, approved rubric downloads, names instead of technical codes, same-site deployment and durable offline receipts. `AI_STUDIO_CONNECTION_REFERENCE.md` packages the actual implemented contract and relevant source, without credentials or roster records.

The source review confirmed a specific unfinished connection: the Google job currently mirrors confirmed judgments, not individual field captures. The prompt requires an additive, Google-authenticated `field-events` read operation and a separate **Field Evidence** mirror within the existing timer job. The contract marks this explicitly as a proposed extension. No backend, bound Apps Script or AI Studio app was changed by this prompt-only update; the new extension has not been deployed. The revised local files supersede the older AI Studio prompt in the existing public deployment until a later release publishes them.

## Field-app Sheet preparation and expanded build requirements

The teacher requested class/roster selection, downloadable existing rubrics, a new-rubric option, completed rubrics sent back to the shared system, dictation, voice notes and Gemini help with statements/comments. The existing **Technology Evidence System** spreadsheet was reused, not duplicated. Three tabs were added: **Field App Setup** (1275286835), **Field Evidence** (56321294; prepared 29-column destination), and **Rubric Library** (905800740; 9 catalogue drafts / 27 criterion rows). The roster, existing data, Forms, scripts and sharing settings were preserved. No student evidence or grades were added. Connector readback verified all new headers, counts and draft statuses; native Google Sheets views of all three new tabs were inspected and rubric widths adjusted.

### Subsequent AI Studio source review — 23 September, evening

The pasted completion report was followed by a newer AI Studio build implementing voice/rubric/AI screens. Its finished source was downloaded and retained at `private/field-app-review-2026-09-23/source` (archive SHA-256 `2549cb5e6cfa9520158d3c2a497618da907285c7059d0615a21732d6dc10f91d`). It was **not merged or deployed**. Current connection tests still pass 24/24; the export's supplied tests pass 18/18, but eight added probes fail. Browser testing also reproduced unsaved note carryover between fictional learners; the text was cleared and nothing submitted.

Blockers include no snapshot call sites, fictional live-roster and auto-approved rubric fallback, invented AI success wording, missing AI/media services, dropped extension fields in the client payload, historical revision-hash incompatibility, mutable published rubrics, the wrong Google header schema and broken second-page cursor requests, and incomplete `/field/`/offline deployment. The latest AI Studio message's public Apps Script web-app instruction contradicts the established timer architecture and should not be followed.

The review, reproducible results and correction prompt are in `outputs/field-app-review-2026-09-23/`; `AI_STUDIO_CORRECTION_PACKET.zip` is the next AI Studio handoff. No production application, script, roster, grade, Google sharing setting or API key was changed during the review. The earlier preparation does not constitute completion of these features.

`GOOGLE_SHEET_FIELD_SETUP.json` records the exact schema. `GOOGLE_AI_STUDIO_PROMPT.md` and `INTERFACE_CONTRACT.json` now explicitly require the missing dynamic rubric draft/publish workflow, completed-assessment grouping, protected media, reviewed transcripts and Gemini draft assistance. They distinguish these future extensions from implemented API actions. `tools/build_field_app_handoff.py` rebuilds the reference and the two-file **AI_STUDIO_FIELD_APP_v2.zip** without credentials or roster rows.

This prepares the Google Sheet and the AI Studio build handoff. It does not deploy the iPad app, raw field mirror, new-rubric authoring, voice storage, transcription or Gemini adapter. No Gemini key was configured or model call made. The Sheet is still shared with anyone who has its link; the prompt requires an owner decision about access before enabling new student-note/transcript mirroring. The existing public handoff remains the earlier deployment; use the latest local v2 packet supplied in this conversation.

## Visual dashboard restoration — 24 September 2026

The main connected UI was rebuilt with the original navy/blue/teal visual language. It now provides course overview cards, O/C/P evidence charts, teacher-confirmed achievement distribution, searchable student cards, outcome tiles, exact-version rubric downloads, the existing sprint/daily sequence and a reporting review register. It reuses the existing authenticated service and does not introduce a new database or grade calculation. The old local planner remains accessible through a dedicated published alias, /planning-tools.html. MM12's truncated display labels were replaced with readable planning titles; official codes, IDs and historical mappings are unchanged.

Eight new dashboard aggregation/export checks and the existing 24 connection/Google checks pass. The deployed preview's 13 service checks passed. Browser tests verified draft isolation by course/student/outcome, an explicit fictional judgment, approved rubric download, confirmed-only CSV download, an empty IBDS roster, sign-out clearing, and desktop/iPad/phone layouts. The final 390px overview and student view have no page overflow. No production grades or rubric approvals were created by the tests. Detailed evidence and remaining work: outputs/connected-system-handoff-2026-09-23/DASHBOARD_RESTORE_QA.md.

The teacher has sent the correction prompt to AI Studio. Its next export is still pending; the iPad app is not deployed. PowerSchool still needs the actual exported template and local standards/grade-scale mapping. The 34 sprint / 332 dated-lesson plan remains a plan, with the unfinished teaching-material production described above.

Visual dashboard published to production deploy `6ab5a63f471a768b09d0c717`. Previous production deploy `6ab47362d6ba04bf4211efc3` is the rollback point. The production root was verified in Chrome. Authenticated before/after checks matched all course roster, event, judgment and approved-rubric counts; no preview fixtures were present in production.

## Roster visibility diagnosis — 24 September 2026

The teacher reported that a successful connection test did not show Google roster students in Netlify. Read-only checks confirmed Roster!C2:E151 contains 18 active MM12 and 32 active COM11 memberships, all with learner IDs, and no IBDS rows. The production snapshot contains the same 18/32/0 course memberships. No roster or sync repair was needed.

The older browser tab at the site root still held the pre-update local Course Studio and its demonstration-roster notice. A separate connected dashboard tab was awaiting teacher sign-in, so its student list was intentionally not loaded. The older tab was navigated to /connected.html and the current sign-in page was verified. Real student names require the existing teacher session. No credentials were changed and no student or grade records were edited.

## Current integration status — 24 September 2026, evening

This section supersedes earlier “not deployed” status entries above; they remain as the implementation history.

- The latest AI Studio AssessTrack source was downloaded, repaired and integrated as `field-app/` in this repository. Its original export is backed up privately; the live AI Studio development project was not edited. The production iPad companion is **https://outcome-evidence-map.netlify.app/field/**. Evidence Map remains the main visual teacher dashboard.
- Codex created the teacher key during connection setup and should have explained it. The single line in `private/connected-teacher-access.txt` is the production Teacher access key. It is never included in public output. Both live apps share the same four-hour protected teacher session.
- Production app/service deployment: `6ab5b4b50e9309325c83babd`. Previous production `6ab5a63f471a768b09d0c717` is the rollback point. Browser verification of the live companion displayed the 18 existing MM12 memberships through the shared session. Before/after API aggregates remained MM12 18 roster / 12 events / 0 judgments / 0 approved rubrics; COM11 32 / 0 / 0 / 0; IBDS 0 / 0 / 0 / 0.
- The existing Apps Script project was freshly backed up. Automatic review rejected a forced upload because remote edits might be overwritten. A second fresh pull proved no remote changes, no deleted files and an unchanged manifest; a normal `clasp push` then succeeded at **20:41:52 Atlantic**. Only ConnectedEvidence.js changed intentionally. No trigger was installed or removed.
- The existing scheduled job succeeded at **20:46:13 Atlantic** with “50 roster memberships; 0 judgments; 0 field captures mirrored.” It now mirrors raw captures, acknowledges exact written revisions, and mirrors approved rubric versions using the prepared tabs. The live job had no field data; this run does not establish a real student capture round trip.
- The Sheet's Field App Setup status cells C3:D13 were updated and its native view inspected. Existing names, roster authority, student evidence, grades, styles and sharing were preserved. Owner-only sharing was verified; it was not changed by this release.
- Isolated preview browser verification: one sign-in across both apps; a fictional O+C note reaches the correct learner/outcomes; Secure suggestion and Guided support remain separate and produce no grade; draft isolation by student/criterion; genuinely empty IBDS; sign-out clears private views; adapting and publishing the actual Truck rubric preserves its PS/GD skills. Approved rubric selection and a 768px iPad-size view were checked. The temporary viewport override was reset.
- 48 automated checks pass across dashboard, service, Google integration and field contract. Type checking and production build pass. Tests exercise the actual Google source for header reordering, extra columns, formula-like text, duplicate/revised events, conflicts, pagination and acknowledgments. Existing event revision hashes remain unchanged. No production grades, rubric approvals or preview student fixtures were created.
- Historical AI Studio build briefs are now labelled as historical. The current API contract, setup metadata, source handoff and FIELD_CONNECTION_STATUS.md record deployed capabilities and remaining limits. Learning Studio Workbook Standard v2, the ChatGPT workbook prompt, coaching-Gem prompt and 34-sprint plan are retained.

Still required: teacher review/approval of a rubric before live capture; IBDS roster entries; physical iPad Safari installation/offline/reconnect/audio checks; Gemini server key/model configuration; protected cross-device audio backup; the actual PowerTeacher template and local standards/scale/ID mapping; and the remaining ready-to-teach course packages. The 34 sprints / 332 dated entries remain a plan. The live GitHub workbook source and coaching Gem were not rewritten. Audio currently stays on the capturing device. API adapters exist but AI is not configured.

Final current-contract/documentation publication: `6ab5b7bcf4c677b383f3c93f`. Live `/field/` and current contract were fetched successfully after deployment; the app/backend are unchanged from the tested release.

## Assignment workflow restoration — 24 September 2026

The teacher clarified the intended package workflow from course plan through workbook/coach/Forms/rubric, classroom capture, student review and PowerSchool. Source inspection confirmed a regression: the older local assignment catalogue and brief controls were absent from the connected visual dashboard. A new Assignments & workbooks view restores that path using the current 34 sprint bundles, without replacing the dashboard, changing course dates or importing the older 111-assessment plan over the newer one.

Every bundle now supplies a course-specific copy/download workbook prompt with its linked lessons, outcomes, skills, evidence opportunities and known rubric versions. Explicit project links join the existing records by course and project, never by similar title. Task rubric cards show collection guidance and skills. Evidence notes and teacher-confirmed reporting comments have exact-text copy controls. New metadata lives in teaching/assignment-links.json and is included by the existing catalogue build. No student database, Forms, Google trigger or reporting grade was added or changed.

The Google Projects and Form Registry tabs identified the existing Truck source in ctwadden/classroom-tools, branch technology-learning-system-v3. Its student Form and original O/C/P rubric/source links are now registered. The original six Form checkpoints are retained in the workbook brief. The original checkpoint/rubric/skill mapping and the newer three-criterion rubric still need explicit reconciliation; full package import/publish and per-student criterion/skill judgments remain unfinished. SYSTEM_WORKFLOW.md records the preserved vision, verified gaps, source commit and ordered acceptance work. The actual published Drop Day step 1 placeholder is recorded for a later workbook repair.

54 automated tests passed, including all 48 prior connection checks and six new assignment contract checks. Browser preview confirmed the 9/9/16 course lists, Truck lesson/rubric joins, the existing fictional capture, exact workbook prompt copying and exact reporting-comment copying. At 390px the assignment view had no horizontal page overflow. Final release verification is recorded below.

Final candidate `6ab5bd1c3f833a72258b3966` also verified the registered original Truck student Form/rubric links, exact fictional evidence-note copying and sign-out removing the new assignment view’s private capture nodes. The temporary mobile viewport was reset. Production rollback point before this update: `6ab5b7bcf4c677b383f3c93f`.

Published and fetched live: production `6ab5bd92c9e9532a5e9d8292`. The assignment view, original six Truck checkpoint references, registered student Form and copy controls were present. No Google source or student grades were changed in this update.


## 25 September 2026 — existing Bootcamp tutorials restored to the dashboard

The Assignments & workbooks page previously registered only Drop Day, although Below the Surface and On the Cover already existed as saved student guides. This release restores those exact HTML/PDF files through an explicit four-file public allowlist and lists the three core tutorials in classes 1–9 order for MM12 and COM11. The published Photoshop Foundations lesson is linked as optional prerequisite/support work. Recovered teacher ZIPs remain private.

A Bootcamp shortcut and a validated course-specific sprint URL now open the correct bundle instead of defaulting to the current calendar sprint. Existing tutorial URLs are retained in the workbook-maker prompt. Resources without registered assessment projects remain resources; no new project IDs, rubric approvals, student evidence or grades were fabricated.

Preview: `6ab6e82acfc66604e8148654`. Build and all 14 dashboard/core tests passed. Browser checks verified MM12 and COM11 navigation, ordered resource links, retained source links in the workbook prompt, and the restored tutorial pages. Below the Surface loaded all 25 embedded images and exposes both source downloads; On the Cover renders its existing lazy-loaded illustrations, portrait and supplied-copy downloads, and step navigation. Source files in the build are byte-identical to the recovered copies.

This restores access to existing instruction. It does not complete the missing shared rubric, Form/coach registrations or the separate class-10 practical package.

Production deploy `6ab6e92c53fa98a5e33521a6` is live. The MM12 Bootcamp page was verified in the browser; all four restored HTML/PDF URLs returned HTTP 200 and their bodies matched the original files byte-for-byte. The prior production rollback point is `6ab5bd92c9e9532a5e9d8292`. Detailed checks are in `private/bootcamp-verification-2026-09-25.json`.
