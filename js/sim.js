// Generic interpreter for an era model file. Nothing here knows about cholera or any particular era:
// states, equations, agent actions, events, milestones, outcomes and scoring all come from YAML.
import { compile } from './expr.js';
import { draw } from './rng.js';
import { historicalDays } from './travel_time.js';

// day and step are in historical days. office_step is the same step in office days, for what wears on the traveller at the pace of the office, like homesickness.
// ring is where the traveller stands, 0 outside the door and 1 inside it, and conspicuous is how much the face stands out, both from the identity.
const BUILTINS = ['day', 'step', 'arrived', 'office_step', 'ring', 'conspicuous'];

// ---------- tags ----------
// What a scene can ask of a person, worked out from the card by the rules in staff_rules.yaml. A model reads each as tag.<name>, 1 or 0.
export function tagNames(D) {
  const R = D.get('staff');
  return [...Object.keys(R.tags), ...Object.keys(R.job_classes).map((c) => 'class_' + c), ...Object.keys(R.traits).map((t) => 'trait_' + t),
    'literate', 'learned', 'unlettered', 'face_local', 'face_near', 'face_far', 'female', 'male', 'young', 'elder'];
}
// place: { home: [regions], near: [regions] or undefined, region: the part of the world }. Without a place the face tags are left out.
export function staffTags(D, staffId, place = null) {
  const R = D.get('staff');
  const st = R.staff[staffId];
  const a = staffAttrs(D, staffId);
  const out = new Set();
  for (const [t, rule] of Object.entries(R.tags)) if ((rule.min === undefined || a[rule.stat] >= rule.min) && (rule.max === undefined || a[rule.stat] <= rule.max)) out.add(t);
  const classes = Object.entries(R.job_classes).filter(([, jobs]) => (st.jobs || []).some((j) => jobs.includes(j))).map(([c]) => c);
  for (const c of classes) out.add('class_' + c);
  for (const t of st.traits) out.add('trait_' + t);
  const L = R.literacy;
  const byJob = classes.some((c) => L.lettered_classes.includes(c));
  const literate = byJob || a.wit >= L.lettered_wit;
  const learned = classes.some((c) => L.learned_classes.includes(c)) || (byJob && a.wit >= L.learned_wit);
  out.add(literate ? 'literate' : 'unlettered');
  if (learned) out.add('learned');
  const g = R.gender_class[st.gender];
  if (g === 'f') out.add('female');
  if (g === 'm') out.add('male');
  if (st.age <= R.ages.young_max) out.add('young');
  if (st.age >= R.ages.elder_min) out.add('elder');
  if (place) out.add('face_' + faceOf(D, staffId, place));
  return out;
}
export function faceOf(D, staffId, place) {
  // the founder has no region on the card: they come from another timeline and are a stranger everywhere
  const region = D.get('staff.staff')[staffId].region;
  if (region === undefined) return 'far';
  if ((place.home || []).includes(region)) return 'local';
  const near = place.near ?? D.get('staff.faces.parts')[place.region] ?? [];
  return near.includes(region) ? 'near' : 'far';
}
// The identity a person takes in a place: the first of the list of the place that fits. The year and whether it is a crossroads are those of the place.
export function identityFor(D, staffId, place, list = null) {
  const I = D.get('identities');
  const tags = staffTags(D, staffId, place);
  const fits = (id) => {
    const d = I.identities[id];
    if (!d) throw new Error('未知身份 ' + id);
    if (d.since !== undefined && place.year < d.since) return false;
    if (d.until !== undefined && place.year > d.until) return false;
    if (d.crossroads && !place.crossroads) return false;
    if ((d.all || []).some((t) => !tags.has(t))) return false;
    if (d.any && !d.any.some((t) => tags.has(t))) return false;
    if ((d.none || []).some((t) => tags.has(t))) return false;
    return true;
  };
  const id = (list || I.default).find(fits);
  if (!id) return null;
  const face = faceOf(D, staffId, place);
  return { id, ring: I.identities[id].ring, reach: I.identities[id].reach, accept: I.identities[id].accept, face, conspicuous: D.get('staff.faces.conspicuous')[face] };
}
// the place of a model, from its metadata
export function placeOfEra(raw) {
  const m = raw.metadata.era;
  return { home: m.home || [], near: m.near, region: m.region, year: m.year, crossroads: !!m.crossroads };
}
// the day of a date in a model, counted from its day 0. A date is year-month-day.
export function dayOfDate(raw, date) {
  const m = raw.metadata.era;
  const ms = (y, mo, d) => { const x = new Date(Date.UTC(2000, mo - 1, d)); x.setUTCFullYear(y); return x.getTime(); };
  const [y, mo, d] = String(date).split('-').map(Number);
  return Math.round((ms(y, mo, d) - ms(m.year, m.calendar.month, m.calendar.day0)) / 86400000);
}

