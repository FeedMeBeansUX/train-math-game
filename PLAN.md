# Treinspel / Train Game — plan

An educational train game for a 5-year-old (reading short Dutch sentences,
addition and subtraction up to 20, later multiplication and division).
The player builds railway track between stations already laid out on a tiled
map, then loads trains with the right amount of goods and sends them along
the network.

## Decisions so far

| Topic | Decision |
|---|---|
| Platform | Browser, plain HTML/CSS/JavaScript, no build step. Runs from GitHub Pages **and** by double-clicking `index.html` after downloading the repo (so: classic `<script>` tags, no ES modules or `fetch` of local files). |
| Input | PC with mouse and keyboard. |
| Language | Dutch first; English UI option later. **Names of stations, goods and pieces are always shown in Dutch and English** so he picks up English words. |
| Reading | He reads short words/sentences himself (no text-to-speech needed). Sentences like "Breng 6 kippen naar de boerderij." |
| Track building | **Puzzle**: a limited set of pieces (straight, curve, junction, later switches/bridges), place and rotate. Difficulty adapts to how previous rounds went. |
| Routing | The train finds its own way at first. Later: player-controlled switches and "deliver in the right order" puzzles. |
| Trips | Multi-stop trips: load once at the start, drop off at several stations (addition), see what is left (subtraction). Wrong amounts are allowed: feedback on delivery, go back to fetch more or end with leftovers. |
| Maths | Addition and subtraction up to 20, configurable/adaptive. Multiplication at higher levels ("20 passengers, 5 seats per carriage: how many carriages?"), division later. |
| Themes | Rotating level themes with their own stations and goods: farm, construction, racing, garage/mechanic, town… |
| Art | Pixel art, leaning realistic rather than childish. **Top-down** view for the track puzzle, **side view** for loading and travelling (with a top-down mini-map of the route). Style is still being explored. |
| Font | Andika (designed for beginning readers), bundled under `assets/fonts` so it works offline. |

## Phases

Each phase ends with something playable in the browser.

### Phase 0 — Setup ✅
- Repository layout, `index.html`, vanilla JS split in `core` (pure logic, testable in Node),
  `gfx` (rendering), `ui` (DOM), `data` (levels, themes, texts).
- Node test runner (`node tests/run-tests.js`) for the pure logic.

### Phase 1 — Top-down map ✅
- Tile grid (16×16 px tiles, integer-scaled to the window), terrain: grass, flowers, water, trees, rocks.
- Pixel art generated in code (procedural tiles + small hand-drawn sprites). Designed so sprites can later
  be swapped for PNG files without touching game logic.
- Stations with a building, platform and bilingual name label.

### Phase 2 — Track puzzle ✅
- Pieces: straight, curve, junction (T); stations are fixed end/through pieces.
- Inventory panel; select with mouse or keys `1`–`3`, rotate with `R` / mouse wheel, place with left click,
  click a placed piece to rotate it, right click to take it back.
- Network analysis on a port graph (each tile edge is a node) so curves really only connect their two ends.
- Live feedback: open ends pulse (yellow = continue here, red = blocked), stations get a ✓ once connected
  to the start station, unconnected pieces are dimmed. Completion when every station is reachable.
- 5 hand-made farm levels, each with a stored solution that the tests verify.

### Phase 3 — Driving
- Shortest-path routing over the port graph from the start station to a chosen station (and onward).
- Short top-down animation leaving the station, then the **side-view travel scene**: parallax landscape in
  the level's theme, train with the selected number of carriages, mini-map showing the train's position.

### Phase 4 — Loading and delivering (first complete game loop)
- Order list written as short Dutch sentences, names bilingual: "Breng 6 kippen naar de Boerderij (Farm)."
- Side-view station: goods on the platform, click to load them into carriages, counter shows numeral + dots.
- Multi-stop trip: choose the next station, unload there, see what is left.
- Feedback: too few → "Er missen 2 kippen"; too many → leftovers stay in the train; option to return to
  the start to fetch more. Round summary at the end.
- **Test session with the player** before going further.

### Phase 5 — Maths engine
- Order generator per skill: counting, addition and subtraction up to N (N configurable, default 20).
- Questions built into the gameplay rather than shown as sums: total to load = sum of the drop-offs; what is
  left after each stop = subtraction.
- Multiplication: carriages have a fixed capacity; work out how many carriages are needed. Division later
  (share goods evenly over stations).

### Phase 6 — Adaptive difficulty and progress
- Keep track of results per skill (puzzle, addition, subtraction, multiplication) and adjust the next round:
  number range, number of stations/goods, puzzle size, spare pieces.
- **Puzzle generator** (needed so puzzles can adapt): place stations, build a valid route with obstacles,
  derive the piece inventory from it, check it can be solved.
- Saved in the browser (`localStorage`), with a small parents' screen (number range, skills, reset).

### Phase 7 — Themes and progression
- Themes: farm, construction, racing, garage, town. Each has its own stations, goods, colours and side-view
  background. A new theme unlocks after a few rounds.

### Phase 8 — Art and sound
- Try out art styles (palette, tile size, amount of detail) side by side and pick one, then go over all sprites.
- Sound effects (whistle, loading, success), animations, celebrations.

### Phase 9 — Switches and ordering puzzles
- Switch pieces the player sets before departure; deliveries that must happen in a set order.

### Later / optional
- English UI option, bridges over water, level editor, extra train types (passengers, freight).

## Open questions
- Where the art comes from: generated in code (current approach), a free pixel-art pack (CC0), or drawn
  by us. See the README / discussion.
