/*
 * Texts. UI strings appear in the chosen language. Names (stations, pieces,
 * later goods) are always shown in both languages: see TG.i18n.name().
 */
(function (TG) {
  'use strict';

  const UI = {
    gameTitle:       { nl: 'Treinspel', en: 'Train Game' },
    level:           { nl: 'Puzzel', en: 'Puzzle' },
    taskBuild:       { nl: 'Leg rails van de start naar alle stations.', en: 'Lay track from the start to every station.' },
    start:           { nl: 'start', en: 'start' },
    pieces:          { nl: 'Rails', en: 'Track' },
    reset:           { nl: 'Opnieuw', en: 'Start over' },
    helpPlace:       { nl: 'Klik op het gras: rails leggen', en: 'Click the grass: lay track' },
    helpRotate:      { nl: 'R of scrollen: draaien', en: 'R or scroll: rotate' },
    helpRotatePlaced:{ nl: 'Klik op rails: draaien', en: 'Click track: rotate' },
    helpRemove:      { nl: 'Rechtsklik: weghalen', en: 'Right click: remove' },
    doneTitle:       { nl: 'Goed gedaan!', en: 'Well done!' },
    doneText:        { nl: 'Alle stations zijn verbonden.', en: 'All stations are connected.' },
    next:            { nl: 'Volgende puzzel', en: 'Next puzzle' },
    again:           { nl: 'Nog een keer', en: 'Play again' },
    lastLevel:       { nl: 'Dit was de laatste puzzel. De treinen komen er snel aan!', en: 'That was the last puzzle. The trains are coming soon!' },
    language:        { nl: 'English', en: 'Nederlands' },
  };

  const NAMES = {
    // Pieces
    straight:  { nl: 'Recht', en: 'Straight' },
    curve:     { nl: 'Bocht', en: 'Curve' },
    junction:  { nl: 'Splitsing', en: 'Junction' },
  };

  const STORAGE_KEY = 'treinspel.lang';
  let lang = 'nl';
  try {
    const saved = globalThis.localStorage && localStorage.getItem(STORAGE_KEY);
    if (saved === 'nl' || saved === 'en') lang = saved;
  } catch (e) { /* storage unavailable: keep default */ }

  function setLang(l) {
    lang = l;
    try { localStorage.setItem(STORAGE_KEY, l); } catch (e) { /* ignore */ }
  }

  function getLang() {
    return lang;
  }

  function other() {
    return lang === 'nl' ? 'en' : 'nl';
  }

  /** UI string in the current language. */
  function t(key) {
    const s = UI[key];
    return s ? s[lang] : key;
  }

  /** A bilingual name: { main, second } in the current/other language. */
  function name(entry) {
    const e = typeof entry === 'string' ? (NAMES[entry] || TG.themes.stationKind(entry).name) : entry;
    return { main: e[lang], second: e[other()] };
  }

  TG.i18n = { UI, NAMES, t, name, setLang, getLang };
})(globalThis.TG = globalThis.TG || {});
