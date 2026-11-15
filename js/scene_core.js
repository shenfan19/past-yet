// The scene sub core. A scene is a small model in the shape of an LM model: parameters, and one indicator variable per sync point,
// each an expression over the parameters. The parameters are 0 or 1 for what the traveller is and carries (trait, job, gender, item, provides),
// the attributes of the day, and a seeded draw for each point that is left to luck. The stars are the sum of the indicators.
// The expressions run on the same compiler as the era models (expr.js), so this is not an LM engine, it is the game's own evaluator of a scene written in the LM format.
// It knows nothing about the body: the attributes of the day come in from outside, so a traveller who falls ill later in the stay meets the later points on lower attributes.
import { compile } from './expr.js';
import { draw } from './rng.js';
import { historicalDays } from './travel_time.js';

const num = (v) => String(v);
const cache = new Map();

// the model of a scene as plain data: the point list with its day, and one expression per point
export function sceneModel(D, ev) {
  const names = new Set();
  const rolls = [];
  const flag = (prefix, id) => { const n = prefix + id; names.add(n); return n; };
  const expr = (req) => {
    const parts = Object.entries(req).map(([k, v]) => {
      if (k === 'stat') return Object.entries(v).map(([s, min]) => { names.add(s); return `${s} >= ${num(min)}`; }).join(' and ');
      if (k === 'trait') return '(' + v.map((t) => flag('trait_', t)).join(' or ') + ')';
      if (k === 'job') return '(' + v.map((j) => flag('job_', j)).join(' or ') + ')';
      if (k === 'gender') return flag('gender_', v);
      if (k === 'item') return flag('item_', v);
      if (k === 'provides') return flag('has_', v);
      if (k === 'luck') {
        const name = 'roll_' + rolls.length;
        rolls.push({ name, key: 'scene_luck_' + JSON.stringify(req) });
        names.add(name); ['luck', 'luck_base', 'luck_per', 'luck_max'].forEach((n) => names.add(n));
        return `${name} < min(luck_max, ${num(v)} * (luck_base + luck_per * luck))`;
      }
      if (k === 'any') return '(' + v.map(expr).join(' or ') + ')';
      throw new Error('unknown requirement ' + k);
    });
    return parts.length ? parts.join(' and ') : 'true';
  };
  const stay = historicalDays(D, ev.stay || D.get('config.light.stay_by_tier.' + ev.tier));
  const share = D.get('config.scene.point_share.' + ev.scene.points.length);
  // a point falls on its share of the stay, or on the day of the stay its card names, when the story ties it to a recorded day
  const points = ev.scene.points.map((p, i) => ({ id: p.id, kind: p.kind, day: typeof p.day === 'number' ? Math.min(stay, Math.max(1, p.day)) : Math.max(1, Math.round(stay * share[i])), expr: expr(p.req) }));
  return { id: ev.id, stay, points, names: [...names], rolls };
}

function compiled(D, ev) {
  const key = D.lang + '|' + ev.id;
  if (!cache.has(key)) {
    const model = sceneModel(D, ev);
    const known = new Set(model.names);
    cache.set(key, { model, fns: model.points.map((p) => compile(p.expr, known, `scene ${ev.id} ${p.id}`)) });
  }
  return cache.get(key);
}

// ctx: staffId, seed, carried (item ids worn or taken), statsAt(day) -> the attributes of that day (after the effect of items)
// evalPoint says whether one point is met, on the attributes of the day of that point
export function evalPoint(D, ev, i, ctx) {
  const { model, fns } = compiled(D, ev);
  const staff = D.get('staff.staff.' + ctx.staffId);
  const L = D.get('config.office.luck');
  const klass = D.get('staff.gender_class')[staff.gender];
  const stats = ctx.statsAt(model.points[i].day);
  const v = {};
  for (const n of model.names) v[n] = 0;
  Object.assign(v, stats, { luck_base: L.base, luck_per: L.per_point, luck_max: L.max_chance });
  for (const t of staff.traits) v['trait_' + t] = 1;
  for (const j of staff.jobs) v['job_' + j] = 1;
  v['gender_' + klass] = 1;
  for (const id of ctx.carried) { v['item_' + id] = 1; for (const pr of D.get('items.' + id).provides) v['has_' + pr] = 1; }
  for (const r of model.rolls) v[r.name] = draw(ctx.seed, r.key, ev.id);
  return fns[i](v) ? true : false;
}
// every point, for a caller that has no body to follow
export function evalScene(D, ev, ctx) {
  return compiled(D, ev).model.points.map((_, i) => evalPoint(D, ev, i, ctx));
}
// the days of the points, for the coordinator that steps the stay
export const pointDays = (D, ev) => compiled(D, ev).model.points.map((p) => p.day);
