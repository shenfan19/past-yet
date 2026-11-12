// Antique find probe: the chance a trip finds an antique before the stars, place by place, and what a find is worth.
// Usage: AF_k=0.16 node tools/in_probe_antique_find.mjs   (AF_k, AF_tau_years, AF_tau_km and AF_cap override the config for the run)
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { createLocalBackend } from '../js/backend.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => 'en');
const b = createLocalBackend(D);
const events = D.get('catalog.events');
const eras = D.get('config.eras');
const AF = D.get('config.office.antique_find');
for (const k of ['k', 'tau_years', 'tau_km', 'cap']) if (process.env['AF_' + k]) AF[k] = Number(process.env['AF_' + k]);
const price = (id) => D.get('antiques.antiques.' + id).price;

// 1) the chance a trip finds something before the stars, per place
const rows = [...eras, ...events.map((e) => e.id)].map((id) => {
  const o = b.findOdds(id);
  const w = o.list.reduce((a, x) => a + x.w, 0);
  const value = o.list.reduce((a, x) => a + x.w * price(x.id), 0) / (w || 1);
  return { id, p: o.p, n: o.list.length, value };
});
const q = (f) => { const s = rows.map(f).sort((a, c) => a - c); return [0, 0.1, 0.25, 0.5, 0.75, 0.9, 1].map((k) => s[Math.min(s.length - 1, Math.floor(k * (s.length - 1)))].toFixed(3)).join(' '); };
console.log('places', rows.length, 'quantiles of p (min 10% 25% 50% 75% 90% max):', q((r) => r.p));
console.log('mean p', (rows.reduce((a, r) => a + r.p, 0) / rows.length).toFixed(3));
console.log('mean price of a find', (rows.reduce((a, r) => a + r.value, 0) / rows.length).toFixed(1));
const lowCount = rows.filter((r) => r.p < 0.2).length;
console.log('places with p under 0.2:', lowCount, 'of', rows.length);

// 2) what a trip is worth on average, with the star shares, for a mid crew
const stars = { 0: 0.15, 1: 0.25, 2: 0.3, 3: 0.3 };
const share = AF.star_share;
let shareMean = 0;
for (const [s, pr] of Object.entries(stars)) shareMean += pr * share[s];
console.log('mean star share', shareMean.toFixed(3));
const meanFind = rows.reduce((a, r) => a + r.p, 0) / rows.length * shareMean;
console.log('mean chance of a find per trip', meanFind.toFixed(3));
const valueFind = rows.reduce((a, r) => a + r.p * r.value, 0) / rows.length * shareMean;
console.log('mean antique value per trip', valueFind.toFixed(1), 'funds');
