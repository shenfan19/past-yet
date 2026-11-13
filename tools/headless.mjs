// Run the simulation without a browser. Usage: node tools/headless.mjs [era] [log] [opt]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import * as sim from '../js/sim.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => process.env.GAME_LANG || 'en');
const eraId = process.argv[2] && !['log', 'opt'].includes(process.argv[2]) ? process.argv[2] : D.get('config.eras')[0];
const E = sim.compileEra(D.get('era_raw.' + eraId), D, eraId);
const seeds = D.get('config.tools.probe_seeds');
const f1 = (x) => Math.round(x * 10) / 10;

const base = (o) => ({ seed: 1, staffId: 's_ning', items: {}, ...o });
const only = (items) => Object.fromEntries(Object.entries(items).filter(([k]) => k in E.itemBindings));
const kit = {
  empty: {},
  ors: only({ ors_pack: 60 }),
  chlor: { chlorine_tablet: 60 },
  snow: { handbook: 1 },
  mix: only({ ors_pack: 40, chlorine_tablet: 40, handbook: 1, recall_charm: 1 }),
  full: only({ ors_pack: 80, chlorine_tablet: 60, handbook: 1, recall_charm: 1 }),
};
const cases = [];
for (const [kn, items] of Object.entries(kit)) cases.push([kn, base({ items })]);
for (const sid of Object.keys(D.get('staff.staff'))) for (const kn of ['empty', 'snow', 'mix']) cases.push([kn + '/' + sid, base({ items: kit[kn], staffId: sid })]);

for (const [label, spec] of cases) {
  const rs = seeds.map((s) => sim.runDispatch(E, D, { ...spec, seed: s }));
  const m = (f) => f1(rs.reduce((a, r) => a + f(r), 0) / rs.length);
  const outs = {};
  for (const r of rs) outs[r.outcome] = (outs[r.outcome] || 0) + 1;
  console.log(label.padEnd(18), 'baseD', m((r) => r.base.final.D), 'D', m((r) => r.branch.final.D), 'saved', m((r) => r.score.lives_saved),
    'rmv', m((r) => r.branch.final[['removed_day', 'reform_day', 'mandate_day'].find((k) => k in r.branch.final)]), 'adv', m((r) => r.branch.final.advance_days), 'prog', m((r) => r.branch.final['traveler.progress']), JSON.stringify(outs));
}
const a = sim.runDispatch(E, D, base({ items: kit.mix }));
const b = sim.runDispatch(E, D, base({ items: kit.mix }));
console.log('deterministic:', JSON.stringify(a.branch.final) === JSON.stringify(b.branch.final) ? 'same' : 'DIFFERENT');
if (process.argv.includes('log')) {
  const r = sim.runDispatch(E, D, base({ items: kit.mix }));
  for (const e of r.branch.log) console.log(e.t, e.kind, e.id, e.key || '');
  console.log(r.branch.series.filter((_, i) => i % 4 === 0).map((x) => `${x.day}:${f1(x.cases)}/${f1(x.deaths)}/${Object.values(x.picked).join('+')}`).join('  '));
}
if (process.argv.includes('opt')) {
  const t0 = Date.now();
  const o = sim.optimize(E, D, { spec: base({}), stock: D.get('config.office.start_stock') });
  console.log('opt ms', Date.now() - t0, 'front', o.front.length);
  for (const c of o.front) console.log(f1(c.lives), c.cost, f1(c.weight), JSON.stringify(c.items));
  console.log('rec', JSON.stringify(o.recommended));
}
