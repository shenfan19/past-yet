# Cards

The game content lives here as small yaml files, one card per thing. `data/` is generated from these cards and must not be edited by hand.

```
node tools/build_data.mjs          pack the cards into data/
node tools/build_data.mjs --check  write nothing, exit 1 if data/ is out of date
```

A card holds the structure of a thing and its text in every language, so changing one thing means changing one file.

```yaml
# cards/staff/s_amara.yaml
order: 5                 # sort order inside the folder, required on every card
gender: f
age: 38
base: {skill: 0.55}
traits: [kind, patient]
start_hired: false
text:
  en: {name: Amara Okafor, job: Midwife, bio: ...}    # the fallback language, required
  zh: {name: 阿玛拉·奥卡福, job: 助产士, bio: ...}   # any other language, may be left out
```

The file name is the id. A card with `id:` inside must match its file name.

| Folder | One card is | Output |
|---|---|---|
| `items/` | a shop item | `data/items.yaml` |
| `antiques/` | an antique made by hand | `data/antiques.yaml` |
| `events/` | a famous event with its relic | `data/catalog.yaml` |
| `staff/`, `traits/` | an employee, a trait | `data/staff.yaml` |
| `mainline/` | a stage of the main line | `data/mainline.yaml` |
| `wiki/places`, `people`, `events`, `stories` | a hand written wiki article | `data/encyclopedia.yaml` and its text |
| `wiki/stats`, `model_events`, `refs` | an attribute with its double edge, a model event, a source | the same |
| `eras/<id>/` | `model.lm.yaml` the simulation model, `text.<lang>.yaml` the text of the era | `data/eras/<id>.lm.yaml` and the text files |
| `text/<lang>/` | a piece of interface text, merged by key | `data/i18n/text.<lang>.yaml` |
| `config/`, `world/` | small shared files, the world coastline | copied |

Languages are the codes in `config/config.yaml` under `i18n.locales`. A language that lacks a key reads English for that key.

To add:
- an event: copy a card in `events/`, give it the next `order`, write the text. Its relic becomes an antique when the game loads.
- an employee: copy a card in `staff/`, choose traits from `traits/`.
- a language: add its code to `i18n.locales`, then add that language under `text:` in the cards you want to translate and add `text/<lang>/` files. Nothing is required, English fills the gaps.

After any change run the build, then `node tools/check_i18n.mjs` and `node tools/ui_check.mjs`.

## The engine boundary

The interface in `js/` shows data and sends requests. It does not run the simulation: everything it needs from the engine goes through `js/backend.js`, and `node tools/check_boundary.mjs` fails if another file imports the engine. The local backend calls the engine in the same page. A server backend with the same methods could read the cards, run the engine on the server, and leave the page to carry data only.
