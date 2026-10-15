// Tela: Observações de um fechamento (CRUD).
import { esc, formatDate, signedMoney, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, sideForm, field, notReady, toast, confirmAction, divergenceOrigin, noteCard } from '../components.js';
import { go, render } from '../router.js';
import { loadClosingDetail, detailMissing } from './fechamentos.js';

function renderClosingNotes() {
  const data = state.detailData;
  if (!data) return detailMissing();
  const editing = data.observacoes.find((item) => sameId(item.observacao_id, state.noteEditId));
  const notes = data.observacoes.map((note) => `<div class="note-row">${noteCard(note)}<div class="row-actions"><button class="text-button" data-action="edit-note" data-id="${note.observacao_id}">Editar</button><button class="text-button danger-text" data-action="delete-note" data-id="${note.observacao_id}">Excluir</button></div></div>`).join('');
  const divergenceOptions = `<option value="">Observação geral do fechamento</option>${data.divergencias.map((item) => `<option value="${item.divergencia_id}">${esc(divergenceOrigin(item))} (${signedMoney(item.valor_diferenca)})</option>`).join('')}`;
  const form = sideForm({
    id: 'note-form', title: editing ? 'Editar Observação' : 'Nova Observação', cancelAction: 'cancel-note',
    body: (editing ? '' : field('Vincular a', `<select name="divergencia_id">${divergenceOptions}</select>`))
      + field('Texto', `<textarea name="texto" rows="6" required placeholder="Ex.: conferido com o operador, foi engano no troco.">${esc(editing?.texto || '')}</textarea>`),
  });
  return `${shell('Observações do Fechamento', `${formatDate(data.fechamento.data_referencia)} · anotações para o contador e para o dono.`, '<button class="success" data-action="new-note">⊕ &nbsp;Nova Observação</button>', 'Histórico › Detalhes do Fechamento › Observações')}
    ${notReady('As rotas de criar, editar e excluir observações ainda não existem; a listagem já vem do banco.')}
    <div class="split-layout"><section class="surface">${notes || '<p class="empty-state">Nenhuma observação registrada.</p>'}</section>${form}</div>
    <div class="form-actions"><button class="secondary" data-page="history-detail">← Voltar ao fechamento</button></div>`;
}

export default {
  pages: {
    'closing-notes': { render: renderClosingNotes, load: loadClosingDetail, nav: 'history', fallback: 'history', enter: () => { state.noteEditId = null; } },
  },
  actions: {
    'new-note': () => { state.noteEditId = null; render(); },
    'cancel-note': () => { state.noteEditId = null; render(); },
    'edit-note': (id) => { state.noteEditId = id; render(); },
    'delete-note': async (id) => {
      if (!await confirmAction({ title: 'Excluir observação?', message: 'A observação será removida deste fechamento.', confirmLabel: 'Excluir' })) return;
      await api(endpoints.note(state.postId, state.detailId, id), { method: 'DELETE' });
      state.noteEditId = null;
      toast('Observação excluída.');
      await go('closing-notes');
    },
  },
  forms: {
    'note-form': async (data) => {
      const texto = data.get('texto').trim();
      if (!texto) { toast('Escreva o texto da observação.', true); return; }
      if (state.noteEditId) await api(endpoints.note(state.postId, state.detailId, state.noteEditId), json('PUT', { texto }));
      else await api(endpoints.notes(state.postId, state.detailId), json('POST', { texto, divergencia_id: data.get('divergencia_id') || null }));
      toast('Observação salva.');
      state.noteEditId = null;
      await go('closing-notes');
    },
  },
};
