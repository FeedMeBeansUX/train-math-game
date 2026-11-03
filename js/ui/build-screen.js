/*
 * The track-building (puzzle) screen: input, side panel, station labels and
 * the "all connected" celebration.
 */
(function (TG) {
  'use strict';

  const T = TG.track;
  const L = TG.level;
  const NW = TG.network;
  const S = TG.sprites;
  const i18n = TG.i18n;

  const CONFETTI_COLORS = ['#ffd84a', '#e0473a', '#5fb0e8', '#7cc56a', '#f2f0e8', '#d98aa0'];

  /** Build a bilingual name element: main language bold, other language below. */
  function nameEl(entry, tag) {
    const n = i18n.name(entry);
    const el = document.createElement(tag || 'span');
    el.className = 'name';
    const main = document.createElement('span');
    main.className = 'main lang-' + i18n.getLang();
    main.textContent = n.main;
    const second = document.createElement('span');
    second.className = 'second lang-' + (i18n.getLang() === 'nl' ? 'en' : 'nl');
    second.textContent = n.second;
    el.append(main, second);
    return el;
  }

  class BuildScreen {
    constructor(dom, callbacks) {
      this.dom = dom;
      this.callbacks = callbacks || {};
      this.renderer = new TG.TopDownRenderer(dom.canvas);
      this.selected = null;
      this.rotations = { straight: 1, curve: 0, junction: 0 };
      this.hover = null;
      this.particles = [];
      this.solved = false;
      this.lastTime = 0;
      this.bindInput();
      window.addEventListener('resize', () => this.layout());
      requestAnimationFrame(t => this.frame(t));
    }

    // ------------------------------------------------------------ level

    load(def) {
      this.def = def;
      this.state = L.createLevel(def);
      this.renderer.setLevel(this.state);
      this.types = T.INVENTORY_ORDER.filter(type => (def.pieces[type] || 0) > 0);
      this.selected = this.types[0] || null;
      this.solved = false;
      this.particles = [];
      this.analysis = NW.analyze(this.state);
      this.buildLabels();
      this.refreshPanel();
      this.layout();
    }

    restart() {
      this.load(this.def);
    }

    changed() {
      this.analysis = NW.analyze(this.state);
      if (this.selected && !(this.state.inventory[this.selected] > 0)) this.selected = null;
      this.refreshPanel();
      if (this.analysis.allConnected && !this.solved) {
        this.solved = true;
        this.celebrate();
      }
    }

    // ------------------------------------------------------------ layout

    layout() {
      if (!this.state) return;
      const wrap = this.dom.stage;
      const tilePx = this.renderer.fit(wrap.clientWidth - 24, wrap.clientHeight - 24, window.devicePixelRatio || 1);
      this.tilePx = tilePx;
      this.dom.labels.style.width = this.dom.canvas.style.width;
      this.dom.labels.style.height = this.dom.canvas.style.height;
      this.dom.labels.style.setProperty('--tile', tilePx + 'px');
      for (const el of this.dom.labels.children) {
        const st = L.stationById(this.state, el.dataset.station);
        const pos = this.labelPosition(st);
        el.style.left = pos.x * tilePx + 'px';
        el.style.top = pos.y * tilePx + 'px';
        el.dataset.place = pos.place;
      }
    }

    /**
     * Where a station's name label goes (in tiles), away from the track:
     * above or below the building, or beside it when that would leave the map.
     */
    labelPosition(st) {
      const { w, h } = this.state;
      const side = st.bx >= w - 3 ? 'left' : 'right';
      const besides = () => ({ x: side === 'right' ? st.bx + 1 : st.bx, y: st.by + 0.5, place: side });
      if (st.by <= st.y) {
        // Building above (or beside) the track: label above the building
        return st.by > 0 ? { x: st.bx + 0.5, y: st.by, place: 'above' } : besides();
      }
      // Building below the track: label below the building
      return st.by < h - 1 ? { x: st.bx + 0.5, y: st.by + 1, place: 'below' } : besides();
    }

    buildLabels() {
      const box = this.dom.labels;
      box.textContent = '';
      for (const st of this.state.stations) {
        const el = document.createElement('div');
        el.className = 'station-label';
        el.dataset.station = st.id;
        el.append(nameEl(st.kind));
        const badge = document.createElement('span');
        badge.className = 'badge';
        el.append(badge);
        box.append(el);
      }
    }

    // ------------------------------------------------------------ panel

    refreshPanel() {
      const d = this.dom;
      d.task.textContent = i18n.t('taskBuild');

      // Station checklist
      d.stations.textContent = '';
      for (const st of this.state.stations) {
        const li = document.createElement('li');
        const ok = this.analysis.connectedStations.has(st.id);
        li.className = st.isStart ? 'start' : ok ? 'done' : '';
        const mark = document.createElement('span');
        mark.className = 'mark';
        mark.textContent = st.isStart ? '▶' : ok ? '✓' : '';
        li.append(mark, nameEl(st.kind));
        if (st.isStart) {
          const tag = document.createElement('span');
          tag.className = 'tag';
          tag.textContent = i18n.t('start');
          li.append(tag);
        }
        d.stations.append(li);
      }

      // Labels on the map
      for (const el of d.labels.children) {
        const st = L.stationById(this.state, el.dataset.station);
        const ok = this.analysis.connectedStations.has(st.id);
        el.classList.toggle('connected', ok && !st.isStart);
        el.classList.toggle('start', st.isStart);
        el.querySelector('.badge').textContent = st.isStart ? '▶' : ok ? '✓' : '';
      }

      // Inventory
      d.inventory.textContent = '';
      this.types.forEach((type, i) => {
        const count = this.state.inventory[type];
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'piece' + (type === this.selected ? ' selected' : '');
        btn.disabled = count === 0;
        btn.addEventListener('click', () => this.select(type));

        const key = document.createElement('span');
        key.className = 'key';
        key.textContent = String(i + 1);

        const cv = document.createElement('canvas');
        cv.width = 48;
        cv.height = 48;
        const cx = cv.getContext('2d');
        cx.imageSmoothingEnabled = false;
        cx.drawImage(S.grass(1), 0, 0, 48, 48);
        cx.drawImage(S.track(type, this.rotations[type]), 0, 0, 48, 48);

        const cnt = document.createElement('span');
        cnt.className = 'count';
        cnt.textContent = '× ' + count;

        btn.append(key, cv, nameEl(type), cnt);
        d.inventory.append(btn);
      });

      d.help.innerHTML = '';
      for (const k of ['helpPlace', 'helpRotate', 'helpRotatePlaced', 'helpRemove']) {
        const li = document.createElement('li');
        li.textContent = i18n.t(k);
        d.help.append(li);
      }
    }

    select(type) {
      if (!(this.state.inventory[type] > 0)) return;
      this.selected = this.selected === type ? null : type;
      this.refreshPanel();
    }

    rotateSelected(step) {
      if (!this.selected) return;
      const type = this.selected;
      this.rotations[type] = T.normalizeRot(type, this.rotations[type] + step);
      this.refreshPanel();
    }

    // ------------------------------------------------------------ input

    bindInput() {
      const cv = this.dom.canvas;
      cv.addEventListener('mousemove', e => {
        this.hover = this.renderer.tileAt(e.clientX, e.clientY);
        this.updateCursor();
      });
      cv.addEventListener('mouseleave', () => { this.hover = null; });
      cv.addEventListener('mousedown', e => {
        if (this.solved) return;
        const tile = this.renderer.tileAt(e.clientX, e.clientY);
        if (!tile) return;
        if (e.button === 0) this.primary(tile);
        else if (e.button === 2) this.secondary(tile);
      });
      cv.addEventListener('contextmenu', e => e.preventDefault());
      cv.addEventListener('wheel', e => {
        if (!this.selected) return;
        e.preventDefault();
        this.rotateSelected(e.deltaY > 0 ? 1 : -1);
      }, { passive: false });

      window.addEventListener('keydown', e => {
        if (!this.state || this.solved || e.ctrlKey || e.metaKey || e.altKey) return;
        const n = parseInt(e.key, 10);
        if (n >= 1 && n <= this.types.length) this.select(this.types[n - 1]);
        else if (e.key === 'r' || e.key === 'R') this.rotateSelected(e.shiftKey ? -1 : 1);
        else if (e.key === 'Escape') { this.selected = null; this.refreshPanel(); }
        else if ((e.key === 'Delete' || e.key === 'Backspace') && this.hover) this.secondary(this.hover);
      });
    }

    primary(tile) {
      const c = L.cellAt(this.state, tile.x, tile.y);
      if (c) {
        if (L.rotateAt(this.state, tile.x, tile.y)) this.changed();
        return;
      }
      if (this.selected && L.place(this.state, tile.x, tile.y, this.selected, this.rotations[this.selected])) {
        this.changed();
      }
    }

    secondary(tile) {
      if (L.removeAt(this.state, tile.x, tile.y)) this.changed();
      else if (!L.cellAt(this.state, tile.x, tile.y) && this.selected) {
        this.selected = null;
        this.refreshPanel();
      }
    }

    updateCursor() {
      const t = this.hover;
      let cursor = 'default';
      if (t) {
        const c = L.cellAt(this.state, t.x, t.y);
        if (c) cursor = c.fixed ? 'not-allowed' : 'pointer';
        else if (this.selected) cursor = L.canBuild(this.state, t.x, t.y) ? 'crosshair' : 'not-allowed';
      }
      this.dom.canvas.style.cursor = cursor;
    }

    // ------------------------------------------------------------ celebration

    celebrate() {
      const w = this.state.w * S.TILE;
      for (let i = 0; i < 140; i++) {
        this.particles.push({
          x: Math.random() * w,
          y: -Math.random() * 60,
          vx: (Math.random() - 0.5) * 30,
          vy: 30 + Math.random() * 50,
          size: Math.random() < 0.3 ? 2 : 1,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        });
      }
      this.hover = null;
      setTimeout(() => this.callbacks.onSolved && this.callbacks.onSolved(), 900);
    }

    frame(t) {
      const dt = Math.min(0.05, (t - this.lastTime) / 1000 || 0);
      this.lastTime = t;
      if (this.state) {
        const h = this.state.h * S.TILE;
        for (const p of this.particles) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.vx *= 0.99;
        }
        this.particles = this.particles.filter(p => p.y < h + 4);
        this.renderer.draw({
          analysis: this.analysis,
          hover: this.solved ? null : this.hover,
          ghost: this.selected ? { type: this.selected, rot: this.rotations[this.selected] } : null,
          particles: this.particles,
          time: t / 1000,
        });
      }
      requestAnimationFrame(tt => this.frame(tt));
    }
  }

  TG.BuildScreen = BuildScreen;
  TG.ui = { nameEl };
})(globalThis.TG = globalThis.TG || {});
