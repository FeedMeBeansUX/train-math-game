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
    helpBridge:      { nl: 'Een brug leg je over water, een weg of de racebaan', en: 'Bridges go over water, roads or the race track' },
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
    // Division and unloading by hand
    orderLineNoNumber: { nl: 'Breng {goods} naar {s}.', en: 'Bring {goods} to {s}.' },
    divideNote:      { nl: 'Verdeel {total} {goods} eerlijk over {k} stations.', en: 'Share {total} {goods} fairly between {k} stations.' },
    askUnload:       { nl: 'Hoeveel {goods} gaan eruit?', en: 'How many {goods} come off?' },
    unload:          { nl: 'Uitladen', en: 'Unload' },
    tooMany:         { nl: 'Dat zijn er te veel.', en: 'That is too many.' },
    tooFew:          { nl: 'Dat zijn er te weinig.', en: 'That is too few.' },
    fairHint:        { nl: 'Elk station krijgt evenveel.', en: 'Every station gets the same amount.' },
    // Progress
    levelUp:         { nl: 'Knap! Je gaat een niveau omhoog.', en: 'Great! You go up a level.' },
    newPuzzle:       { nl: 'Nieuwe puzzel', en: 'New puzzle' },
    stars:           { nl: 'sterren', en: 'stars' },
    // Themes
    newPuzzleTheme:  { nl: 'Nieuwe puzzel: {t}', en: 'New puzzle: {t}' },
    lockedTheme:     { nl: '{t}: nog {n} sterren', en: '{t}: {n} more stars' },
    lockedThemeOne:  { nl: '{t}: nog {n} ster', en: '{t}: {n} more star' },
    unlockTitle:     { nl: 'Nieuw thema!', en: 'New theme!' },
    unlockText:      { nl: 'Je kunt nu spelen in: {t}', en: 'You can now play: {t}' },
    playNow:         { nl: 'Speel nu', en: 'Play now' },
    later:           { nl: 'Later', en: 'Later' },
    // The sum above the train
    qLoad:           { nl: 'Hoeveel {goods} laad je in?', en: 'How many {goods} do you load?' },
    qTakeOut:        { nl: 'Hoeveel {goods} haal je eruit?', en: 'How many {goods} do you take out?' },
    qMore:           { nl: 'Er zitten al {n} {goods} in de trein. Hoeveel {goods2} doe je erbij?', en: 'There are already {n} {goods} on the train. How many more {goods2} do you add?' },
    qLess:           { nl: 'Er zitten {n} {goods} in de trein. Dat zijn er te veel. Hoeveel haal je eruit?', en: 'There are {n} {goods} on the train. That is too many. How many do you take out?' },
    qStationMore:    { nl: '{s} heeft er al {n}. Hoeveel {goods2} komen er nog bij?', en: '{s} already has {n}. How many more {goods2}?' },
    qStationLess:    { nl: '{s} heeft er {n}. Dat zijn er te veel. Hoeveel gaan er terug in de trein?', en: '{s} has {n}. That is too many. How many go back on the train?' },
    wagonsTooFew:    { nl: 'Dat zijn te weinig wagons. Probeer het nog eens.', en: 'Those are too few carriages. Try again.' },
    wagonsTooMany:   { nl: 'Dat zijn te veel wagons. Probeer het nog eens.', en: 'Those are too many carriages. Try again.' },
    loadedOk:        { nl: 'Goed zo! Er zitten {n} {goods} in de trein.', en: 'Well done! There are {n} {goods} on the train.' },
    allLoaded:       { nl: 'Alles zit in de trein! Waar gaat de trein heen?', en: 'Everything is on the train! Where should it go?' },
    notThatMany:     { nl: 'Zoveel {goods} zitten er niet in de trein. Probeer het nog eens.', en: 'There are not that many {goods} on the train. Try again.' },
    notThatManyHere: { nl: 'Zoveel {goods} staan er niet op het perron. Probeer het nog eens.', en: 'There are not that many {goods} on the platform. Try again.' },
    solveFirst:      { nl: 'Los eerst de som op.', en: 'Solve the sum first.' },
    fixesOne:        { nl: 'Je moest {k} keer verbeteren.', en: 'You had to fix it {k} time.' },
    fixesMany:       { nl: 'Je moest {k} keer verbeteren.', en: 'You had to fix it {k} times.' },
    // Switches and ordered deliveries
    switchesTitle:   { nl: 'Wissels', en: 'Switches' },
    switchHint:      { nl: 'Klik op een wissel om hem om te zetten.', en: 'Click a switch to change it.' },
    goesTo:          { nl: 'De trein gaat naar {s}.', en: 'The train will go to {s}.' },
    switchWrong:     { nl: 'Een wissel staat verkeerd.', en: 'A switch is set the wrong way.' },
    depart:          { nl: 'Vertrek!', en: 'Depart!' },
    notYet:          { nl: 'Eerst naar {s}!', en: 'First go to {s}!' },
    orderedNote:     { nl: 'Doe de opdrachten op volgorde.', en: 'Do the orders in order.' },
    wrongStationOne: { nl: 'Je was {k} keer te vroeg bij een station.', en: 'You were at a station too early {k} time.' },
    wrongStationMany:{ nl: 'Je was {k} keer te vroeg bij een station.', en: 'You were at a station too early {k} times.' },
    switchesSetting: { nl: 'Wissels zelf zetten (in plaats van een station kiezen)', en: 'Set the switches yourself (instead of choosing a station)' },
    orderedSetting:  { nl: 'Opdrachten op volgorde', en: 'Orders in a fixed order' },
    // Settings (for parents)
    settings:        { nl: 'Instellingen', en: 'Settings' },
    settingsIntro:   { nl: 'Voor ouders. Geldt vanaf de volgende ronde.', en: 'For parents. Applies from the next round.' },
    maxNumber:       { nl: 'Grootste getal', en: 'Largest number' },
    skills:          { nl: 'Rekenen', en: 'Maths' },
    skillCount:      { nl: 'Tellen', en: 'Counting' },
    skillAdd:        { nl: 'Optellen', en: 'Addition' },
    skillSubtract:   { nl: 'Aftrekken', en: 'Subtraction' },
    skillMultiply:   { nl: 'Keersommen (passagiers in wagons)', en: 'Multiplication (passengers in carriages)' },
    skillDivide:     { nl: 'Delen (eerlijk verdelen, zelf uitladen)', en: 'Division (share fairly, unload by hand)' },
    skillPuzzle:     { nl: 'Puzzels', en: 'Puzzles' },
    difficulty:      { nl: 'Moeilijkheid', en: 'Difficulty' },
    adaptive:        { nl: 'Automatisch aanpassen aan wat mijn kind kan', en: "Adapt automatically to my child's level" },
    manualUnload:    { nl: 'Zelf uitladen bij de stations', en: 'Unload by hand at the stations' },
    progressTitle:   { nl: 'Voortgang', en: 'Progress' },
    levelOf:         { nl: 'niveau {n}', en: 'level {n}' },
    totals:          { nl: '{r} rondes · {p} puzzels · {s} sterren', en: '{r} rounds · {p} puzzles · {s} stars' },
    resetProgress:   { nl: 'Voortgang wissen', en: 'Reset progress' },
    confirmReset:    { nl: 'Alle voortgang en sterren wissen?', en: 'Erase all progress and stars?' },
    notPlayed:       { nl: 'nog niet gespeeld', en: 'not played yet' },
    colorStyle:      { nl: 'Kleurstijl', en: 'Colour style' },
    style_natural:   { nl: 'Natuurlijk', en: 'Natural' },
    style_bright:    { nl: 'Helder', en: 'Bright' },
    style_warm:      { nl: 'Warm', en: 'Warm' },
    style_muted:     { nl: 'Rustig', en: 'Muted' },
    soundOn:         { nl: 'Geluid aan', en: 'Sound on' },
    soundOff:        { nl: 'Geluid uit', en: 'Sound off' },
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
