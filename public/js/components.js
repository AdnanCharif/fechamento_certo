// Componentes de interface reutilizados por todas as telas.
import { $, esc, sameId } from './utils.js';
import { state } from './state.js';

let toastTimer = null;
export function toast(message, error = false) {
  const element = $('#toast');
  element.textContent = message;
  element.className = `toast visible${error ? ' error' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => element.className = 'toast', 4200);
}

// Modal de confirmação: resolve true ao confirmar e false ao cancelar ou apertar Esc.
export function confirmAction({ title, message, confirmLabel = 'Confirmar' }) {
  const dialog = $('#confirm-dialog');
  $('#confirm-title').textContent = title;
  $('#confirm-message').textContent = message;
  $('#confirm-button').textContent = confirmLabel;
  const form = $('form', dialog);
  dialog.showModal();
  return new Promise((resolve) => {
    const finish = (value) => {
      form.removeEventListener('submit', onSubmit);
      dialog.removeEventListener('cancel', onCancel);
      dialog.close();
      resolve(value);
    };
    const onSubmit = (event) => { event.preventDefault(); finish(event.submitter?.value === 'confirm'); };
    const onCancel = (event) => { event.preventDefault(); finish(false); };
    form.addEventListener('submit', onSubmit);
    dialog.addEventListener('cancel', onCancel);
  });
}

export function shell(title, subtitle = '', action = '', breadcrumb = '') {
  return `${breadcrumb ? `<p class="breadcrumb">${breadcrumb}</p>` : ''}<header class="page-heading"><div><h1>${title}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${action ? `<div class="heading-actions">${action}</div>` : ''}</header>`;
}

export function dataTable(headers, rows, emptyText) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead><tbody>${rows.join('') || `<tr><td colspan="${headers.length}" class="empty-cell">${emptyText}</td></tr>`}</tbody></table></div>`;
}

export function sideForm({ id, title, body, cancelAction, submitLabel = 'Salvar' }) {
  return `<form id="${id}" class="surface side-form"><h2>${title}</h2>${body}<div class="form-actions"><button type="button" class="secondary" data-action="${cancelAction}">Cancelar</button><button class="success">${submitLabel}</button></div></form>`;
}

export const field = (label, control, hint = '') => `<label>${label}${control}${hint ? `<small class="field-hint">${hint}</small>` : ''}</label>`;
export const searchBox = (id, value, placeholder) => `<div class="surface search-bar"><span class="search-icon" aria-hidden="true">⌕</span><input id="${id}" type="search" value="${esc(value)}" placeholder="${placeholder}" aria-label="${placeholder}"></div>`;
export const infoNotice = (text) => `<div class="notice info-notice"><span aria-hidden="true">ⓘ</span>${text}</div>`;

// Card de indicador: rótulo, selo, valor em destaque e explicação. tone: green | amber | blue | red | dark.
export function metricCard({ label, badge = '', badgeColor = 'gray', value, tone = 'green', hint = '', border = '' }) {
  return `<article class="metric-card ${border}"><div class="metric-label">${esc(label)}${badge ? `<span class="pill ${badgeColor}">${esc(badge)}</span>` : ''}</div><strong class="tone-${tone}">${value}</strong>${hint ? `<small>${hint}</small>` : ''}</article>`;
}

// Mensagem de erro presa ao campo (borda vermelha + texto abaixo); some quando o campo muda.
export function showFieldError(input, message) {
  input.classList.add('invalid');
  input.insertAdjacentHTML('afterend', `<small class="field-error">${esc(message)}</small>`);
  input.focus();
  input.addEventListener('input', () => {
    input.classList.remove('invalid');
    if (input.nextElementSibling?.classList.contains('field-error')) input.nextElementSibling.remove();
  }, { once: true });
}

// Paginação feita no cliente, usada pelas listas da área admin.
export const PAGE_SIZE = 8;
export function paginate(list, page) {
  const total = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const current = Math.min(Math.max(1, Number(page) || 1), total);
  return { items: list.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE), current, total };
}
export function pager(action, { current, total }) {
  return `<div class="pager"><button class="secondary" data-action="${action}" data-id="${current - 1}" ${current <= 1 ? 'disabled' : ''}>Anterior</button><strong>Página ${current} de ${total}</strong><button class="secondary" data-action="${action}" data-id="${current + 1}" ${current >= total ? 'disabled' : ''}>Próxima</button></div>`;
}

