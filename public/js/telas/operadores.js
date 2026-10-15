// Tela: Cadastro de Operadores (CRUD; "excluir" = inativar).
// Só aparece quando o ponto de variação "gestão de operadores" está habilitado.
import { esc, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, sideForm, field, toast, confirmAction, activePill, companyOptions } from '../components.js';
import { render } from '../router.js';
import { refreshContext } from '../context.js';

function renderOperators() {
  const editing = state.operators.find((operator) => sameId(operator.operador_id, state.operatorEditId));
  const rows = state.operators.map((operator) => `<tr><td>${esc(operator.nome_operador)}</td><td>${esc(operator.nome_empresa)}</td><td>${activePill(operator.ativo)}</td><td class="row-actions"><button class="text-button" data-action="edit-operator" data-id="${operator.operador_id}">Editar</button><button class="text-button ${operator.ativo ? 'danger-text' : ''}" data-action="toggle-operator" data-id="${operator.operador_id}" data-active="${!operator.ativo}">${operator.ativo ? 'Inativar' : 'Ativar'}</button></td></tr>`);
  const form = sideForm({
    id: 'operator-form', title: editing ? 'Editar Operador' : 'Adicionar Operador', cancelAction: 'cancel-operator',
    body: field('Nome do Operador *', `<input name="nome" required placeholder="Nome completo" value="${esc(editing?.nome_operador || '')}">`)
      + field('Empresa Vinculada *', `<select name="empresa_id" required>${companyOptions(editing?.empresa_id)}</select>`, `Opções: ${state.companies.map((company) => esc(company.nome)).join(' / ')}`),
  });
  return `${shell('Cadastro de Operadores', 'Gerencie os frentistas e atendentes do posto.', '<button class="success" data-action="new-operator">⊕ &nbsp;Novo Operador</button>')}
    <div class="split-layout"><section class="surface">${dataTable(['Nome Completo', 'Empresa Vinculada', 'Status', 'Ações'], rows, 'Nenhum operador cadastrado.')}</section>${form}</div>`;
}

export default {
  pages: {
    operators: { render: renderOperators, guard: () => state.operatorsEnabled },
  },
  actions: {
    'new-operator': () => { state.operatorEditId = null; render(); },
    'cancel-operator': () => { state.operatorEditId = null; render(); },
    'edit-operator': (id) => { state.operatorEditId = id; render(); },
    'toggle-operator': async (id, button) => {
      const activate = button.dataset.active === 'true';
      if (!activate && !await confirmAction({ title: 'Inativar operador?', message: 'O operador deixa de aparecer para associação em novas divergências. O histórico é mantido.', confirmLabel: 'Inativar' })) return;
      await api(endpoints.operator(id), json('PATCH', { ativo: activate }));
      await refreshContext();
      render();
      toast('Status do operador atualizado.');
    },
  },
  forms: {
    'operator-form': async (data) => {
      const payload = { nome: data.get('nome'), empresa_id: data.get('empresa_id') };
      if (state.operatorEditId) await api(endpoints.operator(state.operatorEditId), json('PUT', payload));
      else await api(endpoints.operatorCreate, json('POST', payload));
      await refreshContext();
      state.operatorEditId = null;
      render();
      toast('Operador salvo com sucesso.');
    },
  },
};
