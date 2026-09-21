# GITHUB_PUBLISHING_CONTRACT.md
Version: 1.0
Status: CANONICAL

## Current real repositories

### 1. Control plane / canonical Truck Standard metadata
Repository:
`ctwadden/classroom-tools`

Working branch:
`technology-learning-system-v3`

Canonical paths:
- `system/core/`
- `system/domains/`
- `system/projects/<domain>/<project>/`
- `system/automation/`
- `system/integration/`
- `system/semester/`

This repo/branch owns project IDs, skill IDs, evidence IDs, project manifests, Step Maps, assessment specs and video manifests.

### 2. Current Scribe It workbook build + GitHub Pages delivery
Repository:
`ctwadden/multimedia-12`

Branch:
`main`

Workflow:
`.github/workflows/build-workbook.yml`

Factory:
- `factory/tools/make-workbook.mjs`
- `factory/tools/make-lab.mjs`
- `factory/tools/make-embed.mjs`
- `factory/tools/make-pdf.mjs`
- `factory/tools/publish-github.mjs`
- `factory/tools/lib/*`

Current workflow publishes to the user-supplied `dest_path`.
The existing default is `photoshop/composite-realism/index.html`.

Therefore the ACTUAL current publisher is NOT `/tools/<course>/<project>/` in classroom-tools.

## Current mismatch that Scribe It must repair

The current `build-workbook.yml` takes:
- Drive recording ID
- YouTube URL/ID
- lab ID
- course
- dest_path

and `make-workbook.mjs` analyzes the recording into its own generated lesson steps.

That behavior is NOT the canonical Truck/Scribe contract for the seven aligned projects.

For aligned projects, Scribe It must instead:
1. load canonical `Step_Map.csv`;
2. load canonical `video-manifest.json`;
3. use recording analysis only to determine/confirm timestamps and screenshots;
4. write timestamps back against the existing `project_step_id` records;
5. render the canonical workbook steps, not replace them.

## Rebuild trigger — current actual state

Current `build-workbook.yml` trigger:
- `workflow_dispatch` only.

It does NOT currently rebuild when `video-manifest.json` changes.

## Required v1 aligned handoff

Until cross-repo automation is added:

1. Scribe It fills `video_url` / `youtube_video_id` / `actual_start` / `actual_end`.
2. Commit updated `video-manifest.json` to the canonical classroom-tools branch.
3. Manually dispatch the multimedia-12 workbook build.
4. Build reads the canonical Step Map + video manifest.
5. Publish HTML to chosen `dest_path`.

Future improvement:
- `repository_dispatch` from classroom-tools to multimedia-12 when a video manifest changes.

## Canonical workbook HTML

The current Truck Standard workbook HTML files are large standalone artifacts with embedded images and are handed off as build artifacts/packages. They are not all committed to classroom-tools today.

The canonical synchronization surface in GitHub is:
- project manifest
- Step Map
- video manifest
- forms spec
- skill registries
- layout/video contracts

The delivery repo may render/publish the workbook HTML from those sources.