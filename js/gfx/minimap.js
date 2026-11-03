/*
 * Mini-map: a small top-down overview of the level showing the track the
 * player built, the stations, the current route and the moving train.
 */
(function (TG) {
  'use strict';

  const T = TG.track;
  const L = TG.level;
  const R = TG.route;
  const PX = 6; // art pixels per tile

  const COLORS = {
    grass: '#4f7f36', grass2: '#58893c', water: '#3b6ea5', tree: '#2f5225', rock: '#7a766f',
    track: '#2a2522', route: '#ffd84a', station: '#f2efe6', start: '#ffd84a', building: '#9c3d30', train: '#e0473a',
  };

  class Minimap {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
    }

    setLevel(state) {
      this.state = state;
      this.base = TG.sprites.createCanvas(state.w * PX, state.h * PX);
      this.canvas.width = this.base.width;
      this.canvas.height = this.base.height;
      this.drawBase();
    }

    drawBase() {
      const s = this.state;
      const ctx = this.base.getContext('2d');
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const ch = L.terrainAt(s, x, y);
          ctx.fillStyle = ch === '~' ? COLORS.water : (x + y) % 2 ? COLORS.grass : COLORS.grass2;
          ctx.fillRect(x * PX, y * PX, PX, PX);
          if (ch === 'T') { ctx.fillStyle = COLORS.tree; ctx.fillRect(x * PX + 1, y * PX + 1, PX - 2, PX - 2); }
          if (ch === 'R') { ctx.fillStyle = COLORS.rock; ctx.fillRect(x * PX + 2, y * PX + 2, PX - 3, PX - 3); }
        }
      }
      // Track: sample each link's centre line
      ctx.fillStyle = COLORS.track;
      for (let y = 0; y < s.h; y++) {
        for (let x = 0; x < s.w; x++) {
          const c = s.cells[y * s.w + x];
          if (!c) continue;
          for (const link of T.links(c.type, c.rot)) {
            const seg = link.length === 2
              ? { x, y, from: link[0], to: link[1], len: T.opposite(link[0]) === link[1] ? 1 : R.CURVE_LEN }
              : { x, y, from: null, to: link[0], len: 0.5 };
            for (let i = 0; i <= 12; i++) this.dot(ctx, R.segmentPoint(seg, (seg.len * i) / 12), 1);
          }
        }
      }
      for (const st of s.stations) {
        ctx.fillStyle = COLORS.building;
        ctx.fillRect(st.bx * PX + 1, st.by * PX + 1, PX - 2, PX - 2);
      }
    }

    dot(ctx, p, size) {
      ctx.fillRect(Math.floor(p.x * PX - size / 2 + 0.5), Math.floor(p.y * PX - size / 2 + 0.5), size, size);
    }

    /** route may be null; dist = how far the train is along it. */
    draw(route, dist, currentId, time) {
      const ctx = this.ctx;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.base, 0, 0);
      if (route) {
        ctx.fillStyle = COLORS.route;
        for (let d = 0; d <= route.length; d += 0.08) this.dot(ctx, R.pointAt(route, d), 1);
      }
      for (const st of this.state.stations) {
        ctx.fillStyle = st.isStart ? COLORS.start : COLORS.station;
        ctx.fillRect(st.x * PX + 1, st.y * PX + 1, PX - 2, PX - 2);
      }
      // The train: a blinking red block
      let p;
      if (route) p = R.pointAt(route, dist);
      else {
        const st = L.stationById(this.state, currentId);
        p = { x: st.x + 0.5, y: st.y + 0.5 };
      }
      const on = Math.floor(time * 3) % 2 === 0;
      ctx.fillStyle = '#1d1b18';
      this.dot(ctx, p, 5);
      ctx.fillStyle = on ? COLORS.train : '#ff8a7a';
      this.dot(ctx, p, 3);
    }
  }

  TG.Minimap = Minimap;
})(globalThis.TG = globalThis.TG || {});
