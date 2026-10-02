# Technology Evidence System — Phase 2 Patch

## Why this patch exists

The Drop Day Forms were created successfully, but the Projects row ended in an error because the Apps Script project hit the installable-trigger limit.

The old generator creates two Form submit triggers per project. That does not scale.

Phase 2 replaces those per-form triggers with one spreadsheet-level Form Submit router.

## Add this Apps Script file

Add:

`Phase2EvidenceRouter.gs`

to the existing sheet-bound Apps Script project.

Do **not** remove `TechnologyEvidenceMapSync.gs`.

## Code.gs edit 1 — achievement/support language

Use:

```javascript
LEVELS:[
  "IE - Insufficient Evidence",
  "1 - Beginning",
  "2 - Developing",
  "3 - Secure",
  "4 - Extending"
],
IND:[
  "Guided",
  "Supported",
  "Independent",
  "Transfer"
]
```

## Code.gs edit 2 — stop creating two triggers per project

Inside `buildProject_`, replace:

```javascript
ScriptApp.newTrigger("onStudentSubmit").forForm(sf).onFormSubmit().create();
ScriptApp.newTrigger("onTeacherSubmit").forForm(tf).onFormSubmit().create();
```

with:

```javascript
ensureAssessmentSpreadsheetTrigger_();
```

## Then run

`phase2CompleteDropDay`

Expected:
- Drop Day Projects status becomes `Forms current`
- one spreadsheet submit router remains
- old student/teacher Form triggers are removed
- teacher achievement choices become Beginning / Developing / Secure / Extending / IE
- support choices become Guided / Supported / Independent / Transfer
- Drop Day is ready for the four E2E submissions

## Live-test sequence

1. Knowledge
2. Observation or Conversation
3. Transfer candidate
4. Support event

Confirm each in `Evidence Map Sync` with:
- event_id
- canonical_id
- stream
- status
- error_message

Do not convert Knowledge to Product, support to achievement, or Transfer candidate directly to Extending.