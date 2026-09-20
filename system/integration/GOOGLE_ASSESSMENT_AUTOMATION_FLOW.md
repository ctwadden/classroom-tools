# Google Assessment Automation Flow

GitHub teaches. Google Forms saves. The Technology Evidence System spreadsheet normalizes. Outcome Evidence Map judges. PowerSchool reports.

Per project:
1. Production Agent approves manuscript/evidence IDs.
2. Assessment Skill generates self-contained `assessment/forms-spec.json`.
3. Copy/upload that JSON to the configured Drive specs folder.
4. In the Technology Evidence System spreadsheet choose **Truck Standard -> Sync assessment specs**.
5. Choose **Generate pending forms**.
6. Apps Script creates the Student Quiz + Reflection form and Teacher Evidence Capture form.
7. Form-submit triggers append normalized records to `Evidence_Log`.
8. Evidence Map imports/reads the log. Teacher-confirmed evidence remains authoritative.
9. PowerSchool gets the intended assignment grade/feedback rather than every internal checkpoint.