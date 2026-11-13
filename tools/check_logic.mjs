// Logic audit of the content: traits, employees, scenes, items and events must be usable, reasonable and free of dead or duplicated parts.
// Usage: node tools/check_logic.mjs. Exits 1 on an error, warnings are listed but do not fail.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const load = (lang) => loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => lang);
const D = await load('en');
const errors = [];
const warns = [];
const err = (m) => errors.push(m);
const warn = (m) => warns.push(m);

const staff = D.get('staff.staff');
const traits = D.get('staff.traits');
const items = D.get('items');
const events = D.get('catalog.events');
const cfg = D.get('config');
const attrs = D.get('staff.attributes');
const jobs = new Set(Object.values(staff).flatMap((s) => s.jobs));

// point kinds: every kind a scene or an era model asks for, and which traits give or cost it
const sceneEvents = events.filter((e) => e.scene);
const kinds = new Set(cfg.light.kinds);
for (const e of sceneEvents) for (const p of e.scene.points) kinds.add(p.kind);
for (const id of cfg.eras) for (const p of D.get('era_raw.' + id).star_points) kinds.add(p.kind);
const gives = {}, costs = {};
for (const k of kinds) { gives[k] = []; costs[k] = []; }
for (const [t, tr] of Object.entries(traits)) {
  let g = 0, c = 0;
  for (const [k, v] of Object.entries(tr.points)) {
    if (!kinds.has(k)) { err(`trait ${t}: points key ${k} is not a point kind anyone asks for`); continue; }
    (v > 0 ? gives : costs)[k].push(t);
    v > 0 ? g++ : c++;
  }
  if (!g || !c) err(`trait ${t} has only gains or only costs`);
}
for (const k of kinds) {
  if (!gives[k].length) err(`point kind ${k}: no trait gives it`);
  if (!costs[k].length) warn(`point kind ${k}: no trait costs it, nothing trades against it`);
}

// scenes
const baseOf = (s) => Object.fromEntries(attrs.map((a) => [a, s.base?.[a] ?? 5]));
const sceneItems = Object.entries(items).filter(([, it]) => it.scene).map(([id]) => id);
const subsets = (arr) => arr.reduce((a, x) => a.concat(a.map((s) => [...s, x])), [[]]);
// only the items a scene can use matter to it: those its points name or provide, and those that change attributes. All subsets of every scene item would be far too many.
const statItems = sceneItems.filter((i) => items[i].stat_mult || items[i].stat_add);
const namedIn = (r, out) => { for (const [k, v] of Object.entries(r)) { if (k === 'item') out.add(v); if (k === 'provides') sceneItems.filter((i) => items[i].provides.includes(v)).forEach((i) => out.add(i)); if (k === 'any') v.forEach((x) => namedIn(x, out)); } return out; };
const kitsFor = (e) => { const rel = new Set(statItems); e.scene.points.forEach((p) => namedIn(p.req, rel)); return subsets([...rel]); };
function metBy(req, who, carried) {
  const stats = { ...who.base };
  for (const i of carried) {
    for (const [k, m] of Object.entries(items[i].stat_mult || {})) stats[k] *= m;
    for (const [k, v] of Object.entries(items[i].stat_add || {})) stats[k] += v;
  }
  return Object.entries(req).every(([k, v]) => {
    if (k === 'stat') return Object.entries(v).every(([s, min]) => stats[s] >= min);
    if (k === 'trait') return v.some((t) => who.traits.includes(t));
    if (k === 'job') return who.jobs.some((j) => v.includes(j));
    if (k === 'gender') return D.get('staff.gender_class')[who.gender] === v;
    if (k === 'item') return carried.includes(v);
    if (k === 'provides') return carried.some((i) => items[i].provides.includes(v));
    if (k === 'luck') return true;
    if (k === 'any') return v.some((r) => metBy(r, who, carried));
    err(`unknown requirement ${k}`);
    return false;
  });
}
const handStaff = Object.entries(staff).map(([id, s]) => ({ ...s, id, base: baseOf(s) }));
const starsNoKit = Object.fromEntries(handStaff.map((s) => [s.id, 0]));
const fullAny = Object.fromEntries(handStaff.map((s) => [s.id, 0]));
const fullNoKit = Object.fromEntries(handStaff.map((s) => [s.id, 0]));
const traitUse = Object.fromEntries(Object.keys(traits).map((t) => [t, 0]));
const jobUse = {};
const itemUse = Object.fromEntries(sceneItems.map((i) => [i, 0]));
const kindUse = {};
let fullByHand = 0;
const walk = (e, r) => {
  for (const [k, v] of Object.entries(r)) {
    if (k === 'trait') v.forEach((t) => { if (!traits[t]) err(`scene ${e.id}: unknown trait ${t}`); else traitUse[t]++; });
    if (k === 'job') v.forEach((j) => { jobUse[j] = (jobUse[j] || 0) + 1; if (!jobs.has(j)) err(`scene ${e.id}: nobody can have the job ${j}`); });
    if (k === 'item') { if (!items[v]) err(`scene ${e.id}: unknown item ${v}`); else { if (!items[v].scene) err(`scene ${e.id}: item ${v} is not a scene item`); itemUse[v] = (itemUse[v] || 0) + 1; } }
    if (k === 'provides') { const who = sceneItems.filter((i) => items[i].provides.includes(v)); if (!who.length) err('scene ' + e.id + ': no item provides ' + v); who.forEach((i) => itemUse[i]++); }
    if (k === 'any') v.forEach((x) => walk(e, x));
    if (k === 'stat') Object.keys(v).forEach((s) => { if (!attrs.includes(s)) err(`scene ${e.id}: unknown attribute ${s}`); });
  }
};
for (const e of sceneEvents) {
  const pts = e.scene.points;
  if (pts.length !== 3) err(`scene ${e.id} has ${pts.length} points, not 3`);
  if (new Set(pts.map((p) => p.id)).size !== pts.length) err(`scene ${e.id}: duplicate point ids`);
  const allKits = kitsFor(e);
  pts.forEach((p) => { walk(e, p.req); kindUse[p.kind] = (kindUse[p.kind] || 0) + 1; });
  pts.forEach((p) => { if (!handStaff.some((s) => allKits.some((k) => metBy(p.req, s, k)))) err(`scene ${e.id} point ${p.id} (${p.kind}) cannot be met by any hand written employee with any kit`); });
  // a point that does not name an item or a gender must be reachable with nothing in the kit by someone on the roster
  pts.forEach((p) => { const gated = JSON.stringify(p.req); if (!/item|provides|gender|luck/.test(gated) && !handStaff.some((s) => metBy(p.req, s, []))) err('scene ' + e.id + ' point ' + p.id + ' is gated by equipment the text does not name'); });
  let any3 = false;
  for (const s of handStaff) {
    if (allKits.some((k) => pts.every((p) => metBy(p.req, s, k)))) { any3 = true; fullAny[s.id]++; }
    if (pts.every((p) => metBy(p.req, s, []))) fullNoKit[s.id]++;
    starsNoKit[s.id] += pts.filter((p) => metBy(p.req, s, [])).length;
  }
  if (!any3) err(`scene ${e.id}: nobody on the hand written roster can get three stars`); else fullByHand++;
  if (pts.every((p) => 'luck' in p.req)) warn(`scene ${e.id}: all points are luck`);
}
for (const [t, n] of Object.entries(traitUse)) if (!n) warn(`trait ${t} is asked by no scene point`);
{ const ns = Object.values(traitUse).sort((a, b) => a - b); const med = (ns[2] + ns[3]) / 2; for (const [t, n] of Object.entries(traitUse)) if (n > med * 2) warn(`trait ${t} is asked by ${n} scene points, more than twice the median ${med}, so its holders three star far more scenes`); }
for (const [i, n] of Object.entries(itemUse)) if (!n) warn(`scene item ${i} is asked by no scene point, it only raises abilities`);

