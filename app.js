const CATEGORIES = {
  Moradia: { color: '#2962ff' }, Alimentação: { color: '#0c9273' }, Transporte: { color: '#e15c47' },
  Lazer: { color: '#8c62d6' }, Saúde: { color: '#df9e2f' }, Presente: { color: '#bd4f8f' },
  Trabalho: { color: '#277f9d' }, Carro: { color: '#c6533f' }, Gasolina: { color: '#c77a18' }, Eletrônico: { color: '#5865c7' },
  Estudos: { color: '#9a6b16' }, Outros: { color: '#778397' }, Receita: { color: '#0c9273' }
};
const CASH_FLOW_ICONS = {
  income: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="8" width="17" height="12" rx="2"></rect><text x="12" y="17" text-anchor="middle">$</text><path d="M12 2v6M9.5 5.5 12 8l2.5-2.5"></path></svg>',
  expense: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="8" width="17" height="12" rx="2"></rect><text x="12" y="17" text-anchor="middle">$</text><path d="M12 8V2M9.5 4.5 12 2l2.5 2.5"></path></svg>',
  transfer: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8h13M15 5l3 3-3 3M19 16H6M9 13l-3 3 3 3"></path></svg>'
};
const OWNERS = ['Você', 'Namorada', 'Casal'];
const OWNER_LABELS = { 'Você': 'Nicolas', Namorada: 'Isabella', Casal: 'Compartilhado' };
const CONFIG_KEY = 'nosso-caixa:config';
const MONTH_PREFIX = 'nosso-caixa:';
const SUPABASE_CONFIG = window.NOSSO_CAIXA_CONFIG || {};
const today = new Date();
let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
let monthData = null;
let appConfig = loadConfig();
let supabaseClient = null;
let currentUser = null;
let realtimeChannel = null;
const remoteSyncTimers = new Map();

const $ = selector => document.querySelector(selector);
const money = (cents, digits = 2) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits }).format((Number(cents) || 0) / 100);
const monthKey = (date = cursor) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const storageKey = (key = monthKey()) => `${MONTH_PREFIX}${key}`;
const ownerLabel = owner => OWNER_LABELS[owner] || owner || 'Compartilhado';
const ownerClass = owner => owner === 'Namorada' ? 'partner' : owner === 'Casal' ? 'shared' : 'you';
const uid = () => crypto.randomUUID();

function emptyMonth(key = monthKey()) {
  return { version: 6, month: key, budget: 0, savingsGoal: 0, savedAmount: 0, openingBalance: 0,
    openingBalances: { 'Você': 0, Namorada: 0, Casal: 0 }, monthlyIncome: { 'Você': 0, Namorada: 0 },
    status: 'open', closedAt: null, bills: [], transactions: [] };
}
function defaultConfig() { return { version: 1, updatedAt: null, recurringBills: [], cards: [], installmentPlans: [], splitYou: 50 }; }
function safeJson(raw, fallback) { try { return raw ? JSON.parse(raw) : fallback; } catch (_) { return fallback; } }
function loadConfigFrom(value) {
  const result = { ...defaultConfig(), ...(value || {}) };
  result.recurringBills = Array.isArray(result.recurringBills) ? result.recurringBills : [];
  result.cards = Array.isArray(result.cards) ? result.cards : [];
  result.installmentPlans = Array.isArray(result.installmentPlans) ? result.installmentPlans : [];
  return result;
}
function loadConfig() { return loadConfigFrom(safeJson(localStorage.getItem(CONFIG_KEY), {})); }
function saveConfig(schedule = true) {
  appConfig.updatedAt = new Date().toISOString();
  localStorage.setItem(CONFIG_KEY, JSON.stringify(appConfig));
  if (schedule) scheduleConfigSync();
}

function normalizeMonth(data, key = monthKey()) {
  const source = data && typeof data === 'object' ? data : {};
  const normalized = { ...emptyMonth(key), ...source, month: source.month || key };
  if (!source.openingBalances) {
    const hasIncome = (normalized.transactions || []).some(item => item.type === 'income');
    normalized.openingBalances = { 'Você': !hasIncome && !normalized.openingBalance ? Number(normalized.budget) || 0 : 0, Namorada: 0, Casal: Number(normalized.openingBalance) || 0 };
  }
  normalized.openingBalances = { 'Você': Number(normalized.openingBalances?.['Você']) || 0, Namorada: Number(normalized.openingBalances?.Namorada) || 0, Casal: Number(normalized.openingBalances?.Casal) || 0 };
  if (!source.monthlyIncome) {
    const legacyPlanWasIncome = !source.openingFrom;
    normalized.monthlyIncome = legacyPlanWasIncome
      ? { 'Você': normalized.openingBalances['Você'], Namorada: normalized.openingBalances.Namorada }
      : { 'Você': 0, Namorada: 0 };
    if (legacyPlanWasIncome) {
      normalized.openingBalances['Você'] = 0;
      normalized.openingBalances.Namorada = 0;
    }
  }
  normalized.monthlyIncome = { 'Você': Number(normalized.monthlyIncome?.['Você']) || 0, Namorada: Number(normalized.monthlyIncome?.Namorada) || 0 };
  const needsV5PlanRepair = Number(source.version) === 5 && !source.openingFrom
    && (normalized.openingBalances['Você'] || normalized.openingBalances.Namorada);
  if (needsV5PlanRepair) {
    normalized.monthlyIncome = {
      'Você': normalized.monthlyIncome['Você'] || normalized.openingBalances['Você'],
      Namorada: normalized.monthlyIncome.Namorada || normalized.openingBalances.Namorada
    };
    normalized.openingBalances['Você'] = 0;
    normalized.openingBalances.Namorada = 0;
  }
  normalized.bills = Array.isArray(normalized.bills) ? normalized.bills.map(bill => ({ paid: false, transactionId: null, scope: bill.paidBy === 'Casal' ? 'shared' : 'individual', splitYou: 50, ...bill })) : [];
  normalized.transactions = Array.isArray(normalized.transactions) ? normalized.transactions.map(transaction => ({ scope: transaction.paidBy === 'Casal' ? 'shared' : 'individual', splitYou: 50, ...transaction })) : [];
  normalized.budget = Number(normalized.budget) || monthlyIncomeTotal(normalized);
  normalized.savingsGoal = Number(normalized.savingsGoal) || 0;
  normalized.savedAmount = Number(normalized.savedAmount) || 0;
  normalized.status = normalized.status === 'closed' ? 'closed' : 'open';
  normalized.version = 6;
  return normalized;
}
function parseMonthKey(key) { const [year, month] = key.split('-').map(Number); return new Date(year, month - 1, 1); }
function addMonths(key, amount) { const date = parseMonthKey(key); date.setMonth(date.getMonth() + amount); return monthKey(date); }
function monthsBetween(from, to) { const start = parseMonthKey(from), end = parseMonthKey(to); return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth(); }
function readMonth(key) { return normalizeMonth(safeJson(localStorage.getItem(storageKey(key)), {}), key); }
function writeMonth(key, data, schedule = true) {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(storageKey(key), JSON.stringify(normalizeMonth(data, key)));
  if (schedule) scheduleMonthSync(key);
}
function hasMonthValues(data) { return Boolean(OWNERS.some(owner => data.openingBalances?.[owner]) || Object.values(data.monthlyIncome || {}).some(Boolean) || data.savingsGoal || data.savedAmount || data.transactions?.length || data.bills?.length || data.status === 'closed'); }

