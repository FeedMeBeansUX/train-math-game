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
    lastLevel:       { nl: 'Dit was de laatste puzzel!', en: 'That was the last puzzle!' },
    language:        { nl: 'English', en: 'Nederlands' },
    drive:           { nl: 'Ga rijden!', en: "Let's drive!" },
    backToMap:       { nl: 'Naar de kaart', en: 'Back to the map' },
    whereTo:         { nl: 'Waar gaat de trein heen?', en: 'Where should the train go?' },
    here:            { nl: 'hier', en: 'here' },
    map:             { nl: 'Kaart', en: 'Map' },
    atStation:       { nl: 'De trein staat bij {s}.', en: 'The train is at {s}.' },
    goingTo:         { nl: 'De trein rijdt naar {s}.', en: 'The train is going to {s}.' },
    arrived:         { nl: 'De trein is bij {s}!', en: 'The train has arrived at {s}!' },
    // Delivery rounds
    orders:          { nl: 'Opdrachten', en: 'Orders' },
    orderLine:       { nl: 'Breng {n} {goods} naar {s}.', en: 'Bring {n} {goods} to {s}.' },
    load:            { nl: 'In de trein', en: 'On the train' },
    loadHint:        { nl: 'Klik op de spullen om ze in de trein te laden.', en: 'Click the goods to load them onto the train.' },
    loadOnlyAtStart: { nl: 'Laden kan alleen bij {s}.', en: 'You can only load at {s}.' },
    trainFull:       { nl: 'De trein is vol!', en: 'The train is full!' },
    trainEmpty:      { nl: 'De trein is leeg.', en: 'The train is empty.' },
    delivered:       { nl: '{n} {goods} afgeleverd!', en: '{n} {goods} delivered!' },
    missingOne:      { nl: 'Er mist nog {m} {goods}.', en: '{m} more {goods} is needed.' },
    missingMany:     { nl: 'Er missen nog {m} {goods}.', en: '{m} more {goods} are needed.' },
    leftOne:         { nl: 'Er zit nog {k} {goods} in de trein.', en: 'There is still {k} {goods} on the train.' },
    leftMany:        { nl: 'Er zitten nog {k} {goods} in de trein.', en: 'There are still {k} {goods} on the train.' },
    nothingHere:     { nl: 'Hier hoeft niets heen.', en: 'Nothing needs to go here.' },
    fetchMore:       { nl: 'Rij terug naar {s} om meer te halen.', en: 'Drive back to {s} to fetch more.' },
    roundDone:       { nl: 'Alle opdrachten gedaan!', en: 'All orders done!' },
    perfect:         { nl: 'Precies goed, alles in één keer!', en: 'Exactly right, all in one go!' },
    tripsOne:        { nl: 'Je moest {k} keer extra naar {s}.', en: 'You had to go back to {s} {k} more time.' },
    tripsMany:       { nl: 'Je moest {k} keer extra naar {s}.', en: 'You had to go back to {s} {k} more times.' },
    newRound:        { nl: 'Nog een ronde', en: 'Another round' },
    // Maths engine notes under the orders
    howManyOnTrain:  { nl: 'Hoeveel {goods} moeten er in de trein?', en: 'How many {goods} go on the train?' },
    alreadyOne:      { nl: 'Er zit al {p} {goods} in de trein.', en: 'There is already {p} {goods} on the train.' },
    alreadyMany:     { nl: 'Er zitten al {p} {goods} in de trein.', en: 'There are already {p} {goods} on the train.' },
    perWagon:        { nl: 'In elke wagon passen {c} passagiers.', en: 'Each carriage holds {c} passengers.' },
    howManyWagons:   { nl: 'Hoeveel wagons heb je nodig?', en: 'How many carriages do you need?' },
    boardedOne:      { nl: '{n} passagier is ingestapt.', en: '{n} passenger got on.' },
    boardedMany:     { nl: '{n} passagiers zijn ingestapt.', en: '{n} passengers got on.' },
    waitingOne:      { nl: 'Er wacht nog {k} passagier.', en: '{k} passenger is still waiting.' },
    waitingMany:     { nl: 'Er wachten nog {k} passagiers.', en: '{k} passengers are still waiting.' },
    emptySeatsOne:   { nl: 'Er was {k} lege plaats.', en: 'There was {k} empty seat.' },
    emptySeatsMany:  { nl: 'Er waren {k} lege plaatsen.', en: 'There were {k} empty seats.' },
    wagons:          { nl: 'Wagons', en: 'Carriages' },
    // Settings (for parents)
    settings:        { nl: 'Instellingen', en: 'Settings' },
    settingsIntro:   { nl: 'Voor ouders. Geldt vanaf de volgende ronde.', en: 'For parents. Applies from the next round.' },
    maxNumber:       { nl: 'Grootste getal', en: 'Largest number' },
    skills:          { nl: 'Rekenen', en: 'Maths' },
    skillCount:      { nl: 'Tellen', en: 'Counting' },
    skillAdd:        { nl: 'Optellen', en: 'Addition' },
    skillSubtract:   { nl: 'Aftrekken', en: 'Subtraction' },
    skillMultiply:   { nl: 'Keersommen (passagiers in wagons)', en: 'Multiplication (passengers in carriages)' },
    save:            { nl: 'Opslaan', en: 'Save' },
    cancel:          { nl: 'Annuleren', en: 'Cancel' },
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

  /**
   * UI string in the current language (or language l); {name} placeholders are
   * filled from vars. A var may be a function of the language, so one set of
   * vars can produce both the Dutch and the English sentence.
   */
  function t(key, vars, l) {
    l = l || lang;
    const s = UI[key];
    let out = s ? s[l] : key;
    if (vars) {
      for (const k in vars) {
        const v = typeof vars[k] === 'function' ? vars[k](l) : vars[k];
        out = out.split('{' + k + '}').join(v);
      }
    }
    return out;
  }

  /** The same sentence in the current and the other language: { main, second }. */
  function both(key, vars) {
    return { main: t(key, vars, lang), second: t(key, vars, other()) };
  }

  /** Station name with article for use in a sentence: "de Boerderij" / "the Farm". */
  function stationPhrase(kind, l) {
    l = l || lang;
    const n = TG.themes.stationKind(kind).name;
    return l === 'nl' ? n.article + ' ' + n.nl : 'the ' + n.en;
  }

  /** Name of a good, singular for 1 and plural otherwise: "kip" / "kippen". */
  function goodsWord(good, n, l) {
    return TG.GOODS[good][l || lang][n === 1 ? 0 : 1];
  }

  /** A bilingual name: { main, second } in the current/other language. */
  function name(entry) {
    const e = typeof entry === 'string' ? (NAMES[entry] || TG.themes.stationKind(entry).name) : entry;
    return { main: e[lang], second: e[other()] };
  }

  TG.i18n = { UI, NAMES, t, both, name, stationPhrase, goodsWord, setLang, getLang, other };
})(globalThis.TG = globalThis.TG || {});
