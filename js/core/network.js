/*
 * Track network analysis.
 *
 * The network is a graph whose nodes are "ports": one per open edge of a
 * track tile, id = (y * w + x) * 4 + dir. Edges connect
 *   - two ports of the same tile that share a link (a curve joins N and E only), and
 *   - facing ports of neighbouring tiles (E of one tile with W of the next).
 * Because travel goes port to port, connectivity respects how pieces are
 * actually shaped. Phase 3 reuses this graph for train routing.
 */
(function (TG) {
  'use strict';

  const T = TG.track;
  const L = TG.level;

  function portId(state, x, y, d) {
    return (y * state.w + x) * 4 + d;
  }

  function buildGraph(state) {
    const adj = new Map();
    const node = id => {
      if (!adj.has(id)) adj.set(id, []);
      return adj.get(id);
    };
    const connect = (a, b) => {
      node(a).push(b);
      node(b).push(a);
    };
    const openEnds = [];

    for (let y = 0; y < state.h; y++) {
      for (let x = 0; x < state.w; x++) {
        const c = state.cells[y * state.w + x];
        if (!c) continue;
        for (const link of T.links(c.type, c.rot)) {
          for (const d of link) node(portId(state, x, y, d));
          if (link.length === 2) connect(portId(state, x, y, link[0]), portId(state, x, y, link[1]));
        }
        for (const d of T.ports(c.type, c.rot)) {
          const nx = x + T.DX[d], ny = y + T.DY[d];
          const n = L.cellAt(state, nx, ny);
          if (n && T.ports(n.type, n.rot).includes(T.opposite(d))) {
            // Add each tile-to-tile edge once (from the tile with the lower index).
            if (ny * state.w + nx > y * state.w + x) connect(portId(state, x, y, d), portId(state, nx, ny, T.opposite(d)));
          } else {
            // Open end: "free" if a piece could still be placed there, otherwise blocked.
            openEnds.push({ x, y, dir: d, blocked: !L.canBuild(state, nx, ny) });
          }
        }
      }
    }
    return { adj, openEnds };
  }

  function analyze(state) {
    const { adj, openEnds } = buildGraph(state);
    const start = state.stations[0];
    const reached = new Set();
    const queue = [];
    const startCell = L.cellAt(state, start.x, start.y);
    for (const d of T.ports(startCell.type, startCell.rot)) {
      const id = portId(state, start.x, start.y, d);
      reached.add(id);
      queue.push(id);
    }
    while (queue.length) {
      const id = queue.pop();
      for (const next of adj.get(id) || []) {
        if (!reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }

    const connectedTiles = new Set();
    for (const id of reached) connectedTiles.add(id >> 2);

    const connectedStations = new Set();
    for (const st of state.stations) {
      if (connectedTiles.has(st.y * state.w + st.x)) connectedStations.add(st.id);
    }

    return {
      graph: adj,
      openEnds,
      connectedTiles,
      connectedStations,
      allConnected: connectedStations.size === state.stations.length,
    };
  }

  TG.network = { portId, buildGraph, analyze };
})(globalThis.TG = globalThis.TG || {});
