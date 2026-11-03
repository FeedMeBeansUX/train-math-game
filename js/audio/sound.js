/*
 * Sound effects, synthesised with the Web Audio API (no audio files, so the
 * game also works offline and from the file system).
 *
 * TG.sound.play(name) plays one effect; unknown names are ignored. Browsers
 * only allow sound after the player has clicked or pressed a key, so the
 * audio context is created on the first interaction. The on/off choice is
 * saved in the browser.
 */
(function (TG) {
  'use strict';

  const KEY = 'treinspel.sound';
  let enabled = true;
  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) { /* default on */ }

  let ctx = null, master = null, noiseBuf = null;

  function audio() {
    if (ctx) return ctx;
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.45;
    master.connect(ctx.destination);
    // One second of white noise, reused for steam and clicks
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  // Unlock audio on the first user gesture
  function unlock() {
    const a = audio();
    if (a && a.state === 'suspended') a.resume();
  }
  if (globalThis.addEventListener) {
    for (const ev of ['pointerdown', 'keydown']) globalThis.addEventListener(ev, unlock, { capture: true });
  }

  /** A tone with an attack/release envelope; optional pitch slide to `to`. */
  function tone(freq, dur, opts) {
    const o = Object.assign({ type: 'sine', gain: 0.3, attack: 0.005, release: 0.08, at: 0, to: null }, opts);
    const t0 = ctx.currentTime + o.at;
    const osc = ctx.createOscillator();
    osc.type = o.type;
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    if (o.vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = o.vibrato;
      lg.gain.value = freq * 0.012;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t0);
      lfo.stop(t0 + dur + o.release);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain, t0 + o.attack);
    g.gain.setValueAtTime(o.gain, t0 + Math.max(o.attack, dur - o.release));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + o.release);
    let node = osc;
    if (o.lowpass) {
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lowpass;
      osc.connect(f);
      node = f;
    }
    node.connect(g);
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + o.release + 0.02);
  }

  /** Filtered noise burst (steam, clicks, hiss). */
  function noise(dur, opts) {
    const o = Object.assign({ type: 'bandpass', freq: 1000, q: 1, gain: 0.3, attack: 0.005, at: 0 }, opts);
    const t0 = ctx.currentTime + o.at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type;
    f.frequency.setValueAtTime(o.freq, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.gain, t0 + o.attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(master);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.02);
  }

  const NOTE = n => 440 * Math.pow(2, (n - 69) / 12); // MIDI note number -> Hz

  const EFFECTS = {
    // Building track
    place() {
      noise(0.05, { freq: 2200, q: 2, gain: 0.25 });
      tone(200, 0.05, { type: 'square', gain: 0.08, to: 110, lowpass: 900 });
    },
    rotate() { tone(900, 0.025, { type: 'triangle', gain: 0.12 }); },
    remove() { tone(320, 0.08, { gain: 0.18, to: 150 }); },
    bad() {
      tone(180, 0.09, { type: 'square', gain: 0.06, lowpass: 700 });
      tone(140, 0.12, { type: 'square', gain: 0.06, lowpass: 700, at: 0.11 });
    },
    connect() {
      tone(NOTE(84), 0.05, { gain: 0.18, release: 0.5 });
      tone(NOTE(88), 0.05, { gain: 0.12, release: 0.5, at: 0.04 });
    },
    // Train
    whistle() {
      // A steam whistle: a chord of three pipes with a breathy start
      for (const [f, g] of [[523, 0.07], [659, 0.06], [784, 0.05]]) {
        tone(f * 0.94, 0.9, { type: 'sawtooth', gain: g, attack: 0.06, release: 0.25, to: f, lowpass: 2600, vibrato: 6 });
      }
      noise(1.0, { freq: 2400, q: 0.8, gain: 0.06, attack: 0.04 });
    },
    chuff(opts) {
      const s = (opts && opts.strength) || 1;
      noise(0.14, { type: 'lowpass', freq: 900 * s, to: 300, gain: 0.16 * s, attack: 0.008 });
    },
    hiss() { noise(0.7, { type: 'highpass', freq: 3500, gain: 0.08, attack: 0.05 }); },
    // Goods
    load() { tone(600, 0.06, { gain: 0.14, to: 950 }); },
    unload() { tone(760, 0.07, { gain: 0.13, to: 420 }); },
    pop() { tone(880, 0.03, { type: 'triangle', gain: 0.08, to: 1200 }); },
    deliver() {
      tone(NOTE(79), 0.08, { type: 'triangle', gain: 0.16, release: 0.3 });
      tone(NOTE(84), 0.1, { type: 'triangle', gain: 0.16, release: 0.45, at: 0.1 });
    },
    mistake() {
      tone(NOTE(67), 0.14, { gain: 0.15, release: 0.12 });
      tone(NOTE(62), 0.2, { gain: 0.15, release: 0.2, at: 0.16 });
    },
    // Rewards
    star(opts) {
      const i = (opts && opts.index) || 0;
      const n = [84, 88, 91][i % 3];
      tone(NOTE(n), 0.06, { type: 'triangle', gain: 0.18, release: 0.5 });
      tone(NOTE(n + 12), 0.05, { gain: 0.06, release: 0.4 });
    },
    solved() {
      [72, 76, 79, 84].forEach((n, i) => tone(NOTE(n), 0.12, { type: 'triangle', gain: 0.16, release: 0.15, at: i * 0.11 }));
      for (const n of [72, 76, 79, 84]) tone(NOTE(n), 0.5, { type: 'triangle', gain: 0.07, release: 0.5, at: 0.48 });
    },
    levelup() {
      [67, 71, 74, 79, 83, 86].forEach((n, i) => tone(NOTE(n), 0.07, { type: 'square', gain: 0.05, release: 0.1, lowpass: 3000, at: i * 0.06 }));
    },
    unlock() {
      [72, 79, 84, 88, 91, 96].forEach((n, i) => tone(NOTE(n), 0.1, { type: 'triangle', gain: 0.14, release: 0.4, at: i * 0.09 }));
      noise(0.8, { type: 'highpass', freq: 6000, gain: 0.03, at: 0.3 });
    },
    click() { tone(1400, 0.015, { type: 'triangle', gain: 0.05 }); },
  };

  function play(name, opts) {
    if (!enabled || !EFFECTS[name]) return;
    const a = audio();
    if (!a || a.state !== 'running') return;
    try { EFFECTS[name](opts); } catch (e) { /* never let sound break the game */ }
  }

  /** Play a short star sequence: one ding per star, `gap` seconds apart. */
  function stars(n, gap) {
    for (let i = 0; i < n; i++) setTimeout(() => play('star', { index: i }), 250 + i * (gap || 350));
  }

  function setEnabled(on) {
    enabled = on;
    try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) { /* ignore */ }
  }

  TG.sound = { play, stars, setEnabled, isEnabled: () => enabled, EFFECTS };
})(globalThis.TG = globalThis.TG || {});
