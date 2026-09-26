"""Package the field-app prompt and exact connection references, without live data."""
from pathlib import Path
import hashlib
import json
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/connected-system-handoff-2026-09-23'
SOURCES = [
    'outputs/connected-system-handoff-2026-09-23/INTERFACE_CONTRACT.json',
    'outputs/connected-system-handoff-2026-09-23/GOOGLE_SHEET_FIELD_SETUP.json',
    'netlify/functions/evidence-bridge.mts',
    'netlify/functions/_shared/evidence-service.cjs',
    'netlify/functions/_shared/evidence-core.cjs',
    'integrations/technology-evidence-system/bound-project/ConnectedEvidence.js',
    'tests/google-connected.test.cjs',
    'tests/connected-evidence.test.cjs',
    'netlify.toml',
]
INTRO = '''# AI Studio field-app connection reference

Use this with GOOGLE_AI_STUDIO_PROMPT.md. It includes the implemented contract,
the exact prepared Google Sheet tabs/headers, and current connection source.
No student roster records or live credential values are included.

The existing API accepts authenticated O/C/P evidence using approved rubrics,
including combined methods and HTTPS artifact links. Google currently mirrors
confirmed judgments only. The Field Evidence tab and Rubric Library reference
copy are now prepared. Field mirroring, dynamic rubric authoring/publishing,
completed-rubric session metadata, voice-note storage, transcription, Gemini
assistance and shared comment drafts still require the specified extensions.
The requested_field_app_extensions metadata is a build specification, not deployed APIs.

Produce additive patches and preserve current behaviour. ConnectedEvidence.js
is one file in an existing bound Apps Script project. Its EM, TS and other helper
references come from the other installed files; do not replace the whole project.
Keep the existing lock and timer; reuse the prepared tab names and headers.
The Sheet's sharing state was not changed by preparation. Private voice bytes
must never be placed in public files or worksheet cells.

For standalone backend tests, connected-catalogue.json is a repository-root
dependency available at https://outcome-evidence-map.netlify.app/connected-catalogue.json.
Use its real course/outcome/rubric definitions, not invented replacements.
Reference tests use fictional credentials and learners. Preserve the existing
preview credential and data-store isolation.

Dispatch the proposed Google-only field-events operation before the generic
Google-role rejection, keeping authorization, course validation and bounds.
An API event receipt proves Netlify acceptance, not successful Sheet writeback.
New event fields require changes to the normalizer and round-trip tests; frontend
properties alone will currently be discarded.

Build the iPad client for /field/ on the same Netlify site. Keep backend patches
separate from the field frontend. Do not claim an AI Studio preview deploys those
patches. No Gemini key has been supplied in this handoff; deliver server-only
configuration instructions and working unavailable states until configured.
'''

def build():
    contract = json.loads((OUT / 'INTERFACE_CONTRACT.json').read_text())
    assert 'field-events' not in contract['actions']
    assert contract['google_sheet_connection']['raw_field_evidence_mirror_implemented'] is False
    chunks = [INTRO]
    for name in SOURCES:
        path = ROOT / name
        lang = 'json' if path.suffix == '.json' else 'toml' if path.suffix == '.toml' else 'typescript' if path.suffix == '.mts' else 'javascript'
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        chunks.append(f'\n## {name}\n\nSHA-256: {digest}\n\n````{lang}\n{path.read_text().rstrip()}\n````\n')
    reference = '\n'.join(chunks)
    secret_path = ROOT / 'private/connected-teacher-access.txt'
    secret = secret_path.read_text().strip() if secret_path.exists() else ''
    if secret:
        assert secret not in reference
    (OUT / 'AI_STUDIO_CONNECTION_REFERENCE.md').write_text(reference)
    names = ['GOOGLE_AI_STUDIO_PROMPT.md', 'AI_STUDIO_CONNECTION_REFERENCE.md']
    for bundle in ['AI_STUDIO_FIELD_APP_v2.zip', 'AI_STUDIO_OCP_BUILD_PACKET.zip']:
        with zipfile.ZipFile(OUT / bundle, 'w', zipfile.ZIP_DEFLATED) as archive:
            for name in names:
                path = OUT / name
                if secret:
                    assert secret not in path.read_text()
                archive.write(path, name)
    with zipfile.ZipFile(OUT / 'Connected_System_Handoff.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(OUT.iterdir()):
            if path.is_file() and path.suffix in ['.md', '.json']:
                if secret:
                    assert secret not in path.read_text()
                archive.write(path, path.name)
    print(json.dumps({'packet': str(OUT / 'AI_STUDIO_FIELD_APP_v2.zip'), 'files': names, 'reference_sources': len(SOURCES)}))

if __name__ == '__main__':
    build()
