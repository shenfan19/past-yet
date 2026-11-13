// The coordinator of a stay. It steps the traveller through the days of the stay with a computational core, reads the body each day,
// turns the readings into the attributes of that day, meets each sync point of the scene on the day it falls, and writes the outcome of the point
// back to the handles as an event source. It is explicit coupling step by step, nothing iterates to convergence.
// A traveller who can no longer act fails every later point. The core is whatever speaks the core interface, a stand-in or the LM core.
import { evalPoint, pointDays } from './scene_core.js';

// the value of every handle on a day, from the pressure of the channels the event names and what the earlier points wrote back
export function dayHandles(D, ev, day, carry, modes) {
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
      const v = spec.level?.[h]?.[lv];
      const tv = spec.total?.[h]?.[lv];
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
  for (const [c, lv] of Object.entries(ev.channels)) {
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
  const context = {};
  for (const c of Object.keys(ev.channels).filter((k) => !C.off.includes(k))) for (const [h, byLevel] of Object.entries(C.list[c].context || {})) context[h] = Math.max(context[h] || 0, byLevel[ev.channels[c]]);
  // the reference is the same body for the same days with no pressure at all, so the body factor counts only what the pressure added to a body that is not perfectly at rest
  const ref = 'reference';
  core.init({ v: 1, kind: 'init', vocabulary_version: hello.vocabulary_version, subjects: [{ id, seed: ctx.seed, context }, { id: ref, seed: ctx.seed, context: {} }] });
  const days = pointDays(D, ev);
  const stay = Math.max(...days);
  const grief = ev.channels.G || 0;
  let carry = {}, lonely = 0, down = false;
  const hits = ev.scene.points.map(() => false);
  const trace = [];
  for (let day = 1; day <= stay; day++) {
    const handles = dayHandles(D, ev, day, carry, hello.handles);
    const msg = core.step({ v: 1, kind: 'step', minutes: B.step_minutes, subjects: [{ id, handles }, { id: ref, handles: dayHandles(D, { channels: {} }, day, {}, hello.handles) }] });
    const raw = msg.subjects.find((s) => s.id === id).readouts;
    const calm = msg.subjects.find((s) => s.id === ref).readouts;
    const read = Object.fromEntries(Object.keys(raw).map((r) => [r, Math.max(0, raw[r] - calm[r])]));
    lonely += B.loneliness.per_level_day * grief;
    read.loneliness = Math.min(1, lonely);
    if (Math.max(...B.incapacity.readouts.map((r) => read[r] || 0)) >= B.incapacity.at) down = true;
    const stats = { ...ctx.stats };
    for (const [a, carriers] of Object.entries(B.carriers)) stats[a] = ctx.stats[a] * (1 - B.k * Math.max(...carriers.map((r) => read[r] || 0)));
    trace.push({ day, readouts: read, handles, stats, down });
    carry = Object.fromEntries(Object.entries(carry).map(([h, v]) => [h, v * B.feedback.decay]));
    days.forEach((d, i) => {
      if (d !== day) return;
      hits[i] = !down && evalPoint(D, ev, i, { staffId: ctx.staffId, seed: ctx.seed, carried: ctx.carried, statsAt: () => stats });
      for (const [h, v] of Object.entries(B.feedback[hits[i] ? 'hit' : 'miss'])) carry[h] = (carry[h] || 0) + v;
    });
  }
  return { hits, trace };
}