// employees
const traitCount = Object.fromEntries(Object.keys(traits).map((t) => [t, 0]));
for (const [id, s] of Object.entries(staff)) {
  if (!(s.jobs.length >= 1 && s.jobs.length <= 3)) err(`staff ${id}: ${s.jobs.length} jobs, not one to three`);
  if (!['f', 'm', 'tf', 'tm', 'x'].includes(s.gender)) err(`staff ${id}: unknown gender ${s.gender}`);
  for (const t of s.traits) { if (!traits[t]) err(`staff ${id}: unknown trait ${t}`); else traitCount[t]++; }
  if (new Set(s.traits).size !== s.traits.length) err(`staff ${id}: repeated trait`);
  for (const [a, v] of Object.entries(s.base || {})) { if (!attrs.includes(a)) err(`staff ${id}: unknown attribute ${a}`); if (v < 1 || v > 10) err(`staff ${id}: ${a} ${v} out of 1 to 10`); }
}
for (const [t, n] of Object.entries(traitCount)) if (!n) err(`trait ${t} is held by no hand written employee`);
const seen = {};
for (const [id, s] of Object.entries(staff)) (seen[s.jobs.join('+') + '|' + [...s.traits].sort().join(',')] ||= []).push(id);
for (const [k, v] of Object.entries(seen)) if (v.length > 1) warn(`staff ${v.join(', ')} share job and traits: ${k}`);
for (const s of handStaff) if (!fullAny[s.id]) warn(`staff ${s.id}: can three star no scene`);
{
  const pool = handStaff.filter((s) => s.start_pool);
  const regions = new Set(pool.map((s) => s.region));
  const O_ = D.get('config.office.start_staff');
  if (regions.size < O_.offer) err(`the start pool spans ${regions.size} regions, fewer than the ${O_.offer} candidates offered`);
  if (O_.pick > O_.offer) err('more employees to pick than candidates offered');
}

