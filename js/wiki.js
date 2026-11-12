// Wiki style encyclopedia: a left list with search and tag filter, a right article with links, a back and forward history.
// Locked articles show as a question mark for visitors. In dev mode they show in full with a hidden mark, and the model categories appear.
import { staffName, staffTraits, fmtYear, staffProfile } from './narrate.js';

const IDENT = /[A-Za-z_][A-Za-z0-9_.]*/g;

export function createWiki(X) {
  const { D, ctx, T, U, DEV, esc, r1, st } = X;
  const W = U.wiki;
  const COLON = U.fmt.colon, SEP = U.fmt.sep;
  const paren = (x) => U.fmt.paren.replace('{x}', x);
  const eraIds = () => D.get('config.eras');
  const refStatus = (id) => D.get('encyclopedia.refs.' + id + '.status');
  const refCite = (id) => D.get('enc_text.refs.' + id);
  const depCache = {};

  // ---------- model dependencies, used by the dev categories ----------
  function deps(eraId) {
    if (depCache[eraId]) return depCache[eraId];
    const raw = ctx.era(eraId).raw;
    const known = new Set(Object.keys(raw.variables));
    const ids = (src) => [...String(src).matchAll(IDENT)].map((m) => m[0]).filter((n) => known.has(n));
    const eq = {};
    for (const [name, q] of Object.entries(raw.equations)) {
      const writes = Object.keys(q.dynamics);
      const reads = new Set();
      for (const ex of Object.values(q.dynamics)) ids(ex).forEach((n) => reads.add(n));
      eq[name] = { writes: new Set(writes), reads };
    }
    const ev = {};
    for (const [name, e] of Object.entries(raw.events)) {
      const reads = new Set([...ids(e.when), ...ids(e.probability)]);
      const targets = new Set(Object.keys(e.effects));
      for (const ex of Object.values(e.effects)) ids(ex).forEach((n) => reads.add(n));
      const vars = new Set([...reads, ...targets]);
      const formulas = Object.entries(eq).filter(([, q]) => [...q.writes].some((w) => vars.has(w))).map(([n]) => n);
      ev[name] = { vars: [...vars], formulas };
    }
    const varUsers = {};
    for (const [n, q] of Object.entries(eq)) for (const v of new Set([...q.writes, ...q.reads])) (varUsers[v] = varUsers[v] || { eq: [], ev: [] }).eq.push(n);
    for (const [n, e] of Object.entries(ev)) for (const v of e.vars) (varUsers[v] = varUsers[v] || { eq: [], ev: [] }).ev.push(n);
    const eqEvents = {};
    for (const [n, e] of Object.entries(ev)) for (const f of e.formulas) (eqEvents[f] = eqEvents[f] || []).push(n);
    return (depCache[eraId] = { eq, ev, varUsers, eqEvents, ids });
  }

  // A made employee has a page from the moment they are made, so the wiki lists everyone who has been on offer, up to the limit kept in the save.

  // ---------- article registry ----------
  function buildArticles() {
    const A = [];
    const add = (a) => A.push(a);
    const sec = (k) => D.get('encyclopedia.sections.' + k).map((e) => ({ ...e, ...D.get('enc_text.sections.' + k + '.' + e.id) }));
    const tagsOfEra = (eraId) => T.eras[eraId].tags;
    const eraTitle = (eraId) => T.eras[eraId].name;

    for (const e of sec('places')) add({ id: 'places:' + e.id, cat: 'events', title: e.name, tags: e.tags, unlock: e.unlock, refs: e.refs, body: () => `<p>${link(e.text)}</p>${relatedLinks(e.related)}` });
    for (const e of sec('people')) add({ id: 'people:' + e.id, cat: 'people', title: e.name, tags: e.tags, unlock: e.unlock, refs: e.refs, body: () => `<p>${link(e.text)}</p>${relatedLinks(e.related)}` });
    for (const e of sec('events')) add({ id: 'events:' + e.id, cat: 'events', title: e.name, tags: e.tags, unlock: e.unlock, refs: e.refs, body: () => `<p>${link(e.text)}</p>${relatedLinks(e.related)}` });
    for (const e of sec('stories')) add({ id: 'stories:' + e.id, cat: 'virtual', title: e.name, tags: e.tags, unlock: e.unlock, refs: e.refs, body: () => `<p>${link(e.text)}</p>${relatedLinks(e.related)}` });

    // the catalogue: famous events with a relic each, readable once the relic is owned
    for (const ev of D.get('catalog.events')) {
      const c = T.catalog[ev.id];
      const relicId = 'relic_' + ev.id;
      add({
        id: 'events:c:' + ev.id, cat: 'events', title: c.name, tags: D.get('antiques.antiques.' + relicId + '.tags'), unlock: { anchored: relicId }, refs: ['catalog'],
        body: () => `<p>${esc(c.story)}</p><div class="muted">${esc(fmtYear(D, ev.year))} · ${esc(c.place)}</div><div>${U.dispatch.character}${COLON}${esc(c.figure)}</div><div>${U.dispatch.relic}${COLON}${a('antiques:' + relicId, c.relic)}</div><div class="muted">${U.dispatch.small_story.replace('{n}', String(ctx.backend.lightStay(ev.id)))}</div>`,
      });
    }

    // events that come out of the models
    const me = Object.fromEntries(Object.entries(D.get('encyclopedia.model_events')).map(([k, v]) => [k, { refs: v.refs, text: D.get('enc_text.model_events.' + k) }]));
    for (const eraId of eraIds()) {
      for (const key of Object.keys(ctx.era(eraId).raw.events)) {
        const info = me[key];
        add({
          id: `events:m:${eraId}:${key}`, cat: 'events', title: `${T.eras[eraId].event_titles[key]}${paren(`${T.eras[eraId].short}`)}`, tags: tagsOfEra(eraId), unlock: { era: eraId }, refs: info.refs,
          body: () => {
            let h = `<p>${link(info.text)}</p><div class="muted">${W.in_era}${COLON}${a('places:' + eraPlaceId(eraId), eraTitle(eraId))}</div>`;
            if (DEV) {
              const d = deps(eraId).ev[key];
              h += `<div class="sec">${W.uses_formulas}${paren(`${d.formulas.length} ${W.formula_count}`)}</div><ul>${d.formulas.map((n) => `<li>${a(`formulas:${eraId}:${n}`, n)}</li>`).join('') || `<li class="muted">${U.enc.no_ref}</li>`}</ul>`;
              h += `<div class="sec">${W.uses_vars}${paren(`${d.vars.length} ${W.var_count}`)}</div><div class="wrap">${d.vars.map((n) => a(`vars:${eraId}:${n}`, n)).join(' ')}</div>`;
            }
            return h;
          },
          dev: false,
        });
      }
    }

    for (const id of Object.keys(D.get('staff.staff'))) {
      add({
        id: 'staff:' + id, cat: 'staff', title: staffName(D, id), tags: [], unlock: { staff: id }, refs: ['game'],
        body: () => {
          const stats = ctx.backend.staffStats(id);
          const mini = D.get('staff.attributes').map((k) => `${esc(T.stats[k])} ${r1(stats[k])}`).join(' · ');
          const traits = staffTraits(D, id).map((t) => a('traits:' + t, T.traits[t])).join(' ');
          return `<div class="muted">${esc(staffProfile(D, id))}</div><div class="wrap">${traits}</div><p>${esc(T.staff[id].bio)}</p><p>${esc(T.staff[id].story || '')}</p><div class="muted">${mini}</div>`;
        },
      });
    }

    for (const t of Object.keys(D.get('staff.traits'))) {
      add({
        id: 'traits:' + t, cat: 'traits', title: T.traits[t], tags: [], unlock: { trait: t }, refs: ['game'],
        body: () => {
          const tr = D.get('staff.traits.' + t);
          const mods = Object.entries(tr.points).map(([k, v]) => `${esc(T.point_kinds[k])} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`).join(SEP);
          const pol = Object.entries(tr.policy || {}).map(([grp, key]) => `${esc(U.dispatch[grp])}${COLON}${esc(T.strategies[grp][key].name)}`).join('${U.fmt.semi}');
          const who = Object.keys(D.get('staff.staff')).filter((id) => known(id) && staffTraits(D, id).includes(t)).map((id) => a('staff:' + id, staffName(D, id))).join(' ');
          const pref = tr.prefer ? `<div>${U.office.secretary_pref}${COLON}${esc(U.office.aims[tr.prefer])}</div>` : '';
          const note = T.trait_notes[t];
          return `<div class="traitline"><span class="pro">+ ${esc(note.pro)}</span></div><div class="traitline"><span class="con">− ${esc(note.con)}</span></div><div>${U.enc.modified_by}${COLON}${mods}</div><div>${pol ? esc(pol) : U.enc.edge_none}</div>${pref}<div class="sec">${W.related}</div><div class="wrap">${who}</div>`;
        },
      });
    }

    const base = D.get('staff.default_base');
    for (const e of D.get('encyclopedia.stats').map((x) => ({ ...x, ...D.get('enc_text.stats.' + x.id) }))) {
      add({
        id: 'stats:' + e.id, cat: 'stats', title: e.name || T.stats[e.id], tags: [], unlock: e.unlock, refs: ['game'],
        body: () => {
          const mods = '';
          const side = (label, text, inModel) => (inModel || DEV) ? `<div><b>${label}</b>${COLON}${esc(text)}${DEV ? ` <span class="chip ${inModel ? '' : 'warn'}">${inModel ? U.enc.edge_impl : U.enc.edge_pending}</span>` : ''}</div>` : `<div><b>${label}</b>${COLON}${U.enc.edge_none}</div>`;
          const head = e.kind === 'office' ? `<p>${esc(e.text)}</p>` : `<p class="muted">${U.enc.stat_rule}</p><div>${U.enc.base} ${base[e.id]}</div><div>${U.enc.modified_by}${COLON}${esc(mods || U.enc.no_ref)}</div>`;
          return `${head}${side(U.enc.edge_gain, e.gain, e.gain_in_model)}${side(U.enc.edge_cost, e.cost, e.cost_in_model)}`;
        },
      });
    }

    for (const eraId of eraIds()) {
      for (const [pid, p] of Object.entries(ctx.era(eraId).plots)) {
        const px = T.eras[eraId].plots[pid];
        add({
          id: `plots:${eraId}:${pid}`, cat: 'virtual', title: px.name, tags: tagsOfEra(eraId), unlock: { era: eraId }, refs: ['game'],
          body: () => `<p>${esc(px.desc)}</p><div>${W.in_era}${COLON}${a('places:' + eraPlaceId(eraId), eraTitle(eraId))}</div><div>${U.dispatch.character}${COLON}${a(px.article, px.character)}</div><div>${U.dispatch.tech}${COLON}${p.tech} / ${ctx.era(eraId).tech} ${p.tech <= ctx.era(eraId).tech ? '' : '<span class="chip warn">' + U.dispatch.tech_low + '</span>'}</div>`,
        });
      }
    }

    for (const [id, an] of Object.entries(D.get('antiques.antiques'))) {
      const tx = T.antiques[id];
      add({
        id: 'antiques:' + id, cat: 'items_ancient', title: tx.name, tags: an.tags, unlock: { antique: id }, refs: ['game'],
        body: () => `<p>${esc(tx.desc)}</p><p class="muted">${W.kinds.ancient}</p><div class="muted">${U.dispatch.points_to}${COLON}${an.era ? a('places:' + eraPlaceId(an.era), T.eras[an.era].name) : an.event ? a('events:c:' + an.event, T.catalog[an.event].name) : U.dispatch.not_ready} · ${U.enc.antique_price} ${an.price} · ${U.shop.sell_price} ${an.sell}</div>`,
      });
    }

    for (const [id, it] of Object.entries(D.get('items'))) {
      const tx = T.items[id];
      add({
        id: 'items:' + id, cat: it.shop === 'future' ? 'items_future' : 'items_modern', title: tx.name, tags: it.tags, unlock: { item: id }, refs: ['game'],
        body: () => `<p>${esc(tx.desc)}</p><p class="muted">${W.kinds[it.shop === 'future' ? 'future' : 'modern']}</p><div class="muted">${U.enc.cost} ${it.cost} · ${U.enc.weight} ${it.weight} · ${U.enc.max} ${it.max} · ${esc(D.get('shops.shops.' + it.shop).playable ? U.shop[it.shop].name : U.shop[it.shop].name + ' ' + U.shop.planned)}</div>${it.ip ? `<div><span class="chip warn">${U.shop.ip_unchecked}</span></div>` : ''}`,
      });
    }

    // dev categories
    if (DEV) {
      for (const eraId of eraIds()) {
        const E = ctx.era(eraId);
        const dp = deps(eraId);
        for (const [n, q] of Object.entries(E.raw.equations)) {
          add({
            id: `formulas:${eraId}:${n}`, cat: 'formulas', title: `${n}${paren(`${T.eras[eraId].short}`)}`, tags: tagsOfEra(eraId), unlock: 'always', refs: ['readme'], dev: true,
            body: () => {
              const lines = Object.entries(q.dynamics).map(([v, ex]) => `<div><code>${varLink(eraId, v)} = ${exprLinks(eraId, ex)}</code></div>`).join('');
              const evs = (dp.eqEvents[n] || []).map((k) => a(`events:m:${eraId}:${k}`, T.eras[eraId].event_titles[k])).join(' ');
              return `<p>${esc(q.description)}</p><div class="muted">${W.expr}</div>${lines}<div class="muted">${U.enc.equation_ref}${COLON}${esc(q.reference || U.enc.no_ref)}</div>${evs ? `<div class="sec">${W.used_by_events}</div><div class="wrap">${evs}</div>` : ''}<div class="muted">${W.in_era}${COLON}${a('models:' + eraId, T.eras[eraId].name)}</div>`;
            },
          });
        }
        for (const [n, v] of Object.entries(E.vars)) {
          add({
            id: `vars:${eraId}:${n}`, cat: 'vars', title: `${n}${paren(`${T.eras[eraId].short}`)}`, tags: tagsOfEra(eraId), unlock: 'always', refs: ['readme', 'lm'], dev: true,
            body: () => {
              const u = dp.varUsers[n] || { eq: [], ev: [] };
              return `<div>${W.value}${COLON}<code>${esc(v.value)}</code> ${esc(v.unit || '')}</div><div><span class="chip">${esc(X.srcLabel(v.source))}</span> ${esc(v.note || '')}</div>
                <div class="sec">${W.used_by_formulas}${paren(`${u.eq.length}`)}</div><div class="wrap">${u.eq.map((q) => a(`formulas:${eraId}:${q}`, q)).join(' ') || '—'}</div>
                <div class="sec">${W.used_by_events}${paren(`${u.ev.length}`)}</div><div class="wrap">${u.ev.map((k) => a(`events:m:${eraId}:${k}`, T.eras[eraId].event_titles[k])).join(' ') || '—'}</div>`;
            },
          });
        }
        add({
          id: 'models:' + eraId, cat: 'models', title: T.eras[eraId].name, tags: tagsOfEra(eraId), unlock: 'always', refs: ['readme'], dev: true,
          body: () => `<div class="muted">${Object.keys(E.raw.equations).length} ${W.formula_count} · ${Object.keys(E.vars).length} ${W.var_count} · ${Object.keys(E.raw.events).length} ${W.event_count}</div><div class="sec">${W.model_events}</div><div class="wrap">${Object.keys(E.raw.events).map((k) => a(`events:m:${eraId}:${k}`, T.eras[eraId].event_titles[k])).join(' ')}</div><div class="sec">${W.full_yaml}</div><pre class="yaml">${esc(ctx.eraSource(eraId))}</pre>`,
        });
      }
    }
    return A;
  }

  const eraPlaceId = (eraId) => D.get('encyclopedia.sections.places').find((p) => p.era === eraId).id;
  const a = (id, label) => `<a class="wl" data-act="wiki" data-id="${esc(id)}">${esc(label)}</a>`;
  function varLink(eraId, v) { return ctx.era(eraId).vars[v] ? a(`vars:${eraId}:${v}`, v) : esc(v); }
  function exprLinks(eraId, ex) {
    const known = ctx.era(eraId).vars;
    let out = '', last = 0;
    for (const m of String(ex).matchAll(IDENT)) {
      out += esc(ex.slice(last, m.index));
      out += known[m[0]] ? a(`vars:${eraId}:${m[0]}`, m[0]) : esc(m[0]);
      last = m.index + m[0].length;
    }
    return out + esc(ex.slice(last));
  }

  let cache = null;
  const articles = () => (cache ||= buildArticles());
  const byId = (id) => articles().find((x) => x.id === id);
  const open = (x) => X.isUnlocked(x.unlock);
  const visible = (x) => open(x) || DEV;

  // [[id|label]] inside hand written text
  function link(text) {
    return esc(text).replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (m, id, label) => {
      const t = byId(id);
      if (!t) throw new Error('百科链接目标缺失: ' + id);
      return visible(t) && open(t) ? a(id, label) : (DEV ? a(id, label) : U.enc.locked_name);
    });
  }
  function relatedLinks(ids) {
    if (!ids || !ids.length) return '';
    return `<div class="sec">${W.related}</div><div class="wrap">${ids.map((id) => {
      const t = byId(id);
      if (!t) throw new Error('百科相关条目缺失: ' + id);
      return open(t) ? a(id, t.title) : (DEV ? a(id, t.title + ' ' + U.enc.hidden) : '');
    }).join(' ')}</div>`;
  }

  // ---------- filtering ----------
  const w = () => st.wiki;
  function matches(x) {
    const q = w().q.trim().toLowerCase();
    if (w().tag && !(x.tags || []).includes(w().tag)) return false;
    if (!q) return true;
    const tagText = (x.tags || []).map((t) => T.tags[t]).join(' ');
    return (x.title + ' ' + tagText).toLowerCase().includes(q);
  }
  const filtering = () => !!(w().q.trim() || w().tag);

  function tagBar() {
    const present = new Set();
    for (const x of articles()) if (visible(x)) (x.tags || []).forEach((t) => present.add(t));
    return `<details class="tagfold" ${w().tagOpen ? 'open' : ''}><summary>${W.tag_filter}${w().tag ? COLON + esc(T.tags[w().tag]) : ''}</summary><div class="tagbar"><button class="chipbtn ${w().tag ? '' : 'on'}" data-act="wikitag" data-id="">${W.all_tags}</button>${[...present].map((t) => `<button class="chipbtn ${w().tag === t ? 'on' : ''}" data-act="wikitag" data-id="${t}">${esc(T.tags[t])}</button>`).join('')}</div></details>`;
  }

  function listHtml() {
    const cats = Object.keys(W.cats).filter((c) => DEV || !['formulas', 'vars', 'models'].includes(c));
    const out = cats.map((c) => {
      const items = articles().filter((x) => x.cat === c);
      let rows = '';
      let n = 0;
      for (const x of items) {
        if (!visible(x)) { if (!filtering()) { rows += `<div class="wrow locked">${U.enc.locked_name}</div>`; n++; } continue; }
        if (!matches(x)) continue;
        n++;
        rows += `<div class="wrow ${w().cur === x.id ? 'on' : ''} ${open(x) ? '' : 'locked'}" data-act="wiki" data-id="${esc(x.id)}">${esc(x.title)}${open(x) ? '' : ' ' + U.enc.hidden}</div>`;
      }
      if (!n) return '';
      const devCat = ['formulas', 'vars', 'models'].includes(c);
      return `<details class="wcat" ${w().openCats[c] ? 'open' : ''} data-cat="${c}"><summary>${esc(W.cats[c])} <span class="muted">${n}</span>${devCat ? ' <span class="chip warn">' + W.dev_cats + '</span>' : ''}</summary>${rows}</details>`;
    }).join('');
    return out || `<p class="muted">${W.none}</p>`;
  }

  function articleHtml() {
    const x = w().cur ? byId(w().cur) : null;
    if (!x) return `<p class="muted">${W.pick}</p>`;
    if (!visible(x)) return `<p class="muted">${U.enc.locked_text}</p>`;
    const tags = (x.tags || []).map((t) => `<button class="chipbtn" data-act="wikitag" data-id="${t}">${esc(T.tags[t])}</button>`).join('');
    const rf = x.refs.map((id) => {
      if (!(id in D.get('encyclopedia.refs'))) throw new Error('百科引用缺失: ' + id);
      return `<div class="ref">${esc(refCite(id))} ${refStatus(id) === 'pending' ? `<span class="chip warn">${U.enc.pending}</span>` : refStatus(id) === 'game' ? `<span class="chip">${U.enc.game_ref}</span>` : ''}</div>`;
    }).join('');
    return `<h2>${esc(x.title)}${open(x) ? '' : ' ' + `<span class="chip warn">${U.enc.hidden}</span>`}</h2><div class="wrap">${tags}</div>${x.body()}<div class="refs"><span class="muted">${U.enc.refs}</span>${rf}</div>`;
  }

  function navHtml() {
    const hist = w().hist, pos = w().pos;
    return `<button data-act="wikiback" ${pos > 0 ? '' : 'disabled'}>‹ ${W.back}</button><button data-act="wikifwd" ${pos < hist.length - 1 ? '' : 'disabled'}>${W.forward} ›</button>`;
  }
  function html() {
    const hist = w().hist, pos = w().pos;
    return `<div class="wiki">
      <aside class="wside" data-keep="wikiside">
        <div class="row" id="wiki-nav">${navHtml()}</div>
        <input id="wiki-q" type="search" placeholder="${W.search_ph}" value="${esc(w().q)}">
        <div id="wiki-tags">${tagBar()}</div>
        <div id="wiki-list">${listHtml()}</div>
      </aside>
      <article class="wmain" id="wiki-article">${articleHtml()}</article>
    </div>`;
  }

  function go(id) {
    const x = byId(id);
    if (!x || !visible(x)) return;
    const s = w();
    if (s.hist[s.pos] !== id) { s.hist = s.hist.slice(0, s.pos + 1); s.hist.push(id); s.pos = s.hist.length - 1; }
    s.cur = id;
    s.openCats[x.cat] = true;
  }
  function move(d) { const s = w(); const p = s.pos + d; if (p >= 0 && p < s.hist.length) { s.pos = p; s.cur = s.hist[p]; w().openCats[byId(s.cur).cat] = true; } }
  // update only the wiki panels, so the page scroll and the list scroll stay where they are
  function refresh() {
    const set = (id, h) => { const el = document.getElementById(id); if (el) el.innerHTML = h; };
    set('wiki-nav', navHtml());
    set('wiki-tags', tagBar());
    set('wiki-list', listHtml());
    set('wiki-article', articleHtml());
  }
  function invalidate() { cache = null; }
  function onInput(value) {
    w().q = value;
    const el = document.getElementById('wiki-list');
    if (el) el.innerHTML = listHtml();
  }
  return { html, go, move, onInput, invalidate, articles, refresh };
}
