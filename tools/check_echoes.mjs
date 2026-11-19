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
    const choices = Object.values(definitions).filter((quote) => quote.tier && quote.person === person);
    for (const [tier, stars] of [['full', backend.maxStars(eraId)], ['none', 0]]) {
      const selected = backend.echoOf({ ...dispatch, stars });
      if (!choices.length) {
        assert.equal(selected, null, `${lang}: ${event.id} must not borrow an unrelated echo`);
        continue;
      }
      assert.equal(definitions[selected]?.person, person, `${lang}: ${event.id} ${tier} echo owner`);
      if (choices.some((quote) => quote.tier === tier)) assert.equal(definitions[selected].tier, tier);
      assert.ok(text[selected]?.quote && text[selected].occasion && definitions[selected].said);
      assert.match(echoSources(data, definitions[selected].sources, escapeHtml), /<details class="echo-sources">/);
      verified++;
    }
    assert.equal(backend.echoOf({ ...dispatch, recalled: true }), null);
  }
  console.log(`${lang}: ${verified} live full/zero-star settlements with sourced echoes checked`);
}
