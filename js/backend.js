// The one door between the interface and the engine. The interface asks this object for results and shows them, it never runs the
// simulation itself and reads only the plain fields listed in eraInfo. This local version calls the engine in the same page.
// A server version would offer the same methods over fetch, with the yaml data and the engine on the server, and the page would only carry data.
import * as sim from './sim.js';
import { buildReport } from './narrate.js';
import { draw } from './rng.js';

export function createLocalBackend(D) {
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
  function findAntique(eraId, seed, held = []) {
    const { p, list } = findOdds(eraId);
    if (!list.length || draw(seed, 'antique_find', eraId) >= p) return null;
    const all = D.get('antiques.antiques');
    const wt = (x) => x.w * (all[x.id].era && !held.includes(x.id) ? AF.modelled_place_boost : 1);
    const total = list.reduce((a, x) => a + wt(x), 0);
    let at = draw(seed, 'antique_pick', eraId) * total;
    for (const x of list) { at -= wt(x); if (at < 0) return x.id; }
    return list[list.length - 1].id;
  }
  // ---------- hiring pool ----------
  // A candidate is made from the draws of one serial number: a region and with it a name, a skin tone, a gender, an age, a job,
  // base abilities, and two or three traits. Every trait has a gain and a cost, so a candidate is a trade off, not a ranking.
  const HI = D.get('hiring');
  const pickOf = (arr, serial, key) => arr[Math.min(arr.length - 1, Math.floor(draw(serial, key, 0) * arr.length))];
  const weighted = (obj, serial, key) => {
    const total = Object.values(obj).reduce((a, x) => a + x, 0);
    let at = draw(serial, key, 0) * total;
    for (const [k, w] of Object.entries(obj)) { at -= w; if (at < 0) return k; }
    return Object.keys(obj)[0];
  };
  const range = (lo, hi, serial, key) => Math.round((lo + draw(serial, key, 0) * (hi - lo)) * 100) / 100;
  // one candidate: either one of the hand written employees that is still free, or a made one
  function makeCandidate(serial, freeNamed) {
    if (freeNamed.length && draw(serial, 'named', 0) < HI.named_share) return { id: pickOf(freeNamed, serial, 'named_pick') };
    const region = pickOf(HI.regions, serial, 'region');
    const gender = draw(serial, 'gender', 0) < 0.5 ? 'f' : 'm';
    const given = pickOf(gender === 'f' ? region.f : region.m, serial, 'given');
    const family = pickOf(region.family, serial, 'family');
    const job = pickOf(HI.jobs, serial, 'job');
    const traitIds = Object.keys(D.get('staff.traits'));
    const n = HI.traits_per.min + Math.floor(draw(serial, 'trait_n', 0) * (HI.traits_per.max - HI.traits_per.min + 1));
    const traits = [];
    for (let i = 0; traits.length < n && i < 50; i++) {
      const t = traitIds[Math.min(traitIds.length - 1, Math.floor(draw(serial, 'trait', i) * traitIds.length))];
      if (!traits.includes(t)) traits.push(t);
    }
    const base = Object.fromEntries(Object.entries(HI.base).map(([k, [lo, hi]]) => [k, Math.round(range(lo, hi, serial, 'base_' + k))]));
    const name = (lang) => (lang === 'zh' && region.order === 'zh_family_first' ? family[1] + given[1] : lang === 'zh' ? given[1] + region.join + family[1] : given[0] + ' ' + family[0]);
    return {
      id: 'g' + serial,
      def: {
        generated: true, job_id: job.id, gender, age: Math.floor(range(HI.age.min, HI.age.max + 1, serial, 'age')), base, traits, start_hired: false,
        region: region.id, skin: weighted(region.tones, serial, 'skin'),
        text: {
          en: { name: name('en'), job: job.text.en, bio: 'From ' + region.text.en + '.' },
          zh: { name: name('zh'), job: job.text.zh, bio: '来自' + region.text.zh + '。' },
        },
      },
    };
  }
  // a recall is only a request. Someone who has decided to stay does not come, and a trait can make that more or less likely
  function recallRefused(staffId, seed, outcomeId) {
    if (outcomeId === HI.recall.stay_outcome) return true;
    const sum = D.get('staff.staff.' + staffId + '.traits').reduce((a, t) => a + (D.get('staff.traits.' + t).recall_refuse || 0), HI.recall.refuse_base);
    return draw(seed, 'recall_refuse', staffId) < Math.min(1, Math.max(0, sum));
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
  // A scene has three authored points, each a requirement on the traveller: abilities, traits, the job, being a woman, an item carried, or luck.
  // Special equipment raises abilities and satisfies item points, but it shows, and a scene can find the traveller out.
  const SC = D.get('config.scene');
  function runScene(ev, staffId, seed, items) {
    const staff = D.get('staff.staff.' + staffId);
    const stats = { ...sim.staffAttrs(D, staffId) };
    const carried = Object.entries(items || {}).filter(([id, n]) => n > 0 && D.get('items.' + id).scene).map(([id]) => id);
    let exposure = 0;
    for (const id of carried) {
      const it = D.get('items.' + id);
      exposure += it.exposure;
      for (const [k, m] of Object.entries(it.stat_mult || {})) stats[k] *= m;
    }
    const meets = (req) => Object.entries(req).every(([k, v]) => {
      if (k === 'stat') return Object.entries(v).every(([s, min]) => stats[s] >= min);
      if (k === 'trait') return v.some((t) => staff.traits.includes(t));
      if (k === 'job') return v.includes(staff.job_id);
      if (k === 'gender') return staff.gender === v;
      if (k === 'item') return carried.includes(v);
      if (k === 'luck') return draw(seed, 'scene_luck_' + JSON.stringify(req), ev.id) < v;
      if (k === 'any') return v.some(meets);
      throw new Error('unknown requirement ' + k);
    });
    const points = applyBonus(ev.scene.points.map((p) => ({ id: p.id, hit: meets(p.req) })), ev.scene.points.map((p) => p.kind), staffId, seed, ev.id);
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
      funds: Math.round(pay.funds * SC.share[stars]), energyBase: pay.energy, restDays: L.rest_days[stars >= 2 ? 'success' : stars === 1 ? 'partial' : 'missed'] + (f ? f.rest_days : 0), stay: lightStay(ev.id) };
  }
  function runLight(eventId, staffId, seed, items) {
    const ev = lightEvent(eventId);
    if (ev.scene) {
      const r = runScene(ev, staffId, seed, items);
      return { ...r, outcome: r.stars >= 2 ? 'success' : r.stars === 1 ? 'partial' : 'missed' };
    }
    const stats = sim.staffAttrs(D, staffId);
    const score = Object.entries(L.field_weights[ev.field]).reduce((a, [k, w]) => a + w * stats[k] / 10, 0);
    const margin = score + L.noise * (2 * draw(seed, 'light', eventId) - 1) - (L.difficulty.base + L.difficulty.per_tier * ev.tier);
    const points = applyBonus([margin >= L.cuts.reach, margin >= L.cuts.meet, margin >= L.cuts.impress].map((hit, i) => ({ id: ['reach', 'meet', 'impress'][i], hit })), L.kinds, staffId, seed, eventId);
    const stars = points.filter((p) => p.hit).length;
    const outcome = stars >= 2 ? 'success' : stars === 1 ? 'partial' : 'missed';
    const pay = L.pay[ev.tier];
    return { outcome, stars, points, funds: Math.round(pay.funds * L.share[outcome]), energyBase: pay.energy, restDays: L.rest_days[outcome], stay: lightStay(eventId) };
  }
  const recallKeeps = (seed, share) => draw(seed, 'recall_keep', 0) < share;
  return {
    runLight, lightStay, makeCandidate, recallRefused, recallKeeps,
    findOdds, findAntique,
    eraInfo: (id) => info[id],
    staffStats: (staffId) => sim.staffAttrs(D, staffId),
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
