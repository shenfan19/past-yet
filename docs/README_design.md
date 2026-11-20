# The Past Is Yet to Come: design

This document describes how the game works and why it is built the way it is. The numbers quoted here live in `cards/config/` and can be changed there.

## Premise

You run a small agency that sends people into the past. History is drifting: every trip prises a branch off it, and as the branches multiply the main timeline works loose, so that some moments will go another way unless someone holds them, and the road home of the founder runs along the main timeline. The agency therefore does two things. It guards, holding a loosened moment so that what should happen happens; and it mends, setting right in a branch something history left undone. Both are paid out as time energy. The main timeline stays as it was, and the change shows in the branch. The employees are ordinary people with traits, not heroes. A recall charm pulls an employee back from a trip that would end in death, so employees do not die. The agency does not take part in wars or regime changes. It does medicine, technology, documents, daily life and witnessing.

The goal is to collect enough time energy to go back to your own time and see your family.

The game grew out of Life Matters, LM, and was meant from the start to let the traveller live through the hardship of the past. Disease, heat, cold, hunger, sleepless nights, grief and hostility press on the employee every day of a stay, the LM core reads what they do to the body, and someone who can no longer go on is sent home. The pressure of a place is written as the history has it and is not lowered to make a trip easy. Where it presses hard, getting through is the difficulty.

## Pressure and the body

An event card names at most three pressure channels, each at level 1 to 3, in `channels`. Defence against them comes in three layers:

- Attributes: the general defence. Each channel is felt at 1 - 0.08 × (attribute - 5) of its pull on the body, kept between 0.4 and 1.3. Bodily channels are met with the constitution, grief and hostility with the will. The numbers are in `config.body.resist`. The threshold at which a body cannot go on also rises with the constitution, `config.body.resilience`.
- Traits: a trait such as Wanderer takes whole levels off the channels it names, `resist` on the trait card.
- Items and gear: every item that names a channel takes a level off it, at most two levels from items together, and a piece of gear worn takes one more, `config.channels.relief`. A level 3 channel can be cleared only with items, gear and traits together.

The story card names the pressure of the place and how hard it presses, the dispatch desk shows what is left of it for the employee and the kit chosen, and a report of someone sent home names what wore them down. All three add one line on how to ease it.

## Game loop

1. Pick a place and a time on the world map.
2. Pick an employee and a kit from the stock, or press Auto configure for a kit. The traveller also brings the ideas or designs that the protagonist of the place can take up, which are not chosen by hand. Only one employee can be in a place at a time.
3. Send them out and let the clock run. Nobody has to watch.
4. When they come home, read the report. It brings time energy and sometimes an antique.
5. Use antiques to open new places, or sell them for the funds that pay the wages and buy supplies, and use time energy to buy future goods or to go home.

## Pages and pop-ups

Trip returns and automatic settlement continue while a player uses an input or opens a native dropdown. Background redraws of the affected page, pop-up or clock controls wait until the player finishes the interaction. Other regions can update during that time.

