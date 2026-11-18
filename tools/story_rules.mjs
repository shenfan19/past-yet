// The rules a story must meet before it is published, checked by the build for every person card that carries a fact sheet.
// They are the checkable half of the story standard: the other half is the written self check in the card, which a reviewer reads.
// A card without `facts` is a story of the older kind and is not checked here; storyReport lists those so that nothing is forgotten.

const CHECKED = ['two_sources', 'official_record', 'single'];
const LEVELS = ['usable', 'careful', 'unused'];
const USES = ['history', 'story', 'wiki'];
const SELF = ['quote_line', 'fact', 'regret_choice', 'bookend', 'share_line', 'share_number'];

// card: the person card. ctx: { id, langs, fallback, hookMax, refIds (a Set of all source ids), eraOf(eventId) -> the raw model of the era of that event or null, eraText(eventId, lang) }
export function checkStory(card, ctx, fail) {
  const at = `people/${ctx.id}/person.yaml`;
  const isObj = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
  const both = (t, what) => { for (const l of ctx.langs) if (!isObj(t) || typeof t[l] !== 'string' || !t[l].trim()) fail(`${at}: ${what} has no ${l} text`); };

  // the hook: one line, short
  if (!isObj(card.hook)) fail(`${at}: a story with facts needs a hook`);
  else {
    both(card.hook, 'the hook');
    const zh = card.hook.zh || '';
    if ([...zh].length > ctx.hookMax) fail(`${at}: the hook is ${[...zh].length} characters in zh, at most ${ctx.hookMax}`);
  }

  // the facts
  const facts = card.facts;
  for (const [fid, f] of Object.entries(facts)) {
    const w = `${at}: fact ${fid}`;
    if (!isObj(f)) { fail(`${w} must be a mapping`); continue; }
    if (!/^-?\d{1,4}(-\d{2}(-\d{2})?)?$/.test(String(f.date))) fail(`${w} needs a date as year, year-month or year-month-day`);
    if (!CHECKED.includes(f.checked)) fail(`${w}: checked must be one of ${CHECKED.join(', ')}`);
    if (!LEVELS.includes(f.level)) fail(`${w}: level must be one of ${LEVELS.join(', ')}`);
    if (!Array.isArray(f.use) || f.use.some((u) => !USES.includes(u))) fail(`${w}: use must be a list of ${USES.join(', ')}`);
    if (!Array.isArray(f.sources)) fail(`${w}: sources must be a list`);
    else for (const s of f.sources) if (!ctx.refIds.has(s)) fail(`${w} names the source ${s}, which does not exist`);
    both(f.text, `fact ${fid}`);
    // a fact that is used is checked, has a source, and is not of the unused level
    if (Array.isArray(f.use) && f.use.length) {
      if (f.checked === 'single') fail(`${w} is used but only one source was seen`);
      if (f.level === 'unused') fail(`${w} is used but its level is unused`);
      if (!Array.isArray(f.sources) || !f.sources.length) fail(`${w} is used but names no source`);
    }
  }

  // the bystanders: at least two, all of them invented and saying so
  const by = isObj(card.bystanders) ? card.bystanders : {};
  for (const [bid, b] of Object.entries(by)) {
    if (!isObj(b) || b.invented !== true) fail(`${at}: bystander ${bid} must say invented: true`);
    else both(b.text, `bystander ${bid}`);
  }

  // what was said: the person speaks only on the record, a bystander only as an invention
  for (const [did, d] of Object.entries(isObj(card.dialogue) ? card.dialogue : {})) {
    const w = `${at}: line ${did}`;
    if (!isObj(d)) { fail(`${w} must be a mapping`); continue; }
    both(d.text, `line ${did}`);
    if (d.who === ctx.id) {
      if (d.recorded !== true) fail(`${w}: a line of the person must be on the record`);
      if (!(d.fact in facts)) fail(`${w}: a line of the person names the fact it rests on`);
      if (!Array.isArray(d.sources) || !d.sources.length || d.sources.some((s) => !ctx.refIds.has(s))) fail(`${w}: a line of the person names its sources`);
    } else if (d.who in by) {
      if (d.recorded !== false) fail(`${w}: a line of a bystander is invented, recorded must be false`);
    } else fail(`${w}: who must be the person or a bystander of the card`);
  }

  // the self check, read by the reviewer
  const sc = card.self_check;
  if (!isObj(sc)) fail(`${at}: a story with facts needs a self_check`);
  else {
    for (const k of SELF) if (typeof sc[k] !== 'string' || !sc[k].trim()) fail(`${at}: self_check.${k} is empty`);
    if (sc.fact && !(sc.fact in facts)) fail(`${at}: self_check.fact names ${sc.fact}, which is not a fact of the card`);
    else if (sc.fact && (facts[sc.fact].checked === 'single' || facts[sc.fact].level === 'unused')) fail(`${at}: self_check.fact rests on a fact that may not be used`);
  }

  // who made it
  // who made it is the card's authors, or config.meta.card_authors; the pack says only under what licence and in which languages, so an author is never written twice
  const pk = card.pack;
  if (!isObj(pk) || !pk.license || !Array.isArray(pk.languages)) fail(`${at}: a story with facts needs pack with license and languages`);
  if (isObj(pk) && 'author' in pk) fail(`${at}: pack has no author; who made the card is its authors, or config.meta.card_authors`);

  // every episode that has a model: a clock of recorded dates, a choice with a price, stars that are deeds of the traveller, and an ending that compares
  const events = isObj(card.events) ? Object.keys(card.events) : [];
  let withModel = 0;
  for (const eid of events) {
    const raw = ctx.eraOf(eid);
    if (!raw) continue;
    withModel++;
    const w = `${at}: the model of ${eid}`;
    const ms = raw.milestones || {};
    const history = Object.entries(ms).filter(([, m]) => m.tag === 'history' && m.needs_traveler === false);
    if (history.length < 2) fail(`${w} has ${history.length} recorded dates that happen by themselves, at least 2 are needed`);
    const choices = Object.values(raw.events || {}).filter((e) => Array.isArray(e.variants) && e.variants.length);
    if (!choices.length) fail(`${w} has no moment with a done and a missed form`);
    for (const p of raw.star_points || []) {
      const m = ms[p.milestone];
      if (!m) fail(`${w}: the star ${p.id} names no milestone`);
      else if (m.tag === 'history' || m.needs_traveler === false) fail(`${w}: the star ${p.id} is a recorded date, a star must be a deed of the traveller`);
    }
    if (Object.keys(by).length < 2) fail(`${w} needs at least two bystanders in the card`);
    for (const l of ctx.langs) {
      const t = ctx.eraText(eid, l);
      const sums = Object.values((t && t.summary) || {});
      if (!sums.some((s) => /\{base_[A-Za-z_]+(:[a-z0-9]+)?\}/.test(s) && /\{(?!base_)[A-Z][A-Za-z_]*(:[a-z0-9]+)?\}/.test(s))) fail(`${w} has no ending in ${l} that compares the main timeline with the branch`);
    }
  }
  return { events: events.length, withModel };
}

// which published stories still lack a fact sheet, as lines for the build to print
export function storyReport(people) {
  const done = people.filter((p) => p.hasFacts).map((p) => p.id);
  const missing = people.filter((p) => !p.hasFacts && p.published).map((p) => p.id);
  return { done, missing };
}
