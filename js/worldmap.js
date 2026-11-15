// World map with zoom and pan. A pin is a place, a place holds events at different times.
// The filter row and the time axis narrow the events, so a crowded map stays readable. Real coastlines: Natural Earth, public domain.
import { fmtYear } from './narrate.js';

export function createWorldMap(X) {
  const { D, ctx, T, U, DEV, esc, st } = X;
  const M = U.map;
  const V = () => D.get('map.view');
  const m = () => st.map;

  // Events are the simulated eras and the catalogue events. A catalogue event shows once its relic is owned, in dev mode always.
  const eraEvents = () => D.get('config.eras').map((id) => {
    const era = ctx.era(id).raw.metadata.era;
    return { id, year: era.year, place: era.place, geo: era.geo, locked: !X.eraOpen(id), unseen: X.eraOpen(id) && !ctx.S().visited.includes(id), catalog: false };
  });
  const catEvents = () => D.get('catalog.events').filter((e) => !e.era).map((e) => ({ id: e.id, year: e.year, geo: { lon: e.lon, lat: e.lat }, locked: !X.anchored('relic_' + e.id), catalog: true, cell: e }));
  // One pin per place. Events within a radius of each other share a pin, and the radius shrinks as you zoom in so the pins part; which takes the name of the simulated era there if there is one.
  // Only anchored places are drawn. Dev mode draws the rest too.
  const events = () => {
    const all = [...eraEvents(), ...catEvents()].filter((e) => DEV || !e.locked);
    const R = D.get('map.group_radius') / m().z;
    const clusters = [];
    for (const e of all) {
      let c = clusters.find((k) => Math.hypot(k.geo.lon - e.geo.lon, k.geo.lat - e.geo.lat) < R);
      if (!c) { c = { id: 'cell:' + e.id, geo: e.geo }; clusters.push(c); }
      // the first simulated era in the cluster, in the order of config.eras, gives the pin its name
      if (!e.catalog && !c.era) { c.id = e.place; c.era = true; }
      e.cluster = c;
    }
    for (const e of all) e.place = e.cluster.id;
    return all;
  };
  // An anchored place nobody has been to yet is a question mark on the map, with no name, place or tags, and it can still be picked and sent to.
  const info = (e) => {
    if ((e.locked || e.unseen) && !DEV) return { name: M.unknown, short: M.unknown, place: M.unknown, who: M.unknown, tags: [] };
    if (!e.catalog) {
      const ET = T.eras[e.id];
      return { name: ET.name, short: ET.short, place: ET.place_name, who: ET.protagonist, tags: ET.tags };
    }
    const c = T.catalog[e.id];
    return { name: c.name, short: c.figure, place: c.place, who: c.figure, tags: X.catalogTags(e.id) };
  };
  const evText = (e) => {
    const i = info(e);
    return [i.name, i.short, i.place, i.who, e.year, ...i.tags.map((t) => T.tags[t])].join(' ').toLowerCase();
  };
  const best = (e) => ctx.S().stars[e.id] || 0;
  const passes = (e) => {
    const s = m();
    if (s.star === 'none' && ctx.S().stars[e.id] !== undefined) return false;
    if (/^[123]$/.test(s.star) && best(e) < Number(s.star)) return false;
    if (e.year < s.from || e.year > s.to) return false;
    if (s.tag && !info(e).tags.includes(s.tag)) return false;
    const q = s.q.trim().toLowerCase();
    return !q || evText(e).includes(q);
  };
  const filtered = () => events().filter(passes);
  const places = () => {
    const out = {};
    for (const e of filtered()) (out[e.place] = out[e.place] || { id: e.place, geo: e.geo, events: [] }).events.push(e);
    return out;
  };
  const isSel = (e) => (e.catalog ? m().cat === e.id : !m().cat && st.form.eraId === e.id);

  const px = (lon) => lon - V().lon_min;
  const py = (lat) => V().lat_max - lat;
  const W = () => V().lon_max - V().lon_min;
  const H = () => V().lat_max - V().lat_min;
  function view() {
    const z = m().z;
    const w = W() / z, h = H() / z;
    const x0 = Math.min(W() - w, Math.max(0, m().cx - w / 2));
    const y0 = Math.min(H() - h, Math.max(0, m().cy - h / 2));
    return { x0, y0, w, h };
  }
  const vbAttr = () => { const v = view(); return `${v.x0.toFixed(2)} ${v.y0.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`; };

  // ---------- day and night ----------
  // The shade is the part of the map where the sun is below the horizon. The sun stands over one longitude that moves west once per game day,
  // and over a latitude (its declination) that swings through the year. The edge of the night at each longitude has a closed form:
  // tan(lat) = -cos(lon - sun_lon) / tan(declination), and the night lies on the far side of it from the sun.
  const DN = () => D.get('map.daynight');
  let phase = null; // the fraction of the day the picture shows, which stops following the clock above the speed cap
  const dayFrac = () => { const d = ctx.S().clock.day; return d - Math.floor(d); };
  function nightPath() {
    const cfg = DN(), rad = Math.PI / 180;
    if (phase == null) phase = dayFrac();
    const year = (ctx.S().clock.day % cfg.year_days) / cfg.year_days;
    let decl = cfg.tilt_deg * Math.sin(2 * Math.PI * year);
    if (Math.abs(decl) < cfg.min_decl_deg) decl = decl < 0 ? -cfg.min_decl_deg : cfg.min_decl_deg;
    const sunLon = 180 - 360 * phase;
    const pts = [];
    const pad = cfg.pad_deg;
    for (let lon = V().lon_min - pad; lon <= V().lon_max + pad + 1e-9; lon += cfg.step_deg) {
      const lat = Math.atan(-Math.cos((lon - sunLon) * rad) / Math.tan(decl * rad)) / rad;
      pts.push(`${px(lon).toFixed(2)},${py(Math.max(V().lat_min - pad, Math.min(V().lat_max + pad, lat))).toFixed(2)}`);
    }
    const edge = decl > 0 ? H() + pad : -pad;
    return `M${pts.join(' L')} L${W() + pad},${edge} L${-pad},${edge} Z`;
  }
  // called every tick: the picture follows the clock up to the cap, and the shade is redrawn in place
  let lastNight = null;
  function tickNight(dt) {
    if (!ctx.settings.get('map_daynight')) return;
    const sp = Math.min(X.office.effectiveSpeed(), DN().speed_cap);
    if (phase == null) phase = dayFrac();
    phase = (phase + (sp * dt) / D.get('config.clock').sec_per_day) % 1;
    const el = document.querySelector('svg.map .night path');
    if (el) el.setAttribute('d', nightPath());
  }

  // the shade is redrawn on its own short interval, much more often than the page, so it glides instead of stepping
  setInterval(() => {
    const now = performance.now();
    const dt = lastNight == null ? 0 : Math.min(1, (now - lastNight) / 1000);
    lastNight = now;
    tickNight(dt);
  }, D.get('map.daynight.frame_ms'));

  function svgHtml() {
    const grid = [];
    const gs = V().grid_step;
    for (let lo = Math.ceil(V().lon_min / gs) * gs; lo <= V().lon_max; lo += gs) grid.push(`<line x1="${px(lo)}" x2="${px(lo)}" y1="0" y2="${H()}"/>`);
    for (let la = Math.ceil(V().lat_min / gs) * gs; la <= V().lat_max; la += gs) grid.push(`<line x1="0" x2="${W()}" y1="${py(la)}" y2="${py(la)}"/>`);
    const shape = (poly, off) => `<polygon points="${poly.map(([lo, la]) => (px(lo) + off) + ',' + py(la)).join(' ')}"/>`;
    const land = D.get('world').map((poly) => shape(poly, 0) + (Math.min(...poly.map((q) => q[0])) < V().lon_min ? shape(poly, 360) : '')).join('');
    const pins = Object.values(places()).map((p) => {
      const lock = p.events.every((e) => e.locked);
      const bs = Math.max(...p.events.map(best));
      const name = info(p.events.find((e) => !e.catalog) || p.events[0]).place;
      return `<g class="pt ${lock ? 'locked' : ''} star${bs}" data-act="mapplace" data-id="${esc(p.id)}" transform="translate(${px(p.geo.lon).toFixed(2)} ${py(p.geo.lat).toFixed(2)})"><g class="pin" style="transform: scale(var(--inv))"><rect class="hit" x="-3" y="-3" width="6" height="6"/><circle class="dot" r="2.2"/>${m().counts ? `<text class="cnt" x="0" y="-5" text-anchor="middle">${p.events.length}</text>` : ''}<text class="city" x="6" y="1.6">${esc(name)}${lock && DEV ? ' ' + U.dispatch.hidden_mark : ''}</text></g></g>`;
    }).join('');
    return `<svg class="map ${m().cities ? 'labels' : ''}" viewBox="${vbAttr()}" style="--inv:${1 / m().z}" role="img"><g class="grid">${grid.join('')}</g><g class="land">${land}</g>${ctx.settings.get('map_daynight') ? `<g class="night"><path d="${nightPath()}"/></g>` : ''}${pins}</svg>`;
  }

  function niceStep(span) {
    const target = D.get('map.axis.tick_count');
    const raw = span / target;
    const pow = 10 ** Math.floor(Math.log10(raw));
    for (const k of [1, 2, 5, 10]) if (k * pow >= raw) return k * pow;
    return 10 * pow;
  }
  function axisHtml() {
    const s = m();
    const A = D.get('map.axis');
    const TL = D.get('config.ui.timeline');
    const Wd = TL.w, pad = TL.pad, y0 = TL.y;
    // recent years are spread out, the deep past is compressed: position follows the square root of the years before the end of the range
    const L = (y) => Math.sqrt(Math.max(0, s.to - y));
    const Lmax = L(s.from);
    const x = (yr) => pad + (1 - L(yr) / Lmax) * (Wd - 2 * pad);
    let g = `<line class="ax" x1="${pad - TL.line_ext}" x2="${Wd - pad + TL.line_ext}" y1="${y0}" y2="${y0}"/>`;
    let ticks = A.ticks.filter((t) => t >= s.from && t <= s.to);
    if (ticks.length < A.min_ticks) {
      const step = niceStep(s.to - s.from);
      ticks = [];
      for (let yr = Math.ceil(s.from / step) * step; yr <= s.to; yr += step) ticks.push(yr);
    }
    for (const yr of ticks) g += `<line class="tick" x1="${x(yr)}" x2="${x(yr)}" y1="${y0 - TL.tick_half}" y2="${y0 + TL.tick_half}"/><text class="yr" x="${x(yr)}" y="${y0 + 18}" text-anchor="middle">${fmtYear(D, yr || 1)}</text>`;
    for (const e of filtered()) {
      const i = info(e);
      const on = isSel(e);
      const tipText = `${fmtYear(D, e.year)} ${i.name}`;
      const label = !e.catalog || on ? `<text x="0" y="-14" text-anchor="middle">${fmtYear(D, e.year)} ${esc(i.short)}${e.locked ? ' ' + U.dispatch.hidden_mark : ''}</text>` : '';
      g += `<g class="pt ${on ? 'on' : ''} ${e.locked ? 'locked' : ''} ${e.catalog ? 'cat' : ''}" data-act="mapevent" data-id="${e.id}" data-tip="${esc(tipText)}" transform="translate(${x(e.year).toFixed(1)} ${y0})"><rect class="hit" x="${e.catalog ? -4 : -46}" y="${e.catalog ? -8 : -28}" width="${e.catalog ? 8 : 92}" height="${e.catalog ? 16 : 44}"/><circle class="dot" r="${e.catalog ? 2.6 : 4.5}"/>${label}</g>`;
    }
    return `<svg class="axis" viewBox="0 0 ${Wd} ${TL.h}" role="img">${g}</svg>`;
  }

  // The axis is a window on the years. The wheel narrows or widens it around the year under the pointer, and dragging slides it.
  // The scale is a square root, so the year under a screen fraction f of the width satisfies to - year = (1 - f)^2 * span.
  const axisFrac = (clientX, svg) => {
    const TL = D.get('config.ui.timeline');
    const r = svg.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * TL.w;
    return Math.min(1, Math.max(0, (x - TL.pad) / (TL.w - 2 * TL.pad)));
  };
  function setWindow(to, span) {
    const s = m();
    const A = D.get('map.axis');
    const full = A.to - A.from;
    const sp = Math.min(full, Math.max(A.min_span, span));
    const t = Math.min(A.to, Math.max(A.from + sp, to));
    s.to = Math.round(t);
    s.from = Math.round(t - sp);
    const fi = document.getElementById('map-from'); if (fi) fi.value = String(s.from);
    const ti = document.getElementById('map-to'); if (ti) ti.value = String(s.to);
    const ft = document.getElementById('map-fromtxt'); if (ft) ft.textContent = fmtYear(D, s.from === 0 ? 1 : s.from);
    const tt = document.getElementById('map-totxt'); if (tt) tt.textContent = fmtYear(D, s.to === 0 ? 1 : s.to);
    refreshParts();
  }
  function axisZoom(factor, f) {
    const s = m();
    const A = D.get('map.axis');
    const span = s.to - s.from;
    const yc = s.to - (1 - f) ** 2 * span;
    const sp = Math.min(A.to - A.from, Math.max(A.min_span, span * factor));
    setWindow(yc + (1 - f) ** 2 * sp, sp);
  }
  function axisDrag(d, f) {
    const span = d.to - d.from;
    setWindow(d.yc + (1 - f) ** 2 * span, span);
  }

  // The events of a place, as the body of a pop-up: a grid of short rows, as many columns as fit. Picking one opens the dispatch pop-up.
  function placeHtml(id) {
    const p = places()[id];
    if (!p) return `<p class="muted">${M.pick_event}</p>`;
    const name = info(p.events.find((e) => !e.catalog) || p.events[0]).place;
    const items = p.events.slice().sort((a, b) => a.year - b.year).map((e) => {
      const i = info(e);
      return `<button class="evrow ${isSel(e) ? 'on' : ''}" data-act="mapevent" data-id="${e.id}"><b>${fmtYear(D, e.year)}</b> <span>${esc(i.name)}</span> ${best(e) ? X.starsHtml(best(e), e.id) : ''}${e.locked ? ' <span class="chip warn">' + U.dispatch.hidden_mark + '</span>' : ''}</button>`;
    }).join('');
    return `<h3>${esc(name)} <span class="muted">· ${p.events.length}</span></h3><div class="evgrid">${items}</div>`;
  }

  function tagBar() {
    const present = new Set();
    for (const e of events()) info(e).tags.forEach((t) => present.add(t));
    return `<details class="tagfold" ${m().tagOpen ? 'open' : ''}><summary>${M.tag_filter}${m().tag ? U.fmt.colon + esc(T.tags[m().tag]) : ''}</summary><div class="tagbar"><button class="chipbtn ${m().tag ? '' : 'on'}" data-act="maptag" data-id="">${M.all_tags}</button>${[...present].map((t) => `<button class="chipbtn ${m().tag === t ? 'on' : ''}" data-act="maptag" data-id="${t}">${esc(T.tags[t])}</button>`).join('')}</div></details>`;
  }

  function html() {
    const s = m();
    const help = `${U.dispatch.pick_map} ${M.drag_hint}`;
    const panel = s.filterOpen ? `<div class="fpanel">
        <span class="muted">${M.from}</span><input id="map-from" type="number" value="${s.from}" style="width:80px"><span class="muted" id="map-fromtxt">${fmtYear(D, s.from === 0 ? 1 : s.from)}</span><span class="muted">${M.to}</span><input id="map-to" type="number" value="${s.to}" style="width:80px"><span class="muted" id="map-totxt">${fmtYear(D, s.to === 0 ? 1 : s.to)}</span>
        <span class="muted">${U.stars.filter}</span><select id="map-star"><option value="" ${s.star === '' ? 'selected' : ''}>${U.stars.f_all}</option><option value="none" ${s.star === 'none' ? 'selected' : ''}>${U.stars.f_none}</option><option value="1" ${s.star === '1' ? 'selected' : ''}>★ ${U.stars.f_up}</option><option value="2" ${s.star === '2' ? 'selected' : ''}>★★ ${U.stars.f_up}</option><option value="3" ${s.star === '3' ? 'selected' : ''}>★★★</option></select>
        <div id="map-tags" style="flex:1 1 100%">${tagBar()}</div></div>` : '';
    return `
      <div class="mapbar"><input id="map-q" type="search" placeholder="${M.events_filter_ph}" value="${esc(s.q)}">
        <button class="ghost" data-act="mapfilter">${M.more_filters} ${s.filterOpen ? '▾' : '▸'}</button>
        <label class="check"><input type="checkbox" id="map-cities" ${s.cities ? 'checked' : ''}> ${M.cities}</label>
        <label class="check"><input type="checkbox" id="map-counts" ${s.counts ? 'checked' : ''}> ${M.counts}</label>
        <span class="helpq" data-tip="${esc(help)}">?</span></div>
      ${panel}
      <div class="mapwrap"><div id="map-svg">${svgHtml()}</div>
        <div class="zoombtns"><button data-act="mapz" data-id="in" title="${M.zoom_in}">+</button><button data-act="mapz" data-id="out" title="${M.zoom_out}">−</button><button data-act="mapz" data-id="reset" title="${M.zoom_reset}">⌂</button></div></div>
      <div id="map-axis">${axisHtml()}</div>`;
  }

  // ---------- interaction ----------
  function refreshParts() {
    const a = document.getElementById('map-svg'); if (a) a.innerHTML = svgHtml();
    const b = document.getElementById('map-axis'); if (b) b.innerHTML = axisHtml();
  }
  function refreshPins() {
    const a = document.getElementById('map-svg');
    if (!a) return;
    const svg = a.querySelector('svg.map');
    if (!svg) return;
    svg.classList.toggle('labels', m().cities);
    // swap only the pins and the land stay, so a wheel zoom keeps its pointer
    svg.querySelectorAll('g.pt').forEach((g) => g.remove());
    const tmp = document.createElement('div');
    tmp.innerHTML = svgHtml();
    tmp.querySelectorAll('svg.map > g.pt').forEach((g) => svg.appendChild(g));
  }
  function applyView() {
    const svg = document.querySelector('svg.map');
    if (!svg) return;
    svg.setAttribute('viewBox', vbAttr());
    svg.style.setProperty('--inv', String(1 / m().z));
  }
  function zoomAt(factor, fx, fy) {
    const s = m();
    const Z = D.get('map.zoom');
    const nz = Math.min(Z.max, Math.max(Z.min, s.z * factor));
    const v = view();
    // keep the point under the cursor fixed, fx and fy are fractions of the visible box
    const wx = v.x0 + fx * v.w, wy = v.y0 + fy * v.h;
    s.z = nz;
    const w2 = W() / nz, h2 = H() / nz;
    s.cx = wx - fx * w2 + w2 / 2;
    s.cy = wy - fy * h2 + h2 / 2;
    const v2 = view();
    s.cx = v2.x0 + v2.w / 2; s.cy = v2.y0 + v2.h / 2;
    applyView();
    refreshPins();
  }

  function attach(root) {
    root.addEventListener('wheel', (ev) => {
      const ax = ev.target.closest && ev.target.closest('svg.axis');
      if (ax) {
        ev.preventDefault();
        const f = D.get('map.zoom.step');
        axisZoom(ev.deltaY < 0 ? 1 / f : f, axisFrac(ev.clientX, ax));
        return;
      }
      const svg = ev.target.closest && ev.target.closest('svg.map');
      if (!svg) return;
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      const f = D.get('map.zoom.step');
      zoomAt(ev.deltaY < 0 ? f : 1 / f, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
    }, { passive: false });
    root.addEventListener('pointerdown', (ev) => {
      const ax = ev.target.closest && ev.target.closest('svg.axis');
      if (ax) {
        const f = axisFrac(ev.clientX, ax);
        const span = m().to - m().from;
        m().adrag = { x: ev.clientX, box: ax.parentElement, svg: ax, span, to: m().to, from: m().from, yc: m().to - (1 - f) ** 2 * span, moved: false };
        m().adrag.pid = ev.pointerId;
        return;
      }
      const svg = ev.target.closest && ev.target.closest('svg.map');
      if (!svg || ev.target.closest('.pt')) return;
      m().drag = { x: ev.clientX, y: ev.clientY, cx: m().cx, cy: m().cy, moved: false, svg };
      svg.setPointerCapture(ev.pointerId);
    });
    root.addEventListener('pointermove', (ev) => {
      const a = m().adrag;
      if (a) {
        if (!a.moved && Math.abs(ev.clientX - a.x) > D.get('map.zoom.drag_px')) { a.moved = true; a.box.setPointerCapture(a.pid); }
        if (a.moved) axisDrag(a, axisFrac(ev.clientX, a.box.querySelector('svg.axis') || a.svg));
        return;
      }
      const d = m().drag;
      if (!d) return;
      const r = d.svg.getBoundingClientRect();
      const v = view();
      const dx = ((ev.clientX - d.x) / r.width) * v.w, dy = ((ev.clientY - d.y) / r.height) * v.h;
      if (Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) > D.get('map.zoom.drag_px')) d.moved = true;
      m().cx = d.cx - dx; m().cy = d.cy - dy;
      const v2 = view();
      m().cx = v2.x0 + v2.w / 2; m().cy = v2.y0 + v2.h / 2;
      applyView();
    });
    const end = () => {
      const a = m().adrag;
      if (a) { m().adrag = null; m().justDragged = a.moved; setTimeout(() => { m().justDragged = false; }, 0); return; }
      const d = m().drag; if (!d) return; m().drag = null; m().justDragged = d.moved; setTimeout(() => { m().justDragged = false; }, 0); };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  }

  function act(a, id) {
    const s = m();
    if (a === 'mapz') {
      if (id === 'reset') { s.z = 1; s.cx = W() / 2; s.cy = H() / 2; applyView(); refreshPins(); }
      else zoomAt(id === 'in' ? D.get('map.zoom.step') ** 2 : 1 / D.get('map.zoom.step') ** 2, 0.5, 0.5);
      return false;
    }
    if (s.justDragged) return false;
    if (a === 'mapplace') {
      X.st.modal = { kind: 'place', place: id };
      return true;
    }
    if (a === 'mapevent') {
      const e = events().find((x) => x.id === id);
      if (!e) return false;
      if (e.locked && !DEV) return true;
      const from = X.st.modal && X.st.modal.kind === 'place' ? X.st.modal.place : null;
      if (e.catalog) s.cat = id; else { s.cat = null; X.selectEra(id); }
      X.st.modal = from ? { kind: 'dispatch', from } : { kind: 'dispatch' };
      return true;
    }
    if (a === 'maptag') { s.tag = id; return true; }
    if (a === 'mapfilter') { s.filterOpen = !s.filterOpen; return true; }
    return false;
  }
  function onInput(el) {
    const s = m();
    if (el.id === 'map-q') s.q = el.value;
    else if (el.id === 'map-star') s.star = el.value;
    else if (el.id === 'map-cities') s.cities = el.checked;
    else if (el.id === 'map-counts') s.counts = el.checked;
    else if (el.id === 'map-from') { const v = Number(el.value); if (Number.isFinite(v) && v < s.to) s.from = v; }
    else if (el.id === 'map-to') { const v = Number(el.value); if (Number.isFinite(v) && v > s.from) s.to = v; }
    else return false;
    const ft = document.getElementById('map-fromtxt'); if (ft) ft.textContent = fmtYear(D, s.from === 0 ? 1 : s.from);
    const tt = document.getElementById('map-totxt'); if (tt) tt.textContent = fmtYear(D, s.to === 0 ? 1 : s.to);
    refreshParts();
    return true;
  }

  function init() {
    const A = D.get('map.axis');
    return { z: 1, cx: W() / 2, cy: H() / 2, q: '', tag: '', tagOpen: false, filterOpen: false, cities: false, counts: false, cat: null, star: '', from: A.from, to: A.to, drag: null, adrag: null, justDragged: false };
  }
  return { html, placeHtml, act, onInput, attach, init, tickNight };
}
