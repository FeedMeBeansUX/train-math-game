/*
 * Hand-made puzzle levels (phase 2). Format: see js/core/level.js.
 * Map chars: '.' grass, 'f' flowers (buildable), '~' water, 'T' tree, 'R' rock.
 * Every level carries one known solution; tests/run-tests.js checks it.
 * Curve rotations: 0 = N-E, 1 = E-S, 2 = S-W, 3 = W-N.
 * Straight rotations: 0 = N-S, 1 = E-W.
 * Junction rotations: 0 = W/E/S, 1 = N/S/W, 2 = E/W/N, 3 = S/N/E.
 */
(function (TG) {
  'use strict';

  function row(y, x0, x1, type, rot) {
    const out = [];
    for (let x = x0; x <= x1; x++) out.push({ x, y, type, rot });
    return out;
  }
  function col(x, y0, y1, type, rot) {
    const out = [];
    for (let y = y0; y <= y1; y++) out.push({ x, y, type, rot });
    return out;
  }

  TG.LEVELS = [
    {
      id: 'farm-1',
      theme: 'farm',
      map: [
        'TT..........T.TT',
        'T.....f.........',
        '..........f.....',
        '....f...........',
        '................',
        '................',
        '..f.......f.....',
        '............R...',
        'T....f..........',
        'TT.T........TTTT',
      ],
      stations: [
        { kind: 'depot', x: 4, y: 5, ports: 'E', building: 'N' },
        { kind: 'farm', x: 11, y: 5, ports: 'W', building: 'N' },
      ],
      pieces: { straight: 6 },
      solution: row(5, 5, 10, 'straight', 1),
    },
    {
      id: 'farm-2',
      theme: 'farm',
      map: [
        'TTT....TT.....TT',
        'T.....f.........',
        '........f...T...',
        '..............T.',
        '...f............',
        '.......R........',
        '..T.............',
        '......f.........',
        'T...........TT..',
        'TT..T.......TTTT',
      ],
      stations: [
        { kind: 'depot', x: 4, y: 3, ports: 'E', building: 'N' },
        { kind: 'farm', x: 10, y: 7, ports: 'N', building: 'S' },
      ],
      pieces: { straight: 8, curve: 1 },
      solution: [
        ...row(3, 5, 9, 'straight', 1),
        { x: 10, y: 3, type: 'curve', rot: 2 },
        ...col(10, 4, 6, 'straight', 0),
      ],
    },
    {
      id: 'farm-3',
      theme: 'farm',
      map: [
        'T.T.....TT....TT',
        '...f..........T.',
        '..............f.',
        '.......~~.......',
        '......~~~~......',
        '......~~~~......',
        '......~~~~..R...',
        '.......~~.......',
        '..f.............',
        'TT.....TT....TTT',
      ],
      stations: [
        { kind: 'depot', x: 2, y: 5, ports: 'E', building: 'N' },
        { kind: 'bakery', x: 13, y: 5, ports: 'W', building: 'N' },
      ],
      pieces: { straight: 13, curve: 5 },
      solution: [
        ...row(5, 3, 4, 'straight', 1),
        { x: 5, y: 5, type: 'curve', rot: 3 },
        ...col(5, 3, 4, 'straight', 0),
        { x: 5, y: 2, type: 'curve', rot: 1 },
        ...row(2, 6, 9, 'straight', 1),
        { x: 10, y: 2, type: 'curve', rot: 2 },
        ...col(10, 3, 4, 'straight', 0),
        { x: 10, y: 5, type: 'curve', rot: 0 },
        ...row(5, 11, 12, 'straight', 1),
      ],
    },
    {
      id: 'farm-4',
      theme: 'farm',
      map: [
        'TT.....TTT....TT',
        'T.........f.....',
        '................',
        '...f............',
        '...........T....',
        '..............R.',
        '..f.............',
        '................',
        '............f...',
        'TTT.....TT..TTTT',
      ],
      stations: [
        { kind: 'depot', x: 3, y: 5, ports: 'E', building: 'N' },
        { kind: 'farm', x: 11, y: 2, ports: 'W', building: 'N' },
        { kind: 'bakery', x: 11, y: 8, ports: 'W', building: 'N' },
      ],
      pieces: { straight: 13, curve: 2, junction: 1 },
      solution: [
        ...row(5, 4, 6, 'straight', 1),
        { x: 7, y: 5, type: 'junction', rot: 1 },
        ...col(7, 3, 4, 'straight', 0),
        { x: 7, y: 2, type: 'curve', rot: 1 },
        ...row(2, 8, 10, 'straight', 1),
        ...col(7, 6, 7, 'straight', 0),
        { x: 7, y: 8, type: 'curve', rot: 0 },
        ...row(8, 8, 10, 'straight', 1),
      ],
    },
    {
      id: 'farm-5',
      theme: 'farm',
      map: [
        'TTT.....TTT..TTT',
        'T...f...........',
        '................',
        '..R.........f...',
        '....TT....~~....',
        '...TTT....~~~...',
        '..........~~....',
        '..f.............',
        '...........R....',
        'TT........TTTTTT',
      ],
      stations: [
        { kind: 'depot', x: 2, y: 2, ports: 'E', building: 'N' },
        { kind: 'mill', x: 13, y: 2, ports: 'W', building: 'N' },
        { kind: 'bakery', x: 13, y: 7, ports: 'W', building: 'S' },
        { kind: 'farm', x: 6, y: 8, ports: 'N', building: 'S' },
      ],
      pieces: { straight: 19, curve: 2, junction: 2 },
      solution: [
        ...row(2, 3, 7, 'straight', 1),
        { x: 8, y: 2, type: 'junction', rot: 0 },
        ...row(2, 9, 12, 'straight', 1),
        ...col(8, 3, 6, 'straight', 0),
        { x: 8, y: 7, type: 'junction', rot: 2 },
        ...row(7, 9, 12, 'straight', 1),
        { x: 7, y: 7, type: 'straight', rot: 1 },
        { x: 6, y: 7, type: 'curve', rot: 1 },
      ],
    },
  ];
})(globalThis.TG = globalThis.TG || {});
