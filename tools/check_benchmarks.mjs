// The benchmark stories, run for the reference employees with fixed seeds. A change to the engine or to the rules that breaks one of the checks below has broken a story.
// The benchmarks, the employees, the seeds and what is expected of each are in cards/config/benchmarks.yaml.
// Usage: node tools/check_benchmarks.mjs            run the checks, exit 1 if one fails
//        node tools/check_benchmarks.mjs --print    also print who each employee is taken for in each benchmark
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { createLocalBackend } from '../js/backend.js';
import { dayOfDate } from '../js/sim.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const print = process.argv.includes('--print');
const B0 = yaml.load(fs.readFileSync(path.join(root, 'cards/config/benchmarks.yaml'), 'utf8'));
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => B0.lang, { drafts: true });
const B = createLocalBackend(D);
const SEG = D.get('config.travel.history_days_per_office_day');
const maxSeg = D.get('config.travel.max_office_days');
const allStaff = Object.keys(D.get('staff.staff'));
const people = yaml.load(fs.readFileSync(path.join(root, 'data/encyclopedia.yaml'), 'utf8'));

let failed = 0;
const ok = (name, pass, detail = '') => { if (!pass) failed++; console.log(`${pass ? 'ok  ' : 'FAIL'} ${name}${!pass && detail ? ' :: ' + detail : ''}`); };

