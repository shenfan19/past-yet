// The one door between the interface and the engine. The interface asks this object for results and shows them, it never runs the
// simulation itself and reads only the plain fields listed in eraInfo. This local version calls the engine in the same page.
// A server version would offer the same methods over fetch, with the yaml data and the engine on the server, and the page would only carry data.
import * as sim from './sim.js';
import { buildReport } from './narrate.js';
import { draw } from './rng.js';
import { evalScene } from './scene_core.js';
import { runStay } from './stay.js';
import { createStubCore } from './stub_core.js';

export function createLocalBackend(D, core = createStubCore(D)) {
  const eras = {};
  for (const id of D.get('config.eras')) eras[id] = sim.compileEra(D.get('era_raw.' + id), D, id);
  // the plain data of an era that the interface may read, no functions
  const plain = (E) => ({ id: E.id, raw: E.raw, vars: E.vars, itemBindings: E.itemBindings, plots: E.plots, tech: E.tech, roles: E.roles, report: E.report, tagSource: E.tagSource, calendar: E.calendar });
  const info = Object.fromEntries(Object.entries(eras).map(([id, E]) => [id, plain(E)]));
  // Antique discovery. A trip to an era can bring back an antique from a place near it and from a time before it. Each candidate
  // has a reach w = exp(-years / tau_years - km / tau_km), where years is how far earlier the candidate lies and km is the great circle
  // distance, so the farther in time or space, the less likely. A candidate is found with chance k * w. The trip finds something with
  // chance 1 - the product of (1 - k * w), at most cap, and the one it finds is drawn in proportion to w. The roll is seeded by the dispatch.
  const AF = D.get('config.office.antique_find');
  // Luck is read where a point or an antique is left to chance: a factor on the chance, one at luck 4, more above and less below, never past max_chance.
  const LK = D.get('config.office.luck');
  // what an employee wears is kept in the game state, so the backend asks for it through a function the page sets
  let gearSource = () => [];
  const gearOf = (staffId) => gearSource(staffId) || [];
  const luckFactor = (staffId, mood = null) => LK.base + LK.per_point * sim.staffAttrs(D, staffId, mood, gearOf(staffId)).luck;
  const rad = (x) => (x * Math.PI) / 180;
  const km = (a, b) => {
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
    return 2 * AF.earth_km * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const placeOf = (an) => {
    if (an.era) { const m = info[an.era].raw.metadata.era; return { year: m.year, geo: m.geo }; }
    if (an.event) { const e = D.get('catalog.events').find((x) => x.id === an.event); return { year: e.year, geo: { lon: e.lon, lat: e.lat } }; }
    return null;
  };
  function findOdds(eraId) {
    const here = info[eraId] ? placeOf({ era: eraId }) : placeOf({ event: eraId });
    const all = D.get('antiques.antiques');
    const list = [];
    for (const [id, an] of Object.entries(all)) {
      if (!an.playable) continue;
      const at = placeOf(an);
      if (!at || at.year > here.year) continue;
      list.push({ id, w: Math.exp(-(here.year - at.year) / AF.tau_years - km(here.geo, at.geo) / AF.tau_km) });
    }
    const p = Math.min(AF.cap, 1 - list.reduce((a, x) => a * (1 - AF.k * x.w), 1));
    return { p, list };
  }
  // An antique that points to a place with a simulation, and is not held yet, is favoured by modelled_place_boost when it is drawn, so the way to a place that can be dispatched to is not buried under the many events that have no model yet.
  // The chance is scaled by the stars of the trip: a quarter of it with none, half with one, three quarters with two, all of it with three.
  function findAntique(eraId, seed, held = [], stars = 3, luck = 1) {
    const { p, list } = findOdds(eraId);
    if (!list.length || draw(seed, 'antique_find', eraId) >= Math.min(LK.max_chance, p * AF.star_share[Math.max(0, Math.min(3, stars))] * luck)) return null;
    const all = D.get('antiques.antiques');
    const wt = (x) => x.w * (all[x.id].era && !held.includes(x.id) ? AF.modelled_place_boost : 1);
    const total = list.reduce((a, x) => a + wt(x), 0);
    let at = draw(seed, 'antique_pick', eraId) * total;
    for (const x of list) { at -= wt(x); if (at < 0) return x.id; }
    return list[list.length - 1].id;
  }
  // ---------- hiring ----------
  const HI = D.get('hiring');
  // a recall is only a request. Someone who has decided to stay does not come, and for anyone else the refusal is a roll at the base chance
  function recallRefused(staffId, seed, outcomeId) {
    if (outcomeId === HI.recall.stay_outcome) return true;
    return draw(seed, 'recall_refuse', staffId) < HI.recall.refuse_base;
  }
  // A small story: a catalogue event with no branch simulation. How the trip goes is the traveller's abilities, weighted by the field of the event,
  // against a difficulty that rises with its tier, with a little seeded luck. It pays by outcome and brings nothing else.
  const L = D.get('config.light');
  const lightEvent = (eventId) => D.get('catalog.events').find((x) => x.id === eventId);
  const lightStay = (eventId) => L.stay_by_tier[lightEvent(eventId).tier];
  // A trait is worth something at the sync points. Each point is about one kind of thing, and the traits of the employee add up to a bonus for that kind:
  // a point that was missed is still reached with the chance of the bonus, and a negative bonus loses a point that was reached. The draw is seeded.
  const traitBonus = (staffId, kind) => D.get('staff.staff.' + staffId + '.traits').reduce((a, t) => a + (D.get('staff.traits.' + t).points[kind] || 0), 0);
  function applyBonus(points, kinds, staffId, seed, key) {
    return points.map((p, i) => {
      const b = traitBonus(staffId, kinds[i]);
      const r = draw(seed, 'bonus_' + key + '_' + p.id, 0);
      if (!p.hit && b > 0 && r < Math.min(0.9, b)) return { ...p, hit: true, bonus: true };
      if (p.hit && b < 0 && r < Math.min(0.9, -b)) return { ...p, hit: false, lost: true };
      return p;
    });
  }
  // A scene: three points the traveller meets or does not by what they are, and what they carry. Being found out costs stars, rest and favor.
  const SC = D.get('config.scene');
  // what the traveller has on in a scene: the attributes after the items, the items that count, and how much of it shows
  function sceneKit(staffId, items, favor) {
    const gear = gearOf(staffId);
    const stats = { ...sim.staffAttrs(D, staffId, favor, gear) };
    const carried = [...new Set([...Object.entries(items || {}).filter(([id, n]) => n > 0 && D.get('items.' + id).scene).map(([id]) => id), ...gear])];
    let exposure = 0;
    for (const id of carried) {
      const it = D.get('items.' + id);
      exposure += it.exposure;
      for (const [k, m] of Object.entries(it.stat_mult || {})) stats[k] *= m;
    }
    return { stats, carried, exposure };
  }
  function runScene(ev, staffId, seed, items, favor = null, body = null) {
    const { stats, carried, exposure } = sceneKit(staffId, items, favor);
    // the sync points are met by the scene sub core. With the body on, the stay is stepped through the core of the traveller and each point is met on the attributes of its day;
    // with it off, or when the caller gives its own attributes of the day, the attributes do not change in the stay
    const hits = !body && D.get('config.body.enabled') ? runStay(D, core, ev, { staffId, seed, carried, stats }).hits
      : evalScene(D, ev, { staffId, seed, carried, statsAt: (day) => (body ? body(day, stats) : stats) });
    const points = applyBonus(ev.scene.points.map((p, i) => ({ id: p.id, hit: hits[i], ...(p.redeem ? { redeem: true } : {}) })), ev.scene.points.map((p) => p.kind), staffId, seed, ev.id);
    let stars = points.filter((p) => p.hit).length;
    // being found out: the more equipment shows and the more suspicious the time, the likelier
    const chance = Math.min(SC.max_discovery, Math.max(0, exposure) * SC.suspicion_by_tier[ev.tier]);
    let found = null;
    if (carried.length && draw(seed, 'scene_found', ev.id) < chance) {
      const r = draw(seed, 'scene_found_kind', ev.id);
      found = Object.keys(SC.found).find((k) => r < SC.found[k].at);
    }
    const f = found ? SC.found[found] : null;
    if (f) stars = Math.max(0, stars - f.stars_cost);
    const pay = L.pay[ev.tier];
    return { points, stars, found, keepAntique: f ? f.keep_antique : true, extraRest: f ? f.rest_days : 0, extraFavor: f ? f.favor : 0,
      energyBase: pay.energy, restDays: L.rest_days[stars >= 2 ? 'success' : stars === 1 ? 'partial' : 'missed'] + (f ? f.rest_days : 0), stay: lightStay(ev.id) };
  }
  function runLight(eventId, staffId, seed, items, favor = null) {
    const ev = lightEvent(eventId);
    if (ev.scene) {
      const r = runScene(ev, staffId, seed, items, favor);
      return { ...r, outcome: r.stars >= 2 ? 'success' : r.stars === 1 ? 'partial' : 'missed' };
    }
    const stats = sim.staffAttrs(D, staffId, favor, gearOf(staffId));
    const score = Object.entries(L.field_weights[ev.field]).reduce((a, [k, w]) => a + w * stats[k] / 10, 0);
    const margin = score + L.noise * (2 * draw(seed, 'light', eventId) - 1) - (L.difficulty.base + L.difficulty.per_tier * ev.tier);
    const points = applyBonus([margin >= L.cuts.reach, margin >= L.cuts.meet, margin >= L.cuts.impress].map((hit, i) => ({ id: ['reach', 'meet', 'impress'][i], hit })), L.kinds, staffId, seed, eventId);
    const stars = points.filter((p) => p.hit).length;
    const outcome = stars >= 2 ? 'success' : stars === 1 ? 'partial' : 'missed';
    const pay = L.pay[ev.tier];
    return { outcome, stars, points, energyBase: pay.energy, restDays: L.rest_days[outcome], stay: lightStay(eventId) };
  }
  // The market price factor of an antique on a day: one seeded draw per field and per period, so every antique of a field moves together.
  const MK = D.get('config.office.market');
  const marketMult = (antiqueId, dayNo) => 1 + MK.amp * (2 * draw(Math.floor(dayNo / MK.period_days), 'market', D.get('antiques.antiques.' + antiqueId).tags[0]) - 1);
  const recallKeeps = (seed, share) => draw(seed, 'recall_keep', 0) < share;
  return {
    runLight, lightStay, marketMult, luckFactor, recallRefused, recallKeeps,
    // the stay of a traveller through the body, for the tools and the report: which points were met and the body day by day
    runStay: (eventId, staffId, seed, items, favor = null) => runStay(D, core, lightEvent(eventId), { staffId, seed, ...sceneKit(staffId, items, favor) }),
    findOdds, findAntique,
    // the year of a simulated place or a catalogue event, and a seeded pick from a list, both for the auto mode
    placeYear: (id) => (info[id] ? placeOf({ era: id }) : placeOf({ event: id })).year,
    pick: (list, seed, key) => list[Math.min(list.length - 1, Math.floor(draw(seed, key, 0) * list.length))],
    eraInfo: (id) => info[id],
    staffStats: (staffId, mood = null) => sim.staffAttrs(D, staffId, mood, gearOf(staffId)),
    staffBase: (staffId) => sim.staffAttrs(D, staffId),
    setGearSource: (fn) => { gearSource = fn; },
    staffHabit: (staffId) => sim.staffHabit(D, staffId),
    itemTotals: (items) => sim.itemTotals(D, items),
    // returns an error code, or null when the dispatch is allowed
    validate: (eraId, spec, stock) => sim.validateSpec(eras[eraId], D, spec, stock),
    // runs one dispatch and returns the raw result and the written report
    dispatch: (eraId, spec) => {
      const res = sim.runDispatch(eras[eraId], D, spec);
      const report = buildReport(D, eras[eraId], res);
      report.points = applyBonus(report.points, eras[eraId].starPoints.map((p) => p.kind), spec.staffId, spec.seed, eraId);
      report.stars = report.points.filter((p) => p.hit).length;
      return { res, report };
    },
    // searches item sets and returns the Pareto front and the recommended one
    suggest: (eraId, spec, stock) => sim.optimize(eras[eraId], D, { spec, stock }),
  };
}
