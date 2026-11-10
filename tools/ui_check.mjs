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
  await page.goto(`http://127.0.0.1:${port}/index.html?lang=zh&dev=1`);
  await page.waitForSelector('.lead');
  // the real pace is one minute a day at 1x, the test runs the clock at three seconds a day
  ok('1x is one real minute per game day', await page.evaluate(() => window.__game.D.get('config.clock').sec_per_day === 60));
  await page.evaluate(() => { window.__game.D.get('config.clock').sec_per_day = 3; });
  await page.screenshot({ path: path.join(outDir, '0_home.png'), fullPage: true });
  await page.waitForSelector('#res .rv');
  await page.screenshot({ path: path.join(outDir, '1_office.png'), fullPage: true });
  // dispatch through the world map
  // tooltip on a trait chip, and a staff link opens the wiki with only its category expanded
  await page.hover('a.chip.tr >> nth=0');
  ok('trait tooltip shows', (await page.locator('#tip').isVisible()) && (await page.locator('#tip').innerText()).length > 0);
  await page.click('a.wl[data-id="staff:s_ning"] >> nth=0');
  await page.waitForSelector('.wiki');
  ok('staff link opens wiki and expands only its category', (await page.locator('.wcat[open]').count()) === 1);
  // back and forward walk the pages, the wiki jump from the home page can be undone
  await page.click('[data-nav="-1"]');
  await page.waitForFunction(() => document.querySelector('#tabs [data-tab=home]').classList.contains('on'));
  ok('back returns from a wiki jump to the page it came from', true);
  await page.click('[data-nav="1"]');
  await page.waitForSelector('.wiki');
  ok('forward goes to the wiki again', (await page.locator('#tabs [data-tab=enc]').getAttribute('class')).includes('on'));
  await page.goBack();
  await page.waitForFunction(() => document.querySelector('#tabs [data-tab=home]').classList.contains('on'));
  ok('the browser back button does the same', true);
  await page.click('[data-tab=home]');
  await page.click('[data-tab=enc]');
  ok('wiki keeps its state when you come back', (await page.locator('.wcat[open]').count()) === 1 && (await page.locator('#wiki-article h2').count()) === 1);
  await page.click('[data-tab=home]');
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
  await page.click('.evrow[data-id=broad_street_1854]');
  ok('picking the open event again closes it', (await page.locator('.evitem .evstory').count()) === 0);
  await page.click('.evrow[data-id=broad_street_1854]');
  await page.fill('#map-q', 'xyz-no-match');
  ok('filter hides all pins', (await page.locator('svg.map .pt').count()) === 0);
  await page.fill('#map-q', '');
  ok('filter restore pins', (await page.locator('svg.map .pt').count()) > 2);
  await page.click('[data-act=autocfg]');
  await page.waitForSelector('.lpin [data-act=dec]', { timeout: 60000 });
  ok('auto configure puts a kit in the carry box', true);
  ok('the open event shows its story under the full width map, one at a time, and who goes and what they carry take a half each', (await page.locator('.evitem .evstory').count()) === 1 && (await page.locator('.cols2.desk > div').count()) === 2);
  ok('plots are not picked by hand, the story names the ideas', (await page.locator('[data-act=plotpick]').count()) === 0 && (await page.locator('.evstory ul li').count()) >= 1);
  await page.click('[data-act=pickstaff][data-id=s_zhou]');
  ok('picked staff is marked', (await page.locator('.pickrow.on a.wl[data-id="staff:s_zhou"]').count()) === 1);
  await page.screenshot({ path: path.join(outDir, '2_dispatch.png'), fullPage: true });
  await page.click('[data-act=send]');
  await page.waitForSelector('[data-act=ff]');
  await page.click('[data-act=ff]');
  await page.waitForSelector('[data-act=claim]');
  ok('ready report puts a badge on the home tab', (await page.locator('#tabs [data-tab=home] .badge').count()) === 1);
  await page.click('[data-act=claim]');
  await page.waitForSelector('.tl');
  await page.screenshot({ path: path.join(outDir, '4_report.png'), fullPage: true });
  // the share page draws a card with a QR code that reads back as the site address
  await page.click('[data-act=shareopen]');
  await page.waitForSelector('#sharecanvas');
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
  await page.click('[data-act=shareback]');
  await page.waitForSelector('.tl');
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
  await page.click('[data-tab=shop]');
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
  // time energy buys future goods, funds buy modern ones
  await page.evaluate(() => { window.__game.ctx.S().energy = 100; window.__game.ui.render(); });
  const fundsB = await page.evaluate(() => window.__game.ctx.S().funds);
  await page.click('[data-act=cartinc][data-id=radiation_shield]');
  await page.click('[data-act=cartbuy][data-id=future]');
  ok('future goods are paid in time energy', await page.evaluate((f) => window.__game.ctx.S().energy === 20 && window.__game.ctx.S().inv.radiation_shield === 1 && window.__game.ctx.S().funds === f, fundsB));
  // the antique roll is the backend's, seeded, and the chance falls to a floor
  ok('antique find is repeatable, and near in time and space beats far', await page.evaluate(() => { const b = window.__game.backend; const o = b.findOdds('broad_street_1854'); const w = (id) => o.list.find((x) => x.id === id).w; return b.findAntique('broad_street_1854', 5) === b.findAntique('broad_street_1854', 5) && o.p <= 0.6 && w('relic_faraday_london') > w('relic_lavoisier_paris') && w('relic_lavoisier_paris') > w('relic_pythagoras_croton') && !o.list.some((x) => x.id === 'relic_einstein_bern'); }));
  ok('the chance of a find is a probability below the cap', await page.evaluate(() => { const b = window.__game.backend; return ['broad_street_1854', 'vienna_1847'].every((e) => { const p = b.findOdds(e).p; return p > 0.1 && p <= 0.6; }); }));
  ok('some first trips bring something back and some do not', await page.evaluate(() => { const b = window.__game.backend; let n = 0; for (let s = 1; s <= 400; s++) if (b.findAntique('broad_street_1854', s)) n++; return n > 80 && n < 280; }));
  ok('the key to a place not yet held is found often enough to open it', await page.evaluate(() => { const b = window.__game.backend; let n = 0; for (let k = 1; k <= 400; k++) if (b.findAntique('broad_street_1854', k, ['pump_rust']) === 'clinic_bell') n++; return n > 30; }));
  // spares: sell all but one of each
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.antiques.push('relic_faraday_london', 'relic_faraday_london', 'relic_faraday_london'); window.__game.ui.render(); });
  const fundsC = await page.evaluate(() => window.__game.ctx.S().funds);
  await page.click('[data-act=sellspares]');
  ok('one click sells the spares and keeps one of each', await page.evaluate((f) => { const S = window.__game.ctx.S(); return S.funds > f && S.antiques.filter((x) => x === 'relic_faraday_london').length === 1; }, fundsC));
  await page.click('[data-act=cartinc][data-id=disinfectant]');
  ok('cart pins the chosen item', (await page.locator('.lpin [data-act=cartdec][data-id=disinfectant]').count()) === 1);
  await page.click('[data-act=cartbuy]');
  ok('bought disinfectant', (await page.evaluate(() => window.__game.ctx.S().inv.disinfectant)) === 2);
  await page.click('[data-act=shopsell][data-id=disinfectant]');
  ok('sold disinfectant', (await page.evaluate(() => window.__game.ctx.S().inv.disinfectant)) === 0);
  ok('future goods are buyable but a borrowed design is not', (await page.locator('[data-act=cartinc][data-id=bionic_lung]').count()) === 1 && (await page.locator('[data-act=cartinc][data-id=bamboo_copter]').count()) === 0);
  await page.fill('#shop-q', '心率');
  ok('shop text filter', (await page.locator('[data-act=cartinc]').count()) === 1);
  await page.fill('#shop-q', '');
  await page.screenshot({ path: path.join(outDir, '5_shop.png'), fullPage: true });
  // second place
  await page.click('[data-tab=home]');
  await page.click('[data-act=mapz][data-id=reset]');
  await page.click('.map [data-id=vienna_general_hospital] .hit', { force: true });
  await page.click('.evrow[data-id=vienna_1847]');
  await page.screenshot({ path: path.join(outDir, '7_dispatch_vienna.png'), fullPage: true });
  ok('vienna sendable after buying its antique', !(await page.locator('[data-act=send]').isDisabled()));
  // wiki
  await page.click('[data-tab=enc]');
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
  // hire, then guest mode
  await page.click('[data-tab=shop]');
  const slotsBefore = await page.evaluate(() => window.__game.ctx.S().hire.slots.map((x) => x.id));
  ok('two candidates are on offer, with gains and costs shown', slotsBefore.length === 2 && (await page.locator('.cand .pro').count()) >= 2 && (await page.locator('.cand .con').count()) >= 2);
  await page.locator('[data-act=hire]').first().click();
  ok('hiring one brings another so two stay on offer', await page.evaluate((before) => { const h = window.__game.ctx.S().hire.slots; return h.length === 2 && h.some((x) => !before.includes(x.id)); }, slotsBefore));
  // secretary, favor, clock and auto mode
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
  // every employee has a wiki page once hired, the made ones too
  // a made employee is in the wiki from the moment they are made, even before hiring
  const offerId = await page.evaluate(() => window.__game.ctx.S().hire.slots.map((x) => x.id).find((id) => window.__game.ctx.S().generated[id]));
  if (offerId) { await page.click(`.cand a.wl[data-id="staff:${offerId}"]`); await page.waitForSelector('.wiki'); ok('a candidate on offer already has a wiki page', (await page.locator('#wiki-article h2').count()) === 1); await page.click('[data-nav="-1"]'); }
  const gid = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    for (let i = 0; i < 40 && !S.hire.slots.some((x) => S.generated[x.id]); i++) { S.hire.slots = []; S.hire.serial += 1; off.ensureHire(); }
    const slot = S.hire.slots.find((x) => S.generated[x.id]);
    S.funds = Math.max(S.funds, 500);
    off.hire(slot.id);
    g.ui.render();
    return slot.id;
  });
  await page.click(`a.wl[data-id="staff:${gid}"]`);
  await page.waitForSelector('.wiki');
  ok('a made employee has a wiki page once hired', (await page.locator('#wiki-article h2').count()) === 1);
  await page.click('[data-nav="-1"]');
  // a recall stops the trip where it is and pays a share, only one employee can be in a place, and the offer changes every seven days
  const rc = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    S.staff.s_ning.restUntil = 0; S.staff.s_lin.restUntil = 0;
    const era = 'broad_street_1854';
    const d = off.launch(era, { seed: 5, staffId: 's_ning', items: {} });
    const second = off.launch(era, { seed: 6, staffId: 's_lin', items: {} });
    S.clock.day += 2;
    const fav = S.staff.s_ning.favor;
    d.report.outcomeId = 'modest';
    const r = off.recall(d.id);
    const b = g.backend;
    D_tmp(g);
    const res = { launched: !!d, secondBlocked: second === null, ok: r.ok, share: d.paid && d.paid.share, recalled: d.recalled, favorDown: S.staff.s_ning.favor < fav,
      stay: b.recallRefused('s_ning', 1, 'stay_and_gifts'), hed: b.recallRefused('tmp_hed', 1, 'modest'), loyal: b.recallRefused('tmp_loyal', 1, 'modest') };
    delete g.D.o.staff.staff.tmp_hed; delete g.D.o.staff.staff.tmp_loyal;
    return res;
    function D_tmp(gg) {
      const O = gg.D.o.staff.staff;
      O.tmp_hed = { traits: ['hedonist', 'hedonist'], base: {}, gender: 'f', age: 30 };
      O.tmp_loyal = { traits: ['loyal', 'loyal'], base: {}, gender: 'f', age: 30 };
    }
  });
  ok('only one employee can be in a place at a time', rc.launched && rc.secondBlocked);
  ok('a recall brings them home with part of the pay and the story stops', rc.ok && rc.recalled && rc.share > 0 && rc.share < 1 && rc.favorDown);
  ok('someone who decided to stay, or a hedonist, can refuse, a loyal one does not', rc.stay === true && rc.hed === true && rc.loyal === false);
  const offerBefore = await page.evaluate(() => window.__game.ctx.S().hire.slots.map((x) => x.id).join());
  await page.evaluate(() => { window.__game.ctx.S().clock.day += 8; });
  await page.selectOption('[data-clk=speed]', '1');
  await page.waitForTimeout(800);
  await page.selectOption('[data-clk=speed]', '0');
  ok('the offer is replaced every seven days', await page.evaluate((before) => window.__game.ctx.S().hire.slots.map((x) => x.id).join() !== before, offerBefore));
  ok('the funds, the wages and the energy are in the navigation bar as icons', (await page.locator('#navrow #res .rv').count()) === 3);
  // stars: time energy is paid only for stars above the best of the place, funds every time
  const sr = await page.evaluate(() => {
    const g = window.__game, S = g.ctx.S(), off = g.ui.office;
    const era = 'vienna_1847';
    S.dispatches = S.dispatches.filter((d) => d.claimed);
    for (const k of Object.keys(S.staff)) S.staff[k].restUntil = 0;
    const crew = Object.keys(S.staff).filter((k) => S.staff[k].hired && S.secretary !== k);
    delete S.stars[era];
    const run = (stars, staff) => {
      const d = off.launch(era, { seed: 11 + stars, staffId: staff, items: {} });
      d.stars = stars; d.readyDay = S.clock.day;
      const before = S.energy;
      off.claim(d.id);
      return { gain: S.energy - before, best: S.stars[era], newBest: d.newBest };
    };
    const a = run(2, crew[0]); const b = run(2, crew[1]); const c = run(3, crew[2]);
    return { a, b, c, base: g.D.get('config.stars.energy_base.' + era) };
  });
  ok('two stars pay half of the base energy', sr.a.gain === Math.round(sr.base / 2) && sr.a.best === 2 && sr.a.newBest === true);
  ok('the same stars again pay no energy, so a place cannot be farmed', sr.b.gain === 0 && sr.b.newBest === false);
  ok('the third star pays the other half', sr.c.gain === Math.round(sr.base / 2) && sr.c.best === 3);
  await page.click('[data-tab=home]');
  await page.selectOption('#map-star', '3');
  ok('the star filter keeps only places with that many stars', await page.evaluate(() => [...document.querySelectorAll('svg.map .pt')].length >= 1 && [...document.querySelectorAll('svg.map .pt')].length <= 3));
  await page.selectOption('#map-star', '');
  await page.click('[data-tab=shop]');
  // wages come out of the funds as time passes, and a short purse leaves them owed
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.funds = 100; S.wageOwed = 0; });
  await page.selectOption('[data-clk=speed]', '3');
  await page.waitForTimeout(1200);
  ok('wages are drawn from the funds', await page.evaluate(() => window.__game.ctx.S().funds < 100));
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.funds = 0; });
  await page.waitForTimeout(1200);
  ok('a short purse leaves wages owed', await page.evaluate(() => window.__game.ctx.S().wageOwed > 0));
  ok('owed wages are shown beside the figures on every page', (await page.locator('#res .chip.warn').count()) >= 1);
  await page.selectOption('[data-clk=speed]', '0');
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.funds = 400; S.wageOwed = 0; for (const k of Object.keys(S.staff)) S.staff[k].favor = 0.5; });
  const hiredN = await page.evaluate(() => Object.values(window.__game.ctx.S().staff).filter((x) => x.hired).length);
  await page.click('[data-act=fire][data-id=s_lin]');
  ok('an employee can be let go', (await page.evaluate(() => Object.values(window.__game.ctx.S().staff).filter((x) => x.hired).length)) === hiredN - 1);
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.staff.s_lin.hired = true; });
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.locks = S.locks.filter((x) => x !== 'clinic_bell'); if (!S.antiques.includes('clinic_bell')) S.antiques.push('clinic_bell'); S.antiques.push('relic_newton_cambridge', 'relic_newton_cambridge'); S.funds = 50; });
  await page.locator('[data-clk=auto]').click();
  await page.selectOption('[data-clk=speed]', '3');
  const claimedBefore = await page.evaluate(() => window.__game.ctx.S().dispatches.filter((d) => d.claimed).length);
  await page.waitForFunction((b) => window.__game.ctx.S().dispatches.filter((d) => d.claimed).length > b, claimedBefore, { timeout: 60000 });
  ok('auto mode dispatches and claims by itself', true);
  ok('auto mode anchors a found antique and sells spares when funds are short', await page.evaluate(() => { const S = window.__game.ctx.S(); return S.locks.includes('clinic_bell') && S.locks.includes('relic_newton_cambridge') && S.antiques.filter((x) => x === 'relic_newton_cambridge').length === 1; }));
  const sec = await page.evaluate(() => window.__game.ctx.S().secretaryLast);
  ok('secretary verdict recorded after auto results', !!sec && typeof sec.met === 'boolean');
  await page.click('[data-tab=shop]');
  ok('verdict chip shows', (await page.locator('.chip:has-text("他的意")').count()) === 1);
  await page.click('[data-act=appoint][data-id=s_zhou]');
  await page.locator('[data-clk=auto]').click();
  await page.selectOption('[data-clk=speed]', '0');
  ok('hired after recruit', (await page.evaluate(() => Object.values(window.__game.ctx.S().staff).filter((x) => x.hired).length)) === 5);
  await page.goto(`http://127.0.0.1:${port}/index.html?dev=0&lang=zh`);
  await page.waitForSelector('.lead');
  // settings, music and effects
  // the time axis zooms around the pointer and slides when dragged, and its marks are plain dots
  await page.click('[data-tab=home]');
  await page.waitForSelector('svg.axis');
  ok('map and axis marks have no rings', (await page.locator('svg .pt .ring').count()) === 0);
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
  await page.click('[data-tab=settings]');
  ok('settings page has four sections', (await page.locator('.settings h3').count()) === 4);
  await page.selectOption('[data-set=theme]', 'dark');
  ok('dark theme is applied', (await page.evaluate(() => document.documentElement.dataset.theme)) === 'dark');
  await page.selectOption('[data-set=theme]', 'auto');
  ok('auto theme clears the attribute', (await page.evaluate(() => document.documentElement.dataset.theme)) === undefined);
  await page.locator('[data-set=music_volume]').fill('0.2');
  ok('volume slider is saved', (await page.evaluate(() => window.__game.ctx.settings.get('music_volume'))) === 0.2);
  await page.click('[data-music=toggle]');
  await page.waitForFunction(() => window.__game.ctx.audio.state.playing && !window.__game.ctx.audio.state.loading, null, { timeout: 8000 });
  ok('music plays without an error', (await page.evaluate(() => window.__game.ctx.audio.state.error)) === null);
  await page.click('[data-music=next]');
  await page.waitForFunction(() => window.__game.ctx.audio.state.index === 1 && !window.__game.ctx.audio.state.loading, null, { timeout: 8000 });
  ok('next piece loads', (await page.evaluate(() => window.__game.ctx.audio.state.error)) === null);
  await page.click('[data-music=toggle]');
  ok('music pauses', (await page.evaluate(() => window.__game.ctx.audio.state.playing)) === false);
  await page.click('[data-act=sfxtry][data-id=send]');
  await page.screenshot({ path: path.join(outDir, '9_settings.png'), fullPage: true });
  await page.click('[data-tab=home]');
  ok('guest has five tabs', (await page.locator('#tabs [data-tab]').count()) === 5);
  await page.click('[data-tab=enc]');
  await page.waitForSelector('.wiki');
  ok('guest wiki has no model categories', (await page.locator('.wcat[data-cat=formulas]').count()) === 0);
  ok('guest sees locked rows and no hidden marks', (await page.locator('.wrow.locked').count()) > 0 && !(await page.locator('#wiki-list').innerText()).includes('(hidden)'));
  await page.screenshot({ path: path.join(outDir, '10_wiki_guest.png'), fullPage: true });
  await page.click('[data-tab=home]');
  ok('guest map draws only anchored places', await page.evaluate(() => { const S = window.__game.ctx.S(); const pins = document.querySelectorAll('svg.map .pt').length; return pins >= 2 && pins <= S.locks.length; }) && !(await page.locator('svg.map').innerHTML()).includes('牛顿'));
  await page.evaluate(() => { const S = window.__game.ctx.S(); window.__saved_visited = S.visited; S.visited = []; window.__game.ui.render(); });
  ok('an anchored place nobody has been to is a question mark but can be picked', (await page.locator('svg.map .pt text').first().textContent()).includes('?') && (await page.locator('[data-act=send]').count()) === 1);
  await page.evaluate(() => { window.__game.ctx.S().visited = window.__saved_visited; window.__game.ui.render(); });
  // a catalogue relic reveals its event on the map and in the wiki, but nobody can be sent there
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.funds = 5000; window.__game.ctx.save(); });
  await page.click('[data-tab=shop]');
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.antiques.push('relic_newton_cambridge'); S.locks.push('relic_newton_cambridge'); window.__game.ui.render(); });
  await page.click('[data-tab=home]');
  await page.waitForSelector('svg.map');
  await page.evaluate(() => { const m = window.__game.ui.state.map; m.z = 1; m.cx = 180; m.cy = 71; window.__game.ui.render(); });
  await page.click('.map [data-id=london_soho] .hit', { force: true });
  ok('a relic puts its event in the list of its place', (await page.locator('.evrow[data-id=newton_cambridge]').count()) === 1);
  await page.click('.evrow[data-id=newton_cambridge]');
  // typing in the year box while the clock runs a trip must not be interrupted by the redraw of the page
  await page.evaluate(() => { const g = window.__game, S = g.ctx.S(); S.dispatches = S.dispatches.filter((d) => d.claimed); for (const k of Object.keys(S.staff)) S.staff[k].restUntil = 0; g.ui.office.launch('broad_street_1854', { seed: 3, staffId: 's_ning', items: {} }); S.clock.speed = 1; g.ui.render(); });
  await page.click('#map-from', { clickCount: 3 });
  await page.keyboard.type('1850', { delay: 450 });
  ok('digits typed in the year box stay in order while the clock runs', (await page.locator('#map-from').inputValue()) === '1850');
  await page.selectOption('[data-clk=speed]', '0');
  await page.fill('#map-from', '-5000');
  await page.evaluate(() => { const S = window.__game.ctx.S(); S.dispatches = S.dispatches.filter((d) => d.claimed); window.__game.ui.render(); });
  await page.click('.map [data-id=london_soho] .hit', { force: true });
  await page.click('.evrow[data-id=newton_cambridge]');
  if (!(await page.locator('.evstory').count())) await page.click('.evrow[data-id=newton_cambridge]');
  ok('an anchored catalogue event shows its card and can be gone to', (await page.locator('.lbox').filter({ hasText: '牛顿' }).count()) >= 1 && !(await page.locator('[data-act=send]').isDisabled()));
  await page.click('[data-act=send]');
  await page.waitForSelector('.outrow');
  await page.evaluate(() => { const S = window.__game.ctx.S(); for (const d of S.dispatches.filter((x) => !x.claimed)) d.readyDay = S.clock.day; window.__game.ui.render(); });
  await page.waitForSelector('[data-act=claim]');
  await page.click('[data-act=claim]');
  await page.waitForSelector('.stamp');
  ok('a small story has its own short report and no branch timeline', (await page.locator('.tl').count()) === 0 && (await page.locator('.quote').count()) === 1 && (await page.locator('table').count()) === 1);
  await page.click('[data-act=back]');
  await page.click('[data-tab=enc]');
  await page.fill('#wiki-q', '苹果');
  ok('relic unlocked the event article', (await page.locator('#wiki-list .wrow:not(.locked)').count()) === 1);
  await page.click('[data-tab=shop]');
  ok('guest sees the future shop and its goods', (await page.locator('[data-act=cartinc][data-id=bionic_lung]').count()) === 1);
  // English, language switch and fallback
  await page.goto(`http://127.0.0.1:${port}/index.html?lang=en`);
  await page.waitForSelector('.lead');
  ok('English title', (await page.title()) === 'The Teleporter');
  ok('English tab label', (await page.locator('#tabs [data-tab=shop]').textContent()).includes('Agency'));
  await page.click('[data-tab=home]');
  await page.waitForSelector('svg.map');
  await page.fill('#map-from', '-500');
  ok('English BC format', (await page.locator('#map-fromtxt').innerText()) === '500 BC');
  await page.fill('#map-from', '1840');
  await page.click('[data-tab=enc]');
  await page.waitForSelector('.wiki');
  ok('English wiki lists categories', (await page.locator('.wcat summary').first().innerText()).length > 0);
  // follow browser is the default, a switch keeps the page and the state
  await page.click('[data-tab=settings]');
  ok('follow browser is offered and selected by default', (await page.evaluate(() => localStorage.getItem('teleporter_lang'))) === null && (await page.locator('#lang').inputValue()) === 'en');
  ok('language is the first row of the settings page', (await page.locator('.settings .srow').first().locator('#lang').count()) === 1);
  await page.click('[data-tab=about]');
  ok('about page has the disclaimer', (await page.locator('.about h3').allInnerTexts()).includes('Disclaimer'));
  ok('about page has jump links and no second title', (await page.locator('.about .jumps a').count()) >= 5 && (await page.locator('.about h2').count()) === 0);
  ok('about release shows the date only', (await page.locator('.about .muted').first().innerText()).includes('2026-11-09') && !(await page.locator('.about .muted').first().innerText()).includes('T00'));
  ok('about page names the purpose without a family reason', !(await page.locator('.about').innerText()).toLowerCase().includes('wife') && (await page.locator('.about').innerText()).includes('Life Matters'));
  await page.click('[data-tab=enc]');
  await page.click('.wcat[data-cat=people] summary');
  await page.locator('#wiki-list .wrow', { hasText: 'John Snow' }).first().click();
  await page.waitForSelector('#wiki-article h2');
  await page.fill('#wiki-q', 'Snow');
  await page.click('[data-tab=settings]');
  await Promise.all([page.waitForNavigation(), page.selectOption('#lang', 'zh')]);
  await page.waitForSelector('.settings');
  ok('switching language keeps the tab', (await page.locator('#tabs [data-tab=settings]').getAttribute('class')).includes('on'));
  await page.click('[data-tab=enc]');
  await page.waitForSelector('.wiki');
  ok('switching language keeps the article', (await page.locator('#wiki-article h2').innerText()).includes('斯诺'));
  ok('switching language keeps the filter text and the open category', (await page.locator('#wiki-q').inputValue()) === 'Snow' && (await page.evaluate(() => window.__game.ui.state.wiki.openCats.people)) === true);
  ok('switching to Chinese sticks', (await page.evaluate(() => localStorage.getItem('teleporter_lang'))) === 'zh' && (await page.locator('#tabs [data-tab=shop]').textContent()).includes('事务所'));
  await page.click('[data-tab=settings]');
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
} catch (e) {
  errors.push('script: ' + e.message);
  await page.screenshot({ path: path.join(outDir, 'fail.png'), fullPage: true });
}
await browser.close();
server.kill();
console.log(errors.length ? errors.join('\n') : 'no console errors');
