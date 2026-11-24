# The Past Is Yet to Come

[简体中文](README.zh-CN.md) · [繁體中文](README.zh-TW.md) · [日本語](README.ja.md) · [한국어](README.ko.md)

You run a small staffing agency that sends people into the past. History is drifting: every trip prises a branch off it, so the agency holds the moments that are slipping and mends, in a branch, what history left undone. The staff come home with stories and time energy, and you spend the energy on getting back to your own family.

It is a travel-frog style game: send people out, wait, read what happened. Each trip is an automatic simulation of the traveller and the protagonist of the era, driven by traits and the conditions of that era. Every report is set against a baseline run of the same seed without the traveller.

## Status

Version 0.12.1 has 57 playable stories. See [the changelog](CHANGELOG.md) for what changed.

## Run

On Windows, make sure Python 3 is on your PATH. From the repository folder, run:

```
run_game.cmd
```

Leave that window running and open [the game in your browser](http://127.0.0.1:8778/index.html). The script starts a local server with caching disabled, so reloading picks up changes to the code and data. You don't need to build anything to run the checked-out game.

Use **Settings → Data** to transfer a save between browsers or addresses. Large saves are stored in IndexedDB and export as `past-yet-come-save.json.gz` in browsers that support gzip streams. The import picker accepts that file and earlier JSON saves.

## Deploy to Cloudflare

Past uses Cloudflare Workers Builds with static assets, like CARE. Run `node tools/build_web.mjs` to rebuild the game data and prepare `dist/`. The public homepage is `dist/index.html`, and visitors can open the site at `/`. Git ignores the generated `dist/`; Cloudflare builds it from the repository.

In **Workers & Pages**, import the GitHub repository as a Worker using these settings. [Cloudflare Workers Builds configuration](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/)

| Setting | Value |
| --- | --- |
| Worker name | `past-yet-come` |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `node tools/build_web.mjs` |
| Deploy command | `npx wrangler deploy` |

`wrangler.jsonc` sets `dist/` as the static assets directory. After the first deployment succeeds, go to **Settings → Domains & Routes → Add → Custom Domain** in the Worker and enter `www.pastyet.com`. Pushes to `main` then rebuild and deploy the site. [Cloudflare Workers custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/)

## Development tools

- `node tools/headless.mjs [era] [log] [opt]` runs the simulation without a browser and compares kits and staff from the same seeds.
- `node tools/check_logic.mjs` audits the traits, employees, scenes and items for dead, missing or unreachable parts.
- `node tools/check_content.mjs` builds thousands of reports and fails on a missing text key or template variable.
- `node tools/ui_check.mjs` drives the page with Playwright. Set `PLAYWRIGHT_DIR` to a folder that has `playwright` installed.
- `node tools/check_benchmarks.mjs` runs the benchmark places with the reference employees and checks identities, vignettes and that the employees do not all end the same.
- `node tools/story_probe.mjs <place> [lang] [seed] [staff,...] [item:n,...]` prints, for each employee, who they were taken for, the stars and the record of one trip.
- `node tools/pressure_probe.mjs [place,...] [seeds]` prints how often employees are sent home from each story that is turned on, empty handed and with the fitting kit; `BINS=1` adds the empty handed rate by constitution.
- `node tools/release.cjs <version> "<line>" ...` sets the version, puts the lines on top of `CHANGELOG.md`, rebuilds `data/` and `play.html`, and refuses when the languages differ in their placeholders.
- `node tools/build_offline.mjs` builds the optional offline page, `play.html`, for release packages. Git ignores this file.

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

- Historical echoes are sourced quotations in the settlement report. Every playable story has echoes, including outcomes with zero stars, lost synchronisation or no participation in the event. The result guides the choice of quotation. Medical evacuation and manual recall skip the echo.
- Time travel: the trips on the road first, then a slim row of filters and a zoomable world map (Natural Earth 110m land, public domain) with a time axis, then the log of finished trips. A pin is a place and a place holds events at different times; only anchored places are drawn, and an anchored place nobody has been to yet is a question mark. A pin opens a pop-up with its events, an event opens a pop-up with its story, who goes and what they carry, and a Send button.
- Buy: the shop paid in funds, the time shop paid in time energy, and the hiring offer of five candidates. Items sell at the price they were bought for. The research institute provides funding when the agency transfers antiques.
- Agency: the employees, the goods and the antiques. Antiques are found on trips and anchored to open places, spares can be sold. Each employee shows a total of their personal best stars across stories. Click it to open their record. Every 30 stars earn one attribute point if an attribute can still grow. Pick a training focus on the employee card or let the game choose.
- Wiki (a pop-up): a left list with search and tag filter, linked articles and back and forward history. Unseen entries show as a question mark. In dev mode they show in full with a hidden mark, and the model categories (formulas, variables, models) appear.
- The wiki, Settings and About open from the icons beside the music controls. Funds, time energy, date, clock speed and auto dispatch share the office status area. Every list is paged, with no scroll bars, and every table has a filter of its own that opens on a click.
- Dev mode: add `?devtools` to the URL (or `&devtools` when other parameters are present).
- `python tools/story_prose_convert.py [eventId,eventId]` converts the story prose of Simplified Chinese into Traditional Chinese with OpenCC, for the stories the Traditional catalogue carries; `--whole` also converts every Traditional Chinese file in place. `--stale` lists the Traditional Chinese story texts that no longer match the conversion of the Chinese, and `--stale --refresh` reconverts them. It needs `pip install opencc pyyaml`.
- Story review save: `node tools/story_review_save.mjs [eventId,eventId]` plays the stories with story prose in `?devtools` and writes a save to import from Settings there. The import replaces the save of that browser. Each story gets V, King, a reader for each written variant and a trip that misses the first ending.

## Languages

- The language selector offers English, Simplified Chinese (`zh`), Traditional Chinese (`zh-Hant`), French, Spanish, Japanese, Korean and Russian. Untranslated interface, story and encyclopedia text falls back to English key by key.
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
