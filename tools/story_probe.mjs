// Story probe: runs one place for a few employees and prints who they were taken for, what they read and what they got.
// Usage: node tools/story_probe.mjs <eraId or eventId> [lang] [seed] [staff,staff] [items as id:n,id:n]
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { createLocalBackend } from '../js/backend.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const [id, lang = 'zh', seedArg = '36891', staffArg = '', itemArg = ''] = process.argv.slice(2);
const D = await loadData(async (p) => fs.readFileSync(path.join(root, p), 'utf8'), (t) => yaml.load(t), () => lang, { drafts: true });
const B = createLocalBackend(D);
const staff = staffArg ? staffArg.split(',') : ['s_fan', 's_guilan', 's_somchai', 's_carlos', 's_samuel', 's_amara', 's_jeanluc'];
const items = Object.fromEntries(itemArg ? itemArg.split(',').map((x) => { const [k, n] = x.split(':'); return [k, Number(n)]; }) : []);
const seed = Number(seedArg);
const isEra = D.get('config.eras').includes(id);
for (const s of staff) {
  const name = D.get('text.staff.' + s + '.name');
  const ident = B.identityOf(id, s);
  console.log(`\n=== ${name} (${s}) identity=${ident.id} face=${ident.face} tags=${B.staffTags(id, s).filter((t) => !t.startsWith('trait_')).join(',')}`);
  if (!isEra) { const r = B.runLight(id, s, seed, items); console.log('  journey', JSON.stringify(r.journey), 'stars', r.stars, 'vignette', r.vignette, 'outcome', r.outcome); for (const t of r.timeline || []) console.log('   ', t.after ? 'AFTER' : '', t.year, '[' + (t.tag || t.kind) + ']', t.star ? '★' : '', t.text); continue; }
  const { res, report, evacuation } = B.dispatch(id, { seed, staffId: s, items });
  if (evacuation) { console.log('  evacuated'); continue; }
  const F = res.branch.final;
  console.log(`  journey reached=${report.journey.reached} accepted=${report.journey.accepted} day=${report.journey.recognitionDay} outcome=${report.outcomeId} stars=${report.stars} points=${report.points.map((p) => p.id + ':' + (p.hit ? 1 : 0) + (p.bonus ? 'b' : '') + (p.lost ? 'l' : '')).join(' ')}`);
  console.log(`  D base=${res.base.final.D.toFixed(1)} branch=${F.D.toFixed(1)} ` + ['records', 'sites', 'traveler.trust', 'traveler.homesick', 'traveler.fatigue', 'traveler.progress'].filter((k) => k in F).map((k) => k.replace('traveler.', '') + '=' + F[k].toFixed(2)).join(' '));
  for (const t of report.timeline) console.log(`  ${t.after ? 'AFTER' : 'seg' + t.seg} [${t.tag || t.kind}] ${t.key}${t.own ? ' *own*' : ''}: ${t.text}`);
  console.log('  ledger', report.ledger.map((l) => `${l.day}:${Math.round(l.sick)}/${Math.round(l.baseDead)}/${Math.round(l.dead)}/${Math.round(l.treated)}/${Math.round(l.protected)}`).join(' '));
  console.log('  summary:', report.summary, '| hints:', report.hints.join(' / '));
}
