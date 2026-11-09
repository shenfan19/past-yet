// Sweep every era over staff and a few kits. Builds each report so a missing text key or
// template variable fails here instead of in front of a player. Usage: node tools/check_content.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import * as sim from '../js/sim.js';
import { buildReport, stratText, itemText } from '../js/narrate.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t));
let n = 0;
const outcomes = {};
for (const id of D.get('config.eras')) {
  const E = sim.compileEra(D.get('era_raw.' + id), D, id);
  const bound = Object.keys(E.itemBindings);
  const kits = [{}, Object.fromEntries(bound.filter((k) => D.get(`items.${k}.kind`) === 'consumable').map((k) => [k, 10])), Object.fromEntries(bound.filter((k) => D.get(`items.${k}.kind`) === 'consumable').map((k) => [k, D.get(`items.${k}.max`)])), Object.fromEntries(bound.map((k) => [k, D.get(`items.${k}.max`) > 1 ? 10 : 1])), Object.fromEntries(bound.filter((k) => k !== 'recall_charm').map((k) => [k, D.get(`items.${k}.max`)]))];
  for (const staffId of Object.keys(D.get('staff.staff'))) {
    for (const items of kits) {
      for (const seed of [1, 2, 3, 4, 5, 6]) {
        const res = sim.runDispatch(E, D, { seed, staffId, items });
        buildReport(D, E, res);
        const k = id + ':' + res.outcome;
        outcomes[k] = (outcomes[k] || 0) + 1;
        n++;
      }
    }
    const h = D.get('staff.staff.' + staffId + '.habit');
    stratText(D, id, 'focus', h.focus);
    stratText(D, id, 'on_block', h.on_block);
  }
  for (const item of bound) itemText(D, id, item);
}
console.log('reports built:', n);
console.log(JSON.stringify(outcomes));
