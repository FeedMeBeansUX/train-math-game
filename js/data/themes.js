/*
 * Themes and station kinds.
 *
 * Each station kind has a bilingual name and parameters for its building
 * sprite (see js/gfx/sprites.js: building()). wallType: brick | plank | plaster | metal.
 * article: the Dutch article ('de' or 'het') used in sentences. Goods per theme follow in phase 4.
 */
(function (TG) {
  'use strict';

  const STATION_KINDS = {
    depot: {
      name: { article: 'het', nl: 'Magazijn', en: 'Warehouse' },
      art: { wallType: 'metal', roof: ['#7c8087', '#5f6369'], wall: '#a39a8a', trim: '#d9d2c3', door: '#4b3b2b', emblem: 'bigdoor' },
    },
    // Farm theme
    farm: {
      name: { article: 'de', nl: 'Boerderij', en: 'Farm' },
      art: { wallType: 'plank', roof: ['#6e6a64', '#55514c'], wall: '#9c3d30', trim: '#e6dfd0', door: '#7a2e24', emblem: 'barn' },
    },
    bakery: {
      name: { article: 'de', nl: 'Bakkerij', en: 'Bakery' },
      art: { wallType: 'brick', roof: ['#b8643a', '#94502e'], wall: '#d6c6a4', trim: '#f0e8d6', door: '#6b4a2f', emblem: 'bread' },
    },
    mill: {
      name: { article: 'de', nl: 'Molen', en: 'Mill' },
      art: { wallType: 'plaster', roof: ['#5e5249', '#4a4039'], wall: '#b8ab92', trim: '#e6dfd0', door: '#4b3b2b', emblem: 'sails' },
    },
    market: {
      name: { article: 'de', nl: 'Markt', en: 'Market' },
      art: { wallType: 'brick', roof: ['#3f7a4e', '#2f5e3b'], wall: '#cbbfa6', trim: '#f0e8d6', door: '#6b4a2f', emblem: 'awning' },
    },
    // Construction theme
    building_site: {
      name: { article: 'de', nl: 'Bouwplaats', en: 'Building site' },
      art: { wallType: 'metal', roof: ['#d6a531', '#b08624'], wall: '#8f8a80', trim: '#2b2b2b', door: '#3a3a3a', emblem: 'stripes' },
    },
    quarry: {
      name: { article: 'de', nl: 'Steengroeve', en: 'Quarry' },
      art: { wallType: 'plaster', roof: ['#8d857a', '#6f685f'], wall: '#a8a093', trim: '#d0c8ba', door: '#4b4b4b', emblem: 'stones' },
    },
    sawmill: {
      name: { article: 'de', nl: 'Zagerij', en: 'Sawmill' },
      art: { wallType: 'plank', roof: ['#6b4a2f', '#553a24'], wall: '#a07a50', trim: '#d9c29a', door: '#4b3b2b', emblem: 'logs' },
    },
    // Racing / garage theme
    garage: {
      name: { article: 'de', nl: 'Garage', en: 'Garage' },
      art: { wallType: 'metal', roof: ['#4f6d8a', '#3d566e'], wall: '#b9bec4', trim: '#e9edf0', door: '#5a5f66', emblem: 'wheel' },
    },
    race_track: {
      name: { article: 'de', nl: 'Racebaan', en: 'Race track' },
      art: { wallType: 'plaster', roof: ['#c43c32', '#9e3028'], wall: '#d9d9d9', trim: '#ffffff', door: '#333333', emblem: 'flag' },
    },
    fuel_station: {
      name: { article: 'het', nl: 'Tankstation', en: 'Fuel station' },
      art: { wallType: 'plaster', roof: ['#2f7d62', '#23604b'], wall: '#d8d4cc', trim: '#ffffff', door: '#3a3a3a', emblem: 'drop' },
    },
  };

  const THEMES = {
    farm:         { name: { nl: 'Boerderij', en: 'Farm' }, stations: ['farm', 'bakery', 'mill', 'market'] },
    construction: { name: { nl: 'Bouwen', en: 'Construction' }, stations: ['building_site', 'quarry', 'sawmill'] },
    racing:       { name: { nl: 'Racen', en: 'Racing' }, stations: ['garage', 'race_track', 'fuel_station'] },
  };

  function stationKind(kind) {
    const k = STATION_KINDS[kind];
    if (!k) throw new Error('Unknown station kind: ' + kind);
    return k;
  }

  TG.themes = { STATION_KINDS, THEMES, stationKind };
})(globalThis.TG = globalThis.TG || {});
