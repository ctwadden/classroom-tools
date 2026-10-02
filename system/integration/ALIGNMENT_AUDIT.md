# ALIGNMENT_AUDIT.md

## Project status

| Project | Courses | Status | Step IDs | Canonical anchors | Layout lock | Deviation |
|---|---|---|---|---|---|---|
| PS-TRUCK-AD | MM12;COM11 | Release Candidate (NOT VERIFIED) | `TA-S01..TA-S16` | `#step-1..#step-16` | PASS | None after alignment patch |
| PS-ZEBRA-IRONING | MM12;COM11 | Release Candidate (NOT VERIFIED) | `ZI-S01..ZI-S30` | `#step-1..#step-30` | PASS | None after alignment patch |
| PS-CEREAL-BOX | MM12 | Release Candidate (NOT VERIFIED) | `CB-S01..CB-S40` | `#step-1..#step-40` | PASS | None after alignment patch |
| PS-TURTLE-KINGDOM | MM12 | Release Candidate (NOT VERIFIED) | `TK-S01..TK-S36` | `#step-1..#step-36` | PASS | None after alignment patch |
| PS-STORMBOUND | MM12 | Release Candidate (NOT VERIFIED) | `SB-S01..SB-S40` | `#step-1..#step-40` | PASS | None after alignment patch |
| BL-SKYBOUND | MM12;COM11 | Release Candidate (NOT VERIFIED) | `SK-S01..SK-S32` | `#step-1..#step-32` | PASS | Uses BLENDER_SKILLS in addition to Photoshop/Design registries |
| PS-LEMON-BURST | MM12;COM11 | Release Candidate (NOT VERIFIED) | `LB-S01..LB-S14` | `#step-1..#step-14` | PASS | None after alignment patch |

## Before this alignment patch

- Zebra, Cereal and Skybound used zero-padded HTML anchors such as `#step-01`.
- Turtle, Stormbound and Lemon had workbook anchors but no canonical Step_Map/video-manifest files.
- Only Truck Ad had a populated Step Map/video manifest.
- `TRUCK_STANDARD_LAYOUT_LOCK.md` was described in system planning but was not present in the GitHub control-plane tree.

## After this alignment patch

- Every core step exposes canonical `#step-N` and `data-project-step-id`.
- Legacy zero-padded anchors remain as aliases where they previously existed.
- All seven projects have `Step_Map.csv` and `video-manifest.json`.
- All video manifests have null timestamps/video URL until Scribe It fills them.
- All seven project manifests name the same video/step-map contract.

## Verification status

All seven are **Release Candidate / unverified**. Final `VERIFIED` remains blocked by the installed-school-software preflight (and, for selected legacy projects, any outstanding public-asset-rights cleanup).