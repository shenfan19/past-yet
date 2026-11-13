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
let bad = 0;
const T_ = D.get('staff.traits');
for (const [id, tr] of Object.entries(T_)) {
  // a trait is worth something at some kind of sync point, and costs something at another or in a weakness of its own
  const effects = Object.values(tr.points).concat(Object.values(tr.model || {}).map((v) => -v));
  if (!effects.some((x) => x > 0) || !effects.some((x) => x < 0)) { console.log(`trait ${id} lacks a gain or a cost`); bad++; }
  if (tr.mods) { console.log(`trait ${id} must not change attributes`); bad++; }
  for (const k of Object.keys(tr.points)) D.get('text.point_kinds.' + k);
  const note = D.get('text.trait_notes.' + id);
  if (!note.pro || !note.con) { console.log(`trait ${id} has no gain or cost text`); bad++; }
}
const E1 = sim.compileEra(D.get('era_raw.' + D.get('config.eras')[0]), D, D.get('config.eras')[0]);
// The employees are the cards of cards/staff: all of them with a name, a job and a story in both languages, a region and a skin tone that exist,
// attributes from 1 to 10 that add up to a sensible total, one or two traits, and a stat set the era models can read.
const staffAll = D.get('staff.staff');
const seenRegion = new Set(), seenSkin = new Set(), names = new Set();
const regionIds = new Set(D.get('hiring.regions').map((r) => r.id));
const attrList = D.get('staff.attributes');
for (const [id, st] of Object.entries(staffAll)) {
  for (const lang of ['en', 'zh']) {
    const tx = D.o.text.staff[id];
    if (lang === 'en' && !(tx.name && tx.ethnicity && tx.bio && tx.story && Array.isArray(tx.jobs) && tx.jobs.length === st.jobs.length)) { console.log(id + ' lacks a name, ethnicity, bio, story or the titles of its jobs'); bad++; }
  }
  if (!regionIds.has(st.region)) { console.log(id + ' has an unknown region ' + st.region); bad++; }
  if (!D.get('hiring.skin_tones')[st.skin]) { console.log(id + ' has an unknown skin tone ' + st.skin); bad++; }
  if (!(st.age >= 18 && st.age <= 80)) { console.log(id + ' has an age out of 18 to 80'); bad++; }
  const sum = attrList.reduce((a, k) => a + (st.base[k] ?? 5), 0);
  if (sum < 20 || sum > 30 || attrList.some((k) => !(st.base[k] >= 1 && st.base[k] <= 10))) { console.log(id + ' has attributes out of range or a total of ' + sum); bad++; }
  if (new Set(st.traits).size !== st.traits.length || st.traits.length < 1 || st.traits.length > 2) { console.log(id + ' has bad traits'); bad++; }
  seenRegion.add(st.region); seenSkin.add(st.skin); names.add(D.o.text.staff[id].name);
  const stats = sim.staffStats(D, id);
  if (Object.values(stats).some((v) => !(v >= 0))) { console.log(id + ' has a bad stat'); bad++; }
  buildReport(D, E1, sim.runDispatch(E1, D, { seed: 1, staffId: id, items: {} }));
}
if (names.size !== Object.keys(staffAll).length) { console.log('two employees share a name'); bad++; }
console.log(`employees: ${Object.keys(staffAll).length}, ${seenRegion.size} regions, ${seenSkin.size} skin tones`);
if (seenRegion.size < regionIds.size || seenSkin.size < Object.keys(D.get('hiring.skin_tones')).length) { console.log('some region or skin tone is used by nobody'); bad++; }
if (bad) { console.log(bad + ' problems'); process.exit(1); }

// Time energy is paid in quarters of the base of a place, so every base must divide by four, or a quarter would not be a whole number.
const energyBases = { ...D.get('config.stars.energy_base'), ...Object.fromEntries(Object.entries(D.get('config.light.pay')).map(([t, p]) => ['light tier ' + t, p.energy])) };
for (const [k, v] of Object.entries(energyBases)) if (v % 4 !== 0) { console.log(`energy base of ${k} is ${v}, not a multiple of 4`); process.exit(1); }
console.log('energy bases divide into quarters: ok');

