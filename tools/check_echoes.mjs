import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { loadData } from '../js/data.js';
import { createLocalBackend } from '../js/backend.js';
import { echoSources } from '../js/quotes.js';

const yaml = createRequire(import.meta.url)('../vendor/js-yaml.min.js');
const read = (file) => fs.readFile(new URL('../' + file, import.meta.url), 'utf8');
const escapeHtml = (value) => value.replace(/[&<>"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]);
const base = await loadData(read, yaml.load);
for (const lang of Object.keys(base.get('config.i18n.locales'))) {
  const data = lang === base.lang ? base : await loadData(read, yaml.load, () => lang);
  const backend = createLocalBackend(data);
  const definitions = data.get('quotes.quotes');
  const text = data.get('text.quotes');
  const owners = new Map(data.get('encyclopedia.sections.people').flatMap((person) => (person.events || []).map((id) => [id, person.id])));
  const staffId = Object.keys(data.get('staff.staff'))[0];
  let verified = 0;
  for (const event of data.get('catalog.active_events')) {
    const eraId = event.era || event.id;
    const person = owners.get(event.id);
    const dispatch = { id: 'd1', eraId, light: !event.era, spec: { staffId, seed: 1 }, report: {} };
    const max = backend.maxStars(eraId);
    const outcomes = [
      ...Array.from({ length: max + 1 }, (_, stars) => ({ stars, report: {} })),
      { stars: 0, report: { outcomeId: 'desync' } },
      { stars: 0, report: { journey: { accepted: false } } },
    ];
    for (const outcome of outcomes) {
      const trip = { ...dispatch, ...outcome };
      const tier = backend.echoTier(trip);
      const location = `${lang}: ${event.id} ${tier}`;
      const selected = backend.echoOf(trip);
      const quote = definitions[selected];
      assert.ok(person && quote, `${location} needs a sourced echo`);
      assert.equal(quote.person, person, `${location} echo owner`);
      if (tier === 'full' || tier === 'none') assert.equal(quote.tier, tier, `${location} required tier`);
      assert.ok(text[selected]?.who && text[selected].quote && text[selected].occasion && quote.said, location);
      assert.match(echoSources(data, quote.sources, escapeHtml), /<details class="echo-sources">/, location);
      verified++;
    }
    assert.equal(backend.echoOf({ ...dispatch, recalled: true }), null);
    assert.equal(backend.echoOf({ ...dispatch, evacuation: { day: 1 } }), null);
  }
  console.log(`${lang}: ${verified} live settlement outcomes with sourced echoes checked`);
}
