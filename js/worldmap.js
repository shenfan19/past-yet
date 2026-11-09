// World map with zoom and pan. A pin is a place, a place holds events at different times.
// The filter row and the time axis narrow the events, so a crowded map stays readable. Real coastlines: Natural Earth, public domain.
import { fmtYear } from './narrate.js';

export function createWorldMap(X) {
  const { D, ctx, T, U, DEV, esc, st } = X;
  const M = U.map;
  const V = () => D.get('map.view');
  const m = () => st.map;

  const events = () => X.visibleEras().map((id) => {
    const era = ctx.era(id).raw.metadata.era;
    return { id, year: era.year, place: era.place, geo: era.geo, locked: !X.eraOpen(id) };
  });
  const evText = (e) => {
    const ET = T.eras[e.id];
    return [ET.name, ET.short, ET.place_name, ET.protagonist, e.year, ...ET.tags.map((t) => T.tags[t])].join(' ').toLowerCase();
  };
  const passes = (e) => {
    const s = m();
    if (e.year < s.from || e.year > s.to) return false;
    if (s.tag && !T.eras[e.id].tags.includes(s.tag)) return false;
    const q = s.q.trim().toLowerCase();
    return !q || evText(e).includes(q);
  };
  const filtered = () => events().filter(passes);
  const places = () => {
    const out = {};
    for (const e of filtered()) (out[e.place] = out[e.place] || { id: e.place, geo: e.geo, events: [] }).events.push(e);
    return out;
  };

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
  const labelsOn = () => m().z >= D.get('map.zoom.label_z');
  const vbAttr = () => { const v = view(); return `${v.x0.toFixed(2)} ${v.y0.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`; };

  function svgHtml() {
    const grid = [];
    const gs = V().grid_step;
    for (let lo = Math.ceil(V().lon_min / gs) * gs; lo <= V().lon_max; lo += gs) grid.push(`<line x1="${px(lo)}" x2="${px(lo)}" y1="0" y2="${H()}"/>`);
    for (let la = Math.ceil(V().lat_min / gs) * gs; la <= V().lat_max; la += gs) grid.push(`<line x1="0" x2="${W()}" y1="${py(la)}" y2="${py(la)}"/>`);
    const shape = (poly, off) => `<polygon points="${poly.map(([lo, la]) => (px(lo) + off) + ',' + py(la)).join(' ')}"/>`;
    const land = D.get('world').map((poly) => shape(poly, 0) + (Math.min(...poly.map((q) => q[0])) < V().lon_min ? shape(poly, 360) : '')).join('');
    const pins = Object.values(places()).map((p) => {
      const on = p.events.some((e) => e.id === st.form.eraId);
      const sel = m().place === p.id;
      const lock = p.events.every((e) => e.locked);
      const name = T.eras[p.events[0].id].place_name;
      return `<g class="pt ${on ? 'on' : ''} ${sel ? 'sel' : ''} ${lock ? 'locked' : ''}" data-act="mapplace" data-id="${esc(p.id)}" transform="translate(${px(p.geo.lon).toFixed(2)} ${py(p.geo.lat).toFixed(2)})"><g class="pin" style="transform: scale(var(--inv))"><rect class="hit" x="-6" y="-6" width="12" height="12"/><circle class="ring" r="5"/><circle class="dot" r="2.2"/><text x="6" y="1.6">${esc(name)}${lock && DEV ? ' ' + U.dispatch.hidden_mark : ''}${p.events.length > 1 ? ' ×' + p.events.length : ''}</text></g></g>`;
    }).join('');
    return `<svg class="map ${labelsOn() ? 'labels' : ''}" viewBox="${vbAttr()}" style="--inv:${1 / m().z}" role="img"><g class="grid">${grid.join('')}</g><g class="land">${land}</g>${pins}</svg>`;
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
    const Wd = 600, pad = 30, y0 = 36;
    const span = s.to - s.from;
    const x = (yr) => pad + ((yr - s.from) / span) * (Wd - 2 * pad);
    const step = niceStep(span);
    let g = `<line class="ax" x1="${pad - 20}" x2="${Wd - pad + 20}" y1="${y0}" y2="${y0}"/>`;
    for (let yr = Math.ceil(s.from / step) * step; yr <= s.to; yr += step) g += `<line class="tick" x1="${x(yr)}" x2="${x(yr)}" y1="${y0 - 4}" y2="${y0 + 4}"/><text class="yr" x="${x(yr)}" y="${y0 + 18}" text-anchor="middle">${fmtYear(D, yr || 1)}</text>`;
    for (const e of filtered()) {
      const on = st.form.eraId === e.id;
      g += `<g class="pt ${on ? 'on' : ''} ${e.locked ? 'locked' : ''}" data-act="mapevent" data-id="${e.id}" transform="translate(${x(e.year).toFixed(1)} ${y0})"><rect class="hit" x="-46" y="-28" width="92" height="44"/><circle class="ring" r="9"/><circle class="dot" r="4.5"/><text x="0" y="-14" text-anchor="middle">${fmtYear(D, e.year)} ${esc(T.eras[e.id].short)}${e.locked ? ' ' + U.dispatch.hidden_mark : ''}</text></g>`;
    }
    return `<svg class="axis" viewBox="0 0 ${Wd} 70" role="img">${g}</svg>`;
  }

  function eventRows() {
    const s = m();
    const p = s.place ? places()[s.place] : null;
    if (!p) return `<p class="muted">${M.pick_event}</p>`;
    return `<div class="muted">${M.events_here}</div>` + p.events.sort((a, b) => a.year - b.year).map((e) => {
      const ET = T.eras[e.id];
      return `<div class="evrow ${st.form.eraId === e.id ? 'on' : ''}" data-act="mapevent" data-id="${e.id}"><b>${fmtYear(D, e.year)}</b> <span>${esc(ET.name)}</span> ${ET.tags.map((t) => `<span class="chip">${esc(T.tags[t])}</span>`).join('')}${e.locked ? ' <span class="chip warn">' + U.dispatch.hidden_mark + '</span>' : ''}</div>`;
    }).join('');
  }

  function tagBar() {
    const present = new Set();
    for (const e of events()) T.eras[e.id].tags.forEach((t) => present.add(t));
    return `<div class="tagbar"><button class="chipbtn ${m().tag ? '' : 'on'}" data-act="maptag" data-id="">${M.all_tags}</button>${[...present].map((t) => `<button class="chipbtn ${m().tag === t ? 'on' : ''}" data-act="maptag" data-id="${t}">${esc(T.tags[t])}</button>`).join('')}</div>`;
  }

  function html() {
    const s = m();
    return `
      <div class="row" style="margin-bottom:6px"><input id="map-q" type="search" placeholder="${M.events_filter_ph}" value="${esc(s.q)}" style="flex:1;min-width:200px">
        <span class="muted">${M.from}</span><input id="map-from" type="number" value="${s.from}" style="width:80px"><span class="muted" id="map-fromtxt">${fmtYear(D, s.from === 0 ? 1 : s.from)}</span><span class="muted">${M.to}</span><input id="map-to" type="number" value="${s.to}" style="width:80px"><span class="muted" id="map-totxt">${fmtYear(D, s.to === 0 ? 1 : s.to)}</span></div>
      ${tagBar()}
      <div class="mapwrap"><div id="map-svg">${svgHtml()}</div><div class="zoombtns"><button data-act="mapz" data-id="in" title="${M.zoom_in}">+</button><button data-act="mapz" data-id="out" title="${M.zoom_out}">−</button><button data-act="mapz" data-id="reset" title="${M.zoom_reset}">⌂</button></div></div>
      <div class="muted">${M.drag_hint}</div>
      <div id="map-axis">${axisHtml()}</div>
      <div id="map-events">${eventRows()}</div>`;
  }

  // ---------- interaction ----------
  function refreshParts() {
    const a = document.getElementById('map-svg'); if (a) a.innerHTML = svgHtml();
    const b = document.getElementById('map-axis'); if (b) b.innerHTML = axisHtml();
    const c = document.getElementById('map-events'); if (c) c.innerHTML = eventRows();
  }
  function applyView() {
    const svg = document.querySelector('svg.map');
    if (!svg) return;
    svg.setAttribute('viewBox', vbAttr());
    svg.classList.toggle('labels', labelsOn());
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
  }

  function attach(root) {
    root.addEventListener('wheel', (ev) => {
      const svg = ev.target.closest && ev.target.closest('svg.map');
      if (!svg) return;
      ev.preventDefault();
      const r = svg.getBoundingClientRect();
      const f = D.get('map.zoom.step');
      zoomAt(ev.deltaY < 0 ? f : 1 / f, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
    }, { passive: false });
    root.addEventListener('pointerdown', (ev) => {
      const svg = ev.target.closest && ev.target.closest('svg.map');
      if (!svg || ev.target.closest('.pt')) return;
      m().drag = { x: ev.clientX, y: ev.clientY, cx: m().cx, cy: m().cy, moved: false, svg };
      svg.setPointerCapture(ev.pointerId);
    });
    root.addEventListener('pointermove', (ev) => {
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
    const end = () => { const d = m().drag; if (!d) return; m().drag = null; m().justDragged = d.moved; setTimeout(() => { m().justDragged = false; }, 0); };
    root.addEventListener('pointerup', end);
    root.addEventListener('pointercancel', end);
  }

  function act(a, id) {
    const s = m();
    if (a === 'mapz') {
      if (id === 'reset') { s.z = 1; s.cx = W() / 2; s.cy = H() / 2; applyView(); }
      else zoomAt(id === 'in' ? D.get('map.zoom.step') ** 2 : 1 / D.get('map.zoom.step') ** 2, 0.5, 0.5);
      return false;
    }
    if (s.justDragged) return false;
    if (a === 'mapplace') {
      s.place = id;
      const p = places()[id];
      if (p && p.events.length === 1) X.selectEra(p.events[0].id);
      else if (p && !p.events.some((e) => e.id === st.form.eraId)) { /* keep the form until an event is picked */ }
      return true;
    }
    if (a === 'mapevent') { X.selectEra(id); s.place = ctx.era(id).raw.metadata.era.place; return true; }
    if (a === 'maptag') { s.tag = id; return true; }
    return false;
  }
  function onInput(el) {
    const s = m();
    if (el.id === 'map-q') s.q = el.value;
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
    return { z: 1, cx: W() / 2, cy: H() / 2, q: '', tag: '', from: A.from, to: A.to, place: null, drag: null, justDragged: false };
  }
  return { html, act, onInput, attach, init };
}
