// Drive the page with Playwright: dispatch, fast-forward, claim, read the report, screenshot each tab.
// Set PLAYWRIGHT_DIR to a folder that has playwright installed.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const pwDir = process.env.PLAYWRIGHT_DIR || 'C:/fight/life-matters-reference-engine/gui';
const { chromium } = createRequire(path.join(pwDir, 'x.js'))('playwright');
const outDir = process.argv[2] || path.join(root, 'temp_screens');
fs.mkdirSync(outDir, { recursive: true });
// a free port from the system, a fixed one can be taken by another program
const port = await new Promise((res) => { const srv = net.createServer(); srv.listen(0, '127.0.0.1', () => { const p = srv.address().port; srv.close(() => res(p)); }); });
const server = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
// wait until the server answers, a slow machine can take longer than a fixed pause
for (let i = 0; i < 100; i++) {
  try { if ((await fetch(`http://127.0.0.1:${port}/index.html`)).ok) break; } catch (e) { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 200));
}
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1100, height: 900 } });
page.setDefaultTimeout(Number(process.env.UI_TIMEOUT) || 30000);
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
try {
  const ok = (label, cond) => console.log(label + ':', cond ? 'ok' : 'MISMATCH');
  // the agency page shows one tab at a time
  // a tab click first closes a pop-up that is open, as a person would
  const go = async (tab) => {
    if (await page.locator('#modal .modalbg').count()) await page.keyboard.press('Escape');
    // the lists show five rows by default, the test asks for the longest page so every item is on the first one
    await page.evaluate(() => { const pg = window.__game.ui.state.pager; for (const id of ['shop_modern', 'shop_future', 'inv', 'ants', 'home_staff', 'hire', 'pending', 'log']) pg[id] = { size: 50, page: 0 }; });
    await page.click(`#tabs [data-tab=${tab}]`);
  };
  const tool = async (id) => { if (await page.locator('#modal .modalbg').count()) await page.keyboard.press('Escape'); await page.click(`#tools [data-act=modalopen][data-id=${id}]`); };
  const sub = (id) => go(['modern', 'future', 'hire'].includes(id) ? 'buy' : 'shop');
  // a pin opens the events of its place, a place with one event goes straight to the dispatch pop-up
  const pick = async (pin, ev) => { await page.click(`.map [data-id=${pin}] .hit`, { force: true }); const row = page.locator(`#modal .evrow[data-id=${ev}]`); if (await row.count()) await row.click(); };
  const openFilter = () => page.evaluate(() => { window.__game.ui.state.map.filterOpen = true; window.__game.ui.render(); });
  await page.goto(`http://127.0.0.1:${port}/index.html?lang=zh&dev=1`);
  await page.waitForSelector('.lead');
  // a new game opens with the welcome: it cannot be closed from outside, shows the start places, the notice about the people, and begins on the button
  await page.waitForSelector('#modal .welcome');
  ok('a new game opens with the welcome and its notice about the people in the game', (await page.locator('#modal .welcome a[href*=issues]').count()) === 1 && (await page.locator('#modal .welcome .startplaces li').count()) === 4 && (await page.locator('#modal .mclose').count()) === 0);
  await page.keyboard.press('Escape');
  await page.mouse.click(5, 5);
  ok('the welcome does not close on Escape or on a click beside it', (await page.locator('#modal .welcome').count()) === 1);
  const startBefore = await page.evaluate(() => window.__game.ctx.S().startRandom.join());
  await page.click('[data-act=rerollstart]');
  ok('the two random places can be drawn again before the first trip', (await page.evaluate(() => window.__game.ctx.S().startRandom.join())) !== startBefore && (await page.locator('#modal .welcome .startplaces li').count()) === 4);
  ok('the welcome tells how to have something removed that infringes rights', (await page.locator('#modal .welcome').innerText()).includes('contact@teleporter.uk'));
  // the first employees: six candidates from six different regions, three picked, swapped by a click, drawn again before the first trip
  const crewInfo = () => page.evaluate(() => { const g = window.__game, S = g.ctx.S(); return { offer: S.startStaff.offer, pick: S.startStaff.pick, regions: new Set(S.startStaff.offer.map((id) => g.D.get('staff.staff.' + id).region)).size, hired: Object.keys(S.staff).filter((k) => S.staff[k].hired) }; });
  const c0 = await crewInfo();
  ok('the welcome offers six candidates from six regions and three are picked', c0.offer.length === 6 && c0.regions === 6 && c0.pick.length === 3 && c0.hired.length === 3 && (await page.locator('#modal .welcome .startstaff li').count()) === 6);
  const spare = c0.offer.find((id) => !c0.pick.includes(id));
  await page.click(`[data-act=startpick][data-id=${c0.pick[0]}]`);
  const c1 = await crewInfo();
  ok('the start button waits for the full crew', c1.pick.length === 2 && (await page.locator('[data-act=welcomestart][disabled]').count()) === 1);
  await page.click(`[data-act=startpick][data-id=${spare}]`);
  const c2 = await crewInfo();
  ok('a click swaps the picks and the employees follow', c2.pick.includes(spare) && !c2.pick.includes(c0.pick[0]) && c2.hired.length === 3 && c2.hired.includes(spare));
  await page.click('[data-act=rerollstaff]');
  const c3 = await crewInfo();
  ok('the candidates can be drawn again, still six regions', c3.offer.join() !== c0.offer.join() && c3.regions === 6 && c3.hired.length === 3);
  await page.click('[data-act=welcomestart]');
  // the rest of the checks use a known crew
  await page.evaluate(() => { const S = window.__game.ctx.S(); for (const k of Object.keys(S.staff)) S.staff[k].hired = ['s_ning', 's_zhou', 's_arjun'].includes(k); S.hire = null; });
  ok('the button begins the game and it is remembered', (await page.locator('#modal .welcome').count()) === 0 && (await page.evaluate(() => window.__game.ctx.S().welcomed)) === true);
  ok('the clock stands still before the first trip, with a hint', (await page.evaluate(() => window.__game.ctx.S().clock.speed)) === 0 && (await page.locator('#clock .chipwrap .chip').count()) === 1 && (await page.locator('#clock svg.ring').count()) === 1);
  // the real pace is one minute a day at 1x, the test runs the clock at three seconds a day
  ok('1x is one real minute per game day', await page.evaluate(() => window.__game.D.get('config.clock').sec_per_day === 60));
  await page.evaluate(() => { window.__game.D.get('config.clock').sec_per_day = 3; });
  await page.screenshot({ path: path.join(outDir, '0_home.png'), fullPage: true });
  await page.waitForSelector('#res .rv');
  await openFilter();
  await page.screenshot({ path: path.join(outDir, '1_office.png'), fullPage: true });
  // dispatch through the world map
  // tooltip on a trait chip, and a staff link opens the wiki with only its category expanded
  await page.evaluate(() => { window.__game.ui.state.modal = { kind: 'dispatch' }; window.__game.ui.render(); });
  await page.hover('a.chip.tr >> nth=0');
  ok('trait tooltip shows', (await page.locator('#tip').isVisible()) && (await page.locator('#tip').innerText()).length > 0);
  await page.click('a.wl[data-id="staff:s_ning"] >> nth=0');
  await page.waitForSelector('.wiki');
  ok('staff link opens wiki and expands only its category', (await page.locator('.wcat[open]').count()) === 1);
  // the wiki opens over the pop-up it was opened from, and closing it gives that pop-up back
  ok('the wiki is a pop-up over the dispatch pop-up', (await page.locator('#modal .wikibox').count()) === 1);
  await page.keyboard.press('Escape');
  ok('closing the wiki gives back the dispatch pop-up', (await page.locator('#modal .storyfull').count()) === 1 && (await page.locator('#modal .wikibox').count()) === 0);
  await page.keyboard.press('Escape');
  await tool('wiki');
  ok('the wiki keeps its state when it is opened again', (await page.locator('.wcat[open]').count()) === 1 && (await page.locator('#wiki-article h2').count()) === 1);
  await go('home');
  await go('home');
  await page.waitForSelector('svg.map');
  const vb0 = await page.evaluate(() => Number(document.querySelector('svg.map').getAttribute('viewBox').split(' ')[2]));
  await page.click('[data-act=mapz][data-id=in]');
  const vb1 = await page.evaluate(() => Number(document.querySelector('svg.map').getAttribute('viewBox').split(' ')[2]));
  ok('zoom in narrows the view', vb1 < vb0);
  await page.click('[data-act=mapz][data-id=reset]');
  await page.fill('#map-from', '-500');
  ok('negative year shows with a prefix', (await page.locator('#map-fromtxt').innerText()) === '前500');
  await page.fill('#map-from', '1840');
  await page.evaluate(() => { const m = window.__game.ui.state.map; m.z = 12; m.cx = 179.86; m.cy = 32.5; window.__game.ui.render(); });
  await page.click('.map [data-id=london_soho] .hit', { force: true });
  ok('a pin opens the events of its place as a grid in a pop-up, and the page has no list of events', (await page.locator('#modal .evgrid .evrow').count()) > 1 && (await page.locator('#map-events').count()) === 0 && (await page.locator('#view .evrow').count()) === 0);
  await page.click('#modal .evrow[data-id=broad_street_1854]');
  ok('an event opens the dispatch pop-up, with a way back to the list', (await page.locator('#modal .storyfull').count()) === 1 && (await page.locator('#modal [data-act=modalplace]').count()) === 1);
  await page.click('#modal [data-act=modalplace]');
  ok('the way back shows the list again', (await page.locator('#modal .evgrid').count()) === 1);
  await page.mouse.click(5, 5);
  ok('a click on the dark ground closes the pop-up', (await page.locator('#modal .mbox').count()) === 0);
  await pick('london_soho', 'broad_street_1854');
  await page.keyboard.press('Escape');
  ok('Escape closes it too', (await page.locator('#modal .mbox').count()) === 0);
  await page.fill('#map-q', 'xyz-no-match');
  ok('filter hides all pins', (await page.locator('svg.map .pt').count()) === 0);
  await page.fill('#map-q', '');
  ok('filter restore pins', (await page.locator('svg.map .pt').count()) > 2);
  await page.check('#map-counts');
  ok('the counts switch puts the number of events on the pins', (await page.locator('svg.map .pt text.cnt').count()) > 2);
  await page.uncheck('#map-counts');
  ok('and takes them off', (await page.locator('svg.map .pt text.cnt').count()) === 0);
  await pick('london_soho', 'broad_street_1854');
  await page.click('[data-act=autocfg]');
  await page.waitForSelector('.lpin [data-act=dec]', { timeout: 60000 });
  ok('auto configure puts a kit in the carry box', true);
  ok('the pop-up holds the story, who goes and what they carry in a half each, and the send button', (await page.locator('#modal .mbox .lbox').count()) >= 3 && (await page.locator('#modal .cols2.desk > div').count()) === 2 && (await page.locator('#modal [data-act=send]').count()) === 1);
  ok('plots are not picked by hand, the story names the ideas', (await page.locator('[data-act=plotpick]').count()) === 0 && (await page.locator('#modal .lbox ul li').count()) >= 1);
  // the automatic set-up may already have chosen one of them, so click one that is not chosen yet
  const other = (await page.locator('[data-act=pickstaff][data-id=s_zhou]').count()) ? 's_zhou' : 's_ning';
  await page.click(`[data-act=pickstaff][data-id=${other}]`);
  ok('picked staff is marked', (await page.locator(`.pickrow.on a.wl[data-id="staff:${other}"]`).count()) === 1);
  await page.screenshot({ path: path.join(outDir, '2_dispatch.png'), fullPage: true });
  await page.click('[data-act=send]');
  ok('sending closes the pop-up and the trip shows at the top, before the map', (await page.locator('#modal .mbox').count()) === 0 && (await page.locator('#home-pending').count()) === 1 && (await page.evaluate(() => document.getElementById('home-pending').compareDocumentPosition(document.getElementById('home-map')) & Node.DOCUMENT_POSITION_FOLLOWING)) > 0);
  ok('the first trip starts the clock at 1x', (await page.evaluate(() => window.__game.ctx.S().clock.speed)) === 1);
  // the trip is made to be home by moving its day, as the clock would
  await page.waitForSelector('.outrow');
  await page.evaluate(() => { const S = window.__game.ctx.S(); for (const d of S.dispatches.filter((x) => !x.claimed)) d.readyDay = S.clock.day; window.__game.ui.render(); });
  await page.waitForSelector('[data-act=claim]');
  ok('ready report puts a badge on the home tab', (await page.locator('#tabs [data-tab=home] .badge').count()) === 1);
  await page.click('[data-act=claim]');
  await page.waitForSelector('.tl');
  ok('the report lists three sync points and the stars are the ones hit', await page.evaluate(() => { const hit = document.querySelectorAll('.sync li.hit').length; return document.querySelectorAll('.sync li').length === 3 && document.querySelector('.stars') && document.querySelector('.stars').classList.contains('s' + hit); }));
  ok('the milestone lines of the points are highlighted in the timeline', (await page.locator('.tl li.star').count()) === (await page.locator('.sync li.hit').count()));
  await page.screenshot({ path: path.join(outDir, '4_report.png'), fullPage: true });
  // the share pop-up draws a card with a QR code that reads back as the site address
  await page.click('[data-act=shareopen]');
  await page.waitForSelector('#modal #sharecanvas');
  await page.screenshot({ path: path.join(outDir, '4b_share.png'), fullPage: true });
  const shareUrl = await page.evaluate(() => window.__game.D.get('config.meta.links.site'));
  const png = await page.evaluate(() => document.getElementById('sharecanvas').toDataURL('image/png'));
  if (process.env.QR_DIR) {
    const rq = createRequire(path.join(process.env.QR_DIR, 'x.js'));
    const { PNG } = rq('pngjs');
    const jsQR = rq('jsqr');
    const img = PNG.sync.read(Buffer.from(png.split(',')[1], 'base64'));
    const found = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
    ok('share card QR reads back as the site address', !!found && found.data === shareUrl);
  }
  ok('share page has save and copy', (await page.locator('[data-act=sharesave]').count()) === 1 && (await page.locator('[data-act=sharecopy]').count()) === 1);
  await page.mouse.click(5, 5);
  ok('the share pop-up closes on a click beside it and the report stays', (await page.locator('#modal .mbox').count()) === 0 && (await page.locator('.tl').count()) === 1);
  const inv = await page.evaluate(() => window.__game.ctx.S().inv);
  ok('stock was consumed', inv.chlorine_tablet < 40 || inv.ors_pack < 40 || inv.handbook < 1);
  const before = await page.evaluate(() => window.__game.ctx.S().energy);
  await page.reload();
  await page.waitForSelector('.lead');
  await page.evaluate(() => { window.__game.D.get('config.clock').sec_per_day = 3; });
  await page.waitForSelector('.lead');
  const after = await page.evaluate(() => window.__game.ctx.S().energy);
  ok('energy kept after reload', before === after);
  // shop: the used anchor is locked, antiques sell and buy, items buy and sell
  await go('shop');
  await sub('ants');
  await page.waitForSelector('[data-act=antlock]');
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.antiques = S.antiques.filter((x) => x !== 'pump_rust'); S.antiques.push('pump_rust'); window.__game.ui.render(); });
  ok('anchored antique cannot be sold', await page.locator('[data-act=antsell][data-id=pump_rust]').isDisabled());
  ok('the last open place cannot be released', await page.locator('[data-act=antlock][data-id=pump_rust]').isDisabled());
  await page.evaluate(() => { window.__game.ctx.S().antiques.push('clinic_bell'); window.__game.ui.render(); });
  ok('a found antique opens nothing until it is anchored', await page.evaluate(() => !window.__game.ctx.S().locks.includes('clinic_bell')));
  await page.click('[data-act=antlock][data-id=clinic_bell]');
  ok('anchoring opens its place', await page.evaluate(() => window.__game.ctx.S().locks.includes('clinic_bell')));
  await page.click('[data-act=antlock][data-id=pump_rust]');
  ok('release then sell possible', !(await page.locator('[data-act=antsell][data-id=pump_rust]').isDisabled()));
  await page.click('[data-act=antlock][data-id=pump_rust]');
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.antiques = S.antiques.filter((x) => x !== 'clinic_bell'); S.antiques.push('clinic_bell'); window.__game.ui.render(); });
  ok('the only copy of an anchored antique cannot be sold', await page.locator('[data-act=antsell][data-id=clinic_bell]').isDisabled());
  await page.evaluate(() => { window.__game.ctx.S().antiques.push('clinic_bell'); window.__game.ui.render(); });
  const fundsA = await page.evaluate(() => window.__game.ctx.S().funds);
  await page.click('[data-act=antsell][data-id=clinic_bell]');
  ok('a spare copy sells for funds and the anchored one stays', await page.evaluate((f) => window.__game.ctx.S().funds > f && window.__game.ctx.S().antiques.filter((x) => x === 'clinic_bell').length === 1 && window.__game.ctx.S().locks.includes('clinic_bell'), fundsA));
  // the time shop is paid in time energy, and an item sells back for exactly what it cost, in either shop
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.energy = 300; S.funds = 1000; window.__game.ui.render(); });
  const pre = await page.evaluate(() => ({ e: window.__game.ctx.S().energy, f: window.__game.ctx.S().funds }));
  await sub('future');
  await page.click('[data-act=cartinc][data-id=radiation_shield]');
  await page.click('[data-act=cartbuy][data-id=future]');
  ok('future goods are paid in time energy and the funds stay', await page.evaluate((b) => { const S = window.__game.ctx.S(); return S.energy === b.e - window.__game.D.get("items.radiation_shield.cost") && S.funds === b.f && S.inv.radiation_shield === 1; }, pre));
  await sub('inv');
  await page.click('[data-act=shopsell][data-id=radiation_shield]');
  ok('selling a future good returns the time energy it cost, with no loss', await page.evaluate((b) => { const S = window.__game.ctx.S(); return S.energy === b.e && S.funds === b.f && !S.inv.radiation_shield; }, pre));
  await sub('modern');
  await page.click('[data-act=cartinc][data-id=ors_pack]');
  await page.click('[data-act=cartbuy][data-id=modern]');
  await sub('inv');
  await page.click('[data-act=shopsell][data-id=ors_pack]');
  ok('selling a modern good returns the funds it cost, with no loss', await page.evaluate((b) => window.__game.ctx.S().funds === b.f, pre));
  await go('shop');
  ok('the agency page lists the employees, the goods and the antiques one under the other, with no tabs and no scroll bars', (await page.locator('#lb-home_staff').count()) === 1 && (await page.locator('#lb-inv').count()) === 1 && (await page.locator('#lb-ants').count()) === 1 && (await page.locator('.subtabs').count()) === 0 && (await page.locator('#view .lscroll').count()) === 0);
  await go('buy');
  ok('the buying page lists the two shops and the hiring offer one under the other', (await page.locator('#lb-shop_modern').count()) === 1 && (await page.locator('#lb-shop_future').count()) === 1 && (await page.locator('#lb-hire').count()) === 1 && (await page.locator('#view .lscroll').count()) === 0);
  // a list shows five rows until the player asks for more
  await page.evaluate(() => { delete window.__game.ui.state.pager.shop_modern; window.__game.ui.render(); });
  const fiveRows = await page.locator('#lb-shop_modern .ltable tbody tr').count();
  ok('a list shows five rows by default and has a pager when there are more', fiveRows === 5 && (await page.locator('#lb-shop_modern [data-act=pgpage]').count()) === 2);
  await page.selectOption('#lb-shop_modern [data-pgsize]', '20');
  ok('the player can ask for more rows, and the pager stays so the size can be set back', (await page.locator('#lb-shop_modern .ltable tbody tr').count()) > 5 && (await page.locator('#lb-shop_modern [data-act=pgpage]').count()) === 2);
  await sub('ants');
  await go('home');
  await go('shop');
  await sub('future');
  await page.evaluate(() => { window.__game.ctx.S().energy = 100; window.__game.ui.render(); });
  ok('special equipment is locked until the energy reaches its number', (await page.locator('[data-act=cartinc][data-id=golden_apple]').count()) === 0 && (await page.locator('[data-act=cartinc][data-id=neural_chip]').count()) === 1);
  await page.evaluate(() => { window.__game.ctx.S().energy = 130; window.__game.ui.render(); });
  ok('it unlocks when the energy gets there', (await page.locator('[data-act=cartinc][data-id=golden_apple]').count()) === 1);
  // the kit: supplies are spent in the story, future technology always comes home, and a fatal trip costs the gear unless a rescue item was carried
  const kit = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    const saved = { inv: { ...S.inv }, dispatches: S.dispatches, secretary: S.secretary };
    S.secretary = null; S.dispatches = [];
    for (const k of Object.keys(S.staff)) S.staff[k].restUntil = 0;
    const crew = Object.keys(S.staff).filter((k) => S.staff[k].hired);
    Object.assign(S.inv, { ors_pack: 20, neural_chip: 1, heart_monitor: 1, recall_charm: 1 });
    const trip = (staffId, items, outcome, era) => {
      const d = off.launch(era, { seed: 5, staffId, items });
      d.report.outcomeId = outcome; d.readyDay = S.clock.day;
      off.claim(d.id);
      return d.kit;
    };
    const fine = trip(crew[0], { ors_pack: 10, neural_chip: 1, heart_monitor: 1 }, 'perfect', 'vienna_1847');
    const bad = trip(crew[1], { heart_monitor: 1, neural_chip: 1 }, 'near_death', 'broad_street_1854');
    S.inv.heart_monitor = 1;
    const saved2 = trip(crew[2], { heart_monitor: 1, recall_charm: 1, neural_chip: 1 }, 'near_death', 'vienna_1847');
    const out = { fine, bad, saved2, inv: { ...S.inv } };
    S.inv = saved.inv; S.dispatches = saved.dispatches.concat(S.dispatches.filter((d) => d.claimed)); S.secretary = saved.secretary;
    for (const k of Object.keys(S.staff)) S.staff[k].restUntil = 0;
    return out;
  });
  ok('supplies are used up in the story and the rest of the kit comes home', kit.fine.lost.ors_pack === 10 && kit.fine.back.neural_chip === 1 && kit.fine.back.heart_monitor === 1);
  ok('a fatal trip loses the modern gear, not the future technology', kit.bad.lost.heart_monitor === 1 && kit.bad.back.neural_chip === 1);
  ok('a rescue item saves the gear and is spent doing it', kit.saved2.back.heart_monitor === 1 && kit.saved2.lost.recall_charm === 1 && kit.saved2.back.neural_chip === 1);
  // scenes: the points are requirements, equipment counts and shows, and a scene can find the traveller out
  const sc = await page.evaluate(() => {
    const b = window.__game.backend;
    const rate = (ev, staff, items, id) => { let n = 0; for (let k = 1; k <= 60; k++) if (b.runLight(ev, staff, k, items).points.find((p) => p.id === id).hit) n++; return n / 60; };
    let foundGorilla = 0, foundCloak = 0;
    for (let k = 1; k <= 200; k++) { if (b.runLight('leonardo_florence', 's_ning', k, { gorilla_arm: 1, cyber_arm: 1 }).found) foundGorilla++; if (b.runLight('leonardo_florence', 's_ning', k, { gorilla_arm: 1, cyber_arm: 1, holo_cloak: 1 }).found) foundCloak++; }
    return {
      woman: rate('leonardo_florence', 's_ning', {}, 'p2'), man: rate('leonardo_florence', 's_zhou', {}, 'p2'),
      plain: rate('leonardo_florence', 's_ning', {}, 'p1'), apple: rate('leonardo_florence', 's_ning', { golden_apple: 1 }, 'p1'),
      chipNeeded: rate('newton_cambridge', 's_ning', {}, 'p2'), chip: rate('newton_cambridge', 's_ning', { neural_chip: 1 }, 'p2'), foundGorilla, foundCloak,
      noKit: b.runLight('leonardo_florence', 's_ning', 5, {}).found,
    };
  });
  ok('being a woman is a requirement of the portrait', sc.woman > 0.95 && sc.man < 0.2);
  ok('the golden apple triples persuasion and a chip is the item a point asks for', sc.plain === 0 && sc.apple > 0.7 && sc.chipNeeded === 0 && sc.chip > 0.7);
  ok('equipment that shows gets the traveller found out, a cloak lowers it, and no equipment is never found out', sc.foundGorilla > 80 && sc.foundCloak < sc.foundGorilla && sc.noKit === null);
  // the antique roll is the backend's, seeded, and the chance falls to a floor
  ok('antique find is repeatable, and near in time and space beats far', await page.evaluate(() => { const b = window.__game.backend; const o = b.findOdds('broad_street_1854'); const w = (id) => o.list.find((x) => x.id === id).w; return b.findAntique('broad_street_1854', 5) === b.findAntique('broad_street_1854', 5) && o.p <= window.__game.D.get('config.office.antique_find.cap') && w('relic_faraday_london') > w('relic_lavoisier_paris') && w('relic_lavoisier_paris') > w('relic_pythagoras_croton') && !o.list.some((x) => x.id === 'relic_curie_paris'); }));
  ok('the chance of a find is a probability below the cap', await page.evaluate(() => { const b = window.__game.backend; return ['broad_street_1854', 'vienna_1847'].every((e) => { const p = b.findOdds(e).p; return p > 0.1 && p <= window.__game.D.get('config.office.antique_find.cap'); }); }));
  ok('a trip with no star finds a quarter as often as one with three', await page.evaluate(() => { const b = window.__game.backend; let a = 0, z = 0; for (let s = 1; s <= 2000; s++) { if (b.findAntique('broad_street_1854', s, [], 3)) a++; if (b.findAntique('broad_street_1854', s, [], 0)) z++; } return z > 0 && Math.abs(z / a - 0.25) < 0.08; }));
  ok('some first trips bring something back and some do not', await page.evaluate(() => { const b = window.__game.backend; let n = 0; for (let s = 1; s <= 400; s++) if (b.findAntique('broad_street_1854', s)) n++; return n > 80 && n < 400 * window.__game.D.get('config.office.antique_find.cap'); }));
  ok('the key to a place not yet held is found often enough to open it', await page.evaluate(() => { const b = window.__game.backend; let n = 0; for (let k = 1; k <= 400; k++) if (b.findAntique('broad_street_1854', k, ['pump_rust']) === 'clinic_bell') n++; return n > 30; }));
  // spares: sell all but one of each
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.antiques.push('relic_faraday_london', 'relic_faraday_london', 'relic_faraday_london'); window.__game.ui.render(); });
  const fundsC = await page.evaluate(() => window.__game.ctx.S().funds);
  await sub('ants');
  await page.click('[data-act=sellspares]');
  ok('one click sells the spares and keeps one of each', await page.evaluate((f) => { const S = window.__game.ctx.S(); return S.funds > f && S.antiques.filter((x) => x === 'relic_faraday_london').length === 1; }, fundsC));
  await sub('modern');
  await page.click('[data-act=cartinc][data-id=disinfectant]');
  ok('cart pins the chosen item', (await page.locator('.lpin [data-act=cartdec][data-id=disinfectant]').count()) === 1);
  await page.click('[data-act=cartbuy]');
  ok('bought disinfectant', (await page.evaluate(() => window.__game.ctx.S().inv.disinfectant)) === 2);
  await sub('inv');
  await page.click('[data-act=shopsell][data-id=disinfectant]');
  ok('sold disinfectant', (await page.evaluate(() => window.__game.ctx.S().inv.disinfectant)) === 0);
  await sub('future');
  ok('future goods are buyable but a borrowed design is not', (await page.locator('[data-act=cartinc][data-id=radiation_shield]').count()) === 1 && (await page.locator('[data-act=cartinc][data-id=bamboo_copter]').count()) === 0);
  await sub('modern');
  await page.click('[data-act=lfilter][data-id=shop_modern]');
  await page.fill('#fq-shop_modern', '心率');
  ok('a table has its own filter, folded until asked for', (await page.locator('#lb-shop_modern [data-act=cartinc]').count()) === 1 && (await page.locator('#lb-shop_future [data-act=cartinc]').count()) > 1);
  await page.fill('#fq-shop_modern', '');
  await page.screenshot({ path: path.join(outDir, '5_shop.png'), fullPage: true });
  // second place
  await go('home');
  await page.click('[data-act=mapz][data-id=reset]');
  await pick('vienna_general_hospital', 'vienna_1847');
  await page.screenshot({ path: path.join(outDir, '7_dispatch_vienna.png'), fullPage: true });
  ok('vienna sendable after buying its antique', !(await page.locator('[data-act=send]').isDisabled()));
  await page.keyboard.press('Escape');
  // wiki
  await tool('wiki');
  await page.waitForSelector('.wiki');
  await page.fill('#wiki-q', '斯诺');
  ok('wiki filter by text', (await page.locator('#wiki-list .wrow:not(.locked)').count()) >= 1);
  await page.locator('#wiki-list .wcat summary').first().click();
  await page.locator('#wiki-list .wrow:not(.locked)').first().click();
  await page.waitForSelector('#wiki-article h2');
  await page.locator('#wiki-article a.wl').first().click();
  await page.click('[data-act=wikiback]');
  await page.fill('#wiki-q', '');
  await page.click('#wiki-tags summary');
  const openBefore = await page.locator('.wcat[open]').count();
  await page.click('[data-act=wikitag][data-id=obstetrics]');
  ok('tag click keeps the expanded state', (await page.locator('.wcat[open]').count()) === openBefore);
  ok('wiki tag filter', (await page.locator('#wiki-list .wcat').count()) >= 1);
  await page.fill('#wiki-q', 'zz-none');
  ok('text filter keeps the expanded state too', (await page.locator('.wcat[open]').count()) === 0 || openBefore > 0);
  await page.fill('#wiki-q', '');
  await page.click('[data-act=wikitag][data-id=""]');
  if ((await page.locator('.wcat[data-cat=events][open]').count()) === 0) await page.click('.wcat[data-cat=events] summary');
  await page.locator('#wiki-list .wrow', { hasText: '被拒之门外' }).first().click();
  ok('model event lists formulas in dev', (await page.locator('#wiki-article').innerText()).includes('用到的公式'));
  await page.locator('#wiki-article a.wl').nth(1).click();
  await page.screenshot({ path: path.join(outDir, '9_wiki.png'), fullPage: true });
  // every catalogue event has its figure in the people of the wiki, and there are no virtual stories any more
  const peopleInfo = await page.evaluate(() => { const D = window.__game.D; const covered = new Set(D.get('encyclopedia.sections.people').flatMap((p) => p.events || [])); return { missing: D.get('catalog.events').filter((e) => !covered.has(e.id)).length, sections: Object.keys(D.get('encyclopedia.sections')).join() }; });
  ok('every catalogue event has its person in the wiki', peopleInfo.missing === 0);
  ok('the wiki has no virtual stories', !peopleInfo.sections.includes('stories') && (await page.locator('.wcat[data-cat=virtual]').count()) === 0);
  // hire, then guest mode
  await go('shop');
  await sub('hire');
  const slotsBefore = await page.evaluate(() => window.__game.ctx.S().hire.slots.map((x) => x.id));
  ok('five candidates are on offer, one row each, with their traits', slotsBefore.length === 5 && (await page.locator('#lb-hire [data-act=hire]').count()) === 5 && (await page.locator('#lb-hire .ltable tbody tr').count()) === 5 && (await page.locator('#lb-hire .ltable a.chip.tr').count()) >= 2);
  await page.locator('[data-act=hire]').first().click();
  ok('hiring one brings another so five stay on offer', await page.evaluate((before) => { const h = window.__game.ctx.S().hire.slots; return h.length === 5 && h.some((x) => !before.includes(x.id)); }, slotsBefore));
  // secretary, favor, clock and auto mode
  await sub('staff');
  await page.click('[data-act=appoint][data-id=s_zhou]');
  ok('secretary is appointed', (await page.evaluate(() => window.__game.ctx.S().secretary)) === 's_zhou');
  const favor0 = await page.evaluate(() => window.__game.ctx.S().staff.s_ning.favor);
  await page.click('[data-act=gift][data-id=s_ning]');
  ok('gift raises favor', (await page.evaluate(() => window.__game.ctx.S().staff.s_ning.favor)) > favor0);
  await page.selectOption('[data-clk=speed]', '3');
  const day0 = await page.evaluate(() => window.__game.ctx.S().clock.day);
  await page.waitForTimeout(1500);
  ok('clock runs at speed', (await page.evaluate(() => window.__game.ctx.S().clock.day)) > day0);
  await page.keyboard.press('Space');
  const day1 = await page.evaluate(() => window.__game.ctx.S().clock.day);
  await page.waitForTimeout(1200);
  ok('space pauses the clock', (await page.evaluate(() => window.__game.ctx.S().clock.day)) === day1);
  // every employee has a wiki page once hired or on offer
  const offerId = await page.evaluate(() => window.__game.ctx.S().hire.slots[0].id);
  if (offerId) { await sub('hire'); await page.click(`.ltable a.wl[data-id="staff:${offerId}"]`); await page.waitForSelector('.wiki'); ok('a candidate on offer already has a wiki page', (await page.locator('#wiki-article h2').count()) === 1); await page.keyboard.press('Escape'); }
  const gid = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    const slot = S.hire.slots[0];
    S.funds = Math.max(S.funds, 500);
    off.hire(slot.id);
    g.ui.render();
    return slot.id;
  });
  await sub('staff');
  await page.click(`a.wl[data-id="staff:${gid}"]`);
  await page.waitForSelector('.wiki');
  ok('a hired employee has a wiki page', (await page.locator('#wiki-article h2').count()) === 1);
  await page.keyboard.press('Escape');
  // a recall stops the trip where it is and pays a share, only one employee can be in a place, and the offer changes every seven days
  const rc = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    S.staff.s_ning.restUntil = 0; S.staff.s_arjun.restUntil = 0;
    const era = 'broad_street_1854';
    const d = off.launch(era, { seed: 5, staffId: 's_ning', items: {} });
    const second = off.launch(era, { seed: 6, staffId: 's_arjun', items: {} });
    S.clock.day += 2;
    const fav = S.staff.s_ning.favor;
    d.report.outcomeId = 'modest';
    const r = off.recall(d.id);
    const b = g.backend;
    const res = { launched: !!d, secondBlocked: second === null, ok: r.ok, share: d.paid && d.paid.share, recalled: d.recalled, favorDown: S.staff.s_ning.favor < fav,
      stay: b.recallRefused('s_ning', 1, 'stay_and_gifts'), other: b.recallRefused('s_ning', 1, 'modest') };
    return res;
  });
  ok('only one employee can be in a place at a time', rc.launched && rc.secondBlocked);
  ok('a recall brings them home with part of the pay and the story stops', rc.ok && rc.recalled && rc.share > 0 && rc.share < 1 && rc.favorDown);
  ok('someone who decided to stay refuses a recall and anyone else comes', rc.stay === true && rc.other === false);
  const offerBefore = await page.evaluate(() => window.__game.ctx.S().hire.slots.map((x) => x.id).join());
  await page.evaluate(() => { window.__game.ctx.S().clock.day += 8; });
  await page.selectOption('[data-clk=speed]', '1');
  await page.waitForTimeout(800);
  await page.selectOption('[data-clk=speed]', '0');
  ok('the offer is replaced every seven days', await page.evaluate((before) => window.__game.ctx.S().hire.slots.map((x) => x.id).join() !== before, offerBefore));
  ok('the funds with the wages a day, and the energy, are in the navigation bar as icons', (await page.locator('#navrow #res .rv').count()) === 2 && (await page.locator('#navrow #res .rv').first().innerText()).includes('−'));
  // stars: time energy is paid only for stars above the best of the place, funds every time
  const sr = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    const era = 'vienna_1847';
    S.dispatches = S.dispatches.filter((d) => d.claimed);
    for (const k of Object.keys(S.staff)) S.staff[k].restUntil = 0;
    const crew = Object.keys(S.staff).filter((k) => S.staff[k].hired && S.secretary !== k);
    const keepSecretary = S.secretary; S.secretary = null;
    delete S.stars[era];
    const run = (stars, staff) => {
      const d = off.launch(era, { seed: 11 + stars, staffId: staff, items: {} });
      d.stars = stars; d.readyDay = S.clock.day;
      const before = S.energy;
      off.claim(d.id);
      return { gain: S.energy - before, best: S.stars[era], newBest: d.newBest };
    };
    const a = run(2, crew[0]); const b = run(2, crew[1]); const c = run(3, crew[2]);
    S.secretary = keepSecretary;
    return { a, b, c, base: g.D.get('config.stars.energy_base.' + era) };
  });
  ok('two stars pay half of the base energy', sr.a.gain === Math.round(sr.base / 2) && sr.a.best === 2 && sr.a.newBest === true);
  ok('the same stars again pay no energy, so a place cannot be farmed', sr.b.gain === 0 && sr.b.newBest === false);
  ok('the third star pays the other half', sr.c.gain === Math.round(sr.base / 2) && sr.c.best === 3);
  await go('home');
  await openFilter();
  await page.selectOption('#map-star', '3');
  ok('the star filter keeps only places with that many stars', await page.evaluate(() => [...document.querySelectorAll('svg.map .pt')].length >= 1 && [...document.querySelectorAll('svg.map .pt')].length <= 3));
  await page.selectOption('#map-star', '');
  await go('shop');
  // the auto mode picks where to send an employee by rules: unexplored first, then a place that can still be improved, then earlier history, then any
  const pk = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    const free = ['broad_street_1854', 'vienna_1847', 'ev_a'].slice(0, 2);
    const keep = { visited: [...S.visited], stars: { ...S.stars }, dispatches: S.dispatches, trips: S.trips };
    const id = Object.keys(S.staff).find((k) => S.staff[k].hired);
    S.dispatches = []; S.trips = [];
    S.visited = ['vienna_1847']; S.stars = { vienna_1847: 3 };
    const r1 = off.pickPlace(id, free);
    S.visited = ['broad_street_1854', 'vienna_1847']; S.stars = { broad_street_1854: 3, vienna_1847: 2 };
    const r2 = off.pickPlace(id, free);
    S.stars = { broad_street_1854: 3, vienna_1847: 3 };
    const r3 = off.pickPlace(id, free);
    const early = g.ctx.backend.placeYear('vienna_1847') < g.ctx.backend.placeYear('broad_street_1854') ? 'vienna_1847' : 'broad_street_1854';
    Object.assign(S, keep);
    return { r1, r2, r3, early };
  });
  ok('the auto mode sends to an unexplored place first', pk.r1.rule === 'unexplored' && pk.r1.eraId === 'broad_street_1854');
  ok('then to a visited place that can still be improved', pk.r2.rule === 'breakthrough' && pk.r2.eraId === 'vienna_1847');
  ok('then to the earlier history, the earliest of the places', pk.r3.rule === 'farther' && pk.r3.eraId === pk.early);
  // the auto mode buys the equipment a story needs, within the share of the energy it may spend, and carries it
  const eq = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    const scenes = g.D.get('catalog.events').filter((e) => e.scene);
    const staffIds = Object.keys(S.staff);
    const keep = { energy: S.energy, inv: { ...S.inv } };
    let found = null;
    S.energy = 5000;
    for (const e of scenes) {
      for (const sid of staffIds) {
        const plain = g.ctx.backend.runLight(e.id, sid, 7, {}).stars;
        const plan = off.planLight(e.id, sid, 7);
        if (plan.stars > plain && plan.buy.length) { found = { e: e.id, sid, plain, rich: plan.stars, buy: plan.buy, kit: Object.keys(plan.kit) }; break; }
      }
      if (found) break;
    }
    S.energy = 0;
    const poor = found ? off.planLight(found.e, found.sid, 7) : null;
    S.energy = 5000;
    const before = found ? found.buy.map((id) => S.inv[id] || 0) : [];
    if (found) for (const id of found.buy) off.buyItem(id);
    const after = found ? found.buy.map((id) => S.inv[id] || 0) : [];
    const spent = 5000 - S.energy;
    Object.assign(S, { energy: keep.energy, inv: keep.inv });
    return { found, poorBuy: poor ? poor.buy.length : -1, before, after, spent };
  });
  ok('some story cannot reach more stars without equipment, and the plan buys it', !!eq.found && eq.found.rich > eq.found.plain);
  ok('with no energy the plan buys nothing', eq.poorBuy === 0);
  ok('buying puts the equipment in the stock and takes the energy', eq.found && eq.after.every((n, i) => n === eq.before[i] + 1) && eq.spent > 0);
  await page.selectOption('[data-clk=speed]', '0');
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.funds = 400; for (const k of Object.keys(S.staff)) S.staff[k].favor = 0.5; });
  const hiredN = await page.evaluate(() => Object.values(window.__game.ctx.S().staff).filter((x) => x.hired).length);
  await page.click('[data-act=fire][data-id=s_arjun]');
  ok('an employee can be let go', (await page.evaluate(() => Object.values(window.__game.ctx.S().staff).filter((x) => x.hired).length)) === hiredN - 1);
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.staff.s_arjun.hired = true; });
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.locks = S.locks.filter((x) => x !== 'clinic_bell'); if (!S.antiques.includes('clinic_bell')) S.antiques.push('clinic_bell'); S.antiques.push('relic_newton_cambridge', 'relic_newton_cambridge'); S.funds = 50; });
  await page.locator('[data-clk=auto]').click();
  await page.selectOption('[data-clk=speed]', '3');
  const claimedBefore = await page.evaluate(() => window.__game.ctx.S().dispatches.filter((d) => d.claimed).length);
  await page.waitForFunction((b) => window.__game.ctx.S().dispatches.filter((d) => d.claimed).length > b, claimedBefore, { timeout: 60000 });
  ok('auto mode dispatches and claims by itself', true);
  ok('auto mode anchors a found antique and sells spares when funds are short', await page.evaluate(() => { const S = window.__game.ctx.S(); return S.locks.includes('clinic_bell') && S.locks.includes('relic_newton_cambridge') && S.antiques.filter((x) => x === 'relic_newton_cambridge').length === 1; }));
  const sec = await page.evaluate(() => window.__game.ctx.S().secretaryLast);
  ok('secretary verdict recorded after auto results', !!sec && typeof sec.met === 'boolean');
  await go('shop');
  ok('verdict chip shows', (await page.locator('.chip:has-text("他的意")').count()) === 1);
  await page.click('[data-act=appoint][data-id=s_zhou]');
  await page.locator('[data-clk=auto]').click();
  await page.selectOption('[data-clk=speed]', '0');
  ok('hired after recruit', (await page.evaluate(() => Object.values(window.__game.ctx.S().staff).filter((x) => x.hired).length)) === 5);
  await page.goto(`http://127.0.0.1:${port}/index.html?dev=0&lang=zh`);
  await page.waitForSelector('.lead');
  // settings, music and effects
  // the time axis zooms around the pointer and slides when dragged, and its marks are plain dots
  await go('home');
  await page.waitForSelector('svg.axis');
  ok('map and axis marks have no rings', (await page.locator('svg .pt .ring').count()) === 0);
  await openFilter();
  await page.locator('svg.axis').scrollIntoViewIfNeeded();
  const axBox = await page.locator('svg.axis').boundingBox();
  const winBefore = await page.evaluate(() => { const m = window.__game.ui.state.map; return m.to - m.from; });
  await page.mouse.move(axBox.x + axBox.width * 0.8, axBox.y + axBox.height / 2);
  await page.mouse.wheel(0, -120);
  await page.waitForTimeout(150);
  const winAfter = await page.evaluate(() => { const m = window.__game.ui.state.map; return m.to - m.from; });
  ok('wheel on the axis narrows the window', winAfter < winBefore);
  ok('the year fields follow the wheel', await page.evaluate(() => { const m = window.__game.ui.state.map; return Number(document.getElementById('map-from').value) === m.from && Number(document.getElementById('map-to').value) === m.to; }));
  const fromBefore = await page.evaluate(() => window.__game.ui.state.map.from);
  await page.mouse.move(axBox.x + axBox.width * 0.5, axBox.y + axBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(axBox.x + axBox.width * 0.4, axBox.y + axBox.height / 2, { steps: 5 });
  await page.mouse.up();
  ok('dragging the axis slides the window', (await page.evaluate(() => window.__game.ui.state.map.from)) !== fromBefore);
  await tool('settings');
  ok('settings page has five sections', (await page.locator('.settings h3').count()) === 5);
  await page.selectOption('[data-set=theme]', 'dark');
  ok('dark theme is applied', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.selectOption('[data-set=theme]', 'auto');
  ok('auto theme clears the attribute', (await page.evaluate(() => document.documentElement.dataset.theme)) === undefined);
  await page.locator('[data-set=music_volume]').fill('0.2');
  ok('volume slider is saved', (await page.evaluate(() => window.__game.ctx.settings.get('music_volume'))) === 0.2);
  await page.keyboard.press('Escape');
  await page.click('[data-music=toggle]');
  await page.waitForFunction(() => window.__game.ctx.audio.state.playing && !window.__game.ctx.audio.state.loading, null, { timeout: 8000 });
  ok('music plays without an error', (await page.evaluate(() => window.__game.ctx.audio.state.error)) === null);
  await page.click('[data-music=next]');
  await page.waitForFunction(() => window.__game.ctx.audio.state.index === 1 && !window.__game.ctx.audio.state.loading, null, { timeout: 8000 });
  ok('next piece loads', (await page.evaluate(() => window.__game.ctx.audio.state.error)) === null);
  await page.click('[data-music=toggle]');
  ok('music pauses', (await page.evaluate(() => window.__game.ctx.audio.state.playing)) === false);
  await tool('settings');
  await page.click('[data-act=sfxtry][data-id=send]');
  await page.screenshot({ path: path.join(outDir, '9_settings.png'), fullPage: true });
  await go('home');
  ok('guest has three pages and three tools', (await page.locator('#tabs [data-tab]').count()) === 3 && (await page.locator('#tools [data-act=modalopen]').count()) === 3);
  await tool('wiki');
  await page.waitForSelector('.wiki');
  ok('guest wiki has no model categories', (await page.locator('.wcat[data-cat=formulas]').count()) === 0);
  ok('guest sees locked rows and no hidden marks', (await page.locator('.wrow.locked').count()) > 0 && !(await page.locator('#wiki-list').innerText()).includes('(hidden)'));
  await page.screenshot({ path: path.join(outDir, '10_wiki_guest.png'), fullPage: true });
  await go('home');
  ok('guest map draws only anchored places', await page.evaluate(() => { const S = window.__game.ctx.S(); const pins = document.querySelectorAll('svg.map .pt').length; return pins >= 2 && pins <= S.locks.length; }) && !(await page.locator('svg.map').innerHTML()).includes('牛顿'));
  await page.evaluate(() => { const S = window.__game.ctx.S(); window.__saved_visited = S.visited; S.visited = []; window.__game.ui.render(); });
  ok('an anchored place nobody has been to is a question mark but can be picked', (await page.locator('svg.map .pt text').first().textContent()).includes('?') && await page.evaluate(() => { window.__game.ui.state.modal = { kind: 'dispatch' }; window.__game.ui.render(); document.querySelector('#modal'); return 1; }) === 1 && (await page.locator('#modal [data-act=send]').count()) === 1);
  await page.keyboard.press('Escape');
  await page.evaluate(() => { window.__game.ctx.S().visited = window.__saved_visited; window.__game.ui.render(); });
  // a catalogue relic reveals its event on the map and in the wiki, but nobody can be sent there
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.funds = 5000; window.__game.ctx.save(); });
  await go('shop');
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.antiques.push('relic_newton_cambridge'); S.locks.push('relic_newton_cambridge'); window.__game.ui.render(); });
  await go('home');
  await page.waitForSelector('svg.map');
  await page.evaluate(() => { const m = window.__game.ui.state.map; m.z = 1; m.cx = 180; m.cy = 71; window.__game.ui.render(); });
  await page.click('.map [data-id=london_soho] .hit', { force: true });
  ok('a relic puts its event in the list of its place', (await page.locator('#modal .evrow[data-id=newton_cambridge]').count()) === 1);
  await page.click('#modal .evrow[data-id=newton_cambridge]');
  await page.keyboard.press('Escape');
  // typing in the year box while the clock runs a trip must not be interrupted by the redraw of the page
  await page.evaluate(() => { const g = window.__game, S = g.ctx.S(); S.dispatches = S.dispatches.filter((d) => d.claimed); for (const k of Object.keys(S.staff)) S.staff[k].restUntil = 0; g.ui.office.launch('broad_street_1854', { seed: 3, staffId: 's_ning', items: {} }); S.clock.speed = 1; g.ui.render(); });
  await openFilter();
  await page.click('#map-from', { clickCount: 3 });
  await page.keyboard.type('1850', { delay: 450 });
  ok('digits typed in the year box stay in order while the clock runs', (await page.locator('#map-from').inputValue()) === '1850');
  await page.selectOption('[data-clk=speed]', '0');
  await page.fill('#map-from', '-5000');
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.dispatches = S.dispatches.filter((d) => d.claimed); window.__game.ui.render(); });
  // the open filter panel lies over a part of the map, so it is folded before a pin is clicked
  await page.evaluate(() => { window.__game.ui.state.map.filterOpen = false; window.__game.ui.render(); });
  await pick('london_soho', 'newton_cambridge');
  ok('an anchored catalogue event shows its card and can be gone to', (await page.locator('.lbox').filter({ hasText: '牛顿' }).count()) >= 1 && !(await page.locator('[data-act=send]').isDisabled()));
  await page.click('[data-act=send]');
  await page.waitForSelector('.outrow');
  await page.evaluate(() => { const S = window.__game.ctx.S(); for (const d of S.dispatches.filter((x) => !x.claimed)) d.readyDay = S.clock.day; window.__game.ui.render(); });
  await page.waitForSelector('[data-act=claim]');
  await page.click('[data-act=claim]');
  await page.waitForSelector('.stamp');
  ok('a small story has its own short report and no branch timeline', (await page.locator('.tl').count()) === 0 && (await page.locator('.quote').count()) === 1 && (await page.locator('table').count()) === 1);
  await page.click('[data-act=back]');
  await tool('wiki');
  await page.fill('#wiki-q', '月亮');
  ok('relic unlocked the event article', (await page.locator('#wiki-list .wrow:not(.locked)').count()) === 1);
  await go('shop');
  await sub('future');
  ok('guest sees the future shop and its goods', (await page.locator('[data-act=cartinc][data-id=radiation_shield]').count()) === 1);
  // English, language switch and fallback
  await page.goto(`http://127.0.0.1:${port}/index.html?lang=en`);
  await page.waitForSelector('.lead');
  ok('English title', (await page.title()) === 'The Teleporter');
  ok('English tab label', (await page.locator('#tabs [data-tab=shop]').textContent()).includes('Agency'));
  await go('home');
  await page.waitForSelector('svg.map');
  await openFilter();
  await page.fill('#map-from', '-500');
  ok('English BC format', (await page.locator('#map-fromtxt').innerText()) === '500 BC');
  await page.fill('#map-from', '1840');
  await tool('wiki');
  await page.waitForSelector('.wiki');
  ok('English wiki lists categories', (await page.locator('.wcat summary').first().innerText()).length > 0);
  // follow browser is the default, a switch keeps the page and the state
  await tool('settings');
  ok('follow browser is offered and selected by default', (await page.evaluate(() => localStorage.getItem('teleporter_lang'))) === null && (await page.locator('#lang').inputValue()) === 'en');
  ok('language is the first row of the settings page', (await page.locator('.settings .srow').first().locator('#lang').count()) === 1);
  await tool('about');
  ok('about page has the disclaimer', (await page.locator('.about h3').allInnerTexts()).includes('Disclaimer'));
  ok('about page has jump links and no second title', (await page.locator('.about .jumps a').count()) >= 5 && (await page.locator('.about h2').count()) === 0);
  ok('about release shows the date only', (await page.locator('.about .muted').first().innerText()).includes('2026-11-09') && !(await page.locator('.about .muted').first().innerText()).includes('T00'));
  ok('about page names the purpose without a family reason', !(await page.locator('.about').innerText()).toLowerCase().includes('wife') && (await page.locator('.about').innerText()).includes('Life Matters'));
  await tool('wiki');
  await page.click('.wcat[data-cat=people] summary');
  await page.locator('#wiki-list .wrow', { hasText: 'John Snow' }).first().click();
  await page.waitForSelector('#wiki-article h2');
  await page.fill('#wiki-q', 'Snow');
  await tool('settings');
  await Promise.all([page.waitForNavigation(), page.selectOption('#lang', 'zh')]);
  await page.waitForSelector('.settings');
  ok('switching language keeps the settings pop-up open', (await page.locator('#modal .settings').count()) === 1);
  await tool('wiki');
  await page.waitForSelector('.wiki');
  ok('switching language keeps the article', (await page.locator('#wiki-article h2').innerText()).includes('斯诺'));
  ok('switching language keeps the filter text and the open category', (await page.locator('#wiki-q').inputValue()) === 'Snow' && (await page.evaluate(() => window.__game.ui.state.wiki.openCats.people)) === true);
  ok('switching to Chinese sticks', (await page.evaluate(() => localStorage.getItem('teleporter_lang'))) === 'zh' && (await page.locator('#tabs [data-tab=shop]').textContent()).includes('事务所'));
  await tool('settings');
  await Promise.all([page.waitForNavigation(), page.selectOption('#lang', 'auto')]);
  await page.waitForSelector('.settings');
  ok('choosing follow browser clears the saved choice', (await page.evaluate(() => localStorage.getItem('teleporter_lang'))) === null && (await page.locator('#lang').inputValue()) === 'auto');
  const frCtx = await browser.newContext({ locale: 'fr-FR' });
  const frPage = await frCtx.newPage();
  await frPage.goto(`http://127.0.0.1:${port}/index.html`);
  await frPage.waitForSelector('.lead');
  ok('browser language not configured falls back to English', (await frPage.locator('#tabs [data-tab=shop]').textContent()).includes('Agency'));
  await frPage.goto(`http://127.0.0.1:${port}/index.html?lang=fr`);
  await frPage.waitForSelector('.lead');
  ok('?lang with an unconfigured code falls back to English', (await frPage.locator('#tabs [data-tab=shop]').textContent()).includes('Agency'));
  await frCtx.close();
  // a click that spans several ticks of the clock must still land
  await page.goto(`http://127.0.0.1:${port}/index.html?lang=en`);
  await page.waitForSelector('.lead');
  await page.selectOption('[data-clk=speed]', '3');
  const tabBox = await page.locator('#tabs [data-tab=shop]').boundingBox();
  await page.mouse.move(tabBox.x + tabBox.width / 2, tabBox.y + tabBox.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  ok('a slow click on a tab is not lost to the clock', (await page.locator('#tabs button.on').getAttribute('data-tab')) === 'shop');
  await page.selectOption('[data-clk=speed]', '0');
  // the log scrolls, is read from the kept summaries, and a place lists the trips that came home from it
  await go('home');
  const lg = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S();
    const claimed = S.dispatches.filter((d) => d.claimed);
    return { claimed: claimed.length, trips: (S.trips || []).length, paged: !!document.querySelector('#view table.logtable:not(.pending)') && !!document.querySelector('#view [data-act=pgpage]'), size: (window.__game.ui.state.pager.log || {}).size, place: claimed.length ? claimed[claimed.length - 1].eraId : null, rows: document.querySelectorAll('.logtable:not(.pending) tbody tr').length, perPlace: Math.max(0, ...Object.values(claimed.reduce((a, d) => ((a[d.eraId] = (a[d.eraId] || 0) + 1), a), {}))) };
  });
  ok('the log is a table with a pager', lg.paged);
  ok('every finished trip has a summary that is kept', lg.claimed > 0 && lg.trips >= lg.claimed);
  ok('the log shows a page of the summaries, not only the stored reports', lg.rows === Math.min(lg.size, lg.trips));
  ok('at most the best and the latest report are stored for a place', lg.perPlace <= 2);
  // paging: 25 trips make three pages of ten, the last with five
  const pg = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S();
    const keep = S.trips;
    S.trips = Array.from({ length: 25 }, (_, i) => ({ id: 'd' + (900 + i), place: 'broad_street_1854', light: false, staffId: 's_ning', stars: 1, day: i, back: i, outcome: 'success' }));
    g.ui.state.pager.log = { size: 10, page: 0 }; g.ui.render();
    const rows = () => document.querySelectorAll('.logtable:not(.pending) tbody tr').length;
    const out = { first: rows() };
    document.querySelector('[data-act=pgpage][data-id="log:next"]').click(); out.second = rows();
    document.querySelector('[data-act=pgpage][data-id="log:next"]').click(); out.third = rows();
    out.nextOff = document.querySelector('[data-act=pgpage][data-id="log:next"]').disabled;
    S.trips = keep; g.ui.state.pager.log = { size: 50, page: 0 }; g.ui.render();
    return out;
  });
  ok('the log pages by ten, then ten, then the rest', pg.first === 10 && pg.second === 10 && pg.third === 5 && pg.nextOff);
  const hist = await page.evaluate((place) => {
    const g = window.__game;
    const ev = g.D.get('catalog.events').find((e) => e.id === place);
    return { n: g.ui.office.tripsOf(place).length, html: ev ? g.ui.X.storyFor({ catalog: true, id: place }) : g.ui.X.storyFor({ id: place }) };
  }, lg.place);
  ok('the story of a place lists the trips that came home from it', hist.n > 0 && hist.html.includes('class="trips"'));
  // favor bends the points of a trip, and three three star trips give a point of a random attribute
  const fv = await page.evaluate(() => {
    const g = window.__game, b = g.backend, off = g.ui.office, D = g.D;
    const ids = D.get('catalog.events').map((e) => e.id).slice(0, 60);
    const mean = (favor) => { let n = 0, s = 0; for (const e of ids) for (let seed = 1; seed <= 6; seed++) { s += b.runLight(e, 's_ning', seed, {}, favor).stars; n++; } return s / n; };
    const low = mean(0), high = mean(1);
    const base = { ...D.get('staff.staff.s_ning.base') };
    const sf = g.ctx.S().staff.s_ning; sf.tally = { 3: 0, 2: 0, 1: 0 };
    const got = [11, 12, 13].map((seq) => { sf.tally[3] += 1; return off.grow('s_ning', seq); });
    const after = D.get('staff.staff.s_ning.base');
    const diff = Object.keys(after).filter((k) => after[k] !== base[k]);
    const growth = { ...sf.growth };
    D.o.staff.staff.s_ning.base = base; sf.growth = {}; sf.tally = { 3: 0, 2: 0, 1: 0 };
    return { low, high, got, diff, attr: got[2], growth };
  });
  ok('a favored employee does better than one who is not', fv.high > fv.low);
  ok('three three star trips give one point of one attribute, not before', fv.got[0] === null && fv.got[1] === null && !!fv.got[2] && fv.diff.length === 1 && fv.diff[0] === fv.attr && fv.growth[fv.attr] === 1);
  // the mood changes every attribute by up to a fifth, and a reward costs a day of wages and adds ten to the mood
  const md = await page.evaluate(() => {
    const g = window.__game, b = g.backend, off = g.ui.office, S = g.ctx.S();
    const lo = b.staffStats('s_ning', 0), mid = b.staffStats('s_ning', 0.5), hi = b.staffStats('s_ning', 1);
    const id = off.hiredIds()[0], n = off.hiredIds().length;
    S.funds = 1000; const f0 = S.staff[id].favor; S.staff[id].favor = 0.5;
    const cost = off.giftCost();
    off.gift(id);
    const r = { lo: lo.wit / mid.wit, hi: hi.wit / mid.wit, cost, paid: 1000 - S.funds, mood: S.staff[id].favor - 0.5, want: Math.round(off.wageOf(n) / n) };
    S.staff[id].favor = f0;
    return r;
  });
  ok('full mood adds a fifth to the attributes and none takes a fifth away', Math.abs(md.hi - 1.2) < 1e-9 && Math.abs(md.lo - 0.8) < 1e-9);
  ok('a reward costs a day of the wages of that person and adds ten to the mood', md.paid === md.cost && md.cost === md.want && Math.abs(md.mood - 0.1) < 1e-9);
  // the record of one person opens as a pop-up from the tally of stars, and a trip can be archived and brought back
  await go('shop');
  await page.click('.tallylink >> nth=0');
  ok('the tally of stars opens the record of that person in a pop-up, with the star of the five attributes', (await page.locator('#modal #lb-staff_trips').count()) === 1 && (await page.locator('#modal .tally').count()) >= 1 && (await page.locator('#modal svg.radar .area').count()) === 1);
  await page.keyboard.press('Escape');
  await go('home');
  const ar = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    const rows = () => document.querySelectorAll('.logtable:not(.pending) tbody tr').length;
    const before = rows();
    // a trip whose report is still stored, so that keeping it can be seen
    const id = S.dispatches.filter((d) => d.claimed && S.trips.some((x) => x.id === d.id && !x.archived))[0].id;
    off.archive([id]); g.ui.render();
    const hidden = rows();
    g.ui.state.showArchived = true; g.ui.render();
    const shown = rows(), dim = document.querySelectorAll('.logtable tr.archived').length;
    off.restore([id]); g.ui.state.showArchived = false; g.ui.render();
    return { before, hidden, shown, dim, back: rows(), kept: S.dispatches.some((d) => d.id === id) };
  });
  ok('an archived trip leaves the log, shows dimmed on request, and comes back', ar.hidden === ar.before - 1 && ar.shown === ar.before && ar.dim === 1 && ar.back === ar.before);
  ok('archiving keeps the report', ar.kept === true);
  // wages: paid per whole day for everyone hired, rising with the headcount, and an empty purse costs favor
  const wg = await page.evaluate(() => {
    const g = window.__game, o = g.ui.office, S = g.ctx.S();
    S.funds = 1000; S.wageDay = Math.floor(S.clock.day);
    S.clock.day += 3; o.advance(0);
    const paid = 1000 - S.funds;
    const f0 = o.hiredIds().map((id) => S.staff[id].favor);
    S.funds = 0; S.clock.day += 1; o.advance(0);
    const f1 = o.hiredIds().map((id) => S.staff[id].favor);
    const n = o.hiredIds().length;
    return { paid, want: 3 * o.wageTotal(), rising: o.wageOf(n + 1) - o.wageOf(n) > o.wageOf(n) - o.wageOf(n - 1), poor: S.funds === 0 && f1.every((v, i) => v < f0[i] || f0[i] === 0), mult: g.ctx.backend.marketMult('relic_faraday_london', 40) };
  });
  ok('wages are paid for every whole day', wg.paid === wg.want);
  ok('each further hire costs more per day than the one before', wg.rising);
  ok('an unpaid day empties the funds and costs favor', wg.poor);
  ok('the market factor stays within its band', wg.mult >= 0.7 && wg.mult <= 1.3);
