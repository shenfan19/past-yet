# The Teleporter

You run a small staffing agency that sends people into the past. History cannot be changed, so every trip creates a branch timeline. The staff come home with stories and time energy, and you spend the energy on getting back to your own family.

It is a travel-frog style game: send people out, wait, read what happened. Each trip is an automatic simulation of the traveller and the protagonist of the era, driven by traits and the conditions of that era. Every report is set against a baseline run of the same seed without the traveller.

## Status

Prototype P0. Two eras (London 1854, Vienna 1847), three employees, item allocation, employee habits that decide field behaviour, an automatic dyad simulation, a search for a good item set, and reports that persist across reloads. Chinese text only. Historical facts are placeholders until their sources are checked.

## Run

```
run.cmd
```

Then open http://127.0.0.1:8778/index.html. Any static file server works.

- `node tools/headless.mjs [era] [log] [opt]` runs the simulation without a browser and compares kits and staff from the same seeds.
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

- Dispatch: a zoomable world map (Natural Earth 110m land, public domain). A pin is a place, a place holds events at different times. A text filter, tag chips and a time range narrow the events. Staff and items follow.
- Shop: items are bought into stock and carried from stock, items and antiques can be sold, antiques can be locked. The future shop is closed until a future place exists.
- Encyclopedia: a wiki with a left list, search and tag filter, linked articles and back and forward history. Unseen entries show as a question mark. In dev mode they show in full with a hidden mark, and the model categories (formulas, variables, models) appear, with the formulas and variables each event uses.
- Dev mode: `ui.dev_mode` in `data/config.yaml`, overridden by `?dev=1` or `?dev=0` in the address.

## Languages

- Language files are `data/i18n/text.<code>.yaml` and `data/i18n/encyclopedia.<code>.yaml`. The structure of the encyclopedia is language neutral in `data/encyclopedia.yaml`.
- Supported languages are listed in `config.yaml` under `i18n.locales`. English is the fallback and must be complete. Any key another language lacks, a missing file, or a language that is not configured, reads English.
- The language is picked from `?lang=`, then the saved choice, then the browser language, then English. The header selector has Follow browser as its default, which clears the saved choice. Choosing a language saves it and reloads, and the page, filters, wiki article and scroll positions come back as they were.
- The About tab holds the introduction, disclaimer, privacy, how it is driven and credits, in every language.
- To add a language: add its code to `i18n.locales`, copy `text.en.yaml` and `encyclopedia.en.yaml` to the new code, translate what you want, leave the rest.
- `node tools/check_i18n.mjs` compares the files with English (missing keys, stray keys, placeholders that differ) and tests the fallback.

## Catalogue and employees

- `data/catalog.yaml` lists 100 famous events across the world, mostly science, technology, philosophy, art and ideas, each with a place, a year and a field. Names, stories and relics are in the language files under `catalog`.
- Each event has a relic, made into an antique when the data loads. Buying a relic puts its event on the map and in the wiki. The events have no simulation model yet, so they can be found and read but not dispatched to.
- The map groups nearby events into one pin, and the grouping radius shrinks as you zoom in. The time axis spreads recent years and compresses the deep past.
- `data/staff.yaml` has twenty employees with a gender, an age and a job, and thirteen traits. Event summaries are written from general knowledge and unchecked, the wiki marks them so.

## Engine boundary

The interface in `js/` shows data and sends requests, it does not run the simulation. Everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. A server backend with the same methods could keep the yaml and run the engine on the server, leaving the page to carry data only.

## Music

The piano pieces in `assets/music` are MIDI files by Bernd Krueger from [piano-midi.de](https://www.piano-midi.de), kept unchanged and licensed CC BY-SA 3.0 DE. Anyone redistributing them must keep that licence and the attribution. The rest of the game is MIT licensed. The page plays the files with a small synthesiser built on Web Audio, and the sound effects are tones it makes itself, so there is no sampled audio. Pieces and effects are listed in `cards/config/audio.yaml`.
