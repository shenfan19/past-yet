# The Teleporter: design

This document describes how the game works and why it is built the way it is. The numbers quoted here live in `cards/config/` and can be changed there.

## Premise

You run a small agency that sends people into the past. History cannot be changed, so every trip happens on a parallel branch and the main timeline stays as it was. The difference between the branch and the main timeline is paid out as time energy. The employees are ordinary people with traits, not heroes. When one of them is about to die, a recall charm pulls them back at a cost, so nobody dies and the story goes on. The agency does not take part in wars or regime changes. It does medicine, technology, documents, daily life and witnessing.

The goal is to collect enough time energy to go back to your own time and see your family.

## Game loop

1. Pick a place and a time on the world map.
2. Pick an employee and a kit from the stock, or press Auto configure for a kit. The traveller also brings the ideas or designs that the protagonist of the place can take up, which are not chosen by hand. Only one employee can be in a place at a time.
3. Send them out and let the clock run. Nobody has to watch.
4. When they come home, read the report. It brings funds, time energy and sometimes an antique.
5. Use antiques to open new places, funds to pay wages and buy supplies, and time energy to buy future goods or to go home.

## Pages

- Time travel: one sentence of introduction, the world map with its time axis, at full width, and under it the events of the picked place as an accordion, one open at a time, the open one showing its story at full width. Under them are who goes and what they carry, two boxes of one height with the employees as compact two line cards, the buttons Auto configure, Clear and Send, and then one table of dispatches, the ones still out first with Recall and Collect, then the finished ones with their report.
- The funds, the daily wages and the time energy are icons at the right of the navigation bar on every page, with the wage owed beside them when there is any.
- Agency: the antiques, the items, the shop, the time shop, the employees and the hiring offer.
- Encyclopedia: a wiki of people, events, places, items and employees, linked and filterable. Entries not yet encountered show as a question mark.
- Settings: language, theme, sound and music volume, save export and import, and an advanced section.
- About: introduction, disclaimer, data and privacy, contribution, author, credits and licence.

## Clock and pace

Time runs in game days. At 1x one real minute is one game day. The speeds are pause, 1x, 2x, 4x, 8x and 16x, and the space key pauses. The days an employee spends in the past pass at the same rate as the days in the agency, so a seven day stay takes seven minutes at 1x. A returning report pauses the clock unless the box "reports do not stop" is ticked. Full auto is a checkbox too.

## Employees

- Three employees are on the payroll at the start. Each has a gender, an age, a job, five attributes from 1 to 10 and traits. The five attributes are constitution, wit, finesse, will and desire, and there is nothing hidden behind them. Wit covers knowledge and curiosity, finesse covers eloquence and a light hand, will covers stubbornness and its opposite, homesickness, and desire covers greed and, in reverse, kindness. A weak will means homesickness and being hurt by hostility, a weak constitution means catching disease, and a high desire means greed and less kindness. The era models were written against finer quantities, so each of those is a plain function of one attribute, listed in `staff_rules.yaml`, and at 5 each is what the models always had.
- Wages: each hired employee draws a cash wage per game day, `wage_base + wage_skill * skill`. The three starting employees cost about ten funds a day together. Wages come out of the funds as time passes. When the funds run out, the shortfall is owed, the next income pays it first, and while anything is owed all employees lose favor every day. There is no lockout and nobody quits.
- Letting someone go removes them from the payroll, and hiring them again costs the fee again. The last employee and anyone who is away cannot be let go.
- Favor: a bonus raises it, a good trip raises it, failure, giving up and a recall lower it. A high favor makes an employee slower to get homesick and give up.
- Secretary: one employee can stay at the agency as secretary. They stop travelling and their traits give the agency bonuses to funds income, time energy income, rest time and favor growth. In auto mode the secretary has a preference, and the auto results either suit it or do not.
- Only one employee can be in a place at a time, because the simulation holds one traveller per place.

### Traits

There are six traits: kind, stubborn, curious, silver tongued, sensitive and bold. A trait does not change the attributes. It is worth something at the sync points of a place and costs something there. Each sync point is about one kind of thing, persuading, winning trust, noticing, holding on, enduring or caring, and the traits of an employee add up to a bonus for each kind. A point that was missed is still reached with the chance of a positive bonus, and a negative bonus can lose a point that was reached. The draw is seeded. Two traits also carry a weakness of their own: a kind employee is more easily hurt by hostility, and a sensitive one catches disease more easily. A check fails the build if a trait has only gains or only costs, or if it changes an attribute.

