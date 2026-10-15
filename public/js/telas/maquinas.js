// Tela: Cadastro de Máquinas (CRUD; "excluir" = inativar).
import { esc, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, sideForm, field, toast, confirmAction, activePill, companyOptions } from '../components.js';
import { render } from '../router.js';
import { refreshContext } from '../context.js';

function renderMachines() {
  const editing = state.machines.find((machine) => sameId(machine.maquina_id, state.machineEditId));
  const rows = state.machines.map((machine) => `<tr><td>${esc(machine.nome_maquina)}</td><td>${esc(machine.nome_empresa)}</td><td>${activePill(machine.ativo)}</td><td class="row-actions"><button class="text-button" data-action="edit-machine" data-id="${machine.maquina_id}">Editar</button><button class="text-button ${machine.ativo ? 'danger-text' : ''}" data-action="toggle-machine" data-id="${machine.maquina_id}" data-active="${!machine.ativo}">${machine.ativo ? 'Inativar' : 'Ativar'}</button></td></tr>`);
  const form = sideForm({
    id: 'machine-form', title: editing ? 'Editar Máquina' : 'Adicionar Máquina', cancelAction: 'cancel-machine',
    body: field('Nome da Máquina *', `<input name="nome" required placeholder="Ex.: Stone Recepção" value="${esc(editing?.nome_maquina || '')}">`)
      + field('Empresa Vinculada *', `<select name="empresa_id" required>${companyOptions(editing?.empresa_id)}</select>`)
      + `<input type="hidden" name="ativo" value="${editing ? editing.ativo : true}">`,
  });
  return `${shell('Cadastro de Máquinas', 'Gerencie as máquinas de cartão do posto.', '<button class="success" data-action="new-machine">⊕ &nbsp;Nova Máquina</button>')}
    <div class="split-layout"><section class="surface">${dataTable(['Nome da Máquina', 'Empresa Vinculada', 'Status', 'Ações'], rows, 'Nenhuma máquina cadastrada.')}</section>${form}</div>`;
}

export default {
  pages: {
    machines: { render: renderMachines },
  },
  actions: {
    'new-machine': () => { state.machineEditId = null; render(); },
    'cancel-machine': () => { state.machineEditId = null; render(); },
    'edit-machine': (id) => { state.machineEditId = id; render(); },
    'toggle-machine': async (id, button) => {
      const activate = button.dataset.active === 'true';
      if (!activate && !await confirmAction({ title: 'Inativar máquina?', message: 'A máquina deixa de aparecer nos novos fechamentos. Os fechamentos antigos continuam com o histórico dela.', confirmLabel: 'Inativar' })) return;
      await api(endpoints.machine(id), json('PATCH', { ativo: activate }));
      await refreshContext();
      render();
      toast('Status da máquina atualizado.');
    },
  },
  forms: {
    'machine-form': async (data) => {
      const payload = { nome: data.get('nome'), empresa_id: data.get('empresa_id'), ativo: data.get('ativo') === 'true' };
      if (state.machineEditId) await api(endpoints.machine(state.machineEditId), json('PUT', payload));
      else await api(endpoints.machineCreate, json('POST', payload));
      await refreshContext();
      state.machineEditId = null;
      render();
      toast('Máquina salva com sucesso.');
    },
  },
};
