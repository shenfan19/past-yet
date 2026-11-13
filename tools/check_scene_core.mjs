// The regression baseline of the scene sub core: with no pressure on the body, the points it finds met are bit for bit the points the old static rule finds met.
// The oracle below is the static rule as it was before the sub core, kept here on purpose. Usage: node tools/check_scene_core.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { draw } from '../js/rng.js';
import { evalScene, sceneModel } from '../js/scene_core.js';
import * as sim from '../js/sim.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => 'en');
const LK = D.get('config.office.luck');
const seeds = D.get('config.tools.probe_seeds');
const events = D.get('catalog.events').filter((e) => e.scene);
const items = D.get('items');
const sceneItems = Object.keys(items).filter((i) => items[i].scene);

function oracle(ev, staffId, seed, carried, stats) {
  const staff = D.get('staff.staff.' + staffId);
  const meets = (req) => Object.entries(req).every(([k, v]) => {
    if (k === 'stat') return Object.entries(v).every(([s, min]) => stats[s] >= min);
    if (k === 'trait') return v.some((t) => staff.traits.includes(t));
    if (k === 'job') return staff.jobs.some((j) => v.includes(j));
    if (k === 'gender') return D.get('staff.gender_class')[staff.gender] === v;
    if (k === 'item') return carried.includes(v);
    if (k === 'provides') return carried.some((id) => items[id].provides.includes(v));
    if (k === 'luck') return draw(seed, 'scene_luck_' + JSON.stringify(req), ev.id) < Math.min(LK.max_chance, v * (LK.base + LK.per_point * stats.luck));
    if (k === 'any') return v.some(meets);
    throw new Error('unknown requirement ' + k);
  });
  return ev.scene.points.map((p) => meets(p.req));
}

let n = 0, bad = 0;
const kits = (ev) => {
  const named = new Set();
  const walk = (r) => { for (const [k, v] of Object.entries(r)) { if (k === 'item') named.add(v); if (k === 'provides') sceneItems.filter((i) => items[i].provides.includes(v)).forEach((i) => named.add(i)); if (k === 'any') v.forEach(walk); } };
  ev.scene.points.forEach((p) => walk(p.req));
  const list = [...named];
  return [[], ...list.map((i) => [i]), list];
};
for (const ev of events) {
  const m = sceneModel(D, ev);
  if (m.points.length !== 3 || m.points.some((p) => !(p.day >= 1 && p.day <= m.stay))) { console.log('bad model', ev.id); bad++; }
  for (const staffId of Object.keys(D.get('staff.staff'))) {
    for (const carried of kits(ev)) {
      for (const favor of [null, 0.2, 0.9]) {
        const stats = { ...sim.staffAttrs(D, staffId, favor, []) };
        for (const id of carried) for (const [k, mu] of Object.entries(items[id].stat_mult || {})) stats[k] *= mu;
        for (const seed of seeds) {
          // the attributes change from day to day in the callback, but not by anything: the same object comes back
          const got = evalScene(D, ev, { staffId, seed, carried, statsAt: () => stats });
          const want = oracle(ev, staffId, seed, carried, stats);
          n++;
          if (got.some((g, i) => g !== want[i])) { bad++; if (bad < 10) console.log('differs', ev.id, staffId, carried, seed, got, want); }
        }
      }
    }
  }
}
console.log(`${n} cases over ${events.length} scenes, ${bad} differences`);
if (bad) process.exit(1);
console.log('scene core: ok');
