// Tela: Novo Fechamento (CREATE de fechamentos) — assistente em 4 etapas,
// com as telas de detalhe da divergência e de associação de operador.
import { $, $$, esc, formatDate, money, signedMoney, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state, emptyClosing } from '../state.js';
import { shell, field, toast, differencePill, differenceClass, operatorOptions } from '../components.js';
import { go, render } from '../router.js';

const steps = ['Data de Competência', 'Cartões e Dinheiro', 'Investigar Divergências', 'Resumo do Fechamento'];
// Chave do dinheiro em caixa nos mapas de causas e operadores (as máquinas usam o maquina_id).
const cashKey = 'dinheiro';

function renderClosing() {
  const step = state.closing.step;
  return `${shell(step === 1 ? 'Novo Fechamento' : steps[step - 1], step === 1 ? 'Prepare as informações para iniciar a conciliação' : `Etapa ${step} de 4 · ${formatDate(state.closing.date)}`)}
    <div class="stepper">${steps.map((name, index) => `<div class="step ${index + 1 === step ? 'current' : index + 1 < step ? 'complete' : ''}"><b>${index + 1 < step ? '✓' : index + 1}</b>${name}</div>`).join('')}</div>
    ${step === 1 ? dateStep() : step === 2 ? valuesStep() : step === 3 ? divergenceStep() : summaryStep()}`;
}

function dateStep() {
  return `<form id="closing-date-form" class="surface date-step"><h2>Selecione a Data de Competência</h2><p>Escolha o dia em que o caixa foi encerrado física e eletronicamente.</p><label>Data do Fechamento<input id="closing-date" type="date" required value="${esc(state.closing.date || new Date().toISOString().slice(0, 10))}"></label><div class="form-actions spread"><button type="button" class="secondary" data-page="dashboard">Cancelar</button><button class="primary" type="submit">Continuar para Lançamentos&nbsp; →</button></div></form>`;
}

function valuesStep() {
  const machines = state.machines.filter((machine) => machine.ativo);
  return `<section class="surface closing-work"><div class="surface-heading"><div><h2>Cartões e Dinheiro</h2><p>Insira valores esperados e recebidos de cada máquina.</p></div></div>
    ${machines.length ? `<div class="value-table"><div class="value-head"><span>Máquina</span><span>Valor Esperado (Sistema)</span><span>Valor Recebido (Máquina)</span><span>Diferença</span></div>${machines.map((machine) => {
      const value = state.closing.values[machine.maquina_id] || {};
      return `<div class="value-row"><strong>${esc(machine.nome_maquina)}<small>${esc(machine.nome_empresa)}</small></strong><label class="sr-only" for="expected-${machine.maquina_id}">Valor esperado de ${esc(machine.nome_maquina)}</label><input id="expected-${machine.maquina_id}" data-machine="${machine.maquina_id}" data-field="expected" type="number" min="0" step="0.01" placeholder="0,00" value="${esc(value.expected || '')}"><label class="sr-only" for="received-${machine.maquina_id}">Valor recebido de ${esc(machine.nome_maquina)}</label><input id="received-${machine.maquina_id}" data-machine="${machine.maquina_id}" data-field="received" type="number" min="0" step="0.01" placeholder="0,00" value="${esc(value.received || '')}"><strong id="difference-${machine.maquina_id}" class="difference">${money(Number(value.received || 0) - Number(value.expected || 0))}</strong></div>`;
    }).join('')}</div>` : '<p class="empty-state">Cadastre máquinas para começar os lançamentos.</p>'}
    <div class="totals-row"><strong>Total Geral Cartões</strong><span>Esperado: <b>${money(totalMachines('expected'))}</b></span><span>Recebido: <b>${money(totalMachines('received'))}</b></span><strong class="${differenceClass(totalMachines('received') - totalMachines('expected'))}">${money(totalMachines('received') - totalMachines('expected'))}</strong></div>
    <h3>Dinheiro em Caixa</h3><div class="cash-grid"><label>Valor Declarado (contagem física)<input id="cash-received" type="number" min="0" step="0.01" value="${esc(state.closing.moneyReceived)}" placeholder="0,00"></label><label>Valor Esperado (Sistema)<input id="cash-expected" type="number" min="0" step="0.01" value="${esc(state.closing.moneyExpected)}" placeholder="0,00"></label><div class="cash-difference"><small>Diferença</small><strong>${money(Number(state.closing.moneyReceived || 0) - Number(state.closing.moneyExpected || 0))}</strong></div></div>
    <div class="form-actions spread"><button class="secondary" data-action="closing-back">← Voltar</button><button class="primary" data-action="closing-next">Próximo: Investigar Divergências&nbsp; →</button></div></section>`;
}

