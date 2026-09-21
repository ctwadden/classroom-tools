# VIDEO_WORKBOOK_CONTRACT.md
Version: truck-video.1
Status: CANONICAL
Owner: Truck Standard tutorial system
Consumer: Scribe It

## Purpose
Scribe It adds a recorded YouTube demonstration as a SECOND way to follow the SAME canonical workbook steps. It must not generate a parallel step sequence.

## Canonical files per project

- `workbook.html`
- `Step_Map.csv`
- `project-manifest.yml`
- `video-manifest.json`
- `forms-spec.json`

## HTML step target

Each core step MUST expose:

```html
id="step-N"
data-project-step-id="XX-SNN"
data-step-number="N"
data-video-chapter-id="VID-XX-SNN"
```

Canonical anchor format: `#step-1 .. #step-N` (no zero padding).

Canonical project step ID format: project-specific prefix + `-SNN`.

## Video UI

Required:
- one YouTube player near the top of the workbook
- one ordered chapter list near that player
- optional lightweight `Watch this step` button inside each workbook step

Not allowed:
- separate video iframe per step
- video-generated replacement steps
- Scribe-only skill/outcome/evidence IDs

## Chapter click behavior

`jumpToChapter(projectStepId)` MUST:

1. locate the chapter in the inlined manifest by `project_step_id`;
2. if `actual_start` is not null, seek the shared YouTube player to that second and start playback;
3. locate `[data-project-step-id="<ID>"]`;
4. call `scrollIntoView({behavior:"smooth", block:"start"})`;
5. update location hash to the chapter's `anchor`, e.g. `#step-4`.

If `actual_start` is null, still scroll to the workbook step; do not invent a timestamp.

## video-manifest.json fields

Top level:

```json
{
  "schema_version": "truck-video.1",
  "project_id": "PS-TRUCK-AD",
  "video_title": "...",
  "version": "1.0.0",
  "provider": "YouTube / Scribe It",
  "status": "awaiting_recording | ready",
  "video_url": null,
  "youtube_video_id": null,
  "chapters": []
}
```

Each chapter:

```json
{
  "chapter_id": "VID-TA-S04",
  "project_step_id": "TA-S04",
  "anchor": "step-4",
  "title": "Protect the truck detail with the Smart Filter mask",
  "planned_start": null,
  "actual_start": null,
  "actual_end": null,
  "skill_ids": ["PS-FLT-01", "PS-LAY-01"],
  "design_skill_ids": [],
  "evidence_ids": ["TA-OBS-01"],
  "refresher_links": []
}
```

`actual_start` / `actual_end` are numeric seconds from the beginning of the final YouTube video.

## Build-time rule

The workbook build reads `video-manifest.json` at BUILD TIME and inlines its JSON into:

```html
<script id="video-manifest" type="application/json">...</script>
```

The deployed workbook MUST NOT depend on a runtime fetch of the manifest.

Reason:
- avoids CORS/path drift
- keeps workbook and manifest version matched
- supports static GitHub Pages output

The separate `video-manifest.json` remains canonical for Scribe It and build tooling.

## What Scribe It may change

Scribe It MAY populate:
- `video_url`
- `youtube_video_id`
- chapter `actual_start`
- chapter `actual_end`
- status/version metadata

Scribe It MUST NOT change:
- `project_id`
- `project_step_id`
- anchor
- title unless the workbook title changed upstream
- skill IDs
- outcome codes
- evidence IDs

If the recording combines multiple workbook steps, keep one chapter record per canonical step. Multiple consecutive chapters may share the same start region if necessary, but no canonical step is deleted.

## Validation

Before publish:
- every `project_step_id` in the video manifest exists exactly once in `Step_Map.csv`;
- every `anchor` exists in `workbook.html`;
- every chapter title matches `Step_Map.csv`;
- `actual_start` values are nondecreasing;
- all skill/design/evidence IDs already exist upstream.