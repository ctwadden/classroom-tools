# Module controls source snapshot

These files are the tested module-control sources deployed to the existing Teacher OS and Student OS on 10 October 2026. The canonical `technology-learning-system-v3` branch predates parts of the current live Teacher OS (including its support and assessment guardrails). This additive snapshot preserves the new source without overwriting that branch or rolling back those guardrails. It is not an independent service or a second roster.

Teacher OS deployment: see `RELEASE_REPORT.md` in the local audit for the Netlify receipt. Student OS is the existing project/deployment, version 22. No credentials, private teacher materials, learner records or roster copies are in this snapshot. Runtime module controls are immutable revisions in the existing connected-evidence store, separate from work and grades.

Source folders mirror the local `evidence-map/` and `collaboration/claude-student-os/` paths. Review/reconcile these sources into the existing app folders before a subsequent Git-based rebuild. Do not replace the current live iPad companion with an unrelated locally generated bundle. The module policy file is the single source for browser and generated Apps Script rules.
