# The Teleporter: design

This document describes how the game works and why it is built the way it is. The numbers quoted here live in `cards/config/` and can be changed there.

## Premise

You run a small agency that sends people into the past. History cannot be changed, so every trip happens on a parallel branch and the main timeline stays as it was. The difference between the branch and the main timeline is paid out as time energy. The employees are ordinary people with traits, not heroes. A recall charm pulls an employee back from a trip that would end in death, so employees do not die. The agency does not take part in wars or regime changes. It does medicine, technology, documents, daily life and witnessing.

The goal is to collect enough time energy to go back to your own time and see your family.

## Game loop

1. Pick a place and a time on the world map.
2. Pick an employee and a kit from the stock, or press Auto configure for a kit. The traveller also brings the ideas or designs that the protagonist of the place can take up, which are not chosen by hand. Only one employee can be in a place at a time.
3. Send them out and let the clock run. Nobody has to watch.
4. When they come home, read the report. It brings funds, time energy and sometimes an antique.
5. Use antiques to open new places, funds to buy supplies, and time energy to buy future goods or to go home.

## Pages

- Time travel: one sentence of introduction, a bar of links to its sections (the places, who goes, the dispatch log), the world map with its time axis, at full width, and under it the events of the picked place as an accordion, one open at a time, the open one showing its story at full width. Under them are who goes and what they carry, two boxes of one height with the employees as compact two line cards, the buttons Auto configure, Clear and Send, and then one table of dispatches, the ones still out first with Recall and Collect, then the finished ones with their report.
- The funds and the time energy are icons at the right of the navigation bar on every page.
- Agency: a bar of links to its sections, then the antiques, the items, the shop, the time shop, the employees and the hiring offer. The list can be filtered by text and by tag.
- Encyclopedia: a wiki of people, events, places, items and employees, linked and filterable. Entries not yet encountered show as a question mark.
- Settings: language, theme, sound and music volume, save export and import, and an advanced section, with a bar of links to its sections. The advanced section holds dev mode, off by default, which shows hidden entries and a seed field. `?dev=1` or `?dev=0` in the address overrides it.
- About: introduction, disclaimer, data and privacy, contribution, author, credits and licence, with a bar of links to its sections.

## Clock and pace

Time runs in game days. At 1x one real minute is one game day. The speeds are pause, 1x, 2x, 4x, 8x and 16x, and the space key pauses. The days an employee spends in the past pass at the same rate as the days in the agency, so a seven day stay takes seven minutes at 1x. A returning report pauses the clock unless the box "reports do not stop" is ticked. Full auto is a checkbox too.

## Employees

- Three employees are hired at the start. Each has a gender, an age, a job, five attributes from 1 to 10 and traits. The five attributes are constitution, wit, finesse, will and desire, and there is nothing hidden behind them. Wit covers knowledge and curiosity, finesse covers eloquence and a light hand, will covers stubbornness and its opposite, homesickness, and desire covers greed and, in reverse, kindness. A weak will means homesickness and being hurt by hostility, a weak constitution means catching disease, and a high desire means greed and less kindness. The era models were written against finer quantities, so each of those is a plain function of one attribute, listed in `staff_rules.yaml`, and at 5 each is what the models always had.
- Letting someone go removes them from the staff list, and hiring them again costs the fee again. The last employee and anyone who is away cannot be let go.
- Favor: a bonus raises it, a good trip raises it, failure, giving up and a recall lower it. A high favor makes an employee slower to get homesick and give up.
- Secretary: one employee can stay at the agency as secretary. They stop travelling and their traits give the agency bonuses to funds income, time energy income, rest time and favor growth. In auto mode the secretary has a preference, and the auto results either suit it or do not.
- Only one employee can be in a place at a time, because the simulation holds one traveller per place.

### Traits

