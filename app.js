const CATEGORIES = {
  Moradia: { color: '#2962ff', icon: '⌂' },
  Alimentação: { color: '#0c9273', icon: '◒' },
  Transporte: { color: '#e15c47', icon: '◇' },
  Lazer: { color: '#8c62d6', icon: '☆' },
  Saúde: { color: '#df9e2f', icon: '+' },
  Outros: { color: '#778397', icon: '•' },
  Receita: { color: '#0c9273', icon: '↗' }
};

const today = new Date();
let cursor = new Date(today.getFullYear(), today.getMonth(), 1);
let showAll = false;
let monthData = null;

const demoTransactions = [
  ['2026-09-02', 'income', 'Salário', 'Receita', 620000, 'Você'],
  ['2026-09-03', 'income', 'Contribuição da parceira', 'Receita', 410000, 'Namorada'],
  ['2026-09-05', 'expense', 'Aluguel', 'Moradia', 240000, 'Casal'],
  ['2026-09-08', 'expense', 'Mercado da semana', 'Alimentação', 48760, 'Você'],
  ['2026-09-12', 'expense', 'Conta de energia', 'Moradia', 19640, 'Namorada'],
  ['2026-09-15', 'expense', 'Combustível', 'Transporte', 22000, 'Você'],
  ['2026-09-19', 'expense', 'Jantar', 'Lazer', 14890, 'Casal'],
  ['2026-09-23', 'expense', 'Farmácia', 'Saúde', 7860, 'Namorada']
].map((item, index) => ({ id: `demo-${index}`, date: item[0], type: item[1], description: item[2], category: item[3], value: item[4], paidBy: item[5] }));

const $ = (selector) => document.querySelector(selector);
const money = (cents, digits = 2) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: digits, maximumFractionDigits: digits }).format(cents / 100);
const monthKey = () => `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`;
const storageKey = () => `nosso-caixa:${monthKey()}`;
const emptyMonth = () => ({ version: 3, month: monthKey(), budget: 0, savingsGoal: 0, openingBalance: 0, openingBalances: { 'Você': 0, Namorada: 0 }, bills: [], transactions: [] });

function normalizeMonth(data) {
  const normalized = { ...emptyMonth(), ...data };
  if (!data.openingBalances) {
    const hasIncome = (normalized.transactions || []).some(transaction => transaction.type === 'income');
    normalized.openingBalances = {
      'Você': !hasIncome && !normalized.openingBalance ? normalized.budget || 0 : 0,
      Namorada: 0
    };
  }
  normalized.openingBalances['Você'] = Number(normalized.openingBalances['Você']) || 0;
  normalized.openingBalances.Namorada = Number(normalized.openingBalances.Namorada) || 0;
  normalized.bills = Array.isArray(normalized.bills) ? normalized.bills : [];
  normalized.budget = normalized.openingBalances['Você'] + normalized.openingBalances.Namorada;
  normalized.version = 3;
  return normalized;
}

function loadMonth() {
  const stored = localStorage.getItem(storageKey());
  monthData = normalizeMonth(stored ? JSON.parse(stored) : emptyMonth());
  if (!stored && monthKey() === '2026-09' && new URLSearchParams(location.search).has('demo')) {
    monthData.openingBalances = { 'Você': 400000, Namorada: 300000 };
    monthData.budget = 700000;
    monthData.savingsGoal = 100000;
    monthData.transactions = demoTransactions;
  }
  if (!stored || JSON.stringify(JSON.parse(stored)) !== JSON.stringify(monthData)) {
    monthData.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(), JSON.stringify(monthData));
  }
  render();
}

function saveLocal(feedback = true) {
  monthData.updatedAt = new Date().toISOString();
  localStorage.setItem(storageKey(), JSON.stringify(monthData));
  $('#syncText').textContent = 'Alterações salvas neste aparelho';
  if (feedback) toast('Movimentação salva neste aparelho');
}

function totals() {
  const income = monthData.transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + t.value, 0);
  const expense = monthData.transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + t.value, 0);
  const plannedMoney = monthData.openingBalances['Você'] + monthData.openingBalances.Namorada;
  return { income, expense, balance: monthData.openingBalance + plannedMoney + income - expense };
}

