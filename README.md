# The Past Is Yet to Come

Chinese title: 白露未晞, from the Book of Songs, Jian Jia: the white dew on the reeds is not yet dry.

You run a small staffing agency that sends people into the past. History is drifting: every trip prises a branch off it, so the agency holds the moments that are slipping and mends, in a branch, what history left undone. The staff come home with stories and time energy, and you spend the energy on getting back to your own family.

It is a travel-frog style game: send people out, wait, read what happened. Each trip is an automatic simulation of the traveller and the protagonist of the era, driven by traits and the conditions of that era. Every report is set against a baseline run of the same seed without the traveller.

## Status

Version 0.10.0, the first release. Forty six stories are open, each holding a moment of history or mending a regret in a branch; more are added release by release.

## Run

Open `play.html` with a double click. It is the whole game in one page and needs no server; it has to stay in the root of the game folder, next to `css/` and `assets/`. It is built by `node tools/build_offline.mjs` and by every release, and is attached to each release rather than kept in the repository.

To work on the game, serve the folder instead, so that changes to the code and to `data/` show on reload:

```
run_game.cmd
```

Then open http://127.0.0.1:8778/index.html. `run_game.cmd` runs `tools/serve.py`, which tells the browser not to cache anything, so a reload never mixes files from before and after a change. Another static file server works too, but after a change it may need a hard reload, Ctrl+F5.

- `node tools/headless.mjs [era] [log] [opt]` runs the simulation without a browser and compares kits and staff from the same seeds.
- `node tools/check_logic.mjs` audits the traits, employees, scenes and items for dead, missing or unreachable parts.
- `node tools/check_content.mjs` builds thousands of reports and fails on a missing text key or template variable.
- `node tools/ui_check.mjs` drives the page with Playwright. Set `PLAYWRIGHT_DIR` to a folder that has `playwright` installed.
- `node tools/check_benchmarks.mjs` runs the benchmark places with the reference employees and checks identities, vignettes and that the employees do not all end the same.
- `node tools/story_probe.mjs <place> [lang] [seed] [staff,...] [item:n,...]` prints, for each employee, who they were taken for, the stars and the record of one trip.
- `node tools/pressure_probe.mjs [place,...] [seeds]` prints how often employees are sent home from each story that is turned on, empty handed and with the fitting kit; `BINS=1` adds the empty handed rate by constitution.
- `node tools/release.cjs <version> "<line>" ...` sets the version, puts the lines on top of `CHANGELOG.md`, rebuilds `data/` and `play.html`, and refuses when the languages differ in their placeholders.
- `node tools/build_offline.mjs` builds `play.html`: the modules bundled into one script with esbuild, fetched by npx at a fixed version, and every file of `data/` and the music carried inline.

## How it is built

- `cards/`: the source of all content, one yaml card per thing, see `cards/README.md`. `data/` is generated from it by `node tools/build_data.mjs`, do not edit `data/` by hand.
- `cards/eras/<id>/model.lm.yaml` is copied to `data/eras/<id>.lm.yaml`: one model file per era, in LM format blocks (variables, equations, simulation, optimization) plus extensions: agents, utility-chosen actions, seeded events, milestones, outcomes, counterfactual scoring, item bindings and per-variable provenance.
- `data/*.yaml`: office numbers, items, staff, all text, as built from the cards. The code reads these files and fails on a missing key. Expressions are compiled without `eval`, and an undeclared variable fails at load.
- `js/sim.js`: generic interpreter. It knows nothing about any era. Same seed and same inputs give the same result, and a random draw depends only on seed, event id and step.
- `js/narrate.js`: turns the structured log into report text. The only place an optional AI narrator would plug in.
- `js/ui.js`: the page.

## License

MIT. The name and logos are not licensed. `vendor/js-yaml.min.js` is MIT licensed by its authors.

## Interface