There are six traits: kind, stubborn, curious, silver tongued, sensitive and bold. A trait does not change the attributes. It is worth something at the sync points of a place and costs something there. Each sync point is about one kind of thing, persuading, winning trust, noticing, holding on, enduring or caring, and the traits of an employee add up to a bonus for each kind. A point that was missed is still reached with the chance of a positive bonus, and a negative bonus can lose a point that was reached. The draw is seeded. Two traits also carry a weakness of their own: a kind employee is more easily hurt by hostility, and a sensitive one catches disease more easily. A check fails the build if a trait has only gains or only costs, or if it changes an attribute. A trait may also carry a secretary perk, and the stubborn one cuts the rest days after a hard trip.

### Hiring

- Everyone hired is paid a daily wage, idle or not: headcount x 3 x (1 + 0.25 x (headcount - 1)), so each further hire costs more than the one before and the office settles at three or four people. A day that cannot be paid empties the funds and costs every employee a little favor. Antiques sell at the card price times a market factor that moves within +-30% every 30 days, per field.
- Two candidates are on offer, like the recruits of a strategy game. Everything is shown before hiring: name, region, skin tone, gender, age, job, abilities, and every trait with what it gives and what it costs. Hiring one brings another, and every seven game days the whole offer is replaced.
- A candidate is made from one serial number. A region sets the name and the likely skin tones, among fourteen regions across the world, then come gender, age, a job from a list of forty, abilities within a range, and one or two different traits. The names, jobs, regions and skin tones are rows in `cards/config/hiring.yaml` and can be added to freely, so combinations are in the thousands. A small share of the offers are the hand written employees.
- Every made employee goes into the encyclopedia the moment they are made, with both language texts in the save, so a switch of language keeps their names. The latest 200 are kept, and anyone on offer or ever hired stays.

### Recall

A trip can be cut short with the Recall button on a trip in transit. It is a request. If the employee agrees they come home at once, the story stops where it is, and they bring back a share of the pay in proportion to how far the trip had got, a chance of keeping the antique in the same proportion, and a loss of favor. They refuse if their outcome was to stay behind, or by a roll at a base chance that is zero for now. A refusal is final for that trip, and they carry on.

## The simulation of a trip

Each era is one model file in LM format, with variables, equations, a simulation block and an optimization block, plus extensions for agents, utility chosen actions, seeded events, milestones, outcomes, counterfactual scoring, item bindings and a provenance tag on every number. The tags are historical, LM model, game assumption and calibrated.

`js/sim.js` is a generic interpreter that knows nothing about any one era. The same seed and the same inputs give the same result, and a random draw depends only on the seed, the event id and the step, so changing one item does not reshuffle the rest. Expressions are compiled without `eval`, and an undeclared variable fails at load.

A trip runs twice from the same seed, once on the main timeline without the traveller and once on the branch with them. The report sets the two against each other: cases, deaths, who was treated and protected, and the accounts. The search for a good kit runs the model over item sets and returns the Pareto front of lives against cost.

## Reports

A report has the story, the ledger by day, the comparison with the baseline, the accounts and hints. The accounts list the cost of the kit, the funds, the time energy, the rest days and the antique brought back. Numbers can be opened to their formula and variables. A report can be run again with the same setup, compared with the previous one, and shared.

## Antiques, anchors and places

An antique is an anchor. It points at one place and one time, and holding it anchored is what opens that place for dispatch and makes its event readable. Places that are not anchored are not drawn on the map at all. An anchored place nobody has been to yet is drawn as a question mark, with no name, place or tags, and it can still be picked and sent to. Its name appears on the map after the first trip there comes home. An anchored event that has no simulation shows its name and story at once, since there is nobody to send.

### Finding antiques

Antiques are not bought in a shop. Each trip may bring one back. Let the trip go to a place at year `y0` and position `p0`. Every antique that has a place and a year is a candidate if its year is not later than `y0`. For a candidate at year `y` and position `p`:

