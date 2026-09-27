/* Sahsih: everything a non-developer might want to edit lives here.
 *
 * Flavours drive the 3D sachet label, the page accent colour, the shop and
 * the cart. Prices are in whole units of `currency`. Copy for the health
 * callouts stays descriptive: it names ingredients, it does not make claims.
 */
export const CONFIG = {
  locale: 'en-US',
  currency: 'USD',
  orderEmail: 'hello@sahsih.com',
  storageKey: 'sahsih-cart-v2',
  defaultFlavour: 'berry',

  flavours: [
    {
      id: 'berry',
      name: 'Berry',
      note: 'Deep and jammy',
      accent: '#ff4de0',
      light: '#ffc2f5',
      deep: '#5a1a86',
    },
    {
      id: 'mango',
      name: 'Mango',
      note: 'Thick and golden',
      accent: '#ff9a2e',
      light: '#ffe0a8',
      deep: '#9a3a05',
    },
    {
      id: 'pineapple',
      name: 'Pineapple',
      note: 'Sharp, tropical',
      accent: '#ffd52e',
      light: '#fff4b0',
      deep: '#8a6a00',
    },
    {
      id: 'watermelon',
      name: 'Watermelon',
      note: 'Light, cooling',
      accent: '#ff3b6b',
      light: '#ffc0cf',
      deep: '#8a0a2c',
    },
    {
      id: 'citrus',
      name: 'Citrus',
      note: 'Clean and bright',
      accent: '#8fe23f',
      light: '#e2ffb8',
      deep: '#2f6a07',
    },
  ],

  packs: [
    { id: 'box', name: '1 box', sticks: 10, price: 24 },
    { id: 'trio', name: '3 boxes', sticks: 30, price: 72 },
    { id: 'set', name: 'The Full Set', sticks: 50, price: 105, mixed: true, note: 'All five flavours' },
  ],

  hud: [
    { id: 'weight', label: 'Weight', from: 0, to: 15, unit: 'g' },
    { id: 'water', label: 'Water needed', from: 500, to: 0, unit: 'ml' },
    { id: 'flavours', label: 'Flavours', from: 0, to: 5, unit: '' },
  ],

  // Printed on the 3D sachet. Ingredient names only, no claims.
  label: {
    lines: ['HANGOVER', 'JELLY STICK'],
    strap: 'REPLENISH • REBALANCE • FEEL GOOD',
    rows: [
      { icon: 'leaf', title: 'MILK THISTLE', sub: 'BOTANICAL' },
      { icon: 'drop', title: 'ELECTROLYTES', sub: 'MINERAL SALTS' },
      { icon: 'lightning', title: 'B VITAMINS', sub: 'B1 · B6 · B12' },
    ],
    weight: 'NET WT. 15 g',
  },
};

export const flavourById = (id) => CONFIG.flavours.find((f) => f.id === id) || CONFIG.flavours[0];
export const packById = (id) => CONFIG.packs.find((p) => p.id === id) || CONFIG.packs[0];