// Gráfico de colunas a partir de uma linha de base. Com valores negativos, as colunas descem
// da linha do zero, então o sinal é lido pela posição e não só pela cor. Cada coluna é
// focável, mostra a dica no hover/foco e tem o próprio rótulo para leitores de tela.
// A linha do zero fica na proporção entre o maior valor positivo e o maior negativo,
// então um período só com faltas usa a altura toda para baixo.
export function columnChart({ items, caption, format = String, height = 150, showValues = false }) {
  const values = items.map((item) => Number(item.value));
  const maxPositive = Math.max(0, ...values);
  const maxNegative = Math.max(0, ...values.map((value) => -value));
  const range = maxPositive + maxNegative || 1;
  const diverging = maxNegative > 0;
  const zero = diverging ? (maxPositive / range) * 100 : 100;
  const columns = items.map((item, index) => {
    const value = values[index];
    const size = value ? Math.max(2, (Math.abs(value) / range) * 100) : 0;
    const tip = `${item.label}: ${format(value)}`;
    return `<div class="chart-column" tabindex="0" role="img" aria-label="${esc(tip)}" data-tip="${esc(tip)}"><div class="chart-plot${diverging ? ' diverging' : ''}">${showValues && value ? `<span class="chart-value">${esc(item.valueLabel ?? value)}</span>` : ''}<i class="chart-bar ${value < 0 ? 'negative' : 'positive'}" style="--size:${size}%"></i></div><span class="chart-label" aria-hidden="true">${esc(item.shortLabel ?? item.label)}</span></div>`;
  }).join('');
  return `<div class="column-chart" style="--chart-height:${height}px; --zero:${zero}%" role="group" aria-label="${esc(caption)}">${columns || '<p class="helper">Sem dados no período.</p>'}</div>`;
}

const registrationStatus = { ativo: ['Ativo', 'green'], inativo: ['Inativo', 'red'], pendente: ['Pendente', 'yellow'] };
export const registrationPill = (status) => { const [label, color] = registrationStatus[status] || [status, 'gray']; return `<span class="pill ${color}">${esc(label)}</span>`; };

const balanceStatus = { ok: ['Dentro do Limite', 'green'], atencao: ['Atenção', 'yellow'], critico: ['Crítico', 'red'] };
export const balancePill = (status, prefix = '') => { const [label, color] = balanceStatus[status] || [status, 'gray']; return `<span class="pill ${color}">${esc(prefix + label)}</span>`; };

export const activePill = (active) => `<span class="pill ${active ? 'green' : 'gray'}">${active ? 'Ativo' : 'Inativo'}</span>`;
export const differencePill = (value) => Number(value) < 0 ? '<span class="pill red">FALTA</span>' : Number(value) > 0 ? '<span class="pill green">SOBRA</span>' : '<span class="pill gray">OK</span>';
export const differenceClass = (value) => Number(value) < 0 ? 'negative-text' : Number(value) > 0 ? 'positive-text' : '';
export const companyType = (type) => type === 'combustivel' ? 'Posto de Combustível' : 'Loja de Conveniência';

const closingStatus = { ok: ['OK', 'green'], com_divergencia: ['Divergência', 'red'], em_analise: ['Em análise', 'yellow'], arquivado: ['Arquivado', 'gray'] };
export const closingPill = (status) => { const [label, color] = closingStatus[status] || [status, 'gray']; return `<span class="pill ${color}">${esc(label)}</span>`; };

export const divergenceStatus = { pendente: ['Pendente', 'yellow'], investigada: ['Investigada', 'blue'], resolvida: ['Resolvida', 'green'] };
export const divergencePill = (status) => { const [label, color] = divergenceStatus[status] || [status, 'gray']; return `<span class="pill ${color}">${esc(label)}</span>`; };
export const divergenceOrigin = (divergence) => divergence.maquina_nome || 'Dinheiro em caixa / geral';

export function noteCard(note) {
  return `<article class="note-card"><div><strong>${esc(note.usuario_nome)}</strong><small>${new Date(note.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</small></div><p>${esc(note.texto)}</p></article>`;
}

export const initial = (name) => esc(String(name ?? '').trim()[0]?.toUpperCase() || '?');

export function companyOptions(selected) {
  return `<option value="">Selecione uma empresa</option>${state.companies.map((company) => `<option value="${company.empresa_id}" ${sameId(selected, company.empresa_id) ? 'selected' : ''}>${esc(company.nome)}</option>`).join('')}`;
}

export function operatorOptions(selected, placeholder = 'Sem operador') {
  return `<option value="">${placeholder}</option>${state.operators.filter((operator) => operator.ativo).map((operator) => `<option value="${operator.operador_id}" ${sameId(selected, operator.operador_id) ? 'selected' : ''}>${esc(operator.nome_operador)} (${esc(operator.nome_empresa)})</option>`).join('')}`;
}
