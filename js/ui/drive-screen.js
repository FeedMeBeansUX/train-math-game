/*
 * The driving screen: side view of the train, the orders, loading goods,
 * a mini-map and the list of stations to travel to.
 *
 * Game loop of a delivery round (logic in TG.round):
 *   1. At the start station: load goods by clicking the crates on the
 *      platform (or the + buttons). Clicking goods in the train puts them back.
 *   2. Pick a station: the train finds its own way there (TG.route).
 *   3. On arrival the station takes what it ordered; the player is told what
 *      was delivered, what is still missing and what is left in the train.
 *   4. When every order is done: a summary with 1-3 stars.
 * What is ordered comes from the maths engine (TG.maths), one skill per round.
 * In passenger rounds the player picks the number of carriages instead of
 * loading goods; passengers board when the train leaves the start.
 */
(function (TG) {
  'use strict';

  const L = TG.level;
  const R = TG.route;
  const RD = TG.round;
  const SS = TG.sideSprites;
  const S = TG.sprites;
  const i18n = TG.i18n;
  const nameEl = TG.ui.nameEl;
  const STOP_X = TG.SideRenderer.STOP_X;

  const PX_PER_TILE = 150; // side-view distance per tile of track
  const VMAX = 280;        // top speed, art px per second
  const ACC = 130;         // acceleration / braking, art px per second²
  const WHISTLE = 0.8;     // seconds between pressing the button and moving off
  const MAX_PILES = 3;     // crates that fit on the platform next to the train
  const CHIMNEY_DX = -10;  // chimney position relative to the train's front
  const CHIMNEY_Y = SS.RAIL_Y - SS.LOCO_H + 1;
  const FLY_TIME = 0.45;
  const SWITCH_COLORS = ['#e0473a', '#2a6fb0', '#a05ac8', '#e0a030', '#3f8a4a'];

  /** Smooth start and stop over distance D: accelerate, cruise, brake. */
  function motion(D) {
    const vTop = Math.min(VMAX, Math.sqrt(ACC * D));
    const tAcc = vTop / ACC;
    const dAcc = (vTop * vTop) / (2 * ACC);
    const tCruise = Math.max(0, (D - 2 * dAcc) / vTop);
    const T = 2 * tAcc + tCruise;
    return {
      T,
      pos(t) {
        if (t <= tAcc) return 0.5 * ACC * t * t;
        if (t <= tAcc + tCruise) return dAcc + vTop * (t - tAcc);
        const r = Math.max(0, T - t);
        return D - 0.5 * ACC * r * r;
      },
      speed(t) {
        if (t <= tAcc) return ACC * t;
        if (t <= tAcc + tCruise) return vTop;
        return ACC * Math.max(0, T - t);
      },
    };
  }

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text != null) e.textContent = text;
    return e;
  }

  /** Icon of a good as a small canvas, scaled up crisply by CSS. */
  function goodIconEl(good) {
    const c = el('canvas', 'good-icon');
    c.width = 8;
    c.height = 8;
    c.getContext('2d').drawImage(SS.goodIcon(good), 0, 0);
    return c;
  }

  /** A sentence in both languages: { main, second } -> element. */
  function sentenceEl(both, className) {
    const p = el('p', 'sentence ' + (className || ''));
    p.append(el('span', 'main lang-' + i18n.getLang(), both.main));
    p.append(el('span', 'second lang-' + i18n.other(), both.second));
    return p;
  }

  /** Count shown as dots in ten frames: blocks of ten, rows of five (like the wagons). */
  function dotsEl(n) {
    const box = el('span', 'dots');
    for (let t = 0; t < n; t += 10) {
      const ten = el('span', 'ten');
      for (let i = t; i < Math.min(n, t + 10); i++) ten.append(el('span', 'dot'));
      box.append(ten);
    }
    return box;
  }

  class DriveScreen {
    constructor(dom, callbacks) {
      this.dom = dom;
      this.callbacks = callbacks || {};
      this.renderer = new TG.SideRenderer(dom.canvas);
      this.minimap = new TG.Minimap(dom.minimap);
      this.active = false;
      this.smoke = [];
      this.flyers = [];
      this.lastTime = 0;
      this.wheelDist = 0;
      window.addEventListener('resize', () => { if (this.active) this.layout(); });
      dom.canvas.addEventListener('mousedown', e => this.onCanvasClick(e));
      dom.canvas.addEventListener('mousemove', e => this.onCanvasMove(e));
      requestAnimationFrame(t => this.frame(t));
    }

    // ------------------------------------------------------------ opening and rounds

    open(state, analysis, def) {
      this.state = state;
      this.graph = analysis.graph;
      this.def = def;
      this.startId = state.stations[0].id;
      this.sceneryOffset = 0;
      this.minimap.setLevel(state);
      // Switch mode (parent setting): junctions are switches the player sets before leaving
      this.switchTiles = TG.settings.get().switches
        ? TG.route.junctions(state).map((j, i) => Object.assign(j, { color: SWITCH_COLORS[i % SWITCH_COLORS.length] }))
        : [];
      this.switchMode = this.switchTiles.length > 0;
      this.switchState = new Map(this.switchTiles.map(j => [j.idx, 0]));
      this.preview = null;
      this.active = true;
      this.newRound();
      this.layout();
    }

    close() {
      this.active = false;
      this.dom.roundDone.hidden = true;
    }

    newRound() {
      const plan = TG.maths.planRound(this.state, TG.settings.get(), Math.floor(Math.random() * 1e9), this.lastKind);
      this.plan = plan;
      this.lastKind = plan.kind;
      this.round = RD.createRound(plan.orders, plan);
      this.current = this.startId;
      this.trip = null;
      this.arrivedHere = false;
      this.busy = false;
      this.smoke = [];
      this.flyers = [];
      this.pendingLoad = {};
      this.pendingPile = {};
      this.unloading = null;
      this.answered = new Set(); // sums already answered this round
      this.puffTimer = 0;
      this.messages = [];
      this.dom.roundDone.hidden = true;
      this.idleScene();
      this.refresh();
    }

    // ------------------------------------------------------------ trips

    sceneBase() {
      const wagons = this.passengers() ? this.round.wagons : Math.max(1, this.wagonGoods().length);
      return { theme: this.def.theme, wagons, wagonType: this.round.wagonType, sceneryOffset: this.sceneryOffset };
    }

    idleScene() {
      const st = L.stationById(this.state, this.current);
      this.renderer.setScene(Object.assign(this.sceneBase(), { startKind: st.kind, endKind: null, worldEnd: SS.W, bridges: [] }));
      this.sceneStations = [this.current];
      this.camera = 0;
      this.front = STOP_X;
      this.speed = 0;
      this.buildSigns();
    }

    /** Switch mode: leave along the track as the switches are set. */
    departAlongTrack() {
      if (this.trip || this.busy) return;
      const res = R.followTrack(this.state, this.current, this.switchState);
      if (!res || !res.end) {
        this.messages = [Object.assign(i18n.both('switchWrong'), { kind: 'warn' })];
        TG.sound.play('bad');
        this.refresh();
        return;
      }
      this.depart(res.end, res.route);
    }

    toggleSwitch(sw) {
      if (this.trip || this.busy) return;
      this.switchState.set(sw.idx, (this.switchState.get(sw.idx) + 1) % 3);
      TG.sound.play('rotate');
      this.messages = [];
      this.refresh();
    }

    depart(toId, routeOverride) {
      if (this.trip || this.busy) return;
      const route = routeOverride || R.findRoute(this.state, this.graph, this.current, toId);
      if (!route) return;
      RD.recordDeparture(this.round, this.current === this.startId);
      const D = route.length * PX_PER_TILE;
      const worldEnd = STOP_X + D + (SS.W - STOP_X);
      const toX = d => STOP_X + (d / route.length) * D;
      const bridges = R.spans(route, 'bridge').map(sp => ({ x0: toX(sp.start), x1: toX(sp.end) }));
      const from = L.stationById(this.state, this.current);
      const to = L.stationById(this.state, toId);
      this.renderer.setScene(Object.assign(this.sceneBase(), { startKind: from.kind, endKind: to.kind, worldEnd, bridges }));
      this.sceneStations = [this.current, toId];
      this.flyers = [];
      this.pendingLoad = {};
      this.messages = [];
      this.unloading = null;
      const boarding = this.round.mode === 'passengers' && this.current === this.startId ? this.boardPassengers() : 0;
      this.trip = { route, to: toId, D, worldEnd, motion: motion(D), t: -(WHISTLE + boarding), lastPos: 0 };
      for (let i = 0; i < 6; i++) this.puff(this.front + CHIMNEY_DX, 0, 1.4);
      TG.sound.play('whistle');
      this.buildSigns();
      this.refresh();
    }

    /** Waiting passengers walk into the carriages. Returns the extra seconds this takes. */
    boardPassengers() {
      const before = this.round.load.length;
      const waitingBefore = RD.waitingPassengers(this.round);
      const n = RD.board(this.round);
      for (let i = 0; i < n; i++) {
        this.pendingLoad.passenger = (this.pendingLoad.passenger || 0) + 1;
        const from = this.renderer.pileItemPos(0, 0, Math.min(25, waitingBefore - 1 - i), false, 'passenger');
        this.fly('passenger', from, this.renderer.slotPos(this.front, before + i), -i * 0.08, () => {
          this.pendingLoad.passenger--;
          TG.sound.play('pop');
        });
      }
      const left = RD.waitingPassengers(this.round);
      if (n > 0) this.messages.push(Object.assign(i18n.both(n === 1 ? 'boardedOne' : 'boardedMany', { n }), { kind: 'ok' }));
      if (left > 0) this.messages.push(Object.assign(i18n.both(left === 1 ? 'waitingOne' : 'waitingMany', { k: left }), { kind: 'warn' }));
      return n > 0 ? n * 0.08 + FLY_TIME : 0;
    }

    arrive() {
      const shift = this.trip.worldEnd - SS.W;
      this.sceneryOffset += shift;
      for (const p of this.smoke) p.x -= shift;
      this.current = this.trip.to;
      this.trip = null;
      this.arrivedHere = true;
      TG.sound.play('hiss');
      this.idleScene();
      if (this.current === this.startId) {
        this.messages = [i18n.both('loadHint')];
        this.refresh();
      } else {
        this.unloadHere();
      }
    }

    /**
     * Hand over the goods this station ordered. Normally automatic; when unloading by hand
     * (division rounds or the parent setting) the player first chooses how many come off.
     */
    unloadHere() {
      // Ordered rounds: a station that is not next does not take anything yet
      const early = RD.checkTurn(this.round, this.current);
      if (early) {
        const k = L.stationById(this.state, early.stationId).kind;
        this.messages = [Object.assign(i18n.both('notYet', { s: l => i18n.stationPhrase(k, l) }), { kind: 'warn' })];
        TG.sound.play('mistake');
        this.refresh();
        return;
      }
      const order = RD.openOrderAt(this.round, this.current);
      if (this.plan.manual && order && RD.count(this.round, order.good) > 0) {
        this.unloading = { stationId: this.current, good: order.good, n: 0 };
        this.messages = [i18n.both('askUnload', { goods: l => i18n.goodsWord(order.good, 2, l) })];
        this.refresh();
        return;
      }
      const before = this.round.load.slice();
      const res = RD.deliverAt(this.round, this.current);
      this.animateDelivery(before, res.removed, res.deliveries);
    }

    setUnloadCount(n) {
      const u = this.unloading;
      if (!u) return;
      u.n = Math.max(0, Math.min(RD.count(this.round, u.good), n));
      this.refresh();
    }

    confirmUnload() {
      const u = this.unloading;
      if (!u || this.busy) return;
      const before = this.round.load.slice();
      const res = RD.unloadAt(this.round, u.stationId, u.n);
      if (!res.ok) {
        this.messages = [Object.assign(i18n.both(res.reason === 'tooMany' ? 'tooMany' : 'tooFew'), { kind: 'warn' })];
        TG.sound.play('mistake');
        if (this.plan.kind === 'divide') this.messages.push(i18n.both('fairHint'));
        this.refresh();
        return;
      }
      this.unloading = null;
      this.animateDelivery(before, res.removed, [res.delivery]);
    }

    /** Goods fly from the wagons onto the platform; then the result is shown. */
    animateDelivery(before, removedIdx, deliveries) {
      const goodsHere = this.deliveredGoods(this.current);
      const removed = removedIdx.slice().sort((a, b) => a - b);
      removed.forEach((idx, i) => {
        const good = before[idx];
        const key = this.current + ':' + good;
        this.pendingPile[key] = (this.pendingPile[key] || 0) + 1;
        const from = this.itemPos(good, idx);
        const p = Math.min(goodsHere.indexOf(good), MAX_PILES - 1);
        const k = this.deliveredCount(this.current, good) - this.pendingPile[key];
        const to = this.renderer.pileItemPos(0, p, Math.min(good === 'passenger' ? 25 : 9, k), false, good);
        this.fly(good, from, to, -i * 0.12, () => {
          this.pendingPile[key]--;
          TG.sound.play('pop');
        });
      });
      this.busy = removed.length > 0;
      this.afterFlights = () => {
        this.busy = false;
        this.messages = this.deliveryMessages(deliveries);
        if (deliveries.some(dl => dl.given > 0)) TG.sound.play('deliver');
        if (deliveries.some(dl => dl.missing > 0)) setTimeout(() => TG.sound.play('mistake'), 450);
        this.refresh();
        if (RD.isComplete(this.round)) setTimeout(() => this.showRoundDone(), 900);
      };
      if (!this.busy) this.afterFlights();
      this.refresh();
    }

    deliveryMessages(deliveries) {
      if (!deliveries.length) return [i18n.both('nothingHere')];
      const out = [];
      const word = (good, n) => l => i18n.goodsWord(good, n, l);
      for (const d of deliveries) {
        if (d.given > 0) out.push(Object.assign(i18n.both('delivered', { n: d.given, goods: word(d.good, d.given) }), { kind: 'ok' }));
        if (d.missing > 0) {
          out.push(Object.assign(i18n.both(d.missing === 1 ? 'missingOne' : 'missingMany', { m: d.missing, goods: word(d.good, d.missing) }), { kind: 'warn' }));
        }
        if (d.left > 0) out.push(i18n.both(d.left === 1 ? 'leftOne' : 'leftMany', { k: d.left, goods: word(d.good, d.left) }));
      }
      if (deliveries.some(d => d.missing > 0)) {
        const startKind = L.stationById(this.state, this.startId).kind;
        out.push(i18n.both('fetchMore', { s: l => i18n.stationPhrase(startKind, l) }));
      }
      return out;
    }

    // ------------------------------------------------------------ loading

    atStart() {
      return !this.trip && !this.busy && this.current === this.startId;
    }

    passengers() {
      return this.round.mode === 'passengers';
    }

    /** Passenger rounds: add or remove carriages at the start station. */
    setWagons(n) {
      if (!this.atStart() || !RD.setWagons(this.round, n, TG.maths.MAX_COACHES)) return;
      TG.sound.play('click');
      this.messages = [];
      this.idleScene();
      this.refresh();
    }

    supplyGoods() {
      return RD.goodsNeeded(this.round);
    }

    /** Freight trains have one wagon per kind of good, in the order of the orders list. */
    wagonGoods() {
      return Array.from(new Set([...this.supplyGoods(), ...this.round.load]));
    }

    /**
     * Wagon index (0 = right behind the locomotive) of a good. The first good gets the leftmost
     * wagon, so reading the train from left to right follows the orders list.
     */
    wagonIndex(good) {
      const list = this.wagonGoods();
      return list.length - 1 - Math.max(0, list.indexOf(good));
    }

    /** Where an item of a good is in the train: its wagon's plate (freight) or its seat (passengers). */
    itemPos(good, idx) {
      if (this.passengers()) return this.renderer.slotPos(this.front, idx);
      return this.renderer.wagonSlot(this.front, this.wagonIndex(good));
    }

    /** Load n items at once (answer buttons): they fly into the wagon one after another. */
    loadMany(good, n) {
      for (let i = 0; i < n; i++) if (!this.loadGood(good, i * 0.07, i > 0)) break;
    }

    unloadMany(good, n) {
      for (let i = 0; i < n; i++) if (!this.unloadGood(good, i * 0.07, i > 0)) break;
    }

    loadGood(good, delay, quiet) {
      if (this.passengers()) return false;
      if (!this.atStart()) {
        const startKind = L.stationById(this.state, this.startId).kind;
        this.messages = [i18n.both('loadOnlyAtStart', { s: l => i18n.stationPhrase(startKind, l) })];
        TG.sound.play('bad');
        this.refresh();
        return false;
      }
      const idx = RD.loadOne(this.round, good);
      if (idx < 0) {
        this.messages = [Object.assign(i18n.both('trainFull'), { kind: 'warn' })];
        TG.sound.play('bad');
        this.refresh();
        return false;
      }
      this.messages = [];
      this.pendingLoad[good] = (this.pendingLoad[good] || 0) + 1;
      const p = Math.min(this.supplyGoods().indexOf(good), MAX_PILES - 1);
      const from = this.renderer.pileItemPos(0, p, 1, true);
      if (!quiet) TG.sound.play('load');
      this.fly(good, from, this.itemPos(good, idx), -(delay || 0), () => {
        this.pendingLoad[good]--;
        if (quiet) TG.sound.play('pop');
      });
      this.refresh();
      return true;
    }

    unloadGood(good, delay, quiet) {
      if (!this.atStart() || this.passengers()) return false;
      const from = this.itemPos(good, this.round.load.lastIndexOf(good));
      const idx = RD.unloadOne(this.round, good);
      if (idx < 0) return false;
      this.messages = [];
      const p = Math.max(0, Math.min(this.supplyGoods().indexOf(good), MAX_PILES - 1));
      if (!quiet) TG.sound.play('unload');
      this.fly(good, from, this.renderer.pileItemPos(0, p, 1, true), -(delay || 0), quiet ? () => TG.sound.play('pop') : null);
      this.refresh();
      return true;
    }

    fly(good, from, to, delay, onLand) {
      this.flyers.push({ good, x0: from.x, y0: from.y, x1: to.x, y1: to.y, t: delay || 0, onLand });
    }

    // ------------------------------------------------------------ what to draw

    deliveredGoods(stationId) {
      return Array.from(new Set(this.round.orders.filter(o => o.stationId === stationId && o.delivered > 0).map(o => o.good)));
    }

    deliveredCount(stationId, good) {
      return this.round.orders.filter(o => o.stationId === stationId && o.good === good).reduce((n, o) => n + o.delivered, 0);
    }

    pilesFor(stationId) {
      if (stationId === this.startId) {
        if (this.passengers()) return [{ good: 'passenger', count: RD.waitingPassengers(this.round) }];
        return this.supplyGoods().slice(0, MAX_PILES).map(good => ({ good, supply: true }));
      }
      return this.deliveredGoods(stationId).slice(0, MAX_PILES).map(good => ({
        good,
        count: this.deliveredCount(stationId, good) - (this.pendingPile[stationId + ':' + good] || 0),
      }));
    }

    /** The load as drawn: items still flying towards the train are not shown yet. */
    cargoView() {
      if (!this.passengers()) {
        // Freight: one entry per wagon with how many are on board (not counting goods still flying in)
        const out = [];
        for (const good of this.wagonGoods()) {
          out[this.wagonIndex(good)] = { good, n: Math.max(0, RD.count(this.round, good) - (this.pendingLoad[good] || 0)) };
        }
        return out;
      }
      const seen = {};
      return this.round.load.map(good => {
        seen[good] = (seen[good] || 0) + 1;
        const visible = RD.count(this.round, good) - (this.pendingLoad[good] || 0);
        return seen[good] <= visible ? good : null;
      });
    }

    // ------------------------------------------------------------ animation

    puff(x, speed, strength) {
      this.smoke.push({
        x: x + (Math.random() - 0.5) * 3,
        y: CHIMNEY_Y,
        vx: (Math.random() - 0.5) * 12 - speed * 0.15,
        vy: -18 - Math.random() * 14 * (strength || 1),
        r: 2 + Math.random(),
        a: 0.95,
      });
    }

    update(dt) {
      const tr = this.trip;
      if (tr) {
        tr.t += dt;
        const t = Math.max(0, tr.t);
        const pos = tr.motion.pos(Math.min(t, tr.motion.T));
        this.wheelDist += pos - tr.lastPos;
        tr.lastPos = pos;
        this.front = STOP_X + pos;
        this.camera = Math.max(0, Math.min(tr.worldEnd - SS.W, this.front - STOP_X));
        this.speed = tr.t > 0 ? tr.motion.speed(t) : 0;
        if (tr.t >= tr.motion.T + 0.4) this.arrive();
      }
      // Goods flying between platform and train
      if (this.flyers.length) {
        for (const f of this.flyers) {
          f.t += dt;
          if (f.t >= FLY_TIME && !f.landed) {
            f.landed = true;
            if (f.onLand) f.onLand();
          }
        }
        this.flyers = this.flyers.filter(f => !f.landed);
        if (!this.flyers.length && this.afterFlights) {
          const done = this.afterFlights;
          this.afterFlights = null;
          done();
        }
      }
      // Steam: faster puffs when moving, a lazy wisp when standing still
      this.puffTimer -= dt;
      if (this.puffTimer <= 0) {
        this.puff(this.front + CHIMNEY_DX, this.speed, this.speed > 0 ? 1 : 0.5);
        // Chuff with every puff while moving (not too often at full speed)
        if (this.speed > 5 && this.lastTime - (this.lastChuff || 0) > 130) {
          this.lastChuff = this.lastTime;
          TG.sound.play('chuff', { strength: 0.6 + Math.min(0.5, this.speed / 600) });
        }
        this.puffTimer = this.speed > 0 ? Math.max(0.07, 0.35 - this.speed / 900) : 0.9;
      }
      for (const p of this.smoke) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy *= 1 - dt * 0.8;
        p.r = Math.min(10, p.r + dt * 6);
        p.a -= dt * 0.38;
      }
      this.smoke = this.smoke.filter(p => p.a > 0);
      // Confetti after a finished round (screen coordinates)
      for (const p of this.confetti || []) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.99;
      }
      if (this.confetti) this.confetti = this.confetti.filter(p => p.y < SS.H + 4);
    }

    flyerPositions() {
      const out = [];
      for (const f of this.flyers) {
        if (f.t < 0) continue;
        const u = Math.min(1, f.t / FLY_TIME);
        const e = u * u * (3 - 2 * u);
        out.push({
          good: f.good,
          x: f.x0 + (f.x1 - f.x0) * e,
          y: f.y0 + (f.y1 - f.y0) * e - Math.sin(Math.PI * u) * 22,
        });
      }
      return out;
    }

    frame(t) {
      requestAnimationFrame(tt => this.frame(tt)); // first, so one bad frame cannot stop the loop
      const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0);
      this.lastTime = t;
      if (!this.active || !this.state) return;
      this.update(dt);
      const time = t / 1000;
      this.renderer.draw({
        camera: this.camera,
        front: this.front,
        wheelDist: this.wheelDist,
        time,
        smoke: this.smoke,
        cargo: this.cargoView(),
        piles: this.sceneStations.map(id => this.pilesFor(id)),
        flyers: this.flyerPositions(),
        confetti: this.confetti,
        speed: this.speed,
      });
      const tr = this.trip;
      const dist = tr ? (tr.lastPos / tr.D) * tr.route.length : 0;
      this.minimap.draw(tr ? tr.route : null, dist, this.current, time, this.switchMode ? {
        switches: this.switchTiles,
        preview: this.preview && this.preview.route,
        blocked: this.preview && this.preview.blocked,
      } : null);
      this.positionSigns();
    }

    // ------------------------------------------------------------ mouse on the side view

    artPoint(e) {
      const r = this.dom.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * SS.W, y: ((e.clientY - r.top) / r.height) * SS.H };
    }

    hit(e) {
      if (!this.atStart() || this.passengers()) return null;
      const p = this.artPoint(e);
      const goods = this.supplyGoods().slice(0, MAX_PILES);
      const pile = this.renderer.pileAt(0, goods.length, p.x, p.y, this.camera);
      if (pile >= 0) return { load: goods[pile] };
      const wagons = this.wagonGoods();
      const w = this.renderer.wagonAt(this.front, wagons.length, p.x, p.y, this.camera);
      const good = w >= 0 ? wagons[wagons.length - 1 - w] : null;
      if (good && RD.count(this.round, good) > 0) return { unload: good };
      return null;
    }

    onCanvasClick(e) {
      if (e.button !== 0) return;
      const h = this.hit(e);
      if (h && h.load) this.loadGood(h.load);
      if (h && h.unload) this.unloadGood(h.unload);
    }

    onCanvasMove(e) {
      this.dom.canvas.style.cursor = this.hit(e) ? 'pointer' : 'default';
    }

    // ------------------------------------------------------------ layout and panels

    layout() {
      const stage = this.dom.stage;
      const s = this.renderer.fit(stage.clientWidth - 24, stage.clientHeight - 24, window.devicePixelRatio || 1);
      this.cssScale = s;
      for (const box of [this.dom.signs]) {
        box.style.width = this.dom.canvas.style.width;
        box.style.height = this.dom.canvas.style.height;
      }
      this.dom.board.style.setProperty('--px', s + 'px');
      const mm = this.dom.minimap;
      const k = Math.max(1, Math.round(s));
      mm.style.width = mm.width * k + 'px';
      mm.style.height = mm.height * k + 'px';
      this.positionSigns();
    }

    buildSigns() {
      const box = this.dom.signs;
      box.textContent = '';
      for (const st of this.renderer.stations) {
        const sign = el('div', 'sign');
        sign.append(nameEl(st.kind));
        box.append(sign);
      }
    }

    positionSigns() {
      if (!this.cssScale) return;
      const pos = this.renderer.signPositions(this.camera);
      Array.from(this.dom.signs.children).forEach((sign, i) => {
        const p = pos[i];
        const visible = p && p.x > -60 && p.x < SS.W + 60;
        sign.style.display = visible ? '' : 'none';
        if (visible) {
          sign.style.left = p.x * this.cssScale + 'px';
          sign.style.top = p.y * this.cssScale + 'px';
        }
      });
    }

    refresh() {
      this.refreshStatus();
      this.refreshOrders();
      this.refreshMessages();
      this.refreshLoad();
      this.refreshDestinations();
      this.refreshMaths();
    }

    // ------------------------------------------------------------ the sum with answer buttons

    /** The sum to show now: unloading by hand at a station, or the next unanswered loading sum. */
    currentProblem() {
      if (this.trip || this.busy) return null;
      if (this.unloading) {
        const o = RD.openOrderAt(this.round, this.unloading.stationId);
        return o ? TG.maths.unloadProblem(this.plan, o, this.round.orders.indexOf(o) * 31 + 7) : null;
      }
      if (this.current !== this.startId) return null;
      const i = this.plan.problems.findIndex((p, k) => !this.answered.has(k));
      return i < 0 ? null : Object.assign({ index: i }, this.plan.problems[i]);
    }

    /** An answer button: load / take out / unload that many, or set that many carriages. */
    answer(pr, n) {
      if (pr.index != null) this.answered.add(pr.index);
      if (this.unloading) {
        this.setUnloadCount(n);
        this.confirmUnload();
        return;
      }
      if (pr.action === 'wagons') this.setWagons(n);
      else if (pr.action === 'unload') this.unloadMany(pr.good, n);
      else this.loadMany(pr.good, n);
      this.refresh();
    }

    refreshMaths() {
      const box = this.dom.maths;
      const pr = this.currentProblem();
      box.textContent = '';
      box.hidden = !pr;
      if (!pr) return;
      const q = pr.action === 'wagons' ? i18n.both('howManyWagons')
        : this.unloading ? i18n.both('askUnload', { goods: l => i18n.goodsWord(pr.good, 2, l) })
          : i18n.both(pr.action === 'unload' ? 'qTakeOut' : 'qLoad', { goods: l => i18n.goodsWord(pr.good, 2, l) });
      box.append(sentenceEl(q, 'question'));
      const sum = el('div', 'sum');
      for (const t of pr.tokens) {
        if (t === '?') sum.append(el('span', 'blank', '…'));
        else if (typeof t === 'object') sum.append(this.iconsEl(pr.good, t.icons));
        else if (typeof t === 'number') sum.append(el('span', 'num', String(t)));
        else sum.append(el('span', 'op', t));
      }
      box.append(sum);
      const row = el('div', 'choices');
      for (const n of pr.choices) {
        const b = el('button', 'btn choice-btn', String(n));
        b.type = 'button';
        b.addEventListener('click', () => this.answer(pr, n));
        row.append(b);
      }
      box.append(row);
    }

    /** Goods to count, laid out in tens (rows of five), like a ten frame. */
    iconsEl(good, n) {
      const wrap = el('span', 'icon-count');
      for (let t = 0; t < n; t += 10) {
        const ten = el('span', 'ten');
        for (let i = t; i < Math.min(n, t + 10); i++) ten.append(goodIconEl(good));
        wrap.append(ten);
      }
      return wrap;
    }

    refreshStatus() {
      const d = this.dom;
      const cur = L.stationById(this.state, this.current);
      if (this.trip) {
        const to = L.stationById(this.state, this.trip.to);
        d.status.textContent = i18n.t('goingTo', { s: i18n.stationPhrase(to.kind) });
      } else {
        d.status.textContent = i18n.t(this.arrivedHere ? 'arrived' : 'atStation', { s: i18n.stationPhrase(cur.kind) });
      }
      d.whereTo.textContent = i18n.t('whereTo');
    }

    refreshOrders() {
      const box = this.dom.orders;
      box.textContent = '';
      box.append(el('h2', null, i18n.t('orders')));
      const list = el('ul', this.round.ordered ? 'ordered' : '');
      const next = RD.nextOrder(this.round);
      this.round.orders.forEach((o, i) => {
        const st = L.stationById(this.state, o.stationId);
        const done = RD.remaining(o) === 0;
        const li = el('li', done ? 'done' : this.round.ordered && o === next ? 'current' : '');
        if (this.round.ordered) li.append(el('span', 'step', String(i + 1)));
        li.append(goodIconEl(o.good));
        const hide = this.plan.hideAmounts;
        li.append(sentenceEl(i18n.both(hide ? 'orderLineNoNumber' : 'orderLine', {
          n: o.amount,
          goods: l => i18n.goodsWord(o.good, hide ? 2 : o.amount, l),
          s: l => i18n.stationPhrase(st.kind, l),
        })));
        const progress = o.delivered > 0 && !hide ? o.delivered + ' / ' + o.amount : '';
        const status = el('span', 'order-status', done ? '✓' : progress);
        li.append(status);
        list.append(li);
      });
      box.append(list);
      for (const note of this.plan.notes) {
        const v = note.vars;
        const vars = {};
        for (const k in v) if (typeof v[k] === 'number') vars[k] = v[k];
        const n = v.p != null ? v.p : v.total != null ? v.total : 2;
        if (v.good) vars.goods = l => i18n.goodsWord(v.good, n, l);
        box.append(sentenceEl(i18n.both(note.key, vars), 'note'));
      }
    }

    refreshMessages() {
      const box = this.dom.messages;
      box.textContent = '';
      box.hidden = !this.messages.length;
      for (const m of this.messages) box.append(sentenceEl(m, m.kind || ''));
    }

    refreshLoad() {
      const box = this.dom.load;
      box.textContent = '';
      box.append(el('h2', null, i18n.t('load')));
      if (this.unloading) box.append(this.unloadBox());
      if (this.passengers()) {
        this.refreshCarriages(box);
        return;
      }
      const goods = Array.from(new Set([...this.supplyGoods(), ...this.round.load]));
      const canLoad = this.atStart();
      for (const good of goods) {
        const n = RD.count(this.round, good);
        const row = el('div', 'load-row');
        row.append(goodIconEl(good));
        const label = el('div', 'load-label');
        const word = el('span', 'name');
        word.append(el('span', 'main lang-' + i18n.getLang(), i18n.goodsWord(good, 2)));
        word.append(el('span', 'second lang-' + i18n.other(), i18n.goodsWord(good, 2, i18n.other())));
        label.append(word, dotsEl(n));
        row.append(label);
        const minus = el('button', 'btn round-btn', '−');
        minus.type = 'button';
        minus.disabled = !canLoad || n === 0;
        minus.setAttribute('aria-label', '−1');
        minus.addEventListener('click', () => this.unloadGood(good));
        const plus = el('button', 'btn round-btn', '+');
        plus.type = 'button';
        plus.disabled = !canLoad || RD.isFull(this.round);
        plus.setAttribute('aria-label', '+1');
        plus.addEventListener('click', () => this.loadGood(good));
        row.append(minus, el('span', 'load-count', String(n)), plus);
        box.append(row);
      }
      if (!this.round.load.length && !canLoad) box.append(el('p', 'hint', i18n.t('trainEmpty')));
      if (canLoad) box.append(el('p', 'hint', i18n.t('loadHint')));
    }

    /** Unloading by hand: choose how many of the good come off, then press Unload. */
    unloadBox() {
      const u = this.unloading;
      const have = RD.count(this.round, u.good);
      const boxEl = el('div', 'unload-box');
      const row = el('div', 'load-row');
      row.append(goodIconEl(u.good));
      const label = el('div', 'load-label');
      const word = el('span', 'name');
      word.append(el('span', 'main lang-' + i18n.getLang(), i18n.t('unload')));
      word.append(el('span', 'second lang-' + i18n.other(), i18n.t('unload', null, i18n.other())));
      label.append(word, dotsEl(u.n));
      row.append(label);
      const minus = el('button', 'btn round-btn', '−');
      minus.type = 'button';
      minus.disabled = this.busy || u.n === 0;
      minus.addEventListener('click', () => this.setUnloadCount(u.n - 1));
      const plus = el('button', 'btn round-btn', '+');
      plus.type = 'button';
      plus.disabled = this.busy || u.n >= have;
      plus.addEventListener('click', () => this.setUnloadCount(u.n + 1));
      row.append(minus, el('span', 'load-count', String(u.n)), plus);
      const go = el('button', 'btn primary unload-go', i18n.t('unload') + ' ✓');
      go.type = 'button';
      go.disabled = this.busy || u.n === 0;
      go.addEventListener('click', () => this.confirmUnload());
      boxEl.append(row, go);
      return boxEl;
    }

    /** Passenger rounds: number of carriages, and seats shown as groups of dots (c, c, c ...). */
    refreshCarriages(box) {
      const r = this.round;
      const canChange = this.atStart();
      const row = el('div', 'load-row');
      const icon = el('canvas', 'good-icon wide');
      const t = SS.WAGON_TYPES[r.wagonType];
      icon.width = t.w;
      icon.height = t.h;
      icon.getContext('2d').drawImage(SS.wagonSprite(r.wagonType, 0), 0, 0);
      row.append(icon);
      const label = el('div', 'load-label');
      const word = el('span', 'name');
      word.append(el('span', 'main lang-' + i18n.getLang(), i18n.t('wagons')));
      word.append(el('span', 'second lang-' + i18n.other(), i18n.t('wagons', null, i18n.other())));
      label.append(word);
      row.append(label);
      const minus = el('button', 'btn round-btn', '−');
      minus.type = 'button';
      minus.disabled = !canChange || r.wagons <= 1 || (r.wagons - 1) * r.perWagon < r.load.length;
      minus.addEventListener('click', () => this.setWagons(r.wagons - 1));
      const plus = el('button', 'btn round-btn', '+');
      plus.type = 'button';
      plus.disabled = !canChange || r.wagons >= TG.maths.MAX_COACHES;
      plus.addEventListener('click', () => this.setWagons(r.wagons + 1));
      row.append(minus, el('span', 'load-count', String(r.wagons)), plus);
      box.append(row);

      // One group of seat dots per carriage; filled dots are passengers on board
      const groups = el('div', 'seat-groups');
      const onBoard = RD.count(r, 'passenger');
      for (let w = 0; w < r.wagons; w++) {
        const g = el('span', 'seat-group');
        for (let k = 0; k < r.perWagon; k++) {
          const seat = w * r.perWagon + k;
          g.append(el('span', 'dot' + (seat < onBoard ? '' : ' empty')));
        }
        groups.append(g);
      }
      box.append(groups);
      const prow = el('div', 'load-row passengers-row');
      prow.append(goodIconEl('passenger'));
      const plabel = el('div', 'load-label');
      const pword = el('span', 'name');
      pword.append(el('span', 'main lang-' + i18n.getLang(), i18n.goodsWord('passenger', 2)));
      pword.append(el('span', 'second lang-' + i18n.other(), i18n.goodsWord('passenger', 2, i18n.other())));
      plabel.append(pword);
      prow.append(plabel, el('span'), el('span', 'load-count', String(onBoard)), el('span'));
      box.append(prow);
    }

    /** Switch mode: switch buttons, where the train will go, and a Depart button. */
    refreshSwitches() {
      const d = this.dom;
      d.destinations.textContent = '';
      d.whereTo.textContent = i18n.t('switchesTitle');
      this.preview = !this.trip ? R.followTrack(this.state, this.current, this.switchState) : null;
      const box = el('div', 'switches');
      for (const sw of this.switchTiles) {
        const c = L.cellAt(this.state, sw.x, sw.y);
        const btn = el('button', 'switch-btn');
        btn.type = 'button';
        btn.style.borderColor = sw.color;
        btn.disabled = !!this.trip || this.busy;
        btn.setAttribute('aria-label', i18n.t('switchesTitle') + ' ' + (this.switchTiles.indexOf(sw) + 1));
        const cv = el('canvas');
        cv.width = S.TILE;
        cv.height = S.TILE;
        const cx = cv.getContext('2d');
        cx.drawImage(S.ground('grass'), 0, 0);
        cx.drawImage(S.switchTile(c.rot, this.switchState.get(sw.idx)), 0, 0);
        btn.append(cv);
        btn.addEventListener('click', () => this.toggleSwitch(sw));
        box.append(btn);
      }
      d.destinations.append(el('p', 'hint', i18n.t('switchHint')), box);
      if (!this.trip && this.preview) {
        const to = this.preview.end && L.stationById(this.state, this.preview.end);
        d.destinations.append(sentenceEl(to
          ? i18n.both('goesTo', { s: l => i18n.stationPhrase(to.kind, l) })
          : i18n.both('switchWrong'), to ? 'prediction ok' : 'prediction warn'));
      }
      const go = el('button', 'btn primary depart-btn', i18n.t('depart'));
      go.type = 'button';
      go.disabled = !!this.trip || this.busy || !(this.preview && this.preview.end);
      go.addEventListener('click', () => this.departAlongTrack());
      d.destinations.append(go);
    }

    refreshDestinations() {
      if (this.switchMode) return this.refreshSwitches();
      const d = this.dom;
      d.destinations.textContent = '';
      for (const st of this.state.stations) {
        const here = st.id === this.current;
        const btn = el('button', 'destination' + (here ? ' here' : ''));
        btn.type = 'button';
        btn.disabled = here || !!this.trip || this.busy;
        btn.addEventListener('click', () => this.depart(st.id));
        const icon = el('canvas');
        icon.width = S.TILE;
        icon.height = S.TILE;
        const ictx = icon.getContext('2d');
        ictx.drawImage(S.ground('grass'), 0, 0);
        ictx.drawImage(S.building(st.kind), 0, 0);
        btn.append(icon, nameEl(st.kind));
        const open = this.round.orders.some(o => o.stationId === st.id && RD.remaining(o) > 0);
        if (here) btn.append(el('span', 'tag', i18n.t('here')));
        else if (open) btn.append(goodIconEl(this.round.orders.find(o => o.stationId === st.id).good));
        d.destinations.append(btn);
      }
    }

    showRoundDone() {
      const d = this.dom;
      const n = RD.stars(this.round);
      d.roundTitle.textContent = i18n.t('roundDone');
      TG.ui.fillStars(d.roundStars, n);
      d.roundStars.setAttribute('aria-label', n + ' / 3');
      d.roundText.textContent = '';
      const startKind = L.stationById(this.state, this.startId).kind;
      const extra = this.round.departuresFromStart - 1;
      const left = RD.leftovers(this.round);
      if (n === 3) d.roundText.append(sentenceEl(i18n.both('perfect'), 'ok'));
      if (extra > 0) {
        d.roundText.append(sentenceEl(i18n.both(extra === 1 ? 'tripsOne' : 'tripsMany', { k: extra, s: l => i18n.stationPhrase(startKind, l) })));
      }
      for (const lo of left) {
        d.roundText.append(sentenceEl(i18n.both(lo.n === 1 ? 'leftOne' : 'leftMany', { k: lo.n, goods: l => i18n.goodsWord(lo.good, lo.n, l) })));
      }
      const early = this.round.orderMistakes || 0;
      if (early > 0) d.roundText.append(sentenceEl(i18n.both(early === 1 ? 'wrongStationOne' : 'wrongStationMany', { k: early })));
      const empty = this.round.emptySeats || 0;
      if (empty > 0) d.roundText.append(sentenceEl(i18n.both(empty === 1 ? 'emptySeatsOne' : 'emptySeatsMany', { k: empty })));
      // Progress: the result moves this skill's level (adaptive difficulty)
      const skill = this.plan.skill;
      const before = TG.progress.level(skill);
      const after = TG.progress.record(skill, n);
      const levelUp = after > before && TG.settings.get().adaptive;
      if (levelUp) d.roundText.append(sentenceEl(i18n.both('levelUp'), 'ok'));
      TG.sound.stars(n);
      if (levelUp) setTimeout(() => TG.sound.play('levelup'), 400 + n * 350);
      this.confetti = TG.ui.confetti(SS.W, 120);
      if (this.callbacks.onStars) this.callbacks.onStars();
      d.roundDone.hidden = false;
      d.btnNewRound.focus();
    }

    refreshTexts() {
      if (!this.state) return;
      this.buildSigns();
      this.refresh();
      this.positionSigns();
    }
  }

  TG.DriveScreen = DriveScreen;
})(globalThis.TG = globalThis.TG || {});
