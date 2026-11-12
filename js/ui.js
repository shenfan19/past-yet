import { diffRows, kitText, staffName, staffTraits, itemText, stratText, firstSentence, fmtYear, staffProfile } from './narrate.js';
import { createWiki } from './wiki.js';
import { createShop } from './shop.js';
import { createWorldMap } from './worldmap.js';
import { createListbox } from './listbox.js';
import { createOffice } from './office.js';
import { createSettingsPage } from './settings_ui.js';
import { createShare } from './share.js';
import { createQuotes } from './quotes.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const r1 = (x) => (Math.round(x * 10) / 10).toString();
const ri = (x) => String(Math.round(x));

export function createUI(D, ctx) {
  const T = D.get('text');
  const U = T.ui;
  const COLON = U.fmt.colon, SEP = U.fmt.sep;
  const O = D.get('config.office');
  const view = document.getElementById('view');
  const tabsEl = document.getElementById('tabs');
  const I = D.get('config.i18n');
  const UI_KEY = 'teleporter_ui_state';
  let savedLang = null;
  try { savedLang = localStorage.getItem(I.storage_key); } catch (e) { /* storage blocked */ }
  const urlLang = new URLSearchParams(location.search).get('lang');
  const chosen = urlLang && urlLang in I.locales ? urlLang : (savedLang && savedLang in I.locales ? savedLang : I.auto);
  // The language selector lives on the settings page. It is drawn there and handled here, so a change keeps the page and state.
  function langHtml() {
    const opts = `<option value="${I.auto}" ${chosen === I.auto ? 'selected' : ''}>${esc(U.lang.auto)}</option>` + Object.entries(I.locales).map(([code, name]) => `<option value="${code}" ${chosen === code ? 'selected' : ''}>${esc(name)}</option>`).join('');
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
  document.getElementById('logo').textContent = D.get('config.meta.logo');
  document.getElementById('title').textContent = U.title;
  document.getElementById('subtitle').textContent = U.subtitle;

  const devParam = new URLSearchParams(location.search).get('dev');
  const DEV = devParam === null ? ctx.settings.get('dev_mode') : devParam === '1';
  const st = { showArchived: false, tab: 'home', sub: null, share: false, back: 'home', vs: false, opened: new Set(), form: null, suggest: null, searching: false, shop: { q: '', tag: '' }, cart: {}, sort: {}, scrollY: {}, lastKey: null, wiki: { q: '', tag: '', cur: null, hist: [], pos: -1, openCats: {}, tagOpen: false }, map: null };

  // ---------- navigation history ----------
  // Every page the player lands on is one entry, so the back and forward buttons and the browser's own buttons walk the same trail.
  // Render records the entry, so any way of changing page is covered without each place having to remember it.
  const nav = { list: [], pos: -1, sid: String(Date.now()) };
  const navSnap = () => ({ tab: st.tab, sub: st.sub, share: st.share, back: st.back });
  const navSame = (a, b) => a.tab === b.tab && a.sub === b.sub && a.share === b.share;
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
    if ('staff' in rule) return hiredIds().includes(rule.staff);
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
  const sceneKit = () => Object.fromEntries(Object.entries(st.form.items).filter(([k, n]) => n > 0 && D.get('items.' + k).scene));
  const srcLabel = (src) => ({ historical: U.report.source_historical, lm_model: U.report.source_lm, game_assumption: U.report.source_game, calibrated: U.report.source_calibrated }[src]);
  const tagLabel = (tag) => U.report[tag];
  const reports = () => ctx.S().dispatches.filter((d) => d.claimed).sort((a, b) => b.claimedAt - a.claimedAt);
  const tip = (text) => ` data-tip="${esc(text)}"`;
  const wl = (id, label, tipText) => `<a class="wl" data-act="wiki" data-id="${esc(id)}"${tipText ? tip(tipText) : ''}>${esc(label)}</a>`;
  const statsLine = (stats) => D.get('staff.attributes').map((k) => `${T.stats[k]} ${r1(stats[k])}`).join(' · ');
  // what a trait does at the sync points, as percent per kind of point, for example persuading +35%
  const pointsText = (tr) => Object.entries(tr.points).map(([k, v]) => `${T.point_kinds[k]} ${v > 0 ? '+' : ''}${Math.round(v * 100)}%`).join(SEP);
  function traitTip(t) {
    const tr = D.get('staff.traits.' + t);
    const mods = pointsText(tr);
    const pol = Object.entries(tr.policy || {}).map(([grp, key]) => `${U.dispatch[grp]}${COLON}${T.strategies[grp][key].name}`).join('${U.fmt.semi}');
    const pref = tr.prefer ? `${U.office.secretary_pref}${COLON}${U.office.aims[tr.prefer]}` : '';
    const note = T.trait_notes[t];
    return [T.traits[t], `+ ${note.pro}`, `− ${note.con}`, mods, pol, pref].filter(Boolean).join('\n');
  }
  function staffTip(id) {
    const stats = ctx.backend.staffStats(id);
    const mini = statsLine(stats);
    return [staffProfile(D, id), T.staff[id].bio, staffTraits(D, id).map((t) => T.traits[t]).join(SEP), mini].join('\n');
  }
  const staffLink = (id) => (D.get('staff.staff.' + id).generated && !(id in ctx.S().generated) ? `<span class="wl"${tip(staffTip(id))}>${esc(staffName(D, id))}</span>` : wl('staff:' + id, staffName(D, id), staffTip(id)));
  const traitChip = (t) => `<a class="chip tr" data-act="wiki" data-id="traits:${t}"${tip(traitTip(t))}>${esc(T.traits[t])}</a>`;
  // stars: filled and empty marks coloured by the count, bronze, silver and gold
  const STAR_MAX = D.get('config.stars.max');
  const starsHtml = (n) => `<span class="stars s${n}"${tip(U.stars.label.replace('{n}', String(n)).replace('{m}', String(STAR_MAX)))}>${'★'.repeat(n)}${'☆'.repeat(STAR_MAX - n)}</span>`;
  // the sync points of a trip, hit or not, with the words of the place
  const pointsHtml = (cur, textOf) => `<ul class="sync">${cur.report.points.map((p) => `<li class="${p.hit ? 'hit' : 'miss'}">${p.redeem ? (p.hit ? '♥' : '♡') : (p.hit ? '★' : '☆')} ${esc(textOf(p.id))}${p.redeem ? ` <span class="chip">${U.stars.redeem}</span>` : ''}</li>`).join('')}</ul>`;
  const placeYear = (d) => fmtYear(D, d.light ? D.get('catalog.events').find((x) => x.id === d.eraId).year : ctx.era(d.eraId).raw.metadata.era.year);
  const placeName = (d) => (d.light ? T.catalog[d.eraId].name : T.eras[d.eraId].name);
  const placeShort = (d) => (d.light ? T.catalog[d.eraId].place : T.eras[d.eraId].short);
  const outcomeOf = (d) => (d.recalled ? U.report.recalled : d.light ? U.light.outcome[d.report.outcomeId] : d.report.outcomeName);
  // a plain running count of the trips sent out, not a reference to anything
  const seqOf = (d) => d.id.slice(1);
  const livesOf = (d) => (d.recalled || d.light ? '—' : r1(d.report.accounts.lives));
  const recordRow = (d, withStaff) => `<tr><td>${withStaff ? staffLink(d.spec.staffId) : esc(placeShort(d))}</td><td>${esc(outcomeOf(d))}</td><td class="num">${livesOf(d)}</td><td><button class="ghost" data-act="open" data-id="${d.id}">${U.report.view}</button></td></tr>`;
  function selectEra(id) {
    if (st.form.eraId !== id) { st.form = { ...newForm(id), staffId: st.form.staffId };  }
  }
  // a row of links to the sections of a page, the same bar the about and settings pages have
  const jumpBar = (items) => `<p class="jumps">${items.map(([id, label]) => `<a class="wl" data-act="aboutjump" data-id="${id}">${esc(label)}</a>`).join(' · ')}</p>`;
  const X = { jumpBar, starsHtml: (n) => starsHtml(n), storyFor: (e) => (e.catalog ? catalogCard(e.id) : placeFile(e.id)), D, ctx, T, U, O, DEV, st, esc, r1, ri, srcLabel, isUnlocked, visibleEras, eraOpen, anchored, selectEra, wl, tip, anchorOf, owns, catalogTags, saveUiState, langHtml };
  const office = createOffice(X);
  office.ensureHire();
  const clockEl = document.getElementById('clock');
  X.listbox = createListbox(X);
  const listbox = X.listbox;
  const wiki = createWiki(X);
  X.office = office;
  const shop = createShop(X);
  const worldMap = createWorldMap(X);
  const settingsPage = createSettingsPage(X);
  const share = createShare(X);
  st.map = worldMap.init();
  st.form = newForm(visibleEras()[0]);
  worldMap.attach(view);
  restoreUiState();

  // ---------- interface state over a language switch ----------
  // The game itself is in localStorage. The page and the filters live here, so a switch of language comes back to the same place.
  function saveUiState() {
    try {
      const keeps = {};
      view.querySelectorAll('[data-keep]').forEach((el) => { keeps[el.dataset.keep] = el.scrollTop; });
      const key = st.sub ? 'sub:' + st.sub : st.tab;
      sessionStorage.setItem(UI_KEY, JSON.stringify({
        tab: st.tab, sub: st.sub, back: st.back, vs: st.vs, opened: [...st.opened], shop: st.shop, cart: st.cart, sort: st.sort,
        wiki: st.wiki, map: { ...st.map, drag: null, justDragged: false }, form: st.form, scrollY: { ...st.scrollY, [key]: window.scrollY }, keeps,
      }));
    } catch (e) { /* storage blocked, the switch just starts fresh */ }
  }
  function restoreUiState() {
    let raw = null;
    try { raw = sessionStorage.getItem(UI_KEY); sessionStorage.removeItem(UI_KEY); } catch (e) { return; }
    if (!raw) return;
    try {
      const o = JSON.parse(raw);
      if (o.tab in U.tabs) st.tab = o.tab;
      if (o.sub && ctx.S().dispatches.some((d) => d.id === o.sub)) { st.sub = o.sub; st.back = o.back in U.tabs ? o.back : 'home'; st.vs = !!o.vs; }
      st.opened = new Set(o.opened || []);
      Object.assign(st.shop, o.shop);
      st.cart = o.cart || {};
      st.sort = o.sort || {};
      Object.assign(st.wiki, o.wiki);
      Object.assign(st.map, o.map);
      if (o.form && visibleEras().includes(o.form.eraId) && hiredIds().includes(o.form.staffId)) st.form = { ...st.form, ...o.form };
      st.scrollY = o.scrollY || {};
      st.pendingKeeps = o.keeps || {};
    } catch (e) { console.warn('界面状态恢复失败', e); }
  }

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
  // The clock is three parts so that a ticking day never rebuilds the controls: the day text, the controls and the paused chip.
  const clockParts = { day: document.createElement('span'), ctl: document.createElement('span'), chip: document.createElement('span') };
  clockParts.day.className = 'day'; clockParts.ctl.className = 'ctl'; clockParts.chip.className = 'chipwrap';
  clockEl.append(clockParts.day, clockParts.ctl, clockParts.chip);
  function renderClock() {
    const c = ctx.S().clock;
    const C = D.get('config.clock');
    const al = office.alerts();
    clockParts.day.textContent = U.clock.day.replace('{n}', String(Math.floor(c.day) + 1));
    const speeds = C.speeds.map((sp, i) => `<option value="${i}" ${c.speed === sp ? 'selected' : ''}>${sp === 0 ? '⏸ ' + U.clock.pause : sp + '×'}</option>`).join('');
    const noStop = !ctx.settings.get('pause_on_report');
    setHtml(clockParts.ctl, `<select class="spd" data-clk="speed" aria-label="${esc(U.clock.speed)}"${tip(U.clock.speed)}>${speeds}</select><span class="autochk"><label${tip(U.clock.auto_tip)}><input type="checkbox" data-clk="auto" ${c.auto ? 'checked' : ''}> ${esc(U.clock.auto)}</label><label${tip(U.clock.nostop_tip)}><input type="checkbox" data-clk="nostop" ${noStop ? 'checked' : ''}> ${esc(U.clock.nostop)}</label></span>`);
    setHtml(clockParts.chip, c.speed === 0 && al.home ? `<span class="chip warn pulse">${U.clock.paused_report}</span>` : '');
  }
  clockEl.addEventListener('change', (ev) => {
    const b = ev.target.closest('[data-clk]');
    if (!b) return;
    const c = ctx.S().clock;
    if (b.dataset.clk === 'speed') office.setSpeed(Number(b.value));
    else if (b.dataset.clk === 'nostop') ctx.settings.set('pause_on_report', !b.checked);
    else { c.auto = b.checked; if (c.auto && c.speed === 0) office.setSpeed(1); ctx.save(); }
    renderClock();
    renderTabs();
  });
  document.addEventListener('keydown', (ev) => {
    if (ev.code !== 'Space' || /INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    ev.preventDefault();
    office.togglePause();
    renderClock();
  });

  // ---------- tabs ----------
  function renderTabs() {
    const al = office.alerts();
    const icons = D.get('config.ui.tab_icons');
    const arrows = `<span class="navbtns"><button data-nav="-1" title="${esc(U.nav.back)}" aria-label="${esc(U.nav.back)}" ${nav.pos > 0 ? '' : 'disabled'}>◀</button><button data-nav="1" title="${esc(U.nav.forward)}" aria-label="${esc(U.nav.forward)}" ${nav.pos < nav.list.length - 1 ? '' : 'disabled'}>▶</button></span>`;
    setHtml(tabsEl, arrows + Object.entries(U.tabs).map(([k, label]) => `<button data-tab="${k}" title="${esc(label)}" aria-label="${esc(label)}" class="${st.tab === k && !st.sub ? 'on' : ''}"><span class="ic" aria-hidden="true">${icons[k]}</span><span class="tx">${esc(label)}</span>${al[k] ? `<span class="badge">${al[k]}</span>` : ''}</button>`).join(''));
  }

  // ---------- agency: employees and hiring ----------
  const favorCell = (id) => { const v = ctx.S().staff[id].favor; return `<span class="favor"${tip(U.office.favor_tip)}>♥ ${Math.round(v * 100)}<span class="fbar"><i style="width:${v * 100}%"></i></span></span>`; };
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
    const rows = hiredIds().map((id) => {
      const mine = reports().filter((d) => d.spec.staffId === id);
      return { id, name: staffName(D, id), state: staffState(id), favor: S.staff[id].favor, last: mine[0], count: mine.length };
    });
    const pk = office.perks();
    const perkText = Object.entries(pk).filter(([, v]) => v !== 0).map(([k, v]) => `${U.office.perks[k]} ${k === 'rest_cut' ? '−' : (v > 0 ? '+' : '')}${Math.round(Math.abs(v) * 100)}%`).join(' · ');
    const sec = S.secretary
      ? `<div class="muted">${U.office.secretary}${COLON}${staffLink(S.secretary)} · ${perkText || U.enc.edge_none} · ${U.office.secretary_pref}${COLON}${U.office.aims[office.secretaryAim()] || U.enc.edge_none}${S.secretaryLast ? ` <span class="chip ${S.secretaryLast.met ? '' : 'warn'}">${S.secretaryLast.met ? U.office.verdict_match : U.office.verdict_miss}</span>` : ''}</div>`
      : `<div class="muted">${U.office.secretary}${COLON}${U.office.no_secretary}</div>`;
    const n = hiredIds().length;
    const wage = `<div class="muted">${U.office.wage}${COLON}${ri(office.wageOf(n))} ${D.get('config.ui.currency_icons.funds')}${S.funds < office.wageOf(n) ? ` <span class="chip warn">${U.office.wage_unpaid}</span>` : ''}</div>`;
    return sec + wage + listbox.html({
      id: 'home_staff', rows, maxH: D.get('config.ui.box_h.home_staff'),
      cols: [
        { k: 'name', label: U.office.col_staff, w: '15%', val: (r) => r.name, cell: (r) => staffLink(r.id) },
        { k: 'traits', label: U.office.col_traits, w: '32%', cell: (r) => staffTraits(D, r.id).map(traitChip).join('') },
        { k: 'state', label: U.office.col_state, w: '9%', val: (r) => r.state, cell: (r) => `<span class="chip ${r.state === 'ready' ? '' : 'warn'}">${stateLabel()[r.state]}</span>` },
        { k: 'favor', label: U.office.col_favor, w: '10%', val: (r) => r.favor, cell: (r) => favorCell(r.id) },
        { k: 'count', label: U.office.col_history, w: '12%', val: (r) => r.count, cell: (r) => (r.last ? `${r.count} · <button class="ghost" data-act="open" data-id="${r.last.id}">${U.report.view}</button>` : `<span class="muted">${U.office.no_history}</span>`) },
        { k: 'act', label: '', w: '22%', cls: 'num', cell: (r) => `<button data-act="gift" data-id="${r.id}" ${S.funds < D.get('config.favor.gift_cost') ? 'disabled' : ''}${tip(U.office.gift_tip)}>${U.office.gift}</button> <button data-act="appoint" data-id="${r.id}" ${r.state === 'away' ? 'disabled' : ''}>${r.state === 'secretary' ? U.office.dismiss : U.office.appoint}</button> <button class="ghost" data-act="fire" data-id="${r.id}" ${r.state === 'away' || hiredIds().length <= 1 ? 'disabled' : ''}${tip(U.office.fire_tip)}>${U.office.fire}</button>` },
      ],
    });
  }

  // Candidates are shown in full before hiring: who they are, what they can do, and what each trait gives and costs.
  const regionLabel = (id) => { const r = D.get('hiring.regions').find((x) => x.id === id); return r ? (r.text[D.lang] || r.text.en) : ''; };
  function candidateHtml(c) {
    const S = ctx.S();
    const id = c.id;
    const def = D.get('staff.staff.' + id);
    const stats = ctx.backend.staffStats(id);
    const mini = statsLine(stats);
    const swatch = def.skin ? `<span class="skin" style="background:${D.get('hiring.skin_tones.' + def.skin)}"></span>` : '';
    const traits = staffTraits(D, id).map((t) => `<div class="traitline"><b>${esc(T.traits[t])}</b> <span class="pro">+ ${esc(T.trait_notes[t].pro)}</span> <span class="con">− ${esc(T.trait_notes[t].con)}</span></div>`).join('');
    return `<div class="card cand">
      <div class="row sp"><div class="candname">${swatch}<b>${staffLink(id)}</b></div><span class="muted">${esc(staffProfile(D, id))}${def.region ? ' · ' + esc(regionLabel(def.region)) : ''}</span></div>
      ${traits}
      <div class="muted">${mini}</div>
      <div class="row sp"><span class="muted">${U.office.wage}${COLON}${ri(office.wageOf(hiredIds().length))} → ${ri(office.wageOf(hiredIds().length + 1))}</span><button class="primary" data-act="hire" data-id="${id}" ${S.funds < O.hire_cost ? 'disabled' : ''}>${U.office.hire} ${O.hire_cost}</button></div>
    </div>`;
  }
  function hireHtml() {
    const S = ctx.S();
    office.ensureHire();
    const left = Math.max(0, S.hire.next - S.clock.day);
    return `<p class="muted">${U.office.hire_hint.replace('{n}', String(D.get('hiring.refresh_days')))}</p>
      <div class="grid2">${S.hire.slots.map(candidateHtml).join('')}</div>
      <p class="muted" id="hire-next">${U.office.hire_next.replace('{n}', r1(left))}</p>`;
  }

  // The figures that move with the clock sit at the right of the navigation bar on every page, as icons. The tick redraws only this.
  const resEl = document.getElementById('res');
  function resHtml() {
    const S = ctx.S();
    const I = D.get('config.ui.currency_icons');
    const home = S.energy >= O.home_cost ? `<span class="chip"${tip(U.office.reached_home)}>🏠</span>` : '';
    return `<span class="rv"${tip(U.office.funds)}>${I.funds} <b>${ri(S.funds)}</b></span>`
      + `<span class="rv"${tip(U.office.energy + COLON + U.office.home)}>${I.energy} <b>${ri(S.energy)}</b><span class="muted">/ ${O.home_cost}</span></span>${home}`;
  }

  // One table for the dispatches: the ones still out come first, with what can be done to them, then the finished ones with their report.
  function officeHtml() {
    const S = ctx.S();
    const today = S.clock.day;
    const out = S.dispatches.filter((d) => !d.claimed).map((d) => {
      const left = Math.max(0, d.readyDay - today);
      const ready = left === 0;
      const recallBtn = !ready && !d.recallRefused ? `<button data-act="recall" data-id="${d.id}"${tip(U.office.recall_tip)}>${U.office.recall}</button>` : '';
      const refused = d.recallRefused && !ready ? ` <span class="chip warn">${U.office.recall_refused}</span>` : '';
      // the stars of a trip that is not home yet are not known, so the cell shows the wait
      const status = ready ? `<span class="chip warn pulse">${U.office.pending}</span>` : `<span class="muted">⏳ ${r1(left)} ${U.report.days}</span>${refused}`;
      const acts = ready ? `<button class="primary alert" data-act="claim" data-id="${d.id}">${U.office.claim}</button>` : `${recallBtn} ${DEV ? `<button data-act="ff" data-id="${d.id}">${U.office.fast_forward}</button>` : ''}`;
      return `<tr class="outrow"><td class="num muted">${seqOf(d)}</td><td>${placeYear(d)}</td><td>${esc(placeShort(d))}</td><td>${staffLink(d.spec.staffId)}</td><td>${status}</td><td class="num">${acts}</td></tr>`;
    });
    const finished = reports();
    const shown = finished.filter((d) => st.showArchived || !d.archived);
    const done = shown.map((d) => `<tr${d.archived ? ' class="archived"' : ''}><td class="num muted">${seqOf(d)}</td><td>${placeYear(d)}</td><td>${esc(placeShort(d))}</td><td>${staffLink(d.spec.staffId)}</td><td>${starsHtml(d.stars || 0)}${d.newBest ? ` <span class="chip" ${tip(U.stars.new_best)}>↑</span>` : ''}</td><td class="num"><button class="ghost" data-act="open" data-id="${d.id}">${U.report.view}</button> <button class="ghost" data-act="${d.archived ? 'unarchive' : 'archive'}" data-id="${d.id}">${d.archived ? U.office.restore : U.office.archive}</button></td></tr>`);
    const rows = out.concat(done).join('');
    const open = finished.filter((d) => !d.archived).length;
    const bar = finished.length ? `<div class="row logbar"><button class="ghost" data-act="archiveall" ${open ? '' : 'disabled'}>${U.office.archive_all}</button><label class="check"><input type="checkbox" data-act="showarchived" ${st.showArchived ? 'checked' : ''}> ${U.office.show_archived} (${finished.length - open})</label></div>` : '';
    return `
      <div class="sec" id="home-log">${U.office.log}</div>
      ${bar}
      ${rows ? `<div class="lscroll" data-keep="log" style="max-height:${D.get('config.ui.box_h.log')}px"><table class="logtable"><thead><tr><th class="num">#</th><th>${U.report.year}</th><th>${U.report.place}</th><th>${U.office.col_staff}</th><th>${U.stars.col}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted">${finished.length ? U.office.log_empty_hidden : U.report.none}</p>`}`;
  }

  // ---------- dispatch ----------
  // Every trip that has come home from a place, newest first, from the summaries that are kept for good. A report opens while it is still stored.
  function tripsHtml(id) {
    const trips = office.tripsOf(id);
    const kept = new Set(ctx.S().dispatches.map((d) => d.id));
    const body = trips.length
      ? `<ul class="trips">${trips.map((t) => {
        const oc = t.recalled ? U.report.recalled : t.light ? U.light.outcome[t.outcome] : T.outcomes[t.outcome].name;
        const view = kept.has(t.id) ? `<button class="ghost" data-act="open" data-id="${t.id}">${U.report.view}</button>` : `<span class="muted small">${U.archive.trip_gone}</span>`;
        return `<li><span class="muted">${U.archive.trip_day.replace('{d}', t.day)}</span> ${staffLink(t.staffId)} ${starsHtml(t.stars)}${t.redeemed ? ' <span class="chip" ' + tip(U.stars.redeem) + '>♥</span>' : ''} <span class="muted">${esc(oc)}</span> ${view}</li>`;
      }).join('')}</ul>`
      : `<p class="muted">${U.archive.trips_none}</p>`;
    return `<div class="sec">${U.archive.trips} (${trips.length})</div>${body}`;
  }
  // The story of the selected place: who it is about, what the traveller can bring up with them, and what is known of it once someone has been.
  function placeFile(id) {
    const ET = T.eras[id];
    const done = office.tripsOf(id);
    const ideas = office.plotsFor(id).map((pid) => `<li>${esc(ET.plots[pid].name)}${U.fmt.paren.replace('{x}', esc(ET.plots[pid].character))}</li>`).join('');
    const head = `<div class="row sp"><h3>${esc(ET.name)}${!eraOpen(id) ? ' ' + hiddenChip() : ''}</h3><span class="muted">${esc(ET.stay)}</span></div>
      <p class="muted">${esc(ET.blurb)}</p><div class="muted">${esc(ET.protagonist)} · ${esc(ET.protagonist_role)}</div>
      <div class="muted">${U.stars.best}${COLON}${starsHtml(ctx.S().stars[id] || 0)}</div>
      <div class="muted">${U.dispatch.find_chance.replace('{p}', String(Math.round(ctx.backend.findOdds(id).p * 100)))}</div>
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
      <div class="muted">${U.dispatch.relic}${COLON}${wl('antiques:' + relicId, c.relic)}${own ? ' · ' + U.dispatch.owned : ''}</div>
      <div class="muted">${U.stars.best}${COLON}${starsHtml(ctx.S().stars[id] || 0)}</div>
      <div class="muted">${U.dispatch.find_chance.replace('{p}', String(Math.round(ctx.backend.findOdds(id).p * 100)))}</div>
      ${ev.scene ? `<div class="sec">${U.stars.points}</div><ul class="sync">${ev.scene.points.map((p) => `<li>${p.redeem ? '♡' : '☆'} ${esc(c.points[p.id])}${p.redeem ? ` <span class="chip">${U.stars.redeem}</span>` : ''}</li>`).join('')}</ul>${ev.regret ? `<p class="muted">${U.stars.regret_note}</p>` : ''}<p class="muted">${U.dispatch.scene_hint}</p>` : ''}
      <p class="muted" style="margin-top:8px">${(ev.scene ? U.dispatch.scene_note : U.dispatch.small_story).replace('{n}', String(ctx.backend.lightStay(id)))}</p>${own ? tripsHtml(id) : ''}</div></div>`;
  }

  // ---------- home: the dispatch desk under the map ----------
  function fixForm() {
    if (!visibleEras().includes(st.form.eraId)) st.form = { ...newForm(visibleEras()[0]), staffId: st.form.staffId };
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
        <div class="pr2">${staffTraits(D, id).map(traitChip).join('')}<span class="grow"></span><span class="muted">${favorCell(id)}</span></div></div>`;
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
    const overW = tot.weight > O.weight_capacity + 1e-9;
    const stState = staffState(f.staffId);
    const story = !!st.map.cat;
    // only what can be taken is listed: what is in stock, and anything already chosen
    const carryRows = story ? Object.keys(D.get('items')).filter((id) => D.get('items.' + id).scene && ((S.inv[id] || 0) > 0 || (f.items[id] || 0) > 0)).map((id) => ({ id, name: T.items[id].name, it: D.get('items.' + id), stock: S.inv[id] || 0 })) : Object.keys(e.itemBindings).filter((id) => (S.inv[id] || 0) > 0 || f.items[id] > 0).map((id) => ({ id, name: itemText(D, e.id, id).name, it: D.get('items.' + id), stock: S.inv[id] || 0 }));
    const carryBox = listbox.html({
      id: 'carry', maxH: D.get('config.ui.box_h.carry'), rows: carryRows, pinTitle: U.dispatch.carrying, empty: story ? U.dispatch.no_kit_needed : U.dispatch.no_stock,
      pinned: (r) => f.items[r.id] > 0,
      foot: `<span class="${overW ? 'delta down' : ''}">${U.dispatch.weight} ${r1(tot.weight)} / ${O.weight_capacity}</span> · <span>${U.dispatch.kit_value} ${ri(tot.cost)}</span>`,
      cols: [
        { k: 'name', label: U.shop.col_name, w: '44%', val: (r) => r.name, cell: (r) => { const tx = story ? T.items[r.id] : itemText(D, e.id, r.id); return `${wl('items:' + r.id, tx.name, `${tx.desc}\n${U.dispatch.weight} ${r.it.weight} · ${U.dispatch.cost} ${r.it.cost}${r.it.scene ? '\n' + U.dispatch.exposure + COLON + r.it.exposure : ''}`)}<div class="oneline muted">${esc(firstSentence(tx.desc))}</div>`; } },
        { k: 'stock', label: U.shop.stock, w: '16%', cls: 'num', val: (r) => r.stock, cell: (r) => r.stock },
        { k: 'qty', label: U.dispatch.carry, w: '40%', cls: 'num', cell: (r) => `<span class="stepper"><button data-act="dec" data-id="${r.id}" ${(f.items[r.id] || 0) > 0 ? '' : 'disabled'}>−</button><span class="n">${f.items[r.id] || 0}</span><button data-act="inc" data-id="${r.id}" ${(f.items[r.id] || 0) < Math.min(r.it.max, r.stock) ? '' : 'disabled'}>+</button></span>` },
      ],
    });
    const target = story ? st.map.cat : e.id;
    const open = story ? anchored('relic_' + target) : eraOpen(target);
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
  function lineChart(series, markers, ymax) {
    const CH = D.get('config.ui.chart');
    const W = CH.w, H = CH.h;
    const m = { l: CH.margin_l, r: CH.margin_r, t: CH.margin_t, b: CH.margin_b };
    const xmax = Math.max(...series.flatMap((s) => s.pts.map((p) => p[0])));
    const x = (v) => m.l + (v / xmax) * (W - m.l - m.r);
    const y = (v) => H - m.b - (v / ymax) * (H - m.t - m.b);
    let g = '';
    for (let i = 0; i <= CH.y_lines; i++) {
      const v = (ymax * i) / CH.y_lines;
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".12"/><text x="${m.l - 4}" y="${y(v) + 3}" text-anchor="end">${ri(v)}</text>`;
    }
    for (let d = 0; d <= xmax; d += Math.ceil(xmax / CH.x_labels)) g += `<text x="${x(d)}" y="${H - 6}" text-anchor="middle">${d}</text>`;
    for (const mk of markers) if (mk.x !== null && mk.x !== undefined) g += `<line x1="${x(mk.x)}" x2="${x(mk.x)}" y1="${m.t}" y2="${H - m.b}" stroke="${mk.color}" stroke-dasharray="${mk.dash || '3 3'}" opacity=".7"/>`;
    for (const s of series) g += `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} points="${s.pts.map((p) => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ')}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
  }

  // A small story has no branch to compare, so its page is short: how it went, the event itself, and the accounts.
  function lightHtml(cur) {
    const c = T.catalog[cur.eraId];
    const P = cur.paid;
    const o = cur.report.outcomeId;
    const summary = U.light.summary[o].replace('{staff}', staffName(D, cur.spec.staffId)).replace('{place}', c.place).replace('{figure}', c.figure);
    return `
      <p><button class="ghost" data-act="back">‹ ${U.report.back}</button></p>
      <div class="row sp"><h2>${staffLink(cur.spec.staffId)} · ${esc(c.name)}</h2><span class="stamp">${esc(U.light.outcome[o])}</span></div>
      <p style="font-size:16px">${esc(summary)}</p>
      <div class="quote">${esc(c.story)}<div class="muted" style="font-family:inherit;font-size:12px">${U.fmt.dash}${esc(c.figure)}</div></div>
      <div class="sec">${U.stars.points}</div>${pointsHtml(cur, (id) => (D.get('catalog.events').find((x) => x.id === cur.eraId).scene ? c.points[id] : U.light.points[id]))}${cur.report.found ? `<p class="warnline">${U.light.found[cur.report.found]}</p>` : ''}
      <div class="sec">${U.report.accounts}</div>
      <table><tbody>
        <tr><td>${U.stars.col}</td><td class="num">${starsHtml(cur.stars || 0)}${cur.newBest ? ' ' + U.stars.new_best : ''}</td></tr>
        <tr><td>${U.report.funds_gain}</td><td class="num">+${ri(P.funds)}</td></tr>
        <tr><td>${U.report.energy_gain}</td><td class="num">+${ri(P.energy)}</td></tr>
        <tr><td>${U.report.antique_gain}</td><td class="num">${P.antique ? `${wl('antiques:' + P.antique, T.antiques[P.antique].name)}${P.duplicate ? ' · ' + U.report.antique_dup : ''}` : U.report.antique_none}</td></tr>
        <tr><td>${U.report.rest}</td><td class="num">${P.restDays} ${U.report.days}</td></tr>
      </tbody></table>
      <p class="muted">${U.light.note}</p>`;
  }

  // A recalled trip has no ending to read. It says where it stopped and what came back.
  function recalledHtml(cur) {
    const P = cur.paid;
    return `
      <p><button class="ghost" data-act="back">‹ ${U.report.back}</button></p>
      <div class="row sp"><h2>${staffLink(cur.spec.staffId)} · ${esc(placeName(cur))}</h2><span class="stamp">${U.report.recalled}</span></div>
      <p style="font-size:16px">${U.report.recalled_text.replace('{day}', String(Math.floor(cur.recallDay) + 1)).replace('{p}', String(Math.round(P.share * 100)))}</p>
      <div class="sec">${U.report.accounts}</div>
      <table><tbody>
        <tr><td>${U.report.funds_gain}</td><td class="num">+${ri(P.funds)}</td></tr>
        <tr><td>${U.report.energy_gain}</td><td class="num">+${ri(P.energy)}</td></tr>
        <tr><td>${U.report.antique_gain}</td><td class="num">${P.antique ? `${wl('antiques:' + P.antique, T.antiques[P.antique].name)}${P.duplicate ? ' · ' + U.report.antique_dup : ''}` : U.report.antique_none}</td></tr>
        <tr><td>${U.report.rest}</td><td class="num">${P.restDays} ${U.report.days}</td></tr>
      </tbody></table>`;
  }

  function reportHtml() {
    const cur = ctx.S().dispatches.find((d) => d.id === st.sub);
    if (!cur) return `<p class="muted">${U.report.none}</p>`;
    if (cur.recalled) return recalledHtml(cur);
    if (cur.light) return lightHtml(cur);
    const R = cur.report;
    const e = ctx.era(cur.eraId);
    const spec = cur.spec;
    const fn = (key, label, text) => {
      const open = st.opened.has(cur.id + key);
      return `<span class="fn" data-act="fn" data-key="${key}">${label}</span>${open ? `<div class="fntext">${esc(text)}</div>` : ''}`;
    };
    const varNote = (name) => {
      const v = e.vars[name];
      return `${srcLabel(v.source)}${v.note ? COLON + v.note : ''}`;
    };
    const tl = R.timeline.map((t, i) => `<li class="${t.tag || ''}${t.star ? ' star' : ''}"><div>${t.star ? '<span class="starmark">★</span> ' : ''}${t.tag ? `<span class="chip ${t.tag}">${esc(tagLabel(t.tag))}</span>` : ''}${esc(t.text)}${t.source ? fn('t' + i, '†', srcLabel(t.source)) : ''}</div></li>`).join('');
    const C = R.chart;
    const sickMax = Math.max(...C.base.map((p) => p.cases), ...C.branch.map((p) => p.cases)) * D.get('config.ui.chart.headroom');
    const deadMax = Math.max(...C.base.map((p) => p.deaths), ...C.branch.map((p) => p.deaths)) * D.get('config.ui.chart.headroom');
    const pts = (rows, k) => rows.map((p) => [p.day, p[k]]);
    const mk = [{ x: C.arrive, color: '#2f4f6f' }, { x: C.leave, color: '#2f4f6f' }, { x: C.handleBase, color: '#8a6a1f', dash: '1 3' }, { x: C.handleBranch, color: '#b3382c', dash: '5 3' }];
    const legend = `<div class="legend"><span><i style="border-color:#8a8272;border-top-style:dashed"></i>${U.report.mainline}</span><span><i style="border-color:#b3382c"></i>${U.report.this_branch}</span><span><i style="border-color:#2f4f6f;border-top-style:dotted"></i>${U.report.legend_visit}</span><span><i style="border-color:#8a6a1f;border-top-style:dotted"></i>${U.report.legend_handle_hist}</span><span><i style="border-color:#b3382c;border-top-style:dashed"></i>${U.report.legend_handle_branch}</span></div>`;
    const charts = `<div class="grid2"><div><div class="muted">${U.report.sick}</div>${lineChart([{ pts: pts(C.base, 'cases'), color: '#8a8272', dash: '5 4' }, { pts: pts(C.branch, 'cases'), color: '#b3382c' }], mk, sickMax)}</div>
      <div><div class="muted">${U.report.dead}</div>${lineChart([{ pts: pts(C.base, 'deaths'), color: '#8a8272', dash: '5 4' }, { pts: pts(C.branch, 'deaths'), color: '#b3382c' }], mk, deadMax)}</div></div>`;
    const led = R.ledger.map((l) => `<tr><td>${l.day}</td><td class="num">${ri(l.sick)}</td><td class="num">${ri(l.baseDead)}</td><td class="num">${ri(l.dead)}</td><td class="num">${ri(l.treated)}</td><td class="num">${ri(l.protected)}</td></tr>`).join('');
    const cmp = R.compare;
    const A = R.accounts;
    const vsHtml = st.vs ? vsBlock(cur) : '';
    return `
      <p><button class="ghost" data-act="back">‹ ${U.report.back}</button></p>
      <div class="row sp"><h2>${staffLink(spec.staffId)} · ${esc(T.eras[cur.eraId].name)}</h2><span class="stamp">${esc(R.outcomeName)}</span></div>
      <div class="muted">${DEV ? U.report.seed + ' ' + spec.seed + ' · ' : ''}${esc(kitText(D, spec.items, cur.eraId) || '—')}${(spec.plots || []).length ? ' · ' + spec.plots.map((p) => esc(T.eras[cur.eraId].plots[p].name)).join(SEP) : ''}</div>
      <div class="sec">${U.report.summary}</div>
      <p style="font-size:16px">${esc(R.summary)}</p><div class="quote">${U.fmt.quote.replace('{x}', esc(R.quote))}<div class="muted" style="font-family:inherit;font-size:12px">${U.fmt.dash}${esc(R.staff)}</div></div>
      <div class="sec">${U.stars.points}</div>${pointsHtml(cur, (id) => T.eras[cur.eraId].star_points[id])}
      <div class="sec">${U.report.timeline}</div><ul class="tl">${tl}</ul>
      <div class="sec">${U.report.chart}</div>${legend}${charts}
      <div class="sec">${U.report.compare}</div>
      <table><thead><tr><th></th><th class="num">${U.report.mainline}</th><th class="num">${U.report.this_branch}</th></tr></thead><tbody>
        <tr><td>${U.report.deaths}${fn('c1', '†', varNote(e.report.deaths))}</td><td class="num">${ri(cmp.deathsBase)}</td><td class="num">${ri(cmp.deathsBranch)}</td></tr>
        <tr><td>${U.report.sick}${U.report.cumulative}${fn('c2', '†', varNote(e.report.cases))}</td><td class="num">${ri(cmp.casesBase)}</td><td class="num">${ri(cmp.casesBranch)}</td></tr>
        <tr><td>${esc(T.eras[cur.eraId].handle_label)}${fn('c3', '†', varNote(e.report.handle))}</td><td class="num">${esc(cmp.handleBase)}</td><td class="num">${esc(cmp.handleBranch)}</td></tr>
        <tr><td>${U.report.treated} / ${U.report.protected}${fn('c4', '†', varNote(e.report.treated))}</td><td class="num">—</td><td class="num">${ri(cmp.treated)} / ${ri(cmp.protectedTotal)}</td></tr>
      </tbody></table>
      <div class="sec">${U.report.ledger}</div>
      <div class="scroll"><table><thead><tr><th>${U.report.day}</th><th class="num">${U.report.sick}</th><th class="num">${U.report.dead}·${U.report.mainline}</th><th class="num">${U.report.dead}·${U.report.this_branch}</th><th class="num">${U.report.treated}</th><th class="num">${U.report.protected}</th></tr></thead><tbody>${led}</tbody></table></div>
      <div class="sec">${U.report.accounts}</div>
      <table><tbody>
        <tr><td>${U.report.spent}</td><td class="num">${ri(A.cost)}</td></tr>
        <tr><td>${U.stars.col}</td><td class="num">${starsHtml(cur.stars || 0)}${cur.newBest ? ' ' + U.stars.new_best : ''}</td></tr>
        <tr><td>${U.report.funds_gain}</td><td class="num">+${ri(cur.paid.funds)}</td></tr>
        <tr><td>${U.report.energy_gain}</td><td class="num">+${ri(cur.paid.energy)}</td></tr>
        <tr><td>${U.report.antique_gain}</td><td class="num">${cur.paid && cur.paid.antique ? `${wl('antiques:' + cur.paid.antique, T.antiques[cur.paid.antique].name)}${cur.paid.duplicate ? ' · ' + U.report.antique_dup : ''}` : U.report.antique_none}</td></tr>
        <tr><td>${U.report.rest}</td><td class="num">${A.restDays} ${U.report.days}</td></tr>
      </tbody></table>
      ${R.hints.map((h) => `<div class="hint">${esc(h)}</div>`).join('')}
      <div class="row" style="margin:16px 0"><button class="primary" data-act="again" data-id="${cur.id}">${U.report.again}</button><button data-act="shareopen" data-id="${cur.id}">${U.share.button}</button><button data-act="vs">${U.report.vs_prev}</button></div>${vsHtml}
      <div class="sec">${U.report.footnotes}</div><p class="muted">† ${U.report.drilldown}</p>`;
  }

  function vsBlock(cur) {
    const older = reports().filter((d) => d.eraId === cur.eraId && d.claimedAt < cur.claimedAt)[0];
    if (!older) return `<p class="muted">${U.report.none}</p>`;
    const rows = diffRows(D, cur.eraId, { res: cur }, { res: older }).map((r) => `<tr><td>${esc(r.k)}</td><td class="num">${esc(r.b)}</td><td class="num">${esc(r.a)}</td></tr>`).join('');
    const dl = (a, b) => { const d = a - b; return `<span class="delta ${d < 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${r1(d)}</span>`; };
    return `<div class="card"><h3>${U.report.vs_title}</h3><table><thead><tr><th></th><th class="num">${U.report.prev}</th><th class="num">${U.report.this}</th></tr></thead><tbody>${rows}
      <tr><td>${U.report.deaths}</td><td class="num">${ri(older.report.compare.deathsBranch)}</td><td class="num">${ri(cur.report.compare.deathsBranch)} ${dl(cur.report.compare.deathsBranch, older.report.compare.deathsBranch)}</td></tr>
      <tr><td>${esc(T.eras[cur.eraId].handle_label)}</td><td class="num">${esc(older.report.compare.handleBranch)}</td><td class="num">${esc(cur.report.compare.handleBranch)}</td></tr>
      <tr><td>${esc(older.report.outcomeName)}</td><td class="num">→</td><td class="num">${esc(cur.report.outcomeName)}</td></tr></tbody></table></div>`;
  }

  // ---------- about ----------
  function aboutHtml() {
    const A = U.about;
    const M = D.get('config.meta');
    const link = (href, label) => `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
    // the first mention of a name on this page links to its page
    const inline = { 'Life Matters': M.links.lm, 'Care for You': M.links.care, 'Fan Shen': M.links.author, 'Mutopia Project': M.links.music };
    const linked = new Set();
    const para = (x) => {
      let h = esc(x);
      for (const [name, href] of Object.entries(inline)) if (!linked.has(name) && h.includes(name)) { linked.add(name); h = h.replace(name, link(href, name)); }
      return `<p>${h}</p>`;
    };
    const links = A.links.map((l) => link(M.links[l.id], l.label)).join(' · ');
    const secs = A.sections.map((sec, i) => `<h3 id="about-${i}">${esc(sec.h)}</h3>${sec.p.map((x, k) => para(x) + (sec.links === k ? `<p>${links}</p>` : '')).join('')}`).join('');
    const jumps = A.sections.map((sec, i) => `<a class="wl" data-act="aboutjump" data-id="about-${i}">${esc(sec.h)}</a>`).join(' · ');
    return `<div class="about">
      <div class="muted">${esc(A.version_line.replace('{app}', M.app).replace('{v}', M.version).replace('{date}', M.released))}</div>
      <p class="jumps">${jumps}</p>
      ${secs}</div>`;
  }

  // ---------- home ----------
  function homeHtml() {
    const H = U.home;
    fixForm();
    return `
      <p class="lead" style="margin-top:0">${esc(H.lead)}</p>
      ${jumpBar([['home-map', U.dispatch.era], ['home-desk', U.dispatch.staff], ['home-log', U.office.log]])}
      <div class="sec" id="home-map">${U.dispatch.era}</div><p class="muted">${U.dispatch.pick_map}</p>
      ${worldMap.html()}
      ${worldMap.eventsBox()}
      ${deskHtml()}
      ${officeHtml()}`;
  }

  // ---------- render ----------
  let viewHtml = null;
  function render(fromTick) {
    office.ensureHire();
    renderTabs();
    const html = st.sub ? (st.share ? share.html(share.dispatch(st.sub)) : reportHtml()) : { home: homeHtml, shop: () => shop.html({ staff: staffBoxHtml(), hire: hireHtml() }), enc: wiki.html, settings: settingsPage.html, about: aboutHtml }[st.tab]();
    const key = st.sub ? 'sub:' + st.sub + (st.share ? ':share' : '') : st.tab;
    if (fromTick === true && html === viewHtml && key === st.lastKey) return;
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
    if (st.sub && st.share) share.draw(share.dispatch(st.sub));
    st.lastKey = key;
    navCommit();
    renderTabs();
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
    st.sub = null;
    st.form.plots = [];
    renderClock();
    render();
  }

  function claim(id) {
    const d = office.claim(id);
    if (!d) return;
    ctx.audio.sfx('back');
    st.sub = id;
    st.back = 'home';
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

  view.addEventListener('click', (ev) => {
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
    else if (act === 'ff') { const d = ctx.S().dispatches.find((x) => x.id === id); d.readyDay = ctx.S().clock.day; ctx.save(); render(); }
    else if (act === 'gift') { office.gift(id); render(); }
    else if (act === 'appoint') { office.appoint(id); renderClock(); render(); }
    else if (act === 'recall') { const r = office.recall(id); if (r.ok) { st.back = st.tab; st.sub = id; st.vs = false; st.share = false; } renderClock(); render(); }
    else if (act === 'showarchived') { st.showArchived = !st.showArchived; render(); }
    else if (act === 'archive') { office.archive([id]); render(); }
    else if (act === 'unarchive') { office.unarchive([id]); render(); }
    else if (act === 'archiveall') { office.archive(reports().filter((d) => !d.archived).map((d) => d.id)); render(); }
    else if (act === 'open') { st.back = st.tab; st.sub = id; st.vs = false; st.share = false; render(); }
    else if (act === 'fire') { office.dismiss(id); render(); }
    else if (act === 'hire') { if (office.hire(id)) ctx.audio.sfx('coin'); render(); }
    else if (act === 'wiki') { wiki.go(id); if (st.tab === 'enc' && !st.sub) wiki.refresh(); else { st.tab = 'enc'; st.sub = null; render(); } }
    else if (act === 'wikitag') { st.wiki.tag = id; wiki.refresh(); }
    else if (act === 'wikiback') { wiki.move(-1); wiki.refresh(); }
    else if (act === 'wikifwd') { wiki.move(1); wiki.refresh(); }
    else if (act === 'lsort') { listbox.sort(id); render(); }
    else if (act === 'pickstaff') { if (staffState(id) === 'ready') { st.form.staffId = id;  } render(); }
    else if (act.startsWith('map')) { if (worldMap.act(act, id)) render(); }
    else if (['shoptag', 'cartinc', 'cartdec', 'cartclear', 'cartbuy', 'shopsell', 'antsell', 'antlock', 'sellspares'].includes(act)) { if (shop.act(act, id)) { if (['cartbuy', 'shopsell', 'antsell', 'sellspares'].includes(act)) ctx.audio.sfx('coin'); render(); } }
    else if (act === 'aboutjump') { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    else if (act === 'shareopen') { st.share = true; render(); }
    else if (act === 'shareback') { st.share = false; render(); }
    else if (act === 'sharesave') share.save();
    else if (act === 'sharecopy') share.copy(share.dispatch(st.sub));
    else if (act === 'sharenative') share.send(share.dispatch(st.sub));
    else if (act === 'musictoggle') ctx.audio.toggle();
    else if (act === 'sfxtry') ctx.audio.sfx(id);
    else if (act === 'saveexport') settingsPage.exportSave();
    else if (act === 'settingsreset') { ctx.settings.reset(); render(); }
    else if (act === 'go') { st.tab = id; st.sub = null; render(); }
    else if (act === 'back') { st.sub = null; st.share = false; st.tab = st.back; render(); }
    else if (act === 'vs') { st.vs = !st.vs; render(); }
    else if (act === 'fn') { const k = st.sub + b.dataset.key; if (st.opened.has(k)) st.opened.delete(k); else st.opened.add(k); render(); }
    else if (act === 'yaml') { st.modelYaml = !st.modelYaml; render(); }
    else if (act === 'again') {
      const d = ctx.S().dispatches.find((x) => x.id === id);
      const fresh = newForm(d.eraId);
      st.form = { ...fresh, staffId: d.spec.staffId, items: Object.fromEntries(Object.entries(d.spec.items).map(([k, n]) => [k, Math.min(n, ctx.S().inv[k] || 0)])), seed: DEV ? d.spec.seed : fresh.seed };
      
      st.sub = null;
      st.tab = 'home';
      render();
    } else if (act === 'reset') { if (confirm(U.settings.data.reset_confirm)) { ctx.reset(); st.sub = null; render(); } }
  });
  view.addEventListener('toggle', (ev) => {
    const t = ev.target;
    if (!t.matches) return;
    if (t.matches('details.wcat')) st.wiki.openCats[t.dataset.cat] = t.open;
    else if (t.matches('#wiki-tags details.tagfold')) st.wiki.tagOpen = t.open;
    else if (t.matches('#map-tags details.tagfold')) st.map.tagOpen = t.open;
  }, true);
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
  view.addEventListener('input', (ev) => {
    const t = ev.target;
    if (settingsPage.onInput(ev)) return;
    if (t.id === 'wiki-q') wiki.onInput(t.value);
    else if (worldMap.onInput(t)) { /* partial refresh done by the map */ }
    else if (shop.onInput(t)) render();
  });
  view.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.id === 'lang') { changeLang(t.value); return; }
    if (settingsPage.onInput(ev)) return;
    if (t.id === 'map-star') { worldMap.onInput(t); render(); return; }
    if (t.dataset.act === 'saveimport' && t.files && t.files[0]) { settingsPage.importSave(t.files[0]).then((okk) => { if (okk) { st.sub = null; render(); } }); return; }
    if (t.name === 'staff') { if (staffState(t.value) === 'ready') { st.form.staffId = t.value;  } render(); }
    else if (t.id === 'seed') { st.form.seed = Number(t.value) || 1;  }
  });
  window.addEventListener('popstate', (ev) => {
    const n = ev.state && ev.state.sid === nav.sid ? ev.state.n : null;
    if (n === null || !nav.list[n]) return;
    nav.pos = n;
    const s = nav.list[n];
    st.tab = s.tab; st.sub = s.sub && ctx.S().dispatches.some((d) => d.id === s.sub) ? s.sub : null; st.share = !!(st.sub && s.share); st.back = s.back;
    render();
  });
  tabsEl.addEventListener('click', (ev) => {
    const nb = ev.target.closest('[data-nav]');
    if (nb) { navStep(Number(nb.dataset.nav)); return; }
    const b = ev.target.closest('[data-tab]');
    if (!b) return;
    st.tab = b.dataset.tab;
    st.sub = null;
    st.share = false;
    render();
  });

  function tick() {
    const fresh = office.advance(D.get('config.ui.refresh_ms') / 1000);
    if (fresh.length) ctx.audio.sfx('ready');
    if (ctx.S().clock.auto) office.autoStep();
    if (pressed) return;
    renderClock();
    renderTabs();
    const transit = ctx.S().dispatches.some((d) => !d.claimed);
    // Redrawing the page replaces the box someone is typing in and loses the cursor, so the page waits while a field has the focus.
    const ae = document.activeElement;
    const typing = !!ae && view.contains(ae) && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
    if ((fresh.length || ctx.S().clock.auto || transit) && st.tab === 'home' && !st.sub && !typing) render(true);
    setHtml(resEl, resHtml());
  }
  const quotes = createQuotes(D, document.getElementById('quote'));
  quotes.start();
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
  ctx.audio.onChange(() => { renderMusic(); if (st.tab === 'settings' && !st.sub && !pressed) render(true); });
  let started = false;
  document.addEventListener('pointerdown', () => {
    if (started) return;
    started = true;
    if (ctx.settings.get('music_autostart') && !ctx.audio.state.playing) ctx.audio.play(0);
  }, { once: true });
  renderMusic();
  renderClock();
  setHtml(resEl, resHtml());
  return { render, tick, state: st, office, X };
}
