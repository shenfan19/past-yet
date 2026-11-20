// Compare automatic progress from the same exported office with different hires.
// Usage: node tools/in_probe_roster.mjs <save.json[.gz]> [days=1200] [comparison hires=6]
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';
import { loadData } from '../js/data.js';
import { createLocalBackend } from '../js/backend.js';
import { applyFounder } from '../js/founder.js';
import { createOffice } from '../js/office.js';

const [file, dayArg = '1200', sampleArg = '6'] = process.argv.slice(2);
const days = Number(dayArg), sampleSize = Number(sampleArg);
if (!file || !Number.isSafeInteger(days) || days < 1 || !Number.isSafeInteger(sampleSize) || sampleSize < 1) {
  throw new Error('Usage: node tools/in_probe_roster.mjs <save.json[.gz]> [days=1200] [comparison hires=6]');
}
const bytes = await fs.readFile(file);
const original = JSON.parse((bytes[0] === 0x1f && bytes[1] === 0x8b ? gunzipSync(bytes) : bytes).toString('utf8'));
const yaml = createRequire(import.meta.url)('../vendor/js-yaml.min.js');
const D = await loadData((p) => fs.readFile(new URL('../' + p, import.meta.url), 'utf8'), yaml.load);
applyFounder(D, original.founder);
const B = createLocalBackend(D);
const antiques = D.get('antiques.antiques');
const modelAntique = new Map(Object.entries(antiques).filter(([, antique]) => antique.era).map(([id, antique]) => [antique.era, id]));
const events = D.get('catalog.active_events').map((event) => ({
  route: event.era || event.id,
  key: event.era ? modelAntique.get(event.era) : 'relic_' + event.id,
  max: B.maxStars(event.era || event.id),
}));
const specialists = ['s_olga', 's_fatima'].filter((id) => original.staff[id] && !original.staff[id].hired);
const candidatePool = Object.keys(D.get('staff.staff')).filter((id) => original.staff[id] && !original.staff[id].hired && !specialists.includes(id));
const sampled = [];
for (let i = 0; i < sampleSize && candidatePool.length; i += 1) {
  const id = B.pick(candidatePool, i + 1, 'roster_probe');
  candidatePool.splice(candidatePool.indexOf(id), 1);
  sampled.push(id);
}

function run(group, hire = null) {
  const s = structuredClone(original);
  s.clock.auto = true;
  s.clock.speed = 1;
  D.staffGrowth = (id) => s.staff[id]?.growth;
  B.setGearSource((id) => s.staff[id]?.gear || []);
  const office = createOffice({
    D,
    ctx: { S: () => s, backend: B, era: B.eraInfo, settings: { get: () => false }, save() {}, now: () => s.clock.day * 1000 },
    owns: (id) => s.antiques.includes(id),
    anchored: (id) => s.locks.includes(id),
    eraOpen: (route) => s.locks.some((id) => antiques[id]?.era === route),
    visibleEras: () => D.get('config.eras'),
  });
  if (hire) {
    office.ensureHire();
    if (!s.hire.slots.some(({ id }) => id === hire)) s.hire.slots[0] = { id: hire };
    if (!office.hire(hire)) throw new Error('Cannot hire ' + hire);
  }
  const start = s.clock.day;
  const startUnpaid = s.unpaidDays || 0;
  const seen = new Set();
  let zeroTrips = 0;
  for (let day = 0; day < days; day += 1) {
    office.advance(D.get('config.clock.sec_per_day'));
    if ((s.unpaidDays || 0) > startUnpaid) break;
    office.autoStep();
    for (const t of s.trips.slice(-office.hiredIds().length)) {
      if (Number(t.id.slice(1)) <= original.seq || seen.has(t.id)) continue;
      seen.add(t.id);
      if (!t.stars) zeroTrips += 1;
    }
  }
  const improvements = events.filter(({ route }) => (s.stars[route] || 0) > (original.stars[route] || 0)).map(({ route }) => ({
    route, before: original.stars[route] || 0, after: s.stars[route],
  }));
  const spareValue = [...new Set(s.antiques)].reduce((value, id) =>
    value + (s.antiques.filter((item) => item === id).length - 1) * office.salePrice(id), 0);
  return {
    group, hire, days: Math.floor(s.clock.day - start + 1e-5), dailyWages: office.wageTotal(),
    funds: Math.round(s.funds), spareValue, trips: seen.size, zeroTrips,
    opened: events.filter(({ key }) => s.locks.includes(key) && !original.locks.includes(key)).map(({ route }) => route),
    improvements,
    bestStarsAdded: improvements.reduce((sum, { before, after }) => sum + after - before, 0),
    fullAdded: events.filter(({ route, max }) => s.stars[route] === max && original.stars[route] !== max).length,
  };
}

console.log(JSON.stringify(run('baseline')));
for (const hire of sampled) console.log(JSON.stringify(run('comparison', hire)));
for (const hire of specialists) console.log(JSON.stringify(run('specialist', hire)));
