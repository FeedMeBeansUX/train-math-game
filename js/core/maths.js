/*
 * The maths engine: plans a delivery round around one skill at a time.
 *
 *   count     every station wants a number of goods (up to 10)
 *   add       two or three stations want parcels: load the total in one go
 *   missing   the train already holds some goods; load the rest (3 + ? = 8)
 *   takeaway  the train holds too many; take the extra out (9 - ? = 5)
 *   multiply  passengers: carriages hold c people each; how many carriages for c x w?
 *
 * A plan: { kind, skill, orders, preload: [good...], mode: 'goods' | 'passengers',
 *           wagons, perWagon, wagonType, notes: [{ key, vars }] }
 * Notes are extra lines under the orders, e.g. "Er zitten al 3 kippen in de trein."
 */
(function (TG) {
  'use strict';

  const FREIGHT_WAGONS = 3;
  const FREIGHT_CAPACITY = FREIGHT_WAGONS * 10;
  const MAX_COACHES = 5;
  const COACH_SIZES = [2, 5, 10];

  const KINDS_BY_SKILL = {
    count: ['count'],
    add: ['add', 'missing'],
    subtract: ['takeaway'],
    multiply: ['multiply'],
  };

  function randInt(rand, lo, hi) {
    return lo + Math.floor(rand() * (hi - lo + 1));
  }

  function pick(rand, list) {
    return list[Math.floor(rand() * list.length)];
  }

  function shuffle(rand, list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Round kinds that the settings allow and this level can support. */
  function feasibleKinds(state, settings) {
    const targets = state.stations.filter(s => !s.isStart).length;
    const kinds = [];
    for (const skill of TG.settings.SKILLS) {
      if (!settings.skills[skill]) continue;
      for (const k of KINDS_BY_SKILL[skill]) {
        if (k === 'add' && targets < 2) continue;
        kinds.push(k);
      }
    }
    return kinds.length ? kinds : ['count'];
  }

  function skillOf(kind) {
    for (const s in KINDS_BY_SKILL) if (KINDS_BY_SKILL[s].includes(kind)) return s;
    return 'count';
  }

  function planRound(state, settings, seed, previousKind) {
    const rand = TG.util.rng(seed);
    const N = settings.maxNumber;
    const cap = Math.min(N, FREIGHT_CAPACITY);
    const targets = state.stations.filter(s => !s.isStart);
    let kinds = feasibleKinds(state, settings);
    if (kinds.length > 1) kinds = kinds.filter(k => k !== previousKind);
    const kind = pick(rand, kinds);

    const plan = {
      kind,
      skill: skillOf(kind),
      orders: [],
      preload: [],
      mode: 'goods',
      wagons: FREIGHT_WAGONS,
      perWagon: 10,
      wagonType: 'freight',
      notes: [],
    };
    const addOrder = (st, good, amount) => plan.orders.push({ id: 'o' + plan.orders.length, stationId: st.id, good, amount, delivered: 0 });
    const wants = st => TG.themes.stationKind(st.kind).wants;
    const already = (good, p) => ({ key: p === 1 ? 'alreadyOne' : 'alreadyMany', vars: { p, good } });

    switch (kind) {
      case 'count': {
        // Different goods per station where possible, to keep the sentences distinct
        const used = new Set();
        for (const st of targets) {
          const fresh = wants(st).filter(g => !used.has(g));
          const good = pick(rand, fresh.length ? fresh : wants(st));
          used.add(good);
          addOrder(st, good, randInt(rand, 1, Math.min(10, N)));
        }
        break;
      }
      case 'add': {
        const n = targets.length >= 3 && cap >= 12 && rand() < 0.4 ? 3 : 2;
        const stations = shuffle(rand, targets).slice(0, n);
        const total = randInt(rand, Math.max(n + 1, 4), cap);
        const parts = [];
        let left = total;
        for (let i = 0; i < n - 1; i++) {
          const part = randInt(rand, 1, left - (n - 1 - i));
          parts.push(part);
          left -= part;
        }
        parts.push(left);
        stations.forEach((st, i) => addOrder(st, 'parcel', parts[i]));
        plan.notes.push({ key: 'howManyOnTrain', vars: { good: 'parcel' } });
        break;
      }
      case 'missing': {
        const st = pick(rand, targets);
        const good = pick(rand, wants(st));
        const amount = randInt(rand, Math.min(4, cap), cap);
        const p = randInt(rand, 1, amount - 1);
        addOrder(st, good, amount);
        for (let i = 0; i < p; i++) plan.preload.push(good);
        plan.notes.push(already(good, p));
        break;
      }
      case 'takeaway': {
        const st = pick(rand, targets);
        const good = pick(rand, wants(st));
        const p = randInt(rand, Math.min(3, cap), cap);
        const amount = randInt(rand, 1, p - 1);
        addOrder(st, good, amount);
        for (let i = 0; i < p; i++) plan.preload.push(good);
        plan.notes.push(already(good, p));
        break;
      }
      case 'multiply': {
        const pairs = [];
        for (const c of COACH_SIZES) for (let w = 2; w <= MAX_COACHES; w++) if (c * w <= N) pairs.push([c, w]);
        const [c, w] = pick(rand, pairs);
        addOrder(pick(rand, targets), 'passenger', c * w);
        Object.assign(plan, { mode: 'passengers', wagons: 1, perWagon: c, wagonType: 'coach' + c });
        plan.notes.push({ key: 'perWagon', vars: { c } }, { key: 'howManyWagons', vars: {} });
        break;
      }
    }
    return plan;
  }

  TG.maths = { KINDS_BY_SKILL, MAX_COACHES, COACH_SIZES, FREIGHT_CAPACITY, feasibleKinds, planRound, skillOf };
})(globalThis.TG = globalThis.TG || {});
