# Cards

The game content lives here as small yaml files, one card per thing. `data/` is generated from these cards and must not be edited by hand.

```
node tools/build_data.mjs          pack the cards into data/
node tools/build_data.mjs --check  write nothing, exit 1 if data/ is out of date
```

A card holds the structure of a thing and its text in every language, so changing one thing means changing one file.

```yaml
# cards/staff/s_amara.yaml
order: 5                 # sort order inside the folder, required on every card
gender: f                # f, m, tf (trans woman), tm (trans man) or x (another gender)
age: 38
region: west_africa      # a region named in config/hiring.yaml, used to see that the world is covered, not shown
skin: t6                 # a skin tone named in config/hiring.yaml
base: {wit: 3, constitution: 3, finesse: 6, will: 3, luck: 9}   # 1 to 10, the average of the five 4 to 6 by age
traits: [kind]           # one or two of the traits in traits/, a plain person gets two
jobs: [midwife, herbalist]   # one to three job ids, the first one is the main one
start_pool: true         # may be one of the candidates offered at the start; at most one candidate per region is offered
text:
  en: {name: Amara Okafor, ethnicity: Igbo, jobs: [Midwife, Herbalist], bio: ..., story: ...}    # the fallback language, required
  zh: {name: 阿玛拉·奥卡福, ethnicity: 伊博人, jobs: [助产士, 草药师], bio: ..., story: ...}   # any other language, may be left out
```

The file name is the id. A card with `id:` inside must match its file name.

| Folder | One card is | Output |
|---|---|---|
| `people/<person>/` | everything about one historical person, as a module, see below | the output of each card inside |
| `items/` | a shop item | `data/items.yaml` |
| `staff/`, `traits/` | an employee, a trait | `data/staff.yaml` |
| `mainline/` | a stage of the main line | `data/mainline.yaml` |
| `wiki/stats`, `wiki/model_events`, `wiki/refs`, `wiki/events` | what is shared by several people: an attribute with its double edge, a model event that several eras use, a source that several people cite, a wiki event | `data/encyclopedia.yaml` and its text |
| `text/<lang>/` | a piece of interface text, merged by key | `data/i18n/text.<lang>.yaml` |
| `config/`, `world/` | small shared files, the world coastline, `audio.yaml` pieces and effects, `share_qr.yaml` the QR matrix of the site address | copied |

## A person is a module

A historical person has one folder, `people/<person>/`, and one file in it, `person.yaml`, holds everything written about that person. To find the events of a person, the lines they said, the sources, open the file of the person. To add a person, drop a folder in. To take one out, remove the folder. Nothing else has to change.

```
people/<person>/
  person.yaml            the card of the person, see below
  era/model.lm.yaml      a full simulation model of the person, when there is one; the id of the era is `metadata.name` of the model
  images/                pictures of the person, named <kind>.<two digits>.<ext>, such as portrait.01.jpg
```

```yaml
# people/<person>/person.yaml
order: 232               # sort order of the article
text:                    # the wiki article of the person; a card without text is not an article, for example a person who only has a quote
  en: {name: ..., text: ...}
events:                  # the events of the person, the episodes, each a full event card under its id, in the order they are listed
  <event id>:
    order: ...
    year: ...
    ...
wiki:                    # the wiki cards and sources only this person uses
  places: {<id>: card}
  events: {<id>: card}
  model_events: {<id>: card}
  refs: {<id>: card}
antiques: {<id>: card}   # antiques made by hand
quotes: {<id>: card}     # lines for the header of the page
era_text:                # the text of the era model, in every language
  en: ...
  zh: ...
hook: {en: ..., zh: ...}  # one line that makes a reader want the rest, at most `release.hook_max` characters in Chinese
facts:                   # the fact sheet: every fact the story may lean on
  f01: {date: '1924-02-04', checked: official_record, level: usable, use: [history, story, wiki], sources: [<ref id>], text: {en: ..., zh: ...}, note: ...}
dialogue:                # what was said: a line of the person only when it is recorded, with its fact and sources; a line of a bystander is invented
  <id>: {who: <person or bystander id>, recorded: true, fact: f09, sources: [...], text: {...}}
bystanders:              # the people who were there and are made up for the game
  <id>: {invented: true, text: {...}}
images:                  # every picture in images/, with where it comes from and why it may be used
  portrait.01.jpg: {title: {en: ..., zh: ...}, author: ..., year: ..., source: ..., license: ..., credit: ...}
self_check:              # the written check of the story, for the reviewer
  quote_line: ...
  fact: f04
  regret_choice: ...
  bookend: ...
  share_line: ...
  share_number: ...
pack: {author: ..., license: ..., version: 1, languages: [en, zh]}
```

A card that has `facts` is a story made by the story process, and the build checks it against `tools/story_rules.mjs`: `checked` is `two_sources`, `official_record` (the record of the institution itself) or `single`; `level` is `usable`, `careful` or `unused`; a fact that is used must not be `single` or `unused` and must name its sources; every episode with a model needs two recorded dates that happen by themselves, a moment with a done and a missed form, stars that are deeds of the traveller and not recorded dates, two bystanders, and an ending that compares the main timeline with the branch. The build prints which published models have no fact sheet yet.

A card may also stay a file of its own inside the module, in the folder of its kind, `events/<id>.yaml`, `wiki/places/<id>.yaml` and so on, with a list of ids under `events:` in `person.yaml`. Both forms build to the same data.

An event card has these optional fields. `era: <model id>` hands the event to the full model of the person: the model then stands at the event on the map, the relic of the event is its anchor, and the sync points of the card are the fallback. `start: true` makes the relic owned from the start, so the place is open from the first moment. `after: <event id>` makes the event the next episode of the same person: its place opens when a trip to the named event has come back. `stay: <days>` gives the story its own length of stay. `draft: true`, and `metadata.status: draft` in a model, keep it out of the published game, see `release` in `config/config.yaml`.

An id may be used once. The build stops with a message when two cards use the same id, when the events of a module and its card do not match, or when a module holds something a module does not use, and `node tools/build_data.mjs --check` says when `data/` is out of date.

Languages are the codes in `config/config.yaml` under `i18n.locales`. A language that lacks a key reads English for that key.

To add:
- a person with an event: copy a folder in `people/`, rename it, and rewrite `person.yaml`, giving the article and the event the next `order`. The relic of the event becomes an antique when the game loads.
- an employee: copy a card in `staff/`, choose traits from `traits/`, a region and a skin tone from `config/hiring.yaml`, one to three jobs, an ethnicity (one short label that names a people or a descent, such as Igbo, Han or African descent, never a place and never a country plus a descent such as African American; where the person lives belongs in the story), and write a short life story that fits the age, the place and the numbers: a high attribute is a gift that shows in the life, a low one is a flaw that shows too. `node tools/check_content.mjs` checks the range of the attributes, that the name is unique, that the titles of the jobs match the ids, and that every region and skin tone is used.
- a language: add its code to `i18n.locales`, then add that language under `text:` in the cards you want to translate and add `text/<lang>/` files. Nothing is required, English fills the gaps.

After any change run the build, then `node tools/check_i18n.mjs` and `node tools/ui_check.mjs`.

## The engine boundary

The interface in `js/` shows data and sends requests. It does not run the simulation: everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. The local backend calls the engine in the same page. A server backend with the same methods could read the cards, run the engine on the server, and leave the page to carry data only.

The QR matrix is made by `QR_DIR=path node tools/make_share_qr.mjs`, which needs the npm package `qrcode` installed in that folder. Run it again if `meta.links.site` changes.
