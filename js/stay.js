// LM advances in historical days. Read health at checkpoints and objectives, then feed the objective result back into the next interval.
import { evalPoint, sceneModel } from './scene_core.js';
import { historicalDays } from './travel_time.js';

// How much of a channel the body of the traveller feels: the attribute named for the channel, above or below the reference, takes off or adds a share of it, between a floor and a ceiling.
// The attributes are the general defence against pressure; traits and the kit take whole levels off instead, in effectiveChannels.
export function feltShare(D, channel, stats) {
  const R = D.get('config.body.resist');
  const attr = R.by_channel[channel] || R.attr;
  return Math.min(R.max, Math.max(R.min, 1 - R.per_point * (stats[attr] - R.ref)));
}

// the value of every handle on a day, from the pressure of the channels the event names and what the earlier points wrote back; felt is the share of each channel the body feels, all of it when not given
export function dayHandles(D, ev, day, carry, modes, felt = {}) {
  const C = D.get('config.channels');
  const live = Object.entries(ev.channels).filter(([c]) => !C.off.includes(c));
  const ramp = Math.min(1, day / C.ramp_days);
  const out = [];
  for (const h of Object.keys(C.baseline)) {
    const base = C.baseline[h];
    let level = null, extra = 0;
    const mode = modes[h].mode;
    for (const [c, lv] of live) {
      const spec = C.list[c];
      const f = felt[c] ?? 1;
      const lvv = spec.level?.[h]?.[lv];
      const tvv = spec.total?.[h]?.[lv];
      const v = lvv === undefined ? undefined : base + (lvv - base) * f;
      const tv = tvv === undefined ? undefined : base + (tvv - base) * f;
      if (v !== undefined && (level === null || Math.abs(v - base) > Math.abs(level - base))) level = v;
      if (tv !== undefined) extra += tv - base;
    }
    let value = (level === null ? base : level) + extra;
    value = base + (value - base) * ramp + (carry[h] || 0);
    out.push({ concept: h, mode, value, source: 'event' });
  }
  return out;
}

// The level a channel has for this traveller: the level of the event, less what the items they carry, the gear they wear and their traits take off. A channel at nothing is gone.
export function effectiveChannels(D, ev, staffId, props, gear) {
  const R = D.get('config.channels.relief');
  const field = D.get('config.channels.trait_resist.field');
  const traits = D.get('staff.staff.' + staffId + '.traits');
  const out = {};
  for (const [c, lv] of Object.entries(ev.channels || {})) {
    const named = (ids) => ids.filter((id) => D.get('items.' + id).channels.includes(c)).length;
    const cut = Math.min(R.item_cap, R.item_levels * named(props)) + R.gear_levels * named(gear)
      + traits.reduce((a, t) => a + (D.get('staff.traits.' + t)[field]?.[c] || 0), 0);
    const left = Math.max(R.floor, lv - cut);
    if (left > 0) out[c] = left;
  }
  return out;
}

// runs the stay and says which points were met. ctx: staffId, seed, carried, stats (the attributes on the card after the items)
export function runStay(D, core, ev0, ctx) {
  // ctx.props are the ids of the plain items carried, ctx.carried the gear and scene items; the pressure of the stay is what is left after them
  const ev = { ...ev0, channels: effectiveChannels(D, ev0, ctx.staffId, ctx.props || [], (ctx.carried || []).filter((id) => D.get('items.' + id).scene)) };
  const B = D.get('config.body');
  const C = D.get('config.channels');
  const hello = core.hello();
  const id = 'traveler';
  const live = Object.keys(ev.channels).filter((k) => !C.off.includes(k));
  const felt = Object.fromEntries(live.map((c) => [c, feltShare(D, c, ctx.stats)]));
  const context = {};
  for (const c of live) for (const [h, byLevel] of Object.entries(C.list[c].context || {})) context[h] = Math.max(context[h] || 0, byLevel[ev.channels[c]] * felt[c]);
  // the reference is the same body for the same days with no pressure at all, so the body factor counts only what the pressure added to a body that is not perfectly at rest
  const ref = 'reference';
  core.init({ v: 1, kind: 'init', vocabulary_version: hello.vocabulary_version, subjects: [{ id, seed: ctx.seed, context }, { id: ref, seed: ctx.seed, context: {} }] });
  const scene = ev.scene ? sceneModel(D, ev) : null;
  const days = scene?.points.map((p) => p.day) || [];
  const stay = ctx.historicalDays ?? scene?.stay ?? historicalDays(D, ev.stay || D.get('config.light.stay_by_tier.' + ev.tier));
  const checks = new Set([stay, ...days]);
  for (let day = B.check_days; day < stay; day += B.check_days) checks.add(day);
  const grief = ev.channels.G || 0;
  let carry = {}, lonely = 0, prev = 0;
  const hits = days.map(() => false);
  const trace = [];
  for (const day of [...checks].sort((a, b) => a - b)) {
    const elapsed = day - prev;
    prev = day;
    const handles = dayHandles(D, ev, day, carry, hello.handles, felt);
    const interval = (writes) => writes.map((h) => h.mode === 'total' ? { ...h, value: h.value * elapsed } : h);
    const msg = core.step({ v: 1, kind: 'step', minutes: B.step_minutes * elapsed, subjects: [{ id, handles: interval(handles) }, { id: ref, handles: interval(dayHandles(D, { channels: {} }, day, {}, hello.handles)) }] });
    const raw = msg.subjects.find((s) => s.id === id).readouts;
    const calm = msg.subjects.find((s) => s.id === ref).readouts;
    const read = Object.fromEntries(Object.keys(raw).map((r) => [r, Math.max(0, raw[r] - calm[r])]));
    lonely += B.loneliness.per_level_day * grief * elapsed / D.get('config.travel.history_days_per_office_day');
    read.loneliness = Math.min(1, lonely);
    const RS = B.resilience;
    const resilience = RS.base + RS.per_point * ctx.stats[RS.attr];
    const infectionLimit = resilience * B.incapacity.infection_at;
    const reason = B.incapacity.readouts.find((r) => read[r] >= (r === 'infection_burden' ? infectionLimit : resilience * B.incapacity.at));
    const strain = { ...read, infection_burden: Math.min(1, (read.infection_burden || 0) / infectionLimit) };
    const stats = { ...ctx.stats };
    for (const [a, carriers] of Object.entries(B.carriers)) stats[a] = ctx.stats[a] * (1 - B.k * Math.max(...carriers.map((r) => strain[r] || 0)));
    trace.push({ day, readouts: read, handles, stats, down: !!reason });
    if (reason) return { hits, trace, evacuation: { day, reason } };
    carry = Object.fromEntries(Object.entries(carry).map(([h, v]) => [h, v * B.feedback.decay ** elapsed]));
    days.forEach((d, i) => {
      if (d !== day) return;
      hits[i] = evalPoint(D, ev, i, { staffId: ctx.staffId, seed: ctx.seed, carried: ctx.carried, statsAt: () => stats });
      for (const [h, v] of Object.entries(B.feedback[hits[i] ? 'hit' : 'miss'])) carry[h] = (carry[h] || 0) + v;
    });
  }
  return { hits, trace };
}
