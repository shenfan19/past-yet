import { loadData } from './data.js';
import { createLocalBackend } from './backend.js';
import { createUI } from './ui.js';
import { createSettings } from './settings.js';
import { createAudio } from './audio.js';
import { drawStartStaff } from './start.js';
import { defaultFounder, applyFounder } from './founder.js';
import { localeTag, pickLocale } from './language.js';

// Language: ?lang= in the address, then the saved choice, then the browser language, then the fallback.
function pickLang(I) {
  const url = new URLSearchParams(location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem(I.storage_key); } catch (e) { /* storage blocked */ }
  return pickLocale(I, url, saved, navigator.languages?.length ? navigator.languages : [navigator.language]);
}

const dev = new URLSearchParams(location.search).has('devtools');
const D = await loadData(async (p) => {
  // play.html, the build for opening without a server, carries every data file in window.TP_FILES; index.html asks the server
  if (window.TP_FILES) { if (p in window.TP_FILES) return window.TP_FILES[p]; throw new Error('无法读取 ' + p); }
  const res = await fetch(p, { cache: 'no-cache' }); // always ask the server whether the data changed, so a rebuilt playlist is never hidden by the browser cache
  if (!res.ok) throw new Error('无法读取 ' + p);
  return res.text();
}, (t) => window.jsyaml.load(t), pickLang, { drafts: dev || new URLSearchParams(location.search).has('drafts') ? true : undefined, devStaff: dev })
  // a failure here would leave the page blank, so the box of index.html shows it
  .catch((e) => { window.__bootfail?.(e.stack || e); throw e; });

// The test employees, King and V, cards with dev_only: they are in the agency only with ?devtools, and never in a save,
// so a save written in the developer mode still opens in the normal game, and the normal game never shows them.
const staffCards = D.get('staff.staff');
const DEV_STAFF = Object.keys(staffCards).filter((id) => staffCards[id].dev_only);
const devIds = DEV_STAFF;
const devStaffEntry = () => ({ restUntil: 0, gear: [], hired: true, favor: D.get('config.favor.start'), tally: { 3: 0, 2: 0, 1: 0 }, growth: {} });
// a save as it is written: without the test employees and what they did
function withoutDevStaff(S) {
  if (!DEV_STAFF.length) return S;
  const out = { ...S, staff: Object.fromEntries(Object.entries(S.staff).filter(([id]) => !DEV_STAFF.includes(id))) };
  out.dispatches = (S.dispatches || []).filter((d) => !DEV_STAFF.includes(d.spec?.staffId));
  out.trips = (S.trips || []).filter((t) => !DEV_STAFF.includes(t.staffId));
  if (DEV_STAFF.includes(S.secretary)) out.secretary = null;
  return out;
}
// the test employees join a save read in the developer mode, always hired and ready
function withDevStaff(S) {
  for (const id of devIds) S.staff[id] ||= devStaffEntry();
  return S;
}

document.documentElement.lang = localeTag(D.lang);
document.title = [D.get('text.ui.title'), D.get('text.ui.subtitle')].filter(Boolean).join(' · ');

const backend = createLocalBackend(D);
backend.setGearSource((id) => (S && S.staff[id] && S.staff[id].gear) || []);

const KEY = D.get('config.save.key');
const VERSION = D.get('config.save.version');
const O = D.get('config.office');

// The latest event of the catalogue goes first, because an antique only leads to earlier times and from the latest one most of the others can be reached.
// The rest are drawn at random from what is left. Each new game draws its own.
function startAntiques() {
  const out = Object.entries(D.get('antiques.antiques')).filter(([, a]) => a.start_owned).map(([id]) => id);
  const events = D.get('catalog.active_events');
  const { newest, random } = O.start_scenes;
  // events marked start are already owned from the start, so they are not drawn again
  const pool = events.filter((e) => !e.start).sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));
  for (const e of pool.splice(0, newest)) out.push('relic_' + e.id);
  const drawn = [];
  for (let i = 0; i < random && pool.length; i++) drawn.push('relic_' + pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
  return { all: [...out, ...drawn], random: drawn };
}

