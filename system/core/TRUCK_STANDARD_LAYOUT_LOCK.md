# TRUCK_STANDARD_LAYOUT_LOCK.md
Version: 1.0
Status: CANONICAL

## Required workbook order

1. Project hero / title / status
2. Industry Connection
3. Design Lens / principles
4. Course configuration + outcome codes
5. Prerequisite and target skill IDs
6. Video Companion slot
7. Assets / source provenance
8. Core workbook steps
9. Observation / Conversation / Product evidence markers
10. Knowledge + Reflection assessment launch
11. QA / critique / revision
12. Export / submission
13. Sources / version / verification notes

## Step contract

Every CORE step uses BOTH identifiers:

- HTML anchor: `#step-N` where `N` is 1-based with no leading zero.
- Canonical project step ID: `<PROJECT_PREFIX>-SNN` with a two-digit suffix.

Example:

```html
<section id="step-4"
         data-project-step-id="TA-S04"
         data-step-number="4"
         data-video-chapter-id="VID-TA-S04">
```

Legacy anchors such as `#step-04` may remain as hidden aliases for backwards compatibility, but `#step-4` is canonical.

Optional extension steps are not in the core Scribe chapter contract unless a project explicitly adds them to `Step_Map.csv`.

## Video placement

Use ONE YouTube player + ONE chapter list near the top of the workbook.

Do not embed a separate iframe for every step.

Each chapter:
1. seeks the shared YouTube player to the chapter's `actual_start`, and
2. scrolls the workbook to the matching `[data-project-step-id]` / `#step-N`.

A step may also show a lightweight **Watch this step** button that calls the same jump function.

## Assessment placement

The official saved assessment is the Google project assessment launched through the Technology Evidence System.

In-workbook questions may exist only as low-stakes practice/checks. They do not create authoritative evidence records and do not replace the Google assessment.

## Status rule

`Release Candidate` means the package is system-aligned but has not passed the installed-school-software preflight.

`VERIFIED` is reserved for projects that pass the full Truck Standard QA gate, including software preflight.