// Campos de causa e operador de uma divergência, ligados por bindClosingValues pela chave (máquina ou dinheiro).
function investigationFields(key) {
  return `<label>Observação / Causa<input data-cause="${key}" value="${esc(state.closing.causes[key] || '')}" placeholder="Descreva a causa ou conferência"></label>${state.operatorsEnabled ? `<label>Operador responsável<select data-operator="${key}">${operatorOptions(state.closing.operators[key], 'Selecionar operador...')}</select></label>` : ''}`;
}

function divergenceStep() {
  const entries = getEntries().filter((entry) => entry.received !== entry.expected);
  const cashDiff = Number(state.closing.moneyReceived || 0) - Number(state.closing.moneyExpected || 0);
  return `<section class="closing-work"><h2>Resumo por Empresa / CNPJ</h2><div class="summary-by-company">${companyTotals(getEntries()).map((company) => `<article class="metric-card ${company.difference < 0 ? 'negative' : 'positive'}"><div class="metric-label"><span>${esc(company.nome)}<small class="block">CNPJ: ${esc(company.cnpj)}</small></span>${differencePill(company.difference)}</div><div class="metric-label">Total Esperado <b>${money(company.expected)}</b></div><div class="metric-label">Total Recebido <b>${money(company.received)}</b></div><strong>${signedMoney(company.difference)}</strong></article>`).join('')}</div>
    <h2>Divergências Encontradas</h2>${entries.map((entry) => {
      const difference = entry.received - entry.expected;
      return `<article class="surface divergence-card"><div class="surface-heading"><h3>${esc(entry.machine.nome_maquina)} · ${esc(entry.company?.nome || 'Empresa')}</h3>${differencePill(difference)}</div><div class="detail-lines"><span>Esperado <b>${money(entry.expected)}</b></span><span>Recebido <b>${money(entry.received)}</b></span><strong class="${differenceClass(difference)}">Diferença: ${money(difference)}</strong></div>${investigationFields(entry.machine.maquina_id)}<button class="text-button" data-page="divergence" data-id="${entry.machine.maquina_id}">Ver detalhe da divergência</button></article>`;
    }).join('')}${cashDiff !== 0 ? `<article class="surface divergence-card"><div class="surface-heading"><h3>Dinheiro em Caixa</h3>${differencePill(cashDiff)}</div><div class="detail-lines"><span>Declarado <b>${money(state.closing.moneyReceived)}</b></span><span>Esperado <b>${money(state.closing.moneyExpected)}</b></span><strong class="${differenceClass(cashDiff)}">Diferença: ${money(cashDiff)}</strong></div>${investigationFields(cashKey)}</article>` : ''}
    ${!entries.length && !cashDiff ? '<p class="empty-state">Nenhuma divergência: todos os valores conferem.</p>' : ''}
    <div class="form-actions spread"><button class="secondary" data-action="closing-back">← Voltar</button><button class="primary" data-action="closing-next">Próximo: Resumo&nbsp; →</button></div></section>`;
}

