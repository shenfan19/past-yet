// Wiki style encyclopedia: a left list with search and tag filter, a right article with links, a back and forward history.
// Locked articles show as a question mark for visitors. In dev mode they show in full with a hidden mark, and the model categories appear.
import { staffName, staffTraits, fmtYear, staffProfile, radarSvg, isoDateLabel } from './narrate.js';
import { echoSources } from './quotes.js';
import { localeTag } from './language.js';

const IDENT = /[A-Za-z_][A-Za-z0-9_.]*/g;

export function createWiki(X) {
  const { D, ctx, T, U, DEV, esc, r1, st } = X;
  const W = U.wiki;
  const collator = new Intl.Collator(localeTag(D.lang), { numeric: true });
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
    const events = D.get('catalog.events');
    const eventRefs = new Map(events.map((e) => [e.id, e.refs || []]));
    const tagsOfEra = (eraId) => T.eras[eraId].tags;
    const eraTitle = (eraId) => T.eras[eraId].name;

    for (const e of sec('places')) add({ id: 'places:' + e.id, cat: 'events', title: e.name, tags: e.tags, unlock: e.unlock, refs: e.refs, authors: e.authors, body: () => `<p>${link(e.text)}</p>${relatedLinks(e.related)}` });
    // a person with `events` is the figure of those catalogue events: the page opens with the first event, takes its tags and links to every one
    const personOf = {};
    // The IF lines of a person: what the employees changed in that life on their branches, apart from the history above and marked as fiction.
    // A line opens once a trip has won its point; it belongs to the person the card names with who, or else to the figure of the story. See 5.12 of the story outline.
    const ifLines = (pid, evs) => {
      // a win carries its own words, from a small story or a full model alike: the shift of the point, the year and the place
      const rows = X.office.winsOf().filter((w) => !w.guard).map((w) => {
        const sh = w.shift;
        if (!sh || !(sh.bio || sh.now) || !(sh.who ? sh.who === pid : evs.includes(w.event))) return '';
        const staff = staffName(D, w.trip.staffId);
        const from = U.enc.if_from.replace('{year}', fmtYear(D, w.year)).replace('{place}', w.where || '').replace('{staff}', staff);
        return `<li><div class="from">${esc(from)}</div>${esc(String(sh.bio || sh.now).split('{staff}').join(staff))}</li>`;
      }).filter(Boolean);
      return rows.length ? `<div class="sec">${esc(U.enc.if_title)}</div><p class="muted">${esc(U.enc.if_note)}</p><ul class="iflines">${rows.join('')}</ul>` : '';
    };
    // The words of a person: every quote of the card. An echo, a quote with a tier, shows once a trip has given it, 5.15 of the story outline;
    // until then it keeps its place as question marks with the tier that brings it. A quote without a tier is a plain line and always shows.
    const quotesBlock = (pid) => {
      const Q = D.get('quotes.quotes');
      const order = D.get('config.echo.tiers');
      const mine = Object.keys(Q).filter((id) => Q[id].person === pid && T.quotes[id])
        .sort((a, b) => (Q[a].tier ? order.indexOf(Q[a].tier) : order.length) - (Q[b].tier ? order.indexOf(Q[b].tier) : order.length));
      if (!mine.length) return '';
      const heard = ctx.S().heard || [];
      const rows = mine.map((id) => {
        const q = T.quotes[id];
        if (Q[id].tier && !heard.includes(id)) return `<li class="locked"><div class="q">${esc(U.enc.quote_locked)}</div><div class="muted small">${esc(U.enc.quote_tier[Q[id].tier])}</div></li>`;
        const cite = q.occasion ? U.report.echo_cite.replace('{who}', q.who).replace('{date}', isoDateLabel(D, Q[id].date)).replace('{occasion}', q.occasion) : q.who;
        const original = Q[id].said && Q[id].said !== q.quote ? `<div class="muted small">${esc(Q[id].said)}</div>` : '';
        return `<li><div class="q">${U.fmt.quote.replace('{x}', esc(q.quote))}</div>${original}<div class="muted small">${esc(cite)}${echoSources(D, Q[id].sources, esc)}</div></li>`;
      });
      const title = mine.some((id) => Q[id].contextual) ? U.enc.context_echoes : U.enc.quotes_title;
      return `<div class="sec">${esc(title)}</div><ul class="quotelist">${rows.join('')}</ul>`;
    };
    for (const e of sec('people')) {
      const evs = e.events || [];
      for (const ev of evs) personOf[ev] = e.id;
      add({
        id: 'people:' + e.id, cat: 'people', title: e.name, authors: e.authors,
        tags: evs.length ? D.get('antiques.antiques.relic_' + evs[0] + '.tags') : e.tags,
        unlock: evs.length ? { anchored: 'relic_' + evs[0] } : e.unlock,
        refs: [...(e.refs || []), ...evs.flatMap((id) => eventRefs.get(id) || [])],
        // the stars of a person are the best stars of all the episodes of that person, added up
        body: () => {
          const keys = evs.map((id) => { const c = D.get('catalog.events').find((x) => x.id === id); return c && c.era ? c.era : id; }).filter((k) => D.get('catalog.events').some((x) => x.id === k || x.era === k));
          const got = keys.reduce((a, k) => a + (ctx.S().stars[k] || 0), 0), all = keys.reduce((a, k) => a + ctx.backend.maxStars(k), 0);
          const total = keys.length > 1 ? `<div class="muted">${esc(U.enc.person_stars.replace('{n}', String(got)).replace('{m}', String(all)).replace('{k}', String(keys.length)))}</div>` : '';
          const pics = D.get('encyclopedia').images ? (D.get('encyclopedia.images')[e.id] || []) : [];
          const pic = pics.find((x) => x.kind === 'portrait') || pics[0];
          const fig = pic ? `<figure class="personpic"><img src="data/people/${esc(e.id)}/images/${esc(pic.file)}" alt="${esc(pic.title[D.lang] || pic.title[D.get('config.i18n.fallback')])}"><figcaption class="muted small">${esc(pic.title[D.lang] || pic.title[D.get('config.i18n.fallback')])} · ${esc(pic.credit)} · ${esc(pic.license)}</figcaption></figure>` : '';
          return `${fig}<p>${link(e.text)}</p>${total}${quotesBlock(e.id)}${ifLines(e.id, evs)}${relatedLinks(evs.length ? evs.map((ev) => 'events:c:' + ev) : e.related)}`;
        },
      });
    }
    for (const e of sec('events')) add({ id: 'events:' + e.id, cat: 'events', title: e.name, tags: e.tags, unlock: e.unlock, refs: e.refs, authors: e.authors, body: () => `<p>${link(e.text)}</p>${relatedLinks(e.related)}` });

    // the catalogue: famous events with a relic each, readable once the relic is owned
    for (const ev of events) {
      const c = T.catalog[ev.id];
      const relicId = 'relic_' + ev.id;
      add({
        id: 'events:c:' + ev.id, cat: 'events', title: c.name, tags: D.get('antiques.antiques.' + relicId + '.tags'), unlock: { anchored: relicId }, refs: ev.refs || ['catalog'], authors: ev.authors,
        body: () => {
          const days = ev.era ? ctx.backend.eraStay(ev.era) : ctx.backend.lightStay(ev.id);
          const stay = U.dispatch.travel_time.replace('{n}', String(days)).replace('{h}', String(ctx.backend.historicalDays(days)));
          return `<p>${esc(c.story)}</p><div class="muted">${esc(fmtYear(D, ev.year))} · ${esc(c.place)}</div><div>${U.dispatch.character}${COLON}${personOf[ev.id] && byId('people:' + personOf[ev.id]) && open(byId('people:' + personOf[ev.id])) ? a('people:' + personOf[ev.id], c.figure) : esc(c.figure)}</div><div>${U.dispatch.relic}${COLON}${D.get('antiques.antiques.' + relicId).kind === 'medium' ? esc(c.relic) : a('antiques:' + relicId, c.relic)}</div><div class="muted">${esc(stay)}</div>`;
        },
      });
    }

    // events that come out of the models
    const me = Object.fromEntries(Object.entries(D.get('encyclopedia.model_events')).map(([k, v]) => [k, { refs: v.refs, authors: v.authors, text: D.get('enc_text.model_events.' + k) }]));
    for (const eraId of eraIds()) {
      for (const key of Object.keys(ctx.era(eraId).raw.events)) {
        const info = me[key];
        add({
          id: `events:m:${eraId}:${key}`, cat: 'events', title: `${T.eras[eraId].event_titles[key]}${paren(`${T.eras[eraId].short}`)}`, tags: tagsOfEra(eraId), unlock: { era: eraId }, refs: info.refs, authors: info.authors,
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
        id: 'staff:' + id, cat: 'staff', title: staffName(D, id), tags: [], unlock: { staff: id }, refs: ['game'], authors: D.get('staff.staff.' + id).authors,
        body: () => {
          const stats = ctx.backend.staffStats(id);
          const mini = D.get('staff.attributes').map((k) => `${esc(T.stats[k])} ${r1(stats[k])}`).join(' · ');
          const traits = staffTraits(D, id).map((t) => a('traits:' + t, T.traits[t])).join(' ');
          return `<div class="radarwrap">${radarSvg(D, stats)}</div><div class="muted">${esc(staffProfile(D, id))}</div><div class="wrap">${traits}</div><p>${esc(T.staff[id].bio)}</p><p>${esc(T.staff[id].story || '')}</p><div class="muted">${mini}</div>`;
        },
      });
    }

    for (const t of Object.keys(D.get('staff.traits'))) {
      add({
        id: 'traits:' + t, cat: 'traits', title: T.traits[t], tags: [], unlock: { trait: t }, refs: ['game'], authors: D.get('staff.traits.' + t + '.authors'),
        body: () => {
          const tr = D.get('staff.traits.' + t);
          const mods = X.pointsText(tr);
          const pol = Object.entries(tr.policy || {}).map(([grp, key]) => `${U.dispatch[grp]}${COLON}${T.strategies[grp][key].name}`).join(U.fmt.semi);
          const who = Object.keys(D.get('staff.staff')).filter((id) => X.isUnlocked({ staff: id }) && staffTraits(D, id).includes(t)).map((id) => a('staff:' + id, staffName(D, id))).join(' ');
          const pref = `<div>${U.office.secretary_as}${COLON}${esc(X.traitPerk(t))}</div>`;
          const note = T.trait_notes[t];
          return `<p>${esc(note.pro)}</p><div>${U.stars.trait_bonus}${COLON}${esc(mods)}</div>${pol ? `<div>${esc(pol)}</div>` : ''}${pref}<div class="sec">${W.related}</div><div class="wrap">${who}</div>`;
        },
      });
    }

    const base = D.get('staff.default_base');
    for (const e of D.get('encyclopedia.stats').map((x) => ({ ...x, ...D.get('enc_text.stats.' + x.id) }))) {
      add({
        id: 'stats:' + e.id, cat: 'stats', title: e.name || T.stats[e.id], tags: [], unlock: e.unlock, refs: ['game'], authors: e.authors,
        body: () => {
          const mods = '';
          const side = (label, text, inModel) => (inModel || DEV) ? `<div><b>${label}</b>${COLON}${esc(text)}${DEV ? ` <span class="chip ${inModel ? '' : 'warn'}">${inModel ? U.enc.edge_impl : U.enc.edge_pending}</span>` : ''}</div>` : `<div><b>${label}</b>${COLON}${U.enc.edge_none}</div>`;
          const head = e.kind === 'office' ? `<p>${esc(e.text)}</p>` : `<p class="muted">${U.enc.stat_rule}</p><div>${U.enc.base} ${base[e.id]}</div><div>${U.enc.modified_by}${COLON}${esc(mods || U.enc.no_ref)}</div>`;
          return `${head}${side(U.enc.edge_gain, e.gain, e.gain_in_model)}${side(U.enc.edge_cost, e.cost, e.cost_in_model)}`;
        },
      });
    }


    for (const [id, an] of Object.entries(D.get('antiques.antiques'))) {
      if (an.kind === 'medium') continue;
      const tx = T.antiques[id];
      add({
        id: 'antiques:' + id, cat: 'items_ancient', title: tx.name, tags: an.tags, unlock: { antique: id }, refs: ['game'], authors: an.authors,
        body: () => `<p>${esc(tx.desc)}</p><p class="muted">${W.kinds.ancient}</p><div class="muted">${U.dispatch.points_to}${COLON}${an.era ? a('places:' + eraPlaceId(an.era), T.eras[an.era].name) : an.event ? a('events:c:' + an.event, T.catalog[an.event].name) : U.dispatch.not_ready} · ${U.shop.research_grant} ${X.office.salePrice(id)}</div>`,
      });
    }

    for (const [id, it] of Object.entries(D.get('items'))) {
      if (it.retired) continue;
      const tx = T.items[id];
      add({
        id: 'items:' + id, cat: it.shop === 'future' ? 'items_future' : 'items_modern', title: tx.name, tags: it.tags, unlock: { item: id }, refs: ['game'], authors: it.authors,
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
  const open = (x) => x.unlock != null && X.isUnlocked(x.unlock);
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
    const filtered = filtering();
    const out = cats.map((c) => {
      const items = articles().filter((x) => x.cat === c).sort((a, b) => collator.compare(a.title, b.title));
      const unlockedRows = [];
      const lockedRows = [];
      let unlocked = 0;
      for (const x of items) {
        const isOpen = open(x);
        if (isOpen) unlocked++;
        if (!isOpen && !DEV) {
          if (!filtered) lockedRows.push(`<div class="wrow locked">${esc(U.enc.locked_name)}</div>`);
          continue;
        }
        if (filtered && !matches(x)) continue;
        const rows = isOpen ? unlockedRows : lockedRows;
        rows.push(`<div class="wrow ${w().cur === x.id ? 'on' : ''} ${isOpen ? '' : 'locked'}" data-act="wiki" data-id="${esc(x.id)}">${esc(x.title)}${isOpen ? '' : ' ' + esc(U.enc.hidden)}</div>`);
      }
      if (!unlockedRows.length && !lockedRows.length) return '';
      const devCat = ['formulas', 'vars', 'models'].includes(c);
      return `<details class="wcat" ${w().openCats[c] ? 'open' : ''} data-cat="${c}"><summary>${esc(W.cats[c])} <span class="muted wcount">${unlocked}/${items.length}</span>${devCat ? ' <span class="chip warn">' + W.dev_cats + '</span>' : ''}</summary>${unlockedRows.join('')}${lockedRows.join('')}</details>`;
    }).join('');
    return out || `<p class="muted">${W.none}</p>`;
  }

  function articleHtml() {
    const x = w().cur ? byId(w().cur) : null;
    if (!x) return `<p class="muted">${W.pick}</p>`;
    if (!visible(x)) return `<p class="muted">${U.enc.locked_text}</p>`;
    const tags = (x.tags || []).map((t) => `<button class="chipbtn" data-act="wikitag" data-id="${t}">${esc(T.tags[t])}</button>`).join('');
    const sourceIds = [...new Set(x.refs || [])].filter((id) => id !== 'game' && id !== 'catalog');
    const rf = sourceIds.map((id) => {
      if (!(id in D.get('encyclopedia.refs'))) throw new Error('百科引用缺失: ' + id);
      return `<div class="ref">${esc(refCite(id))} ${refStatus(id) === 'pending' ? `<span class="chip warn">${esc(U.enc.pending)}</span>` : ''}</div>`;
    }).join('');
    const defaults = D.get('config.meta.card_authors');
    const authors = x.authors ?? defaults;
    const hasSpecialCredit = authors.length !== defaults.length || authors.some((name) => !defaults.includes(name));
    const credited = hasSpecialCredit ? authors.filter((name) => name !== 'AI') : [];
    const credit = credited.length ? `<div class="muted">${esc(U.enc.card_authors)}${COLON}${esc(credited.join(', '))}</div>` : '';
    const sources = rf ? `<span class="muted">${esc(U.enc.refs)}</span>${rf}` : '';
    const footer = credit || sources ? `<div class="refs">${credit}${sources}</div>` : '';
    return `<h2>${esc(x.title)}${open(x) ? '' : ' ' + `<span class="chip warn">${U.enc.hidden}</span>`}</h2><div class="wrap">${tags}</div>${x.body()}${footer}`;
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
    if (!x) return false;
    const s = w();
    if (s.hist[s.pos] !== id) { s.hist = s.hist.slice(0, s.pos + 1); s.hist.push(id); s.pos = s.hist.length - 1; }
    s.cur = id;
    if (visible(x)) s.openCats[x.cat] = true;
    return true;
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
