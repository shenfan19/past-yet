// Office rules without any DOM: the game clock, dispatch lifecycle, secretary and favor, the auto mode and the alerts.
// The clock is real time scaled by a speed, pausable like a grand strategy game. Everything is in game days.
import { staffTraits } from './narrate.js';
import { drawStartStaff } from './start.js';
import { applyFounder, pointsLeft } from './founder.js';

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
    const out = { sale_mult: 0, energy_mult: 0, rest_cut: 0, favor_gain: 0 };
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
    if (aim === 'antiques') return !!d.paid.antique;
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
    const full = { ...spec, plots: plotsFor(eraId), favor: s.staff[spec.staffId].favor, gear: staffGear(spec.staffId) };
    const err = ctx.backend.validate(eraId, full, s.inv);
    if (err || staffState(full.staffId) !== 'ready' || eraBusy(eraId)) return null;
    const { res, report } = ctx.backend.dispatch(eraId, full);
    const antique = ctx.backend.findAntique(eraId, full.seed, s.antiques, report.stars, ctx.backend.luckFactor(full.staffId, s.staff[full.staffId].favor));
    for (const [id, n] of Object.entries(full.items)) s.inv[id] = (s.inv[id] || 0) - n;
    s.seq += 1;
    if (s.seq === 1) startClock();
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
    const kit = Object.fromEntries(Object.entries(items).filter(([id, n]) => n > 0 && D.get('items.' + id).scene && !D.get('items.' + id).implant && (s.inv[id] || 0) >= n));
    const r = ctx.backend.runLight(eventId, staffId, seed, kit, s.staff[staffId].favor);
    const antique = r.keepAntique === false ? null : ctx.backend.findAntique(eventId, seed, s.antiques, r.stars, ctx.backend.luckFactor(staffId, s.staff[staffId].favor));
    for (const [id, n] of Object.entries(kit)) s.inv[id] -= n;
    s.seq += 1;
    if (s.seq === 1) startClock();
    const d = {
      id: 'd' + s.seq, eraId: eventId, light: true, stars: r.stars, max: ctx.backend.maxStars(eventId), baseEnergy: r.energyBase, spec: { seed, staffId, items: kit, plots: [], favor: s.staff[staffId].favor },
      report: { outcomeId: r.outcome, found: r.found || null, extraFavor: r.extraFavor || 0, points: Array.isArray(r.points) && typeof r.points[0] === 'boolean' ? r.points.map((hit, i) => ({ id: ['reach', 'meet', 'impress'][i], hit })) : r.points, accounts: { cost: 0, funds: r.funds, energy: r.energy, restDays: r.restDays, lives: 0 } },
      startDay: day(), readyDay: day() + r.stay, claimed: false, notified: false, auto: !!opts.auto, payout: { energy: 0, restDays: r.restDays, antique },
    };
    s.dispatches.push(d);
    ctx.save();
    return d;
  }

  // What of the kit comes home with the traveller. Anything with no loss rule, which is all the future technology, always comes back.
  // 'used' is spent in the story. On a fatal outcome 'fatal' gear is lost unless a 'rescue' item was carried, and the rescue item is spent doing it.
  function kitReturn(d) {
    const s = S();
    const kit = Object.entries(d.spec.items || {}).filter(([, n]) => n > 0);
    const fatal = !d.recalled && O.fatal_outcomes.includes(d.report.outcomeId);
    const rescued = kit.some(([id]) => D.get('items.' + id).loss === 'rescue');
    d.kit = { back: {}, lost: {} };
    for (const [id, n] of kit) {
      const loss = D.get('items.' + id).loss;
      const gone = loss === 'used' || (loss === 'rescue' && fatal) || (loss === 'fatal' && fatal && !rescued);
      d.kit[gone ? 'lost' : 'back'][id] = n;
      if (!gone) s.inv[id] = (s.inv[id] || 0) + n;
    }
  }

  // A summary of a finished trip that is kept for good. The full reports are dropped after max_archive trips, the summaries are not,
  // so the history of a place can always be listed, and a report can be opened as long as it is still stored.
  function tripOf(d) {
    const pts = d.report.points || [];
    return {
      id: d.id, place: d.eraId, light: !!d.light, staffId: d.spec.staffId, day: Math.floor(d.startDay), back: Math.floor(d.recalled ? d.recallDay : d.readyDay),
      stars: d.stars || 0, newBest: !!d.newBest, outcome: d.report.outcomeId, energy: d.paid?.energy || 0,
      antique: d.paid?.antique || null, recalled: !!d.recalled, found: d.report.found || null, items: Object.keys(d.spec.items || {}).filter((k) => d.spec.items[k] > 0),
      redeemed: pts.some((p) => p.redeem && p.hit), archived: false,
    };
  }
  function record(d) {
    const s = S();
    s.trips ||= [];
    s.trips.push(tripOf(d));
    if (s.trips.length > O.max_trips) s.trips.splice(0, s.trips.length - O.max_trips);
  }
  function ensureTrips() {
    const s = S();
    if (Array.isArray(s.trips)) return;
    s.trips = [];
    for (const d of s.dispatches.filter((x) => x.claimed).sort((a, b) => a.claimedAt - b.claimedAt)) record(d);
  }
  ensureTrips();
  const tripsOf = (placeId) => S().trips.filter((t) => t.place === placeId).reverse();
  // Archiving hides a trip from the log and keeps its report, up to max_archived_reports, the oldest going first. The summary and the tally of stars always stay.
  // The rule picks trips the way a person would: those that are not the best of their place.
  const live = () => S().trips.filter((t) => !t.archived);
  function archiveRule(rule) {
    const trips = live();
    // the best of a place is the newest of its most starred trips, every other trip of the place can go
    const keep = new Set();
    const byPlace = {};
    for (const t of trips) (byPlace[t.place] ||= []).push(t);
    for (const list of Object.values(byPlace)) keep.add(list.reduce((b, t) => ((t.stars || 0) >= (b.stars || 0) ? t : b)).id);
    return trips.filter((t) => !keep.has(t.id)).map((t) => t.id);
  }
  function archive(ids) {
    const set = new Set(ids);
    for (const t of S().trips) if (set.has(t.id)) t.archived = true;
    pruneReports();
    ctx.save();
  }
  function restore(ids) {
    const set = new Set(ids);
    for (const t of S().trips) if (set.has(t.id)) t.archived = false;
    ctx.save();
  }
  // Full reports are kept per place, the best one (most stars, then the newest) and the latest. Every other report goes, its summary stays.
  function pruneReports() {
    const s = S();
    const archived = new Set(s.trips.filter((x) => x.archived).map((x) => x.id));
    const keep = new Set();
    const byPlace = {};
    for (const x of s.dispatches.filter((y) => y.claimed && !archived.has(y.id))) (byPlace[x.eraId] ||= []).push(x);
    for (const list of Object.values(byPlace)) {
      const newest = (a, b) => b.claimedAt - a.claimedAt;
      list.slice().sort((a, b) => (b.stars || 0) - (a.stars || 0) || newest(a, b)).slice(0, O.keep_best).forEach((x) => keep.add(x.id));
      list.slice().sort(newest).slice(0, O.keep_latest).forEach((x) => keep.add(x.id));
    }
    s.dispatches.filter((y) => y.claimed && archived.has(y.id)).sort((a, b) => b.claimedAt - a.claimedAt).slice(0, O.max_archived_reports).forEach((x) => keep.add(x.id));
    s.dispatches = s.dispatches.filter((x) => !x.claimed || keep.has(x.id));
  }

  // What an employee has grown is kept in the save and added to their attributes when the game starts, so the cards stay as written.
  function applyGrowth() {
    for (const [id, sf] of Object.entries(S().staff)) for (const [a, n] of Object.entries(sf.growth || {})) D.o.staff.staff[id].base[a] = Math.min(10, (D.o.staff.staff[id].base[a] ?? 5) + n);
  }
  applyGrowth();
  // Every threes_per_point three star trips of an employee give one point to a random attribute that is not at 10 yet. Returns the attribute or null.
  function grow(id, seq) {
    const sf = S().staff[id];
    if (!sf.tally[3] || sf.tally[3] % O.threes_per_point) return null;
    const base = D.get('staff.staff.' + id).base;
    const open = D.get('staff.attributes').filter((a) => (base[a] ?? 5) < 10);
    if (!open.length) return null;
    const a = ctx.backend.pick(open, seq, 'grow|' + id);
    D.o.staff.staff[id].base[a] = (base[a] ?? 5) + 1;
    sf.growth = { ...(sf.growth || {}), [a]: ((sf.growth || {})[a] || 0) + 1 };
    return a;
  }

  function claim(id) {
    const s = S();
    const d = s.dispatches.find((x) => x.id === id);
    if (!d || d.claimed) return null;
    const p = perks();
    d.claimed = true;
    if (!s.visited.includes(d.eraId)) s.visited.push(d.eraId);
    kitReturn(d);
    d.claimedAt = ctx.now();
    // Time energy is paid for the stars above the best this place has had: a quarter of the base for one star, half for two, all of it for three,
    // and each trip pays the difference to what the best already paid, so a place cannot be farmed for energy.
    // Funds and antiques are paid every time.
    const best = s.stars[d.eraId] || 0;
    d.newBest = d.stars > best;
    const top = ctx.backend.maxStars(d.eraId);
    const energy = d.newBest ? d.baseEnergy * (ST.energy_share[top][d.stars] - ST.energy_share[top][best]) : 0;
    if (d.newBest) s.stars[d.eraId] = d.stars;
    const sf0 = s.staff[d.spec.staffId];
    d.paid = { energy: Math.round(energy * (1 + p.energy_mult)), restDays: Math.round(d.payout.restDays * (1 - p.rest_cut)) };
    s.energy += d.paid.energy;
    sf0.tally ||= { 3: 0, 2: 0, 1: 0 };
    // the tally counts in thirds of the stars of the place, so a five star story fills the same three cells
    if (d.stars > 0) sf0.tally[Math.ceil(d.stars * 3 / top)] += 1;
    d.paid.grown = d.stars === top ? grow(d.spec.staffId, S().seq) : null;
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
    // The next episode of the same person opens when this one has been visited: an event that names this one in `after` has its relic found and anchored.
    d.paid.opened = [];
    for (const e of D.get('catalog.events')) {
      if (!e.after) continue;
      const prev = D.get('catalog.events').find((x) => x.id === e.after);
      if (!prev || (d.eraId !== prev.id && d.eraId !== prev.era)) continue;
      const relic = 'relic_' + e.id;
      if (s.antiques.includes(relic)) continue;
      s.antiques.push(relic);
      if (!s.locks.includes(relic)) s.locks.push(relic);
      d.paid.opened.push(e.id);
    }
    record(d);
    s.dispatches.sort((a, b) => (a.claimedAt ?? Infinity) - (b.claimedAt ?? Infinity));
    pruneReports();
    ctx.save();
    return d;
  }

  // A reward costs the wage of F.gift_days days of that person, and lifts the mood by F.gift_gain.
  const giftCost = () => Math.round(F.gift_days * wageOf(hiredIds().length) / Math.max(1, hiredIds().length));
  function gift(id) {
    const s = S();
    const cost = giftCost();
    if (s.funds < cost || !s.staff[id].hired) return false;
    s.funds -= cost;
    s.staff[id].favor = clamp(s.staff[id].favor + F.gift_gain, F.min, F.max);
    ctx.save();
    return true;
  }

  // Until the first trip goes out the two random places of the start can be drawn again, other than the ones they were.
  function rerollStart() {
    const s = S();
    if (s.seq > 0 || !s.startRandom) return false;
    const out = new Set(s.startRandom);
    const pool = D.get('catalog.events').filter((e) => !e.after && !s.locks.includes('relic_' + e.id));
    const next = [];
    for (let i = 0; i < O.start_scenes.random && pool.length; i++) next.push('relic_' + pool.splice(Math.floor(Math.random() * pool.length), 1)[0].id);
    s.locks = s.locks.filter((x) => !out.has(x)).concat(next);
    s.antiques = s.antiques.filter((x) => !out.has(x)).concat(next);
    s.startRandom = next;
    ctx.save();
    return true;
  }

  // The founder is made and changed until the first trip goes out. Each change keeps the card inside the rules of config.founder and puts it back into the data.
  const FO = D.get('config.founder');
  function founderChange(fn) {
    const s = S();
    if (s.seq > 0) return false;
    const f = { ...s.founder, base: { ...s.founder.base }, traits: [...s.founder.traits] };
    if (fn(f) === false) return false;
    s.founder = f;
    applyFounder(D, f);
    ctx.save();
    return true;
  }
  const founderName = (v) => founderChange((f) => { f.name = String(v).slice(0, FO.name_max); });
  const founderGender = (g) => founderChange((f) => { if (!(g in D.get('staff.gender_class'))) return false; f.gender = g; });
  const founderSkin = (k) => founderChange((f) => { if (!(k in D.get('hiring.skin_tones'))) return false; f.skin = k; });
  const founderAttr = (a, d) => founderChange((f) => {
    if (!(a in f.base) || !(d === 1 || d === -1)) return false;
    const v = f.base[a] + d;
    if (v < FO.min || v > FO.max || (d === 1 && pointsLeft(D, f) <= 0)) return false;
    f.base[a] = v;
  });
  const founderTrait = (id) => founderChange((f) => {
    if (!(id in D.get('staff.traits'))) return false;
    if (f.traits.includes(id)) f.traits = f.traits.filter((x) => x !== id);
    else if (f.traits.length < FO.traits_max) f.traits.push(id);
    else return false;
  });

  // Until the first trip goes out the first employees can be picked from the candidates, or the candidates drawn again.
  function setStartPick(pick) {
    const s = S();
    for (const id of s.startStaff.offer) s.staff[id].hired = pick.includes(id);
    s.startStaff.pick = pick;
    s.hire = null;
    ctx.save();
  }
  function pickStart(id) {
    const s = S();
    if (s.seq > 0 || !s.startStaff || !s.startStaff.offer.includes(id)) return false;
    const pick = s.startStaff.pick;
    if (pick.includes(id)) { if (pick.length <= 1) return false; setStartPick(pick.filter((x) => x !== id)); return true; }
    if (pick.length >= O.start_staff.pick) return false;
    setStartPick([...pick, id]);
    return true;
  }
  function rerollStaff() {
    const s = S();
    if (s.seq > 0 || !s.startStaff) return false;
    for (const id of s.startStaff.offer) s.staff[id].hired = false;
    const next = drawStartStaff(D, O);
    s.startStaff = next;
    setStartPick(next.pick);
    return true;
  }

  // ---------- antiques ----------
  // A spare is a copy beyond the first of an antique. The first copy stays, anchored or not.
  // What an antique sells for today: its price, the market of its field, and the sale bonus of the secretary.
  const salePrice = (id) => Math.round(D.get('antiques.antiques.' + id).price * O.sale_scale * ctx.backend.marketMult(id, day()) * (1 + perks().sale_mult));
  const copies = (id) => S().antiques.filter((x) => x === id).length;
  const spareCount = () => [...new Set(S().antiques)].reduce((a, id) => a + copies(id) - 1, 0);
  function sellSpares() {
    const s = S();
    let gain = 0;
    for (const id of new Set(s.antiques)) {
      const n = copies(id) - 1;
      if (n > 0) { gain += n * salePrice(id); s.antiques = s.antiques.filter((x, i) => x !== id || s.antiques.indexOf(x) === i); }
    }
    s.funds += gain;
    if (gain) ctx.save();
    return gain;
  }
  // The auto mode anchors every new antique it holds, so each one opens its place or its event.
  // A piece it has anchored once is remembered, so a piece the player released by hand stays released and can be sold.
  function anchorFound() {
    const s = S();
    s.autoAnchored ||= [];
    for (const id of new Set(s.antiques)) {
      if (s.locks.includes(id) || s.autoAnchored.includes(id)) continue;
      s.locks.push(id);
      s.autoAnchored.push(id);
    }
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
    kitReturn(d);
    d.claimedAt = ctx.now();
    if (!s.visited.includes(d.eraId)) s.visited.push(d.eraId);
    d.stars = 0;
    d.paid = { energy: 0, restDays: Math.ceil(d.payout.restDays * f), share: f };
    s.energy += d.paid.energy;
    d.paid.antique = d.payout.antique && ctx.backend.recallKeeps(d.spec.seed, f) ? d.payout.antique : null;
    d.paid.duplicate = !!d.paid.antique && s.antiques.includes(d.paid.antique);
    if (d.paid.antique) s.antiques.push(d.paid.antique);
    const sf = s.staff[d.spec.staffId];
    sf.restUntil = day() + d.paid.restDays;
    sf.favor = clamp(sf.favor - RC.favor_loss, F.min, F.max);
    d.favorDelta = -RC.favor_loss;
    record(d);
    pruneReports();
    ctx.save();
    return { ok: true, d };
  }

  // ---------- hiring pool ----------
  // The candidates are the employees of the cards, the ones not hired and not already on offer, drawn with a seed. Hiring one brings another,
  // and every refresh_days the whole offer is replaced.
  const HI = D.get('hiring');
  function addCandidate() {
    const s = S();
    const taken = new Set(s.hire.slots.map((x) => x.id));
    const free = Object.keys(D.get('staff.staff')).filter((id) => !(s.staff[id] && s.staff[id].hired) && !taken.has(id));
    if (!free.length) return false;
    s.hire.serial += 1;
    s.hire.slots.push({ id: ctx.backend.pick(free, s.hire.serial, 'hire') });
    return true;
  }
  function ensureHire() {
    const s = S();
    if (!s.hire) s.hire = { slots: [], serial: 0, next: day() + HI.refresh_days };
    while (s.hire.slots.length < HI.slots && addCandidate());
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
    s.staff[id].hired = true;
    s.hire.slots = s.hire.slots.filter((x) => x.id !== id);
    addCandidate();
    ctx.save();
    return true;
  }

  // ---------- implants ----------
  // An implant is bought with time energy and then worn by one employee, up to the load cap. It adds to the attributes while worn and shows on every trip.
  const staffGear = (id) => S().staff[id].gear || [];
  const loadOf = (id) => staffGear(id).reduce((a, g) => a + D.get('items.' + g).load, 0);
  const loadCap = () => O.implant_load_cap;
  function equip(id, itemId) {
    const s = S();
    const it = D.get('items.' + itemId);
    if (!s.staff[id] || !s.staff[id].hired || !it.implant || staffState(id) === 'away') return false;
    if ((s.inv[itemId] || 0) < 1 || staffGear(id).includes(itemId) || loadOf(id) + it.load > loadCap()) return false;
    s.inv[itemId] -= 1;
    s.staff[id].gear = [...staffGear(id), itemId];
    ctx.save();
    return true;
  }
  function unequip(id, itemId) {
    const s = S();
    if (!s.staff[id] || !staffGear(id).includes(itemId) || staffState(id) === 'away') return false;
    s.staff[id].gear = staffGear(id).filter((g) => g !== itemId);
    s.inv[itemId] = (s.inv[itemId] || 0) + 1;
    ctx.save();
    return true;
  }

  // Letting someone go takes their implants off first and puts them back in the stock, so nothing bought with time energy is lost.
  function dismiss(id) {
    const s = S();
    if (id === s.founder.id || !s.staff[id].hired || hiredIds().length <= 1 || staffState(id) === 'away') return false;
    for (const g of staffGear(id)) s.inv[g] = (s.inv[g] || 0) + 1;
    s.staff[id].gear = [];
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

  // ---------- wages ----------
  const W = O.wage;
  // The wage of the whole staff of n people: the more of them, the more each costs, so the upkeep grows faster than the staff.
  const wageOf = (n) => n * W.base * (1 + W.step * (n - 1));
  const wageTotal = () => wageOf(hiredIds().length);
  // Settles every whole day that has passed since the last payment. What cannot be paid is not owed: the funds go to nothing and the staff lose favor.
  function payWages() {
    const s = S();
    if (s.wageDay == null) s.wageDay = Math.floor(day());
    while (Math.floor(day()) > s.wageDay) {
      s.wageDay += 1;
      const ids = hiredIds();
      const due = wageTotal();
      if (s.funds >= due) { s.funds -= due; continue; }
      s.funds = 0;
      s.unpaidDays = (s.unpaidDays || 0) + 1;
      for (const id of ids) s.staff[id].favor = clamp(s.staff[id].favor + W.unpaid_favor, F.min, F.max);
    }
  }

  // ---------- clock ----------
  // The speed the clock really runs at: when the funds pay fewer than low_funds_days days of wages it is held to low_funds_speed.
  const lowFunds = () => hiredIds().length > 0 && S().funds < C.low_funds_days * wageTotal();
  const effectiveSpeed = () => { const sp = S().clock.speed; return lowFunds() ? Math.min(sp, C.low_funds_speed) : sp; };
  // While a pop-up is open the clock stands still, and the speed that was set comes back when it closes.
  function holdClock() {
    const c = S().clock;
    if (c.resume != null) return;
    c.resume = c.speed;
    c.speed = 0;
    ctx.save();
  }
  function releaseClock() {
    const c = S().clock;
    if (c.resume == null) return;
    if (c.speed === 0) c.speed = c.resume;
    c.resume = null;
    ctx.save();
  }
  // The clock stands still until the first trip goes out, because nothing happens before it and the wages would only run down the funds.
  function startClock() {
    const c = S().clock;
    if (c.resume != null) c.resume = C.speeds[1]; else c.speed = C.speeds[1];
  }
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
      const dt = (effectiveSpeed() * seconds) / C.sec_per_day;
      s.clock.day += dt;
    }
    const unpaid0 = s.unpaidDays || 0;
    payWages();
    // an unpaid day stops the clock and asks for a decision
    if ((s.unpaidDays || 0) > unpaid0) { s.clock.speed = 0; s.brokeNew = true; }
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
  // Buying one piece of special equipment: the time shop is paid in time energy and the piece must be unlocked.
  function buyItem(id) {
    const s = S();
    const it = D.get('items.' + id);
    const sh = D.get('shops.shops.' + it.shop);
    if (!it.playable || it.ip || !sh.playable || it.unlock_energy > s.energy) return false;
    const cur = sh.currency === 'energy' ? 'energy' : 'funds';
    if (s[cur] < it.cost * it.step) return false;
    s[cur] -= it.cost * it.step;
    s.inv[id] = (s.inv[id] || 0) + it.step;
    return true;
  }
  // The kit for a story, found the way a person would: try every set of the special equipment the office owns, or could buy and still keep
  // its reserve, with the very seed the trip will have, and take the set that earns the most stars, the cheaper and the lighter first.
  // The kit is not a guess, the story is run on it. What is bought is only what the best set needs and the owned sets cannot match.
  const sceneItems = Object.keys(D.get('items')).filter((id) => D.get('items.' + id).scene && !D.get('items.' + id).implant);
  const nextSeed = () => ((S().seq + 1) * D.get('config.engine.mc_seed_stride')) % D.get('config.engine.seed_max') + 1;
  function planLight(eventId, staffId, seed, canBuy = true) {
    const s = S();
    const ev = D.get('catalog.events').find((x) => x.id === eventId);
    const favor = s.staff[staffId].favor;
    const none = { kit: {}, buy: [], stars: ctx.backend.runLight(eventId, staffId, seed, {}, favor).stars };
    if (!ev.scene) return none;
    const owned = sceneItems.filter((id) => (s.inv[id] || 0) > 0);
    const spend = Math.floor(s.energy * A.item_buy.energy_share);
    const buyable = canBuy ? sceneItems.filter((id) => !owned.includes(id) && D.get('items.' + id).unlock_energy <= s.energy && D.get('items.' + id).cost <= spend) : [];
    const pool = owned.concat(buyable);
    let best = null;
    for (let mask = 0; mask < (1 << pool.length); mask++) {
      const set = pool.filter((_, i) => mask & (1 << i));
      const buy = set.filter((id) => !owned.includes(id));
      const cost = buy.reduce((a, id) => a + D.get('items.' + id).cost, 0);
      if (cost > spend) continue;
      const kit = Object.fromEntries(set.map((id) => [id, 1]));
      const stars = ctx.backend.runLight(eventId, staffId, seed, kit, favor).stars;
      const key = [stars, -cost, -set.length];
      if (!best || key[0] > best.key[0] || (key[0] === best.key[0] && (key[1] > best.key[1] || (key[1] === best.key[1] && key[2] > best.key[2])))) best = { key, kit, buy, stars };
    }
    return best ? { kit: best.kit, buy: best.buy, stars: best.stars } : none;
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
  // Where the auto mode sends one idle employee, from the free places. The first rule that leaves any candidate decides, and the choice among
  // the candidates is a seeded draw, so a run can be replayed:
  //   1. a place nobody has come back from yet
  //   2. a place already visited whose best is below the top stars, and this employee has tried fewer than A.pick.breakthrough_tries times
  //   3. a place earlier in history than any this employee has been sent to, the earliest of those
  //   4. any free place
  function pickPlace(staffId, free, stories = []) {
    const s = S();
    const roll = (list) => ctx.backend.pick(list, s.seq + 1, 'auto_place|' + staffId);
    const year = ctx.backend.placeYear;
    // the trips of this person from the summaries that are kept for good, and the one in transit
    const mine = [...s.trips.filter((t) => t.staffId === staffId).map((t) => ({ eraId: t.place })), ...s.dispatches.filter((d) => !d.claimed && d.spec.staffId === staffId)];
    const tries = (id) => mine.filter((d) => d.eraId === id).length;
    const seed = nextSeed();
    const isStory = (id) => stories.includes(id);
    const rules = [
      ['unexplored', () => free.filter((id) => !s.visited.includes(id))],
      // a story already visited where this traveller, with the equipment the office has or can buy, would beat the best stars
      ['improvable', () => free.filter((id) => isStory(id) && s.visited.includes(id) && (s.stars[id] || 0) < ctx.backend.maxStars(id) && planLight(id, staffId, seed).stars > (s.stars[id] || 0))],
      ['breakthrough', () => free.filter((id) => s.visited.includes(id) && (s.stars[id] || 0) < ctx.backend.maxStars(id) && tries(id) < A.pick.breakthrough_tries)],
      ['farther', () => {
        const reach = Math.min(Infinity, ...mine.map((d) => year(d.eraId)));
        const older = free.filter((id) => year(id) < reach);
        const first = Math.min(...older.map(year));
        return older.filter((id) => year(id) === first);
      }],
      ['random', () => free],
    ];
    for (const [rule, pool] of rules) {
      const list = pool();
      if (list.length) return { eraId: roll(list), rule };
    }
    return null;
  }
  function autoStep() {
    const s = S();
    for (const d of s.dispatches.filter((x) => !x.claimed && x.readyDay <= day())) claim(d.id);
    anchorFound();
    if (s.funds < A.sell_spares_below) sellSpares();
    restock();
    const eras = X.visibleEras().filter((id) => X.eraOpen(id));
    const stories = D.get('catalog.events').filter((e) => !e.era).map((e) => e.id).filter((id) => s.locks.includes('relic_' + id));
    for (const staffId of hiredIds()) {
      if (staffState(staffId) !== 'ready') continue;
      const free = [...eras, ...stories].filter((id) => !eraBusy(id));
      if (!free.length) break;
      const { eraId } = pickPlace(staffId, free, stories);
      const seed = nextSeed();
      if (stories.includes(eraId)) {
        const plan = planLight(eraId, staffId, seed);
        for (const id of plan.buy) buyItem(id);
        launchLight(eraId, staffId, seed, plan.kit, { auto: true });
        continue;
      }
      launch(eraId, { seed, staffId, items: autoKit(eraId) }, { auto: true });
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

  return { salePrice, equip, unequip, staffGear, loadOf, loadCap, lowFunds, effectiveSpeed, holdClock, releaseClock, rerollStart, pickStart, rerollStaff, founderName, founderGender, founderSkin, founderAttr, founderTrait, grow, giftCost, archiveRule, archive, restore, wageOf, wageTotal, planLight, buyItem, tripsOf, launchLight, recall, hire, ensureHire, eraBusy, plotsFor, sellSpares, spareCount, anchorFound, dismiss, secretaryAim, perks, staffState, launch, claim, gift, appoint, setSpeed, togglePause, advance, autoStep, pickPlace, alerts, stageIndex, hiredIds };
}
