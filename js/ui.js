import { diffRows, kitText, staffName, staffTraits, itemText, firstSentence, fmtYear, staffProfile, radarSvg, staffSaying, isoDateLabel } from './narrate.js';
import { pointsLeft, founderProblem } from './founder.js';
import { createWiki } from './wiki.js';
import { createShop } from './shop.js';
import { createWorldMap } from './worldmap.js';
import { createListbox } from './listbox.js';
import { createOffice } from './office.js';
import { createSettingsPage } from './settings_ui.js';
import { createShare } from './share.js';
import { createHeaderLines, echoSources } from './quotes.js';
import { chosenLocale, localeTag } from './language.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (x) => (Math.round(x * 10) / 10).toString();
const ri = (x) => String(Math.round(x));

export function createUI(D, ctx, DEV = false) {
  const T = D.get('text');
  const U = T.ui;
  const COLON = U.fmt.colon, SEP = U.fmt.sep;
  const O = D.get('config.office');
  const view = document.getElementById('view');
  const tabsEl = document.getElementById('tabs');
  const toolsEl = document.getElementById('tools');
  const I = D.get('config.i18n');
  const UI_KEY = 'teleporter_ui_state';
  let savedLang = null;
  try { savedLang = localStorage.getItem(I.storage_key); } catch (e) { /* storage blocked */ }
  const urlLang = new URLSearchParams(location.search).get('lang');
  const chosen = chosenLocale(I, urlLang, savedLang);
  // The language selector lives on the settings page. It is drawn there and handled here, so a change keeps the page and state.
  function langHtml() {
    const opts = `<option value="${I.auto}" ${chosen === I.auto ? 'selected' : ''}>${esc(U.lang.auto)}</option>` + Object.entries(I.locales).map(([code, name]) => `<option value="${esc(code)}" lang="${esc(localeTag(code))}" ${chosen === code ? 'selected' : ''}>${esc(name)}</option>`).join('');
    return `<select id="lang" aria-label="${esc(U.lang.label)}">${opts}</select>`;
  }
  function changeLang(value) {
    try {
      if (value === I.auto) localStorage.removeItem(I.storage_key); else localStorage.setItem(I.storage_key, value);
    } catch (e) { /* storage blocked */ }
    saveUiState();
    const u = new URL(location.href);
    u.searchParams.delete('lang');
    location.href = u.toString();
  }
  // the logo is one svg in data/, used as a data URL so it also works in play.html and keeps the share canvas exportable
  const logoUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(D.get('logo'));
  document.getElementById('logo').innerHTML = `<img src="${logoUrl}" alt="">`;
  document.querySelector('link[rel=icon]').href = logoUrl;
  const versionLabel = document.createElement('span');
  versionLabel.className = 'brand-version';
  versionLabel.textContent = 'v' + D.get('config.meta.version');
  document.getElementById('title').replaceChildren(U.title, ' ', versionLabel);

  const st = { chartOff: new Set(), tab: 'home', modal: null, modalStack: [], pager: {}, filters: {}, showArchived: false, vs: false, opened: new Set(), form: null, suggest: null, searching: false, cart: {}, sort: {}, scrollY: {}, lastKey: null, wiki: { q: '', tag: '', cur: null, hist: [], pos: -1, openCats: {}, tagOpen: false }, map: null, recordAll: null, settled: {} };

  // ---------- navigation history ----------
  // Every page the player lands on is one entry, so the back and forward buttons and the browser's own buttons walk the same trail.
  // Render records the entry, so any way of changing page is covered without each place having to remember it.
  const nav = { list: [], pos: -1, sid: String(Date.now()) };
  const navSnap = () => ({ tab: st.tab, modal: st.modal });
  const navSame = (a, b) => a.tab === b.tab;
  function navCommit() {
    const s = navSnap();
    if (nav.pos < 0) {
      nav.list = [s]; nav.pos = 0;
      try { history.replaceState({ n: 0, sid: nav.sid }, ''); } catch (e) { /* history may be blocked */ }
      return;
    }
    if (navSame(nav.list[nav.pos], s)) { nav.list[nav.pos] = s; return; }
    nav.list = nav.list.slice(0, nav.pos + 1);
    nav.list.push(s);
    nav.pos += 1;
    try { history.pushState({ n: nav.pos, sid: nav.sid }, ''); } catch (e) { /* history may be blocked */ }
  }
  function navStep(delta) {
    if (nav.pos + delta < 0 || nav.pos + delta >= nav.list.length) return;
    try { history.go(delta); } catch (e) { /* history may be blocked */ }
  }
  const eraList = () => D.get('config.eras');
  const E = () => ctx.era(st.form.eraId);

  const antiqueDefs = () => D.get('antiques.antiques');
  const owns = (id) => ctx.S().antiques.includes(id);
  const anchorOf = (eraId) => Object.keys(antiqueDefs()).find((id) => antiqueDefs()[id].era === eraId);
  // A place or an event is open only while its antique is anchored, whatever kind of place it is.
  const anchored = (id) => ctx.S().locks.includes(id);
  const eraOpen = (eraId) => anchored(anchorOf(eraId));
  const catalogTags = (id) => D.get('antiques.antiques.relic_' + id + '.tags');
  const visibleEras = () => eraList().filter((id) => DEV || eraOpen(id));
  const hiredIds = () => Object.keys(ctx.S().staff).filter((id) => ctx.S().staff[id].hired);
  function isUnlocked(rule) {
    if (rule === 'always') return true;
    if ('era' in rule) return eraOpen(rule.era) || ctx.S().dispatches.some((d) => d.eraId === rule.era);
    if ('antique' in rule) return owns(rule.antique);
    if ('anchored' in rule) return anchored(rule.anchored);
    if ('trait' in rule) return hiredIds().some((id) => staffTraits(D, id).includes(rule.trait));
    if ('staff' in rule) return hiredIds().includes(rule.staff) || (ctx.S().hire && ctx.S().hire.slots.some((x) => x.id === rule.staff)) || ctx.S().trips.some((x) => x.staffId === rule.staff);
    if ('item' in rule) return D.get('items.' + rule.item + '.playable') || (ctx.S().inv[rule.item] || 0) > 0;
    throw new Error('未知解锁条件');
  }
  const hiddenChip = () => `<span class="chip warn">${U.enc.hidden}</span>`;

  function newForm(eraId) {
    const e = ctx.era(eraId);
    return {
      eraId, staffId: hiredIds()[0],
      items: Object.fromEntries(Object.keys(e.itemBindings).map((k) => [k, 0])),
      seed: Math.floor(Math.random() * D.get('config.engine.seed_max')) + 1,
    };
  }

  // ---------- helpers ----------
  const staffState = (id) => office.staffState(id);
  const totals = () => ctx.backend.itemTotals(st.form.items);
  const formSpec = () => ({ seed: Number(st.form.seed) || 1, staffId: st.form.staffId, items: Object.fromEntries(Object.entries(st.form.items).filter(([k]) => k in E().itemBindings)) });
  const sceneKit = () => Object.fromEntries(Object.entries(st.form.items).filter(([k, n]) => n > 0 && ctx.backend.lightKitAllowed(st.map.cat, k)));
  const srcLabel = (src) => ({ historical: U.report.source_historical, lm_model: U.report.source_lm, game_assumption: U.report.source_game, calibrated: U.report.source_calibrated }[src]);
  const reports = () => ctx.S().dispatches.filter((d) => d.claimed).sort((a, b) => b.claimedAt - a.claimedAt);
  // the calendar of the office: day 0 is the date the game began, see calendarStart in main.js
  const officeDate = (day) => { const at = new Date((ctx.S().calendarStart || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z'); at.setUTCDate(at.getUTCDate() + Math.floor(day)); return at; };
  const officeDay = (day) => { const at = officeDate(day); return T.date_day.replace('{m}', String(at.getUTCMonth() + 1)).replace('{mn}', T.month_names[at.getUTCMonth()]).replace('{d}', String(at.getUTCDate())); };
  const tip = (text) => ` data-tip="${esc(text)}"`;
  const wl = (id, label, tipText) => `<a class="wl" data-act="wiki" data-id="${esc(id)}"${tipText ? tip(tipText) : ''}>${esc(label)}</a>`;
  // What a sync point asks for, said from its requirement, so the hint can never differ from the rule. All the keys of a requirement must hold, any lists alternatives.
  const jobNames = (() => { const m = {}; for (const [sid, s] of Object.entries(D.get('staff.staff'))) s.jobs.forEach((j, i) => { m[j] = m[j] || T.staff[sid].jobs[i]; }); return m; })();
  const reqClauses = (req) => Object.entries(req).map(([k, v]) => {
    const S_ = U.stars;
    if (k === 'stat') return Object.entries(v).map(([s, n]) => S_.need_stat.replace('{s}', T.stats[s]).replace('{n}', String(n))).join(S_.need_and);
    if (k === 'trait') return S_.need_trait.replace('{t}', v.map((x) => T.traits[x]).join(S_.need_or));
    if (k === 'job') return S_.need_job.replace('{j}', v.map((x) => jobNames[x] || x).join(S_.need_or));
    if (k === 'gender') return U.gender[v];
    if (k === 'item') return S_.need_gear.replace('{i}', T.items[v].name);
    if (k === 'provides') return Object.entries(D.get('items')).filter(([, it]) => it.scene && it.provides.includes(v)).map(([id]) => S_.need_gear.replace('{i}', T.items[id].name)).join(S_.need_or);
    if (k === 'luck') return S_.need_luck;
    return v.map((r) => reqClauses(r).join(S_.need_and)).join(S_.need_or);
  });
  // the pressure channels of a story in words: the name of each channel and how hard it presses
  const pressureText = (chs) => Object.entries(chs).map(([c, lv]) => U.dispatch.channel_names[c] + ' ' + U.dispatch.channel_levels[lv]).join(' · ');
  const reqHint = (req) => { const c = reqClauses(req); return c.length ? ` <span class="muted">${esc(U.stars.need.replace('{x}', c.join(U.stars.need_and)))}</span>` : ''; };
  const statsLine = (stats) => D.get('staff.attributes').map((k) => `${T.stats[k]} ${r1(stats[k])}`).join(' · ');
  // what a trait does at the sync points, as percent per kind of point, for example persuading +35%
  const pointsText = (tr) => Object.entries(tr.points).map(([k, v]) => `${T.point_kinds[k]} +${Math.round(v * 100)}%`).join(SEP);
  // What a secretary gives, in words: shares as percent, an attribute lent as its points, a sure star by its kind. perkParts reads office.perks(),
  // traitPerk the card of one trait, which has no secretary yet, so an attribute is told as the share of the secretary's own.
  const PK = () => U.office.perks;
  const shareText = (k, v) => `${PK()[k]} ${k === 'rest_cut' ? '−' : '+'}${Math.round(v * 100)}%`;
  const perkParts = (pk) => [
    ...['sale_mult', 'rest_cut', 'favor_gain'].filter((k) => pk[k]).map((k) => shareText(k, pk[k])),
    ...Object.entries(pk.attrs).filter(([, n]) => n).map(([a, n]) => PK().attr.replace('{attr}', T.stats[a]).replace('{n}', String(n))),
    ...pk.sure.map((s) => PK()['sure_' + s + '_short']),
  ];
  function traitPerk(t) {
    const [[k, v]] = Object.entries(D.get('staff.traits.' + t).secretary);
    if (k === 'attr') return PK().attr_trait.split('{attr}').join(T.stats[v]).replace('{d}', String(D.get('config.office.secretary.attr_divisor')));
    if (k === 'sure') return PK()['sure_' + v];
    return shareText(k, v);
  }
  function traitTip(t) {
    const tr = D.get('staff.traits.' + t);
    const mods = pointsText(tr);
    const pol = Object.entries(tr.policy || {}).map(([grp, key]) => `${U.dispatch[grp]}${COLON}${T.strategies[grp][key].name}`).join(U.fmt.semi);
    const note = T.trait_notes[t];
    return [T.traits[t], note.pro, `${U.stars.trait_bonus}${COLON}${mods}`, pol, `${U.office.secretary_as}${COLON}${traitPerk(t)}`].filter(Boolean).join('\n');
  }
  function staffTip(id) {
    const stats = ctx.backend.staffStats(id);
    const mini = statsLine(stats);
    return [staffProfile(D, id), T.staff[id].bio, staffTraits(D, id).map((t) => T.traits[t]).join(SEP), mini].join('\n');
  }
  const staffLink = (id) => `<a class="wl" data-act="staffopen" data-id="${esc(id)}"${tip(staffTip(id))}>${esc(staffName(D, id))}</a>`;
  // a three star trip that earned a point of an attribute says so in the accounts
  const grownRow = (paid) => (paid && paid.grown ? `<tr><td>${U.report.grown}</td><td class="num">${esc(T.stats[paid.grown])} +1</td></tr>` : '');
  // The stars an employee has brought in, as three counts: three stars, two stars, one star. It never grows into a list.
  const tallyHtml = (stars) => `<span class="tally">★ ${stars}</span>`;
  const traitChip = (t) => `<a class="chip tr" data-act="wiki" data-id="traits:${t}"${tip(traitTip(t))}>${esc(T.traits[t])}</a>`;
  // stars: filled and empty marks coloured by the count, bronze, silver and gold
  const STAR_MAX = D.get('config.stars.max');
  // the stars of a place: how many it has is the number of its sync points, so a place id gives the length of the row
  const starsHtml = (n, place) => { const m = place ? ctx.backend.maxStars(place) : STAR_MAX; return starRow(n, m); };
  const starRow = (n, STAR_MAX) => `<span class="stars s${n}"${tip(U.stars.label.replace('{n}', String(n)).replace('{m}', String(STAR_MAX)))}>${'★'.repeat(n)}${'☆'.repeat(STAR_MAX - n)}</span>`;
  // the sync points of a trip, hit or not, with the words of the place
  // a point that a trait made up for, or that a trait lost, says so, because the timeline shows what happened and the traits then changed the count
  const pointsHtml = (cur, textOf) => `<ul class="sync">${cur.report.points.map((p) => `<li class="${p.hit ? 'hit' : 'miss'}${p.bonus ? ' bonus' : ''}${p.lost ? ' lost' : ''}">${p.redeem ? (p.hit ? '♥' : '♡') : (p.hit ? '★' : '☆')} ${p.day ? `<span class="muted">${esc(U.report.participation.day.replace('{day}', String(p.day)))} · </span>` : ''}${esc(textOf(p.id))}${p.bonus ? ` <span class="chip trait">${U.stars.by_trait}</span>` : ''}${p.lost ? ` <span class="chip trait">${U.stars.lost_by_trait}</span>` : ''}${p.sure ? ` <span class="chip trait">${U.stars.by_secretary}</span>` : ''}</li>`).join('')}</ul>`;
  const yearOfPlace = (id, light) => (light ? D.get('catalog.events').find((x) => x.id === id).year : ctx.era(id).raw.metadata.era.year);
  const shortOfPlace = (id, light) => (light ? T.catalog[id].place : T.eras[id].short);
  const placeYear = (d) => fmtYear(D, d.light ? D.get('catalog.events').find((x) => x.id === d.eraId).year : ctx.era(d.eraId).raw.metadata.era.year);
  const placeName = (d) => (d.light ? T.catalog[d.eraId].name : T.eras[d.eraId].name);
  // The protagonist of a place is who the story is about, and is the more important name of a record: the figure of a catalogue event, or the protagonist of a simulated era, linked to the article about them.
  // which person an event belongs to: a person can have several events, the episodes of that person
  const personOfEvent = {};
  for (const p of D.get('encyclopedia.sections.people')) for (const e of p.events || []) personOfEvent[e] = p.id;
  const protagonistOf = (d) => {
    if (d.light) return { name: T.catalog[d.eraId].figure, link: personOfEvent[d.eraId] ? 'people:' + personOfEvent[d.eraId] : '' };
    // the person of an era is the figure of the event that hands over to it; the two older eras name theirs in the plots
    const ET = T.eras[d.eraId];
    const ev = D.get('catalog.events').find((x) => x.era === d.eraId);
    const art = ev && personOfEvent[ev.id] ? 'people:' + personOfEvent[ev.id] : Object.values(ET.plots || {}).map((x) => x.article).find(Boolean);
    return { name: ET.protagonist, link: art || '' };
  };
  const protagonistHtml = (d) => { const p = protagonistOf(d); return p.link ? wl(p.link, p.name) : esc(p.name); };
  const staffLine = (id) => `<div class="muted small">${U.report.staff_line.replace('{x}', staffLink(id))}</div>`;
  // under the title of a report, the employee's own words on coming back with the name; without words, the plain line that names the employee
  const echoDate = (iso) => isoDateLabel(D, iso);
  // The echo, 5.15 of the story outline: the recorded line of the person, large, with who said it, when and where in small letters below.
  // When the words were said in another language than the page, the words as said follow in small letters.
  const echoHtml = (qid) => {
    const q = qid && T.quotes[qid];
    const Q = qid && D.get('quotes.quotes')[qid];
    if (!q || !Q?.tier || !Q.sources?.length) return '';
    const said = Q.said && Q.original !== D.lang && Q.said !== q.quote ? `<div class="echosaid">${esc(Q.said)}</div>` : '';
    return `<figure class="echo"><blockquote>${U.fmt.quote.replace('{x}', esc(q.quote))}</blockquote>${said}<figcaption>${esc(U.report.echo_cite.replace('{who}', q.who).replace('{date}', echoDate(Q.date)).replace('{occasion}', q.occasion))}${echoSources(D, Q.sources, esc)}</figcaption></figure>`;
  };
  // The settlement at the head of a report, its summary: the stars one row each, what the trip brought and cost, the shift of the timeline, then the echo.
  // The record waits folded below, and the line the employee says on coming back is in it, at the return.
  // When an action redraws the report, the rows resume their animation at the elapsed time. A click on the settlement shows it all at once.
  const settleHtml = (cur, S) => {
    const C = D.get('config.ui.settle');
    const rows = [];
    const chips = (p) => `${p.bonus ? ` <span class="chip trait">${U.stars.by_trait}</span>` : ''}${p.lost ? ` <span class="chip trait">${U.stars.lost_by_trait}</span>` : ''}${p.sure ? ` <span class="chip trait">${U.stars.by_secretary}</span>` : ''}`;
    for (const p of cur.report.points || []) rows.push(`<li class="${p.hit ? 'hit' : 'miss'}">${p.redeem ? (p.hit ? '♥' : '♡') : (p.hit ? '★' : '☆')} ${esc(S.pointText(p.id))}${chips(p)}</li>`);
    if (cur.paid?.energy) rows.push(`<li class="gain">${esc(U.report.energy_gain)} +${ri(cur.paid.energy)}${cur.newBest ? ' · ' + U.stars.new_best : ''}</li>`);
    if (cur.paid?.grown) rows.push(`<li class="gain">${esc(U.report.grown)}${COLON}${esc(T.stats[cur.paid.grown])} +1</li>`);
    if (cur.paid?.antique) rows.push(`<li class="gain">${esc(U.report.antique_gain)}${COLON}${wl('antiques:' + cur.paid.antique, T.antiques[cur.paid.antique].name)}${cur.paid.duplicate ? ' · ' + U.report.antique_dup : ''}</li>`);
    if (S.cost) rows.push(`<li class="gain">${esc(U.report.spent)}${COLON}${ri(S.cost)}</li>`);
    rows.push(`<li class="gain">${esc(U.report.rest)} ${S.restDays} ${esc(U.report.days)}</li>`);
    // the shift of the timeline comes in after the rows as one more of them, and the echo last
    const shift = S.shift ? `<li class="shiftrow" style="--i:${rows.length}">${S.shift}</li>` : '';
    const n = rows.length + (shift ? 1 : 0);
    const echo = echoHtml(cur.echo ?? ctx.backend.echoOf(cur));
    const now = Date.now();
    if (!(cur.id in st.settled)) st.settled[cur.id] = now;
    const gone = now - st.settled[cur.id];
    const total = n * C.step_ms + C.echo_pause_ms + C.echo_ms;
    const moving = gone < total;
    const animation = moving ? ` style="--step:${C.step_ms}ms;--item:${C.item_ms}ms;--echo-at:${n * C.step_ms + C.echo_pause_ms}ms;--echo:${C.echo_ms}ms;--gone:${gone}ms"` : '';
    return `<section class="settle${moving ? ' moving' : ''}"${animation} data-act="settleskip" data-id="${cur.id}">
      <div class="sec">${U.report.accounts}</div>
      <ul class="settlerows">${rows.map((r, i) => r.replace('<li class="', `<li style="--i:${i}" class="`)).join('')}${shift}</ul>${echo}</section>`;
  };
  const sayingLine = (d) => { const x = ctx.backend.sayingOf(d); return x ? `<p class="saying">${U.fmt.quote.replace('{x}', esc(x))} <span class="muted">${U.fmt.dash}${staffLink(d.spec.staffId)}</span></p>` : staffLine(d.spec.staffId); };
  const placeShort = (d) => (d.light ? T.catalog[d.eraId].place : T.eras[d.eraId].short);
  // how a trip ended is told by its stamp, see stampOf in backend.js
  const outcomeOf = (d) => U.report.stamp[ctx.backend.stampOf(d)];
  // a plain running count of the trips sent out, not a reference to anything
  const livesOf = (d) => (d.recalled || d.evacuation || d.light ? '—' : r1(d.report.accounts.lives));
  const recordRow = (d, withStaff) => `<tr><td>${withStaff ? staffLink(d.spec.staffId) : esc(placeShort(d))}</td><td>${esc(outcomeOf(d))}</td><td class="num">${livesOf(d)}</td><td><button class="ghost" data-act="open" data-id="${d.id}">${U.report.view}</button></td></tr>`;
  function selectEra(id) {
    if (st.form.eraId !== id) { st.form = { ...newForm(id), staffId: st.form.staffId };  }
  }
  // a row of links to the sections of a page, the same bar the about and settings pages have
  const jumpBar = (items) => `<p class="jumps">${items.map(([id, label]) => `<a class="wl" data-act="aboutjump" data-id="${id}">${esc(label)}</a>`).join(' · ')}</p>`;
  const X = { jumpBar, starsHtml: (n, place) => starsHtml(n, place), storyFor: (e) => (e.catalog ? catalogCard(e.id) : placeFile(e.id)), D, ctx, T, U, O, DEV, st, esc, r1, ri, srcLabel, isUnlocked, visibleEras, eraOpen, anchored, selectEra, wl, tip, anchorOf, owns, catalogTags, langHtml };
  const office = createOffice(X);
  office.ensureHire();
  const clockEl = document.getElementById('clock');
  X.listbox = createListbox(X);
  const listbox = X.listbox;
  const wiki = createWiki(X);
  X.office = office;
  X.traitPerk = traitPerk;
  X.pointsText = pointsText;
  const shop = createShop(X);
  const worldMap = createWorldMap(X);
  const settingsPage = createSettingsPage(X);
  const share = createShare(X);
  // the pop-up layer, made before anything is drawn
  const modalEl = document.createElement('div');
  modalEl.id = 'modal';
  document.body.appendChild(modalEl);
  let modalLast = '';
  const reportBackScroll = new WeakMap();
  st.map = worldMap.init();
  // with no simulated place open yet, which is the case at the start, the form stands on the first one of the list and is made again when the player picks a place
  st.form = newForm(visibleEras()[0] || eraList()[0]);
  worldMap.attach(view);
  // The welcome belongs to a game that has not begun: it is opened from the save, never from the remembered state of the page, and it cannot be closed,
  // so a welcome left over from an earlier visit must not stand over a game that has already sent a trip and locked the founder form
  const needsWelcome = () => ctx.S().welcomed === false && ctx.S().seq === 0;
  restoreUiState();
  if (st.modal?.kind === 'welcome' && !needsWelcome()) st.modal = null;
  if (needsWelcome() && !st.modal) st.modal = { kind: 'welcome' };

  // ---------- interface state over a reload or language switch ----------
  let restoringOnNavigation = false;
  function saveUiState(reloadOnly = false) {
    try {
      const keeps = {};
      view.querySelectorAll('[data-keep]').forEach((el) => { keeps[el.dataset.keep] = el.scrollTop; });
      const key = st.tab;
      sessionStorage.setItem(UI_KEY, JSON.stringify({
        tab: st.tab, pager: st.pager, modal: st.modal && ['settings', 'about', 'wiki', 'report'].includes(st.modal.kind) ? st.modal : null, vs: st.vs, opened: [...st.opened], filters: st.filters, cart: st.cart, sort: st.sort,
        wiki: st.wiki, map: { ...st.map, drag: null, justDragged: false }, form: st.form, scrollY: { ...st.scrollY, [key]: window.scrollY }, keeps,
        reloadOnly, modalScroll: modalEl.querySelector('.modalbg')?.scrollTop || 0,
      }));
      restoringOnNavigation = !reloadOnly;
    } catch (e) { /* storage blocked, the interface starts fresh */ }
  }
  function restoreUiState() {
    let raw = null;
    try { raw = sessionStorage.getItem(UI_KEY); sessionStorage.removeItem(UI_KEY); } catch (e) { return; }
    if (!raw) return;
    try {
      const o = JSON.parse(raw);
      if (o.reloadOnly && performance.getEntriesByType('navigation')[0]?.type !== 'reload') return;
      if (o.tab in U.tabs) st.tab = o.tab;
      if (o.pager) st.pager = o.pager;
      if (o.modal && ['settings', 'about', 'wiki', 'report'].includes(o.modal.kind)) st.modal = o.modal;
      if (!st.modal && o.sub && ctx.S().dispatches.some((d) => d.id === o.sub)) st.modal = { kind: 'report', id: o.sub };
      st.vs = !!o.vs;
      st.opened = new Set(o.opened || []);
      if (o.filters) st.filters = o.filters;
      const items = D.get('items');
      const keepItems = (list) => Object.fromEntries(Object.entries(list || {}).filter(([id]) => Object.hasOwn(items, id) && !items[id].retired));
      st.cart = keepItems(o.cart);
      st.sort = o.sort || {};
      Object.assign(st.wiki, o.wiki);
      const keepArticle = (id) => !id?.startsWith('items:') || (Object.hasOwn(items, id.slice(6)) && !items[id.slice(6)].retired);
      st.wiki.pos = st.wiki.hist.slice(0, st.wiki.pos + 1).filter(keepArticle).length - 1;
      st.wiki.hist = st.wiki.hist.filter(keepArticle);
      if (!keepArticle(st.wiki.cur)) st.wiki.cur = st.wiki.hist[st.wiki.pos] || null;
      if (!Object.hasOwn(T.tags, st.wiki.tag)) st.wiki.tag = '';
      Object.assign(st.map, o.map);
      if (o.form && visibleEras().includes(o.form.eraId) && hiredIds().includes(o.form.staffId)) st.form = { ...st.form, ...o.form, items: keepItems(o.form.items) };
      st.scrollY = o.scrollY || {};
      st.pendingKeeps = o.keeps || {};
      st.pendingModalScroll = o.modalScroll;
    } catch (e) { console.warn('界面状态恢复失败', e); }
  }
  window.addEventListener('pagehide', () => { if (!restoringOnNavigation) saveUiState(true); });

  // ---------- clock ----------
  // The clock and the tabs are redrawn every tick. Replacing a button between the press and the release loses the click,
  // so an element is only rewritten when its html really changed, and the tick does not redraw anything while a pointer is held down.
  const lastHtml = new WeakMap();
  function setHtml(el, html) {
    if (lastHtml.get(el) === html) return;
    lastHtml.set(el, html);
    el.innerHTML = html;
  }
  let pressed = false;
  document.addEventListener('pointerdown', () => { pressed = true; }, true);
  for (const type of ['pointerup', 'pointercancel']) document.addEventListener(type, () => { pressed = false; }, true);
  window.addEventListener('blur', () => { pressed = false; });
  const openSelectSupported = CSS.supports('selector(select:open)');
  function editingWithin(region) {
    const field = document.activeElement;
    return (region.contains(field) && field.matches('input, textarea, select')) ||
      (openSelectSupported && region.querySelector('select:open') !== null);
  }
  // The clock is three parts so that a ticking day never rebuilds the controls: the day text, the controls and the paused chip.
  const clockParts = { day: document.createElement('span'), ctl: document.createElement('span'), chip: document.createElement('span') };
  clockParts.day.className = 'day'; clockParts.ctl.className = 'ctl'; clockParts.chip.className = 'chipwrap';
  clockEl.append(clockParts.day, clockParts.ctl, clockParts.chip);
  function renderClock(fromTick = false) {
    const c = ctx.S().clock;
    const C = D.get('config.clock');
    const al = office.alerts();
    // a ring that fills once a day, so the passing of time can be seen at any speed
    const frac = c.day - Math.floor(c.day), circ = 2 * Math.PI * 7;
    setHtml(clockParts.day, `<svg class="ring" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="7" class="rb"/><circle cx="9" cy="9" r="7" class="rf" stroke-dasharray="${circ.toFixed(2)}" stroke-dashoffset="${(circ * (1 - frac)).toFixed(2)}" transform="rotate(-90 9 9)"/></svg><span title="${esc(U.clock.day.replace('{n}', String(Math.floor(c.day) + 1)))}">${esc(T.year_day.replace('{y}', String(officeDate(c.day).getUTCFullYear())).replace('{date}', officeDay(c.day)))}</span>`);
    if (!fromTick || !editingWithin(clockParts.ctl)) {
      const speeds = C.speeds.map((sp, i) => `<option value="${i}" ${c.speed === sp ? 'selected' : ''}>${sp === 0 ? '⏸ ' + U.clock.pause : sp + '×'}</option>`).join('');
      setHtml(clockParts.ctl, `<select class="spd" data-clk="speed" aria-label="${esc(U.clock.speed)}"${tip(U.clock.speed)}>${speeds}</select><span class="autochk"><label${tip(U.clock.auto_tip)}><input type="checkbox" data-clk="auto" ${c.auto ? 'checked' : ''}> ${esc(U.clock.auto)}</label></span>`);
    }
    const first = ctx.S().seq === 0 && c.speed === 0;
    setHtml(clockParts.chip, c.speed === 0 && al.home ? `<span class="chip warn pulse">${U.clock.paused_report}</span>`
      : first ? `<span class="chip"${tip(U.clock.start_tip)}>${U.clock.start_hint}</span>`
      : office.lowFunds() && c.speed > office.effectiveSpeed() ? `<span class="chip warn"${tip(U.clock.low_tip)}>${U.clock.low_funds.replace('{n}', String(office.effectiveSpeed()))}</span>` : '');
  }
  clockEl.addEventListener('change', (ev) => {
    const b = ev.target.closest('[data-clk]');
    if (!b) return;
    const c = ctx.S().clock;
    if (b.dataset.clk === 'speed') office.setSpeed(Number(b.value));
    else { c.auto = b.checked; if (c.auto && c.speed === 0) office.setSpeed(1); ctx.save(); }
    renderClock();
    renderTabs();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.code !== 'Space' || st.modal || /INPUT|TEXTAREA|SELECT|BUTTON/.test(ev.target.tagName)) return;
    ev.preventDefault();
    office.togglePause();
    renderClock();
  });

  // ---------- tabs ----------
  function renderTabs() {
    const al = office.alerts();
    const icons = D.get('config.ui.tab_icons');
    const arrows = `<span class="navbtns"><button data-nav="-1" title="${esc(U.nav.back)}" aria-label="${esc(U.nav.back)}" ${nav.pos > 0 ? '' : 'disabled'}>◀</button><button data-nav="1" title="${esc(U.nav.forward)}" aria-label="${esc(U.nav.forward)}" ${nav.pos < nav.list.length - 1 ? '' : 'disabled'}>▶</button></span>`;
    const tools = D.get('config.ui.tool_icons');
    setHtml(toolsEl, Object.entries(U.tools).map(([k, label]) => `<button class="tool ${st.modal && st.modal.kind === k ? 'on' : ''}" data-act="modalopen" data-id="${k}" title="${esc(label)}" aria-label="${esc(label)}">${tools[k]}</button>`).join(''));
    setHtml(tabsEl, arrows + Object.entries(U.tabs).map(([k, label]) => `<button data-tab="${k}" title="${esc(label)}" aria-label="${esc(label)}" class="${st.tab === k ? 'on' : ''}"><span class="ic" aria-hidden="true">${icons[k]}</span><span class="tx">${esc(label)}</span>${al[k] ? `<span class="badge">${al[k]}</span>` : ''}</button>`).join(''));
  }

  // ---------- agency: employees and hiring ----------
  // The record of an employee: each point that fulfilled something, once, on the earliest trip that won it, with the year, the place and the words of the star,
  // opening the report while it is kept; the guard points held are one line of their count. A trip out of sync adds nothing of its own. See 5.12 of the story outline.
  // The record of an employee: what their trips helped bring about, one line to a trip with the fulfil stars it won for the first time, small stories and
  // full models alike, and after them the words the employee said on coming back. Guard stars are not listed, since holding history is not a deed.
  // The weightiest come first: a redeemed regret, then the share of the stars of the trip, then the later year; config.ui.record_top show, the rest open on a click.
  function recordHtml(id) {
    const P = U.staffpage;
    const kept = new Set(ctx.S().dispatches.filter((d) => d.claimed).map((d) => d.id));
    const seen = new Set();
    const done = [];
    const trips = (ctx.S().trips || []).filter((t) => t.staffId === id).slice().sort((a, b) => a.back - b.back || a.day - b.day);
    for (const t of trips) {
      const ev = t.light ? D.get('catalog.events').find((x) => x.id === t.place) : null;
      if (t.light && !ev?.scene) continue;
      const texts = [];
      for (const pid of office.wonOf(t)) {
        const key = t.place + '|' + pid;
        // a guard point holds history as it was, so it is no change of the employee's own, in a small story or a full model alike
        const pt = t.light ? ev.scene.points.find((p) => p.id === pid) : ctx.backend.modelPoints(t.place)?.points.find((p) => p.id === pid);
        const text = pt && !pt.guard && (t.light ? T.catalog[t.place].points[pid] : T.eras[t.place]?.star_points?.[pid]);
        if (!text || seen.has(key)) continue;
        seen.add(key);
        texts.push(text);
      }
      if (texts.length) done.push({ t, texts, year: yearOfPlace(t.place, t.light), share: (t.stars || 0) / Math.max(1, ctx.backend.maxStars(t.place)) });
    }
    if (!done.length) return `<p class="muted">${P.record_none}</p>`;
    done.sort((a, b) => Number(!!b.t.redeemed) - Number(!!a.t.redeemed) || b.share - a.share || b.year - a.year);
    const top = D.get('config.ui.record_top');
    const all = st.recordAll === id;
    const line = ({ t, texts, year }) => {
      const head = `${fmtYear(D, year)} ${shortOfPlace(t.place, t.light)}${COLON}${texts.join(U.fmt.semi)}`;
      const said = ctx.backend.sayingOfTrip(t);
      return `<li>${t.redeemed ? '<span class="chip">♥</span> ' : ''}${kept.has(t.id) ? `<a class="wl" data-act="open" data-id="${t.id}">${esc(head)}</a>` : esc(head)}${said ? ` <span class="muted">${esc(U.fmt.quote.replace('{x}', said))}</span>` : ''}</li>`;
    };
    const more = done.length > top ? `<p><a class="wl" data-act="recordmore" data-id="${esc(id)}">${esc(all ? P.record_less : P.record_more.replace('{n}', String(done.length)))}</a></p>` : '';
    return `<ul class="iflines">${(all ? done : done.slice(0, top)).map(line).join('')}</ul>${more}`;
  }

  const moodMult = (v) => 1 + D.get('config.favor.buff') * (2 * v - 1);
  const favorCell = (id) => { const v = ctx.S().staff[id].favor; return `<span class="favor"${tip(U.office.favor_tip + ' ' + U.office.mood_mult.replace('{m}', moodMult(v).toFixed(2)))}>♥ ${Math.round(v * 100)}<span class="fbar"><i style="width:${v * 100}%"></i></span></span>`; };
  const stateLabel = () => ({ ready: U.office.ready, away: U.office.away, resting: U.office.resting, secretary: U.office.secretary_state });
  // the state of an employee, with the days left while they are away or resting, so it is plain why they cannot be picked
  function stateText(id) {
    const S = ctx.S();
    const state = staffState(id);
    let left = 0;
    if (state === 'away') left = Math.max(...S.dispatches.filter((d) => !d.claimed && d.spec.staffId === id).map((d) => d.readyDay - S.clock.day), 0);
    else if (state === 'resting') left = S.staff[id].restUntil - S.clock.day;
    return stateLabel()[state] + (left > 0 ? ' ' + r1(left) + ' ' + U.report.days : '');
  }
  function staffBoxHtml() {
    const S = ctx.S();
    const allIds = hiredIds();
    const traitTags = [...new Set(allIds.flatMap((id) => staffTraits(D, id)))].map((x) => ({ id: x, label: T.traits[x] }));
    const rows = allIds.filter((id) => listbox.match('home_staff', staffName(D, id) + ' ' + T.staff[id].jobs.join(' ') + ' ' + T.staff[id].ethnicity, staffTraits(D, id))).map((id) => {
      return { id, name: staffName(D, id), state: staffState(id), favor: S.staff[id].favor, score: office.growthStars(id) };
    });
    const perkText = perkParts(office.perks()).join(' · ');
    const sec = S.secretary
      ? `<div class="muted">${U.office.secretary}${COLON}${staffLink(S.secretary)} · ${esc(perkText) || U.enc.edge_none}</div>`
      : `<div class="muted">${U.office.secretary}${COLON}${U.office.no_secretary}</div>`;
    const total = office.wageTotal();
    const wage = `${U.office.wage}${COLON}${ri(total)} ${D.get('config.ui.currency_icons.funds')}${S.funds < total ? ` <span class="chip warn">${U.office.wage_unpaid}</span>` : ''}`;
    const secLine = sec.slice(0, sec.length - '</div>'.length) + ' · ' + wage + '</div>';
    return secLine + listbox.html({
      id: 'home_staff', tools: listbox.tools('home_staff', traitTags), rows,
      cols: [
        { k: 'name', label: U.office.col_staff, w: '14%', val: (r) => r.name, cell: (r) => `<span class="nowrap">${staffLink(r.id)}</span>` },
        { k: 'traits', label: U.office.col_traits, w: '22%', cell: (r) => `<span class="nowrap">${staffTraits(D, r.id).map(traitChip).join('')}</span>` },
        { k: 'state', label: U.office.col_state, w: '9%', val: (r) => r.state, cell: (r) => `<span class="chip ${r.state === 'ready' ? '' : 'warn'}">${stateLabel()[r.state]}</span>` },
        { k: 'favor', label: U.office.col_favor, w: '13%', val: (r) => r.favor, cell: (r) => favorCell(r.id) },
        { k: 'score', label: U.office.col_history, w: '11%', val: (r) => r.score, cell: (r) => `<a class="tallylink" data-act="staffopen" data-id="${r.id}"${tip(U.office.tally_tip)}>${tallyHtml(r.score)}</a>` },
        // the test employees of the developer mode keep their mood, never serve as secretary and cannot be let go, so their row has no buttons
        { k: 'act', label: '', w: '31%', cls: 'num', cell: (r) => D.get('staff.staff')[r.id]?.dev_only ? '' : `<span class="nowrap"><button data-act="gift" data-id="${r.id}" ${S.funds < office.giftCost() ? 'disabled' : ''}${tip(U.office.gift_tip)}>${U.office.gift} ${office.giftCost()}</button> <button data-act="appoint" data-id="${r.id}" ${r.state === 'away' ? 'disabled' : ''}>${r.state === 'secretary' ? U.office.dismiss : U.office.appoint}</button> <button class="ghost" data-act="fire" data-id="${r.id}" ${r.state === 'away' || hiredIds().length <= 1 || r.id === ctx.S().founder.id ? 'disabled' : ''}${tip(U.office.fire_tip)}>${U.office.fire}</button></span>` },
      ],
    });
  }

  // Candidates show their background, abilities and trait effects before hiring.
  function candidateRow(c) {
    const id = c.id;
    const def = D.get('staff.staff.' + id);
    const swatch = def.skin ? `<span class="skin" style="background:${D.get('hiring.skin_tones.' + def.skin)}"></span> ` : '';
    return { id, name: staffName(D, id), swatch, profile: staffProfile(D, id), stats: statsLine(ctx.backend.staffStats(id)), traits: staffTraits(D, id) };
  }

  let renderedHireSlots = null;
  function hireCountdown() {
    const S = ctx.S();
    const left = Math.max(0, S.hire.next - S.clock.day);
    return U.office.hire_next.replace('{n}', r1(Math.ceil(left * 10) / 10));
  }

  function hireHtml() {
    const S = ctx.S();
    renderedHireSlots = S.hire.slots;
    const n = hiredIds().length;
    const icon = D.get('config.ui.currency_icons.funds');
    const box = listbox.html({
      id: 'hire', rows: S.hire.slots.map(candidateRow), empty: U.office.hire_none,
      cols: [
        { k: 'name', label: U.office.col_staff, w: '14%', val: (r) => r.name, cell: (r) => `<span class="nowrap">${r.swatch}<b>${staffLink(r.id)}</b></span>` },
        { k: 'profile', label: U.office.col_profile, w: '19%', cell: (r) => `<div class="oneline"${tip(r.profile)}>${esc(r.profile)}</div>` },
        { k: 'stats', label: U.office.col_stats, w: '24%', cell: (r) => `<div class="oneline">${esc(r.stats)}</div>` },
        { k: 'traits', label: U.office.col_traits, w: '17%', cell: (r) => `<span class="nowrap">${r.traits.map(traitChip).join('')}</span>` },
        { k: 'wage', label: U.office.col_wage, w: '12%', cls: 'num', cell: () => `<span class="nowrap"${tip(U.office.wage_after.replace('{a}', ri(office.wageTotal())).replace('{b}', ri(office.wageOf(n + 1))))}>+${ri(office.wageOf(n + 1) - office.wageTotal())} ${icon}</span>` },
        { k: 'act', label: '', w: '14%', cls: 'num', cell: (r) => `<button class="primary" data-act="hire" data-id="${r.id}" ${S.funds < O.hire_cost ? 'disabled' : ''}>${U.office.hire} ${O.hire_cost}</button>` },
      ],
    });
    return `<p class="muted">${U.office.hire_hint.replace('{n}', String(D.get('hiring.refresh_days')))} ${U.office.wage}${COLON}${ri(office.wageTotal())} → ${ri(office.wageOf(n + 1))} ${icon}</p>
      ${box}
      <p class="muted" id="hire-next">${hireCountdown()}</p>`;
  }

  // Update the figures without replacing the completion button when funds or energy change.
  const resEl = document.getElementById('res');
  const fundsEl = document.getElementById('res-funds');
  const energyEl = document.getElementById('res-energy');
  const perksEl = document.getElementById('res-perks');
  const homeComplete = document.getElementById('home-complete');
  const homeGoal = U.share.home.goal.replace('{n}', O.home_cost);
  fundsEl.dataset.tip = U.office.funds + ' · ' + U.office.wage_total;
  energyEl.dataset.tip = U.office.energy + COLON + U.office.home;
  homeComplete.textContent = U.share.home.button;
  homeComplete.title = homeGoal;
  document.getElementById('home-complete-goal').textContent = homeGoal;
  function renderResources() {
    const S = ctx.S();
    const I = D.get('config.ui.currency_icons');
    // the effect of the secretary stays in sight on every page, the person in the tip
    const perk = S.secretary ? perkParts(office.perks()) : [];
    setHtml(fundsEl, `${I.funds} <b>${ri(S.funds)}</b><span class="muted"> − ${ri(office.wageTotal())}${U.office.per_day}</span>`);
    setHtml(energyEl, `${I.energy} <b>${ri(S.energy)}</b><span class="muted">/ ${O.home_cost}</span>`);
    setHtml(perksEl, perk.length ? `<span class="rv"${tip(`${U.office.secretary_effect}${COLON}${staffName(D, S.secretary)}\n${perk.join('\n')}`)}>${I.secretary} <span class="muted">${esc(perk.join(' · '))}</span></span>` : '');
    homeComplete.hidden = st.tab !== 'home' || needsWelcome();
    homeComplete.disabled = S.energy < O.home_cost;
  }

  // Standby first, then trips and reports to collect, then rest.
  function staffStatusHtml() {
    const S = ctx.S();
    const today = S.clock.day;
    const out = S.dispatches.filter((d) => !d.claimed).sort((a, b) => a.readyDay - b.readyDay);
    const away = new Set(out.map((d) => d.spec.staffId));
    const trips = out.map((d) => ({ id: d.spec.staffId, d, state: d.readyDay <= today ? 'pending' : 'away', until: d.readyDay }));
    const here = hiredIds().filter((id) => id !== S.secretary && !away.has(id));
    const resting = here.filter((id) => S.staff[id].restUntil > today)
      .map((id) => ({ id, state: 'resting', until: S.staff[id].restUntil }))
      .sort((a, b) => a.until - b.until);
    const standby = here.filter((id) => !(S.staff[id].restUntil > today)).map((id) => ({ id, state: 'ready' }));
    const roster = [...standby, ...trips, ...resting];
    if (!roster.length) return '';
    const pg = listbox.paginate('pending', roster);
    const maxDays = D.get('config.ui.staff_status_max_days');
    const rows = pg.shown.map(({ id, d, state, until }) => {
      const countdown = state === 'away' || state === 'resting';
      const remaining = countdown ? until - today : 0;
      const percent = countdown ? r1(100 * Math.min(remaining, maxDays) / maxDays) : 100;
      const time = countdown ? `${r1(remaining)} ${U.report.days}` : '';
      const label = state === 'ready' ? U.office.standby : U.office[state];
      const status = state === 'pending' ? `<span class="chip warn pulse">${esc(label)}</span>`
        : `<span class="pend-status">${esc(label)}${time ? ' · ' + esc(time) : ''}</span>`;
      const action = state === 'pending' ? `<button class="primary alert" data-act="claim" data-id="${d.id}">${U.office.claim}</button>`
        : state !== 'away' ? '' : d.recallRefused ? `<span class="chip warn">${U.office.recall_refused}</span>`
          : `<button data-act="recall" data-id="${d.id}"${tip(U.office.recall_tip)}>${U.office.recall}</button>`;
      const place = d ? `${placeYear(d)} · ${d.light ? T.catalog[d.eraId].place : T.eras[d.eraId].place_name}` : '';
      const progress = state === 'pending' ? '' : `<div class="pend-progress" ${countdown
        ? `role="progressbar" aria-label="${esc(label)}" aria-valuenow="${percent}" aria-valuetext="${esc(time)}"`
        : 'aria-hidden="true"'}><i style="width:${percent}%"></i></div>`;
      return `<div class="pend pend-${state}" data-staff="${esc(id)}">
        <div class="pend-person"><span class="pend-staff" title="${esc(staffName(D, id))}">${staffLink(id)}</span>${place ? `<span class="pend-place" title="${esc(place)}">${esc(place)}</span>` : ''}</div>
        <div class="pend-meta">${status}${action}</div>${progress}
      </div>`;
    });
    return `<div class="sec" id="home-pending">${esc(U.office.staff_status)}</div>
      ${pg.html}<div class="pendgrid">${rows.join('')}</div>`;
  }

  // The log of finished trips, read from the summaries that are kept for good, a page at a time. Archived trips are hidden until asked for.
  function officeHtml() {
    const S = ctx.S();
    const keptIds = new Set(S.dispatches.filter((d) => d.claimed).map((d) => d.id));
    const all = S.trips.slice().reverse().filter((x) => st.showArchived || !x.archived);
    const nArch = S.trips.filter((x) => x.archived).length;
    const pg = listbox.paginate('log', all);
    const trips = pg.shown;
    const done = trips.map((t) => `<tr${t.archived ? ' class="archived"' : ''}>
      <td>${fmtYear(D, yearOfPlace(t.place, t.light))}</td><td>${esc(shortOfPlace(t.place, t.light))}</td><td>${staffLink(t.staffId)}</td>
      <td>${starsHtml(t.stars || 0, t.place)}${t.newBest ? ` <span class="chip" ${tip(U.stars.new_best)}>↑</span>` : ''}</td>
      <td>${protagonistHtml({ eraId: t.place, light: t.light })}</td>
      <td><div class="log-actions">${keptIds.has(t.id) ? `<button class="ghost" data-act="open" data-id="${t.id}">${U.report.view}</button>` : ''}<button class="ghost" data-act="${t.archived ? 'restore' : 'archive'}" data-id="${t.id}">${t.archived ? U.office.restore : U.office.archive}</button></div></td>
    </tr>`);
    const rows = done.join('');
    const bar = S.trips.length ? `<div class="logbar"><span class="logtools"><button class="ghost" data-act="archiverule" data-id="notbest"${tip(U.office.archive_tip)}>${U.office.archive_notbest}</button><label class="check"><input type="checkbox" id="log-archived" ${st.showArchived ? 'checked' : ''}> ${U.office.show_archived} (${nArch})</label></span>${pg.html}</div>` : '';
    return `
      <div class="sec" id="home-log">${U.office.log}</div>
      ${bar}${rows ? `<table class="logtable"><thead><tr><th>${U.report.year}</th><th>${U.report.place}</th><th>${U.office.col_staff}</th><th>${U.stars.col}</th><th>${U.office.col_contact}</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : `<p class="muted">${U.report.none}</p>`}`;
  }

  // ---------- dispatch ----------
  const tripPageSize = 5;
  function tripPage(key, trips, sizes) {
    const byStars = st.sort[key]?.k === 'best';
    const recent = (a, b) => (b.back ?? b.day) - (a.back ?? a.day);
    trips.sort(byStars ? (a, b) => (b.stars || 0) - (a.stars || 0) || recent(a, b) : recent);
    const { shown, html: pager } = listbox.paginate(key, trips, sizes);
    const order = trips.length > 1 ? `<div class="row trip-controls"><select id="${esc(key)}" data-trip-order="${esc(key)}" aria-label="${esc(U.archive.trip_order)}"><option value="recent">${esc(U.archive.trip_recent)}</option><option value="best" ${byStars ? 'selected' : ''}>${esc(U.archive.trip_best)}</option></select>${pager}</div>` : '';
    return { shown, html: order };
  }

  // Show the stored summaries in pages. A full report opens while it is still kept.
  function tripsHtml(id) {
    const trips = office.tripsOf(id);
    const heading = `<div class="sec">${U.archive.trips} (${trips.length})</div>`;
    if (!trips.length) return heading + `<p class="muted">${U.archive.trips_none}</p>`;
    const page = tripPage('event_trips_' + id, trips, [tripPageSize]);
    const kept = new Set(ctx.S().dispatches.map((d) => d.id));
    const body = `<ul class="trips">${page.shown.map((t) => {
        const oc = t.stamp ? U.report.stamp[t.stamp] : t.recalled ? U.report.recalled : t.evacuated ? U.report.evacuated : t.light ? U.light.outcome[t.outcome] : T.outcomes[t.outcome].name;
        const view = kept.has(t.id) ? `<button class="ghost" data-act="open" data-id="${t.id}">${U.report.view}</button>` : `<span class="muted small">${U.archive.trip_gone}</span>`;
        return `<li${t.archived ? ' class="archived"' : ''}><span class="muted">${U.archive.trip_day.replace('{d}', t.day)}</span> ${staffLink(t.staffId)} ${starsHtml(t.stars, t.place)}${t.redeemed ? ' <span class="chip">♥</span>' : ''} <span class="muted">${esc(oc)}</span> ${view}</li>`;
      }).join('')}</ul>`;
    return heading + page.html + body;
  }
  // The story of the selected place: who it is about, what the traveller can bring up with them, and what is known of it once someone has been.
  const travelTime = (days) => U.dispatch.travel_time.replace('{n}', String(days)).replace('{h}', String(ctx.backend.historicalDays(days)));
  function placeFile(id) {
    const ET = T.eras[id];
    const done = office.tripsOf(id);
    const ideas = office.plotsFor(id).map((pid) => `<li>${esc(ET.plots[pid].name)}${U.fmt.paren.replace('{x}', esc(ET.plots[pid].character))}</li>`).join('');
    const head = `<div class="row sp"><h3>${esc(ET.name)}${!eraOpen(id) ? ' ' + hiddenChip() : ''}</h3><span class="muted">${esc(travelTime(ctx.backend.eraStay(id)))}</span></div>
      <p class="muted">${esc(ET.blurb)}</p><div class="muted">${esc(ET.protagonist)} · ${esc(ET.protagonist_role)}</div>
      <div class="muted">${U.stars.best}${COLON}${starsHtml(ctx.S().stars[id] || 0, id)}</div>
      <div class="muted">${(ctx.backend.maxStars(id) === 3 ? U.dispatch.find_chance : U.dispatch.find_chance_n.replace('{n}', String(ctx.backend.maxStars(id)))).replace('{p}', String(Math.round(ctx.backend.findOdds(id).p * 100)))}</div>
      <div class="sec">${U.stars.points}</div><ul class="sync">${ctx.era(id).raw.star_points.map((p) => `<li>☆ ${esc(ET.star_points[p.id])}</li>`).join('')}</ul>
      <div class="sec">${U.dispatch.ideas}</div><ul>${ideas}</ul>`;
    if (!done.length) return `<div class="lbox"><div class="lscroll pad" data-keep="placefile" style="max-height:${D.get('config.ui.box_h.story')}px">${head}<p class="muted" style="margin-top:8px">${U.archive.sealed}</p></div></div>`;
    const hist = ET.encyclopedia.history.map((h) => `<li>${esc(h.text)}${h.check ? ` <span class="chip warn">${U.archive.check_pending}</span>` : ''}</li>`).join('');
    const reg = ET.encyclopedia.regret.map((h) => `<li>${esc(h)}</li>`).join('');
    return `<div class="lbox"><div class="lscroll pad" data-keep="placefile" style="max-height:${D.get('config.ui.box_h.story')}px">${head}<div class="sec">${U.archive.history}</div><ul>${hist}</ul><div class="sec">${U.archive.regret}</div><ul>${reg}</ul>${tripsHtml(id)}</div></div>`;
  }

  function catalogCard(id) {
    const c = T.catalog[id];
    const ev = D.get('catalog.events').find((x) => x.id === id);
    const relicId = 'relic_' + id;
    const own = anchored(relicId);
    const tags = catalogTags(id).map((t) => `<span class="chip">${esc(T.tags[t])}</span>`).join('');
    return `<div class="lbox"><div class="lscroll pad" data-keep="placefile" style="max-height:${D.get('config.ui.box_h.story')}px">
      <div class="row sp"><h3>${esc(c.name)}${own ? '' : ' ' + hiddenChip()}</h3><span class="muted">${esc(fmtYear(D, ev.year))} · ${esc(c.place)}</span></div>
      <div>${tags}</div>
      <p>${esc(c.story)}</p><div class="muted">${U.dispatch.character}${COLON}${esc(c.figure)}</div>
      <div class="muted">${U.dispatch.relic}${COLON}${D.get('antiques.antiques.' + relicId).kind === 'medium' ? esc(c.relic) : wl('antiques:' + relicId, c.relic)}${own ? ' · ' + U.dispatch.owned : ''}</div>
      <div class="muted">${U.stars.best}${COLON}${starsHtml(ctx.S().stars[id] || 0, id)}</div>
      <div class="muted">${(ctx.backend.maxStars(id) === 3 ? U.dispatch.find_chance : U.dispatch.find_chance_n.replace('{n}', String(ctx.backend.maxStars(id)))).replace('{p}', String(Math.round(ctx.backend.findOdds(id).p * 100)))}</div>
      ${Object.keys(ctx.backend.pressureOf(id).base).length ? `<div class="muted">${U.dispatch.pressure}${COLON}${esc(pressureText(ctx.backend.pressureOf(id).base))}</div><p class="muted">${U.dispatch.pressure_hint}</p>` : ''}
      ${ev.scene ? `<div class="sec">${U.stars.points}</div><ul class="sync">${ev.scene.points.map((p) => `<li>${p.guard ? '◇' : p.redeem ? '♡' : '☆'} ${esc(c.points[p.id])}${reqHint(p.req)}</li>`).join('')}</ul>${ev.regret || ev.scene.points.some((p) => p.guard) ? `<p class="muted">${U.stars.regret_note}</p>` : ''}<p class="muted">${U.dispatch.scene_hint}</p>` : ''}
      <p class="muted" style="margin-top:8px">${esc(travelTime(ev.era && ctx.era(ev.era) ? ctx.backend.eraStay(ev.era) : ctx.backend.lightStay(id)))} · ${esc(ev.scene ? U.dispatch.scene_note : U.dispatch.small_story)}</p>${own ? tripsHtml(id) : ''}</div></div>`;
  }

  // ---------- home: the dispatch desk under the map ----------
  function fixForm() {
    if (visibleEras().length && !visibleEras().includes(st.form.eraId)) st.form = { ...newForm(visibleEras()[0]), staffId: st.form.staffId };
    if (!hiredIds().includes(st.form.staffId)) st.form.staffId = hiredIds()[0];
    const f = st.form;
    if (staffState(f.staffId) !== 'ready') {
      const free = hiredIds().find((id) => staffState(id) === 'ready');
      if (free) f.staffId = free;
    }
  }

  // Three columns: the story, who goes, what they carry. Then one button.
  function pickHtml() {
    const f = st.form;
    const S = ctx.S();
    const ready = hiredIds().filter((id) => staffState(id) === 'ready');
    const rows = ready.map((id) => {
      const chosen = id === f.staffId;
      const stats = ctx.backend.staffStats(id);
      const mini = statsLine(stats);
      return `<div class="pickrow ${chosen ? 'on' : ''}">
        <div class="pr1"><b>${staffLink(id)}</b><span class="muted pstats">${mini}</span>${chosen ? `<span class="chip">${U.dispatch.picked}</span>` : `<button data-act="pickstaff" data-id="${id}">${U.dispatch.pick}</button>`}</div>
        <div class="pr2"><span class="muted">${esc(T.staff[id].jobs.join(' · '))}</span>${staffTraits(D, id).map(traitChip).join('')}<span class="grow"></span><span class="muted">${favorCell(id)}</span></div></div>`;
    }).join('');
    // when nobody can go, say when the first one is back
    const back = hiredIds().map((id) => (staffState(id) === 'away' ? Math.max(...S.dispatches.filter((d) => !d.claimed && d.spec.staffId === id).map((d) => d.readyDay - S.clock.day), 0) : staffState(id) === 'resting' ? S.staff[id].restUntil - S.clock.day : Infinity)).filter((x) => x < Infinity);
    const none = `<p class="muted pad">${U.dispatch.nobody}${back.length ? ' ' + U.dispatch.nobody_back.replace('{n}', r1(Math.min(...back))) : ''}</p>`;
    return `<div class="lbox"><div class="lscroll pad" data-keep="pick" style="max-height:${D.get('config.ui.box_h.pick_staff')}px">${rows || none}</div></div>`;
  }

  // The story of the selected place, drawn beside the map where it is picked.
  function storyBoxHtml() {
    return `<div class="sec" style="margin-top:0">${U.dispatch.story}</div>${st.map.cat ? catalogCard(st.map.cat) : placeFile(st.form.eraId)}`;
  }

  function deskHtml() {
    const f = st.form;
    const e = E();
    const tot = totals();
    const S = ctx.S();
    const overW = tot.weight > tot.cap + 1e-9;
    const stState = staffState(f.staffId);
    const story = !!st.map.cat;
    // only what can be taken is listed: what is in stock, and anything already chosen
    const carryRows = story ? Object.keys(D.get('items')).filter((id) => ctx.backend.lightKitAllowed(st.map.cat, id) && ((S.inv[id] || 0) > 0 || (f.items[id] || 0) > 0)).map((id) => ({ id, name: T.items[id].name, it: D.get('items.' + id), stock: S.inv[id] || 0 })) : Object.keys(e.itemBindings).filter((id) => (S.inv[id] || 0) > 0 || f.items[id] > 0).map((id) => ({ id, name: itemText(D, e.id, id).name, it: D.get('items.' + id), stock: S.inv[id] || 0 }));
    // what the story presses with, and what is left of it for the employee picked with the kit chosen
    const press = story ? ctx.backend.pressureOf(st.map.cat, f.staffId, sceneKit(), S.staff[f.staffId]?.favor) : { base: {}, left: {} };
    const pressed = Object.keys(press.base).length > 0;
    const pressFoot = pressed ? ` · <span class="${Object.keys(press.left).length ? 'delta down' : ''}">${U.dispatch.pressure_left}${COLON}${esc(Object.keys(press.left).length ? pressureText(press.left) : U.dispatch.pressure_none)}</span>` : '';
    const carryBox = listbox.html({
      id: 'carry', scroll: true, maxH: D.get('config.ui.box_h.carry'), rows: carryRows, pinTitle: U.dispatch.carrying, empty: story ? (pressed ? U.dispatch.no_kit_stock : U.dispatch.no_kit_needed) : U.dispatch.no_stock,
      pinned: (r) => f.items[r.id] > 0,
      foot: `<span class="${overW ? 'delta down' : ''}">${U.dispatch.weight} ${r1(tot.weight)} / ${r1(tot.cap)}</span> · <span>${U.dispatch.kit_value} ${ri(tot.cost)}</span>${pressFoot}`,
      cols: [
        { k: 'name', label: U.shop.col_name, w: '44%', val: (r) => r.name, cell: (r) => { const tx = story ? T.items[r.id] : itemText(D, e.id, r.id); return `${wl('items:' + r.id, tx.name, `${tx.desc}\n${U.dispatch.weight} ${r.it.weight} · ${U.dispatch.cost} ${r.it.cost}${r.it.scene ? '\n' + U.dispatch.exposure + COLON + r.it.exposure : ''}`)}<div class="oneline muted">${esc(firstSentence(tx.desc))}</div>`; } },
        { k: 'stock', label: U.shop.stock, w: '16%', cls: 'num', val: (r) => r.stock, cell: (r) => r.stock },
        { k: 'qty', label: U.dispatch.carry, w: '40%', cls: 'num', cell: (r) => `<span class="stepper"><button data-act="dec" data-id="${r.id}" ${(f.items[r.id] || 0) > 0 ? '' : 'disabled'}>−</button><span class="n">${f.items[r.id] || 0}</span><button data-act="inc" data-id="${r.id}" ${(f.items[r.id] || 0) < Math.min(r.it.max, r.stock) ? '' : 'disabled'}>+</button></span>` },
      ],
    });
    const target = story ? st.map.cat : e.id;
    const open = office.canDispatchTo(target, story);
    const holds = story ? owns('relic_' + target) : owns(anchorOf(target));
    const msg = !open ? (holds ? U.dispatch.not_anchored : U.dispatch.not_found) : office.eraBusy(target) ? U.dispatch.era_busy : overW ? U.dispatch.over_weight : stState !== 'ready' ? U.dispatch.busy : '';
    const seedRow = DEV ? `<span class="row"><input id="seed" type="number" value="${f.seed}" style="width:110px" title="${esc(U.dispatch.seed_hint)}"></span>` : '';
    return `
      <div class="cols2 desk" id="home-desk">
        <div><div class="sec" style="margin-top:0">${U.dispatch.staff}</div>${pickHtml()}</div>
        <div><div class="sec" style="margin-top:0">${U.dispatch.items}</div>${carryBox}</div>
      </div>
      <div class="row" style="margin:16px 0"><button data-act="autocfg" ${st.searching || story ? 'disabled' : ''}${tip(U.dispatch.autocfg_tip)}>${st.searching ? U.dispatch.searching : U.dispatch.autocfg}</button><button class="ghost" data-act="clear">${U.dispatch.clear}</button>${seedRow}<span style="flex:1"></span><span class="delta down">${esc(msg)}</span><button class="primary" data-act="send" ${msg ? 'disabled' : ''}>${U.dispatch.send}</button></div>`;
  }

  // ---------- report ----------
  // A line a reader has switched off in the legend is left out of the chart; it is named chart:key, so one switch serves the charts that share a legend.
  const lineOn = (chart, key) => !st.chartOff.has(chart + ':' + key);
  // the legend of a chart: each line a button that switches it on and off, and the marks that are not lines as plain text
  const legendHtml = (chart, lines, marks = []) => `<div class="legend">${lines.map((l) => `<button class="lg${lineOn(chart, l.key) ? '' : ' off'}" data-act="chartline" data-chart="${chart}" data-k="${esc(l.key)}"><i style="border-color:${l.color}${l.dash ? ';border-top-style:dashed' : ''}"></i>${esc(l.label)}</button>`).join('')}${marks.map((m) => `<span><i style="border-color:${m.color};border-top-style:${m.style}"></i>${esc(m.label)}</span>`).join('')}</div>`;
  function lineChart(series0, markers, ymax, chart = null) {
    const series = chart ? series0.filter((s) => lineOn(chart, s.key)) : series0;
    if (!series.length) return `<div class="muted">${U.report.chart_all_off}</div>`;
    const CH = D.get('config.ui.chart');
    const W = CH.w, H = CH.h;
    const m = { l: CH.margin_l, r: CH.margin_r, t: CH.margin_t, b: CH.margin_b };
    const xmax = Math.max(...series.flatMap((s) => s.pts.map((p) => p[0])));
    const x = (v) => m.l + (v / xmax) * (W - m.l - m.r);
    const y = (v) => H - m.b - (v / ymax) * (H - m.t - m.b);
    let g = '';
    for (let i = 0; i <= CH.y_lines; i++) {
      const v = (ymax * i) / CH.y_lines;
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".12"/><text x="${m.l - 4}" y="${y(v) + 3}" text-anchor="end">${ymax < 10 ? r1(v) : ri(v)}</text>`;
    }
    for (let d = 0; d <= xmax; d += Math.ceil(xmax / CH.x_labels)) g += `<text x="${x(d)}" y="${H - 6}" text-anchor="middle">${d}</text>`;
    for (const mk of markers) if (mk.x !== null && mk.x !== undefined) g += `<line x1="${x(mk.x)}" x2="${x(mk.x)}" y1="${m.t}" y2="${H - m.b}" stroke="${mk.color}" stroke-dasharray="${mk.dash || '3 3'}" opacity=".7"/>`;
    for (const s of series) g += `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} points="${s.pts.map((p) => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ')}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
  }

  function vignetteHtml(line) {
    return line ? `<div class="sec">${esc(U.light.vignette)}</div><p>${esc(line)}</p>` : '';
  }

  // A small story has no branch to compare, so its page is short: how it went, the event itself, and the accounts.
  function lightHtml(cur) {
    const c = T.catalog[cur.eraId];
    const ev = D.get('catalog.events').find((x) => x.id === cur.eraId);
    const P = cur.paid;
    const o = cur.report.outcomeId;
    const summary = U.light.summary[o].replace('{staff}', staffName(D, cur.spec.staffId)).replace('{place}', c.place).replace('{figure}', c.figure);
    return `
      <p><button class="ghost" data-act="modalclose">‹ ${U.report.back}</button></p>
      <div class="row sp"><h2>${protagonistHtml(cur)} · ${esc(c.name)}</h2><span class="stamp">${esc(outcomeOf(cur))}</span></div>${sayingLine(cur)}
      ${cur.report.journey?.accepted === false || ev.scene?.vignettes ? '' : `<p style="font-size:16px">${esc(summary)}</p>`}
      ${ev.refs ? `<p>${esc(c.story)} ${wl('events:c:' + ev.id, U.light.sources)}</p>` : `<div class="quote">${esc(c.story)}<div class="muted" style="font-family:inherit;font-size:12px">${U.fmt.dash}${esc(c.figure)}</div></div>`}
      ${participationHtml(cur)}
      ${vignetteHtml(c.vignettes?.[cur.report.vignette])}
      <div class="sec">${U.stars.points}</div>${pointsHtml(cur, (id) => (ev.scene ? c.points[id] : U.light.points[id]))}${cur.report.found ? `<p class="warnline">${U.light.found[cur.report.found]}</p>` : ''}
      <div class="sec">${U.report.accounts}</div>
      <table><tbody>
        <tr><td>${U.stars.col}</td><td class="num">${starsHtml(cur.stars || 0, cur.eraId)}${cur.newBest ? ' ' + U.stars.new_best : ''}</td></tr>
        ${grownRow(P)}
        <tr><td>${U.report.antique_gain}</td><td class="num">${P.antique ? `${wl('antiques:' + P.antique, T.antiques[P.antique].name)}${P.duplicate ? ' · ' + U.report.antique_dup : ''}` : U.report.antique_none}</td></tr>
        <tr><td>${U.report.rest}</td><td class="num">${P.restDays} ${U.report.days}</td></tr>
      </tbody></table>
      <p class="muted">${U.light.note}</p>
      ${echoHtml(cur.echo ?? ctx.backend.echoOf(cur))}`;
  }

  // A recalled trip has no ending to read. It says where it stopped and what came back.
  function recalledHtml(cur) {
    const P = cur.paid;
    return `
      <p><button class="ghost" data-act="modalclose">‹ ${U.report.back}</button></p>
      <div class="row sp"><h2>${protagonistHtml(cur)} · ${esc(placeName(cur))}</h2><span class="stamp">${esc(outcomeOf(cur))}</span></div>${sayingLine(cur)}
      <p style="font-size:16px">${U.report.recalled_text.replace('{day}', String(Math.floor(cur.recallDay) + 1)).replace('{p}', String(Math.round(P.share * 100)))}</p>
      <div class="sec">${U.report.accounts}</div>
      <table><tbody>
        ${grownRow(P)}
        <tr><td>${U.report.antique_gain}</td><td class="num">${P.antique ? `${wl('antiques:' + P.antique, T.antiques[P.antique].name)}${P.duplicate ? ' · ' + U.report.antique_dup : ''}` : U.report.antique_none}</td></tr>
        <tr><td>${U.report.rest}</td><td class="num">${P.restDays} ${U.report.days}</td></tr>
      </tbody></table>`;
  }

  // why a small story sent the traveller home: the pressure that was still on them after the kit, and the ways to take it off
  function evacuationCause(cur) {
    if (!cur.light) return '';
    const left = ctx.backend.pressureOf(cur.eraId, cur.spec.staffId, cur.spec.items, cur.spec.favor).left;
    if (!Object.keys(left).length) return '';
    return `<p>${esc(U.report.evacuation_cause.replace('{list}', pressureText(left)))}</p><p class="muted">${U.dispatch.pressure_hint}</p>`;
  }

  function reportHtml(id) {
    const cur = ctx.S().dispatches.find((d) => d.id === id);
    if (!cur) return `<p class="muted">${U.report.none}</p>`;
    if (cur.recalled) return recalledHtml(cur);
    if (cur.evacuation) return `<p><button class="ghost" data-act="modalclose">‹ ${U.report.back}</button></p>
      <div class="row sp"><h2>${esc(placeName(cur))}</h2><span class="stamp">${esc(outcomeOf(cur))}</span></div>${sayingLine(cur)}
      <p>${esc(U.report.evacuation_text.replace('{day}', String(cur.evacuation.day)))}</p>${evacuationCause(cur)}
      <p>${esc(U.report.rest)} ${cur.paid.restDays} ${esc(U.report.days)}</p>`;
    // a small story written before it kept a record is shown the old way
    if (cur.light && !cur.report.timeline) return lightHtml(cur);
    return storyHtml(cur, cur.light ? lightStory(cur) : modelStory(cur));
  }

  // What a report needs from a story with a full model: its record, its words, its numbers.
  function modelStory(cur) {
    const R = cur.report;
    const e = ctx.era(cur.eraId);
    const event = D.get('catalog.events').find((ev) => ev.era === cur.eraId);
    const modelSource = e.raw.metadata.vignette_source;
    // the words for what is counted are those of the model when it has its own: a model about a university does not count the sick and the dead
    const RL = { ...U.report, ...(T.eras[cur.eraId].labels || {}) };
    const varNote = (name) => {
      const v = e.vars[name];
      return `${srcLabel(v.source)}${v.note ? COLON + v.note : ''}`;
    };
    const fn = (key, label, text) => {
      const open = st.opened.has(cur.id + key);
      return `<span class="fn" data-act="fn" data-key="${key}">${label}</span>${open ? `<div class="fntext">${esc(text)}</div>` : ''}`;
    };
    // the numbers, chart and ledger are shown only where the model counts something that means something, such as the lives of an outbreak
    const numbersHtml = () => {
      const C = R.chart;
      const sickMax = Math.max(...C.base.map((p) => p.cases), ...C.branch.map((p) => p.cases)) * D.get('config.ui.chart.headroom');
      const deadMax = Math.max(...C.base.map((p) => p.deaths), ...C.branch.map((p) => p.deaths)) * D.get('config.ui.chart.headroom');
      const pts = (rows, k) => rows.map((p) => [p.day, p[k]]);
      const mk = [{ x: C.arrive, color: '#2f4f6f' }, { x: C.leave, color: '#2f4f6f' }, { x: C.handleBase, color: '#8a6a1f', dash: '1 3' }, { x: C.handleBranch, color: '#b3382c', dash: '5 3' }].filter((m) => m.x !== null && m.x !== undefined);
      // the two marks of the handle are named by the model, so a model about a university does not speak of a pump
      const handleName = T.eras[cur.eraId].handle_label;
      // the main timeline and this branch can each be switched off, in both charts at once; the marks of the visit and the handle stay
      const legend = legendHtml('outbreak', [{ key: 'base', label: U.report.mainline, color: '#8a8272', dash: true }, { key: 'branch', label: U.report.this_branch, color: '#b3382c' }],
        [{ label: U.report.legend_visit, color: '#2f4f6f', style: 'dotted' }, { label: U.report.legend_handle_hist.replace('{x}', handleName), color: '#8a6a1f', style: 'dotted' }, { label: U.report.legend_handle_branch.replace('{x}', handleName), color: '#b3382c', style: 'dashed' }]);
      const two = (k) => [{ key: 'base', pts: pts(C.base, k), color: '#8a8272', dash: '5 4' }, { key: 'branch', pts: pts(C.branch, k), color: '#b3382c' }];
      const charts = `<div class="grid2"><div><div class="muted">${RL.sick}</div>${lineChart(two('cases'), mk, sickMax, 'outbreak')}</div>
      <div><div class="muted">${RL.dead}</div>${lineChart(two('deaths'), mk, deadMax, 'outbreak')}</div></div>`;
      const led = R.ledger.map((l) => `<tr><td>${l.day}</td><td class="num">${ri(l.sick)}</td><td class="num">${ri(l.baseDead)}</td><td class="num">${ri(l.dead)}</td><td class="num">${ri(l.treated)}</td><td class="num">${ri(l.protected)}</td></tr>`).join('');
      const cmp = R.compare;
      return `<details class="nums"><summary class="sec">${U.report.numbers}</summary>
      <div class="sec">${U.report.chart}</div>${legend}${charts}
      <div class="sec">${U.report.compare}</div>
      <table><thead><tr><th></th><th class="num">${U.report.mainline}</th><th class="num">${U.report.this_branch}</th></tr></thead><tbody>
        <tr><td>${RL.deaths}${fn('c1', '†', varNote(e.report.deaths))}</td><td class="num">${ri(cmp.deathsBase)}</td><td class="num">${ri(cmp.deathsBranch)}</td></tr>
        <tr><td>${RL.sick}${U.report.cumulative}${fn('c2', '†', varNote(e.report.cases))}</td><td class="num">${ri(cmp.casesBase)}</td><td class="num">${ri(cmp.casesBranch)}</td></tr>
        <tr><td>${esc(T.eras[cur.eraId].handle_label)}${fn('c3', '†', varNote(e.report.handle))}</td><td class="num">${esc(cmp.handleBase)}</td><td class="num">${esc(cmp.handleBranch)}</td></tr>
        <tr><td>${RL.treated} / ${RL.protected}${fn('c4', '†', varNote(e.report.treated))}</td><td class="num">—</td><td class="num">${ri(cmp.treated)} / ${ri(cmp.protectedTotal)}</td></tr>
      </tbody></table>
      <div class="sec">${U.report.ledger}</div>
      <div class="scroll"><table><thead><tr><th>${R.ledgerBySegment ? U.report.segment : U.report.day}</th><th class="num">${RL.sick}</th><th class="num">${RL.dead}·${U.report.mainline}</th><th class="num">${RL.dead}·${U.report.this_branch}</th><th class="num">${RL.treated}</th><th class="num">${RL.protected}</th></tr></thead><tbody>${led}</tbody></table></div>
      </details>`;
    };
    // a report written before the lines of getting in were part of the record still shows them on their own
    const woven = R.timeline.some((t) => t.kind === 'journey');
    return {
      title: T.eras[cur.eraId].name, year: e.raw.metadata.era.year, staff: R.staff,
      place: event ? T.catalog[event.id].place : T.eras[cur.eraId].short, anchor: anchorOf(cur.eraId),
      sources: `${event?.refs ? ' ' + wl('events:c:' + event.id, U.light.sources) : ''}${modelSource ? ' ' + wl('events:' + modelSource, U.light.sources) : ''}`,
      timeline: R.timeline, factRefs: (fact) => (fact ? D.get('encyclopedia.fact_sources')?.[cur.eraId]?.[fact] || [] : []),
      summary: R.summary, modelNote: U.report.note_model + COLON + srcLabel(e.vars[e.report.deaths].source),
      stay: R.chart.arrive != null && R.chart.leave != null ? R.chart.leave - R.chart.arrive : null,
      before: woven ? '' : participationHtml(cur),
      afterRecord: woven ? '' : vignetteHtml((T.catalog[event?.id]?.vignettes ?? T.eras[cur.eraId].vignettes)?.[R.vignette]),
      numbers: e.report.numbers === false ? '' : numbersHtml(),
      // the shift of the timeline of a full model reads its star points and the words of the model, as a small story reads its scene
      shift: shiftHtml(cur, e.raw.star_points, e.raw.star_rules === 2, { points: T.eras[cur.eraId].star_points, points_fail: T.eras[cur.eraId].points_fail, shift: T.eras[cur.eraId].shift, shift_all: T.eras[cur.eraId].shift_all }),
      cost: R.accounts.cost, restDays: R.accounts.restDays, pointText: (pid) => T.eras[cur.eraId].star_points[pid], hints: R.hints, warn: '', body: R.body,
      // sharing closes the reading of a report, so it comes last and is the one lit; sending again is a plain button
      buttons: `<button data-act="again" data-id="${cur.id}">${U.report.again}</button><button data-act="vs">${U.report.vs_prev}</button><button class="primary" data-act="shareopen" data-id="${cur.id}">${U.share.button}</button>`,
    };
  }

  // The shift of the timeline: what this trip changed, set out beside what history recorded. Each won point that fulfils something has a row,
  // a missed guard point has one row of its own marked out of sync, and a trip that changed nothing says so. Guard points that held are not shown,
  // since history went on as it was. The words are text.<language>.shift of the card, read in the language of the page, see 5.12 of the story outline.
  // defs: the points of the story with their guard flags, from the scene of a small story or the star_points of a full model; c: their words,
  // points, points_fail, shift and shift_all, from the catalogue card or the text of the model
  function shiftHtml(cur, defs, rules2, c) {
    if (!rules2 || !defs || cur.report.journey?.accepted === false) return '';
    const staff = staffName(D, cur.spec.staffId);
    const put = (x) => esc(String(x || '').split('{staff}').join(staff));
    const pts = cur.report.points || [];
    const rows = [];
    const out = cur.report.outcomeId === 'desync' ? pts.filter((p) => p.guard && !p.hit && !p.cut).sort((a, b) => a.day - b.day)[0] : null;
    if (out) rows.push(`<tr class="desync"><td>${put(c.shift?.[out.id]?.was || c.points[out.id])}</td><td><span class="chip">${esc(U.report.shift.desync)}</span> ${put(c.points_fail?.[out.id])}</td></tr>`);
    const won = pts.filter((p) => p.hit && !p.guard && c.shift?.[p.id]?.now);
    for (const p of won) rows.push(`<tr><td>${put(c.shift[p.id].was)}</td><td>${put(c.shift[p.id].now)}</td></tr>`);
    // a guard point held: history went on as it was, and the card says so, so a story that only guards has its own shift
    const held = out ? [] : pts.filter((p) => p.guard && p.hit);
    for (const p of held) rows.push(`<tr class="held"><td>${put(c.shift?.[p.id]?.was || c.points[p.id])}</td><td>${esc(U.report.shift.held_row)}</td></tr>`);
    const fulfil = defs.filter((p) => !p.guard);
    if (c.shift_all && fulfil.length && fulfil.every((p) => pts.find((x) => x.id === p.id)?.hit)) rows.push(`<tr class="all"><td>${esc(U.report.shift.all)}</td><td>${put(c.shift_all)}</td></tr>`);
    const head = out ? U.report.shift.desync : [won.length ? U.report.shift.moved.replace('{n}', String(won.length)) : '', held.length ? U.report.shift.held.replace('{n}', String(held.length)) : ''].filter(Boolean).join(U.fmt.sep) || U.report.shift.none;
    // a card of its own, the turn of the whole report: what history recorded on the left, what this timeline made of it on the right
    return `<section class="shiftcard${out ? ' desync' : ''}"><div class="shifthead"><span class="shifttitle">${esc(U.report.shift.title)}</span><span class="shiftsub">${esc(head)}</span></div>
      ${rows.length ? `<table class="shift"><thead><tr><th>${esc(U.report.shift.was)}</th><th>${esc(U.report.shift.now)}</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : ''}</section>`;
  }

  // What a report needs from a small story: the record it kept, the words of its catalogue card, no model numbers.
  function lightStory(cur) {
    const c = T.catalog[cur.eraId];
    const ev = D.get('catalog.events').find((x) => x.id === cur.eraId);
    const EF = D.get('encyclopedia.event_facts')?.[ev.id];
    return {
      title: c.name, year: ev.year, staff: staffName(D, cur.spec.staffId), place: c.place, anchor: 'relic_' + ev.id,
      sources: ev.refs ? ' ' + wl('events:c:' + ev.id, U.light.sources) : '',
      timeline: cur.report.timeline, factRefs: (fact) => (fact && EF ? EF.facts.find((f) => f.id === fact)?.sources || [] : []),
      summary: null, modelNote: null, stay: null, before: '', afterRecord: '', numbers: '', shift: shiftHtml(cur, ev.scene?.points, ev.scene?.star_rules === 2, c),
      cost: null, restDays: cur.paid.restDays, pointText: (pid) => (ev.scene ? c.points[pid] : U.light.points[pid]), hints: [],
      warn: cur.report.found ? `<p class="warnline">${U.light.found[cur.report.found]}</p>` : '', body: cur.report.body,
      buttons: `<button class="primary" data-act="shareopen" data-id="${cur.id}">${U.share.button}</button>`,
    };
  }

  // One report for every story. Under the title and the stamp comes the line the employee says, then the record, one short line to a thing in time order:
  // the year of the office and the crossing, the year of the place and what happened, a mark for each new year, and back in the year of the office with the return,
  // the rest and the mood. A thin rule tells history from the lines of the employee, and buttons show all, only history or only the employee; the button of the
  // employee bears their name, so the lines of another employee met in the same time can have their own button later. Notes are kept for what has a source
  // worth reading: a line of history names the sources of its fact, and a number worked out by the model says so. In the developer mode each line also says where
  // it came from. After the record come the numbers when the story has any, the body in the developer mode, and the summary with the stars.
  function storyHtml(cur, S) {
    const spec = cur.spec;
    const notes = [];
    const noteOf = (key, text) => { let n = notes.findIndex((x) => x.key === key); if (n < 0) { notes.push({ key, text }); n = notes.length - 1; } return n + 1; };
    const sup = (ns) => (ns.length ? `<sup class="fnref">${ns.join(',')}</sup>` : '');
    const lineKind = (t) => (t.tag === 'history' ? 'history' : 'travel');
    // the one emphasis of the record is a won star; every other line has the same weight, and history and the employee are told apart by their side of the axis
    // the date goes to a column of its own: the lead of the sentence up to its first comma, when it reads as a date or a day of the stay
    const splitLead = (text) => {
      const m = String(text).match(/^([^，。：,:;]{1,24}?)(，|：|, |: )/);
      if (!m || !/\d|十|廿|元|初|望|朔|晦/.test(m[1]) || !/[年月日天]|day|Day|\d{3,4}|January|February|March|April|May|June|July|August|September|October|November|December/.test(m[1])) return ['', text];
      return [m[1], text.slice(m[0].length)];
    };
    // A time axis down the middle: history on the left, leaning towards the axis, the employee on the right in a bubble, the date on the axis between them.
    // Another employee met in the same time can later take the right side in a colour of their own.
    const cell = (side, body) => (side === 'l' ? `<div class="what l">${body}</div><span class="when">%W</span><div class="what r"></div>` : `<div class="what l"></div><span class="when">%W</span><div class="what r"><div class="bubble">${body}</div></div>`);
    const tlLine = (t) => {
      const [lead, rest] = splitLead(t.text);
      const refs = lineKind(t) === 'history' ? sup(S.factRefs(t.fact).map((r) => noteOf('ref:' + r, D.get('enc_text.refs.' + r) || r))) : '';
      const why = DEV && t.why ? `<div class="why">${esc(U.report.why[t.why.kind] + COLON + t.why.expr + (t.why.vals && t.why.vals.length ? SEP + t.why.vals.map(([k, v]) => k + ' = ' + v).join(', ') : ''))}</div>` : '';
      const body = `${t.star ? '<span class="starmark">★</span> ' : ''}${esc(rest)}${t.times > 1 ? ' ' + esc(U.report.times.replace('{n}', String(t.times))) : ''}${refs}${why}`;
      return `<li class="${lineKind(t)}${t.star ? ' star' : ''}${t.after ? ' after' : ''}${t.own ? ' own' : ''}">${cell(lineKind(t) === 'history' ? 'l' : 'r', body).replace('%W', esc(lead))}</li>`;
    };
    const accepted = cur.report.journey?.accepted !== false;
    const summaryNote = accepted && S.modelNote ? sup([noteOf('model', S.modelNote)]) : '';
    const nowYear = officeDate(cur.startDay).getUTCFullYear();
    const backYear = officeDate(cur.readyDay).getUTCFullYear();
    const yearLine = (y) => `<li class="year"><span class="when">${esc(U.report.year_mark.replace('{y}', String(y)))}</span></li>`;
    // the crossing says only where and to which year it carried the employee; the rest of the story is told by the dated lines of the record
    const via = S.anchor && D.get('antiques.antiques.' + S.anchor)?.kind === 'medium' ? U.report.depart_medium : U.report.depart_antique;
    // the lines of the office, set out like the others: the date in its column, the sentence beside it
    const officeLi = (text, extra) => { const [lead, rest] = splitLead(text); return `<li class="travel">${cell('r', esc(rest) + extra).replace('%W', esc(lead))}</li>`; };
    const departLine = officeLi(via.replace('{date}', officeDay(cur.startDay)).replace('{staff}', S.staff).replace('{anchor}', S.anchor && T.antiques[S.anchor] ? T.antiques[S.anchor].name : '').replace('{year}', String(S.year)).replace('{place}', S.place), S.sources);
    const backLine = officeLi(accepted && S.summary ? U.report.back_line.replace('{date}', officeDay(cur.readyDay)).replace('{text}', S.summary) : U.report.back_plain.replace('{date}', officeDay(cur.readyDay)).replace('{staff}', S.staff), summaryNote);
    const fd = cur.favorDelta || 0;
    const restLine = officeLi((S.restDays > 0 ? U.report.rest_line.replace('{n}', String(S.restDays)) : U.report.rest_none).replace(/\{staff\}/g, S.staff) + (fd > 0 ? U.report.mood_up : fd < 0 ? U.report.mood_down : '').replace(/\{staff\}/g, S.staff), '');
    let lastYear = S.year;
    const record = S.timeline.map((t) => { const mark = t.year && t.year !== lastYear ? yearLine(t.year) : ''; if (t.year) lastYear = t.year; return mark + tlLine(t); }).join('');
    // what the employee says on coming back is a line of the record, after the return, where it is said
    const said = ctx.backend.sayingOf(cur);
    const saidLine = said ? officeLi(U.report.said_line.replace('{date}', officeDay(cur.readyDay)).replace(/\{staff\}/g, S.staff).replace('{x}', said), '') : '';
    const tl = yearLine(nowYear) + departLine + yearLine(S.year) + record + yearLine(backYear) + backLine + saidLine + restLine;
    const tlf = st.tlf === 'history' || st.tlf === 'travel' ? st.tlf : 'all';
    const tlButtons = [['all', U.report.line_filter.all], ['history', U.report.line_filter.history], ['travel', S.staff]].map(([k, label]) => `<button class="chipbtn${tlf === k ? ' on' : ''}" data-act="tlf" data-k="${k}">${esc(label)}</button>`).join(' ');
    // the body of the employee through the stay as LM reads it, a part of its own that config.ui.report_body turns on always, in the developer mode only, or never
    const bodyHtml = () => {
      const show = D.get('config.ui.report_body');
      const B = S.body;
      if (!B || !B.length || !(show === 'always' || (show === 'dev' && DEV))) return '';
      const colors = D.get('config.ui.chart.body_colors');
      // The two kinds are kept apart. What weighs on the body, every readout of LM, runs from 0, nothing, to 1, the worst, and is drawn as a percentage;
      // only the readouts that rose at all are drawn. What the body can still do is the five attributes of each day, which fall as the burdens rise.
      const keys = Object.keys(U.report.body_readouts).filter((k) => B.some((x) => x[k] > 0));
      const ymax = 100 * Math.max(D.get('config.ui.chart.body_min_max'), ...B.flatMap((x) => keys.map((k) => x[k] || 0))) * D.get('config.ui.chart.headroom');
      const lines = keys.map((k, i) => ({ key: k, label: U.report.body_readouts[k], color: colors[i % colors.length], pts: B.map((x) => [x.day, 100 * (x[k] || 0)]) }));
      const burden = keys.length ? `<div class="sec">${U.report.body}</div>${legendHtml('burden', lines)}${lineChart(lines, [], ymax, 'burden')}` : `<div class="sec">${U.report.body}</div><p class="muted">${U.report.body_none}</p>`;
      // reports kept from before the attributes were saved with the body have only the burdens
      if (!B.some((x) => x.attrs)) return burden;
      const attrs = D.get('staff.attributes');
      const alines = attrs.map((a, i) => ({ key: a, label: T.stats[a], color: colors[i % colors.length], pts: B.filter((x) => x.attrs).map((x) => [x.day, x.attrs[a]]) }));
      return burden + `<div class="sec">${U.report.body_attrs}</div>${legendHtml('attrs', alines)}${lineChart(alines, [], ctx.backend.staffAttrMax, 'attrs')}`;
    };
    const vsHtml = st.vs && !cur.light ? vsBlock(cur) : '';
    // the record and all below it are folded under the settlement, and open on a click
    const recOpen = st.opened.has(cur.id + 'rec');
    const page = `
      <p><button class="ghost" data-act="modalclose">‹ ${U.report.back}</button></p>
      <div class="row sp"><h2>${protagonistHtml(cur)} · ${esc(S.title)}</h2><span class="stamp">${esc(outcomeOf(cur))}</span></div>
      ${settleHtml(cur, S)}
      <div class="row" style="margin:16px 0">${S.buttons}</div>${vsHtml}
      <p><button class="ghost recordbtn" data-act="fn" data-key="rec">${esc(recOpen ? U.report.hide_record : U.report.full_record)}</button></p>
      ${recOpen ? `<div class="fullrecord">
      ${S.stay != null ? `<p class="muted">${esc(U.report.historical_stay.replace('{n}', r1(S.stay)))}</p>` : ''}
      ${S.before}
      <div class="row sp sec"><span>${U.report.timeline}</span><span class="tlf">${tlButtons}</span></div><ul class="tl f-${tlf}">${tl}</ul>
      ${S.afterRecord}${S.warn}
      ${S.numbers}
      ${bodyHtml()}
      ${S.hints.map((h) => `<div class="hint">${esc(h)}</div>`).join('')}
      ${notes.length ? `<div class="sec">${U.report.footnotes}</div><ol class="notes">${notes.map((x) => `<li class="muted">${esc(x.text)}</li>`).join('')}</ol>` : ''}
      </div>` : ''}`;
    // the notes are numbered in the order they are first met on the page, so they are listed with the record they belong to
    return page;
  }

  function participationHtml(cur) {
    const j = cur.report.journey;
    if (!j) return '';
    const P = U.report.participation;
    const staff = staffName(D, cur.spec.staffId);
    // who the employee was taken for, in the words of the story when it has its own for that identity
    const idText = j.identity ? { ...T.identities[j.identity], ...((cur.eraId && T.eras[cur.eraId]?.identities?.[j.identity]) || {}) } : { name: '', cover: '' };
    const entry = (key, day) => `<li>${esc(P[key].replace('{day}', String(day)).replace('{cover}', idText.cover).replace(/\{staff\}/g, staff).replace('{identity}', idText.name))}</li>`;
    return `<div class="sec">${esc(P.title)}</div><ol class="participation">${entry(j.reached ? 'reached' : 'blocked', j.approachDay)}${j.reached ? entry(j.accepted ? 'accepted' : 'declined', j.recognitionDay) : ''}${entry(j.accepted ? 'involved' : 'continued', j.recognitionDay)}</ol>`;
  }

  function vsBlock(cur) {
    const older = reports().find((d) => d.eraId === cur.eraId && d.claimedAt < cur.claimedAt && !d.evacuation);
    if (!older) return `<p class="muted">${U.report.none}</p>`;
    const rows = diffRows(D, cur.eraId, { res: cur }, { res: older }).map((r) => `<tr><td>${esc(r.k)}</td><td class="num">${esc(r.b)}</td><td class="num">${esc(r.a)}</td></tr>`).join('');
    const dl = (a, b) => { const d = a - b; return `<span class="delta ${d < 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${r1(d)}</span>`; };
    return `<div class="card"><h3>${U.report.vs_title}</h3><table><thead><tr><th></th><th class="num">${U.report.prev}</th><th class="num">${U.report.this}</th></tr></thead><tbody>${rows}
      <tr><td>${U.report.deaths}</td><td class="num">${ri(older.report.compare.deathsBranch)}</td><td class="num">${ri(cur.report.compare.deathsBranch)} ${dl(cur.report.compare.deathsBranch, older.report.compare.deathsBranch)}</td></tr>
      <tr><td>${esc(T.eras[cur.eraId].handle_label)}</td><td class="num">${esc(older.report.compare.handleBranch)}</td><td class="num">${esc(cur.report.compare.handleBranch)}</td></tr>
      <tr><td>${esc(outcomeOf(older))}</td><td class="num">→</td><td class="num">${esc(outcomeOf(cur))}</td></tr></tbody></table></div>`;
  }

  // ---------- about ----------
  function contentNoticeHtml() {
    const C = U.about.content_credit;
    const { issues, mail } = D.get('config.meta.links');
    const contacts = {
      issues: `<a href="${esc(issues)}" target="_blank" rel="noopener noreferrer">GitHub Issues</a>`,
      mail: `<a href="${esc(mail)}">${esc(mail.replace(/^mailto:/, ''))}</a>`,
    };
    const review = esc(C.review).replace(/\{(issues|mail)\}/g, (_, channel) => contacts[channel]);
    return `<p>${esc(C.drafts)}</p><p>${review}</p>`;
  }

  function aboutHtml() {
    const A = U.about;
    const M = D.get('config.meta');
    const appName = ['zh', 'zh-Hant', 'ja', 'ko'].includes(D.lang) ? `${M.app}（${M.chinese_title}）` : M.app;
    const link = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
    // the first mention of a name on this page links to its page
    const inline = { 'Life Matters': M.links.lm, 'Care for You': M.links.care, 'Fan Shen': M.links.author, 'Mutopia Project': M.links.music };
    const linked = new Set();
    const para = (x) => {
      let h = esc(x);
      for (const [name, href] of Object.entries(inline)) if (!linked.has(name) && h.includes(name)) { linked.add(name); h = h.replace(name, link(href, name)); }
      return `<p>${h}</p>`;
    };
    const links = A.links.map(({ id, label }) => link(M.links[id], label)).join(' · ');
    const preview = `<h4>${esc(A.preview.title)}</h4>${para(A.preview.project)}${para(A.preview.changes)}`;
    const echoes = `<h4>${esc(A.echoes.title)}</h4>${para(A.echoes.rule)}`;
    const secs = A.sections.map((sec, i) => {
      const heading = `<h3 id="about-${i}">${esc(sec.h)}</h3>`;
      const credits = sec.credits ? para(A.content_credit.design) : '';
      const body = sec.p.map((x, k) => para(x) + (sec.links === k ? `<p>${links}</p>` : '')).join('');
      const review = sec.review ? contentNoticeHtml() : '';
      return heading + credits + review + body + (sec.dedication ? para(A.dedication) : '') + (sec.echoes ? echoes : '') + (sec.preview ? preview : '');
    }).join('');
    const jumps = jumpBar([...A.sections.map((sec, i) => ['about-' + i, sec.h]), ['about-updates', A.update_notes]]);
    const releases = `<div class="release-notes">${D.get('changelog.releases').map(({ title, notes }) =>
      `<section><h4>${esc(title)}</h4><pre>${esc(notes)}</pre></section>`).join('')}</div>`;
    return `<div class="about">
      <div class="about-title">${esc(appName)}</div>
      <p class="about-version">${esc(A.version_line.replace('{v}', M.version).replace('{date}', M.released))}</p>
      ${jumps}
      ${secs}
      <h3 id="about-updates">${esc(A.update_notes)}</h3>${releases}</div>`;
  }

  // ---------- home ----------
  function homeHtml() {
    const H = U.home;
    fixForm();
    return `
      <p class="lead" style="margin-top:0">${esc(H.lead)}</p>
      <div id="home-staff-panel">${staffStatusHtml()}</div>
      <div class="sec" id="home-map">${U.dispatch.era}</div>
      ${worldMap.html()}
      ${officeHtml()}`;
  }

  // ---------- the record of one person ----------
  // Name, background, traits, the attributes of the day with the mood in them, the story, the tally of stars, and the trips of this person a page at a time.
  function staffModalHtml(id) {
    const S = ctx.S();
    const sf = S.staff[id];
    const P = U.staffpage;
    const attrList = D.get('staff.attributes');
    const eff = ctx.backend.staffStats(id, sf.favor);
    const plain = ctx.backend.staffBase(id);
    const worn = office.staffGear(id);
    const gearAdd = (k) => worn.reduce((a, g) => a + ((D.get('items.' + g).stat_add || {})[k] || 0), 0);
    const attrs = attrList.map((k) => `${T.stats[k]} ${r1(eff[k])}`).join(' · ');
    const keptIds = new Set(S.dispatches.filter((d) => d.claimed).map((d) => d.id));
    const rows = S.trips.filter((x) => x.staffId === id).reverse();
    const grown = sf.growth || {};
    const stars = office.growthStars(id);
    const into = stars % O.stars_per_point;
    const training = attrList.filter((k) => plain[k] < ctx.backend.staffAttrMax);
    const trainingSelect = sf.hired && !D.get('staff.staff')[id].dev_only && training.length
      ? `<label class="muted">${esc(P.training)} <select data-training="${esc(id)}">
          <option value="">${esc(P.training_auto)}</option>
          ${training.map((k) => `<option value="${esc(k)}" ${k === sf.training ? 'selected' : ''}>${esc(T.stats[k])}</option>`).join('')}
        </select></label>` : '';
    const attrRows = attrList.map((k) => {
      const base = plain[k];
      return `<tr><td>${esc(T.stats[k])}</td><td class="num">${r1(base)}${grown[k] ? ` <span class="muted"${tip(P.grown_tip)}>(+${grown[k]})</span>` : ''}</td><td class="num">${gearAdd(k) ? `<b class="up">+${gearAdd(k)}</b>` : '<span class="muted">0</span>'}</td><td class="num"><b>${r1(eff[k])}</b></td></tr>`;
    }).join('');
    const implants = Object.keys(D.get('items')).filter((g) => D.get('items.' + g).implant);
    const away = staffState(id) === 'away';
    const bonusText = (it) => Object.entries(it.stat_add || {}).map(([k, v]) => `${T.stats[k]} +${v}`).join(SEP);
    const used = office.loadOf(id), cap = office.loadCap();
    const gearRows = implants.filter((g) => worn.includes(g) || (S.inv[g] || 0) > 0).map((g) => {
      const it = D.get('items.' + g);
      const on = worn.includes(g);
      const fits = used + it.load <= cap;
      const btn = on ? `<button class="ghost" data-act="unequip" data-id="${g}" ${away ? 'disabled' : ''}>${P.unequip}</button>`
        : `<button data-act="equip" data-id="${g}" ${away || !fits ? 'disabled' : ''}${!fits ? tip(P.too_heavy) : ''}>${P.equip}</button>`;
      return `<tr><td>${wl('items:' + g, T.items[g].name, T.items[g].desc)}${on ? ` <span class="chip">${P.worn}</span>` : ` <span class="muted">${P.in_stock.replace('{n}', String(S.inv[g] || 0))}</span>`}</td><td class="num">${P.load} ${it.load}</td><td>${esc(bonusText(it))}</td><td class="num">${btn}</td></tr>`;
    }).join('');
    const list = listbox.html({
      id: 'staff_trips', rows, empty: U.office.no_trips,
      page: tripPage('staff_trips', rows),
      cols: [
        { k: 'no', label: '#', w: '8%', cls: 'num', cell: (r) => `<span class="muted">${r.id.slice(1)}</span>` },
        { k: 'year', label: U.report.year, w: '16%', cell: (r) => fmtYear(D, yearOfPlace(r.place, r.light)) },
        { k: 'place', label: U.report.place, w: '36%', cell: (r) => `<span class="nowrap${r.archived ? ' archived' : ''}">${esc(shortOfPlace(r.place, r.light))}</span>` },
        { k: 'stars', label: U.stars.col, w: '24%', cell: (r) => `${starsHtml(r.stars || 0, r.place)}${r.redeemed ? ' <span class="chip">♥</span>' : ''}` },
        { k: 'act', label: '', w: '16%', cls: 'num', cell: (r) => (keptIds.has(r.id) ? `<button class="ghost" data-act="open" data-id="${r.id}">${U.report.view}</button>` : '') },
      ],
    });
    return `<h3>${esc(staffName(D, id))} <span class="muted">${esc(staffProfile(D, id))}</span> <a class="wl" data-act="wiki" data-id="staff:${esc(id)}">${P.wiki}</a></h3>
      <p class="muted">${esc(T.staff[id].bio)}</p>
      <div class="cols2"><div><div class="radarwrap"${tip(attrs)}>${radarSvg(D, eff)}</div></div>
      <div><table class="plain attrs"><thead><tr><th></th><th class="num">${P.base}</th><th class="num">${P.gear}</th><th class="num">${P.today}</th></tr></thead><tbody>${attrRows}</tbody></table>
      <div class="muted">${favorCell(id)} · <span${tip(U.office.tally_tip)}>${tallyHtml(stars)}</span></div>
      <div class="muted">${P.growth.replace('{n}', String(into)).replace('{m}', String(O.stars_per_point))}</div>${trainingSelect}</div></div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${staffTraits(D, id).map(traitChip).join('')}</div>
      ${sf.hired ? `<div class="sec">${P.gear_title} <span class="muted">${P.load_meter.replace('{a}', String(used)).replace('{b}', String(cap))}</span></div>
      ${gearRows ? `<table class="plain gear"><tbody>${gearRows}</tbody></table>` : `<p class="muted">${P.no_gear}</p>`}
      ${away ? `<p class="muted">${P.away_note}</p>` : ''}` : `<p class="muted">${P.left_note}</p>`}
      <div class="sec">${P.story}</div><p>${esc(T.staff[id].story || '')}</p>
      <div class="sec" style="clear:both">${P.record_title}</div>${recordHtml(id)}
      <div class="sec">${U.office.staff_trips}</div>${list}`;
  }

  // ---------- the welcome of a new game ----------
  // The language, what the game is, how it is played, the places open at the start with a way to draw the random ones again, and the notice about the people in it.
  // The player's own character, made before the first trip: a name, a gender, a skin tone, points over the five attributes and up to two traits.
  function founderHtml() {
    const S = ctx.S(), W = U.welcome, F = D.get('config.founder'), f = S.founder, left = pointsLeft(D, f);
    const locked = S.seq > 0 ? 'disabled' : '';
    const attrs = D.get('staff.attributes').map((a) => `<li><span class="lab">${esc(T.stats[a])}</span> <button data-act="founderattr" data-id="${a}:-1" ${locked} aria-label="-">−</button> <b>${f.base[a]}</b> <button data-act="founderattr" data-id="${a}:1" ${locked} aria-label="+">+</button></li>`).join('');
    const skins = Object.entries(D.get('hiring.skin_tones')).map(([k, c]) => `<button class="skinpick ${f.skin === k ? 'on' : ''}" data-act="founderskin" data-id="${k}" aria-pressed="${f.skin === k}" ${locked} style="background:${c}"></button>`).join('');
    const genders = Object.keys(D.get('staff.gender_class')).map((g) => `<option value="${g}" ${f.gender === g ? 'selected' : ''}>${esc(U.gender[g])}</option>`).join('');
    const traits = Object.keys(D.get('staff.traits')).map((id) => `<button class="chip ${f.traits.includes(id) ? 'on' : ''}" data-act="foundertrait" data-id="${id}" aria-pressed="${f.traits.includes(id)}" ${locked}${tip(pointsText(D.get('staff.traits.' + id)))}>${esc(T.traits[id])}</button>`).join(' ');
    return `<section class="founder">
        <div class="row sp"><h3>${esc(W.founder_title)}</h3><button class="ghost" data-act="rerollfounder" ${locked}>${esc(W.reroll_founder)}</button></div>
        <div class="founder-identity"><label>${W.founder_name} <input id="founder-name" type="text" maxlength="${F.name_max}" value="${esc(f.name)}" placeholder="${esc(W.founder_name_ph)}" required ${locked}></label>
        <label>${W.founder_gender} <select id="founder-gender" ${locked}>${genders}</select></label>
        <span>${W.founder_skin} ${skins}</span></div>
        <h3>${esc(W.founder_attrs.replace('{n}', String(left)))}</h3><ul class="founderattrs">${attrs}</ul>
        <h3>${esc(W.founder_traits.replace('{n}', String(F.traits_max)))}</h3><div>${traits}</div>
      </section>`;
  }
  function welcomeReady() {
    const S = ctx.S();
    return !founderProblem(D, S.founder) && pointsLeft(D, S.founder) === 0 && S.founder.traits.length > 0
      && (!S.startStaff || S.startStaff.pick.length === D.get('config.office.start_staff.pick'));
  }
  function welcomeOfficeHtml() {
    const S = ctx.S();
    const W = U.welcome;
    const places = S.locks.map((id) => D.get('antiques.antiques.' + id)).filter((an) => an.era || an.event).map((an) => {
      const era = !!an.era;
      const id = era ? an.era : an.event;
      return `<li><b>${fmtYear(D, yearOfPlace(id, !era))}</b> ${esc(era ? T.eras[id].name : T.catalog[id].name)} <span class="muted">${esc(era ? T.eras[id].place_name : T.catalog[id].place)}</span>${era ? ` <span class="chip">${W.tutorial}</span>` : ''}</li>`;
    }).join('');
    const need = D.get('config.office.start_staff.pick');
    const picked = S.startStaff ? S.startStaff.pick : [];
    const crew = (S.startStaff ? S.startStaff.offer : []).map((id) => {
      const on = picked.includes(id);
      const fixed = S.startStaff.offer.length <= need;
      const toggle = fixed ? '' : `<button data-act="startpick" data-id="${esc(id)}" aria-pressed="${on}">${on ? '✓' : '+'}</button> `;
      return `<li class="${on ? 'on' : ''}">${toggle}<b>${esc(staffName(D, id))}</b> <span class="muted">${esc(staffProfile(D, id))}</span><div class="muted">${esc(T.staff[id].bio)}</div></li>`;
    }).join('');
    return `<div class="welcome-office">
      <section><h3>${esc(W.staff_title)}</h3><p class="muted">${esc(W.staff_hint.replace('{n}', need))}</p>
        <ul class="startstaff">${crew}</ul>
        <button class="ghost" data-act="rerollstaff" ${S.seq > 0 || !S.startStaff ? 'disabled' : ''}>${esc(W.reroll_staff)}</button></section>
      <section><h3>${esc(W.places_title)}</h3><p class="muted">${esc((S.startRandom || []).length ? W.places_hint : W.places_hint_start_only)}</p>
        <ul class="startplaces">${places}</ul>
        ${(S.startRandom || []).length ? `<button class="ghost" data-act="rerollstart" ${S.seq > 0 ? 'disabled' : ''}>${esc(W.reroll)}</button>` : ''}</section>
    </div>`;
  }
  function welcomeIntroHtml() {
    const W = U.welcome;
    return `<p>${esc(W.story)}</p><p>${esc(W.story_start)}</p><section class="welcome-notice">
      <h3 id="welcome-title" tabindex="-1">${esc(W.disclaimer_title)}</h3>
      ${contentNoticeHtml()}
    </section>`;
  }
  function welcomeHtml() {
    const W = U.welcome;
    const acknowledged = ctx.S().welcomeAcknowledged === true;
    return `<div class="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <header class="row sp"><h2>${esc(U.title)}</h2>${langHtml()}</header>
      <div class="welcome-content" data-keep="welcome-${acknowledged}" tabindex="0">
        ${acknowledged ? `<h3 id="welcome-title" tabindex="-1">${esc(W.office_title)}</h3>
          <p class="welcome-how"><b>${esc(W.how_title)}</b> · ${esc(W.how.join(' '))}</p>
          <div class="welcome-columns">${founderHtml()}${welcomeOfficeHtml()}</div>` : welcomeIntroHtml()}
      </div>
      <footer class="welcome-nav row">
        ${acknowledged ? `<span class="small muted">${esc(W.start_requirements)}</span><button class="primary" data-act="welcomestart" ${welcomeReady() ? '' : 'disabled'}>${esc(W.begin)}</button>` :
          `<button class="primary" data-act="welcomeack">${esc(W.acknowledge)}</button>`}
      </footer>
    </div>`;
  }

  // ---------- pop-up ----------
  // One pop-up at a time over the page. The dispatch pop-up holds the story, who goes, what they carry and the send button, so a trip is made
  // in one place and then shows in the log below. The share pop-up holds the card of a trip. A click on the dark ground, the cross or Escape closes it.
  // Closing the wiki gives back the pop-up it was opened from, if there was one, so a chain of links ends where it began.
  function closeModal() {
    if (st.modal && st.modal.kind === 'welcome') return;
    const fromHomeCompletion = st.modal?.kind === 'share' && st.modal.id === null;
    // the wiki and the status page open over what is open and give it back, one step at a time
    st.modal = st.modal && ['wiki', 'staff', 'share', 'report'].includes(st.modal.kind) && st.modalStack.length ? st.modalStack.pop() : null;
    if (reportBackScroll.has(st.modal)) {
      st.pendingModalScroll = reportBackScroll.get(st.modal);
      reportBackScroll.delete(st.modal);
    }
    if (!st.modal) st.modalStack = [];
    render();
    if (fromHomeCompletion) document.getElementById('home-complete')?.focus();
  }
  function modalBody(dispatch) {
    const m = st.modal;
    if (!m) return '';
    if (m.kind === 'broke') return `<div class="mbox narrow"><h2>${esc(U.clock.broke_title)}</h2><p>${esc(U.clock.broke_text)}</p><p class="row" style="justify-content:flex-end"><button class="primary" data-act="modalclose">${esc(U.clock.broke_ok)}</button></p></div>`;
    if (m.kind === 'welcome') return `<div class="mbox narrow welcomebox">${welcomeHtml()}</div>`;
    if (m.kind === 'wiki') return `<div class="mbox wide wikibox">${wiki.html()}</div>`;
    if (m.kind === 'settings') return `<div class="mbox narrow">${settingsPage.html()}</div>`;
    if (m.kind === 'about') return `<div class="mbox narrow">${aboutHtml()}</div>`;
    if (m.kind === 'report') return `<div class="mbox wide reportbox" role="dialog" aria-modal="true" aria-label="${esc(U.report.view)}">${reportHtml(m.id)}</div>`;
    if (m.kind === 'staff') return `<div class="mbox wide">${staffModalHtml(m.id)}</div>`;
    if (m.kind === 'place') return `<div class="mbox wide">${worldMap.placeHtml(m.place)}</div>`;
    if (m.kind === 'dispatch') return `<div class="mbox wide">${m.from ? `<p><button class="ghost" data-act="modalplace" data-id="${esc(m.from)}">‹ ${U.map.back_list}</button></p>` : ''}<div class="storyfull">${dispatch.story}</div><div class="dispatchdesk">${dispatch.desk}</div></div>`;
    const d = share.dispatch(m.id);
    return m.kind === 'share' && (d || d === null) ? `<div class="mbox sharebox" role="dialog" aria-modal="true" aria-labelledby="share-title">${share.html(d)}</div>` : '';
  }
  let modalRedrawPending = false;
  function renderModal(fromTick) {
    modalRedrawPending = fromTick === true && editingWithin(modalEl);
    if (modalRedrawPending) return;
    if (fromTick === true && st.modal?.kind === 'report') return;
    const dispatch = st.modal?.kind === 'dispatch' ? { story: storyBoxHtml(), desk: deskHtml() } : null;
    const inner = modalBody(dispatch);
    // only a pop-up the game forces open stops the clock, see config.clock.hold_modals; one the player opens leaves it running
    if (inner && D.get('config.clock.hold_modals').includes(st.modal.kind)) office.holdClock(); else office.releaseClock();
    const html = inner ? `<div class="modalbg" data-bg="1"><div class="mwrap">${inner.replace('<div class="mbox', st.modal.kind === 'welcome' ? '<div class="mbox' : `<button class="mclose ghost" data-act="modalclose" aria-label="${esc(U.share.close)}">✕</button><div class="mbox`)}</div></div>` : '';
    document.body.classList.toggle('modal-open', !!html);
    if (html === modalLast) return;
    modalLast = html;
    const keeps = {};
    modalEl.querySelectorAll('[data-keep]').forEach((el) => { keeps[el.dataset.keep] = el.scrollTop; });
    const scroll = st.pendingModalScroll ?? modalEl.querySelector('.modalbg')?.scrollTop ?? 0;
    st.pendingModalScroll = null;
    const act = document.activeElement;
    const keepFocus = act && act.id && modalEl.contains(act) ? { id: act.id, a: act.selectionStart, b: act.selectionEnd } : null;
    const desk = fromTick === true && dispatch && modalEl.querySelector('.dispatchdesk');
    if (desk) {
      // A returning traveller can change the desk without changing this event's history.
      setHtml(modalEl.querySelector('.storyfull'), dispatch.story);
      setHtml(desk, dispatch.desk);
    } else {
      modalEl.innerHTML = html;
      if (dispatch) {
        lastHtml.set(modalEl.querySelector('.storyfull'), dispatch.story);
        lastHtml.set(modalEl.querySelector('.dispatchdesk'), dispatch.desk);
      }
    }
    if (keepFocus) { const el = document.getElementById(keepFocus.id); if (el && el !== act) { el.focus({ preventScroll: true }); try { el.setSelectionRange(keepFocus.a, keepFocus.b); } catch (e) { /* no selection in this kind of input */ } } }
    modalEl.querySelectorAll('[data-keep]').forEach((el) => { if (el.dataset.keep in keeps) el.scrollTop = keeps[el.dataset.keep]; });
    const bg = modalEl.querySelector('.modalbg');
    if (bg && bg.scrollTop !== scroll) bg.scrollTop = scroll;
    if (st.modal && st.modal.kind === 'share') share.draw(share.dispatch(st.modal.id));
  }
  modalEl.addEventListener('click', (ev) => {
    if (ev.target.dataset && ev.target.dataset.bg) { closeModal(); return; }
    onClick(ev);
  });
  modalEl.addEventListener('change', (ev) => onChange(ev));
  modalEl.addEventListener('input', (ev) => onInput(ev));
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && st.modal) closeModal(); });

  // ---------- render ----------
  let viewHtml = null;
  let viewRedrawPending = false;
  let renderedMarketPeriod = null;
  let renderedAntiqueCount = null;
  const marketPeriod = () => ctx.backend.marketPeriod(ctx.S().clock.day);
  function render(fromTick) {
    office.ensureHire();
    renderTabs();
    renderResources();
    viewRedrawPending = fromTick === true && editingWithin(view);
    if (viewRedrawPending) { renderModal(true); return; }
    const html = { home: homeHtml, buy: () => shop.html({ hire: hireHtml() }, 'buy'), shop: () => shop.html({ staff: staffBoxHtml() }, 'shop') }[st.tab]();
    const key = st.tab;
    if (key === 'shop') {
      renderedMarketPeriod = marketPeriod();
      renderedAntiqueCount = ctx.S().antiques.length;
    }
    if (fromTick === true && html === viewHtml && key === st.lastKey) { renderModal(true); return; }
    viewHtml = html;
    if (st.lastKey !== null) st.scrollY[st.lastKey] = window.scrollY;
    const keeps = {};
    view.querySelectorAll('[data-keep]').forEach((el) => { keeps[el.dataset.keep] = el.scrollTop; });
    const act = document.activeElement;
    const keep = act && act.id && view.contains(act) ? { id: act.id, a: act.selectionStart, b: act.selectionEnd } : null;
    view.innerHTML = html;
    view.querySelectorAll('[data-keep]').forEach((el) => { if (el.dataset.keep in keeps) el.scrollTop = keeps[el.dataset.keep]; });
    if (st.pendingKeeps) {
      view.querySelectorAll('[data-keep]').forEach((el) => { if (el.dataset.keep in st.pendingKeeps) el.scrollTop = st.pendingKeeps[el.dataset.keep]; });
      st.pendingKeeps = null;
    }
    window.scrollTo(0, st.scrollY[key] || 0);
    st.lastKey = key;
    navCommit();
    renderTabs();
    renderModal(fromTick);
    if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.a, keep.b); } catch (e) { /* number inputs have no selection */ } } }
  }

  // ---------- actions ----------
  function addItem(id, dir) {
    const it = D.get('items.' + id);
    const v = (st.form.items[id] || 0) + dir * it.step;
    st.form.items[id] = Math.min(it.max, ctx.S().inv[id] || 0, Math.max(0, v));
  }

  function send() {
    const d = st.map.cat ? office.launchLight(st.map.cat, st.form.staffId, Number(st.form.seed) || 1, sceneKit()) : office.launch(st.form.eraId, formSpec());
    if (!d) return;
    ctx.audio.sfx('send');
    st.tab = 'home';
    st.modal = null;
    st.form.plots = [];
    renderClock();
    render();
    const lg = document.getElementById('home-pending');
    if (lg) lg.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function claim(id) {
    const d = office.claim(id);
    if (!d) return;
    ctx.audio.sfx('back');
    openReport(id);
  }

  function openReport(id) {
    if (st.modal) {
      if (st.modal.kind === 'dispatch') {
        reportBackScroll.set(st.modal, modalEl.querySelector('.modalbg')?.scrollTop ?? 0);
        st.pendingModalScroll = 0;
      }
      st.modalStack.push(st.modal);
    }
    st.modal = { kind: 'report', id };
    st.vs = false;
    render();
  }

  // Auto configure: search the kits for the traveller and the place, and take the recommended one.
  function suggest() {
    st.searching = true;
    render();
    setTimeout(() => {
      const e = E();
      const r = ctx.backend.suggest(e.id, formSpec(), ctx.S().inv);
      st.searching = false;
      if (r.recommended) st.form.items = { ...Object.fromEntries(Object.keys(e.itemBindings).map((k) => [k, 0])), ...r.recommended.items };
      render();
    }, D.get('config.ui.search_delay_ms'));
  }

  function onClick(ev) {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    if (act === 'inc') { addItem(id, 1);  render(); }
    else if (act === 'dec') { addItem(id, -1);  render(); }
    else if (act === 'clear') { for (const k of Object.keys(st.form.items)) st.form.items[k] = 0; render(); }
    else if (act === 'autocfg') suggest();
    else if (act === 'send') send();
    else if (act === 'claim') claim(id);
    else if (act === 'gift') { office.gift(id); render(); }
    else if (act === 'appoint') { office.appoint(id); renderClock(); render(); }
    else if (act === 'recall') { const r = office.recall(id); if (r.ok) openReport(id); renderClock(); render(); }
    else if (act === 'open') openReport(id);
    else if (act === 'fire') { office.dismiss(id); render(); }
    else if (act === 'hire') { if (office.hire(id)) ctx.audio.sfx('coin'); render(); }
    else if (act === 'wiki') { wiki.go(id); if (st.modal && st.modal.kind === 'wiki') wiki.refresh(); else { if (st.modal) st.modalStack.push(st.modal); st.modal = { kind: 'wiki' }; render(); } }
    else if (act === 'wikitag') { st.wiki.tag = id; wiki.refresh(); }
    else if (act === 'wikiback') { wiki.move(-1); wiki.refresh(); }
    else if (act === 'wikifwd') { wiki.move(1); wiki.refresh(); }
    else if (act === 'lsort') { listbox.sort(id); render(); }
    else if (act === 'pickstaff') { if (staffState(id) === 'ready') { st.form.staffId = id;  } render(); }
    else if (act.startsWith('map')) { if (worldMap.act(act, id)) render(); }
    else if (['cartinc', 'cartdec', 'cartclear', 'cartbuy', 'shopsell', 'antsell', 'antlock', 'sellspares'].includes(act)) {
      if (shop.act(act, id) && ['cartbuy', 'shopsell', 'antsell', 'sellspares'].includes(act)) ctx.audio.sfx('coin');
      render();
    }
    else if (act === 'aboutjump') { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (act === 'shareopen') { if (st.modal) st.modalStack.push(st.modal); st.modal = { kind: 'share', id }; render(); }
    else if (act === 'homecomplete' && !st.modal && ctx.S().energy >= O.home_cost) {
      st.modal = { kind: 'share', id: null };
      render();
      document.getElementById('share-title')?.focus();
    }
    else if (act === 'modalclose') closeModal();
    else if (act === 'rerollstart') { office.rerollStart(); render(); }
    else if (act === 'rerollstaff') { office.rerollStaff(); render(); }
    else if (act === 'startpick') { office.pickStart(id); render(); }
    else if (act === 'founderattr') { const [a, d] = id.split(':'); office.founderAttr(a, Number(d)); render(); }
    else if (act === 'founderskin') { office.founderSkin(id); render(); }
    else if (act === 'foundertrait') { office.founderTrait(id); render(); }
    else if (act === 'rerollfounder') { office.rerollFounder(); render(); }
    else if (act === 'welcomeack' && st.modal?.kind === 'welcome') {
      ctx.S().welcomeAcknowledged = true;
      ctx.save();
      render();
      document.getElementById('welcome-title').focus();
    }
    else if (act === 'welcomestart' && ctx.S().welcomeAcknowledged && welcomeReady()) { ctx.S().welcomed = true; st.modal = null; ctx.save(); render(); }
    else if (act === 'modalopen') { st.modalStack = []; st.modal = { kind: id }; render(); }
    else if (act === 'recordmore') { st.recordAll = st.recordAll === id ? null : id; render(); }
    else if (act === 'staffopen') { if (st.pager.staff_trips) st.pager.staff_trips.page = 0; if (st.modal && st.modal.kind !== 'staff') st.modalStack.push(st.modal); st.modal = { kind: 'staff', id }; render(); }
    else if (act === 'equip') { if (st.modal && st.modal.kind === 'staff') office.equip(st.modal.id, id); render(); }
    else if (act === 'unequip') { if (st.modal && st.modal.kind === 'staff') office.unequip(st.modal.id, id); render(); }
    else if (act === 'archive') { office.archive([id]); render(); }
    else if (act === 'restore') { office.restore([id]); render(); }
    else if (act === 'archiverule') { office.archive(office.archiveRule(id)); render(); }
    else if (act === 'modalplace') { st.modal = { kind: 'place', place: id }; render(); }
    else if (act === 'lfilter') { listbox.toggleFilter(id); render(); }
    else if (act === 'pgpage') { const [pid, dir] = id.split(':'); listbox.turn(pid, dir === 'next' ? 1 : -1); render(); }
    else if (act === 'sharesave') share.save(share.dispatch(st.modal.id));
    else if (act === 'sharecopy') share.copy(share.dispatch(st.modal.id));
    else if (act === 'sharenative') share.send(share.dispatch(st.modal.id));
    else if (act === 'musictoggle') ctx.audio.toggle();
    else if (act === 'sfxtry') ctx.audio.sfx(id);
    else if (act === 'saveexport') settingsPage.exportSave();
    else if (act === 'settingsreset') { ctx.settings.reset(); ctx.audio.setEnabled(ctx.settings.get('music_autostart')); render(); }
    else if (act === 'go') { st.tab = id; st.modal = null; render(); }
    else if (act === 'vs') { st.vs = !st.vs; render(); }
    else if (act === 'tlf') { st.tlf = b.dataset.k; render(); }
    else if (act === 'chartline') { const k = b.dataset.chart + ':' + b.dataset.k; if (st.chartOff.has(k)) st.chartOff.delete(k); else st.chartOff.add(k); render(); }
    else if (act === 'fn') { const k = st.modal.id + b.dataset.key; if (st.opened.has(k)) st.opened.delete(k); else st.opened.add(k); render(); }
    // a click on the settlement shows all of it at once: its rows and its echo are put where the motion would have ended
    else if (act === 'settleskip' && !ev.target.closest('.echo-sources')) { st.settled[id] = 0; render(); }
    else if (act === 'yaml') { st.modelYaml = !st.modelYaml; render(); }
    else if (act === 'again') {
      const d = ctx.S().dispatches.find((x) => x.id === id);
      const fresh = newForm(d.eraId);
      st.form = { ...fresh, staffId: d.spec.staffId, items: Object.fromEntries(Object.entries(d.spec.items).map(([k, n]) => [k, Math.min(n, ctx.S().inv[k] || 0)])), seed: DEV ? d.spec.seed : fresh.seed };
      
      st.tab = 'home';
      st.map.cat = null;
      st.modalStack = [];
      st.modal = { kind: 'dispatch' };
      render();
    // a cleared save is a new game, so the settings give way to the welcome, as on a first visit
    } else if (act === 'reset') { if (confirm(U.settings.data.reset_confirm)) { ctx.reset(); st.modal = { kind: 'welcome' }; render(); } }
  }
  view.addEventListener('click', onClick);
  toolsEl.addEventListener('click', onClick);
  resEl.addEventListener('click', onClick);
  function onToggle(ev) {
    const t = ev.target;
    if (!t.matches) return;
    if (t.matches('details.wcat')) st.wiki.openCats[t.dataset.cat] = t.open;
    else if (t.matches('#wiki-tags details.tagfold')) st.wiki.tagOpen = t.open;
    else if (t.matches('#map-tags details.tagfold')) st.map.tagOpen = t.open;
  }
  view.addEventListener('toggle', onToggle, true);
  modalEl.addEventListener('toggle', onToggle, true);
  const tipEl = document.createElement('div');
  tipEl.id = 'tip';
  document.body.appendChild(tipEl);
  document.addEventListener('mouseover', (ev) => {
    const el = ev.target.closest && ev.target.closest('[data-tip]');
    if (!el) { tipEl.style.display = 'none'; return; }
    tipEl.textContent = el.dataset.tip;
    tipEl.style.display = 'block';
  });
  document.addEventListener('mousemove', (ev) => {
    if (tipEl.style.display === 'none') return;
    const TT = D.get('config.ui.tooltip');
    const pad = TT.offset, edge = TT.edge;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(edge, Math.min(window.innerWidth - w - edge, ev.clientX + pad)) + 'px';
    tipEl.style.top = Math.max(edge, Math.min(window.innerHeight - h - edge, ev.clientY + pad)) + 'px';
  });
  function onInput(ev) {
    const t = ev.target;
    if (settingsPage.onInput(ev)) return;
    if (t.dataset.fq !== undefined) { listbox.setText(t.dataset.fq, t.value); render(); return; }
    if (t.id === 'founder-name') {
      office.founderName(t.value);
      const start = modalEl.querySelector('[data-act=welcomestart]');
      if (start) start.disabled = !welcomeReady();
      return;
    }
    if (t.id === 'wiki-q') wiki.onInput(t.value);
    else if (worldMap.onInput(t)) { /* partial refresh done by the map */ }
  }
  view.addEventListener('input', onInput);
  function onChange(ev) {
    const t = ev.target;
    if (t.dataset.training) { office.setTraining(t.dataset.training, t.value); render(); return; }
    if (t.id === 'lang') { changeLang(t.value); return; }
    if (t.id === 'founder-gender') { office.founderGender(t.value); render(); return; }
    if (t.id === 'log-archived') { st.showArchived = t.checked; if (st.pager.log) st.pager.log.page = 0; render(); return; }
    if (t.id === 'grant-tier') { st.filters.grantTier = t.value === '' ? null : Number(t.value); if (st.pager.ants) st.pager.ants.page = 0; render(); return; }
    if (t.dataset.tripOrder) {
      const key = t.dataset.tripOrder;
      st.sort[key] = { k: t.value };
      if (st.pager[key]) st.pager[key].page = 0;
      render();
      return;
    }
    if (t.dataset.ftag !== undefined) { listbox.setTag(t.dataset.ftag, t.value); render(); return; }
    if (t.dataset.pgsize) { listbox.setSize(t.dataset.pgsize, Number(t.value)); render(); return; }
    if (settingsPage.onInput(ev)) return;
    if (t.id === 'map-star') { worldMap.onInput(t); render(); return; }
    if (t.dataset.act === 'saveimport' && t.files && t.files[0]) { settingsPage.importSave(t.files[0]).then((okk) => { if (okk) { render(); } }); return; }
    if (t.name === 'staff') { if (staffState(t.value) === 'ready') { st.form.staffId = t.value;  } render(); }
    else if (t.id === 'seed') { st.form.seed = Number(t.value) || 1;  }
  }
  view.addEventListener('change', onChange);
  window.addEventListener('popstate', (ev) => {
    const n = ev.state && ev.state.sid === nav.sid ? ev.state.n : null;
    if (n === null || !nav.list[n]) return;
    nav.pos = n;
    const s = nav.list[n];
    st.tab = s.tab; st.modal = s.modal || null; st.modalStack = [];
    render();
  });
  tabsEl.addEventListener('click', (ev) => {
    const nb = ev.target.closest('[data-nav]');
    if (nb) { navStep(Number(nb.dataset.nav)); return; }
    const b = ev.target.closest('[data-tab]');
    if (!b) return;
    st.tab = b.dataset.tab;
    st.modal = null;
    render();
  });

  // A return shows a note that fades by itself, with the seconds left drawn as a bar, and the reports wait on the home page.
  const toastEl = document.createElement('div');
  toastEl.id = 'toasts';
  document.body.appendChild(toastEl);
  function showReturns(list) {
    const names = list.map((d) => staffName(D, d.spec.staffId));
    const text = names.length > 2 ? U.clock.back_many.replace('{a}', names[0]).replace('{b}', names[1]).replace('{n}', String(names.length - 2)) : names.length === 2 ? U.clock.back_two.replace('{a}', names[0]).replace('{b}', names[1]) : U.clock.back_one.replace('{a}', names[0]);
    const sec = D.get('config.ui.toast_seconds');
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span>${esc(text)}</span> <button class="ghost" data-act="toastgo">${esc(U.clock.back_view)}</button><i style="animation-duration:${sec}s"></i>`;
    toastEl.appendChild(el);
    while (toastEl.children.length > 3) toastEl.removeChild(toastEl.firstChild);
    setTimeout(() => el.remove(), sec * 1000);
  }
  toastEl.addEventListener('click', (ev) => {
    if (!ev.target.closest('[data-act=toastgo]')) return;
    toastEl.innerHTML = '';
    st.modal = null; st.tab = 'home';
    render();
  });

  function tick() {
    const fresh = office.advance(D.get('config.ui.refresh_ms') / 1000);
    if (fresh.length) { ctx.audio.sfx('ready'); showReturns(fresh); }
    if (ctx.S().brokeNew) { ctx.S().brokeNew = false; st.modal = { kind: 'broke' }; ctx.save(); render(); }
    // nothing is sent before the game has begun, so a save never has trips out while the founder form still waits
    if (ctx.S().clock.auto && !needsWelcome()) office.autoStep();
    if (pressed) {
      if (fresh.length && st.tab === 'home') viewRedrawPending = true;
      if (fresh.length && st.modal) modalRedrawPending = true;
      return;
    }
    renderClock(true);
    renderTabs();
    const transit = ctx.S().dispatches.some((d) => !d.claimed);
    if (st.tab === 'home') {
      if (fresh.length || ctx.S().clock.auto || transit || viewRedrawPending || modalRedrawPending) render(true);
      else {
        const panel = document.getElementById('home-staff-panel');
        if (panel && !editingWithin(panel)) setHtml(panel, staffStatusHtml());
      }
    } else if (viewRedrawPending) {
      render(true);
    } else if (st.tab === 'buy' && renderedHireSlots !== ctx.S().hire.slots) {
      render(true);
    } else if (st.tab === 'shop' && (renderedMarketPeriod !== marketPeriod() || renderedAntiqueCount !== ctx.S().antiques.length)) {
      render(true);
    } else if (modalRedrawPending || (fresh.length && st.modal)) {
      renderModal(true);
    }
    const hireNext = document.getElementById('hire-next');
    if (hireNext && renderedHireSlots === ctx.S().hire.slots) {
      const countdown = hireCountdown();
      if (hireNext.textContent !== countdown) hireNext.textContent = countdown;
    }
    renderResources();
  }
  createHeaderLines(D, document.getElementById('quote')).start();
  const musicEl = document.getElementById('music');
  function renderMusic() {
    const a = ctx.audio;
    const t = a.tracks[a.state.index];
    const label = `${t.composer} · ${t.title}`;
    setHtml(musicEl, `<button class="ico" data-music="prev" title="${esc(U.music.prev)}" aria-label="${esc(U.music.prev)}">⏮</button><button class="ico" data-music="toggle" title="${esc(a.state.playing ? U.music.pause : U.music.play)}" aria-label="${esc(a.state.playing ? U.music.pause : U.music.play)}">${a.state.playing ? '⏸' : '▶'}</button><button class="ico" data-music="next" title="${esc(U.music.next)}" aria-label="${esc(U.music.next)}">⏭</button><span class="trk" title="${esc(label)}">${esc(a.state.error ? U.music.error : a.state.loading ? U.music.loading : label)}</span>`);
  }
  musicEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-music]');
    if (!b) return;
    const a = ctx.audio;
    if (b.dataset.music === 'prev') a.prev(); else if (b.dataset.music === 'next') a.next(); else a.toggle();
  });
  ctx.audio.onChange(() => { renderMusic(); if (st.modal && st.modal.kind === 'settings' && !pressed) render(true); });
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-music], [data-act="musictoggle"]')) return;
    if (ctx.settings.get('music_autostart') && !ctx.audio.state.playing) ctx.audio.play();
  }, { once: true });
  renderMusic();
  renderClock();
  renderResources();
  return { render, tick, state: st, office, X };
}