function req(obj, key, where) {
  if (!(key in obj)) throw new Error(`${where} 缺少键 ${key}`);
  return obj[key];
}

export function deltaName(name) {
  return 'd_' + name.replace(/\./g, '_');
}

export function baseName(name) {
  return 'base_' + name.replace(/\./g, '_');
}

// ---------- compile ----------
export function compileEra(raw, D, id) {
  const E = { id, raw };
  const vars = req(raw, 'variables', id);
  const names = Object.keys(vars);
  const known = new Set([...BUILTINS, ...tagNames(D).map((t) => 'tag.' + t), ...names]);
  const knownScore = new Set([...known, ...names.map(baseName), ...Object.keys(req(raw, 'scoring', id))]);
  const where = (s) => `${id}.${s}`;

  E.vars = {};
  for (const n of names) {
    const d = vars[n];
    for (const k of ['type', 'value', 'source']) req(d, k, where('variables.' + n));
    if (!['state', 'input', 'parameter'].includes(d.type)) throw new Error(where('variables.' + n) + ' type 非法');
    if (!['historical', 'lm_model', 'game_assumption', 'calibrated'].includes(d.source)) throw new Error(where('variables.' + n) + ' source 非法');
    E.vars[n] = d;
  }
  const staffStats = D.get('staff.stats');
  for (const n of names) {
    const fs = vars[n].from_staff;
    if (fs && !staffStats.includes(fs)) throw new Error(where('variables.' + n) + ' from_staff 未知: ' + fs);
  }

  const step = req(req(raw.simulation, 'step_size', id), 'value', id);
  E.step = step;
  E.roles = req(raw, 'roles', id);
  for (const r of Object.values(E.roles)) if (!known.has(r)) throw new Error(where('roles') + ' 未声明 ' + r);
  E.horizon = vars[E.roles.horizon].value;

  // equations
  E.equations = Object.entries(req(raw, 'equations', id)).map(([eid, eq], order) => {
    const dyn = Object.entries(req(eq, 'dynamics', where('equations.' + eid))).map(([target, src]) => {
      if (!known.has(target)) throw new Error(where('equations.' + eid) + ' 写入未声明变量 ' + target);
      return { target, fn: compile(src, known, where('equations.' + eid + '.' + target)) };
    });
    return {
      id: eid, priority: eq.priority ?? 0, order, dyn,
      cond: eq.condition ? compile(eq.condition, known, where('equations.' + eid + '.condition')) : null,
    };
  });
  E.equations.sort((a, b) => b.priority - a.priority || a.order - b.order);

  // agents and actions
  E.agents = Object.entries(req(raw, 'agents', id)).map(([aid, a]) => ({ id: aid, order: a.order, actions: [] }));
  E.agents.sort((a, b) => a.order - b.order);
  E.levels = [];
  for (const ag of E.agents) {
    const acts = req(raw.actions, ag.id, where('actions'));
    for (const [aid, a] of Object.entries(acts)) {
      if (!known.has(a.level)) throw new Error(where(`actions.${ag.id}.${aid}`) + ' level 未声明 ' + a.level);
      E.levels.push(a.level);
      ag.actions.push({
        id: aid, level: a.level,
        requires: compile(a.requires, known, where(`actions.${ag.id}.${aid}.requires`)),
        utility: compile(a.utility, known, where(`actions.${ag.id}.${aid}.utility`)),
      });
    }
  }

  // events
  E.events = Object.entries(req(raw, 'events', id)).map(([eid, ev]) => ({
    id: eid, tag: ev.tag, source: ev.source, importance: ev.importance, cooldown: ev.cooldown_days, once: !!ev.once,
    when: compile(ev.when, known, where(`events.${eid}.when`)),
    probability: compile(ev.probability, known, where(`events.${eid}.probability`)),
    effects: Object.entries(ev.effects).map(([t, src]) => {
      if (!known.has(t)) throw new Error(where(`events.${eid}`) + ' 写入未声明变量 ' + t);
      return { target: t, fn: compile(src, known, where(`events.${eid}.${t}`)) };
    }),
    variants: (ev.variants || []).map((x) => ({
      key: x.key,
      when: compile(x.when, new Set([...known, ...Object.keys(ev.effects).map(deltaName)]), where(`events.${eid}.variants`)),
    })),
  }));

  // A milestone is a line of the report that is written once. It may carry a date, and then it is written on that day: a recorded date writes itself whoever is there,
  // and a line of the traveller that has a date is written only if the traveller is there on that day. It may change variables when it is written, and it may have variants:
  // the first variant whose condition holds gives the text, and may change variables of its own, so the same moment reads differently for different people.
  const effectsOf = (obj, w) => Object.entries(obj || {}).map(([t, src]) => {
    if (!known.has(t)) throw new Error(w + ' 写入未声明变量 ' + t);
    return { target: t, fn: compile(src, known, w + '.' + t) };
  });
  E.milestones = Object.entries(req(raw, 'milestones', id)).map(([mid, m]) => {
    const w = where(`milestones.${mid}`);
    if (m.when === undefined && m.date === undefined) throw new Error(w + ' 需要 when 或 date');
    const at = m.date !== undefined ? dayOfDate(raw, m.date) : null;
    return {
      id: mid, tag: m.tag, importance: m.importance, needsTraveler: m.needs_traveler, fact: m.fact || null, at,
      when: m.when !== undefined ? compile(m.when, known, w) : null,
      effects: effectsOf(m.effects, w),
      variants: (m.variants || []).map((x) => ({ key: x.key, when: compile(x.when, known, w + '.variants'), effects: effectsOf(x.effects, w + '.variants.' + x.key) })),
    };
  });

  E.starPoints = req(raw, 'star_points', id).map((p) => {
    if (!p.kind) throw new Error(where('star_points.' + p.id) + ' needs a kind');
    const m = E.milestones.find((x) => x.id === p.milestone);
    if (!m || !m.needsTraveler) throw new Error(where('star_points.' + p.id) + ' needs a milestone that needs the traveller: ' + p.milestone);
    return p;
  });

  const rc = req(raw, 'recall', id);
  E.recall = {
    when: compile(rc.when, known, where('recall.when')),
    withCharm: Object.entries(rc.with_charm).map(([t, s]) => ({ target: t, fn: compile(s, known, where('recall.with_charm')) })),
    withoutCharm: Object.entries(rc.without_charm).map(([t, s]) => ({ target: t, fn: compile(s, known, where('recall.without_charm')) })),
  };

  E.outcomes = req(raw, 'outcomes', id).map((o) => ({ ...o, fn: compile(o.when, known, where('outcomes.' + o.id)) }));
  E.scoring = Object.entries(req(raw, 'scoring', id)).map(([k, s]) => ({ id: k, fn: compile(s, knownScore, where('scoring.' + k)) }));
  E.report = req(raw, 'report', id);
  for (const k of ['deaths', 'cases', 'handle', 'treated', 'protected']) if (!known.has(E.report[k])) throw new Error(where('report') + ' 未声明 ' + E.report[k]);
  E.logImportance = req(raw, 'log_importance', id);
  E.tagSource = req(raw, 'tag_source', id);
  E.hints = req(raw, 'hints', id).map((h) => ({ key: h.key, fn: compile(h.when, knownScore, where('hints.' + h.key)) }));
  E.series = req(raw, 'series', id).map((s) => ({ id: s.id, label: s.label, fn: compile(s.expr, known, where('series.' + s.id)) }));

  // bindings
  const items = D.get('items');
  E.itemBindings = req(raw, 'item_bindings', id);
  for (const [item, b] of Object.entries(E.itemBindings)) {
    if (!(item in items)) throw new Error(where('item_bindings') + ' 未知物品 ' + item);
    for (const t of Object.keys(b)) if (!known.has(t)) throw new Error(where('item_bindings.' + item) + ' 变量未声明 ' + t);
  }
  E.strategies = req(raw, 'strategies', id);
  for (const grp of Object.values(E.strategies)) for (const opt of Object.values(grp)) for (const t of Object.keys(opt)) if (!known.has(t)) throw new Error(where('strategies') + ' 变量未声明 ' + t);
  E.calendar = raw.metadata.era.calendar;
  E.opt = req(raw, 'optimization', id);
  E.tech = raw.metadata.era.tech;
  E.plots = req(raw, 'plots', id);
  for (const [pid, p] of Object.entries(E.plots)) for (const t of Object.keys(p.bindings)) if (!known.has(t)) throw new Error(where('plots.' + pid) + ' 变量未声明 ' + t);
  return E;
}

