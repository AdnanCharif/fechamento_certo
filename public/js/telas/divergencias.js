// Tela: Divergências de um fechamento (CRUD).
import { esc, formatDate, signedMoney, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, sideForm, field, notReady, toast, confirmAction, differenceClass, divergencePill, divergenceStatus, divergenceOrigin, operatorOptions } from '../components.js';
import { go, render } from '../router.js';
import { loadClosingDetail, detailMissing } from './fechamentos.js';

function renderClosingDivergences() {
  const data = state.detailData;
  if (!data) return detailMissing();
  const editing = data.divergencias.find((item) => sameId(item.divergencia_id, state.divergenceEditId));
  const rows = data.divergencias.map((item) => `<tr><td>${esc(divergenceOrigin(item))}</td><td class="${differenceClass(item.valor_diferenca)}">${signedMoney(item.valor_diferenca)}</td><td>${divergencePill(item.status)}</td><td class="row-actions"><button class="text-button" data-action="edit-divergence" data-id="${item.divergencia_id}">Editar</button><button class="text-button danger-text" data-action="delete-divergence" data-id="${item.divergencia_id}">Excluir</button></td></tr>`);
  const machineOptions = `<option value="">Dinheiro em caixa / geral</option>${data.maquinas.map((row) => `<option value="${row.fechamento_maquina_id}" ${editing && sameId(editing.maquina_id, row.maquina_id) ? 'selected' : ''}>${esc(row.maquina_nome)} (${signedMoney(row.diferenca)})</option>`).join('')}`;
  const statusOptions = Object.entries(divergenceStatus).map(([value, [label]]) => `<option value="${value}" ${(editing?.status || 'pendente') === value ? 'selected' : ''}>${label}</option>`).join('');
  const form = sideForm({
    id: 'divergence-form', title: editing ? 'Editar Divergência' : 'Registrar Divergência', cancelAction: 'cancel-divergence',
    body: field('Origem', `<select name="fechamento_maquina_id" ${editing ? 'disabled' : ''}>${machineOptions}</select>`)
      + field('Valor da diferença (R$)', `<input name="valor_diferenca" type="number" step="0.01" required value="${esc(editing?.valor_diferenca ?? '')}" placeholder="-150,00">`, 'Use valor negativo para falta e positivo para sobra.')
      + field('Status', `<select name="status">${statusOptions}</select>`)
      + (state.operatorsEnabled ? field('Operador responsável', `<select name="operador_id">${operatorOptions('', 'Sem operador')}</select>`) : ''),
  });
  return `${shell('Divergências do Fechamento', `${formatDate(data.fechamento.data_referencia)} · investigue, associe operadores e acompanhe o status.`, '<button class="success" data-action="new-divergence">⊕ &nbsp;Nova Divergência</button>', 'Histórico › Detalhes do Fechamento › Divergências')}
    ${notReady('As rotas de criar, editar e excluir divergências ainda não existem; a listagem já vem do banco.')}
    <div class="split-layout"><section class="surface">${dataTable(['Origem', 'Diferença', 'Status', 'Ações'], rows, 'Nenhuma divergência neste fechamento.')}</section>${form}</div>
    <div class="form-actions"><button class="secondary" data-page="history-detail">← Voltar ao fechamento</button></div>`;
}

export default {
  pages: {
    'closing-divergences': { render: renderClosingDivergences, load: loadClosingDetail, nav: 'history', fallback: 'history', enter: () => { state.divergenceEditId = null; } },
  },
  actions: {
    'new-divergence': () => { state.divergenceEditId = null; render(); },
    'cancel-divergence': () => { state.divergenceEditId = null; render(); },
    'edit-divergence': (id) => { state.divergenceEditId = id; render(); },
    'delete-divergence': async (id) => {
      if (!await confirmAction({ title: 'Excluir divergência?', message: 'O registro da divergência e o vínculo com o operador serão removidos deste fechamento.', confirmLabel: 'Excluir' })) return;
      await api(endpoints.divergence(state.postId, state.detailId, id), { method: 'DELETE' });
      state.divergenceEditId = null;
      toast('Divergência excluída.');
      await go('closing-divergences');
    },
  },
  forms: {
    'divergence-form': async (data) => {
      const payload = { valor_diferenca: Number(data.get('valor_diferenca')), status: data.get('status'), operador_id: data.get('operador_id') || null };
      if (state.divergenceEditId) await api(endpoints.divergence(state.postId, state.detailId, state.divergenceEditId), json('PUT', payload));
      else await api(endpoints.divergences(state.postId, state.detailId), json('POST', { ...payload, fechamento_maquina_id: data.get('fechamento_maquina_id') || null }));
      toast('Divergência salva.');
      state.divergenceEditId = null;
      await go('closing-divergences');
    },
  },
};
