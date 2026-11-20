// The one door between the interface and the engine. The interface asks this object for results and shows them, it never runs the
// simulation itself and reads only the plain fields listed in eraInfo. This local version calls the engine in the same page.
// A server version would offer the same methods over fetch, with the yaml data and the engine on the server, and the page would only carry data.
import * as sim from './sim.js';
import { buildReport, weaveJourney, lightRecord, staffSaying } from './narrate.js';
import { draw } from './rng.js';
import { evalScene, pointDays } from './scene_core.js';
import { runStay, effectiveChannels } from './stay.js';
import { officeStay, historicalDays } from './travel_time.js';
import { participation } from './participation.js';
import { LMCore } from '../vendor/lm_core/index.js';

export function createLocalBackend(D, core = new LMCore({ model: D.get('core_model'), bridge: D.get('core_bridge') })) {
  const eras = {};
  for (const id of D.get('config.eras')) eras[id] = sim.compileEra(D.get('era_raw.' + id), D, id);
  // the place of an era: what its model says, and where the model is silent, what the card of its event says
  for (const [id, E] of Object.entries(eras)) {
    const ev = D.get('catalog.events').find((e) => e.era === id) || {};
    const m = E.raw.metadata.era;
    E.place = { home: m.home ?? ev.home ?? [], near: m.near ?? ev.near, region: m.region ?? ev.region, year: m.year, crossroads: !!(m.crossroads ?? ev.crossroads) };
  }
  // the plain data of an era that the interface may read, no functions
  const plain = (E) => ({ id: E.id, raw: E.raw, vars: E.vars, itemBindings: E.itemBindings, plots: E.plots, tech: E.tech, roles: E.roles, report: E.report, tagSource: E.tagSource, calendar: E.calendar });
  const info = Object.fromEntries(Object.entries(eras).map(([id, E]) => [id, plain(E)]));
  // Antique discovery. A trip to an era can bring back an antique from a place near it and from a year before it, never its own year or later. Each candidate
  // has a reach w = exp(-years / tau_years - km / tau_km), where years is how far earlier the candidate lies and km is the great circle
  // distance, so the farther in time or space, the less likely. A candidate is found with chance k * w. The trip finds something with
  // chance 1 - the product of (1 - k * w), at most cap, and the one it finds is drawn in proportion to w. The roll is seeded by the dispatch.
  const AF = D.get('config.office.antique_find');
  // Luck is read where a point or an antique is left to chance: a factor on the chance, one at luck 4, more above and less below, never past max_chance.
  const LK = D.get('config.office.luck');
  // what an employee wears is kept in the game state, so the backend asks for it through a function the page sets
  let gearSource = () => [];
  // the points the secretary makes sure of for a traveller, guard and fulfil, also set by the page
  let sureSource = () => [];
  // The test employees of the developer mode: V, dev_only max, carries every item and wears every implant, whatever was packed; King, dev_only min, carries and wears nothing.
  const devKind = (staffId) => D.get('staff.staff')[staffId]?.dev_only || null;
  const allItems = () => Object.fromEntries(Object.keys(D.get('items')).filter((id) => !D.get('items.' + id).implant).map((id) => [id, 1]));
  const allImplants = () => Object.keys(D.get('items')).filter((id) => D.get('items.' + id).implant);
  const gearOf = (staffId) => (devKind(staffId) === 'max' ? allImplants() : devKind(staffId) === 'min' ? [] : gearSource(staffId) || []);
  const kitOf = (staffId, items) => (devKind(staffId) === 'max' ? allItems() : devKind(staffId) === 'min' ? {} : items);
  // the attributes of a day of the stay, kept with the body for the report, rounded to a tenth so a saved report stays small
  const bodyAttrs = (stats) => Object.fromEntries(Object.entries(stats || {}).map(([k, v]) => [k, Math.round(v * 10) / 10]));
  const luckFactor = (staffId, mood = null) => LK.base + LK.per_point * sim.staffAttrs(D, staffId, mood, gearOf(staffId)).luck;
  const rad = (x) => (x * Math.PI) / 180;
  const km = (a, b) => {
    const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
    return 2 * AF.earth_km * Math.asin(Math.min(1, Math.sqrt(h)));
  };
  const placeOf = (an) => {
    if (an.era) { const m = info[an.era].raw.metadata.era; return { year: m.year, geo: m.geo }; }
    if (an.event) { const e = D.get('catalog.events').find((x) => x.id === an.event); return { year: e.year, geo: { lon: e.lon, lat: e.lat } }; }
    return null;
  };
  function findOdds(eraId) {
    const here = info[eraId] ? placeOf({ era: eraId }) : placeOf({ event: eraId });
    const all = D.get('antiques.antiques');
    const list = [];
    for (const [id, an] of Object.entries(all)) {
      if (!an.playable) continue;
      const at = placeOf(an);
      if (!at || at.year >= here.year) continue;
      list.push({ id, w: Math.exp(-(here.year - at.year) / AF.tau_years - km(here.geo, at.geo) / AF.tau_km) });
    }
    const p = Math.min(AF.cap, 1 - list.reduce((a, x) => a * (1 - AF.k * x.w), 1));
    return { p, list };
  }
  // An antique that points to a place with a simulation, and is not held yet, is favoured by modelled_place_boost when it is drawn, so the way to a place that can be dispatched to is not buried under the many events that have no model yet.
  // The chance is scaled by the stars of the trip: a quarter of it with none, half with one, three quarters with two, all of it with three.
  function findAntique(eraId, seed, held = [], stars = 3, luck = 1) {
    const { p, list } = findOdds(eraId);
    if (!list.length || draw(seed, 'antique_find', eraId) >= Math.min(LK.max_chance, p * AF.star_share[maxStars(eraId)][Math.max(0, Math.min(maxStars(eraId), stars))] * luck)) return null;
    const all = D.get('antiques.antiques');
    const wt = (x) => x.w * (all[x.id].era && !held.includes(x.id) ? AF.modelled_place_boost : 1);
    const total = list.reduce((a, x) => a + wt(x), 0);
    let at = draw(seed, 'antique_pick', eraId) * total;
    for (const x of list) { at -= wt(x); if (at < 0) return x.id; }
    return list[list.length - 1].id;
  }
  // ---------- hiring ----------
  const HI = D.get('hiring');
  // a recall is only a request. Someone who has decided to stay does not come, and for anyone else the refusal is a roll at the base chance
  function recallRefused(staffId, seed, outcomeId) {
    if (D.get('staff.staff')[staffId]?.dev_only) return false;
    if (outcomeId === HI.recall.stay_outcome) return true;
    return draw(seed, 'recall_refuse', staffId) < HI.recall.refuse_base;
  }
  // A small story: a catalogue event with no branch simulation. How the trip goes is the traveller's abilities, weighted by the field of the event,
  // against a difficulty that rises with its tier, with a little seeded luck. It pays by outcome and brings nothing else.
  const L = D.get('config.light');
  // two thirds of the stars or more is a success, any is a partial, none is missed
  const outcomeOf = (stars, n) => (stars * 3 >= 2 * n ? 'success' : stars > 0 ? 'partial' : 'missed');
  // how many stars a place can give: a scene has one per sync point, everything else three
  // The stamp on a report is read from three things: how the employee came back, how many of the stars were won, and whether the branch came out
  // different from the main timeline. The words are all kind, the least of them is to try again, so no trip is told it failed. See config.stamp.
  function stampOf(d) {
    const ST = D.get('config.stamp');
    const back = d.recalled ? ST.recalled : d.evacuation ? ST.evacuated : (ST.returns[d.report?.outcomeId] || ST.default_return);
    const max = maxStars(d.eraId);
    const n = d.evacuation ? 0 : (d.stars || 0);
    const won = n >= max ? 'full' : n > 0 ? 'part' : 'none';
    const C = d.report?.compare;
    const changed = !!C && C.deathsBranch < C.deathsBase - ST.changed_margin;
    const key = back + '_' + won;
    return changed && ST.changed[key] ? ST.changed[key] : key;
  }
  // The line the employee says at the head of a report: the words the card of a full model gives for this ending, when the employee was let in,
  // otherwise the catchphrase of the employee for the stamp, see staffSaying in narrate.js.
  // the same for a trip whose full report is gone: the words kept in its summary, or the catchphrase for its stamp
  const sayingOfTrip = (t) => t.quote || staffSaying(D, t.staffId, t.stamp, t.id);
  // The echo of a trip, 5.15 of the story outline: a recorded line of the person of the place, picked by the tier the trip falls in.
  // A tier with no line falls back along config.echo.fallback; of two lines in a tier, one whose fit names a trait or tag of the employee comes first,
  // and otherwise the seed of the trip decides, so a report shows the same line every time. Returns the id of a quote, or null.
  const personOfEvent = {};
  for (const p of D.get('encyclopedia.sections.people') || []) for (const e of p.events || []) personOfEvent[e] = p.id;
  const echoTier = (d) => {
    const E = D.get('config.echo');
    if (d.report?.outcomeId === 'desync') return 'desync';
    const s = d.stars || 0, m = maxStars(d.eraId);
    if (d.report?.journey?.accepted === false || s === 0) return 'none';
    return s >= m ? 'full' : s / m > E.most_share ? 'most' : 'some';
  };
  const echoOf = (d) => {
    if (!d || d.recalled || d.evacuation || !d.report) return null;
    const ev = d.light ? d.eraId : D.get('catalog.events').find((e) => e.era === d.eraId)?.id;
    const person = ev && personOfEvent[ev];
    if (!person) return null;
    const mine = Object.entries(D.get('quotes.quotes') || {}).filter(([, q]) => q.person === person && q.tier);
    if (!mine.length) return null;
    const first = echoTier(d);
    for (const tier of [first, ...D.get('config.echo.fallback')[first]]) {
      const lines = mine.filter(([, q]) => q.tier === tier);
      if (!lines.length) continue;
      const tags = sim.staffTags(D, d.spec.staffId);
      const traits = D.get('staff.staff.' + d.spec.staffId + '.traits') || [];
      const fits = lines.filter(([, q]) => q.fit && ((q.fit.traits || []).some((t) => traits.includes(t)) || (q.fit.tags || []).some((t) => tags.has(t))));
      const pool = fits.length ? fits : lines;
      return pool[(Math.abs(Math.trunc(d.spec.seed || 0)) + Number(String(d.id).replace(/\D/g, '') || 0)) % pool.length][0];
    }
    return null;
  };
  const sayingOf = (d) => (!d.light && d.report?.journey?.accepted !== false && d.report?.quote) || staffSaying(D, d.spec.staffId, stampOf(d), d.id);
  // the stars of a place: those of its full model, also when it is asked by the event the model stands at, else the points of the small story
  const maxStars = (id) => { if (info[id]) return info[id].raw.star_points.length; const e = D.get('catalog.events').find((x) => x.id === id); if (e?.era && info[e.era]) return info[e.era].raw.star_points.length; return e && e.scene && !e.era ? e.scene.points.length : D.get('config.stars.max'); };
  const lightEvent = (eventId) => D.get('catalog.events').find((x) => x.id === eventId);
  const lightStay = (eventId) => { const e = lightEvent(eventId); return officeStay(D, e.stay || L.stay_by_tier[e.tier]); };
  const namedIn = (req, id) => Object.entries(req || {}).some(([k, v]) => (k === 'item' && v === id) || (k === 'any' && v.some((r) => namedIn(r, id))));
  const namedBy = (ev, id) => !!ev?.scene?.points?.some((p) => namedIn(p.req, id));
  const lightKitAllowed = (eventId, itemId) => {
    const it = D.get('items.' + itemId);
    // a plain item may come along when it eases a channel of the story or a sync point of the story asks for it, such as antibiotics to heal someone
    return !it.implant && (it.scene || it.channels.some((c) => lightEvent(eventId).channels?.[c] && !D.get('config.channels.off').includes(c)) || namedBy(lightEvent(eventId), itemId));
  };
  // the pressure of a story the traveller would feel: the live channels of the event at their level, and what is left of them after the kit, the gear worn and the traits
  const pressureOf = (eventId, staffId = null, items = {}, favor = null) => {
    const ev = lightEvent(eventId);
    const off = D.get('config.channels.off');
    const live = Object.fromEntries(Object.entries(ev?.channels || {}).filter(([c]) => !off.includes(c)));
    if (!staffId || !D.get('config.body.enabled')) return { base: live, left: live };
    const kit = sceneKit(staffId, items, favor);
    return { base: live, left: effectiveChannels(D, { channels: live }, staffId, kit.props, kit.carried.filter((id) => D.get('items.' + id).scene)) };
  };
  const eraStay = (id) => officeStay(D, info[id].vars[info[id].roles.stay].value);
  const travelHealth = (id, spec, stay, ev = lightEvent(id)) => {
    if (!D.get('config.body.enabled') || !ev || !Object.keys(ev.channels || {}).length) return null;
    return runStay(D, core, ev, { staffId: spec.staffId, seed: spec.seed, ...sceneKit(spec.staffId, spec.items, spec.favor), historicalDays: historicalDays(D, stay) });
  };
  const evacuated = (health) => ({
    evacuation: health.evacuation, stars: 0, points: [], outcome: 'missed', keepAntique: false,
    restDays: D.get('config.body.incapacity.rest_days'), energyBase: 0,
    stay: health.evacuation.day / D.get('config.travel.history_days_per_office_day'),
  });
  // who the traveller is taken for: the first identity of the place that fits. A place with a model names its identities in the model, an event may name them in its card,
  // and otherwise the default list is used. The place is the home regions, the part of the world, the year and whether it is a crossroads.
  const placeOfEvent = (ev) => ({ home: ev.home || [], near: ev.near, region: ev.region, year: ev.year, crossroads: !!ev.crossroads });
  const identityOf = (eraId, ev, staffId) => (info[eraId]
    ? sim.identityFor(D, staffId, eras[eraId].place, info[eraId].raw.identities)
    : sim.identityFor(D, staffId, placeOfEvent(ev), ev.identities));
  function participationFor(ev, spec, days, health, stats) {
    const statsAt = (day) => health?.trace.findLast((row) => row.day <= day)?.stats || stats;
    return participation(D, ev.tier, historicalDays(D, days), spec, statsAt, (stage) => draw(spec.seed, 'participation_' + stage, ev.id));
  }
  // A trait is worth something at the sync points. Each point is about one kind of thing, and the traits of the employee add up to a bonus for that kind:
  // a point that was missed is still reached with the chance of the bonus, and a negative bonus loses a point that was reached. The draw is seeded.
  const traitBonus = (staffId, kind) => D.get('staff.staff.' + staffId + '.traits').reduce((a, t) => a + (D.get('staff.traits.' + t).points[kind] || 0), 0);
  function applyBonus(points, kinds, staffId, seed, key) {
    // a test employee is read on the requirements alone, so the same story gives the same stars every time
    if (devKind(staffId)) return points;
    return points.map((p, i) => {
      const b = traitBonus(staffId, kinds[i]);
      const r = draw(seed, 'bonus_' + key + '_' + p.id, 0);
      if (!p.hit && b > 0 && r < Math.min(0.9, b)) return { ...p, hit: true, bonus: true };
      if (p.hit && b < 0 && r < Math.min(0.9, -b)) return { ...p, hit: false, lost: true };
      return p;
    });
  }
  // A scene: three points the traveller meets or does not by what they are, and what they carry. Being found out costs stars, rest and favor.
  const SC = D.get('config.scene');
  // what the traveller has on in a scene: the attributes after the items, the items that count, and how much of it shows
  function sceneKit(staffId, items0, favor) {
    const items = kitOf(staffId, items0);
    const gear = gearOf(staffId);
    const stats = { ...sim.staffAttrs(D, staffId, favor, gear) };
    const carried = [...new Set([...Object.entries(items || {}).filter(([id, n]) => n > 0 && D.get('items.' + id).scene).map(([id]) => id), ...gear])];
    let exposure = 0;
    // V carries everything and is never the weaker for it: nothing shows and no item takes from the attributes
    if (devKind(staffId) !== 'max') for (const id of carried) {
      const it = D.get('items.' + id);
      exposure += it.exposure;
      for (const [k, m] of Object.entries(it.stat_mult || {})) stats[k] *= m;
    }
    const props = Object.entries(items || {}).filter(([id, n]) => n > 0 && !D.get('items.' + id).scene).map(([id]) => id);
    return { stats, carried, exposure, props };
  }
  function vignetteFor(variants, staffId) {
    if (!variants) return undefined;
    const traits = D.get('staff.staff.' + staffId + '.traits');
    return variants.find((v) => !v.traits || v.traits.some((t) => traits.includes(t)))?.id;
  }

  function runScene(ev, staffId, seed, items, favor, health) {
    const { stats, carried, exposure } = sceneKit(staffId, items, favor);
    // the sync points are met by the scene sub core. With the body on, the stay is stepped through the core of the traveller and each point is met on the attributes of its day;
    // with it off, or when the caller gives its own attributes of the day, the attributes do not change in the stay
    const { props } = sceneKit(staffId, items, favor);
    // a sync point reads every item carried, the scene items and gear and also the plain items, so a point may ask for antibiotics
    const hits = health?.hits ?? evalScene(D, ev, { staffId, seed, carried: [...carried, ...props], statsAt: () => stats });
    const points = applyBonus(ev.scene.points.map((p, i) => ({ id: p.id, hit: hits[i], ...(p.redeem ? { redeem: true } : {}), ...(p.guard ? { guard: true } : {}) })), ev.scene.points.map((p) => p.kind), staffId, seed, ev.id);
    const days = pointDays(D, ev);
    // The secretary can make one point sure. guard holds the earliest guard point that was missed. fulfil wins the earliest fulfil point when none was won,
    // and it still has to be reached: a missed guard before it sends the traveller back first, below.
    const earliest = (test) => points.map((p, i) => i).filter((i) => test(points[i])).reduce((a, i) => (a < 0 || days[i] < days[a] ? i : a), -1);
    const sure = sureSource(staffId) || [];
    if (sure.includes('guard')) { const i = earliest((p) => p.guard && !p.hit); if (i >= 0) points[i] = { ...points[i], hit: true, lost: false, sure: true }; }
    if (sure.includes('fulfil') && !points.some((p) => !p.guard && p.hit)) { const i = earliest((p) => !p.guard); if (i >= 0) points[i] = { ...points[i], hit: true, lost: false, sure: true }; }
    // a guard point holds a recorded event in place. When it is missed the branch falls out of step with history: the traveller is sent back on that day,
    // and the points after it are never reached
    // the points are listed in any order, so the first missed guard is the one with the earliest day, and the points cut are those that fall after it
    const missed = points.map((p, i) => i).filter((i) => points[i].guard && !points[i].hit);
    const cutAt = missed.length ? missed.reduce((a, i) => (days[i] < days[a] ? i : a)) : -1;
    if (cutAt >= 0) for (let i = 0; i < points.length; i++) if (days[i] > days[cutAt]) points[i] = { ...points[i], hit: false, bonus: false, sure: false, cut: true };
    let stars = points.filter((p) => p.hit).length;
    // being found out: the more equipment shows and the more suspicious the time, the likelier
    const chance = Math.min(SC.max_discovery, Math.max(0, exposure) * SC.suspicion_by_tier[ev.tier]);
    let found = null;
    if (carried.length && draw(seed, 'scene_found', ev.id) < chance) {
      const r = draw(seed, 'scene_found_kind', ev.id);
      found = Object.keys(SC.found).find((k) => r < SC.found[k].at);
    }
    const f = found ? SC.found[found] : null;
    if (f) stars = Math.max(0, stars - f.stars_cost);
    const pay = L.pay[ev.tier];
    const kind = cutAt >= 0 ? 'desync' : outcomeOf(stars, points.length);
    const vignette = vignetteFor(ev.scene.vignettes, staffId);
    // sent back on the day of the guard point, so the stay is cut to the office days it took
    const cutDay = cutAt >= 0 ? days[cutAt] : null;
    const stay = cutAt >= 0 ? Math.min(lightStay(ev.id), Math.max(1, Math.ceil(cutDay / D.get('config.travel.history_days_per_office_day')))) : lightStay(ev.id);
    return { points, stars, found, vignette, keepAntique: f ? f.keep_antique : true, extraRest: f ? f.rest_days : 0, extraFavor: f ? f.favor : 0,
      energyBase: pay.energy, restDays: L.rest_days[kind] + (f ? f.rest_days : 0), stay, outcome: kind, cutDay };
  }
  function runLight(eventId, staffId, seed, items, favor = null, { estimate = false } = {}) {
    const ev = lightEvent(eventId);
    const health = estimate ? null : travelHealth(eventId, { staffId, seed, items, favor }, lightStay(eventId), ev);
    if (health?.evacuation) return evacuated(health);
    const stats = sceneKit(staffId, items, favor).stats;
    const identity = identityOf(null, ev, staffId);
    const journey = { ...participationFor(ev, { staffId, seed, items, identity }, lightStay(eventId), health, stats), identity: identity.id };
    if (ev.scene) {
      const r = runScene(ev, staffId, seed, items, favor, health);
      const days = pointDays(D, ev);
      const timed = r.points.map((p, i) => ({ ...p, day: days[i] }));
      if (!journey.accepted) {
        const missedTrip = { ...r, points: timed.map((p) => ({ id: p.id, day: p.day, redeem: p.redeem, hit: false })), stars: 0,
          journey, vignette: null, found: null, extraFavor: 0, restDays: L.rest_days.missed, keepAntique: false, outcome: 'missed' };
        return { ...missedTrip, timeline: lightRecord(D, ev, missedTrip, staffId, historicalDays(D, lightStay(eventId)), sim.staffTags(D, staffId, placeOfEvent(ev))), body: health ? health.trace.map((x) => ({ day: x.day, ...x.readouts, attrs: bodyAttrs(x.stats) })) : null };
      }
      const done = { ...r, points: timed, journey };
      // after a desync the record and the body stop on the day the traveller was sent back
      const lastDay = r.cutDay ?? historicalDays(D, lightStay(eventId));
      return { ...done, timeline: lightRecord(D, ev, done, staffId, lastDay, sim.staffTags(D, staffId, placeOfEvent(ev))), body: health ? health.trace.filter((x) => x.day <= lastDay).map((x) => ({ day: x.day, ...x.readouts, attrs: bodyAttrs(x.stats) })) : null };
    }
    const score = Object.entries(L.field_weights[ev.field]).reduce((a, [k, w]) => a + w * stats[k] / 10, 0);
    const margin = score + L.noise * (2 * draw(seed, 'light', eventId) - 1) - (L.difficulty.base + L.difficulty.per_tier * ev.tier);
    const points = applyBonus([margin >= L.cuts.reach, margin >= L.cuts.meet, margin >= L.cuts.impress].map((hit, i) => ({ id: ['reach', 'meet', 'impress'][i], hit })), L.kinds, staffId, seed, eventId)
      .map((p) => journey.accepted ? p : { ...p, hit: false, bonus: false, lost: false });
    const stars = points.filter((p) => p.hit).length;
    const outcome = stars >= 2 ? 'success' : stars === 1 ? 'partial' : 'missed';
    const pay = L.pay[ev.tier];
    const plain = { outcome, stars, points, journey, keepAntique: journey.accepted, energyBase: pay.energy, restDays: L.rest_days[outcome], stay: lightStay(eventId) };
    return { ...plain, timeline: lightRecord(D, ev, plain, staffId, historicalDays(D, lightStay(eventId)), sim.staffTags(D, staffId, placeOfEvent(ev))), body: health ? health.trace.map((x) => ({ day: x.day, ...x.readouts, attrs: bodyAttrs(x.stats) })) : null };
  }
  // The market price factor of an antique on a day: one seeded draw per field and per period, so every antique of a field moves together.
  const MK = D.get('config.office.market');
  const marketMult = (antiqueId, dayNo) => 1 + MK.amp * (2 * draw(Math.floor(dayNo / MK.period_days), 'market', D.get('antiques.antiques.' + antiqueId).tags[0]) - 1);
  const recallKeeps = (seed, share) => draw(seed, 'recall_keep', 0) < share;
  return {
    // the star points of a full model with their guard flags, and the year of its place, for the record of an employee and the IF lines
    modelPoints: (id) => (eras[id] ? { points: eras[id].starPoints, year: info[id].raw.metadata.era.year } : null),
    runLight, lightStay, lightKitAllowed, pressureOf, eraStay, historicalDays: (days) => historicalDays(D, days), maxStars, marketMult, luckFactor, recallRefused, recallKeeps,
    // the stay of a traveller through the body, for the tools and the report: which points were met and the body day by day
    runStay: (eventId, staffId, seed, items, favor = null) => runStay(D, core, lightEvent(eventId), { staffId, seed, ...sceneKit(staffId, items, favor) }),
    findOdds, findAntique, stampOf, sayingOf, sayingOfTrip, echoOf, echoTier,
    // the year of a simulated place or a catalogue event, and a seeded pick from a list, both for the auto mode
    placeYear: (id) => (info[id] ? placeOf({ era: id }) : placeOf({ event: id })).year,
    pick: (list, seed, key) => list[Math.min(list.length - 1, Math.floor(draw(seed, key, 0) * list.length))],
    eraInfo: (id) => info[id],
    // the identity an employee would take in a place, and the tags of the employee there, for the dispatch sheet and the checks
    identityOf: (id, staffId) => identityOf(info[id] ? id : null, lightEvent(id), staffId),
    staffTags: (id, staffId) => [...sim.staffTags(D, staffId, info[id] ? eras[id].place : placeOfEvent(lightEvent(id)))],
    staffStats: (staffId, mood = null) => sim.staffAttrs(D, staffId, mood, gearOf(staffId)),
    staffAttrMax: sim.STAFF_ATTR_MAX,
    staffBase: (staffId) => sim.staffAttrs(D, staffId, null, [], { boost: false }),
    setGearSource: (fn) => { gearSource = fn; },
    setSureSource: (fn) => { sureSource = fn; },
    staffHabit: (staffId) => sim.staffHabit(D, staffId),
    itemTotals: (items) => sim.itemTotals(D, items),
    // returns an error code, or null when the dispatch is allowed
    validate: (eraId, spec, stock) => sim.validateSpec(eras[eraId], D, spec, stock),
    // runs one dispatch and returns the raw result and the written report
    dispatch: (eraId, spec) => {
      const ev = D.get('catalog.events').find((e) => e.era === eraId);
      const health = ev ? travelHealth(eraId, spec, eraStay(eraId), { ...ev, scene: null }) : null;
      if (health?.evacuation) return { evacuation: evacuated(health) };
      const identity = identityOf(eraId, ev, spec.staffId);
      const journey = { ...participationFor(ev || { id: eraId, tier: 1 }, { ...spec, identity }, eraStay(eraId), health, sceneKit(spec.staffId, spec.items, spec.favor).stats), identity: identity.id };
      const res = sim.runDispatch(eras[eraId], D, { ...spec, journey, identity });
      const vignetteId = journey.accepted ? vignetteFor(ev?.scene?.vignettes ?? info[eraId].raw.metadata.vignettes, spec.staffId) : null;
      const vignetteText = vignetteId ? (D.get('text.catalog')[ev?.id]?.vignettes ?? D.get('text.eras')[eraId].vignettes)?.[vignetteId] : null;
      const vignetteTraits = vignetteId ? (ev?.scene?.vignettes ?? info[eraId].raw.metadata.vignettes).find((x) => x.id === vignetteId)?.traits : null;
      const report = weaveJourney(D, eras[eraId], res, buildReport(D, eras[eraId], res), journey, vignetteText, vignetteTraits);
      report.journey = journey;
      report.vignette = vignetteId;
      // the body of the traveller through the stay, as LM reads it, for the part of the report that shows it
      report.body = health ? health.trace.map((x) => ({ day: x.day, ...x.readouts, attrs: bodyAttrs(x.stats) })) : null;
      if (!journey.accepted) report.outcomeName = D.get('text.ui.report.participation.title_missed');
      const SP = eras[eraId].starPoints;
      if (!journey.accepted) report.points = report.points.map((p) => ({ ...p, hit: false }));
      else if (info[eraId].raw.star_trait_bonus !== false) report.points = applyBonus(report.points, SP.map((p) => p.kind), spec.staffId, spec.seed, eraId);
      // A guard point of a model holds a recorded event by its day of the stay. Missed, the trip falls out of sync on that day, as in a small story:
      // the points whose milestones come later are not reached, the lines of the employee after it are dropped, and the traveller comes home that day.
      const arrived = res.branch.arrivedDay ?? 0;
      const milestoneDay = (p) => res.branch.log.find((e) => e.kind === 'milestone' && e.id === p.milestone)?.t;
      report.points = report.points.map((p, i) => ({ ...p, ...(SP[i].guard ? { guard: true } : {}) }));
      const missedGuard = journey.accepted ? SP.map((p, i) => ({ p, i })).filter(({ p, i }) => p.guard && !report.points[i].hit && typeof p.day === 'number').sort((a, b) => a.p.day - b.p.day)[0] : null;
      if (missedGuard) {
        const cut = arrived + missedGuard.p.day;
        report.points = report.points.map((p, i) => (i !== missedGuard.i && (milestoneDay(SP[i]) ?? Infinity) > cut ? { ...p, hit: false, cut: true } : p));
        report.timeline = report.timeline.filter((x) => x.tag === 'history' || x.t <= cut);
        report.outcomeId = 'desync';
        report.outcomeName = D.get('text.ui.light.outcome.desync');
        report.cutStay = Math.max(1, Math.ceil(missedGuard.p.day / D.get('config.travel.history_days_per_office_day')));
        report.restDays = (res.restDays || 0) + L.rest_days.desync;
      }
      report.stars = report.points.filter((p) => p.hit).length;
      return { res, report };
    },
    // searches item sets and returns the Pareto front and the recommended one
    suggest: (eraId, spec, stock) => sim.optimize(eras[eraId], D, { spec, stock }),
  };
}
