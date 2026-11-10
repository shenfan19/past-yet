// Strict data access: a missing key throws, there are no silent defaults.
export class Data {
  constructor(obj) { this.o = obj; }
  get(path) {
    let v = this.o;
    for (const part of path.split('.')) {
      if (v === null || typeof v !== 'object' || !(part in v)) throw new Error('缺少数据键: ' + path);
      v = v[part];
    }
    return v;
  }
}

const FILES = ['config', 'items', 'staff', 'map', 'antiques', 'shops', 'mainline', 'encyclopedia', 'catalog', 'audio', 'share_qr'];
// Language files: the key under which the merged text lives, and the file name stem in data/i18n.
const LOCALE_KINDS = { text: 'text', enc_text: 'encyclopedia' };

// Objects merge key by key, anything else (strings, numbers, arrays) is replaced whole.
// A language file that lacks a key therefore falls back to the fallback language for that key.
export function merge(base, over) {
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  if (!isObj(base) || !isObj(over)) return over;
  const out = { ...base };
  for (const k of Object.keys(over)) out[k] = k in base ? merge(base[k], over[k]) : over[k];
  return out;
}

// pickLang(i18n) returns the language code to use. A code that is not in config.i18n.locales, or a language with no file, falls back.
export async function loadData(readText, parse, pickLang) {
  const o = {};
  for (const f of FILES) o[f] = parse(await readText('data/' + f + '.yaml'));
  const I = o.config.i18n;
  const want = pickLang ? pickLang(I) : I.fallback;
  const lang = want in I.locales ? want : I.fallback;
  const loadLocale = async (kind, code) => {
    try { return parse(await readText(`data/i18n/${kind}.${code}.yaml`)); } catch (e) { console.warn(`语言文件缺失 ${kind}.${code}，落回 ${I.fallback}`); return {}; }
  };
  for (const [key, stem] of Object.entries(LOCALE_KINDS)) {
    const base = await loadLocale(stem, I.fallback);
    o[key] = lang === I.fallback ? base : merge(base, await loadLocale(stem, lang));
  }
  // every catalogue event has a relic, which is an antique: it points at the event and sells for money
  const C = o.catalog;
  const period = (y) => C.periods.find((p) => y < p.until).id;
  for (const e of C.events) {
    const id = 'relic_' + e.id;
    const price = C.price[e.tier];
    o.antiques.antiques[id] = { era: null, event: e.id, kind: 'key', found_in: [], price, sell: Math.floor(price * C.sell_ratio), start_owned: false, playable: true, tags: [e.field, e.region, period(e.year)] };
    const t = o.text.catalog[e.id];
    o.text.antiques[id] = { name: t.relic, desc: t.relic_desc };
  }
  o.world = JSON.parse(await readText('data/world_land.json'));
  o.era_raw = {};
  o.era_src = {};
  for (const id of o.config.eras) {
    const src = await readText('data/eras/' + id + '.lm.yaml');
    o.era_src[id] = src;
    o.era_raw[id] = parse(src);
  }
  const D = new Data(o);
  D.lang = lang;
  return D;
}
