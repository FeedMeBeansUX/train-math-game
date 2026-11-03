/* Start-up: wires the screens to the page, level picker and dialogs. */
(function (TG) {
  'use strict';

  const i18n = TG.i18n;
  const $ = id => document.getElementById(id);
  const LEVEL_KEY = 'treinspel.level';

  let levelIndex = 0;
  try {
    const saved = parseInt(localStorage.getItem(LEVEL_KEY), 10);
    if (saved >= 0 && saved < TG.LEVELS.length) levelIndex = saved;
  } catch (e) { /* storage unavailable */ }

  const build = new TG.BuildScreen({
    stage: $('stage'),
    canvas: $('game'),
    labels: $('labels'),
    task: $('task-text'),
    stations: $('station-list'),
    inventory: $('inventory'),
    help: $('help'),
  }, { onSolved: showDone });

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
  });

  // Handy for debugging and automated browser tests
  TG.app = { build, drive };

  function isLast() {
    return levelIndex === TG.LEVELS.length - 1;
  }

  function loadLevel(i) {
    levelIndex = i;
    try { localStorage.setItem(LEVEL_KEY, String(i)); } catch (e) { /* ignore */ }
    hideDone();
    showBuild();
    build.load(TG.LEVELS[i]);
    refreshTexts();
  }

  function nextLevel() {
    loadLevel(Math.min(levelIndex + 1, TG.LEVELS.length - 1));
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
    $('btn-next-drive').hidden = isLast();
    $('btn-new-round').textContent = i18n.t('newRound');
    $('btn-round-next').textContent = i18n.t('next');
    $('btn-round-next').hidden = isLast();
    $('btn-round-map').textContent = i18n.t('backToMap');
    $('done-text').textContent = i18n.t('doneText') + (isLast() ? ' ' + i18n.t('lastLevel') : '');
    $('btn-next').hidden = isLast();

    const sel = $('level-select');
    sel.textContent = '';
    TG.LEVELS.forEach((l, i) => {
      const o = document.createElement('option');
      o.value = String(i);
      o.textContent = i18n.t('level') + ' ' + (i + 1);
      sel.append(o);
    });
    sel.value = String(levelIndex);
  }

  function showDone() {
    refreshTexts();
    $('done').hidden = false;
    $('btn-drive').focus();
  }

  function hideDone() {
    $('done').hidden = true;
  }

  $('level-select').addEventListener('change', e => {
    loadLevel(parseInt(e.target.value, 10));
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

  const SKILL_LABELS = { count: 'skillCount', add: 'skillAdd', subtract: 'skillSubtract', multiply: 'skillMultiply' };

  function openSettings() {
    const cur = TG.settings.get();
    $('settings-title').textContent = i18n.t('settings');
    $('settings-intro').textContent = i18n.t('settingsIntro');
    $('max-legend').textContent = i18n.t('maxNumber');
    $('skills-legend').textContent = i18n.t('skills');
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
    for (const k of TG.settings.SKILLS) {
      const label = document.createElement('label');
      label.className = 'choice';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = 'skill';
      input.value = k;
      input.checked = cur.skills[k];
      label.append(input, document.createTextNode(' ' + i18n.t(SKILL_LABELS[k])));
      skillBox.append(label);
    }
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
    TG.settings.set({ maxNumber: max ? parseInt(max.value, 10) : 20, skills });
    $('settings').hidden = true;
  });

  // Fonts change the panel width; lay out again once they are ready.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => (drive.active ? drive.layout() : build.layout()));
  }

  loadLevel(levelIndex);
})(globalThis.TG = globalThis.TG || {});
