// Economy probe: plays new games in the page with the automatic mode and reports the funds, the staff and the antiques over the days.
// Two ways of playing: auto leaves it alone, human sells the spares and then the cheapest door that can be let go when the funds run short, and hires when they are rich.
// Usage: node tools/in_probe_economy.mjs runs days policy [key=value ...]
// Policies: auto (stop at unpaid wage), idle (sell to resume), human (sell and hire).
// Options: k base step hire start scale mindoors cushion sec team nodup (suppress duplicate finds only).
// Needs PLAYWRIGHT_DIR, as ui_check does. A run of 6 games and 120 days takes about three minutes.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const pwDir = process.env.PLAYWRIGHT_DIR || 'C:/fight/life-matters-reference-engine/gui';
const { chromium } = createRequire(path.join(pwDir, 'x.js'))('playwright');
const [runs, days, policy] = [Number(process.argv[2] || 8), Number(process.argv[3] || 150), process.argv[4] || 'auto'];
const over = Object.fromEntries(process.argv.slice(5).map((a) => a.split('=')).map(([k, v]) => [k, Number(v)]));
const port = await new Promise((res) => { const srv = net.createServer(); srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => res(p)); }); });
const server = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 100; i++) { try { if ((await fetch(`http://127.0.0.1:${port}/index.html`)).ok) break; } catch (e) { /* not up */ } await new Promise((r) => setTimeout(r, 200)); }
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
page.setDefaultTimeout(290000);
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`http://127.0.0.1:${port}/index.html?lang=en`);
await page.waitForSelector('#tabs button');
const res = await page.evaluate(async ({ runs, days, policy, over }) => {
  const g = window.__game, o = g.ui.office, D = g.D;
  // overrides of the config, by name
  const AF = D.get('config.office.antique_find'), W = D.get('config.office.wage'), OF = D.get('config.office');
  if (over.k) AF.k = over.k;
  if (over.base) W.base = over.base;
  if (over.step !== undefined) W.step = over.step;
  if (over.hire) OF.hire_cost = over.hire;
  if (over.scale) OF.sale_scale = over.scale;
  if (over.start) OF.start_funds = over.start;
  const findAntique = g.ctx.backend.findAntique;
  if (over.nodup) g.ctx.backend.findAntique = (...args) => {
    const found = findAntique(...args);
    return g.ctx.S().antiques.includes(found) ? null : found;
  };
  const active = D.get('catalog.active_events').map((e) => ({ route: e.era || e.id, antique: e.era
    ? Object.keys(D.get('antiques.antiques')).find((id) => D.get('antiques.antiques')[id].era === e.era)
    : 'relic_' + e.id, max: g.ctx.backend.maxStars(e.era || e.id) }));
  const out = [];
  for (let r = 0; r < runs; r++) {
    g.ctx.reset();
    const S = g.ctx.S();
    S.welcomed = true; S.trips = S.trips || []; g.ui.state.modal = null; S.clock.auto = true; S.clock.resume = null;
    const f = { firstUnpaid: null, sells: 0, hires: 0, staffAt: {}, fundsAt: {}, antiquesAt: {}, spareSold: 0 };
    const step = 0.25;
    const releasable = (id) => {
      const an = D.get('antiques.antiques.' + id);
      if (!an.era) return true;
      if (S.dispatches.some((d) => !d.claimed && d.eraId === an.era)) return false;
      return S.locks.some((x) => x !== id && D.get('antiques.antiques.' + x).era);
    };
    // team=N: the agency is hired up to N people at the start and stays at that size
    if (over.team) { for (let i = 0; i < 50 && o.hiredIds().length < over.team; i++) { o.ensureHire(); const slot = S.hire.slots[0]; if (!slot || !o.hire(slot.id)) break; } }
    if (over.sec && o.hiredIds().length >= over.sec) {
      const candidate = o.hiredIds().find((id) => id !== S.founder.id);
      if (candidate) o.appoint(candidate);
    }
    f.stops = 0; f.stopsLate = 0;
    for (let t = 0; t < days / step; t++) {
      S.clock.speed = 1;
      const unpaid0 = S.unpaidDays || 0;
      S.brokeNew = false;
      o.advance(step * D.get('config.clock.sec_per_day'));
      if ((S.unpaidDays || 0) > unpaid0 && f.firstUnpaid === null) f.firstUnpaid = Math.floor(S.clock.day);
      if (policy === 'auto' && (S.unpaidDays || 0) > unpaid0) { f.stops += 1; break; }
      // idle: the player leaves the auto mode on; each time a wage cannot be paid the clock stops, and the player sells the spares, then the cheapest antique
      // that can be let go, keeping two, and lets it run again
      if (policy === 'idle' && (S.unpaidDays || 0) > unpaid0) {
        f.stops += 1; if (S.clock.day >= 60) f.stopsLate += 1;
        o.sellSpares();
        const ids = [...new Set(S.antiques)].filter((id) => releasable(id) && D.get('antiques.antiques.' + id).price > 0).sort((a, b) => D.get('antiques.antiques.' + a).price - D.get('antiques.antiques.' + b).price);
        if (S.funds < o.wageTotal() && ids.length > 2) { const id = ids[0]; S.funds += o.salePrice(id); S.antiques.splice(S.antiques.indexOf(id), 1); if (!S.antiques.includes(id)) { S.locks = S.locks.filter((x) => x !== id); S.autoAnchored = (S.autoAnchored || []).filter((x) => x !== id); } f.sells += 1; }
      }
      o.autoStep();
      // sec=N: once N people are hired, the first ready one besides the founder becomes the secretary
      if (over.sec && !S.secretary && o.hiredIds().length >= over.sec) { const id = o.hiredIds().find((x) => x !== S.founder.id && o.staffState(x) === 'ready'); if (id) o.appoint(id); }
      const wageTotal = o.wageTotal();
      if (policy === 'human') {
        // short of money: sell the spares, then the cheapest door that can be let go
        if (S.funds < 2 * wageTotal) {
          const got = o.sellSpares();
          if (got) f.spareSold += 1;
          if (S.funds < 2 * wageTotal && new Set(S.antiques).size > (over.mindoors ?? 4)) {
            const ids = [...new Set(S.antiques)].filter((id) => releasable(id) && D.get('antiques.antiques.' + id).price > 0).sort((a, b) => D.get('antiques.antiques.' + a).price - D.get('antiques.antiques.' + b).price);
            if (ids.length) {
              const id = ids[0];
              S.funds += D.get('antiques.antiques.' + id).price;
              S.antiques.splice(S.antiques.indexOf(id), 1);
              if (!S.antiques.includes(id)) { S.locks = S.locks.filter((x) => x !== id); S.autoAnchored = (S.autoAnchored || []).filter((x) => x !== id); }
              f.sells += 1;
            }
          }
        }
        // rich: hire one more, when ten days of the next wage bill are covered
        const n = o.hiredIds().length;
        if (S.funds > OF.hire_cost + (over.cushion ?? 25) * o.wageOf(n + 1)) {
          o.ensureHire();
          const slot = S.hire.slots[0];
          if (slot && o.hire(slot.id)) f.hires += 1;
        }
      }
      const d = Math.floor(S.clock.day);
      for (const mark of [30, 60, 90, 120, 150, 200, 250]) if (d === mark && f.fundsAt[mark] === undefined) { f.fundsAt[mark] = Math.round(S.funds); f.staffAt[mark] = o.hiredIds().length; f.antiquesAt[mark] = S.antiques.length; }
    }
    f.unpaidDays = S.unpaidDays || 0;
    f.staff = o.hiredIds().length;
    f.funds = Math.round(S.funds);
    f.energy = S.energy;
    f.trips = S.trips.length;
    f.elapsed = Math.floor(S.clock.day);
    f.unlocked = active.filter(({ antique }) => S.locks.includes(antique)).length;
    f.full = active.filter(({ route, max }) => S.stars[route] === max).length;
    f.bestStars = active.reduce((sum, { route }) => sum + (S.stars[route] || 0), 0);
    out.push(f);
  }
  return out;
}, { runs, days, policy, over });
const avg = (f) => { const v = res.map(f).filter((x) => x !== undefined && x !== null); return v.length ? (v.reduce((a, b) => a + b, 0) / v.length).toFixed(1) : '-'; };
console.log(`policy ${policy}, ${res.length} runs, ${days} days`, JSON.stringify(over));
console.log('first unpaid day (runs that had one):', avg((r) => r.firstUnpaid), `in ${res.filter((r) => r.firstUnpaid !== null).length}/${res.length}`);
for (const m of [30, 60, 90, 120, 150, 200, 250]) if (res[0].fundsAt[m] !== undefined) console.log(`day ${m}: funds ${avg((r) => r.fundsAt[m])}, staff ${avg((r) => r.staffAt[m])}, antiques ${avg((r) => r.antiquesAt[m])}`);
console.log('stops', avg((r) => r.stops), 'stops after day 60', avg((r) => r.stopsLate));
console.log('unpaid days', avg((r) => r.unpaidDays), 'door sales', avg((r) => r.sells), 'spare-sale events', avg((r) => r.spareSold), 'hires', avg((r) => r.hires), 'energy', avg((r) => r.energy), 'trips', avg((r) => r.trips));
console.log('elapsed', avg((r) => r.elapsed), 'unlocked stories', avg((r) => r.unlocked), 'full-star stories', avg((r) => r.full), 'best stars', avg((r) => r.bestStars));
await browser.close();
server.kill();
