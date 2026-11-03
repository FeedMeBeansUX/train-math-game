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
  'js/core/route.js',
  'js/core/round.js',
  'js/core/settings.js',
  'js/core/maths.js',
  'js/data/themes.js',
  'js/data/goods.js',
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

console.log('route');
function solved(id) {
  const def = TG.LEVELS.find(l => l.id === id);
  const s = L.createLevel(def);
  for (const p of def.solution) L.place(s, p.x, p.y, p.type, p.rot);
  return { s, a: NW.analyze(s) };
}
function near(a, b, eps) {
  return Math.abs(a - b) < (eps || 1e-6);
}
test('straight route: length and end points', () => {
  const { s, a } = solved('farm-1');
  const r = TG.route.findRoute(s, a.graph, 'depot', 'farm');
  assert(r, 'route found');
  assert(near(r.length, 7), 'length ' + r.length);
  const p0 = TG.route.pointAt(r, 0), p1 = TG.route.pointAt(r, r.length);
  assert(near(p0.x, 4.5) && near(p0.y, 5.5), 'starts at depot centre');
  assert(near(p1.x, 11.5) && near(p1.y, 5.5), 'ends at farm centre');
  assert(near(p0.heading, 0), 'heading east');
});
test('routes are continuous (no jumps) on every level, between all station pairs', () => {
  for (const def of TG.LEVELS) {
    const { s, a } = solved(def.id);
    for (const from of s.stations) {
      for (const to of s.stations) {
        if (from === to) continue;
        const r = TG.route.findRoute(s, a.graph, from.id, to.id);
        assert(r, def.id + ': no route ' + from.id + ' -> ' + to.id);
        let prev = TG.route.pointAt(r, 0);
        for (let d = 0.02; d <= r.length; d += 0.02) {
          const p = TG.route.pointAt(r, d);
          const jump = Math.hypot(p.x - prev.x, p.y - prev.y);
          assert(jump < 0.03, def.id + ' ' + from.id + '->' + to.id + ': jump ' + jump.toFixed(3) + ' at ' + d.toFixed(2));
          prev = p;
        }
        const end = TG.route.pointAt(r, r.length);
        assert(near(end.x, to.x + 0.5) && near(end.y, to.y + 0.5), def.id + ': ends at destination');
      }
    }
  }
});
test('route through a junction picks the right branch', () => {
  const { s, a } = solved('farm-4');
  const r = TG.route.findRoute(s, a.graph, 'depot', 'bakery');
  assert(r.segments.some(g => g.type === 'junction'), 'uses the junction');
  assert(!r.segments.some(g => g.y < 5 && g.x === 7), 'does not go up to the farm');
});
test('bridge spans are reported', () => {
  const { s, a } = solved('farm-river');
  const r = TG.route.findRoute(s, a.graph, 'depot', 'market');
  const sp = TG.route.spans(r, 'bridge');
  eq(sp.length, 1);
  assert(near(sp[0].end - sp[0].start, 2), 'two bridge tiles');
});
test('no route when not connected', () => {
  const s = L.createLevel(TG.LEVELS[0]);
  eq(TG.route.findRoute(s, NW.analyze(s).graph, 'depot', 'farm'), null);
});

