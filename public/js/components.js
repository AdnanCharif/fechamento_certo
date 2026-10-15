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
export const searchBox = (id, value, placeholder) => `<div class="surface search-bar"><input id="${id}" type="search" value="${esc(value)}" placeholder="${placeholder}" aria-label="${placeholder}"></div>`;
export const notReady = (text) => `<div class="notice warning"><span>Backend pendente</span> ${text}</div>`;

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

export function companyOptions(selected) {
  return `<option value="">Selecione uma empresa</option>${state.companies.map((company) => `<option value="${company.empresa_id}" ${sameId(selected, company.empresa_id) ? 'selected' : ''}>${esc(company.nome)}</option>`).join('')}`;
}

export function operatorOptions(selected, placeholder = 'Sem operador') {
  return `<option value="">${placeholder}</option>${state.operators.filter((operator) => operator.ativo).map((operator) => `<option value="${operator.operador_id}" ${sameId(selected, operator.operador_id) ? 'selected' : ''}>${esc(operator.nome_operador)} (${esc(operator.nome_empresa)})</option>`).join('')}`;
}
