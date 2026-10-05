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
  window: { NOSSO_CAIXA_CONFIG: {}, addEventListener() {} },
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

storage.set('nosso-caixa:2026-09', JSON.stringify(migrated));
storage.set('nosso-caixa:2026-10', JSON.stringify(month));
getElement('#historyRange').value = '6';
context.renderHistory();
assert.match(getElement('#historyTableBody').innerHTML, /R\$\s10\.000,00/);
assert.match(getElement('#historyTableBody').innerHTML, /R\$\s10\.500,00/);
assert.match(getElement('#historyTableBody').innerHTML, /R\$\s9\.500,00/);

console.log('income rules: ok');
