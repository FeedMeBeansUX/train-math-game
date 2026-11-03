/*
 * Train routing over the track network.
 *
 * findRoute() does a breadth-first search on the port graph from
 * TG.network (so trains only travel the way pieces are shaped) and turns the
 * result into a list of segments a train can follow. Geometry is in tile
 * units: tile (x, y) spans x..x+1, y..y+1; the track centre line runs through
 * the middle of each tile edge, curves are quarter circles of radius 0.5.
 *
 * Segment: { x, y, from, to, len, type, stationId }
 *   from/to: edge direction (0-3) or null for the tile centre (start/end station)
 *   type:    the piece on that tile (straight, curve, bridge, ...)
 */
(function (TG) {
  'use strict';

  const T = TG.track;
  const L = TG.level;
  const NW = TG.network;

  const CURVE_LEN = Math.PI / 4; // quarter circle with radius 0.5

  function stationPorts(state, st) {
    const c = L.cellAt(state, st.x, st.y);
    return T.ports(c.type, c.rot).map(d => NW.portId(state, st.x, st.y, d));
  }

  /** Shortest route between two stations, or null if they are not connected. */
  function findRoute(state, graph, fromId, toId) {
    if (fromId === toId) return null;
    const from = L.stationById(state, fromId);
    const to = L.stationById(state, toId);
    const goal = new Set(stationPorts(state, to));
    const prev = new Map();
    const queue = [];
    for (const p of stationPorts(state, from)) {
      prev.set(p, -1);
      queue.push(p);
    }
    let found = -1;
    for (let qi = 0; qi < queue.length && found < 0; qi++) {
      const p = queue[qi];
      if (goal.has(p)) { found = p; break; }
      for (const n of graph.get(p) || []) {
        if (!prev.has(n)) {
          prev.set(n, p);
          queue.push(n);
        }
      }
    }
    if (found < 0) return null;
    const ports = [];
    for (let p = found; p !== -1; p = prev.get(p)) ports.push(p);
    ports.reverse();
    return buildRoute(state, ports, fromId, toId);
  }

  function decode(state, id) {
    const tile = id >> 2;
    return { x: tile % state.w, y: Math.floor(tile / state.w), d: id & 3 };
  }

  function makeSegment(state, x, y, from, to) {
    const c = L.cellAt(state, x, y);
    let len;
    if (from === null || to === null) len = 0.5;
    else if (T.opposite(from) === to) len = 1;
    else len = CURVE_LEN;
    return { x, y, from, to, len, type: c.type, stationId: c.stationId };
  }

  function buildRoute(state, ports, fromId, toId) {
    const p = ports.map(id => decode(state, id));
    const segments = [makeSegment(state, p[0].x, p[0].y, null, p[0].d)];
    let i = 1;
    while (i < p.length) {
      const entry = p[i];
      const exit = p[i + 1];
      if (exit && exit.x === entry.x && exit.y === entry.y) {
        segments.push(makeSegment(state, entry.x, entry.y, entry.d, exit.d));
        i += 2;
      } else {
        segments.push(makeSegment(state, entry.x, entry.y, entry.d, null));
        i += 1;
      }
    }
    let length = 0;
    for (const s of segments) {
      s.start = length;
      length += s.len;
    }
    return { from: fromId, to: toId, segments, length };
  }

  function edgePoint(x, y, d) {
    return { x: x + 0.5 + T.DX[d] * 0.5, y: y + 0.5 + T.DY[d] * 0.5 };
  }

  /** Position and heading (radians, 0 = east) at distance t into a segment. */
  function segmentPoint(s, t) {
    const cx = s.x + 0.5, cy = s.y + 0.5;
    if (s.from === null) {
      return { x: cx + T.DX[s.to] * t, y: cy + T.DY[s.to] * t, heading: Math.atan2(T.DY[s.to], T.DX[s.to]) };
    }
    const a = edgePoint(s.x, s.y, s.from);
    if (s.to === null) {
      return { x: a.x - T.DX[s.from] * t, y: a.y - T.DY[s.from] * t, heading: Math.atan2(-T.DY[s.from], -T.DX[s.from]) };
    }
    if (T.opposite(s.from) === s.to) {
      return { x: a.x + T.DX[s.to] * t, y: a.y + T.DY[s.to] * t, heading: Math.atan2(T.DY[s.to], T.DX[s.to]) };
    }
    // Curve around the tile corner between the two edges
    const has = d => s.from === d || s.to === d;
    const kx = s.x + (has(T.E) ? 1 : 0);
    const ky = s.y + (has(T.S) ? 1 : 0);
    const b = edgePoint(s.x, s.y, s.to);
    const a0 = Math.atan2(a.y - ky, a.x - kx);
    let delta = Math.atan2(b.y - ky, b.x - kx) - a0;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta <= -Math.PI) delta += 2 * Math.PI;
    const ang = a0 + delta * (t / s.len);
    return {
      x: kx + 0.5 * Math.cos(ang),
      y: ky + 0.5 * Math.sin(ang),
      heading: ang + Math.sign(delta) * Math.PI / 2,
    };
  }

  /** Position along the whole route; dist is clamped to [0, length]. */
  function pointAt(route, dist) {
    const d = Math.max(0, Math.min(route.length, dist));
    let seg = route.segments[route.segments.length - 1];
    for (const s of route.segments) {
      if (d <= s.start + s.len) { seg = s; break; }
    }
    const pt = segmentPoint(seg, Math.min(seg.len, d - seg.start));
    pt.segment = seg;
    return pt;
  }

  /** Stretches of the route over a given piece type, e.g. bridges: [{start, end}]. */
  function spans(route, type) {
    const out = [];
    for (const s of route.segments) {
      if (s.type !== type) continue;
      const last = out[out.length - 1];
      if (last && Math.abs(last.end - s.start) < 1e-9) last.end = s.start + s.len;
      else out.push({ start: s.start, end: s.start + s.len });
    }
    return out;
  }

  TG.route = { findRoute, pointAt, segmentPoint, spans, CURVE_LEN };
})(globalThis.TG = globalThis.TG || {});
