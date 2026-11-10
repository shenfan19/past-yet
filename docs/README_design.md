# The Teleporter: design

This document describes how the game works and why it is built the way it is. The numbers quoted here live in `cards/config/` and can be changed there.

## Premise

You run a small agency that sends people into the past. History cannot be changed, so every trip happens on a parallel branch and the main timeline stays as it was. The difference between the branch and the main timeline is paid out as time energy. The employees are ordinary people with traits, not heroes. When one of them is about to die, a recall charm pulls them back at a cost, so nobody dies and the story goes on. The agency does not take part in wars or regime changes. It does medicine, technology, documents, daily life and witnessing.

The goal is to collect enough time energy to go back to your own time and see your family.

## Game loop

1. Pick a place and a time on the world map.
2. Pick an employee, a kit from the stock, and up to two plots, which are ideas or designs the traveller hands to a historical figure.
3. Send them out and let the clock run. Nobody has to watch.
4. When they come home, read the report. It brings funds, time energy and sometimes an antique.
5. Use antiques to open new places, funds to pay wages and buy supplies, and time energy to buy future goods or to go home.

## Pages

- Home: the premise and rules, the world map with its time axis, the card of the selected place, the three figures that move with the clock, the trips in transit, the recent reports, the main line, the employee list, the kit, the plots, a search for a good kit, and the send button.
- Shop: the stock, the antiques, the modern shop and the future shop.
- Encyclopedia: a wiki of people, events, places, items and employees, linked and filterable. Entries not yet encountered show as a question mark.
- Settings: language, theme, sound and music volume, save export and import, and an advanced section.
- About: introduction, disclaimer, data and privacy, contribution, author, credits and licence.

## Clock and pace

Time runs in game days. At 1x one real minute is one game day. The speeds are pause, 1x, 2x, 4x, 8x and 16x, and the space key pauses. The days an employee spends in the past pass at the same rate as the days in the agency, so a seven day stay takes seven minutes at 1x. A returning report pauses the clock unless the box "reports do not stop" is ticked. Full auto is a checkbox too.

## Employees

- Twenty employees, three of them on the payroll at the start. Each has a gender, an age, a job, a base skill and traits. Applicants show as unknown until they are hired.
- Wages: each hired employee draws a cash wage per game day, `wage_base + wage_skill * skill`. The three starting employees cost about ten funds a day together. Wages come out of the funds as time passes. When the funds run out, the shortfall is owed, the next income pays it first, and while anything is owed all employees lose favor every day. There is no lockout and nobody quits.
- Hiring costs a fee. Letting someone go removes them from the payroll, and hiring them again costs the fee again. The last employee and anyone who is away cannot be let go.
- Favor: a bonus raises it, a good trip raises it, failure and giving up lower it. A high favor makes an employee slower to get homesick and give up.
- Secretary: one employee can stay at the agency as secretary. They stop travelling and their traits give the agency bonuses to funds income, time energy income, rest time and favor growth. In auto mode the secretary has a preference, and the auto results either suit it or do not.
- Habits and traits decide field behaviour, for example whether to focus on the task, the people or the goods, and what to do when turned away at the door.

## The simulation of a trip

Each era is one model file in LM format, with variables, equations, a simulation block and an optimization block, plus extensions for agents, utility chosen actions, seeded events, milestones, outcomes, counterfactual scoring, item bindings and a provenance tag on every number. The tags are historical, LM model, game assumption and calibrated.

`js/sim.js` is a generic interpreter that knows nothing about any one era. The same seed and the same inputs give the same result, and a random draw depends only on the seed, the event id and the step, so changing one item does not reshuffle the rest. Expressions are compiled without `eval`, and an undeclared variable fails at load.

A trip runs twice from the same seed, once on the main timeline without the traveller and once on the branch with them. The report sets the two against each other: cases, deaths, who was treated and protected, and the accounts. The search for a good kit runs the model over item sets and returns the Pareto front of lives against cost.

## Reports

A report has the story, the ledger by day, the comparison with the baseline, the accounts and hints. The accounts list the cost of the kit, the funds, the time energy, the rest days and the antique brought back. Numbers can be opened to their formula and variables. A report can be run again with the same setup, compared with the previous one, and shared.

## Antiques, anchors and places

An antique is an anchor. It points at one place and one time, and holding it anchored is what opens that place for dispatch and makes its event readable. Places that are not open show on the map only as question marks, with no name, place, tags or story.

### Finding antiques

