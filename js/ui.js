import * as sim from './sim.js';
import { buildReport, diffRows, kitText, staffName, staffTraits, itemText, stratText, firstSentence } from './narrate.js';
import { createWiki } from './wiki.js';
import { createShop } from './shop.js';
import { createWorldMap } from './worldmap.js';
import { createListbox } from './listbox.js';
import { createOffice } from './office.js';

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
  const langSel = document.getElementById('lang');
  const I = D.get('config.i18n');
  const UI_KEY = 'teleporter_ui_state';
  let savedLang = null;
  try { savedLang = localStorage.getItem(I.storage_key); } catch (e) { /* storage blocked */ }
  const urlLang = new URLSearchParams(location.search).get('lang');
  const chosen = urlLang && urlLang in I.locales ? urlLang : (savedLang && savedLang in I.locales ? savedLang : I.auto);
  langSel.setAttribute('aria-label', U.lang.label);
  langSel.innerHTML = `<option value="${I.auto}" ${chosen === I.auto ? 'selected' : ''}>${esc(U.lang.auto)}</option>` + Object.entries(I.locales).map(([code, name]) => `<option value="${code}" ${chosen === code ? 'selected' : ''}>${esc(name)}</option>`).join('');
  langSel.addEventListener('change', () => {
    try {
      if (langSel.value === I.auto) localStorage.removeItem(I.storage_key); else localStorage.setItem(I.storage_key, langSel.value);
    } catch (e) { /* storage blocked */ }
    saveUiState();
    const u = new URL(location.href);
    u.searchParams.delete('lang');
    location.href = u.toString();
  });
  document.getElementById('logo').textContent = U.logo;
  document.getElementById('title').textContent = U.title;
  document.getElementById('subtitle').textContent = U.subtitle;

  const devParam = new URLSearchParams(location.search).get('dev');
  const DEV = devParam === null ? D.get('config.ui.dev_mode') : devParam === '1';
  const st = { tab: 'home', sub: null, back: 'home', vs: false, opened: new Set(), form: null, suggest: null, searching: false, shop: { q: '', tag: '' }, cart: {}, sort: {}, scrollY: {}, lastKey: null, wiki: { q: '', tag: '', cur: null, hist: [], pos: -1, openCats: {}, tagOpen: false }, map: null };

  const eraList = () => D.get('config.eras');
  const E = () => ctx.era(st.form.eraId);

  const antiqueDefs = () => D.get('antiques.antiques');
  const owns = (id) => ctx.S().antiques.includes(id);
  const anchorOf = (eraId) => Object.keys(antiqueDefs()).find((id) => antiqueDefs()[id].era === eraId);
  const eraOpen = (eraId) => owns(anchorOf(eraId));
  const visibleEras = () => eraList().filter((id) => DEV || eraOpen(id));
  const hiredIds = () => Object.keys(D.get('staff.staff')).filter((id) => ctx.S().staff[id].hired);
  function isUnlocked(rule) {
    if (rule === 'always') return true;
    if ('era' in rule) return eraOpen(rule.era) || ctx.S().dispatches.some((d) => d.eraId === rule.era);
    if ('antique' in rule) return owns(rule.antique);
    if ('trait' in rule) return hiredIds().some((id) => staffTraits(D, id).includes(rule.trait));
    if ('staff' in rule) return hiredIds().includes(rule.staff);
    if ('item' in rule) return D.get('items.' + rule.item + '.playable') || (ctx.S().inv[rule.item] || 0) > 0;
    throw new Error('未知解锁条件');
  }
  const hiddenChip = () => `<span class="chip warn">${U.enc.hidden}</span>`;

  function newForm(eraId) {
    const e = ctx.era(eraId);
    return {
      eraId, plots: [], staffId: hiredIds()[0],
      items: Object.fromEntries(Object.keys(e.itemBindings).map((k) => [k, 0])),
      seed: Math.floor(Math.random() * 100000) + 1,
    };
  }

  // ---------- helpers ----------
  const staffState = (id) => office.staffState(id);
  const totals = () => sim.itemTotals(D, st.form.items);
  const formSpec = () => ({ seed: Number(st.form.seed) || 1, staffId: st.form.staffId, items: { ...st.form.items }, plots: [...st.form.plots] });
  const srcLabel = (src) => ({ historical: U.report.source_historical, lm_model: U.report.source_lm, game_assumption: U.report.source_game, calibrated: U.report.source_calibrated }[src]);
  const tagLabel = (tag) => U.report[tag];
  const reports = () => ctx.S().dispatches.filter((d) => d.claimed).sort((a, b) => b.claimedAt - a.claimedAt);
  const tip = (text) => ` data-tip="${esc(text)}"`;
  const wl = (id, label, tipText) => `<a class="wl" data-act="wiki" data-id="${esc(id)}"${tipText ? tip(tipText) : ''}>${esc(label)}</a>`;
  function traitTip(t) {
    const tr = D.get('staff.traits.' + t);
    const mods = Object.entries(tr.mods).map(([k, v]) => `${T.stats[k]} ${v > 0 ? '+' : ''}${v}`).join(SEP);
    const pol = Object.entries(tr.policy || {}).map(([grp, key]) => `${U.dispatch[grp]}${COLON}${T.strategies[grp][key].name}`).join('${U.fmt.semi}');
    const pref = tr.prefer ? `${U.office.secretary_pref}${COLON}${U.office.aims[tr.prefer]}` : '';
    return [T.traits[t], mods, pol, pref].filter(Boolean).join('\n');
  }
  function staffTip(id) {
    const stats = sim.staffStats(D, id);
    const mini = Object.keys(T.stats).map((k) => `${T.stats[k]} ${r1(stats[k])}`).join(' · ');
    return [T.staff[id].bio, staffTraits(D, id).map((t) => T.traits[t]).join(SEP), mini].join('\n');
  }
  const staffLink = (id) => wl('staff:' + id, staffName(D, id), staffTip(id));
  const traitChip = (t) => `<a class="chip tr" data-act="wiki" data-id="traits:${t}"${tip(traitTip(t))}>${esc(T.traits[t])}</a>`;
  const recordRow = (d, withStaff) => `<tr><td>${withStaff ? staffLink(d.spec.staffId) : esc(T.eras[d.eraId].short)}</td><td>${esc(d.report.outcomeName)}</td><td class="num">${r1(d.report.accounts.lives)}</td><td><button class="ghost" data-act="open" data-id="${d.id}">›</button></td></tr>`;
  function selectEra(id) {
    if (st.form.eraId !== id) { st.form = { ...newForm(id), staffId: st.form.staffId }; st.suggest = null; }
  }
  const X = { D, ctx, T, U, O, DEV, st, esc, r1, ri, srcLabel, isUnlocked, visibleEras, eraOpen, selectEra, wl, tip, anchorOf };
  const office = createOffice(X);
  const clockEl = document.getElementById('clock');
  X.listbox = createListbox(X);
  const listbox = X.listbox;
  const wiki = createWiki(X);
  const shop = createShop(X);
  const worldMap = createWorldMap(X);
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
  function renderClock() {
    const c = ctx.S().clock;
    const C = D.get('config.clock');
    const al = office.alerts();
    const speeds = C.speeds.map((sp, i) => `<button class="spd ${c.speed === sp ? 'on' : ''}" data-clk="speed" data-i="${i}" title="${sp === 0 ? U.clock.pause : sp + '×'}">${sp === 0 ? '⏸' : sp + '×'}</button>`).join('');
    clockEl.innerHTML = `<span class="day">${U.clock.day.replace('{n}', String(Math.floor(c.day) + 1))}</span>${speeds}<button class="auto ${c.auto ? 'on' : ''}" data-clk="auto"${tip(U.clock.auto_tip)}>${U.clock.auto}</button>${c.speed === 0 && al.home ? `<span class="chip warn pulse">${U.clock.paused_report}</span>` : ''}`;
  }
  clockEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-clk]');
    if (!b) return;
    const c = ctx.S().clock;
    if (b.dataset.clk === 'speed') office.setSpeed(Number(b.dataset.i));
    else { c.auto = !c.auto; if (c.auto && c.speed === 0) office.setSpeed(1); ctx.save(); }
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
    tabsEl.innerHTML = Object.entries(U.tabs).map(([k, label]) => `<button data-tab="${k}" class="${st.tab === k && !st.sub ? 'on' : ''}">${esc(label)}${al[k] ? `<span class="badge">${al[k]}</span>` : ''}</button>`).join('');
  }

  // ---------- office ----------
  function officeHtml() {
    const S = ctx.S();
    const today = ctx.S().clock.day;
    const pct = Math.min(100, (S.energy / O.home_cost) * 100);
    const stateLabel = { ready: U.office.ready, away: U.office.away, resting: U.office.resting, secretary: U.office.secretary_state };
    const favorCell = (id) => { const f = S.staff[id].favor; return `<span class="favor"${tip(U.office.favor_tip)}>♥ ${Math.round(f * 100)}<span class="fbar"><i style="width:${f * 100}%"></i></span></span>`; };
    const staffRows = Object.keys(D.get('staff.staff')).map((id) => {
      const hired = S.staff[id].hired;
      const mine = reports().filter((d) => d.spec.staffId === id);
      return { id, hired, name: hired ? staffName(D, id) : U.office.unknown_candidate, state: hired ? staffState(id) : 'recruit', favor: hired ? S.staff[id].favor : 0, last: mine[0], count: mine.length, cls: hired ? '' : 'dim' };
    });
    const staffBox = listbox.html({
      id: 'home_staff', rows: staffRows, maxH: 260,
      cols: [
        { k: 'name', label: U.office.col_staff, w: '17%', val: (r) => r.name, cell: (r) => (r.hired ? staffLink(r.id) : `${r.name}${DEV ? ' ' + hiddenChip() + ' ' + esc(staffName(D, r.id)) : ''}`) },
        { k: 'traits', label: U.office.col_traits, w: '25%', cell: (r) => (r.hired ? staffTraits(D, r.id).map(traitChip).join('') : `<span class="muted">${U.office.recruit_hint_short}</span>`) },
        { k: 'state', label: U.office.col_state, w: '10%', val: (r) => r.state, cell: (r) => (r.hired ? `<span class="chip ${r.state === 'ready' ? '' : 'warn'}">${stateLabel[r.state]}</span>` : `<span class="chip warn">${U.office.recruit}</span>`) },
        { k: 'favor', label: U.office.col_favor, w: '12%', val: (r) => r.favor, cell: (r) => (r.hired ? favorCell(r.id) : '') },
        { k: 'count', label: U.office.col_history, w: '16%', val: (r) => r.count, cell: (r) => (r.last ? `${r.count} · <button class="ghost" data-act="open" data-id="${r.last.id}">${esc(r.last.report.outcomeName)} ›</button>` : (r.hired ? `<span class="muted">${U.office.no_history}</span>` : '')) },
        { k: 'act', label: '', w: '20%', cls: 'num', cell: (r) => (r.hired
          ? `<button data-act="gift" data-id="${r.id}" ${S.funds < D.get('config.favor.gift_cost') ? 'disabled' : ''}${tip(U.office.gift_tip)}>${U.office.gift}</button> <button data-act="appoint" data-id="${r.id}" ${r.state === 'away' ? 'disabled' : ''}>${r.state === 'secretary' ? U.office.dismiss : U.office.appoint}</button>`
          : `<button data-act="hire" data-id="${r.id}" ${S.funds < O.hire_cost ? 'disabled' : ''}>${U.office.hire} ${O.hire_cost}</button>`) },
      ],
    });
    const pk = office.perks();
    const perkText = Object.entries(pk).filter(([, v]) => v !== 0).map(([k, v]) => `${U.office.perks[k]} ${k === 'rest_cut' ? '−' : (v > 0 ? '+' : '')}${Math.round(Math.abs(v) * 100)}%`).join(' · ');
    const secLine = S.secretary
      ? `<div class="muted">${U.office.secretary}${COLON}${staffLink(S.secretary)} · ${perkText || U.enc.edge_none} · ${U.office.secretary_pref}${COLON}${U.office.aims[office.secretaryAim()] || U.enc.edge_none}${S.secretaryLast ? ` <span class="chip ${S.secretaryLast.met ? '' : 'warn'}">${S.secretaryLast.met ? U.office.verdict_match : U.office.verdict_miss}</span>` : ''}</div>`
      : `<div class="muted">${U.office.secretary}${COLON}${U.office.no_secretary}</div>`;
    const stages = D.get('mainline.stages');
    const sIdx = office.stageIndex();
    const stageRows = stages.map((g, i) => {
      const tx = T.mainline[g.id];
      if (i > sIdx + 1) return `<li class="dim">${U.enc.locked_name}</li>`;
      return `<li class="${i < sIdx ? 'done' : i === sIdx ? 'cur' : 'dim'}"><b>${esc(tx.name)}</b> <span class="muted">${g.energy} ${U.office.energy} · ${esc(tx.desc)}</span></li>`;
    }).join('');
    const open = S.dispatches.filter((d) => !d.claimed);
    const openHtml = open.length ? open.map((d) => {
      const left = Math.max(0, d.readyDay - today);
      const ready = left === 0;
      return `<div class="card row sp"><div><b>${staffLink(d.spec.staffId)}</b> · ${esc(T.eras[d.eraId].name)}<div class="muted">${ready ? U.office.pending : U.office.eta + ' ' + r1(left) + ' ' + U.report.days}</div></div>
        <div class="row">${ready ? `<button class="primary alert" data-act="claim" data-id="${d.id}">${U.office.claim}</button>` : `<button data-act="ff" data-id="${d.id}">${U.office.fast_forward}</button>`}</div></div>`;
    }).join('') : `<p class="muted">${U.office.nothing}</p>`;
    const done = reports().slice(0, 8).map((d) => `<tr><td>${staffLink(d.spec.staffId)}</td><td>${esc(T.eras[d.eraId].short)}</td><td>${esc(d.report.outcomeName)}</td><td class="num">${r1(d.report.accounts.lives)}</td><td><button class="ghost" data-act="open" data-id="${d.id}">›</button></td></tr>`).join('');
    return `
      <div class="grid2">
        <div class="card"><div class="muted">${U.office.funds}</div><div class="stat">${ri(S.funds)}</div></div>
        <div class="card"><div class="muted">${U.office.energy}</div><div class="stat">${ri(S.energy)} <span class="muted" style="font-size:13px">/ ${O.home_cost}</span></div>
          <div class="bar ${pct >= 100 ? 'ok' : ''}"><i style="width:${pct}%"></i></div><div class="muted">${U.office.home}${pct >= 100 ? ' · ' + U.office.reached_home : ''}</div></div>
      </div>
      <div class="sec">${U.office.mainline}</div><ul class="stages">${stageRows}</ul>
      <div class="sec">${U.office.staff}</div>${secLine}${staffBox}
      <div class="sec">${U.office.transit}</div>${openHtml}
      <div class="sec">${U.office.recent}</div>
      ${done ? `<table><tbody>${done}</tbody></table>` : `<p class="muted">${U.report.none}</p>`}
      <p style="margin-top:24px"><button class="ghost danger" data-act="reset">${U.office.reset}</button></p>`;
  }

  // ---------- dispatch ----------
  function placeFile(id) {
    const ET = T.eras[id];
    const done = reports().filter((d) => d.eraId === id);
    const head = `<div class="row sp"><h3>${esc(ET.name)}${!eraOpen(id) ? ' ' + hiddenChip() : ''}</h3><span class="muted">${esc(ET.stay)}</span></div>
      <p class="muted">${esc(ET.blurb)}</p><div class="muted">${esc(ET.protagonist)} · ${esc(ET.protagonist_role)}</div>`;
    if (!done.length) return `<div class="lbox"><div class="lscroll pad" data-keep="placefile" style="max-height:200px">${head}<p class="muted" style="margin-top:8px">${U.archive.sealed}</p><div class="muted">${U.dispatch.no_records_here}</div></div></div>`;
    const hist = ET.encyclopedia.history.map((h) => `<li>${esc(h.text)}${h.check ? ` <span class="chip warn">${U.archive.check_pending}</span>` : ''}</li>`).join('');
    const reg = ET.encyclopedia.regret.map((h) => `<li>${esc(h)}</li>`).join('');
    const rows = done.map((d) => recordRow(d, true)).join('');
    return `<div class="lbox"><div class="lscroll pad" data-keep="placefile" style="max-height:200px">${head}<div class="sec">${U.archive.history}</div><ul>${hist}</ul><div class="sec">${U.archive.regret}</div><ul>${reg}</ul>
      <div class="sec">${U.dispatch.records_here}</div><table><tbody>${rows}</tbody></table></div></div>`;
  }

  function dispatchHtml() {
    if (!visibleEras().includes(st.form.eraId)) st.form = { ...newForm(visibleEras()[0]), staffId: st.form.staffId };
    if (!hiredIds().includes(st.form.staffId)) st.form.staffId = hiredIds()[0];
    const f = st.form;
    if (staffState(f.staffId) !== 'ready') {
      const free = hiredIds().find((id) => staffState(id) === 'ready');
      if (free) f.staffId = free;
    }
    const e = E();
    const tot = totals();
    const S = ctx.S();
    const overW = tot.weight > O.weight_capacity + 1e-9;
    const stState = staffState(f.staffId);
    const staffBox = listbox.html({
      id: 'pick_staff', maxH: 200, pinTitle: U.dispatch.chosen_staff,
      rows: hiredIds().map((id) => ({ id, name: staffName(D, id), state: staffState(id) })),
      pinned: (r) => r.id === f.staffId,
      cols: [
        { k: 'name', label: U.office.col_staff, w: '30%', val: (r) => r.name, cell: (r) => staffLink(r.id) },
        { k: 'traits', label: U.office.col_traits, w: '40%', cell: (r) => staffTraits(D, r.id).map(traitChip).join('') },
        { k: 'state', label: U.office.col_state, w: '14%', val: (r) => r.state, cell: (r) => `<span class="chip ${r.state === 'ready' ? '' : 'warn'}">${({ ready: U.office.ready, away: U.office.away, resting: U.office.resting, secretary: U.office.secretary_state })[r.state]}</span>` },
        { k: 'act', label: '', w: '16%', cls: 'num', cell: (r) => (r.id === f.staffId ? `<span class="chip">${U.dispatch.picked}</span>` : `<button data-act="pickstaff" data-id="${r.id}" ${r.state === 'ready' ? '' : 'disabled'}>${U.dispatch.pick}</button>`) },
      ],
    });
    const carryRows = Object.keys(e.itemBindings).map((id) => ({ id, name: itemText(D, e.id, id).name, it: D.get('items.' + id), stock: S.inv[id] || 0 }));
    const carryBox = listbox.html({
      id: 'carry', maxH: 200, rows: carryRows, pinTitle: U.dispatch.carrying, empty: U.dispatch.no_stock,
      pinned: (r) => f.items[r.id] > 0,
      foot: `<span class="${overW ? 'delta down' : ''}">${U.dispatch.weight} ${r1(tot.weight)} / ${O.weight_capacity}</span> · <span>${U.dispatch.kit_value} ${ri(tot.cost)}</span>`,
      cols: [
        { k: 'name', label: U.shop.col_name, w: '42%', val: (r) => r.name, cell: (r) => { const tx = itemText(D, e.id, r.id); return `${wl('items:' + r.id, tx.name, `${tx.desc}\n${U.dispatch.weight} ${r.it.weight} · ${U.dispatch.cost} ${r.it.cost}`)}<div class="oneline muted">${esc(firstSentence(tx.desc))}</div>`; } },
        { k: 'weight', label: U.dispatch.weight, w: '14%', cls: 'num', val: (r) => r.it.weight, cell: (r) => r.it.weight },
        { k: 'stock', label: U.shop.stock, w: '12%', cls: 'num', val: (r) => r.stock, cell: (r) => r.stock },
        { k: 'qty', label: U.dispatch.carry, w: '32%', cls: 'num', cell: (r) => `<span class="stepper"><button data-act="dec" data-id="${r.id}" ${f.items[r.id] > 0 ? '' : 'disabled'}>−</button><span class="n">${f.items[r.id]}</span><button data-act="inc" data-id="${r.id}" ${f.items[r.id] < Math.min(r.it.max, r.stock) ? '' : 'disabled'}>+</button></span>` },
      ],
    });
    const ET = T.eras[e.id];
    const plotRows = Object.keys(e.plots).map((pid) => ({ id: pid, name: ET.plots[pid].name, need: e.plots[pid].tech, ok: e.plots[pid].tech <= e.tech, cls: e.plots[pid].tech <= e.tech ? '' : 'dim' }));
    const plotBox = listbox.html({
      id: 'plots', maxH: 170, rows: plotRows, pinTitle: U.dispatch.chosen_plots, pinned: (r) => f.plots.includes(r.id),
      cols: [
        { k: 'name', label: U.shop.col_name, w: '44%', val: (r) => r.name, cell: (r) => `${esc(r.name)}<div class="oneline muted">${esc(ET.plots[r.id].desc)}</div>` },
        { k: 'who', label: U.dispatch.character, w: '24%', cell: (r) => wl(ET.plots[r.id].article, ET.plots[r.id].character) },
        { k: 'tech', label: U.dispatch.tech, w: '14%', cls: 'num', val: (r) => r.need, cell: (r) => `${r.need} / ${e.tech}` },
        { k: 'act', label: '', w: '18%', cls: 'num', cell: (r) => (r.ok
          ? `<button data-act="plotpick" data-id="${r.id}" ${!f.plots.includes(r.id) && f.plots.length >= O.max_plots ? 'disabled' : ''}>${f.plots.includes(r.id) ? U.dispatch.drop : U.dispatch.pick}</button>`
          : `<span class="muted">${U.dispatch.tech_low}</span>`) },
      ],
    });
    let sug = '';
    if (st.searching) sug = `<p class="muted">${U.dispatch.searching}</p>`;
    else if (st.suggest) {
      if (!st.suggest.front.length) sug = `<p class="muted">${U.dispatch.none_found}</p>`;
      else {
        const rec = st.suggest.recommended;
        sug = `<div class="muted">${U.dispatch.suggest_front}</div><div class="scroll"><table><thead><tr><th class="num">${U.dispatch.lives}</th><th class="num">${U.dispatch.cost}</th><th>${U.dispatch.kit}</th><th></th></tr></thead><tbody>` +
          st.suggest.front.map((c, i) => `<tr style="${c === rec ? 'background:var(--paper2);font-weight:600' : ''}"><td class="num">${r1(c.lives)}</td><td class="num">${ri(c.cost)}</td><td>${esc(kitText(D, c.items, e.id) || '—')}</td><td><button data-act="use" data-i="${i}">${U.dispatch.use}</button></td></tr>`).join('') + '</tbody></table></div>';
      }
    }
    const msg = !eraOpen(e.id) ? U.dispatch.no_anchor : overW ? U.dispatch.over_weight : stState !== 'ready' ? U.dispatch.busy : '';
    const seedRow = DEV ? `<div class="sec">${U.dispatch.seed}</div><div class="row"><input id="seed" type="number" value="${f.seed}" style="width:120px"><span class="muted">${U.dispatch.seed_hint}</span></div>` : '';
    return `
      <div class="sec">${U.dispatch.era}</div><p class="muted">${U.dispatch.pick_map}</p>
      ${worldMap.html()}
      <div style="margin-top:10px">${placeFile(e.id)}</div>
      <div class="grid2" style="margin-top:12px">
        <div><div class="sec" style="margin-top:0">${U.dispatch.staff}</div>${staffBox}</div>
        <div><div class="sec" style="margin-top:0">${U.dispatch.items}</div>${carryBox}</div>
      </div>
      <div class="sec">${U.dispatch.plots}</div><p class="muted">${U.dispatch.plots_hint}</p>${plotBox}
      <div class="sec">${U.dispatch.suggest}</div><p class="muted">${U.dispatch.suggest_hint}</p>
      <div class="row"><button data-act="suggest" ${st.searching ? 'disabled' : ''}>${U.dispatch.suggest}</button><button class="ghost" data-act="clear">${U.dispatch.clear}</button></div>${sug}
      ${seedRow}
      <div class="row" style="margin:20px 0"><button class="primary" data-act="send" ${msg ? 'disabled' : ''}>${U.dispatch.send}</button><span class="delta down">${esc(msg)}</span></div>`;
  }

  // ---------- report ----------
  function lineChart(series, markers, ymax, W = 520, H = 170) {
    const m = { l: 36, r: 10, t: 10, b: 22 };
    const xmax = Math.max(...series.flatMap((s) => s.pts.map((p) => p[0])));
    const x = (v) => m.l + (v / xmax) * (W - m.l - m.r);
    const y = (v) => H - m.b - (v / ymax) * (H - m.t - m.b);
    let g = '';
    for (let i = 0; i <= 4; i++) {
      const v = (ymax * i) / 4;
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}" stroke="currentColor" opacity=".12"/><text x="${m.l - 4}" y="${y(v) + 3}" text-anchor="end">${ri(v)}</text>`;
    }
    for (let d = 0; d <= xmax; d += Math.ceil(xmax / 8)) g += `<text x="${x(d)}" y="${H - 6}" text-anchor="middle">${d}</text>`;
    for (const mk of markers) if (mk.x !== null && mk.x !== undefined) g += `<line x1="${x(mk.x)}" x2="${x(mk.x)}" y1="${m.t}" y2="${H - m.b}" stroke="${mk.color}" stroke-dasharray="${mk.dash || '3 3'}" opacity=".7"/>`;
    for (const s of series) g += `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? `stroke-dasharray="${s.dash}"` : ''} points="${s.pts.map((p) => x(p[0]).toFixed(1) + ',' + y(p[1]).toFixed(1)).join(' ')}"/>`;
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
  }

  function reportHtml() {
    const cur = ctx.S().dispatches.find((d) => d.id === st.sub);
    if (!cur) return `<p class="muted">${U.report.none}</p>`;
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
    const tl = R.timeline.map((t, i) => `<li class="${t.tag || ''}"><div>${t.tag ? `<span class="chip ${t.tag}">${esc(tagLabel(t.tag))}</span>` : ''}${esc(t.text)}${t.source ? fn('t' + i, '†', srcLabel(t.source)) : ''}</div></li>`).join('');
    const C = R.chart;
    const sickMax = Math.max(...C.base.map((p) => p.cases), ...C.branch.map((p) => p.cases)) * 1.1;
    const deadMax = Math.max(...C.base.map((p) => p.deaths), ...C.branch.map((p) => p.deaths)) * 1.1;
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
        <tr><td>${U.report.funds_gain}</td><td class="num">+${ri(A.funds)}</td></tr>
        <tr><td>${U.report.energy_gain}</td><td class="num">+${ri(A.energy)}</td></tr>
        <tr><td>${U.report.rest}</td><td class="num">${A.restDays} ${U.report.days}</td></tr>
      </tbody></table>
      ${R.hints.map((h) => `<div class="hint">${esc(h)}</div>`).join('')}
      <div class="row" style="margin:16px 0"><button class="primary" data-act="again" data-id="${cur.id}">${U.report.again}</button><button data-act="vs">${U.report.vs_prev}</button></div>${vsHtml}
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
    const secs = A.sections.map((sec) => `<h3>${esc(sec.h)}</h3>${sec.p.map((x) => `<p>${esc(x)}</p>`).join('')}`).join('');
    const links = A.links.map((l) => link(M.links[l.id], l.label)).join(' · ');
    return `<div class="about">
      <div class="hero"><span class="logo big">${esc(U.logo)}</span><div><h2>${esc(A.title)}</h2><div class="muted">${esc(A.version_line.replace('{app}', M.app).replace('{v}', M.version).replace('{date}', M.released))}</div></div></div>
      ${secs}<p>${links}</p></div>`;
  }

  // ---------- home ----------
  function homeHtml() {
    const H = U.home;
    const refs = D.get('encyclopedia.refs');
    const sources = Object.keys(refs).filter((id) => refs[id].status === 'pending').map((id) => `<li>${esc(D.get('enc_text.refs.' + id))} <span class="chip warn">${U.enc.pending}</span></li>`).join('');
    const go = Object.entries(H.go).map(([k, g]) => `<button class="gobtn" data-act="go" data-id="${k}"><b>${esc(g.name)}</b><span class="muted">${esc(g.desc)}</span></button>`).join('');
    return `
      <div class="hero"><span class="logo big">${esc(U.logo)}</span><div><h2>${esc(U.title)}</h2><div class="muted">${esc(U.subtitle)}</div></div></div>
      <p class="lead">${esc(H.lead)}</p>
      <div class="grid2" style="margin-top:12px">${go}</div>
      ${officeHtml()}
      <div class="sec">${H.mainline_title}</div><ul>${H.mainline.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
      <div class="sec">${H.materials_title}</div>
      <ul>${sources}<li>${esc(H.materials_model)}</li><li>${esc(H.materials_enc)}</li></ul>`;
  }

  // ---------- render ----------
  function render() {
    renderTabs();
    const html = st.sub ? reportHtml() : { home: homeHtml, dispatch: dispatchHtml, shop: shop.html, enc: wiki.html, about: aboutHtml }[st.tab]();
    const key = st.sub ? 'sub:' + st.sub : st.tab;
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
    if (keep) { const el = document.getElementById(keep.id); if (el) { el.focus(); try { el.setSelectionRange(keep.a, keep.b); } catch (e) { /* number inputs have no selection */ } } }
  }

  // ---------- actions ----------
  function addItem(id, dir) {
    const it = D.get('items.' + id);
    const v = st.form.items[id] + dir * it.step;
    st.form.items[id] = Math.min(it.max, ctx.S().inv[id] || 0, Math.max(0, v));
  }

  function send() {
    const d = office.launch(st.form.eraId, formSpec());
    if (!d) return;
    st.tab = 'home';
    st.sub = null;
    st.form.plots = [];
    renderClock();
    render();
  }

  function claim(id) {
    const d = office.claim(id);
    if (!d) return;
    st.sub = id;
    st.back = 'home';
    st.vs = false;
    render();
  }

  function suggest() {
    st.searching = true;
    st.suggest = null;
    render();
    setTimeout(() => {
      const e = E();
      st.suggest = sim.optimize(e, D, { spec: formSpec(), stock: ctx.S().inv });
      st.searching = false;
      render();
    }, 30);
  }

  view.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    const id = b.dataset.id;
    if (act === 'inc') { addItem(id, 1); st.suggest = null; render(); }
    else if (act === 'dec') { addItem(id, -1); st.suggest = null; render(); }
    else if (act === 'clear') { for (const k of Object.keys(st.form.items)) st.form.items[k] = 0; st.suggest = null; render(); }
    else if (act === 'suggest') suggest();
    else if (act === 'use') { Object.assign(st.form.items, st.suggest.front[Number(b.dataset.i)].items); render(); }
    else if (act === 'send') send();
    else if (act === 'claim') claim(id);
    else if (act === 'ff') { const d = ctx.S().dispatches.find((x) => x.id === id); d.readyDay = ctx.S().clock.day; ctx.save(); render(); }
    else if (act === 'gift') { office.gift(id); render(); }
    else if (act === 'appoint') { office.appoint(id); renderClock(); render(); }
    else if (act === 'plotpick') { const p = st.form.plots; if (p.includes(id)) st.form.plots = p.filter((x) => x !== id); else if (p.length < O.max_plots) p.push(id); st.suggest = null; render(); }
    else if (act === 'open') { st.back = st.tab; st.sub = id; st.vs = false; render(); }
    else if (act === 'hire') { const S = ctx.S(); if (!S.staff[id].hired && S.funds >= O.hire_cost) { S.funds -= O.hire_cost; S.staff[id].hired = true; ctx.save(); } render(); }
    else if (act === 'wiki') { wiki.go(id); if (st.tab === 'enc' && !st.sub) wiki.refresh(); else { st.tab = 'enc'; st.sub = null; render(); } }
    else if (act === 'wikitag') { st.wiki.tag = id; wiki.refresh(); }
    else if (act === 'wikiback') { wiki.move(-1); wiki.refresh(); }
    else if (act === 'wikifwd') { wiki.move(1); wiki.refresh(); }
    else if (act === 'lsort') { listbox.sort(id); render(); }
    else if (act === 'pickstaff') { if (staffState(id) === 'ready') { st.form.staffId = id; st.suggest = null; } render(); }
    else if (act.startsWith('map')) { if (worldMap.act(act, id)) render(); }
    else if (['shoptag', 'cartinc', 'cartdec', 'cartclear', 'cartbuy', 'shopsell', 'antbuy', 'antsell', 'antlock'].includes(act)) { if (shop.act(act, id)) render(); }
    else if (act === 'go') { st.tab = id; st.sub = null; render(); }
    else if (act === 'back') { st.sub = null; st.tab = st.back; render(); }
    else if (act === 'vs') { st.vs = !st.vs; render(); }
    else if (act === 'fn') { const k = st.sub + b.dataset.key; if (st.opened.has(k)) st.opened.delete(k); else st.opened.add(k); render(); }
    else if (act === 'yaml') { st.modelYaml = !st.modelYaml; render(); }
    else if (act === 'again') {
      const d = ctx.S().dispatches.find((x) => x.id === id);
      const fresh = newForm(d.eraId);
      st.form = { ...fresh, plots: [...(d.spec.plots || [])], staffId: d.spec.staffId, items: Object.fromEntries(Object.entries(d.spec.items).map(([k, n]) => [k, Math.min(n, ctx.S().inv[k] || 0)])), seed: DEV ? d.spec.seed : fresh.seed };
      st.suggest = null;
      st.sub = null;
      st.tab = 'dispatch';
      render();
    } else if (act === 'reset') { if (confirm(U.office.reset_confirm)) { ctx.reset(); st.sub = null; render(); } }
  });
  view.addEventListener('toggle', (ev) => {
    const t = ev.target;
    if (!t.matches) return;
    if (t.matches('details.wcat')) st.wiki.openCats[t.dataset.cat] = t.open;
    else if (t.matches('#wiki-tags details.tagfold')) st.wiki.tagOpen = t.open;
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
    const pad = 14;
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(4, Math.min(window.innerWidth - w - 4, ev.clientX + pad)) + 'px';
    tipEl.style.top = Math.max(4, Math.min(window.innerHeight - h - 4, ev.clientY + pad)) + 'px';
  });
  view.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.id === 'wiki-q') wiki.onInput(t.value);
    else if (worldMap.onInput(t)) { /* partial refresh done by the map */ }
    else if (shop.onInput(t)) render();
  });
  view.addEventListener('change', (ev) => {
    const t = ev.target;
    if (t.name === 'staff') { if (staffState(t.value) === 'ready') { st.form.staffId = t.value; st.suggest = null; } render(); }
    else if (t.id === 'seed') { st.form.seed = Number(t.value) || 1; st.suggest = null; }
  });
  tabsEl.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-tab]');
    if (!b) return;
    st.tab = b.dataset.tab;
    st.sub = null;
    render();
  });

  function tick() {
    const fresh = office.advance(D.get('config.ui.refresh_ms') / 1000);
    if (ctx.S().clock.auto) office.autoStep();
    renderClock();
    renderTabs();
    const transit = ctx.S().dispatches.some((d) => !d.claimed);
    if ((fresh.length || ctx.S().clock.auto || transit) && st.tab === 'home' && !st.sub) render();
  }
  renderClock();
  return { render, tick, state: st };
}
