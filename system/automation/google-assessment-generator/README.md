# Truck Standard Google Assessment Generator

This is the save/collection bridge for static GitHub tutorials.

## Automated flow

`GitHub project manifest -> Assessment Skill -> forms-spec.json -> project-spec-registry.json -> Apps Script -> Student Quiz + Teacher Evidence Form -> Evidence_Log -> Outcome Evidence Map -> PowerSchool`

Install the Apps Script **once**. Each approved tutorial then contributes a self-contained `forms-spec.json`; the central Google Sheet syncs the GitHub registry and generates/versions the two forms automatically.

## One-time setup
1. Create a Google Sheet named **Technology Evidence System**.
2. Extensions -> Apps Script.
3. Paste `Code.gs` and save.
4. Run `setupTechnologyEvidenceSystem()` once and approve permissions.
5. Set `SPEC_REGISTRY_URL` in Config to the raw GitHub URL of `system/automation/project-spec-registry.json`.
6. Load the Roster sheet.
7. Use the **Truck Standard** menu: **Sync specs from GitHub -> Generate pending forms**.
8. Deploy the script once as a **Web app**. The permanent project link pattern is:
   - `<WEB_APP_URL>?project=PS-TRUCK-AD&type=student`
   - `<WEB_APP_URL>?project=PS-TRUCK-AD&type=teacher`

The launcher redirects to the currently active form, so a tutorial link does not have to change when a form is regenerated.

Each project creates:
- Student Knowledge + Reflection quiz
- Teacher Evidence Capture form
- normal Form response tabs
- normalized append-only `Evidence_Log`

Knowledge scores and student self-ratings never auto-confirm competency. Outcome Evidence Map remains the teacher-judgement layer.