# Drop Day Phase 2 — Completion Runbook

## Current state found in the uploaded Technology Evidence System

Drop Day is already substantially generated.

### Projects
`PS-DROP-DAY` exists, but status is `ERROR - see Automation Log`.

### Active forms
Student and Teacher forms both exist and are active in Form Registry.

### Form mappings
Drop Day has:
- 8 Knowledge items
- technical reflection
- design reflection
- growth target
- transfer candidate
- teacher metadata fields

### Root blocker
Automation Log:
`This script has too many triggers. Triggers must be deleted from the script before more can be added.`

### Existing Evidence Map backbone
The workbook also shows a functioning `Evidence Map Sync` tab with prior events in `ok` state. This means we should preserve the existing Evidence Map sync hook rather than replace it.

## Definition of Phase 2 complete

Phase 2 is complete when:

- one scalable spreadsheet form-submit trigger is installed;
- old per-form triggers are gone;
- Drop Day Projects row says Forms current;
- Drop Day student and teacher forms submit to Evidence_Log;
- Knowledge stays Knowledge;
- O/C/P remain teacher evidence;
- transfer remains pending teacher verification;
- support stays separate from achievement;
- Drop Day events land in Evidence Map Sync with `ok`;
- live Evidence Map can read those events.

## Files

- `Phase2EvidenceRouter.gs`
- `PHASE2_PATCH_INSTRUCTIONS.md`

The Apps Script file is designed to be added to the existing bound project without replacing the working `TechnologyEvidenceMapSync.gs`.