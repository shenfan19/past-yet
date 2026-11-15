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

Set `authors: [AI, Fan Shen]` for an explicit credit or list the contributors to that card. Embedded and separate cards in a person module can inherit the module's `authors`. The build uses `meta.card_authors` for the existing first-party cards and writes the resolved credit into every generated content card. Author credits describe the game's card, while sources and image credits identify the underlying material.

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

An event card has these optional fields. `era: <model id>` hands the event to the full model of the person: the model then stands at the event on the map, the relic of the event is its anchor, and the sync points of the card are the fallback. `start: true` makes the event the place the game starts from. Its relic is then a medium of today, such as a statue, and not an antique: it is held from the start, opens the place, is never found on a trip and is never sold. `stay: <days>` gives the story its own length of stay. The events of a person stand side by side, none waits for another to be visited, and the build stops at an event card with `after`. `draft: true`, and `metadata.status: draft` in a model, keep it out of the published game, see `release` in `config/config.yaml`.

An id may be used once. The build stops with a message when two cards use the same id, when the events of a module and its card do not match, or when a module holds something a module does not use, and `node tools/build_data.mjs --check` says when `data/` is out of date.

A catalogue event can add `scene.vignettes`, an ordered list of entries such as `{id: apple, traits: [bold]}`. After an accepted visit, the first entry matching any of the traveller's listed traits appears in the return report, including for events linked to a full simulation model. The last entry has only an `id` and is the default. Put the prose for each entry under `text.<language>.vignettes.<id>`. These fictional passages do not change the scene's stars. An event can also list `refs` from the wiki to make its historical sources available in the report.

For a standalone model without a catalogue event, put the same entries in `metadata.vignettes`, set `metadata.vignette_source` to a wiki event ID, and put the prose in `era_text.<language>.vignettes`.

Languages are the codes in `config/config.yaml` under `i18n.locales`. A language that lacks a key reads English for that key.

To add:
- a person with an event: copy a folder in `people/`, rename it, and rewrite `person.yaml`, giving the article and the event the next `order`. The relic of the event becomes an antique when the game loads.
- an employee: copy a card in `staff/`, choose traits from `traits/`, a region and a skin tone from `config/hiring.yaml`, one to three jobs, an ethnicity (one short label that names a people or a descent, such as Igbo, Han or African descent, never a place and never a country plus a descent such as African American; where the person lives belongs in the story), and write a short life story that fits the age, the place and the numbers: a high attribute is a gift that shows in the life, a low one is a flaw that shows too. `node tools/check_content.mjs` checks the range of the attributes, that the name is unique, that the titles of the jobs match the ids, and that every region and skin tone is used.
- a language: add its code to `i18n.locales`, then add that language under `text:` in the cards you want to translate and add `text/<lang>/` files. Nothing is required, English fills the gaps.

After any change run the build, then `node tools/check_i18n.mjs`, `node tools/check_benchmarks.mjs` and `node tools/ui_check.mjs`.

## Time

One office day is thirty historical days, `travel.history_days_per_office_day` in `config/config.yaml`. A stay is one to seven office days. A model counts in historical days, and what wears on the traveller at the pace of the office, such as homesickness, is written with `office_step`. Dates are counted on the real calendar from `metadata.era.calendar`, which gives the month and the day of day 0. The crossing is not exact: a trip arrives before or after the planned day by up to a share of its stay, `travel.drift.share`, at least `min_days` and at most `max_days`, drawn from the seed of the trip, never before day 0 of the model. A model may set its own in `metadata.era.drift` as `{early, late}` in historical days, and a model that wants early arrivals begins a few days before the planned day, as Guangzhou 1924 begins on 27 January for an arrival on 4 February.

A report is a story told as one list in time order, one short line to a thing, under the heading Record, after the line of the employee. The office keeps a calendar: day 0 is the real date the game began, and the clock shows the date. The record opens in the year of the office with one line, the date, the employee before the medium or holding the antique, and the year and place they were carried to, with the link to the sources. It turns to the year of the place, marks each new year as the lines reach it, and at the end comes back to the year of the office with the date of return and how it ended, then the rest and the change of mood the trip leaves. The rest of the story of the event is not told in the opening: it is told by the dated lines of the record, plainly. A line is history, what is recorded and happens whoever is there, or a line of the employee: arriving, the identity taken and being taken in, the moments of the model, the scene of the trip and the stars, a line that won a star marked with a star. What is recorded after the employee has left follows in the same list. The reader can show all lines, only history, or only the lines of the employee, the button bearing the name of the employee. Notes are given only where there is something to look up: a line of history names the sources of its fact, from `facts` of the person card, and the sentence with the numbers of the model says that the model worked them out. The numbers, the chart and the ledger appear, folded, only when the model counts something worth it, such as lives in an outbreak; `report.numbers: false` in a model leaves them out, as the founding template does. The body of the employee through the stay as LM reads it is a part of its own, shown always, in the developer mode only, or never by `ui.report_body` in `config/config.yaml`. The ledger of a stay longer than one office day has one row for each office day. In the developer mode, `?devtools`, each line of the record shows where it came from: the date and fact, or the condition with the values it read. The sync points stand under the stars in the summary at the end. The line of arrival says only the date and the place. The stamp of a report is read from three things: how the employee came back, normally, early or the hard way; whether all, some or none of the stars were won; and, where none was won, whether the branch still came out different from the main timeline. Every stamp is a kind word, the least of them is to try again. The table is `stamp` in `config/config.yaml` and the words are `stamp` in `text/<language>/ui_report.yaml`.

