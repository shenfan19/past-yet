// Turns a structured dispatch result into report text. It only reads the log, it never changes a result.
// This is the one place an optional AI narrator could plug in.

// Where a line of the record came from, for the developer mode: the recorded date and fact, the condition that wrote it with the values it read,
// the chance of an event, the range of the drift, the length of the stay. The interface shows it only in the developer mode.
const r2 = (x) => Math.round(x * 100) / 100;
const valsOf = (expr, snap) => (snap ? [...new Set(expr.match(/[A-Za-z_][A-Za-z0-9_.]*/g) || [])].filter((n) => typeof snap[n] === 'number').map((n) => [n, r2(snap[n])]) : []);
function whyOf(D, E, e, res) {
  const variantOf = (list) => (list || []).find((x) => x.key === e.key);
  if (e.kind === 'milestone') {
    const m = E.raw.milestones?.[e.id];
    if (!m) return null;
    if (m.date && m.needs_traveler === false) return { kind: 'date', expr: m.date + (m.fact ? ' · ' + m.fact : '') };
    const expr = [m.when ?? 'date == ' + m.date, variantOf(m.variants)?.when].filter(Boolean).join(' ; ');
    return { kind: 'when', expr, vals: valsOf(expr, e.snap) };
  }
  if (e.kind === 'event') {
    const ev = E.raw.events?.[e.id];
    if (!ev) return null;
    const expr = [ev.when, ev.probability, variantOf(ev.variants)?.when].filter(Boolean).join(' ; ');
    return { kind: 'event', expr, vals: valsOf(expr, e.snap) };
  }
  if (e.kind === 'arrive') {
    if (!e.drift) return null;
    return { kind: 'drift', expr: `${r2(e.planned)} − ${e.drift.early} … ${r2(e.planned)} + ${e.drift.late} → ${r2(e.t)}` };
  }
  if (e.kind === 'leave') return { kind: 'stay', expr: `${r2(res.branch.arrivedDay)} + ${r2(e.t - res.branch.arrivedDay)}` };
  return null;
}

export function fmt(tpl, vars, extra = {}) {
  return tpl.replace(/\{([A-Za-z_][A-Za-z0-9_.]*)(?::([a-z0-9]+))?\}/g, (m, name, f) => {
    let x;
    if (name in extra) x = extra[name];
    else if (name.startsWith('d.')) x = Math.abs(extra.__delta ? extra.__delta[name.slice(2)] ?? 0 : 0);
    else if (name in vars) x = vars[name];
    else throw new Error('模板变量缺失: ' + name + ' in ' + tpl);
    if (typeof x === 'string') return x;
    if (f === 'i') return String(Math.round(x));
    if (f === 'p') return Math.round(x * 100) + '%';
    if (f === '1') return (Math.round(x * 10) / 10).toString();
    return String(Math.round(x * 100) / 100);
  });
}

// the date of a day of a model, on the real calendar from day 0 of the model, so a month has its own length
export function dateOf(E, t) {
  const cal = E.calendar;
  const at = new Date(Date.UTC(2000, cal.month - 1, cal.day0));
  at.setUTCFullYear(E.raw.metadata.era.year);
  at.setUTCDate(at.getUTCDate() + Math.floor(t));
  return at;
}

// the day of a model on which a date falls
export function dayOfDate(E, iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const at = new Date(Date.UTC(2000, m - 1, d)); at.setUTCFullYear(y);
  return Math.round((at - dateOf(E, 0)) / 86400000);
}

export function dateLabel(D, E, t, dayOnly = false) {
  const T = D.get('text');
  const hour = (t - Math.floor(t)) * 24;
  let part = T.day_parts[0].name;
  for (const p of T.day_parts) if (hour >= p.from) part = p.name;
  const at = dateOf(E, t);
  const month = at.getUTCMonth() + 1;
  const monthName = T.month_names[month - 1];
  const day = at.getUTCDate();
  return fmt(dayOnly ? T.date_day : T.date_format, {}, { m: month, mn: monthName, d: day, part });
}