// ---------- staff and spec ----------
// The five attributes of an employee, from 1 to 10. Traits do not change them.
// With a mood the attributes are the ones of that day: up to buff more at full mood, up to buff less at none. Without it they are the ones on the card.
export const STAFF_ATTR_MAX = 10;

export function staffAttrs(D, staffId, mood = null, gear = []) {
  const a = { ...D.get('staff.default_base'), ...D.get('staff.staff.' + staffId + '.base') };
  for (const [k, v] of Object.entries(D.staffGrowth?.(staffId) || {})) if (Object.hasOwn(a, k)) a[k] += v;
  for (const k of Object.keys(a)) a[k] = Math.min(STAFF_ATTR_MAX, a[k]);
  // an implant adds to the attributes while it is worn
  for (const id of gear) for (const [k, v] of Object.entries(D.get('items.' + id).stat_add || {})) a[k] += v;
  const f = mood === null ? 1 : 1 + D.get('config.favor.buff') * (2 * mood - 1);
  return Object.fromEntries(Object.entries(a).map(([k, v]) => [k, Math.min(STAFF_ATTR_MAX, v * f)]));
}
// What the era models read. Every quantity is a plain function of one attribute, set in staff_rules.yaml. A trait can add a weakness of its own, like being hurt or infected.
export function staffStats(D, staffId, mood = null, gear = []) {
  const a = staffAttrs(D, staffId, mood, gear);
  const out = Object.fromEntries(Object.entries(D.get('staff.derive')).map(([k, d]) => [k, Math.max(0, d.offset + (d.from ? d.scale * a[d.from] : 0))]));
  for (const t of D.get('staff.staff.' + staffId + '.traits')) for (const [k, v] of Object.entries(D.get('staff.traits.' + t).model || {})) out[k] += v;
  // a trait can take a weakness away, but nothing falls below nothing
  for (const k of Object.keys(out)) out[k] = Math.max(0, out[k]);
  return out;
}
export function staffHabit(D, staffId) {
  const out = { ...D.get('staff.default_habit') };
  const best = {};
  for (const t of D.get('staff.staff.' + staffId + '.traits')) {
    const tr = D.get('staff.traits.' + t);
    for (const [grp, key] of Object.entries(tr.policy || {})) {
      if (!(grp in best) || tr.priority > best[grp]) { best[grp] = tr.priority; out[grp] = key; }
    }
  }
  return out;
}