A trip may bring back one antique, and only from a year before the year of the place it went to. The nearer the antique lies in time and space, the likelier it is found, see `office.antique_find` in `config/config.yaml`.

## Templates

A model may begin with `template: <name>`. The file `templates/<name>.lm.yaml` holds what the stories of one kind share, and the model of the person is laid over it key by key, so the person file holds only its own place, dates, moments, stars and identities. `templates/founding.lm.yaml` is the first: scattered things have to become one institution by an opening day.

A model may end with `epilogue`, a list of `{date, fact, key}`: what is recorded months or years after the model ends, such as a death or a new name. Each is told plainly as a dated line of history at the end of the record, the text under `era_text.<language>.milestones.<key>`, and the simulation does not run to it. `report.countdown: <variable>` names a day the model counts toward, such as the opening day, and the texts of the ending read `{countdown:i}`, the days left when the traveller went, so the number stays true however the crossing drifts.

A milestone of a model is a line of the report that is written once. Besides `when` it may have:

- `date: "1924-02-17"`: the line is written on that day. A recorded date, with `needs_traveler: false`, writes itself whoever is there. A line of the traveller with a date is written only if the traveller is there on that day.
- `fact: <id>`: the fact of the person card the line rests on.
- `effects`: variables the line changes when it is written.
- `variants`: a list of `{when, key, effects}`. The first whose condition holds gives the text, under `era_text.<language>.milestones.<key>`, and may change variables of its own.

An event with `once: true` happens at most once in a trip. An event that comes again and reads the same is told once in the report, with how many times it came.

`era_text.<language>.personal.<key>.<employee id>` is a line written for one employee at one moment. Where there is one, it is read in place of the line of the moment.

## Tags and identities

The tags of an employee are worked out from the card by the rules in `config/staff_rules.yaml`: tags from an attribute (`steady`, `clumsy`, `eloquent`, `sturdy`, `frail`, `sharp`, `steadfast`), the kinds of work as `class_<kind>`, the traits as `trait_<id>`, `literate`, `learned` or `unlettered`, `female` or `male`, `young` or `elder`, and the face in a place, `face_local`, `face_near` or `face_far`. A model reads each as `tag.<name>`, 1 or 0, in any expression.

A place says whose faces are at home in it: `home: [regions]`, optionally `near: [regions]`, and `crossroads: true` for a port or a great city. For a model these lie in `metadata.era`, with `region` for the part of the world, and for an event in the event card.

An identity is who a traveller is taken for. The library is `config/identities.yaml`, and the names and the accounts travellers give of themselves are in `text/<language>/identities.yaml`. A place lists the identities it has room for in the order it prefers them, `identities: [...]` in a model or an event card, and an employee takes the first that fits. Without a list the default of the library is used. `lodger` asks for nothing, so every employee has a door into every place. A story may give an identity its own name and account under `era_text.<language>.identities`. In a model `ring` is 0 outside the door and 1 inside it, and `conspicuous` is 0, 0.5 or 1 by the face.

## Benchmarks

`node tools/check_benchmarks.mjs` runs the benchmark stories for the reference employees with fixed seeds, both listed in `config/benchmarks.yaml`, and checks that identities are as expected, recorded dates fall on their days, a report keeps to its segments and tells nothing twice, staying to the end is not giving up, empty hands do not make the compared number worse than the main timeline, the employees read different lines and get different stars, and the hooks named in `self_check` are read.

## The engine boundary

The interface in `js/` shows data and sends requests. It does not run the simulation: everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. The local backend calls the engine in the same page. A server backend with the same methods could read the cards, run the engine on the server, and leave the page to carry data only.

The QR matrix is made by `QR_DIR=path node tools/make_share_qr.mjs`, which needs the npm package `qrcode` installed in that folder. Run it again if `meta.links.site` changes.