function materializeScheduledItems() {
  if (monthData.status === 'closed') return false;
  const key = monthKey();
  let changed = false;
  appConfig.recurringBills.forEach(template => {
    const active = template.active !== false && template.startMonth <= key && (!template.endMonth || template.endMonth >= key);
    if (!active || monthData.bills.some(bill => bill.recurrenceId === template.id && bill.generatedMonth === key)) return;
    monthData.bills.push({ id: `rec-${template.id}-${key}`, description: template.description, value: template.value, dueDay: template.dueDay,
      category: template.category, paidBy: template.paidBy, scope: template.scope || 'individual', splitYou: template.splitYou ?? 50,
      paid: false, transactionId: null, recurrenceId: template.id, generatedMonth: key });
    changed = true;
  });
  appConfig.installmentPlans.forEach(plan => {
    const index = monthsBetween(plan.firstMonth, key);
    if (index < 0 || index >= plan.installments || monthData.bills.some(bill => bill.installmentPlanId === plan.id && bill.installmentNumber === index + 1)) return;
    const base = plan.installmentValue || Math.floor(plan.totalValue / plan.installments);
    const value = plan.installmentValue ? base : (index === plan.installments - 1 ? plan.totalValue - base * (plan.installments - 1) : base);
    monthData.bills.push({ id: `inst-${plan.id}-${index + 1}`, description: `${plan.description} (${index + 1}/${plan.installments})`, value,
      dueDay: plan.dueDay, category: plan.category, paidBy: plan.paidBy, scope: plan.scope || 'individual', splitYou: plan.splitYou ?? 50,
      paid: false, transactionId: null, installmentPlanId: plan.id, installmentNumber: index + 1, installmentCount: plan.installments, cardName: plan.cardName });
    changed = true;
  });
  return changed;
}

function seedDemo() {
  monthData.openingBalances = { 'Você': 0, Namorada: 0, Casal: 0 };
  monthData.budget = 700000; monthData.savingsGoal = 100000;
  monthData.transactions = [
    ['2026-09-02', 'income', 'Salário', 'Receita', 620000, 'Você'], ['2026-09-03', 'income', 'Contribuição da parceira', 'Receita', 410000, 'Namorada'],
    ['2026-09-05', 'expense', 'Aluguel', 'Moradia', 240000, 'Casal'], ['2026-09-08', 'expense', 'Mercado da semana', 'Alimentação', 48760, 'Você'],
    ['2026-09-12', 'expense', 'Conta de energia', 'Moradia', 19640, 'Namorada'], ['2026-09-15', 'expense', 'Combustível', 'Transporte', 22000, 'Você'],
    ['2026-09-19', 'expense', 'Jantar', 'Lazer', 14890, 'Casal'], ['2026-09-23', 'expense', 'Farmácia', 'Saúde', 7860, 'Namorada']
  ].map((item, index) => ({ id: `demo-${index}`, date: item[0], type: item[1], description: item[2], category: item[3], value: item[4], paidBy: item[5], scope: item[5] === 'Casal' ? 'shared' : 'individual', splitYou: 50 }));
}
function loadMonth() {
  const key = monthKey(), raw = localStorage.getItem(storageKey(key));
  monthData = normalizeMonth(safeJson(raw, {}), key);
  if (!raw && key === '2026-09' && new URLSearchParams(location.search).has('demo')) seedDemo();
  const generated = materializeScheduledItems();
  if (generated || (raw && JSON.stringify(safeJson(raw, {})) !== JSON.stringify(monthData))) writeMonth(key, monthData);
  render();
  if (hasMonthValues(monthData)) scheduleMonthSync(key, 150);
}
function saveLocal(feedback = true) {
  writeMonth(monthKey(), monthData); setSyncState('Salvando no Supabase...');
  if (feedback) toast('Alteração salva');
}

function monthlyIncomeTotal(data = monthData) { return ['Você', 'Namorada'].reduce((sum, owner) => sum + (Number(data.monthlyIncome?.[owner]) || 0), 0); }
function totals(data = monthData) {
  const fixedIncome = monthlyIncomeTotal(data);
  const variableIncome = data.transactions.filter(item => item.type === 'income').reduce((sum, item) => sum + item.value, 0);
  const income = fixedIncome + variableIncome;
  const expense = data.transactions.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.value, 0);
  const opening = OWNERS.reduce((sum, owner) => sum + (Number(data.openingBalances?.[owner]) || 0), 0);
  return { income, fixedIncome, variableIncome, expense, opening, balance: opening + income - expense };
}
function gasolineExpenseTotal(data = monthData) {
  return data.transactions
    .filter(item => item.type === 'expense' && (item.category === 'Gasolina' || /\b(gasolina|combust[ií]vel)\b/i.test(item.description || '')))
    .reduce((sum, item) => sum + item.value, 0);
}
function ownerTotals(data = monthData) {
  const balances = Object.fromEntries(OWNERS.map(owner => [owner, Number(data.openingBalances?.[owner]) || 0]));
  ['Você', 'Namorada'].forEach(owner => { balances[owner] += Number(data.monthlyIncome?.[owner]) || 0; });
  data.transactions.forEach(transaction => {
    if (transaction.type === 'transfer') { if (balances[transaction.from] !== undefined) balances[transaction.from] -= transaction.value; if (balances[transaction.to] !== undefined) balances[transaction.to] += transaction.value; return; }
    const owner = balances[transaction.paidBy] === undefined ? 'Casal' : transaction.paidBy;
    balances[owner] += transaction.type === 'income' ? transaction.value : -transaction.value;
  });
  return balances;
}
function pendingBillsTotal(owner = null) { return monthData.bills.filter(bill => !bill.paid && (!owner || bill.paidBy === owner)).reduce((sum, bill) => sum + bill.value, 0); }
function settlementBalance(data = monthData) {
  let net = 0;
  data.transactions.forEach(transaction => {
    if (transaction.type === 'expense' && transaction.scope === 'shared') {
      const splitYou = Math.min(100, Math.max(0, Number(transaction.splitYou ?? 50)));
      if (transaction.paidBy === 'Você') net += Math.round(transaction.value * (100 - splitYou) / 100);
      if (transaction.paidBy === 'Namorada') net -= Math.round(transaction.value * splitYou / 100);
    }
    if (transaction.type === 'transfer') {
      if (transaction.from === 'Namorada' && transaction.to === 'Você') net -= transaction.value;
      if (transaction.from === 'Você' && transaction.to === 'Namorada') net += transaction.value;
    }
  });
  return net;
}

function render() {
  const summary = totals(), balances = ownerTotals(), pending = pendingBillsTotal(), committed = summary.expense + pending, projected = summary.balance - pending;
  const name = new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(cursor);
  $('#monthName').textContent = name.charAt(0).toUpperCase() + name.slice(1); $('#yearName').textContent = cursor.getFullYear();
  $('#balanceValue').textContent = money(summary.balance); $('#incomeValue').textContent = money(summary.income); $('#expenseValue').textContent = money(summary.expense); $('#gasolineValue').textContent = money(gasolineExpenseTotal()); if ($('#pendingValue')) $('#pendingValue').textContent = money(pending);
  $('#projectedValue').textContent = money(projected); $('#projectedValue').classList.toggle('negative', projected < 0);
  $('#balanceDelta').textContent = monthData.budget ? (committed <= monthData.budget ? `${money(monthData.budget - committed)} livres no plano` : `${money(committed - monthData.budget)} acima do plano`) : 'Defina um limite no planejamento';
  $('#yourBalance').textContent = money(balances['Você']); $('#partnerBalance').textContent = money(balances.Namorada); $('#sharedBalance').textContent = money(balances.Casal);
  [['#yourBalance', balances['Você']], ['#partnerBalance', balances.Namorada], ['#sharedBalance', balances.Casal]].forEach(([selector, value]) => $(selector).classList.toggle('is-negative', value < 0));
  renderFreshness(); renderWeeks(summary.expense, committed); renderCategories(summary.expense); renderPlan(committed);
  renderTransactions(); renderBills(); renderAlerts(projected); renderSettlement(); renderBalanceChart(); updateClosedState();
  if (location.hash === '#historico') renderHistory();
}
function renderFreshness() {
  if (monthData.status === 'closed') { $('#syncText').textContent = 'Mês fechado'; $('#syncDot').classList.remove('is-stale'); return; }
  if (monthData.updatedAt) $('#syncDot').classList.toggle('is-stale', Date.now() - new Date(monthData.updatedAt).getTime() > 7 * 86400000);
}
function renderWeeks(totalExpense, committed) {
  const weeks = [0, 0, 0, 0, 0];
  monthData.transactions.filter(item => item.type === 'expense').forEach(item => { const day = Number(item.date?.slice(8, 10)) || 1; weeks[Math.min(4, Math.floor((day - 1) / 7))] += item.value; });
  const max = Math.max(...weeks, 1);
  $('#weekList').innerHTML = weeks.map((value, index) => `<div class="week-item ${Math.floor((today.getDate() - 1) / 7) === index && monthKey(today) === monthKey() ? 'current' : ''}"><span>Semana ${index + 1}</span><div class="bar-track"><i style="width:${Math.round(value / max * 100)}%"></i></div><strong>${money(value, 0)}</strong></div>`).join('');
  const over = monthData.budget > 0 && committed > monthData.budget;
  $('#budgetChip').textContent = monthData.budget ? (over ? 'Acima do planejado' : 'Dentro do planejado') : 'Sem limite definido'; $('#budgetChip').classList.toggle('is-alert', over);
}
function renderCategories(totalExpense) {
  const grouped = {}; monthData.transactions.filter(item => item.type === 'expense').forEach(item => grouped[item.category] = (grouped[item.category] || 0) + item.value);
  const rows = Object.entries(grouped).sort((a, b) => b[1] - a[1]); let current = 0;
  const stops = rows.map(([name, value]) => { const start = current; current += totalExpense ? value / totalExpense * 100 : 0; return `${CATEGORIES[name]?.color || CATEGORIES.Outros.color} ${start}% ${current}%`; });
  $('#categoryDonut').style.background = stops.length ? `conic-gradient(${stops.join(',')})` : '#e9edf1'; $('#categoryTotal').textContent = money(totalExpense, 0);
  $('#categoryLegend').innerHTML = rows.slice(0, 5).map(([name, value]) => `<li><i style="background:${CATEGORIES[name]?.color || CATEGORIES.Outros.color}"></i><span>${escapeHtml(name)}</span><strong>${totalExpense ? Math.round(value / totalExpense * 100) : 0}%</strong></li>`).join('') || '<li><span>As categorias aparecerão aqui.</span></li>';
}

