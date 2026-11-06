const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function element() {
  return {
    addEventListener() {},
    classList: { add() {}, remove() {}, toggle() {} },
    querySelector() { return element(); },
    querySelectorAll() { return []; },
    setAttribute() {},
    style: { setProperty() {} },
    elements: new Proxy({}, { get: () => element() })
  };
}

const storage = new Map();
const elements = new Map();
const getElement = selector => {
  if (!elements.has(selector)) elements.set(selector, element());
  return elements.get(selector);
};
const context = {
  console,
  crypto: { randomUUID: () => 'test-id' },
  document: {
    body: element(),
    addEventListener() {},
    createElement: element,
    querySelector: getElement,
    querySelectorAll: () => []
  },
  location: { hash: '', search: '' },
  localStorage: {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, value),
    removeItem: key => storage.delete(key),
    key: index => [...storage.keys()][index] ?? null,
    get length() { return storage.size; }
  },
  sessionStorage: { removeItem() {} },
  navigator: { onLine: false },
  window: { __NOSSO_CAIXA_TEST__: true, addEventListener() {} },
  URL,
  URLSearchParams,
  Intl,
  Date,
  Number,
  Object,
  Array,
  Map,
  Math,
  String,
  Boolean,
  setTimeout: () => 0,
  clearTimeout() {},
  confirm: () => true
};

vm.createContext(context);
vm.runInContext(fs.readFileSync('app.js', 'utf8'), context);

const savingsConfig = context.loadConfigFrom({
  version: 1,
  savedFunds: { bank: 125050, cash: 2490 }
});

assert.equal(savingsConfig.version, 3);
assert.deepEqual({ ...savingsConfig.savedFunds }, { bank: 125050, cash: 2490 });

const cardsConfig = context.loadConfigFrom({
  version: 2,
  cards: [{ id: 'card-1', name: 'Cartão antigo' }, { id: 'card-2', name: 'Cartão atual', limit: 450000, color: '#12ab34' }]
});