// a pop-up stops the clock and gives the speed back, low funds hold the speed, an unpaid day stops the clock with a pop-up
await page.evaluate(() => { const S = window.__game.ctx.S(); S.clock.speed = 16; S.clock.resume = null; window.__game.ui.render(); });
await tool('about');
const held = await page.evaluate(() => { const c = window.__game.ctx.S().clock; return { speed: c.speed, resume: c.resume }; });
ok('a pop-up stops the clock and remembers the speed', held.speed === 0 && held.resume === 16);
await page.keyboard.press('Escape');
const freed = await page.evaluate(() => { const c = window.__game.ctx.S().clock; return { speed: c.speed, resume: c.resume }; });
ok('closing the pop-up gives the speed back', freed.speed === 16 && freed.resume == null);
const low = await page.evaluate(() => { const g = window.__game, o = g.ui.office, S = g.ctx.S(); S.funds = 1; const lo = o.effectiveSpeed(); S.funds = 100000; const hi = o.effectiveSpeed(); return { lo, hi, cap: g.D.get('config.clock.low_funds_speed') }; });
ok('low funds hold the speed and plenty lets it run', low.lo === low.cap && low.hi === 16);
await page.evaluate(() => { const g = window.__game, o = g.ui.office, S = g.ctx.S(); S.funds = 0; S.clock.speed = 4; S.clock.day += 1; o.advance(0); });
await page.waitForSelector('#modal .mbox h2');
const broke = await page.evaluate(() => ({ speed: window.__game.ctx.S().clock.speed, same: document.querySelector('#modal .mbox h2').textContent === window.__game.D.get('text.ui.clock.broke_title') }));
ok('an unpaid day stops the clock and opens the pop-up', broke.speed === 0 && broke.same);
await page.keyboard.press('Escape');
const noteN = await page.evaluate(() => { const g = window.__game, S = g.ctx.S(); const before = document.querySelectorAll('#toasts .toast').length; return before; });
ok('the notes of returns do not pile up', noteN <= 3);
// the shade of the night on the map follows the clock, and the setting takes it off
await go('home');
const night1 = await page.locator('svg.map .night path').getAttribute('d');
await page.selectOption('[data-clk=speed]', '3');
await page.waitForTimeout(2200);
const night2 = await page.locator('svg.map .night path').getAttribute('d');
await page.selectOption('[data-clk=speed]', '0');
ok('the night shade is on the map and moves with the clock', !!night1 && night1.startsWith('M') && night1 !== night2);
await page.evaluate(() => { window.__game.ctx.settings.set('map_daynight', false); window.__game.ui.render(); });
ok('the setting takes the night shade off the map', (await page.locator('svg.map .night').count()) === 0);
// a save that names something no longer in the data is not loaded, the game starts again instead of showing an empty page
await page.evaluate(() => { const S = JSON.parse(localStorage.getItem('teleporter_save')); S.locks.push('relic_removed_event'); localStorage.setItem('teleporter_save', JSON.stringify(S)); });
await page.goto(`http://127.0.0.1:${port}/index.html?dev=0&lang=zh`);
await page.waitForSelector('#tabs button');
ok('a save that does not fit the data is dropped and the page still opens', (await page.locator('#tabs button[data-tab]').count()) === 3 && !(await page.evaluate(() => window.__game.ctx.S().locks.includes('relic_removed_event'))));
} catch (e) {
  errors.push('script: ' + e.message);
  await page.screenshot({ path: path.join(outDir, 'fail.png'), fullPage: true });
}
await browser.close();
server.kill();
console.log(errors.length ? errors.join('\n') : 'no console errors');
