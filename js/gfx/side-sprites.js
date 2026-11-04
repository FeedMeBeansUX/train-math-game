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
      case 'stripes': return { sprite: buildingSite(art) };
      case 'flag': return { sprite: grandstand(art) };
      case 'drop': return { sprite: fuelStation(art, kind) };
      case 'bell': return { sprite: school(art, kind) };
      default: return {
        sprite: genericBuilding(art, {
          paint: (set, w, h) => {
            drawWindow(set, art, 14, 46, 14, 14);
            drawWindow(set, art, w - 28, 46, 14, 14);
            set.rect(w / 2 - 8, h - 26, w / 2 + 7, h - 1, art.trim);
            set.rect(w / 2 - 6, h - 24, w / 2 + 5, h - 1, art.door);
            iconSign(set, w / 2 - 14, 28, TG.themes.stationKind(kind).wants[0], art);
          },
        }),
      };
    }
  }

  /** A sign board showing a good's icon at double size (what the station is about). */
  function iconSign(set, x, y, good, art) {
    set.rect(x, y, x + 27, y + 19, '#3b2f25');
    set.rect(x + 1, y + 1, x + 26, y + 18, art.trim);
    const icon = GOOD_ICONS[good];
    if (!icon) return;
    const [rows, pal] = icon;
    rows.forEach((row, iy) => {
      for (let ix = 0; ix < 8; ix++) {
        if (row[ix] !== '.') set.rect(x + 6 + ix * 2, y + 2 + iy * 2, x + 7 + ix * 2, y + 3 + iy * 2, pal[row[ix]]);
      }
    });
  }

  /** Construction: a concrete frame going up, scaffolding and a tower crane. */
  function buildingSite(art) {
    const w = 124, h = 132;
    return makeSprite(w, h, set => {
      const base = h - 1;
      // Floors and columns
      for (let f = 0; f < 4; f++) {
        const y = base - f * 22;
        set.rect(10, y - 3, 86, y - 1, '#a8a49c');
        for (const cx of [12, 36, 60, 84]) set.rect(cx - 1, y - 22, cx + 1, y - 3, '#8f8a80');
        // Some bays are already bricked in on the lower floors
        if (f < 2) for (const bx of [14, 38]) {
          for (let yy = y - 21; yy < y - 3; yy++) for (let xx = bx; xx < bx + 21; xx++) {
            set(xx, yy, (yy % 4 === 0 || (xx + (Math.floor(yy / 4) % 2) * 3) % 6 === 0) ? '#7e3a2c' : '#a8473a');
          }
          drawWindow(set, art, bx + 7, y - 16, 7, 7);
        }
      }
      set.rect(10, base - 91, 86, base - 89, '#a8a49c');
      // Scaffolding in front of the right part
      for (let x = 62; x <= 92; x += 10) set.rect(x, base - 92, x, base, '#6d7178');
      for (let f = 0; f < 5; f++) set.rect(60, base - f * 22 - 1, 94, base - f * 22, '#c9a46c');
      for (let f = 0; f < 4; f++) for (let i = 0; i < 10; i++) set(62 + i * 3, base - f * 22 - 2 - i * 2, '#8a8f98');
      // Tower crane
      for (let y = 4; y <= base; y++) {
        set(100, y, '#d6a531');
        set(104, y, '#d6a531');
        if (y % 4 === 0) set.rect(101, y, 103, y, '#b08624');
        else if (y % 4 === 2) set(102, y, '#b08624');
      }
      set.rect(30, 4, 122, 6, '#d6a531');
      for (let x = 30; x < 122; x += 4) set(x + 2, 7, '#b08624');
      set.rect(108, 7, 120, 14, '#6d7178');
      set.rect(98, 0, 106, 3, '#d6a531');
      set.rect(99, 8, 105, 13, '#2f3135');
      set.rect(100, 9, 104, 11, '#9cbfd6');
      // Hook with a hanging beam
      set.rect(52, 7, 52, 40, '#3a3a3a');
      set.rect(50, 41, 54, 43, '#3a3a3a');
      set.rect(38, 44, 66, 47, '#c4483d');
      set.rect(38, 44, 66, 44, '#e06a5a');
    });
  }

  /** Racing: a grandstand full of spectators under a roof, with a chequered banner. */
  function grandstand(art) {
    const w = 140, h = 74;
    return makeSprite(w, h, set => {
      const r = rng(31);
      // Roof and posts
      set.rect(0, 2, w - 1, 7, art.roof[0]);
      set.rect(0, 7, w - 1, 9, art.roof[1]);
      for (const px of [4, 46, 92, w - 6]) set.rect(px, 10, px + 2, h - 1, '#6d7178');
      // Tiers with spectators
      for (let t = 0; t < 6; t++) {
        const y = 16 + t * 8;
        set.rect(2, y + 5, w - 3, y + 7, t % 2 ? '#9a9a9a' : '#b4b4b4');
        for (let x = 6; x < w - 6; x += 4) {
          if (r() < 0.82) {
            const shirt = ['#c4483d', '#2a6fb0', '#e0a030', '#3f8a4a', '#f2efe6', '#8a4a9a'][Math.floor(r() * 6)];
            set.rect(x, y + 2, x + 2, y + 4, shirt);
            set(x + 1, y + 1, ['#f0c8a0', '#c08860', '#8a5a3a'][Math.floor(r() * 3)]);
          }
        }
      }
      // Chequered banner along the front
      for (let x = 0; x < w; x++) for (let y = h - 10; y < h - 4; y++) set(x, y, (Math.floor(x / 3) + Math.floor(y / 3)) % 2 ? '#111111' : '#f5f5f5');
      set.rect(0, h - 4, w - 1, h - 1, '#5a5f66');
    });
  }

  /** Racing: canopy over two pumps and a small shop. */
  function fuelStation(art, kind) {
    const w = 134, h = 74;
    return makeSprite(w, h, set => {
      // Canopy
      set.rect(0, 10, 88, 19, '#f2efe6');
      set.rect(0, 12, 88, 16, art.roof[0]);
      set.rect(0, 20, 88, 21, 'rgba(0,0,0,0.3)');
      for (const px of [10, 74]) set.rect(px, 22, px + 3, h - 1, '#b9bec4');
      // Pumps
      for (const px of [28, 52]) {
        set.rect(px, h - 26, px + 10, h - 1, art.roof[0]);
        set.rect(px + 2, h - 23, px + 8, h - 17, '#1e2a30');
        set.rect(px + 3, h - 22, px + 7, h - 20, '#7ad48a');
        set.rect(px + 10, h - 18, px + 12, h - 16, '#2a2a2c');
        set.rect(px + 12, h - 16, px + 12, h - 8, '#2a2a2c');
      }
      // Shop
      for (let y = 30; y < h; y++) for (let x = 94; x < w; x++) set(x, y, wallColor(art, x, y));
      set.rect(92, 26, w - 1, 30, art.roof[1]);
      drawWindow(set, art, 98, 40, 14, 12);
      set.rect(118, h - 24, 129, h - 1, art.door);
      iconSign(set, 98, 2, TG.themes.stationKind(kind).wants[0], art);
    });
  }

  /** Town: a brick school with a bell tower and big windows. */
  function school(art, kind) {
    const w = 120, h = 104;
    return makeSprite(w, h, set => {
      const roofTop = 26, roofBottom = 44;
      for (let y = roofBottom + 1; y < h; y++) for (let x = 4; x < w - 4; x++) set(x, y, wallColor(art, x, y));
      set.rect(4, roofBottom + 1, 4, h - 1, '#26221e');
      set.rect(w - 5, roofBottom + 1, w - 5, h - 1, '#26221e');
      roof(set, art, 0, w - 1, roofTop, roofBottom, 16);
      // Bell tower
      set.rect(52, 4, 67, roofBottom, art.wall);
      set.rect(52, 4, 67, 5, art.trim);
      set.rect(55, 10, 64, 20, '#2f3135');
      set.ellipse(59.5, 16, 3.5, 4, '#d9b43a');
      set.rect(58, 9, 61, 10, '#d9b43a');
      for (let y = 0; y < 4; y++) set.rect(54 + y, y, 65 - y, y, art.roof[1]);
      // Windows in two rows and a door with steps
      for (const wx of [12, 30, 78, 96]) {
        drawWindow(set, art, wx, 54, 12, 14);
        drawWindow(set, art, wx, 78, 12, 14);
      }
      set.rect(51, h - 30, 68, h - 1, art.trim);
      set.rect(53, h - 28, 66, h - 3, art.door);
      set.rect(48, h - 3, 71, h - 1, '#9a9282');
      iconSign(set, 46, 52, TG.themes.stationKind(kind).wants[0], art);
    });
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
      const sil = '#6d8f70';
      if (theme === 'farm') {
        for (const x of [180, 610, 880]) {
          const top = Math.round(hs[x]);
          set.rect(x - 1, top - 14, x + 1, top, sil);
          set.rect(x - 2, top - 16, x + 2, top - 14, sil);
          for (let t = -7; t <= 7; t++) { set(x + t, top - 15 + t, sil); set(x + t, top - 15 - t, sil); }
        }
      } else if (theme === 'construction') {
        // Tower cranes and unfinished blocks
        for (const x of [150, 520, 840]) {
          const top = Math.round(hs[x]);
          set.rect(x, top - 40, x + 1, top, sil);
          set.rect(x - 12, top - 40, x + 30, top - 39, sil);
          set.rect(x - 12, top - 38, x - 8, top - 35, sil);
          set.rect(x + 20, top - 38, x + 20, top - 26, sil);
        }
        for (const x of [60, 300, 420, 700, 960]) {
          const top = Math.round(hs[x]), bh = 10 + (x % 7) * 2;
          set.rect(x, top - bh, x + 22, top, sil);
          for (let yy = top - bh + 2; yy < top - 2; yy += 4) for (let xx = x + 2; xx < x + 21; xx += 4) set(xx, yy, '#8fb092');
        }
      } else if (theme === 'racing') {
        // Floodlight towers and a long grandstand
        for (const x of [120, 470, 800]) {
          const top = Math.round(hs[x]);
          set.rect(x, top - 34, x + 1, top, sil);
          set.rect(x - 4, top - 38, x + 5, top - 34, sil);
        }
        for (const x of [230, 640]) {
          const top = Math.round(hs[x]);
          for (let i = 0; i < 90; i++) set.rect(x + i, top - 10 - Math.floor(i / 12), x + i, top, sil);
        }
      } else if (theme === 'town') {
        // Skyline of gabled houses and a church tower
        for (let x = 0; x < STRIP; x += 14) {
          const top = Math.round(hs[x]), hh = 8 + Math.floor(rng(x + 1)() * 8);
          set.rect(x, top - hh, x + 11, top, sil);
          for (let i = 0; i < 6; i++) set.rect(x + i, top - hh - i, x + 11 - i, top - hh - i, sil);
        }
        for (const x of [360, 860]) {
          const top = Math.round(hs[x]);
          set.rect(x, top - 34, x + 7, top, sil);
          for (let i = 0; i < 14; i++) set.rect(x + Math.floor(i / 4), top - 34 - i, x + 7 - Math.floor(i / 4), top - 34 - i, sil);
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
          if (theme === 'construction') col = y === top ? '#a8956a' : (hash2(x, y, 23) < 0.2 ? '#7f6e4c' : '#8f7d56');
          if (theme === 'racing' && y >= top + 9 && y <= top + 13) {
            // A stretch of race track with red-and-white kerbs along the hill
            col = y === top + 9 || y === top + 13 ? (Math.floor(x / 4) % 2 ? '#d23a2c' : '#f2efe6') : '#5a5d63';
          }
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
    if (theme === 'town') {
      // A row of Dutch houses with stepped gables along the ridge
      const houses = makeSprite(STRIP, H, set => {
        for (let x = 4; x < STRIP - 20; x += 22 + Math.floor(r() * 10)) {
          const top = Math.round(hs[x + 8]) + 2;
          const hw = 16, hh = 22 + Math.floor(r() * 10);
          const wall = ['#9c4a34', '#7a5040', '#c9a27a', '#8a3a2e', '#e0d6c4'][Math.floor(r() * 5)];
          for (let y = top - hh; y <= top; y++) set.rect(x, y, x + hw, y, wall);
          for (let st = 0; st < 3; st++) set.rect(x + 2 + st * 2, top - hh - 3 - st * 3, x + hw - 2 - st * 2, top - hh - 1 - st * 3, wall);
          for (let wy = top - hh + 4; wy < top - 6; wy += 8) for (const wx of [x + 3, x + 10]) set.rect(wx, wy, wx + 3, wy + 4, '#f2efe6');
          set.rect(x + 6, top - 7, x + 10, top, '#3f4a5a');
        }
      });
      ctx.drawImage(houses, 0, 0);
    }
    if (theme === 'construction') {
      // Half-built frames on the hills
      const frames = makeSprite(STRIP, H, set => {
        for (const x of [90, 380, 620, 900]) {
          const top = Math.round(hs[x + 10]);
          for (let f = 0; f < 3; f++) set.rect(x, top - f * 10 - 1, x + 26, top - f * 10, '#b4aea2');
          for (const cx of [x, x + 13, x + 26]) set.rect(cx, top - 30, cx, top, '#8f8a80');
        }
      });
      ctx.drawImage(frames, 0, 0);
    }
    const treeCount = theme === 'construction' ? 6 : theme === 'town' ? 8 : 18;
    for (let i = 0; i < treeCount; i++) {
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

  /** Traffic cone seen from the side. */
  function sideCone() {
    return makeSprite(8, 11, set => {
      for (let y = 0; y < 9; y++) {
        const hw = Math.floor(y / 3);
        set.rect(4 - hw - 1, y, 4 + hw, y, y === 4 || y === 5 ? '#f2efe6' : '#e8702a');
      }
      set.rect(0, 9, 7, 10, '#3a3a3a');
    });
  }

  /** Red-and-white road barrier. */
  function barrier() {
    return makeSprite(26, 12, set => {
      for (let x = 0; x < 26; x++) for (let y = 2; y < 6; y++) set(x, y, Math.floor((x + y) / 4) % 2 ? '#f2efe6' : '#c4483d');
      set.rect(2, 6, 3, 11, '#5a5f66');
      set.rect(22, 6, 23, 11, '#5a5f66');
      set.rect(0, 11, 5, 11, '#3a3a3a');
      set.rect(20, 11, 25, 11, '#3a3a3a');
    });
  }

  /** Wall of stacked tyres at the race track. */
  function tyreWall() {
    return makeSprite(24, 14, set => {
      for (let row = 0; row < 2; row++) for (let i = 0; i < 4 - row; i++) {
        const cx = 3 + i * 6 + row * 3, cy = 10 - row * 6;
        set.ellipse(cx, cy, 3, 3, '#1e1e20');
        set.ellipse(cx, cy, 1.2, 1.2, row ? '#e0473a' : '#f2efe6');
      }
    });
  }

  /** Billboard on two posts (racing). */
  function billboard(v) {
    const colors = [['#c4483d', '#f2efe6'], ['#2a6fb0', '#f0c830'], ['#3f8a4a', '#f2efe6']][v % 3];
    return makeSprite(34, 24, set => {
      set.rect(5, 14, 6, 23, '#5a5f66');
      set.rect(27, 14, 28, 23, '#5a5f66');
      set.rect(0, 0, 33, 14, '#2f3135');
      set.rect(1, 1, 32, 13, colors[0]);
      set.rect(6, 5, 27, 9, colors[1]);
      for (let x = 8; x < 26; x += 4) set.rect(x, 6, x + 2, 8, colors[0]);
    });
  }

  /** Chequered flag on a pole (racing). */
  function flagPole() {
    return makeSprite(14, 26, set => {
      set.rect(0, 0, 1, 25, '#8a8f98');
      for (let y = 1; y < 9; y++) for (let x = 2; x < 13; x++) set(x, y + Math.floor(Math.sin(x / 2) * 1), (Math.floor(x / 2) + Math.floor(y / 2)) % 2 ? '#111111' : '#f5f5f5');
    });
  }

  /** A bicycle parked in town (a Dutch classic). */
  function bicycle(v) {
    const frame = ['#2a6fb0', '#c4483d', '#2f3135', '#3f8a4a'][v % 4];
    return makeSprite(18, 12, set => {
      for (const cx of [4, 13]) {
        for (let a = 0; a < 24; a++) {
          const t = (a / 24) * Math.PI * 2;
          set(Math.round(cx + Math.cos(t) * 3.5), Math.round(8 + Math.sin(t) * 3.5), '#2a2a2c');
        }
        set(cx, 8, '#8a8f98');
      }
      for (let i = 0; i <= 9; i++) set(4 + i, 8 - Math.round(i * 0.4), frame);
      set.rect(8, 4, 12, 4, frame);
      set.rect(7, 3, 9, 3, '#3a2a1c');
      set.rect(12, 1, 12, 4, frame);
      set.rect(11, 1, 14, 1, '#2a2a2c');
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
    parcel: [['........', '.PPPsPP.', 'PPPPsPPP', 'ppppsppd', 'ssssssss', 'ppppsppd', 'ppppsppd', 'dddddddd'],
      { P: '#d9b07a', p: '#b88a54', d: '#8a6438', s: '#ece5d4' }],
    passenger: [['...hh...', '..hffh..', '...ff...', '..cccc..', '.cccccc.', '.cccccc.', '..cddc..', '..d..d..'],
      { h: '#5a3a20', f: '#f0c8a0', c: '#2a6fb0', d: '#2f3135' }],
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
    cement: [['..t..t..', '...tt...', '..wwww..', '.wwwwww.', 'wwwwwwww', 'wwFFwwwW', 'wwwwwwwW', '.WWWWWW.'],
      { t: '#4a4a4a', w: '#a8a8a8', W: '#7a7a7a', F: '#dedede' }],
    logs: [['...oo...', '..oyyo..', '..oyyo..', '.oooooo.', 'oyyooyyo', 'oyyooyyo', '.oo..oo.', '........'],
      { o: '#6b4a2f', y: '#d9b07a' }],
    helmet: [['........', '........', '..yyyy..', '.yYyyyy.', 'yYyyyyyy', 'yyyyyyyy', 'dddddddd', '........'],
      { y: '#e8c030', Y: '#f8e080', d: '#b8901c' }],
    wheelbarrow: [['........', 'h.......', '.h......', '..gggggg', '..GGGGGg', '...GGGg.', '...h.kk.', '.....kk.'],
      { g: '#4a8a4a', G: '#3a6a3a', h: '#8a6a48', k: '#2a2a2c' }],
    cone: [['...oo...', '...oo...', '..owwo..', '..oooo..', '.oooooo.', '.wwwwww.', '.oooooo.', 'dddddddd'],
      { o: '#e8702a', w: '#f2efe6', d: '#3a3a3a' }],
    flag: [['pkwkwkw.', 'pwkwkwk.', 'pkwkwkw.', 'pwkwkwk.', 'p.......', 'p.......', 'p.......', 'p.......'],
      { p: '#8a8f98', k: '#1a1a1a', w: '#f5f5f5' }],
    soap: [['...dd...', '...bb...', '..bbbb..', '.bBbbbb.', '.bBbbbb.', '.bwwwbb.', '.bbbbbb.', '..bbbb..'],
      { b: '#5ab0e0', B: '#a8dcf4', d: '#2a6fb0', w: '#f2efe6' }],
    sponge: [['........', '........', '.yyyyyy.', 'yYyoyyyy', 'yyyyyoyy', 'yoyyyyyy', 'gggggggg', 'gggggggg'],
      { y: '#f0d040', Y: '#f8e890', o: '#c8a020', g: '#3f8a4a' }],
    book: [['........', '.rrrrrr.', '.rRrrrr.', '.rRrrrr.', '.rRwwrr.', '.rrrrrr.', '.wwwwww.', '........'],
      { r: '#c4483d', R: '#e06a5a', w: '#f2efe6' }],
    pencil: [['......ee', '.....yye', '....yyy.', '...yyy..', '..yyy...', '.www....', '.ww.....', 'k.......'],
      { y: '#e8c030', e: '#e88a9a', w: '#e8cfa0', k: '#2a2a2c' }],
    letter: [['........', 'wwwwwwww', 'wDwwwwDw', 'wwDwwDww', 'wwwDDwww', 'wwwwwwww', 'wwwwwwrw', '........'],
      { w: '#f2efe6', D: '#b8b0a0', r: '#c4483d' }],
    banana: [['......k.', '.....yy.', '....yyy.', 'y..yyyy.', 'yyyyyyy.', '.yyyyyd.', '..dddd..', '........'],
      { y: '#f0d040', d: '#c8a020', k: '#5a3a20' }],
    ball: [['..rrww..', '.rrrwww.', 'rrrrwwww', 'bbbbyyyy', 'bbbbyyyy', '.bbbyyy.', '..bbyy..', '........'],
      { r: '#d23a2c', w: '#f5f5f5', b: '#2a6fb0', y: '#f0c830' }],
    teddy: [['.bb..bb.', '.bBbbBb.', '..bbbb..', '..bkkb..', '..bnnb..', '.bbbbbb.', 'bbBBBBbb', '.bb..bb.'],
      { b: '#a0703a', B: '#c89a60', k: '#1a1a1a', n: '#e0c090' }],
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

  // ================================================================ people and passenger carriages

  const HAIR = ['#5a3a20', '#e0c060', '#2a2a2a', '#a04a20', '#c8c8c8', '#7a4a2a'];
  const SKIN = ['#f0c8a0', '#c08860', '#e8b890', '#8a5a3a', '#f5d5b5'];
  const SHIRTS = ['#2a6fb0', '#c4483d', '#3f8a4a', '#e0a030', '#8a4a9a', '#e8e2d4', '#d9702a'];

  /** A person standing on the platform (5 x 11). */
  function person(v) {
    const hair = HAIR[v % HAIR.length], skin = SKIN[(v * 3) % SKIN.length], shirt = SHIRTS[(v * 5) % SHIRTS.length];
    const rows = ['.hhh.', 'hfff.', '.fff.', '..f..', 'sssss', 'Sssss', 'Sssss', '.sss.', '.p.p.', '.p.p.', '.k.k.'];
    const pal = { h: hair, f: skin, s: shirt, S: shadeHex(shirt, 25), p: '#3a3f4a', k: '#1e1e1e' };
    return makeSprite(5, 11, set => rows.forEach((r, y) => { for (let x = 0; x < 5; x++) if (r[x] !== '.') set(x, y, pal[r[x]]); }));
  }

  /** A passenger's head seen through a carriage window (4 x 4). */
  function head(v) {
    const hair = HAIR[v % HAIR.length], skin = SKIN[(v * 3) % SKIN.length];
    const rows = ['.hh.', 'hhhh', 'hffh', '.ff.'];
    const pal = { h: hair, f: skin };
    return makeSprite(4, 4, set => rows.forEach((r, y) => { for (let x = 0; x < 4; x++) if (r[x] !== '.') set(x, y, pal[r[x]]); }));
  }

  /**
   * Wagon types. seats: where a passenger's head goes (relative to the wagon's top-left),
   * bottom row first so carriages fill like a ten frame.
   */
  const seatRow = y => [0, 1, 2, 3, 4].map(j => [4 + j * 8, y]);
  const WAGON_TYPES = {
    freight: { w: 44, h: 30, wheels: [11, 32] },
    coach2: { w: 44, h: 30, wheels: [9, 35], seats: [[10, 12], [30, 12]] },
    coach5: { w: 44, h: 30, wheels: [9, 35], seats: seatRow(12) },
    coach10: { w: 44, h: 40, wheels: [9, 35], seats: [...seatRow(21), ...seatRow(11)] },
  };

  /** Passenger carriage in yellow and blue; coach10 is a double-decker. */
  function coach(type) {
    const t = WAGON_TYPES[type];
    const YEL = '#e8b830', YEL_D = '#c99a20', BLUE = '#2a4f8a', GLASS = '#2f4a63', GLASS_L = '#4d6680';
    return makeSprite(t.w, t.h, set => {
      const top = type === 'coach10' ? 2 : 4;
      const bodyTop = top + 4, bodyBottom = t.h - 7;
      // Roof
      set.rect(2, top, t.w - 3, top, '#7b8089');
      set.rect(1, top + 1, t.w - 2, top + 3, '#5a5f66');
      // Body
      for (let y = bodyTop; y <= bodyBottom; y++) set.rect(1, y, t.w - 2, y, y > bodyBottom - 2 ? YEL_D : YEL);
      set.rect(1, bodyTop, 1, bodyBottom, YEL_D);
      set.rect(t.w - 2, bodyTop, t.w - 2, bodyBottom, YEL_D);
      // Windows around each seat
      const windows = type === 'coach2' ? [[5, 10, 14], [25, 10, 14]] : t.seats.map(([x, y]) => [x - 1, y - 2, 6]);
      for (const [wx, wy, ww] of windows) {
        set.rect(wx, wy, wx + ww - 1, wy + 6, GLASS);
        set.rect(wx, wy, wx + ww - 1, wy, GLASS_L);
      }
      // Blue stripes under each window row
      const rows = Array.from(new Set(windows.map(w => w[1])));
      for (const wy of rows) set.rect(1, wy + 8, t.w - 2, wy + 9, BLUE);
      // Chassis and buffers
      set.rect(3, t.h - 6, t.w - 4, t.h - 5, BLACK);
      set.rect(0, t.h - 11, 1, t.h - 9, '#9a9a9a');
      set.rect(t.w - 2, t.h - 11, t.w - 1, t.h - 9, '#9a9a9a');
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

  // ================================================================ digits (5 x 7 pixel font)

  const DIGITS = {
    0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
    1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
    2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
    3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
    4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
    5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
    6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
    7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
    8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
    9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  };

  function digit(d) {
    const rows = DIGITS[d];
    return makeSprite(5, 7, set => rows.forEach((r, y) => { for (let x = 0; x < 5; x++) if (r[x] === '#') set(x, y, '#2a2522'); }));
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
    sideCone: () => get('sideCone', sideCone),
    barrier: () => get('barrier', barrier),
    tyreWall: () => get('tyreWall', tyreWall),
    billboard: v => get('billboard' + (v % 3), () => billboard(v)),
    flagPole: () => get('flagPole', flagPole),
    bicycle: v => get('bicycle' + (v % 4), () => bicycle(v)),
    puff: r => get('puff' + r, () => puff(Math.max(1, r))),
    goodIcon: g => get('good:' + g, () => goodIcon(g)),
    digit: d => get('digit' + d, () => digit(d)),
    DIGITS,
    crate: () => get('crate', crate),
    person: v => get('person' + (v % 12), () => person(v % 12)),
    head: v => get('head' + (v % 12), () => head(v % 12)),
    WAGON_TYPES,
    wagonSprite: (type, i) => (type === 'freight'
      ? get('wagon' + (i % WAGON_COLORS.length), () => wagon(WAGON_COLORS[i % WAGON_COLORS.length]))
      : get('coach:' + type, () => coach(type))),
    GOOD_ICONS,
    bush: v => get('bush' + (v % 3), () => bush(300 + (v % 3))),
  };
})(globalThis.TG = globalThis.TG || {});