- Reach: `w = exp(-(y0 - y) / tau_years - d / tau_km)`, where `d` is the great circle distance in kilometres from `p0` to `p`.
- Each candidate is found with chance `k * w`.
- The trip finds something with chance `min(cap, 1 - product(1 - k * w))`.
- The antique it finds is drawn from the candidates in proportion to `w`. An antique that points to a place with a simulation and is not held yet counts `modelled_place_boost` times heavier, 12 for now, so the way to a place that can be dispatched to is not buried under the many events that have no model yet. With the first one not yet held, about one trip in six brings it back.

So what a trip finds is near in space and earlier in time, and the farther it is in either, the less likely. Finding the very place you are at is the most likely single find, and that gives duplicates. The current values are `k` 0.03, `cap` 0.6, `tau_years` 120 and `tau_km` 2500, which put a trip to London 1854 at about 38 percent and a trip to Vienna 1847 at about 32 percent. The roll is seeded by the dispatch, so a replay finds the same thing, and it belongs to the backend. The page shows the chance on the card of each place.

Because candidates must be earlier, antiques lead backwards in time. A place is reached from a later one, and the way to an earlier era runs through the antiques of the later ones.

### Small stories

A catalogue event without a model is played as a small story. The traveller's abilities, weighted by the field of the event, are set against a difficulty that rises with its tier, with a little seeded luck, and the margin gives one of three outcomes, met them, a brief encounter, or missed them. The trip takes four to nine days by tier, needs no kit, pays funds and time energy by outcome, and may bring back an antique by the same rule as any trip. It has a short report, not a branch comparison. The numbers are in `config.light`. Full auto also sends people on small stories to places it has anchored.

### Anchoring and selling

- An antique that opens a place must be anchored in the stock list of the shop page. Anchoring opens the place. An anchored copy cannot be sold.
- The same antique can come back more than once. Copies beyond the first are spares. Spares can be sold one by one, or all at once with one button.
- An anchor cannot be released while someone is away at that place, and the last open place cannot be released.
- A spare sells for the price of the antique. Each copy is therefore either money or a door.

## Money and energy

- Funds pay the hiring fee and buy modern supplies. They come from trips and from selling spare antiques and goods.
- Time energy buys future goods and is also the progress toward going home, so spending it lowers the progress.
- Every item sells at the price it was bought for, in the currency of its shop, at any time and with no loss. Spare antiques sell for their price too.
- Goods sent on a trip come home with the traveller, unless the story uses them up. Supplies and the handbook are spent. The recall charm is spent only when a trip ends in near death, and the heart monitor is lost then unless a charm was carried. Future goods are never lost.
- Future goods are only collected for now, because no era can use them yet. A good whose name and design are borrowed from someone else's work is not sold until that is checked.

## Items

Items are bought into stock and carried on a trip. A kit has a weight limit (`weight_capacity`, 20 for now), and each item has a weight, a maximum count and a step. The shop paid in funds sells supplies, a handbook, a recall charm and a heart monitor. The time shop paid in time energy sells future goods.

Each item card may carry a `loss` field that says how a trip uses it. An item with no `loss` always comes home.

- `used`: spent in the story. The supplies (oral rehydration salts, chlorine tablets, disinfectant, detox water) and the handbook.
- `rescue`: kept unless the outcome is one of `office.fatal_outcomes` (near death), in which case it is spent. The recall charm.
- `fatal`: lost when the outcome is fatal, unless a `rescue` item was carried. The heart monitor.

A recall before the story ends does not count as fatal. The kit that came home and the kit that was lost are kept on the dispatch as `kit.back` and `kit.lost`.

## Main line and going home

The main line is the time energy the agency holds, in five stages at 0, 80, 240, 440 and 600 (`cards/mainline`). The last is going home. The home cost, `office.home_cost`, is 600, about half of the energy that all places can pay together: 140 from the two full simulations and 1032 from the small stories at their top rank, 1172 in all.

## Auto mode

Full auto collects reports, anchors every found antique that opens a place, sells spare antiques when the funds fall below a limit, restocks the supplies it has targets for, and sends every idle employee to a free place, with a kit chosen by simple rules. The place is chosen by the first of four rules that leaves any candidate, and a seeded draw picks among the candidates:

