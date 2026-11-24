# Changelog

## [Unreleased]

- Added Russian to the language selector. The interface, calendar, tags and header lines are in Russian; stories and the encyclopedia read in English for now. Time axis ticks can use a shorter year form per language, and Russian ticks read −4000 and 1.
- Fixed Russian text that split into stray keys: the lodger identity, an early-return stamp and a placeholder in a secretary perk.
- Story prose in Chinese, English and Traditional Chinese for Hammurabi and Ibn Battuta.
- Traditional Chinese now follows the rewritten Chinese for thirteen story texts that had kept an older version, among them Eratosthenes, Lalibela, Ife, Sophie Germain and Wallace.
- Story prose in Chinese, English and Traditional Chinese for Inō Tadataka, with Japanese too, Keats, Nezahualcoyotl, Pushkin, Ramanujan and Sequoyah. Religious wording in the Keats, Pushkin and Sequoyah cards is now neutral.
- The fiction note under the record and on share cards now also says that historical details may be wrong or not yet checked. On the share card the note wraps instead of running past the edge.
- `tools/story_prose_convert.py --stale` lists Traditional Chinese story texts left behind by a rewritten Chinese text, and `--refresh` reconverts them; 32 such texts were brought up to date.
- The story review save also picks readers whose trip falls out of sync after the passage they show.
- Stories can now be told as short fiction. The story page opens with three paragraphs, each won star has its own passage in the report, and a closing paragraph sits under the stamp. Mary Anning, Émilie du Châtelet and Sejong are the first stories written this way, in English and Chinese.
- Reports now open with the echo and the full record. The fiction note follows the record and the settlement closes the page.
- Share cards for these stories quote a few sentences from the won passage. Other cards keep up to three short lines from the record.
- When every star is won, a story shows its own closing paragraph. A key passage can vary with the kind of employee who went, such as a teacher or a geologist.
- Chinese text for the Sejong story now names Chojeong as 椒水, as in the court records.
- Chinese story prose for Abel, Ahmed Baba, Bashō, Beethoven, Boltzmann, Boole, Cajal and Chekhov. Every passage in the eleven written stories now ends on a moment rather than a result. English for these stories still uses the plain record lines.
- Fixed a startup failure when a saved report or the trip log named a story the current mode does not load, such as a draft played in developer mode. Those trips wait aside in the save and return when the story is available again.
- Restored the two-sided record, with history to the left of the time axis and the traveller to the right.
- Saves written in developer mode now keep V and King and their trips. Outside developer mode those trips wait aside in the save, are left out of the dispatch log and come back in developer mode. Trips under way and kept reports set aside with a missing place or employee also come back when it returns. The import message says how many trips wait aside.
- A story with Chinese story prose must now also have it in English and in every language that carries its card; the data build fails otherwise. Added `tools/story_prose_convert.py`, which converts the prose into Traditional Chinese with OpenCC and a list of corrections, and Traditional Chinese prose for ten stories. The rest of the Traditional Chinese text was converted again, which puts right characters left in Simplified.
- Share card excerpts are now two sentences, and every excerpt is given in each language.
- Story prose in Chinese, English and Traditional Chinese for Socrates, Euclid, Eratosthenes, Fibonacci, Dante and Copernicus. The second Copernicus star now reads more plainly.
- Story prose in Chinese, English and Traditional Chinese for Adam Smith, Ada Lovelace, Mendel, Mendeleev, Marie Curie and Freud. The Traditional Chinese titles of the Smith, Sophie Germain and Great Zimbabwe stories now match the Chinese ones.
- Added `tools/story_review_save.mjs`, which plays each story with prose in developer mode and writes a save to import.

## 0.14.0, 2026-11-21

- Moved recruitment and both shops into pop-ups opened from the Agency. The Employees and Items descriptions sit below their section headings.
- Set six fixed antique grants from 500 to 1,000, based on the historical year an antique points to. The Antiques heading now holds the bulk transfer button, which leaves one copy of each antique. The secretary's bonus still applies.
- Kept the top bar in the same position when switching between Time travel and Agency. Both pages show the finish button beside the energy counter. Removed the divider before the date on narrow screens.
- Fixed a startup failure when reopening the encyclopedia with an incomplete unlock rule. Startup errors now replace the loading message even if the page has partly rendered.

## 0.13.5, 2026-11-21

