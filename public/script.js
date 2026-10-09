let token = null;
const state = {
  user: null, posts: [], postId: null, companies: [], machines: [], operators: [],
  page: 'dashboard', operatorsEnabled: true, machineEditId: null, operatorEditId: null,
  historyFilter: 'Todos', historyFrom: '', historyTo: '', detailId: null, divergenceId: null, toastTimer: null,
  dashboardData: null, historyData: [], detailData: null,
  closing: { step: 1, date: '', values: {}, moneyExpected: '', moneyReceived: '', causes: {}, operators: {} },
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const money = (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const todayPt = () => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(new Date());

async function api(url, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const response = await fetch(url, { ...options, headers });
  let data = null;
  try { data = await response.json(); } catch { /* Respostas sem JSON serão tratadas pelo status HTTP. */ }
  if (!response.ok) throw new Error(data?.error || `Falha na requisição (${response.status})`);
  return data;
}

function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast visible${error ? ' error' : ''}`;
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => element.className = 'toast', 4200);
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#login-error').textContent = '';
  try {
    const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email: $('#login-email').value, senha: $('#login-senha').value }) });
    token = result.token;
    state.user = result.usuario;
    $('#login-screen').hidden = true;
    $('#application').hidden = false;
    $('#account-name').textContent = state.user.nome;
    $('#account-avatar').textContent = state.user.nome?.trim()?.[0]?.toUpperCase() || 'G';
    await loadContext();
    go('dashboard');
  } catch (error) { $('#login-error').textContent = error.message; }
});

async function loadContext() {
  const variation = await api('/config/variabilidade');
  state.operatorsEnabled = Boolean(variation?.pontosDeVariacao?.gestaoDeOperadores?.habilitado);
  $('#operators-nav').hidden = !state.operatorsEnabled;
  state.posts = await api(`/postos/${state.user.usuario_id}`);
  state.postId = state.posts[0]?.posto_id || null;
  if (!state.postId) { toast('Este usuário ainda não está vinculado a um posto.', true); return; }
  const [companies, machines, operators, user] = await Promise.all([
    api(`/postos/empresas/${state.postId}`),
    api(`/postos/${state.postId}/maquinas`),
    state.operatorsEnabled ? api(`/operadores/posto/${state.postId}`) : Promise.resolve([]),
    api(`/usuarios/${state.user.usuario_id}`),
  ]);
  state.companies = companies;
  state.machines = machines;
  state.operators = operators;
  state.user = { ...state.user, ...user };
  $('#account-name').textContent = state.user.nome;
  $('#account-avatar').textContent = state.user.nome?.trim()?.[0]?.toUpperCase() || 'G';
}

async function go(page) {
  if (page === 'operators' && !state.operatorsEnabled) return;
  state.page = page;
  $$('.nav-link').forEach((item) => item.classList.toggle('active', item.dataset.page === page
    || (page === 'history-detail' && item.dataset.page === 'history')
    || (['divergence', 'divergence-edit'].includes(page) && item.dataset.page === 'closing')));
  try {
    if (page === 'dashboard') state.dashboardData = await api(`/postos/${state.postId}/fechamentos/dashboard`);
    if (page === 'history') state.historyData = await loadHistory();
    if (page === 'history-detail' && state.detailId) state.detailData = await api(`/postos/${state.postId}/fechamentos/${state.detailId}`);
  } catch (error) { toast(error.message, true); }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadHistory() {
  const params = new URLSearchParams();
  if (state.historyFrom) params.set('from', state.historyFrom);
  if (state.historyTo) params.set('to', state.historyTo);
  const status = state.historyFilter === 'OK' ? 'ok' : state.historyFilter === 'Divergência' ? 'com_divergencia' : '';
  if (status) params.set('status', status);
  return api(`/postos/${state.postId}/fechamentos?${params}`);
}

function shell(title, subtitle = '', action = '') {
  return `<header class="page-heading"><div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action}</header>`;
}

function render() {
  const root = $('#page-root');
  const renderers = {
    dashboard: renderDashboard, closing: renderClosing, history: renderHistory,
    'history-detail': renderHistoryDetail, machines: renderMachines,
    operators: renderOperators, settings: renderSettings, profile: renderProfile,
    divergence: renderDivergence, 'divergence-edit': renderDivergenceEdit,
  };
  root.innerHTML = (renderers[state.page] || renderDashboard)();
  bindClosingValues();
}

function legacyRenderDashboard() {
  return `${shell('Dashboard', `Hoje, ${todayPt()}`, '<button class="primary" data-page="closing">⊕ &nbsp;Novo Fechamento</button>')}
    <div class="notice"><span>Prévia visual</span> Os valores do dashboard e do histórico são ilustrativos enquanto a API de fechamentos não está conectada.</div>
    <section class="metric-grid">
      <article class="metric-card positive"><div class="metric-label">Sobra Acumulada (Posto)<span class="pill green">SOBRA</span></div><strong>+R$ 1.245,00</strong><small>Refletindo os últimos 22 fechamentos</small></article>
      <article class="metric-card negative"><div class="metric-label">Falta Acumulada (Loja)<span class="pill red">ALERTA</span></div><strong>-R$ 3.120,50</strong><small>Requer revisão manual com gerência</small></article>
      <article class="metric-card"><div class="metric-label">Fechamentos no Mês<span class="pill gray">PROGRESSO</span></div><strong class="dark-value">22 / 30</strong><small>Meta de preenchimento diário</small></article>
    </section>
    <section class="dashboard-grid"><article class="surface chart-card"><div class="surface-heading"><h2>Evolução Diária (Agosto)</h2><div class="legend"><span class="dot green-dot"></span>Sobra <span class="dot red-dot"></span>Falta</div></div><div class="chart"><div class="chart-lines"><i></i><i></i><i></i></div><svg viewBox="0 0 760 210" preserveAspectRatio="none" aria-label="Gráfico ilustrativo de sobra e falta"><polyline points="10,98 120,36 245,152 365,72 490,164 612,84 748,118" fill="none" stroke="#ef4b4b" stroke-width="3"/><polyline points="10,98 120,36 245,152 365,72 490,164 612,84 748,118" fill="none" stroke="#20bd65" stroke-width="3" stroke-dasharray="0 118 22 120 0 70 0 140"/>${[[10,98],[120,36],[245,152],[365,72],[490,164],[612,84],[748,118]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="4" fill="#f04444" stroke="white" stroke-width="2"/>`).join('')}</svg></div><div class="chart-axis"><span>Dia 01</span><span>Dia 05</span><span>Dia 10</span><span>Dia 15</span><span>Dia 20</span><span>Dia 25</span><span>Dia 30</span></div></article>
      <article class="surface recent-card"><div class="surface-heading"><h2>Últimos Fechamentos</h2><button class="text-button" data-page="history">Ver histórico</button></div>${demoHistory.slice(0,5).map(historyRow).join('')}</article></section>`;
}

function renderClosing() {
  const step = state.closing.step;
  const steps = ['Data de Competência', 'Cartões e Dinheiro', 'Investigar Divergências', 'Resumo do Fechamento'];
  return `${shell(step === 1 ? 'Novo Fechamento' : steps[step - 1], step === 1 ? 'Prepare as informações para iniciar a conciliação' : `Etapa ${step} de 4 · ${state.closing.date ? formatDate(state.closing.date) : ''}`)}
    <div class="stepper">${steps.map((name, index) => `<div class="step ${index + 1 === step ? 'current' : index + 1 < step ? 'complete' : ''}"><b>${index + 1 < step ? '✓' : index + 1}</b>${name}</div>`).join('')}</div>
    ${step === 1 ? closingDateStep() : step === 2 ? closingValuesStep() : step === 3 ? closingDivergenceStep() : closingSummaryStep()}`;
}

function closingDateStep() {
  return `<form id="closing-date-form" class="surface date-step"><h2>Selecione a Data de Competência</h2><p>Escolha o dia em que o caixa foi encerrado física e eletronicamente.</p><label>Data do Fechamento<input id="closing-date" type="date" required value="${esc(state.closing.date || new Date().toISOString().slice(0,10))}"></label><div class="form-actions spread"><button type="button" class="secondary" data-page="dashboard">Cancelar</button><button class="primary" type="submit">Continuar para Lançamentos&nbsp; →</button></div></form>`;
}

function closingValuesStep() {
  const machines = state.machines.filter((machine) => machine.ativo);
  return `<section class="surface closing-work"><div class="surface-heading"><div><h2>Cartões e Dinheiro</h2><p>Insira valores esperados e recebidos de cada máquina.</p></div></div>
    ${machines.length ? `<div class="value-table"><div class="value-head"><span>Máquina</span><span>Valor Esperado (Sistema)</span><span>Valor Recebido (Máquina)</span><span>Diferença</span></div>${machines.map((machine) => {
      const value = state.closing.values[machine.maquina_id] || {};
      return `<div class="value-row"><strong>${esc(machine.nome_maquina)}</strong><label class="sr-only" for="expected-${machine.maquina_id}">Valor esperado de ${esc(machine.nome_maquina)}</label><input id="expected-${machine.maquina_id}" data-machine="${machine.maquina_id}" data-field="expected" type="number" min="0" step="0.01" placeholder="0,00" value="${esc(value.expected || '')}"><label class="sr-only" for="received-${machine.maquina_id}">Valor recebido de ${esc(machine.nome_maquina)}</label><input id="received-${machine.maquina_id}" data-machine="${machine.maquina_id}" data-field="received" type="number" min="0" step="0.01" placeholder="0,00" value="${esc(value.received || '')}"><strong id="difference-${machine.maquina_id}" class="difference">${money(Number(value.received || 0) - Number(value.expected || 0))}</strong></div>`;
    }).join('')}</div>` : '<p class="empty-state">Cadastre máquinas para começar os lançamentos.</p>'}
    <div class="totals-row"><strong>Total Geral Cartões</strong><span>Esperado: <b>${money(totalMachines('expected'))}</b></span><span>Recebido: <b>${money(totalMachines('received'))}</b></span><strong class="${totalMachines('received')-totalMachines('expected') < 0 ? 'negative-text' : 'positive-text'}">${money(totalMachines('received')-totalMachines('expected'))}</strong></div>
    <h3>Dinheiro em Caixa</h3><div class="cash-grid"><label>Valor Declarado (contagem física)<input id="cash-received" type="number" min="0" step="0.01" value="${esc(state.closing.moneyReceived)}" placeholder="0,00"></label><label>Valor Esperado (Sistema)<input id="cash-expected" type="number" min="0" step="0.01" value="${esc(state.closing.moneyExpected)}" placeholder="0,00"></label><div class="cash-difference"><small>Diferença</small><strong>${money(Number(state.closing.moneyReceived || 0)-Number(state.closing.moneyExpected || 0))}</strong></div></div>
    <div class="form-actions spread"><button class="secondary" data-action="closing-back">← Voltar</button><button class="primary" data-action="closing-next">Próximo: Investigar Divergências&nbsp; →</button></div></section>`;
}

function closingDivergenceStep() {
  const entries = getEntries();
  const cashDiff = Number(state.closing.moneyReceived || 0) - Number(state.closing.moneyExpected || 0);
  return `<section class="closing-work"><div class="summary-by-company">${companyTotals(entries).map((company) => `<article class="metric-card ${company.difference < 0 ? 'negative' : 'positive'}"><h3>${esc(company.nome)}</h3><small>${esc(company.tipo)}</small><div class="metric-label">Total Esperado <b>${money(company.expected)}</b></div><div class="metric-label">Total Recebido <b>${money(company.received)}</b></div><strong>${company.difference >= 0 ? '+' : ''}${money(company.difference)}</strong></article>`).join('')}</div>
    <h2>Divergências Encontradas</h2>${entries.map((entry) => {
      const difference = entry.received - entry.expected;
    return `<article class="surface divergence-card"><div class="surface-heading"><h3>${esc(entry.machine.nome_maquina)} · ${esc(entry.company?.nome || 'Empresa')}</h3><span class="pill ${difference < 0 ? 'red' : difference > 0 ? 'green' : 'gray'}">${difference < 0 ? 'FALTA' : difference > 0 ? 'SOBRA' : 'OK'}</span></div><div class="detail-lines"><span>Esperado <b>${money(entry.expected)}</b></span><span>Recebido <b>${money(entry.received)}</b></span><strong class="${difference < 0 ? 'negative-text' : 'positive-text'}">Diferença: ${money(difference)}</strong></div><label>Observação / Causa<input data-cause="${entry.machine.maquina_id}" value="${esc(state.closing.causes[entry.machine.maquina_id] || '')}" placeholder="Descreva a causa ou conferência"></label><label>Operador responsável<select data-operator="${entry.machine.maquina_id}"><option value="">Sem operador selecionado</option>${state.operators.filter((operator) => operator.ativo).map((operator) => `<option value="${operator.operador_id}" ${String(state.closing.operators[entry.machine.maquina_id] || '') === String(operator.operador_id) ? 'selected' : ''}>${esc(operator.nome_operador)}</option>`).join('')}</select></label><button class="text-button" data-page="divergence" data-id="${entry.machine.maquina_id}">Ver detalhe da divergência</button></article>`;
    }).join('')}${cashDiff !== 0 ? `<article class="surface divergence-card"><div class="surface-heading"><h3>Dinheiro em Caixa</h3><span class="pill ${cashDiff < 0 ? 'red' : 'green'}">${cashDiff < 0 ? 'FALTA' : 'SOBRA'}</span></div><div class="detail-lines"><span>Esperado <b>${money(state.closing.moneyExpected)}</b></span><span>Declarado <b>${money(state.closing.moneyReceived)}</b></span><strong class="${cashDiff < 0 ? 'negative-text' : 'positive-text'}">Diferença: ${money(cashDiff)}</strong></div><label>Observação / Causa<input data-cause="cash" value="${esc(state.closing.causes.cash || '')}" placeholder="Descreva a causa ou conferência"></label></article>` : ''}
    <div class="form-actions spread"><button class="secondary" data-action="closing-back">← Voltar</button><button class="primary" data-action="closing-next">Próximo: Resumo&nbsp; →</button></div></section>`;
}

function closingSummaryStep() {
  const entries = getEntries();
  const cashDiff = Number(state.closing.moneyReceived || 0) - Number(state.closing.moneyExpected || 0);
  const difference = entries.reduce((sum, entry) => sum + entry.received - entry.expected, 0) + cashDiff;
  const mismatches = entries.filter((entry) => entry.received !== entry.expected).map((entry) => `<div class="history-item"><div><strong>${esc(entry.machine.nome_maquina)} · ${esc(entry.company?.nome || 'Empresa')}</strong><small>${esc(state.closing.causes[entry.machine.maquina_id] || 'Sem observação registrada')}</small></div><strong class="${entry.received < entry.expected ? 'negative-text' : 'positive-text'}">${money(entry.received-entry.expected)}</strong></div>`).join('');
  const cashMismatch = cashDiff ? `<div class="history-item"><div><strong>Dinheiro em Caixa</strong><small>${esc(state.closing.causes.cash || 'Sem observação registrada')}</small></div><strong class="${cashDiff < 0 ? 'negative-text' : 'positive-text'}">${money(cashDiff)}</strong></div>` : '';
  return `<section class="closing-work"><div class="summary-by-company">${companyTotals(entries).map((company) => `<article class="metric-card ${company.difference < 0 ? 'negative' : 'positive'}"><small>${esc(company.nome)}</small><strong>${company.difference >= 0 ? '+' : ''}${money(company.difference)}</strong><span>${company.difference < 0 ? 'Falta identificada' : 'Sobra identificada'}</span></article>`).join('')}</div><article class="surface"><h2>Divergências Identificadas</h2>${mismatches || cashMismatch ? `${mismatches}${cashMismatch}` : '<p>Nenhuma divergência identificada.</p>'}<div class="grand-total"><strong>Total Geral</strong><span>Data: ${formatDate(state.closing.date)}</span><span>Diferença: <b class="${difference < 0 ? 'negative-text' : 'positive-text'}">${money(difference)}</b></span></div><div class="notice warning"><span>Integração pendente</span> A API de fechamentos ainda não está conectada. Esta tela não salvará os dados no banco.</div><div class="form-actions spread"><button class="secondary" data-action="closing-back">Voltar para Investigar Divergências</button><button class="success" data-action="save-closing">Salvar Fechamento</button></div></article></section>`;
}

function totalMachines(field) { return getEntries().reduce((sum, entry) => sum + entry[field], 0); }
function getEntries() {
  return state.machines.filter((machine) => machine.ativo).map((machine) => {
    const values = state.closing.values[machine.maquina_id] || {};
    return { machine, company: state.companies.find((company) => Number(company.empresa_id) === Number(machine.empresa_id)), expected: Number(values.expected || 0), received: Number(values.received || 0) };
  });
}
function companyTotals(entries) {
  return state.companies.map((company) => {
    const group = entries.filter((entry) => Number(entry.machine.empresa_id) === Number(company.empresa_id));
    const expected = group.reduce((sum, entry) => sum + entry.expected, 0);
    const received = group.reduce((sum, entry) => sum + entry.received, 0);
    return { ...company, expected, received, difference: received - expected };
  });
}
function bindClosingValues() {
  $$('[data-machine]').forEach((input) => input.addEventListener('input', () => {
    const id = input.dataset.machine;
    state.closing.values[id] ||= {};
    state.closing.values[id][input.dataset.field] = input.value;
    const entry = state.closing.values[id];
    const diff = $('#difference-' + id);
    diff.textContent = money(Number(entry.received || 0) - Number(entry.expected || 0));
    diff.className = `difference ${(Number(entry.received || 0)-Number(entry.expected || 0)) < 0 ? 'negative-text' : 'positive-text'}`;
    const totals = $('.totals-row');
    if (totals) {
      totals.querySelectorAll('span b')[0].textContent = money(totalMachines('expected'));
      totals.querySelectorAll('span b')[1].textContent = money(totalMachines('received'));
      totals.querySelector('strong:last-child').textContent = money(totalMachines('received')-totalMachines('expected'));
    }
  }));
  $('#cash-received')?.addEventListener('input', (event) => { state.closing.moneyReceived = event.target.value; });
  $('#cash-expected')?.addEventListener('input', (event) => { state.closing.moneyExpected = event.target.value; });
  $$('[data-cause]').forEach((input) => input.addEventListener('input', () => state.closing.causes[input.dataset.cause] = input.value));
  $$('[data-operator]').forEach((input) => input.addEventListener('change', () => state.closing.operators[input.dataset.operator] = input.value));
}

function legacyRenderHistory() {
  const filtered = demoHistory.filter((item) => {
    const date = item.date.split('/').reverse().join('-');
    return (state.historyFilter === 'Todos' || item.status === state.historyFilter)
      && (!state.historyFrom || date >= state.historyFrom)
      && (!state.historyTo || date <= state.historyTo);
  });
  return `${shell('Histórico de Fechamentos', 'Consulte e filtre fechamentos anteriores registrados no sistema.')}
    <div class="notice"><span>Prévia visual</span> Registros ilustrativos. A listagem será vinculada à API de fechamentos.</div>
    <form id="history-filter" class="surface filter-bar"><label>De<input type="date" name="from" value="${esc(state.historyFrom)}"></label><label>Até<input type="date" name="to" value="${esc(state.historyTo)}"></label><label>Status<select name="status"><option ${state.historyFilter === 'Todos' ? 'selected' : ''}>Todos</option><option ${state.historyFilter === 'OK' ? 'selected' : ''}>OK</option><option ${state.historyFilter === 'Divergência' ? 'selected' : ''}>Divergência</option></select></label><button class="primary">Filtrar</button></form>
    <section class="surface"><div class="table-wrap"><table><thead><tr><th>Data</th><th>Status</th><th>Total Cartões</th><th>Total Dinheiro</th><th>Posto</th><th>Loja Conveniência</th><th></th></tr></thead><tbody>${filtered.map((item) => `<tr><td>${esc(item.date)}</td><td><span class="pill ${item.status === 'OK' ? 'green' : 'red'}">${esc(item.status)}</span></td><td>${money(item.cards)}</td><td>${money(item.cash)}</td><td class="${item.station >= 0 ? 'positive-text' : 'negative-text'}">${money(item.station)} ${item.station >= 0 ? '(Sobra)' : '(Falta)'}</td><td class="${item.store >= 0 ? 'positive-text' : 'negative-text'}">${money(item.store)} ${item.store >= 0 ? '(Sobra)' : '(Falta)'}</td><td><button class="text-button" data-page="history-detail" data-id="${item.id}">Ver detalhe</button></td></tr>`).join('')}</tbody></table></div><div class="table-footer">Mostrando ${filtered.length} de ${demoHistory.length} fechamentos <span>Prévia de dados</span></div></section>`;
}

function legacyRenderHistoryDetail() {
  const item = demoHistory.find((record) => record.id === state.detailId) || demoHistory[0];
  return `${shell(`Fechamento — ${esc(item.date)}`, 'Detalhe consolidado de vendas, cartões e fluxo de caixa do dia.', '<button class="secondary" data-action="export-demo">Exportar PDF</button>')}
    <div class="notice"><span>Prévia visual</span> Os dados desta tela são ilustrativos.</div><div class="summary-by-company"><article class="metric-card positive"><small>Resumo Posto</small><strong>${money(item.station)}</strong><span>Conferência física de caixa</span></article><article class="metric-card negative"><small>Resumo Loja Conveniência</small><strong>${money(item.store)}</strong><span>Divergência detectada nas maquininhas</span></article></div>
    <section class="surface"><h2>Máquinas de Cartão</h2><div class="table-wrap"><table><thead><tr><th>Identificação</th><th>Empresa</th><th>Valor Esperado</th><th>Valor Recebido</th><th>Diferença</th></tr></thead><tbody>${state.machines.slice(0,4).map((machine, index) => `<tr><td>${esc(machine.nome_maquina)}</td><td>${esc(machine.nome_empresa)}</td><td>${money(1250 + index*370)}</td><td>${money(1250 + index*370 + (index === 1 ? item.store : 0))}</td><td>${index === 1 ? money(item.store) : money(0)}</td></tr>`).join('')}</tbody></table></div><h2>Observações Registradas</h2><div class="notice">Conteúdo de demonstração. Observações serão carregadas quando a API de fechamentos for implementada.</div><button class="secondary" data-page="history">Voltar ao Histórico</button></section>`;
}

// Renderização baseada somente nas respostas reais das rotas de fechamento.
function renderDashboard() {
  const data = state.dashboardData || { totals: {}, daily: [], recent: [] };
  const totals = data.totals || {};
  const dailyRows = (data.daily || []).map((row) => '<tr><td>' + formatDate(String(row.data).slice(0, 10)) + '</td><td>' + money(row.diferenca) + '</td></tr>').join('');
  return shell('Dashboard', 'Hoje, ' + todayPt(), '<button class="primary" data-page="closing">Novo Fechamento</button>')
    + '<section class="metric-grid"><article class="metric-card"><div class="metric-label">Saldo do Posto neste mês</div><strong>' + money(totals.posto) + '</strong></article>'
    + '<article class="metric-card"><div class="metric-label">Saldo da Loja neste mês</div><strong>' + money(totals.loja) + '</strong></article>'
    + '<article class="metric-card"><div class="metric-label">Fechamentos no mês</div><strong class="dark-value">' + Number(totals.quantidade || 0) + '</strong></article></section>'
    + '<section class="dashboard-grid"><article class="surface chart-card"><h2>Evolução diária</h2><div class="table-wrap"><table><thead><tr><th>Data</th><th>Diferença</th></tr></thead><tbody>'
    + (dailyRows || '<tr><td colspan="2">Nenhum fechamento neste mês.</td></tr>') + '</tbody></table></div></article>'
    + '<article class="surface recent-card"><h2>Últimos fechamentos</h2>' + ((data.recent || []).map(historyRow).join('') || '<p>Ainda não há fechamentos.</p>') + '</article></section>';
}

function renderHistory() {
  const rows = state.historyData || [];
  const options = ['Todos', 'OK', 'Divergência'].map((name) => '<option ' + (state.historyFilter === name ? 'selected' : '') + '>' + name + '</option>').join('');
  const body = rows.map((item) => '<tr><td>' + formatDate(String(item.data).slice(0, 10)) + '</td><td>' + (item.status === 'ok' ? 'OK' : 'Divergência')
    + '</td><td>' + money(item.total_cartoes) + '</td><td>' + money(item.dinheiro_declarado) + '</td><td>' + money(item.posto)
    + '</td><td>' + money(item.loja) + '</td><td><button class="text-button" data-page="history-detail" data-id="' + item.fechamento_id + '">Ver detalhe</button></td></tr>').join('');
  return shell('Histórico de Fechamentos', 'Consulte e filtre fechamentos registrados no banco.')
    + '<form id="history-filter" class="surface filter-bar"><label>De<input type="date" name="from" value="' + esc(state.historyFrom) + '"></label><label>Até<input type="date" name="to" value="' + esc(state.historyTo) + '"></label>'
    + '<label>Status<select name="status">' + options + '</select></label><button class="primary">Filtrar</button></form>'
    + '<section class="surface"><div class="table-wrap"><table><thead><tr><th>Data</th><th>Status</th><th>Total cartões</th><th>Dinheiro declarado</th><th>Posto</th><th>Loja conveniência</th><th></th></tr></thead><tbody>'
    + (body || '<tr><td colspan="7">Nenhum fechamento encontrado.</td></tr>') + '</tbody></table></div><div class="table-footer">Mostrando ' + rows.length + ' fechamentos</div></section>';
}

function renderHistoryDetail() {
  const data = state.detailData;
  if (!data) return shell('Detalhe do fechamento') + '<section class="surface">Selecione um fechamento no histórico.</section>';
  const item = data.fechamento;
  const machineRows = data.maquinas.map((row) => '<tr><td>' + esc(row.maquina_nome) + '</td><td>' + esc(row.empresa_nome)
    + '</td><td>' + esc(row.operador_nome || 'Não informado') + '</td><td>' + money(row.valor_esperado) + '</td><td>'
    + money(row.valor_recebido) + '</td><td>' + money(row.diferenca) + '</td></tr>').join('');
  const notes = data.observacoes.map((note) => '<article class="notice"><strong>' + esc(note.usuario_nome) + '</strong>: ' + esc(note.texto) + '</article>').join('');
  const date = formatDate(String(item.data_referencia).slice(0, 10));
  return shell('Fechamento — ' + date, 'Fechado por ' + esc(item.usuario_nome) + ' · Status: ' + esc(item.status))
    + '<section class="surface"><h2>Lançamentos por máquina</h2><div class="table-wrap"><table><thead><tr><th>Máquina</th><th>Empresa</th><th>Operador</th><th>Esperado</th><th>Recebido</th><th>Diferença</th></tr></thead><tbody>'
    + (machineRows || '<tr><td colspan="6">Sem lançamentos de máquinas.</td></tr>') + '</tbody></table></div>'
    + '<h2>Dinheiro em caixa</h2><p>Esperado: ' + money(item.valor_dinheiro_esperado) + ' · Declarado: ' + money(item.valor_dinheiro_declarado) + '</p>'
    + '<h2>Observações</h2>' + (notes || '<p>Nenhuma observação registrada.</p>') + '<button class="secondary" data-page="history">Voltar ao histórico</button></section>';
}

function legacyHistoryRow(item) {
  const ok = item.status === 'ok';
  return '<button class="recent-row" data-page="history-detail" data-id="' + item.fechamento_id + '"><span><strong>'
    + formatDate(String(item.data).slice(0, 10)) + '</strong><small>' + (ok ? 'Concluído' : 'Com divergência')
    + '</small></span><strong>' + money(item.total_cartoes) + '</strong><span class="pill ' + (ok ? 'green' : 'red') + '">'
    + (ok ? 'OK' : 'Divergência') + '</span></button>';
}

function renderMachines() {
  const action = '<button class="success" data-action="new-machine">⊕ &nbsp;Nova Máquina</button>';
  return `${shell('Cadastro de Máquinas', 'Gerencie as máquinas de cartão do posto.', action)}
    <div class="split-layout"><section class="surface"><div class="table-wrap"><table><thead><tr><th>Nome da Máquina</th><th>Empresa Vinculada</th><th>Status</th><th>Ações</th></tr></thead><tbody>${state.machines.map((machine) => `<tr><td>${esc(machine.nome_maquina)}</td><td>${esc(machine.nome_empresa)}</td><td><span class="pill ${machine.ativo ? 'green' : 'gray'}">${machine.ativo ? 'Ativo' : 'Inativo'}</span></td><td class="row-actions"><button class="text-button" data-action="edit-machine" data-id="${machine.maquina_id}">Editar</button><button class="text-button" data-action="toggle-machine" data-id="${machine.maquina_id}" data-active="${!machine.ativo}">${machine.ativo ? 'Inativar' : 'Ativar'}</button></td></tr>`).join('')}</tbody></table></div></section>
    <form id="machine-form" class="surface side-form"><h2>${state.machineEditId ? 'Editar Máquina' : 'Adicionar Máquina'}</h2><label>Nome da Máquina<input name="nome" required placeholder="Ex.: Stone Recepção"></label><label>Empresa Vinculada<select name="empresa_id" required>${companyOptions()}</select></label><input type="hidden" name="ativo" value="true"><div class="form-actions"><button type="button" class="secondary" data-action="cancel-machine">Cancelar</button><button class="success">Salvar</button></div></form></div>`;
}

function renderOperators() {
  return `${shell('Cadastro de Operadores', 'Gerencie os frentistas e atendentes do posto.', '<button class="success" data-action="new-operator">⊕ &nbsp;Novo Operador</button>')}
    <div class="split-layout"><section class="surface"><div class="table-wrap"><table><thead><tr><th>Nome Completo</th><th>Empresa Vinculada</th><th>Status</th><th>Ações</th></tr></thead><tbody>${state.operators.map((operator) => `<tr><td>${esc(operator.nome_operador)}</td><td>${esc(operator.nome_empresa)}</td><td><span class="pill ${operator.ativo ? 'green' : 'gray'}">${operator.ativo ? 'Ativo' : 'Inativo'}</span></td><td class="row-actions"><button class="text-button" data-action="edit-operator" data-id="${operator.operador_id}">Editar</button><button class="text-button" data-action="toggle-operator" data-id="${operator.operador_id}" data-active="${!operator.ativo}">${operator.ativo ? 'Inativar' : 'Ativar'}</button></td></tr>`).join('')}</tbody></table></div></section>
    <form id="operator-form" class="surface side-form"><h2>${state.operatorEditId ? 'Editar Operador' : 'Adicionar Operador'}</h2><label>Nome do Operador<input name="nome" required placeholder="Nome completo"></label><label>Empresa Vinculada<select name="empresa_id" required>${companyOptions()}</select></label><div class="form-actions"><button type="button" class="secondary" data-action="cancel-operator">Cancelar</button><button class="success">Salvar</button></div></form></div>`;
}

function companyOptions(selected) {
  return `<option value="">Selecione uma empresa</option>${state.companies.map((company) => `<option value="${company.empresa_id}" ${String(selected || '') === String(company.empresa_id) ? 'selected' : ''}>${esc(company.nome)}</option>`).join('')}`;
}

function renderSettings() {
  const post = state.posts.find((item) => Number(item.posto_id) === Number(state.postId));
  return `${shell('Configurações do Posto', 'Visualize os dados do posto e das empresas vinculadas.')}
    <section class="surface"><h2>Dados do Posto</h2><label>Nome do Posto<input value="${esc(post?.nome_posto)}" disabled></label><p class="helper">O endereço e o telefone ainda não são fornecidos pela API do projeto.</p></section><h2 class="section-title">Empresas Vinculadas</h2><div class="summary-by-company">${state.companies.map((company) => `<article class="surface company-card"><h3>${esc(company.nome)}</h3><label>CNPJ<input value="${esc(company.cnpj)}" disabled></label><label>Tipo<input value="${company.tipo === 'combustivel' ? 'Posto de Combustível' : 'Loja de Conveniência'}" disabled></label><button class="secondary" data-action="edit-company" data-id="${company.empresa_id}">Editar</button></article>`).join('')}</div>`;
}

function renderProfile() {
  return `${shell('Informações Pessoais', 'Edite suas informações pessoais e credenciais de acesso.')}
    <form id="profile-form"><section class="surface"><h2>Dados Pessoais</h2><div class="profile-grid"><label>Nome Completo<input name="nome" required value="${esc(state.user?.nome)}"></label><label>E-mail<input name="email" type="email" required value="${esc(state.user?.email)}"></label></div></section><section class="surface"><h2>Segurança</h2><div class="profile-grid"><label>Nova Senha<input name="senha" type="password" placeholder="Deixe em branco para manter"></label><label>Confirmar Nova Senha<input name="confirmar" type="password" placeholder="Confirme a nova senha"></label></div></section><div class="form-actions end"><button class="secondary" type="button" data-page="dashboard">Cancelar</button><button class="success">Salvar Alterações</button></div></form>`;
}

function renderDivergence() {
  const entry = getEntries().find((item) => String(item.machine.maquina_id) === String(state.divergenceId)) || getEntries()[0];
  if (!entry) return `${shell('Divergência', 'Não há máquinas cadastradas.')}<section class="surface">Cadastre máquinas para visualizar esta tela.</section>`;
  const difference = entry.received - entry.expected;
  return `${shell(`Divergência — ${esc(entry.machine.nome_maquina)}`, 'Análise minuciosa da divergência detectada na conciliação.')}
    <section class="surface detail-panel"><div class="detail-meta"><span>DISPOSITIVO<strong>${esc(entry.machine.nome_maquina)}</strong></span><span>DATA<strong>${formatDate(state.closing.date)}</strong></span><span class="pill red">${Math.abs(difference) >= 100 ? 'Divergência Crítica' : 'Divergência'}</span></div><div class="summary-by-company"><article class="value-box"><small>Valor Esperado (Sistema)</small><strong>${money(entry.expected)}</strong></article><article class="value-box"><small>Valor Recebido (Máquina)</small><strong>${money(entry.received)}</strong></article></div><div class="difference-banner"><small>Diferença Apurada</small><strong>${money(difference)}</strong><span>${difference < 0 ? 'Falta de caixa identificada.' : 'Sobra identificada.'}</span></div><button class="primary" data-page="divergence-edit">Editar operador e observação</button></section>`;
}

function renderDivergenceEdit() {
  const entry = getEntries().find((item) => String(item.machine.maquina_id) === String(state.divergenceId)) || getEntries()[0];
  return `${shell('Editar operador e observação', 'Identifique o operador responsável pelo turno.')}
    <section class="surface"><h2>Detalhamento do Caso</h2><p>${esc(entry?.machine.nome_maquina || '')} · Diferença ${money(entry ? entry.received-entry.expected : 0)}</p><label>Selecionar Operador<select id="divergence-operator"><option value="">Selecione um nome da lista...</option>${state.operators.filter((operator) => operator.ativo).map((operator) => `<option value="${operator.operador_id}" ${String(state.closing.operators[state.divergenceId] || '') === String(operator.operador_id) ? 'selected' : ''}>${esc(operator.nome_operador)} (${esc(operator.nome_empresa)})</option>`).join('')}</select></label></section><section class="surface"><label>Nova Observação<textarea id="divergence-note" rows="4" placeholder="Descreva a causa da divergência...">${esc(state.closing.causes[state.divergenceId] || '')}</textarea></label><h2>Histórico de Observações</h2><p class="helper">A API de observações ainda não está conectada.</p></section><div class="form-actions end"><button class="secondary" data-page="divergence">Cancelar</button><button class="primary" data-action="save-divergence-note">Confirmar Alterações</button></div>`;
}

const demoHistory = [
  { id: 1, date: '29/08/2024', status: 'OK', cards: 14820.40, cash: 2450, station: 125, store: 0 },
  { id: 2, date: '28/08/2024', status: 'Divergência', cards: 12110, cash: 1980, station: -150, store: -135.5 },
  { id: 3, date: '27/08/2024', status: 'OK', cards: 15300.5, cash: 3120, station: 0, store: 0 },
  { id: 4, date: '26/08/2024', status: 'OK', cards: 11245.9, cash: 2230, station: 0, store: 0 },
  { id: 5, date: '25/08/2024', status: 'Divergência', cards: 13550.2, cash: 2100, station: -60, store: -90 },
  { id: 6, date: '24/08/2024', status: 'OK', cards: 14120, cash: 2400, station: 10, store: 0 },
  { id: 7, date: '23/08/2024', status: 'OK', cards: 11980.45, cash: 1870, station: 0, store: 0 },
  { id: 8, date: '22/08/2024', status: 'Divergência', cards: 10450, cash: 1560, station: 0, store: -90 },
];

function historyRow(item) {
  return `<button class="recent-row" data-page="history-detail" data-id="${item.id}"><span><strong>${esc(item.date)}</strong><small>Fechado por: ${esc(state.user?.nome || 'Gerente')}</small></span><strong>${money(item.cards)}</strong><span class="pill ${item.status === 'OK' ? 'green' : 'red'}">${esc(item.status)}</span></button>`;
}
function formatDate(value) {
  if (!value) return '—';
  const [year, month, day] = value.split('-');
  return year ? `${day}/${month}/${year}` : value;
}

$('#main-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (button) go(button.dataset.page);
});
$('.brand').addEventListener('click', (event) => { event.preventDefault(); go('dashboard'); });
$('.account-card').addEventListener('click', () => go('profile'));

$('#logout-button').addEventListener('click', async () => {
  try { await api('/auth/logout', { method: 'POST' }); } catch { /* A sessão local também precisa ser encerrada. */ }
  token = null;
  state.user = null;
  state.posts = [];
  state.postId = null;
  $('#application').hidden = true;
  $('#login-screen').hidden = false;
  $('#login-form').reset();
});

$('#page-root').addEventListener('click', async (event) => {
  const pageButton = event.target.closest('[data-page]');
  if (pageButton) {
    if (pageButton.dataset.id) {
      if (pageButton.dataset.page === 'history-detail') state.detailId = Number(pageButton.dataset.id);
      if (pageButton.dataset.page === 'divergence') state.divergenceId = pageButton.dataset.id;
    }
    go(pageButton.dataset.page);
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === 'closing-back') { state.closing.step = Math.max(1, state.closing.step - 1); render(); }
    if (action === 'closing-next') { state.closing.step = Math.min(4, state.closing.step + 1); render(); }
    if (action === 'save-closing') {
      const machines = getEntries().map((entry) => ({
        maquina_id: entry.machine.maquina_id,
        valor_esperado: entry.expected,
        valor_recebido: entry.received,
        operador_id: state.closing.operators[entry.machine.maquina_id] || null,
        observacao: state.closing.causes[entry.machine.maquina_id] || '',
      }));
      const result = await api(`/postos/${state.postId}/fechamentos`, { method: 'POST', body: JSON.stringify({
        data_referencia: state.closing.date,
        valor_dinheiro_esperado: Number(state.closing.moneyExpected || 0),
        valor_dinheiro_declarado: Number(state.closing.moneyReceived || 0),
        maquinas,
      }) });
      state.detailId = result.fechamento_id;
      state.closing = { step: 1, date: '', values: {}, moneyExpected: '', moneyReceived: '', causes: {}, operators: {} };
      toast('Fechamento salvo com sucesso.');
      await go('history-detail');
    }
    if (action === 'new-machine') { state.machineEditId = null; render(); }
    if (action === 'cancel-machine') { state.machineEditId = null; render(); }
    if (action === 'edit-machine') {
      const machine = state.machines.find((item) => String(item.maquina_id) === id);
      state.machineEditId = id; render();
      const form = $('#machine-form'); form.elements.nome.value = machine.nome_maquina; form.elements.empresa_id.value = machine.empresa_id; form.elements.ativo.value = machine.ativo;
    }
    if (action === 'toggle-machine') {
      await api(`/maquinas/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: button.dataset.active === 'true' }) });
      await refreshContext(); render(); toast('Status da máquina atualizado.');
    }
    if (action === 'new-operator' || action === 'cancel-operator') { state.operatorEditId = null; render(); }
    if (action === 'edit-operator') {
      const operator = state.operators.find((item) => String(item.operador_id) === id);
      state.operatorEditId = id; render();
      const form = $('#operator-form'); form.elements.nome.value = operator.nome_operador; form.elements.empresa_id.value = operator.empresa_id;
    }
    if (action === 'toggle-operator') {
      await api(`/operadores/${id}`, { method: 'PATCH', body: JSON.stringify({ ativo: button.dataset.active === 'true' }) });
      await refreshContext(); render(); toast('Status do operador atualizado.');
    }
    if (action === 'edit-company') {
      const company = state.companies.find((item) => String(item.empresa_id) === id);
      const nome = prompt('Nome da empresa:', company.nome); if (nome === null) return;
      const cnpj = prompt('CNPJ:', company.cnpj); if (cnpj === null) return;
      const tipo = prompt('Tipo (combustivel ou conveniencia):', company.tipo); if (tipo === null) return;
      await api(`/empresas/${id}`, { method: 'PUT', body: JSON.stringify({ nome, cnpj, tipo }) });
      await refreshContext(); render(); toast('Empresa atualizada.');
    }
    if (action === 'export-demo') toast('A exportação será adicionada em uma próxima etapa.');
    if (action === 'save-divergence-note') { go('divergence'); toast('Alterações mantidas apenas nesta prévia; a API ainda não está conectada.', true); }
  } catch (error) { toast(error.message, true); }
});

async function refreshContext() {
  const [companies, machines, operators] = await Promise.all([
    api(`/postos/empresas/${state.postId}`), api(`/postos/${state.postId}/maquinas`),
    state.operatorsEnabled ? api(`/operadores/posto/${state.postId}`) : Promise.resolve([]),
  ]);
  state.companies = companies; state.machines = machines; state.operators = operators;
}

$('#page-root').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    if (form.id === 'closing-date-form') {
      state.closing.date = $('#closing-date').value;
      state.closing.step = 2; render();
    } else if (form.id === 'history-filter') {
      const data = new FormData(form);
      state.historyFilter = data.get('status');
      state.historyFrom = data.get('from') || '';
      state.historyTo = data.get('to') || '';
      state.historyData = await loadHistory();
      render();
    } else if (form.id === 'machine-form') {
      const data = new FormData(form);
      const payload = { nome: data.get('nome'), empresa_id: data.get('empresa_id'), ativo: data.get('ativo') === 'true' };
      if (state.machineEditId) await api(`/maquinas/${state.machineEditId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/maquinas', { method: 'POST', body: JSON.stringify(payload) });
      await refreshContext(); state.machineEditId = null; render(); toast('Máquina salva com sucesso.');
    } else if (form.id === 'operator-form') {
      const data = new FormData(form);
      const payload = { nome: data.get('nome'), empresa_id: data.get('empresa_id') };
      if (state.operatorEditId) await api(`/operadores/${state.operatorEditId}`, { method: 'PUT', body: JSON.stringify(payload) });
      else await api('/operadores', { method: 'POST', body: JSON.stringify(payload) });
      await refreshContext(); state.operatorEditId = null; render(); toast('Operador salvo com sucesso.');
    } else if (form.id === 'profile-form') {
      const data = new FormData(form);
      if (data.get('senha') && data.get('senha') !== data.get('confirmar')) return toast('As senhas não conferem.', true);
      await api(`/usuarios/${state.user.usuario_id}`, { method: 'PUT', body: JSON.stringify({ nome: data.get('nome'), email: data.get('email'), senha: data.get('senha') }) });
      state.user.nome = data.get('nome'); state.user.email = data.get('email');
      $('#account-name').textContent = state.user.nome;
      $('#account-avatar').textContent = state.user.nome.trim()[0]?.toUpperCase() || 'G';
      toast('Perfil atualizado.'); render();
    }
  } catch (error) { toast(error.message, true); }
});

$('#page-root').addEventListener('input', (event) => {
  if (event.target.id === 'cash-received') state.closing.moneyReceived = event.target.value;
  if (event.target.id === 'cash-expected') state.closing.moneyExpected = event.target.value;
  if (event.target.id === 'divergence-note' && state.divergenceId) state.closing.causes[state.divergenceId] = event.target.value;
  if (event.target.id === 'cash-received' || event.target.id === 'cash-expected') {
    const difference = $('.cash-difference strong');
    if (difference) difference.textContent = money(Number(state.closing.moneyReceived || 0)-Number(state.closing.moneyExpected || 0));
  }
});

$('#page-root').addEventListener('change', (event) => {
  if (event.target.id === 'divergence-operator' && state.divergenceId) state.closing.operators[state.divergenceId] = event.target.value;
});