1. A place nobody has come back from yet.
2. A visited place whose best result is below three stars, which this employee has tried fewer than three times.
3. The earliest of the places that lie earlier in history than any this employee has been sent to.
4. Any free place.

It only touches funds, antiques and dispatches. Employees do not die.

## Catalogue events

`cards/events` lists 200 events across the world. The selection leans toward science, technology, philosophy, art and ideas, and more than half are regrets: people and works that history treated unjustly or lost, such as Galois, Hypatia, Sappho or the Indus script. Each event has a place, a year, a field, a story, a figure and a relic. The relic is an antique that is found on trips. Anchoring it opens the event, and until then the event is only a question mark. Every event can be gone to once its antique is anchored. Two of them have a full simulation, and the rest are small stories.

## Data and code

- `cards/` is the source of all content, one yaml card per thing. `data/` is generated from it by `node tools/build_data.mjs` and is never edited by hand.
- The code holds no game numbers. Rules, prices, speeds and probabilities are in `cards/config`, read through a strict getter that fails on a missing key.
- The interface in `js/` shows data and sends requests. Everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. A server backend with the same methods could hold the data and the engine and leave the page to carry data only.
- The page is plain ES modules with no build step to run. Any static file server works.
- A save is one JSON object in the browser's local storage. It can be exported and imported from the settings page. A save from another version is dropped and a fresh one starts.

## Languages, sound and sharing

- English is the fallback and must be complete. Simplified Chinese is the second language. Any missing key reads English. `node tools/check_i18n.mjs` checks the files against English.
- The music is a few piano pieces played by a small Web Audio synthesiser from MIDI files, and the sound effects are tones the page makes itself. There is no sampled audio.
- A trip can be shared from its report. The card opens in a pop-up, not on a page of its own, and closes with a click beside it, the cross or Escape. It tells the story of the trip in a few lines. A simulated place shows its two curves against the mainline, a small story shows its sync points, and there is no table of numbers on it. It has the address and a QR code, as a picture to save or copy.
- The theme follows the system and can be set to light or dark. Quotes from historians and scientists rotate in the header.

## Checks

- `node tools/check_content.mjs` builds thousands of reports and fails on a missing text key or template variable.
- `node tools/check_logic.mjs` audits traits, employees, scenes and items: every point kind has a trait that gives it and one that costs it, every scene can be three starred by someone on the roster, and no requirement is gated by equipment the text does not name.
- `node tools/check_i18n.mjs` and `node tools/check_boundary.mjs` check the languages and the engine boundary.
- `node tools/ui_check.mjs` drives the page with Playwright through dispatching, shopping, antiques, auto mode, the map, the axis, themes, languages and the settings page.
- `node tools/headless.mjs` runs the simulation without a browser and compares kits and staff from the same seeds.

## Stars

Every place has three sync points, and the stars are how many of them a trip hits, so three stars need all three. A full simulation names its points in its model, `star_points`, and each is a milestone of the model that needs the traveller, so history cannot hit one alone. In London 1854 they are convincing Snow, winning the trust of the street, and having the pump handle removed ahead of history. In Vienna 1847 they are convincing Semmelweis, getting the washing started, and making it a rule ahead of history. A point that the model cannot evaluate cannot be a point. A brief scene has three generic points, reaching the place, meeting the figure and leaving a mark, each a margin of the traveller against the event.

Because the points come from what the traveller does, they depend on the employee's habit and the kit. An employee who works on allies convinces and gets the handle removed, one who works on prevention gets the water or the washing done, and no kit means the points that need supplies cannot be hit.

Every place keeps its best star count. Time energy is paid only for the stars above the best the place has had, a quarter of the base of the place for one star, half for two and all of it for three, each trip paying the difference to what the best already paid, so a place cannot be farmed for energy. Funds and antiques are paid every time, so waiting at home brings money, antiques and new employees, but not by itself the way home. The best stars show on the map pins and event rows in bronze, silver and gold, the map can be filtered by them, the log of dispatches shows the stars of each trip with a mark when it beat the best, and a report lists the points with the ones hit highlighted in the timeline.

