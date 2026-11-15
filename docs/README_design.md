# The Teleporter: design

This document describes how the game works and why it is built the way it is. The numbers quoted here live in `cards/config/` and can be changed there.

## Premise

You run a small agency that sends people into the past. History cannot be changed, so every trip happens on a parallel branch and the main timeline stays as it was. The difference between the branch and the main timeline is paid out as time energy. The employees are ordinary people with traits, not heroes. A recall charm pulls an employee back from a trip that would end in death, so employees do not die. The agency does not take part in wars or regime changes. It does medicine, technology, documents, daily life and witnessing.

The goal is to collect enough time energy to go back to your own time and see your family.

## Game loop

1. Pick a place and a time on the world map.
2. Pick an employee and a kit from the stock, or press Auto configure for a kit. The traveller also brings the ideas or designs that the protagonist of the place can take up, which are not chosen by hand. Only one employee can be in a place at a time.
3. Send them out and let the clock run. Nobody has to watch.
4. When they come home, read the report. It brings time energy and sometimes an antique.
5. Use antiques to open new places, or sell them for the funds that pay the wages and buy supplies, and use time energy to buy future goods or to go home.

## Pages and pop-ups

- The bar holds three pages, Time travel, Buy and Agency. At its right are the funds and the time energy as icons, and three icons that open the pop-ups Wiki, Settings and About.
- Time travel: one sentence of introduction. Then the section Trips on the road, what needs the player first: the trips on the road and the ones waiting to be claimed, in two columns of one line each, those that are home first. The next section is Time travel. Then one slim row of filters over the map: a search box, More filters (years, stars, tags, which open as a panel in the page and never lie over the map), a Counts switch that puts on each pin the number of events it holds under the filters in force, and a question mark with the hints. Then the world map with its time axis, and at the bottom the log of finished trips. Picking a pin opens a pop-up with the events of that place in a grid of columns, and picking an event there opens the dispatch pop-up with the story shown whole, who goes, what they carry, Auto configure, Clear and Send, and a way back to the list. A place with one event goes straight to the dispatch pop-up. Sending closes the pop-up and the trip shows at the top.
- Buy: the modern shop paid in funds, the future shop paid in time energy, and the hiring offer, one under the other. Antiques are found, not bought.
- Agency: the employees, the goods and the antiques, one under the other. Antiques are anchored here and spares sold. Each employee shows the mood and a tally of three, two and one star trips as a/b/c; a click on it opens the record of that person in a pop-up, with the life story, the attributes of the day and every trip, a page at a time.
- Wiki (pop-up): people (one page for the figure of every catalogue event, two for the figures of the simulated eras), events (places are part of them), employees, traits, attributes, and the items in three kinds: ancient items (the antiques, found on trips and sold, anchored to open a place), modern items (bought with funds, mostly used up, today's science and medicine) and future items (bought with time energy, used for special stories, never used up). Linked and filterable, with back and forward inside it. Entries not yet encountered show as a question mark. An employee has a page with the life story once on offer or hired. A link to the wiki from anywhere opens it over what is open, and closing it gives that pop-up back, so a chain of links ends where it began.
- Welcome (pop-up, once, on a new game): the language, a short story of what the agency is, how a trip is made in four lines, the first employees (six candidates from six different regions, three to pick, which can be drawn again until the first trip goes out), the places open at the start (London 1854 as the first, the latest event of the catalogue, and two drawn at random, which can be drawn again until the first trip goes out), and a notice about the people in the game: they are invented, some lean on common impressions of a place or a group and some are written against them, the author cannot know every culture, an AI also looked for anything that might offend and can be wrong, and a report in the Issues of the repository is changed as soon as possible. It does not close on Escape or a click beside it, only on the Begin button, and is remembered in the save. The same notice is in About.
- Settings (pop-up): language, theme, sound and music volume, save export and import, and an advanced section with dev mode, off by default, which shows hidden entries and a seed field. `?dev=1` or `?dev=0` in the address overrides it. A language switch reloads the page and the pop-up stays open.
- About (pop-up): introduction, disclaimer, data and privacy, contribution, author, credits and licence.
- Lists: there are no scroll bars. Every list, including the trips on the road and the log, shows a page of rows, five by default, and the page size and page number sit at its top right (`ui.page_sizes`: five, ten, twenty or fifty, picked for each list). The pager shows only when a list is longer than the shortest page. Each table has a filter of its own in a row above the table, folded behind a small button until asked for: a short box for text and a drop-down of the tags that table holds. The hiring offer has none, there are only five. One item or one person is one line, with the description in a column of its own, cut short with the whole text in the tooltip. The list of what is carried in the dispatch pop-up is the one exception, a small box of fixed height that scrolls.
- Pop-ups: one at a time, in the middle of the screen. A click on the dark ground, the cross or Escape closes it. Going to a report from a pop-up records the pop-up on the page that is left, so Back brings it back. Pop-ups hold short tasks and material that is looked at and put away, including the wiki; a page is for what the player stays on.
- Looks: section titles are larger and bold with a red bar, and buttons are small, so the columns stay narrow. Two levels of navigation at most, and no tabs inside a page.

## Clock and pace

Time runs in game days. At 1x one real minute is one game day. The speeds are pause, 1x, 2x, 4x, 8x and 16x, and the space key pauses. The days an employee spends in the past pass at the same rate as the days in the agency, so a seven day stay takes seven minutes at 1x. The clock stands still until the first trip goes out, then runs at 1x, and a ring beside the day fills once a day so the passing of time shows at any speed. On the map a soft shade marks where the sun is below the horizon: the sun stands over a longitude that moves west once per game day and over a latitude that swings through the year (`map.daynight`), and above 4x the shade stops following the clock so that it never turns so fast that it tires the eye. A setting takes it off. Only a pop-up the game forces open stops the clock, the welcome and the day a wage goes unpaid (`clock.hold_modals`); a report, the wiki, the settings and the other pop-ups the player opens leave it running. The speed depends on the funds: when they pay fewer than three days of wages (`config.clock.low_funds_days`) the clock is held to 4x, and the day a wage goes unpaid it stops and a pop-up asks for a decision, there is no game over. A return shows a note that fades after a few seconds and the reports wait on the home page; the setting "pause when someone comes home" is off by default. Full auto is a checkbox.

## Employees

- Three employees are hired at the start. Each has a gender, an age, a region, a job, five attributes from 1 to 10 and traits, and a short life story of their own. The five attributes are wit, constitution, finesse, will and luck, and there is nothing hidden behind them. Everyone starts at 4 in each and what they have lived adds a little with age, the average of the five at most 6 (4 at eighteen, 5 at forty-eight, 6 at seventy-eight), so the five add up to between 20 and 30. The totals are close but the shapes are not: every attribute has its top people with a 10, and every genius has a plain flaw, a 1 or a 2 somewhere, while the plainest few have middling numbers and two traits to make up for it, so no attribute, wit least of all, is the only reason to hire someone. A person's profile is the gender (female, male, trans woman, trans man or another gender, a few of them in the roster), the age, the ethnicity, one short label naming a people or a descent (Igbo, Han, African descent), never a place or a country plus a descent, since where the person lives is in the story, and one to three jobs. A point that asks for a woman sees a trans woman as one. Ages run from eighteen to eighty. Wit covers knowledge and curiosity, finesse covers eloquence and a light hand, will covers stubbornness and its opposite, homesickness, constitution covers stamina and catching disease, and luck is read where a point or an antique is left to chance: a factor of 0.6 plus 0.1 per point on those chances, one at luck 4. A trait is worth something at the sync points of a place and costs something there. Three three star trips of an employee give one point to a random attribute of theirs, up to 10. What an employee has brought in is kept as a tally of three, two and one star trips, shown as a/b/c, and never as a list that grows. The five attributes are drawn as a star, a radar chart, in the record of the employee and in the wiki.
- Letting someone go removes them from the staff list, and hiring them again costs the fee again. The last employee and anyone who is away cannot be let go.
- Mood (called favor in the code): it is tied to how the trips go, from 0 to 100, starting at 50. Every success raises it a little, every failure lowers it, and so do giving up and a recall. Every attribute follows it: up to 20% more at full mood and 20% less at none (`favor.buff`), so a trip is run on the attributes of that day. A reward costs a day of that person's wage and adds 10. A high mood also makes an employee slower to get homesick and give up.
- Secretary: one employee can stay at the agency as secretary. They stop travelling and their traits give the agency bonuses to antique sale prices, time energy income, rest time and mood growth. In auto mode the secretary has a preference, and the auto results either suit it or do not.
- Only one employee can be in a place at a time, because the simulation holds one traveller per place.

### Traits

There are 23 traits, `cards/traits`, each worth something at the sync points of a place and costing something there, and none changes the attributes. Each sync point is about one kind of thing, persuading, winning trust, noticing, holding on, enduring or caring, and the traits of an employee add up to a bonus for each kind. A point that was missed is still reached with the chance of a positive bonus, and a negative bonus can lose a point that was reached. The draw is seeded. A trait may also carry a strength or a weakness of the body or the mind that the era models read: being hurt by hostility, catching disease, homesickness. A trait may carry a secretary perk and a preference, and a habit for the era models. An employee holds one or two traits, and every trait is held by at least one of the fifty. The sync points of a scene name the traits that help at that kind of point, drawn from a pool for each kind so that each trait is asked about equally often. A check fails the build if a trait has only gains or only costs, or if it changes an attribute, and warns when a trait is asked far more often than the others.

### Hiring

- Everyone hired is paid a daily wage, idle or not: headcount x 2.4 x (1 + 0.5 x (headcount - 1)), so each further hire costs more than the one before. There is no fixed limit on the staff: the wage bill is the limit, and in the simulations of the automatic mode the office settles at about six or seven people by day 250 and keeps growing slowly after, as the spare antiques pile up and sell. Every employee costs the same, because a different wage for each would bend the choice of who to hire. The bar at the top shows the funds followed by the wages a day, as funds minus wages per day. A reward costs one day of the wage of that employee and adds ten to the mood. A day that cannot be paid empties the funds and costs every employee a little mood. Antiques sell at the card price times a market factor that moves within +-30% every 30 days, per field.
- Five candidates are on offer, like the recruits of a strategy game. Everything is shown before hiring: name, region, skin tone, gender, age, job, abilities, the wage it adds a day, and every trait with what it gives and what it costs. Hiring one brings another, and every seven game days the whole offer is replaced.
- There are fifty employees in all, each a card of `cards/staff`, spread over the world roughly as people are: more from China and India, and from every region, of every skin tone, gender and age from eighteen to seventy-six. The first three are picked by the player from six candidates of the cards marked `start_pool`, never two from the same region. The candidates on offer later are drawn with a seed from the ones not hired. The regions and skin tones are rows in `cards/config/hiring.yaml`.
- Every employee has a page in the encyclopedia with the life story, unlocked once they are on offer or hired.

### Recall

A trip can be cut short with the Recall button on a trip in transit. It is a request. If the employee agrees they come home at once, the story stops where it is, and they bring back a share of the pay in proportion to how far the trip had got, a chance of keeping the antique in the same proportion, and a loss of mood. They refuse if their outcome was to stay behind, or by a roll at a base chance that is zero for now. A refusal is final for that trip, and they carry on.

## The simulation of a trip

Each era is one model file in LM format, with variables, equations, a simulation block and an optimization block, plus extensions for agents, utility chosen actions, seeded events, milestones, outcomes, counterfactual scoring, item bindings and a provenance tag on every number. The tags are historical, LM model, game assumption and calibrated.

`js/sim.js` is a generic interpreter that knows nothing about any one era. The same seed and the same inputs give the same result, and a random draw depends only on the seed, the event id and the step, so changing one item does not reshuffle the rest. Expressions are compiled without `eval`, and an undeclared variable fails at load.

A trip runs twice from the same seed, once on the main timeline without the traveller and once on the branch with them. The report sets the two against each other: cases, deaths, who was treated and protected, and the accounts. The search for a good kit runs the model over item sets and returns the Pareto front of lives against cost.

## Reports

A report is told as a story. Under the title and the stamp comes one line the employee says, and then the record, one short line to a thing in time order. It opens in the year of the office with the date and the year and place the employee was carried to, turns to the year of the place, follows what was recorded and what the employee did, how they got in, the scene of the trip and the stars, goes on past their leaving to what was recorded later, marking each new year, and comes back to the year of the office with the date of return, how it ended, and the rest and the mood the trip leaves. A thin rule tells history from the lines of the employee, and buttons show all, only history or only the employee. Notes are numbered and listed at the end: the sources of the facts behind lines of history, and a word where a number was worked out by the model. In the developer mode each line also says, in small type under it, where it came from: the recorded date and fact, or the condition that wrote it with the values it read, the chance of an event, the planned day and range of the drift, the score and the bar of getting in, or the traits that chose the scene. The normal mode never shows this.

After the record comes the summary: the cost of the kit, the stars with the sync points under them, growth, the antique brought back and the rest days, then hints. Numbers, the chart and the ledger appear, folded, only for a model that counts something worth it, such as lives in an outbreak. The body of the employee through the stay as LM reads it is a part of its own, shown in the developer mode only for now (`ui.report_body`). A trip brings no funds. A report can be run again with the same setup, compared with the previous one, and shared.

### Stamps

The stamp at the top of a report is read from three things. How the employee came back: normally, early (gave up or was recalled) or the hard way (near death or sent back). How many stars: all, some or none. And where none was won, whether the branch still came out different from the main timeline. Every stamp is a kind word and the least of them is to try again: Home in full, Well worth it, Left a mark, Next time; Done and home early, Something gained, It made a difference, Plenty of time yet; Home a hero, A close call still a gain, Safe and sound. The stamp only says how it went. The ending of the model still sets the time energy and the rest. The table is `stamp` in the config.

## Time and the crossing

One office day is thirty historical days, and a stay is one to seven office days, so a trip can span recorded events that lie weeks or months apart. The office keeps a calendar from the real date the game began. What wears on the traveller at the pace of the office, such as homesickness, runs on office days, and the world runs on historical days. The crossing is not exact: a trip arrives before or after the planned day by up to a tenth of its stay, at least one day and at most ten, drawn from its seed, never before day 0 of the model. A short story is not missed and a long one is not thrown off by weeks. A model may set its own range.

## Antiques, anchors and places

An antique is an anchor. It points at one place and one time, and holding it anchored is what opens that place for dispatch and makes its event readable. Places that are not anchored are not drawn on the map at all. An anchored place nobody has been to yet is drawn as a question mark, with no name, place or tags, and it can still be picked and sent to. Its name appears on the map after the first trip there comes home. An anchored event that has no simulation shows its name and story at once, since there is nobody to send.

### Finding antiques

Antiques are not bought in a shop. Each trip may bring one back. A new game starts with Guangzhou 1924 open through the statue of Sun Yat-sen, a medium of today that is not an antique and is never found or sold, and with three more places: the latest event of the catalogue, which reaches the farthest back, and two at random (`office.start_scenes`). Let the trip go to a place at year `y0` and position `p0`. Every antique that has a place and a year is a candidate if its year is earlier than `y0`, never the same year. For a candidate at year `y` and position `p`:

- Reach: `w = exp(-(y0 - y) / tau_years - d / tau_km)`, where `d` is the great circle distance in kilometres from `p0` to `p`.
- Each candidate is found with chance `k * w`. The chance of the whole trip is then scaled by its stars: a quarter of it with none, half with one, three quarters with two, all of it with three (`star_share`), so a good trip also pays better in antiques.
- The trip finds something with chance `min(cap, 1 - product(1 - k * w))`.
- The antique it finds is drawn from the candidates in proportion to `w`. An antique that points to a place with a simulation and is not held yet counts `modelled_place_boost` times heavier, 12 for now, so the way to a place that can be dispatched to is not buried under the many events that have no model yet. With the first one not yet held, about one trip in six brings it back.

So what a trip finds is near in space and earlier in time, and the farther it is in either, the less likely. The nearest earlier places are the likeliest finds, and they give duplicates. The current values are `k` 0.16, `cap` 0.8, `tau_years` 120 and `tau_km` 2500. The chance on the card of a place is this reach chance times the star share, so a place far in time or space, or a trip with no stars, shows a low number: the median place is at 0.41 before the stars, and an average trip finds something about one time in three and brings antiques worth about 63 funds, though only the spare copies can be sold, the rest are doors. A small story pays 40, 70 and 110 funds by tier at full marks (`light.pay`), scaled by the stars. Left alone, the automatic mode stalls about the fortieth day, when the wages outrun the trips and nothing is spare yet, and then climbs as the duplicates come in and are sold by themselves. The roll is seeded by the dispatch, so a replay finds the same thing, and it belongs to the backend. The page shows the chance on the card of each place.

Because candidates must be earlier, antiques lead backwards in time. A place is reached from a later one, and the way to an earlier era runs through the antiques of the later ones.

### Small stories

A catalogue event without a model is played as a small story. The traveller's abilities, weighted by the field of the event, are set against a difficulty that rises with its tier, with a little seeded luck, and the margin gives one of three outcomes, met them, a brief encounter, or missed them. The trip takes four to nine days by tier, needs no kit, pays time energy by outcome, and may bring back an antique by the same rule as any trip. It has a short report, not a branch comparison. The numbers are in `config.light`. Full auto also sends people on small stories to places it has anchored.

### Anchoring and selling

- An antique that opens a place must be anchored in the antiques list of the Agency page. Anchoring opens the place. An anchored copy cannot be sold. The automatic mode anchors a new piece once; a piece the player has released stays released, so it can be sold.
- The same antique can come back more than once. Copies beyond the first are spares. Spares can be sold one by one, or all at once with one button.
- An anchor cannot be released while someone is away at that place, and the last open place cannot be released.
- A spare sells for the price of the antique. Each copy is therefore either money or a door.

## How the economy was tuned

A trip brings no funds. The only income is selling antiques, which are also the doors to the places, so every sale is a choice. The aim is that the early game cannot be left to run by itself: the wages outrun what the spare antiques bring in, and the office stalls about the fortieth day, because the automatic mode anchors every antique it finds and nothing is spare yet. The player then has to stop and choose, sell a spare, let a door go and sell it, or let someone go. Later the duplicates come in and the automatic mode sells them by itself, so the funds grow. More staff move things faster and cost more, and stall earlier. There is no fixed limit on the staff, the wage bill is the limit.

The numbers behind it are `office.sale_scale` (3), `office.wage` (base 2.4, step 0.5), `office.antique_find.k` (0.16), the start funds (800), the hire cost (100) and `auto.sell_spares_below` (100). `tools/in_probe_antique_find.mjs` prints the chance of a find place by place, and `tools/in_probe_economy.mjs` plays new games in the page and prints the funds, the staff and the antiques over the days, hands off or with a simple player who sells a spare, then the cheapest door, when the funds run short and hires when they are rich. With the numbers above, hands off, 5 games in 6 stall about day 36; with the simple player the office is at four or five people by day 150, five or six by day 200 and seven by day 250, and keeps growing slowly. The first tries without the sale scale went bankrupt by day 14, and with a wage step of 0.25 the office reached ten people by day 250, which was too loose.

## Money and energy

- Funds pay the hiring fee, the daily wages and the modern supplies. They come only from selling antiques and goods: a trip brings no funds, so the antiques are both the doors to the places and the only income.
- Time energy buys future goods and is also the progress toward going home, so spending it lowers the progress.
- Every item sells at the price it was bought for, in the currency of its shop, at any time and with no loss. An antique sells for its price on the card times `office.sale_scale` (3 for now) times the market of its field, which moves by up to 30% every 30 days, and the secretary may add a few percent.
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

The main line is the time energy the agency holds, in five stages at 0, 80, 240, 440 and 600 (`cards/mainline`). The last is going home. The home cost, `office.home_cost`, is 600, under a third of the most that all places can pay together: 140 from the two full simulations and 1700 from the 179 catalogue events at three stars, 1840 in all.

## Auto mode

Full auto collects reports, anchors every found antique that opens a place, sells spare antiques when the funds fall below a limit, restocks the supplies it has targets for, and sends every idle employee to a free place, with a kit chosen by simple rules. The place is chosen by the first of five rules that leaves any candidate, and a seeded draw picks among the candidates:

1. A place nobody has come back from yet.
2. A visited story where this employee, with the equipment the office has or could buy, would beat the best stars.
3. A visited place whose best result is below three stars, which this employee has tried fewer than three times (counted from the lines of the log, which are kept for good).
4. The earliest of the places that lie earlier in history than any this employee has been sent to.
5. Any free place.

For a story the auto mode tries every set of the special equipment it owns, or could buy, with the very seed the trip will have, and takes the set that earns the most stars, the cheaper and lighter first. It buys only what that set needs and the owned sets cannot match, and only a piece whose price is at most `auto.item_buy.energy_share` of the energy in hand, because the time shop is paid in the same time energy that takes the boss home.

It only touches funds, antiques and dispatches. Employees do not die.

## Catalogue events

`cards/events` lists 179 events across the world. The selection leans toward science, technology, philosophy, art and ideas, and more than half are regrets: people and works that history treated unjustly or lost, such as Galois, Hypatia, Sappho or the Indus script. Each event has a place, a year, a field, a story, a figure and a relic. The relic is an antique that is found on trips. Anchoring it opens the event, and until then the event is only a question mark. Every event can be gone to once its antique is anchored. Two of them have a full simulation, and the rest are small stories.

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

Time energy unlocks things. The time shop sells special equipment for time energy. Each piece unlocks when the time energy reaches its number (price in time energy in brackets): a cyborg neural chip at 20 (25), a cyborg arm at 40 (50), a cyborg bionic lung at 60 (75), a cyborg gorilla arm at 80 (100), a hologram cloak at 100 (125), and out of myth a golden apple at 120 (150), which triples persuasion, and an elixir at 150 (190). A radiation shield (20) unlocks at 10 and is asked for by the Curie scene. The two arms are asked for through the strength they provide. Equipment satisfies the points that ask for an item, so the third star of some scenes needs it. The four cyborg pieces are implants: they are worn by one employee, not carried in the kit, up to a load cap of 2 (`office.implant_load_cap`), and add to the attributes while worn: the neural chip wit +2 (load 1), the arm constitution +2 (load 1), the lung constitution +1 and will +1 (load 1), and the gorilla arm constitution +3 (load 2). They are worn and taken off on the status page of the employee, which opens from any name and has the encyclopedia one step further; it shows the attributes as base, implants and today, the mood, the stars tally and the progress to the next point, the implants with the load, the life story and the records. Letting someone go takes their implants off first and puts them back in the stock, so nothing bought with time energy is lost. The other special equipment is still carried on a trip.

The price is being found out. Each piece shows by its exposure, a scene is more suspicious the later its tier, and the chance of being found grows with both, capped at ninety percent. A cloak lowers it, and with no equipment there is nothing to find. Being found out ends in one of three ways, being turned away, which costs a star, being locked up, which costs all stars and the antique and several days, or being hunted, which costs everything and more days and a lot of favor.

A hundred and twenty one catalogue events are scenes with three authored points, each a requirement on the traveller: an ability, a trait, a job, being a woman, an item, a capability that an item gives such as strength, or luck. A point that names no item must be met by someone on the hand written roster without equipment, so equipment only gates what the text says it gates. They are checked directly and are not differential equation simulations like London 1854 and Vienna 1847.

## Inspirations

The encyclopedia follows the Civilopedia of Civilization IV, sending someone out and reading what happened follows Assassin's Creed Brotherhood and Travel Frog, hiring follows Heroes of Might and Magic, the clock and the music player follow Stellaris, and the stars and levels follow Plants vs. Zombies and the full synchronisation of Assassin's Creed. They are named as thanks and have no connection to this game.

## Licence

The game is MIT licensed. The music files are from the Mutopia Project, public domain and kept unchanged. See the README for the details.

## Regrets and redemption

A catalogue event with `regret: true` is a story history treated unjustly: an early death, a lost work, a stolen credit, a lonely life. It is always a scene with three points, exactly one of them marked `redeem: true`. History cannot be changed, so the traveller never prevents the outcome. The first two stars are company and attention, the redeem star is the thing the traveller can give inside history as it happened. The redeem point is shown as a heart, is never a pure luck roll, and about a third of them need special equipment, which is what the auto mode buys equipment for. A regret carries the tag regret. `node tools/check_logic.mjs` fails a regret without exactly one redeem point.

## Log, reports and the history of a place

The log of dispatches is read from the one line summary of every trip, which is kept for good up to `office.max_trips`, so the log never loses a row. Full reports are kept per place: the best one (most stars, then the newest, `office.keep_best`) and the latest (`office.keep_latest`), so a report that is not among them can no longer be opened, but its line stays. The story of a place, once its relic is anchored, lists every trip that came home from it, newest first, with who went, the stars, whether the redemption was reached and the outcome.

A trip can be archived, by itself or by a rule that archives all but the best trip of each place. Archiving hides it from the log and keeps its report, up to 200 of them, the oldest going first; the line and the stars always stay, and Restore brings the line back. A switch shows the archived ones dimmed. There is no delete, because the lines are small and bounded and the tally of stars must not lose what it counted.

