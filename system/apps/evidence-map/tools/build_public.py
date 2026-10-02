"""Create an explicit static publishing artifact. Never copy the repository root."""
from pathlib import Path
import json,shutil,subprocess,sys,hashlib
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'dist';OUT.mkdir(exist_ok=True)
subprocess.run(['node',str(ROOT/'tools/build_connected_catalogue.cjs')],cwd=ROOT,check=True)
subprocess.run([sys.executable,str(ROOT/'tools/package_release.py')],check=True)
CODE=['index.html','studio.js','studio-core.js','catalogue-core.js','assignment-studio.js','studio-data.js','studio.css','app-storage.js','backup-core.js','curriculum-review.js','learning-dashboard.js','SKILL_CROSSWALK.json','connected.html','connected.css','connected.js','connected-dashboard-core.js','learning-profile.js','connected-catalogue.json']
# These authored teaching directories contain no supplied books, browser data or credentials.
DIRS=['help','outputs/gold-standard-2026','outputs/connected-course-map-2026-09-23','outputs/connected-system-handoff-2026-09-23']
ALLOWED={'.html','.css','.js','.md','.json','.xlsx','.png','.svg','.zip','.psd','.docx','.csv'}
files=[ROOT/p for p in CODE]
files.append(ROOT/'outputs/recovered-teaching-materials-2026-09-23/guides/Truck_Ad_Complete_Guide_v2_RC2.html')
# Publish only these inspected student guides, never the recovered teacher packages.
for title in ['Below_the_Surface','On_the_Cover']:
 for extension in ['html','pdf']:
  files.append(ROOT/'outputs/recovered-teaching-materials-2026-09-23/guides'/f'{title}_Student_Guide.{extension}')
for name in DIRS:
 files.extend(p for p in (ROOT/name).rglob('*') if p.is_file() and p.suffix.lower() in ALLOWED and not p.name.endswith('.inspect.ndjson'))
files.append(ROOT/'outputs/Evidence_Map_Release.zip')
manifest=[]
for p in files:
 if not p.exists():raise SystemExit('Missing public artifact: '+str(p))
 dest=OUT/p.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);manifest.append(str(p.relative_to(ROOT)))
# Build the existing React companion as a bounded /field/ subtree.
field=ROOT/'field-app'
subprocess.run(['npm','run','build'],cwd=field,check=True)
for p in (field/'dist').rglob('*'):
 if not p.is_file() or p.suffix not in {'.html','.js','.css','.json','.svg','.png'}:continue
 relative=Path('field')/p.relative_to(field/'dist');dest=OUT/relative;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest);manifest.append(str(relative))
assets=['/field/']+['/'+f for f in manifest if f.startswith('field/') and f!='field/sw.js']
worker=OUT/'field/sw.js';body=worker.read_text();version=hashlib.sha256(''.join((OUT/f).read_text() for f in manifest if f.startswith('field/assets/') and f.endswith('.js')).encode()).hexdigest()[:12]
body=body.replace('BUILD_VERSION',version).replace("const PRECACHE_ASSETS=['/field/','/field/index.html','/field/manifest.json','/field/icon.svg'];",'const PRECACHE_ASSETS='+json.dumps(assets)+';');worker.write_text(body)
# Keep the existing local planner accessible without the root dashboard redirect.
shutil.copy2(ROOT/'index.html',OUT/'planning-tools.html');manifest.append('planning-tools.html')
# Remove only stale generated files inside this script's dedicated dist output.
keep=set(manifest)|{'public-manifest.json'}
for p in OUT.rglob('*'):
 if p.is_file() and str(p.relative_to(OUT)) not in keep:p.unlink()
(OUT/'public-manifest.json').write_text(json.dumps(sorted(manifest),indent=2))
print('Built '+str(len(manifest))+' allowlisted public files in dist/')
