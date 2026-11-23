import { loadData } from './data.js';
import { createLocalBackend } from './backend.js';
import { createUI } from './ui.js';
import { createSettings } from './settings.js';
import { createAudio } from './audio.js';
import { drawStartStaff } from './start.js';
import { defaultFounder, applyFounder } from './founder.js';
import { localeTag, pickLocale } from './language.js';
import { createSaveStorage } from './save_storage.js';

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

// The test employees, King and V, cards with dev_only: they are in the agency only with ?devtools. A save written there keeps them and their trips;
// the normal game, which does not load their cards, sets them and their trips aside in S.parked, and the developer mode puts them back.
const staffCards = D.get('staff.staff');
const DEV_STAFF = Object.keys(staffCards).filter((id) => staffCards[id].dev_only);
const devIds = DEV_STAFF;
const devStaffEntry = () => ({ restUntil: 0, gear: [], hired: true, favor: D.get('config.favor.start'), growth: {} });
// the test employees join a save read in the developer mode, always hired and ready
function withDevStaff(S) {
  for (const id of devIds) S.staff[id] ||= devStaffEntry();
  return S;
}

document.documentElement.lang = localeTag(D.lang);
const { app, version } = D.get('config.meta');
document.title = `${app} · v${version}`;

const backend = createLocalBackend(D);
backend.setGearSource((id) => (S && S.staff[id] && S.staff[id].gear) || []);

const KEY = D.get('config.save.key');
const saveStorage = createSaveStorage(KEY);
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
    staff: Object.fromEntries(Object.keys(D.get('staff.staff')).map((id) => [id, { restUntil: 0, gear: [], hired: crew.pick.includes(id) || id === founder.id || devIds.includes(id), favor: D.get('config.favor.start'), growth: {} }])),
    inv: { ...O.start_stock },
    clock: { day: 0, speed: 0, auto: false },
    secretary: null,
    calendarStart: O.start_date,
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
    // antiques already anchored by auto mode or explicitly released by the player
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

// The removed arms become carried exoskeletons. Other retired stock is refunded at its old shop price.
const retiredRefunds = {
  altitude_pills: 10, back_brace: 14, detox_water: 12, disinfectant: 8, ear_plugs: 5,
  energy_bar: 4, hand_warmer: 3, heart_monitor: 60, insulated_gloves: 16, plush_toy: 7,
  sun_hat: 8, thermometer: 6, elixir: 190,
};
const retiredArm = (id) => id === 'cyber_arm' || id === 'gorilla_arm';
const retiredItem = (id) => retiredArm(id) || Object.hasOwn(retiredRefunds, id);

function migrateRetiredItems(save) {
  const credit = (id, n) => {
    if (!(n > 0)) return;
    if (retiredArm(id)) save.inv.exoskeleton = (save.inv.exoskeleton || 0) + n;
    else save[id === 'elixir' ? 'energy' : 'funds'] += retiredRefunds[id] * n;
  };
  const clear = (items, refund = false) => {
    for (const [id, n] of Object.entries(items || {})) {
      if (!retiredItem(id)) continue;
      if (refund) credit(id, n);
      delete items[id];
    }
  };
  const clearGear = (gear) => gear.filter((id) => !retiredItem(id));
  clear(save.inv, true);
  for (const staff of [...Object.values(save.staff), ...(save.parked.staff || [])]) {
    for (const id of staff.gear || []) if (retiredItem(id)) credit(id, 1);
    if (staff.gear) staff.gear = clearGear(staff.gear);
  }
  for (const dispatch of [...save.dispatches, ...(save.parked.dispatches || [])]) {
    // Dispatch results are stored at launch. Credit the retired cargo of open trips once, before it can return to stock.
    clear(dispatch.spec.items, !dispatch.claimed);
    if (dispatch.spec.gear) dispatch.spec.gear = clearGear(dispatch.spec.gear);
    clear(dispatch.kit?.back);
    clear(dispatch.kit?.lost);
  }
  for (const trip of save.trips || []) if (trip.items) trip.items = trip.items.filter((id) => !retiredItem(id));
}

