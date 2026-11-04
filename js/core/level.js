/*
 * Level state: terrain, stations, placed track and the piece inventory.
 *
 * Level definition format (see js/data/levels.js):
 *   map:      array of equal-length strings, one char per tile (see TERRAIN)
 *   stations: [{ kind, x, y, ports: 'E' | 'EW' | ..., building: 'N' }]
 *             The first station is the start station (where trains load).
 *             ports: 1 letter = terminal with buffer stop, 2 opposite letters = through station.
 *             building: side of the track tile where the station building stands.
 *   fixed:    optional pre-placed track [{ x, y, type, rot }]
 *   pieces:   inventory, e.g. { straight: 6, curve: 1 }
 *   solution: [{ x, y, type, rot }] one known solution (used by tests and, later, hints)
 */
(function (TG) {
  'use strict';

  const T = TG.track;

  /**
   * Map characters. buildable: track can go here; bridgeable: only a bridge can cross it.
   * Farm maps add crops, meadows with animals and hay bales; racing maps a race track and
   * town maps a road, both winding across the map like a river.
   */
  const TERRAIN = {
    '.': { id: 'grass',     buildable: true },
    'f': { id: 'flowers',   buildable: true },
    '~': { id: 'water',     buildable: false, bridgeable: true },
    '=': { id: 'road',      buildable: false, bridgeable: true },
    '#': { id: 'racetrack', buildable: false, bridgeable: true },
    'T': { id: 'tree',      buildable: false },
    'R': { id: 'rock',      buildable: false },
    'C': { id: 'crops',     buildable: false },
    'A': { id: 'meadow',    buildable: false },
    'H': { id: 'hay',       buildable: false },
  };

  function stationTrack(st) {
    const dirs = st.ports.split('').map(T.dirFromLetter);
    if (dirs.length === 1) return { type: 'buffer', rot: dirs[0] };
    if (dirs.length === 2 && T.opposite(dirs[0]) === dirs[1]) {
      return { type: 'straight', rot: dirs[0] % 2 };
    }
    throw new Error('Station ' + st.kind + ': unsupported ports "' + st.ports + '"');
  }

  function createLevel(def) {
    const h = def.map.length;
    const w = def.map[0].length;
    const size = w * h;
    const state = {
      def,
      w, h,
      terrain: new Array(size),
      cells: new Array(size).fill(null),
      buildings: new Array(size).fill(null),
      stations: [],
      inventory: {},
    };

    def.map.forEach((row, y) => {
      if (row.length !== w) throw new Error(def.id + ': map row ' + y + ' has wrong length');
      for (let x = 0; x < w; x++) {
        if (!TERRAIN[row[x]]) throw new Error(def.id + ': unknown map char "' + row[x] + '"');
        state.terrain[y * w + x] = row[x];
      }
    });

    def.stations.forEach((s, i) => {
      const bd = T.dirFromLetter(s.building || 'N');
      const st = {
        id: s.id || s.kind,
        kind: s.kind,
        x: s.x, y: s.y,
        bx: s.x + T.DX[bd], by: s.y + T.DY[bd],
        buildingDir: bd,
        isStart: i === 0,
      };
      for (const [x, y, what] of [[st.x, st.y, 'track'], [st.bx, st.by, 'building']]) {
        if (!inBounds(state, x, y)) throw new Error(def.id + ': station ' + st.id + ' ' + what + ' outside map');
        if (!TERRAIN[terrainAt(state, x, y)].buildable) {
          throw new Error(def.id + ': station ' + st.id + ' ' + what + ' not on open ground');
        }
      }
      const tr = stationTrack(s);
      state.cells[idx(state, st.x, st.y)] = { type: tr.type, rot: tr.rot, fixed: true, stationId: st.id };
      state.buildings[idx(state, st.bx, st.by)] = st.id;
      state.stations.push(st);
    });

    (def.fixed || []).forEach(f => {
      state.cells[idx(state, f.x, f.y)] = { type: f.type, rot: T.normalizeRot(f.type, f.rot), fixed: true, stationId: null };
    });

    for (const type of T.INVENTORY_ORDER) state.inventory[type] = (def.pieces && def.pieces[type]) || 0;
    return state;
  }

  function idx(state, x, y) {
    return y * state.w + x;
  }

  function inBounds(state, x, y) {
    return x >= 0 && y >= 0 && x < state.w && y < state.h;
  }

  function terrainAt(state, x, y) {
    return state.terrain[idx(state, x, y)];
  }

  function cellAt(state, x, y) {
    return inBounds(state, x, y) ? state.cells[idx(state, x, y)] : null;
  }

  function stationById(state, id) {
    return state.stations.find(s => s.id === id) || null;
  }

  /**
   * Can a new piece go on this tile? With a type: that piece specifically
   * (bridges cross water, roads and race tracks; the rest need open ground). Without: any piece at all.
   */
  function canBuild(state, x, y, type) {
    if (!inBounds(state, x, y)) return false;
    const i = idx(state, x, y);
    if (state.cells[i] || state.buildings[i]) return false;
    const ground = TERRAIN[state.terrain[i]];
    const fits = t => (T.getPiece(t).on === 'water' ? !!ground.bridgeable : ground.buildable);
    return type ? fits(type) : T.INVENTORY_ORDER.some(fits);
  }

  /** Could track still continue onto this tile with the pieces this level offers? */
  function canContinue(state, x, y) {
    return T.INVENTORY_ORDER.some(t => (state.def.pieces[t] || 0) > 0 && canBuild(state, x, y, t));
  }

  function place(state, x, y, type, rot) {
    if (!T.getPiece(type).placeable) return false;
    if (!(state.inventory[type] > 0) || !canBuild(state, x, y, type)) return false;
    state.cells[idx(state, x, y)] = { type, rot: T.normalizeRot(type, rot), fixed: false, stationId: null };
    state.inventory[type]--;
    return true;
  }

  function rotateAt(state, x, y) {
    const c = cellAt(state, x, y);
    if (!c || c.fixed) return false;
    c.rot = T.normalizeRot(c.type, c.rot + 1);
    return true;
  }

  function removeAt(state, x, y) {
    const c = cellAt(state, x, y);
    if (!c || c.fixed) return false;
    state.cells[idx(state, x, y)] = null;
    state.inventory[c.type]++;
    return true;
  }

  TG.level = {
    TERRAIN,
    createLevel, idx, inBounds, terrainAt, cellAt, stationById,
    canBuild, canContinue, place, rotateAt, removeAt,
  };
})(globalThis.TG = globalThis.TG || {});