function getFilteredTransactions() {
  const search = ($('#transactionSearch')?.value || '').trim().toLocaleLowerCase('pt-BR');
  const type = $('#transactionTypeFilter')?.value || '', owner = $('#transactionOwnerFilter')?.value || '', category = $('#transactionCategoryFilter')?.value || '';
  const from = $('#transactionDateFrom')?.value || '', to = $('#transactionDateTo')?.value || '', sort = $('#transactionSort')?.value || 'date-desc';
  const items = monthData.transactions.filter(item => {
    const haystack = `${item.description || ''} ${item.category || ''}`.toLocaleLowerCase('pt-BR');
    return (!search || haystack.includes(search)) && (!type || item.type === type) && (!owner || item.paidBy === owner || item.from === owner || item.to === owner) && (!category || item.category === category) && (!from || item.date >= from) && (!to || item.date <= to);
  });
  items.sort((a, b) => sort === 'date-asc' ? (a.date || '').localeCompare(b.date || '') : sort === 'value-desc' ? b.value - a.value : sort === 'description' ? (a.description || '').localeCompare(b.description || '', 'pt-BR') : (b.date || '').localeCompare(a.date || ''));
  return items;
}
function renderTransactions() {
  const items = getFilteredTransactions(), filteredTotal = items.filter(item => item.type === 'expense').reduce((sum, item) => sum + item.value, 0);
  $('#transactionCount').textContent = `${items.length} ${items.length === 1 ? 'lançamento' : 'lançamentos'} · ${money(filteredTotal)} em saídas`;
  $('#transactionList').innerHTML = items.length ? items.map(item => {
    const date = item.date ? new Intl.DateTimeFormat('pt-BR').format(new Date(`${item.date}T12:00:00`)) : '—';
    const transfer = item.type === 'transfer', owner = transfer ? `${ownerLabel(item.from)} → ${ownerLabel(item.to)}` : ownerLabel(item.paidBy);
    const sign = item.type === 'income' ? '+' : item.type === 'expense' ? '−' : '';
    return `<article class="transaction-item"><span class="transaction-icon ${item.type}" aria-hidden="true">${CASH_FLOW_ICONS[item.type] || CASH_FLOW_ICONS.expense}</span><div class="transaction-main"><strong>${escapeHtml(item.description || 'Movimentação')}</strong><span>${escapeHtml(item.category || 'Transferência')} <i class="owner-pill ${ownerClass(item.paidBy)}">${escapeHtml(owner)}</i> ${date}${item.scope === 'shared' && !transfer ? ' · Compartilhada' : ''}</span></div><span class="transaction-value ${item.type}">${sign} ${money(item.value)}</span><div class="row-actions"><button type="button" data-transaction-action="duplicate" data-id="${item.id}">Duplicar</button><button type="button" data-transaction-action="edit" data-id="${item.id}">Editar</button><button type="button" data-transaction-action="delete" data-id="${item.id}">Excluir</button></div></article>`;
  }).join('') : '<div class="empty-state"><strong>Nenhuma movimentação encontrada.</strong><br>Ajuste os filtros ou adicione um lançamento.</div>';
}
function renderPlan(committed) {
  const percent = monthData.budget ? Math.round(committed / monthData.budget * 100) : 0;
  $('#planGauge').style.setProperty('--progress', `${Math.min(100, percent)}%`); $('#planPercent').textContent = `${percent}%`;
  $('#remainingBudget').textContent = money(monthData.budget - committed);
  $('#goalValue').textContent = monthData.status === 'closed' ? `${money(monthData.savedAmount)} de ${money(monthData.savingsGoal)}` : money(monthData.savingsGoal);
}
function renderBills() {
  const sorted = [...monthData.bills].sort((a, b) => Number(a.paid) - Number(b.paid) || a.dueDay - b.dueDay), pending = sorted.filter(bill => !bill.paid);
  $('#billsSummary').textContent = sorted.length ? `${pending.length} ${pending.length === 1 ? 'pendente' : 'pendentes'} · ${money(pendingBillsTotal())}` : 'Nenhuma conta cadastrada';
  $('#billList').innerHTML = sorted.length ? sorted.map(bill => {
    const tags = [bill.recurrenceId ? 'Recorrente' : '', bill.installmentPlanId ? `Parcela ${bill.installmentNumber} de ${bill.installmentCount}` : '', bill.cardName || '', bill.carriedFrom ? `Pendente de ${bill.carriedFrom}` : ''].filter(Boolean);
    return `<article class="bill-item ${bill.paid ? 'is-paid' : ''}"><label class="bill-check" aria-label="Marcar ${escapeHtml(bill.description)} como ${bill.paid ? 'pendente' : 'paga'}"><input type="checkbox" data-bill-id="${bill.id}" ${bill.paid ? 'checked' : ''} ${monthData.status === 'closed' ? 'disabled' : ''}><span aria-hidden="true">✓</span></label><div class="bill-main"><strong>${escapeHtml(bill.description)}</strong><span>Vence dia ${bill.dueDay} · ${escapeHtml(bill.category)} · ${ownerLabel(bill.paidBy)}${tags.length ? ` · ${escapeHtml(tags.join(' · '))}` : ''}</span></div><div class="bill-value"><strong>${money(bill.value)}</strong><span>${bill.paid ? 'Paga' : 'Pendente'}</span></div><div class="row-actions"><button type="button" data-bill-action="edit" data-id="${bill.id}">Editar</button><button type="button" data-bill-action="delete" data-id="${bill.id}">Excluir</button></div></article>`;
  }).join('') : '<div class="bill-empty"><strong>Cadastre faturas e contas fixas.</strong><br>Elas entram no valor comprometido e na previsão do mês.</div>';
}
function renderAlerts(projected) {
  const alerts = [];
  if (monthKey() === monthKey(today)) monthData.bills.filter(bill => !bill.paid).forEach(bill => {
    const days = bill.dueDay - today.getDate();
    if (days < 0) alerts.push({ level: 'danger', text: `${bill.description} venceu há ${Math.abs(days)} dia${Math.abs(days) === 1 ? '' : 's'}.` });
    else if (days === 0) alerts.push({ level: 'danger', text: `${bill.description} vence hoje.` });
    else if (days <= 3) alerts.push({ level: 'warning', text: `${bill.description} vence em ${days} dia${days === 1 ? '' : 's'}.` });
  });
  if (projected < 0) alerts.unshift({ level: 'danger', text: `Faltarão ${money(Math.abs(projected))} para pagar todas as contas pendentes.` });
  const committed = totals().expense + pendingBillsTotal();
  if (monthData.budget && committed >= monthData.budget * .9 && committed <= monthData.budget) alerts.push({ level: 'warning', text: 'O planejamento mensal já atingiu 90% do limite.' });
  $('#alertList').innerHTML = alerts.length ? alerts.slice(0, 6).map(alert => `<div class="alert-item ${alert.level}"><span aria-hidden="true">${alert.level === 'danger' ? '!' : '●'}</span><p>${escapeHtml(alert.text)}</p></div>`).join('') : '<div class="calm-state"><span aria-hidden="true">✓</span><p>Nenhum vencimento urgente ou risco detectado.</p></div>';
}
function renderSettlement() {
  const net = settlementBalance(), button = $('#recordSettlement');
  if (Math.abs(net) < 1) { $('#settlementSummary').innerHTML = '<div class="calm-state"><span aria-hidden="true">✓</span><p>As despesas compartilhadas estão equilibradas.</p></div>'; button.disabled = true; }
  else { const debtor = net > 0 ? 'Isabella' : 'Nicolas', creditor = net > 0 ? 'Nicolas' : 'Isabella'; $('#settlementSummary').innerHTML = `<div class="settlement-amount"><span>${debtor} transfere para ${creditor}</span><strong>${money(Math.abs(net))}</strong></div>`; button.disabled = monthData.status === 'closed'; }
}
function renderBalanceChart() {
  const canvas = $('#balanceChart'), rect = canvas.getBoundingClientRect(); if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1; canvas.width = Math.max(1, rect.width * dpr); canvas.height = Math.max(1, rect.height * dpr);
  const ctx = canvas.getContext('2d'); ctx.scale(dpr, dpr);
  const initial = OWNERS.reduce((sum, owner) => sum + monthData.openingBalances[owner], 0), fixedIncome = monthlyIncomeTotal(), values = [initial]; let running = initial;
  if (fixedIncome) { running += fixedIncome; values.push(running); }
  [...monthData.transactions].filter(item => item.type !== 'transfer').sort((a, b) => (a.date || '').localeCompare(b.date || '')).forEach(item => { running += item.type === 'income' ? item.value : -item.value; values.push(running); });
  if (values.length === 1) values.push(values[0]);
  const min = Math.min(...values), max = Math.max(...values), spread = Math.max(1, max - min);
  const points = values.map((value, index) => ({ x: index / (values.length - 1) * rect.width, y: rect.height - 12 - ((value - min) / spread) * (rect.height - 28) }));
  const gradient = ctx.createLinearGradient(0, 0, 0, rect.height); gradient.addColorStop(0, 'rgba(85,214,181,.30)'); gradient.addColorStop(1, 'rgba(85,214,181,0)');
  ctx.beginPath(); ctx.moveTo(points[0].x, rect.height); points.forEach(point => ctx.lineTo(point.x, point.y)); ctx.lineTo(points.at(-1).x, rect.height); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.strokeStyle = '#55d6b5'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
}
function updateClosedState() {
  const closed = monthData.status === 'closed'; $('#closeMonthButton').textContent = closed ? 'Reabrir mês' : 'Fechar mês';
  ['#openTransaction', '#openBill', '#openInstallment', '#mobileAdd', '#editPlan', '#quickExpense', '#quickIncome', '#quickBill', '#quickPlan'].forEach(selector => { if ($(selector)) $(selector).disabled = closed; }); document.body.classList.toggle('month-closed', closed);
}
function formatMonthShort(key) { return new Intl.DateTimeFormat('pt-BR', { month: 'short' }).format(parseMonthKey(key)).replace('.', ''); }
function formatMonthLabel(key) { return new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(parseMonthKey(key)); }
function renderHistory() {
  const limit = Number($('#historyRange').value) || 6, rows = [];
  for (let index = 0; index < localStorage.length; index++) { const key = localStorage.key(index), match = key?.match(/^nosso-caixa:(\d{4}-\d{2})$/); if (!match) continue; const data = readMonth(match[1]); if (!hasMonthValues(data)) continue; rows.push({ key: match[1], data, ...totals(data) }); }
  rows.sort((a, b) => b.key.localeCompare(a.key)); const visible = rows.slice(0, limit).reverse();
  const totalExpense = visible.reduce((sum, row) => sum + row.expense, 0), totalSaved = visible.reduce((sum, row) => sum + row.data.savedAmount, 0), average = visible.length ? Math.round(totalExpense / visible.length) : 0, categories = {};
  visible.forEach(row => row.data.transactions.filter(item => item.type === 'expense').forEach(item => categories[item.category] = (categories[item.category] || 0) + item.value));
  const topCategory = Object.entries(categories).sort((a, b) => b[1] - a[1])[0];
  $('#historySummary').innerHTML = `<div><span>Média de despesas</span><strong>${money(average)}</strong></div><div><span>Total reservado</span><strong>${money(totalSaved)}</strong></div><div><span>Maior categoria</span><strong>${topCategory ? escapeHtml(topCategory[0]) : '—'}</strong></div>`;
  const max = Math.max(...visible.map(row => Math.max(row.income, row.expense)), 1);
  $('#historyBars').innerHTML = visible.length ? visible.map(row => `<div class="history-month"><span>${formatMonthShort(row.key)}</span><div class="history-bar-pair"><i class="income" style="height:${Math.max(3, row.income / max * 100)}%" title="Entradas: ${money(row.income)}"></i><i class="expense" style="height:${Math.max(3, row.expense / max * 100)}%" title="Saídas: ${money(row.expense)}"></i></div></div>`).join('') : '<div class="empty-state">Os meses salvos aparecerão aqui.</div>';
  $('#historyTableBody').innerHTML = [...visible].reverse().map(row => `<tr><td>${formatMonthLabel(row.key)}</td><td>${money(row.income)}</td><td>${money(row.expense)}</td><td>${money(row.data.savedAmount)}</td><td>${money(row.balance)}</td></tr>`).join('');
}