export function itemTotals(D, items) {
  let cost = 0, weight = 0, cap = D.get('config.office.weight_capacity');
  for (const [id, n] of Object.entries(items)) {
    cost += D.get(`items.${id}.cost`) * n;
    weight += D.get(`items.${id}.weight`) * n;
    // a pack frame or an exoskeleton raises what can be carried
    cap += (D.get(`items.${id}`).carry || 0) * n;
  }
  return { cost, weight, cap };
}

// spec: { seed, staffId, items:{id:n} }. Focus and on_block come from the staff traits.
export function validateSpec(E, D, spec, stock) {
  const t = itemTotals(D, spec.items);
  if (t.weight > t.cap + 1e-9) return 'overweight';
  if (stock) for (const [id, n] of Object.entries(spec.items)) if (n > (stock[id] || 0)) return 'stock';
  for (const [id, n] of Object.entries(spec.items)) if (n > D.get(`items.${id}.max`) || n < 0) return 'item_range';
  const plots = spec.plots || [];
  if (plots.length > D.get('config.office.max_plots')) return 'plot_count';
  for (const pid of plots) if (!E.plots[pid] || E.plots[pid].tech > E.tech) return 'plot_tech';
  return null;
}

// ---------- run ----------
function initVars(E, D, spec, withTraveler) {
  const v = {};
  for (const [n, d] of Object.entries(E.vars)) v[n] = d.value;
  const stats = staffStats(D, spec.staffId, spec.favor ?? null, spec.gear || []);
  for (const [n, d] of Object.entries(E.vars)) if (d.from_staff) v[n] = stats[d.from_staff];
  for (const [n, d] of Object.entries(E.vars)) if (d.from_spec) v[n] = spec[d.from_spec] ?? d.value;
  v[E.roles.stay] = historicalDays(D, v[E.roles.stay]);
  // The crossing is not exact: the day of arrival moves by up to a share of the stay before or after the planned day, between min_days and max_days of config.travel.drift,
  // or by the early and late days a model sets in metadata.era.drift,
  // drawn from the seed, in whole days, and never before day 0 of the model.
  // The horizon covers the latest arrival the drift allows, so the run with the traveller and the one without have the same length.
  const TD = D.get('config.travel.drift');
  const span = Math.min(TD.max_days, Math.max(TD.min_days, Math.round(TD.share * v[E.roles.stay])));
  const DR = E.raw.metadata?.era?.drift ?? { early: span, late: span };
  const planned = v[E.roles.arrive];
  const lo = -Math.min(DR.early, Math.floor(planned));
  if (withTraveler) v[E.roles.arrive] = planned + Math.round(lo + draw(spec.seed, 'arrival_drift', 0) * (DR.late - lo));
  v.office_step = E.step / D.get('config.travel.history_days_per_office_day');
  const who = staffTags(D, spec.staffId, E.place || placeOfEra(E.raw));
  for (const t of tagNames(D)) v['tag.' + t] = who.has(t) ? 1 : 0;
  v.ring = spec.identity ? spec.identity.ring : 0;
  v.conspicuous = spec.identity ? spec.identity.conspicuous : 0;
  v[E.roles.horizon] = Math.max(E.horizon, Math.ceil((planned + DR.late + v[E.roles.stay]) / E.step) * E.step + E.step);
  const apply = (grp, key) => {
    const o = E.strategies[grp][key];
    if (!o) throw new Error('未知策略 ' + grp + '.' + key);
    Object.assign(v, o);
  };
  const habit = staffHabit(D, spec.staffId);
  apply('focus', habit.focus);
  apply('on_block', habit.on_block);
  v.day = 0; v.step = E.step; v.arrived = 0;
  if (!withTraveler) v[E.roles.arrive] = Infinity;
  return v;
}

