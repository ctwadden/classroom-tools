# Truck Standard Google Assessment Generator

This is the save/collection bridge for static GitHub tutorials.

## Flow
`project manifest -> Assessment Skill -> forms-spec.json -> Apps Script -> Student Quiz + Teacher Evidence Form -> Evidence_Log -> Outcome Evidence Map -> PowerSchool`

## Install once
1. Create a Google Sheet named **Technology Evidence System**.
2. Extensions -> Apps Script.
3. Paste `Code.gs` and save.
4. Run `setupTechnologyEvidenceSystem()` once and approve permissions.
5. Create a Drive folder for generated `forms-spec.json` files.
6. Put the folder ID in the spreadsheet Config sheet beside `ASSESSMENT_SPECS_FOLDER_ID`.
7. Load the Roster sheet.
8. Use the **Truck Standard** spreadsheet menu: Sync specs -> Generate pending forms.

Each project creates:
- Student Knowledge + Reflection quiz
- Teacher Evidence Capture form
- response tabs
- normalized append-only Evidence_Log

Knowledge quiz scores and student self-ratings never auto-confirm competency.