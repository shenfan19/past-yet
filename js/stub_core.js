// The stand-in computational core. It speaks the core interface (version 1) and nothing else: hello, init, step, readouts, snapshot, restore.
// Each reading is pulled toward a target by a first order lag, the target being a weighted sum of how far each handle is from its baseline.
// It knows the vocabulary concepts and nothing of the game, and is replaced as a whole by the LM core. All numbers are in config.core_stub.
export function createStubCore(D) {
  const S = D.get('config.core_stub');
  const baseline = D.get('config.channels.baseline');
  const readoutNames = Object.keys(S.weights);
  const handleModes = { fluid_intake: 'total', activity_load: 'level', sleep_duration: 'level', psychological_demand: 'level', injury_exposure: 'level' };
  const subjects = new Map();
  const clamp01 = (x) => Math.min(1, Math.max(0, x));
  const readOf = (s) => Object.fromEntries(readoutNames.map((r) => [r, s.x[r]]));
  const message = (ids) => ({ v: 1, kind: 'readouts', subjects: ids.filter((id) => subjects.has(id)).map((id) => ({ id, readouts: readOf(subjects.get(id)), drives: readoutNames, rates: {}, warnings: [] })) });
  return {
    hello: () => ({ v: 1, kind: 'hello', name: S.name, core_kind: 'stub', runtime_version: '0', vocabulary_version: 4, step_minutes: S.step_minutes,
      readouts: readoutNames, rates: [], handles: Object.fromEntries(Object.entries(handleModes).map(([k, mode]) => [k, { mode }])),
      context: Object.keys(Object.values(S.context_weight).reduce((a, o) => ({ ...a, ...o }), {})), presets: [], snapshot: true,
      tolerance: Object.fromEntries(readoutNames.map((r) => [r, 1e-9])) }),
    init(msg) {
      for (const sub of msg.subjects) subjects.set(sub.id, { seed: sub.seed, context: { ...(sub.context || {}) }, x: Object.fromEntries(readoutNames.map((r) => [r, 0])) });
      return message(msg.subjects.map((s) => s.id));
    },
    step(msg) {
      const days = msg.minutes / S.step_minutes;
      for (const sub of msg.subjects) {
        const s = subjects.get(sub.id);
        if (!s) continue;
        const value = { ...baseline };
        for (const h of sub.handles) if (h.concept in handleModes && h.mode === handleModes[h.concept]) value[h.concept] = h.value;
        for (const r of readoutNames) {
          let target = 0;
          for (const [h, w] of Object.entries(S.weights[r])) target += w * (value[h] - baseline[h]) / S.scale[h];
          for (const [c, w] of Object.entries(S.context_weight[r] || {})) target += w * (s.context[c] || 0);
          s.x[r] += (1 - Math.pow(1 - S.rate_per_day, days)) * (clamp01(target) - s.x[r]);
        }
      }
      return message(msg.subjects.map((s) => s.id));
    },
    readouts: (ids) => message(ids),
    snapshot: (id) => JSON.parse(JSON.stringify(subjects.get(id))),
    restore(snap, id) { subjects.set(id, JSON.parse(JSON.stringify(snap))); },
  };
}
