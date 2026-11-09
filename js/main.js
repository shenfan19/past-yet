import { loadData } from './data.js';
import * as sim from './sim.js';
import { createUI } from './ui.js';

const D = await loadData(async (p) => {
  const res = await fetch(p);
  if (!res.ok) throw new Error('无法读取 ' + p);
  return res.text();
}, (t) => window.jsyaml.load(t));

const eras = {};
for (const id of D.get('config.eras')) eras[id] = sim.compileEra(D.get('era_raw.' + id), D, id);

const KEY = D.get('config.save.key');
const VERSION = D.get('config.save.version');
const O = D.get('config.office');

function fresh() {
  return {
    version: VERSION, funds: O.start_funds, energy: O.start_energy, seq: 0, dispatches: [],
    staff: Object.fromEntries(Object.entries(D.get('staff.staff')).map(([id, s]) => [id, { restUntil: 0, hired: s.start_hired }])),
    inv: { ...O.start_stock },
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
  era: (id) => eras[id],
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
window.__game = { D, sim, ctx, ui, eras };
ui.render();
setInterval(() => ui.tick(), D.get('config.ui.refresh_ms'));