## Special equipment and scenes

Time energy unlocks things. The time shop sells special equipment for time energy. Each piece unlocks when the time energy reaches its number (price in time energy in brackets): a cyborg neural chip at 20 (25), a cyborg arm at 40 (50), a cyborg bionic lung at 60 (75), a cyborg gorilla arm at 80 (100), a hologram cloak at 100 (125), and out of myth a golden apple at 120 (150), which triples persuasion, and an elixir at 150 (190). A radiation shield (20) and a bamboo copter (40, not sold until its name is checked) have no unlock. Equipment raises abilities and satisfies the points that ask for an item, so the third star of some scenes needs it.

The price is being found out. Each piece shows by its exposure, a scene is more suspicious the later its tier, and the chance of being found grows with both, capped at ninety percent. A cloak lowers it, and with no equipment there is nothing to find. Being found out ends in one of three ways, being turned away, which costs a star, being locked up, which costs all stars and the antique and several days, or being hunted, which costs everything and more days and a lot of favor.

A hundred and twenty one catalogue events are scenes with three authored points, each a requirement on the traveller: an ability, a trait, a job, being a woman, an item, a capability that an item gives such as strength, or luck. A point that names no item must be met by someone on the hand written roster without equipment, so equipment only gates what the text says it gates. They are checked directly and are not differential equation simulations like London 1854 and Vienna 1847.

## Inspirations

The encyclopedia follows the Civilopedia of Civilization IV, sending someone out and reading what happened follows Assassin's Creed Brotherhood and Travel Frog, hiring follows Heroes of Might and Magic, the clock and the music player follow Stellaris, and the stars and levels follow Plants vs. Zombies and the full synchronisation of Assassin's Creed. They are named as thanks and have no connection to this game.

## Licence

The game is MIT licensed. The music files are from the Mutopia Project, public domain and kept unchanged. See the README for the details.

## Regrets and redemption

A catalogue event with `regret: true` is a story history treated unjustly: an early death, a lost work, a stolen credit, a lonely life. It is always a scene with three points, exactly one of them marked `redeem: true`. History cannot be changed, so the traveller never prevents the outcome. The first two stars are company and attention, the redeem star is the thing the traveller can give inside history as it happened. The redeem point is shown as a heart, is never a pure luck roll, and about a third of them need special equipment, which is what the auto mode buys equipment for. A regret carries the tag regret. `node tools/check_logic.mjs` fails a regret without exactly one redeem point.

## Log, reports and the history of a place

The log of dispatches scrolls in its own box and is read from the one line summary of every trip, which is kept for good up to `office.max_trips`, so the log never loses a row. Full reports are kept per place: the best one (most stars, then the newest, `office.keep_best`) and the latest (`office.keep_latest`), so a report that is not among them can no longer be opened, but its line stays. There is nothing to archive or delete by hand. The story of a place, once its relic is anchored, lists every trip that came home from it, newest first, with who went, the stars, whether the redemption was reached and the outcome.

## Pop-ups and the dispatch desk

Picking an event on the map or in its list does not unfold anything on the page. It opens a pop-up with the story, who goes, what they carry and the send button, so a trip is made in one place. Sending closes the pop-up and the trip shows at the top of the log below. A click on the dark ground, the cross or Escape closes any pop-up.

## Auto mode and equipment

For a story the auto mode tries every set of the special equipment it owns, or could buy, with the very seed the trip will have, and takes the set that earns the most stars, the cheaper and lighter first. It buys only what that set needs and the owned sets cannot match, and only a piece whose price is at most `auto.item_buy.energy_share` of the energy in hand, because the time shop is paid in the same time energy that takes the boss home. A visited story where the traveller, with the equipment the office has or could buy, would beat the best stars comes before a plain second try.
