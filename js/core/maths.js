/*
 * The maths engine: plans a delivery round around one skill at a time.
 *
 *   count     every station wants a number of goods
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
 *           wagons, perWagon, wagonType, notes: [{ key, vars }], problems: [problem] }
 * Freight trains get one wagon per kind of good.
 * Numbers have a lower bound too (at least 2 per part, about half the level's range), so
 * rounds are never "bring 1 of this".
 *
 * Problems are the sums shown above the train with four answer buttons, e.g.
 *   { good, tokens: [3, '+', '?', '=', 8], answer: 5, action: 'load', choices: [4, 5, 6, 8] }
 * A token is a number, an operator, '?' (the blank) or { icons: n } (goods to count).
 * action: 'load' (put that many in), 'unload' (take that many out), 'wagons' (set the carriages),
 * 'takeback' (put that many back from the platform into the train).
 * question: the i18n key of the question above the sum; n: the number that question mentions.
 * A wrong answer leads to a follow-up sum (trainCorrection / stationCorrection) until it is right.
 * Notes are extra lines under the orders, e.g. "Er zitten al 3 kippen in de trein."
 * plan.manual: the player unloads by hand; plan.hideAmounts: order lines show no number (division).
 */
(function (TG) {
  'use strict';

  const FREIGHT_CAPACITY = 30; // most of one good in a round
  const FREIGHT_PER_WAGON = 50; // freight wagons show a number instead of a pile, so they hold plenty
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
    { sizes: [2, 5], w: 3 }, { sizes: [2, 5], w: 5 }, { sizes: [2, 5, 10], w: 3 }, { sizes: [2, 5, 10], w: 5 },
    { sizes: [2, 5, 10], w: 5 }, { sizes: [2, 5, 10], w: 5 }, { sizes: [2, 5, 10], w: 5 }, { sizes: [2, 5, 10], w: 5 },
  ];
  /** Division per level: most stations to share over and the largest share. */
  const DIVIDE_LEVELS = [
    { k: 2, s: 6 }, { k: 3, s: 5 }, { k: 3, s: 6 }, { k: 4, s: 5 }, { k: 4, s: 6 }, { k: 4, s: 7 }, { k: 4, s: 8 }, { k: 4, s: 8 },
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
      wagons: 1,
      perWagon: FREIGHT_PER_WAGON,
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
          const hi = Math.min(N, 20);
          addOrder(st, good, randInt(rand, Math.max(3, Math.round(hi * 0.35)), hi));
        }
        break;
      }
      case 'add': {
        const n = targets.length >= 3 && cap >= 12 && lvl >= 5 && rand() < 0.4 ? 3 : 2;
        const stations = shuffle(rand, targets).slice(0, n);
        const total = randInt(rand, Math.min(cap, Math.max(n * 2 + 1, Math.round(cap * 0.5))), cap);
        const parts = [];
        let left = total;
        for (let i = 0; i < n - 1; i++) {
          const part = randInt(rand, 2, left - 2 * (n - 1 - i)); // every part at least 2
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
        const amount = randInt(rand, Math.min(cap, Math.max(5, Math.round(cap * 0.5))), cap);
        const p = randInt(rand, 2, amount - 2); // already in the train, and at least 2 to add
        addOrder(st, good, amount);
        for (let i = 0; i < p; i++) plan.preload.push(good);
        plan.notes.push(already(good, p));
        break;
      }
      case 'takeaway': {
        const st = pick(rand, targets);
        const good = pick(rand, wants(st));
        const p = randInt(rand, Math.min(cap, Math.max(6, Math.round(cap * 0.5))), cap);
        const amount = randInt(rand, 2, p - 2); // at least 2 wanted and at least 2 to take out
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
    if (plan.mode === 'goods') plan.wagons = Math.max(1, new Set(plan.orders.map(o => o.good)).size);
    plan.manual = kind === 'divide' || (!!settings.manualUnload && plan.mode === 'goods');
    // Orders in a fixed order (setting): shuffle them so the order differs from the station list
    plan.ordered = !!settings.ordered && plan.mode === 'goods' && plan.orders.length >= 2;
    if (plan.ordered) {
      plan.orders = shuffle(rand, plan.orders);
      plan.orders.forEach((o, i) => { o.id = 'o' + i; });
      plan.notes.push({ key: 'orderedNote', vars: {} });
    }
    plan.problems = loadingProblems(plan, Math.floor(rand() * 1e9));
    return plan;
  }

  /** Four different answers, all at least `min`, the right one among them. */
  function choicesFor(answer, seed, min) {
    const rand = TG.util.rng(seed);
    const lo = min || 0;
    const set = new Set([answer]);
    for (let spread = 2; set.size < 4; spread++) {
      const v = answer + randInt(rand, -spread, spread);
      if (v >= lo) set.add(v);
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  /** The sums to solve at the warehouse, one per kind of good (see the header). */
  function loadingProblems(plan, seed) {
    const out = [];
    if (plan.mode === 'passengers') {
      const o = plan.orders[0];
      const w = o.amount / plan.perWagon;
      out.push({ good: 'passenger', tokens: ['?', '×', plan.perWagon, '=', o.amount], answer: w, action: 'wagons', question: 'howManyWagons' });
    } else {
      for (const good of Array.from(new Set(plan.orders.map(o => o.good)))) {
        const amounts = plan.orders.filter(o => o.good === good).map(o => o.amount);
        const need = amounts.reduce((a, b) => a + b, 0);
        const p = plan.preload.filter(g => g === good).length;
        if (plan.kind === 'missing') out.push({ good, tokens: [p, '+', '?', '=', need], answer: need - p, action: 'load', question: 'qMore', n: p });
        else if (plan.kind === 'takeaway') out.push({ good, tokens: [p, '−', '?', '=', need], answer: p - need, action: 'unload', question: 'qLess', n: p });
        else if (amounts.length > 1 && !plan.hideAmounts) out.push({ good, tokens: [...amounts.flatMap((a, i) => (i ? ['+', a] : [a])), '=', '?'], answer: need, action: 'load', question: 'qLoad' });
        else out.push({ good, tokens: [{ icons: need }, '=', '?'], answer: need, action: 'load', question: 'qLoad' });
      }
    }
    out.forEach((pr, i) => { pr.choices = choicesFor(pr.answer, seed + i * 7919, 1); }); // 0 is never a real answer
    return out;
  }

  /**
   * The sum to solve when unloading by hand at a station: sharing ("12 : 3 = ?") in division
   * rounds, otherwise counting the goods this station still needs.
   */
  function unloadProblem(plan, order, seed) {
    const need = order.amount - order.delivered;
    const pr = plan.kind === 'divide'
      ? { good: order.good, tokens: [order.amount * plan.orders.length, ':', plan.orders.length, '=', '?'], answer: order.amount, action: 'unload' }
      : { good: order.good, tokens: [{ icons: need }, '=', '?'], answer: need, action: 'unload' };
    pr.question = 'askUnload';
    pr.choices = choicesFor(pr.answer, seed, 1);
    return pr;
  }

  /**
   * Follow-up sum at the warehouse when the wagon holds the wrong amount:
   * "5 + ? = 7" (put more in) or "9 - ? = 7" (take some out). Null when it is right.
   */
  function trainCorrection(good, have, need, seed) {
    if (have === need) return null;
    const pr = have < need
      ? { good, tokens: [have, '+', '?', '=', need], answer: need - have, action: 'load', question: 'qMore', n: have }
      : { good, tokens: [have, '−', '?', '=', need], answer: have - need, action: 'unload', question: 'qLess', n: have };
    pr.choices = choicesFor(pr.answer, seed, 1);
    return pr;
  }

  /**
   * Follow-up sum at a station when the platform has the wrong amount:
   * "6 + ? = 10" (unload more) or "12 - ? = 10" (put some back in the train). Null when it is right.
   */
  function stationCorrection(good, delivered, amount, seed) {
    if (delivered === amount) return null;
    const pr = delivered < amount
      ? { good, tokens: [delivered, '+', '?', '=', amount], answer: amount - delivered, action: 'unload', question: 'qStationMore', n: delivered }
      : { good, tokens: [delivered, '−', '?', '=', amount], answer: delivered - amount, action: 'takeback', question: 'qStationLess', n: delivered };
    pr.choices = choicesFor(pr.answer, seed, 1);
    return pr;
  }

  TG.maths = {
    KINDS_BY_SKILL, MAX_COACHES, COACH_SIZES, FREIGHT_CAPACITY, FREIGHT_PER_WAGON, MULTIPLY_LEVELS, DIVIDE_LEVELS,
    feasibleKinds, planRound, skillOf, choicesFor, loadingProblems, unloadProblem, trainCorrection, stationCorrection,
  };
})(globalThis.TG = globalThis.TG || {});
