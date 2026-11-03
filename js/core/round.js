/*
 * A delivery round: orders, the goods in the train, deliveries and scoring.
 *
 * Orders: [{ id, stationId, good, amount, delivered }]
 * The train load is an ordered list with one entry per item (e.g.
 * ['apple', 'apple', 'flour']); items of the same good stay together so
 * the wagons show neat groups. Each wagon holds WAGON_CAPACITY items, laid
 * out as two rows of five (a "ten frame").
 */
(function (TG) {
  'use strict';

  const WAGON_CAPACITY = 10;

  /**
   * opts: { wagons, perWagon, wagonType, mode, preload } (a number means just the wagon count).
   * mode 'passengers': the player picks the number of carriages; passengers board when leaving the start.
   */
  function createRound(orders, opts) {
    if (typeof opts === 'number') opts = { wagons: opts };
    opts = opts || {};
    const wagons = opts.wagons || 3;
    const perWagon = opts.perWagon || WAGON_CAPACITY;
    return {
      orders,
      mode: opts.mode || 'goods',
      wagonType: opts.wagonType || 'freight',
      wagons,
      perWagon,
      capacity: wagons * perWagon,
      load: (opts.preload || []).slice(),
      departuresFromStart: 0,
      emptySeats: null,
    };
  }

  /** Change the number of carriages (passenger rounds); not below what is already on board. */
  function setWagons(round, n, max) {
    const wagons = Math.max(1, Math.min(max || 5, n));
    if (wagons * round.perWagon < round.load.length) return false;
    round.wagons = wagons;
    round.capacity = wagons * round.perWagon;
    return true;
  }

  /** Passengers still waiting at the start station. */
  function waitingPassengers(round) {
    let waiting = 0;
    for (const o of round.orders) if (o.good === 'passenger') waiting += remaining(o);
    return Math.max(0, waiting - count(round, 'passenger'));
  }

  /** Let waiting passengers get on (as many as fit). Returns how many boarded. */
  function board(round) {
    const n = Math.min(waitingPassengers(round), round.capacity - round.load.length);
    for (let i = 0; i < n; i++) round.load.push('passenger');
    if (round.emptySeats === null) round.emptySeats = round.capacity - round.load.length;
    return n;
  }

  function remaining(order) {
    return Math.max(0, order.amount - order.delivered);
  }

  /** The different goods asked for in this round, in order of the orders. */
  function goodsNeeded(round) {
    return Array.from(new Set(round.orders.map(o => o.good)));
  }

  function count(round, good) {
    let n = 0;
    for (const g of round.load) if (g === good) n++;
    return n;
  }

  function isFull(round) {
    return round.load.length >= round.capacity;
  }

  /** Add one item; returns its index in the load, or -1 if the train is full. */
  function loadOne(round, good) {
    if (isFull(round)) return -1;
    const last = round.load.lastIndexOf(good);
    const at = last >= 0 ? last + 1 : round.load.length;
    round.load.splice(at, 0, good);
    return at;
  }

  /** Remove one item; returns the index it had, or -1 if there was none. */
  function unloadOne(round, good) {
    const at = round.load.lastIndexOf(good);
    if (at >= 0) round.load.splice(at, 1);
    return at;
  }

  /**
   * Hand over what this station ordered. Returns
   *   { deliveries: [{ good, given, missing, left }], removed: [indices in the load before delivery] }
   * given = items handed over, missing = still needed afterwards, left = items of that good still in the train.
   */
  function deliverAt(round, stationId) {
    const deliveries = [];
    const removed = [];
    const before = round.load.slice();
    for (const o of round.orders) {
      if (o.stationId !== stationId || remaining(o) === 0) continue;
      const give = Math.min(count(round, o.good), remaining(o));
      // Take the last items of this good, remembering where they were
      let taken = 0;
      for (let i = before.length - 1; i >= 0 && taken < give; i--) {
        if (before[i] === o.good && !removed.includes(i)) {
          removed.push(i);
          taken++;
        }
      }
      for (let k = 0; k < give; k++) unloadOne(round, o.good);
      o.delivered += give;
      deliveries.push({ good: o.good, given: give, missing: remaining(o), left: count(round, o.good) });
    }
    return { deliveries, removed };
  }

  function recordDeparture(round, fromStart) {
    if (fromStart) round.departuresFromStart++;
  }

  function isComplete(round) {
    return round.orders.every(o => remaining(o) === 0);
  }

  /**
   * 3 stars: one trip from the start, nothing left over and (passenger rounds) no empty seats on the
   * first trip; one star less for each extra trip, for leftovers and for empty seats.
   */
  function stars(round) {
    const mistakes = Math.max(0, round.departuresFromStart - 1)
      + (round.load.length > 0 ? 1 : 0)
      + (round.emptySeats > 0 ? 1 : 0);
    return Math.max(1, 3 - mistakes);
  }

  /** Leftover goods as [{ good, n }]. */
  function leftovers(round) {
    const out = [];
    for (const g of new Set(round.load)) out.push({ good: g, n: count(round, g) });
    return out;
  }

  TG.round = {
    WAGON_CAPACITY,
    createRound, setWagons, waitingPassengers, board, remaining, goodsNeeded, count, isFull,
    loadOne, unloadOne, deliverAt, recordDeparture, isComplete, stars, leftovers,
  };
})(globalThis.TG = globalThis.TG || {});
