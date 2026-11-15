# Changelog

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
