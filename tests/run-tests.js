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
  'js/core/progress.js',
  'js/core/maths.js',
  'js/core/generator.js',
  'js/data/themes.js',
  'js/data/goods.js',
  'js/data/i18n.js',
  'js/data/levels.js',
  // Sprite modules only define drawing functions at load time, so their data can be checked here
  'js/gfx/sprites.js',
  'js/gfx/side-sprites.js',
  'js/audio/sound.js',
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

console.log('progress');
test('staircase: two 3-star results go up, one 1-star result goes down', () => {
  const P = TG.progress;
  let s = { level: 1, streak: 0, history: [] };
  s = P.applyResult(s, 3); eq(s.level, 1);
  s = P.applyResult(s, 3); eq(s.level, 2);
  s = P.applyResult(s, 3); s = P.applyResult(s, 2); s = P.applyResult(s, 3); eq(s.level, 2, '2 stars resets the streak');
  s = P.applyResult(s, 1); eq(s.level, 1);
  s = P.applyResult(s, 1); eq(s.level, 1, 'not below 1');
  for (let i = 0; i < 40; i++) s = P.applyResult(s, 3);
  eq(s.level, P.MAX_LEVEL, 'not above the maximum');
  eq(s.history.length, 10, 'history is kept short');
});
test('puzzle stars from pieces taken back', () => {
  const P = TG.progress;
  eq(P.puzzleStars(0, 6), 3);
  eq(P.puzzleStars(1, 6), 3);
  eq(P.puzzleStars(3, 6), 2);
  eq(P.puzzleStars(8, 6), 1);
  eq(P.puzzleStars(2, 20), 3);
  eq(P.puzzleStars(8, 20), 2);
});
test('progress: record, limits follow the level and the parent maximum', () => {
  const P = TG.progress;
  P.use(null);
  const st = { maxNumber: 20, skills: {}, adaptive: true };
  eq(P.limit('add', st), 15, 'level 1 addition already goes up to 15');
  eq(P.limit('multiply', st), 10);
  P.record('multiply', 3); P.record('multiply', 3);
  eq(P.level('multiply'), 2);
  eq(P.limit('multiply', st), 15);
  eq(P.limit('add', Object.assign({}, st, { adaptive: false })), 20, 'not adaptive: the parent maximum');
  eq(P.get().totalStars, 6);
  eq(P.normalize({ skills: { add: { level: 99 } } }).skills.add.level, P.MAX_LEVEL);
  P.use(null);
});
test('adaptive plans stay within the level range', () => {
  TG.progress.use(null); // everything at level 1
  const st = { maxNumber: 20, adaptive: true, skills: { count: true, add: true, subtract: true, multiply: true, divide: true } };
  for (const def of TG.LEVELS) {
    const s = L.createLevel(def);
    for (let seed = 1; seed < 40; seed++) {
      const p = M().planRound(s, st, seed);
      const lim = TG.progress.limit(p.skill, st);
      for (const o of p.orders) assert(o.amount <= lim, p.kind + ' amount ' + o.amount + ' > ' + lim);
      assert(p.preload.length <= lim, 'preload');
      if (p.kind === 'multiply') assert([2, 5].includes(p.perWagon), 'level 1 multiplication uses carriages of 2 or 5');
    }
  }
});
test('division: equal shares of parcels over 2+ stations, unloaded by hand', () => {
  TG.progress.use(null);
  const st = { maxNumber: 20, adaptive: false, skills: { count: false, add: false, subtract: false, multiply: false, divide: true } };
  const s = L.createLevel(TG.LEVELS[5]);
  for (let seed = 1; seed < 40; seed++) {
    const p = M().planRound(s, st, seed);
    eq(p.kind, 'divide');
    assert(p.manual && p.hideAmounts, 'manual and hidden');
    assert(p.orders.length >= 2);
    assert(new Set(p.orders.map(o => o.amount)).size === 1, 'equal shares');
    assert(p.orders[0].amount >= 2, 'at least 2 each');
    assert(p.orders.every(o => o.good === 'parcel'));
  }
});
test('manual unloading: exact amount accepted, wrong amounts counted as mistakes', () => {
  const orders = [{ id: 'o0', stationId: 'farm', good: 'chicken', amount: 4, delivered: 0 }];
  const r = RD().createRound(orders, { preload: ['chicken', 'chicken', 'chicken', 'chicken', 'chicken', 'chicken'] });
  eq(RD().unloadAt(r, 'farm', 5).reason, 'tooMany');
  eq(RD().unloadAt(r, 'farm', 2).reason, 'tooFew');
  const ok = RD().unloadAt(r, 'farm', 4);
  assert(ok.ok);
  eq(ok.removed.length, 4);
  eq(RD().count(r, 'chicken'), 2);
  eq(r.unloadMistakes, 2);
  eq(RD().unloadAt(r, 'farm', 1).reason, 'none', 'order already done');
});
test('manual unloading: everything in the train is accepted when it is less than needed', () => {
  const orders = [{ id: 'o0', stationId: 'farm', good: 'chicken', amount: 5, delivered: 0 }];
  const r = RD().createRound(orders, { preload: ['chicken', 'chicken'] });
  const res = RD().unloadAt(r, 'farm', 2);
  assert(res.ok);
  eq(res.delivery.missing, 3);
});

