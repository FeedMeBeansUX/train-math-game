# Treinspel / Train Game — plan

An educational train game for a 5-year-old (reading short Dutch sentences,
addition and subtraction up to 20, later multiplication and division).
The player builds railway track between stations already laid out on a tiled
map, then loads trains with the right amount of goods and sends them along
the network.

## Decisions so far

| Topic | Decision |
|---|---|
| Platform | Browser, plain HTML/CSS/JavaScript, no build step. Runs from GitHub Pages (deployed by GitHub Actions on every push to `main`) **and** by double-clicking `index.html` after downloading the repo (so: classic `<script>` tags, no ES modules or `fetch` of local files). |
| Input | PC with mouse and keyboard. |
| Language | Dutch first; English UI option later. **Names of stations, goods and pieces are always shown in Dutch and English** so he picks up English words. |
| Reading | He reads short words/sentences himself (no text-to-speech needed). Sentences like "Breng 6 kippen naar de boerderij." |
| Track building | **Puzzle**: a limited set of pieces (straight, curve, junction, bridge, later switches), place and rotate. Difficulty adapts to how previous rounds went. |
| Junctions | For now the train may take any way through a junction (auto routing). Real switches come in phase 9. |
| Water | Obstacle, crossed with a separate **bridge** piece that only goes on water. |
| Routing | The train finds its own way at first. Later: player-controlled switches and "deliver in the right order" puzzles. |
| Trips | Multi-stop trips: load once at the start, drop off at several stations (addition), see what is left (subtraction). Wrong amounts are allowed: feedback on delivery, go back to fetch more or end with leftovers. |
| Maths | Addition and subtraction up to 20, configurable/adaptive. Multiplication at higher levels ("20 passengers, 5 seats per carriage: how many carriages?"), division later. |
| Themes | Rotating level themes with their own stations and goods: farm, construction, racing, garage/mechanic, town… |
| Art | Pixel art, leaning realistic rather than childish, **32×32 px tiles**, generated in code for now (can be swapped for PNGs later). **Top-down** view for the track puzzle, **side view** for loading and travelling (with a top-down mini-map of the route). |
| Font | Andika (designed for beginning readers), bundled under `assets/fonts` so it works offline. |

## Phases

Each phase ends with something playable in the browser.

### Phase 0 — Setup ✅
- Repository layout, `index.html`, vanilla JS split in `core` (pure logic, testable in Node),
  `gfx` (rendering), `ui` (DOM), `data` (levels, themes, texts).
- Node test runner (`node tests/run-tests.js`) for the pure logic.

### Phase 1 — Top-down map ✅
- Tile grid (32×32 px tiles, integer-scaled to the window), terrain: grass, flowers, water with shores, trees, rocks.
- Pixel art generated in code: ground painted for the whole map (no repeating tiles), procedural trees,
  rocks, buildings and track. Designed so sprites can later be swapped for PNG files without touching game logic.
- Stations with a building, platform and bilingual name label.

### Phase 2 — Track puzzle ✅
- Pieces: straight, curve, junction (T), bridge (water only); stations are fixed end/through pieces.
- Inventory panel; select with mouse or keys `1`–`4`, rotate with `R` / mouse wheel, place with left click,
  click a placed piece to rotate it, right click to take it back.
- Network analysis on a port graph (each tile edge is a node) so curves really only connect their two ends.
- Live feedback: open ends pulse (yellow = continue here, red = blocked), stations get a ✓ once connected
  to the start station, unconnected pieces are dimmed. Completion when every station is reachable.
- 6 hand-made farm levels (one with a river), each with a stored solution that the tests verify.
- GitHub Actions workflow: runs the tests, deploys `main` to GitHub Pages.

### Phase 3 — Driving ✅
- Shortest-path routing over the port graph between any two stations (`js/core/route.js`), with smooth
  geometry through straights and curves; tests check every route on every level for jumps.
- After solving a puzzle: **Ga rijden!** opens the **side-view** screen. Pick a station, the whistle blows
  and the train accelerates, cruises and brakes into the destination station.