function ownerTotals() {
  const balances = {
    'Você': monthData.openingBalances['Você'],
    Namorada: monthData.openingBalances.Namorada,
    Casal: monthData.openingBalance || 0
  };
  monthData.transactions.forEach(transaction => {
    const owner = balances[transaction.paidBy] === undefined ? 'Casal' : transaction.paidBy;
    balances[owner] += transaction.type === 'income' ? transaction.value : -transaction.value;
  });
  return balances;
}

function pendingBillsTotal() {
  return monthData.bills.filter(bill => !bill.paid).reduce((sum, bill) => sum + bill.value, 0);
}

function render() {
  const label = cursor.toLocaleDateString('pt-BR', { month: 'long' });
  $('#monthName').textContent = label.charAt(0).toUpperCase() + label.slice(1);
  $('#yearName').textContent = cursor.getFullYear();
  const { income, expense, balance } = totals();
  $('#balanceValue').textContent = money(balance);
  $('#incomeValue').textContent = money(income);
  $('#expenseValue').textContent = money(expense);
  const balances = ownerTotals();
  $('#yourBalance').textContent = money(balances['Você']);
  $('#partnerBalance').textContent = money(balances.Namorada);
  $('#sharedBalance').textContent = money(balances.Casal);
  $('#yourBalance').classList.toggle('is-negative', balances['Você'] < 0);
  $('#partnerBalance').classList.toggle('is-negative', balances.Namorada < 0);
  $('#sharedBalance').classList.toggle('is-negative', balances.Casal < 0);
  const committed = expense + pendingBillsTotal();
  $('#balanceDelta').textContent = committed <= monthData.budget ? `${money(monthData.budget - committed)} livres após as contas` : `${money(committed - monthData.budget)} acima do plano`;
  renderWeeks(expense, committed);
  renderCategories(expense);
  renderTransactions();
  renderPlan(committed);
  renderBills();
  renderFreshness();
  requestAnimationFrame(renderBalanceChart);
}

function renderFreshness() {
  const elapsed = Date.now() - new Date(monthData.updatedAt || 0).getTime();
  const days = Math.max(0, Math.floor(elapsed / 86400000));
  const stale = days >= 7;
  $('#syncDot').classList.toggle('is-stale', stale);
  $('#syncText').textContent = stale ? 'Hora da revisão semanal' : days === 0 ? 'Atualizado hoje' : `Atualizado há ${days} ${days === 1 ? 'dia' : 'dias'}`;
}

function renderWeeks(totalExpense, committed) {
  const weeks = [0, 0, 0, 0, 0];
  monthData.transactions.filter(t => t.type === 'expense').forEach(t => {
    const day = Number(t.date.slice(-2));
    weeks[Math.min(4, Math.floor((day - 1) / 7))] += t.value;
  });
  const max = Math.max(...weeks, monthData.budget / 4, 1);
  const currentWeek = cursor.getMonth() === today.getMonth() && cursor.getFullYear() === today.getFullYear() ? Math.min(4, Math.floor((today.getDate() - 1) / 7)) : -1;
  $('#weekList').innerHTML = weeks.map((value, index) => `<div class="week-item ${index === currentWeek ? 'current' : ''}"><span>Semana ${index + 1}</span><div class="bar-track"><i style="width:${Math.min(100, value / max * 100)}%"></i></div><strong>${money(value, 0)}</strong></div>`).join('');
  const over = committed > monthData.budget;
  $('#budgetChip').textContent = over ? 'Acima do planejado' : 'Dentro do planejado';
  $('#budgetChip').classList.toggle('is-alert', over);
}