### Hiring

- Two candidates are on offer, like the recruits of a strategy game. Everything is shown before hiring: name, region, skin tone, gender, age, job, abilities, the wage, and every trait with what it gives and what it costs. Hiring one brings another, and every seven game days the whole offer is replaced.
- A candidate is made from one serial number. A region sets the name and the likely skin tones, among fourteen regions across the world, then come gender, age, a job from a list of thirty four, abilities within a range, and two or three different traits. The names, jobs, regions and skin tones are rows in `cards/config/hiring.yaml` and can be added to freely, so combinations are in the thousands. A small share of the offers are the hand written employees.
- Every made employee goes into the encyclopedia the moment they are made, with both language texts in the save, so a switch of language keeps their names. The latest 200 are kept, and anyone on offer or ever hired stays.

### Recall

A trip can be cut short with the Recall button on a trip in transit. It is a request. If the employee agrees they come home at once, the story stops where it is, and they bring back a share of the pay in proportion to how far the trip had got, a chance of keeping the antique in the same proportion, and a loss of favor. They refuse if their outcome was to stay behind, or by a roll that traits move, the hedonist towards refusing and the loyal away from it. A refusal is final for that trip, and they carry on.

## The simulation of a trip

Each era is one model file in LM format, with variables, equations, a simulation block and an optimization block, plus extensions for agents, utility chosen actions, seeded events, milestones, outcomes, counterfactual scoring, item bindings and a provenance tag on every number. The tags are historical, LM model, game assumption and calibrated.

`js/sim.js` is a generic interpreter that knows nothing about any one era. The same seed and the same inputs give the same result, and a random draw depends only on the seed, the event id and the step, so changing one item does not reshuffle the rest. Expressions are compiled without `eval`, and an undeclared variable fails at load.

A trip runs twice from the same seed, once on the main timeline without the traveller and once on the branch with them. The report sets the two against each other: cases, deaths, who was treated and protected, and the accounts. The search for a good kit runs the model over item sets and returns the Pareto front of lives against cost.

## Reports

A report has the story, the ledger by day, the comparison with the baseline, the accounts and hints. The accounts list the cost of the kit, the funds, the time energy, the rest days and the antique brought back. Numbers can be opened to their formula and variables. A report can be run again with the same setup, compared with the previous one, and shared.

## Antiques, anchors and places

An antique is an anchor. It points at one place and one time, and holding it anchored is what opens that place for dispatch and makes its event readable. Places that are not anchored are not drawn on the map at all. An anchored place nobody has been to yet is drawn as a question mark, with no name, place or tags, and it can still be picked and sent to. Its name appears on the map after the first trip there comes home. An anchored event that has no simulation shows its name and story at once, since there is nobody to send.

### Finding antiques

Antiques are not sold. Each trip may bring one back. Let the trip go to a place at year `y0` and position `p0`. Every antique that has a place and a year is a candidate if its year is not later than `y0`. For a candidate at year `y` and position `p`:

- Reach: `w = exp(-(y0 - y) / tau_years - d / tau_km)`, where `d` is the great circle distance in kilometres from `p0` to `p`.
- Each candidate is found with chance `k * w`.
- The trip finds something with chance `min(cap, 1 - product(1 - k * w))`.
- The antique it finds is drawn from the candidates in proportion to `w`. An antique that points to a place with a simulation and is not held yet counts `modelled_place_boost` times heavier, 12 for now, so the way to a place that can be dispatched to is not buried under the many events that have no model yet. With the first one not yet held, about one trip in six brings it back.

So what a trip finds is near in space and earlier in time, and the farther it is in either, the less likely. Finding the very place you are at is the most likely single find, and that gives duplicates. The current values are `k` 0.06, `cap` 0.6, `tau_years` 120 and `tau_km` 2500, which put a trip to London 1854 at about 38 percent and a trip to Vienna 1847 at about 32 percent. The roll is seeded by the dispatch, so a replay finds the same thing, and it belongs to the backend. The page shows the chance on the card of each place.

Because candidates must be earlier, antiques lead backwards in time. A place is reached from a later one, and the way to an earlier era runs through the antiques of the later ones.

