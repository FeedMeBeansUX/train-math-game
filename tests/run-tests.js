#!/usr/bin/env node
/*
 * Tests for the pure game logic (no browser needed).
 * Run with: node tests/run-tests.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const FILES = [
  'js/core/util.js',
  'js/core/track.js',
  'js/core/level.js',
  'js/core/network.js',
  'js/data/themes.js',
  'js/data/i18n.js',
  'js/data/levels.js',
];

const context = vm.createContext({ console });
for (const f of FILES) vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), context, { filename: f });
const TG = context.TG;

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ok   ' + name);
  } catch (e) {
    failed++;
    console.log('  FAIL ' + name + '\n       ' + e.message);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
function eq(a, b, msg) {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) throw new Error((msg ? msg + ': ' : '') + 'expected ' + jb + ', got ' + ja);
}

const { track: T, level: L, network: NW } = TG;

console.log('track');
test('curve rotations', () => {
  eq(T.ports('curve', 0), [T.N, T.E]);
  eq(T.ports('curve', 1), [T.E, T.S]);
  eq(T.ports('curve', 2), [T.S, T.W]);
  eq(T.ports('curve', 3), [T.N, T.W]);
});
test('straight has two distinct rotations', () => {
  eq(T.ports('straight', 0), [T.N, T.S]);
  eq(T.ports('straight', 1), [T.E, T.W]);
  eq(T.normalizeRot('straight', 3), 1);
});
test('junction rotations', () => {
  eq(T.ports('junction', 0), [T.E, T.S, T.W]);
  eq(T.ports('junction', 1), [T.N, T.S, T.W]);
});

function tinyLevel(extra) {
  return Object.assign({
    id: 'tiny',
    map: ['.....', '.....', '.....'],
    stations: [
      { kind: 'depot', x: 0, y: 1, ports: 'E', building: 'N' },
      { kind: 'farm', x: 4, y: 1, ports: 'W', building: 'N' },
    ],
    pieces: { straight: 3, curve: 2 },
  }, extra || {});
}

console.log('level');
test('place uses inventory and respects occupied tiles', () => {
  const s = L.createLevel(tinyLevel());
  assert(L.place(s, 1, 1, 'straight', 1), 'first place');
  eq(s.inventory.straight, 2);
  assert(!L.place(s, 1, 1, 'straight', 1), 'cannot place twice on a tile');
  assert(!L.place(s, 0, 1, 'straight', 1), 'cannot place on a station');
  assert(!L.place(s, 0, 0, 'straight', 1), 'cannot place on a station building');
  assert(!L.place(s, 2, 2, 'buffer', 0), 'buffer is not placeable');
});
test('remove returns the piece, fixed pieces stay', () => {
  const s = L.createLevel(tinyLevel());
  L.place(s, 2, 1, 'curve', 0);
  assert(L.removeAt(s, 2, 1));
  eq(s.inventory.curve, 2);
  assert(!L.removeAt(s, 0, 1), 'station track is fixed');
});
test('inventory runs out', () => {
  const s = L.createLevel(tinyLevel({ pieces: { straight: 1 } }));
  assert(L.place(s, 1, 1, 'straight', 1));
  assert(!L.place(s, 2, 1, 'straight', 1));
});
test('cannot build on water, trees or rocks', () => {
  const s = L.createLevel(tinyLevel({ map: ['.....', '.~TR.', '.....'], stations: [
    { kind: 'depot', x: 0, y: 1, ports: 'E', building: 'N' },
    { kind: 'farm', x: 4, y: 1, ports: 'W', building: 'N' },
  ] }));
  for (const x of [1, 2, 3]) assert(!L.canBuild(s, x, 1, 'straight'), 'straight at x=' + x);
  assert(L.canBuild(s, 1, 1, 'bridge') && !L.canBuild(s, 2, 1, 'bridge'), 'bridge on water only');
});

test('bridges only on water, other pieces only on land', () => {
  const s = L.createLevel(tinyLevel({ map: ['.....', '..~..', '.....'], pieces: { straight: 2, bridge: 2 } }));
  assert(!L.place(s, 2, 1, 'straight', 1), 'straight on water');
  assert(!L.place(s, 1, 1, 'bridge', 1), 'bridge on land');
  assert(L.place(s, 2, 1, 'bridge', 1), 'bridge on water');
  L.place(s, 1, 1, 'straight', 1);
  L.place(s, 3, 1, 'straight', 1);
  assert(NW.analyze(s).allConnected, 'bridge connects like a straight');
});
test('water is a dead end without bridges in the level', () => {
  const s = L.createLevel(tinyLevel({ map: ['.....', '..~..', '.....'] }));
  L.place(s, 1, 1, 'straight', 1);
  const end = NW.analyze(s).openEnds.find(o => o.x === 1 && o.y === 1 && o.dir === T.E);
  assert(end && end.blocked);
});

console.log('network');
test('straight line connects two stations', () => {
  const s = L.createLevel(tinyLevel());
  assert(!NW.analyze(s).allConnected);
  for (let x = 1; x <= 3; x++) L.place(s, x, 1, 'straight', 1);
  assert(NW.analyze(s).allConnected);
});
test('a wrongly rotated piece breaks the line', () => {
  const s = L.createLevel(tinyLevel());
  L.place(s, 1, 1, 'straight', 1);
  L.place(s, 2, 1, 'straight', 0);
  L.place(s, 3, 1, 'straight', 1);
  const a = NW.analyze(s);
  assert(!a.allConnected);
  assert(a.openEnds.some(o => o.x === 1 && o.y === 1 && o.dir === T.E && o.blocked), 'blocked open end reported');
  L.rotateAt(s, 2, 1);
  assert(NW.analyze(s).allConnected, 'rotating fixes it');
});
test('a curve does not connect its two closed sides', () => {
  // depot -> curve(W-N) -> ... a curve whose ports touch both neighbours only on one side
  const s = L.createLevel(tinyLevel({ pieces: { straight: 2, junction: 1, curve: 1 } }));
  L.place(s, 1, 1, 'straight', 1);
  L.place(s, 2, 1, 'curve', 3); // W-N: open to the depot side but not to the farm side
  L.place(s, 3, 1, 'straight', 1);
  assert(!NW.analyze(s).allConnected);
});
test('free open ends are reported for the frontier', () => {
  const s = L.createLevel(tinyLevel());
  const a = NW.analyze(s);
  assert(a.openEnds.some(o => o.x === 0 && o.y === 1 && o.dir === T.E && !o.blocked));
  assert(a.connectedStations.has('depot') && !a.connectedStations.has('farm'));
});

console.log('levels');
for (const def of TG.LEVELS) {
  test(def.id + ': loads, starts unsolved, stored solution solves it', () => {
    const s = L.createLevel(def);
    assert(!NW.analyze(s).allConnected, 'already solved at start');
    for (const p of def.solution) {
      assert(L.place(s, p.x, p.y, p.type, p.rot), 'cannot place ' + JSON.stringify(p));
    }
    const a = NW.analyze(s);
    assert(a.allConnected, 'solution does not connect: ' + Array.from(a.connectedStations).join(','));
  });
  test(def.id + ': station names exist in both languages', () => {
    for (const st of def.stations) {
      const n = TG.themes.stationKind(st.kind).name;
      assert(n.nl && n.en, st.kind);
    }
  });
}
test('level ids are unique', () => {
  const ids = TG.LEVELS.map(l => l.id);
  eq(new Set(ids).size, ids.length);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