- Reorganized the top bar with tabs on the left, time controls in the middle and funds and energy on the right. On narrow screens the clock moves down as a group. Removed the navigation arrows and secretary summary from the header, and grouped the music buttons in an outline.
- Added an optional Idle pause switch beside Auto-dispatch. It pauses when nobody is travelling or resting and resumes at the selected speed when a new trip or rest period begins. Press Play to keep the clock running through the current idle period.

## 0.13.4, 2026-11-20

- The clock now has a dedicated Play/Pause button and a separate speed selector. Choose a speed while paused or change it while playing. The game remembers the selected speed when you resume or reload a save.
- Renamed Auto to Auto-dispatch in all seven interface languages. Automatic dispatch, report collection and purchases wait while the clock is paused.

## 0.13.3, 2026-11-20

- Rewrote the welcome in all seven languages to introduce recruitment, guarding and mending history, and returning to your family in the future. Clarified the AI credits and how to report an issue or request removal.
- New games start on 12 November 2026. Existing saves keep their recorded calendar start.

## 0.13.2, 2026-11-20

- The game opens faster on slower connections by loading independent files in parallel and skipping unused draft models in normal play.
- The opening screen shows the game title and a loading message while the game starts.

## 0.13.1, 2026-11-20

- Shortened the opening introduction to three sentences and the home screen introduction to one. The Finish the game button now sits beside the time energy counter and becomes available at 600 energy.
- Condensed the welcome and About notices about fictional portrayals and AI-generated material. Each notice now has one GitHub Issues link and one email link for corrections and removal requests.
- The About page now records when the first version was completed and shows the current version and release date on a separate line at the body text size.

## 0.13.0, 2026-11-20

- Research grants now use funding tiers in steps of 100. Filter antiques by tier and transfer spares from that tier in bulk.
- The antiques list shows the secretary's percentage and the final payout separately. A grant in the 700 tier pays 840 with a +20% secretary bonus.
- Antiques that are harder to find again are slightly more likely to land in a higher grant tier. The market still updates every 30 in-game days.

## 0.12.8, 2026-11-20

- The hiring page now updates the countdown and replaces candidates every seven in-game days. A refresh prioritizes people who were absent from the previous offer.
- Traits provide a second chance at missed sync points. Removed trait-based star penalties and dispatch priorities such as treating patients first. Fixed an error when opening trait articles in the encyclopedia.
- Removed 15 retired items from the game, including both arm implants and the elixir. The exoskeleton supplies strength and opens routes to full stars in the Van Gogh and Su Shi stories.
- Older saves exchange each retired arm for one exoskeleton and refund other retired stock and unclaimed cargo at their original prices. Existing trip results are preserved.

## 0.12.7, 2026-11-20

- Opened Robert Hooke’s story in London. Check a reader’s tracing against Micrographia and help preserve Hooke’s lectures and experimental papers for later editors.

## 0.12.6, 2026-11-20

- Opened George Boole’s story in Cork. Keep his lecture on schedule, flag a sign in an unfinished manuscript and relieve the family at his bedside.

## 0.12.5, 2026-11-20

- Opened Nietzsche’s story in Turin. Help Overbeck find his friend and separate corrected proofs from private letters. The historical echoes come from Nietzsche’s preface and a letter to his publisher.

## 0.12.4, 2026-11-20

- Opened Schumann’s story at Endenich, with three ways to help and two echoes from his published advice to musicians. The recovered score also opens an encyclopedia entry on Clara Schumann.

## 0.12.3, 2026-11-20

- Opened Puccini’s unfinished duet in Brussels in November 1924, with two ways to help and sourced echoes from his score and a contemporary interview.

## 0.12.2, 2026-11-20

- Reach 600 time energy to open the ending and share a dedicated completion card. The ending takes you home to your own future, with the echoes of the past still with you.
- Localized the ending in all seven interface languages and added more translated report labels.
- Added citation metadata for GitHub and future Zenodo archives.

## 0.12.1, 2026-11-19

- The game header, browser tab, share image and copied share text now use The Past Is Yet to Come as the title in every language.
- About and the Simplified Chinese, Traditional Chinese, Japanese and Korean README guides pair the original title with 白露未晞.
- About links to the current source and issue tracker. The email link opens a draft, and the disclaimer points readers to the contact links in the Author section.

## 0.12.0, 2026-11-19