console.log('round');
const RD = () => TG.round;
function testRound(orders) {
  return RD().createRound(orders.map((o, i) => Object.assign({ id: 'o' + i, delivered: 0 }, o)), 2);
}
const M = () => TG.maths;
const ALL = { maxNumber: 20, skills: { count: true, add: true, subtract: true, multiply: true } };
function only(skill, max) {
  const skills = { count: false, add: false, subtract: false, multiply: false };
  skills[skill] = true;
  return { maxNumber: max || 20, skills };
}
function planMany(settings, fn) {
  for (const def of TG.LEVELS) {
    const s = L.createLevel(def);
    for (let seed = 1; seed <= 60; seed++) fn(M().planRound(s, settings, seed), s, def, seed);
  }
}
test('settings: defaults, normalising and at least one skill', () => {
  const d = TG.settings.normalize(null);
  eq(d.maxNumber, 20);
  eq(d.skills.multiply, false);
  eq(TG.settings.normalize({ maxNumber: 7 }).maxNumber, 20, 'unknown max falls back');
  const none = TG.settings.normalize({ skills: { count: false, add: false, subtract: false, multiply: false } });
  assert(none.skills.count, 'counting switched back on');
});
test('plans only use enabled skills', () => {
  for (const skill of ['count', 'add', 'subtract', 'multiply']) {
    planMany(only(skill), p => assert(p.skill === skill, skill + ' gave ' + p.skill));
  }
});
test('every order is for a station that wants the good; numbers stay within the maximum', () => {
  for (const max of [10, 20, 50]) {
    planMany(Object.assign({}, ALL, { maxNumber: max }), (p, s, def, seed) => {
      assert(p.orders.length > 0, def.id + ' no orders');
      for (const o of p.orders) {
        const st = L.stationById(s, o.stationId);
        assert(!st.isStart, 'order for the start station');
        const ok = o.good === 'parcel' || o.good === 'passenger' || TG.themes.stationKind(st.kind).wants.includes(o.good);
        assert(ok, def.id + ': ' + st.kind + ' does not want ' + o.good);
        assert(o.amount >= 1 && o.amount <= max, def.id + ' seed ' + seed + ': amount ' + o.amount + ' > ' + max);
      }
      assert(p.preload.length <= max, 'preload too big');
      const total = p.orders.reduce((n, o) => n + o.amount, 0);
      if (p.mode === 'goods') assert(Math.max(total, p.preload.length) <= 30 || p.kind === 'count', p.kind + ' does not fit the train: ' + total);
    });
  }
});
test('addition: parcels to two or three stations, summing to at most the maximum', () => {
  planMany(only('add'), (p, s) => {
    if (p.kind !== 'add') return;
    assert(p.orders.length >= 2 && p.orders.length <= 3);
    assert(p.orders.every(o => o.good === 'parcel'));
    assert(p.orders.reduce((n, o) => n + o.amount, 0) <= 20);
  });
});
test('addition on a one-station level becomes "top up" (missing addend)', () => {
  const s = L.createLevel(TG.LEVELS[0]);
  for (let seed = 1; seed < 30; seed++) {
    const p = M().planRound(s, only('add'), seed);
    eq(p.kind, 'missing');
    assert(p.preload.length >= 1 && p.preload.length < p.orders[0].amount, 'preload smaller than the order');
  }
});
test('subtraction: the train starts with more than the station wants', () => {
  planMany(only('subtract'), p => {
    eq(p.kind, 'takeaway');
    assert(p.preload.length > p.orders[0].amount);
    assert(p.preload.every(g => g === p.orders[0].good));
  });
});
test('multiplication: passengers in whole carriages of 2, 5 or 10', () => {
  planMany(only('multiply'), p => {
    eq(p.mode, 'passengers');
    assert(M().COACH_SIZES.includes(p.perWagon));
    const n = p.orders[0].amount;
    assert(n % p.perWagon === 0 && n / p.perWagon >= 2 && n / p.perWagon <= M().MAX_COACHES, n + ' / ' + p.perWagon);
  });
});
test('the same kind is not planned twice in a row when there is a choice', () => {
  const s = L.createLevel(TG.LEVELS[5]);
  for (let seed = 1; seed < 40; seed++) {
    const p = M().planRound(s, ALL, seed, 'count');
    assert(p.kind !== 'count');
  }
});
test('plans are reproducible with the same seed', () => {
  const s = L.createLevel(TG.LEVELS[5]);
  eq(M().planRound(s, ALL, 9), M().planRound(s, ALL, 9));
});
test('passengers: board as many as fit, empty seats cost a star', () => {
  const orders = [{ id: 'o0', stationId: 'market', good: 'passenger', amount: 10, delivered: 0 }];
  const r = RD().createRound(orders, { mode: 'passengers', wagons: 1, perWagon: 5, wagonType: 'coach5' });
  eq(RD().waitingPassengers(r), 10);
  assert(RD().setWagons(r, 3));
  eq(r.capacity, 15);
  RD().recordDeparture(r, true);
  eq(RD().board(r), 10);
  eq(r.emptySeats, 5);
  RD().deliverAt(r, 'market');
  assert(RD().isComplete(r));
  eq(RD().stars(r), 2);
});
test('passengers: too few carriages means a second trip', () => {
  const orders = [{ id: 'o0', stationId: 'market', good: 'passenger', amount: 10, delivered: 0 }];
  const r = RD().createRound(orders, { mode: 'passengers', wagons: 1, perWagon: 5 });
  RD().recordDeparture(r, true);
  eq(RD().board(r), 5);
  eq(RD().waitingPassengers(r), 5);
  RD().deliverAt(r, 'market');
  RD().recordDeparture(r, true);
  eq(RD().board(r), 5);
  RD().deliverAt(r, 'market');
  assert(RD().isComplete(r));
  eq(RD().stars(r), 2, 'one extra trip');
});
test('preloaded goods count as load and can be taken out', () => {
  const orders = [{ id: 'o0', stationId: 'farm', good: 'chicken', amount: 3, delivered: 0 }];
  const r = RD().createRound(orders, { preload: ['chicken', 'chicken', 'chicken', 'chicken', 'chicken'] });
  eq(RD().count(r, 'chicken'), 5);
  RD().unloadOne(r, 'chicken'); RD().unloadOne(r, 'chicken');
  RD().recordDeparture(r, true);
  RD().deliverAt(r, 'farm');
  eq(RD().stars(r), 3);
});
test('loading keeps goods grouped and respects capacity', () => {
  const r = testRound([{ stationId: 'farm', good: 'chicken', amount: 3 }]);
  RD().loadOne(r, 'apple'); RD().loadOne(r, 'chicken'); RD().loadOne(r, 'apple');
  eq(r.load, ['apple', 'apple', 'chicken']);
  for (let i = 0; i < 30; i++) RD().loadOne(r, 'chicken');
  eq(r.load.length, 20, 'two wagons of ten');
  eq(RD().loadOne(r, 'apple'), -1);
  eq(RD().unloadOne(r, 'apple'), 1);
  eq(RD().count(r, 'apple'), 1);
});
test('exact delivery completes the order, no leftovers: 3 stars', () => {
  const r = testRound([{ stationId: 'farm', good: 'chicken', amount: 3 }]);
  for (let i = 0; i < 3; i++) RD().loadOne(r, 'chicken');
  RD().recordDeparture(r, true);
  const res = RD().deliverAt(r, 'farm');
  eq(res.deliveries, [{ good: 'chicken', given: 3, missing: 0, left: 0 }]);
  eq(res.removed.length, 3);
  assert(RD().isComplete(r));
  eq(RD().stars(r), 3);
});
test('too few: missing is reported and the order stays open', () => {
  const r = testRound([{ stationId: 'farm', good: 'chicken', amount: 5 }]);
  for (let i = 0; i < 3; i++) RD().loadOne(r, 'chicken');
  const res = RD().deliverAt(r, 'farm');
  eq(res.deliveries[0], { good: 'chicken', given: 3, missing: 2, left: 0 });
  assert(!RD().isComplete(r));
  // Fetch two more and deliver again
  RD().loadOne(r, 'chicken'); RD().loadOne(r, 'chicken');
  eq(RD().deliverAt(r, 'farm').deliveries[0], { good: 'chicken', given: 2, missing: 0, left: 0 });
  assert(RD().isComplete(r));
});
test('too many: the rest stays in the train and costs a star', () => {
  const r = testRound([{ stationId: 'farm', good: 'chicken', amount: 2 }, { stationId: 'bakery', good: 'flour', amount: 1 }]);
  for (let i = 0; i < 4; i++) RD().loadOne(r, 'chicken');
  RD().loadOne(r, 'flour');
  RD().recordDeparture(r, true);
  eq(RD().deliverAt(r, 'farm').deliveries[0], { good: 'chicken', given: 2, missing: 0, left: 2 });
  RD().deliverAt(r, 'bakery');
  assert(RD().isComplete(r));
  eq(RD().leftovers(r), [{ good: 'chicken', n: 2 }]);
  eq(RD().stars(r), 2);
});
test('removed indices point at the delivered items', () => {
  const r = testRound([{ stationId: 'bakery', good: 'flour', amount: 2 }]);
  ['apple', 'flour', 'flour', 'flour', 'egg'].forEach(g => RD().loadOne(r, g));
  const res = RD().deliverAt(r, 'bakery');
  eq(res.removed.sort(), [2, 3]);
  eq(r.load, ['apple', 'flour', 'egg']);
});
test('every station kind in the levels can order something, and goods have names', () => {
  for (const def of TG.LEVELS) for (const st of def.stations.slice(1)) {
    const wants = TG.themes.stationKind(st.kind).wants;
    assert(wants.length > 0, st.kind);
    for (const g of wants) assert(TG.GOODS[g] && TG.GOODS[g].nl.length === 2 && TG.GOODS[g].en.length === 2, g);
  }
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
