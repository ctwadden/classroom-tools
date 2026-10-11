/**
 * Script Properties (set by the coordinator; never committed):
 *   SOS_ROSTER_SPREADSHEET_ID   existing Technology Evidence System spreadsheet (Roster tab, read-only use)
 *   SOS_STORE_SPREADSHEET_ID    owner-only spreadsheet holding the SOS_* tabs (see DATA_CONTRACT.md). Never shared with students.
 *   SOS_TEACHERS_JSON           {"teacher@school": {"label":"…","courses":["IBDS","MM12","COM11"]}} — explicit teacher authorization
 *   SOS_PILOT_ALLOWLIST_JSON    exact student emails allowed into the pilot, as a JSON array. Missing or [] denies every student.
 *   SOS_EVIDENCE_MODE           "demo" (default) or "live" (only after CR-SOS-3 is approved and tested)
 *   EVIDENCE_MAP_INGEST_URL / EVIDENCE_MAP_INGEST_SECRET   required for module controls and live evidence delivery
 *   SOS_ALLOW_EMBED             "true" only after the Google Sites embed test is approved
 */
var SOS_CANONICAL_ROSTER_SPREADSHEET_ID = '1hGXzxde_q7UmKUFYKub3N_j_bFTMRrZqIUxTCIpciwc';

function sosPilotAllowlist_(raw) {
  var parsed;
  try { parsed = JSON.parse(raw || '[]'); } catch (e) { throw SOS.SosError('DENIED', 'Student OS is not configured (pilot allowlist).', 401); }
  if (!Array.isArray(parsed)) throw SOS.SosError('DENIED', 'Student OS is not configured (pilot allowlist).', 401);
  var seen = {}, result = [];
  parsed.forEach(function (value) {
    var email = typeof value === 'string' ? value.trim().toLowerCase() : '';
    if (!email || email.indexOf('@') < 1) throw SOS.SosError('DENIED', 'Student OS is not configured (pilot allowlist).', 401);
    if (!seen[email]) { seen[email] = true; result.push(email); }
  });
  return result;
}

function sosConfig_() {
  var p = PropertiesService.getScriptProperties();
  var need = function (k) { var v = p.getProperty(k); if (!v) throw SOS.SosError('DENIED', 'Student OS is not configured (' + k + ').', 401); return v; };
  var teachers = {};
  try { teachers = JSON.parse(p.getProperty('SOS_TEACHERS_JSON') || '{}'); } catch (e) { throw SOS.SosError('DENIED', 'Student OS is not configured (teachers).', 401); }
  var normalized = {};
  Object.keys(teachers).forEach(function (k) { normalized[String(k).trim().toLowerCase()] = teachers[k]; });
  return {
    rosterSpreadsheetId: need('SOS_ROSTER_SPREADSHEET_ID'),
    storeId: need('SOS_STORE_SPREADSHEET_ID'),
    teachers: normalized,
    pilotAllowlist: sosPilotAllowlist_(p.getProperty('SOS_PILOT_ALLOWLIST_JSON')),
    evidenceMode: p.getProperty('SOS_EVIDENCE_MODE') === 'live' ? 'live' : 'demo',
    ingestUrl: p.getProperty('EVIDENCE_MAP_INGEST_URL') || '',
    ingestSecret: p.getProperty('EVIDENCE_MAP_INGEST_SECRET') || '',
    allowEmbed: p.getProperty('SOS_ALLOW_EMBED') === 'true'
  };
}

/**
 * First-run setup. Points at the existing Technology Evidence System Roster for read-only identity lookup,
 * defaults the student pilot allowlist to empty, and creates only the private Student OS store when needed.
 * It never copies or writes the Roster, Forms, gradebook or evidence tabs.
 */
function sosEnsureSetup_() {
  var p = PropertiesService.getScriptProperties();
  var configUpdates = {};
  if (p.getProperty('SOS_ROSTER_SPREADSHEET_ID') !== SOS_CANONICAL_ROSTER_SPREADSHEET_ID) configUpdates.SOS_ROSTER_SPREADSHEET_ID = SOS_CANONICAL_ROSTER_SPREADSHEET_ID;
  if (p.getProperty('SOS_PILOT_ALLOWLIST_JSON') === null) configUpdates.SOS_PILOT_ALLOWLIST_JSON = '[]';
  if (Object.keys(configUpdates).length) p.setProperties(configUpdates, false);
  if (p.getProperty('SOS_STORE_SPREADSHEET_ID')) return false;
  // The web app runs as the owner, so the files are always created in the owner's Drive and shared with no one.
  var owner = String(Session.getEffectiveUser().getEmail() || '').toLowerCase();
  if (!owner) throw new Error('Google did not report the owner account.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (p.getProperty('SOS_STORE_SPREADSHEET_ID')) return false;
    var store = SpreadsheetApp.create('Student OS Store (pilot) — private');
    var props = { SOS_STORE_SPREADSHEET_ID: store.getId(), SOS_EVIDENCE_MODE: 'demo' };
    if (!p.getProperty('SOS_TEACHERS_JSON')) { var t = {}; t[owner] = { label: 'Teacher', courses: ['IBDS', 'MM12', 'COM11'] }; props.SOS_TEACHERS_JSON = JSON.stringify(t); }
    p.setProperties(props, false);
    return true;
  } finally { lock.releaseLock(); }
}

/** Run this once from the Apps Script editor (Run ▸ setupStudentOS) if the web page says Student OS is not configured. */
function setupStudentOS() {
  var made = sosEnsureSetup_();
  var p = PropertiesService.getScriptProperties();
  console.log(made ? 'Student OS set up.' : 'Student OS was already set up.');
  console.log('Store: https://docs.google.com/spreadsheets/d/' + p.getProperty('SOS_STORE_SPREADSHEET_ID'));
  console.log('Roster (read-only): https://docs.google.com/spreadsheets/d/' + p.getProperty('SOS_ROSTER_SPREADSHEET_ID'));
  console.log('Pilot students allowed: ' + sosPilotAllowlist_(p.getProperty('SOS_PILOT_ALLOWLIST_JSON')).length);
}
