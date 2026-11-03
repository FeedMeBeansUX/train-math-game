/*
 * Pixel-art sprites, generated in code at start-up.
 *
 * Everything is drawn at 16x16 px per tile and scaled up by the renderer
 * without smoothing. Two techniques are used:
 *   - procedural painters (terrain, track) that decide a colour per pixel;
 *   - small hand-drawn sprites written as strings with a palette (trees, rocks).
 * The rest of the game only asks for sprites by name, so these can later be
 * replaced with PNG files without touching the game logic.
 */
(function (TG) {
  'use strict';

  const TILE = 16;
  const hash2 = TG.util.hash2;

  // ---------------------------------------------------------------- helpers

  const colorCache = new Map();
  function parseColor(c) {
    let v = colorCache.get(c);
    if (v) return v;
    if (c[0] === '#') {
      const n = c.length === 9 ? c.slice(1) : c.slice(1) + 'ff';
      v = [0, 2, 4, 6].map(i => parseInt(n.slice(i, i + 2), 16));
    } else {
      const m = c.match(/rgba?\(([^)]+)\)/);
      const p = m[1].split(',').map(Number);
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
   * Make a sprite by calling paint(set, w, h), where set(x, y, color) draws a
   * pixel. Colours with alpha are blended over what is already there.
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
    paint(set, w, h);
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  /** Sprite from rows of characters; '.' and ' ' are transparent. */
  function fromStrings(rows, palette) {
    rows.forEach((r, i) => {
      if (r.length !== rows[0].length) throw new Error('Sprite row ' + i + ' has wrong length');
    });
    return makeSprite(rows[0].length, rows.length, set => {
      rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) {
          const ch = r[x];
          if (ch !== '.' && ch !== ' ') set(x, y, palette[ch]);
        }
      });
    });
  }

  /** Draw sprites on top of each other into a new canvas. */
  function layer(...sprites) {
    const out = createCanvas(sprites[0].width, sprites[0].height);
    const ctx = out.getContext('2d');
    for (const s of sprites) ctx.drawImage(s, 0, 0);
    return out;
  }

  function pick(colors, n) {
    return colors[Math.min(colors.length - 1, Math.floor(n * colors.length))];
  }

  // ---------------------------------------------------------------- palette

  const C = {
    grass: '#5d8b3b', grassDark: '#517d33', grassLight: '#6b9a46', grassDeep: '#456f2c', tuft: '#7aa852',
    flowers: ['#e8d35a', '#eeeadc', '#d98aa0', '#9bb7e0'],
    water: '#3e6fa3', waterDark: '#36649a', waterLight: '#6593c6', foam: 'rgba(196,220,240,0.75)', bank: '#a8996c',
    ballast: ['#7a7163', '#857b6c', '#8f8576', '#9a907f'], ballastEdge: '#6a6256',
    sleeper: '#5f4631', sleeperEnd: '#4c3826', sleeperLight: '#6e533a',
    railTop: '#cfd3d8', railSide: '#5b5f66',
    platform: '#a9a191', platformJoint: '#958d7e', platformKerb: '#e0d8c7', platformFar: '#8f8778',
    bufferRed: '#b03a2e', bufferWhite: '#e6ddca', bufferDark: '#3d3a36',
    shadow: 'rgba(0,0,0,0.28)', shadowSoft: 'rgba(0,0,0,0.18)',
  };

  // ---------------------------------------------------------------- terrain

  function grass(variant) {
    const seed = 101 + variant * 17;
    return makeSprite(TILE, TILE, set => {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const n = hash2(x, y, seed);
          set(x, y, n < 0.8 ? C.grass : n < 0.92 ? C.grassDark : n < 0.985 ? C.grassLight : C.grassDeep);
        }
      }
      // A few grass tufts
      for (let k = 0; k < 3; k++) {
        const tx = 1 + Math.floor(hash2(k, variant, seed + 1) * 14);
        const ty = 2 + Math.floor(hash2(variant, k, seed + 2) * 12);
        set(tx, ty, C.tuft);
        set(tx - 1, ty + 1, C.grassDeep);
        set(tx + 1, ty + 1, C.grassDeep);
        set(tx, ty + 1, C.grassLight);
      }
    });
  }

  function flowers(variant) {
    const seed = 303 + variant * 7;
    return layer(grass(variant), makeSprite(TILE, TILE, set => {
      for (let k = 0; k < 4; k++) {
        const fx = 2 + Math.floor(hash2(k, 1, seed) * 12);
        const fy = 2 + Math.floor(hash2(k, 2, seed) * 12);
        const col = pick(C.flowers, hash2(k, 3, seed));
        set(fx, fy + 1, C.grassDeep);
        set(fx, fy, col);
        if (k % 2 === 0) { set(fx - 1, fy, col); set(fx + 1, fy, col); set(fx, fy - 1, col); set(fx, fy, '#f2c94c'); }
      }
    }));
  }

  function water(variant) {
    const seed = 505 + variant * 13;
    return makeSprite(TILE, TILE, set => {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          set(x, y, hash2(x, y, seed) < 0.82 ? C.water : C.waterDark);
        }
      }
      for (let k = 0; k < 3; k++) {
        const wx = Math.floor(hash2(k, 5, seed) * 12);
        const wy = 1 + Math.floor(hash2(k, 6, seed) * 14);
        for (let i = 0; i < 3 + (k % 2); i++) set(wx + i, wy, C.waterLight);
      }
    });
  }

  const TREE_ROWS = [
    '................',
    '.....111111.....',
    '...1122333211...',
    '..123334443321..',
    '.12334455543321.',
    '.12334555443321.',
    '1223344544433211',
    '1223334443333211',
    '1222333433332211',
    '.12223333322221.',
    '.11222222222211.',
    '..111122221111..',
    '...sss1tu1sss...',
    '....sssutsss....',
    '.....ssssss.....',
    '................',
  ];
  const TREE_PAL = {
    1: '#2a4620', 2: '#365c2c', 3: '#467238', 4: '#5a8a44', 5: '#73a455',
    t: '#5b3d26', u: '#3f2c1c', s: C.shadow,
  };

  const ROCK_ROWS = [
    '................',
    '................',
    '................',
    '................',
    '................',
    '.......111......',
    '.....1123311....',
    '....122344311...',
    '...12234444321..',
    '..1223344443221.',
    '..1222333332221.',
    '..s11222222211s.',
    '...sss111111ss..',
    '.....ssssssss...',
    '................',
    '................',
  ];
  const ROCK_PAL = { 1: '#4f4d4a', 2: '#6c6964', 3: '#87837c', 4: '#a39f97', s: C.shadow };

  // ---------------------------------------------------------------- track

  /**
   * Geometry of one link for a pixel centre (cx, cy):
   *   off = signed distance from the track centre line,
   *   s   = distance along the track (used for the sleeper rhythm).
   */
  function linkGeom(link, cx, cy) {
    if (link.length === 1) {
      const d = link[0];
      const along = [cy, TILE - cx, TILE - cy, cx][d];
      const off = [cx - 8, cy - 8, 8 - cx, 8 - cy][d];
      return { off, s: along, end: true };
    }
    const [a, b] = link;
    if ((a + 2) % 4 === b) {
      return a % 2 === 0 ? { off: cx - 8, s: cy } : { off: cy - 8, s: cx };
    }
    const has = d => a === d || b === d;
    const kx = has(1) ? TILE : 0;           // corner the curve bends around
    const ky = has(2) ? TILE : 0;
    const dx = Math.abs(cx - kx), dy = Math.abs(cy - ky);
    const r = Math.hypot(dx, dy);
    return { off: r - 8, s: Math.atan2(dy, dx) * 8 };
  }

  /** Track tile for a piece; platformDir (0-3) adds a station platform on that side. */
  function track(type, rot, platformDir) {
    const links = TG.track.links(type, rot);
    return makeSprite(TILE, TILE, set => {
      for (let y = 0; y < TILE; y++) {
        for (let x = 0; x < TILE; x++) {
          const cx = x + 0.5, cy = y + 0.5;
          let ballast = false, ballastEdge = false, sleeper = false, sleeperEnd = false;
          let rail = 0, buffer = null;
          for (const link of links) {
            const g = linkGeom(link, cx, cy);
            const a = Math.abs(g.off);
            const maxS = g.end ? 12.5 : Infinity;
            if (g.s > maxS) continue;
            if (a <= 5) { ballast = true; if (a > 4.2) ballastEdge = true; }
            const phase = ((g.s % 4) + 4) % 4;
            if (a < 5.5 && phase >= 1 && phase < 3 && (!g.end || g.s < 9)) {
              sleeper = true;
              if (a >= 4.5) sleeperEnd = true;
            }
            if (!g.end || g.s < 10) {
              if (a >= 2 && a < 3) rail = 1;
              else if (a >= 3 && a < 4 && rail !== 1) rail = 2;
            }
            if (g.end && g.s >= 10 && g.s < 12 && a < 5) {
              // Buffer stop: red and white striped beam with dark ends
              buffer = a >= 4 ? C.bufferDark : (Math.floor(g.off + 8) % 4 < 2 ? C.bufferRed : C.bufferWhite);
            }
          }
          if (ballast) {
            set(x, y, ballastEdge ? C.ballastEdge : pick(C.ballast, hash2(x, y, 77)));
          }
          if (sleeper) {
            set(x, y, sleeperEnd ? C.sleeperEnd : (hash2(x, y, 91) < 0.2 ? C.sleeperLight : C.sleeper));
          }
          if (platformDir != null) {
            const d = [8 - cy, cx - 8, cy - 8, 8 - cx][platformDir];
            const u = platformDir % 2 === 0 ? x : y;
            if (d >= 4) {
              if (d < 5) set(x, y, C.platformKerb);
              else if (d >= 7) set(x, y, C.platformFar);
              else set(x, y, u % 4 === 0 ? C.platformJoint : C.platform);
            }
          }
          if (rail === 1) set(x, y, C.railTop);
          else if (rail === 2) set(x, y, C.railSide);
          if (buffer) set(x, y, buffer);
        }
      }
    });
  }

  // ---------------------------------------------------------------- buildings

  /** Station building, drawn in a slight top-down 3/4 view. */
  function building(art) {
    const [roofLight, roofDark] = art.roof;
    const outline = '#2e2a26';
    return makeSprite(TILE, TILE, set => {
      // Ground shadow
      for (let x = 2; x <= 15; x++) set(x, 15, C.shadowSoft);
      for (let y = 3; y <= 14; y++) set(15, y, C.shadowSoft);
      // Roof
      for (let y = 1; y <= 8; y++) {
        for (let x = 1; x <= 14; x++) {
          let col = y <= 4 ? roofLight : roofDark;
          if (y % 2 === 0 && (x + y) % 3 === 0) col = roofDark;
          if (y === 4) col = art.trim;
          if (x === 1 || x === 14 || y === 1) col = outline;
          set(x, y, col);
        }
      }
      // Eave shadow
      for (let x = 1; x <= 14; x++) set(x, 9, outline);
      // Wall
      for (let y = 10; y <= 14; y++) {
        for (let x = 1; x <= 14; x++) set(x, y, x === 1 || x === 14 ? outline : art.wall);
      }
      // Windows
      for (const wx of [3, 11]) {
        for (let y = 11; y <= 12; y++) for (let x = wx; x <= wx + 1; x++) set(x, y, y === 11 ? '#7e95a8' : '#3b4a5a');
        set(wx - 1, 13, art.trim); set(wx, 13, art.trim); set(wx + 1, 13, art.trim); set(wx + 2, 13, art.trim);
      }
      // Door
      for (let y = 11; y <= 14; y++) for (let x = 7; x <= 8; x++) set(x, y, art.door);
      set(6, 10, art.trim); set(7, 10, art.trim); set(8, 10, art.trim); set(9, 10, art.trim);
      emblem(set, art);
    });
  }

  function emblem(set, art) {
    switch (art.emblem) {
      case 'bigdoor': // roller door
        for (let y = 10; y <= 14; y++) for (let x = 5; x <= 10; x++) set(x, y, y % 2 ? '#5b4a38' : art.door);
        break;
      case 'barn': // white X on the barn door and white roof trim
        for (let y = 10; y <= 14; y++) for (let x = 6; x <= 9; x++) set(x, y, art.door);
        for (let i = 0; i < 4; i++) { set(6 + i, 11 + i, art.trim); set(9 - i, 11 + i, art.trim); }
        for (let x = 6; x <= 9; x++) set(x, 10, art.trim);
        break;
      case 'bread': // loaf on a sign
        for (let x = 5; x <= 10; x++) { set(x, 5, '#3b2f25'); set(x, 8, '#3b2f25'); }
        for (let x = 6; x <= 9; x++) { set(x, 6, '#d9a25a'); set(x, 7, '#b77a36'); }
        set(5, 6, '#3b2f25'); set(5, 7, '#3b2f25'); set(10, 6, '#3b2f25'); set(10, 7, '#3b2f25');
        set(7, 6, '#f0c987');
        break;
      case 'sails': { // windmill sails across the roof
        const wood = '#4a3726', cloth = '#e6dfd0';
        for (let i = -3; i <= 3; i++) {
          set(7 + i, 4 + i, i === 0 ? wood : cloth);
          set(8 + i, 4 - i, cloth);
        }
        set(7, 4, wood); set(8, 4, wood);
        break;
      }
      case 'awning': // striped market awning
        for (let x = 1; x <= 14; x++) { set(x, 9, x % 2 ? '#e8e2d4' : '#3f7a4e'); set(x, 10, x % 2 ? '#d4cdbd' : '#2f5e3b'); }
        break;
      case 'stripes': // hazard stripes
        for (let x = 2; x <= 13; x++) set(x, 14, (x >> 1) % 2 ? '#2b2b2b' : '#e0b030');
        break;
      case 'stones':
        [[4, 6], [5, 6], [5, 5], [9, 6], [10, 6], [10, 5], [11, 6]].forEach(([x, y]) => set(x, y, '#bdb6aa'));
        break;
      case 'logs':
        for (const lx of [3, 11]) { set(lx, 11, '#c9a46c'); set(lx + 1, 11, '#c9a46c'); set(lx, 12, '#8a6440'); set(lx + 1, 12, '#8a6440'); }
        break;
      case 'wheel':
        [[11, 11], [12, 11], [10, 12], [13, 12], [11, 13], [12, 13]].forEach(([x, y]) => set(x, y, '#222222'));
        set(11, 12, '#9a9a9a'); set(12, 12, '#9a9a9a');
        break;
      case 'flag':
        for (let y = 2; y <= 6; y++) for (let x = 6; x <= 9; x++) set(x, y, (x + y) % 2 ? '#111111' : '#f5f5f5');
        break;
      case 'drop':
        [[7, 5], [8, 5], [6, 6], [7, 6], [8, 6], [9, 6], [7, 7], [8, 7]].forEach(([x, y]) => set(x, y, '#d9b43a'));
        set(7, 4, '#d9b43a');
        break;
    }
  }

  // ---------------------------------------------------------------- registry

  const cache = new Map();
  function get(key, factory) {
    let s = cache.get(key);
    if (!s) {
      s = factory();
      cache.set(key, s);
    }
    return s;
  }

  const GRASS_VARIANTS = 4;

  TG.sprites = {
    TILE, C, createCanvas, makeSprite, fromStrings,
    grass: v => get('grass' + (v % GRASS_VARIANTS), () => grass(v % GRASS_VARIANTS)),
    flowers: v => get('flowers' + (v % 3), () => flowers(v % 3)),
    water: v => get('water' + (v % 3), () => water(v % 3)),
    tree: () => get('tree', () => fromStrings(TREE_ROWS, TREE_PAL)),
    rock: () => get('rock', () => fromStrings(ROCK_ROWS, ROCK_PAL)),
    track: (type, rot, platformDir) =>
      get('track:' + type + ':' + rot + ':' + platformDir, () => track(type, rot, platformDir)),
    building: kind => get('building:' + kind, () => building(TG.themes.stationKind(kind).art)),
  };
})(globalThis.TG = globalThis.TG || {});
