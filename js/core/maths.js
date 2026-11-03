/*
 * The maths engine: plans a delivery round around one skill at a time.
 *
 *   count     every station wants a number of goods (up to 10)
 *   add       two or three stations want parcels: load the total in one go
 *   missing   the train already holds some goods; load the rest (3 + ? = 8)
 *   takeaway  the train holds too many; take the extra out (9 - ? = 5)
 *   multiply  passengers: carriages hold c people each; how many carriages for c x w?
 *   divide    share parcels evenly over 2-4 stations (unloaded by hand; amounts hidden)
 *
 * With adaptive settings the numbers follow the player's level per skill
 * (TG.progress.limit), always capped by the parent's maximum.
 *
 * A plan: { kind, skill, orders, preload: [good...], mode: 'goods' | 'passengers',
 *           wagons, perWagon, wagonType, notes: [{ key, vars }] }
 * Notes are extra lines under the orders, e.g. "Er zitten al 3 kippen in de trein."
 * plan.manual: the player unloads by hand; plan.hideAmounts: order lines show no number (division).
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
    divide: ['divide'],
  };

  /** Multiplication per level: allowed carriage sizes and the most carriages. */
  const MULTIPLY_LEVELS = [
    { sizes: [2], w: 3 }, { sizes: [2], w: 5 }, { sizes: [2, 5], w: 3 }, { sizes: [2, 5], w: 5 },
    { sizes: [2, 5, 10], w: 3 }, { sizes: [2, 5, 10], w: 5 }, { sizes: [2, 5, 10], w: 5 }, { sizes: [2, 5, 10], w: 5 },
  ];
  /** Division per level: most stations to share over and the largest share. */
  const DIVIDE_LEVELS = [
    { k: 2, s: 3 }, { k: 2, s: 5 }, { k: 3, s: 3 }, { k: 3, s: 5 }, { k: 4, s: 5 }, { k: 4, s: 6 }, { k: 4, s: 7 }, { k: 4, s: 8 },
  ];

  function levelOf(skill, settings) {
    return settings.adaptive && TG.progress ? TG.progress.level(skill) : TG.progress ? TG.progress.MAX_LEVEL : 8;
  }

  function limitOf(skill, settings) {
    return TG.progress ? TG.progress.limit(skill, settings) : settings.maxNumber;
  }

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
        if ((k === 'add' || k === 'divide') && targets < 2) continue;
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
    const targets = state.stations.filter(s => !s.isStart);
    let kinds = feasibleKinds(state, settings);
    if (kinds.length > 1) kinds = kinds.filter(k => k !== previousKind);
    const kind = pick(rand, kinds);

    const skill = skillOf(kind);
    const N = limitOf(skill, settings);
    const cap = Math.min(N, FREIGHT_CAPACITY);
    const lvl = levelOf(skill, settings);
    const plan = {
      kind,
      skill,
      level: lvl,
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
        const n = targets.length >= 3 && cap >= 12 && lvl >= 5 && rand() < 0.4 ? 3 : 2;
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
        const rule = MULTIPLY_LEVELS[lvl - 1];
        const pairs = [];
        for (const c of rule.sizes) for (let w = 2; w <= rule.w; w++) if (c * w <= N) pairs.push([c, w]);
        const [c, w] = pairs.length ? pick(rand, pairs) : [2, 2];
        addOrder(pick(rand, targets), 'passenger', c * w);
        Object.assign(plan, { mode: 'passengers', wagons: 1, perWagon: c, wagonType: 'coach' + c });
        plan.notes.push({ key: 'perWagon', vars: { c } }, { key: 'howManyWagons', vars: {} });
        break;
      }
      case 'divide': {
        const rule = DIVIDE_LEVELS[lvl - 1];
        const k = randInt(rand, 2, Math.max(2, Math.min(rule.k, targets.length)));
        const maxShare = Math.max(1, Math.min(rule.s, Math.floor(cap / k)));
        const share = randInt(rand, Math.min(2, maxShare), maxShare); // sharing 1 each is too easy
        shuffle(rand, targets).slice(0, k).forEach(st => addOrder(st, 'parcel', share));
        plan.hideAmounts = true;
        plan.notes.push({ key: 'divideNote', vars: { total: share * k, k, good: 'parcel' } });
        break;
      }
    }
    plan.manual = kind === 'divide' || (!!settings.manualUnload && plan.mode === 'goods');
    return plan;
  }

  TG.maths = {
    KINDS_BY_SKILL, MAX_COACHES, COACH_SIZES, FREIGHT_CAPACITY, MULTIPLY_LEVELS, DIVIDE_LEVELS,
    feasibleKinds, planRound, skillOf,
  };
})(globalThis.TG = globalThis.TG || {});