- The bar holds three pages, Time travel, Buy and Agency. At its right are the funds and the time energy as icons, and three icons that open the pop-ups Wiki, Settings and About.
- Time travel: one sentence of introduction. Then the section Trips on the road, what needs the player first: the trips on the road and the ones waiting to be claimed, in two columns of one line each, those that are home first. The next section is Time travel. Then one slim row of filters over the map: a search box, More filters (years, stars, tags, which open as a panel in the page and never lie over the map), a Counts switch that puts on each pin the number of events it holds under the filters in force, and a question mark with the hints. Then the world map with its time axis, and at the bottom the log of finished trips. Picking a pin opens a pop-up with the events of that place in a grid of columns, and picking an event there opens the dispatch pop-up with the story shown whole, who goes, what they carry, Auto configure, Clear and Send, and a way back to the list. A place with one event goes straight to the dispatch pop-up. Sending closes the pop-up and the trip shows at the top.
- Buy: the modern shop paid in funds, the future shop paid in time energy, and the hiring offer, one under the other. Antiques are found, not bought.
- Agency: the employees, the goods and the antiques, one under the other. Antiques are anchored here and spares sold. Each employee shows the mood and the sum of their best star results across stories; a click on it opens the record of that person in a pop-up, with the life story, the attributes of the day and every trip, a page at a time.
- Wiki (pop-up): people (one page for the figure of every catalogue event, two for the figures of the simulated eras), events (places are part of them), employees, traits, attributes, and the items in three kinds: ancient items (the antiques, found on trips and sold, anchored to open a place), modern items (bought with funds, mostly used up, today's science and medicine) and future items (bought with time energy, used for special stories, never used up). Linked and filterable, with back and forward inside it. Entries not yet encountered show as a question mark. An employee has a page with the life story once on offer or hired. A link to the wiki from anywhere opens it over what is open, and closing it gives that pop-up back, so a chain of links ends where it began.
- Welcome (pop-up, once, on a new game): the language, a short story of what the agency is, how a trip is made in four lines, the first employees (six candidates from six different regions, three to pick, which can be drawn again until the first trip goes out), the places open at the start (London 1854 as the first, the latest event of the catalogue, and two drawn at random, which can be drawn again until the first trip goes out), and a notice about the people in the game: they are invented, some lean on common impressions of a place or a group and some are written against them, the author cannot know every culture, an AI also looked for anything that might offend and can be wrong, and a report in the Issues of the repository is changed as soon as possible. It does not close on Escape or a click beside it, only on the Begin button, and is remembered in the save. The same notice is in About.
- Settings (pop-up): language, theme, sound and music volume, save export and import, and an advanced section with dev mode, off by default, which shows hidden entries and a seed field. `?dev=1` or `?dev=0` in the address overrides it. A language switch reloads the page and the pop-up stays open.
- About (pop-up): introduction, disclaimer, data and privacy, contribution, author, credits and licence.

The welcome introduces recruitment, guarding key moments, and mending regrets in parallel timelines to earn enough time energy to go home. The opening honours Dr Sun Yat-sen, and the welcome and About share the same AI credit and correction notice.
- Lists: there are no scroll bars. Every list, including the trips on the road and the log, shows a page of rows, five by default, and the page size and page number sit at its top right (`ui.page_sizes`: five, ten, twenty or fifty, picked for each list). The pager shows only when a list is longer than the shortest page. Each table has a filter of its own in a row above the table, folded behind a small button until asked for: a short box for text and a drop-down of the tags that table holds. The hiring offer has none, there are only five. One item or one person is one line, with the description in a column of its own, cut short with the whole text in the tooltip. The list of what is carried in the dispatch pop-up is the one exception, a small box of fixed height that scrolls.
- Pop-ups: one at a time, in the middle of the screen. A click on the dark ground, the cross or Escape closes it. Going to a report from a pop-up records the pop-up on the page that is left, so Back brings it back. Pop-ups hold short tasks and material that is looked at and put away, including the wiki; a page is for what the player stays on.
- Looks: section titles are larger and bold with a red bar, and buttons are small, so the columns stay narrow. Two levels of navigation at most, and no tabs inside a page.

## Clock and pace

Time runs in game days. At 1x one real minute is one game day. The speeds are pause, 1x, 2x, 4x, 8x and 16x, and the space key pauses. The days an employee spends in the past pass at the same rate as the days in the agency, so a seven day stay takes seven minutes at 1x. The clock stands still until the first trip goes out, then runs at 1x, and a ring beside the day fills once a day so the passing of time shows at any speed. On the map a soft shade marks where the sun is below the horizon: the sun stands over a longitude that moves west once per game day and over a latitude that swings through the year (`map.daynight`), and above 4x the shade stops following the clock so that it never turns so fast that it tires the eye. A setting takes it off. Only a pop-up the game forces open stops the clock, the welcome and the day a wage goes unpaid (`clock.hold_modals`); a report, the wiki, the settings and the other pop-ups the player opens leave it running. The speed depends on the funds: when they pay fewer than three days of wages (`config.clock.low_funds_days`) the clock is held to 4x, and the day a wage goes unpaid it stops and a pop-up asks for a decision, there is no game over. A return shows a note that fades after a few seconds and the reports wait on the home page; the setting "pause when someone comes home" is off by default. Full auto is a checkbox.

## Employees

- Three employees are hired at the start. Each has a gender, an age, a region, a job, five attributes from 1 to 10 and traits, and a short life story of their own. The five attributes are wit, constitution, finesse, will and luck, and there is nothing hidden behind them. Everyone starts at 4 in each and what they have lived adds a little with age, the average of the five at most 6 (4 at eighteen, 5 at forty-eight, 6 at seventy-eight), so the five add up to between 20 and 30. The totals are close but the shapes are not: every attribute has its top people with a 10, and every genius has a plain flaw, a 1 or a 2 somewhere, while the plainest few have middling numbers and two traits to make up for it, so no attribute, wit least of all, is the only reason to hire someone. A person's profile is the gender (female, male, trans woman, trans man or another gender, a few of them in the roster), the age, the ethnicity, one short label naming a people or a descent (Igbo, Han, African descent), never a place or a country plus a descent, since where the person lives is in the story, and one to three jobs. A point that asks for a woman sees a trans woman as one. Ages run from eighteen to eighty. Wit covers knowledge and curiosity, finesse covers eloquence and a light hand, will covers stubbornness and its opposite, homesickness, constitution covers stamina and catching disease, and luck is read where a point or an antique is left to chance: a factor of 0.6 plus 0.1 per point on those chances, one at luck 4. Traits can give an employee a second chance at a missed sync point. Every 30 personal-best stars give one point to an attribute that is still below 10. The employee card lets the player choose a training focus. If that attribute is capped or the focus is set to Automatic, the point goes to a seeded choice among the remaining attributes. Only the best result per story counts, so a repeat never adds stars unless it improves that result. Existing attribute gains are kept; the new threshold applies when a future result crosses a multiple of 30. The five attributes are drawn as a star, a radar chart, in the record of the employee and in the wiki.
- Letting someone go removes them from the staff list, and hiring them again costs the fee again. The last employee and anyone who is away cannot be let go. Their card still opens from the trip records, with the record and the trips kept, and only the implants give way to a line saying they have left.
- Every employee has catchphrases of their own on the card, `sayings` in each language, drawn from their work, their flaws and where they come from: one group for every star won, one for some stars or a branch that still came out different, one for nothing done, one for coming home hurt. The stamp of a trip names the group (`stamp.saying`), and the id of the trip picks the line, so a trip always says the same.
- The record of an employee lists what their trips helped bring about: one line to a trip, small stories and full models alike, with the mend stars it won for the first time and, after them, the words said on coming back. Guard stars that held are not listed, since holding history is not a deed; the report shows them. The weightiest come first, a redeemed regret, then the share of the stars of the trip, then the later year, and `ui.record_top` of them show until the rest are opened. The record stays on the employee card and is not repeated in the wiki, where the IF lines of the historical people are told.
- The Trips table on the employee card shows one row per finished dispatch, including repeat visits to the same story. Like the story page, it can be sorted by most recent or highest stars. Equal star counts put the most recent return first. Changing the order returns to the first page and keeps the chosen page size. A report can be opened while its full record is still kept.
- Mood (called favor in the code): it is tied to how the trips go, from 0 to 100, starting at 50. Every success raises it a little, every failure lowers it, and so do giving up and a recall. Every attribute follows it: up to 20% more at full mood and 20% less at none (`favor.buff`), so a trip is run on the attributes of that day. A reward costs a day of that person's wage and adds 10. A high mood also makes an employee slower to get homesick and give up.
- Secretary: one employee can stay at the agency as secretary. They stop travelling, and each of their traits lends one thing, written as `secretary` on the trait card: a higher sale price for antiques, faster mood growth, shorter rest, one attribute for every traveller (the secretary's own over `office.secretary.attr_divisor`, rounded, never to the secretary or the test employees), or a sure star, the earliest missed guard star held or, when no mend star was won, the earliest one won if the guard holds until its day. In a small story, the employee and kit must first qualify for that point. A star made sure says so in the record. The secretary adds no time energy, which the stars fix, has no preference, and works the same with the auto mode on or off. The effect stays in the navigation bar on every page.
- Only one employee can be in a place at a time, because the simulation holds one traveller per place.

### Traits

There are 23 traits, `cards/traits`, each with sync point bonuses. The bonuses leave the five attributes as they are. Each sync point is about one kind of thing, persuading, winning trust, noticing, holding on, enduring or caring, and the traits of an employee add up to a bonus for each kind. The total bonus is the chance to recover a missed point, capped at 90%. The draw is seeded. For small stories, a positive bonus or secretary guarantee can bridge a missed attribute or luck check only after the traveller and kit satisfy the applicable profession, trait, gender, item and capability requirements on at least one authored route to the point. A trait may also carry a strength or a weakness of the body or the mind that the era models read: being hurt by hostility, catching disease, homesickness. A trait can give a secretary perk or affect how a traveller responds when blocked in an era model. Dispatches use the balanced priority. An employee holds one or two traits, and every trait is held by at least one of the fifty. The sync points of a scene name the traits that help at that kind of point, drawn from a pool for each kind so that each trait is asked about equally often. A check fails the build if a trait has an invalid sync point bonus or changes an attribute, and warns when a trait is asked far more often than the others.

### Hiring

- Everyone hired is paid a daily wage, idle or not: headcount x 2.4 x (1 + 0.5 x (headcount - 1)), so each further hire costs more than the one before. Staffing is limited by the wage bill. A larger roster makes more trips possible and needs more sales to cover its higher marginal wages. Every employee costs the same, because a different wage for each would bend the choice of who to hire. The bar at the top shows the funds followed by the wages a day, as funds minus wages per day. A reward costs one day of the wage of that employee and adds ten to the mood. A day that cannot be paid empties the funds and costs every employee a little mood.
- The hiring page shows up to five candidates, including their abilities, traits and added daily wage. Hiring one opens a slot for another. The countdown follows the game clock and pauses with it. Every seven game days the page refreshes the offer in place, drawing fresh candidates first and reusing candidates from the previous offer only if there are too few others.
- There are fifty employees in all, each a card of `cards/staff`, spread over the world roughly as people are: more from China and India, and from every region, of every skin tone, gender and age from eighteen to seventy-six. The first three are picked by the player from six candidates of the cards marked `start_pool`, never two from the same region. The candidates on offer later are drawn with a seed from the ones not hired. The regions and skin tones are rows in `cards/config/hiring.yaml`.
- Every employee has a page in the encyclopedia with the life story, unlocked once they are on offer or hired.

### Recall

A trip can be cut short with the Recall button on a trip in transit. It is a request. If the employee agrees they come home at once, the story stops where it is, and they bring back a share of the pay in proportion to how far the trip had got, a chance of keeping the antique in the same proportion, and a loss of mood. They refuse if their outcome was to stay behind, or by a roll at a base chance that is zero for now. A refusal is final for that trip, and they carry on.

## The simulation of a trip

Each era is one model file in LM format, with variables, equations, a simulation block and an optimization block, plus extensions for agents, utility chosen actions, seeded events, milestones, outcomes, counterfactual scoring, item bindings and a provenance tag on every number. The tags are historical, LM model, game assumption and calibrated.

`js/sim.js` is a generic interpreter that knows nothing about any one era. The same seed and the same inputs give the same result, and a random draw depends only on the seed, the event id and the step, so changing one item does not reshuffle the rest. Expressions are compiled without `eval`, and an undeclared variable fails at load.

A trip runs twice from the same seed, once on the main timeline without the traveller and once on the branch with them. The report sets the two against each other: cases, deaths, who was treated and protected, and the accounts. The search for a good kit runs the model over item sets and returns the Pareto front of lives against cost.

## Reports

A report is told as a story. Under the title and the stamp comes one line the employee says, a catchphrase of theirs for how the trip went, or for a full model whose card gives words for its ending, those words, and then the record, one short line to a thing in time order. It opens in the year of the office with the date and the year and place the employee was carried to, turns to the year of the place, follows what was recorded and what the employee did, how they got in, the scene of the trip and the stars, goes on past their leaving to what was recorded later, marking each new year, and comes back to the year of the office with the date of return, how it ended, and the rest and the mood the trip leaves. The date stands on a time axis down the middle of the record, taken from the head of the sentence; in a story with a planned arrival on the calendar the lines of the employee are dated too, and otherwise they count the days from arriving. History stands on the left of the axis and the employee on the right, in a thin frame on a narrow screen where both sides stand right of the axis, and buttons show all, only history or only the employee. The one emphasis is a won star, marked and set heavier. Notes are numbered and listed at the end: the sources of the facts behind lines of history, and a word where a number was worked out by the model. In the developer mode each line also says, in small type under it, where it came from: the recorded date and fact, or the condition that wrote it with the values it read, the chance of an event, the planned day and range of the drift, the score and the bar of getting in, or the traits that chose the scene. The normal mode never shows this.

A small story of one to five sync points is told by the same report. Its record has the same shape: the facts of the person dated in the year of the event before the arrival, the lines of getting in, each sync point on its day after arriving, said as done or not done, the scene, the leaving, and the facts of later years after it. Its days are counted from arrival, since a small story has a year and no calendar. It has no model numbers. The facts an event may tell are those of its person that are dated, used for the story or the history, checked by more than one source and not set aside.

The stars of a small story are of the two kinds the premise names, and a story is one of three: guarding only, with two stars at least, all of them guard points; mending; or both. A guard point holds a recorded event against a real threat: when it is missed the trip falls out of sync with history, the traveller is sent back on that day and the points after it are never reached, with longer rest and a loss of mood. Every other point is a mend point and sets right something history left undone, finishing a work, saving or healing someone, or easing an end that cannot change, and a miss costs only its star. The record says what each miss cost. Before the summary, the report sets out the shift of the timeline: for each point that mended something, what history recorded on the left and what this timeline made of it on the right, and for a trip out of sync the event it failed to hold. A person card keeps its history apart and adds IF lines, the lives the employees changed, each opened once a trip has won it. The record of an employee lists what they changed and counts the recorded events they held in place. A point may ask for gear, a scene item or a plain item such as antibiotics, and an item a point names may be taken on that story. An event card marks where its story stands in the making with `build_step`.

After the record comes the summary: the cost of the kit, the stars with the sync points under them, growth, the antique brought back and the rest days, then hints. The rest is the rest of the outcome, two to four days for a story (`light.rest_days`), plus `office.rest_per_stay_day`, half a day, for each office day away, rounded up, then shortened by the secretary. Numbers, the chart and the ledger appear, folded, only for a model that counts something worth it, such as lives in an outbreak. The body of the employee through the stay as LM reads it is a part of its own, shown in the developer mode only for now (`ui.report_body`). A trip brings no funds. A report can be run again with the same setup, compared with the previous one, and shared; sharing comes last and is the one button lit.

### Stamps

The stamp at the top of a report is read from three things. How the employee came back: normally, early (gave up or was recalled) or the hard way (near death or sent back). How many stars: all, some or none. And where none was won, whether the branch still came out different from the main timeline. Every stamp is a kind word and the least of them is to try again: Home in full, Well worth it, Left a mark, Next time; Done and home early, Something gained, It made a difference, Plenty of time yet; Home a hero, A close call, still a gain, Safe and sound. The stamp only says how it went. The ending of the model still sets the time energy and the rest. The table is `stamp` in the config.

## Which stories are in the game

A story is turned on when it is finished. With `release.ready_only`, only an event whose card says `ready: true` is in the game, and a model with no event of its own needs `metadata.ready: true`. The rest are kept out as drafts: no place on the map, no antique, not drawn for the start, no page in the wiki, and the antiques of their models with them. The developer mode and `?drafts` show every story. The welcome says which places are open from the start as they are; with only the start story on, it is the one place.

## Time and the crossing

One office day is thirty historical days, and a stay is one to seven office days, so a trip can span recorded events that lie weeks or months apart. A new game starts on 12 November 2026 (`office.start_date`). Existing saves keep their `calendarStart`, including imported saves. Saves without it use the configured start. What wears on the traveller at the pace of the office, such as homesickness, runs on office days, and the world runs on historical days. The crossing is not exact: a trip arrives before or after the planned day by up to a tenth of its stay, at least one day and at most ten, drawn from its seed, never before day 0 of the model. A short story is not missed and a long one is not thrown off by weeks. A model may set its own range.

## Antiques, anchors and places

An antique is an anchor. It points at one place and one time, and holding it anchored is what opens that place for dispatch and makes its event readable. Places that are not anchored are not drawn on the map at all. An anchored place nobody has been to yet is drawn as a question mark, with no name, place or tags, and it can still be picked and sent to. Its name appears on the map after the first trip there comes home. An anchored event that has no simulation shows its name and story at once, since there is nobody to send.

### Finding antiques

Antiques are not bought in a shop. Each trip may bring one back. A new game starts with Guangzhou 1924 open through the statue of Sun Yat-sen, a medium of today that is not an antique and is never found or sold, and with three more places: the latest event of the catalogue, which reaches the farthest back, and two at random (`office.start_scenes`). Let the trip go to a place at year `y0` and position `p0`. Every antique that has a place and a year is a candidate if its year is earlier than `y0`, never the same year. For a candidate at year `y` and position `p`:

- Reach: `w = exp(-(y0 - y) / tau_years - d / tau_km)`, where `d` is the great circle distance in kilometres from `p0` to `p`.
- Each candidate contributes `k * w` to the combined roll. The base chance is multiplied by the traveller’s luck factor and the `star_share` entry for stars earned and stars available. Zero stars give a quarter of the base chance before luck, while full stars give the entire base chance before luck. The final chance is capped at 95%. Auto and manual trips use the same roll when the trip can bring back an antique.
- The trip finds something with chance `min(cap, 1 - product(1 - k * w))`.
- The antique it finds is drawn from the candidates in proportion to `w`. An antique that points to a place with a simulation and is not held yet counts `modelled_place_boost` times heavier, 12 in the current configuration.

The current values are `k` 1.2, `cap` 0.8, `tau_years` 120 and `tau_km` 2500. The story card shows the base find chance. The actual roll is seeded and uses the result and luck of the traveller.

Because candidates must be earlier, antiques lead backwards in time. A place is reached from a later one, and the way to an earlier era runs through the antiques of the later ones.

### Small stories

A catalogue event without a model is played as a small story. The traveller's abilities, weighted by the field of the event, are set against a difficulty that rises with its tier, with a little seeded luck, and the margin gives one of three outcomes, met them, a brief encounter, or missed them. The trip takes four to nine days by tier, needs no kit, pays time energy by outcome, and may bring back an antique by the same rule as any trip. It has a short report, not a branch comparison. The numbers are in `config.light`. Full auto also sends people on small stories to places it has anchored.

### Anchoring and selling

- An antique that opens a place must be anchored in the antiques list of the Agency page. Anchoring opens the place. An anchored copy cannot be sold. The automatic mode anchors a new piece once; a piece the player has released stays released, so it can be sold.
- The same antique can come back more than once. Copies beyond the first are spares. Spares can be sold one by one, or all at once with one button.
- An anchor cannot be released while someone is away at that place, and the last open place cannot be released.
- A spare sells for the price of the antique. Each copy is therefore either money or a door.

## How the economy was tuned

The agency starts with 800 funds. Hiring costs 100 per employee. Daily wages are `headcount × 2.4 × (1 + 0.5 × (headcount − 1))`. Trips earn time energy when they improve the agency’s best star count for that story. Surplus antiques can be transferred to the research institute for funds, and goods can be sold back. Antique transfers use the current grant tier plus the secretary’s bonus. The tier filter can also limit the bulk transfer to spares in that tier.

Auto targets a cash reserve of 100 funds or 14 days of payroll, whichever is greater. It sells the cheapest spare copies first until it meets the reserve or runs out of spares, keeping one copy of each antique. Restocking basic supplies stays within that reserve. If a wage payment falls due before there is enough cash, Auto first tries to sell enough spares to cover it.

Use `tools/in_probe_economy.mjs` to compare cash, payroll and growth across new games. Use `node tools/in_probe_roster.mjs <save.json[.gz]> [days] [sample-size]` to compare the same save with its existing roster or one added hire. The probe reports funds, wages, spare value, zero-star trips, new openings and improvements to the agency’s best story results.

In one 60-day run from an existing save, the original roster finished 19 trips, 18 with zero stars. Two comparison hires finished 29–30 trips, 27–28 with zero stars, while two specialist hires each finished 29 trips, 22 with zero stars. Each specialist added two stars to the agency’s best story results. Each added hire raised daily payroll from 14.4 to 24 funds. The figures describe that save and roster, so rerun the probe when changing starting conditions or employee requirements.

## Money and energy

- Funds pay the hiring fee, the daily wages and the modern supplies. The starting reserve and sales of antiques and goods cover those costs. A trip can bring back an antique or earn time energy.
- Time energy buys future goods and is also the progress toward going home, so spending it lowers the progress.
- Every item sells at the price it was bought for, in the currency of its shop, at any time and with no loss. An antique's nominal grant comes from its story tier and `office.sale_scale` (3). Each field redraws its market factor every 30 game days. The best chance of finding another copy on a full-star trip at ordinary luck shifts the market-adjusted grant by up to 25 funds in either direction. A chance of 5% or lower gets the full upward adjustment, and a chance of 30% or higher gets the full downward adjustment. The grant stays within the field market's original ±30% range before rounding to the nearest 100. The secretary's percentage then applies to the rounded grant, so 700 with a +20% bonus pays 840. Manual, bulk and automatic transfers share this calculation.
- Across 61 transferable antiques and 400 seeded market periods, weighting by the repeat-find chances on equally sampled full-star routes at ordinary luck, the rarity adjustment moved the mean rounded grant from 561.33 to 561.50 funds. The catalogue spans the same 300–1,000 grant tiers.
- Goods sent on a trip come home with the traveller, unless the story uses them up. Supplies and the handbook are spent. The recall charm is spent only when a trip ends in near death. Future goods are never lost.
- Future goods can help with eligible story goals and may also change a traveller’s attributes or exposure.

## Items

Items are bought into stock and carried on a trip. A kit has a weight limit (`weight_capacity`, 20 for now), and each item has a weight, a maximum count and a step. The shop paid in funds sells supplies, a handbook and a recall charm. The time shop paid in time energy sells future goods.

Each item card may carry a `loss` field that says how a trip uses it. An item with no `loss` always comes home.

- `used`: spent in the story. Examples include oral rehydration salts, chlorine tablets and the handbook.
- `rescue`: kept unless the outcome is one of `office.fatal_outcomes` (near death), in which case it is spent. The recall charm.
- `fatal`: lost when the outcome is fatal, unless a `rescue` item was carried.

A recall before the story ends does not count as fatal. The kit that came home and the kit that was lost are kept on the dispatch as `kit.back` and `kit.lost`.

## Main line and going home

The main line is the time energy the agency holds, in five stages at 0, 80, 240, 440 and 600 (`cards/mainline`). The last is going home. The home cost, `office.home_cost`, is 600, under a third of the most that all places can pay together: 140 from the two full simulations and 1700 from the 179 catalogue events at three stars, 1840 in all.

At the home threshold, the finish button opens the ending and its completion card. The time machine takes the agency director home to their own future, where the echoes of the past are still with them. The ending dialog, share image and copied text use the same localized ending.

## Auto mode

Auto claims finished trips, anchors newly discovered antiques, manages the cash reserve and restocks basic supplies. For each ready employee it first chooses among open, unoccupied places nobody has returned from. After those are explored, it chooses among the places the employee has tried least, using a seeded draw to break ties. Recalled trips do not count toward that rotation.

For a small story, Auto estimates star outcomes using the dispatch seed. It considers playable non-implant scene equipment that changes attributes or meets a story requirement. It ranks kits by more estimated stars, lower purchase cost and fewer pieces, in that order. It can buy unlocked equipment from the time shop for the chosen kit, up to 50% of the time energy currently held for that dispatch. Full-model trips continue to use their own automatic kit rules.

## Catalogue events

`cards/events` lists 179 events across the world. The selection leans toward science, technology, philosophy, art and ideas, and more than half are regrets: people and works that history treated unjustly or lost, such as Galois, Hypatia, Sappho or the Indus script. Each event has a place, a year, a field, a story, a figure and a relic. The relic is an antique that is found on trips. Anchoring it opens the event, and until then the event is only a question mark. Every event can be gone to once its antique is anchored. Two of them have a full simulation, and the rest are small stories.

## Data and code

- `cards/` is the source of all content, one yaml card per thing. `data/` is generated from it by `node tools/build_data.mjs` and is never edited by hand.
- The code holds no game numbers. Rules, prices, speeds and probabilities are in `cards/config`, read through a strict getter that fails on a missing key.
- The interface in `js/` shows data and sends requests. Everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. A server backend with the same methods could hold the data and the engine and leave the page to carry data only.
- The page is plain ES modules with no build step to run. Any static file server works.
- A save is one JSON object in the browser's local storage. It can be exported and imported from the settings page. A save from another version is dropped and a fresh one starts.

## Languages, sound and sharing

- The Past Is Yet to Come is the title shown in the game, browser tab, share image and copied share text across all languages. The subtitle 白露未晞 appears in About and the README guides for Simplified Chinese, Traditional Chinese, Japanese and Korean. Project links use their English names.
- English is the fallback and must be complete. Simplified Chinese is the second language. Any missing key reads English. `node tools/check_i18n.mjs` checks the files against English.
- The music is a few piano pieces played by a small Web Audio synthesiser from MIDI files, and the sound effects are tones the page makes itself. There is no sampled audio.
- A trip can be shared from its report. The card opens in a pop-up, not on a page of its own, and closes with a click beside it, the cross or Escape. It tells the story of the trip in a few lines taken from its record: the line of the employee, how it ended, then the lines that won a star, the lines written for this employee and the history around them, at most `share.record_lines`, in time order. It draws no curves. A simulated place shows its two curves against the mainline, a small story shows its sync points, and there is no table of numbers on it. It has the address and a QR code, as a picture to save or copy.
- The theme follows the system and can be set to light or dark. Quotes from historians and scientists rotate in the header.

## Checks

- `node tools/check_content.mjs` builds thousands of reports and fails on a missing text key or template variable.
- `node tools/check_logic.mjs` audits traits, employees, scenes and items: every point kind has a trait that gives it and one that costs it, every scene can be three starred by someone on the roster, and no requirement is gated by equipment the text does not name.
- `node tools/check_i18n.mjs` and `node tools/check_boundary.mjs` check the languages and the engine boundary.
- `node tools/ui_check.mjs` drives the page with Playwright through dispatching, shopping, antiques, auto mode, the map, the axis, themes, languages and the settings page.
- `node tools/headless.mjs` runs the simulation without a browser and compares kits and staff from the same seeds.

## Stars

A story has one to five sync points by its weight, one or two for a light one, three for a middling one, four or five for a heavy one, and the stars are how many of them a single trip hits: full stars need all of them on the same trip, while a star won on any trip opens what it changed. Time energy and the chance of an antique follow the share of the full stars. A full model takes its base of time energy from `stars.energy_base`, and a model missing from that table is an error rather than a trip worth nothing. A full simulation names its points in its model, `star_points`, and each is a milestone of the model that needs the traveller, so history cannot hit one alone. In London 1854 they are convincing Snow, winning the trust of the street, and having the pump handle removed ahead of history. In Vienna 1847 they are convincing Semmelweis, getting the washing started, and making it a rule ahead of history. A point that the model cannot evaluate cannot be a point. A brief scene has three generic points, reaching the place, meeting the figure and leaving a mark, each a margin of the traveller against the event.

Because the points come from what the traveller does, they depend on the employee's habit and the kit. An employee who works on allies convinces and gets the handle removed, one who works on prevention gets the water or the washing done, and no kit means the points that need supplies cannot be hit.

Every place keeps its best star count. Time energy is paid only for the stars above the best the place has had, a quarter of the base of the place for one star, half for two and all of it for three, each trip paying the difference to what the best already paid, so a place cannot be farmed for energy. Funds and antiques are paid every time, so waiting at home brings money, antiques and new employees, but not by itself the way home. The best stars show on the map pins and event rows in bronze, silver and gold, the map can be filtered by them, the log of dispatches shows the stars of each trip with a mark when it beat the best, and a report lists the points with the ones hit highlighted in the timeline.

## Special equipment and scenes

The time shop uses time energy to unlock and buy special equipment. The exoskeleton unlocks at 130 and costs 162. It supplies strength for sync points and adds ten units to the weight the traveller can carry. The neural chip and bionic lung are implants, with a total load cap of 2 (`office.implant_load_cap`). Each uses one load. The chip adds two wit, and the lung adds one constitution and one will. Employees equip implants from their status page and return them to stock when dismissed. Older saves exchange each retired arm, including an equipped arm, for one exoskeleton. Other retired items still owned by the office are refunded in their original currency.

The radiation shield unlocks at 10 time energy and costs 20. The hologram cloak unlocks at 100 and costs 125. The golden apple unlocks at 120, costs 150 and triples finesse in scenes.

The price is being found out. Each piece shows by its exposure, a scene is more suspicious the later its tier, and the chance of being found grows with both, capped at ninety percent. A cloak lowers it, and with no equipment there is nothing to find. Being found out ends in one of three ways, being turned away, which costs a star, being locked up, which costs all stars and the antique and several days, or being hunted, which costs everything and more days and a lot of favor.

A hundred and twenty one catalogue events are scenes with three authored points, each a requirement on the traveller: an ability, a trait, a job, being a woman, an item, a capability that an item gives such as strength, or luck. A point that names no item must be met by someone on the hand written roster without equipment, so equipment only gates what the text says it gates. They are checked directly and are not differential equation simulations like London 1854 and Vienna 1847.

## Inspirations

The encyclopedia follows the Civilopedia of Civilization IV, sending someone out and reading what happened follows Assassin's Creed Brotherhood and Travel Frog, hiring follows Heroes of Might and Magic, the clock and the music player follow Stellaris, and the stars and levels follow Plants vs. Zombies and the full synchronisation of Assassin's Creed. They are named as thanks and have no connection to this game.

## Licence

The game is MIT licensed. The music files are from the Mutopia Project, public domain and kept unchanged. See the README for the details.

## Regrets and redemption

Older cards, those without `scene.star_rules: 2`, may still carry `regret: true` and one point marked `redeem: true`. They are kept so that old saves and reports read, and no story that is turned on uses them; the stories use guard and mend stars, see Stars.

## What the record leaves out and what the employee says

The record of a trip runs in the order of the calendar. A fact with a full date sits on its day; with a planned arrival, a fact with only a year or a month sits where its date falls; without one, as in a story of the lunar calendar or before the common era, a fact of an earlier year comes before the arrival and a later one after the leaving. After an employee falls out of sync and is sent home, no scene of a later day is told, and the leaving comes after the cost of a point missed on the last day.

A mend point may list `overturns`, facts of history its branch undoes, such as the death of the person it saved; when the point is won those facts are left out of the record.

A story may give the employee one remark at the end of the record, chosen by who the employee is: `text.<language>.remarks` maps keys of person tags joined by `+`, such as `female+elder` or `young`, to one sentence, and the first key the employee fits is said, `else` when none fits, nothing without `else`. With `scene.remark_on` the remark is said only when that point was won. A remark is the employee's own voice; the people of history keep to what they are recorded to have done.

## Log, reports and the history of a place

The log of dispatches is read from the one line summary of every trip, which is kept for good up to `office.max_trips`, so the log never loses a row. Full reports are kept per place: the two best (most stars, then the newest, `office.keep_best`) and the ten latest (`office.keep_latest`), so a report that is not among them can no longer be opened, but its line stays. A report keeps no curves when its model shows no numbers, and at most `ui.chart.max_points` points when it does, so the saved game stays small. The story of a place, once its relic is anchored, lists every trip that came home from it, newest first, with who went, the stars, whether the redemption was reached and the outcome.

A trip can be archived, by itself or by a rule that archives all but the best trip of each place. Archiving hides it from the log and keeps its report, up to 200 of them, the oldest going first; the line and the stars always stay, and Restore brings the line back. A switch shows the archived ones dimmed. There is no delete, because the lines are small and bounded and the tally of stars must not lose what it counted.