function parseCurrency(value) { const normalized = String(value || '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, ''); return Math.round(Number(normalized) * 100); }
function escapeHtml(value) { const div = document.createElement('div'); div.textContent = String(value ?? ''); return div.innerHTML; }
function toast(message) { const element = $('#toast'); element.textContent = message; element.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => element.classList.remove('show'), 2600); }
function openDialog(selector) { const dialog = $(selector); if (!dialog.open) dialog.showModal(); }
function setFormCurrency(input, cents) { input.value = (Number(cents || 0) / 100).toFixed(2).replace('.', ','); }
function ensureOpenMonth() { if (monthData.status === 'closed') { toast('Reabra o mês para fazer alterações'); return false; } return true; }

function openTransaction(transaction = null) {
  if (!ensureOpenMonth()) return;
  const form = $('#transactionForm'); form.reset(); form.dataset.editId = transaction?.id || '';
  form.querySelector('h2').textContent = transaction ? 'Editar movimentação' : 'Nova movimentação';
  if (transaction) {
    form.elements.type.value = transaction.type; form.elements.description.value = transaction.description || ''; setFormCurrency(form.elements.value, transaction.value);
    form.elements.date.value = transaction.date || ''; form.elements.category.value = transaction.category || 'Outros'; form.elements.paidBy.value = transaction.paidBy || 'Você';
    form.elements.scope.value = transaction.scope || 'individual'; form.elements.splitYou.value = transaction.splitYou ?? 50;
  } else { form.elements.date.valueAsDate = today; $('#expenseType').checked = true; $('#ownerYou').checked = true; $('#individualScope').checked = true; }
  updateTransactionForm(); openDialog('#transactionDialog');
}
function updateTransactionForm() {
  const isIncome = $('#incomeType').checked;
  $('#ownerPickerLegend').textContent = isIncome ? 'De quem é esta entrada?' : 'Quem pagou?';
  $('#ownerPickerHelp').textContent = isIncome ? 'O valor será somado ao saldo escolhido.' : 'O valor será descontado do saldo escolhido.';
  $('#sharingFields').hidden = isIncome; $('#splitLabel').hidden = isIncome || !$('#sharedScope').checked;
}
function openBill(bill = null) {
  if (!ensureOpenMonth()) return;
  const form = $('#billForm'); form.reset(); form.dataset.editId = bill?.id || ''; form.querySelector('h2').textContent = bill ? 'Editar conta' : 'Nova conta do mês';
  if (bill) { form.elements.description.value = bill.description; setFormCurrency(form.elements.value, bill.value); form.elements.dueDay.value = bill.dueDay; form.elements.category.value = bill.category; form.elements.paidBy.value = bill.paidBy; form.elements.scope.value = bill.scope || 'individual'; form.elements.recurring.checked = Boolean(bill.recurrenceId); }
  if (bill) {
    form.elements.installments.value = bill.installmentCount || 1;
    if (bill.installmentPlanId) form.elements.description.value = bill.description.replace(/ \(\d+\/\d+\)$/, '');
  }
  updateBillScheduleFields();
  openDialog('#billDialog');
}
function updateBillScheduleFields() {
  const form = $('#billForm');
  const installments = Number(form.elements.installments.value) || 1;
  const editingInstallment = Boolean(form.dataset.editId && monthData.bills.find(item => item.id === form.dataset.editId)?.installmentPlanId);
  form.elements.installments.disabled = editingInstallment;
  form.elements.recurring.disabled = installments > 1 || editingInstallment;
  if (installments > 1 || editingInstallment) form.elements.recurring.checked = false;
  $('#billInstallmentsHelp').textContent = editingInstallment
    ? 'A quantidade original de parcelas não pode ser alterada.'
    : installments > 1
      ? `${installments} contas de ${form.elements.value.value || 'mesmo valor'}, uma por mês.`
      : 'Use 1 para uma conta sem parcelas. As demais vencem nos meses seguintes.';
}
function renderCards() {
  $('#cardList').innerHTML = appConfig.cards.length ? appConfig.cards.map(card => `<div class="card-item"><div><strong>${escapeHtml(card.name)}</strong><span>${ownerLabel(card.owner)} · fecha dia ${card.closingDay} · vence dia ${card.dueDay}</span></div><button type="button" data-card-remove="${card.id}" aria-label="Excluir ${escapeHtml(card.name)}">×</button></div>`).join('') : '<div class="bill-empty">Nenhum cartão cadastrado.</div>';
  $('#installmentCardSelect').innerHTML = appConfig.cards.map(card => `<option value="${card.id}">${escapeHtml(card.name)} · ${ownerLabel(card.owner)}</option>`).join('');
}
function openCards() { renderCards(); openDialog('#cardsDialog'); }
function openInstallment() {
  if (!ensureOpenMonth()) return; renderCards();
  if (!appConfig.cards.length) { toast('Cadastre um cartão primeiro'); openCards(); return; }
  const form = $('#installmentForm'); form.reset(); form.elements.purchaseDate.valueAsDate = today; openDialog('#installmentDialog');
}
function openCloseMonth() {
  if (monthData.status === 'closed') { reopenMonth(); return; }
  const summary = totals(), balances = ownerTotals();
  $('#closeMonthSummary').innerHTML = `<dl><div><dt>Saldo final</dt><dd>${money(summary.balance)}</dd></div><div><dt>Contas pendentes</dt><dd>${money(pendingBillsTotal())}</dd></div><div><dt>Nicolas</dt><dd>${money(balances['Você'])}</dd></div><div><dt>Isabella</dt><dd>${money(balances.Namorada)}</dd></div><div><dt>Compartilhado</dt><dd>${money(balances.Casal)}</dd></div></dl>`;
  setFormCurrency($('#closeMonthForm').elements.savedAmount, monthData.savingsGoal); openDialog('#closeMonthDialog');
}
function reopenMonth() {
  if (!confirm('Reabrir este mês para edição?')) return;
  const nextKey = addMonths(monthKey(), 1), next = readMonth(nextKey);
  if (next.openingFrom === monthKey()) { next.openingBalances = { 'Você': 0, Namorada: 0, Casal: 0 }; next.openingFrom = null; next.budget = monthlyIncomeTotal(next); next.bills = next.bills.filter(bill => bill.carriedFrom !== monthKey()); writeMonth(nextKey, next); }
  monthData.status = 'open'; monthData.closedAt = null; saveLocal(false); render(); toast('Mês reaberto');
}

function setSyncState(message, stale = false) {
  $('#syncText').textContent = message;
  $('#syncDot').classList.toggle('is-stale', stale);
}

function configuredForSupabase() {
  let validUrl = false;
  try { validUrl = new URL(SUPABASE_CONFIG.supabaseUrl).protocol === 'https:'; } catch (_) {}
  return validUrl && Boolean(SUPABASE_CONFIG.supabaseAnonKey)
    && !String(SUPABASE_CONFIG.supabaseAnonKey).includes('SUA_CHAVE')
    && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(SUPABASE_CONFIG.authEmail || '');
}

function localMonthKeys() {
  const keys = [];
  for (let index = 0; index < localStorage.length; index++) {
    const match = localStorage.key(index)?.match(/^nosso-caixa:(\d{4}-\d{2})$/);
    if (match) keys.push(match[1]);
  }
  return [...new Set(keys)].sort();
}

function newerThan(first, second) {
  return new Date(first || 0).getTime() > new Date(second || 0).getTime();
}

async function saveMonthRemote(key) {
  if (!supabaseClient || !currentUser || !navigator.onLine) { setSyncState('Sem conexão — salvo neste aparelho', true); return; }
  const data = readMonth(key);
  if (!hasMonthValues(data)) return;
  const { error } = await supabaseClient.from('monthly_data').upsert({ user_id: currentUser.id, month: key, data, updated_at: data.updatedAt || new Date().toISOString() });
  if (error) throw error;
  setSyncState('Salvo no Supabase');
}

async function saveConfigRemote() {
  if (!supabaseClient || !currentUser || !navigator.onLine) { setSyncState('Sem conexão — salvo neste aparelho', true); return; }
  const { error } = await supabaseClient.from('app_config').upsert({ user_id: currentUser.id, data: appConfig, updated_at: appConfig.updatedAt || new Date().toISOString() });
  if (error) throw error;
  setSyncState('Salvo no Supabase');
}

function scheduleRemoteSync(name, action, delay = 700) {
  if (!currentUser) return;
  clearTimeout(remoteSyncTimers.get(name));
  setSyncState(navigator.onLine ? 'Salvando no Supabase...' : 'Sem conexão — salvo neste aparelho', !navigator.onLine);
  remoteSyncTimers.set(name, setTimeout(async () => {
    remoteSyncTimers.delete(name);
    try { await action(); }
    catch (error) { setSyncState('Não foi possível sincronizar', true); console.error(error); }
  }, delay));
}

function scheduleMonthSync(key, delay = 700) { scheduleRemoteSync(`month:${key}`, () => saveMonthRemote(key), delay); }
function scheduleConfigSync(delay = 700) { scheduleRemoteSync('config', saveConfigRemote, delay); }

async function reconcileSupabase({ silent = false } = {}) {
  if (!supabaseClient || !currentUser) return;
  setSyncState('Sincronizando...');
  try {
    const [monthsResult, configResult] = await Promise.all([
      supabaseClient.from('monthly_data').select('month,data,updated_at').eq('user_id', currentUser.id),
      supabaseClient.from('app_config').select('data,updated_at').eq('user_id', currentUser.id).maybeSingle()
    ]);
    if (monthsResult.error) throw monthsResult.error;
    if (configResult.error) throw configResult.error;

    const remoteMonths = new Map((monthsResult.data || []).map(row => [row.month, row]));
    const allMonths = new Set([...localMonthKeys(), ...remoteMonths.keys()]);
    const uploads = [];
    allMonths.forEach(key => {
      const localRaw = safeJson(localStorage.getItem(storageKey(key)), null), remote = remoteMonths.get(key);
      if (remote && (!localRaw || newerThan(remote.updated_at, localRaw.updatedAt))) {
        const data = normalizeMonth({ ...remote.data, updatedAt: remote.data?.updatedAt || remote.updated_at }, key);
        localStorage.setItem(storageKey(key), JSON.stringify(data));
      } else if (localRaw) {
        const data = normalizeMonth(localRaw, key);
        if (hasMonthValues(data) && (!remote || newerThan(data.updatedAt, remote.updated_at))) uploads.push({ user_id: currentUser.id, month: key, data, updated_at: data.updatedAt || new Date().toISOString() });
      }
    });
    if (uploads.length) {
      const { error } = await supabaseClient.from('monthly_data').upsert(uploads);
      if (error) throw error;
    }

    const remoteConfig = configResult.data;
    if (remoteConfig && newerThan(remoteConfig.updated_at, appConfig.updatedAt)) {
      appConfig = loadConfigFrom({ ...remoteConfig.data, updatedAt: remoteConfig.data?.updatedAt || remoteConfig.updated_at });
      localStorage.setItem(CONFIG_KEY, JSON.stringify(appConfig));
    } else if (!remoteConfig || newerThan(appConfig.updatedAt, remoteConfig.updated_at)) {
      if (!appConfig.updatedAt) appConfig.updatedAt = new Date().toISOString();
      await saveConfigRemote();
    }

    loadMonth(); renderCards(); syncRoute(); setSyncState('Salvo no Supabase');
    if (!silent) toast('Dados sincronizados');
  } catch (error) {
    setSyncState(navigator.onLine ? 'Erro ao conectar ao Supabase' : 'Sem conexão — usando dados deste aparelho', true);
    if (!monthData) { loadMonth(); renderCards(); syncRoute(); }
    if (!silent) toast(error.message || 'Não foi possível sincronizar');
    console.error(error);
  }
}

function subscribeToChanges() {
  if (!supabaseClient || !currentUser) return;
  if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
  realtimeChannel = supabaseClient.channel(`finance-${currentUser.id}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'monthly_data', filter: `user_id=eq.${currentUser.id}` }, payload => {
      const row = payload.new;
      if (!row?.month || !row.data) return;
      const local = safeJson(localStorage.getItem(storageKey(row.month)), {});
      if (!newerThan(row.updated_at, local.updatedAt)) return;
      localStorage.setItem(storageKey(row.month), JSON.stringify(normalizeMonth({ ...row.data, updatedAt: row.data.updatedAt || row.updated_at }, row.month)));
      if (row.month === monthKey()) { monthData = readMonth(row.month); render(); }
      setSyncState('Atualizado pelo Supabase');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'app_config', filter: `user_id=eq.${currentUser.id}` }, payload => {
      const row = payload.new;
      if (!row?.data || !newerThan(row.updated_at, appConfig.updatedAt)) return;
      appConfig = loadConfigFrom({ ...row.data, updatedAt: row.data.updatedAt || row.updated_at });
      localStorage.setItem(CONFIG_KEY, JSON.stringify(appConfig));
      renderCards();
      setSyncState('Atualizado pelo Supabase');
    })
    .subscribe();
}

async function enterApp(user) {
  currentUser = user;
  localStorage.removeItem('nosso-caixa:github');
  localStorage.removeItem('nosso-caixa:github-token');
  sessionStorage.removeItem('nosso-caixa:token');
  document.body.classList.remove('auth-pending');
  document.body.classList.add('is-authenticated');
  $('#authGate').hidden = true;
  await reconcileSupabase({ silent: true });
  subscribeToChanges();
}

function showAuthMessage(message, error = false) {
  $('#authDescription').textContent = message;
  $('#pinForm').hidden = error;
  $('#pinError').hidden = true;
}

async function initializeSupabase() {
  if (!configuredForSupabase()) {
    showAuthMessage('Preencha a URL, a chave pública e o e-mail em supabase-config.js para concluir a configuração.', true);
    return;
  }
  if (!window.supabase?.createClient) {
    showAuthMessage('Não foi possível carregar a conexão com o Supabase. Verifique a internet e recarregue a página.', true);
    return;
  }
  supabaseClient = window.supabase.createClient(SUPABASE_CONFIG.supabaseUrl, SUPABASE_CONFIG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
  const { data, error } = await supabaseClient.auth.getSession();
  if (error) { showAuthMessage('Não foi possível recuperar a sessão. Digite o PIN novamente.'); return; }
  if (data.session?.user) await enterApp(data.session.user);
  else { document.body.classList.remove('auth-pending'); $('#pinInput').focus(); }
}

async function signOut() {
  remoteSyncTimers.forEach(timer => clearTimeout(timer)); remoteSyncTimers.clear();
  if (realtimeChannel) await supabaseClient.removeChannel(realtimeChannel);
  await supabaseClient?.auth.signOut();
  currentUser = null; realtimeChannel = null;
  document.body.classList.remove('is-authenticated');
  $('#authGate').hidden = false; $('#pinForm').hidden = false; $('#pinForm').reset();
  $('#authDescription').textContent = 'Digite o PIN para acessar os dados do casal.';
  $('#pinInput').focus();
}
function exportPdf() { exportPdf.previousTitle = document.title; document.title = `Nosso Caixa — ${$('#monthName').textContent} ${cursor.getFullYear()}`; toast('Escolha “Salvar como PDF” na janela de impressão'); setTimeout(() => window.print(), 250); }
function setMonth(delta) { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1); loadMonth(); }
function syncRoute() {
  const requested = location.hash.slice(1) || 'inicio', route = requested === 'movimentacoes' ? 'gastos' : requested, records = route === 'contas' || route === 'gastos', history = route === 'historico';
  $('[data-page="dashboard"]').hidden = records || history; $('[data-page="records"]').hidden = !records; $('[data-page="history"]').hidden = !history;
  $('#billsPanel').hidden = route !== 'contas'; $('#expensesPanel').hidden = route !== 'gastos'; $('#billsTab').setAttribute('aria-selected', String(route !== 'gastos')); $('#expensesTab').setAttribute('aria-selected', String(route === 'gastos'));
  const activeView = records ? 'lancamentos' : history ? 'historico' : route === 'planejamento' ? 'planejamento' : 'inicio';
  document.querySelectorAll('[data-view]').forEach(link => { const active = link.dataset.view === activeView; link.classList.toggle('is-active', active); active ? link.setAttribute('aria-current', 'page') : link.removeAttribute('aria-current'); });
  document.body.classList.toggle('records-mode', records || history); document.title = records ? 'Contas e gastos — Nosso Caixa' : history ? 'Histórico — Nosso Caixa' : 'Nosso Caixa';
  if (history) renderHistory(); else if (route === 'planejamento') requestAnimationFrame(() => $('#planejamento').scrollIntoView({ block: 'start' })); else if (!records) requestAnimationFrame(renderBalanceChart);
}

$('#openTransaction').addEventListener('click', () => openTransaction());
$('#openBill').addEventListener('click', () => openBill());
$('#quickExpense')?.addEventListener('click', () => openTransaction());
$('#quickIncome')?.addEventListener('click', () => { openTransaction(); $('#incomeType').checked = true; updateTransactionForm(); });
$('#quickBill')?.addEventListener('click', () => openBill());
$('#quickPlan')?.addEventListener('click', () => $('#editPlan').click());
$('#mobileAdd').addEventListener('click', () => { location.hash = 'gastos'; openTransaction(); });
$('#settingsButton').addEventListener('click', signOut);
$('#logoutButton').addEventListener('click', signOut);
$('#previousMonth').addEventListener('click', () => setMonth(-1));
$('#nextMonth').addEventListener('click', () => setMonth(1));
$('#monthPicker').addEventListener('click', () => toast('Use as setas para navegar entre os meses'));
$('#closeMonthButton').addEventListener('click', openCloseMonth);
$('#historyRange').addEventListener('change', renderHistory);
['#transactionSearch', '#transactionTypeFilter', '#transactionOwnerFilter', '#transactionCategoryFilter', '#transactionSort', '#transactionDateFrom', '#transactionDateTo'].forEach(selector => $(selector).addEventListener('input', renderTransactions));

$('#editPlan').addEventListener('click', () => {
  if (!ensureOpenMonth()) return;
  const form = $('#planForm'); setFormCurrency(form.yourBudget, monthData.monthlyIncome['Você']); setFormCurrency(form.partnerBudget, monthData.monthlyIncome.Namorada); setFormCurrency(form.goal, monthData.savingsGoal); openDialog('#planDialog');
});
document.querySelectorAll('#transactionForm input[name="type"], #transactionForm input[name="scope"]').forEach(input => input.addEventListener('change', updateTransactionForm));

$('#transactionForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault(); const formElement = event.currentTarget, form = new FormData(formElement), value = parseCurrency(form.get('value')), description = String(form.get('description') || '').trim();
  if (!description || !value || value < 0 || !form.get('date')) { toast('Preencha descrição, valor e data'); return; }
  const type = form.get('type'), data = { type, description, value, date: form.get('date'), category: type === 'income' ? 'Receita' : form.get('category'), paidBy: form.get('paidBy'), scope: type === 'income' ? 'individual' : form.get('scope'), splitYou: Number(form.get('splitYou')) || 50 };
  const editId = formElement.dataset.editId;
  if (editId) { const index = monthData.transactions.findIndex(item => item.id === editId); if (index >= 0) monthData.transactions[index] = { ...monthData.transactions[index], ...data }; }
  else monthData.transactions.push({ id: uid(), ...data });
  saveLocal(); render(); formElement.closest('dialog').close();
});

$('#transactionList').addEventListener('click', event => {
  const button = event.target.closest('button[data-transaction-action]'); if (!button || !ensureOpenMonth()) return;
  const transaction = monthData.transactions.find(item => item.id === button.dataset.id); if (!transaction) return;
  if (button.dataset.transactionAction === 'edit') { if (transaction.type === 'transfer') { toast('Acertos são corrigidos excluindo e registrando novamente'); return; } openTransaction(transaction); }
  if (button.dataset.transactionAction === 'duplicate') { const copy = { ...transaction, id: uid(), billId: null, date: `${monthKey()}-${String(Math.min(today.getDate(), new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate())).padStart(2, '0')}` }; monthData.transactions.push(copy); saveLocal(false); render(); toast('Movimentação duplicada'); }
  if (button.dataset.transactionAction === 'delete' && confirm(`Excluir “${transaction.description}”?`)) {
    if (transaction.billId) { const bill = monthData.bills.find(item => item.id === transaction.billId); if (bill) { bill.paid = false; bill.transactionId = null; } }
    monthData.transactions = monthData.transactions.filter(item => item.id !== transaction.id); saveLocal(false); render(); toast('Movimentação excluída');
  }
});

$('#billForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault(); const formElement = event.currentTarget, form = new FormData(formElement), value = parseCurrency(form.get('value')), dueDay = Number(form.get('dueDay')), description = String(form.get('description') || '').trim(), installments = Number(form.get('installments') || formElement.elements.installments.value || 1);
  if (!description || !value || value < 0 || dueDay < 1 || dueDay > 31 || installments < 1 || installments > 60) { toast('Preencha a conta, o valor, o vencimento e as parcelas'); return; }
  const data = { description, value, dueDay, category: form.get('category'), paidBy: form.get('paidBy'), scope: form.get('scope') || 'individual', splitYou: 50 }, editId = formElement.dataset.editId;
  if (editId) {
    const bill = monthData.bills.find(item => item.id === editId); if (!bill) return;
    Object.assign(bill, data, { description: bill.installmentPlanId ? `${description} (${bill.installmentNumber}/${bill.installmentCount})` : description });
    if (bill.transactionId) { const transaction = monthData.transactions.find(item => item.id === bill.transactionId); if (transaction) Object.assign(transaction, { description: bill.description, value, category: data.category, paidBy: data.paidBy, scope: data.scope, date: `${monthKey()}-${String(Math.min(dueDay, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate())).padStart(2, '0')}` }); }
    if (bill.installmentPlanId && confirm('Aplicar esta alteração também às próximas parcelas?')) { const plan = appConfig.installmentPlans.find(item => item.id === bill.installmentPlanId); if (plan) Object.assign(plan, data, { description, installmentValue: value, totalValue: value * plan.installments }); saveConfig(); }
    if (bill.recurrenceId && form.get('recurring') && confirm('Aplicar esta alteração também aos próximos meses?')) { const template = appConfig.recurringBills.find(item => item.id === bill.recurrenceId); if (template) Object.assign(template, data); saveConfig(); }
    if (!bill.recurrenceId && form.get('recurring')) { const recurrence = { id: uid(), ...data, startMonth: monthKey(), endMonth: null, active: true }; appConfig.recurringBills.push(recurrence); bill.recurrenceId = recurrence.id; bill.generatedMonth = monthKey(); saveConfig(); }
    if (bill.recurrenceId && !form.get('recurring')) { const template = appConfig.recurringBills.find(item => item.id === bill.recurrenceId); if (template) { template.active = false; template.endMonth = monthKey(); } delete bill.recurrenceId; delete bill.generatedMonth; saveConfig(); }
  } else {
    if (installments > 1) {
      appConfig.installmentPlans.push({ id: uid(), description, installmentValue: value, totalValue: value * installments, installments, firstMonth: monthKey(), dueDay, category: data.category, paidBy: data.paidBy, scope: data.scope, splitYou: 50 });
      saveConfig(); materializeScheduledItems();
    } else {
      const bill = { id: uid(), ...data, paid: false, transactionId: null };
      if (form.get('recurring')) { const recurrence = { id: uid(), ...data, startMonth: monthKey(), endMonth: null, active: true }; appConfig.recurringBills.push(recurrence); bill.recurrenceId = recurrence.id; bill.generatedMonth = monthKey(); saveConfig(); }
      monthData.bills.push(bill);
    }
  }
  saveLocal(false); render(); formElement.closest('dialog').close(); toast(editId ? 'Conta atualizada' : installments > 1 ? `${installments} parcelas programadas` : 'Conta adicionada ao mês');
});

$('#billForm').elements.installments.addEventListener('input', updateBillScheduleFields);
$('#billForm').elements.value.addEventListener('input', updateBillScheduleFields);
$('#billForm').elements.recurring.addEventListener('change', event => {
  if (event.target.checked) $('#billForm').elements.installments.value = 1;
  updateBillScheduleFields();
});

$('#billList').addEventListener('change', event => {
  const input = event.target.closest('input[data-bill-id]'); if (!input || !ensureOpenMonth()) return;
  const bill = monthData.bills.find(item => item.id === input.dataset.billId); if (!bill) return; bill.paid = input.checked;
  if (bill.paid) { bill.transactionId = uid(); monthData.transactions.push({ id: bill.transactionId, type: 'expense', description: bill.description, value: bill.value, date: `${monthKey()}-${String(Math.min(bill.dueDay, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate())).padStart(2, '0')}`, category: bill.category, paidBy: bill.paidBy, scope: bill.scope || 'individual', splitYou: bill.splitYou ?? 50, billId: bill.id }); }
  else if (bill.transactionId) { monthData.transactions = monthData.transactions.filter(item => item.id !== bill.transactionId); bill.transactionId = null; }
  saveLocal(false); render(); toast(bill.paid ? 'Conta marcada como paga' : 'Conta voltou para pendente');
});

$('#billList').addEventListener('click', event => {
  const button = event.target.closest('button[data-bill-action]'); if (!button || !ensureOpenMonth()) return;
  const bill = monthData.bills.find(item => item.id === button.dataset.id); if (!bill) return;
  if (button.dataset.billAction === 'edit') openBill(bill);
  if (button.dataset.billAction === 'delete' && confirm(`Excluir “${bill.description}” deste mês?`)) {
    if (bill.recurrenceId && confirm('Encerrar também a recorrência nos próximos meses?')) { const template = appConfig.recurringBills.find(item => item.id === bill.recurrenceId); if (template) { template.active = false; template.endMonth = addMonths(monthKey(), -1); } saveConfig(); }
    if (bill.installmentPlanId && confirm('Excluir também as parcelas dos próximos meses?')) { appConfig.installmentPlans = appConfig.installmentPlans.filter(item => item.id !== bill.installmentPlanId); saveConfig(); }
    monthData.bills = monthData.bills.filter(item => item.id !== bill.id); if (bill.transactionId) monthData.transactions = monthData.transactions.filter(item => item.id !== bill.transactionId);
    saveLocal(false); render(); toast('Conta excluída');
  }
});

$('#planForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault(); const form = new FormData(event.currentTarget), yourBudget = parseCurrency(form.get('yourBudget')) || 0, partnerBudget = parseCurrency(form.get('partnerBudget')) || 0;
  if (yourBudget < 0 || partnerBudget < 0) { toast('Informe valores válidos para o planejamento'); return; }
  monthData.monthlyIncome['Você'] = yourBudget; monthData.monthlyIncome.Namorada = partnerBudget; monthData.budget = yourBudget + partnerBudget; monthData.savingsGoal = parseCurrency(form.get('goal')) || 0;
  saveLocal(false); render(); event.currentTarget.closest('dialog').close(); toast('Planejamento atualizado');
});

$('#cardForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault(); const form = new FormData(event.currentTarget), closingDay = Number(form.get('closingDay')), dueDay = Number(form.get('dueDay'));
  if (closingDay < 1 || closingDay > 31 || dueDay < 1 || dueDay > 31) { toast('Informe dias de fechamento e vencimento válidos'); return; }
  appConfig.cards.push({ id: uid(), name: String(form.get('name')).trim(), owner: form.get('owner'), closingDay, dueDay }); saveConfig(); event.currentTarget.reset(); renderCards(); toast('Cartão adicionado');
});
$('#cardList').addEventListener('click', event => {
  const button = event.target.closest('button[data-card-remove]'); if (!button) return; const card = appConfig.cards.find(item => item.id === button.dataset.cardRemove);
  if (!card || !confirm(`Excluir o cartão “${card.name}”? As parcelas existentes serão mantidas.`)) return;
  appConfig.cards = appConfig.cards.filter(item => item.id !== card.id); saveConfig(); renderCards();
});

$('#installmentForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault(); const form = new FormData(event.currentTarget), card = appConfig.cards.find(item => item.id === form.get('cardId')), totalValue = parseCurrency(form.get('value')), installments = Number(form.get('installments')), purchaseDate = new Date(`${form.get('purchaseDate')}T12:00:00`);
  if (!card || !totalValue || installments < 2 || installments > 60 || Number.isNaN(purchaseDate.getTime())) { toast('Confira o cartão, valor, parcelas e data'); return; }
  const purchaseMonth = monthKey(purchaseDate), firstMonth = Number(String(form.get('purchaseDate')).slice(8, 10)) > card.closingDay ? addMonths(purchaseMonth, 1) : purchaseMonth;
  appConfig.installmentPlans.push({ id: uid(), cardId: card.id, cardName: card.name, dueDay: card.dueDay, paidBy: card.owner, description: String(form.get('description')).trim(), category: form.get('category'), totalValue, installments, purchaseDate: form.get('purchaseDate'), firstMonth, scope: form.get('scope'), splitYou: 50 });
  saveConfig(); materializeScheduledItems(); saveLocal(false); render(); event.currentTarget.closest('dialog').close(); toast(`${installments} parcelas criadas`);
});

$('#closeMonthForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault(); const form = new FormData(event.currentTarget), balances = ownerTotals(), nextKey = addMonths(monthKey(), 1), next = readMonth(nextKey);
  if (hasMonthValues(next) && next.openingFrom !== monthKey() && !confirm(`O mês ${formatMonthLabel(nextKey)} já possui dados. Atualizar seus saldos iniciais?`)) return;
  next.openingBalances = { ...balances }; next.openingFrom = monthKey(); next.budget = monthlyIncomeTotal(next);
  if (form.get('carryPending')) monthData.bills.filter(bill => !bill.paid).forEach(bill => { const id = `carry-${bill.id}-${nextKey}`; if (!next.bills.some(item => item.id === id)) next.bills.push({ ...bill, id, paid: false, transactionId: null, recurrenceId: null, generatedMonth: null, carriedFrom: monthKey() }); });
  writeMonth(nextKey, next); monthData.savedAmount = Math.max(0, parseCurrency(form.get('savedAmount')) || 0); monthData.status = 'closed'; monthData.closedAt = new Date().toISOString();
  saveLocal(false); render(); event.currentTarget.closest('dialog').close(); toast('Mês fechado e saldo preparado para o próximo');
});

$('#recordSettlement').addEventListener('click', () => {
  if (!ensureOpenMonth()) return; const net = settlementBalance(); if (!net) return;
  const from = net > 0 ? 'Namorada' : 'Você', to = net > 0 ? 'Você' : 'Namorada';
  $('#settlementDetail').innerHTML = `<strong>${ownerLabel(from)} transfere ${money(Math.abs(net))} para ${ownerLabel(to)}</strong>`;
  const form = $('#settlementForm'); form.dataset.from = from; form.dataset.to = to; form.dataset.value = String(Math.abs(net)); form.elements.date.valueAsDate = today; openDialog('#settlementDialog');
});
$('#settlementForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault(); const form = event.currentTarget;
  monthData.transactions.push({ id: uid(), type: 'transfer', description: 'Acerto do casal', value: Number(form.dataset.value), date: form.elements.date.value, category: 'Transferência', from: form.dataset.from, to: form.dataset.to, paidBy: form.dataset.from });
  saveLocal(false); render(); form.closest('dialog').close(); toast('Acerto registrado');
});

$('#pinForm').addEventListener('submit', async event => {
  event.preventDefault();
  const pin = String(new FormData(event.currentTarget).get('pin') || '');
  const errorElement = $('#pinError'), button = $('#pinSubmit');
  if (!/^\d{6}$/.test(pin)) { errorElement.textContent = 'Digite os 6 números do PIN.'; errorElement.hidden = false; return; }
  errorElement.hidden = true; button.disabled = true; button.textContent = 'Entrando...';
  let authenticatedUser = null;
  try {
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: SUPABASE_CONFIG.authEmail, password: pin });
    authenticatedUser = data?.session?.user || data?.user || null;
    if (!authenticatedUser) {
      const { data: sessionData } = await supabaseClient.auth.getSession();
      authenticatedUser = sessionData.session?.user || null;
    }
    if (!authenticatedUser) throw error || new Error('Acesso não autorizado');
  } catch (error) {
    console.error(error);
    errorElement.textContent = 'PIN incorreto. Confira os 6 números e tente novamente.';
    errorElement.hidden = false; $('#pinInput').select();
    button.disabled = false; button.textContent = 'Entrar';
    return;
  }

  event.currentTarget.reset();
  try { await enterApp(authenticatedUser); }
  catch (error) {
    console.error(error);
    if (!monthData) { loadMonth(); renderCards(); syncRoute(); }
    toast('Sessão iniciada; alguns dados ainda estão carregando');
  } finally { button.disabled = false; button.textContent = 'Entrar'; }
});

window.addEventListener('resize', () => { if (monthData) requestAnimationFrame(renderBalanceChart); });
window.addEventListener('hashchange', () => { if (monthData) syncRoute(); });
window.addEventListener('beforeprint', () => { if (monthData) render(); });
window.addEventListener('afterprint', () => { document.title = exportPdf.previousTitle || 'Nosso Caixa'; });
window.addEventListener('online', () => { if (currentUser) reconcileSupabase({ silent: true }); });
window.addEventListener('offline', () => { if (currentUser) setSyncState('Sem conexão — salvo neste aparelho', true); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && currentUser && navigator.onLine) reconcileSupabase({ silent: true }); });

const categoryOptions = Object.keys(CATEGORIES).filter(category => category !== 'Receita').map(category => `<option>${category}</option>`).join('');
$('#categorySelect').innerHTML = categoryOptions; $('#billCategorySelect').innerHTML = categoryOptions; $('#installmentCategorySelect').innerHTML = categoryOptions;
$('#transactionCategoryFilter').innerHTML = `<option value="">Todas</option>${categoryOptions}<option>Receita</option><option>Transferência</option>`;
initializeSupabase();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
