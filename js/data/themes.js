/*
 * Themes and station kinds.
 *
 * Each station kind has a bilingual name and parameters for its building
 * sprite (see js/gfx/sprites.js: building()). Goods per theme follow in phase 4.
 */
(function (TG) {
  'use strict';

  const STATION_KINDS = {
    depot: {
      name: { nl: 'Magazijn', en: 'Warehouse' },
      art: { roof: ['#7c8087', '#5f6369'], wall: '#a39a8a', trim: '#d9d2c3', door: '#4b3b2b', emblem: 'bigdoor' },
    },
    // Farm theme
    farm: {
      name: { nl: 'Boerderij', en: 'Farm' },
      art: { roof: ['#6e6a64', '#55514c'], wall: '#9c3d30', trim: '#e6dfd0', door: '#7a2e24', emblem: 'barn' },
    },
    bakery: {
      name: { nl: 'Bakkerij', en: 'Bakery' },
      art: { roof: ['#b8643a', '#94502e'], wall: '#d6c6a4', trim: '#f0e8d6', door: '#6b4a2f', emblem: 'bread' },
    },
    mill: {
      name: { nl: 'Molen', en: 'Mill' },
      art: { roof: ['#5e5249', '#4a4039'], wall: '#b8ab92', trim: '#e6dfd0', door: '#4b3b2b', emblem: 'sails' },
    },
    market: {
      name: { nl: 'Markt', en: 'Market' },
      art: { roof: ['#3f7a4e', '#2f5e3b'], wall: '#cbbfa6', trim: '#f0e8d6', door: '#6b4a2f', emblem: 'awning' },
    },
    // Construction theme
    building_site: {
      name: { nl: 'Bouwplaats', en: 'Building site' },
      art: { roof: ['#d6a531', '#b08624'], wall: '#8f8a80', trim: '#2b2b2b', door: '#3a3a3a', emblem: 'stripes' },
    },
    quarry: {
      name: { nl: 'Steengroeve', en: 'Quarry' },
      art: { roof: ['#8d857a', '#6f685f'], wall: '#a8a093', trim: '#d0c8ba', door: '#4b4b4b', emblem: 'stones' },
    },
    sawmill: {
      name: { nl: 'Zagerij', en: 'Sawmill' },
      art: { roof: ['#6b4a2f', '#553a24'], wall: '#a07a50', trim: '#d9c29a', door: '#4b3b2b', emblem: 'logs' },
    },
    // Racing / garage theme
    garage: {
      name: { nl: 'Garage', en: 'Garage' },
      art: { roof: ['#4f6d8a', '#3d566e'], wall: '#b9bec4', trim: '#e9edf0', door: '#5a5f66', emblem: 'wheel' },
    },
    race_track: {
      name: { nl: 'Racebaan', en: 'Race track' },
      art: { roof: ['#c43c32', '#9e3028'], wall: '#d9d9d9', trim: '#ffffff', door: '#333333', emblem: 'flag' },
    },
    fuel_station: {
      name: { nl: 'Tankstation', en: 'Fuel station' },
      art: { roof: ['#2f7d62', '#23604b'], wall: '#d8d4cc', trim: '#ffffff', door: '#3a3a3a', emblem: 'drop' },
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
