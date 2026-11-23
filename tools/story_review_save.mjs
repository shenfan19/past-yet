// Story review save: runs the real game in a headless browser, sends the test employee V to each story with story prose, King for the floor,
// and for each paragraph written in variants an employee who reads that variant, brings every trip home and writes a save.
// Import the file on the settings page of index.html?devtools; it replaces the save of this browser, so export your own first if you want to keep it.
// It also sends one trip where the first point of outcomes is missed and another won, the case that most often contradicts an ending.
// Usage: node tools/story_review_save.mjs [eventId,eventId] [out file] [seed] [seeds to try]
// Without event IDs it takes every open story whose Chinese text has story_prose. Set PLAYWRIGHT_DIR to a folder that has playwright installed.
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pwDir = process.env.PLAYWRIGHT_DIR || 'C:/fight/life-matters-reference-engine/gui';
const { chromium } = createRequire(path.join(pwDir, 'x.js'))('playwright');
const [idArg = '', outArg = '', seedArg = '42', triesArg = '60'] = process.argv.slice(2);
const yaml = createRequire(import.meta.url)(path.join(root, 'vendor/js-yaml.min.js'));
const config = yaml.load(fs.readFileSync(path.join(root, 'data/config.yaml'), 'utf8'));
const out = outArg || path.join(root, 'temp_story_review', config.save.file_name + '.json');
fs.mkdirSync(path.dirname(out), { recursive: true });

const port = await new Promise((res) => { const srv = net.createServer(); srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => res(p)); }); });
const server = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(`http://127.0.0.1:${port}/index.html`)).ok) break; } catch (e) { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 200));
}
const browser = await chromium.launch();
const errors = [];
try {
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${port}/index.html?devtools`);
  await page.waitForFunction(() => window.__game?.ui?.office);
  const rows = await page.evaluate(({ wanted, seed, tries }) => {
    const { D, ctx, ui, backend } = window.__game;
    const office = ui.office;
    ctx.reset();
    const S = ctx.S();
    S.welcomed = true;
    S.welcomeAcknowledged = true;
    S.founder.name = S.founder.name || 'Review';
    const T = D.get('text');
    const events = D.get('catalog.active_events').filter((e) => e.scene && (wanted.length ? wanted.includes(e.id) : T.catalog[e.id]?.story_prose));
    const staffIds = Object.keys(D.get('staff.staff'));
    // every item in stock, so a variant reader can reach the star whose passage it shows; the kit of a trip keeps only what the story allows
    const kit = Object.fromEntries(Object.keys(D.get('items')).map((id) => [id, 1]));
    for (const id of Object.keys(kit)) S.inv[id] = 99;
    const out = [];
    // the game's own run of a small story, tried over a few seeds before the trip is sent, to find a reader and a seed that show a passage
    const won = (r, id) => (r.points || []).some((p) => p.id === id && p.hit && !p.cut);
    const find = (ev, readers, test) => {
      for (let k = 0; k < tries; k++) for (const s of readers) {
        // the same kit the trip will carry, as launchLight keeps only what the story allows
        const allowed = Object.fromEntries(Object.entries(kit).filter(([id]) => backend.lightKitAllowed(ev.id, id)));
        const r = backend.runLight(ev.id, s, seed + k, allowed, S.staff[s].favor);
        // reached and taken in: a trip that never got there keeps its scene points in the run, though it wins no star
        if (!r.evacuation && r.outcome !== 'desync' && r.journey?.reached && r.journey?.accepted && r.stars > 0 && test(r)) return { staffId: s, seed: seed + k };
      }
      return null;
    };
    const roster = staffIds.filter((s) => !D.get('staff.staff')[s].dev_only);
    const send = (ev, staffId, why, at = seed) => {
      S.staff[staffId].hired = true;
      S.staff[staffId].restUntil = 0;
      const d = office.launchLight(ev.id, staffId, at, kit);
      if (!d) { out.push({ story: ev.id, staff: staffId, why, result: 'not sent' }); return; }
      S.clock.day = Math.max(S.clock.day, d.readyDay);
      office.claim(d.id);
      S.staff[staffId].restUntil = 0;
      out.push({ story: ev.id, name: T.catalog[ev.id].name, place: T.catalog[ev.id].place, staff: T.staff[staffId].name, why, stars: d.stars, outcome: d.report.outcomeId, admitted: d.report.journey?.accepted !== false });
    };
    for (const ev of events) {
      send(ev, 's_v', 'full stars');
      send(ev, 's_king', 'floor');
      // a reader for each written variant: an employee whose tags hold every tag of its key and who wins that point, on the first seed that does
      const prose = T.catalog[ev.id].story_prose;
      for (const [point, x] of Object.entries(prose?.points || {})) {
        if (!x || typeof x !== 'object') continue;
        for (const key of Object.keys(x).filter((k) => k !== 'else')) {
          const readers = roster.filter((s) => key.split('+').every((t) => backend.staffTags(ev.id, s).includes(t)));
          const pick = find(ev, readers, (r) => won(r, point));
          if (pick) send(ev, pick.staffId, point + ' ' + key, pick.seed);
          else out.push({ story: ev.id, name: T.catalog[ev.id].name, staff: readers.length + ' readers', why: point + ' ' + key, result: 'no reader won the point in ' + tries + ' seeds' });
        }
      }
      // the first point of outcomes missed and another won: its ending must hold without the first
      const order = Object.keys(prose?.outcomes || {}).filter((k) => k !== 'all');
      if (order.length > 1) {
        const pick = find(ev, roster, (r) => !won(r, order[0]) && order.slice(1).some((id) => won(r, id)));
        if (pick) send(ev, pick.staffId, 'without ' + order[0], pick.seed);
        else out.push({ story: ev.id, name: T.catalog[ev.id].name, staff: '-', why: 'without ' + order[0], result: 'no trip found in ' + tries + ' seeds' });
      }
    }
    ctx.save();
    return { rows: out, save: JSON.stringify(ctx.saved()) };
  }, { wanted: idArg ? idArg.split(',') : [], seed: Number(seedArg), tries: Number(triesArg) });
  fs.writeFileSync(out, rows.save);
  for (const r of rows.rows) console.log([r.name || r.story, r.place || '', r.staff, r.why, r.result || `${r.stars}★ ${r.outcome}${r.admitted ? '' : ' not admitted'}`].join(' | '));
  console.log('\nwrote', out);
  console.log('open index.html?devtools, Settings, import this file; the reports are in the dispatch log of the Agency. It replaces the save of that browser.');
  if (errors.length) { console.log('page errors:'); for (const e of errors) console.log('  ' + e); process.exitCode = 1; }
} finally {
  await browser.close();
  server.kill();
}
