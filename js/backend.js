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
  // Each trip may bring back an antique. The chance starts high and falls with every earlier trip to the same place down to a floor,
  // and the same antique can come back twice. The roll is seeded by the dispatch, so a replay finds the same thing.
  const AF = D.get('config.office.antique_find');
  const findChance = (trips) => Math.max(AF.floor, AF.start - AF.step * trips);
  function findAntique(eraId, seed, trips) {
    if (draw(seed, 'antique_find', eraId) >= findChance(trips)) return null;
    const all = D.get('antiques.antiques');
    const ids = Object.keys(all).filter((id) => all[id].playable);
    const keys = ids.filter((id) => all[id].found_in.includes(eraId));
    const relics = ids.filter((id) => all[id].event);
    const pool = keys.length && (!relics.length || draw(seed, 'antique_kind', eraId) >= AF.relic_share) ? keys : relics;
    if (!pool.length) return null;
    return pool[Math.min(pool.length - 1, Math.floor(draw(seed, 'antique_pick', eraId) * pool.length))];
  }
  return {
    findChance, findAntique,
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