### Small stories

A catalogue event without a model is played as a small story. The traveller's abilities, weighted by the field of the event, are set against a difficulty that rises with its tier, with a little seeded luck, and the margin gives one of three outcomes, met them, a brief encounter, or missed them. The trip takes four to nine days by tier, needs no kit, pays funds and time energy by outcome, and may bring back an antique by the same rule as any trip. It has a short report, not a branch comparison. The numbers are in `config.light`. Full auto also sends people on small stories to places it has anchored.

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

Full auto collects reports, anchors every found antique that opens a place, sells spare antiques when the funds fall below a limit, restocks the supplies it has targets for, and sends every idle employee to the free place it has visited least, with a kit chosen by simple rules. It only touches funds, antiques and dispatches. Employees do not die, and a broke office is handled by wages being owed, not by a lockout.

## Catalogue events

`cards/events` lists 100 famous events across the world. The selection is deliberately tilted toward science, technology, philosophy, art and ideas, and away from politics and war. That is a choice for the first version, not a claim about what mattered more in history. Each event has a place, a year, a field, a story, a figure and a relic. The relic is an antique that is found on trips. Anchoring it opens the event, and until then the event is only a question mark. Every event can be gone to once its antique is anchored. Two of them have a full simulation, and the rest are small stories.

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

## Stars

Every place has three sync points, and the stars are how many of them a trip hits, so three stars need all three. A full simulation names its points in its model, `star_points`, and each is a milestone of the model that needs the traveller, so history cannot hit one alone. In London 1854 they are convincing Snow, winning the trust of the street, and having the pump handle removed ahead of history. In Vienna 1847 they are convincing Semmelweis, getting the washing started, and making it a rule ahead of history. A point that the model cannot evaluate cannot be a point. A brief scene has three generic points, reaching the place, meeting the figure and leaving a mark, each a margin of the traveller against the event.

Because the points come from what the traveller does, they depend on the employee's habit and the kit. An employee who works on allies convinces and gets the handle removed, one who works on prevention gets the water or the washing done, and no kit means the points that need supplies cannot be hit.

Every place keeps its best star count. Time energy is paid only for the stars above the best the place has had, a quarter of the base of the place for one star, half for two and all of it for three, each trip paying the difference to what the best already paid, so a place cannot be farmed for energy. Funds and antiques are paid every time, so waiting at home brings money, antiques and new employees, but not by itself the way home. The best stars show on the map pins and event rows in bronze, silver and gold, the map can be filtered by them, the log of dispatches shows the stars of each trip with a mark when it beat the best, and a report lists the points with the ones hit highlighted in the timeline.

## Special equipment and scenes

Time energy is the progress of the game, and it only goes up, so it can unlock things. The time shop sells special equipment for funds, and each piece unlocks when the time energy reaches its number: a cyborg neural chip, a cyborg arm, a cyborg bionic lung, a cyborg gorilla arm, a hologram cloak, and out of myth a golden apple, which triples persuasion, and an elixir. Equipment raises abilities and satisfies the points that ask for an item, so the third star of some scenes cannot be had without it, which locks them behind progress.

The price is being found out. Each piece shows by its exposure, a scene is more suspicious the later its tier, and the chance of being found grows with both, capped at ninety percent. A cloak lowers it, and with no equipment there is nothing to find. Being found out ends in one of three ways, being turned away, which costs a star, being locked up, which costs all stars and the antique and several days, or being hunted, which costs everything and more days and a lot of favor.

Twenty catalogue events are scenes with three authored points, each a requirement on the traveller: an ability, a trait, a job, being a woman, an item, or luck. They are checked directly and are not differential equation simulations like London 1854 and Vienna 1847.

## Inspirations

The encyclopedia follows the Civilopedia of Civilization IV, sending someone out and reading what happened follows Assassin's Creed Brotherhood and Travel Frog, hiring follows Heroes of Might and Magic, the clock and the music player follow Stellaris, and the stars and levels follow Plants vs. Zombies and the full synchronisation of Assassin's Creed. They are named as thanks and have no connection to this game.

## Licence

The game is MIT licensed. The piano files are by Bernd Krueger from piano-midi.de under CC BY-SA 3.0 DE and kept unchanged. See the README for the details.