function clampTo(E, name, x) {
  const b = E.vars[name].bounds;
  if (!b) return x;
  if (b[0] !== null && x < b[0]) return b[0];
  if (b[1] !== null && x > b[1]) return b[1];
  return x;
}

export function run(E, D, spec, withTraveler) {
  const v = initVars(E, D, spec, withTraveler);
  const stay = v[E.roles.stay];
  const steps = Math.ceil(v[E.roles.horizon] / E.step);
  const log = [];
  const series = [];
  const digest = [];
  const lastFire = {};
  const doneMs = new Set();
  let delivered = false;
  let arrivedDay = null;
  let leftDay = null;
  const acceptedAt = spec.journey ? (spec.journey.accepted ? spec.journey.recognitionDay : Infinity) : 0;
  const supplies = () => {
    for (const [item, n] of Object.entries(spec.items)) {
      for (const [target, per] of Object.entries(E.itemBindings[item] || {})) v[target] = clampTo(E, target, v[target] + n * per);
    }
    for (const pid of spec.plots || []) {
      for (const [target, add] of Object.entries(E.plots[pid].bindings)) v[target] = clampTo(E, target, v[target] + add);
    }
  };
  let authorized = false;

  const snap = () => ({ ...v });

  for (let k = 0; k < steps; k++) {
    v.day = k * E.step;
    const inWindow = withTraveler && v.day >= v[E.roles.arrive] && v.day < v[E.roles.arrive] + stay && v[E.roles.recalled] === 0;
    v.arrived = inWindow && v.day >= v[E.roles.arrive] + acceptedAt ? 1 : 0;
    if (inWindow && !delivered) {
      delivered = true;
      arrivedDay = v.day;
      log.push({ t: v.day, kind: 'arrive', id: 'arrive', importance: E.logImportance.arrive, snap: snap() });
    }
    if (v.arrived && !authorized) { authorized = true; supplies(); }
    if (delivered && !inWindow && leftDay === null) {
      leftDay = v.day;
      log.push({ t: v.day, kind: 'leave', id: 'leave', importance: E.logImportance.leave, snap: snap() });
    }

    // agents pick one action each
    for (const l of E.levels) v[l] = 0;
    const picked = {};
    for (const ag of E.agents) {
      let best = null, bu = -Infinity;
      for (const a of ag.actions) {
        if (!a.requires(v)) continue;
        const u = a.utility(v);
        if (u > bu) { bu = u; best = a; }
      }
      if (best) { v[best.level] = 1; picked[ag.id] = best.id; }
    }

    // equations
    for (const eq of E.equations) {
      if (eq.cond && !eq.cond(v)) continue;
      for (const d of eq.dyn) v[d.target] = clampTo(E, d.target, d.fn(v));
    }

    // events
    for (const ev of E.events) {
      if (!ev.when(v)) continue;
      if (ev.once && lastFire[ev.id] !== undefined) continue;
      if (ev.cooldown && lastFire[ev.id] !== undefined && v.day - lastFire[ev.id] < ev.cooldown) continue;
      if (draw(spec.seed, ev.id, k) >= ev.probability(v)) continue;
      lastFire[ev.id] = v.day;
      const before = {};
      for (const e of ev.effects) before[e.target] = v[e.target];
      for (const e of ev.effects) v[e.target] = clampTo(E, e.target, e.fn(v));
      const delta = {};
      for (const e of ev.effects) delta[e.target] = v[e.target] - before[e.target];
      let key = ev.id;
      const venv = { ...v };
      for (const e of ev.effects) venv[deltaName(e.target)] = delta[e.target];
      for (const vr of ev.variants) if (vr.when(venv)) { key = vr.key; break; }
      log.push({ t: v.day, kind: 'event', id: ev.id, key, tag: ev.tag, source: ev.source, importance: ev.importance, delta, snap: snap() });
    }

    // recall
    if (v.arrived === 1 && v[E.roles.recalled] === 0 && E.recall.when(v)) {
      v[E.roles.recalled] = 1;
      const charm = v[E.roles.charm] === 1;
      for (const e of charm ? E.recall.withCharm : E.recall.withoutCharm) v[e.target] = clampTo(E, e.target, e.fn(v));
      log.push({ t: v.day, kind: 'recall', id: 'recall', key: charm ? 'recall_charm' : 'recall_lost', charm, importance: E.logImportance.recall, snap: snap() });
    }

    // milestones
    for (const m of E.milestones) {
      if (doneMs.has(m.id)) continue;
      if (m.needsTraveler && !authorized) continue;
      if (m.at !== null) {
        if (v.day < m.at) continue;
        // a line of the traveller with a date belongs to that day: if the traveller is not there then, it is never written
        if (m.needsTraveler && (v.day >= m.at + 1 || v.arrived !== 1)) { if (v.day >= m.at + 1) doneMs.add(m.id); continue; }
      }
      if (m.when && !m.when(v)) continue;
      doneMs.add(m.id);
      const variant = m.variants.find((x) => x.when(v));
      for (const e of m.effects) v[e.target] = clampTo(E, e.target, e.fn(v));
      if (variant) for (const e of variant.effects) v[e.target] = clampTo(E, e.target, e.fn(v));
      log.push({ t: m.at !== null && !m.needsTraveler ? m.at : v.day, kind: 'milestone', id: m.id, key: variant ? variant.key : m.id, fact: m.fact, dated: m.at !== null, tag: m.tag, importance: m.importance, snap: snap() });
    }

    const row = { day: v.day + E.step, picked: { ...picked } };
    for (const s of E.series) row[s.id] = s.fn(v);
    series.push(row);
    if (Math.floor((v.day + E.step) / 1) !== Math.floor(v.day / 1)) digest.push({ day: Math.floor(v.day + E.step), snap: snap(), arrived: v.arrived });
  }
  v.day = steps * E.step;

  let outcome = null;
  if (withTraveler && delivered) {
    for (const o of E.outcomes) if (o.fn(v)) { outcome = o; break; }
  }
  return { final: snap(), log, series, digest, outcome: outcome ? outcome.id : null, outcomeDef: outcome, arrivedDay, leftDay, delivered };
}

