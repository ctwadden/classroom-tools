# AssessTrack · installed Evidence Map companion

Imported from Chad's Google AI Studio export downloaded 24 September 2026; SHA-256 a960492e11349dfa75c0927c4514d7348bda418c109255a4bd7d1250c08194d4. This folder is the integrated production source. The original export is retained privately for comparison.

Build through `python3 tools/build_public.py` from the repository root after `npm ci --prefix field-app`. The existing static dashboard stays at `/connected.html`; this Vite client is published only at `/field/`. Do not replace the site root with the AI Studio export or deploy its Express server.

The same-origin teacher cookie protects both clients. Google owns the roster. Only shared server-approved rubric versions can be used for capture. Field events stay evidence, not grades. The existing Apps Script timer mirrors field rows and acknowledges exact revisions; no public Apps Script web app is required.

Offline: public app shell is cached by a service worker scoped to `/field/`. Downloaded rosters, approved rubrics and pending captures are kept in IndexedDB. Opening the offline client requires an already verified, unexpired session in that tab; a new offline session is locked. Sign-out clears the view, keeps unsent work and requires sign-in before reopening. This is a private teacher device workflow, not multi-user device security or encrypted storage.

Voice recordings are local only. Gemini routes require both GEMINI_API_KEY and GEMINI_MODEL in server configuration; previews use separate PREVIEW_GEMINI_API_KEY and PREVIEW_GEMINI_MODEL. Neither is configured yet. Text and audio are sent only when the teacher explicitly requests assistance. No provider key belongs in client code.

Known remaining work: physical iPad Safari offline/audio checks, protected audio backup/playback across devices, deployment verification after later AI Studio changes, and full workbook teaching-package production. PowerSchool remains a review handoff pending the school's actual template and standards mapping.

Google API implementation reference: https://ai.google.dev/api/generate-content and https://ai.google.dev/gemini-api/docs/audio (checked 24 September 2026).
