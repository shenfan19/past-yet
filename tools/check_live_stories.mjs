import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { loadData } from '../js/data.js';
import { createLocalBackend } from '../js/backend.js';

const yaml = createRequire(import.meta.url)('../vendor/js-yaml.min.js');
const read = (file) => fs.readFile(new URL('../' + file, import.meta.url), 'utf8');
const roster = ['s_fan', 's_guilan', 's_somchai', 's_carlos', 's_samuel', 's_amara', 's_jeanluc'];
function relevantKit(data, backend, event) {
  const items = data.get('items');
  const ids = new Set(['first_aid_kit', 'warm_blanket']);
  function addRequirements(req) {
    if (req.item) ids.add(req.item);
    if (req.provides) {
      const provider = Object.keys(items).find((id) => items[id].playable && items[id].provides?.includes(req.provides));
      if (provider) ids.add(provider);
    }
    for (const alternative of req.any || []) addRequirements(alternative);
  }
  for (const point of event.scene?.points || []) addRequirements(point.req);
  const activeChannels = Object.keys(event.channels || {}).filter((channel) => !data.get('config.channels.off').includes(channel));
  for (const [id, item] of Object.entries(items)) {
    if (item.channels?.some((channel) => activeChannels.includes(channel))) ids.add(id);
  }
  return Object.fromEntries([...ids]
    .filter((id) => items[id]?.playable && backend.lightKitAllowed(event.id, id))
    .map((id) => [id, items[id].kind === 'consumable' ? items[id].step : 1]));
}

for (const lang of (process.argv.slice(2).length ? process.argv.slice(2) : ['en', 'zh'])) {
  const data = await loadData(read, yaml.load, () => lang, { drafts: false });
  const backend = createLocalBackend(data);
  const stories = data.get('catalog.active_events');
  const staff = roster.filter((id) => Object.hasOwn(data.get('staff.staff'), id));
  assert.ok(staff.length >= 3);
  let reports = 0;
  let evacuations = 0;
  const sameEnding = [];
  for (const event of stories) {
    const patterns = new Set();
    const location = event.era || event.id;
    const max = backend.maxStars(location);
    function run(staffId, seed, items) {
      const label = `${lang}:${event.id}:${staffId}:${seed}`;
      const spec = { staffId, seed, items };
      const trip = event.era ? backend.dispatch(location, spec) : backend.runLight(location, staffId, seed, spec.items);
      if (trip.evacuation) { evacuations++; return; }
      const report = event.era ? trip.report : trip;
      assert.ok(Number.isInteger(report.stars) && report.stars >= 0 && report.stars <= max, label);
      assert.ok(report.timeline?.length, label + ' has no trip record');
      for (const { text } of report.timeline) {
        assert.ok(typeof text === 'string' && text.trim(), label + ' contains an empty line');
        assert.doesNotMatch(text, /\{[A-Za-z_][\w.:]*\}|\b(?:undefined|NaN)\b/, label + ' has unresolved report text');
      }
      patterns.add(JSON.stringify([report.outcomeId ?? report.outcome, report.points.map(({ hit, lost }) => [!!hit, !!lost])]));
      reports++;
    }
    for (const staffId of staff) for (const seed of [17, 36891]) run(staffId, seed, {});
    if (patterns.size <= 1 && event.scene && !event.era) {
      const kit = relevantKit(data, backend, event);
      for (const staffId of staff) for (const seed of [17, 36891]) run(staffId, seed, kit);
      for (const staffId of Object.keys(data.get('staff.staff'))) {
        if (patterns.size > 1) break;
        if (!staff.includes(staffId)) for (const seed of [17, 36891]) run(staffId, seed, kit);
      }
    }
    assert.ok(patterns.size, `${lang}:${event.id} all runs evacuated`);
    if (patterns.size === 1) sameEnding.push(event.id);
  }
  console.log(`${lang}: ${stories.length} live stories; ${reports} completed reports, ${evacuations} evacuations`);
  if (sameEnding.length) console.log('One result pattern in this sample (review the cases by hand): ' + sameEnding.join(', '));
}
