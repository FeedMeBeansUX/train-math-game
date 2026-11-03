/*
 * Track piece definitions.
 *
 * Directions are numbered clockwise: 0 = N, 1 = E, 2 = S, 3 = W.
 * A piece is a list of "links" at rotation 0. A link [a, b] means a train can
 * travel between edge a and edge b of the tile. A link with a single edge [a]
 * is a dead end (buffer stop at a terminal station).
 * Rotating a piece by r quarter turns clockwise maps edge d to (d + r) % 4.
 */
(function (TG) {
  'use strict';

  const N = 0, E = 1, S = 2, W = 3;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const DIR_LETTERS = 'NESW';

  const PIECES = {
    // Placeable pieces (in the inventory). `on` says which ground they go on.
    straight: { links: [[N, S]], rotations: 2, placeable: true, on: 'land' },
    curve:    { links: [[N, E]], rotations: 4, placeable: true, on: 'land' },
    // T-junction: the train may take any pair of its three ends (auto routing).
    junction: { links: [[W, E], [W, S], [E, S]], rotations: 4, placeable: true, on: 'land' },
    // Bridge: a straight piece that can only be placed on water.
    bridge:   { links: [[N, S]], rotations: 2, placeable: true, on: 'water' },
    // Station-only piece: track ending in a buffer stop, open towards N.
    buffer:   { links: [[N]], rotations: 4, placeable: false, on: 'land' },
  };

  /** Order in which placeable pieces appear in the inventory (keys 1, 2, 3…). */
  const INVENTORY_ORDER = ['straight', 'curve', 'junction', 'bridge'];

  function opposite(d) {
    return (d + 2) % 4;
  }

  function dirFromLetter(letter) {
    const d = DIR_LETTERS.indexOf(String(letter).toUpperCase());
    if (d < 0) throw new Error('Unknown direction: ' + letter);
    return d;
  }

  function getPiece(type) {
    const p = PIECES[type];
    if (!p) throw new Error('Unknown piece type: ' + type);
    return p;
  }

  /** Links of a piece after rotation. */
  function links(type, rot) {
    return getPiece(type).links.map(link => link.map(d => (d + rot) % 4));
  }

  /** Sorted, unique edges a rotated piece is open on. */
  function ports(type, rot) {
    const set = new Set();
    for (const link of links(type, rot)) for (const d of link) set.add(d);
    return Array.from(set).sort();
  }

  function normalizeRot(type, rot) {
    const n = getPiece(type).rotations;
    return ((rot % n) + n) % n;
  }

  TG.track = {
    N, E, S, W, DX, DY, DIR_LETTERS,
    PIECES, INVENTORY_ORDER,
    opposite, dirFromLetter, getPiece, links, ports, normalizeRot,
  };
})(globalThis.TG = globalThis.TG || {});