- Auto explores unvisited routes first, then rotates through each employee’s least-tried routes. Automatic and manual trips use the same antique find rules, including after repeated low-star results.
- Auto plans small-story kits for the traveller and dispatch seed, buying unlocked equipment only when it improves the chosen kit. Equipment purchases for one dispatch are capped at half the time energy on hand.
- In small stories, trait bonuses and secretary guarantees respect profession, trait, gender and equipment requirements. The dispatch picker shows employees’ professions alongside their traits.
- Employees can choose a training focus for each attribute point earned from 30 personal-best stars. The game can allocate the point automatically among attributes that can still grow.
- Trip returns no longer close a dropdown while it is in use. Reports and settlement continue in the background.

## 0.11.2, 2026-11-19

- Trip histories on story pages and employee cards can be sorted by most recent or highest stars and browsed page by page. Repeat dispatches stay visible, and returning from a report restores the story page position.
- Share cards use a portrait layout with more room for the historical echo and trip record. The game link and QR code point to www.pastyet.com.
- About explains when historical echoes appear and how the historical material was drafted and reviewed. Life Matters is introduced and linked in the author section. Encyclopedia entries show individual contributor credits where applicable.
- The opening Sun Yat-sen University story and its translations were revised. The encyclopedia lists unlocked entries in language-aware title order and groups locked entries below them.
- Large saves are stored in IndexedDB and can be transferred as compressed exports in supported browsers. Import also accepts earlier JSON exports and warns if the browser cannot keep the imported save.
- Automatic dispatch covers routine trips and restocking. Routes that repeatedly fall short can be retried manually, and spare antiques can be transferred to fund payroll.

## 0.11.1, 2026-11-19

- Travel and rest bars use the same seven-day scale. Longer countdowns stay full until seven days remain, while the label shows the actual time left.
- Share cards have a larger logo and title, plus a short description of the game in all seven interface languages.
- All 57 playable stories now have sourced historical echoes for both full-star and zero-star results. Related historical quotations credit the recorded speaker or author.

## 0.11.0, 2026-11-19

- The game is now The Past Is Yet to Come (白露未晞), with a heart-and-clock logo and rotating literary lines beside the title. The interface supports English, Simplified Chinese, Traditional Chinese, French, Spanish, Japanese and Korean. The title lines include links to their sources where applicable.
- The catalogue now has 57 playable stories. All five goals in the opening Sun Yat-sen University story are ways to help. A missed goal costs that star, and the trip continues. Antiques use the same reward rules as other stories.
- The home page shows who is travelling, resting or on standby. Blue travel and amber rest bars shrink as time passes, and standby is green. The date, pause and automatic dispatch controls sit with funds and time energy.
- Employee records show the total stars earned across stories. Every 30 stars awards an attribute point.
- Reports put the outcome and rewards first and keep the full record one click away. The expanded record scrolls without being redrawn by the game clock. Featured echoes in reports and share cards come from sourced historical speech. Employee dialogue appears in the trip record.
- The encyclopedia has translated tags, clearer source credits and readable source links in dark mode. Entries with AI assistance show a short notice when they have no sources to list.
- Auto mode remembers when you unlock an antique, including one that started locked or was locked by hand. You can transfer it to the research institute on the first attempt.
- Older saves are upgraded on load where possible. About explains what early updates may mean for saves and shows the three latest version entries.

## 0.10.0, 2026-11-18

- Twenty four stories rewritten on the new stars and turned on: Socrates, Euclid, Eratosthenes, Fibonacci, Dante, Copernicus, Adam Smith, Beethoven, Ada Lovelace, Mendel, Mendeleev, Marie Curie, Freud, Cajal, Hammurabi, Murasaki Shikibu, Basho, Tagore, Galois, Abel, Riemann, Emilie du Chatelet, Emmy Noether and Boltzmann, with new encyclopedia entries for the people they name.
- A story may give the employee one remark at the end of the record, chosen by who the employee is, an older woman or a young firebrand, with a sentence for everyone else or none at all.
- The record runs in the order of the calendar: facts with only a year or a month fall where their date puts them, years before the common era read right, no scene is told after an employee is sent back, and the leaving comes after the last day's costs. A mend point can overturn a fact of history, such as a death it prevented, and the record then leaves it out.
- Five stories are retired: Ban Zhao, Song Yingxing, Wang Zhenyi, Zhu Shijie and Qin Jiushao; Hippocrates, Mozart in Prague and Giotto before them.

## 0.9.7, 2026-11-17