export function itemText(D, eraId, id) {
  const e = D.get('text.eras.' + eraId);
  return (e.items && e.items[id]) || D.get('text.items.' + id);
}

export function stratText(D, eraId, grp, key) {
  const e = D.get('text.eras.' + eraId);
  return (e.strategies && e.strategies[grp] && e.strategies[grp][key]) || D.get(`text.strategies.${grp}.${key}`);
}

export function kitText(D, items, eraId) {
  return Object.entries(items).filter(([, n]) => n > 0).map(([id, n]) => {
    const name = itemText(D, eraId, id).name;
    return D.get(`items.${id}.max`) === 1 ? name : `${name}×${n}`;
  }).join(D.get('text.ui.fmt.sep'));
}

// Gender, age and job of an employee as one line, in the current language.
export function staffProfile(D, id) {
  const st = D.get('staff.staff.' + id);
  const U = D.get('text.ui');
  const tx = D.get('text.staff.' + id);
  return [U.gender[st.gender], U.fmt.age.replace('{n}', String(st.age)), tx.ethnicity, tx.jobs.join(U.fmt.sep)].filter(Boolean).join(' · ');
}

export function staffName(D, id) { return D.get(`text.staff.${id}.name`); }
export function staffTraits(D, id) { return D.get(`staff.staff.${id}.traits`); }

const stayDaysOf = (res) => (res.branch.arrivedDay === null ? 0 : (res.branch.leftDay ?? res.branch.digest.length) - res.branch.arrivedDay);

