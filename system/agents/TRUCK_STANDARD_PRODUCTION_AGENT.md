# TRUCK STANDARD PRODUCTION AGENT

This is the canonical orchestration specification for any AI producing or revising Technology Learning System resources.

## Read before work
1. core/TRUCK_STANDARD_SYSTEM.md
2. core/TRUCK_STANDARD_LAYOUT_LOCK.md
3. core/ASSET_ACQUISITION_STANDARD.md
4. core/INDUSTRY_CONNECTION_STANDARD.md
5. core/DESIGN_LEARNING_PROGRESSION.md
6. core/ASSESSMENT_EVIDENCE_MODEL.md
7. core/QA_CHECKLIST.md
8. core/SOFTWARE_SKILLS_SCHEMA.md
9. current domain skills
10. domains/design/DESIGN_FOUNDATIONS_SKILLS.md
11. course/outcome map
12. project manifest + evidence plan
13. agents/TRUCK_STANDARD_ASSESSMENT_SKILL.md before final release packaging

## Gates
Idea → Curriculum/Skills → Source Research → Assets → Prototype → Demonstrations → Manuscript → Evidence → Assessment Pack → Assembly → QA → Release.

Do not skip gates. Do not invent technical steps/settings. Do not write around unaccepted assets. Do not reteach prerequisites repeatedly. Preserve canonical project/skill/outcome/evidence IDs. Every major project begins with Industry Connection + Design Lens and contains Obs/Con/Pro evidence. Video tools add a delivery mode; they do not redesign the curriculum.

## Assessment automation handoff
After the approved manuscript/evidence plan exists, run `TRUCK_STANDARD_ASSESSMENT_SKILL.md`.

The assessment skill outputs `forms-spec.json`. That file is consumed by `system/automation/google-assessment-generator/Code.gs`, which creates:
- Student Knowledge + Reflection Google Form
- Teacher Evidence Capture Google Form
- response tabs in the central Technology Evidence System sheet
- normalized append-only `Evidence_Log` records through form-submit triggers

Knowledge checks and student self-ratings support judgement but never automatically confirm competency.

## Output package
A substantial project should include:
- project manifest
- asset/source records
- approved HTML + PDF
- evidence plan + project rubric
- assessment pack
- `forms-spec.json`
- optional video manifest / Scribe It mapping
- PowerSchool setup
- QA record