for (const [id, bm] of Object.entries(B0.benchmarks)) {
  const isEra = D.get('config.eras').includes(id);
  const ev = D.get('catalog.events').find((e) => (isEra ? e.era === id : e.id === id));
  console.log(`\n--- ${id} (${isEra ? 'full model' : 'three points'})`);
  if (!isEra && !ev) { ok(`${id}: the event exists`, false); continue; }

  // everyone has a door: each of the fifty employees is taken for someone here
  const doorless = allStaff.filter((s) => !B.identityOf(id, s));
  ok(`${id}: every employee has an identity`, doorless.length === 0, doorless.join(', '));

  // the reference employees are taken for who the benchmark expects
  const got = Object.fromEntries(B0.staff.map((s) => [s, B.identityOf(id, s)?.id]));
  if (print) console.log('     ' + B0.staff.map((s) => `${s.slice(2)}=${got[s]}`).join(' '));
  const wrong = B0.staff.filter((s) => got[s] !== bm.identities[s]).map((s) => `${s} is ${got[s]}, expected ${bm.identities[s]}`);
  ok(`${id}: identities are as expected`, wrong.length === 0, wrong.join('; '));

  if (!isEra) {
    const runs = B0.staff.map((s) => B.runLight(id, s, B0.seeds[0], {}));
    ok(`${id}: a vignette is read by everyone who is taken in`, runs.every((r) => r.evacuation || !r.journey.accepted || !ev.scene?.vignettes || r.vignette));
    ok(`${id}: the employees do not all end the same`, new Set(runs.map((r) => r.stars + ':' + r.vignette)).size >= 2);
    continue;
  }

  const raw = B.eraInfo(id).raw;
  const dated = Object.entries(raw.milestones).filter(([, m]) => m.date !== undefined && m.needs_traveler === false);
  const runs = [];
  for (const seed of B0.seeds) for (const s of B0.staff) {
    const out = B.dispatch(id, { seed, staffId: s, items: {} });
    if (out.evacuation) continue;
    runs.push({ s, seed, ...out });
  }
  ok(`${id}: the runs came back`, runs.length > 0);

  // recorded dates fall on their days, whoever is sent
  const dateBad = [];
  for (const r of runs) for (const [mid, m] of dated) {
    const want = dayOfDate(raw, m.date);
    const e = r.res.branch.log.find((x) => x.kind === 'milestone' && x.id === mid);
    const horizon = r.res.branch.series.length ? r.res.branch.series[r.res.branch.series.length - 1].day : 0;
    if (want > horizon) continue;
    if (!e || e.t !== want) dateBad.push(`${mid} for ${r.s}: ${e ? e.t : 'missing'} is not ${want}`);
  }
  ok(`${id}: ${dated.length} recorded dates fall on their days`, dateBad.length === 0, dateBad.slice(0, 3).join('; '));

  // the report has a row for each segment and no more than the longest stay, and nothing is told twice
  const segBad = [];
  for (const r of runs) {
    if (r.report.ledgerBySegment && r.report.ledger.length > maxSeg) segBad.push(`${r.s}: ${r.report.ledger.length} rows`);
    const keys = r.report.timeline.map((t) => t.kind + ':' + t.key);
    const twice = keys.filter((k, i) => keys.indexOf(k) !== i);
    if (twice.length) segBad.push(`${r.s}: told twice ${[...new Set(twice)].join(',')}`);
    if (bm.every_segment && r.report.journey.accepted) {
      const stay = Math.round((r.res.branch.leftDay - Math.floor(r.res.branch.arrivedDay)) / SEG);
      const have = new Set(r.report.timeline.filter((t) => !t.after).map((t) => t.seg));
      for (let n = 1; n <= stay; n++) if (!have.has(n)) segBad.push(`${r.s}: segment ${n} is empty`);
    }
  }
  ok(`${id}: the report keeps to its segments and tells nothing twice`, segBad.length === 0, segBad.slice(0, 4).join('; '));

  // an employee who stays the whole time has not given up
  const gaveUp = runs.filter((r) => r.report.outcomeId === 'gave_up' && r.res.branch.leftDay - r.res.branch.arrivedDay >= B.historicalDays(B.eraStay(id)) - 1).map((r) => r.s);
  ok(`${id}: staying to the end is not giving up`, gaveUp.length <= bm.gave_up_allowed, [...new Set(gaveUp)].join(', '));

  // an employee who brings nothing does not make the compared number worse than the main timeline
  const RP = raw.report;
  const worse = runs.filter((r) => r.res.branch.final[RP.deaths] > r.res.base.final[RP.deaths] + 1e-6).map((r) => `${r.s} ${r.res.branch.final[RP.deaths].toFixed(1)} > ${r.res.base.final[RP.deaths].toFixed(1)}`);
  ok(`${id}: empty hands do not make it worse than the main timeline`, worse.length === 0, worse.slice(0, 3).join('; '));

  // the employees read different lines and do not all get the same stars
  const first = runs.filter((r) => r.seed === B0.seeds[0]);
  const own = new Set(first.map((r) => r.report.timeline.filter((t) => t.kind !== 'arrive' && t.kind !== 'leave' && t.tag !== 'history').map((t) => t.text.replace(D.get('text.staff.' + r.s + '.name'), '')).join('|')));
  const stars = new Set(first.map((r) => r.report.points.map((p) => (p.hit ? 1 : 0)).join('')));
  ok(`${id}: at least ${bm.distinct_lines} employees read lines of their own (${own.size})`, own.size >= bm.distinct_lines);
  ok(`${id}: at least two star patterns (${stars.size})`, stars.size >= 2);

  // the five hooks of the story: what the card names for each is read in the reports
  const card = bm.card ? yaml.load(fs.readFileSync(path.join(root, 'cards/people', bm.card, 'person.yaml'), 'utf8')) : null;
  if (card && bm.hooks) {
    const names = (k) => String(card.self_check[k] || '').split(',').map((x) => x.trim()).filter(Boolean);
    const inReport = (r, ids) => ids.some((x) => r.report.timeline.some((t) => t.id === x || t.key === x));
    for (const k of ['knowing', 'near', 'missed']) {
      const miss = first.filter((r) => r.report.journey.accepted && !inReport(r, names(k))).map((r) => r.s);
      ok(`${id}: every report has the hook ${k}`, names(k).length > 0 && miss.length === 0, miss.join(', '));
    }
    for (const k of ['lever', 'brought']) ok(`${id}: someone of the panel reads the hook ${k}`, names(k).length > 0 && first.some((r) => inReport(r, names(k))));
  }
}

console.log(failed ? `\n${failed} checks failed` : '\nall benchmark checks passed');
console.log('what a real person says is checked by the build: tools/story_rules.mjs lets a line of the person stand only with a fact and a source.');
process.exit(failed ? 1 : 0);