assert.equal(cardsConfig.version, 3);
assert.equal(cardsConfig.cards[0].limit, 0);
assert.equal(cardsConfig.cards[1].limit, 450000);
assert.equal(cardsConfig.cards[1].color, '#12ab34');
assert.match(cardsConfig.cards[0].color, /^#[0-9a-f]{6}$/);

const migratedCardTheme = context.loadConfigFrom({ cards: [{ id: 'card-3', name: 'Tema antigo', theme: 'coral' }] });
assert.equal(migratedCardTheme.cards[0].color, '#aa4d42');
const repairedCardColor = context.loadConfigFrom({ cards: [{ id: 'card-4', name: 'Cor inválida', color: 'neon' }] });
assert.match(repairedCardColor.cards[0].color, /^#[0-9a-f]{6}$/);
assert.equal(context.hslToHex(0, 100, 50), '#ff0000');
assert.deepEqual({ ...context.hexToHsl('#ff0000') }, { hue: 0, saturation: 100, lightness: 50 });
assert.equal(context.cardColorTokens('#ffffff').text, '#172033');
assert.equal(context.cardColorTokens('#000000').text, '#ffffff');

const repairedSavingsConfig = context.loadConfigFrom({
  savedFunds: { bank: -100, cash: 'valor inválido' }
});

assert.deepEqual({ ...repairedSavingsConfig.savedFunds }, { bank: 0, cash: 0 });

const migrated = context.normalizeMonth({
  version: 4,
  month: '2026-09',
  budget: 1_000_000,
  openingBalances: { 'Você': 600_000, Namorada: 400_000, Casal: 0 },
  transactions: [],
  bills: []
}, '2026-09');

assert.deepEqual({ ...migrated.monthlyIncome }, { 'Você': 600_000, Namorada: 400_000 });
assert.deepEqual({ ...migrated.openingBalances }, { 'Você': 0, Namorada: 0, Casal: 0 });
assert.equal(context.totals(migrated).income, 1_000_000);
assert.equal(context.totals(migrated).balance, 1_000_000);

const month = context.normalizeMonth({
  version: 5,
  month: '2026-10',
  openingFrom: '2026-09',
  budget: 1_000_000,
  openingBalances: { 'Você': 100_000, Namorada: 0, Casal: 0 },
  monthlyIncome: { 'Você': 600_000, Namorada: 400_000 },
  transactions: [
    { type: 'income', value: 50_000, paidBy: 'Você' },
    { type: 'expense', value: 200_000, paidBy: 'Você' },
    { type: 'transfer', value: 25_000, from: 'Você', to: 'Namorada', paidBy: 'Você' }
  ],
  bills: []
}, '2026-10');

assert.deepEqual(
  { income: context.totals(month).income, opening: context.totals(month).opening, expense: context.totals(month).expense, balance: context.totals(month).balance },
  { income: 1_050_000, opening: 100_000, expense: 200_000, balance: 950_000 }
);
assert.deepEqual({ ...context.ownerTotals(month) }, { 'Você': 525_000, Namorada: 425_000, Casal: 0 });

const legacyWithSalaryTransaction = context.normalizeMonth({
  version: 4,
  month: '2026-08',
  openingBalances: { 'Você': 100_000, Namorada: 0, Casal: 0 },
  transactions: [{ type: 'income', value: 600_000, paidBy: 'Você' }],
  bills: []
}, '2026-08');

assert.equal(legacyWithSalaryTransaction.monthlyIncome['Você'], 100_000);
assert.equal(legacyWithSalaryTransaction.openingBalances['Você'], 0);
assert.equal(context.totals(legacyWithSalaryTransaction).income, 700_000);
assert.equal(context.totals(legacyWithSalaryTransaction).balance, 700_000);

const repairedV5Plan = context.normalizeMonth({
  version: 5,
  month: '2026-07',
  budget: 1_000_000,
  openingBalances: { 'Você': 600_000, Namorada: 400_000, Casal: 0 },
  monthlyIncome: { 'Você': 0, Namorada: 0 },
  transactions: [{ type: 'income', value: 50_000, paidBy: 'Você' }],
  bills: []
}, '2026-07');

assert.equal(repairedV5Plan.version, 6);
assert.deepEqual({ ...repairedV5Plan.monthlyIncome }, { 'Você': 600_000, Namorada: 400_000 });
assert.deepEqual({ ...repairedV5Plan.openingBalances }, { 'Você': 0, Namorada: 0, Casal: 0 });
assert.equal(context.totals(repairedV5Plan).income, 1_050_000);
assert.equal(context.totals(repairedV5Plan).balance, 1_050_000);

const repairedAfterEditAttempt = context.normalizeMonth({
  version: 5,
  month: '2026-06',
  budget: 650_000,
  openingBalances: { 'Você': 600_000, Namorada: 400_000, Casal: 0 },
  monthlyIncome: { 'Você': 650_000, Namorada: 0 },
  transactions: [],
  bills: []
}, '2026-06');

assert.deepEqual({ ...repairedAfterEditAttempt.monthlyIncome }, { 'Você': 650_000, Namorada: 400_000 });
assert.deepEqual({ ...repairedAfterEditAttempt.openingBalances }, { 'Você': 0, Namorada: 0, Casal: 0 });
assert.equal(context.totals(repairedAfterEditAttempt).balance, 1_050_000);

const carriedBalance = context.normalizeMonth({
  version: 5,
  month: '2026-11',
  openingFrom: '2026-10',
  openingBalances: { 'Você': 300_000, Namorada: 200_000, Casal: 50_000 },
  monthlyIncome: { 'Você': 0, Namorada: 0 },
  transactions: [],
  bills: []
}, '2026-11');

assert.deepEqual({ ...carriedBalance.monthlyIncome }, { 'Você': 0, Namorada: 0 });
assert.deepEqual({ ...carriedBalance.openingBalances }, { 'Você': 300_000, Namorada: 200_000, Casal: 50_000 });

const monthWithGasoline = context.normalizeMonth({
  month: '2026-12',
  transactions: [
    { type: 'expense', category: 'Gasolina', description: 'Posto', value: 20_000 },
    { type: 'expense', category: 'Transporte', description: 'Combustível', value: 15_000 },
    { type: 'expense', category: 'Transporte', description: 'Aplicativo', value: 5_000 },
    { type: 'income', category: 'Gasolina', description: 'Reembolso de gasolina', value: 2_000 }
  ],
  bills: []
}, '2026-12');

assert.equal(context.gasolineExpenseTotal(monthWithGasoline), 35_000);

const creditConfig = {
  installmentPlans: [{ id: 'plan-1', cardId: 'card-1', totalValue: 10_000, installments: 3, firstMonth: '2026-10' }]
};
const creditMonths = {
  '2026-10': { bills: [{ installmentPlanId: 'plan-1', installmentNumber: 1, paid: true }] },
  '2026-11': { bills: [{ installmentPlanId: 'plan-1', installmentNumber: 2, paid: false }] },
  '2026-12': { bills: [] },
  '2027-01': { bills: [{ installmentPlanId: 'plan-1', installmentNumber: 2, paid: true, carriedFrom: '2026-11' }] }
};

context.localStorage.setItem('nosso-caixa:2027-01', JSON.stringify(creditMonths['2027-01']));
assert.equal(context.cardOutstanding('card-1', creditConfig, key => creditMonths[key]), 3_334);

const groupedBills = context.groupBillsByCard([
  { id: 'bill-1', cardId: 'card-2', cardName: 'Nome antigo', paidBy: 'Namorada' },
  { id: 'bill-2', cardId: 'card-1', cardName: 'Cartão removido', cardOwner: 'Você', paidBy: 'Namorada' },
  { id: 'bill-3', paidBy: 'Você' }
], {
  cards: [{ id: 'card-2', name: 'Nubank', owner: 'Você' }],
  installmentPlans: []
});

assert.equal(groupedBills.length, 3);
assert.equal(groupedBills[0].card.name, 'Nubank');
assert.equal(groupedBills[0].card.owner, 'Você');
assert.equal(groupedBills[0].bills[0].paidBy, 'Namorada');
assert.equal(groupedBills[1].card.name, 'Cartão removido');
assert.equal(groupedBills[1].card.owner, 'Você');
assert.equal(groupedBills[1].card.missing, true);
assert.equal(groupedBills[2].card.id, null);

console.log('income rules: ok');
