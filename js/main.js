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
    canvas: $('side'),
    signs: $('signs'),
    minimap: $('minimap'),
    status: $('drive-status'),
    whereTo: $('whereto-heading'),
    mapHeading: $('map-heading'),
    destinations: $('destinations'),
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
    $('done-title').textContent = i18n.t('doneTitle');
    $('btn-again').textContent = i18n.t('again');
    $('btn-next').textContent = i18n.t('next');
    $('btn-drive').textContent = i18n.t('drive');
    $('btn-drive-panel').textContent = i18n.t('drive');
    $('btn-drive-panel').hidden = !build.solved;
    $('btn-map').textContent = i18n.t('backToMap');
    $('btn-next-drive').textContent = i18n.t('next');
    $('btn-next-drive').hidden = isLast();
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
  $('btn-lang').addEventListener('click', () => {
    i18n.setLang(i18n.getLang() === 'nl' ? 'en' : 'nl');
    build.buildLabels();
    build.refreshPanel();
    build.layout();
    drive.refreshTexts();
    refreshTexts();
  });

  // Fonts change the panel width; lay out again once they are ready.
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => (drive.active ? drive.layout() : build.layout()));
  }

  loadLevel(levelIndex);
})(globalThis.TG = globalThis.TG || {});
