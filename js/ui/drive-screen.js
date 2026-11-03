/*
 * The driving screen: side view of the train, a mini-map and a list of
 * stations to travel to. The train finds its own way over the track the
 * player built (TG.route).
 */
(function (TG) {
  'use strict';

  const L = TG.level;
  const R = TG.route;
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
  const CHIMNEY_DX = -10;  // chimney position relative to the train's front
  const CHIMNEY_Y = SS.RAIL_Y - SS.LOCO_H + 1;

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

  class DriveScreen {
    constructor(dom, callbacks) {
      this.dom = dom;
      this.callbacks = callbacks || {};
      this.renderer = new TG.SideRenderer(dom.canvas);
      this.minimap = new TG.Minimap(dom.minimap);
      this.active = false;
      this.smoke = [];
      this.lastTime = 0;
      this.wheelDist = 0;
      window.addEventListener('resize', () => { if (this.active) this.layout(); });
      requestAnimationFrame(t => this.frame(t));
    }

    open(state, analysis, def) {
      this.state = state;
      this.graph = analysis.graph;
      this.def = def;
      this.current = state.stations[0].id;
      this.trip = null;
      this.arrivedHere = false;
      this.smoke = [];
      this.sceneryOffset = 0;
      this.puffTimer = 0;
      this.minimap.setLevel(state);
      this.idleScene();
      this.active = true;
      this.refreshPanel();
      this.layout();
    }

    close() {
      this.active = false;
    }

    // ------------------------------------------------------------ trips

    sceneBase() {
      return { theme: this.def.theme, wagons: WAGONS, sceneryOffset: this.sceneryOffset };
    }

    idleScene() {
      const st = L.stationById(this.state, this.current);
      this.renderer.setScene(Object.assign(this.sceneBase(), { startKind: st.kind, endKind: null, worldEnd: SS.W, bridges: [] }));
      this.camera = 0;
      this.front = STOP_X;
      this.speed = 0;
      this.buildSigns();
    }

    depart(toId) {
      if (this.trip) return;
      const route = R.findRoute(this.state, this.graph, this.current, toId);
      if (!route) return;
      const D = route.length * PX_PER_TILE;
      const worldEnd = STOP_X + D + (SS.W - STOP_X);
      const toX = d => STOP_X + (d / route.length) * D;
      const bridges = R.spans(route, 'bridge').map(sp => ({ x0: toX(sp.start), x1: toX(sp.end) }));
      const from = L.stationById(this.state, this.current);
      const to = L.stationById(this.state, toId);
      this.renderer.setScene(Object.assign(this.sceneBase(), { startKind: from.kind, endKind: to.kind, worldEnd, bridges }));
      this.trip = { route, to: toId, D, worldEnd, motion: motion(D), t: -WHISTLE, lastPos: 0 };
      // A big puff of steam as the whistle blows
      for (let i = 0; i < 6; i++) this.puff(this.front + CHIMNEY_DX, 0, 1.4);
      this.buildSigns();
      this.refreshPanel();
    }

    arrive() {
      const shift = this.trip.worldEnd - SS.W;
      this.sceneryOffset += shift;
      for (const p of this.smoke) p.x -= shift;
      this.current = this.trip.to;
      this.trip = null;
      this.arrivedHere = true;
      this.idleScene();
      this.refreshPanel();
    }

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

    frame(t) {
      requestAnimationFrame(tt => this.frame(tt)); // first, so one bad frame cannot stop the loop
      const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0);
      this.lastTime = t;
      if (this.active && this.state) {
        this.update(dt);
        const time = t / 1000;
        this.renderer.draw({ camera: this.camera, front: this.front, wheelDist: this.wheelDist, time, smoke: this.smoke });
        const tr = this.trip;
        const dist = tr ? (tr.lastPos / tr.D) * tr.route.length : 0;
        this.minimap.draw(tr ? tr.route : null, dist, this.current, time);
        this.positionSigns();
      }
    }

    // ------------------------------------------------------------ layout and panel

    layout() {
      const stage = this.dom.stage;
      const s = this.renderer.fit(stage.clientWidth - 24, stage.clientHeight - 24, window.devicePixelRatio || 1);
      this.cssScale = s;
      this.dom.signs.style.width = this.dom.canvas.style.width;
      this.dom.signs.style.height = this.dom.canvas.style.height;
      this.dom.signs.style.setProperty('--px', s + 'px');
      const mm = this.dom.minimap;
      const k = Math.max(1, Math.floor(270 / mm.width));
      mm.style.width = mm.width * k + 'px';
      mm.style.height = mm.height * k + 'px';
      this.positionSigns();
    }

    buildSigns() {
      const box = this.dom.signs;
      box.textContent = '';
      for (const st of this.renderer.stations) {
        const el = document.createElement('div');
        el.className = 'sign';
        el.append(nameEl(st.kind));
        box.append(el);
      }
    }

    positionSigns() {
      if (!this.cssScale) return;
      const pos = this.renderer.signPositions(this.camera);
      Array.from(this.dom.signs.children).forEach((el, i) => {
        const p = pos[i];
        const visible = p && p.x > -60 && p.x < SS.W + 60;
        el.style.display = visible ? '' : 'none';
        if (visible) {
          el.style.left = p.x * this.cssScale + 'px';
          el.style.top = p.y * this.cssScale + 'px';
        }
      });
    }

    refreshPanel() {
      const d = this.dom;
      const cur = L.stationById(this.state, this.current);
      if (this.trip) {
        const to = L.stationById(this.state, this.trip.to);
        d.status.textContent = i18n.t('goingTo', { s: i18n.stationPhrase(to.kind) });
      } else {
        d.status.textContent = i18n.t(this.arrivedHere ? 'arrived' : 'atStation', { s: i18n.stationPhrase(cur.kind) });
      }
      d.whereTo.textContent = i18n.t('whereTo');
      d.mapHeading.textContent = i18n.t('map');

      d.destinations.textContent = '';
      for (const st of this.state.stations) {
        const here = st.id === this.current;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'destination' + (here ? ' here' : '');
        btn.disabled = here || !!this.trip;
        btn.addEventListener('click', () => this.depart(st.id));
        const icon = document.createElement('canvas');
        icon.width = S.TILE;
        icon.height = S.TILE;
        const ictx = icon.getContext('2d');
        ictx.drawImage(S.ground('grass'), 0, 0);
        ictx.drawImage(S.building(st.kind), 0, 0);
        btn.append(icon, nameEl(st.kind));
        if (here) {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = i18n.t('here');
          btn.append(tag);
        }
        d.destinations.append(btn);
      }
    }

    refreshTexts() {
      if (!this.state) return;
      this.buildSigns();
      this.refreshPanel();
      this.positionSigns();
    }
  }

  TG.DriveScreen = DriveScreen;
})(globalThis.TG = globalThis.TG || {});
