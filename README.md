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

- `data/eras/*.lm.yaml`: one model file per era, in LM format blocks (variables, equations, simulation, optimization) plus extensions: agents, utility-chosen actions, seeded events, milestones, outcomes, counterfactual scoring, item bindings and per-variable provenance.
- `data/*.yaml`: office numbers, items, staff, all text. The code reads these files and fails on a missing key. Expressions are compiled without `eval`, and an undeclared variable fails at load.
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
