# Connected Evidence Map source recovery

This directory preserves the working dashboard, iPad field app and bound Apps Script recovered on 25 September 2026, with the Truck Ad / learner-support repair. The former local checkout had no Git remote; its committed head was b88a9a07fae89d5062cc2f3452f5c9518adbfe5b, with additional uncommitted working files. The original checkout was left untouched.

The runtime code and curriculum data are versioned here. Bulky teaching assets remain in the exact verified Netlify release archive:

- Archive: https://6ab7114ec9d95d2f94521de2--outcome-evidence-map.netlify.app/outputs/Evidence_Map_Release.zip
- SHA-256: `26461c233ccb2ff22b3a067c740ff0ea107543e16a045254126543155941a3bf`

To restore, obtain this source directory and the checksum-verified archive. Extract only the archive's `Evidence_Map_Release/outputs/` and `Evidence_Map_Release/help/` directories alongside this file. Keep the GitHub runtime code. Run `npm ci --ignore-scripts`, `npm ci --prefix field-app --ignore-scripts`, then `python3 tools/build_public.py`. The publication allowlist excludes private data and credentials. Deployment secrets remain in the existing Netlify account; Apps Script properties remain in the existing bound project.

Use the existing Netlify site e2fe77c9-f0e4-406f-9c4a-fb3b6d359a64. A preview must pass before a production deploy. Preview storage is isolated by host; production storage is unchanged. Bundle functions fresh with `--skip-functions-cache`.

The installed Apps Script matches `integrations/technology-evidence-system/bound-project/`. Only the support_context serialization changed in this release; existing triggers and raw evidence were preserved. Fresh-pull before future pushes.

Truck Ad rubric MM12-TRUCK-AD-R1 / 2026-09-25.2 is a draft. Readiness requires mapped taught skills, valid outcomes, four descriptors and explicit collection guidance; teacher approval remains separate. The workbook is a release candidate pending assets/native Photoshop rehearsal.

65 Node tests and TypeScript validation passed. The isolated preview received six synthetic events, retained a confirmed Secure achievement through two contextual support observations, and deduplicated replayed capture. The Google mirror function passed a structured-support test; a real live classroom capture-to-Sheet round trip and physical iPad offline/reconnect remain unverified.

No synthetic records were added to production. Broader curriculum mapping, student-specific delivery and IBDS Operation Get a 7 remain subsequent work.
