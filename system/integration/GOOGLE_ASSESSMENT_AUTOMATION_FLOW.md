# Google Assessment Automation Flow

**GitHub teaches. Google Forms saves. Google Sheets normalizes. Outcome Evidence Map judges. PowerSchool reports.**

## Automated project flow
1. Truck Standard Production Agent approves the manuscript, skills, outcomes and evidence IDs.
2. Truck Standard Assessment Skill generates a self-contained `assessment/forms-spec.json`.
3. The project is added to `system/automation/project-spec-registry.json`.
4. The central **Technology Evidence System** Google Sheet runs **Sync specs from GitHub**.
5. Changed/new specs are marked for form generation; unchanged specs stay current.
6. **Generate pending forms** creates a Student Knowledge + Reflection quiz and Teacher Evidence Capture form.
7. Form-submit triggers append normalized records to `Evidence_Log`.
8. Outcome Evidence Map imports/reads the log. Teacher-confirmed evidence remains authoritative.
9. PowerSchool receives the intended assignment grade/feedback rather than every internal checkpoint.

## Stable tutorial links
Deploy the Apps Script once as a Web app. A tutorial can link by project ID:

`<WEB_APP_URL>?project=PS-TRUCK-AD&type=student`

`<WEB_APP_URL>?project=PS-ZEBRA-IRONING&type=student`

`<WEB_APP_URL>?project=PS-CEREAL-BOX&type=student`

The launcher looks up the currently active form in **Form Registry** and redirects. Regenerating a Google Form therefore does not require replacing the project-specific link.

## One unavoidable one-time setup
The teacher/admin must authorize the Apps Script and deploy its Web app under the school Google Workspace account. After that, project assessment generation is registry/spec driven.