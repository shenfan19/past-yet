// Checks the language files. Usage: node tools/check_i18n.mjs
// 1. Every key in the fallback language file exists in each other language file, and the other way round, so nothing is left untranslated or misspelt.
// 2. A language that lacks a key, or a whole file, reads English for it.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const config = yaml.load(read('data/config.yaml'));
const I = config.i18n;
const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
function paths(o, p = '') {
  if (!isObj(o)) return [p];
  return Object.keys(o).flatMap((k) => paths(o[k], p ? p + '.' + k : k));
}
const placeholders = (s) => (typeof s === 'string' ? [...s.matchAll(/\{[A-Za-z_][A-Za-z0-9_.:]*\}/g)].map((m) => m[0]).sort().join(' ') : '');
const valueAt = (o, p) => p.split('.').reduce((a, k) => (a === undefined ? a : a[k]), o);

let bad = 0;
for (const stem of ['text', 'encyclopedia']) {
  const base = yaml.load(read(`data/i18n/${stem}.${I.fallback}.yaml`));
  const bp = new Set(paths(base));
  for (const code of Object.keys(I.locales)) {
    if (code === I.fallback) continue;
    const file = `data/i18n/${stem}.${code}.yaml`;
    if (!fs.existsSync(path.join(root, file))) { console.log(`${file}: missing, ${code} reads ${I.fallback}`); continue; }
    const other = yaml.load(read(file));
    const op = new Set(paths(other));
    const missing = [...bp].filter((p) => !op.has(p));
    const extra = [...op].filter((p) => !bp.has(p));
    for (const p of extra) { console.log(`${file}: key not in ${I.fallback}: ${p}`); bad++; }
    if (missing.length) console.log(`${file}: ${missing.length} keys fall back to ${I.fallback}, first: ${missing.slice(0, 3).join(', ')}`);
    for (const p of bp) {
      if (!op.has(p) || p === 'date_format') continue;
      const a = placeholders(valueAt(base, p)), b = placeholders(valueAt(other, p));
      if (a !== b) { console.log(`${file}: placeholders differ at ${p}: ${a} / ${b}`); bad++; }
    }
  }
}

// fallback behaviour with a language that has only a few keys, and one that has no file at all
const partial = { 'data/i18n/text.xx.yaml': 'ui:\n  title: Partial title\n', 'data/i18n/encyclopedia.xx.yaml': 'refs:\n  game: Partial game ref\n' };
const cfg = yaml.load(read('data/config.yaml'));
cfg.i18n.locales.xx = 'Partial';
cfg.i18n.locales.yy = 'Absent';
const reader = async (p) => {
  if (p === 'data/config.yaml') return yaml.dump(cfg);
  if (p in partial) return partial[p];
  if (p.includes('.yy.yaml')) throw new Error('no file');
  return read(p);
};
const Dxx = await loadData(reader, (t) => yaml.load(t), () => 'xx');
const Dyy = await loadData(reader, (t) => yaml.load(t), () => 'yy');
const Dzz = await loadData(reader, (t) => yaml.load(t), () => 'not-configured');
const en = await loadData(reader, (t) => yaml.load(t), () => I.fallback);
const check = (label, ok) => { console.log(label + ':', ok ? 'ok' : 'MISMATCH'); if (!ok) bad++; };
check('partial language uses its own key', Dxx.get('text.ui.title') === 'Partial title');
check('partial language falls back for the rest', Dxx.get('text.ui.tabs.home') === en.get('text.ui.tabs.home'));
check('partial encyclopedia falls back key by key', Dxx.get('enc_text.refs.game') === 'Partial game ref' && Dxx.get('enc_text.refs.lm') === en.get('enc_text.refs.lm'));
check('language without a file reads the fallback', Dyy.get('text.ui.title') === en.get('text.ui.title') && Dyy.lang === 'yy');
check('language not in the config reads the fallback', Dzz.lang === I.fallback && Dzz.get('text.ui.title') === en.get('text.ui.title'));
process.exit(bad ? 1 : 0);