- The premise is new: history is drifting. Every trip prises a branch off history, the main timeline loosens, and a key moment goes another way unless someone holds it. The agency does two things: a guard star holds a recorded moment so that history happens as it did, and a mend star mends a regret in the branch the trip made. Both pay time energy; a missed guard star sends the employee home out of sync, a missed mend star costs only the star. The welcome, the home page, the star note and the about page say so.
- A story may be one of three kinds: guarding only, with two stars at least, mending, or both.
- Full models have guard stars too: a guard point names the day of the stay it must hold by, and missing it sends the employee home that day out of sync, with a rest and a small loss of favour. Their reports show how the timeline moved, as small stories do, and their wins reach the record and the IF lines of the encyclopedia.
- The shift card of a report lists the guard points held, 'Held: it happened as it did', beside the moments that moved, and a story of guarding only has a shift card of its own.
- The dispatch card marks a guard star with ◇ and a mend star with ☆.

## 0.9.6, 2026-11-17

- Every employee has catchphrases of their own, drawn from their work and where they come from, and says one on coming back: for every star won, for some, for nothing done, or for coming home hurt. The line opens the report and the share card; a full model keeps the words its card gives for the ending.
- The record of an employee lists what their trips helped bring about, one line to a trip, full models included, with the words said on coming back. The weightiest come first, a redeemed regret, then the share of stars, and five show until the rest are opened. Guard stars that held are no longer counted there.
- A dismissed employee's card still opens from the trip records, with the record and the trips kept.
- The English stamp for a close call reads in full again: 'A close call, still a gain'.
- The secretary is remade: each trait lends one thing, a higher sale price, faster mood growth, shorter rest, one attribute for every traveller (the secretary's own over five, rounded), or a sure star, the earliest missed guard star held or, when no fulfil star was won, the earliest one won if the guard holds until its day. The secretary no longer adds time energy, which the stars fix, and has no preference. Its effect stays in the navigation bar on every page, and a star it made sure says so in the record.
- The rest after a trip grows with the stay: the rest of the outcome, now two to four days for a story, plus half a day for each day away, rounded up.
- The design notes in `docs/README_design.md` describe the catchphrases, the record of an employee, the remade secretary and the rest after a trip.
- Trips to Guangzhou 1924 no longer break the time energy: six modelled places had no energy base, and a missing one is now an error.

## 0.9.5, 2026-11-17

- Twenty one more stories have stars of the new kind, from Ban Zhao and Sima Qian to Scott, Seacole, Nightingale, Wegener and Sophie Germain, waiting to be checked; stories whose year holds nothing that history left unresolved stay at the first step, with a suggested window.

## 0.9.4, 2026-11-17

- The stars of 116 stories are set again by their weight: light stories have one or two, heavy ones four, such as Van Gogh, Vermeer, Kafka, Büchner, Dickinson, Bizet, Modigliani and Miyazawa Kenji, and the stars that only sorted papers give way to what history left unresolved. These stories go back to the step of checking their stars.

## 0.9.3, 2026-11-16

- A story has one to five stars by its weight: one or two for a light story, three for a middling one, four or five for a heavy one. A story of one star has a fulfil point, one of three or more holds at least one recorded event. Time energy and the chance of an antique follow the share of the full stars, with a table for each count.

## 0.9.2, 2026-11-16

- On a narrow screen the lines of the employee have a thin frame again instead of a ground. Sharing is the last button of a report and the one lit; sending again is a plain button.

## 0.9.1, 2026-11-16

- The record is plainer: no frame around the lines of the employee on a wide screen, a light ground on a narrow one where both sides stand right of the axis, and one emphasis only, a won star; the lighter steps and the heavier facts are gone.

## 0.9.0, 2026-11-16

- The record runs around a time axis: the date on the axis, history on the left, the employee on the right in a bubble, a won star with a gold edge and the steps of getting there and away set lighter; the buttons are all, history and the employee again.
- Since 0.8.0: the shift of the timeline sets what history recorded beside what this timeline made of it, person cards keep IF lines for the lives the employees changed, and the record of an employee lists what they changed; test employees King and V in the developer mode; a cleared save or a remembered welcome no longer leaves the founder form dead.
- Many stories of the catalogue have their making marked with build_step, and a good number have new stars drawn from what history left unresolved, waiting to be checked; a new story, David Fleay at Healesville.

## 0.8.3, 2026-11-16

- The record is easier to read: the date stands in a column of its own, and in a story with a planned arrival the lines of the employee are dated on the calendar too; history is in the text face and the employee in a kai face with a dot, no coloured rule; a won star, a turn of the story and the cost of a desync are set heavier, the steps of getting there and away lighter, and the brief view, the default, folds those away without cutting a word.
- The shift of the timeline is a card of its own after the record, what was on a dim ground and this timeline on a bright one.
- A fact with a full date and no day of the stay is placed by its date, so the printing of Darwin and Wallace in August follows the leaving instead of opening the record.

## 0.8.2, 2026-11-16

- Two test employees for the developer mode: King, every attribute at 1 with nothing carried, reads the floor of a story, and V, every attribute at 10 and read as having every job, trait, item and implant, reads its ceiling. They are in the agency only with ?devtools, take no wage, keep their mood, rest no day, are never sent by the automatic mode, and are never written into a save.
- The scene core check reads plain items asked for by a sync point.

## 0.8.1, 2026-11-16

- The shift of the timeline of the twenty one stories with new stars now has what history recorded for every point, the guard points included, each opening with its date, so a trip out of sync shows the event it failed to hold.
- Ahmad Baba in Timbuktu no longer names a number of volumes that no source gives.
- These stories move on to the next step of their making.

## 0.8.0, 2026-11-16

- The shift of the timeline: before the summary, a report sets out what the trip changed, with what history recorded on the left and this timeline on the right, one row for each point that fulfilled something, and one row marked out of sync when a guard point was missed. The record no longer tells the changes as loose lines after the leaving.
- IF lines: a person card keeps its history apart and adds the lives the employees changed, marked as fiction, each shown once a trip has won it. A card can give the life to the person it was changed for.
- The record of an employee lists the stars they won that changed something, once each, opening the report while it is kept, and counts the recorded events they held in place.
- The cards write the shift as was, now, who and bio in place of branch; the twenty one stories with new stars are moved over.

## 0.7.3, 2026-11-16

- The line at the foot of the share card no longer calls the game a simulation: the stories are fiction drawn from history, for entertainment only.

## 0.7.2, 2026-11-16

- The welcome and the founder form open only for a game that has not begun, read from the save and never from the remembered state of the page. A save that had already sent a trip, the founder form locked, could open on that form again and leave nothing to type in or click; it now opens on the game. The automatic mode sends nobody before the game has begun.

## 0.7.1, 2026-11-16

- Clearing the save from the settings starts a new game cleanly: the new save carries an empty log of trips, so the page no longer stops rendering and leaves the founder form dead, and the welcome opens in place of the settings.

## 0.7.0, 2026-11-16

- Two kinds of star, drawn from what history left unresolved. A guard point holds a recorded event against a real threat; when it is missed the trip falls out of sync with history, the traveller is sent back on that day and the points after it are never reached, with three days of rest and a loss of mood. Every other point fulfils something history left undone and a miss costs only its star.
- Each sync point says what its miss cost, read right after it in the record, and a fulfilled point tells what came of it in this branch, apart from the lines of history.
- A sync point may ask for a plain item, such as antibiotics, and an item a point names may be taken on that story.
- Twenty one of the stories that are on have new stars: Van Gogh is helped to finish the wheatfield under the storm and healed, Keats is spared the starvation diet, Wallace's hunter Jumaat is saved, and so on. An event card marks where its story stands in the making with build_step.

## 0.6.0, 2026-11-16

- The trips are meant to be hard. The game grew out of Life Matters to let the traveller live through the hardship of the past, and the About page now says so; the design document has a section on pressure and the body.
- Since 0.5.0: thirty stories rewritten from checked sources and turned on, across every part of the world; the record of a small story told on the days of the stay; pressure kept as the history has it, eased by constitution and will, by Wanderer and by items and gear, and named on the story card, the desk and the report of someone sent home.

## 0.5.34, 2026-11-16

- The attributes are the general defence against pressure: each channel is felt more or less by the constitution, grief and hostility by the will, in config body.resist; Wanderer and the kit still take whole levels off. The threshold of being sent home reads its numbers from config body.resilience.
- The release step, the story probe and the pressure probe are kept as tools and listed in the README; the benchmark check counts someone sent home as not taken in.

## 0.5.33, 2026-11-16

- Pressure is the difficulty: the channels lowered on Keats, Wallace, Tupaia, Rapa Nui, Great Zimbabwe, Machu Picchu and Lalibela are back at their levels, since fitting items, gear and traits take them off.
- The story card names the pressure of the place and how hard it presses, the desk shows what is left of it for the employee and kit chosen, and a report of someone sent home names what wore them down, each with one line on how to ease it.

## 0.5.32, 2026-11-16

- Lyme Regis 1823, Mary Anning, is rewritten and turned on for two office days from 15 November: the ichthyosaur she dug out at thirteen, the first complete plesiosaur in December 1823, the first English pterosaur of 1828 and her death in 1847, still short of money, with sync points for going under the cliffs at low tide, telling bone from crack and saying who dug the plesiosaur out.

## 0.5.31, 2026-11-16

- Texcoco 1472, Nezahualcoyotl, is rewritten and turned on: lord of Texcoco from 1431, his death in 1472 and the songs written down under his name in the late sixteenth century, with sync points for keeping time on the drum, keeping the practice sheets in order and helping a learner tell the voice in a song from the name beside it.

## 0.5.30, 2026-11-15

- Tangier 1325, Ibn Battuta, is rewritten and turned on for one office day from 1 June: his leaving Tangier on 14 June 1325, alone, with neither companion nor caravan, and his coming home some thirty years later to dictate his travels, with sync points for getting the food and water skins ready, writing down the towns of the first stage and walking with him to the gate.

## 0.5.29, 2026-11-15

- Auvers 1890, Vincent van Gogh, is rewritten and turned on for three office days from 20 May: the room at the Auberge Ravoux, almost a picture a day, the letter of the wheatfields under troubled skies, the shot of 27 July and his death on 29 July with Theo beside him, with sync points for carrying his easel out, holding the canvas in the wind and sitting outside the door in the last two days.

## 0.5.28, 2026-11-15

- Madras 1913, Srinivasa Ramanujan, is rewritten and turned on: the clerk's post at the Port Trust from March 1912, the letter to Hardy of Thursday 16 January 1913, England in 1914 and his death in 1920, with sync points for copying the accounts, putting his pages of formulas in order and cooking for him through the weeks of work.

## 0.5.27, 2026-11-15

- Tupaia keeps one Chinese spelling of his name throughout.

## 0.5.26, 2026-11-15

- Tahiti 1769, Tupaia, is turned on as a scene: going aboard the Endeavour on 12 July 1769, sailing the next day, the chart of some 130 islands begun on 15 August, 74 named by him, and his death at Batavia late in 1770, with sync points for rolling the water casks to the boats, the wind and bearing on the day of sailing and writing down the island names. Its full model is still a draft.

## 0.5.25, 2026-11-15

- Ife, the casters of the heads, is rewritten and turned on: heads cast in brass from wax models around 1300, Leo Frobenius made to give back the head he pressed a priest to sell in 1910, the heads found in the Wunmonije compound in 1938 and the London exhibition of 1948, with sync points for shaping a wax model, keeping the fire on the day of pouring and telling the cut lines from the added ones.

## 0.5.24, 2026-11-15

- Rapa Nui, the carvers of the moai, is rewritten and turned on: the figures cut from the tuff of Rano Raraku from about the thirteenth century, and Jacob Roggeveen reaching the island on Easter Sunday 1722, with sync points for grinding the adzes, drawing a figure from front and side and cutting the tuff behind it.

## 0.5.23, 2026-11-15

- Cherokee country 1821, Sequoyah, is rewritten and turned on: the syllabary shown at the Cherokee National Council and accepted, the first Cherokee Phoenix on 21 February 1828 and his death in Mexico in 1843, with sync points for keeping his sheets of signs in order, teaching a neighbour to write her name and carrying a slip across the council ground.

## 0.5.22, 2026-11-15

- Machu Picchu is rewritten and turned on: the estate of Pachacuti built around 1450, its canal and sixteen stone basins, its abandonment about a century later, the farmer Melchor Arteaga leading Hiram Bingham up on 24 July 1911 and the World Heritage listing of 1983, with sync points for carrying stone up the terraces, following the water down the basins and keeping the channel clear in the rains.

## 0.5.21, 2026-11-15

- Great Zimbabwe is rewritten and turned on: the stone city built over three centuries by ancestors of the Shona, the Great Enclosure and its passage, Karl Mauch at the ruins in 1871, the country named for the city in 1980 and the World Heritage listing of 1986, with sync points for sorting stones for the next course, drawing the passage with the way left blank and carrying water up the hill.

## 0.5.20, 2026-11-15

- Lalibela, the rock hewn churches, is rewritten and turned on: the reign of King Lalibela from 1181 to 1221, the ditches and trenches cut into the same rock, the first detailed European description by Francisco Álvares in the 1520s and the World Heritage listing of 1978, with sync points for carrying the broken rock out of the trench, finding the outlet of a channel before the rains and clearing a ditch in the rains. The exposure to the land is lowered from three to two.

## 0.5.19, 2026-11-15

- Nishapur 1079, Omar Khayyam, is rewritten and turned on: the observatory of Malik-Shah at Isfahan, the new calendar beginning on 15 March 1079 with the year set by the spring equinox, the closing of the observatory in 1092 and the calendar that outlived it by eight centuries, with sync points for copying the new month table, watching the sunrise around the equinox and a farmer persuaded to the new calendar.

## 0.5.18, 2026-11-15

- Ezo 1800, Ino Tadataka, is rewritten and turned on: the party of five setting out from Edo on 11 June 1800, the survey of the southeastern coast, his death in 1818 kept quiet for the sake of the work, and the maps finished in 1821, with sync points for carrying the line, writing down paces and bearings and walking a whole stretch of coast in the autumn wind.

## 0.5.17, 2026-11-15

- St Petersburg 1837, Alexander Pushkin, is rewritten and turned on, on both calendars: his letter giving the house by the bridge, the duel by the Black River on 27 January old style, 8 February new style, his death on 29 January, 10 February, and his burial at the Svyatogorsky Monastery, with sync points for the errands of the house, waiting by the Black River and keeping the hall.

## 0.5.16, 2026-11-15

- Ternate 1858, Alfred Russel Wallace, is rewritten and turned on: the fever and the essay of February 1858, the mail steamer whose month is still argued over, the essay reaching Darwin on 18 June, the reading at the Linnean Society on 1 July with neither author there, and the printing on 20 August, with sync points for pinning the specimens, nursing the fever and seeing the essay aboard. The exposure to infection and heat is lowered from three to two.

## 0.5.15, 2026-11-15

- Samarkand 1428, Ulugh Beg, is rewritten and turned on: the building of the observatory and its great arc, the catalogue of 1018 stars, his death on 27 October 1449 and the finding of the arc again in 1908, with sync points for carrying bricks for the arc, keeping old and new positions on separate rows and watching a winter night by the arc.

## 0.5.14, 2026-11-15

- Hanseong 1443, King Sejong and the new letters, is rewritten and turned on: the twenty eight letters finished at the end of 1443, the memorial of Choe Manri and his colleagues in the second month of 1444, the promulgation of 1446 and the death of Sejong in 1450, with sync points for the ink and paper of the Hall of Worthies, a stallholder spelling her name and a fair copy kept safe.

## 0.5.13, 2026-11-15

- Stanwell Park 1894, Lawrence Hargrave, is rewritten and turned on: the box kite of 1893, the lift on the beach on 12 November 1894, the photograph and his death in 1915, with sync points for stretching the cloth of the kites, calling the height at the winch and holding the line of the fourth kite.
- The faces at home in Pune include India.

## 0.5.12, 2026-11-15

- Cairo 1406, Ibn Khaldun, is rewritten and turned on: his coming to Cairo in 1382, the judgeship and the shipwreck of 1384, the meeting with Timur outside Damascus in 1401, and his death on 17 March 1406 and burial outside the Bab al-Nasr, with sync points for copying the judgements, asking how long the gate was open and walking with the bier.

## 0.5.11, 2026-11-15

- A scene of Sor Juana names the employee once, as in English.

## 0.5.10, 2026-11-15

- Mexico City 1695, Sor Juana Inés de la Cruz, is rewritten and turned on: the letter printed without her leave in 1690, her reply of 1 March 1691, the books sold in 1693, the vows of 1694, her death on 17 April 1695 after nursing her sisters, and the reply printed in 1700, with sync points in the convent kitchen, a sheet kept from the empty shelf and a sick sister watched over.

## 0.5.9, 2026-11-15

- Timbuktu 1594, Ahmad Baba, is rewritten and turned on: the fall of the city in 1591, his deportation to Marrakesh in 1594, his return in 1608 and his death in 1627, with sync points for listing his books, giving some into the keeping of a family in the town and writing down the day he was taken away.

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