test('no tiny numbers: every part at least 2, and level 1 already reaches 10 or more', () => {
  TG.progress.use(null);
  const st = { maxNumber: 20, adaptive: true, skills: { count: true, add: true, subtract: true, multiply: false, divide: false } };
  let big = 0;
  for (const def of TG.LEVELS) {
    const s = L.createLevel(def);
    for (let seed = 1; seed < 50; seed++) {
      const p = M().planRound(s, st, seed);
      for (const o of p.orders) assert(o.amount >= 2, p.kind + ' amount ' + o.amount);
      const pre = p.preload.length;
      if (p.kind === 'missing') assert(pre >= 2 && p.orders[0].amount - pre >= 2, 'top up: ' + pre + ' -> ' + p.orders[0].amount);
      if (p.kind === 'takeaway') assert(pre - p.orders[0].amount >= 2, 'take away at least 2');
      if (p.kind === 'count') for (const o of p.orders) assert(o.amount >= 3, 'count at least 3');
      if (Math.max(pre, ...p.orders.map(o => o.amount), p.orders.reduce((n, o) => n + o.amount, 0)) >= 10) big++;
    }
  }
  assert(big > 150, 'most level-1 rounds use numbers of 10 or more: ' + big);
});
test('freight trains get one wagon per kind of good', () => {
  const st = { maxNumber: 20, adaptive: false, skills: { count: true, add: true, subtract: true, multiply: false, divide: true } };
  const s = L.createLevel(TG.LEVELS[5]);
  for (let seed = 1; seed < 40; seed++) {
    const p = M().planRound(s, st, seed);
    eq(p.wagons, new Set(p.orders.map(o => o.good)).size, p.kind);
  }
});
test('sums: the answer makes the sum true, four different choices including the answer', () => {
  const st = { maxNumber: 20, adaptive: false, skills: { count: true, add: true, subtract: true, multiply: true, divide: true } };
  const evalSum = (tokens, x) => {
    const v = tokens.map(t => (t === '?' ? x : t));
    const eqAt = v.indexOf('=');
    const side = part => {
      let acc = null, op = '+';
      for (const t of part) {
        if (typeof t === 'string') { op = t; continue; }
        const n = typeof t === 'object' ? t.icons : t;
        acc = acc === null ? n : op === '+' ? acc + n : op === '−' ? acc - n : op === '×' ? acc * n : acc / n;
      }
      return acc;
    };
    return side(v.slice(0, eqAt)) === side(v.slice(eqAt + 1));
  };
  for (const def of TG.LEVELS) {
    const s = L.createLevel(def);
    for (let seed = 1; seed < 40; seed++) {
      const p = M().planRound(s, st, seed);
      assert(p.problems.length >= 1, 'a sum for every round');
      for (const pr of p.problems) {
        assert(evalSum(pr.tokens, pr.answer), p.kind + ': ' + JSON.stringify(pr.tokens) + ' with ' + pr.answer);
        eq(pr.choices.length, 4);
        eq(new Set(pr.choices).size, 4, 'different choices');
        assert(pr.choices.includes(pr.answer), 'answer among the choices');
        assert(pr.choices.every(c => c >= 1), 'no zero or negative choices');
      }
      if (p.kind === 'divide') {
        const up = M().unloadProblem(p, p.orders[0], seed);
        assert(evalSum(up.tokens, up.answer) && up.answer === p.orders[0].amount, 'sharing sum');
      }
    }
  }
});

