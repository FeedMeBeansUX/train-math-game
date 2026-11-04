/*
 * Progress and adaptive difficulty.
 *
 * Every skill (the maths skills and "puzzle") has a level from 1 to MAX_LEVEL.
 * After each round the result (1-3 stars) moves the level with a simple
 * staircase: two 3-star results in a row -> one level up; a 1-star result ->
 * one level down; 2 stars -> stay. The maths engine and the puzzle generator
 * read the levels; parents see them in the settings dialog.
 */
(function (TG) {
  'use strict';

  const KEY = 'treinspel.progress';
  const SKILLS = ['count', 'add', 'subtract', 'multiply', 'divide', 'puzzle'];
  const MAX_LEVEL = 8;
  const HISTORY = 10;

  /** Highest number used per level (index = level - 1), before the parent's maximum is applied. */
  const RANGES = {
    count:    [15, 15, 18, 20, 20, 20, 20, 20],
    add:      [15, 15, 18, 20, 20, 25, 30, 30],
    subtract: [15, 15, 18, 20, 20, 25, 30, 30],
    multiply: [10, 15, 20, 25, 30, 40, 50, 50],
    divide:   [12, 12, 15, 16, 20, 24, 30, 30],
  };

  function freshSkill() {
    return { level: 1, streak: 0, history: [] };
  }

  function fresh() {
    const skills = {};
    for (const s of SKILLS) skills[s] = freshSkill();
    return { version: 1, skills, totalStars: 0, rounds: 0, puzzles: 0, themesSeen: ['farm'] };
  }

  function normalize(p) {
    const out = fresh();
    if (!p || typeof p !== 'object') return out;
    for (const s of SKILLS) {
      const k = p.skills && p.skills[s];
      if (!k) continue;
      out.skills[s] = {
        level: Math.max(1, Math.min(MAX_LEVEL, k.level | 0 || 1)),
        streak: Math.max(0, k.streak | 0),
        history: Array.isArray(k.history) ? k.history.filter(n => n >= 1 && n <= 3).slice(-HISTORY) : [],
      };
    }
    for (const f of ['totalStars', 'rounds', 'puzzles']) out[f] = Math.max(0, p[f] | 0);
    if (Array.isArray(p.themesSeen)) out.themesSeen = Array.from(new Set(['farm', ...p.themesSeen.filter(t => typeof t === 'string')]));
    return out;
  }

  /** The staircase: returns the skill state after a result of `stars`. Pure. */
  function applyResult(skill, stars) {
    const s = { level: skill.level, streak: skill.streak, history: skill.history.concat([stars]).slice(-HISTORY) };
    if (stars >= 3) {
      s.streak++;
      if (s.streak >= 2) {
        s.level = Math.min(MAX_LEVEL, s.level + 1);
        s.streak = 0;
      }
    } else if (stars <= 1) {
      s.level = Math.max(1, s.level - 1);
      s.streak = 0;
    } else {
      s.streak = 0;
    }
    return s;
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

  function save() {
    try { globalThis.localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) { /* ignore */ }
  }

  /** Record a finished round or puzzle. Returns the skill's new level. */
  function record(skill, stars) {
    const p = get();
    p.skills[skill] = applyResult(p.skills[skill], stars);
    p.totalStars += stars;
    if (skill === 'puzzle') p.puzzles++;
    else p.rounds++;
    save();
    return p.skills[skill].level;
  }

  function level(skill) {
    return get().skills[skill].level;
  }

  /** Highest number to use for a maths skill: the level's range, capped by the parent's maximum. */
  function limit(skill, settings) {
    if (!settings.adaptive || !RANGES[skill]) return settings.maxNumber;
    return Math.min(settings.maxNumber, RANGES[skill][level(skill) - 1]);
  }

  /**
   * Stars for a solved puzzle from the number of pieces taken back: a few corrections are fine
   * (about 1 in 10 pieces for 3 stars, 4 in 10 for 2 stars).
   */
  function puzzleStars(removals, pieces) {
    if (removals <= Math.max(1, Math.round(pieces * 0.1))) return 3;
    if (removals <= Math.max(3, Math.round(pieces * 0.4))) return 2;
    return 1;
  }

  /**
   * Themes that just became available (enough stars) and were not announced yet.
   * Marks them as announced.
   */
  function newlyUnlocked() {
    const p = get();
    const fresh = TG.themes.unlocked(p.totalStars).filter(t => !p.themesSeen.includes(t));
    if (fresh.length) {
      p.themesSeen.push(...fresh);
      save();
    }
    return fresh;
  }

  function reset() {
    current = fresh();
    save();
  }

  /** For tests: use this state instead of the saved one. */
  function use(p) {
    current = normalize(p);
  }

  TG.progress = {
    KEY, SKILLS, MAX_LEVEL, RANGES, fresh, normalize, applyResult, puzzleStars, get, record, level, limit,
    newlyUnlocked, reset, use,
  };
})(globalThis.TG = globalThis.TG || {});
