// Pressure probe: for every story that is turned on, how often employees are sent home, bare and with the best kit for its channels.
// Usage: node tools/pressure_probe.mjs [eventId,eventId] [seeds], BINS=1 adds the bare stay by constitution
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { createLocalBackend } from '../js/backend.js';
import { effectiveChannels } from '../js/stay.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const [only = '', seedsArg = '6'] = process.argv.slice(2);
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => 'zh', { drafts: true });
const B = createLocalBackend(D);
const off = D.get('config.channels.off');
const items = D.get('items');
const staff = Object.keys(D.get('staff.staff'));
const evs = D.get('catalog.events').filter((e) => (only ? only.split(',').includes(e.id) : e.ready) && Object.keys(e.channels || {}).some((c) => !off.includes(c)));
// the best kit: for each live channel the two plain items and one piece of gear that name it, no implants and nothing retired
function bestKit(ev) {
  const kit = {};
  for (const c of Object.keys(ev.channels).filter((c) => !off.includes(c))) {
    const named = Object.keys(items).filter((id) => items[id].playable !== false && !items[id].implant && items[id].channels.includes(c));
    named.filter((id) => !items[id].scene).slice(0, 2).forEach((id) => { kit[id] = 1; });
    named.filter((id) => items[id].scene).slice(0, 1).forEach((id) => { kit[id] = 1; });
  }
  return kit;
}
const seeds = Array.from({ length: Number(seedsArg) }, (_, i) => 1000 + 97 * i);
for (const ev of evs) {
  const kit = bestKit(ev);
  const row = (k) => {
    let out = 0, stars = 0, n = 0;
    for (const s of staff) for (const seed of seeds) { const r = B.runLight(ev.id, s, seed, k); n++; if (r.evacuation) out++; else stars += r.stars; }
    return `${Math.round(100 * out / n)}% sent home, stars ${(stars / n).toFixed(2)}`;
  };
  const left = JSON.stringify(effectiveChannels(D, ev, staff[0], Object.keys(kit).filter((id) => !items[id].scene), Object.keys(kit).filter((id) => items[id].scene)));
  console.log(`${ev.id} ${JSON.stringify(ev.channels)}\n  bare: ${row({})}\n  kit ${Object.keys(kit).join(',')} -> ${left}: ${row(kit)}`);
}
// with BINS=1, the bare stay again, the employees sorted by constitution
if (process.env.BINS) for (const ev of evs) {
  const bins = { low: [0, 0], mid: [0, 0], high: [0, 0] };
  for (const s of staff) {
    const c = D.get('staff.staff.' + s + '.base.constitution');
    const b = c <= 3 ? 'low' : c <= 6 ? 'mid' : 'high';
    for (const seed of seeds) { bins[b][1]++; if (B.runLight(ev.id, s, seed, {}).evacuation) bins[b][0]++; }
  }
  console.log(ev.id, 'bare sent home by constitution', Object.entries(bins).map(([k, [o, n]]) => `${k} ${Math.round(100 * o / n)}%`).join(' '));
}
