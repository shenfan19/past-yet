// Checks the language files. Usage: node tools/check_i18n.mjs
// 1. Every key in the fallback language file exists in each other language file, and the other way round, so nothing is left untranslated or misspelt.
// 2. A language that lacks a key, or a whole file, reads English for it.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { loadData } from '../js/data.js';
import { chosenLocale, localeTag, pickLocale } from '../js/language.js';

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
      if (!op.has(p) || p === 'date_format' || p === 'date_day') continue;
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
check('partial language falls back for story text', JSON.stringify(Dxx.get('text.eras')) === JSON.stringify(en.get('text.eras')));
check('partial encyclopedia falls back key by key', Dxx.get('enc_text.refs.game') === 'Partial game ref' && Dxx.get('enc_text.refs.lm') === en.get('enc_text.refs.lm'));
check('language without a file reads the fallback', Dyy.get('text.ui.title') === en.get('text.ui.title') && Dyy.lang === 'yy');
check('language not in the config reads the fallback', Dzz.lang === I.fallback && Dzz.get('text.ui.title') === en.get('text.ui.title'));
check('legacy Chinese choice keeps the Simplified Chinese content', pickLocale(I, null, 'zh', ['zh-TW']) === 'zh' && localeTag('zh') === 'zh-Hans');
check('the selector and runtime resolve the same URL alias', chosenLocale(I, 'zh_tw', 'ja') === 'zh-Hant' && pickLocale(I, 'zh_tw', 'ja', ['en']) === 'zh-Hant');
check('Traditional Chinese regions and script use the Traditional locale', ['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant-CN'].every((tag) => pickLocale(I, null, null, [tag]) === 'zh-Hant'));
check('explicit Simplified Chinese script wins over the region', ['zh-CN', 'zh-SG', 'zh-Hans-HK'].every((tag) => pickLocale(I, null, null, [tag]) === 'zh'));
check('unsupported preferences are skipped in browser order', pickLocale(I, 'de', null, ['de-DE', 'es-MX', 'fr-CA']) === 'es');
check('unsupported browser languages fall back to English', pickLocale(I, null, null, ['pt-BR']) === I.fallback);
for (const [code, agency] of Object.entries({ 'zh-Hant': '事務所', fr: 'Agence', es: 'Agencia', ja: '事務所', ko: '사무소', ru: 'Агентство' })) {
  const localized = await loadData(reader, (t) => yaml.load(t), () => code);
  check(`${code} uses its own navigation`, localized.lang === code && localized.get('text.ui.tabs.shop') === agency);
}

function covers(base, translated) {
  if (Array.isArray(base)) return Array.isArray(translated) && base.length === translated.length && base.every((entry, index) => covers(entry, translated[index]));
  if (isObj(base)) return isObj(translated) && Object.entries(base).every(([key, value]) => Object.hasOwn(translated, key) && covers(value, translated[key]));
  return typeof translated === typeof base && (typeof translated !== 'string' || !base.trim() || !!translated.trim());
}

const activeStories = en.get('catalog.active_events');
const activeEras = en.get('config.eras');
const opening = activeStories.find((event) => event.start);
for (const code of Object.keys(I.locales)) {
  const file = `data/i18n/text.${code}.yaml`;
  if (!fs.existsSync(path.join(root, file))) continue;
  const raw = yaml.load(read(file));
  const cards = activeStories.filter(({ id }) => covers(en.get('text.catalog.' + id), raw.catalog?.[id]));
  const eras = activeEras.filter((id) => covers(en.get('text.eras.' + id), raw.eras?.[id]));
  console.log(`${code} story coverage: ${cards.length}/${activeStories.length} complete catalogue cards, ${eras.length}/${activeEras.length} complete era texts`);
  if (!opening || !['zh-Hant', 'fr', 'es', 'ja', 'ko'].includes(code)) continue;
  const localized = await loadData(reader, (t) => yaml.load(t), () => code);
  check(`${code} opening story and relic use the locale's text`, !!raw.catalog?.[opening.id]?.story
    && localized.get('text.catalog.' + opening.id).story === raw.catalog[opening.id].story
    && localized.get('text.antiques.relic_' + opening.id).name === raw.catalog[opening.id].relic);
}
process.exit(bad ? 1 : 0);