test('follow-up sums: too few means "have + ? = need", too many means "have - ? = need"', () => {
  const few = M().trainCorrection('fuel', 5, 7, 1);
  eq(few.tokens, [5, '+', '?', '=', 7]);
  eq(few.answer, 2);
  eq(few.action, 'load');
  eq(few.question, 'qMore');
  const many = M().trainCorrection('fuel', 9, 7, 1);
  eq(many.tokens, [9, '−', '?', '=', 7]);
  eq(many.action, 'unload');
  eq(M().trainCorrection('fuel', 7, 7, 1), null);
  const st = M().stationCorrection('tyre', 12, 10, 1);
  eq(st.tokens, [12, '−', '?', '=', 10]);
  eq(st.action, 'takeback');
  eq(M().stationCorrection('tyre', 6, 10, 1).action, 'unload');
  for (const pr of [few, many, st]) assert(pr.choices.includes(pr.answer) && pr.choices.length === 4);
});
test('unloading with answer buttons: too many can go back, the order is done only when exact', () => {
  const orders = [{ id: 'o0', stationId: 'garage', good: 'tyre', amount: 10, delivered: 0 }];
  const r = RD().createRound(orders, { preload: Array(14).fill('tyre') });
  eq(RD().needAtStart(r, 'tyre'), 10);
  const o = RD().orderAt(r, 'garage');
  eq(RD().unloadTo(r, o, 12).length, 12);
  eq(o.delivered, 12);
  assert(!RD().isComplete(r), 'too many is not done');
  eq(RD().orderAt(r, 'garage'), o, 'still needs fixing');
  eq(RD().takeBack(r, o, 2), 2);
  eq(o.delivered, 10);
  eq(RD().count(r, 'tyre'), 4);
  assert(RD().isComplete(r));
  eq(RD().orderAt(r, 'garage'), null);
  eq(RD().unloadTo(r, { good: 'tyre', delivered: 0, amount: 99 }, 50).length, 4, 'never more than the train holds');
});
test('corrections cost stars: one for the first, another after three', () => {
  const orders = [{ id: 'o0', stationId: 'farm', good: 'hay', amount: 2, delivered: 2 }];
  const r = RD().createRound(orders, {});
  RD().recordDeparture(r, true);
  eq(RD().stars(r), 3);
  r.corrections = 1;
  eq(RD().stars(r), 2);
  r.corrections = 3;
  eq(RD().stars(r), 1);
});
test('first sums carry their question: top up and take away mention what is already in the train', () => {
  const st = (skill) => ({ maxNumber: 20, adaptive: false, skills: Object.assign({ count: false, add: false, subtract: false, multiply: false, divide: false }, { [skill]: true }) });
  const s = L.createLevel(TG.LEVELS[0]);
  const pa = M().planRound(s, st('add'), 3);
  eq(pa.problems[0].question, 'qMore');
  eq(pa.problems[0].n, pa.preload.length);
  const ps = M().planRound(s, st('subtract'), 3);
  eq(ps.problems[0].question, 'qLess');
});

console.log('generator');
test('generated puzzles: valid and solvable at every level', () => {
  for (let level = 1; level <= TG.generator.PUZZLE_LEVELS.length; level++) {
    const params = TG.generator.PUZZLE_LEVELS[level - 1];
    for (let seed = 1; seed <= 40; seed++) {
      const def = TG.generator.generate(level, seed * 101);
      assert(def.generated, 'level ' + level + ' seed ' + seed + ': generation fell back');
      assert(TG.generator.verify(def), 'not solvable');
      eq(def.stations.length, params.stations, 'station count');
      eq(def.map.length, 10);
      assert(def.map.every(r => r.length === 16));
      const used = {};
      for (const p of def.solution) used[p.type] = (used[p.type] || 0) + 1;
      for (const t in used) assert(def.pieces[t] >= used[t], 'inventory too small for ' + t);
      if (params.straight) eq(def.solution.length, def.solution.filter(p => p.type === 'straight').length, 'level 1 is straight');
    }
  }
});
test('generated puzzles: higher levels use junctions and bridges', () => {
  let junctions = 0, bridges = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const def = TG.generator.generate(8, seed * 13);
    if (def.pieces.junction) junctions++;
    if (def.pieces.bridge) bridges++;
  }
  assert(junctions === 30, 'every 4-station puzzle needs junctions: ' + junctions);
  assert(bridges >= 8, 'rivers appear: ' + bridges);
});
test('generated puzzles are reproducible', () => {
  eq(TG.generator.generate(5, 1234), TG.generator.generate(5, 1234));
});
test('generated puzzles support every round kind', () => {
  const st = { maxNumber: 20, adaptive: false, skills: { count: true, add: true, subtract: true, multiply: true, divide: true } };
  for (let level = 1; level <= 8; level++) {
    const def = TG.generator.generate(level, 77 + level);
    const s = L.createLevel(def);
    for (const p of def.solution) L.place(s, p.x, p.y, p.type, p.rot);
    const a = NW.analyze(s);
    for (let seed = 1; seed < 15; seed++) {
      const plan = M().planRound(s, st, seed);
      for (const o of plan.orders) assert(TG.route.findRoute(s, a.graph, s.stations[0].id, o.stationId), 'route to ' + o.stationId);
    }
  }
});