export function buildReport(D, E, res) {
  const T = D.get('text');
  const ET = T.eras[E.id];
  const spec = res.spec;
  const staff = staffName(D, spec.staffId);
  const traitSet = new Set(staffTraits(D, spec.staffId));
  const F = res.branch.final;
  const ctxVars = { ...F };
  for (const [n, x] of Object.entries(res.base.final)) ctxVars['base_' + n.replace(/\./g, '_')] = x;
  Object.assign(ctxVars, res.score);
  // a model may name in report.countdown the day it counts toward, such as the opening day, and the texts read how many days were left when the traveller went
  if (E.report.countdown) ctxVars.countdown = Math.max(0, Math.round(F[E.report.countdown] - (res.branch.leftDay ?? F[E.report.countdown])));
  const common = { staff, era: ET.short, kit: kitText(D, spec.items, E.id) };

  // timeline. A line belongs to a segment of the stay, one office day long, and a recorded date that falls after the traveller has left is marked as after.
  // A milestone reads the text of its variant, and where the card has a line written for this employee at this moment, that line.
  const SEG = D.get('config.travel.history_days_per_office_day');
  const arrivedAt = res.branch.arrivedDay, leftAt = res.branch.leftDay;
  const personal = (key) => ET.personal?.[key]?.[spec.staffId];
  const entries = res.branch.log.map((e) => {
    const vars = { ...e.snap };
    for (const [n, x] of Object.entries(res.base.final)) vars['base_' + n.replace(/\./g, '_')] = x;
    const extra = { ...common, date: dateLabel(D, E, e.t, e.kind === 'milestone'), __delta: e.delta };
    let text;
    if (e.kind === 'arrive') {
      // how far the crossing missed the planned day, in whole days, told after the line of arrival
      const off = Math.round(e.t - E.vars[E.roles.arrive].value);
      text = fmt(T.generic.arrive, vars, extra) + (off ? fmt(T.generic[off < 0 ? 'drift_early' : 'drift_late'], vars, { ...extra, n: String(Math.abs(off)) }) : '');
    }
    else if (e.kind === 'leave') text = fmt(T.generic.leave, vars, extra);
    else if (e.kind === 'recall') text = fmt(T.generic[e.key], vars, extra);
    else if (e.kind === 'event') text = fmt(ET.events[e.key], vars, extra);
    else text = fmt(personal(e.key || e.id) ?? ET.milestones[e.key || e.id], vars, extra);
    const tag = e.tag || null;
    const source = e.source || (tag ? E.tagSource[tag] : null);
    const after = leftAt !== null && e.t >= leftAt && e.kind !== 'leave' && e.kind !== 'recall';
    const seg = arrivedAt === null || after ? null : Math.min(Math.max(1, Math.ceil(stayDaysOf(res) / SEG)), Math.max(1, Math.floor((e.t - Math.floor(arrivedAt)) / SEG) + 1));
    return { t: e.t, year: dateOf(E, e.t).getUTCFullYear(), text, tag, source, importance: e.importance, kind: e.kind, id: e.id, key: e.key || e.id, fact: e.fact || null, after, seg, own: e.kind === 'milestone' && personal(e.key || e.id) !== undefined, why: whyOf(D, E, e, res) };
  });
  // an event that comes again and reads the same is told once, where it first happened, with how many times it came
  {
    const firstOf = new Map();
    for (const en of entries) {
      if (en.kind !== 'event') continue;
      const f = firstOf.get(en.key);
      if (f) { f.times++; en.drop = true; } else { en.times = 1; firstOf.set(en.key, en); }
    }
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i].drop) entries.splice(i, 1);
  }
  // the cap is for one segment of the stay, so a long stay keeps as many lines for each of its months as a short one has in all
  const max = D.get('config.ui.timeline_max') * Math.max(1, Math.ceil(stayDaysOf(res) / SEG));
  // the milestone lines of the sync points are never dropped from the timeline, and they are marked
  const pointIds = new Set(E.starPoints.map((p) => p.milestone));
  for (const en of entries) en.star = en.kind === 'milestone' && pointIds.has(en.id);
  let kept = entries;
  if (entries.length > max) {
    const ranked = [...entries].sort((a, b) => b.importance - a.importance || a.t - b.t).slice(0, max);
    const set = new Set(ranked);
    kept = entries.filter((e) => set.has(e) || e.star);
  }
  // The epilogue of a model is what is recorded after the model ends, months or years later, each a dated line of history on a fact of the person.
  // It is told plainly at the end of the record, after the traveller has gone, and the simulation does not run to it.
  for (const ep of E.raw.epilogue || []) {
    const t = dayOfDate(E, ep.date);
    kept.push({ t, year: Number(ep.date.slice(0, 4)), text: fmt(ET.milestones[ep.key], {}, { ...common, date: dateLabel(D, E, t, true) }), tag: 'history', source: null, importance: 5, kind: 'milestone', id: ep.key, key: ep.key, fact: ep.fact || null, after: true, seg: null, own: false, why: { kind: 'epilogue', expr: ep.date + (ep.fact ? ' · ' + ep.fact : '') } });
  }

  // outcome, summary, quote
  const oid = res.outcome;
  const summary = fmt(ET.summary[oid], ctxVars, common);
  let quote = '';
  for (const q of ET.quotes[oid]) if (!q.trait || traitSet.has(q.trait)) { quote = q.text; break; }

  // The ledger reads the two series of the model, whatever they count. A stay of one office day or less is kept day by day, a longer one has one row for each segment.
  const cases = E.series.find((x) => x.id === 'cases').fn, deaths = E.series.find((x) => x.id === 'deaths').fn;
  const stayDays = arrivedAt === null ? 0 : (leftAt ?? res.branch.digest.length) - arrivedAt;
  const bySegment = stayDays > SEG;
  const ledger = res.branch.digest.map((d, i) => ({
    day: d.day, sick: cases(d.snap), dead: deaths(d.snap), baseDead: deaths(res.base.digest[i].snap),
    treated: d.snap[E.report.treated], protected: d.snap[E.report.protected] * E.report.protected_scale, arrived: d.arrived,
  })).filter((l) => !bySegment || (arrivedAt !== null && l.day > arrivedAt && l.day <= arrivedAt + stayDays && Math.round(l.day - arrivedAt) % SEG === 0))
    .map((l) => (bySegment ? { ...l, day: Math.round((l.day - arrivedAt) / SEG) } : l));

  // a hint that names a star is given only when that star was missed, so a hint always points at something the next trip could win
  const missed = new Set(E.starPoints.filter((p) => !res.branch.log.some((e) => e.kind === 'milestone' && e.id === p.milestone)).map((p) => p.id));
  const hints = res.hints.filter((h) => !h.point || missed.has(h.point)).slice(0, D.get('config.engine.report_hints')).map((h) => ET.hints[h.key]);
  const RP = E.report;
  // a handle that never came about is a negative day, and reads as nothing
  const orNull = (x) => (x >= 0 ? x : null);
  const maxPoints = D.get('config.ui.chart.max_points');
  const thin = (rows) => (rows.length <= maxPoints ? rows : rows.filter((_, i) => i % Math.ceil(rows.length / maxPoints) === 0 || i === rows.length - 1));
  const handleBase = orNull(res.base.final[RP.handle]);
  const handleBranch = orNull(F[RP.handle]);
  return {
    outcomeId: oid, outcomeName: T.outcomes[oid].name, summary, quote, staff, stars: E.starPoints.filter((p) => res.branch.log.some((e) => e.kind === 'milestone' && e.id === p.milestone)).length,
    timeline: kept, ledger, ledgerBySegment: bySegment,
    points: E.starPoints.map((p) => ({ id: p.id, hit: res.branch.log.some((e) => e.kind === 'milestone' && e.id === p.milestone) })),
    // a model that shows no numbers keeps no curves, and the curves of one that does are thinned to config.ui.chart.max_points, so a saved report stays small
    chart: { base: E.report.numbers === false ? [] : thin(res.base.series), branch: E.report.numbers === false ? [] : thin(res.branch.series), arrive: res.branch.arrivedDay, leave: res.branch.leftDay, handleBase, handleBranch },
    accounts: { cost: res.cost, funds: res.funds, energy: res.energy, restDays: res.restDays, lives: res.score.lives_saved },
    compare: {
      deathsBase: res.base.final[RP.deaths], deathsBranch: F[RP.deaths], casesBase: res.base.final[RP.cases], casesBranch: F[RP.cases],
      handleBase: handleBase === null ? T.ui.report.never : dateLabel(D, E, handleBase), handleBranch: handleBranch === null ? T.ui.report.never : dateLabel(D, E, handleBranch),
      treated: F[RP.treated], protectedTotal: F[RP.protected] * RP.protected_scale,
    },
    hints,
  };
}

