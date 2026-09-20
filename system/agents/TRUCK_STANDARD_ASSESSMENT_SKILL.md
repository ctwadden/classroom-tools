# TRUCK STANDARD ASSESSMENT SKILL

## Purpose
Generate one assessment pack from the canonical project manifest, skills, outcomes, evidence plan, rubrics and approved manuscript. Do not create a second curriculum.

## Mandatory model
**KNOW → DO → EXPLAIN → APPLY → REFLECT → TRANSFER**

- **KNOW:** 6–10 auto-markable questions; default 8. Supporting formative knowledge only.
- **DO:** existing Observation evidence.
- **EXPLAIN:** existing Conversation / defence evidence.
- **APPLY:** existing Product evidence.
- **REFLECT:** bounded student skills-used reflection.
- **TRANSFER:** possible Level 4 evidence only after teacher verification.

## Knowledge Check
Each question must have a canonical ID (`<PROJECT>-KC-##`), answer, rationale, skill IDs, outcome IDs when relevant, and project-step reference.
- max 30% vocabulary/recognition
- at least 40% reasoning/application/diagnosis
- at least one design/audience item for applied projects
- at least one troubleshooting item
- do not count the quiz score as software competency

## Skills-Used Reflection
Do not ask students to invent skill names or choose from the entire registry. Build the chooser from the project manifest.

Students select:
1. one technical skill that mattered most
2. one design/communication skill that mattered most
3. one skill they still want to improve

For the first two ask: Where did you use it? Why was it appropriate? What visible evidence shows it? How independently did you use it?

Self-report options:
- Followed the example closely
- Needed some prompts/checkpoints
- Worked independently
- Adapted or extended the skill

Never auto-convert self-report into the teacher 1–4 judgement.

## Defence / Reflection
Create 5–8 defence questions; teacher normally selects 2–3 based on evidence gaps. Include explanation, reasoning, audience/design, troubleshooting/revision and transfer.

Required reflection stays short:
- skills used and why
- one revision/problem
- one transfer possibility

## Outputs
- `assessment-pack.json`
- `knowledge-check.csv`
- `student-skill-reflection.md`
- `teacher-key.md`
- `video-checkpoints.json`

Preserve all canonical project, skill, outcome and evidence IDs so HTML/PDF, Scribe It, Evidence Map and PowerSchool stay synchronized.

## Anti-drift rules
- no invented skills or outcomes
- no quiz score = competency
- no student self-rating = teacher judgement
- no duplicate product rubric
- no reflection on skills the project does not use
