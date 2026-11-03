/*
 * Side-view renderer: the train travelling through the landscape.
 *
 * World coordinates are art pixels along the trip, increasing to the right.
 * A scene has a start station (at the left) and optionally a destination
 * station at the far end, with bridges in between. Landscape layers scroll
 * slower than the track (parallax) and keep scrolling seamlessly between
 * trips via `sceneryOffset`.
 */
(function (TG) {
  'use strict';

  const SS = TG.sideSprites;
  const S = TG.sprites;
  const { hash2 } = TG.util;
  const W = SS.W, H = SS.H, RAIL_Y = SS.RAIL_Y, PLATFORM_Y = SS.PLATFORM_Y, STRIP = SS.STRIP;

  /** Where the train's front stands when waiting at a station (screen x). */
  const STOP_X = 440;
  /** Station building centre, in screen x, when the station is in view. */
  const STATION_X = 160;
  const SIGN_X = 272;
  /** Name board on the platform (art px). */
  const SIGN_TOP = 132, SIGN_W = 96, SIGN_H = 32;

  class SideRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.buffer = S.createCanvas(W, H);
      this.bctx = this.buffer.getContext('2d');
      this.scale = 1;
      this.scene = null;
      this.ballast = this.makeBallastStrip();
    }

    fit(cssW, cssH, dpr) {
      this.scale = Math.max(1, Math.floor(Math.min((cssW * dpr) / W, (cssH * dpr) / H)));
      this.canvas.width = W * this.scale;
      this.canvas.height = H * this.scale;
      this.canvas.style.width = (W * this.scale) / dpr + 'px';
      this.canvas.style.height = (H * this.scale) / dpr + 'px';
      this.cssScale = this.scale / dpr;
      return this.cssScale;
    }

    /**
     * scene = { theme, startKind, endKind | null, worldEnd, bridges: [{x0, x1}], wagons, sceneryOffset }
     */
    setScene(scene) {
      this.scene = scene;
      this.stations = [{ kind: scene.startKind, x: STATION_X }];
      if (scene.endKind) this.stations.push({ kind: scene.endKind, x: scene.worldEnd - W + STATION_X });
    }

    /** Screen x (art px) of each station's name sign, for the HTML labels. */
    signPositions(camera) {
      return this.stations.map(st => ({ kind: st.kind, x: st.x - STATION_X + SIGN_X - camera, y: SIGN_TOP }));
    }

    // ------------------------------------------------------------ goods geometry (world coordinates)

    wagonType() {
      return SS.WAGON_TYPES[(this.scene && this.scene.wagonType) || 'freight'];
    }

    /** Left edge of wagon i (0 = right behind the locomotive). */
    wagonLeft(front, i) {
      const t = this.wagonType();
      return front - SS.LOCO_W - 2 - i * (t.w + 2) - t.w;
    }

    /**
     * Top-left of the i-th item in the train. Freight wagons are ten frames (2 rows of 5 goods on top,
     * bottom row first); passenger carriages have a head in each window.
     */
    slotPos(front, i) {
      const t = this.wagonType();
      if (t.seats) {
        const n = t.seats.length;
        const [sx, sy] = t.seats[i % n];
        return { x: this.wagonLeft(front, Math.floor(i / n)) + sx, y: RAIL_Y - t.h + sy };
      }
      const k = i % TG.round.WAGON_CAPACITY;
      const row = Math.floor(k / 5), col = k % 5;
      return { x: this.wagonLeft(front, Math.floor(i / TG.round.WAGON_CAPACITY)) + 2 + col * 8, y: RAIL_Y - t.h + 7 - 8 - row * 8 };
    }

    /** Left edge of goods pile p on the platform of station s. */
    pileX(s, p) {
      return this.stations[s].x - 150 + 8 + p * 38;
    }

    /**
     * Top-left of the k-th item in a pile (a pyramid of 4-3-2-1). Supply piles sit on a crate.
     * People stand in two rows instead.
     */
    pileItemPos(s, p, k, supply, good) {
      const base = this.pileX(s, p);
      if (good === 'passenger') {
        const row = Math.floor(k / 13) % 2;
        return { x: base + (k % 13) * 9 + row * 4, y: PLATFORM_Y - 11 - row * 3 };
      }
      if (supply) return { x: base + 2 + (k % 3) * 8, y: PLATFORM_Y - 14 - 8 };
      let row = 0, inRow = k;
      while (inRow >= 4 - row && row < 3) { inRow -= 4 - row; row++; }
      return { x: base + row * 4 + inRow * 8, y: PLATFORM_Y - 8 - row * 7 };
    }

    /** Pile index under an art-pixel point on the screen, for clicks; -1 if none. */
    pileAt(s, count, sx, sy, camera) {
      for (let p = 0; p < count; p++) {
        const x = this.pileX(s, p) - camera;
        if (sx >= x - 2 && sx <= x + 30 && sy >= PLATFORM_Y - 34 && sy <= PLATFORM_Y + 2) return p;
      }
      return -1;
    }

    /** Index of the train item under a screen point, -1 if none (only filled slots count). */
    slotAt(front, n, sx, sy, camera) {
      for (let i = 0; i < n; i++) {
        const p = this.slotPos(front, i);
        const x = p.x - camera;
        if (sx >= x && sx < x + 8 && sy >= p.y && sy < p.y + 8) return i;
      }
      return -1;
    }

    makeBallastStrip() {
      return S.makeSprite(STRIP, 16, set => {
        for (let x = 0; x < STRIP; x++) {
          const bottom = 12 + Math.round(hash2(x >> 2, 0, 91) * 2);
          for (let y = 0; y <= bottom; y++) {
            const n = hash2(x, y, 92);
            set(x, y, y === bottom ? '#5f584e' : n < 0.3 ? '#7a776f' : n < 0.6 ? '#8a867d' : n < 0.85 ? '#97938a' : '#aaa69c');
          }
        }
      });
    }

    /**
     * view = { camera, front, wheelDist, time, smoke: [{x, y, r, a}], loads }
     */
    draw(view) {
      const ctx = this.bctx;
      const sc = this.scene;
      const cam = view.camera;
      const scenery = cam + (sc.sceneryOffset || 0);
      ctx.imageSmoothingEnabled = false;

      ctx.drawImage(SS.sky(), 0, 0);
      this.strip(ctx, SS.clouds(), scenery * 0.05 + view.time * 3, 0);
      this.strip(ctx, SS.farHills(sc.theme), scenery * 0.15, 0);
      this.strip(ctx, SS.midHills(sc.theme), scenery * 0.35, 0);
      this.drawNear(ctx, scenery * 0.7, sc.theme);
      this.drawPoles(ctx, scenery * 0.92);

      this.stations.forEach((st, i) => {
        this.drawStation(ctx, st, cam, view.time);
        this.drawPiles(ctx, i, (view.piles || [])[i] || [], cam);
      });
      this.drawTrack(ctx, cam);
      for (const b of sc.bridges) this.drawBridge(ctx, b, cam);
      this.drawSmoke(ctx, view.smoke, cam);
      this.drawTrain(ctx, view.front - cam, view.wheelDist, sc.wagons, sc.wagonType || 'freight');
      this.drawCargo(ctx, view.front, view.cargo || [], cam);
      for (const f of view.flyers || []) ctx.drawImage(SS.goodIcon(f.good), Math.round(f.x - cam), Math.round(f.y));
      this.strip(ctx, SS.foreground(), scenery * 1.25, H - 40);

      const out = this.ctx;
      out.imageSmoothingEnabled = false;
      out.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
    }

    /** Draw a repeating strip scrolled by `offset`. */
    strip(ctx, img, offset, y) {
      const o = ((Math.round(offset) % img.width) + img.width) % img.width;
      ctx.drawImage(img, -o, y);
      if (img.width - o < W) ctx.drawImage(img, img.width - o, y);
    }

    drawNear(ctx, offset, theme) {
      // Ground (dusty at construction sites)
      const ground = { construction: ['#6e6b45', '#7d7a50'], racing: ['#4f8a3a', '#5c9a44'] }[theme] || ['#4f7f36', '#5c8c3f'];
      ctx.fillStyle = ground[0];
      ctx.fillRect(0, 206, W, H - 206);
      ctx.fillStyle = ground[1];
      ctx.fillRect(0, 206, W, 2);
      // Objects on a 56 px grid in this layer's own coordinates, different per theme
      const cell = 56;
      const first = Math.floor(offset / cell) - 1;
      for (let c = first; c < first + W / cell + 3; c++) {
        const n = hash2(c, 0, 101);
        const x = Math.round(c * cell - offset + hash2(c, 1, 102) * 24);
        this.nearObject(ctx, theme, n, c, x);
      }
    }

    nearObject(ctx, theme, n, c, x) {
      if (theme === 'construction') {
        if (n < 0.2) { ctx.drawImage(SS.sideCone(), x, 199); ctx.drawImage(SS.sideCone(), x + 12, 199); }
        else if (n < 0.38) ctx.drawImage(SS.barrier(), x, 198);
        else if (n < 0.52) ctx.drawImage(S.obstacle('construction', 'T', 1), x, 180);
        else if (n < 0.62) ctx.drawImage(SS.bush(c & 7), x, 196);
        else if (n < 0.72) this.drawFence(ctx, x, 196, 40);
      } else if (theme === 'racing') {
        if (n < 0.24) ctx.drawImage(SS.tyreWall(), x, 196);
        else if (n < 0.38) ctx.drawImage(SS.flagPole(), x, 184);
        else if (n < 0.54) ctx.drawImage(SS.billboard(c & 7), x, 186);
        else if (n < 0.64) ctx.drawImage(SS.bush(c & 7), x, 196);
        else if (n < 0.74) ctx.drawImage(S.tree(c & 3), x, 182);
      } else if (theme === 'town') {
        if (n < 0.2) this.drawLamp(ctx, x);
        else if (n < 0.38) ctx.drawImage(SS.bush(c & 7), x, 196);
        else if (n < 0.52) { ctx.drawImage(SS.bicycle(c & 7), x, 198); ctx.drawImage(SS.bicycle((c + 1) & 7), x + 12, 198); }
        else if (n < 0.64) ctx.drawImage(S.tree(c & 3), x, 182);
        else if (n < 0.72) this.drawBench(ctx, x);
      } else {
        if (n < 0.22) ctx.drawImage(SS.bush(c & 7), x, 196);
        else if (n < 0.36) ctx.drawImage(SS.haybale(), x, 197);
        else if (n < 0.52) ctx.drawImage(S.tree(c & 3), x, 182);
        else if (n < 0.7) this.drawFence(ctx, x, 196, 40);
      }
    }

    drawLamp(ctx, x) {
      ctx.fillStyle = '#2f3135';
      ctx.fillRect(x, 180, 2, 30);
      ctx.fillRect(x - 3, 178, 8, 3);
      ctx.fillStyle = '#ffe58a';
      ctx.fillRect(x - 2, 181, 6, 1);
    }

    drawBench(ctx, x) {
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(x, 202, 20, 2);
      ctx.fillRect(x, 197, 20, 2);
      ctx.fillStyle = '#2f3135';
      ctx.fillRect(x + 2, 204, 2, 5);
      ctx.fillRect(x + 16, 204, 2, 5);
    }

    drawFence(ctx, x, y, len) {
      ctx.fillStyle = '#6e5238';
      for (let px = 0; px <= len; px += 10) ctx.fillRect(x + px, y, 2, 12);
      ctx.fillStyle = '#8a6a48';
      ctx.fillRect(x, y + 3, len + 2, 1);
      ctx.fillRect(x, y + 7, len + 2, 1);
    }

    /** Telegraph poles with sagging wires, a classic sight along railways. */
    drawPoles(ctx, offset) {
      const gap = 150;
      const first = Math.floor(offset / gap) - 1;
      const xs = [];
      for (let c = first; c < first + W / gap + 3; c++) xs.push(Math.round(c * gap - offset));
      ctx.fillStyle = '#2f2b27';
      for (let i = 0; i < xs.length - 1; i++) {
        for (const wy of [150, 156]) {
          for (let x = xs[i]; x < xs[i + 1]; x++) {
            const t = (x - xs[i]) / gap;
            ctx.fillRect(x, Math.round(wy + 8 * 4 * t * (1 - t)), 1, 1);
          }
        }
      }
      for (const x of xs) {
        ctx.fillStyle = '#5b4632';
        ctx.fillRect(x - 1, 146, 3, 68);
        ctx.fillStyle = '#4a3828';
        ctx.fillRect(x + 1, 146, 1, 68);
        ctx.fillRect(x - 8, 149, 17, 2);
        ctx.fillStyle = '#e8e2d4';
        for (const ix of [-7, 7]) ctx.fillRect(x + ix, 147, 2, 2);
        ctx.fillRect(x - 1, 153, 2, 2);
      }
    }

    drawStation(ctx, st, cam, time) {
      const cx = Math.round(st.x - cam);
      if (cx < -260 || cx > W + 260) return;
      // Platform: top surface with yellow line, then the stone edge
      const x0 = cx - 150, x1 = cx + 300;
      ctx.fillStyle = '#c9c1b0';
      ctx.fillRect(x0, PLATFORM_Y, x1 - x0, 4);
      ctx.fillStyle = '#d4b84a';
      ctx.fillRect(x0, PLATFORM_Y + 3, x1 - x0, 1);
      ctx.fillStyle = '#9a9282';
      ctx.fillRect(x0, PLATFORM_Y + 4, x1 - x0, RAIL_Y - PLATFORM_Y - 4);
      ctx.fillStyle = '#857d6f';
      for (let x = x0; x < x1; x += 12) ctx.fillRect(x, PLATFORM_Y + 4, 1, RAIL_Y - PLATFORM_Y - 4);
      ctx.fillRect(x0, PLATFORM_Y + 9, x1 - x0, 1);

      // Building
      const b = SS.building(st.kind);
      const bx = cx - Math.round(b.sprite.width / 2);
      const by = PLATFORM_Y - b.sprite.height;
      ctx.drawImage(b.sprite, bx, by);
      if (b.sails) SS.drawSails(ctx, bx + b.sails.x, by + b.sails.y, b.sails.len, time * 0.8);

      // Lamps and a bench
      for (const lx of [x0 + 20, cx + 120, x1 - 16]) {
        ctx.fillStyle = '#2f3135';
        ctx.fillRect(lx, PLATFORM_Y - 34, 2, 34);
        ctx.fillRect(lx - 2, PLATFORM_Y - 38, 6, 4);
        ctx.fillStyle = '#ffe58a';
        ctx.fillRect(lx - 1, PLATFORM_Y - 37, 4, 2);
      }
      ctx.fillStyle = '#6b4a2f';
      ctx.fillRect(cx + 70, PLATFORM_Y - 8, 22, 3);
      ctx.fillRect(cx + 70, PLATFORM_Y - 14, 22, 2);
      ctx.fillStyle = '#2f3135';
      ctx.fillRect(cx + 72, PLATFORM_Y - 5, 2, 5);
      ctx.fillRect(cx + 88, PLATFORM_Y - 5, 2, 5);

      // Name sign (the text itself is an HTML label on top)
      const sx = cx - STATION_X + SIGN_X;
      const left = sx - SIGN_W / 2;
      ctx.fillStyle = '#2f3135';
      ctx.fillRect(left + 8, SIGN_TOP + SIGN_H, 3, PLATFORM_Y - SIGN_TOP - SIGN_H);
      ctx.fillRect(left + SIGN_W - 11, SIGN_TOP + SIGN_H, 3, PLATFORM_Y - SIGN_TOP - SIGN_H);
      ctx.fillStyle = '#16305a';
      ctx.fillRect(left, SIGN_TOP, SIGN_W, SIGN_H);
      ctx.fillStyle = '#f2efe6';
      ctx.fillRect(left + 1, SIGN_TOP + 1, SIGN_W - 2, SIGN_H - 2);
      ctx.fillStyle = '#1f3d6b';
      ctx.fillRect(left + 3, SIGN_TOP + 3, SIGN_W - 6, SIGN_H - 6);
    }

    drawTrack(ctx, cam) {
      // Embankment, sleepers, rails
      this.strip(ctx, this.ballast, cam, RAIL_Y + 3);
      ctx.fillStyle = '#3b2a1c';
      const start = Math.floor(cam / 10) * 10;
      for (let wx = start; wx < cam + W + 10; wx += 10) ctx.fillRect(Math.round(wx - cam), RAIL_Y + 2, 6, 2);
      ctx.fillStyle = '#d5d9de';
      ctx.fillRect(0, RAIL_Y, W, 1);
      ctx.fillStyle = '#666a72';
      ctx.fillRect(0, RAIL_Y + 1, W, 1);
    }

    drawBridge(ctx, b, cam) {
      const x0 = Math.round(b.x0 - cam), x1 = Math.round(b.x1 - cam);
      if (x1 < -40 || x0 > W + 40) return;
      // River valley below the track
      const bank = 22;
      for (let x = x0 - bank; x <= x1 + bank; x++) {
        let top = 262;
        if (x < x0) top = RAIL_Y + 14 + Math.round(((x - (x0 - bank)) / bank) * (262 - RAIL_Y - 14));
        if (x > x1) top = RAIL_Y + 14 + Math.round((((x1 + bank) - x) / bank) * (262 - RAIL_Y - 14));
        ctx.fillStyle = '#6b5a40';
        ctx.fillRect(x, RAIL_Y + 3, 1, top - RAIL_Y - 3);
        ctx.fillStyle = '#5a4a34';
        ctx.fillRect(x, top - 2, 1, 2);
        if (x >= x0 - 6 && x <= x1 + 6) {
          ctx.fillStyle = '#3b6ea5';
          ctx.fillRect(x, 262, 1, H - 262);
          ctx.fillStyle = '#86b2da';
          if (hash2(Math.round((x + cam) / 3), 0, 111) < 0.3) ctx.fillRect(x, 266 + Math.round(hash2(x + Math.round(cam), 1, 112) * 16), 2, 1);
          ctx.fillStyle = '#b4d0e8';
          ctx.fillRect(x, 262, 1, 1);
        }
      }
      // Valley background between banks (far bank in shadow)
      ctx.fillStyle = '#4a6b3a';
      ctx.fillRect(x0 - 6, RAIL_Y + 3, x1 - x0 + 12, 262 - RAIL_Y - 3);
      ctx.fillStyle = '#3f5e31';
      ctx.fillRect(x0 - 6, 254, x1 - x0 + 12, 8);
      // Stone piers
      const piers = [x0];
      for (let px = x0 + 90; px < x1 - 30; px += 90) piers.push(px);
      piers.push(x1 - 12);
      for (const px of piers) {
        for (let y = RAIL_Y + 14; y < H; y++) {
          for (let x = px; x < px + 12; x++) {
            const row = Math.floor((y - RAIL_Y) / 5);
            ctx.fillStyle = (y % 5 === 0 || (x + row * 3) % 6 === 0) ? '#6f685f' : (x === px ? '#a8a093' : '#8d857a');
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }
      // Plate girder carrying the track
      ctx.fillStyle = '#4a4d53';
      ctx.fillRect(x0 - 4, RAIL_Y + 2, x1 - x0 + 8, 12);
      ctx.fillStyle = '#7b8089';
      ctx.fillRect(x0 - 4, RAIL_Y + 2, x1 - x0 + 8, 1);
      ctx.fillStyle = '#2f3135';
      ctx.fillRect(x0 - 4, RAIL_Y + 13, x1 - x0 + 8, 1);
      for (let x = x0; x < x1; x += 10) {
        ctx.fillStyle = '#3a3d42';
        ctx.fillRect(x, RAIL_Y + 3, 1, 10);
        ctx.fillStyle = '#8a8f98';
        ctx.fillRect(x + 3, RAIL_Y + 4, 1, 1);
        ctx.fillRect(x + 3, RAIL_Y + 11, 1, 1);
      }
      ctx.fillStyle = '#d5d9de';
      ctx.fillRect(x0 - 4, RAIL_Y, x1 - x0 + 8, 1);
    }

    /** piles: [{ good, count, supply }] */
    drawPiles(ctx, s, piles, cam) {
      piles.forEach((pile, p) => {
        const x = Math.round(this.pileX(s, p) - cam);
        if (x < -40 || x > W + 140) return;
        if (pile.good === 'passenger') {
          // Back row first so the front row stands in front
          const order = [];
          for (let k = 0; k < Math.min(26, pile.count); k++) order.push(k);
          order.sort((a, b) => (Math.floor(b / 13) % 2) - (Math.floor(a / 13) % 2));
          for (const k of order) {
            const pos = this.pileItemPos(s, p, k, false, 'passenger');
            ctx.drawImage(SS.person(k), Math.round(pos.x - cam), pos.y);
          }
        } else if (pile.supply) {
          ctx.drawImage(SS.crate(), x, PLATFORM_Y - 14);
          ctx.drawImage(SS.goodIcon(pile.good), x + 10, PLATFORM_Y - 11);
          for (let k = 0; k < 3; k++) {
            const pos = this.pileItemPos(s, p, k, true);
            ctx.drawImage(SS.goodIcon(pile.good), Math.round(pos.x - cam), pos.y);
          }
          const top = this.pileItemPos(s, p, 0, true);
          ctx.drawImage(SS.goodIcon(pile.good), Math.round(top.x - cam + 8), top.y - 6);
        } else {
          for (let k = 0; k < Math.min(10, pile.count); k++) {
            const pos = this.pileItemPos(s, p, k, false);
            ctx.drawImage(SS.goodIcon(pile.good), Math.round(pos.x - cam), pos.y);
          }
        }
      });
    }

    /** Goods in the wagons; cargo is a list of good ids (null = slot not shown yet). */
    drawCargo(ctx, front, cargo, cam) {
      cargo.forEach((good, i) => {
        if (!good) return;
        const p = this.slotPos(front, i);
        ctx.drawImage(good === 'passenger' ? SS.head(i) : SS.goodIcon(good), Math.round(p.x - cam), p.y);
      });
    }

    drawSmoke(ctx, smoke, cam) {
      for (const p of smoke) {
        const img = SS.puff(Math.round(p.r));
        ctx.globalAlpha = Math.max(0, Math.min(1, p.a));
        ctx.drawImage(img, Math.round(p.x - cam - img.width / 2), Math.round(p.y - img.height / 2));
      }
      ctx.globalAlpha = 1;
    }

    drawTrain(ctx, front, wheelDist, wagons, wagonType) {
      const loco = SS.locomotive();
      const lx = Math.round(front) - SS.LOCO_W;
      const ly = RAIL_Y - SS.LOCO_H;
      const t = SS.WAGON_TYPES[wagonType];
      // Wagons (behind the locomotive)
      for (let i = 0; i < wagons; i++) {
        const left = this.wagonLeft(Math.round(front), i);
        ctx.drawImage(SS.wagonSprite(wagonType, i), left, RAIL_Y - t.h);
        for (const wx of t.wheels) this.drawWheel(ctx, 'wagon', left + wx, RAIL_Y - 4.5, 4.5, 6, wheelDist);
        ctx.fillStyle = '#2a2a2c';
        ctx.fillRect(left + t.w, RAIL_Y - 10, 3, 1);
      }
      ctx.drawImage(loco, lx, ly);
      this.drawWheel(ctx, 'small', lx + 9, RAIL_Y - 4, 4, 6, wheelDist);
      this.drawWheel(ctx, 'small', lx + 56, RAIL_Y - 4, 4, 6, wheelDist);
      const drivers = [lx + 25, lx + 39];
      const dy = RAIL_Y - 6.5;
      for (const x of drivers) this.drawWheel(ctx, 'driver', x, dy, 6.5, 10, wheelDist);
      // Coupling rod and piston rod follow the crank pin
      const ang = wheelDist / 6.5;
      const ox = Math.round(Math.cos(ang) * 3.5), oy = Math.round(Math.sin(ang) * 3.5);
      ctx.fillStyle = '#b8bcc2';
      ctx.fillRect(drivers[0] + ox - 1, Math.round(dy) + oy, drivers[1] - drivers[0] + 2, 2);
      // Piston rod from the front crank pin to the cylinder
      ctx.fillStyle = '#8a8f98';
      ctx.fillRect(drivers[1] + ox, Math.round(dy) + oy, Math.max(1, lx + 50 - (drivers[1] + ox)), 1);
      ctx.fillStyle = '#d8c070';
      ctx.fillRect(drivers[0] + ox, Math.round(dy) + oy, 1, 1);
      ctx.fillRect(drivers[1] + ox, Math.round(dy) + oy, 1, 1);
    }

    drawWheel(ctx, kind, cx, cy, r, spokes, dist) {
      const period = (2 * Math.PI) / spokes;
      const ang = ((dist / r) % period + period) % period;
      const frame = Math.floor((ang / period) * SS.WHEEL_FRAMES) % SS.WHEEL_FRAMES;
      const img = SS.wheel(kind, frame);
      ctx.drawImage(img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
    }
  }

  TG.SideRenderer = SideRenderer;
  TG.SideRenderer.STOP_X = STOP_X;
  TG.SideRenderer.SIGN = { W: SIGN_W, H: SIGN_H };
})(globalThis.TG = globalThis.TG || {});
