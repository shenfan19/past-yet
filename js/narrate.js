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

export function dateLabel(D, E, t) {
  const T = D.get('text');
  const hour = (t - Math.floor(t)) * 24;
  let part = T.day_parts[0].name;
  for (const p of T.day_parts) if (hour >= p.from) part = p.name;
  const cal = E.calendar;
  const total = cal.day0 + Math.floor(t);
  const month = cal.month + Math.floor((total - 1) / cal.month_length);
  const monthName = T.month_names[month - 1];
  const day = ((total - 1) % cal.month_length) + 1;
  return fmt(T.date_format, {}, { m: month, mn: monthName, d: day, part });
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
  return [U.gender[st.gender], U.fmt.age.replace('{n}', String(st.age)), D.get('text.staff.' + id + '.job')].join(' · ');
}

export function staffName(D, id) { return D.get(`text.staff.${id}.name`); }
export function staffTraits(D, id) { return D.get(`staff.staff.${id}.traits`); }

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

  // timeline
  const entries = res.branch.log.map((e) => {
    const vars = { ...e.snap };
    for (const [n, x] of Object.entries(res.base.final)) vars['base_' + n.replace(/\./g, '_')] = x;
    const extra = { ...common, date: dateLabel(D, E, e.t), __delta: e.delta };
    let text;
    if (e.kind === 'arrive') text = fmt(Object.values(spec.items).some((n) => n > 0) ? T.generic.arrive : T.generic.arrive_empty, vars, extra);
    else if (e.kind === 'leave') text = fmt(T.generic.leave, vars, extra);
    else if (e.kind === 'recall') text = fmt(T.generic[e.key], vars, extra);
    else if (e.kind === 'event') text = fmt(ET.events[e.key], vars, extra);
    else text = fmt(ET.milestones[e.id], vars, extra);
    const tag = e.tag || null;
    const source = e.source || (tag ? E.tagSource[tag] : null);
    return { t: e.t, text, tag, source, importance: e.importance, kind: e.kind, id: e.id };
  });
  const max = D.get('config.ui.timeline_max');
  let kept = entries;
  if (entries.length > max) {
    const ranked = [...entries].sort((a, b) => b.importance - a.importance || a.t - b.t).slice(0, max);
    const set = new Set(ranked);
    kept = entries.filter((e) => set.has(e));
  }

  // outcome, summary, quote
  const oid = res.outcome;
  const summary = fmt(ET.summary[oid], ctxVars, common);
  let quote = '';
  for (const q of ET.quotes[oid]) if (!q.trait || traitSet.has(q.trait)) { quote = q.text; break; }

  // ledger from daily digests
  const ledger = res.branch.digest.map((d, i) => ({
    day: d.day, sick: d.snap.Iu + d.snap.It, dead: d.snap.D, baseDead: res.base.digest[i].snap.D,
    treated: d.snap[E.report.treated], protected: d.snap[E.report.protected] * E.report.protected_scale, arrived: d.arrived,
  }));

  const hints = res.hints.map((k) => ET.hints[k]);
  const RP = E.report;
  const handleBase = res.base.final[RP.handle];
  const handleBranch = F[RP.handle];
  return {
    outcomeId: oid, outcomeName: T.outcomes[oid].name, summary, quote, staff,
    timeline: kept, ledger,
    chart: { base: res.base.series, branch: res.branch.series, arrive: res.branch.arrivedDay, leave: res.branch.leftDay, handleBase, handleBranch },
    accounts: { cost: res.cost, funds: res.funds, energy: res.energy, restDays: res.restDays, lives: res.score.lives_saved },
    compare: {
      deathsBase: res.base.final[RP.deaths], deathsBranch: F[RP.deaths], casesBase: res.base.final[RP.cases], casesBranch: F[RP.cases],
      handleBase: dateLabel(D, E, handleBase), handleBranch: dateLabel(D, E, handleBranch),
      treated: F[RP.treated], protectedTotal: F[RP.protected] * RP.protected_scale,
    },
    hints,
  };
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