Antiques are not sold. Each trip may bring one back. Let the trip go to a place at year `y0` and position `p0`. Every antique that has a place and a year is a candidate if its year is not later than `y0`. For a candidate at year `y` and position `p`:

- Reach: `w = exp(-(y0 - y) / tau_years - d / tau_km)`, where `d` is the great circle distance in kilometres from `p0` to `p`.
- Each candidate is found with chance `k * w`.
- The trip finds something with chance `min(cap, 1 - product(1 - k * w))`.
- The antique it finds is drawn from the candidates in proportion to `w`.

So what a trip finds is near in space and earlier in time, and the farther it is in either, the less likely. Finding the very place you are at is the most likely single find, and that gives duplicates. The current values are `k` 0.06, `cap` 0.6, `tau_years` 120 and `tau_km` 2500, which put a trip to London 1854 at about 38 percent and a trip to Vienna 1847 at about 32 percent. The roll is seeded by the dispatch, so a replay finds the same thing, and it belongs to the backend. The page shows the chance on the card of each place.

Because candidates must be earlier, antiques lead backwards in time. A place is reached from a later one, and the way to an earlier era runs through the antiques of the later ones.

### Anchoring and selling

- An antique that opens a place must be anchored in the stock list of the shop page. Anchoring opens the place. An anchored copy cannot be sold.
- The same antique can come back more than once. Copies beyond the first are spares. Spares can be sold one by one, or all at once with one button.
- An anchor cannot be released while someone is away at that place, and the last open place cannot be released.
- Each copy is therefore either money or a door.

## Money and energy

- Funds pay wages and the hiring fee, and buy modern supplies. They come from trips and from selling spare antiques and goods.
- Time energy buys future goods and is also what takes you home. Spending it delays going home, which is the trade off between collecting future goods and finishing.
- Future goods are only collected for now, because no era can use them yet. A good whose name and design are borrowed from someone else's work is not sold until that is checked.

## Auto mode

Full auto collects reports, anchors every found antique that opens a place, sells spare antiques when the funds fall below a limit, restocks the supplies it has targets for, and sends every idle employee to the place it has visited least, with a kit and plots chosen by simple rules. It only touches funds, antiques and dispatches. Employees do not die, and a broke office is handled by wages being owed, not by a lockout.

## Catalogue events

`cards/events` lists 100 famous events across the world. The selection is deliberately tilted toward science, technology, philosophy, art and ideas, and away from politics and war. That is a choice for the first version, not a claim about what mattered more in history. Each event has a place, a year, a field, a story, a figure and a relic. The relic is an antique that is found on trips. Holding it makes the event readable. The events have no simulation yet, so they can be found and read but not dispatched to.

## Data and code

- `cards/` is the source of all content, one yaml card per thing. `data/` is generated from it by `node tools/build_data.mjs` and is never edited by hand.
- The code holds no game numbers. Rules, prices, speeds and probabilities are in `cards/config`, read through a strict getter that fails on a missing key.
- The interface in `js/` shows data and sends requests. Everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. A server backend with the same methods could hold the data and the engine and leave the page to carry data only.
- The page is plain ES modules with no build step to run. Any static file server works.
- A save is one JSON object in the browser's local storage. It can be exported and imported from the settings page. A save from another version is dropped and a fresh one starts.

## Languages, sound and sharing

- English is the fallback and must be complete. Simplified Chinese is the second language. Any missing key reads English. `node tools/check_i18n.mjs` checks the files against English.
- The music is a few piano pieces played by a small Web Audio synthesiser from MIDI files, and the sound effects are tones the page makes itself. There is no sampled audio.
- A report can be shared as a card with the title, a line about the trip, the address and a QR code, as a picture to save or copy.
- The theme follows the system and can be set to light or dark. Quotes from historians and scientists rotate in the header.

## Checks

- `node tools/check_content.mjs` builds thousands of reports and fails on a missing text key or template variable.
- `node tools/check_i18n.mjs` and `node tools/check_boundary.mjs` check the languages and the engine boundary.
- `node tools/ui_check.mjs` drives the page with Playwright through dispatching, shopping, wages, antiques, auto mode, the map, the axis, themes, languages and the settings page.
- `node tools/headless.mjs` runs the simulation without a browser and compares kits and staff from the same seeds.

## Licence

The game is MIT licensed. The piano files are by Bernd Krueger from piano-midi.de under CC BY-SA 3.0 DE and kept unchanged. See the README for the details.
