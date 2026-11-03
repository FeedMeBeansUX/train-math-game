/*
 * Themes and station kinds.
 *
 * Each station kind has a bilingual name and parameters for its building
 * sprite (see js/gfx/sprites.js: building()). wallType: brick | plank | plaster | metal.
 * article: the Dutch article ('de' or 'het') used in sentences.
 * wants: goods (js/data/goods.js) this station can order (every station also accepts parcels).
 *
 * Themes group four stations each and unlock with stars (TG.progress totalStars).
 */
(function (TG) {
  'use strict';

  const kind = (article, nl, en, wants, art) => ({ name: { article, nl, en }, wants, art });

  const STATION_KINDS = {
    depot: kind('het', 'Magazijn', 'Warehouse', [],
      { wallType: 'metal', roof: ['#7c8087', '#5f6369'], wall: '#a39a8a', trim: '#d9d2c3', door: '#4b3b2b', emblem: 'bigdoor' }),

    // Farm
    farm: kind('de', 'Boerderij', 'Farm', ['chicken', 'hay'],
      { wallType: 'plank', roof: ['#6e6a64', '#55514c'], wall: '#9c3d30', trim: '#e6dfd0', door: '#7a2e24', emblem: 'barn' }),
    bakery: kind('de', 'Bakkerij', 'Bakery', ['flour', 'egg', 'milk'],
      { wallType: 'brick', roof: ['#b8643a', '#94502e'], wall: '#d6c6a4', trim: '#f0e8d6', door: '#6b4a2f', emblem: 'bread' }),
    mill: kind('de', 'Molen', 'Mill', ['grain'],
      { wallType: 'plaster', roof: ['#5e5249', '#4a4039'], wall: '#b8ab92', trim: '#e6dfd0', door: '#4b3b2b', emblem: 'sails' }),
    market: kind('de', 'Markt', 'Market', ['apple', 'cheese', 'bread'],
      { wallType: 'brick', roof: ['#3f7a4e', '#2f5e3b'], wall: '#cbbfa6', trim: '#f0e8d6', door: '#6b4a2f', emblem: 'awning' }),

    // Construction
    building_site: kind('de', 'Bouwplaats', 'Building site', ['bricks', 'planks', 'cement'],
      { wallType: 'metal', roof: ['#d6a531', '#b08624'], wall: '#8f8a80', trim: '#2b2b2b', door: '#3a3a3a', emblem: 'stripes' }),
    quarry: kind('de', 'Steengroeve', 'Quarry', ['helmet', 'wheelbarrow'],
      { wallType: 'plaster', roof: ['#8d857a', '#6f685f'], wall: '#a8a093', trim: '#d0c8ba', door: '#4b4b4b', emblem: 'stones' }),
    sawmill: kind('de', 'Zagerij', 'Sawmill', ['logs'],
      { wallType: 'plank', roof: ['#6b4a2f', '#553a24'], wall: '#a07a50', trim: '#d9c29a', door: '#4b3b2b', emblem: 'logs' }),
    road_works: kind('de', 'Wegenbouw', 'Road works', ['stones', 'cone'],
      { wallType: 'metal', roof: ['#e07a2a', '#b85f1e'], wall: '#9a958c', trim: '#f2efe6', door: '#3a3a3a', emblem: 'cone' }),

    // Racing
    garage: kind('de', 'Garage', 'Garage', ['tyre', 'fuel'],
      { wallType: 'metal', roof: ['#4f6d8a', '#3d566e'], wall: '#b9bec4', trim: '#e9edf0', door: '#5a5f66', emblem: 'wheel' }),
    race_track: kind('de', 'Racebaan', 'Race track', ['tyre', 'flag'],
      { wallType: 'plaster', roof: ['#c43c32', '#9e3028'], wall: '#d9d9d9', trim: '#ffffff', door: '#333333', emblem: 'flag' }),
    fuel_station: kind('het', 'Tankstation', 'Fuel station', ['fuel'],
      { wallType: 'plaster', roof: ['#2f7d62', '#23604b'], wall: '#d8d4cc', trim: '#ffffff', door: '#3a3a3a', emblem: 'drop' }),
    car_wash: kind('de', 'Wasstraat', 'Car wash', ['soap', 'sponge'],
      { wallType: 'plaster', roof: ['#3a8ac4', '#2c6c9a'], wall: '#e8eef2', trim: '#ffffff', door: '#5a5f66', emblem: 'bubbles' }),

    // Town
    school: kind('de', 'School', 'School', ['book', 'pencil'],
      { wallType: 'brick', roof: ['#8a3a2e', '#6e2e24'], wall: '#c9a27a', trim: '#f0e8d6', door: '#3f5a8a', emblem: 'bell' }),
    post_office: kind('het', 'Postkantoor', 'Post office', ['letter'],
      { wallType: 'brick', roof: ['#5a5f66', '#45494f'], wall: '#d98a4a', trim: '#f2efe6', door: '#3a3a3a', emblem: 'envelope' }),
    shop: kind('de', 'Winkel', 'Shop', ['banana', 'milk', 'bread'],
      { wallType: 'plaster', roof: ['#6a4a8a', '#553a70'], wall: '#e0d6c4', trim: '#f2efe6', door: '#4b3b2b', emblem: 'shopwindow' }),
    toy_shop: kind('de', 'Speelgoedwinkel', 'Toy shop', ['ball', 'teddy'],
      { wallType: 'plaster', roof: ['#c4483d', '#9e3028'], wall: '#f0e2b0', trim: '#ffffff', door: '#2a6fb0', emblem: 'ball' }),
  };

  /**
   * ground: top-down ground style; landscape: side-view scenery style.
   * unlockStars: total stars needed before the theme can be chosen.
   */
  const THEMES = {
    farm: {
      name: { nl: 'Boerderij', en: 'Farm' },
      stations: ['farm', 'bakery', 'mill', 'market'],
      unlockStars: 0,
    },
    construction: {
      name: { nl: 'Bouwen', en: 'Construction' },
      stations: ['building_site', 'quarry', 'sawmill', 'road_works'],
      unlockStars: 12,
    },
    racing: {
      name: { nl: 'Racen', en: 'Racing' },
      stations: ['garage', 'race_track', 'fuel_station', 'car_wash'],
      unlockStars: 30,
    },
    town: {
      name: { nl: 'Stad', en: 'Town' },
      stations: ['school', 'post_office', 'shop', 'toy_shop'],
      unlockStars: 50,
    },
  };
  const THEME_ORDER = ['farm', 'construction', 'racing', 'town'];

  function stationKind(k) {
    const s = STATION_KINDS[k];
    if (!s) throw new Error('Unknown station kind: ' + k);
    return s;
  }

  /** Themes that can be played with this many stars. */
  function unlocked(stars) {
    return THEME_ORDER.filter(t => stars >= THEMES[t].unlockStars);
  }

  TG.themes = { STATION_KINDS, THEMES, THEME_ORDER, stationKind, unlocked };
})(globalThis.TG = globalThis.TG || {});
