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

const FILES = ['config', 'items', 'staff', 'map', 'antiques', 'shops', 'mainline', 'encyclopedia', 'catalog', 'audio', 'share_qr', 'hiring', 'identities'];
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
// opts.drafts: show what is marked as a draft. A simulated era whose model says `metadata.status: draft` and a catalogue event that says `draft: true` are left out of the game, so
// With config.release.ready_only, an event is a draft unless its card says `ready: true`, and so is the era of such an event; a model with no event of its own needs
// `metadata.ready: true`. The antiques of a model kept out are kept out too. A story is turned on when it is finished.
// content can be added step by step and only the finished part is published. The event of a draft era falls back to its own sync points, and the wiki cards of a draft era are dropped.
export async function loadData(readText, parse, pickLang, opts = {}) {
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
  o.world = JSON.parse(await readText('data/world_land.json'));
  o.core_model = JSON.parse(await readText('data/core/traveler_stay.lm.json'));
  o.core_bridge = JSON.parse(await readText('data/core/traveler_stay.bridge.json'));
  o.era_raw = {};
  o.era_src = {};
  for (const id of o.config.eras) {
    const src = await readText('data/eras/' + id + '.lm.yaml');
    o.era_src[id] = src;
    o.era_raw[id] = parse(src);
  }
  // The test employees, King and V, cards with dev_only, are left out unless asked for with opts.devStaff: the game asks in the developer mode,
  // the story probe asks, and every check of the roster reads the fifty without them.
  if (!opts.devStaff) for (const id of Object.keys(o.staff.staff)) if (o.staff.staff[id].dev_only) delete o.staff.staff[id];
  // what is still a draft is left out unless it was asked for
  if (!(opts.drafts ?? o.config.release.drafts)) {
    const notReady = (e) => e.draft || (o.config.release.ready_only && !e.ready);
    const unreadyEras = new Set(o.catalog.events.filter((e) => e.era && notReady(e)).map((e) => e.era));
    // a model with no catalogue event of its own is turned on in the model itself, metadata.ready: true
    const standaloneOff = (id) => o.config.release.ready_only && !o.catalog.events.some((e) => e.era === id) && !o.era_raw[id].metadata.ready;
    const drafts = new Set(o.config.eras.filter((id) => o.era_raw[id].metadata.status === 'draft' || unreadyEras.has(id) || standaloneOff(id)));
    // the antiques that lead to a model kept out go with it
    for (const [id, a] of Object.entries(o.antiques.antiques)) if (a.era && drafts.has(a.era)) delete o.antiques.antiques[id];
    o.config.eras = o.config.eras.filter((id) => !drafts.has(id));
    for (const id of drafts) { delete o.era_raw[id]; delete o.era_src[id]; delete o.config.stars.energy_base[id]; }
    const gone = new Set(o.catalog.events.filter(notReady).map((e) => e.id));
    o.catalog.events = o.catalog.events.filter((e) => !notReady(e));
    for (const e of o.catalog.events) if (drafts.has(e.era)) delete e.era;
    const hidden = (c) => (c.era && drafts.has(c.era)) || (c.unlock && c.unlock.era && drafts.has(c.unlock.era)) || (c.events && c.events.length && c.events.every((x) => gone.has(x)));
    for (const k of Object.keys(o.encyclopedia.sections)) o.encyclopedia.sections[k] = o.encyclopedia.sections[k].filter((c) => !hidden(c));
  }
  // every catalogue event has a relic, which is an antique: it points at the event and sells for money.
  // The event the game starts from has a medium in its place, such as a statue of today: it opens the place, is not an antique, is never found and never sold.
  const C = o.catalog;
  const period = (y) => C.periods.find((p) => y < p.until).id;
  for (const e of C.events) {
    const id = 'relic_' + e.id;
    const price = C.price[e.tier];
    // the relic of an event with a full model is the anchor of that model, so the model opens and is found like any simulated place
    o.antiques.antiques[id] = { era: e.era || null, event: e.id, kind: e.start ? 'medium' : 'key', price, start_owned: !!e.start, playable: !e.start, authors: e.authors, tags: [e.field, e.region, period(e.year), ...(e.regret ? ['regret'] : [])] };
    const t = o.text.catalog[e.id];
    o.text.antiques[id] = { name: t.relic, desc: t.relic_desc };
  }
  const D = new Data(o);
  D.lang = lang;
  return D;
}