function fresh() {
  const begin = startAntiques();
  const start = begin.all;
  const crew = drawStartStaff(D, O);
  // the founder is the player's own character, a staff card of the save that is put into the data before the staff of the save is made
  const founder = defaultFounder(D);
  applyFounder(D, founder);
  return {
    founder,
    // trips: the log of finished trips, made with the save so a cleared save renders like a new one
    version: VERSION, funds: O.start_funds, energy: O.start_energy, seq: 0, dispatches: [], trips: [],
    staff: Object.fromEntries(Object.entries(D.get('staff.staff')).map(([id, s]) => [id, { restUntil: 0, gear: [], hired: crew.pick.includes(id) || id === founder.id || devIds.includes(id), favor: D.get('config.favor.start'), tally: { 3: 0, 2: 0, 1: 0 }, growth: {} }])),
    inv: { ...O.start_stock },
    clock: { day: 0, speed: 0, auto: false },
    secretary: null,
    // the office keeps a calendar: day 0 is the real date this game began, so the days of the office read as dates
    calendarStart: new Date().toISOString().slice(0, 10),
    // places that have had a trip come back, their names are shown on the map
    visited: [],
    // the best star count of each place, time energy is paid only for an improvement on it
    stars: {},
    // the echoes heard so far, the recorded lines of people given at the settlement of a trip; the page of a person shows them
    heard: [],
    // the hiring offer
    hire: null,
    // the antiques the office starts with are already anchored, so those places are open: the first one, the latest event, and a few at random
    locks: [...start],
    antiques: [...start],
    // the random ones of the start, which can be drawn again until the first trip, and whether the welcome has been read
    startRandom: begin.random,
    // the antiques the automatic mode has already anchored, so it does not anchor again what the player released
    autoAnchored: [],
    // the candidates for the first employees and the ones picked, which can be changed until the first trip
    startStaff: crew,
    welcomed: false,
  };
}

// A save fits the data when everything it names still exists. A card removed since the save was written would otherwise break the page,
// so a save that does not fit is dropped and a new game starts.
function fits(S) {
  try {
    if (!S.founder) return false;
    applyFounder(D, S.founder);
    const antiques = D.get('antiques.antiques');
    const events = new Set(D.get('catalog.events').map((e) => e.id));
    const places = new Set([...D.get('config.eras'), ...events]);
    const staff = D.get('staff.staff');
    return S.locks.every((id) => id in antiques) && S.antiques.every((id) => id in antiques) && S.visited.every((id) => places.has(id))
      && S.dispatches.every((d) => places.has(d.eraId) && d.spec.staffId in staff)
      && Object.keys(S.staff).filter((id) => !DEV_STAFF.includes(id)).length === Object.keys(staff).filter((id) => !DEV_STAFF.includes(id)).length && Object.keys(S.staff).every((id) => id in staff)
      && (!S.startStaff || S.startStaff.offer.every((id) => id in staff));
  } catch (e) { return false; }
}

function updateUnfinishedCrew(save) {
  if (save.welcomed !== false || save.seq !== 0 || !save.startStaff?.offer.includes('s_fan')) return save;
  for (const id of save.startStaff.pick) save.staff[id].hired = false;
  save.startStaff = drawStartStaff(D, O);
  for (const id of save.startStaff.pick) save.staff[id].hired = true;
  save.hire = null;
  return save;
}

