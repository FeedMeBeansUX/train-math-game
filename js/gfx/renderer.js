/*
 * Top-down renderer.
 *
 * Everything is drawn at native pixel-art resolution (32 px per tile) into an
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
      const c = S.terrain(state);
      const ctx = c.getContext('2d');
      for (let y = 0; y < state.h; y++) {
        for (let x = 0; x < state.w; x++) {
          const ch = L.terrainAt(state, x, y);
          const v = Math.floor(hash2(x, y, 7) * 12);
          if (ch === 'T') ctx.drawImage(S.tree(v), x * TILE, y * TILE);
          if (ch === 'R') ctx.drawImage(S.rock(v), x * TILE, y * TILE);
        }
      }
      for (const st of state.stations) {
        ctx.drawImage(S.building(st.kind), st.bx * TILE, st.by * TILE);
      }
      return c;
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
      const half = TILE / 2;
      for (const o of a.openEnds) {
        const mx = o.x * TILE + half + T.DX[o.dir] * half;
        const my = o.y * TILE + half + T.DY[o.dir] * half;
        ctx.globalAlpha = o.blocked ? 0.9 : pulse;
        ctx.fillStyle = '#1d1b18';
        ctx.fillRect(mx - 4, my - 4, 8, 8);
        ctx.fillStyle = o.blocked ? '#e0473a' : '#ffd84a';
        ctx.fillRect(mx - 3, my - 3, 6, 6);
        ctx.fillStyle = o.blocked ? '#f08a80' : '#fff1a8';
        ctx.fillRect(mx - 3, my - 3, 2, 2);
        ctx.globalAlpha = 1;
      }

      // Hover + ghost piece
      if (view.hover) {
        const { x, y } = view.hover;
        const px = x * TILE, py = y * TILE;
        if (view.ghost && L.canBuild(state, x, y, view.ghost.type)) {
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
      ctx.fillRect(px, py, TILE, 2);
      ctx.fillRect(px, py + TILE - 2, TILE, 2);
      ctx.fillRect(px, py, 2, TILE);
      ctx.fillRect(px + TILE - 2, py, 2, TILE);
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
