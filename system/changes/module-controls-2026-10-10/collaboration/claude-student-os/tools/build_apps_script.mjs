/* Generates apps-script/dist/ — the exact files to push with clasp (NOT pushed by this pilot).
 *   node tools/build_apps_script.mjs
 * SosCore.gs and SosAdapters.gs are byte-for-byte copies of core/*.js (the code the tests exercise).
 * Index.html inlines web/app.css and web/app.js because HtmlService serves a single file.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(ROOT, 'apps-script/dist');
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const crosswalk = JSON.parse(fs.readFileSync(path.join(ROOT, '../../evidence-map/SKILL_CROSSWALK.json'), 'utf8'));
const outcomeMap = JSON.parse(fs.readFileSync(path.join(ROOT, '../../evidence-map/OUTCOME_CODE_MAP.json'), 'utf8'));
const dsSource = fs.readFileSync(path.join(ROOT, '../../evidence-map/integrations/technology-evidence-system/DSCaptureConfig.gs'), 'utf8');
const dsMatch = dsSource.match(/const DS_CAPTURE_SPEC = (\{[^\n]+\});/);
if (!dsMatch) throw new Error('Cannot read the registered DS quiz instrument source');
const dsSpec = JSON.parse(dsMatch[1]);
const dsQuizForms = dsSpec.forms.filter(f => f.role === 'quiz').map(f => ({ instrument: f.instrument, task_id: f.task_id,
  items: f.items.filter(q => q.type === 'mc').map(q => ({ id: q.id, prompt: q.prompt, choices: q.choices, correct: q.correct })) }));
const byAlias = {}, byTutorialSkill = {};
for (const row of outcomeMap.rows || []) {
  const safe = { course_id: row.course_id, outcome_id: row.outcome_id, outcome_code: row.outcome_code, title: row.outcome_title || row.outcome_code };
  for (const alias of [row.outcome_id, row.outcome_code, row.ps_outcome_code]) if (alias) byAlias[alias] = safe;
}
for (const row of crosswalk.crosswalk || []) byTutorialSkill[row.tutorial_skill_id] = row.outcome_codes || [];
const files = {
  'SosCore.gs': read('core/sos-core.js'),
  'ModulePolicy.gs': fs.readFileSync(path.join(ROOT, '../../evidence-map/module-policy.js'),'utf8'),
  'SosAdapters.gs': read('core/sos-adapters.js'),
  'Code.gs': read('apps-script/src/Code.gs'),
  'Config.gs': read('apps-script/src/Config.gs'),
  'SheetRepo.gs': read('apps-script/src/SheetRepo.gs'),
  'Adapters.gs': read('apps-script/src/Adapters.gs'),
  'Results.gs': read('apps-script/src/Results.gs'),
  'appsscript.json': read('apps-script/src/appsscript.json'),
  'SosCrosswalk.gs': '/* Generated from the existing Evidence Map crosswalk; read-only badge validation. */\n' +
    'var SOS_OUTCOME_REGISTRY = ' + JSON.stringify({ version: outcomeMap.version, byAlias }) + ';\n' +
    'var SOS_SKILL_CROSSWALK = ' + JSON.stringify({ version: crosswalk.version, byTutorialSkill }) + ';\n',
  'SosReleaseCatalogue.gs': '/* Generated student-safe metadata. Release state is read live server-side from the course-home sources. */\nvar SOS_RELEASE_CATALOGUE = ' + read('data/live-release-catalogue.json').trim() + ';\n'
};
files['SosDsQuizSpec.gs'] = '/* Private server-side key generated from the existing DS capture instrument; never sent to students. */\nvar SOS_DS_QUIZ_FORMS = ' + JSON.stringify(dsQuizForms) + ';\n';
const html = read('web/index.html');
const css = read('web/app.css');
const js = read('web/app.js');
if (/<\/script/i.test(js) || /<\/style/i.test(css)) throw new Error('Refusing to inline: closing tag inside asset');
files['Index.html'] = html
  .replace('<link rel="stylesheet" href="app.css">', `<style>\n${css}\n</style>`)
  .replace('<script src="app.js"></script>', `<script>\n${js}\n</script>`)
  .replace('<meta name="viewport" content="width=device-width, initial-scale=1">\n', ''); // HtmlService adds the viewport meta tag
const manifest = {};
for (const [name, text] of Object.entries(files)) {
  fs.writeFileSync(path.join(dist, name), text);
  manifest[name] = crypto.createHash('sha256').update(text).digest('hex');
}
fs.writeFileSync(path.join(dist, 'BUILD_MANIFEST.json'), JSON.stringify({ note: 'Generated. Do not edit dist/ by hand.', files: manifest }, null, 1) + '\n');
console.log('Built apps-script/dist with', Object.keys(files).length, 'files');