const baseCache = new Map();
export function runBaseline(E, D, spec) {
  const key = [E.id, spec.seed, spec.staffId].join('|');
  if (!baseCache.has(key)) baseCache.set(key, run(E, D, { ...spec, items: {} }, false));
  return baseCache.get(key);
}

export function score(E, branch, base) {
  const env = { ...branch.final };
  for (const [n, x] of Object.entries(base.final)) env[baseName(n)] = x;
  const out = {};
  for (const s of E.scoring) { out[s.id] = s.fn(env); env[s.id] = out[s.id]; }
  return out;
}

// One full dispatch: branch run, baseline run, scoring and the office-level accounts.
export function runDispatch(E, D, spec) {
  const base = runBaseline(E, D, spec);
  const branch = run(E, D, spec, true);
  const sc = score(E, branch, base);
  const tot = itemTotals(D, spec.items);
  const O = D.get('config.office');
  const henv = { ...branch.final, ...sc };
  for (const [n, x] of Object.entries(base.final)) henv[baseName(n)] = x;
  const hints = E.hints.filter((h) => h.fn(henv)).map((h) => h.key).slice(0, D.get('config.engine.report_hints'));
  const mult = branch.outcomeDef ? branch.outcomeDef.energy_mult : 0;
  const energy = Math.round(sc.change_amount * O.energy_per_change * mult);
  return {
    spec, base, branch, score: sc, cost: tot.cost, weight: tot.weight,
    energy, restDays: branch.outcomeDef ? branch.outcomeDef.rest_days : 0,
    outcome: branch.outcome, hints,
  };
}

