# Save format

This page describes how The Past Is Yet to Come keeps a game: what a save holds, how it is read, and how it grows without breaking older saves.

The game currently writes flat saves with `version: 13`. The envelope and split files described below are a proposed format. Loading an older flat save backs up the raw save under `<key>_backup_v<version>`, fills missing fields and adds any new employees. If a save still cannot be read, the game keeps a backup under `<key>_backup_unread` before starting a new game.

Flat version 13 migrates the 15 retired item IDs. Each cyber arm or gorilla arm from inventory, equipped gear or an unclaimed kit becomes one exoskeleton in stock. Other retired stock and unclaimed cargo are refunded at their old shop prices in funds or time energy. Old item IDs are removed from saved gear, kits and trip item lists. The reports and results already generated for those trips are retained. Loading the migrated save again leaves the inventory and balances intact.

## Rules

- Permanent ids. Events, employees, items, antiques, implants and simulation modules have permanent ids. An id is never renamed or reused. When removing a card that still appears in flat saves, reserve the old id and define how to migrate its references. Ids do not carry facts that may change, such as a year.
- Tables keyed by id. Employees, event progress, items and simulations are stored as maps from id to record, never as lists read by position, so adding or removing one is adding or removing a key.
- Facts in the save, limits in the rules. A save records what there is; capacities, slots and numbers live in the cards. Implants are a list, and raising the limit from one to three does not touch the save.
- Absolute times. Every time is an office day or a day of the stay, never a count of simulation steps.

## Envelope

```json
{
  "format": "teleporter-save",
  "schema": 13,
  "min_reader": 13,
  "app_version": "0.10.0",
  "created": "2026-11-17T10:00:00Z",
  "updated": "2026-11-17T12:30:00Z",
  "generation": 42,
  "game": {},
  "parked": {},
  "ext": {}
}
```

- `format`: always `teleporter-save`.
- `schema`: the version of the save structure, raised only when the structure changes.
- `min_reader`: the lowest schema that can read this save safely. Adding fields leaves it as it is, so an older game can still read a newer save.
- `app_version`: the game version that wrote the save.
- `generation`: a counter raised on every save, see Files.
- `game`: the content, in sections.
- `parked`: things the save names that the game no longer has, kept aside instead of dropping the save.
- `ext`: one key per add-on module, such as a bridge to Life Matters.

## Sections of `game`

| Section | Holds |
|---|---|
| `office` | funds, time energy, dispatch counter, stock, secretary, hiring offer, the real start date, the clock |
| `founder` | the player's own character |
| `staff` | by employee id: hired, mood, rest, worn gear, implants, personal best stars by story (`storyBests`), growth |
| `travel` | trips under way, and the index of trip chunks |
| `progress` | by event id: best stars, unlocked IF lines, visited, and `world`, the lasting state of that place |
| `antiques` | owned, anchored, and those the automatic mode has anchored |
| `start` | the random start antiques, the starting crew, whether the welcome was read |

A trip records its `crew` as a list of members, each with an employee id, a role and a kit; today the list has one member. Its `sim` is a map from simulation module id to that module's own subtree with its own `v`, so a new simulation such as a famine or a drought is a new key.

## Files

The save is a folder, split by size and how often it changes.

| File | Holds | Written |
|---|---|---|
| `save.json` | the envelope and every section of `game` | whole, on every save |
| `trips/<chunk>.json` | the input and result of returned trips | appended |
| `reports/<trip id>.json` | the report of one trip as it was shown | once, may be compacted |
| `sims/<trip id>.json` | the series of one trip's simulations | once, may be compacted |

Appended files are written first and `save.json` last. `save.json` records its `generation` and the chunks it uses; a chunk it does not name is left over from an interrupted save and is ignored. In the browser each file is one storage key; an export is a zip of the same files.

## Reading a save

1. Parse the JSON; a save that cannot be parsed is kept as a backup and a new game starts.
2. A save with `version` and no `format` is a flat save. Upgrade it to the latest flat version before wrapping it.
3. If `min_reader` is above the game's schema, the save is not overwritten and the player is asked to update the game. If only `schema` is above, the save is read and unknown fields are kept. If `schema` is below, the save is backed up and upgraded step by step.
4. Every section is deep-merged with its defaults.
5. References are checked: whatever names a card that no longer exists moves into `parked`; new employees are added with defaults; a trip under way to a missing event comes home without stars.
6. Parked things whose cards are back are put back.
7. Only if the founder is missing or a number is not finite does a new game start, after a backup.

Unknown fields and `ext` are written back as they were read.

## Growing the format

| Change | What to do |
|---|---|
| A new field | add it to the section's defaults; no version change |
| A larger limit, such as three implants or a crew of four | change the card rules; the save does not change |
| A new simulation | a new module id in `sim`; the module keeps its own `v` |
| A new section | add it with its defaults; raise `schema`, keep `min_reader` |
| A renamed or split field | add an upgrade step; raise `schema`, and `min_reader` when older games would misread it |
| A retired card | nothing; reading the save parks what refers to it |