- Time travel: the trips on the road first, then a slim row of filters and a zoomable world map (Natural Earth 110m land, public domain) with a time axis, then the log of finished trips. A pin is a place and a place holds events at different times; only anchored places are drawn, and an anchored place nobody has been to yet is a question mark. A pin opens a pop-up with its events, an event opens a pop-up with its story, who goes and what they carry, and a Send button.
- Buy: the shop paid in funds, the time shop paid in time energy, and the hiring offer of five candidates. Items sell at the price they were bought for. The research institute provides funding when the agency transfers antiques.
- Agency: the employees, the goods and the antiques. Antiques are found on trips and anchored to open places, spares can be sold. Each employee has a mood and a tally of three, two and one star trips, and a click opens the record of that person.
- Wiki (a pop-up): a left list with search and tag filter, linked articles and back and forward history. Unseen entries show as a question mark. In dev mode they show in full with a hidden mark, and the model categories (formulas, variables, models) appear.
- The wiki, Settings and About are pop-ups from the three icons at the right of the bar. Every list is paged, with no scroll bars, and every table has a filter of its own that opens on a click.
- Dev mode: add `?devtools` to the URL (or `&devtools` when other parameters are present).

## Languages

- The language selector offers English, Simplified Chinese (`zh`), Traditional Chinese (`zh-Hant`), French, Spanish, Japanese and Korean. Untranslated interface, story and encyclopedia text falls back to English key by key.
- Selection priority is `?lang=`, saved choice, browser preferences, then English. Existing `?lang=zh` links and saved choices still work. Browser tags such as `zh-TW` and `zh-HK` select Traditional Chinese; `zh-CN` and `zh-Hans` select Simplified Chinese. Follow browser clears the saved choice. Switching language reloads and restores the current page and UI state.
- Configure selectable languages in `cards/config/config.yaml` under `i18n.locales`. Only the locales in `i18n.story_locales` currently require story translations at build time; keep optional locales out of this list until their stories are ready.
- Add interface strings in `cards/text/<code>/` and encyclopedia translations in the corresponding source cards. Story translation batches can add `catalog` and `eras` mappings in `cards/text/<code>/`, indexed by event and era ID respectively. Text defined on a source card for the same ID and locale takes precedence; keep a translation in one place. Use the same keys and placeholders as English.
- Run `node tools/build_data.mjs` to generate the language packs and `node tools/check_i18n.mjs` to check placeholders, fallback and complete story-card and era coverage in normal mode. Missing translations are reported, not errors. Rebuild the offline page with `node tools/build_offline.mjs` when preparing a release.

## Catalogue and employees

- `data/catalog.yaml` lists the events and their places, years and fields. The published catalogue has 201 events, and developer mode adds two draft entries. Each person’s source card is under `cards/people/`.
- An event becomes available on the map and in the wiki when its relic is anchored. The wiki article lists the event’s sources. Stories use employee traits and equipment to resolve three sync points and select a scene. Three events use full branch simulations in a regular game, and developer mode adds ten draft simulations.
- The map groups nearby events into one pin, and the grouping radius shrinks as you zoom in. The time axis spreads recent years and compresses the deep past.
- `data/staff.yaml` has fifty employees, each with a gender, an age, a region, a job, five attributes, one or two traits and a life story.

## Engine boundary

The interface in `js/` shows data and sends requests, it does not run the simulation. Everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. A server backend with the same methods could keep the yaml and run the engine on the server, leaving the page to carry data only.

## Music

The pieces in `assets/music` are MIDI files from the [Mutopia Project](https://www.mutopiaproject.org), public domain (the licence line in the header of every piece was checked on 2026-11-11) and kept unchanged, with their sources in `assets/music/sources.txt`. The playlist is every .mid file in that folder: drop a file in and run `node tools/build_data.mjs`. The rest of the game is MIT licensed. The page plays the files with a small synthesiser built on Web Audio, and the sound effects are tones it makes itself, so there is no sampled audio. Pieces and effects are listed in `cards/config/audio.yaml`.
