// Office rules without any DOM: the game clock, dispatch lifecycle, secretary and favor, the auto mode and the alerts.
// The clock is real time scaled by a speed, pausable like a grand strategy game. Everything is in game days.
import { staffTraits } from './narrate.js';

export function createOffice(X) {
  const { D, ctx } = X;
  const O = D.get('config.office');
  const C = D.get('config.clock');
  const F = D.get('config.favor');
  const A = D.get('config.auto');
  const S = () => ctx.S();
  const day = () => S().clock.day;
  const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x));

  const allStaff = () => Object.keys(D.get('staff.staff'));
  const hiredIds = () => allStaff().filter((id) => S().staff[id].hired);

  function perks() {
    const out = { funds_mult: 0, energy_mult: 0, rest_cut: 0, favor_gain: 0 };
    const id = S().secretary;
    if (!id) return out;
    for (const t of staffTraits(D, id)) for (const [k, v] of Object.entries(D.get('staff.traits.' + t).secretary || {})) out[k] += v;
    return out;
  }

  // What the secretary wants from the auto mode: the preference of their highest priority trait that has one.
  function secretaryAim() {
    const id = S().secretary;
    if (!id) return null;
    let best = null, bp = -Infinity;
    for (const t of staffTraits(D, id)) {
      const tr = D.get('staff.traits.' + t);
      if (tr.prefer && tr.priority > bp) { bp = tr.priority; best = tr.prefer; }
    }
    return best;
  }
  function aimMet(aim, d) {
    const R = A.secretary_rules;
    if (aim === 'funds') return d.paid.funds >= R.funds_min;
    if (aim === 'lives') return d.report.accounts.lives >= R.lives_min;
    if (aim === 'energy') return d.paid.energy >= R.energy_min;
    if (aim === 'safety') return !R.safety_bad.includes(d.report.outcomeId);
    throw new Error('未知的秘书偏好 ' + aim);
  }

  function staffState(id) {
    if (S().secretary === id) return 'secretary';
    if (S().dispatches.some((d) => d.spec.staffId === id && !d.claimed)) return 'away';
    if ((S().staff[id].restUntil || 0) > day()) return 'resting';
    return 'ready';
  }

  function launch(eraId, spec, opts = {}) {
    const E = ctx.era(eraId);
    const s = S();
    const full = { ...spec, favor: s.staff[spec.staffId].favor };
    const err = ctx.backend.validate(eraId, full, s.inv);
    if (err || staffState(full.staffId) !== 'ready') return null;
    const { res, report } = ctx.backend.dispatch(eraId, full);
    for (const [id, n] of Object.entries(full.items)) s.inv[id] = (s.inv[id] || 0) - n;
    const anchor = X.anchorOf(eraId);
    if (!s.locks.includes(anchor)) s.locks.push(anchor);
    s.seq += 1;
    const stay = E.vars[E.roles.stay].value;
    const d = { id: 'd' + s.seq, eraId, spec: full, report, readyDay: day() + stay, claimed: false, notified: false, auto: !!opts.auto, payout: { energy: res.energy, funds: res.funds, restDays: res.restDays } };
    s.dispatches.push(d);
    ctx.save();
    return d;
  }

  function claim(id) {
    const s = S();
    const d = s.dispatches.find((x) => x.id === id);
    if (!d || d.claimed) return null;
    const p = perks();
    d.claimed = true;
    d.claimedAt = ctx.now();
    d.paid = { energy: Math.round(d.payout.energy * (1 + p.energy_mult)), funds: Math.round(d.payout.funds * (1 + p.funds_mult)), restDays: Math.ceil(d.payout.restDays * (1 - p.rest_cut)) };
    s.energy += d.paid.energy;
    s.funds += d.paid.funds;
    const sf = s.staff[d.spec.staffId];
    sf.restUntil = day() + d.paid.restDays;
    const delta = F.outcome[d.report.outcomeId];
    d.favorDelta = delta > 0 ? delta * (1 + p.favor_gain) : delta;
    sf.favor = clamp(sf.favor + d.favorDelta, F.min, F.max);
    const aim = secretaryAim();
    if (d.auto && aim) {
      const R = A.secretary_rules;
      const met = aimMet(aim, d);
      const sec = s.staff[s.secretary];
      sec.favor = clamp(sec.favor + (met ? R.favor_match : R.favor_miss), F.min, F.max);
      s.secretaryLast = { aim, met, dispatchId: d.id };
    }
    s.dispatches.sort((a, b) => (a.claimedAt ?? Infinity) - (b.claimedAt ?? Infinity));
    const closed = s.dispatches.filter((x) => x.claimed);
    if (closed.length > O.max_archive) {
      const drop = new Set(closed.slice(0, closed.length - O.max_archive).map((x) => x.id));
      s.dispatches = s.dispatches.filter((x) => !drop.has(x.id));
    }
    ctx.save();
    return d;
  }

  function gift(id) {
    const s = S();
    if (s.funds < F.gift_cost || !s.staff[id].hired) return false;
    s.funds -= F.gift_cost;
    s.staff[id].favor = clamp(s.staff[id].favor + F.gift_gain, F.min, F.max);
    ctx.save();
    return true;
  }

  function appoint(id) {
    const s = S();
    if (id && (!s.staff[id].hired || staffState(id) === 'away')) return false;
    s.secretary = s.secretary === id ? null : id;
    ctx.save();
    return true;
  }

  // ---------- clock ----------
  function setSpeed(i) { S().clock.speed = C.speeds[i]; ctx.save(); }
  function togglePause() {
    const c = S().clock;
    c.speed = c.speed === 0 ? C.speeds[1] : 0;
    ctx.save();
  }
  // Moves the clock and returns the dispatches that just came home. A new report pauses the clock unless auto mode runs.
  function advance(seconds) {
    const s = S();
    if (s.clock.speed > 0) s.clock.day += (s.clock.speed * seconds) / C.sec_per_day;
    const fresh = s.dispatches.filter((d) => !d.claimed && !d.notified && d.readyDay <= day());
    for (const d of fresh) d.notified = true;
    if (fresh.length && !s.clock.auto && C.pause_on_report) s.clock.speed = 0;
    if (s.clock.speed > 0 || fresh.length) ctx.save();
    return fresh;
  }

  // ---------- auto mode ----------
  function autoKit(eraId) {
    const E = ctx.era(eraId);
    const s = S();
    let room = O.weight_capacity;
    const items = {};
    for (const id of A.kit_order) {
      if (!(id in E.itemBindings)) continue;
      const it = D.get('items.' + id);
      let n = Math.min(s.inv[id] || 0, it.max);
      n = Math.floor(Math.min(n, room / it.weight) / it.step) * it.step;
      if (n > 0) { items[id] = n; room -= n * it.weight; }
    }
    return items;
  }
  function autoPlots(eraId) {
    const E = ctx.era(eraId);
    return Object.keys(E.plots).filter((p) => E.plots[p].tech <= E.tech).slice(0, O.max_plots);
  }
  function restock() {
    const s = S();
    for (const [id, target] of Object.entries(A.buy_target)) {
      const it = D.get('items.' + id);
      if (!it.playable || !D.get('shops.shops.' + it.shop).playable) continue;
      while ((s.inv[id] || 0) + it.step <= target && s.funds - it.cost * it.step >= A.reserve_funds) {
        s.funds -= it.cost * it.step;
        s.inv[id] = (s.inv[id] || 0) + it.step;
      }
    }
  }
  function autoStep() {
    const s = S();
    for (const d of s.dispatches.filter((x) => !x.claimed && x.readyDay <= day())) claim(d.id);
    restock();
    const eras = X.visibleEras().filter((id) => X.eraOpen(id));
    if (!eras.length) return;
    for (const staffId of hiredIds()) {
      if (staffState(staffId) !== 'ready') continue;
      const count = (id) => s.dispatches.filter((d) => d.eraId === id).length;
      const eraId = [...eras].sort((a, b) => count(a) - count(b))[0];
      launch(eraId, { seed: (s.seq + 1) * D.get('config.engine.mc_seed_stride') % D.get('config.engine.seed_max') + 1, staffId, items: autoKit(eraId), plots: autoPlots(eraId) }, { auto: true });
    }
    ctx.save();
  }

  // ---------- alerts and mainline ----------
  function alerts() {
    const s = S();
    const readyReports = s.dispatches.filter((d) => !d.claimed && d.readyDay <= day()).length;
    const idle = s.clock.auto ? 0 : hiredIds().filter((id) => staffState(id) === 'ready').length;
    const anchors = X.visibleEras().some((id) => X.eraOpen(id));
    return { home: readyReports, dispatch: anchors ? idle : 0 };
  }
  function stageIndex() {
    const st = D.get('mainline.stages');
    let idx = 0;
    st.forEach((x, i) => { if (S().energy >= x.energy) idx = i; });
    return idx;
  }

  return { secretaryAim, perks, staffState, launch, claim, gift, appoint, setSpeed, togglePause, advance, autoStep, alerts, stageIndex, hiredIds };
}
