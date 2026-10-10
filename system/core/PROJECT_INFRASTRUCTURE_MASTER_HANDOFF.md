# Learning Studio — Project Infrastructure Master Handoff
Version: 1.0
Date: 2026-09-22
Status: CANONICAL CONTINUITY DOCUMENT

This file exists so new chats/agents continue the current system instead of rebuilding it.

## Start here
Before changing architecture, read:
- this file
- `system/integration/GITHUB_PUBLISHING_CONTRACT.md`
- `system/integration/GOOGLE_FORM_CONTRACT.md`
- the active project's manifest / Step Map / forms spec
- the relevant domain profile

## North star
```text
COURSE / WORKBOOK
      ↓
TEACH + PRACTICE
      ↓
KNOW / DO / EXPLAIN / APPLY / REFLECT / TRANSFER
      ↓
GOOGLE FORMS / TEACHER CAPTURE / ASSISTANT COACH
      ↓
TECHNOLOGY EVIDENCE SYSTEM
      ↓
NORMALIZE / AUDIT / RETRY
      ↓
OUTCOME EVIDENCE MAP
      ↓
TEACHER JUDGEMENT
      ↓
POWERSCHOOL / REPORTING
```

Core principles:
- **Reduce friction, not thinking.**
- Guided completion is practice.
- Transfer, explanation, repair and independent application are stronger evidence.
- One teacher-facing student-learning record: Outcome Evidence Map.
- Technology Evidence System remains the intake/automation/audit layer.

## System responsibilities

### Workbooks / course pages
Teach. Own sequence, content, assets, project steps, skills, outcomes, evidence opportunities, Coach context, assessment/video launch hooks.

### Technology Evidence System
Collect / automate / normalize / audit / recover. Generates one Student Form + one Teacher Evidence Form per project, stores raw responses and Evidence_Log, then syncs to Evidence Map.

### Outcome Evidence Map
Teacher-facing student-learning system. Lenses: Overview, Outcomes/Skills, Evidence, Knowledge, Transfer/Reflection, Support.

### Assistant Coach
Support only. Canonical Gem:
https://gemini.google.com/gem/1ySXJPfNy0hCfESu8EzsD3vuexPiuKQKo?usp=sharing

One Gem; support bands:
- Guided
- Supported
- Independent
- Transfer

Achievement bands remain:
- Beginning
- Developing
- Secure
- Extending
- IE

### Scribe It
Video is a second route through canonical workbook steps. Scribe may add timestamps/frames, but may not reorder curriculum.

## Repositories

Control plane:
- repo: `ctwadden/classroom-tools`
- branch: `technology-learning-system-v3`

Delivery:
- MM12: `ctwadden/multimedia-12` main
- COM11: `ctwadden/communication-technology-11` main

## ID rules
Preserve course/module/project/step/skill/outcome/evidence/question IDs.

Technology step pattern:
`^[A-Z]{2}-S[0-9]+$`

Workbook technique/design skills remain:
- PS-*
- GD-*
- BL-*
- GEN-*

Evidence Map course competencies remain ct-*/mm-*/ds-*.
Use SKILL_CROSSWALK. Do not hard-rename workbook skill IDs.

## Assessment
Universal chain:
**KNOW → DO → EXPLAIN → APPLY → REFLECT → TRANSFER**

Knowledge is supporting evidence and is NOT Product evidence.
Official achievement methods:
- Observation
- Conversation
- Product

Transfer candidate requires teacher verification.
Support never changes achievement automatically.

## Google Form contract
One project = one active form set:
- Student Knowledge + Reflection
- Teacher Evidence Capture

Stable launcher:
https://script.google.com/a/macros/gnspes.ca/s/AKfycbxqHbAwEwbvdMrOGY4eP4Yu-z8PXqMsA-MfMGBFoTA5CoDbOA4sUv1LsXbYfFMWmrcP/exec

## Workbook standard
Substantial workbooks should support:
1. Authentic Context
2. Brief / Essential Question
3. Outcomes
4. Skills / Concepts
5. Prerequisites / Builds On
6. Learning Pathway
7. Exact Instruction
8. WHY / CHECK / FIX or domain equivalent
9. Knowledge
10. Evidence opportunities
11. Reflection
12. Independent Transfer
13. Defence / Explanation
14. Assistant Coach boundaries
15. Video / delivery metadata
16. QA / status

Photoshop-specific standard:
**Drop Day / Fresh Impact instructional quality + Truck Ad system architecture**

## Photoshop route — authoritative
Shared Bootcamp:
1. Below the Surface
2. Drop Day
3. On the Cover
4. The Brief Has Changed

Then:
- Design Studio Explorer
- course-specific guided/advanced work
- capstone

MM12 advanced:
1. Built for the Wild / Truck Ad
2. Fresh Impact
3. Last Light REDO v2 Fixed
4. future Material / Surface
5. future Advanced Typography
6. Creative Campaign capstone

Candidate/extension only:
- Zebra Ironing
- Cereal Box
- Turtle Kingdom
- Stormbound
- Lemon Burst
- Skybound

IMPORTANT: `system/semester/SEMESTER_PROJECT_ALIGNMENT.md` reflects an older planning state and is not authoritative for the current Photoshop Studio sequence. Rewrite it later; do not use it to revert the course.

## Digital Society
Separate domain profile. Do not force Photoshop layout.

Reasoning spine:
**Technology → How It Works → Real Case + Evidence → Stakeholders → 3Cs → Impact → Implication → Counter-Perspective → Trade-Off → Qualified Judgement**

## Drop Day current state
Project: `PS-DROP-DAY`
Steps: `DD-S01`–`DD-S24`

Control metadata:
`system/projects/photoshop/drop-day/`

Live workbook:
https://ctwadden.github.io/multimedia-12/photoshop/studio/drop-day/

MM12:
https://ctwadden.github.io/multimedia-12/photoshop/studio/drop-day/?course=MM12

COM11:
https://ctwadden.github.io/multimedia-12/photoshop/studio/drop-day/?course=COM11

Catalog:
- visible=true
- status=published_unverified

Do not mark VERIFIED until local Photoshop/classroom + Forms/Evidence/Scribe tests pass.

## Next workbook
Fresh Impact is next.

Conversion queue:
1. Drop Day — Phase 1 + Phase 2 live/unverified
2. Fresh Impact — full conversion next
3. Below the Surface
4. On the Cover
5. Make It Matter + The Brief Has Changed
6. Last Light REDO v2 Fixed
7. Truck Ad reconciliation

## Do-not-regress
Do not:
1. replace Technology Evidence System;
2. create another teacher-facing evidence dashboard;
3. treat MC as Product;
4. merge support with achievement;
5. create multiple Coach Gems;
6. rename PS/GD/BL to Evidence Map IDs;
7. let Scribe invent another step order;
8. duplicate shared workbooks across course repos;
9. treat completion as mastery;
10. award Extending for decoration;
11. use Supported as an academic band;
12. invent placeholder IDs when canonical IDs exist;
13. publish watermarked/unclear-rights assets;
14. claim VERIFIED without testing;
15. revert to the old seven-project Photoshop sequence;
16. build a quick-workbook format that drifts from Truck/Drop Day quality;
17. turn Teacher Mastermind into a second gradebook;
18. expose student PII/grades to Coach or public GitHub.

## Immediate priority
**Fabricate Fresh Impact. Stop infrastructure churn unless a real blocker is proven.**
