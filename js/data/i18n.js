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
    helpBridge:      { nl: 'Een brug leg je op het water', en: 'Bridges go on water' },
    helpRotate:      { nl: 'R of scrollen: draaien', en: 'R or scroll: rotate' },
    helpRotatePlaced:{ nl: 'Klik op rails: draaien', en: 'Click track: rotate' },
    helpRemove:      { nl: 'Rechtsklik: weghalen', en: 'Right click: remove' },
    doneTitle:       { nl: 'Goed gedaan!', en: 'Well done!' },
    doneText:        { nl: 'Alle stations zijn verbonden.', en: 'All stations are connected.' },
    next:            { nl: 'Volgende puzzel', en: 'Next puzzle' },
    again:           { nl: 'Nog een keer', en: 'Play again' },
    lastLevel:       { nl: 'Dit was de laatste puzzel. De treinen komen er snel aan!', en: 'That was the last puzzle. The trains are coming soon!' },
    language:        { nl: 'English', en: 'Nederlands' },
    drive:           { nl: 'Ga rijden!', en: "Let's drive!" },
    backToMap:       { nl: 'Naar de kaart', en: 'Back to the map' },
    whereTo:         { nl: 'Waar gaat de trein heen?', en: 'Where should the train go?' },
    here:            { nl: 'hier', en: 'here' },
    map:             { nl: 'Kaart', en: 'Map' },
    atStation:       { nl: 'De trein staat bij {s}.', en: 'The train is at {s}.' },
    goingTo:         { nl: 'De trein rijdt naar {s}.', en: 'The train is going to {s}.' },
    arrived:         { nl: 'De trein is bij {s}!', en: 'The train has arrived at {s}!' },
  };

  const NAMES = {
    // Pieces
    straight:  { nl: 'Recht', en: 'Straight' },
    curve:     { nl: 'Bocht', en: 'Curve' },
    junction:  { nl: 'Splitsing', en: 'Junction' },
    bridge:    { nl: 'Brug', en: 'Bridge' },
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

  /** UI string in the current language; {name} placeholders are filled from vars. */
  function t(key, vars) {
    const s = UI[key];
    let out = s ? s[lang] : key;
    if (vars) for (const k in vars) out = out.split('{' + k + '}').join(vars[k]);
    return out;
  }

  /** Station name with article for use in a sentence: "de Boerderij" / "the Farm". */
  function stationPhrase(kind) {
    const n = TG.themes.stationKind(kind).name;
    return lang === 'nl' ? n.article + ' ' + n.nl : 'the ' + n.en;
  }

  /** A bilingual name: { main, second } in the current/other language. */
  function name(entry) {
    const e = typeof entry === 'string' ? (NAMES[entry] || TG.themes.stationKind(entry).name) : entry;
    return { main: e[lang], second: e[other()] };
  }

  TG.i18n = { UI, NAMES, t, name, stationPhrase, setLang, getLang };
})(globalThis.TG = globalThis.TG || {});
