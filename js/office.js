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
  // the test employees of the developer mode, King and V, take no wage, keep their mood, rest no day and are always recalled
  const isDev = (id) => !!D.get('staff.staff')[id]?.dev_only;
  const paidIds = () => hiredIds().filter((id) => !isDev(id));
  // only one employee can be in a place at a time, the simulation cannot yet hold two travellers in one place
  const ST = D.get('config.stars');
  function tripAntique(id, seed, staffId, stars) {
    const s = S();
    return ctx.backend.findAntique(id, seed, s.antiques, stars, ctx.backend.luckFactor(staffId, s.staff[staffId].favor));
  }
  const eraBusy = (eraId) => S().dispatches.some((d) => !d.claimed && d.eraId === eraId);
  const canDispatchTo = (id, light, auto = false) => {
    if (light && !D.get('catalog.active_events').some((e) => e.id === id)) return false;
    return (X.DEV && !auto) || (light ? X.anchored('relic_' + id) : X.eraOpen(id));
  };

  // What the secretary gives the agency, one thing from each trait: a share on the sale price, the mood growth or the rest, an attribute lent to every
  // traveller (the attribute of the secretary over attr_divisor, rounded), or a point of a story made sure, a guard point held or a fulfil point won.
  const SEC = D.get('config.office.secretary');
  const PERK_SHARES = ['sale_mult', 'rest_cut', 'favor_gain'];
  function perks() {
    const out = { sale_mult: 0, rest_cut: 0, favor_gain: 0, attrs: {}, sure: [] };
    const id = S().secretary;
    if (!id) return out;
    const own = ctx.backend.staffBase(id);
    for (const t of staffTraits(D, id)) {
      for (const [k, v] of Object.entries(D.get('staff.traits.' + t).secretary)) {
        if (PERK_SHARES.includes(k)) out[k] += v;
        else if (k === 'attr') out.attrs[v] = (out.attrs[v] || 0) + Math.round(own[v] / SEC.attr_divisor);
        else if (k === 'sure') { if (!out.sure.includes(v)) out.sure.push(v); }
        else throw new Error('未知的秘书能力 ' + k + '，特质 ' + t);
      }
    }
    return out;
  }
  // what the secretary lends one traveller; the secretary lends nothing to themselves, and the test employees take nothing
  const lent = (staffId) => (!S().secretary || staffId === S().secretary || isDev(staffId) ? null : perks());
  const boostOf = (staffId) => lent(staffId)?.attrs || {};
  const sureOf = (staffId) => lent(staffId)?.sure || [];
  // the attributes and the stories read these, so every trip, estimate and sheet sees the secretary of the moment
  D.staffBoost = boostOf;
  ctx.backend.setSureSource(sureOf);
  // The rest after a trip: the rest of its outcome and rest_per_stay_day for each office day away, rounded up, then cut by the secretary.
  const restOf = (d, outcomeRest, rest_cut) => Math.round((outcomeRest + Math.ceil((d.readyDay - d.startDay) * O.rest_per_stay_day)) * (1 - rest_cut));

  function staffState(id) {
    if (S().secretary === id) return 'secretary';
    if (S().dispatches.some((d) => d.spec.staffId === id && !d.claimed)) return 'away';
    if ((S().staff[id].restUntil || 0) > day()) return 'resting';
    return 'ready';
  }

  function launch(eraId, spec, opts = {}) {
    if (!canDispatchTo(eraId, false, opts.auto)) return null;
    const s = S();
    const full = { ...spec, plots: plotsFor(eraId), favor: s.staff[spec.staffId].favor, gear: staffGear(spec.staffId) };
    const err = ctx.backend.validate(eraId, full, s.inv);
    if (err || staffState(full.staffId) !== 'ready' || eraBusy(eraId)) return null;
    const { res, report, evacuation } = ctx.backend.dispatch(eraId, full);
    if (evacuation) return launchEvacuation(eraId, full, evacuation, opts);
    const antique = report.journey?.accepted === false ? null : tripAntique(eraId, full.seed, full.staffId, report.stars);
    for (const [id, n] of Object.entries(full.items)) s.inv[id] = (s.inv[id] || 0) - n;
    s.seq += 1;
    if (s.seq === 1) startClock();
    // a trip of a full model that fell out of sync comes home on the day it was sent back, with the rest of a desync
    const stay = report.cutStay ?? ctx.backend.eraStay(eraId);
    const d = { id: 'd' + s.seq, eraId, spec: full, report, stars: report.stars, baseEnergy: D.get('config.stars.energy_base.' + eraId), startDay: day(), readyDay: day() + stay, claimed: false, notified: false, auto: !!opts.auto, payout: { energy: 0, funds: res.funds, restDays: report.restDays ?? res.restDays, antique } };
    s.dispatches.push(d);
    ctx.save();
    return d;
  }

  // A small story to a catalogue event, with no simulated branch.
  const LT = D.get('config.light');
  function launchLight(eventId, staffId, seed, items = {}, opts = {}) {
    const s = S();
    if (!canDispatchTo(eventId, true, opts.auto) || staffState(staffId) !== 'ready' || eraBusy(eventId)) return null;
    const kit = Object.fromEntries(Object.entries(items).filter(([id, n]) => n > 0 && ctx.backend.lightKitAllowed(eventId, id) && (s.inv[id] || 0) >= n));
    const r = ctx.backend.runLight(eventId, staffId, seed, kit, s.staff[staffId].favor);
    if (r.evacuation) return launchEvacuation(eventId, { seed, staffId, items: kit, favor: s.staff[staffId].favor }, r, opts, true);
    const antique = r.keepAntique === false ? null : tripAntique(eventId, seed, staffId, r.stars);
    for (const [id, n] of Object.entries(kit)) s.inv[id] -= n;
    s.seq += 1;
    if (s.seq === 1) startClock();
    const d = {
      id: 'd' + s.seq, eraId: eventId, light: true, stars: r.stars, max: ctx.backend.maxStars(eventId), baseEnergy: r.energyBase, spec: { seed, staffId, items: kit, plots: [], favor: s.staff[staffId].favor },
      report: { outcomeId: r.outcome, journey: r.journey, found: r.found || null, extraFavor: r.extraFavor || 0, vignette: r.vignette, timeline: r.timeline || null, body: r.body || null, points: Array.isArray(r.points) && typeof r.points[0] === 'boolean' ? r.points.map((hit, i) => ({ id: ['reach', 'meet', 'impress'][i], hit })) : r.points, accounts: { cost: 0, funds: r.funds, energy: r.energy, restDays: r.restDays, lives: 0 } },
      startDay: day(), readyDay: day() + r.stay, claimed: false, notified: false, auto: !!opts.auto, payout: { energy: 0, restDays: r.restDays, antique },
    };
    s.dispatches.push(d);
    ctx.save();
    return d;
  }

  function launchEvacuation(eraId, spec, result, opts, light = false) {
    const s = S();
    for (const [id, n] of Object.entries(spec.items)) s.inv[id] -= n;
    s.seq += 1;
    if (s.seq === 1) startClock();
    const d = { id: 'd' + s.seq, eraId, light, spec, stars: 0, baseEnergy: 0, evacuation: result.evacuation,
      report: { outcomeId: 'missed', points: [], accounts: { lives: 0 } },
      startDay: day(), readyDay: day() + result.stay, claimed: false, notified: false, auto: !!opts.auto,
      payout: { energy: 0, restDays: result.restDays, antique: null } };
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
      stars: d.stars || 0, newBest: !!d.newBest, outcome: d.report.outcomeId, stamp: ctx.backend.stampOf(d), energy: d.paid?.energy || 0,
      antique: d.paid?.antique || null, recalled: !!d.recalled, evacuated: !!d.evacuation && !d.recalled, found: d.report.found || null, items: Object.keys(d.spec.items || {}).filter((k) => d.spec.items[k] > 0),
      // won: the points met on this trip, which the timeline of the wiki and the record of the employee read after the full report is dropped
      redeemed: pts.some((p) => p.redeem && p.hit), won: pts.filter((p) => p.hit).map((p) => p.id), archived: false,
      // quote: the words of the card of a full model said on this trip, kept so the record can show them after the full report is dropped
      quote: (!d.light && d.report.journey?.accepted !== false && d.report.quote) || null,
      // echo: the recorded line of the person this trip was given, 5.15 of the story outline
      echo: d.echo || null,
    };
  }
  // the points a finished trip met: kept in its summary, or read from the full report for a summary written before it kept them
  function wonOf(t) {
    if (Array.isArray(t.won)) return t.won;
    const d = S().dispatches.find((x) => x.id === t.id);
    return (d?.report?.points || []).filter((p) => p.hit).map((p) => p.id);
  }
  // The stars of small stories won so far, each once, on the earliest trip that won it: { event, point, guard, trip }.
  // keep(t) narrows the trips, for the record of one employee. A trip sent out of sync keeps the stars it won before.
  function winsOf(keep = () => true) {
    const out = new Map();
    const T = D.get('text');
    const trips = (S().trips || []).filter((t) => keep(t)).slice().sort((a, b) => a.back - b.back || a.day - b.day);
    for (const t of trips) {
      // a small story reads its scene and catalogue card; a full model reads its star points and its own words, and its catalogue event when it has one
      const ev = D.get('catalog.events').find((x) => (t.light ? x.id === t.place : x.era === t.place));
      const model = t.light ? null : ctx.backend.modelPoints(t.place);
      const defs = t.light ? ev?.scene?.points : model?.points;
      if (!defs) continue;
      const words = t.light ? T.catalog[t.place] : { points: T.eras[t.place]?.star_points, shift: T.eras[t.place]?.shift };
      for (const pid of wonOf(t)) {
        const pt = defs.find((p) => p.id === pid);
        const key = t.place + '|' + pid;
        if (pt && !out.has(key)) out.set(key, { event: ev?.id || null, place: t.place, light: !!t.light, point: pid, guard: !!pt.guard, trip: t,
          year: t.light ? ev.year : model.year, where: ev ? T.catalog[ev.id].place : T.eras[t.place]?.short, star: words?.points?.[pid], shift: words?.shift?.[pid] });
      }
    }
    return [...out.values()];
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

  // Backfill personal records from retained history before counting any new results.
  const modelStories = new Map(D.get('catalog.events').filter((e) => e.era).map((e) => [e.era, e.id]));
  const storyKey = (id) => modelStories.get(id) || id;
  function storyBests(id) {
    const sf = S().staff[id];
    if (sf.storyBests) return sf.storyBests;
    ensureTrips();
    const bests = {};
    for (const t of S().trips) {
      if (t.staffId !== id || t.recalled) continue;
      const key = storyKey(t.place);
      if (t.stars > (bests[key] || 0)) bests[key] = t.stars;
    }
    sf.storyBests = bests;
    return bests;
  }
  const growthStars = (id) => Object.values(storyBests(id)).reduce((sum, stars) => sum + stars, 0);
  function grow(id, place, stars, seq) {
    const sf = S().staff[id];
    const bests = storyBests(id);
    const key = storyKey(place);
    const previous = bests[key] || 0;
    if (stars <= previous) return null;
    const before = growthStars(id);
    bests[key] = stars;
    if (Math.floor(before / O.stars_per_point) === Math.floor((before + stars - previous) / O.stars_per_point)) return null;
    const base = ctx.backend.staffBase(id);
    const open = D.get('staff.attributes').filter((a) => base[a] < ctx.backend.staffAttrMax);
    if (!open.length) return null;
    const a = open.includes(sf.training) ? sf.training : ctx.backend.pick(open, seq, 'grow|' + id);
    sf.growth = { ...(sf.growth || {}), [a]: ((sf.growth || {})[a] || 0) + 1 };
    return a;
  }
  function setTraining(id, attr) {
    const sf = S().staff[id];
    if (!sf?.hired || isDev(id)) return false;
    if (attr && (!D.get('staff.attributes').includes(attr) || ctx.backend.staffBase(id)[attr] >= ctx.backend.staffAttrMax)) return false;
    if (attr) sf.training = attr;
    else delete sf.training;
    ctx.save();
    return true;
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
    d.paid = { energy: Math.round(energy), restDays: restOf(d, d.payout.restDays, p.rest_cut), restCut: p.rest_cut };
    s.energy += d.paid.energy;
    d.paid.grown = grow(d.spec.staffId, d.eraId, d.stars, Number(d.id.slice(1)));
    // the echo is fixed when the report is taken, and the line counts as heard, so the page of the person shows it from now on instead of its question marks
    d.echo = ctx.backend.echoOf(d);
    s.heard ||= [];
    if (d.echo && !s.heard.includes(d.echo)) s.heard.push(d.echo);
    d.paid.antique = d.payout.antique || null;
    d.paid.duplicate = !!d.paid.antique && s.antiques.includes(d.paid.antique);
    if (d.paid.antique) s.antiques.push(d.paid.antique);
    const sf = s.staff[d.spec.staffId];
    sf.restUntil = isDev(d.spec.staffId) ? day() : day() + d.paid.restDays;
    const delta = (d.light || d.evacuation ? LT.favor[d.report.outcomeId] : F.outcome[d.report.outcomeId]) + (d.report.extraFavor || 0);
    d.favorDelta = delta > 0 ? delta * (1 + p.favor_gain) : delta;
    if (!isDev(d.spec.staffId)) sf.favor = clamp(sf.favor + d.favorDelta, F.min, F.max);
    record(d);
    s.dispatches.sort((a, b) => (a.claimedAt ?? Infinity) - (b.claimedAt ?? Infinity));
    pruneReports();
    ctx.save();
    return d;
  }

  // A reward costs the wage of F.gift_days days of that person, and lifts the mood by F.gift_gain.
  const giftCost = () => Math.round(F.gift_days * wageOf(paidIds().length) / Math.max(1, paidIds().length));
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
    const pool = D.get('catalog.active_events').filter((e) => !s.locks.includes('relic_' + e.id));
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

  const randomIndex = (length) => Math.floor(Math.random() * length);
  const pickRandom = (values) => values[randomIndex(values.length)];
  const rerollFounder = () => founderChange((f) => {
    const names = D.get('text.ui.welcome.founder_names');
    const attrs = D.get('staff.attributes');
    const traits = Object.keys(D.get('staff.traits'));
    f.name = pickRandom(names);
    f.gender = pickRandom(Object.keys(D.get('staff.gender_class')));
    f.skin = pickRandom(Object.keys(D.get('hiring.skin_tones')));
    f.base = Object.fromEntries(attrs.map((id) => [id, FO.min]));
    for (let left = pointsLeft(D, f); left > 0; left--) {
      const available = attrs.filter((id) => f.base[id] < FO.max);
      if (!available.length) break;
      f.base[pickRandom(available)]++;
    }
    f.traits = [];
    while (f.traits.length < FO.traits_max && traits.length) {
      f.traits.push(...traits.splice(randomIndex(traits.length), 1));
    }
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
  function grantQuote(id, secretary = perks().sale_mult) {
    const { amp, grant_step, rarity } = O.market;
    const nominal = D.get('antiques.antiques.' + id).price * O.sale_scale;
    const marketGrant = nominal * ctx.backend.marketMult(id, day());
    const chance = ctx.backend.bestRepeatFindChance(id);
    const rarityBias = chance === undefined ? 0 : rarity.max_adjustment * (1 - 2 * clamp((chance - rarity.rare_chance) / (rarity.common_chance - rarity.rare_chance), 0, 1));
    const adjusted = clamp(marketGrant + rarityBias, nominal * (1 - amp), nominal * (1 + amp));
    const base = Math.round(adjusted / grant_step) * grant_step;
    const bonus = Math.round(base * secretary);
    return { base, bonus, total: base + bonus };
  }
  const salePrice = (id) => grantQuote(id).total;
  function spareOffers(tier = null) {
    const counts = new Map();
    for (const id of S().antiques) counts.set(id, (counts.get(id) || 0) + 1);
    const secretary = perks().sale_mult;
    return [...counts].filter(([, n]) => n > 1).flatMap(([id, n]) => {
      const quote = grantQuote(id, secretary);
      return tier === null || quote.base === tier ? [{ id, n: n - 1, price: quote.total }] : [];
    });
  }
  function sellSpares(targetFunds = Infinity, persist = true, tier = null) {
    const s = S();
    const sold = new Map();
    let gain = 0;
    const spares = spareOffers(tier);
    const limited = Number.isFinite(targetFunds);
    if (limited) spares.sort((a, b) => a.price - b.price);
    for (const { id, n, price } of spares) {
      const shortfall = targetFunds - s.funds - gain;
      if (shortfall <= 0) break;
      if (limited && price <= 0) continue;
      const qty = limited ? Math.min(n, Math.ceil(shortfall / price)) : n;
      sold.set(id, qty);
      gain += qty * price;
    }
    if (sold.size) {
      const kept = new Set();
      s.antiques = s.antiques.filter((id) => {
        if (!kept.has(id)) { kept.add(id); return true; }
        const remove = sold.get(id) || 0;
        if (remove === 0) return true;
        sold.set(id, remove - 1);
        return false;
      });
      s.funds += gain;
      if (persist) ctx.save();
    }
    return gain;
  }
  // The auto mode anchors every new antique it holds, so each one opens its place or its event.
  // Remember antiques auto mode has already anchored and antiques the player has explicitly released.
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
    d.paid = { energy: 0, restDays: Math.ceil(restOf(d, d.payout.restDays, p.rest_cut) * f), share: f };
    s.energy += d.paid.energy;
    d.paid.antique = d.payout.antique && ctx.backend.recallKeeps(d.spec.seed, f) ? d.payout.antique : null;
    d.paid.duplicate = !!d.paid.antique && s.antiques.includes(d.paid.antique);
    if (d.paid.antique) s.antiques.push(d.paid.antique);
    const sf = s.staff[d.spec.staffId];
    sf.restUntil = isDev(d.spec.staffId) ? day() : day() + d.paid.restDays;
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
  function addCandidate(previous = new Set()) {
    const s = S();
    const taken = new Set(s.hire.slots.map((x) => x.id));
    const free = Object.keys(D.get('staff.staff')).filter((id) => !(s.staff[id] && s.staff[id].hired) && !taken.has(id));
    if (!free.length) return false;
    const newcomers = free.filter((id) => !previous.has(id));
    s.hire.serial += 1;
    s.hire.slots.push({ id: ctx.backend.pick(newcomers.length ? newcomers : free, s.hire.serial, 'hire') });
    return true;
  }
  function ensureHire() {
    const s = S();
    if (!s.hire) s.hire = { slots: [], serial: 0, next: day() + HI.refresh_days };
    const refresh = day() >= s.hire.next;
    const previous = new Set();
    if (refresh) {
      for (const { id } of s.hire.slots) previous.add(id);
      s.hire.next += (Math.floor((day() - s.hire.next) / HI.refresh_days) + 1) * HI.refresh_days;
      s.hire.slots = [];
    }
    while (s.hire.slots.length < HI.slots && addCandidate(previous));
    if (refresh) ctx.save();
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
  const wageTotal = () => wageOf(paidIds().length);
  // Settles every whole day that has passed since the last payment. What cannot be paid is not owed: the funds go to nothing and the staff lose favor.
  function payWages() {
    const s = S();
    if (s.wageDay == null) s.wageDay = Math.floor(day());
    while (Math.floor(day()) > s.wageDay) {
      s.wageDay += 1;
      const ids = paidIds();
      const due = wageTotal();
      if (s.clock.auto && s.funds < due) sellSpares(due, false);
      if (s.funds >= due) { s.funds -= due; continue; }
      s.funds = 0;
      s.unpaidDays = (s.unpaidDays || 0) + 1;
      for (const id of ids) s.staff[id].favor = clamp(s.staff[id].favor + W.unpaid_favor, F.min, F.max);
    }
  }

  // ---------- clock ----------
  // The speed the clock really runs at: when the funds pay fewer than low_funds_days days of wages it is held to low_funds_speed.
  const lowFunds = () => paidIds().length > 0 && S().funds < C.low_funds_days * wageTotal();
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
    const before = day();
    if (s.clock.speed > 0) {
      const dt = (effectiveSpeed() * seconds) / C.sec_per_day;
      s.clock.day += dt;
    }
    for (const id of paidIds()) {
      const sf = s.staff[id];
      const rested = Math.min(day(), sf.restUntil || 0) - before;
      if (id !== s.secretary && rested > 0 && sf.favor < F.start) sf.favor = Math.min(F.start, sf.favor + rested * F.rest_recovery_per_day);
    }
    const unpaid0 = s.unpaidDays || 0;
    payWages();
    // an unpaid day stops the clock and asks for a decision
    if ((s.unpaidDays || 0) > unpaid0) { s.clock.speed = 0; s.brokeNew = true; }
    if (s.hire && day() >= s.hire.next) ensureHire();
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
  const nextSeed = () => ((S().seq + 1) * D.get('config.engine.mc_seed_stride')) % D.get('config.engine.seed_max') + 1;
  const lightKits = new Map(D.get('catalog.active_events').filter((event) => !event.era && event.scene)
    .map((event) => [event.id, ctx.backend.lightPlanItems(event)]));
  function planLight(eventId, staffId, seed) {
    const s = S();
    const spend = Math.floor(s.energy * A.item_buy.energy_share);
    const favor = s.staff[staffId].favor;
    const score = (kit) => ctx.backend.runLight(eventId, staffId, seed, kit, favor, { estimate: true }).stars;
    let best = { kit: {}, buy: [], cost: 0, size: 0, stars: score({}) };
    const pool = (lightKits.get(eventId) || []).flatMap((id) => {
      if ((s.inv[id] || 0) >= 1) return [{ id, cost: 0, purchase: false }];
      const item = D.get('items.' + id);
      const shop = D.get('shops.shops.' + item.shop);
      const cost = item.cost * item.step;
      return !item.ip && shop.playable && shop.currency === 'energy' && item.unlock_energy <= s.energy && cost <= spend
        ? [{ id, cost, purchase: true }] : [];
    });
    function search(start, kit, buy, cost) {
      for (let i = start; i < pool.length; i += 1) {
        const item = pool[i];
        const total = cost + item.cost;
        if (total > spend) continue;
        const next = { ...kit, [item.id]: 1 };
        const orders = item.purchase ? [...buy, item.id] : buy;
        const stars = score(next);
        const size = Object.keys(next).length;
        if (stars > best.stars || (stars === best.stars && (total < best.cost || (total === best.cost && size < best.size)))) {
          best = { kit: next, buy: orders, cost: total, size, stars };
        }
        search(i + 1, next, orders, total);
      }
    }
    if (best.stars < ctx.backend.maxStars(eventId)) search(0, {}, [], 0);
    return best;
  }
  function restock(reserve) {
    const s = S();
    for (const [id, target] of Object.entries(A.buy_target)) {
      const it = D.get('items.' + id);
      if (!it.playable || !D.get('shops.shops.' + it.shop).playable) continue;
      while ((s.inv[id] || 0) + it.step <= target && s.funds - it.cost * it.step >= reserve) {
        s.funds -= it.cost * it.step;
        s.inv[id] = (s.inv[id] || 0) + it.step;
      }
    }
  }
  // Auto explores new places, then rotates among the routes this employee has tried least.
  function pickPlace(staffId, free) {
    const s = S();
    if (!free.length) return null;
    const newPlaces = free.filter((id) => !s.visited.includes(id));
    const attempts = new Map();
    for (const trip of s.trips) {
      if (trip.staffId === staffId && !trip.recalled) attempts.set(trip.place, (attempts.get(trip.place) || 0) + 1);
    }
    const least = Math.min(...free.map((id) => attempts.get(id) || 0));
    const pool = newPlaces.length ? newPlaces : free.filter((id) => (attempts.get(id) || 0) === least);
    return { eraId: ctx.backend.pick(pool, s.seq + 1, 'auto_place|' + staffId), rule: newPlaces.length ? 'unexplored' : 'rotation' };
  }
  function autoStep() {
    const s = S();
    for (const d of s.dispatches.filter((x) => !x.claimed && x.readyDay <= day())) claim(d.id);
    anchorFound();
    const reserve = Math.max(A.reserve_funds, wageTotal() * A.wage_reserve_days);
    if (s.funds < reserve) sellSpares(reserve);
    restock(reserve);
    const eras = X.visibleEras().filter((id) => X.eraOpen(id));
    const stories = D.get('catalog.active_events').filter((e) => !e.era).map((e) => e.id).filter((id) => s.locks.includes('relic_' + id));
    // the automatic mode sends the paid staff only, never the test employees
    for (const staffId of paidIds()) {
      if (staffState(staffId) !== 'ready') continue;
      const free = [...eras, ...stories].filter((id) => !eraBusy(id));
      if (!free.length) break;
      const route = pickPlace(staffId, free);
      if (!route) continue;
      const { eraId } = route;
      const seed = nextSeed();
      if (stories.includes(eraId)) {
        const plan = planLight(eraId, staffId, seed);
        s.energy -= plan.cost;
        for (const id of plan.buy) s.inv[id] = (s.inv[id] || 0) + D.get('items.' + id).step;
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

  return { wonOf, winsOf, salePrice, grantQuote, equip, unequip, staffGear, loadOf, loadCap, lowFunds, effectiveSpeed, holdClock, releaseClock, rerollStart, pickStart, rerollStaff, founderName, founderGender, founderSkin, founderAttr, founderTrait, rerollFounder, grow, growthStars, setTraining, giftCost, archiveRule, archive, restore, wageOf, wageTotal, tripsOf, launchLight, recall, hire, ensureHire, eraBusy, canDispatchTo, plotsFor, sellSpares, spareOffers, anchorFound, dismiss, perks, boostOf, sureOf, staffState, launch, claim, gift, appoint, setSpeed, togglePause, advance, autoStep, pickPlace, planLight, alerts, stageIndex, hiredIds };
}
