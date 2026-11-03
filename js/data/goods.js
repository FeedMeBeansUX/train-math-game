/*
 * Goods the trains carry. Names are [singular, plural] in Dutch and English.
 * Which station wants which goods is set per station kind in themes.js.
 * The pixel icons are in js/gfx/side-sprites.js (goodIcon).
 */
(function (TG) {
  'use strict';

  TG.GOODS = {
    parcel:    { nl: ['pakket', 'pakketten'], en: ['parcel', 'parcels'] },
    passenger: { nl: ['passagier', 'passagiers'], en: ['passenger', 'passengers'] },
    chicken: { nl: ['kip', 'kippen'], en: ['chicken', 'chickens'] },
    hay:     { nl: ['hooibaal', 'hooibalen'], en: ['hay bale', 'hay bales'] },
    flour:   { nl: ['zak meel', 'zakken meel'], en: ['sack of flour', 'sacks of flour'] },
    egg:     { nl: ['ei', 'eieren'], en: ['egg', 'eggs'] },
    milk:    { nl: ['melkbus', 'melkbussen'], en: ['milk churn', 'milk churns'] },
    grain:   { nl: ['zak graan', 'zakken graan'], en: ['sack of grain', 'sacks of grain'] },
    apple:   { nl: ['appel', 'appels'], en: ['apple', 'apples'] },
    cheese:  { nl: ['kaas', 'kazen'], en: ['cheese', 'cheeses'] },
    bread:   { nl: ['brood', 'broden'], en: ['loaf', 'loaves'] },
    bricks:  { nl: ['stapel stenen', 'stapels stenen'], en: ['stack of bricks', 'stacks of bricks'] },
    planks:  { nl: ['stapel planken', 'stapels planken'], en: ['stack of planks', 'stacks of planks'] },
    stones:  { nl: ['kar stenen', 'karren stenen'], en: ['cart of stones', 'carts of stones'] },
    tyre:    { nl: ['band', 'banden'], en: ['tyre', 'tyres'] },
    fuel:    { nl: ['vat olie', 'vaten olie'], en: ['barrel of oil', 'barrels of oil'] },
  };
})(globalThis.TG = globalThis.TG || {});