// A save written by another version, or naming cards that have since left the game, is upgraded instead of dropped. Before anything changes
// the raw text is kept under a backup key. Every field a fresh save has and this one lacks is filled in; an employee new to the roster is added,
// not hired; an employee, antique, place or trip under way the data no longer has is set aside in S.parked, and put back if it returns.
function upgrade(S, raw) {
  if (S.version !== VERSION && raw) { try { localStorage.setItem(KEY + '_backup_v' + S.version, raw); } catch (e) { /* storage blocked */ } }
  const base = fresh();
  for (const k of Object.keys(base)) if (S[k] === undefined) S[k] = base[k];
  S.parked ||= {};
  const park = (kind, x) => { (S.parked[kind] ||= []).push(x); };
  const staff = D.get('staff.staff');
  const entry = base.staff[Object.keys(base.staff)[0]];
  for (const [id, st] of Object.entries(S.staff)) {
    if (DEV_STAFF.includes(id)) continue;
    if (!(id in staff)) { park('staff', { id, ...st }); delete S.staff[id]; continue; }
    for (const k of Object.keys(entry)) if (st[k] === undefined) st[k] = k === 'hired' ? false : structuredClone(entry[k]);
  }
  for (const id of Object.keys(staff)) if (!(id in S.staff) && !DEV_STAFF.includes(id)) S.staff[id] = { ...structuredClone(entry), hired: false };
  const antiques = D.get('antiques.antiques');
  const places = new Set([...D.get('config.eras'), ...D.get('catalog.events').map((e) => e.id)]);
  // what was set aside before and is back in the data returns to its place
  const back = (kind, ok, put) => { const keep = []; for (const x of S.parked[kind] || []) (ok(x) ? put(x) : keep.push(x)); S.parked[kind] = keep; };
  back('antiques', (x) => x.id in antiques, (x) => S[x.list].push(x.id));
  back('staff', (x) => x.id in staff, (x) => { const { id, ...st } = x; S.staff[id] = st; });
  for (const list of ['antiques', 'locks']) S[list] = S[list].filter((id) => (id in antiques) || (park('antiques', { id, list }), false));
  S.visited = S.visited.filter((id) => places.has(id));
  S.dispatches = S.dispatches.filter((d) => (places.has(d.eraId) && d.spec.staffId in S.staff) || (park('dispatches', d), false));
  if (S.startStaff && !S.startStaff.offer.every((id) => id in staff)) S.startStaff = base.startStaff;
  S.version = VERSION;
  applyFounder(D, S.founder);
  return S;
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const S = parsed && parsed.founder && parsed.staff && Array.isArray(parsed.dispatches) ? upgrade(parsed, raw) : null;
      if (S && fits(S)) { S.calendarStart ||= new Date().toISOString().slice(0, 10); return withDevStaff(updateUnfinishedCrew(S)); }
      // a save that still does not read is kept before the new game writes over it
      try { localStorage.setItem(KEY + '_backup_unread', raw); } catch (e) { /* storage blocked */ }
    }
  } catch (e) {
    console.warn('存档读取失败，使用新存档', e);
    try { const raw = localStorage.getItem(KEY); if (raw) localStorage.setItem(KEY + '_backup_unread', raw); } catch (x) { /* storage blocked */ }
  }
  return fresh();
}

let S = load();
D.staffGrowth = (id) => S.staff[id]?.growth;
const settings = createSettings(D);
const ctx = {
  settings,
  audio: createAudio(D, settings),
  S: () => S,
  // the save as it is written and exported, without the test employees
  saved: () => withoutDevStaff(S),
  now: () => Date.now(),
  backend,
  era: (id) => backend.eraInfo(id),
  eraSource: (id) => D.get('era_src.' + id),
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(withoutDevStaff(S))); } catch (e) { /* storage may be blocked, the game still runs */ }
  },
  // replaces the whole game from a loaded save, and says whether the file looked like one
  replace(obj) {
    if (obj && typeof obj === 'object' && obj.founder && typeof obj.staff === 'object' && Array.isArray(obj.dispatches)) obj = upgrade(obj, null);
    if (!obj || typeof obj !== 'object' || obj.version !== VERSION || typeof obj.staff !== 'object' || !Array.isArray(obj.dispatches) || !fits(obj)) { if (S && S.founder) applyFounder(D, S.founder); return false; }
    S = withDevStaff(updateUnfinishedCrew(obj));
    this.save();
    return true;
  },
  reset() {
    S = fresh();
    this.save();
  },
};

const ui = createUI(D, ctx, dev);
window.__game = { D, ctx, ui, backend };
try { ui.render(); } catch (e) { window.__bootfail?.(e.stack || e); throw e; }
setInterval(() => ui.tick(), D.get('config.ui.refresh_ms'));