function renderCategories(totalExpense) {
  const grouped = {};
  monthData.transactions.filter(t => t.type === 'expense').forEach(t => grouped[t.category] = (grouped[t.category] || 0) + t.value);
  const rows = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
  let angle = 0;
  const segments = rows.map(([name, value]) => {
    const start = angle;
    angle += totalExpense ? value / totalExpense * 100 : 0;
    return `${CATEGORIES[name]?.color || CATEGORIES.Outros.color} ${start}% ${angle}%`;
  });
  $('#categoryDonut').style.background = segments.length ? `conic-gradient(${segments.join(',')})` : '#e9edf1';
  $('#categoryTotal').textContent = money(totalExpense, 0);
  $('#categoryLegend').innerHTML = rows.slice(0, 5).map(([name, value]) => `<li><i style="background:${CATEGORIES[name]?.color || CATEGORIES.Outros.color}"></i><span>${name}</span><strong>${totalExpense ? Math.round(value / totalExpense * 100) : 0}%</strong></li>`).join('') || '<li><span>As categorias aparecerão aqui.</span></li>';
}

function renderTransactions() {
  const sorted = [...monthData.transactions].sort((a, b) => b.date.localeCompare(a.date));
  const visible = showAll ? sorted : sorted.slice(0, 5);
  $('#transactionCount').textContent = `${sorted.length} ${sorted.length === 1 ? 'lançamento' : 'lançamentos'} neste mês`;
  $('#showAllButton').hidden = sorted.length <= 5;
  $('#showAllButton').textContent = showAll ? 'Ver recentes' : 'Ver todas';
  $('#transactionList').innerHTML = visible.length ? visible.map(t => {
    const date = new Date(`${t.date}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
    const config = CATEGORIES[t.category] || CATEGORIES.Outros;
    const ownerLabel = t.paidBy === 'Você' ? 'Seu' : t.paidBy === 'Namorada' ? 'Dela' : 'Compartilhado';
    const ownerClass = t.paidBy === 'Você' ? 'you' : t.paidBy === 'Namorada' ? 'partner' : 'shared';
    return `<article class="transaction-item"><span class="transaction-icon" style="color:${config.color};background:${config.color}14">${config.icon}</span><div class="transaction-main"><strong>${escapeHtml(t.description)}</strong><span>${t.category} <i class="owner-pill ${ownerClass}">${ownerLabel}</i> ${date}</span></div><span class="transaction-value ${t.type}">${t.type === 'income' ? '+' : '−'} ${money(t.value)}</span></article>`;
  }).join('') : '<div class="empty-state"><strong>O mês está pronto para começar.</strong><br>Inclua a primeira movimentação.</div>';
}

function renderPlan(committed) {
  const percent = monthData.budget ? Math.round(committed / monthData.budget * 100) : 0;
  $('#planGauge').style.setProperty('--progress', `${Math.min(100, percent)}%`);
  $('#planPercent').textContent = `${percent}%`;
  $('#remainingBudget').textContent = money(Math.max(0, monthData.budget - committed));
  $('#goalValue').textContent = money(monthData.savingsGoal);
}

function renderBills() {
  const sorted = [...monthData.bills].sort((a, b) => Number(a.paid) - Number(b.paid) || a.dueDay - b.dueDay);
  const pending = sorted.filter(bill => !bill.paid);
  const pendingTotal = pending.reduce((sum, bill) => sum + bill.value, 0);
  $('#billsSummary').textContent = sorted.length ? `${pending.length} ${pending.length === 1 ? 'pendente' : 'pendentes'} · ${money(pendingTotal)}` : 'Nenhuma conta cadastrada';
  $('#billList').innerHTML = sorted.length ? sorted.map(bill => {
    const ownerLabel = bill.paidBy === 'Você' ? 'Seu saldo' : bill.paidBy === 'Namorada' ? 'Saldo dela' : 'Saldo compartilhado';
    return `<article class="bill-item ${bill.paid ? 'is-paid' : ''}">
      <label class="bill-check" aria-label="Marcar ${escapeHtml(bill.description)} como ${bill.paid ? 'pendente' : 'paga'}">
        <input type="checkbox" data-bill-id="${bill.id}" ${bill.paid ? 'checked' : ''}><span aria-hidden="true">✓</span>
      </label>
      <div class="bill-main"><strong>${escapeHtml(bill.description)}</strong><span>Vence dia ${bill.dueDay} · ${escapeHtml(bill.category)} · ${ownerLabel}</span></div>
      <div class="bill-value"><strong>${money(bill.value)}</strong><span>${bill.paid ? 'Paga' : 'Pendente'}</span></div>
      <button class="bill-remove" type="button" data-bill-remove="${bill.id}" aria-label="Excluir ${escapeHtml(bill.description)}">×</button>
    </article>`;
  }).join('') : '<div class="bill-empty"><strong>Cadastre faturas e contas fixas.</strong><br>Elas entram no valor comprometido do mês.</div>';
}

function renderBalanceChart() {
  const canvas = $('#balanceChart');
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, rect.width * dpr);
  canvas.height = Math.max(1, rect.height * dpr);
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const initialBalance = monthData.openingBalance + monthData.openingBalances['Você'] + monthData.openingBalances.Namorada;
  const values = [initialBalance];
  let running = initialBalance;
  [...monthData.transactions].sort((a,b) => a.date.localeCompare(b.date)).forEach(t => { running += t.type === 'income' ? t.value : -t.value; values.push(running); });
  if (values.length === 1) values.push(values[0]);
  const min = Math.min(...values), max = Math.max(...values), spread = Math.max(1, max - min);
  const points = values.map((v, i) => ({ x: i / (values.length - 1) * rect.width, y: rect.height - 12 - ((v - min) / spread) * (rect.height - 28) }));
  const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
  gradient.addColorStop(0, 'rgba(85,214,181,.30)'); gradient.addColorStop(1, 'rgba(85,214,181,0)');
  ctx.beginPath(); ctx.moveTo(points[0].x, rect.height); points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(points.at(-1).x, rect.height); ctx.closePath(); ctx.fillStyle = gradient; ctx.fill();
  ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.strokeStyle = '#55d6b5'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
}

function parseCurrency(value) {
  const normalized = String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
  return Math.round(Number(normalized) * 100);
}

function escapeHtml(value) { const div = document.createElement('div'); div.textContent = value; return div.innerHTML; }
function toast(message) { const el = $('#toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toast.timer); toast.timer = setTimeout(() => el.classList.remove('show'), 2600); }
function openDialog(id) { const dialog = $(id); if (!dialog.open) dialog.showModal(); }

async function syncGithub() {
  const settings = JSON.parse(localStorage.getItem('nosso-caixa:github') || '{}');
  const token = sessionStorage.getItem('nosso-caixa:token');
  if (!settings.owner || !settings.repo || !token) { openSettings(); toast('Informe a conexão com o GitHub'); return; }
  const button = $('#syncButton'); button.disabled = true; button.querySelector('span:last-child').textContent = 'Salvando...';
  try {
    const path = `dados/${cursor.getFullYear()}/${monthKey()}.json`;
    const url = `https://api.github.com/repos/${encodeURIComponent(settings.owner)}/${encodeURIComponent(settings.repo)}/contents/${path}`;
    const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' };
    const current = await fetch(`${url}?ref=${encodeURIComponent(settings.branch || 'main')}`, { headers });
    let sha;
    if (current.ok) {
      const remoteFile = await current.json();
      sha = remoteFile.sha;
      const decoded = decodeURIComponent(escape(atob(remoteFile.content.replace(/\s/g, ''))));
      const remoteData = JSON.parse(decoded);
      const remoteTime = new Date(remoteData.updatedAt || 0).getTime();
      const localTime = new Date(monthData.updatedAt || 0).getTime();
      if (remoteTime > localTime) {
        monthData = normalizeMonth(remoteData);
        localStorage.setItem(storageKey(), JSON.stringify(monthData));
        render();
        $('#syncText').textContent = 'Dados carregados do GitHub';
        toast('A versão mais recente foi carregada do GitHub');
        return;
      }
      if (remoteFile.content.replace(/\s/g, '') === btoa(unescape(encodeURIComponent(JSON.stringify(monthData, null, 2))))) {
        $('#syncText').textContent = 'Sincronizado com o GitHub';
        toast('Tudo já está sincronizado');
        return;
      }
    }
    else if (current.status !== 404) throw new Error(`GitHub respondeu ${current.status}`);
    const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(monthData, null, 2))));
    const response = await fetch(url, { method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Atualiza ${monthKey()}`, content: encoded, branch: settings.branch || 'main', ...(sha && { sha }) }) });
    if (!response.ok) throw new Error(`Não foi possível salvar (${response.status})`);
    $('#syncText').textContent = 'Sincronizado com o GitHub';
    toast('Mês sincronizado com o GitHub');
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.querySelector('span:last-child').textContent = 'Sincronizar'; }
}

function openSettings() {
  const settings = JSON.parse(localStorage.getItem('nosso-caixa:github') || '{}');
  const form = $('#settingsForm');
  form.owner.value = settings.owner || '';
  form.repo.value = settings.repo || '';
  form.branch.value = settings.branch || 'main';
  form.token.value = '';
  openDialog('#settingsDialog');
}

function exportPdf() {
  exportPdf.previousTitle = document.title;
  document.title = `Nosso Caixa — ${$('#monthName').textContent} ${cursor.getFullYear()}`;
  exportPdf.previousShowAll = showAll;
  showAll = true;
  renderTransactions();
  toast('Escolha “Salvar como PDF” na janela de impressão');
  setTimeout(() => window.print(), 250);
}

function setMonth(delta) { cursor = new Date(cursor.getFullYear(), cursor.getMonth() + delta, 1); showAll = false; loadMonth(); }

function updateOwnerPickerCopy() {
  const isIncome = $('#incomeType').checked;
  $('#ownerPickerLegend').textContent = isIncome ? 'De quem é esta entrada?' : 'De qual saldo sai este valor?';
  $('#ownerPickerHelp').textContent = isIncome ? 'O valor será somado ao saldo escolhido.' : 'O valor será descontado do saldo escolhido.';
}

$('#openTransaction').addEventListener('click', () => { updateOwnerPickerCopy(); openDialog('#transactionDialog'); });
$('#openBill').addEventListener('click', () => openDialog('#billDialog'));
$('#mobileAdd').addEventListener('click', () => { updateOwnerPickerCopy(); openDialog('#transactionDialog'); });
$('#settingsButton').addEventListener('click', openSettings);
$('#mobileSettings').addEventListener('click', openSettings);
$('#syncButton').addEventListener('click', syncGithub);
$('#exportButton').addEventListener('click', exportPdf);
$('#previousMonth').addEventListener('click', () => setMonth(-1));
$('#nextMonth').addEventListener('click', () => setMonth(1));
$('#monthPicker').addEventListener('click', () => toast('Use as setas para navegar entre os meses'));
$('#showAllButton').addEventListener('click', () => { showAll = !showAll; renderTransactions(); });
$('#editPlan').addEventListener('click', () => {
  $('#planForm').yourBudget.value = (monthData.openingBalances['Você'] / 100).toFixed(2).replace('.', ',');
  $('#planForm').partnerBudget.value = (monthData.openingBalances.Namorada / 100).toFixed(2).replace('.', ',');
  $('#planForm').goal.value = (monthData.savingsGoal / 100).toFixed(2).replace('.', ',');
  openDialog('#planDialog');
});
document.querySelectorAll('input[name="type"]').forEach(input => input.addEventListener('change', updateOwnerPickerCopy));

$('#transactionForm').addEventListener('submit', event => {
  const submitter = event.submitter;
  if (submitter?.value === 'cancel') return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const value = parseCurrency(form.get('value'));
  if (!value || value < 0) { toast('Informe um valor válido'); return; }
  monthData.transactions.push({ id: crypto.randomUUID(), type: form.get('type'), description: form.get('description').trim(), value, date: form.get('date'), category: form.get('type') === 'income' ? 'Receita' : form.get('category'), paidBy: form.get('paidBy') });
  saveLocal(); render(); event.currentTarget.reset(); $('#expenseType').checked = true; $('#ownerYou').checked = true; updateOwnerPickerCopy(); event.currentTarget.closest('dialog').close();
});

$('#billForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const value = parseCurrency(form.get('value'));
  const dueDay = Number(form.get('dueDay'));
  if (!form.get('description').trim() || !value || value < 0 || dueDay < 1 || dueDay > 31) { toast('Preencha a conta, o valor e o vencimento'); return; }
  monthData.bills.push({ id: crypto.randomUUID(), description: form.get('description').trim(), value, dueDay, category: form.get('category'), paidBy: form.get('paidBy'), paid: false, transactionId: null });
  saveLocal(false); render(); event.currentTarget.reset(); $('#billOwnerYou').checked = true; event.currentTarget.closest('dialog').close(); toast('Conta adicionada ao mês');
});

$('#billList').addEventListener('change', event => {
  const input = event.target.closest('input[data-bill-id]');
  if (!input) return;
  const bill = monthData.bills.find(item => item.id === input.dataset.billId);
  if (!bill) return;
  bill.paid = input.checked;
  if (bill.paid) {
    bill.transactionId = crypto.randomUUID();
    monthData.transactions.push({ id: bill.transactionId, type: 'expense', description: bill.description, value: bill.value, date: `${monthKey()}-${String(Math.min(bill.dueDay, new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate())).padStart(2, '0')}`, category: bill.category, paidBy: bill.paidBy, billId: bill.id });
  } else if (bill.transactionId) {
    monthData.transactions = monthData.transactions.filter(transaction => transaction.id !== bill.transactionId);
    bill.transactionId = null;
  }
  saveLocal(false); render(); toast(bill.paid ? 'Conta marcada como paga' : 'Conta voltou para pendente');
});

$('#billList').addEventListener('click', event => {
  const button = event.target.closest('button[data-bill-remove]');
  if (!button) return;
  const bill = monthData.bills.find(item => item.id === button.dataset.billRemove);
  if (!bill || !confirm(`Excluir “${bill.description}” deste mês?`)) return;
  monthData.bills = monthData.bills.filter(item => item.id !== bill.id);
  if (bill.transactionId) monthData.transactions = monthData.transactions.filter(transaction => transaction.id !== bill.transactionId);
  saveLocal(false); render(); toast('Conta excluída do mês');
});

$('#planForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const yourBudget = parseCurrency(form.get('yourBudget')) || 0;
  const partnerBudget = parseCurrency(form.get('partnerBudget')) || 0;
  if (yourBudget < 0 || partnerBudget < 0) { toast('Informe valores válidos para o planejamento'); return; }
  monthData.openingBalances = { 'Você': yourBudget, Namorada: partnerBudget };
  monthData.budget = yourBudget + partnerBudget;
  monthData.savingsGoal = parseCurrency(form.get('goal')) || 0;
  saveLocal(false); render(); event.currentTarget.closest('dialog').close(); toast('Planejamento atualizado');
});

$('#settingsForm').addEventListener('submit', event => {
  if (event.submitter?.value === 'cancel') return;
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  localStorage.setItem('nosso-caixa:github', JSON.stringify({ owner: form.get('owner').trim(), repo: form.get('repo').trim(), branch: form.get('branch').trim() || 'main' }));
  if (form.get('token')) sessionStorage.setItem('nosso-caixa:token', form.get('token').trim());
  event.currentTarget.closest('dialog').close(); toast('Conexão configurada para esta sessão');
});

window.addEventListener('resize', () => requestAnimationFrame(renderBalanceChart));
window.addEventListener('beforeprint', render);
window.addEventListener('afterprint', () => { showAll = exportPdf.previousShowAll ?? showAll; document.title = exportPdf.previousTitle || 'Nosso Caixa'; renderTransactions(); });
const hour = new Date().getHours();
$('#greeting').textContent = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
$('#transactionForm').date.valueAsDate = today;
$('#categorySelect').innerHTML = Object.keys(CATEGORIES).filter(c => c !== 'Receita').map(c => `<option>${c}</option>`).join('');
$('#billCategorySelect').innerHTML = Object.keys(CATEGORIES).filter(c => c !== 'Receita').map(c => `<option>${c}</option>`).join('');
loadMonth();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