- Side view: steam locomotive with turning spoked wheels, coupling rods and steam, three wagons;
  parallax landscape (sky, clouds, far and near hills with fields and windmills, trees, fences, hay bales,
  telegraph poles); a girder bridge over a river wherever the route crosses a bridge piece.
- Station buildings in side view (warehouse, barn, bakery, windmill with turning sails, market stalls,
  generic buildings for the other themes) with a platform and a bilingual name board.
- Mini-map of the built track with the route and the train's position; sentences such as
  "De trein rijdt naar de Boerderij." (Dutch articles stored per station).
- The top-down departure animation from the original plan was dropped: the mini-map shows the train on the
  player's own track instead.

### Phase 4 — Loading and delivering (first complete game loop) ✅
- Each round every station (except the warehouse) orders goods that fit it: farm (chickens, hay bales),
  bakery (flour, eggs, milk), mill (grain), market (apples, cheeses, loaves). Amount ranges per level.
- Orders board in the side view: "Breng 6 kippen naar de Boerderij." with the English sentence below,
  progress ("3 / 6") and a ✓ when done.
- Loading at the warehouse: click the crates on the platform (or the + buttons) and the goods fly into the
  wagons; click goods in the train (or −) to put them back. Each wagon is a **ten frame** (2 rows of 5,
  capacity 10). The panel shows each count as a numeral and as dots in groups of five.
- On arrival the station takes what it ordered (goods fly onto the platform and stay there as a pile) and
  says what happened, in both languages: delivered / still missing ("Er missen nog 2 kippen.") / left in
  the train, plus a hint to drive back to the warehouse for more.
- Round summary with 1–3 stars: a star less for each extra trip from the warehouse and for leftovers.
  "Nog een ronde" gives new orders on the same track.
- Not done yet: a test session with the player. Unloading is automatic for now; unloading by hand
  (subtraction practice) could become a harder setting in phase 6.

### Phase 5 — Maths engine ✅
- `js/core/maths.js` plans each round around **one skill**, so the sentences stay simple:
  - **Counting**: every station wants a number of goods (up to 10).
  - **Addition**: two or three stations want *parcels* (every station accepts parcels); load the total in one
    go ("Hoeveel pakketten moeten er in de trein?"). On one-station levels: **top up** instead — the train
    already holds some goods ("Er zitten al 3 kippen in de trein") and the station wants 8.
  - **Subtraction**: the train already holds more than the station wants; take the extra out at the warehouse.
  - **Multiplication**: passengers. "In elke wagon passen 5 passagiers. Hoeveel wagons heb je nodig?" The
    player chooses the number of carriages (2-, 5- or 10-seaters, the last a Dutch double-decker); passengers
    board when the train leaves. Too few carriages: people stay behind (extra trip). Too many: empty seats
    (a star less). Seats are shown as groups of dots, one group per carriage.
- The same kind is not chosen twice in a row; all numbers stay within the chosen maximum (and the train's
  capacity of 30 goods).
- Counts in the panel are shown as ten frames (blocks of ten in rows of five), like the wagons.
- **Parent settings** (⚙ in the top bar): largest number (10 / 20 / 50 / 100) and which skills are on.
  Default: up to 20, counting + addition + subtraction. Saved in the browser.
- Division (sharing evenly over stations) needed unloading by hand: done in phase 6.

### Phase 6 — Adaptive difficulty and progress ✅
- `js/core/progress.js`: every skill (counting, addition, subtraction, multiplication, division, puzzles) has a
  level 1–8. Staircase: two 3-star results in a row → level up; a 1-star result → level down. Each level has
  a number range (e.g. addition: 5, 7, 10, 12, 15, 20, 25, 30), always capped by the parent's maximum.
  Multiplication levels add carriage sizes (2 → 5 → 10) and more carriages; division levels more stations and
  bigger shares. A "Knap! Je gaat een niveau omhoog." line celebrates a level up.
