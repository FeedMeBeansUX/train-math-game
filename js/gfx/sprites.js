/*
 * Pixel-art sprites, generated in code at start-up.
 *
 * Art is drawn at 32x32 px per tile and scaled up by the renderer without
 * smoothing. Ground (grass, water, shores) is painted for the whole map at
 * once using world coordinates, so there are no repeating tile patterns.
 * Objects (trees, rocks, buildings, track) are separate sprites.
 * The rest of the game only asks for sprites by name, so these can later be
 * replaced with PNG files without touching the game logic.
 */
(function (TG) {
  'use strict';

  const TILE = 32;
  const H = TILE / 2;
  const { hash2, valueNoise } = TG.util;

  // ================================================================ helpers

  const colorCache = new Map();
  function parseColor(c) {
    let v = colorCache.get(c);
    if (v) return v;
    if (c[0] === '#') {
      const n = c.length === 9 ? c.slice(1) : c.slice(1) + 'ff';
      v = [0, 2, 4, 6].map(i => parseInt(n.slice(i, i + 2), 16));
    } else {
      const p = c.match(/rgba?\(([^)]+)\)/)[1].split(',').map(Number);
      v = [p[0], p[1], p[2], p.length > 3 ? Math.round(p[3] * 255) : 255];
    }
    colorCache.set(c, v);
    return v;
  }

  function createCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  /**
   * Make a sprite by calling paint(set, w, h). set(x, y, color) draws a pixel;
   * colours with alpha are blended over what is already there. set also has
   * helpers: set.rect(x0, y0, x1, y1, c) (inclusive), set.ellipse(cx, cy, rx, ry, c).
   */
  function makeSprite(w, h, paint) {
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(w, h);
    const d = img.data;
    function set(x, y, color) {
      if (color == null || x < 0 || y < 0 || x >= w || y >= h) return;
      const [r, g, b, a] = parseColor(color);
      const i = (y * w + x) * 4;
      if (a === 255 || d[i + 3] === 0) {
        d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = a;
      } else {
        const t = a / 255;
        d[i] = Math.round(d[i] * (1 - t) + r * t);
        d[i + 1] = Math.round(d[i + 1] * (1 - t) + g * t);
        d[i + 2] = Math.round(d[i + 2] * (1 - t) + b * t);
        d[i + 3] = Math.max(d[i + 3], a);
      }
    }
    set.rect = (x0, y0, x1, y1, c) => {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c);
    };
    set.ellipse = (cx, cy, rx, ry, c) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry;
          if (dx * dx + dy * dy <= 1) set(x, y, c);
        }
      }
    };
    paint(set, w, h);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  function pick(colors, n) {
    return colors[Math.min(colors.length - 1, Math.max(0, Math.floor(n * colors.length)))];
  }

  /** Map a value in [0, 1] to one of the colours, darkest first. */
  function shade(colors, v) {
    return pick(colors, v);
  }

  // ================================================================ palette

  const C = {
    grass: ['#3d6327', '#486f2e', '#547c37', '#61893f', '#72994c'],
    flowers: ['#e8d35a', '#f0ece0', '#d98aa0', '#a9c0e8', '#e39a4f'],
    water: ['#2c5a8c', '#33659a', '#3b6ea5', '#4579b0'],
    waterShallow: '#4f86bb', waterHighlight: '#86b2da', foam: '#b4d0e8',
    sand: '#c4b486', sandWet: '#a29469',
    ballast: ['#7a776f', '#86827a', '#908c83', '#9b978d', '#aeaa9f'], ballastEdge: '#66635c',
    sleeper: ['#3d2a1b', '#4a3423', '#56402c'], sleeperEnd: '#2e2014', sleeperTop: '#6b5038',
    railTop: '#d5d9de', railSide: '#666a72', railBase: '#3f4247',
    platform: ['#a59d8d', '#ada595'], platformJoint: '#8f8778', platformKerb: '#e3dccd',
    platformLine: '#d4b84a', platformFar: '#857d6f',
    plank: ['#7a5a3a', '#86653f', '#916f47'], plankGap: '#3a2a1c',
    girder: '#4a4d53', girderLight: '#7b8089', girderDark: '#2f3135',
    bufferRed: '#b03a2e', bufferWhite: '#ebe3d1', bufferDark: '#34312d',
    shadow: 'rgba(0,0,0,0.28)', shadowSoft: 'rgba(0,0,0,0.18)',
  };

  // ================================================================ terrain (whole map)

  /**
   * Paint the ground of a whole level: grass, flowers, water with shores.
   * Themes change the ground: construction has dry grass with patches of bare earth,
   * racing has mown stripes.
   */
  function terrain(state) {
    const L = TG.level;
    const theme = (state.def && state.def.theme) || 'farm';
    const ch = (tx, ty) => (L.inBounds(state, tx, ty) ? L.terrainAt(state, tx, ty) : '~');
    const isWater = (tx, ty) => ch(tx, ty) === '~';
    const W = state.w * TILE, Hh = state.h * TILE;

    // Roads and race tracks continue off the map edge; fields and meadows end at it
    const same = c => (tx, ty) => !L.inBounds(state, tx, ty) || L.terrainAt(state, tx, ty) === c;
    const inside = c => (tx, ty) => L.inBounds(state, tx, ty) && L.terrainAt(state, tx, ty) === c;
    const fieldOf = components(state, 'C');

    return makeSprite(W, Hh, set => {
      for (let ty = 0; ty < state.h; ty++) {
        for (let tx = 0; tx < state.w; tx++) {
          const c = ch(tx, ty);
          if (c === '~') paintWaterTile(set, tx, ty, isWater);
          else if (c === '=') paintRoad(set, tx, ty, same('='));
          else if (c === '#') paintRaceTrack(set, tx, ty, same('#'));
          else if (c === 'C') paintCrops(set, tx, ty, CROPS[fieldOf.get(ty * state.w + tx) % CROPS.length]);
          else paintGrassTile(set, tx, ty, theme, c === 'A' ? 0.12 : 0);
        }
      }
      // Details on top of the ground
      for (let ty = 0; ty < state.h; ty++) {
        for (let tx = 0; tx < state.w; tx++) {
          const c = ch(tx, ty);
          if (c === '~' || c === '=' || c === '#' || c === 'C') continue;
          paintGrassBlades(set, tx, ty, theme);
          if (c === 'A') paintFence(set, tx, ty, inside('A'));
          if (ch(tx, ty) === 'f') {
            if (theme === 'construction') paintPebbles(set, tx, ty);
            else paintFlowers(set, tx, ty);
          }
        }
      }
    });
  }

  const GRASS_DRY = ['#4d5e2a', '#596a30', '#657636', '#71813d', '#829048'];
  const DIRT = ['#6e5f44', '#7a6a4c', '#867556', '#93825f'];

  /** Construction sites have patches of bare earth. */
  function isDirt(X, Y) {
    const d = valueNoise(X / 22, Y / 22, 55) + (hash2(X, Y, 56) - 0.5) * 0.06;
    return d > 0.6;
  }

  function grassColor(X, Y, theme, lift) {
    const big = valueNoise(X / 28, Y / 28, 11);
    const clump = valueNoise(X / 7, Y / 7, 12);
    let v = big * 0.5 + clump * 0.4 + hash2(X, Y, 13) * 0.28 - 0.08 + (lift || 0);
    if (theme === 'construction') {
      if (isDirt(X, Y)) return shade(DIRT, clump * 0.6 + hash2(X, Y, 57) * 0.4);
      return shade(GRASS_DRY, v);
    }
    if (theme === 'racing') v += Math.floor(X / 16) % 2 ? 0.1 : -0.06; // mown stripes
    return shade(C.grass, v);
  }

  function paintGrassTile(set, tx, ty, theme, lift) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const X = tx * TILE + x, Y = ty * TILE + y;
        set(X, Y, grassColor(X, Y, theme, lift));
      }
    }
  }

  /** Connected areas of one map character (so a whole field gets one crop). Map: tile index -> area number. */
  function components(state, c) {
    const out = new Map();
    let n = 0;
    for (let i = 0; i < state.w * state.h; i++) {
      if (state.terrain[i] !== c || out.has(i)) continue;
      const stack = [i];
      out.set(i, n);
      while (stack.length) {
        const k = stack.pop();
        const x = k % state.w, y = Math.floor(k / state.w);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy, nk = ny * state.w + nx;
          if (nx < 0 || ny < 0 || nx >= state.w || ny >= state.h || out.has(nk) || state.terrain[nk] !== c) continue;
          out.set(nk, n);
          stack.push(nk);
        }
      }
      n++;
    }
    return out;
  }

  /** Which sides of a tile continue with the same ground: { n, e, s, w }. */
  function sides(tx, ty, same) {
    return { n: same(tx, ty - 1), e: same(tx + 1, ty), s: same(tx, ty + 1), w: same(tx - 1, ty) };
  }

  /** Town road: asphalt with pavements along its edges and a dashed centre line. */
  function paintRoad(set, tx, ty, same) {
    const sd = sides(tx, ty, same);
    const along = sd.w || sd.e ? (sd.n || sd.s ? null : 'h') : (sd.n || sd.s ? 'v' : null);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const X = tx * TILE + x, Y = ty * TILE + y;
        const edge = (!sd.n && y < 4) || (!sd.s && y > 27) || (!sd.w && x < 4) || (!sd.e && x > 27);
        const kerb = (!sd.n && y === 4) || (!sd.s && y === 27) || (!sd.w && x === 4) || (!sd.e && x === 27);
        let col;
        if (edge) col = X % 8 === 0 || Y % 8 === 0 ? '#8f8a80' : '#aaa59a';
        else if (kerb) col = '#d8d4cc';
        else {
          col = shade(['#45484d', '#4a4d52', '#505358'], hash2(X, Y, 61) * 0.7 + valueNoise(X / 6, Y / 6, 62) * 0.3);
          // Dashed centre line (between the tiles of a road two tiles wide)
          const dashH = along === 'h' && (sd.s && !sd.n ? y > 29 : sd.n && !sd.s ? y < 2 : y === 15 || y === 16) && X % 12 < 6;
          const dashV = along === 'v' && (sd.e && !sd.w ? x > 29 : sd.w && !sd.e ? x < 2 : x === 15 || x === 16) && Y % 12 < 6;
          if (dashH || dashV) col = '#e8e4d8';
        }
        set(X, Y, col);
      }
    }
  }

  /** Race track: dark asphalt with red-and-white kerbs and a white line along its edges. */
  function paintRaceTrack(set, tx, ty, same) {
    const sd = sides(tx, ty, same);
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const X = tx * TILE + x, Y = ty * TILE + y;
        let col = shade(['#383b40', '#3e4146', '#44474c'], hash2(X, Y, 63) * 0.7 + valueNoise(X / 5, Y / 9, 64) * 0.3);
        const kerbH = (!sd.n && y < 3) || (!sd.s && y > 28);
        const kerbV = (!sd.w && x < 3) || (!sd.e && x > 28);
        if (kerbH) col = Math.floor(X / 4) % 2 ? '#d23a2c' : '#f2efe6';
        else if (kerbV) col = Math.floor(Y / 4) % 2 ? '#d23a2c' : '#f2efe6';
        else if ((!sd.n && y === 4) || (!sd.s && y === 27) || (!sd.w && x === 4) || (!sd.e && x === 27)) col = '#e8e4d8';
        set(X, Y, col);
      }
    }
  }

  const CROPS = ['wheat', 'cabbage', 'corn'];

  /** A field of crops in rows that run on across neighbouring field tiles. */
  function paintCrops(set, tx, ty, crop) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const X = tx * TILE + x, Y = ty * TILE + y;
        let col = shade(['#6a4c2e', '#765735', '#80603c'], hash2(X, Y, 71));
        const n = hash2(X, Y, 72);
        if (crop === 'wheat') {
          if (X % 4 === 1 || X % 4 === 2) col = n < 0.15 ? '#efd27a' : n < 0.6 ? '#d9b85a' : '#c49e44';
        } else if (crop === 'cabbage') {
          const dx = (X % 8) - 3.5, dy = (Y % 8) - 3.5;
          const d = dx * dx + dy * dy;
          if (d <= 8) col = dx + dy < -1 ? '#7ab84e' : d < 3 ? '#5f9a3e' : '#4a7f32';
        } else {
          if (X % 6 === 2 || X % 6 === 3) col = Y % 7 === 0 ? '#e0c040' : n < 0.5 ? '#5f9a3a' : '#4f8030';
          else if (X % 6 === 4 && Y % 7 === 3) col = '#6fae44';
        }
        set(X, Y, col);
      }
    }
  }

  /** Wooden fence along the sides of a meadow that border something else. */
  function paintFence(set, tx, ty, inside) {
    const sd = sides(tx, ty, inside);
    const post = '#5e4329', rail = '#8a6a48';
    const X0 = tx * TILE, Y0 = ty * TILE;
    const hLine = y => { for (let x = 0; x < TILE; x++) { set(X0 + x, Y0 + y, rail); set(X0 + x, Y0 + y + 3, rail); if (x % 8 === 0) set.rect(X0 + x, Y0 + y - 1, X0 + x + 1, Y0 + y + 4, post); } };
    const vLine = x => { for (let y = 0; y < TILE; y++) { set(X0 + x, Y0 + y, rail); set(X0 + x + 3, Y0 + y, rail); if (y % 8 === 0) set.rect(X0 + x - 1, Y0 + y, X0 + x + 4, Y0 + y + 1, post); } };
    if (!sd.n) hLine(1);
    if (!sd.s) hLine(TILE - 5);
    if (!sd.w) vLine(1);
    if (!sd.e) vLine(TILE - 5);
  }

  function paintPebbles(set, tx, ty) {
    const seed = tx * 31 + ty * 17;
    for (let k = 0; k < 7; k++) {
      const X = tx * TILE + 3 + Math.floor(hash2(k, 1, seed) * 26);
      const Y = ty * TILE + 3 + Math.floor(hash2(k, 2, seed) * 26);
      set(X, Y, '#a39d92');
      set(X + 1, Y, '#8a847a');
      set(X, Y + 1, '#6e6a62');
    }
  }

  function paintGrassBlades(set, tx, ty, theme) {
    for (let y = 0; y < TILE - 2; y++) {
      for (let x = 0; x < TILE; x++) {
        const X = tx * TILE + x, Y = ty * TILE + y;
        if (theme === 'construction' && isDirt(X, Y)) continue;
        if (hash2(X, Y, 14) < 0.022) {
          set(X, Y, C.grass[4]);
          set(X, Y + 1, C.grass[3]);
          set(X + 1, Y + 2, C.grass[0]);
        }
      }
    }
  }

  function paintFlowers(set, tx, ty) {
    const seed = tx * 31 + ty * 17;
    for (let k = 0; k < 6; k++) {
      const X = tx * TILE + 3 + Math.floor(hash2(k, 1, seed) * 26);
      const Y = ty * TILE + 3 + Math.floor(hash2(k, 2, seed) * 24);
      const col = pick(C.flowers, hash2(k, 3, seed));
      set(X, Y + 2, C.grass[0]);
      set(X + 1, Y + 2, C.grass[1]);
      if (k % 3 === 0) {
        set(X, Y, col);
      } else {
        set(X - 1, Y, col); set(X + 1, Y, col); set(X, Y - 1, col); set(X, Y + 1, col);
        set(X, Y, '#f2c94c');
      }
    }
  }

  function paintWaterTile(set, tx, ty, isWater) {
    const land = {
      n: !isWater(tx, ty - 1), s: !isWater(tx, ty + 1), w: !isWater(tx - 1, ty), e: !isWater(tx + 1, ty),
      nw: !isWater(tx - 1, ty - 1), ne: !isWater(tx + 1, ty - 1), sw: !isWater(tx - 1, ty + 1), se: !isWater(tx + 1, ty + 1),
    };
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const X = tx * TILE + x, Y = ty * TILE + y;
        const cx = x + 0.5, cy = y + 0.5;
        // Distance to the nearest shore within this tile
        let d = Infinity;
        if (land.n) d = Math.min(d, cy);
        if (land.s) d = Math.min(d, TILE - cy);
        if (land.w) d = Math.min(d, cx);
        if (land.e) d = Math.min(d, TILE - cx);
        if (land.nw && !land.n && !land.w) d = Math.min(d, Math.hypot(cx, cy));
        if (land.ne && !land.n && !land.e) d = Math.min(d, Math.hypot(TILE - cx, cy));
        if (land.sw && !land.s && !land.w) d = Math.min(d, Math.hypot(cx, TILE - cy));
        if (land.se && !land.s && !land.e) d = Math.min(d, Math.hypot(TILE - cx, TILE - cy));
        d += (valueNoise(X / 5, Y / 5, 31) - 0.5) * 2.2;

        let col;
        if (d < 1.6) col = C.sand;
        else if (d < 2.8) col = C.sandWet;
        else if (d < 3.8) col = C.foam;
        else {
          const n = valueNoise(X / 16, Y / 7, 21) * 0.7 + hash2(X, Y, 23) * 0.3;
          col = shade(C.water, n);
          if (d < 7 && hash2(X, Y, 24) < 0.7) col = C.waterShallow;
          if (valueNoise(X / 9, Y / 1.6, 22) > 0.8 && hash2(X, Y, 25) < 0.8) col = C.waterHighlight;
        }
        set(X, Y, col);
      }
    }
  }

  /** A single grass (or water) tile, e.g. as background for inventory icons. */
  function groundTile(kind) {
    return makeSprite(TILE, TILE, set => {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          if (kind === 'water') {
            const n = valueNoise(x / 16, y / 7, 21) * 0.7 + hash2(x, y, 23) * 0.3;
            set(x, y, valueNoise(x / 9, y / 1.6, 22) > 0.8 ? C.waterHighlight : shade(C.water, n));
          } else {
            set(x, y, grassColor(x + 64, y + 64));
          }
        }
      }
    });
  }

  // ================================================================ trees and rocks

  const LEAVES = ['#24401c', '#2f5225', '#3c652d', '#4c7a37', '#619043', '#7aa852'];

  function deciduousTree(seed) {
    const rnd = TG.util.rng(seed);
    const blobs = [{ x: 16, y: 13, r: 10 }];
    for (let k = 0; k < 6; k++) {
      const a = rnd() * Math.PI * 2;
      const dist = 4 + rnd() * 3.5;
      blobs.push({ x: 16 + Math.cos(a) * dist * 1.15, y: 13 + Math.sin(a) * dist * 0.85, r: 4.5 + rnd() * 2.5 });
    }
    const inside = (x, y) => {
      let hit = null;
      for (const b of blobs) if (Math.hypot(x + 0.5 - b.x, y + 0.5 - b.y) <= b.r) hit = b;
      return hit;
    };
    return makeSprite(TILE, TILE, set => {
      set.ellipse(18.5, 27, 11, 4, C.shadow);
      // Trunk
      for (let y = 19; y <= 28; y++) for (let x = 14; x <= 17; x++) set(x, y, x >= 16 ? '#3f2c1c' : '#5e4129');
      set(13, 28, '#3f2c1c'); set(18, 28, '#3f2c1c');
      // Canopy
      for (let y = 0; y < 27; y++) {
        for (let x = 0; x < TILE; x++) {
          const b = inside(x, y);
          if (!b) continue;
          const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          if (edge) { set(x, y, LEAVES[0]); continue; }
          const lx = (x + 0.5 - b.x) / b.r, ly = (y + 0.5 - b.y) / b.r;
          const gx = (x + 0.5 - 16) / 12, gy = (y + 0.5 - 13) / 12;
          const local = -(lx * 0.55 + ly * 0.8);
          const global = -(gx * 0.5 + gy * 0.85);
          const n = valueNoise(x / 2.2 + seed, y / 2.2, seed);
          const v = 0.48 + local * 0.28 + global * 0.25 + (n - 0.5) * 0.5;
          set(x, y, shade(LEAVES.slice(1), v));
        }
      }
    });
  }

  function conifer(seed) {
    return makeSprite(TILE, TILE, set => {
      set.ellipse(18, 28, 9, 3.5, C.shadow);
      for (let y = 24; y <= 28; y++) for (let x = 15; x <= 16; x++) set(x, y, x === 16 ? '#3f2c1c' : '#5e4129');
      // Three stacked layers of branches
      const layers = [[2, 11, 6], [8, 18, 9], [14, 25, 11]];
      const inside = (x, y) => layers.some(([y0, y1, hw]) => {
        if (y < y0 || y > y1) return false;
        const w = 1 + ((y - y0) / (y1 - y0)) * hw;
        return Math.abs(x + 0.5 - 16) <= w;
      });
      for (let y = 0; y < 27; y++) {
        for (let x = 0; x < TILE; x++) {
          if (!inside(x, y)) continue;
          const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y + 1);
          if (edge) { set(x, y, '#1c3318'); continue; }
          const side = (16 - (x + 0.5)) / 10;
          const n = valueNoise(x / 2, y / 2, seed);
          const v = 0.45 + side * 0.35 + (n - 0.5) * 0.45;
          set(x, y, shade(['#22401f', '#2b4f27', '#365f30', '#44723b', '#55854a'], v));
        }
      }
    });
  }

  function rock(seed) {
    const rnd = TG.util.rng(seed);
    const blobs = [
      { x: 16, y: 20, rx: 9 + rnd() * 2, ry: 7 },
      { x: 10 + rnd() * 2, y: 22, rx: 5 + rnd() * 2, ry: 4.5 },
      { x: 22 + rnd() * 2, y: 22, rx: 4.5 + rnd() * 2, ry: 4 },
    ];
    const inside = (x, y) => {
      let hit = null;
      for (const b of blobs) {
        const dx = (x + 0.5 - b.x) / b.rx, dy = (y + 0.5 - b.y) / b.ry;
        if (dx * dx + dy * dy <= 1) hit = b;
      }
      return hit;
    };
    const greys = ['#4f4c48', '#625f5a', '#76726c', '#8b877f', '#a29d94', '#b9b4aa'];
    return makeSprite(TILE, TILE, set => {
      set.ellipse(18, 26.5, 12, 3.5, C.shadow);
      for (let y = 8; y < 30; y++) {
        for (let x = 0; x < TILE; x++) {
          const b = inside(x, y);
          if (!b) continue;
          const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
          if (edge) { set(x, y, '#3a3835'); continue; }
          const lx = (x + 0.5 - b.x) / b.rx, ly = (y + 0.5 - b.y) / b.ry;
          const v = 0.5 - lx * 0.25 - ly * 0.4 + (valueNoise(x / 2.5, y / 2.5, seed) - 0.5) * 0.4;
          set(x, y, shade(greys.slice(1), v));
        }
      }
      // A crack and a bit of moss
      for (let i = 0; i < 4; i++) set(15 + i, 16 + (i >> 1), '#4f4c48');
      set(12, 19, '#5d7a3a'); set(13, 19, '#6c8a44'); set(12, 20, '#5d7a3a');
    });
  }

  // ================================================================ track

  /**
   * Geometry of one link for a pixel centre (cx, cy):
   *   off = signed distance from the track centre line,
   *   s   = distance along the track (used for the sleeper rhythm).
   */
  function linkGeom(link, cx, cy) {
    if (link.length === 1) {
      const d = link[0];
      return {
        off: [cx - H, cy - H, H - cx, H - cy][d],
        s: [cy, TILE - cx, TILE - cy, cx][d],
        end: true,
      };
    }
    const [a, b] = link;
    if ((a + 2) % 4 === b) {
      return a % 2 === 0 ? { off: cx - H, s: cy } : { off: cy - H, s: cx };
    }
    const has = d => a === d || b === d;
    const kx = has(1) ? TILE : 0; // the corner the curve bends around
    const ky = has(2) ? TILE : 0;
    const dx = Math.abs(cx - kx), dy = Math.abs(cy - ky);
    return { off: Math.hypot(dx, dy) - H, s: Math.atan2(dy, dx) * H };
  }

  /**
   * Track tile. opts.platformDir (0-3) adds a station platform on that side;
   * opts.bridge draws a wooden deck with steel girders instead of ballast.
   */
  function track(type, rot, opts) {
    opts = opts || {};
    const links = TG.track.links(type, rot);
    const bridge = type === 'bridge';
    return makeSprite(TILE, TILE, set => {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const cx = x + 0.5, cy = y + 0.5;
          let ground = null, sleeper = null, rail = null, top = null;
          for (const link of links) {
            const g = linkGeom(link, cx, cy);
            const a = Math.abs(g.off);
            if (g.end && g.s > 25) continue;
            const phase = ((g.s % 8) + 8) % 8;

            if (bridge) {
              if (a <= 11) {
                ground = (g.s % 4) >= 3 ? C.plankGap : shade(C.plank, valueNoise(g.s / 4, g.off * 3, 41));
              } else if (a <= 13) {
                ground = a <= 12 ? C.girderLight : C.girder;
                if (g.s % 8 < 1) ground = C.girderDark; // rivet / post
              } else if (a <= 16 && g.off > 0) {
                ground = C.shadow; // shadow on the water
              }
            } else {
              const edge = 9.6 + hash2(x, y, 5) * 1.2;
              if (a <= edge) {
                ground = a > edge - 1 ? C.ballastEdge : shade(C.ballast, hash2(x, y, 77) * 0.8 + valueNoise(x / 3, y / 3, 78) * 0.2);
              }
              const mainLine = type !== 'junction' || (link.length === 2 && (link[0] + 2) % 4 === link[1]);
            if (mainLine && a < 10.5 && phase >= 2.5 && phase < 5.5 && (!g.end || g.s < 19)) {
                sleeper = a >= 9.5 ? C.sleeperEnd
                  : phase < 3.5 ? C.sleeperTop // lit edge
                  : shade(C.sleeper, valueNoise(g.off / 3, g.s, 79) * 0.6 + hash2(x, y, 80) * 0.4);
              }
            }
            if (!g.end || g.s < 21) {
              if (a >= 4 && a < 5) rail = C.railTop;
              else if (a >= 5 && a < 6 && rail !== C.railTop) rail = C.railSide;
              else if (!rail && a >= 3 && a < 4 && ((phase >= 2.5 && phase < 5.5) || bridge)) rail = C.railBase;
            }
            if (g.end && g.s >= 20 && g.s < 24 && a < 9) {
              // Buffer stop: striped beam with dark posts
              if (a >= 7.5) top = C.bufferDark;
              else top = Math.floor((g.off + 16) / 3) % 2 ? C.bufferRed : C.bufferWhite;
              if (g.s >= 23) top = C.bufferDark;
            }
          }
          if (ground) set(x, y, ground);
          if (sleeper) set(x, y, sleeper);
          if (opts.platformDir != null) paintPlatformPixel(set, x, y, cx, cy, opts.platformDir);
          if (rail) set(x, y, rail);
          if (top) set(x, y, top);
        }
      }
    });
  }

  function paintPlatformPixel(set, x, y, cx, cy, dir) {
    const d = [H - cy, cx - H, cy - H, H - cx][dir];
    if (d < 8) return;
    const u = dir % 2 === 0 ? x : y;
    const v = dir % 2 === 0 ? y : x;
    let col;
    if (d < 9) col = C.platformKerb;
    else if (d < 10) col = C.platformLine;
    else if (d >= 15) col = C.platformFar;
    else if (u % 8 === 0 || (v % 6 === 0 && d > 10)) col = C.platformJoint;
    else col = shade(C.platform, hash2(x, y, 51));
    set(x, y, col);
  }

  // ================================================================ buildings

  /** Station building in a slight top-down 3/4 view (roof on top, front wall below). */
  function building(art) {
    const [roofLight, roofDark] = art.roof;
    const outline = '#26221e';
    return makeSprite(TILE, TILE, set => {
      // Ground shadow (to the right and below)
      set.rect(4, 30, 31, 31, C.shadowSoft);
      set.rect(30, 5, 31, 29, C.shadowSoft);

      // Chimney behind the roof ridge
      if (art.emblem !== 'sails' && art.emblem !== 'flag') {
        set.rect(22, 1, 25, 6, '#7d4a3a');
        set.rect(22, 1, 25, 1, '#4a2c22');
        set.rect(25, 2, 25, 6, '#5e382b');
      }

      // Roof: lit upper slope, darker lower slope, tile rows
      for (let y = 3; y <= 18; y++) {
        for (let x = 2; x <= 29; x++) {
          const upper = y <= 10;
          let col = upper ? roofLight : roofDark;
          const row = upper ? y - 3 : y - 11;
          if (row % 3 === 2) col = shadeHex(col, -18);
          else if ((x + (Math.floor(row / 3) % 2) * 2) % 4 === 0) col = shadeHex(col, -10);
          if (y === 10 || y === 11) col = upper ? shadeHex(art.trim, -10) : shadeHex(roofDark, -25);
          if (x === 2 || x === 29 || y === 3) col = outline;
          set(x, y, col);
        }
      }
      // Eave shadow
      set.rect(2, 19, 29, 19, outline);
      set.rect(3, 20, 28, 20, 'rgba(0,0,0,0.35)');

      // Front wall
      for (let y = 20; y <= 29; y++) {
        for (let x = 3; x <= 28; x++) {
          let col = art.wall;
          if (art.wallType === 'plank') {
            if (x % 3 === 0) col = shadeHex(art.wall, -22);
          } else if (art.wallType === 'metal') {
            if (x % 2 === 0) col = shadeHex(art.wall, -12);
          } else if (art.wallType === 'plaster') {
            if (hash2(x, y, 61) < 0.15) col = shadeHex(art.wall, -10);
          } else {
            const brickRow = Math.floor((y - 20) / 3);
            if ((y - 20) % 3 === 2 || (x + (brickRow % 2) * 3) % 6 === 0) col = shadeHex(art.wall, -20);
          }
          if (x === 3 || x === 28) col = outline;
          set(x, y, col);
        }
      }
      set.rect(3, 29, 28, 29, shadeHex(art.wall, -40));

      // Windows with frame, mullions and a reflection
      for (const wx of [6, 21]) {
        set.rect(wx - 1, 22, wx + 5, 27, art.trim);
        set.rect(wx, 23, wx + 4, 26, '#34495c');
        set.rect(wx, 23, wx + 4, 23, '#4d6680');
        set.rect(wx + 2, 23, wx + 2, 26, art.trim);
        set.rect(wx, 25, wx + 4, 25, art.trim);
        set(wx + 3, 24, '#a9c3d8');
        set(wx + 4, 23, '#a9c3d8');
      }
      // Door
      set.rect(13, 22, 18, 29, art.trim);
      set.rect(14, 23, 17, 29, art.door);
      set.rect(14, 23, 17, 23, shadeHex(art.door, 20));
      set(17, 26, '#d8c070');

      emblem(set, art);
    });
  }

  function shadeHex(hex, amt) {
    const [r, g, b] = parseColor(hex);
    const f = v => Math.max(0, Math.min(255, v + amt)).toString(16).padStart(2, '0');
    return '#' + f(r) + f(g) + f(b);
  }

  function emblem(set, art) {
    switch (art.emblem) {
      case 'bigdoor': { // warehouse: wide roller door, loading lamp
        set.rect(10, 21, 21, 29, art.trim);
        for (let y = 22; y <= 29; y++) set.rect(11, y, 20, y, y % 2 ? '#5d6066' : '#4a4d52');
        set.rect(14, 20, 17, 20, '#f2d36b');
        break;
      }
      case 'barn': { // white X door and white roof edge
        set.rect(12, 21, 19, 29, art.trim);
        set.rect(13, 22, 18, 29, art.door);
        for (let i = 0; i < 7; i++) {
          set(13 + Math.round(i * 5 / 6), 22 + i, art.trim);
          set(18 - Math.round(i * 5 / 6), 22 + i, art.trim);
        }
        set.rect(3, 4, 28, 4, art.trim);
        // Hay loft opening on the roof
        set.rect(13, 13, 18, 17, '#3b2a1c');
        set.rect(14, 15, 17, 17, '#d9b85a');
        break;
      }
      case 'bread': { // sign with a loaf on the lower roof
        set.rect(9, 12, 22, 18, '#3b2f25');
        set.rect(10, 13, 21, 17, '#e9dfc8');
        set.ellipse(15.5, 15, 5, 2.2, '#b97a36');
        set.ellipse(15.5, 14.6, 4, 1.4, '#d9a25a');
        set(13, 14, '#8a5426'); set(15, 14, '#8a5426'); set(17, 14, '#8a5426');
        break;
      }
      case 'sails': { // windmill sails over the roof
        const wood = '#4a3726', cloth = '#ebe4d3', clothDark = '#cfc6b2';
        const cx = 15.5, cy = 10.5;
        for (let i = -11; i <= 11; i++) {
          for (const [dx, dy] of [[1, 1], [1, -1]]) {
            const x = Math.round(cx + i * dx * 0.95), y = Math.round(cy + i * dy * 0.8);
            set(x, y, wood);
            if (Math.abs(i) > 2) {
              set(x + (dy > 0 ? 1 : 1), y, (i % 2) ? cloth : clothDark);
              set(x + 2, y, (i % 2) ? clothDark : cloth);
            }
          }
        }
        set.rect(14, 9, 17, 12, wood);
        set.rect(15, 10, 16, 11, '#7a5c3c');
        break;
      }
      case 'awning': { // striped market awning
        for (let x = 3; x <= 28; x++) {
          const col = Math.floor(x / 3) % 2 ? '#ebe4d3' : '#2f7a46';
          set.rect(x, 19, x, 21, col);
          if (x % 3 !== 1) set(x, 22, col);
        }
        break;
      }
      case 'stripes':
        for (let x = 3; x <= 28; x++) for (let y = 27; y <= 29; y++) set(x, y, Math.floor((x + y) / 3) % 2 ? '#2b2b2b' : '#e0b030');
        break;
      case 'stones':
        [[6, 14, 3], [10, 15, 2.5], [8, 12, 2.5], [23, 15, 3], [20, 14, 2]].forEach(([x, y, r]) => set.ellipse(x, y, r, r * 0.8, '#bdb6aa'));
        break;
      case 'logs':
        for (const lx of [6, 9, 22, 25]) {
          set.ellipse(lx, 13.5, 1.8, 1.8, '#c9a46c');
          set(Math.floor(lx), 13, '#8a6440');
        }
        break;
      case 'wheel':
        set.ellipse(16, 14, 4.5, 4.5, '#1e1e1e');
        set.ellipse(16, 14, 2, 2, '#a0a0a0');
        break;
      case 'flag':
        set.rect(9, 2, 9, 12, '#3a3a3a');
        for (let y = 2; y <= 7; y++) for (let x = 10; x <= 17; x++) set(x, y, (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? '#111111' : '#f5f5f5');
        break;
      case 'drop':
        set.ellipse(16, 15, 3.5, 3, '#d9b43a');
        set.rect(15, 10, 16, 12, '#d9b43a');
        break;
      case 'cone': // traffic cones on the roof edge
        for (const cx of [8, 23]) {
          for (let y = 0; y < 8; y++) {
            const hw = Math.floor(y / 2.5);
            set.rect(cx - hw, 7 + y, cx + hw, 7 + y, y === 4 ? '#f2efe6' : '#e8702a');
          }
          set.rect(cx - 4, 15, cx + 4, 15, '#3a3a3a');
        }
        break;
      case 'bubbles': // soap bubbles
        [[9, 8, 3], [15, 6, 2], [21, 9, 3.5], [13, 13, 2.5], [24, 14, 2]].forEach(([x, y, r]) => {
          set.ellipse(x, y, r, r, 'rgba(240,248,255,0.85)');
          set(Math.round(x - r / 2), Math.round(y - r / 2), '#ffffff');
        });
        break;
      case 'bell': // small bell tower on the ridge
        set.rect(13, 1, 18, 9, art.trim);
        set.rect(14, 3, 17, 7, '#3a3a3a');
        set.ellipse(15.5, 5.5, 1.6, 1.8, '#d9b43a');
        set.rect(12, 0, 19, 1, art.roof[1]);
        break;
      case 'envelope':
        set.rect(10, 11, 21, 17, '#f2efe6');
        for (let i = 0; i < 6; i++) { set(10 + i, 11 + Math.floor(i * 0.6), '#9a9285'); set(21 - i, 11 + Math.floor(i * 0.6), '#9a9285'); }
        set.rect(10, 17, 21, 17, '#9a9285');
        break;
      case 'shopwindow': // striped awning over the front
        for (let x = 3; x <= 28; x++) { set(x, 19, x % 4 < 2 ? '#e8e2d4' : art.roof[0]); set(x, 20, x % 4 < 2 ? '#d4cdbd' : art.roof[1]); }
        break;
      case 'ball':
        set.ellipse(16, 12, 5, 5, '#d23a2c');
        for (let y = 7; y <= 17; y++) for (let x = 16; x <= 21; x++) if (((x - 16) ** 2 + (y - 12) ** 2) <= 25) set(x, y, y < 12 ? '#f5f5f5' : '#2a6fb0');
        set(14, 9, '#ffffff');
        break;
    }
  }

  // ================================================================ top-down train (victory lap)

  /** Locomotive or wagon seen from above, facing east (the renderer rotates it). */
  function topTrain(kind, index) {
    if (kind === 'loco') {
      return makeSprite(22, 12, set => {
        set.rect(0, 1, 21, 10, '#2a2a2c');
        set.rect(7, 3, 19, 8, '#386a45');
        set.rect(7, 3, 19, 4, '#5f9a6a');
        set.rect(7, 8, 19, 8, '#24442d');
        set.rect(18, 3, 20, 8, '#2f3135');
        set.rect(18, 5, 19, 6, '#111111');
        set.rect(13, 5, 14, 6, '#c9a646');
        set.rect(1, 1, 7, 10, '#3a3d42');
        set.rect(1, 1, 7, 1, '#5a5f66');
        set.rect(21, 2, 21, 3, '#a3312a');
        set.rect(21, 8, 21, 9, '#a3312a');
      });
    }
    const col = ['#7a4a2e', '#6b7176', '#4d6a50'][index % 3];
    return makeSprite(16, 11, set => {
      set.rect(0, 0, 15, 10, shadeHex(col, -40));
      set.rect(1, 1, 14, 9, col);
      set.rect(3, 3, 12, 7, shadeHex(col, -25));
      set.rect(0, 2, 0, 3, '#9a9a9a');
      set.rect(0, 7, 0, 8, '#9a9a9a');
    });
  }

  // ================================================================ farm objects (top-down)

  /** Round hay bales seen from above, with their spiral. */
  function haybaleTop(v) {
    const bales = v % 2 ? [[16, 17, 10]] : [[11, 19, 8], [22, 13, 7]];
    return makeSprite(TILE, TILE, set => {
      for (const [cx, cy, r] of bales) set.ellipse(cx + 2, cy + 3, r, r * 0.6, C.shadow);
      for (const [cx, cy, r] of bales) {
        for (let y = 0; y < TILE; y++) {
          for (let x = 0; x < TILE; x++) {
            const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
            if (d > r) continue;
            let col = d > r - 1.2 ? '#a8863a' : '#d9b85a';
            if (Math.abs(d - r * 0.66) < 0.6 || Math.abs(d - r * 0.33) < 0.6) col = '#b8963e';
            if (d < r - 1.2 && dx + dy < -r * 0.6 && hash2(x, y, 81) < 0.5) col = '#efd27a';
            set(x, y, col);
          }
        }
      }
    });
  }

  /** A cow (black and white) or a sheep (fluffy white) for the meadows. */
  function animal(kind) {
    if (kind === 'cow') {
      return makeSprite(16, 11, set => {
        set.ellipse(8.5, 9.5, 7, 1.6, C.shadow);
        set.rect(2, 3, 12, 8, '#f2efe6');
        set.rect(2, 3, 12, 3, '#ffffff');
        set.rect(4, 4, 6, 6, '#26221e');
        set.rect(9, 5, 11, 7, '#26221e');
        set.rect(12, 2, 15, 6, '#f2efe6');
        set.rect(14, 5, 15, 6, '#e8a8a0');
        set(13, 3, '#26221e');
        set.rect(12, 1, 12, 1, '#c8c0b0');
        set.rect(15, 1, 15, 1, '#c8c0b0');
        set(1, 4, '#26221e');
        set.rect(3, 9, 3, 9, '#5a504a');
        set.rect(11, 9, 11, 9, '#5a504a');
      });
    }
    return makeSprite(14, 10, set => {
      set.ellipse(7, 8.5, 6, 1.5, C.shadow);
      for (const [x, y] of [[3, 4], [6, 3], [9, 4], [4, 6], [7, 6], [10, 6]]) set.ellipse(x, y, 2.4, 2.2, '#f2efe6');
      set.rect(4, 3, 9, 3, '#ffffff');
      set.rect(11, 3, 13, 6, '#3a3330');
      set(12, 4, '#f2efe6');
      set.rect(4, 8, 4, 9, '#3a3330');
      set.rect(9, 8, 9, 9, '#3a3330');
    });
  }

  // ================================================================ theme obstacles (top-down)

  /** Heap of sand or gravel (construction). */
  function gravelHeap(seed) {
    const cols = seed % 2 ? ['#8a7a5c', '#9e8c6a', '#b29f7a', '#c4b18a'] : ['#7a776f', '#8c8880', '#9e9a90', '#b2aea3'];
    return makeSprite(TILE, TILE, set => {
      set.ellipse(17, 26, 13, 4, C.shadow);
      for (let y = 9; y <= 26; y++) {
        const hw = ((y - 9) / 17) * 13;
        for (let x = Math.round(16 - hw); x <= Math.round(16 + hw); x++) {
          const v = 0.55 - (x - 16) / 30 - (y - 18) / 40 + (hash2(x, y, seed) - 0.5) * 0.35;
          set(x, y, shade(cols, v));
        }
      }
    });
  }

  /** Stacked concrete blocks (construction). */
  function concreteBlocks() {
    return makeSprite(TILE, TILE, set => {
      set.rect(6, 25, 29, 27, C.shadowSoft);
      const block = (x, y, w, h) => {
        set.rect(x, y, x + w, y + 3, '#c4c0b8');
        set.rect(x, y + 4, x + w, y + h, '#9a968e');
        set.rect(x + w, y, x + w, y + h, '#7a766f');
        set.rect(x, y + h, x + w, y + h, '#5f5c56');
      };
      block(4, 15, 12, 10);
      block(16, 15, 12, 10);
      block(10, 6, 12, 9);
    });
  }

  /** Stack of tyres (racing). */
  function tyreStack() {
    return makeSprite(TILE, TILE, set => {
      set.ellipse(17, 26, 11, 4, C.shadow);
      for (const y of [22, 17, 12]) {
        set.ellipse(16, y, 10, 4.5, '#1e1e20');
        set.ellipse(16, y - 1, 9, 3.5, '#2e2e31');
        set.rect(7, y, 25, y, y === 17 ? '#e0473a' : '#3c3c40');
      }
      set.ellipse(16, 11, 5, 2, '#55565b');
      set.ellipse(16, 11, 3, 1.2, '#1e1e20');
    });
  }

  const HOUSE_COLORS = [
    { wall: '#9c4a34', roof: ['#5f6369', '#4a4d52'] }, { wall: '#c9a27a', roof: ['#8a3a2e', '#6e2e24'] },
    { wall: '#e0d6c4', roof: ['#3f5a7a', '#2f4560'] }, { wall: '#7a5040', roof: ['#9e6a3a', '#7a502c'] },
  ];

  /** A small town house (town), built with the station building painter. */
  function house(v) {
    const c = HOUSE_COLORS[v % HOUSE_COLORS.length];
    return building({ wallType: 'brick', roof: c.roof, wall: c.wall, trim: '#f2efe6', door: '#3f4a5a', emblem: 'none' });
  }

  // ================================================================ registry

  const cache = new Map();
  function get(key, factory) {
    let s = cache.get(key);
    if (!s) {
      s = factory();
      cache.set(key, s);
    }
    return s;
  }

  const TREE_VARIANTS = 4; // three leafy trees and a conifer
  const ROCK_VARIANTS = 2;

  TG.sprites = {
    TILE, C, createCanvas, makeSprite, shade, shadeHex, parseColor,
    terrain,
    ground: kind => get('ground:' + kind, () => groundTile(kind)),
    tree: v => get('tree' + (v % TREE_VARIANTS), () =>
      v % TREE_VARIANTS === 3 ? conifer(700 + v) : deciduousTree(900 + (v % TREE_VARIANTS) * 31)),
    rock: v => get('rock' + (v % ROCK_VARIANTS), () => rock(500 + (v % ROCK_VARIANTS) * 13)),
    /** Obstacle sprite for a map character ('T' or 'R') in a theme. */
    obstacle: (theme, ch, v) => {
      if (theme === 'construction') {
        return ch === 'T'
          ? (v % 3 === 0 ? get('tree3', () => conifer(703)) : get('heap' + (v % 2), () => gravelHeap(v % 2)))
          : get('blocks', concreteBlocks);
      }
      if (theme === 'racing' && ch === 'R') return get('tyres', tyreStack);
      if (theme === 'town' && ch === 'R') return get('house' + (v % HOUSE_COLORS.length), () => house(v));
      return ch === 'T' ? TG.sprites.tree(v) : TG.sprites.rock(v);
    },
    track: (type, rot, platformDir) =>
      get('track:' + type + ':' + rot + ':' + platformDir, () => track(type, rot, { platformDir })),
    building: kind => get('building:' + kind, () => building(TG.themes.stationKind(kind).art)),
    /** A junction drawn as a switch: the whole piece faded, the way it is set on top. */
    switchTile: (rot, linkIndex) => get('switch:' + rot + ':' + linkIndex, () => {
      const c = createCanvas(TILE, TILE);
      const ctx = c.getContext('2d');
      ctx.globalAlpha = 0.35;
      ctx.drawImage(TG.sprites.track('junction', rot), 0, 0);
      ctx.globalAlpha = 1;
      const link = TG.track.links('junction', rot)[linkIndex];
      const p = TG.generator.pieceFor(new Set(link), false);
      ctx.drawImage(TG.sprites.track(p.type, p.rot), 0, 0);
      return c;
    }),
    haybaleTop: v => get('hayTop' + (v % 2), () => haybaleTop(v % 2)),
    animal: v => get('animal' + (v % 3 === 0 ? 'sheep' : 'cow'), () => animal(v % 3 === 0 ? 'sheep' : 'cow')),
    topTrain: (kind, index) => get('top:' + kind + ':' + ((index || 0) % 3), () => topTrain(kind, index || 0)),
  };
})(globalThis.TG = globalThis.TG || {});
