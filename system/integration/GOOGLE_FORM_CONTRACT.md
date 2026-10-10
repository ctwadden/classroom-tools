# GOOGLE_FORM_CONTRACT.md
Version: 1.0
Status: CANONICAL

## Form granularity

One PROJECT generates one active FORM SET:

1. Student form: `<project_title> - Knowledge + Reflection`
2. Teacher form: `<project_title> - Teacher Evidence Capture`

Do NOT create one official Google Form per lesson or per outcome.

## Student form contents

Student form is a Google Forms Quiz and contains:
- collected signed-in email
- course/class selector when the project has multiple course configurations
- mapped MC Knowledge Check
- bounded technical-skill reflection
- bounded design-skill reflection
- growth-skill choice
- transfer prompt

## Teacher form contents

Teacher form contains:
- roster-backed Student selector
- Evidence checkpoint selector
- evidence level
- observed independence
- evidence note

Teacher submission sets `teacher_verified = TRUE`.

## Canonical mapping

Question text does NOT carry IDs visibly.

The `Form Item Map` sheet is the canonical mapping table:

- `form_id`
- `item_id`
- `project_id`
- `canonical_id`
- `evidence_type`
- `skill_ids`
- `outcome_codes`
- `step_id`
- `field_role`

Student/teacher responses are normalized to `Evidence_Log`.

## Response flow

```text
forms-spec.json
  -> Google Assessment Generator
  -> Student Form / Teacher Form
  -> raw Form Responses tabs
  -> onStudentSubmit / onTeacherSubmit
  -> Evidence_Log
  -> Outcome Evidence Map / Evidence Studio
  -> teacher judgement / feedback
  -> PowerSchool
```

## Identity

Primary join key in the private evidence system: `student_email`.

Roster resolves:
- `student_email`
- `student_name`
- `course_id`

GitHub workbook pages never store the roster or student evidence.

## Knowledge score rule

MC auto-score is supporting knowledge evidence only.

It MUST NOT automatically:
- assign a competency level
- confirm mastery
- create a PowerSchool achievement judgement

## Workbook relationship

Official saved assessment = Google project assessment.

Workbook may include low-stakes practice checks, but:
- practice results are browser-local unless explicitly submitted;
- practice is not authoritative evidence;
- official Knowledge/Reflection evidence comes from the Google form.

## Launch link

Workbook uses the stable Apps Script launcher:

```text
<ASSESSMENT_LAUNCHER_URL>?project=<PROJECT_ID>&type=student
```

Teacher capture:

```text
<ASSESSMENT_LAUNCHER_URL>?project=<PROJECT_ID>&type=teacher
```

The actual Google Form may be regenerated without changing the workbook link.