/*
 * Puzzle generator: makes a new track puzzle for a puzzle level (1-8).
 *
 * Steps:
 *   1. optionally draw a river across the map;
 *   2. place the start station and the other stations (terminals with a buffer stop);
 *   3. scatter obstacles (trees, rocks);
 *   4. build a solution network: a path from the first station to the start,
 *      then each further station branches off the network (making a junction).
 *      Paths cross water only in straight lines (bridges of at most 3 tiles);
 *   5. turn the network into pieces, add spare pieces and decoration;
 *   6. check the result with the real game rules (unsolved at first, solved by the solution).
 * The output has the same format as the hand-made levels in js/data/levels.js.
 */
(function (TG) {
  'use strict';

  const T = TG.track;
  const W = 16, H = 10;

  const PUZZLE_LEVELS = [
    { stations: 2, dist: [4, 6], obstacles: 0, river: 0, spare: 0, straight: true },
    { stations: 2, dist: [5, 9], obstacles: 4, river: 0, spare: 0 },
    { stations: 2, dist: [7, 12], obstacles: 10, river: 0, spare: 1 },
    { stations: 2, dist: [7, 12], obstacles: 8, river: 1, spare: 1 },
    { stations: 3, dist: [4, 10], obstacles: 10, river: 0, spare: 1 },
    { stations: 3, dist: [5, 12], obstacles: 14, river: 0.5, spare: 2 },
    { stations: 4, dist: [4, 11], obstacles: 14, river: 0.4, spare: 2 },
    { stations: 4, dist: [5, 13], obstacles: 18, river: 0.6, spare: 3 },
  ];

  const MAX_BRIDGE = 3;

  function generate(level, seed, theme) {
    theme = theme || 'farm';
    const params = PUZZLE_LEVELS[Math.max(1, Math.min(PUZZLE_LEVELS.length, level)) - 1];
    for (let attempt = 0; attempt < 80; attempt++) {
      const def = tryGenerate(params, (seed + attempt * 7919) >>> 0, theme);
      if (def && verify(def)) {
        def.id = 'gen-' + level + '-' + seed;
        def.generated = { level, seed };
        return def;
      }
    }
    // Should not happen; fall back to the first hand-made level so the game keeps going.
    return TG.LEVELS[0];
  }

  function tryGenerate(params, seed, theme) {
    const rand = TG.util.rng(seed);
    const ri = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
    const pick = list => list[Math.floor(rand() * list.length)];
    const idx = (x, y) => y * W + x;
    const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

    const terrain = new Array(W * H).fill('.');
    const reserved = new Array(W * H).fill(false); // station and building tiles
    const portTile = new Array(W * H).fill(-1);    // tile next to a station's port: station index

    // 1. River
    let river = null;
    if (rand() < params.river) river = drawRiver(terrain, rand, ri);

    const land = (x, y) => inside(x, y) && terrain[idx(x, y)] === '.';
    const free = (x, y) => land(x, y) && !reserved[idx(x, y)] && portTile[idx(x, y)] < 0;

    // 2. Stations
    const stations = [];
    const kinds = shuffleList(TG.themes.THEMES[theme].stations, rand);
    function placeStation(x, y, port, kindName) {
      const p = T.dirFromLetter(port);
      const nx = x + T.DX[p], ny = y + T.DY[p];
      // Building beside the track, on a side perpendicular to the port
      const sides = p % 2 === 0 ? ['E', 'W'] : ['N', 'S'];
      const side = sides.find(sd => {
        const d = T.dirFromLetter(sd);
        return free(x + T.DX[d], y + T.DY[d]);
      });
      if (!side || !free(x, y) || !free(nx, ny)) return false;
      const b = T.dirFromLetter(side);
      reserved[idx(x, y)] = true;
      reserved[idx(x + T.DX[b], y + T.DY[b])] = true;
      portTile[idx(nx, ny)] = stations.length;
      stations.push({ kind: kindName, x, y, ports: port, building: side, entry: { x: nx, y: ny, back: T.opposite(p) } });
      return true;
    }

    if (params.straight) {
      // Level 1: two stations on one row, facing each other
      const y = ri(2, H - 3);
      const len = ri(params.dist[0], params.dist[1]);
      const x0 = ri(1, W - 2 - len);
      if (!placeStation(x0, y, 'E', 'depot') || !placeStation(x0 + len, y, 'W', kinds[0])) return null;
    } else {
      let tries = 0;
      while (stations.length < params.stations && tries++ < 400) {
        const x = ri(1, W - 2), y = ri(1, H - 2);
        const port = pick(['N', 'E', 'S', 'W']);
        if (stations.length > 0) {
          const s0 = stations[0];
          const d = Math.abs(x - s0.x) + Math.abs(y - s0.y);
          if (d < params.dist[0] || d > params.dist[1]) continue;
          if (stations.some(s => Math.abs(s.x - x) + Math.abs(s.y - y) < 3)) continue;
          // With a river, put the first destination on the other side so a bridge is needed
          if (river && stations.length === 1 && sideOf(river, x, y) === sideOf(river, s0.x, s0.y)) continue;
        }
        placeStation(x, y, port, stations.length === 0 ? 'depot' : kinds[(stations.length - 1) % kinds.length]);
      }
      if (stations.length < params.stations) return null;
    }

    // 3. Obstacles: small clusters of trees and single rocks
    for (let i = 0; i < params.obstacles; i++) {
      const x = ri(0, W - 1), y = ri(0, H - 1);
      if (free(x, y)) terrain[idx(x, y)] = rand() < 0.75 ? 'T' : 'R';
    }

    // 4. Network: tile -> set of directions
    const net = new Map();
    const addDir = (x, y, d) => {
      const k = idx(x, y);
      if (!net.has(k)) net.set(k, new Set());
      net.get(k).add(d);
    };
    const noise = Array.from({ length: W * H }, () => rand() * 1.4);

    function connect(si, targetFn) {
      const src = stations[si].entry;
      // Dijkstra over tiles (approximate turn penalty using the best arrival heading)
      const dist = new Map(), prev = new Map(), heading = new Map(), via = new Map();
      const start = idx(src.x, src.y);
      dist.set(start, 0);
      heading.set(start, T.opposite(src.back));
      const open = [start];
      while (open.length) {
        open.sort((a, b) => dist.get(a) - dist.get(b));
        const cur = open.shift();
        const cx = cur % W, cy = Math.floor(cur / W);
        if (cur !== start) {
          const hit = targetFn(cx, cy, cur);
          if (hit) return finish(cur);
        }
        for (let d = 0; d < 4; d++) {
          let nx = cx + T.DX[d], ny = cy + T.DY[d];
          const water = [];
          while (inside(nx, ny) && terrain[idx(nx, ny)] === '~' && water.length <= MAX_BRIDGE) {
            water.push(idx(nx, ny));
            nx += T.DX[d];
            ny += T.DY[d];
          }
          if (water.length > MAX_BRIDGE || !inside(nx, ny)) continue;
          if (water.some(w => net.has(w))) continue;
          const nk = idx(nx, ny);
          const isTarget = targetFn(nx, ny, nk, true);
          const ok = isTarget || (free(nx, ny) && !net.has(nk));
          if (!ok) continue;
          const turn = d === heading.get(cur) ? 0 : 1.5;
          const cost = dist.get(cur) + 1 + noise[nk] + turn + water.length * 1.5;
          if (!dist.has(nk) || cost < dist.get(nk)) {
            dist.set(nk, cost);
            prev.set(nk, cur);
            heading.set(nk, d);
            via.set(nk, { d, water });
            if (!open.includes(nk)) open.push(nk);
          }
        }
      }
      return false;

      function finish(end) {
        let k = end;
        while (k !== start) {
          const p = prev.get(k);
          const { d, water } = via.get(k);
          const px = p % W, py = Math.floor(p / W);
          addDir(px, py, d);
          for (const w of water) {
            addDir(w % W, Math.floor(w / W), d);
            addDir(w % W, Math.floor(w / W), T.opposite(d));
          }
          addDir(k % W, Math.floor(k / W), T.opposite(d));
          k = p;
        }
        addDir(src.x, src.y, src.back);
        return true;
      }
    }

    // First station to the start station's entry tile
    const e0 = stations[0].entry;
    const firstOk = connect(1, (x, y) => x === e0.x && y === e0.y);
    if (!firstOk) return null;
    addDir(e0.x, e0.y, e0.back);
    // Further stations branch off the network at a land tile that has two directions
    for (let si = 2; si < stations.length; si++) {
      const ok = connect(si, (x, y, k) => {
        if (!net.has(k) || terrain[k] !== '.') return false;
        return net.get(k).size === 2;
      });
      if (!ok) return null;
    }
    for (const [k, dirs] of net) if (dirs.size > 3) return null;

    // 5. Pieces
    const solution = [];
    const counts = { straight: 0, curve: 0, junction: 0, bridge: 0 };
    for (const [k, dirs] of net) {
      const x = k % W, y = Math.floor(k / W);
      const p = pieceFor(dirs, terrain[k] === '~');
      if (!p) return null;
      solution.push({ x, y, type: p.type, rot: p.rot });
      counts[p.type]++;
    }
    for (let i = 0; i < params.spare; i++) counts[rand() < 0.5 ? 'straight' : 'curve']++;
    const pieces = {};
    for (const t of T.INVENTORY_ORDER) if (counts[t] > 0) pieces[t] = counts[t];

    // Decoration on tiles the solution does not use: flowers, and trees along the edges
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const k = idx(x, y);
        if (!free(x, y) || net.has(k)) continue;
        const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        const r = rand();
        if (edge && r < 0.35) terrain[k] = 'T';
        else if (r < 0.06) terrain[k] = 'f';
      }
    }

    const map = [];
    for (let y = 0; y < H; y++) map.push(terrain.slice(y * W, y * W + W).join(''));
    return {
      theme,
      map,
      stations: stations.map(s => ({ kind: s.kind, x: s.x, y: s.y, ports: s.ports, building: s.building })),
      pieces,
      solution,
    };
  }

  /** Piece and rotation for a tile's set of directions. */
  function pieceFor(dirs, onWater) {
    const d = Array.from(dirs).sort();
    if (d.length === 2 && T.opposite(d[0]) === d[1]) return { type: onWater ? 'bridge' : 'straight', rot: d[0] % 2 };
    if (onWater) return null;
    if (d.length === 2) {
      const key = d.join('');
      return { type: 'curve', rot: { '01': 0, '12': 1, '23': 2, '03': 3 }[key] };
    }
    if (d.length === 3) {
      const missing = [0, 1, 2, 3].find(x => !dirs.has(x));
      return { type: 'junction', rot: missing };
    }
    return null;
  }

  function drawRiver(terrain, rand, ri) {
    const vertical = rand() < 0.6;
    const width = ri(1, 2);
    const len = vertical ? H : W;
    let pos = vertical ? ri(5, W - 7) : ri(3, H - 5);
    const course = [];
    for (let i = 0; i < len; i++) {
      const before = pos;
      if (i > 0 && rand() < 0.3) pos += rand() < 0.5 ? -1 : 1;
      pos = Math.max(3, Math.min((vertical ? W : H) - 4, pos));
      course.push(pos);
      // Where the river shifts, also fill the corner so it stays connected
      const from = Math.min(before, pos), to = Math.max(before, pos) + width - 1;
      for (let w = from; w <= to; w++) {
        const x = vertical ? w : i, y = vertical ? i : w;
        terrain[y * W + x] = '~';
      }
    }
    return { vertical, course, width };
  }

  function sideOf(river, x, y) {
    return river.vertical ? (x < river.course[y] ? 0 : 1) : (y < river.course[x] ? 0 : 1);
  }

  function shuffleList(list, rand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** The real game rules: starts unsolved, the solution fits the inventory and connects everything. */
  function verify(def) {
    try {
      const s = TG.level.createLevel(def);
      if (TG.network.analyze(s).allConnected) return false;
      for (const p of def.solution) if (!TG.level.place(s, p.x, p.y, p.type, p.rot)) return false;
      return TG.network.analyze(s).allConnected;
    } catch (e) {
      return false;
    }
  }

  TG.generator = { PUZZLE_LEVELS, generate, verify, pieceFor };
})(globalThis.TG = globalThis.TG || {});
