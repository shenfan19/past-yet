// Sweep every era over staff and a few kits. Builds each report so a missing text key or
// template variable fails here instead of in front of a player. Usage: node tools/check_content.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import * as sim from '../js/sim.js';
import { buildReport, stratText, itemText } from '../js/narrate.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => process.env.GAME_LANG || 'en');
let n = 0;
const outcomes = {};
for (const id of D.get('config.eras')) {
  const E = sim.compileEra(D.get('era_raw.' + id), D, id);
  const bound = Object.keys(E.itemBindings);
  const kits = [{}, Object.fromEntries(bound.filter((k) => D.get(`items.${k}.kind`) === 'consumable').map((k) => [k, 10])), Object.fromEntries(bound.filter((k) => D.get(`items.${k}.kind`) === 'consumable').map((k) => [k, D.get(`items.${k}.max`)])), Object.fromEntries(bound.map((k) => [k, D.get(`items.${k}.max`) > 1 ? 10 : 1])), Object.fromEntries(bound.filter((k) => k !== 'recall_charm').map((k) => [k, D.get(`items.${k}.max`)]))];
  for (const staffId of Object.keys(D.get('staff.staff'))) {
    for (const items of kits) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const res = sim.runDispatch(E, D, { seed, staffId, items });
        buildReport(D, E, res);
        const k = id + ':' + res.outcome;
        outcomes[k] = (outcomes[k] || 0) + 1;
        n++;
      }
    }
    const h = sim.staffHabit(D, staffId);
    stratText(D, id, 'focus', h.focus);
    stratText(D, id, 'on_block', h.on_block);
  }
  for (const item of bound) itemText(D, id, item);
}
console.log('reports built:', n);
console.log(JSON.stringify(outcomes));

// Every trait must give something and cost something, and say so in both languages.
// A stat counts as a gain when it goes up, except the two where less is better.
const lessIsBetter = new Set(['homesick_trait', 'greed']);
let bad = 0;
const T_ = D.get('staff.traits');
for (const [id, tr] of Object.entries(T_)) {
  const effects = Object.entries(tr.mods).map(([k, v]) => (lessIsBetter.has(k) ? -v : v));
  for (const [k, v] of Object.entries(tr.secretary || {})) effects.push(v);
  if (tr.recall_refuse !== undefined) effects.push(-tr.recall_refuse);
  if (!effects.some((x) => x > 0) || !effects.some((x) => x < 0)) { console.log(`trait ${id} lacks a gain or a cost`); bad++; }
  const note = D.get('text.trait_notes.' + id);
  if (!note.pro || !note.con) { console.log(`trait ${id} has no gain or cost text`); bad++; }
}
// Made candidates: a thousand of them must build, carry both languages, and run a trip without a missing key.
const { createLocalBackend } = await import('../js/backend.js');
const B = createLocalBackend(D);
const E1 = sim.compileEra(D.get('era_raw.' + D.get('config.eras')[0]), D, D.get('config.eras')[0]);
const free = Object.keys(D.get('staff.staff'));
const seenRegion = new Set(), seenSkin = new Set(), names = new Set();
for (let serial = 1; serial <= 1000; serial++) {
  const c = B.makeCandidate(serial, []);
  const def = c.def;
  if (!def.text.en.name || !def.text.zh.name || !def.text.en.job || !def.text.zh.job) { console.log('candidate ' + serial + ' lacks a name or job'); bad++; }
  if (new Set(def.traits).size !== def.traits.length || def.traits.length < 2) { console.log('candidate ' + serial + ' has bad traits'); bad++; }
  seenRegion.add(def.region); seenSkin.add(def.skin); names.add(def.text.en.name);
  if (serial <= 60) {
    const { text, ...rest } = def;
    D.o.staff.staff[c.id] = rest; D.o.text.staff[c.id] = text.en;
    const st = sim.staffStats(D, c.id);
    if (Object.values(st).some((v) => !(v >= 0))) { console.log('candidate ' + serial + ' has a bad stat'); bad++; }
    buildReport(D, E1, sim.runDispatch(E1, D, { seed: serial, staffId: c.id, items: {} }));
  }
}
console.log(`candidates: ${seenRegion.size} regions, ${seenSkin.size} skin tones, ${names.size} different names in 1000`);
if (seenRegion.size < D.get('hiring.regions').length || seenSkin.size < Object.keys(D.get('hiring.skin_tones')).length) { console.log('some region or skin tone never comes up'); bad++; }
if (bad) { console.log(bad + ' problems'); process.exit(1); }

// Time energy is paid in quarters of the base of a place, so every base must divide by four, or a quarter would not be a whole number.
const energyBases = { ...D.get('config.stars.energy_base'), ...Object.fromEntries(Object.entries(D.get('config.light.pay')).map(([t, p]) => ['light tier ' + t, p.energy])) };
for (const [k, v] of Object.entries(energyBases)) if (v % 4 !== 0) { console.log(`energy base of ${k} is ${v}, not a multiple of 4`); process.exit(1); }
console.log('energy bases divide into quarters: ok');
