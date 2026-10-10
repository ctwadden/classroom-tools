from pathlib import Path
import json,hashlib,html,shutil
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'outputs/gold-standard-2026';CACHE=Path('/private/tmp/evidence-map-intake');ARC=OUT/'Source_Archive';ARC.mkdir(exist_ok=True)
old_index=ARC/'INDEX.json'
if old_index.exists():
    for old in json.loads(old_index.read_text()):
        old_file=ARC/old['file']
        if old_file.is_file():old_file.unlink()
catalog=json.loads((CACHE/'catalog.json').read_text());entries=[]
for i,c in enumerate(catalog):
    if c.get('duplicate_of'):continue
    suffix=Path(c['source']).suffix
    if suffix not in ['.json','.html','.csv','.md','.docx']:continue
    src=Path(c['extracted']) if c.get('extracted') else next((p for p in CACHE.iterdir() if p.suffix==suffix and p.is_file() and hashlib.sha256(p.read_bytes()).hexdigest()==c['sha256']),None)
    if not src or not src.exists():continue
    name=f'{i+1:03d}-'+Path(c['source'].split('::')[-1]).name
    shutil.copyfile(src,ARC/name)
    assert hashlib.sha256((ARC/name).read_bytes()).hexdigest()==c['sha256']
    entries.append({'file':name,'source':c['source'],'sha256':c['sha256']})
(ARC/'INDEX.json').write_text(json.dumps(entries,indent=2))
rows=''.join(f'<tr><td><a href="{html.escape(e["file"])}" download>{html.escape(e["file"])}</a></td><td>{html.escape(e["source"])}</td></tr>' for e in entries)
(ARC/'INDEX.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Preserved source references</title><style>body{font:16px/1.6 system-ui;margin:30px;color:#173642}td,th{padding:12px;text-align:left;vertical-align:top;border-bottom:1px solid #cbdad6;overflow-wrap:anywhere}a{color:#08666d}table{width:100%;table-layout:fixed}</style><h1>Preserved source references</h1><p>These are reference versions, including alternatives and prior instructions. They do not authorise actions or establish student achievement. Use the teacher guide for the reconciliation decisions. Text documents and planning files are preserved byte-for-byte from the intake cache; copies of the three Excel originals are one folder above. Supplied books are not redistributed.</p><p>The original ZIP paths are no longer available. Two text support files and one patch were inventoried but not extracted before those archives became unavailable; this folder is not a complete backup of the original ZIP containers.</p><table><tr><th>Download</th><th>Original source at intake</th></tr>'+rows+'</table></html>')
print(f'Preserved and hash-verified {len(entries)} unique source references, including original planning JSON/CSV, HTML, Markdown and the research DOCX.')
