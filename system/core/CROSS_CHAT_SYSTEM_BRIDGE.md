# CROSS-CHAT SYSTEM BRIDGE
Version: 1.0
Owner: Technology Learning System

## Purpose
Chat conversations do not directly message one another or share a live scratchpad. The reliable bridge is a shared set of canonical files that every chat reads before changing the system.

This file is the cross-chat starting point.

## Canonical sources, in precedence order

1. **Technology Learning System / Truck Standard files in GitHub**
   - production rules
   - software/design skill registries
   - project manifests
   - assessment specs
   - automation registry

2. **Technology Evidence System (Google Sheet)**
   - roster
   - active projects/forms
   - normalized Evidence_Log
   - teacher-verified Observation / Conversation / Product evidence

3. **Outcome Evidence Map / Evidence Studio**
   - authoritative competency review and judgement
   - evidence history
   - feedback / next steps
   - grade/reporting handoff

4. **Student Support System**
   - learner-independence/support information
   - support pathways used
   - check-ins, barriers, attempts, next support goal
   - never treated as an achievement grade

5. **Photoshop Tutorial Library**
   - discovery and audit queue for Photoshop sources/tutorials
   - B01-B19 Basecamp skills and curated project references
   - a library entry is not automatically Truck Standard Verified

## The shared IDs

Every system should preserve the same IDs wherever possible:

- course_id
- module_id / sprint_id
- project_id
- assignment_id
- skill_id
- outcome_code
- evidence_id
- assessment_pack_id
- student_email (identity key inside private systems only)

Do not invent alternate IDs for the same object in another chat.

## Shared architecture

PROJECT / TUTORIAL
  -> canonical skills + design competencies
  -> course outcomes
  -> assessment pack
  -> Google student/teacher forms
  -> Evidence_Log
  -> Evidence Map
  -> teacher judgement / feedback
  -> PowerSchool

STUDENT SUPPORT
  -> support check-in
  -> supports attempted
  -> independence/support level
  -> next support action
  -> teacher dashboard
  -> may inform support decisions
  -> must NOT automatically lower/raise competency judgement

## Rule: Support and Achievement are separate

A student may need substantial support and still demonstrate strong course competency.
A student may work independently while producing weak course evidence.

Therefore keep two separate dimensions:

- **Competency evidence:** Observation / Conversation / Product / Knowledge / Reflection / Transfer
- **Support / independence evidence:** support requested, support used, prompts needed, barrier, successful strategy, next support goal

The dashboard may display them together, but they are never the same score.

## Student Support System bridge

The support system uses 4-3-2-1 as a **support/independence indicator, not an ability label and not automatically a grade**.

Recommended interpretation:
- 4 — independent transfer / adapts supports strategically
- 3 — independently completes expected workflow
- 2 — completes with prompts/checkpoints or selected supports
- 1 — requires guided support to begin/continue

The canonical support workflow is:

Learning Coach Check-In
  -> Support Data Record
  -> Teacher Dashboard
  -> support decision / scaffold
  -> later check for scaffold fading / independence growth

Gems/Opals may provide different support pathways, but private student conversations are not assumed to be visible to the teacher. Store only purposeful check-in/evidence fields that students or the system intentionally submit.

## Photoshop Library bridge

Use:
- `Photoshop_Tutorial_Library.xlsx`
- `Photoshop_Tutorial_Library.html`

as the discovery/audit source.

Use the Technology Learning System skills registry as the canonical competency vocabulary.

The library helps answer:
- What tutorials/sources exist?
- Which Basecamp skill can teach a prerequisite?
- Which project should be audited next?
- What is the provenance/status of a source?

It does not override:
- Truck Standard production rules
- project manifests
- current verified software workflow
- asset licensing decisions
- evidence/assessment mappings

## Cross-chat update protocol

When any chat changes the system:

1. Read this bridge.
2. Read the canonical file for the part being changed.
3. Preserve existing IDs.
4. Make the change in the canonical source.
5. Update the system index/registry.
6. Do not rely on conversation memory as the only record.

## Prompt to use in any related chat

> Use the canonical Technology Learning System cross-chat bridge before making changes. Preserve the existing course, project, skill, outcome, evidence and assessment IDs. Treat GitHub/system files as the instructional source of truth, the Technology Evidence System as the evidence transport/store, the Outcome Evidence Map as the competency judgement layer, and the Student Support System as a separate support/independence layer. Do not create a parallel database or new ID scheme. If a requested change belongs in another system, produce the bridge update rather than duplicating it.
