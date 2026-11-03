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
    cement:  { nl: ['zak cement', 'zakken cement'], en: ['sack of cement', 'sacks of cement'] },
    logs:    { nl: ['boomstam', 'boomstammen'], en: ['log', 'logs'] },
    helmet:  { nl: ['helm', 'helmen'], en: ['helmet', 'helmets'] },
    wheelbarrow: { nl: ['kruiwagen', 'kruiwagens'], en: ['wheelbarrow', 'wheelbarrows'] },
    cone:    { nl: ['pion', 'pionnen'], en: ['traffic cone', 'traffic cones'] },
    tyre:    { nl: ['band', 'banden'], en: ['tyre', 'tyres'] },
    fuel:    { nl: ['vat olie', 'vaten olie'], en: ['barrel of oil', 'barrels of oil'] },
    flag:    { nl: ['vlag', 'vlaggen'], en: ['flag', 'flags'] },
    soap:    { nl: ['fles zeep', 'flessen zeep'], en: ['bottle of soap', 'bottles of soap'] },
    sponge:  { nl: ['spons', 'sponzen'], en: ['sponge', 'sponges'] },
    book:    { nl: ['boek', 'boeken'], en: ['book', 'books'] },
    pencil:  { nl: ['potlood', 'potloden'], en: ['pencil', 'pencils'] },
    letter:  { nl: ['brief', 'brieven'], en: ['letter', 'letters'] },
    banana:  { nl: ['banaan', 'bananen'], en: ['banana', 'bananas'] },
    ball:    { nl: ['bal', 'ballen'], en: ['ball', 'balls'] },
    teddy:   { nl: ['knuffel', 'knuffels'], en: ['teddy bear', 'teddy bears'] },
  };
})(globalThis.TG = globalThis.TG || {});