// items
const bindingItems = new Set();
for (const id of cfg.eras) for (const k of Object.keys(D.get('era_raw.' + id).item_bindings)) bindingItems.add(k);
for (const [id, it] of Object.entries(items)) {
  if (it.scene) { if (!(it.unlock_energy > 0)) err(`scene item ${id}: no unlock energy`); }
  else if (it.playable && it.shop !== 'future' && !bindingItems.has(id)) warn(`item ${id}: playable but bound by no era model`);
  if (!it.playable && !it.ip) warn(`item ${id}: not playable and no reason given`);
}

// events
const tiers = {};
const fields = new Set(Object.keys(cfg.light.field_weights));
const placeSeen = {};
for (const e of events) {
  tiers[e.tier] = (tiers[e.tier] || 0) + 1;
  if (!e.scene && !fields.has(e.field)) err(`event ${e.id}: field ${e.field} has no weights`);
  if (!cfg.light.pay[e.tier]) err(`event ${e.id}: tier ${e.tier} unpriced`);
  (placeSeen[`${e.year}|${e.lon}|${e.lat}`] ||= []).push(e.id);
}
// regret stories: history cannot be changed, so the stars are a redemption. A regret is a scene with exactly one redeem point, and nothing else has one.
for (const e of events) {
  if (!(Math.abs(e.lon) <= 180 && Math.abs(e.lat) <= 90)) err(`event ${e.id}: coordinates out of range`);
  const redeem = (e.scene?.points || []).filter((p) => p.redeem);
  if (e.regret) {
    if (!e.scene) err(`regret ${e.id} is not a scene`);
    else if (redeem.length !== 1) err(`regret ${e.id} needs exactly one redeem point, has ${redeem.length}`);
    else if (redeem[0].req.luck !== undefined) err(`regret ${e.id}: the redeem point must not be a pure luck roll`);
  } else if (redeem.length) err(`event ${e.id} has a redeem point but is not a regret`);
}
// pressure channels: each event names at most per_event_max of them at the listed levels, items and gear name the channels they work against
const CH = cfg.channels;
const chIds = Object.keys(CH.list);
for (const e of events) {
  if (!e.channels) { err(`event ${e.id}: no channels field`); continue; }
  const ks = Object.keys(e.channels);
  if (ks.length > CH.per_event_max) err(`event ${e.id}: ${ks.length} channels, at most ${CH.per_event_max}`);
  for (const [k, v] of Object.entries(e.channels)) {
    if (!chIds.includes(k)) err(`event ${e.id}: unknown channel ${k}`);
    if (!CH.levels.includes(v)) err(`event ${e.id}: channel ${k} level ${v} is not one of ${CH.levels}`);
  }
}
const chItems = Object.fromEntries(chIds.map((c) => [c, []]));
const chGear = Object.fromEntries(chIds.map((c) => [c, []]));
for (const [id, it] of Object.entries(items)) {
  for (const c of it.channels || []) {
    if (!chIds.includes(c)) { err(`item ${id}: unknown channel ${c}`); continue; }
    (it.scene ? chGear : chItems)[c].push(id);
  }
}
for (const c of chIds) {
  if (chItems[c].length < 3) warn(`channel ${c}: ${chItems[c].length} items work against it, at least 3 are needed (${chItems[c].join(', ')})`);
  if (chGear[c].length < 1) err(`channel ${c}: no gear works against it`);
  for (const [h, byLevel] of Object.entries({ ...(CH.list[c].level || {}), ...(CH.list[c].total || {}), ...(CH.list[c].context || {}) })) {
    for (const l of CH.levels) if (!(l in byLevel)) err(`channel ${c}: handle ${h} has no value for level ${l}`);
  }
}
for (const [t, tr] of Object.entries(traits)) for (const c of Object.keys(tr[CH.trait_resist.field] || {})) if (!chIds.includes(c)) err(`trait ${t}: resists unknown channel ${c}`);
for (const [a, list] of Object.entries(D.get('config.body.carriers'))) if (!attrs.includes(a)) err(`body carriers: unknown attribute ${a}`);
for (const f of fields) if (!events.some((e) => e.field === f)) warn(`field ${f} has weights but no event`);
for (const [, v] of Object.entries(placeSeen)) if (v.length > 1) warn(`events ${v.join(', ')} share one place and year`);

const fmt = (o) => Object.entries(o).map(([k, v]) => `${k}:${v}`).join(' ');
console.log('point kinds in scenes:', fmt(kindUse));
for (const k of kinds) console.log(`  ${k}: gives [${gives[k].join(', ')}] costs [${costs[k].join(', ')}]`);
console.log('trait holders:', fmt(traitCount));
console.log('trait asked in scenes:', fmt(traitUse));
console.log('scene items asked:', fmt(itemUse));
console.log('jobs asked in scenes:', fmt(jobUse));
console.log('tiers:', fmt(tiers), '| scenes', sceneEvents.length, 'of', events.length, '| three star possible by roster', fullByHand);
console.log('stars with no kit:', fmt(starsNoKit));
console.log('scenes three starred with no kit:', fmt(fullNoKit));
console.log('scenes three starred with some kit:', fmt(fullAny));
for (const w of warns) console.log('warn:', w);
for (const e of errors) console.log('ERROR:', e);
if (errors.length) process.exit(1);
console.log('logic: ok');
