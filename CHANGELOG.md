# Changelog

## 0.5.8, 2026-11-15

- Pune 1848, Savitribai Phule, is rewritten and turned on: the school at Bhide Wada in January 1848, the stones and dung on the road and the spare sari, the head teacher of 1852 and her death of plague in 1897, with sync points for setting out the slates, carrying the bag on the road and staying with a girl until she can write her name.

## 0.5.7, 2026-11-15

- A line of history in a record carries its own date; no date is put before it.

## 0.5.6, 2026-11-15

- Rome 1820 to 1821, John Keats by the Spanish Steps, is rewritten and turned on: from the arrival on 15 November to the death on the night of 23 February, the register that wrote the 24th, the burial and the stone without a name, and Severn beside him in 1879. The exposure to infection is lowered so the stay is not cut short for everyone in its second week.

## 0.5.5, 2026-11-15

- An event card may name `date`, the planned arrival on the calendar, so the lines of the employee in a small story that runs into a new year carry the right year.

## 0.5.4, 2026-11-15

- Kitty Hawk 1903 is rewritten and turned on: one office day from 1 December, the failed try of 14 December, the four flights of 17 December, the photograph, the telegram that gave 57 seconds for 59 and the silence of the Dayton papers, with sync points for carrying the rail with the life saving men, standing by the camera and handing the right number to the telegraph.

## 0.5.3, 2026-11-15

- A day of the stay may be a fraction, so the things of one day keep their order, and it reads as the day it falls in.
- A scene may name the day it falls on.

## 0.5.2, 2026-11-15

- Huangzhou 1082, Su Shi on the Eastern Slope, is rewritten and turned on: six dated facts from the Crow Terrace trial to his leaving, the two odes on their lunar days, three sync points for being taken in on the slope, the boatman before the night on the river and a lamp on the road home, and scenes that name the employee.

## 0.5.1, 2026-11-15

- A small story can be told on the days of its stay. A fact may name `stay_day`, its day counted from the planned arrival, and a sync point may name `day`, so a story on the lunar calendar or with a known order of events reads in that order without converting dates.
- Facts with a line from years before the event are told before the arrival, in order, as what led up to it.
- A scene names the employee with `{staff}`.

## 0.5.0, 2026-11-15

- A person card holds only what is true. The sentences that explained the card, the year of the game or what is made up were taken out of the stories, facts, articles and wiki cards of the people, and the descriptions of the relics no longer call them invented. What is made up stays on the side of the employee: identities, sync points, scenes, bystanders, events of the models.

## 0.4.1, 2026-11-15

- More reports are kept: the ten latest and the two best of each place. A report keeps no curves when its model shows no numbers, and at most 200 points when it does, so a report of Guangzhou 1924 is about 20 KB instead of 218 KB.
- The share card is made from the record: the line of the employee, how it ended, and a few lines that won a star, were written for this employee or are history. It draws no curves.
- A fact is told in a record only through a `line` written for the record; the text of a fact is for the wiki.

## 0.4.0, 2026-11-15

- Stories are turned on one by one. With `release.ready_only`, a story is in the game only when its event card says `ready: true`, or, for a model with no event of its own, `metadata.ready: true`. Every other story is kept out: no place on the map, no antique, not drawn for the start, no page in the wiki, and the antiques of its model go with it.
- Guangzhou 1924 is the one story turned on.
- The developer mode, and `?drafts` in the address, show every story.
- The welcome says which places are open from the start as they are.

## 0.3.0, 2026-11-15

- Every story is told by the same report. A small story of three sync points now keeps a record in the same shape as a model: the facts of the person in the year of the event, the arrival, the lines of getting in, each sync point on its day, won or not, the scene, the leaving, and the facts of later years, each year marked, between the crossing and the return to the office.
- The build gives every event the facts of its person that may be told, with their dates and sources, so a line of history in any report can name its sources.
- The new texts of the report are written in Chinese; the English ones are drafts.

## 0.2.3, 2026-11-15

- A hint may name the star it explains, and is then given only when that star was missed. Guangzhou 1924 no longer tells an employee who cannot read about the copying of the records, which is no longer a star.

## 0.2.2, 2026-11-15

- Only a pop-up the game forces open stops the clock: the welcome and the day a wage goes unpaid. A report, a page of the wiki, the settings or any other pop-up the player opens leaves the clock running (`clock.hold_modals`).

## 0.2.1, 2026-11-15

- In the developer mode each line of the record says where it came from: the recorded date and fact, the condition of a milestone or an event with the values it read, the chance of an event, the planned day and the range of the drift, the score and the bar of getting in, the traits that chose the scene. The normal mode does not show it.

## 0.2.0, 2026-11-15

The framework for stories is in place. The stories themselves are still being written: Guangzhou 1924 is the first one built on it, and London 1854 and Vienna 1847 still run on their earlier models.

Time and the crossing
- One office day is thirty historical days, and a stay is one to seven office days.
- The crossing is not exact. A trip arrives before or after the planned day by up to a tenth of its stay, at least one day and at most ten, drawn from its seed.
- The office keeps a calendar from the real date a game began, and the clock shows the date.

Stories
- A person is a module: one folder with `person.yaml`, an optional model and pictures. A story with a fact sheet is checked by the build.
- Templates: a model may begin with `template: <name>` and be laid over a shared model. The founding template is the first.
- Milestones can carry a recorded date, a fact, variants and effects. Recorded dates happen by themselves on their days.
- `epilogue` tells what is recorded months or years after a model ends, and `report.countdown` lets an ending count the days left to a recorded day.
- Employees get tags from their cards, and each place offers identities a traveller can be taken for. Every employee has a door into every place.
- The events of a person stand side by side; none opens another.
- Guangzhou 1924 is rebuilt on the founding template: seven months from the first Sunday lecture, a fact sheet, lines written for seven employees, and three stars that are deeds of the traveller.

Antiques
- A trip brings back only antiques from years before the place it went to.
- The place a new game starts from opens through a medium of today, the statue of Sun Yat-sen, which is not an antique.

Reports
- A report is one record in time order, from the day the employee set out to the day they came back, with the year marked as it changes.
- History and the lines of the employee are told apart by a thin rule, and can be shown together or apart.
- Notes name the sources of the facts behind the lines of history and say where a number was worked out by the model.
- Numbers, chart and ledger appear only for a model that counts something worth it. The body of the employee as LM reads it is its own part, shown in the developer mode.
- The stamp is read from how the employee came back, the stars won and whether the branch came out different. Every stamp is kind.

Checks
- `tools/check_benchmarks.mjs` runs the benchmark stories for seven reference employees with fixed seeds.

## 0.1.0, 2026-11-09

First prototype: an agency page, a world map of catalogue events, fifty employees, simulated eras for London 1854 and Vienna 1847, antiques and anchors, an automatic mode, music, a share card, English and Chinese.
