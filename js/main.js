import { loadData } from './data.js';
import { createLocalBackend } from './backend.js';
import { createUI } from './ui.js';

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

const D = await loadData(async (p) => {
  const res = await fetch(p);
  if (!res.ok) throw new Error('无法读取 ' + p);
  return res.text();
}, (t) => window.jsyaml.load(t), pickLang);

document.documentElement.lang = D.lang;
document.title = D.get('text.ui.title') + ' · ' + D.get('text.ui.subtitle');

const backend = createLocalBackend(D);

const KEY = D.get('config.save.key');
const VERSION = D.get('config.save.version');
const O = D.get('config.office');

function fresh() {
  return {
    version: VERSION, funds: O.start_funds, energy: O.start_energy, seq: 0, dispatches: [],
    staff: Object.fromEntries(Object.entries(D.get('staff.staff')).map(([id, s]) => [id, { restUntil: 0, hired: s.start_hired, favor: D.get('config.favor.start') }])),
    inv: { ...O.start_stock },
    clock: { day: 0, speed: 0, auto: false },
    secretary: null,
    secretaryLast: null,
    locks: [],
    antiques: Object.entries(D.get('antiques.antiques')).filter(([, a]) => a.start_owned).map(([id]) => id),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const S = JSON.parse(raw);
      if (S.version === VERSION) return S;
    }
  } catch (e) {
    console.warn('存档读取失败，使用新存档', e);
  }
  return fresh();
}

let S = load();
const ctx = {
  S: () => S,
  now: () => Date.now(),
  backend,
  era: (id) => backend.eraInfo(id),
  eraSource: (id) => D.get('era_src.' + id),
  save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* storage may be blocked, the game still runs */ }
  },
  reset() {
    S = fresh();
    this.save();
  },
};

const ui = createUI(D, ctx);
window.__game = { D, ctx, ui, backend };
ui.render();
setInterval(() => ui.tick(), D.get('config.ui.refresh_ms'));