- **Puzzle generator** (`js/core/generator.js`): after the six hand-made puzzles, "Nieuwe puzzel" makes a new
  puzzle for the player's puzzle level: more stations (2 → 4, with junctions), longer routes, obstacles,
  rivers that need bridges, spare pieces. Every puzzle is checked with the game rules before it is shown.
  Puzzles now earn stars too (pieces taken back cost stars) and move the puzzle level.
- **Unloading by hand** (parent setting, always on for division): at a station the player chooses how many
  goods come off; "Dat zijn er te veel / te weinig" until it is right (mistakes cost a star).
- **Division**: "Verdeel 12 pakketten eerlijk over 3 stations." The order lines show no numbers; every station
  must get the same amount ("Elk station krijgt evenveel.").
- Total stars in the top bar. Parent settings: adaptive on/off, unloading by hand, division, and a progress
  overview (level and recent results per skill, totals) with a reset button. All saved in the browser.

### Phase 7 — Themes and progression ✅
- Four themes, four stations each, with their own goods, top-down ground and obstacles, side-view landscape
  and near objects:
  - **Boerderij / Farm**: farm, bakery, mill, market — fields, windmills, hay bales.
  - **Bouwen / Construction** (12 ★): building site (tower crane, scaffolding), quarry, sawmill, road works —
    dry ground with bare earth, sand heaps, concrete blocks, cones and barriers; bricks, planks, cement,
    helmets, wheelbarrows, logs, stones, traffic cones.
  - **Racen / Racing** (30 ★): garage, race track (grandstand full of spectators), fuel station (canopy and
    pumps), car wash — mown stripes, tyre stacks, kerbs, billboards, chequered flags; tyres, oil, flags,
    soap, sponges.
  - **Stad / Town** (50 ★): school (bell tower), post office, shop, toy shop — houses, a row of Dutch gabled
    houses and church towers, lamp posts, bicycles, benches; books, pencils, letters, bananas, milk, bread,
    balls, teddy bears.
- Themes unlock with the total number of stars; a "Nieuw thema!" dialog offers to play the new theme
  straight away. The puzzle menu has a "Nieuwe puzzel" entry per theme; locked ones show the stars still
  needed. Hand-made puzzles stay on the farm.
- Generic station buildings show a sign with the station's main good, so every station is recognisable.

### Phase 8 — Art and sound ✅
- **Sound effects** synthesised with the Web Audio API (`js/audio/sound.js`; no audio files, works offline):
  laying, rotating and removing track, a ding when a station connects, a steam whistle on departure,
  chuffing that follows the speed, a steam hiss on arrival, pops when loading, unloading and passengers
  boarding, a delivery chime, a gentle "uh-oh" for mistakes, a ding per star, fanfares for a solved
  puzzle, a level-up and a new theme. Mute button (🔊) in the top bar, saved in the browser.
- **Celebrations**: after solving a puzzle a little train drives a victory lap over the new track to every
  station (click to skip); stars pop in one by one; confetti after a finished round.
- **Art**: four colour styles as a parent setting (natural, bright, warm, muted — CSS filters on the pixel
  art, with live preview); a cleaner junction piece (sleepers only under the main line); wagons sway a
  little while driving; top-down locomotive and wagon sprites for the victory lap.

### Phase 9 — Switches and ordering puzzles ✅
- **Switches** (parent setting "Wissels zelf zetten"): junctions become switches. Instead of choosing a
  station, the player clicks the switch tiles (each with its own colour, matching a frame on the mini-map)
  and sees where the train will go: the predicted path in yellow on the mini-map and "De trein gaat naar
  de Boerderij." Then **Vertrek!** — the train follows the track as the switches are set. When a switch
  points the other way: "Een wissel staat verkeerd." (`TG.route.followTrack`).
- **Orders in a fixed order** (parent setting): orders are numbered and the next one is highlighted; a
  station that is not next says "Eerst naar de Molen!" and keeps its goods in the train (a star less).
- Default colour style: warm.

### Later / optional
- Level editor, extra train types (passengers, freight).

## Open questions
- None at the moment. Art style will be revisited in phase 8 (tile size can still change).
