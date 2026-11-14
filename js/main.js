import { loadData } from './data.js';
import { createLocalBackend } from './backend.js';
import { createUI } from './ui.js';
import { createSettings } from './settings.js';
import { createAudio } from './audio.js';
import { drawStartStaff } from './start.js';
import { defaultFounder, applyFounder } from './founder.js';

// Language: ?lang= in the address, then the saved choice, then the browser language, then the fallback.
function pickLang(I) {
  const codes = Object.keys(I.locales);
  const url = new URLSearchParams(location.search).get('lang');
  let saved = null;
  try { saved = localStorage.getItem(I.storage_key); } catch (e) { /* storage blocked */ }
  for (const c of [url, saved]) if (c && c !== I.auto && codes.includes(c)) return c;
  for (const n of navigator.languages || [navigator.language]) {
    const pre = String(n).toLowerCase().split('-')[0];
    if (codes.includes(pre)) return pre;
  }
  return I.fallback;
}

const dev = new URLSearchParams(location.search).has('devtools');
const D = await loadData(async (p) => {
  const res = await fetch(p, { cache: 'no-cache' }); // always ask the server whether the data changed, so a rebuilt playlist is never hidden by the browser cache
  if (!res.ok) throw new Error('无法读取 ' + p);
  return res.text();
}, (t) => window.jsyaml.load(t), pickLang, { drafts: dev ? true : undefined });

document.documentElement.lang = D.lang;
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
  const events = D.get('catalog.events');
  const { newest, random } = O.start_scenes;
  // events marked start are already owned from the start, so they are not drawn again
  const pool = events.filter((e) => !e.start && !e.after).sort((a, b) => b.year - a.year || a.id.localeCompare(b.id));
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
    version: VERSION, funds: O.start_funds, energy: O.start_energy, seq: 0, dispatches: [],
    staff: Object.fromEntries(Object.entries(D.get('staff.staff')).map(([id, s]) => [id, { restUntil: 0, gear: [], hired: crew.pick.includes(id) || id === founder.id, favor: D.get('config.favor.start'), tally: { 3: 0, 2: 0, 1: 0 }, growth: {} }])),
    inv: { ...O.start_stock },
    clock: { day: 0, speed: 0, auto: false },
    secretary: null,
    secretaryLast: null,
    // places that have had a trip come back, their names are shown on the map
    visited: [],
    // the best star count of each place, time energy is paid only for an improvement on it
    stars: {},
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
      && Object.keys(S.staff).length === Object.keys(staff).length && Object.keys(S.staff).every((id) => id in staff)
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

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const S = JSON.parse(raw);
      if (S.version === VERSION && fits(S)) return updateUnfinishedCrew(S);
    }
  } catch (e) {
    console.warn('存档读取失败，使用新存档', e);
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
  now: () => Date.now(),
  backend,
  era: (id) => backend.eraInfo(id),
  eraSource: (id) => D.get('era_src.' + id),
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage may be blocked, the game still runs */ }
  },
  // replaces the whole game from a loaded save, and says whether the file looked like one
  replace(obj) {
    if (!obj || typeof obj !== 'object' || obj.version !== VERSION || typeof obj.staff !== 'object' || !Array.isArray(obj.dispatches) || !fits(obj)) { if (S && S.founder) applyFounder(D, S.founder); return false; }
    S = updateUnfinishedCrew(obj);
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
ui.render();
setInterval(() => ui.tick(), D.get('config.ui.refresh_ms'));