console.log('themes');
test('every theme has four stations with names, art and goods they want', () => {
  for (const t of TG.themes.THEME_ORDER) {
    const th = TG.themes.THEMES[t];
    eq(th.stations.length, 4, t);
    assert(th.name.nl && th.name.en, t + ' name');
    for (const k of th.stations) {
      const sk = TG.themes.stationKind(k);
      assert(sk.name.nl && sk.name.en && (sk.name.article === 'de' || sk.name.article === 'het'), k + ' name');
      assert(sk.art && sk.art.roof && sk.art.wall && sk.art.emblem, k + ' art');
      assert(sk.wants.length > 0, k + ' wants something');
    }
  }
});
test('every good has Dutch and English names and an 8x8 icon', () => {
  for (const g in TG.GOODS) {
    const n = TG.GOODS[g];
    assert(n.nl.length === 2 && n.en.length === 2, g + ' names');
    const icon = TG.sideSprites.GOOD_ICONS[g];
    assert(icon, g + ' has no icon');
    eq(icon[0].length, 8, g + ' rows');
    for (const row of icon[0]) {
      eq(row.length, 8, g + ' row length');
      for (const ch of row) assert(ch === '.' || icon[1][ch], g + ': no colour for ' + ch);
    }
  }
});
test('themes unlock with stars, in order', () => {
  eq(TG.themes.unlocked(0), ['farm']);
  eq(TG.themes.unlocked(12), ['farm', 'construction']);
  eq(TG.themes.unlocked(1000), TG.themes.THEME_ORDER);
  TG.progress.use({ totalStars: 31 });
  eq(TG.progress.newlyUnlocked(), ['construction', 'racing']);
  eq(TG.progress.newlyUnlocked(), [], 'announced only once');
  TG.progress.use(null);
});
test('the generator makes valid puzzles in every theme', () => {
  for (const t of TG.themes.THEME_ORDER) {
    for (let level = 1; level <= 8; level++) {
      const def = TG.generator.generate(level, level * 977, t);
      assert(def.generated, t + ' level ' + level + ' fell back');
      eq(def.theme, t);
      for (const st of def.stations.slice(1)) assert(TG.themes.THEMES[t].stations.includes(st.kind), st.kind + ' not in ' + t);
    }
  }
});

console.log('sound and style');
test('colour style setting: default warm, unknown values ignored', () => {
  eq(TG.settings.normalize(null).style, 'warm');
  eq(TG.settings.normalize({ style: 'muted' }).style, 'muted');
  eq(TG.settings.normalize({ style: 'neon' }).style, 'warm');
});
test('sound module loads without a browser and ignores calls when audio is unavailable', () => {
  assert(TG.sound && TG.sound.EFFECTS.whistle && TG.sound.EFFECTS.chuff && TG.sound.EFFECTS.star);
  TG.sound.play('whistle');
  TG.sound.play('no-such-sound');
});