function summaryStep() {
  const entries = getEntries();
  const cashDiff = Number(state.closing.moneyReceived || 0) - Number(state.closing.moneyExpected || 0);
  const difference = entries.reduce((sum, entry) => sum + entry.received - entry.expected, 0) + cashDiff;
  const mismatches = entries.filter((entry) => entry.received !== entry.expected).map((entry) => `<div class="history-item"><div><strong>${esc(entry.machine.nome_maquina)} · ${esc(entry.company?.nome || 'Empresa')}</strong><small>${esc(state.closing.causes[entry.machine.maquina_id] || 'Sem observação registrada')}</small></div><strong class="${differenceClass(entry.received - entry.expected)}">${money(entry.received - entry.expected)}</strong></div>`).join('');
  const cashMismatch = cashDiff ? `<div class="history-item"><div><strong>Dinheiro em Caixa</strong><small>Declarado ${money(state.closing.moneyReceived)} · Esperado ${money(state.closing.moneyExpected)} · ${esc(state.closing.causes[cashKey] || 'Sem observação registrada')}</small></div><strong class="${differenceClass(cashDiff)}">${money(cashDiff)}</strong></div>` : '';
  return `<section class="closing-work"><div class="summary-by-company">${companyTotals(entries).map((company) => `<article class="metric-card ${company.difference < 0 ? 'negative' : 'positive'}"><small>${esc(company.nome)}</small><strong>${signedMoney(company.difference)}</strong><span>${company.difference < 0 ? 'Falta identificada' : company.difference > 0 ? 'Sobra identificada' : 'Sem diferença'}</span></article>`).join('')}</div><article class="surface"><h2>Divergências Identificadas</h2>${mismatches || cashMismatch ? `${mismatches}${cashMismatch}` : '<p class="helper">Nenhuma divergência identificada.</p>'}<div class="grand-total"><strong>Total Geral</strong><span>Data: ${formatDate(state.closing.date)}</span><span>Diferença: <b class="${differenceClass(difference)}">${money(difference)}</b></span></div><div class="form-actions spread"><button class="secondary" data-action="closing-back">Voltar para Investigar Divergências</button><button class="success" data-action="save-closing">Salvar Fechamento</button></div></article></section>`;
}

function totalMachines(fieldName) { return getEntries().reduce((sum, entry) => sum + entry[fieldName], 0); }

function getEntries() {
  return state.machines.filter((machine) => machine.ativo).map((machine) => {
    const values = state.closing.values[machine.maquina_id] || {};
    return { machine, company: state.companies.find((company) => sameId(company.empresa_id, machine.empresa_id)), expected: Number(values.expected || 0), received: Number(values.received || 0) };
  });
}

function companyTotals(entries) {
  return state.companies.map((company) => {
    const group = entries.filter((entry) => sameId(entry.machine.empresa_id, company.empresa_id));
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
    const diffValue = Number(entry.received || 0) - Number(entry.expected || 0);
    const diff = $(`#difference-${id}`);
    diff.textContent = money(diffValue);
    diff.className = `difference ${differenceClass(diffValue)}`;
    const totals = $('.totals-row');
    if (totals) {
      totals.querySelectorAll('span b')[0].textContent = money(totalMachines('expected'));
      totals.querySelectorAll('span b')[1].textContent = money(totalMachines('received'));
      totals.querySelector('strong:last-child').textContent = money(totalMachines('received') - totalMachines('expected'));
    }
  }));
  $$('[data-cause]').forEach((input) => input.addEventListener('input', () => state.closing.causes[input.dataset.cause] = input.value));
  $$('[data-operator]').forEach((input) => input.addEventListener('change', () => state.closing.operators[input.dataset.operator] = input.value));
}

function updateCash() {
  const difference = $('.cash-difference strong');
  if (difference) difference.textContent = money(Number(state.closing.moneyReceived || 0) - Number(state.closing.moneyExpected || 0));
}

function wizardEntry() {
  return getEntries().find((item) => sameId(item.machine.maquina_id, state.divergenceId)) || getEntries()[0];
}

function renderDivergence() {
  const entry = wizardEntry();
  if (!entry) return `${shell('Divergência', 'Não há máquinas cadastradas.')}<section class="surface">Cadastre máquinas para visualizar esta tela.</section>`;
  const difference = entry.received - entry.expected;
  return `${shell(`Divergência — ${esc(entry.machine.nome_maquina)}`, 'Análise da divergência detectada na conciliação.', '', 'Novo Fechamento › Investigar Divergências')}
    <section class="surface detail-panel"><div class="detail-meta"><span>DISPOSITIVO<strong>${esc(entry.machine.nome_maquina)}</strong></span><span>EMPRESA<strong>${esc(entry.company?.nome || '—')}</strong></span><span>DATA<strong>${formatDate(state.closing.date)}</strong></span><span class="pill red">${Math.abs(difference) >= 100 ? 'Divergência Crítica' : 'Divergência'}</span></div><div class="summary-by-company"><article class="value-box"><small>Valor Esperado (Sistema)</small><strong>${money(entry.expected)}</strong></article><article class="value-box"><small>Valor Recebido (Máquina)</small><strong>${money(entry.received)}</strong></article></div><div class="difference-banner ${difference >= 0 ? 'positive' : ''}"><small>Diferença Apurada</small><strong>${money(difference)}</strong><span>${difference < 0 ? 'Falta de caixa identificada.' : 'Sobra identificada.'}</span></div><div class="form-actions spread"><button class="secondary" data-action="closing-to-step-3">← Voltar</button><button class="primary" data-page="divergence-edit">Editar operador e observação</button></div></section>`;
}

