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

  const hiredIds = () => Object.keys(S().staff).filter((id) => S().staff[id].hired);
  // only one employee can be in a place at a time, the simulation cannot yet hold two travellers in one place
  const ST = D.get('config.stars');
  const eraBusy = (eraId) => S().dispatches.some((d) => !d.claimed && d.eraId === eraId);

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
    const full = { ...spec, plots: plotsFor(eraId), favor: s.staff[spec.staffId].favor };
    const err = ctx.backend.validate(eraId, full, s.inv);
    if (err || staffState(full.staffId) !== 'ready' || eraBusy(eraId)) return null;
    const { res, report } = ctx.backend.dispatch(eraId, full);
    const antique = ctx.backend.findAntique(eraId, full.seed, s.antiques);
    for (const [id, n] of Object.entries(full.items)) s.inv[id] = (s.inv[id] || 0) - n;
    s.seq += 1;
    const stay = E.vars[E.roles.stay].value;
    const d = { id: 'd' + s.seq, eraId, spec: full, report, stars: report.stars, baseEnergy: ST.energy_base[eraId], startDay: day(), readyDay: day() + stay, claimed: false, notified: false, auto: !!opts.auto, payout: { energy: 0, funds: res.funds, restDays: res.restDays, antique } };
    s.dispatches.push(d);
    ctx.save();
    return d;
  }

  // A small story to a catalogue event whose antique is anchored. It has no kit and no branch, only the traveller against the event.
  const LT = D.get('config.light');
  function launchLight(eventId, staffId, seed, items = {}, opts = {}) {
    const s = S();
    if (!s.locks.includes('relic_' + eventId) || staffState(staffId) !== 'ready' || eraBusy(eventId)) return null;
    const kit = Object.fromEntries(Object.entries(items).filter(([id, n]) => n > 0 && D.get('items.' + id).scene && (s.inv[id] || 0) >= n));
    const r = ctx.backend.runLight(eventId, staffId, seed, kit);
    const antique = r.keepAntique === false ? null : ctx.backend.findAntique(eventId, seed, s.antiques);
    for (const [id, n] of Object.entries(kit)) s.inv[id] -= n;
    s.seq += 1;
    const d = {
      id: 'd' + s.seq, eraId: eventId, light: true, stars: r.stars, baseEnergy: r.energyBase, spec: { seed, staffId, items: kit, plots: [], favor: s.staff[staffId].favor },
      report: { outcomeId: r.outcome, found: r.found || null, extraFavor: r.extraFavor || 0, points: Array.isArray(r.points) && typeof r.points[0] === 'boolean' ? r.points.map((hit, i) => ({ id: ['reach', 'meet', 'impress'][i], hit })) : r.points, accounts: { cost: 0, funds: r.funds, energy: r.energy, restDays: r.restDays, lives: 0 } },
      startDay: day(), readyDay: day() + r.stay, claimed: false, notified: false, auto: !!opts.auto, payout: { energy: 0, funds: r.funds, restDays: r.restDays, antique },
    };
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
    if (!s.visited.includes(d.eraId)) s.visited.push(d.eraId);
    d.claimedAt = ctx.now();
    // Time energy is paid for the stars above the best this place has had: a quarter of the base for one star, half for two, all of it for three,
    // and each trip pays the difference to what the best already paid, so a place cannot be farmed for energy.
    // Funds and antiques are paid every time.
    const best = s.stars[d.eraId] || 0;
    d.newBest = d.stars > best;
    const energy = d.newBest ? d.baseEnergy * (ST.energy_share[d.stars] - ST.energy_share[best]) : 0;
    if (d.newBest) s.stars[d.eraId] = d.stars;
    d.paid = { energy: Math.round(energy * (1 + p.energy_mult)), funds: Math.round(d.payout.funds * (1 + p.funds_mult)), restDays: Math.ceil(d.payout.restDays * (1 - p.rest_cut)) };
    s.energy += d.paid.energy;
    s.funds += d.paid.funds;
    d.paid.antique = d.payout.antique || null;
    d.paid.duplicate = !!d.paid.antique && s.antiques.includes(d.paid.antique);
    if (d.paid.antique) s.antiques.push(d.paid.antique);
    const sf = s.staff[d.spec.staffId];
    sf.restUntil = day() + d.paid.restDays;
    const delta = (d.light ? LT.favor[d.report.outcomeId] : F.outcome[d.report.outcomeId]) + (d.report.extraFavor || 0);
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

  // ---------- antiques ----------
  // A spare is a copy beyond the first of an antique. The first copy stays, anchored or not.
  const copies = (id) => S().antiques.filter((x) => x === id).length;
  const spareCount = () => [...new Set(S().antiques)].reduce((a, id) => a + copies(id) - 1, 0);
  function sellSpares() {
    const s = S();
    let gain = 0;
    for (const id of new Set(s.antiques)) {
      const n = copies(id) - 1;
      if (n > 0) { gain += n * D.get('antiques.antiques.' + id).sell; s.antiques = s.antiques.filter((x, i) => x !== id || s.antiques.indexOf(x) === i); }
    }
    s.funds += gain;
    if (gain) ctx.save();
    return gain;
  }
  // The auto mode anchors every antique it holds, so each one opens its place or its event.
  function anchorFound() {
    const s = S();
    for (const id of new Set(s.antiques)) if (!s.locks.includes(id)) s.locks.push(id);
  }

  // ---------- recall ----------
  // Calling someone home early is a request. They come at once with a share of what the trip would have paid, in proportion to how far
  // it had got, and the story stops where it is. Someone who has decided to stay, or whose traits make them unwilling, does not come,
  // and a refusal is final for that trip.
  const RC = D.get('hiring.recall');
  function recall(id) {
    const s = S();
    const d = s.dispatches.find((x) => x.id === id);
    if (!d || d.claimed || d.recallRefused || d.readyDay <= day()) return { ok: false };
    if (ctx.backend.recallRefused(d.spec.staffId, d.spec.seed, d.report.outcomeId)) {
      d.recallRefused = true;
      ctx.save();
      return { ok: false, refused: true };
    }
    const p = perks();
    const f = clamp((day() - d.startDay) / (d.readyDay - d.startDay), 0, 1);
    d.claimed = true;
    d.recalled = true;
    d.recallDay = day();
    d.claimedAt = ctx.now();
    if (!s.visited.includes(d.eraId)) s.visited.push(d.eraId);
    d.stars = 0;
    d.paid = { energy: 0, funds: Math.round(d.payout.funds * f * (1 + p.funds_mult)), restDays: Math.ceil(d.payout.restDays * f), share: f };
    s.energy += d.paid.energy;
    s.funds += d.paid.funds;
    d.paid.antique = d.payout.antique && ctx.backend.recallKeeps(d.spec.seed, f) ? d.payout.antique : null;
    d.paid.duplicate = !!d.paid.antique && s.antiques.includes(d.paid.antique);
    if (d.paid.antique) s.antiques.push(d.paid.antique);
    const sf = s.staff[d.spec.staffId];
    sf.restUntil = day() + d.paid.restDays;
    sf.favor = clamp(sf.favor - RC.favor_loss, F.min, F.max);
    d.favorDelta = -RC.favor_loss;
    ctx.save();
    return { ok: true, d };
  }

  // ---------- hiring pool ----------
  // Two candidates are on offer. Hiring one brings a new one, and every refresh_days the whole offer is replaced.
  const HI = D.get('hiring');
  function register(id, def) {
    if (id in D.o.staff.staff) return;
    const { text, ...rest } = def;
    D.o.staff.staff[id] = rest;
    D.o.text.staff[id] = text[D.lang] || text.en;
  }
  // Every made employee goes into the wiki when they are made. To keep the save from growing without end only the latest wiki_max
  // are kept, and anyone on offer or ever hired stays.
  function trimGenerated() {
    const s = S();
    const keep = new Set(s.hire.slots.map((x) => x.id));
    let extra = Object.keys(s.generated).length - HI.wiki_max;
    for (const id of Object.keys(s.generated)) {
      if (extra <= 0) break;
      if (keep.has(id) || s.staff[id]) continue;
      delete s.generated[id];
      extra--;
    }
  }
  function addCandidate() {
    const s = S();
    const taken = new Set(s.hire.slots.map((x) => x.id));
    const free = Object.keys(D.get('staff.staff')).filter((id) => !D.get('staff.staff.' + id).generated && !(s.staff[id] && s.staff[id].hired) && !taken.has(id));
    s.hire.serial += 1;
    const c = ctx.backend.makeCandidate(s.hire.serial, free);
    if (c.def) { s.generated[c.id] = c.def; register(c.id, c.def); trimGenerated(); }
    s.hire.slots.push({ id: c.id });
  }
  function ensureHire() {
    const s = S();
    for (const [id, def] of Object.entries(s.generated)) register(id, def);
    if (!s.hire) s.hire = { slots: [], serial: 0, next: day() + HI.refresh_days };
    while (s.hire.slots.length < HI.slots) addCandidate();
  }
  function refreshHire() {
    const s = S();
    if (!s.hire || day() < s.hire.next) return;
    while (day() >= s.hire.next) s.hire.next += HI.refresh_days;
    s.hire.slots = [];
    ensureHire();
    ctx.save();
  }
  function hire(id) {
    const s = S();
    ensureHire();
    const slot = s.hire.slots.find((x) => x.id === id);
    if (!slot || s.funds < O.hire_cost) return false;
    s.funds -= O.hire_cost;
    if (s.generated[id]) {
      s.staff[id] = { restUntil: 0, hired: true, favor: F.start };
    } else {
      s.staff[id].hired = true;
    }
    s.hire.slots = s.hire.slots.filter((x) => x.id !== id);
    addCandidate();
    ctx.save();
    return true;
  }

  // ---------- wages ----------
  // Every hired person draws a cash wage per game day, from their skill. What the funds cannot cover is owed and is paid first from the next income,
  // and while anything is owed everybody on the payroll loses favor, so a broke office slowly loses goodwill instead of getting stuck.
  const wageOf = (id) => Math.round((O.wage_base + O.wage_skill * ctx.backend.staffStats(id).wit) * 10) / 10;
  const wageTotal = () => hiredIds().reduce((a, id) => a + wageOf(id), 0);
  function payWages(dt) {
    const s = S();
    const due = wageTotal() * dt + s.wageOwed;
    const pay = Math.min(Math.max(s.funds, 0), due);
    s.funds = Math.round((s.funds - pay) * 100) / 100;
    s.wageOwed = Math.round((due - pay) * 100) / 100;
    if (s.wageOwed > 0) for (const id of hiredIds()) s.staff[id].favor = clamp(s.staff[id].favor - O.unpaid_favor_loss * dt, F.min, F.max);
  }
  function dismiss(id) {
    const s = S();
    if (!s.staff[id].hired || hiredIds().length <= 1 || staffState(id) === 'away') return false;
    if (s.secretary === id) s.secretary = null;
    s.staff[id].hired = false;
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
  // Moves the clock and returns the dispatches that just came home. A new report pauses the clock unless the player ticked the box that lets reports pass.
  function advance(seconds) {
    const s = S();
    if (s.clock.speed > 0) {
      const dt = (s.clock.speed * seconds) / C.sec_per_day;
      s.clock.day += dt;
      payWages(dt);
    }
    refreshHire();
    const fresh = s.dispatches.filter((d) => !d.claimed && !d.notified && d.readyDay <= day());
    for (const d of fresh) d.notified = true;
    if (fresh.length && ctx.settings.get('pause_on_report')) s.clock.speed = 0;
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
  // The plots are the ideas the protagonist of the era can take up, so they are not chosen, the traveller brings all the ones the craft of the era allows.
  function plotsFor(eraId) {
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
    anchorFound();
    if (s.funds < A.sell_spares_below) sellSpares();
    restock();
    const eras = X.visibleEras().filter((id) => X.eraOpen(id));
    const stories = D.get('catalog.events').map((e) => e.id).filter((id) => s.locks.includes('relic_' + id));
    if (!eras.length && !stories.length) return;
    for (const staffId of hiredIds()) {
      if (staffState(staffId) !== 'ready') continue;
      const count = (id) => s.dispatches.filter((d) => d.eraId === id).length;
      // the places with a full simulation come first, a brief scene only when all of them are taken
      let free = eras.filter((id) => !eraBusy(id));
      if (!free.length) free = stories.filter((id) => !eraBusy(id));
      if (!free.length) break;
      const eraId = [...free].sort((a, b) => count(a) - count(b))[0];
      if (stories.includes(eraId)) { launchLight(eraId, staffId, (s.seq + 1) * D.get('config.engine.mc_seed_stride') % D.get('config.engine.seed_max') + 1, {}, { auto: true }); continue; }
      launch(eraId, { seed: (s.seq + 1) * D.get('config.engine.mc_seed_stride') % D.get('config.engine.seed_max') + 1, staffId, items: autoKit(eraId), }, { auto: true });
    }
    ctx.save();
  }

  // ---------- alerts and mainline ----------
  function alerts() {
    const readyReports = S().dispatches.filter((d) => !d.claimed && d.readyDay <= day()).length;
    return { home: readyReports };
  }
  function stageIndex() {
    const st = D.get('mainline.stages');
    let idx = 0;
    st.forEach((x, i) => { if (S().energy >= x.energy) idx = i; });
    return idx;
  }

  return { launchLight, recall, hire, ensureHire, eraBusy, plotsFor, sellSpares, spareCount, anchorFound, wageOf, wageTotal, dismiss, secretaryAim, perks, staffState, launch, claim, gift, appoint, setSpeed, togglePause, advance, autoStep, alerts, stageIndex, hiredIds };
}
