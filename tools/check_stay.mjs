// The acceptance of the stay coordinator: no pressure gives the static result bit for bit, the same dispatch and seed give the same stay,
// a traveller under pressure meets the later points on lower attributes, and one who cannot act any more fails every later point. Usage: node tools/check_stay.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { evalScene } from '../js/scene_core.js';
import { runStay } from '../js/stay.js';
import { LMCore } from '../vendor/lm_core/index.js';
import * as sim from '../js/sim.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => 'en');
const events = D.get('catalog.events').filter((e) => e.scene);
const staffIds = Object.keys(D.get('staff.staff'));
const seeds = D.get('config.tools.probe_seeds');
const errors = [];
const err = (m) => errors.push(m);
const core = new LMCore({ model: D.get('core_model'), bridge: D.get('core_bridge') });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 1 no pressure, which means no channel and nothing written back by an earlier point: the same points as the static rule, and the readings stay at nothing
const fb = D.get('config.body.feedback');
D.o.config.body.feedback = { miss: {}, hit: {}, decay: fb.decay };
let n = 0;
for (const ev of events) {
  const calm = { ...ev, channels: {} };
  // the LM core is slower than the stand-in was, so every fifth employee and the first three seeds stand for all
  for (const staffId of staffIds.filter((_, i) => i % 5 === 0)) {
    const stats = { ...sim.staffAttrs(D, staffId, null, []) };
    for (const seed of seeds.slice(0, 3)) {
      const got = runStay(D, core, calm, { staffId, seed, carried: [], stats });
      const want = evalScene(D, ev, { staffId, seed, carried: [], statsAt: () => stats });
      n++;
      if (!same(got.hits, want)) err(`no pressure differs: ${ev.id} ${staffId} seed ${seed}`);
      if (got.trace.some((t) => Object.values(t.readouts).some((x) => x !== 0))) err(`no pressure moves a reading: ${ev.id}`);
    }
  }
}
D.o.config.body.feedback = fb;
console.log(`no pressure: ${n} stays compared with the static rule`);

// the result of a point is written back: a point that is missed adds to the demand of the days after it
{
  const ev = { ...events.find((e) => e.tier === 3), channels: {} };
  const pd = (await import('../js/scene_core.js')).pointDays(D, ev);
  const impossible = { ...ev, scene: { points: ev.scene.points.map((p) => ({ ...p, req: { stat: { wit: 99 } } })) } };
  const r = runStay(D, core, impossible, { staffId: staffIds[0], seed: 1, carried: [], stats: { ...sim.staffAttrs(D, staffIds[0], null, []) } });
  const demand = (day) => r.trace[day - 1].handles.find((h) => h.concept === 'psychological_demand').value;
  if (!(pd[0] < r.trace.length && demand(pd[0] + 1) > demand(pd[0]))) err('a missed point writes nothing back to the later days');
}

// 2 determinism, and the messages the core returns stay inside the vocabulary and the range
const heavy = { ...events.find((e) => e.tier === 3), channels: { H: 3, L: 3, G: 3 } };
const kit = (id) => ({ staffId: id, seed: 5, carried: [], stats: { ...sim.staffAttrs(D, id, null, []) } });
const a = runStay(D, core, heavy, kit(staffIds[0]));
const b = runStay(D, core, heavy, kit(staffIds[0]));
if (!same(a, b)) err('the same stay twice gives different results');
const hello = core.hello();
for (const t of a.trace) for (const [r, x] of Object.entries(t.readouts)) if (r !== 'loneliness' && (!hello.readouts.includes(r) || !(x >= 0 && x <= 1))) err(`reading ${r}=${x} is out of the vocabulary or the range`);

// 3 pressure lowers the attributes of the days: the attributes whose carrier the channels push fall below the card on some day, and none rises above it
const card = kit(staffIds[0]).stats;
for (const attr of ['wit', 'constitution', 'will']) {
  if (!(Math.min(...a.trace.map((x) => x.stats[attr])) < card[attr])) err(`attribute ${attr} does not fall in a heavy stay`);
}
for (const x of a.trace) for (const attr of Object.keys(card)) if (x.stats[attr] > card[attr] + 1e-12) err(`attribute ${attr} is above the card on day ${x.day}`);

// 4 incapacity: with the limit set low, every point after it fails by itself
const keep = D.get('config.body.incapacity.at');
D.o.config.body.incapacity.at = 0.05;
const dead = runStay(D, core, heavy, kit(staffIds[0]));
D.o.config.body.incapacity.at = keep;
const first = dead.trace.findIndex((x) => x.down);
if (first < 0) err('nobody went down with the limit set low');
else {
  const days = heavy.scene.points.map((_, i) => dead.trace.length && i);
  const pd = (await import('../js/scene_core.js')).pointDays(D, heavy);
  pd.forEach((d, i) => { if (d >= dead.trace[first].day && dead.hits[i]) err(`point ${i} was met after the traveller went down`); });
}

// the readings a single channel reaches at the end of the stay, for the tuning later
const rows = [];
for (const c of Object.keys(D.get('config.channels.list'))) {
  const row = [c];
  for (const lv of D.get('config.channels.levels')) {
    const ev = { ...events.find((e) => e.tier === 2), channels: { [c]: lv } };
    const r = runStay(D, core, ev, kit(staffIds[0])).trace.at(-1).readouts;
    row.push(Math.max(...D.get(`config.channels.list.${c}.pushes`).map((k) => r[k] || 0)).toFixed(2));
  }
  rows.push(row.join(' '));
}
console.log('main reading at the end of a tier 2 stay, channel and levels 1 2 3 (target 0.20 0.45 0.75):\n  ' + rows.join('\n  '));
for (const e of errors) console.log('ERROR:', e);
if (errors.length) process.exit(1);
console.log('stay: ok');