function renderDivergenceEdit() {
  const entry = wizardEntry();
  return `${shell('Associar operador', 'Identifique o operador responsável e descreva a causa.', '', 'Novo Fechamento › Investigar Divergências › Detalhe')}
    <section class="surface"><h2>Detalhamento do Caso</h2><p>${esc(entry?.machine.nome_maquina || '')} · Diferença ${money(entry ? entry.received - entry.expected : 0)}</p>${state.operatorsEnabled ? field('Selecionar Operador', `<select id="divergence-operator">${operatorOptions(state.closing.operators[state.divergenceId], 'Selecione um nome da lista...')}</select>`) : ''}${field('Observação', `<textarea id="divergence-note" rows="4" placeholder="Descreva a causa da divergência...">${esc(state.closing.causes[state.divergenceId] || '')}</textarea>`)}<p class="helper">Os dados são gravados junto com o fechamento, na etapa de resumo.</p></section><div class="form-actions end"><button class="secondary" data-page="divergence">Cancelar</button><button class="primary" data-action="save-divergence-note">Confirmar Alterações</button></div>`;
}

async function saveClosing() {
  const maquinas = getEntries().map((entry) => ({
    maquina_id: entry.machine.maquina_id,
    valor_esperado: entry.expected,
    valor_recebido: entry.received,
    operador_id: state.closing.operators[entry.machine.maquina_id] || null,
    observacao: state.closing.causes[entry.machine.maquina_id] || '',
  }));
  const result = await api(endpoints.closings(state.postId), json('POST', {
    data_referencia: state.closing.date,
    valor_dinheiro_esperado: Number(state.closing.moneyExpected || 0),
    valor_dinheiro_declarado: Number(state.closing.moneyReceived || 0),
    operador_dinheiro_id: state.closing.operators[cashKey] || null,
    observacao_dinheiro: state.closing.causes[cashKey] || '',
    maquinas,
  }));
  state.detailId = result.fechamento_id;
  state.closing = emptyClosing();
  toast('Fechamento salvo com sucesso.');
  await go('history-detail');
}

export default {
  pages: {
    closing: { render: renderClosing, afterRender: bindClosingValues },
    divergence: { render: renderDivergence, nav: 'closing', enter: (id) => { if (id) state.divergenceId = id; } },
    'divergence-edit': { render: renderDivergenceEdit, nav: 'closing' },
  },
  actions: {
    'closing-back': () => { state.closing.step = Math.max(1, state.closing.step - 1); render(); },
    'closing-next': () => { state.closing.step = Math.min(4, state.closing.step + 1); render(); },
    'closing-to-step-3': () => { state.closing.step = 3; return go('closing'); },
    'save-divergence-note': () => { toast('Alterações aplicadas. Elas serão gravadas ao salvar o fechamento.'); return go('divergence'); },
    'save-closing': saveClosing,
  },
  forms: {
    'closing-date-form': () => { state.closing.date = $('#closing-date').value; state.closing.step = 2; render(); },
  },
  inputs: {
    'cash-received': (target) => { state.closing.moneyReceived = target.value; updateCash(); },
    'cash-expected': (target) => { state.closing.moneyExpected = target.value; updateCash(); },
    'divergence-note': (target) => { if (state.divergenceId) state.closing.causes[state.divergenceId] = target.value; },
    'divergence-operator': (target) => { if (state.divergenceId) state.closing.operators[state.divergenceId] = target.value; },
  },
};