// ---------- optimisation over the item allocation ----------
export function optimize(E, D, ctx) {
  const O = E.opt;
  const decs = O.startpoint.regimens.map((r) => ({ item: r.item, lo: r.optimize.value[0], hi: Math.min(r.optimize.value[1], ctx.stock[r.item] || 0), step: D.get('items.' + r.item + '.step') }));
  const algo = O.algorithm;
  const mc = O.mc;
  const stride = D.get('config.engine.mc_seed_stride');
  const evalItems = (items) => {
    const t = itemTotals(D, items);
    if (t.weight > t.cap + 1e-9) return null;
    let lives = 0;
    for (let i = 0; i < mc.runs; i++) {
      const spec = { ...ctx.spec, items, seed: mc.seed + i * stride };
      const base = runBaseline(E, D, spec);
      const br = run(E, D, spec, true);
      lives += score(E, br, base).lives_saved;
    }
    return { items, lives: lives / mc.runs, cost: t.cost, weight: t.weight };
  };
  const snapTo = (d, x) => Math.min(d.hi, Math.max(d.lo, Math.round(x / d.step) * d.step));
  const rnd = (key, i) => draw(algo.seed, key, i);
  const pool = [];
  const add = (c) => { if (c) pool.push(c); };
  for (let i = 0; i < algo.samples; i++) {
    const items = {};
    decs.forEach((d, j) => {
      // thinning: each item is skipped half the time so sparse sets are sampled too
      items[d.item] = rnd('skip' + j, i) < algo.skip_prob ? d.lo : snapTo(d, d.lo + rnd('val' + j, i) * (d.hi - d.lo));
    });
    add(evalItems(items));
  }
  const front = (list) => list.filter((a) => !list.some((b) => b !== a && b.lives >= a.lives && b.cost <= a.cost && (b.lives > a.lives || b.cost < a.cost)));
  for (let r = 0; r < algo.refine; r++) {
    const f = front(pool);
    const parent = f[Math.floor(rnd('par', r) * f.length)];
    const items = { ...parent.items };
    const j = Math.floor(rnd('mut', r) * decs.length);
    const d = decs[j];
    const dir = rnd('dir', r) < 0.5 ? -1 : 1;
    items[d.item] = snapTo(d, items[d.item] + dir * d.step * (1 + Math.floor(rnd('mag', r) * algo.max_jump)));
    add(evalItems(items));
  }
  const f = front(pool).sort((a, b) => a.cost - b.cost);
  const uniq = [];
  for (const c of f) if (!uniq.some((u) => Math.abs(u.cost - c.cost) < 1e-9 && Math.abs(u.lives - c.lives) < 1e-9)) uniq.push(c);
  if (!uniq.length) return { front: [], recommended: null };
  const maxL = Math.max(...uniq.map((c) => c.lives)), minL = Math.min(...uniq.map((c) => c.lives));
  const maxC = Math.max(...uniq.map((c) => c.cost)), minC = Math.min(...uniq.map((c) => c.cost));
  const nl = (c) => (maxL === minL ? 1 : (c.lives - minL) / (maxL - minL));
  const nc = (c) => (maxC === minC ? 0 : (c.cost - minC) / (maxC - minC));
  let rec = uniq[0], rd = Infinity;
  for (const c of uniq) {
    const dd = (1 - nl(c)) ** 2 + nc(c) ** 2;
    if (dd < rd) { rd = dd; rec = c; }
  }
  return { front: uniq, recommended: rec };
}