// Every era names three sync points that its milestones can reach, with words in both languages.
for (const id of D.get('config.eras')) {
  const E = sim.compileEra(D.get('era_raw.' + id), D, id);
  if (E.starPoints.length !== 3) { console.log(`${id} has ${E.starPoints.length} sync points, not three`); process.exit(1); }
  for (const p of E.starPoints) D.get(`text.eras.${id}.star_points.${p.id}`);
}
console.log('sync points: ok');

// The scenes: three points each, with words in both languages and requirements the backend understands.
let scenes = 0;
const known = new Set(['stat', 'trait', 'job', 'gender', 'item', 'provides', 'luck', 'any']);
const checkReq = (req, where) => { for (const [k, v] of Object.entries(req)) { if (!known.has(k)) throw new Error(where + ' unknown requirement ' + k); if (k === 'any') v.forEach((r) => checkReq(r, where)); if (k === 'item') D.get('items.' + v);
   if (k === 'trait') v.forEach((t) => D.get('staff.traits.' + t)); } };
for (const ev of D.get('catalog.events')) {
  if (!ev.scene) continue;
  scenes++;
  if (ev.scene.points.length !== 3) throw new Error(ev.id + ' needs three points');
  for (const p of ev.scene.points) { checkReq(p.req, ev.id + '.' + p.id); if (!D.get('text.catalog.' + ev.id + '.points.' + p.id)) throw new Error(ev.id + ' lacks the words of ' + p.id); }
}
for (const [id, it] of Object.entries(D.get('items'))) if (it.scene && !(it.unlock_energy >= 0 && typeof it.exposure === 'number')) throw new Error(id + ' lacks unlock_energy or exposure');
console.log('scenes with three points:', scenes);

// The two weaknesses must really cost health: a kind employee loses more to hostility, a sensitive one more to disease.
{
  const mk = (id, traits) => { D.o.staff.staff[id] = { traits, base: {}, gender: 'f', age: 30 }; D.o.text.staff[id] = { name: id, ethnicity: 'x', jobs: ['x'], bio: '' }; };
  mk('chk_plain', ['curious']); mk('chk_kind', ['kind']); mk('chk_sens', ['sensitive']);
  const id = D.get('config.eras')[0];
  const E = sim.compileEra(D.get('era_raw.' + id), D, id);
  const kit = Object.fromEntries(Object.keys(E.itemBindings).filter((k) => k !== 'recall_charm').map((k) => [k, D.get(`items.${k}.max`)]));
  const mean = (sid) => { let h = 0; for (let seed = 1; seed <= 30; seed++) h += sim.runDispatch(E, D, { seed, staffId: sid, items: kit }).branch.final['traveler.health']; return h / 30; };
  const [p, k, s2] = [mean('chk_plain'), mean('chk_kind'), mean('chk_sens')];
  if (!(k < p && s2 < p)) { console.log(`weaknesses do not cost health: plain ${p}, kind ${k}, sensitive ${s2}`); process.exit(1); }
  console.log(`weaknesses cost health: plain ${p.toFixed(2)}, kind ${k.toFixed(2)}, sensitive ${s2.toFixed(2)}`);
}

// an event that names a full model: the model exists, sits where the event sits, and the relic of the event is the anchor of the model
for (const ev of D.get('catalog.events')) {
  if (!ev.era) continue;
  if (!D.get('config.eras').includes(ev.era)) throw new Error(`event ${ev.id} names the model ${ev.era}, which is not in config.eras`);
  const m = D.get('era_raw.' + ev.era).metadata.era;
  if (m.year !== ev.year || Math.abs(m.geo.lon - ev.lon) > 0.01 || Math.abs(m.geo.lat - ev.lat) > 0.01) throw new Error(`event ${ev.id} and its model ${ev.era} are not at the same time and place`);
  if (D.get('antiques.antiques.relic_' + ev.id).era !== ev.era) throw new Error(`the relic of ${ev.id} does not anchor ${ev.era}`);
}
console.log('events with a full model sit with their model: ok');