console.log('switches and order');
test('switches decide where the train goes; a wrong switch blocks the way', () => {
  const { s } = solved('farm-4');
  const js = TG.route.junctions(s);
  eq(js.length, 1);
  const ends = new Set();
  let blocked = 0;
  for (let k = 0; k < 3; k++) {
    const sw = new Map([[js[0].idx, k]]);
    const res = TG.route.followTrack(s, 'depot', sw);
    if (res.end) {
      ends.add(res.end);
      const last = res.route.segments[res.route.segments.length - 1];
      eq(last.to, null, 'ends at the station centre');
    } else {
      blocked++;
      assert(res.blocked, 'blocked position reported');
    }
  }
  eq(Array.from(ends).sort(), ['bakery', 'farm'], 'both stations reachable with the right setting');
  eq(blocked, 1, 'one setting points away from the start');
});
test('without junctions there is only one way to go', () => {
  const { s } = solved('farm-3');
  const res = TG.route.followTrack(s, 'depot', new Map());
  eq(res.end, 'bakery');
  assert(Math.abs(res.route.length - TG.route.findRoute(s, NW.analyze(s).graph, 'depot', 'bakery').length) < 1e-9, 'same length as the shortest route');
});
test('followed routes are continuous on every level with every switch setting', () => {
  for (const def of TG.LEVELS) {
    const { s } = solved(def.id);
    const js = TG.route.junctions(s);
    const combos = Math.pow(3, js.length);
    for (let c = 0; c < combos; c++) {
      const sw = new Map(js.map((j, i) => [j.idx, Math.floor(c / Math.pow(3, i)) % 3]));
      for (const st of s.stations) {
        const res = TG.route.followTrack(s, st.id, sw);
        let prev = TG.route.pointAt(res.route, 0);
        for (let d = 0.05; d <= res.route.length; d += 0.05) {
          const p = TG.route.pointAt(res.route, d);
          assert(Math.hypot(p.x - prev.x, p.y - prev.y) < 0.08, def.id + ' jump');
          prev = p;
        }
        if (res.end) assert(res.end !== st.id, 'never back to the same station');
      }
    }
  }
});
test('ordered rounds: a station that is not next refuses and costs a star', () => {
  const orders = [
    { id: 'o0', stationId: 'mill', good: 'grain', amount: 2, delivered: 0 },
    { id: 'o1', stationId: 'farm', good: 'hay', amount: 1, delivered: 0 },
  ];
  const r = RD().createRound(orders, { ordered: true, preload: ['grain', 'grain', 'hay'] });
  eq(RD().checkTurn(r, 'farm').stationId, 'mill', 'farm is too early');
  eq(r.orderMistakes, 1);
  eq(RD().checkTurn(r, 'mill'), null);
  RD().deliverAt(r, 'mill');
  eq(RD().checkTurn(r, 'farm'), null, 'now it is the farm');
  RD().deliverAt(r, 'farm');
  RD().recordDeparture(r, true);
  eq(RD().stars(r), 2);
});
test('ordered plans: shuffled orders with a note, only for goods rounds with two or more orders', () => {
  const st = { maxNumber: 20, adaptive: false, ordered: true, skills: { count: true, add: true, subtract: true, multiply: true, divide: true } };
  const s = L.createLevel(TG.LEVELS[5]);
  let seen = 0;
  for (let seed = 1; seed < 60; seed++) {
    const p = M().planRound(s, st, seed);
    if (p.orders.length >= 2 && p.mode === 'goods') {
      assert(p.ordered, p.kind + ' should be ordered');
      assert(p.notes.some(n => n.key === 'orderedNote'));
      seen++;
    } else {
      assert(!p.ordered, p.kind + ' should not be ordered');
    }
  }
  assert(seen > 10);
});
test('settings: switches and ordered are off by default', () => {
  const d = TG.settings.normalize(null);
  eq(d.switches, false);
  eq(d.ordered, false);
  eq(TG.settings.normalize({ switches: true }).switches, true);
});

console.log('map features');
test('bridges cross roads and race tracks too; crops, meadows and hay block track', () => {
  const s = L.createLevel(tinyLevel({ map: ['.....', '.=#~.', '.CAH.'], pieces: { straight: 3, bridge: 3 } }));
  for (const x of [1, 2, 3]) {
    assert(L.canBuild(s, x, 1, 'bridge'), 'bridge at ' + x);
    assert(!L.canBuild(s, x, 1, 'straight'), 'no straight at ' + x);
    assert(!L.canBuild(s, x, 2, 'straight') && !L.canBuild(s, x, 2, 'bridge'), 'field at ' + x);
  }
});
test('racing and town puzzles get a race track or road to bridge; farm puzzles get fields', () => {
  for (const [theme, ch] of [['racing', '#'], ['town', '=']]) {
    let bridged = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const def = TG.generator.generate(4, seed * 37, theme);
      assert(def.generated && TG.generator.verify(def), theme + ' solvable');
      assert(def.map.some(r => r.includes(ch)), theme + ' has its ' + ch);
      assert(!def.map.some(r => r.includes('~')), theme + ' has no river');
      if (def.pieces.bridge) bridged++;
    }
    assert(bridged >= 18, theme + ': most puzzles need a bridge (' + bridged + ')');
  }
  let fields = 0;
  for (let seed = 1; seed <= 20; seed++) {
    const def = TG.generator.generate(3, seed * 41, 'farm');
    if (def.map.some(r => /[CA]/.test(r))) fields++;
  }
  assert(fields >= 15, 'farm puzzles have crops or meadows (' + fields + ')');
});
test('hand-made farm maps have fields, meadows and hay bales', () => {
  for (const def of TG.LEVELS) {
    assert(def.map.some(r => /[CA]/.test(r)) && def.map.some(r => r.includes('H')), def.id);
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
