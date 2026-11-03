/*
 * Start-up: wires the screens to the page, level picker and dialogs.
 *
 * Levels: the hand-made puzzles come first (a gentle introduction); after
 * those, "Nieuwe puzzel" generates puzzles that match the player's puzzle
 * level (TG.generator + TG.progress). The current generated puzzle is kept
 * (level + seed) so a reload shows the same one.
 */
(function (TG) {
  'use strict';

  const i18n = TG.i18n;
  const $ = id => document.getElementById(id);
  const LEVEL_KEY = 'treinspel.level';
  const GEN_KEY = 'treinspel.generated';
  const GEN_INDEX = TG.LEVELS.length; // level select value for generated puzzles

  function load(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
  }
  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  let levelIndex = 0;
  const savedIndex = load(LEVEL_KEY);
  if (Number.isInteger(savedIndex) && savedIndex >= 0 && savedIndex <= GEN_INDEX) levelIndex = savedIndex;
  let generated = load(GEN_KEY); // { level, seed }
  if (!generated || !Number.isInteger(generated.level) || !Number.isInteger(generated.seed)) generated = null;

  const build = new TG.BuildScreen({
    stage: $('stage'),
    canvas: $('game'),
    labels: $('labels'),
    task: $('task-text'),
    stations: $('station-list'),
    inventory: $('inventory'),
    help: $('help'),
  }, { onSolved: puzzleSolved });

  const drive = new TG.DriveScreen({
    stage: $('drive-stage'),
    board: $('drive-board'),
    canvas: $('side'),
    signs: $('signs'),
    orders: $('orders'),
    messages: $('messages'),
    minimap: $('minimap'),
    status: $('drive-status'),
    load: $('load'),
    whereTo: $('whereto-heading'),
    destinations: $('destinations'),
    roundDone: $('round-done'),
    roundTitle: $('round-title'),
    roundStars: $('round-stars'),
    roundText: $('round-text'),
    btnNewRound: $('btn-new-round'),
  }, { onStars: refreshStars });

  // Handy for debugging and automated browser tests
  TG.app = { build, drive };

  /** Load a level; for generated puzzles `fresh` makes a new one at the current puzzle level. */
  function loadLevel(i, fresh) {
    levelIndex = i;
    store(LEVEL_KEY, i);
    let def;
    if (i === GEN_INDEX) {
      if (fresh || !generated) {
        generated = { level: TG.progress.level('puzzle'), seed: Math.floor(Math.random() * 1e9) };
        store(GEN_KEY, generated);
      }
      def = TG.generator.generate(generated.level, generated.seed);
    } else {
      def = TG.LEVELS[i];
    }
    hideDone();
    showBuild();
    build.load(def);
    refreshTexts();
  }

  /** After the hand-made puzzles, every next puzzle is a newly generated one. */
  function nextLevel() {
    if (levelIndex < GEN_INDEX - 1) loadLevel(levelIndex + 1);
    else loadLevel(GEN_INDEX, true);
  }

  function puzzleSolved(result) {
    const stars = TG.progress.puzzleStars(result.removals, result.pieces);
    const before = TG.progress.level('puzzle');
    const after = TG.progress.record('puzzle', stars);
    $('done-stars').textContent = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    $('done-stars').setAttribute('aria-label', stars + ' / 3');
    $('done-text').textContent = i18n.t('doneText') + (after > before && TG.settings.get().adaptive ? ' ' + i18n.t('levelUp') : '');
    refreshStars();
    showDone();
  }

  function refreshStars() {
    const n = TG.progress.get().totalStars;
    $('star-count').textContent = '★ ' + n;
    $('star-count').title = n + ' ' + i18n.t('stars');
  }

  function showBuild() {
    drive.close();
    $('screen-drive').hidden = true;
    $('screen-build').hidden = false;
    build.setActive(true);
    build.layout();
  }

  function showDrive() {
    hideDone();
    build.setActive(false);
    $('screen-build').hidden = true;
    $('screen-drive').hidden = false;
    drive.open(build.state, build.analysis, build.def);
    refreshTexts();
  }

  function refreshTexts() {
    document.documentElement.lang = i18n.getLang();
    document.title = i18n.t('gameTitle');
    $('title').textContent = i18n.t('gameTitle');
    $('pieces-heading').textContent = i18n.t('pieces');
    $('btn-reset').textContent = i18n.t('reset');
    $('btn-lang').textContent = i18n.t('language');
    $('btn-settings').setAttribute('aria-label', i18n.t('settings'));
    $('btn-settings').title = i18n.t('settings');
    $('done-title').textContent = i18n.t('doneTitle');
    $('btn-again').textContent = i18n.t('again');
    $('btn-next').textContent = i18n.t('next');
    $('btn-drive').textContent = i18n.t('drive');
    $('btn-drive-panel').textContent = i18n.t('drive');
    $('btn-drive-panel').hidden = !build.solved;
    $('btn-map').textContent = i18n.t('backToMap');
    $('btn-next-drive').textContent = i18n.t('next');

    $('btn-new-round').textContent = i18n.t('newRound');
    $('btn-round-next').textContent = i18n.t('next');

    $('btn-round-map').textContent = i18n.t('backToMap');
    refreshStars();

    const sel = $('level-select');
    sel.textContent = '';
    TG.LEVELS.forEach((l, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = i18n.t('level') + ' ' + (i + 1);
      sel.append(o);
    });
    const gen = document.createElement('option');
    gen.value = String(GEN_INDEX);
    gen.textContent = i18n.t('newPuzzle') + ' (' + i18n.t('levelOf', { n: TG.progress.level('puzzle') }) + ')';
    sel.append(gen);
    sel.value = String(levelIndex);
  }

  function showDone() {
    const text = $('done-text').textContent;
    refreshTexts();
    $('done-text').textContent = text;
    $('done').hidden = false;
    $('btn-drive').focus();
  }

  function hideDone() {
    $('done').hidden = true;
  }

  $('level-select').addEventListener('change', e => {
    const i = parseInt(e.target.value, 10);
    loadLevel(i, i === GEN_INDEX);
    e.target.blur();
  });
  $('btn-reset').addEventListener('click', () => loadLevel(levelIndex));
  $('btn-again').addEventListener('click', () => loadLevel(levelIndex));
  $('btn-next').addEventListener('click', nextLevel);
  $('btn-next-drive').addEventListener('click', nextLevel);
  $('btn-drive').addEventListener('click', showDrive);
  $('btn-drive-panel').addEventListener('click', showDrive);
  $('btn-map').addEventListener('click', () => { showBuild(); refreshTexts(); });
  $('btn-round-map').addEventListener('click', () => { showBuild(); refreshTexts(); });
  $('btn-round-next').addEventListener('click', nextLevel);
  $('btn-new-round').addEventListener('click', () => drive.newRound());
  $('btn-lang').addEventListener('click', () => {
    i18n.setLang(i18n.getLang() === 'nl' ? 'en' : 'nl');
    build.buildLabels();
    build.refreshPanel();
    build.layout();
    drive.refreshTexts();
    refreshTexts();
  });

  // ------------------------------------------------------------ parent settings

  const SKILL_LABELS = {
    count: 'skillCount', add: 'skillAdd', subtract: 'skillSubtract', multiply: 'skillMultiply',
    divide: 'skillDivide', puzzle: 'skillPuzzle',
  };

  function checkbox(name, value, checked, text) {
    const label = document.createElement('label');
    label.className = 'choice';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = name;
    input.value = value;
    input.checked = checked;
    label.append(input, document.createTextNode(' ' + text));
    return label;
  }

  /** Level and recent results per skill, for parents. */
  function renderProgress() {
    const p = TG.progress.get();
    const table = $('progress-table');
    table.textContent = '';
    for (const k of TG.progress.SKILLS) {
      const sk = p.skills[k];
      const row = document.createElement('div');
      row.className = 'progress-row';
      const name = document.createElement('span');
      name.className = 'progress-name';
      name.textContent = i18n.t(SKILL_LABELS[k]).replace(/ \(.*\)$/, '');
      const bar = document.createElement('span');
      bar.className = 'level-bar';
      bar.title = i18n.t('levelOf', { n: sk.level });
      for (let l = 1; l <= TG.progress.MAX_LEVEL; l++) {
        const seg = document.createElement('span');
        if (l <= sk.level) seg.className = 'on';
        bar.append(seg);
      }
      const lvl = document.createElement('span');
      lvl.className = 'progress-level';
      lvl.textContent = sk.level;
      const hist = document.createElement('span');
      hist.className = 'progress-history';
      hist.textContent = sk.history.length ? sk.history.map(n => '★'.repeat(n)).join(' · ') : i18n.t('notPlayed');
      row.append(name, bar, lvl, hist);
      table.append(row);
    }
    $('progress-totals').textContent = i18n.t('totals', { r: p.rounds, p: p.puzzles, s: p.totalStars });
  }

  function openSettings() {
    const cur = TG.settings.get();
    $('settings-title').textContent = i18n.t('settings');
    $('settings-intro').textContent = i18n.t('settingsIntro');
    $('max-legend').textContent = i18n.t('maxNumber');
    $('skills-legend').textContent = i18n.t('skills');
    $('difficulty-legend').textContent = i18n.t('difficulty');
    $('progress-legend').textContent = i18n.t('progressTitle');
    $('btn-reset-progress').textContent = i18n.t('resetProgress');
    const diff = $('difficulty-options');
    diff.textContent = '';
    diff.append(checkbox('adaptive', '1', cur.adaptive, i18n.t('adaptive')));
    diff.append(checkbox('manualUnload', '1', cur.manualUnload, i18n.t('manualUnload')));
    renderProgress();
    $('btn-settings-save').textContent = i18n.t('save');
    $('btn-settings-cancel').textContent = i18n.t('cancel');
    const maxBox = $('max-options');
    maxBox.textContent = '';
    for (const n of TG.settings.MAX_OPTIONS) {
      const label = document.createElement('label');
      label.className = 'choice';
      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'max';
      input.value = String(n);
      input.checked = cur.maxNumber === n;
      label.append(input, document.createTextNode(' ' + n));
      maxBox.append(label);
    }
    const skillBox = $('skill-options');
    skillBox.textContent = '';
    for (const k of TG.settings.SKILLS) skillBox.append(checkbox('skill', k, cur.skills[k], i18n.t(SKILL_LABELS[k])));
    $('settings').hidden = false;
  }

  $('btn-settings').addEventListener('click', openSettings);
  $('btn-settings-cancel').addEventListener('click', () => { $('settings').hidden = true; });
  $('settings-form').addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    const skills = {};
    for (const k of TG.settings.SKILLS) skills[k] = false;
    for (const input of form.querySelectorAll('input[name=skill]')) skills[input.value] = input.checked;
    const max = form.querySelector('input[name=max]:checked');
    TG.settings.set({
      maxNumber: max ? parseInt(max.value, 10) : 20,
      skills,
      adaptive: form.querySelector('input[name=adaptive]').checked,
      manualUnload: form.querySelector('input[name=manualUnload]').checked,
    });
    $('settings').hidden = true;
  });
  $('btn-reset-progress').addEventListener('click', () => {
    if (!window.confirm(i18n.t('confirmReset'))) return;
    TG.progress.reset();
    renderProgress();
    refreshTexts();
  });

  // Fonts change the panel width; lay out again once they are ready.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => (drive.active ? drive.layout() : build.layout()));
  }

  loadLevel(levelIndex);
})(globalThis.TG = globalThis.TG || {});
