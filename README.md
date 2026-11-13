# The Teleporter

You run a small staffing agency that sends people into the past. History cannot be changed, so every trip creates a branch timeline. The staff come home with stories and time energy, and you spend the energy on getting back to your own family.

It is a travel-frog style game: send people out, wait, read what happened. Each trip is an automatic simulation of the traveller and the protagonist of the era, driven by traits and the conditions of that era. Every report is set against a baseline run of the same seed without the traveller.

## Status

Prototype. Two simulated eras (London 1854, Vienna 1847), fifty employees with their own stories, a world map of 179 catalogue events, antiques found on trips and anchored to open places, item allocation, a search for a good item set, an automatic mode, music, a share card and English and Chinese text. Historical facts are placeholders until their sources are checked. How it all works is in [docs/README_design.md](docs/README_design.md).

## Run

```
run_teleporter.cmd
```

Then open http://127.0.0.1:8778/index.html. Any static file server works.

- `node tools/headless.mjs [era] [log] [opt]` runs the simulation without a browser and compares kits and staff from the same seeds.
- `node tools/check_logic.mjs` audits the traits, employees, scenes and items for dead, missing or unreachable parts.
- `node tools/check_content.mjs` builds thousands of reports and fails on a missing text key or template variable.
- `node tools/ui_check.mjs` drives the page with Playwright. Set `PLAYWRIGHT_DIR` to a folder that has `playwright` installed.

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
- Buy: the shop paid in funds, the time shop paid in time energy, and the hiring offer of five candidates. Items sell at the price they were bought for. Trips bring no funds, funds come only from selling antiques.
- Agency: the employees, the goods and the antiques. Antiques are found on trips and anchored to open places, spares can be sold. Each employee has a mood and a tally of three, two and one star trips, and a click opens the record of that person.
- Wiki (a pop-up): a left list with search and tag filter, linked articles and back and forward history. Unseen entries show as a question mark. In dev mode they show in full with a hidden mark, and the model categories (formulas, variables, models) appear.
- The wiki, Settings and About are pop-ups from the three icons at the right of the bar. Every list is paged, with no scroll bars, and every table has a filter of its own that opens on a click.
- Dev mode: off by default, a switch in Settings, overridden by `?dev=1` or `?dev=0` in the address.

## Languages

- Language files are `data/i18n/text.<code>.yaml` and `data/i18n/encyclopedia.<code>.yaml`. The structure of the encyclopedia is language neutral in `data/encyclopedia.yaml`.
- Supported languages are listed in `config.yaml` under `i18n.locales`. English is the fallback and must be complete. Any key another language lacks, a missing file, or a language that is not configured, reads English.
- The language is picked from `?lang=`, then the saved choice, then the browser language, then English. The selector on the settings page has Follow browser as its default, which clears the saved choice. Choosing a language saves it and reloads, and the page, filters, wiki article and scroll positions come back as they were.
- The About pop-up holds the introduction, disclaimer, privacy, how it is driven and credits, in every language.
- To add a language: add its code to `i18n.locales`, copy `text.en.yaml` and `encyclopedia.en.yaml` to the new code, translate what you want, leave the rest.
- `node tools/check_i18n.mjs` compares the files with English (missing keys, stray keys, placeholders that differ) and tests the fallback.

## Catalogue and employees

- `data/catalog.yaml` lists 179 events across the world, half of them regrets, mostly science, technology, philosophy, art and ideas, each with a place, a year and a field. Names, stories and relics are in the language files under `catalog`.
- Each event has a relic, made into an antique when the data loads. A relic is found on trips and makes its event readable in the map and the wiki. Two events have a full branch simulation. The others are played as small stories, a trip of the traveller against the event with no kit and no branch, which pays by how it went.
- The map groups nearby events into one pin, and the grouping radius shrinks as you zoom in. The time axis spreads recent years and compresses the deep past.
- `data/staff.yaml` has fifty employees, each with a gender, an age, a region, a job, five attributes, one or two of 25 traits and a life story, spread over the world roughly as people are. Event summaries are written from general knowledge and unchecked, the wiki marks them so.

## Engine boundary

The interface in `js/` shows data and sends requests, it does not run the simulation. Everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. A server backend with the same methods could keep the yaml and run the engine on the server, leaving the page to carry data only.

## Music

The pieces in `assets/music` are MIDI files from the [Mutopia Project](https://www.mutopiaproject.org), public domain (the licence line in the header of every piece was checked on 2026-11-11) and kept unchanged, with their sources in `assets/music/sources.txt`. The playlist is every .mid file in that folder: drop a file in and run `node tools/build_data.mjs`. The rest of the game is MIT licensed. The page plays the files with a small synthesiser built on Web Audio, and the sound effects are tones it makes itself, so there is no sampled audio. Pieces and effects are listed in `cards/config/audio.yaml`.
