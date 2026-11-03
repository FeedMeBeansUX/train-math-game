/*
 * Side-view pixel art: train, station buildings and landscape layers.
 *
 * The side view is drawn at 512x288 art pixels. The train runs on rails whose
 * top is at y = RAIL_Y; station platforms are at y = PLATFORM_Y.
 */
(function (TG) {
  'use strict';

  const S = TG.sprites;
  const { makeSprite, shade, shadeHex } = S;
  const { hash2, valueNoise, rng } = TG.util;

  const W = 512, H = 288;
  const RAIL_Y = 230;
  const PLATFORM_Y = 214;
  const STRIP = 1024; // width of repeating landscape strips

  const BLACK = '#232428', BLACK2 = '#34363b', BRASS = '#c9a646', BRASS_D = '#8f7530';
  const RED = '#a3312a', RED_L = '#c4483d', RED_D = '#6e1f1a';

  // ================================================================ train

  const LOCO_W = 64, LOCO_H = 40;
  const WAGON_W = 44, WAGON_H = 30;

  function locomotive() {
    const G = ['#1d3a27', '#2a5235', '#386a45', '#4b8457', '#66a171'];
    return makeSprite(LOCO_W, LOCO_H, set => {
      // Footplate and buffer beams
      set.rect(2, 27, 60, 29, BLACK);
      set.rect(2, 27, 60, 27, BLACK2);
      set.rect(59, 24, 62, 31, RED);
      set.rect(59, 24, 62, 24, RED_L);
      set.rect(0, 24, 2, 31, RED);
      set.rect(63, 25, 63, 26, '#9a9a9a');
      set.rect(63, 29, 63, 30, '#9a9a9a');
      // Boiler with cylindrical shading
      for (let y = 12; y <= 26; y++) {
        const t = (y - 12) / 14;
        const col = t < 0.08 ? G[0] : t < 0.25 ? G[4] : t < 0.45 ? G[3] : t < 0.8 ? G[2] : t < 0.95 ? G[1] : G[0];
        set.rect(18, y, 52, y, col);
      }
      for (const bx of [27, 37, 47]) for (let y = 13; y <= 25; y++) set(bx, y, y < 17 ? BRASS : BRASS_D);
      // Smokebox and chimney
      for (let y = 11; y <= 26; y++) set.rect(52, y, 57, y, y < 14 ? BLACK2 : BLACK);
      set.rect(57, 13, 57, 25, '#4a4c52');
      set.rect(52, 3, 56, 10, BLACK);
      set.rect(51, 1, 57, 2, BLACK2);
      set.rect(53, 3, 53, 10, '#4a4c52');
      // Steam dome and whistle
      set.rect(38, 7, 41, 7, BRASS);
      set.rect(37, 8, 42, 11, BRASS);
      set.rect(37, 9, 37, 11, BRASS_D);
      set.rect(39, 8, 39, 9, '#f0dc8a');
      set.rect(30, 8, 30, 11, BRASS_D);
      set.rect(29, 7, 31, 7, BRASS);
      // Cab
      for (let y = 6; y <= 26; y++) set.rect(3, y, 19, y, y < 8 ? G[3] : y > 24 ? G[0] : G[2]);
      set.rect(1, 3, 21, 5, BLACK);
      set.rect(1, 3, 21, 3, BLACK2);
      set.rect(8, 10, 15, 16, '#e0d6b0');
      set.rect(9, 11, 14, 15, '#9cbfd6');
      set.rect(9, 11, 10, 12, '#d8e8f2');
      set.rect(5, 18, 17, 18, '#d8c070');
      set.rect(5, 24, 17, 24, '#d8c070');
      set.rect(5, 18, 5, 24, '#d8c070');
      set.rect(17, 18, 17, 24, '#d8c070');
      set.rect(9, 20, 13, 22, BRASS);
      set.rect(19, 6, 19, 26, G[0]);
      // Front lamp
      set.rect(58, 18, 60, 20, '#f2efe6');
      set(59, 19, '#ffe58a');
      // Cylinder
      set.rect(48, 28, 58, 32, G[1]);
      set.rect(48, 28, 58, 28, G[3]);
      set.rect(48, 32, 58, 32, G[0]);
      set.rect(53, 28, 53, 32, BRASS_D);
    });
  }

  const WAGON_COLORS = ['#7a4a2e', '#6b7176', '#4d6a50', '#8a6a3a', '#6e4a5a'];

  function wagon(color) {
    return makeSprite(WAGON_W, WAGON_H, set => {
      for (let y = 8; y <= 21; y++) {
        for (let x = 2; x <= 41; x++) {
          let col = color;
          if (x % 4 === 1) col = shadeHex(color, -28);
          else if (y < 11) col = shadeHex(color, 14);
          set(x, y, col);
        }
      }
      set.rect(2, 7, 41, 8, shadeHex(color, -45));
      set.rect(2, 21, 41, 22, shadeHex(color, -45));
      for (const sx of [2, 3, 21, 22, 40, 41]) set.rect(sx, 9, sx, 20, '#3a3a3c');
      set.rect(12, 14, 31, 14, '#3a3a3c');
      // Chassis, axle boxes and buffers
      set.rect(3, 23, 40, 24, BLACK);
      set.rect(9, 23, 13, 26, BLACK2);
      set.rect(30, 23, 34, 26, BLACK2);
      set.rect(0, 19, 1, 21, '#9a9a9a');
      set.rect(42, 19, 43, 21, '#9a9a9a');
    });
  }

  /**
   * Wheel sprite for one rotation frame. Frames cover one spoke interval, so
   * the wheel must be symmetric per spoke (no counterweight).
   */
  function wheel(r, spokes, frame, frames, driver) {
    const size = Math.ceil(r * 2) + 1;
    const c = size / 2;
    const rot = (frame / frames) * (2 * Math.PI / spokes);
    return makeSprite(size, size, set => {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x + 0.5 - c, dy = y + 0.5 - c;
          const d = Math.hypot(dx, dy);
          if (d > r) continue;
          const ang = Math.atan2(dy, dx);
          let col;
          if (d > r - 1.2) col = dy < -r * 0.4 ? '#55565b' : '#2a2a2c';
          else if (d > r - 2.2) col = driver ? RED : '#4a4b50';
          else if (d < 1.6) col = driver ? BRASS : '#8a8b90';
          else {
            col = driver ? RED_D : '#1c1c1e';
            for (let k = 0; k < spokes; k++) {
              const diff = Math.abs(((ang - rot - (k * 2 * Math.PI) / spokes) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI);
              if (diff * d < 0.75) col = driver ? RED_L : '#5a5b60';
            }
          }
          set(x, y, col);
        }
      }
    });
  }

  // ================================================================ station buildings (side view)

  function wallColor(art, x, y) {
    const c = art.wall;
    switch (art.wallType) {
      case 'plank': return x % 4 === 0 ? shadeHex(c, -24) : c;
      case 'metal': return x % 3 === 0 ? shadeHex(c, -14) : x % 3 === 1 ? shadeHex(c, 8) : c;
      case 'plaster': return hash2(x, y, 61) < 0.12 ? shadeHex(c, -8) : c;
      default: {
        const row = Math.floor(y / 4);
        return y % 4 === 3 || (x + (row % 2) * 4) % 8 === 0 ? shadeHex(c, -22) : c;
      }
    }
  }

  function drawWindow(set, art, x, y, w, h) {
    set.rect(x - 1, y - 1, x + w, y + h, art.trim);
    set.rect(x, y, x + w - 1, y + h - 1, '#34495c');
    set.rect(x, y, x + w - 1, y + 1, '#4d6680');
    set.rect(x + (w >> 1), y, x + (w >> 1), y + h - 1, art.trim);
    set.rect(x, y + (h >> 1), x + w - 1, y + (h >> 1), art.trim);
    set(x + 1, y + 2, '#a9c3d8');
    set(x + 2, y + 1, '#a9c3d8');
    set.rect(x - 2, y + h, x + w + 1, y + h + 1, shadeHex(art.trim, -30));
  }

  /** Pitched roof seen from the side: trapezoid with tile rows. */
  function roof(set, art, x0, x1, yTop, yBottom, inset) {
    const [light, dark] = art.roof;
    for (let y = yTop; y <= yBottom; y++) {
      const t = (y - yTop) / Math.max(1, yBottom - yTop);
      const a = Math.round(x0 + inset * (1 - t)), b = Math.round(x1 - inset * (1 - t));
      for (let x = a; x <= b; x++) {
        let col = (y - yTop) % 4 === 3 ? dark : light;
        if ((y - yTop) % 4 !== 3 && (x + Math.floor((y - yTop) / 4) * 3) % 6 === 0) col = shadeHex(light, -12);
        if (x === a || x === b || y === yTop) col = '#26221e';
        set(x, y, col);
      }
    }
    set.rect(x0, yBottom + 1, x1, yBottom + 1, '#26221e');
  }

  function genericBuilding(art, opts) {
    const w = opts.w || 104, h = opts.h || 80, roofH = opts.roofH || 26;
    return makeSprite(w, h, set => {
      for (let y = roofH; y < h; y++) for (let x = 4; x < w - 4; x++) set(x, y, wallColor(art, x, y));
      set.rect(4, roofH, 4, h - 1, '#26221e');
      set.rect(w - 5, roofH, w - 5, h - 1, '#26221e');
      set.rect(5, roofH + 2, w - 6, roofH + 3, 'rgba(0,0,0,0.25)');
      roof(set, art, 0, w - 1, 4, roofH - 1, 18);
      set.rect(w - 30, 0, w - 24, 10, '#7d4a3a');
      set.rect(w - 30, 0, w - 24, 1, '#4a2c22');
      if (opts.paint) opts.paint(set, w, h, roofH);
    });
  }

  function sideBuilding(kind) {
    const art = TG.themes.stationKind(kind).art;
    switch (art.emblem) {
      case 'bigdoor': return { sprite: warehouse(art) };
      case 'barn': return { sprite: barn(art) };
      case 'bread': return { sprite: bakery(art) };
      case 'sails': return mill(art);
      case 'awning': return market(art);
      default: return {
        sprite: genericBuilding(art, {
          paint: (set, w, h) => {
            drawWindow(set, art, 14, 46, 14, 14);
            drawWindow(set, art, w - 28, 46, 14, 14);
            set.rect(w / 2 - 8, h - 26, w / 2 + 7, h - 1, art.trim);
            set.rect(w / 2 - 6, h - 24, w / 2 + 5, h - 1, art.door);
            set.rect(w / 2 - 16, 30, w / 2 + 15, 38, art.roof[1]);
          },
        }),
      };
    }
  }

  function warehouse(art) {
    return genericBuilding(art, {
      w: 124, h: 84, roofH: 20,
      paint: (set, w, h) => {
        for (const dx of [14, 66]) {
          set.rect(dx - 1, 34, dx + 44, h - 1, art.trim);
          for (let y = 35; y < h; y++) set.rect(dx, y, dx + 43, y, y % 3 ? '#5d6066' : '#4a4d52');
          set.rect(dx + 21, 35, dx + 22, h - 1, '#3a3d42');
        }
        set.rect(48, 23, 75, 30, '#3b3f45');
        set.rect(49, 24, 74, 29, '#f2d36b');
      },
    });
  }

  function barn(art) {
    const w = 112, h = 92;
    const outline = '#26221e';
    return makeSprite(w, h, set => {
      // Gambrel roof outline: left foot, left knee, peak, right knee, right foot
      const pts = [[0, 46], [16, 20], [56, 4], [96, 20], [112, 46]];
      const roofTop = x => {
        for (let i = 0; i < pts.length - 1; i++) {
          const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
          if (x >= ax && x <= bx) return ay + ((by - ay) * (x - ax)) / (bx - ax);
        }
        return 46;
      };
      for (let x = 0; x < w; x++) {
        const top = Math.round(roofTop(x));
        for (let y = top; y <= 46; y++) {
          const edge = y - top < 2;
          set(x, y, edge ? art.trim : (y + Math.floor(x / 5)) % 4 === 0 ? art.roof[1] : art.roof[0]);
        }
      }
      // Gable wall (red planks) below the roof
      for (let y = 30; y < h; y++) {
        for (let x = 8; x < w - 8; x++) {
          if (y < roofTop(x) + 6) continue;
          set(x, y, wallColor(art, x, y));
        }
      }
      set.rect(8, 46, 8, h - 1, outline);
      set.rect(w - 9, 46, w - 9, h - 1, outline);
      // Big doors with white X frames
      for (const dx of [38, 56]) {
        set.rect(dx, 56, dx + 17, h - 1, art.trim);
        set.rect(dx + 2, 58, dx + 15, h - 1, art.door);
        for (let i = 0; i <= 13; i++) {
          const yy = 58 + Math.round((i * (h - 59)) / 13);
          set(dx + 2 + i, yy, art.trim);
          set(dx + 15 - i, yy, art.trim);
        }
      }
      // Hay loft
      set.rect(48, 30, 63, 46, art.trim);
      set.rect(50, 32, 61, 46, '#3b2a1c');
      set.rect(50, 40, 61, 46, '#d9b85a');
      set.rect(51, 38, 58, 40, '#e8cc75');
      drawWindow(set, art, 16, 62, 10, 10);
      drawWindow(set, art, w - 26, 62, 10, 10);
    });
  }

  function bakery(art) {
    return genericBuilding(art, {
      w: 108, h: 84, roofH: 28,
      paint: (set, w, h) => {
        // Shop window with loaves on a shelf
        set.rect(10, 50, 50, 72, art.trim);
        set.rect(12, 52, 48, 70, '#3a4652');
        set.rect(12, 64, 48, 65, '#6b4a2f');
        for (const lx of [16, 26, 36, 44]) {
          set.ellipse(lx + 1, 61, 4, 2.6, '#b97a36');
          set.ellipse(lx + 1, 60.5, 3, 1.6, '#d9a25a');
        }
        for (const lx of [18, 30, 42]) set.ellipse(lx, 68, 3.5, 1.8, '#c98a3e');
        // Striped awning above the window
        for (let x = 8; x <= 52; x++) {
          const col = Math.floor(x / 4) % 2 ? '#f0e8d6' : '#c4602c';
          set.rect(x, 42, x, 47, col);
          if (x % 4 !== 0) set(x, 48, col);
        }
        // Door and sign
        set.rect(62, 56, 77, h - 1, art.trim);
        set.rect(64, 58, 75, h - 1, art.door);
        set(73, 70, '#d8c070');
        set.rect(60, 34, 98, 46, '#3b2f25');
        set.rect(62, 36, 96, 44, '#e9dfc8');
        set.ellipse(79, 40, 9, 3.2, '#b97a36');
        set.ellipse(79, 39.4, 7, 2, '#d9a25a');
        drawWindow(set, art, 84, 54, 12, 12);
      },
    });
  }

  function market(art) {
    const w = 132, h = 52;
    const produce = [['#c8382c', '#e05a48'], ['#6a9a3a', '#86b84a'], ['#e0882a', '#f0a640']];
    return {
      sprite: makeSprite(w, h, set => {
        for (let i = 0; i < 3; i++) {
          const x0 = 4 + i * 42;
          // Posts
          set.rect(x0 + 1, 10, x0 + 2, h - 1, '#5a4330');
          set.rect(x0 + 35, 10, x0 + 36, h - 1, '#5a4330');
          // Awning
          for (let x = x0 - 2; x <= x0 + 38; x++) {
            const col = Math.floor((x - x0) / 5) % 2 ? '#ebe4d3' : (i === 1 ? '#c4483d' : '#2f7a46');
            set.rect(x, 4, x, 12, col);
            if ((x - x0) % 5 !== 0) set(x, 13, col);
          }
          set.rect(x0 - 2, 3, x0 + 38, 3, '#26221e');
          // Counter with crates of produce
          set.rect(x0, 34, x0 + 37, h - 1, '#7a5a3a');
          set.rect(x0, 34, x0 + 37, 35, '#916f47');
          for (let x = x0 + 4; x < x0 + 37; x += 9) set.rect(x, 36, x, h - 1, '#5e4329');
          for (let c = 0; c < 3; c++) {
            const [dark, light] = produce[(i + c) % 3];
            const cx = x0 + 3 + c * 12;
            set.rect(cx, 28, cx + 9, 33, '#a07a50');
            for (let k = 0; k < 5; k++) {
              set.ellipse(cx + 1.5 + k * 1.8, 27 - (k % 2), 1.6, 1.6, k % 2 ? light : dark);
            }
          }
        }
      }),
    };
  }

  /** Windmill tower; the sails are drawn separately so they can turn. */
  function mill(art) {
    const w = 96, h = 124;
    const sprite = makeSprite(w, h, set => {
      for (let y = 34; y < h; y++) {
        const t = (y - 34) / (h - 34);
        const half = 17 + t * 11;
        for (let x = Math.round(48 - half); x <= Math.round(48 + half); x++) {
          let col = wallColor(art, x, y);
          if (x - (48 - half) < 3) col = shadeHex(art.wall, 18);
          if ((48 + half) - x < 3) col = shadeHex(art.wall, -26);
          set(x, y, col);
        }
      }
      // Gallery / balcony
      set.rect(14, 78, 82, 80, '#4a3726');
      for (let x = 16; x <= 80; x += 4) set.rect(x, 72, x, 77, '#4a3726');
      set.rect(14, 71, 82, 71, '#4a3726');
      // Cap
      for (let y = 18; y <= 35; y++) {
        const half = 8 + ((y - 18) / 17) * 13;
        set.rect(Math.round(48 - half), y, Math.round(48 + half), y, y < 22 ? art.roof[0] : (y % 3 ? art.roof[0] : art.roof[1]));
      }
      set.rect(26, 35, 70, 36, '#26221e');
      drawWindow(set, art, 42, 50, 10, 12);
      drawWindow(set, art, 42, 88, 10, 10);
      set.rect(40, h - 22, 55, h - 1, art.trim);
      set.rect(42, h - 20, 53, h - 1, art.door);
    });
    return { sprite, sails: { x: 48, y: 26, len: 46 } };
  }

  /** Four lattice sails around (cx, cy), drawn straight into a 2D context. */
  function drawSails(ctx, cx, cy, len, angle) {
    for (let k = 0; k < 4; k++) {
      const a = angle + (k * Math.PI) / 2;
      const ux = Math.cos(a), uy = Math.sin(a);
      const px = -uy, py = ux;
      for (let t = 0; t <= len; t++) {
        const x = cx + ux * t, y = cy + uy * t;
        ctx.fillStyle = '#4a3726';
        ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
        if (t > 6) {
          for (let s = 2; s <= 8; s++) {
            const lattice = t % 4 === 0 || s === 8;
            ctx.fillStyle = lattice ? '#5e4630' : ((t + s) % 2 ? '#ebe4d3' : '#d6cdb8');
            ctx.fillRect(Math.round(x + px * s), Math.round(y + py * s), 1, 1);
          }
        }
      }
    }
    ctx.fillStyle = '#26221e';
    ctx.fillRect(Math.round(cx) - 2, Math.round(cy) - 2, 5, 5);
  }

  // ================================================================ landscape

  function sky() {
    const bands = ['#5f9bd0', '#6ca6d6', '#7ab1db', '#89bce0', '#99c6e4', '#aacfe7', '#bbd9eb', '#cde3ee'];
    return makeSprite(W, H, set => {
      for (let y = 0; y < H; y++) {
        const f = Math.min(bands.length - 1, (y / 190) * (bands.length - 1));
        const i = Math.floor(f), frac = f - i;
        for (let x = 0; x < W; x++) {
          const dither = ((x + y) % 2 === 0 ? 0.25 : 0.75) * (((x >> 1) + (y >> 1)) % 2 ? 1 : 0.6);
          set(x, y, bands[Math.min(bands.length - 1, i + (frac > dither ? 1 : 0))]);
        }
      }
      set.ellipse(420, 52, 20, 20, 'rgba(255,248,214,0.25)');
      set.ellipse(420, 52, 12, 12, '#fff3c4');
      set.ellipse(418, 50, 8, 8, '#fffbe6');
    });
  }

  function clouds() {
    const r = rng(77);
    return makeSprite(STRIP, 110, set => {
      for (let c = 0; c < 7; c++) {
        const cx = 60 + c * 140 + r() * 60, cy = 30 + r() * 50, size = 12 + r() * 10;
        const puffs = [];
        for (let k = 0; k < 6; k++) puffs.push([cx + (k - 2.5) * size * 0.7, cy - r() * size * 0.5, size * (0.55 + r() * 0.4)]);
        for (let y = Math.floor(cy - size * 1.6); y <= cy + 4; y++) {
          for (let x = Math.floor(cx - size * 3); x <= cx + size * 3; x++) {
            let inside = false;
            for (const [px, py, pr] of puffs) if (Math.hypot(x - px, (y - py) * 1.3) < pr) inside = true;
            if (!inside || y > cy + 3) continue;
            const xx = ((x % STRIP) + STRIP) % STRIP;
            set(xx, y, y > cy - 2 ? '#d6e2ec' : y > cy - size * 0.4 ? '#eef3f7' : '#ffffff');
          }
        }
      }
    });
  }

  /** Periodic height line for a strip, from a few sine waves with whole periods. */
  function heights(seed, base, amp) {
    const r = rng(seed);
    const waves = [1, 2, 3, 5, 8].map(k => ({ k, a: amp / k ** 0.7, p: r() * Math.PI * 2 }));
    const out = new Float32Array(STRIP);
    for (let x = 0; x < STRIP; x++) {
      let h = base;
      for (const w of waves) h += w.a * Math.sin((2 * Math.PI * w.k * x) / STRIP + w.p);
      out[x] = h;
    }
    return out;
  }

  function farHills(theme) {
    const hs = heights(11, 152, 9);
    return makeSprite(STRIP, H, set => {
      for (let x = 0; x < STRIP; x++) {
        const top = Math.round(hs[x]);
        for (let y = top; y < H; y++) set(x, y, y === top ? '#a5c3a2' : y < top + 3 ? '#93b592' : '#86aa88');
      }
      // Distant tree clumps and windmills as silhouettes
      const r = rng(12);
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(r() * STRIP), top = Math.round(hs[x]);
        set.ellipse(x, top - 2, 3 + r() * 3, 3, '#759a78');
      }
      if (theme === 'farm') {
        for (const x of [180, 610, 880]) {
          const top = Math.round(hs[x]);
          set.rect(x - 1, top - 14, x + 1, top, '#6d8f70');
          set.rect(x - 2, top - 16, x + 2, top - 14, '#6d8f70');
          for (let t = -7; t <= 7; t++) { set(x + t, top - 15 + t, '#6d8f70'); set(x + t, top - 15 - t, '#6d8f70'); }
        }
      }
    });
  }

  function midHills(theme) {
    const hs = heights(21, 182, 7);
    const r = rng(22);
    const fields = [];
    for (let x = 0; x < STRIP;) {
      const len = 60 + Math.floor(r() * 90);
      fields.push({ x0: x, x1: x + len, kind: Math.floor(r() * 3) });
      x += len + 20 + Math.floor(r() * 40);
    }
    const sprite = makeSprite(STRIP, H, set => {
      for (let x = 0; x < STRIP; x++) {
        const top = Math.round(hs[x]);
        for (let y = top; y < H; y++) {
          let col = y === top ? '#7fae5c' : (hash2(x, y, 23) < 0.15 ? '#5f8f45' : '#6a9a4f');
          if (theme === 'farm') {
            for (const f of fields) {
              if (x >= f.x0 && x <= f.x1 && y > top + 3) {
                const row = (y - top) % 4 < 2;
                col = f.kind === 0 ? (row ? '#c9b55a' : '#b8a24a') : f.kind === 1 ? (row ? '#7ea44a' : '#6c9040') : (row ? '#8a6a48' : '#7a5c3d');
              }
            }
          }
          set(x, y, col);
        }
      }
    });
    // Trees on the ridge (drawn onto the strip with the top-down tree sprites)
    const ctx = sprite.getContext('2d');
    for (let i = 0; i < 18; i++) {
      const x = Math.floor(r() * (STRIP - 32));
      const top = Math.round(hs[x + 16]);
      const tree = S.tree(Math.floor(r() * 4));
      ctx.drawImage(tree, x, top - 26);
      if (x > STRIP - 64) ctx.drawImage(tree, x - STRIP, top - 26);
    }
    return sprite;
  }

  function foreground() {
    return makeSprite(STRIP, 40, set => {
      for (let x = 0; x < STRIP; x++) {
        const top = 26 + Math.round(valueNoise(x / 9, 0, 41) * 6);
        for (let y = top; y < 40; y++) set(x, y, hash2(x, y, 42) < 0.2 ? '#2f5222' : '#3a6128');
        if (hash2(x, 0, 43) < 0.25) {
          const hgt = 3 + Math.floor(hash2(x, 1, 44) * 6);
          for (let k = 1; k <= hgt; k++) set(x, top - k, k === hgt ? '#5c8a3e' : '#47722f');
        }
      }
    });
  }

  /** Round puff of steam with a lit top and a greyer underside. */
  function puff(r) {
    const size = r * 2 + 2;
    return makeSprite(size, size, set => {
      const c = size / 2;
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const dx = x + 0.5 - c, dy = y + 0.5 - c;
          if (dx * dx + dy * dy > r * r) continue;
          const v = -(dx * 0.4 + dy * 0.9) / r;
          set(x, y, v > 0.35 ? '#ffffff' : v > -0.3 ? '#ecedeb' : '#cfd0cd');
        }
      }
    });
  }

  function haybale() {
    return makeSprite(16, 14, set => {
      set.ellipse(8, 12.5, 8, 2, S.C.shadow);
      set.ellipse(8, 7, 7, 6.5, '#b8963e');
      set.ellipse(7.5, 6.5, 5.5, 5, '#d9b85a');
      set.ellipse(7, 6, 3, 2.8, '#c8a64a');
      set.ellipse(7, 6, 1.2, 1.2, '#e8cc75');
    });
  }

  function bush(seed) {
    const r = rng(seed);
    return makeSprite(24, 14, set => {
      const blobs = [[12, 9, 8, 5], [7, 10, 5, 4], [17, 10, 5, 4], [11, 6, 5, 4]].map(b => [b[0] + r() * 2 - 1, b[1], b[2], b[3]]);
      for (let y = 0; y < 14; y++) {
        for (let x = 0; x < 24; x++) {
          let hit = false;
          for (const [cx, cy, rx, ry] of blobs) if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1) hit = true;
          if (!hit) continue;
          const v = 0.7 - y / 16 + (valueNoise(x / 2, y / 2, seed) - 0.5) * 0.5;
          set(x, y, shade(['#2c4a22', '#3a6129', '#4a7a35', '#5f9143'], v));
        }
      }
    });
  }


  // ================================================================ goods (8x8 icons)

  const GOOD_ICONS = {
    apple: [['....gl..', '...g....', '.rRrrrd.', 'rRRrrrrd', 'rRrrrrrd', 'rrrrrrrd', '.rrrrdd.', '..dddd..'],
      { r: '#c8382c', R: '#e86a5a', d: '#8a2018', g: '#5a3a20', l: '#5f9143' }],
    chicken: [['.....rr.', '....www.', '....wkwy', 'ww.wwww.', 'wwwwwww.', 'wWwwwww.', '.wWWWw..', '..y..y..'],
      { w: '#f4f1ea', W: '#c9c4b8', r: '#d23a2c', k: '#1a1a1a', y: '#e0a030' }],
    flour: [['..t..t..', '...tt...', '..wwww..', '.wwwwww.', 'wwwwwwww', 'wwFFwwwW', 'wwwwwwwW', '.WWWWWW.'],
      { t: '#8a6a48', w: '#efe9da', W: '#c8bfaa', F: '#7a9ac0' }],
    grain: [['..t..t..', '...tt...', '..wwww..', '.wwwwww.', 'wwwwwwww', 'wwFFwwwW', 'wwwwwwwW', '.WWWWWW.'],
      { t: '#5a3a20', w: '#c9a46c', W: '#9c7c4c', F: '#f0d68a' }],
    egg: [['...ww...', '..wwww..', '.wwHwww.', '.wHwwww.', 'wwwwwwwW', 'wwwwwwwW', '.wwwwWW.', '..WWWW..'],
      { w: '#f0e2c4', H: '#fffaf0', W: '#cdb894' }],
    milk: [['..dddd..', '...gg...', '..gggg..', '.gHgggd.', '.gHgggd.', '.gggggd.', '.dddddd.', '..d..d..'],
      { g: '#b8bcc2', H: '#e6e9ec', d: '#6d7178' }],
    hay: [['........', 'yyyyyyyy', 'yYyyyYyy', 'yyyyyyyy', 'bbbbbbbb', 'yyyyyyyy', 'yyYyyyYy', 'dddddddd'],
      { y: '#d9b85a', Y: '#f0d68a', b: '#8a6a3a', d: '#a8893c' }],
    cheese: [['........', '..yyyy..', '.yYyyyy.', 'yyyyyyyy', 'oooooooo', 'yyyyyyyy', '.dyyyyd.', '..dddd..'],
      { y: '#f0c850', Y: '#fbe59a', o: '#d9a530', d: '#b88a28' }],
    bread: [['........', '..bbbb..', '.bBbBbb.', 'bBbBbBbb', 'bbbbbbbb', 'dbbbbbbd', '.dddddd.', '........'],
      { b: '#c98a3e', B: '#f0c987', d: '#8a5426' }],
    bricks: [['........', 'rrrmrrrr', 'mmmmmmmm', 'rmrrrrmr', 'mmmmmmmm', 'rrrmrrrr', 'mmmmmmmm', 'rmrrrrmr'],
      { r: '#a8473a', m: '#d9cfc0' }],
    planks: [['........', 'pppppppp', 'dddddddd', 'PPPPPPPP', 'dddddddd', 'pppppppp', 'dddddddd', '........'],
      { p: '#c9a46c', P: '#b08a54', d: '#6b4a2f' }],
    stones: [['........', '...gg...', '..gGgg..', '.ggggdg.', 'gGggdggd', 'gggddggd', '.dddddd.', '........'],
      { g: '#9a958c', G: '#c4bfb5', d: '#6a665f' }],
    tyre: [['..kkkk..', '.kkkkkk.', 'kkk..kkk', 'kk.gg.kk', 'kk.gg.kk', 'kkk..kkk', '.kkkkkk.', '..kkkk..'],
      { k: '#2a2a2c', g: '#9a9a9a' }],
    fuel: [['.rrrrrr.', 'rRrrrrrd', 'dddddddd', 'rRrrrrrd', 'rRrrrrrd', 'dddddddd', 'rRrrrrrd', '.rrrrrr.'],
      { r: '#c4483d', R: '#e87a6a', d: '#7e241f' }],
  };

  function goodIcon(good) {
    const [rows, pal] = GOOD_ICONS[good];
    return makeSprite(8, 8, set => {
      rows.forEach((row, y) => {
        if (row.length !== 8) throw new Error('Icon ' + good + ' row ' + y + ' has wrong length');
        for (let x = 0; x < 8; x++) if (row[x] !== '.') set(x, y, pal[row[x]]);
      });
    });
  }

  /** Wooden crate the warehouse keeps goods in. */
  function crate() {
    return makeSprite(28, 14, set => {
      set.rect(0, 0, 27, 13, '#6b4a2f');
      for (let y = 1; y <= 12; y++) for (let x = 1; x <= 26; x++) set(x, y, y % 4 === 0 ? '#7a5a3a' : '#a07a50');
      set.rect(1, 1, 26, 1, '#b8936a');
      set.rect(1, 1, 2, 12, '#7a5a3a');
      set.rect(25, 1, 26, 12, '#7a5a3a');
      set.rect(0, 13, 27, 13, '#4a3324');
    });
  }

  // ================================================================ registry

  const cache = new Map();
  function get(key, f) {
    if (!cache.has(key)) cache.set(key, f());
    return cache.get(key);
  }
  const WHEEL_FRAMES = 8;

  TG.sideSprites = {
    W, H, RAIL_Y, PLATFORM_Y, STRIP, LOCO_W, LOCO_H, WAGON_W, WAGON_H, WAGON_COLORS, WHEEL_FRAMES,
    locomotive: () => get('loco', locomotive),
    wagon: i => get('wagon' + (i % WAGON_COLORS.length), () => wagon(WAGON_COLORS[i % WAGON_COLORS.length])),
    wheel: (kind, frame) => get('wheel:' + kind + ':' + frame, () =>
      kind === 'driver' ? wheel(6.5, 10, frame, WHEEL_FRAMES, true)
        : kind === 'small' ? wheel(4, 6, frame, WHEEL_FRAMES, false)
          : wheel(4.5, 6, frame, WHEEL_FRAMES, false)),
    building: kind => get('sideBuilding:' + kind, () => sideBuilding(kind)),
    drawSails,
    sky: () => get('sky', sky),
    clouds: () => get('clouds', clouds),
    farHills: theme => get('far:' + theme, () => farHills(theme)),
    midHills: theme => get('mid:' + theme, () => midHills(theme)),
    foreground: () => get('fg', foreground),
    haybale: () => get('hay', haybale),
    puff: r => get('puff' + r, () => puff(Math.max(1, r))),
    goodIcon: g => get('good:' + g, () => goodIcon(g)),
    crate: () => get('crate', crate),
    GOOD_ICONS,
    bush: v => get('bush' + (v % 3), () => bush(300 + (v % 3))),
  };
})(globalThis.TG = globalThis.TG || {});
