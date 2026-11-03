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
  const WAGONS = 3;
  const MAX_PILES = 3;     // crates that fit on the platform next to the train
  const CHIMNEY_DX = -10;  // chimney position relative to the train's front
  const CHIMNEY_Y = SS.RAIL_Y - SS.LOCO_H + 1;
  const FLY_TIME = 0.45;

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

  /** Count shown as dots in groups of five (like a ten frame). */
  function dotsEl(n) {
    const box = el('span', 'dots');
    for (let i = 0; i < n; i++) {
      if (i > 0 && i % 5 === 0) box.append(el('span', 'gap'));
      box.append(el('span', 'dot'));
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
      this.active = true;
      this.newRound();
      this.layout();
    }

    close() {
      this.active = false;
      this.dom.roundDone.hidden = true;
    }

    newRound() {
      const orders = RD.generateOrders(this.state, this.def, Math.floor(Math.random() * 1e9));
      this.round = RD.createRound(orders, WAGONS);
      this.current = this.startId;
      this.trip = null;
      this.arrivedHere = false;
      this.busy = false;
      this.smoke = [];
      this.flyers = [];
      this.pendingLoad = {};
      this.pendingPile = {};
      this.puffTimer = 0;
      this.messages = [];
      this.dom.roundDone.hidden = true;
      this.idleScene();
      this.refresh();
    }

    // ------------------------------------------------------------ trips

    sceneBase() {
      return { theme: this.def.theme, wagons: WAGONS, sceneryOffset: this.sceneryOffset };
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

    depart(toId) {
      if (this.trip || this.busy) return;
      const route = R.findRoute(this.state, this.graph, this.current, toId);
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
      this.trip = { route, to: toId, D, worldEnd, motion: motion(D), t: -WHISTLE, lastPos: 0 };
      this.flyers = [];
      this.pendingLoad = {};
      this.messages = [];
      for (let i = 0; i < 6; i++) this.puff(this.front + CHIMNEY_DX, 0, 1.4);
      this.buildSigns();
      this.refresh();
    }

    arrive() {
      const shift = this.trip.worldEnd - SS.W;
      this.sceneryOffset += shift;
      for (const p of this.smoke) p.x -= shift;
      this.current = this.trip.to;
      this.trip = null;
      this.arrivedHere = true;
      this.idleScene();
      if (this.current === this.startId) {
        this.messages = [i18n.both('loadHint')];
        this.refresh();
      } else {
        this.unloadHere();
      }
    }

    /** Hand over the goods this station ordered, with goods flying onto the platform. */
    unloadHere() {
      const before = this.round.load.slice();
      const res = RD.deliverAt(this.round, this.current);
      const goodsHere = this.deliveredGoods(this.current);
      const removed = res.removed.slice().sort((a, b) => a - b);
      removed.forEach((idx, i) => {
        const good = before[idx];
        const key = this.current + ':' + good;
        this.pendingPile[key] = (this.pendingPile[key] || 0) + 1;
        const from = this.renderer.slotPos(this.front, idx);
        const p = Math.min(goodsHere.indexOf(good), MAX_PILES - 1);
        const k = this.deliveredCount(this.current, good) - this.pendingPile[key];
        const to = this.renderer.pileItemPos(0, p, Math.min(9, k), false);
        this.fly(good, from, to, -i * 0.12, () => { this.pendingPile[key]--; });
      });
      this.busy = removed.length > 0;
      this.afterFlights = () => {
        this.busy = false;
        this.messages = this.deliveryMessages(res.deliveries);
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

    supplyGoods() {
      return RD.goodsNeeded(this.round);
    }

    loadGood(good) {
      if (!this.atStart()) {
        const startKind = L.stationById(this.state, this.startId).kind;
        this.messages = [i18n.both('loadOnlyAtStart', { s: l => i18n.stationPhrase(startKind, l) })];
        this.refresh();
        return;
      }
      const idx = RD.loadOne(this.round, good);
      if (idx < 0) {
        this.messages = [Object.assign(i18n.both('trainFull'), { kind: 'warn' })];
        this.refresh();
        return;
      }
      this.messages = [];
      this.pendingLoad[good] = (this.pendingLoad[good] || 0) + 1;
      const p = Math.min(this.supplyGoods().indexOf(good), MAX_PILES - 1);
      const from = this.renderer.pileItemPos(0, p, 1, true);
      this.fly(good, from, this.renderer.slotPos(this.front, idx), 0, () => { this.pendingLoad[good]--; });
      this.refresh();
    }

    unloadGood(good) {
      if (!this.atStart()) return;
      const idx = RD.unloadOne(this.round, good);
      if (idx < 0) return;
      this.messages = [];
      const p = Math.max(0, Math.min(this.supplyGoods().indexOf(good), MAX_PILES - 1));
      this.fly(good, this.renderer.slotPos(this.front, idx), this.renderer.pileItemPos(0, p, 1, true), 0, null);
      this.refresh();
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
        return this.supplyGoods().slice(0, MAX_PILES).map(good => ({ good, supply: true }));
      }
      return this.deliveredGoods(stationId).slice(0, MAX_PILES).map(good => ({
        good,
        count: this.deliveredCount(stationId, good) - (this.pendingPile[stationId + ':' + good] || 0),
      }));
    }

    /** The load as drawn: items still flying towards the train are not shown yet. */
    cargoView() {
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
        this.camera = Math.max(0, Math.min(tr.worldEnd - SS.W, this.front - 360));
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
      });
      const tr = this.trip;
      const dist = tr ? (tr.lastPos / tr.D) * tr.route.length : 0;
      this.minimap.draw(tr ? tr.route : null, dist, this.current, time);
      this.positionSigns();
    }

    // ------------------------------------------------------------ mouse on the side view

    artPoint(e) {
      const r = this.dom.canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * SS.W, y: ((e.clientY - r.top) / r.height) * SS.H };
    }

    hit(e) {
      if (!this.atStart()) return null;
      const p = this.artPoint(e);
      const goods = this.supplyGoods().slice(0, MAX_PILES);
      const pile = this.renderer.pileAt(0, goods.length, p.x, p.y, this.camera);
      if (pile >= 0) return { load: goods[pile] };
      const slot = this.renderer.slotAt(this.front, this.round.load.length, p.x, p.y, this.camera);
      if (slot >= 0) return { unload: this.round.load[slot] };
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
      const k = Math.max(1, Math.round(s * 1.5));
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
      const list = el('ul');
      for (const o of this.round.orders) {
        const st = L.stationById(this.state, o.stationId);
        const done = RD.remaining(o) === 0;
        const li = el('li', done ? 'done' : '');
        li.append(goodIconEl(o.good));
        li.append(sentenceEl(i18n.both('orderLine', {
          n: o.amount,
          goods: l => i18n.goodsWord(o.good, o.amount, l),
          s: l => i18n.stationPhrase(st.kind, l),
        })));
        const status = el('span', 'order-status', done ? '✓' : o.delivered > 0 ? o.delivered + ' / ' + o.amount : '');
        li.append(status);
        list.append(li);
      }
      box.append(list);
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

    refreshDestinations() {
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
      d.roundStars.textContent = '★'.repeat(n) + '☆'.repeat(3 - n);
      d.roundStars.setAttribute('aria-label', n + ' / 3');
      d.roundText.textContent = '';
      const startKind = L.stationById(this.state, this.startId).kind;
      const extra = this.round.departuresFromStart - 1;
      const left = RD.leftovers(this.round);
      if (extra <= 0 && !left.length) d.roundText.append(sentenceEl(i18n.both('perfect'), 'ok'));
      if (extra > 0) {
        d.roundText.append(sentenceEl(i18n.both(extra === 1 ? 'tripsOne' : 'tripsMany', { k: extra, s: l => i18n.stationPhrase(startKind, l) })));
      }
      for (const lo of left) {
        d.roundText.append(sentenceEl(i18n.both(lo.n === 1 ? 'leftOne' : 'leftMany', { k: lo.n, goods: l => i18n.goodsWord(lo.good, lo.n, l) })));
      }
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
