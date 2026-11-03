/*
 * Parent settings: the highest number used, which maths skills are on, whether
 * difficulty adapts automatically and whether goods are unloaded by hand.
 * Saved in the browser (localStorage) when available.
 */
(function (TG) {
  'use strict';

  const KEY = 'treinspel.settings';
  const MAX_OPTIONS = [10, 20, 50, 100];
  const SKILLS = ['count', 'add', 'subtract', 'multiply', 'divide'];
  const DEFAULTS = {
    maxNumber: 20,
    skills: { count: true, add: true, subtract: true, multiply: false, divide: false },
    adaptive: true,       // levels follow the player's results (TG.progress)
    manualUnload: false,  // the player decides how many goods come off at each station
  };

  /** Make any (possibly old or broken) settings object valid. */
  function normalize(s) {
    const out = {
      maxNumber: DEFAULTS.maxNumber,
      skills: Object.assign({}, DEFAULTS.skills),
      adaptive: DEFAULTS.adaptive,
      manualUnload: DEFAULTS.manualUnload,
    };
    if (s && MAX_OPTIONS.includes(s.maxNumber)) out.maxNumber = s.maxNumber;
    if (s && s.skills) for (const k of SKILLS) if (typeof s.skills[k] === 'boolean') out.skills[k] = s.skills[k];
    if (s && typeof s.adaptive === 'boolean') out.adaptive = s.adaptive;
    if (s && typeof s.manualUnload === 'boolean') out.manualUnload = s.manualUnload;
    if (!SKILLS.some(k => out.skills[k])) out.skills.count = true; // at least one skill
    return out;
  }

  let current = null;

  function get() {
    if (!current) {
      let saved = null;
      try { saved = JSON.parse(globalThis.localStorage.getItem(KEY)); } catch (e) { /* none */ }
      current = normalize(saved);
    }
    return current;
  }

  function set(s) {
    current = normalize(s);
    try { globalThis.localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) { /* ignore */ }
    return current;
  }

  TG.settings = { KEY, MAX_OPTIONS, SKILLS, DEFAULTS, normalize, get, set };
})(globalThis.TG = globalThis.TG || {});
