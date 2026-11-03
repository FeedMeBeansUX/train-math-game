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

  /** Paint the ground of a whole level: grass, flowers, water with shores. */
  function terrain(state) {
    const L = TG.level;
    const ch = (tx, ty) => (L.inBounds(state, tx, ty) ? L.terrainAt(state, tx, ty) : '~');
    const isWater = (tx, ty) => ch(tx, ty) === '~';
    const W = state.w * TILE, Hh = state.h * TILE;

    return makeSprite(W, Hh, set => {
      for (let ty = 0; ty < state.h; ty++) {
        for (let tx = 0; tx < state.w; tx++) {
          if (isWater(tx, ty)) paintWaterTile(set, tx, ty, isWater);
          else paintGrassTile(set, tx, ty);
        }
      }
      // Details on top of the ground
      for (let ty = 0; ty < state.h; ty++) {
        for (let tx = 0; tx < state.w; tx++) {
          if (isWater(tx, ty)) continue;
          paintGrassBlades(set, tx, ty);
          if (ch(tx, ty) === 'f') paintFlowers(set, tx, ty);
        }
      }
    });
  }

  function grassColor(X, Y) {
    const big = valueNoise(X / 28, Y / 28, 11);
    const clump = valueNoise(X / 7, Y / 7, 12);
    const v = big * 0.5 + clump * 0.4 + hash2(X, Y, 13) * 0.28 - 0.08;
    return shade(C.grass, v);
  }

  function paintGrassTile(set, tx, ty) {
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        const X = tx * TILE + x, Y = ty * TILE + y;
        set(X, Y, grassColor(X, Y));
      }
    }
  }

  function paintGrassBlades(set, tx, ty) {
    for (let y = 0; y < TILE - 2; y++) {
      for (let x = 0; x < TILE; x++) {
        const X = tx * TILE + x, Y = ty * TILE + y;
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
              if (a < 10.5 && phase >= 2.5 && phase < 5.5 && (!g.end || g.s < 19)) {
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
    }
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
    TILE, C, createCanvas, makeSprite,
    terrain,
    ground: kind => get('ground:' + kind, () => groundTile(kind)),
    tree: v => get('tree' + (v % TREE_VARIANTS), () =>
      v % TREE_VARIANTS === 3 ? conifer(700 + v) : deciduousTree(900 + (v % TREE_VARIANTS) * 31)),
    rock: v => get('rock' + (v % ROCK_VARIANTS), () => rock(500 + (v % ROCK_VARIANTS) * 13)),
    track: (type, rot, platformDir) =>
      get('track:' + type + ':' + rot + ':' + platformDir, () => track(type, rot, { platformDir })),
    building: kind => get('building:' + kind, () => building(TG.themes.stationKind(kind).art)),
  };
})(globalThis.TG = globalThis.TG || {});
