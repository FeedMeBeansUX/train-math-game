/*
 * Top-down renderer.
 *
 * Everything is drawn at native pixel-art resolution (16 px per tile) into an
 * off-screen buffer, then copied to the visible canvas scaled by a whole
 * number of device pixels, so pixels stay crisp.
 */
(function (TG) {
  'use strict';

  const S = TG.sprites;
  const T = TG.track;
  const L = TG.level;
  const TILE = S.TILE;
  const hash2 = TG.util.hash2;

  class TopDownRenderer {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.buffer = S.createCanvas(1, 1);
      this.bctx = this.buffer.getContext('2d');
      this.terrain = null;
      this.scale = 1; // device pixels per art pixel
    }

    setLevel(state) {
      this.state = state;
      this.buffer.width = state.w * TILE;
      this.buffer.height = state.h * TILE;
      this.terrain = this.buildTerrain(state);
    }

    /** Fit the map into (cssW x cssH) CSS pixels. Returns the CSS size of one tile. */
    fit(cssW, cssH, dpr) {
      const bw = this.buffer.width, bh = this.buffer.height;
      this.scale = Math.max(1, Math.floor(Math.min((cssW * dpr) / bw, (cssH * dpr) / bh)));
      this.canvas.width = bw * this.scale;
      this.canvas.height = bh * this.scale;
      this.canvas.style.width = (bw * this.scale) / dpr + 'px';
      this.canvas.style.height = (bh * this.scale) / dpr + 'px';
      return (TILE * this.scale) / dpr;
    }

    buildTerrain(state) {
      const c = S.createCanvas(state.w * TILE, state.h * TILE);
      const ctx = c.getContext('2d');
      const isWater = (x, y) => !L.inBounds(state, x, y) || L.terrainAt(state, x, y) === '~';

      for (let y = 0; y < state.h; y++) {
        for (let x = 0; x < state.w; x++) {
          const ch = L.terrainAt(state, x, y);
          const v = Math.floor(hash2(x, y, 7) * 12);
          const px = x * TILE, py = y * TILE;
          if (ch === '~') {
            ctx.drawImage(S.water(v), px, py);
            this.drawBanks(ctx, x, y, isWater);
            continue;
          }
          ctx.drawImage(ch === 'f' ? S.flowers(v) : S.grass(v), px, py);
          if (ch === 'T') ctx.drawImage(S.tree(), px, py);
          if (ch === 'R') ctx.drawImage(S.rock(), px, py);
        }
      }
      for (const st of state.stations) {
        ctx.drawImage(S.building(st.kind), st.bx * TILE, st.by * TILE);
      }
      return c;
    }

    /** Sandy bank and foam along water edges that border land. */
    drawBanks(ctx, x, y, isWater) {
      const px = x * TILE, py = y * TILE;
      ctx.fillStyle = S.C.bank;
      const edges = [];
      if (!isWater(x, y - 1)) edges.push([px, py, TILE, 1, px, py + 1, TILE, 1]);
      if (!isWater(x, y + 1)) edges.push([px, py + TILE - 1, TILE, 1, px, py + TILE - 2, TILE, 1]);
      if (!isWater(x - 1, y)) edges.push([px, py, 1, TILE, px + 1, py, 1, TILE]);
      if (!isWater(x + 1, y)) edges.push([px + TILE - 1, py, 1, TILE, px + TILE - 2, py, 1, TILE]);
      for (const e of edges) {
        ctx.fillStyle = S.C.bank;
        ctx.fillRect(e[0], e[1], e[2], e[3]);
        ctx.fillStyle = S.C.foam;
        ctx.fillRect(e[4], e[5], e[6], e[7]);
      }
    }

    /**
     * view = {
     *   analysis,               result of TG.network.analyze
     *   hover: {x, y} | null,   tile under the mouse
     *   ghost: {type, rot} | null, piece to preview at the hover tile
     *   particles: [],          celebration confetti
     *   time,                   seconds, for animation
     * }
     */
    draw(view) {
      const state = this.state;
      const ctx = this.bctx;
      const a = view.analysis;
      ctx.drawImage(this.terrain, 0, 0);

      // Track
      for (let y = 0; y < state.h; y++) {
        for (let x = 0; x < state.w; x++) {
          const c = state.cells[y * state.w + x];
          if (!c) continue;
          let platform;
          if (c.stationId) platform = L.stationById(state, c.stationId).buildingDir;
          ctx.drawImage(S.track(c.type, c.rot, platform), x * TILE, y * TILE);
          if (!c.fixed && !a.connectedTiles.has(y * state.w + x)) {
            // Not (yet) connected to the start: slightly dimmed
            ctx.fillStyle = 'rgba(20,24,32,0.28)';
            ctx.fillRect(x * TILE, y * TILE, TILE, TILE);
          }
        }
      }

      // Open ends: pulsing markers
      const pulse = 0.55 + 0.45 * Math.sin(view.time * 5);
      for (const o of a.openEnds) {
        const mx = o.x * TILE + 8 + T.DX[o.dir] * 8;
        const my = o.y * TILE + 8 + T.DY[o.dir] * 8;
        ctx.globalAlpha = o.blocked ? 0.9 : pulse;
        ctx.fillStyle = '#1d1b18';
        ctx.fillRect(mx - 2, my - 2, 4, 4);
        ctx.fillStyle = o.blocked ? '#e0473a' : '#ffd84a';
        ctx.fillRect(mx - 1, my - 1, 2, 2);
        ctx.globalAlpha = 1;
      }

      // Hover + ghost piece
      if (view.hover) {
        const { x, y } = view.hover;
        const px = x * TILE, py = y * TILE;
        if (view.ghost && L.canBuild(state, x, y)) {
          ctx.globalAlpha = 0.7;
          ctx.drawImage(S.track(view.ghost.type, view.ghost.rot), px, py);
          ctx.globalAlpha = 1;
        } else if (view.ghost && !L.cellAt(state, x, y)) {
          ctx.fillStyle = 'rgba(224,71,58,0.35)';
          ctx.fillRect(px, py, TILE, TILE);
        }
        this.outline(ctx, px, py, 'rgba(255,255,255,0.8)');
      }

      // Confetti
      for (const p of view.particles || []) {
        ctx.fillStyle = p.color;
        ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
      }

      const out = this.ctx;
      out.imageSmoothingEnabled = false;
      out.drawImage(this.buffer, 0, 0, this.canvas.width, this.canvas.height);
    }

    outline(ctx, px, py, color) {
      ctx.fillStyle = color;
      ctx.fillRect(px, py, TILE, 1);
      ctx.fillRect(px, py + TILE - 1, TILE, 1);
      ctx.fillRect(px, py, 1, TILE);
      ctx.fillRect(px + TILE - 1, py, 1, TILE);
    }

    /** Convert a mouse event position to a tile, or null if outside the map. */
    tileAt(clientX, clientY) {
      const r = this.canvas.getBoundingClientRect();
      const x = Math.floor(((clientX - r.left) / r.width) * this.state.w);
      const y = Math.floor(((clientY - r.top) / r.height) * this.state.h);
      return L.inBounds(this.state, x, y) ? { x, y } : null;
    }
  }

  TG.TopDownRenderer = TopDownRenderer;
})(globalThis.TG = globalThis.TG || {});
