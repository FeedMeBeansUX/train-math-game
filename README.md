# Treinspel / Train Game

An educational train game for young children (around age 5): build railway
track between stations, then deliver goods, practising reading and arithmetic
along the way. Dutch first, with all names also shown in English.

See [PLAN.md](PLAN.md) for the phased plan and design decisions.

**Current state:** phases 0–2. The track puzzle is playable: 6 farm levels.

## Playing

- **Online:** GitHub Pages. Every push to `main` runs the tests and deploys the site
  (`.github/workflows/pages.yml`; Settings → Pages → Source: GitHub Actions).
- **Locally:** download or clone the repository and double-click `index.html`.
  No installation or internet connection needed.
  (Alternatively serve the folder, e.g. `python3 -m http.server`, and open http://localhost:8000.)

### Controls

| Action | Mouse / keyboard |
|---|---|
| Pick a piece | click it in the panel, or keys `1` `2` `3` `4` |
| Rotate the piece in hand | `R` (`Shift+R` back) or mouse wheel |
| Lay track | left click on grass |
| Rotate laid track | left click on it |
| Take track back | right click (or `Delete` while hovering) |
| Put the piece down | `Esc` |

Bridges can only be placed on water; the other pieces only on land.
Yellow blinking dots show where the track can continue; red dots show ends
that are blocked or don't fit. Stations get a ✓ once they are connected to the
start station.

## Development

Plain HTML/CSS/JavaScript with no build step and no dependencies. Scripts are
classic `<script>` tags (not ES modules) so the game works when opened from
the file system.

```
index.html          page shell, loads the scripts in order
css/style.css       layout and UI styling
js/core/            pure game logic (no DOM): track pieces, level state, network analysis
js/data/            texts (nl/en), themes and station kinds, levels
js/gfx/             pixel-art sprites (generated in code) and the top-down renderer
js/ui/              screens and input handling
js/main.js          start-up
tests/run-tests.js  tests for js/core and the level data
assets/fonts/       Andika font (SIL Open Font License), designed for beginning readers
```

Run the tests (Node 18+):

```bash
node tests/run-tests.js
```

The tests also check that every level's stored solution actually solves it,
so add a `solution` when adding a level.

### Adding a level

Add an entry to `js/data/levels.js`: a map of characters
(`.` grass, `f` flowers, `~` water, `T` tree, `R` rock), the stations
(the first one is the start), the available pieces and a solution.

## Credits

- Font: [Andika](https://software.sil.org/andika/) by SIL International, SIL Open Font License 1.1.
