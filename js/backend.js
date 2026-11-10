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
    const here = placeOf({ era: eraId });
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
  // A key antique to a place the office cannot reach yet is favoured by new_key_boost when it is drawn, so the way on is not buried under the many relics of events that have no model.
  function findAntique(eraId, seed, held = []) {
    const { p, list } = findOdds(eraId);
    if (!list.length || draw(seed, 'antique_find', eraId) >= p) return null;
    const all = D.get('antiques.antiques');
    const wt = (x) => x.w * (all[x.id].era && !held.includes(x.id) ? AF.new_key_boost : 1);
    const total = list.reduce((a, x) => a + wt(x), 0);
    let at = draw(seed, 'antique_pick', eraId) * total;
    for (const x of list) { at -= wt(x); if (at < 0) return x.id; }
    return list[list.length - 1].id;
  }
  return {
    findOdds, findAntique,
    eraInfo: (id) => info[id],
    staffStats: (staffId) => sim.staffStats(D, staffId),
    staffHabit: (staffId) => sim.staffHabit(D, staffId),
    itemTotals: (items) => sim.itemTotals(D, items),
    // returns an error code, or null when the dispatch is allowed
    validate: (eraId, spec, stock) => sim.validateSpec(eras[eraId], D, spec, stock),
    // runs one dispatch and returns the raw result and the written report
    dispatch: (eraId, spec) => {
      const res = sim.runDispatch(eras[eraId], D, spec);
      return { res, report: buildReport(D, eras[eraId], res) };
    },
    // searches item sets and returns the Pareto front and the recommended one
    suggest: (eraId, spec, stock) => sim.optimize(eras[eraId], D, { spec, stock }),
  };
}