// A save written by another version, or naming cards that have since left the game, is upgraded instead of dropped. Before anything changes
// the raw text is kept under a backup key. Every field a fresh save has and this one lacks is filled in; an employee new to the roster is added,
// not hired; an employee, antique, place or trip under way the data no longer has is set aside in S.parked, and put back if it returns.
function upgrade(S, raw) {
  if (S.version !== VERSION && raw) { try { localStorage.setItem(KEY + '_backup_v' + S.version, raw); } catch (e) { /* storage blocked */ } }
  const base = fresh();
  for (const k of Object.keys(base)) if (S[k] === undefined) S[k] = base[k];
  S.calendarStart ||= O.start_date;
  S.parked ||= {};
  migrateRetiredItems(S);
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
  // a trip under way or a kept report waits aside with its place or employee, and returns with them, as the trips of the log below
  const dispatchFits = (d) => places.has(d.eraId) && (d.spec.staffId in S.staff || DEV_STAFF.includes(d.spec.staffId));
  back('dispatches', dispatchFits, (d) => S.dispatches.push(d));
  S.dispatches = S.dispatches.filter((d) => dispatchFits(d) || (park('dispatches', d), false));
  // the log of finished trips likewise: a trip to a place this game does not have, such as a draft story played in the developer mode,
  // or by an employee it does not have, such as V or King outside the developer mode, waits aside,
  // and comes back into the log, in the order the trips came home, once the place and the employee are there again
  const tripFits = (t) => places.has(t.place) && (t.staffId in S.staff || DEV_STAFF.includes(t.staffId));
  const tripBack = (S.parked.trips || []).some(tripFits);
  back('trips', tripFits, (t) => S.trips.push(t));
  S.trips = (S.trips || []).filter((t) => tripFits(t) || (park('trips', t), false));
  if (tripBack) S.trips.sort((a, b) => a.back - b.back || a.day - b.day);
  if (S.startStaff && !S.startStaff.offer.every((id) => id in staff)) S.startStaff = base.startStaff;
  // a secretary set aside with the employees, such as a test employee outside the developer mode, leaves the post
  if (S.secretary && !(S.secretary in S.staff)) S.secretary = null;
  S.version = VERSION;
  applyFounder(D, S.founder);
  return S;
}

async function load() {
  const raw = await saveStorage.read();
  try {
    if (raw) {
      const parsed = JSON.parse(raw);
      const S = parsed && parsed.founder && parsed.staff && Array.isArray(parsed.dispatches) ? upgrade(parsed, raw) : null;
      if (S && fits(S)) return withDevStaff(updateUnfinishedCrew(S));
      // a save that still does not read is kept before the new game writes over it
      try { localStorage.setItem(KEY + '_backup_unread', raw); } catch (e) { /* storage blocked */ }
    }
  } catch (e) {
    console.warn('存档读取失败，使用新存档', e);
    try { if (raw) localStorage.setItem(KEY + '_backup_unread', raw); } catch (x) { /* storage blocked */ }
  }
  return fresh();
}

let S = await load();
D.staffGrowth = (id) => S.staff[id]?.growth;
const settings = createSettings(D);
const ctx = {
  settings,
  audio: createAudio(D, settings),
  S: () => S,
  // the save as it is written and exported
  saved: () => S,
  now: () => Date.now(),
  backend,
  era: (id) => backend.eraInfo(id),
  eraSource: (id) => D.get('era_src.' + id),
  save() {
    return saveStorage.write(JSON.stringify(S));
  },
  // replaces the whole game from a loaded save, and says whether the file looked like one
  replace(obj) {
    if (obj && typeof obj === 'object' && obj.founder && typeof obj.staff === 'object' && Array.isArray(obj.dispatches)) obj = upgrade(obj, null);
    if (!obj || typeof obj !== 'object' || obj.version !== VERSION || typeof obj.staff !== 'object' || !Array.isArray(obj.dispatches) || !fits(obj)) { if (S && S.founder) applyFounder(D, S.founder); return false; }
    S = withDevStaff(updateUnfinishedCrew(obj));
    this.save();
    return true;
  },
  // trips of the loaded save that wait aside, because their place or employee is not in this game, such as V's outside the developer mode
  unkeptTrips() {
    return (S.parked?.trips || []).length;
  },
  reset() {
    S = fresh();
    this.save();
  },
};

const ui = createUI(D, ctx, dev);
window.__game = { D, ctx, ui, backend };
try { ui.render(); } catch (e) { window.__bootfail?.(e.stack || e); throw e; }
document.getElementById('bootloading').hidden = true;
document.getElementById('top').hidden = false;
setInterval(() => ui.tick(), D.get('config.ui.refresh_ms'));