// How the employee got in and the scene of the trip are lines of the record too, told where they happened, so the report is one list in time order.
// The identity lines fall on the days counted from arrival, and the scene, which has no date of its own, in the middle of the stay.
export function weaveJourney(D, E, res, report, journey, vignette, vignetteTraits = null) {
  const T = D.get('text');
  const arrivedAt = res.branch.arrivedDay;
  if (arrivedAt === null || !journey) return report;
  const P = T.ui.report.participation;
  const idText = journey.identity ? { ...T.identities[journey.identity], ...(T.eras[E.id]?.identities?.[journey.identity] || {}) } : { name: '', cover: '' };
  const jw = (stage) => journey.why?.[stage] ? { kind: 'journey', expr: `${r2(journey.why[stage].score)} ≥ ${r2(journey.why[stage].need)}` } : null;
  const say = (key, day) => ({
    t: arrivedAt + day, kind: 'journey', key, id: 'journey_' + key, tag: null, importance: 5, after: false, seg: 1, why: jw(key === 'reached' || key === 'blocked' ? 'reach' : 'accept'),
    text: P['line_' + key].replace('{date}', dateLabel(D, E, arrivedAt + day, true)).replace('{cover}', idText.cover).replace('{identity}', idText.name).replace(/{staff}/g, report.staff),
  });
  const lines = [say(journey.reached ? 'reached' : 'blocked', journey.approachDay)];
  if (journey.reached) lines.push(say(journey.accepted ? 'accepted' : 'declined', journey.recognitionDay));
  const stay = (res.branch.leftDay ?? arrivedAt) - arrivedAt;
  if (vignette) lines.push({ t: arrivedAt + stay / 2, kind: 'vignette', key: 'vignette', id: 'vignette', tag: null, importance: 4, after: false, seg: null, text: vignette, why: { kind: 'vignette', expr: vignetteTraits && vignetteTraits.length ? 'traits ∋ ' + vignetteTraits.join(' | ') : 'default' } });
  const all = [...report.timeline, ...lines].map((x, i) => [x, i]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(([x]) => x);
  return { ...report, timeline: all };
}

// The record of a small story, in the same shape as the record of a model, so one report shows both. Its days are counted from arrival,
// since a small story has a year and no calendar. Facts of the person dated in the year of the event come before the arrival, facts of later years
// after the leaving, each year marked; the lines of getting in, the sync points on their days, the scene in the middle, and the leaving.
export function lightRecord(D, ev, r, staffId, stayDays) {
  const T = D.get('text');
  const R = T.ui.report;
  const c = T.catalog[ev.id];
  const staff = staffName(D, staffId);
  const dayWord = (d) => R.light_day.replace('{n}', String(Math.max(1, Math.round(d))));
  const lines = [];
  const EF = D.get('encyclopedia.event_facts')?.[ev.id];
  if (EF) {
    for (const f of EF.facts) {
      const year = Number(f.date.slice(0, 4));
      // only the line written for the record is told, never the text of the fact, which is for the wiki
      const text = D.get('enc_text.fact_lines')?.[EF.module]?.[f.id];
      if (!text) continue;
      const [, mm, dd] = f.date.split('-').map(Number);
      // a fact placed on a day of the stay carries its own date in its line, such as a date of the lunar calendar, and reads without a label
      const onDay = typeof f.stay_day === 'number';
      const label = !onDay && mm && dd ? T.date_day.replace('{m}', String(mm)).replace('{mn}', T.month_names[mm - 1]).replace('{d}', String(dd)) + R.light_fact_sep : '';
      // a fact is placed on its day of the stay when it says so; otherwise a fact of an earlier year or of the year of the event comes before the arrival, in order,
      // and a fact of a later year after the leaving
      const after = onDay ? f.stay_day > stayDays : year > ev.year;
      const order = onDay ? f.stay_day : after ? stayDays + (year - ev.year) * 366 + (mm || 1) * 31 + (dd || 0) : -1e7 + (year - ev.year) * 400 + (mm || 0) * 31 + (dd || 0);
      lines.push({ t: order, year, text: label + text, tag: 'history', kind: 'fact', id: f.id, key: f.id, fact: f.id, after, why: { kind: 'date', expr: f.date + ' · ' + f.id } });
    }
  }
  lines.push({ t: 0, year: ev.year, text: R.light_arrive.replace('{staff}', staff).replace('{place}', c.place), tag: null, kind: 'arrive', id: 'arrive', key: 'arrive', after: false, why: null });
  const j = r.journey;
  if (j) {
    const idText = j.identity ? T.identities[j.identity] : { name: '', cover: '' };
    const jw = (stage) => (j.why?.[stage] ? { kind: 'journey', expr: `${Math.round(j.why[stage].score * 100) / 100} ≥ ${Math.round(j.why[stage].need * 100) / 100}` } : null);
    const say = (key, day, stage) => lines.push({ t: day, year: ev.year, kind: 'journey', id: 'journey_' + key, key, tag: null, after: false, why: jw(stage),
      text: R.participation['line_' + key].replace('{date}', dayWord(day)).replace('{cover}', idText.cover).replace('{identity}', idText.name).replace(/\{staff\}/g, staff) });
    say(j.reached ? 'reached' : 'blocked', j.approachDay, 'reach');
    if (j.reached) say(j.accepted ? 'accepted' : 'declined', j.recognitionDay, 'accept');
  }
  const n = (r.points || []).length;
  (r.points || []).forEach((p, i) => {
    const day = p.day ?? stayDays * (i + 1) / (n + 1);
    const what = ev.scene ? c.points[p.id] : T.ui.light.points[p.id];
    const spec = ev.scene?.points?.[i]?.req;
    lines.push({ t: day, year: ev.year, kind: 'point', id: p.id, key: p.id, tag: null, after: false, star: !!p.hit,
      text: (p.hit ? R.point_hit : R.point_miss).replace('{day}', dayWord(day)).replace('{staff}', staff).replace('{text}', what),
      why: { kind: 'point', expr: (spec ? JSON.stringify(spec) : p.id) + (p.bonus ? ' · bonus' : '') } });
  });
  // a scene names the employee with {staff}
  const vignette = r.vignette && c.vignettes ? c.vignettes[r.vignette]?.split('{staff}').join(staff) : null;
  if (vignette) lines.push({ t: stayDays / 2, year: ev.year, kind: 'vignette', id: 'vignette', key: 'vignette', tag: null, after: false, text: vignette,
    why: { kind: 'vignette', expr: (ev.scene.vignettes.find((x) => x.id === r.vignette)?.traits || []).join(' | ') || 'default' } });
  lines.push({ t: stayDays, year: ev.year, kind: 'leave', id: 'leave', key: 'leave', tag: null, after: false, text: R.light_leave.replace('{day}', dayWord(stayDays)).replace('{staff}', staff), why: { kind: 'stay', expr: String(stayDays) } });
  return lines.map((x, i) => [x, i]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(([x]) => x);
}

// Rows comparing two reports of the same era.
export function diffRows(D, eraId, A, B) {
  const T = D.get('text');
  const rows = [];
  const ids = new Set([...Object.keys(A.res.spec.items), ...Object.keys(B.res.spec.items)]);
  for (const id of ids) {
    const a = A.res.spec.items[id] || 0, b = B.res.spec.items[id] || 0;
    if (a !== b) rows.push({ k: itemText(D, eraId, id).name, a, b });
  }
  const sa = A.res.spec, sb = B.res.spec;
  if (sa.staffId !== sb.staffId) rows.push({ k: T.ui.dispatch.staff, a: staffName(D, sa.staffId), b: staffName(D, sb.staffId) });
  return rows;
}

// Years are stored as signed integers. The text decides how they read: negative years use the bc template, years before the cut off the ad template.
export function fmtYear(D, y) {
  const C = D.get('text.ui.cal');
  if (y === 0) throw new Error('没有 0 年');
  if (y < 0) return C.bc.replace('{n}', String(-y));
  return y < D.get('map.calendar.ad_prefix_below') ? C.ad.replace('{n}', String(y)) : String(y);
}

// The first sentence of a description, for one line list cells.
export function firstSentence(text) {
  const m = text.match(/^.*?[。.!?！？]/);
  return m ? m[0] : text;
}

// The five attributes of a person as a star: one axis for each, from the centre out to 10, the area filled. Pure markup, the colours are in the style sheet.
export function radarSvg(D, stats, size = 190) {
  const keys = D.get('staff.attributes');
  const T = D.get('text.stats');
  const cx = size / 2, cy = size / 2, R = size * 0.32;
  const pt = (i, v) => { const a = -Math.PI / 2 + (2 * Math.PI * i) / keys.length; return [cx + R * (v / 10) * Math.cos(a), cy + R * (v / 10) * Math.sin(a)]; };
  const poly = (f) => keys.map((_, i) => f(i).map((x) => x.toFixed(1)).join(',')).join(' ');
  const rings = [2, 4, 6, 8, 10].map((r) => `<polygon class="ring" points="${poly((i) => pt(i, r))}"/>`).join('');
  const axes = keys.map((_, i) => `<line class="axis" x1="${cx}" y1="${cy}" x2="${pt(i, 10)[0].toFixed(1)}" y2="${pt(i, 10)[1].toFixed(1)}"/>`).join('');
  const area = `<polygon class="area" points="${poly((i) => pt(i, Math.min(10, stats[keys[i]])))}"/>`;
  const labels = keys.map((k, i) => { const [x, y] = pt(i, 12.6); const anchor = Math.abs(x - cx) < 4 ? 'middle' : x < cx ? 'end' : 'start'; return `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="${anchor}">${T[k]} ${Math.round(stats[k] * 10) / 10}</text>`; }).join('');
  return `<svg class="radar" viewBox="-40 0 ${size + 80} ${size}" width="${size + 80}" height="${size}" role="img">${rings}${axes}${area}${labels}</svg>`;
}
