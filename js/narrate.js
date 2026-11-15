// Turns a structured dispatch result into report text. It only reads the log, it never changes a result.
// This is the one place an optional AI narrator could plug in.

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

export function dateLabel(D, E, t, dayOnly = false) {
  const T = D.get('text');
  const hour = (t - Math.floor(t)) * 24;
  let part = T.day_parts[0].name;
  for (const p of T.day_parts) if (hour >= p.from) part = p.name;
  // the date is counted on the real calendar from day 0 of the model, so a month has its own length
  const cal = E.calendar;
  const at = new Date(Date.UTC(2000, cal.month - 1, cal.day0));
  at.setUTCFullYear(E.raw.metadata.era.year);
  at.setUTCDate(at.getUTCDate() + Math.floor(t));
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
      text = fmt(Object.values(spec.items).some((n) => n > 0) ? T.generic.arrive : T.generic.arrive_empty, vars, extra) + (off ? fmt(T.generic[off < 0 ? 'drift_early' : 'drift_late'], vars, { ...extra, n: String(Math.abs(off)) }) : '');
    }
    else if (e.kind === 'leave') text = fmt(T.generic.leave, vars, extra);
    else if (e.kind === 'recall') text = fmt(T.generic[e.key], vars, extra);
    else if (e.kind === 'event') text = fmt(ET.events[e.key], vars, extra);
    else text = fmt(personal(e.key || e.id) ?? ET.milestones[e.key || e.id], vars, extra);
    const tag = e.tag || null;
    const source = e.source || (tag ? E.tagSource[tag] : null);
    const after = leftAt !== null && e.t >= leftAt && e.kind !== 'leave' && e.kind !== 'recall';
    const seg = arrivedAt === null || after ? null : Math.min(Math.max(1, Math.ceil(stayDaysOf(res) / SEG)), Math.max(1, Math.floor((e.t - Math.floor(arrivedAt)) / SEG) + 1));
    return { t: e.t, text, tag, source, importance: e.importance, kind: e.kind, id: e.id, key: e.key || e.id, fact: e.fact || null, after, seg, own: e.kind === 'milestone' && personal(e.key || e.id) !== undefined };
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

  const hints = res.hints.map((k) => ET.hints[k]);
  const RP = E.report;
  // a handle that never came about is a negative day, and reads as nothing
  const orNull = (x) => (x >= 0 ? x : null);
  const handleBase = orNull(res.base.final[RP.handle]);
  const handleBranch = orNull(F[RP.handle]);
  return {
    outcomeId: oid, outcomeName: T.outcomes[oid].name, summary, quote, staff, stars: E.starPoints.filter((p) => res.branch.log.some((e) => e.kind === 'milestone' && e.id === p.milestone)).length,
    timeline: kept, ledger, ledgerBySegment: bySegment,
    points: E.starPoints.map((p) => ({ id: p.id, hit: res.branch.log.some((e) => e.kind === 'milestone' && e.id === p.milestone) })),
    chart: { base: res.base.series, branch: res.branch.series, arrive: res.branch.arrivedDay, leave: res.branch.leftDay, handleBase, handleBranch },
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
export function weaveJourney(D, E, res, report, journey, vignette) {
  const T = D.get('text');
  const arrivedAt = res.branch.arrivedDay;
  if (arrivedAt === null || !journey) return report;
  const P = T.ui.report.participation;
  const idText = journey.identity ? { ...T.identities[journey.identity], ...(T.eras[E.id]?.identities?.[journey.identity] || {}) } : { name: '', cover: '' };
  const say = (key, day) => ({
    t: arrivedAt + day, kind: 'journey', key, id: 'journey_' + key, tag: null, importance: 5, after: false, seg: 1,
    text: P['line_' + key].replace('{date}', dateLabel(D, E, arrivedAt + day, true)).replace('{cover}', idText.cover).replace('{identity}', idText.name).replace(/{staff}/g, report.staff),
  });
  const lines = [say(journey.reached ? 'reached' : 'blocked', journey.approachDay)];
  if (journey.reached) lines.push(say(journey.accepted ? 'accepted' : 'declined', journey.recognitionDay));
  const stay = (res.branch.leftDay ?? arrivedAt) - arrivedAt;
  if (vignette) lines.push({ t: arrivedAt + stay / 2, kind: 'vignette', key: 'vignette', id: 'vignette', tag: null, importance: 4, after: false, seg: null, text: vignette });
  const all = [...report.timeline, ...lines].map((x, i) => [x, i]).sort((a, b) => a[0].t - b[0].t || a[1] - b[1]).map(([x]) => x);
  return { ...report, timeline: all };
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
