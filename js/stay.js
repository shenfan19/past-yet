// The coordinator of a stay. It steps the traveller through the days of the stay with a computational core, reads the body each day,
// turns the readings into the attributes of that day, meets each sync point of the scene on the day it falls, and writes the outcome of the point
// back to the handles as an event source. It is explicit coupling step by step, nothing iterates to convergence.
// A traveller who can no longer act fails every later point. The core is whatever speaks the core interface, a stand-in or the LM core.
import { evalPoint, pointDays } from './scene_core.js';

// the value of every handle on a day, from the pressure of the channels the event names and what the earlier points wrote back
export function dayHandles(D, ev, day, carry) {
  const C = D.get('config.channels');
  const ramp = Math.min(1, day / C.ramp_days);
  const out = [];
  for (const h of Object.keys(C.baseline)) {
    const base = C.baseline[h];
    let level = null, extra = 0, mode = 'level';
    for (const [c, lv] of Object.entries(ev.channels)) {
      const spec = C.list[c];
      const v = spec.level?.[h]?.[lv];
      const tv = spec.total?.[h]?.[lv];
      if (v !== undefined && (level === null || Math.abs(v - base) > Math.abs(level - base))) level = v;
      if (tv !== undefined) { extra += tv - base; mode = 'total'; }
    }
    let value = mode === 'total' ? base + extra : level === null ? base : level;
    value = base + (value - base) * ramp + (carry[h] || 0);
    out.push({ concept: h, mode, value, source: 'event' });
  }
  return out;
}

// runs the stay and says which points were met. ctx: staffId, seed, carried, stats (the attributes on the card after the items)
export function runStay(D, core, ev, ctx) {
  const B = D.get('config.body');
  const C = D.get('config.channels');
  const hello = core.hello();
  const id = 'traveler';
  const context = {};
  for (const c of Object.keys(ev.channels)) for (const [h, byLevel] of Object.entries(C.list[c].context || {})) context[h] = Math.max(context[h] || 0, byLevel[ev.channels[c]]);
  core.init({ v: 1, kind: 'init', vocabulary_version: hello.vocabulary_version, subjects: [{ id, seed: ctx.seed, context }] });
  const days = pointDays(D, ev);
  const stay = Math.max(...days);
  const grief = ev.channels.G || 0;
  let carry = {}, lonely = 0, down = false;
  const hits = ev.scene.points.map(() => false);
  const trace = [];
  for (let day = 1; day <= stay; day++) {
    const msg = core.step({ v: 1, kind: 'step', minutes: B.step_minutes, subjects: [{ id, handles: dayHandles(D, ev, day, carry) }] });
    const read = { ...msg.subjects[0].readouts };
    lonely += B.loneliness.per_level_day * grief;
    read.loneliness = Math.min(1, lonely);
    if (Math.max(...B.incapacity.readouts.map((r) => read[r] || 0)) >= B.incapacity.at) down = true;
    const stats = { ...ctx.stats };
    for (const [a, carriers] of Object.entries(B.carriers)) stats[a] = ctx.stats[a] * (1 - B.k * Math.max(...carriers.map((r) => read[r] || 0)));
    trace.push({ day, readouts: read, stats, down });
    carry = Object.fromEntries(Object.entries(carry).map(([h, v]) => [h, v * B.feedback.decay]));
    days.forEach((d, i) => {
      if (d !== day) return;
      hits[i] = !down && evalPoint(D, ev, i, { staffId: ctx.staffId, seed: ctx.seed, carried: ctx.carried, statsAt: () => stats });
      for (const [h, v] of Object.entries(B.feedback[hits[i] ? 'hit' : 'miss'])) carry[h] = (carry[h] || 0) + v;
    });
  }
  return { hits, trace };
}
