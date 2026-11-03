/* Start-up: wires the build screen to the page, level picker and dialogs. */
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

  const screen = new TG.BuildScreen({
    stage: $('stage'),
    canvas: $('game'),
    labels: $('labels'),
    task: $('task-text'),
    stations: $('station-list'),
    inventory: $('inventory'),
    help: $('help'),
  }, { onSolved: showDone });

  function loadLevel(i) {
    levelIndex = i;
    try { localStorage.setItem(LEVEL_KEY, String(i)); } catch (e) { /* ignore */ }
    hideDone();
    screen.load(TG.LEVELS[i]);
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
    const last = levelIndex === TG.LEVELS.length - 1;
    $('done-text').textContent = i18n.t('doneText') + (last ? ' ' + i18n.t('lastLevel') : '');
    $('btn-next').hidden = last;

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
    $(levelIndex < TG.LEVELS.length - 1 ? 'btn-next' : 'btn-again').focus();
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
  $('btn-next').addEventListener('click', () => loadLevel(Math.min(levelIndex + 1, TG.LEVELS.length - 1)));
  $('btn-lang').addEventListener('click', () => {
    i18n.setLang(i18n.getLang() === 'nl' ? 'en' : 'nl');
    screen.buildLabels();
    screen.refreshPanel();
    screen.layout();
    refreshTexts();
  });

  // Fonts change the panel width; lay out again once they are ready.
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => screen.layout());

  loadLevel(levelIndex);
})(globalThis.TG = globalThis.TG || {});
