// Tela: Fechamentos (READ, UPDATE e "DELETE" = arquivar) — histórico, detalhe e edição.
import { esc, formatDate, money, signedMoney } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, toast, confirmAction, closingPill, differencePill, differenceClass, noteCard } from '../components.js';
import { go, render } from '../router.js';

// Usados também pelas telas de divergências e observações.
export async function loadClosingDetail() {
  state.detailData = state.detailId ? await api(endpoints.closing(state.postId, state.detailId)) : null;
}

export function detailMissing() {
  return `${shell('Fechamento')}<section class="surface empty-state">Selecione um fechamento no histórico. <button class="text-button" data-page="history">Ir para o histórico</button></section>`;
}

function loadHistory() {
  const params = new URLSearchParams();
  if (state.historyFrom) params.set('from', state.historyFrom);
  if (state.historyTo) params.set('to', state.historyTo);
  const status = { OK: 'ok', 'Divergência': 'com_divergencia', 'Em análise': 'em_analise', Arquivado: 'arquivado' }[state.historyFilter];
  if (status) params.set('status', status);
  return api(`${endpoints.closings(state.postId)}?${params}`);
}

function renderHistory() {
  const rows = (state.historyData || []).map((item) => `<tr><td>${formatDate(item.data)}</td><td>${closingPill(item.status)}</td><td>${money(item.total_cartoes)}</td><td>${money(item.dinheiro_declarado)}</td><td class="${differenceClass(item.posto)}">${signedMoney(item.posto)}</td><td class="${differenceClass(item.loja)}">${signedMoney(item.loja)}</td><td><button class="text-button" data-page="history-detail" data-id="${item.fechamento_id}">Ver detalhe</button></td></tr>`);
  const options = ['Todos', 'OK', 'Divergência', 'Em análise', 'Arquivado'].map((name) => `<option ${state.historyFilter === name ? 'selected' : ''}>${name}</option>`).join('');
  return `${shell('Histórico de Fechamentos', 'Consulte e filtre fechamentos anteriores registrados no sistema.', '<button class="primary" data-page="closing">⊕ &nbsp;Novo Fechamento</button>', 'Histórico › Fechamentos')}
    <form id="history-filter" class="surface filter-bar"><label>De<input type="date" name="from" value="${esc(state.historyFrom)}"></label><label>Até<input type="date" name="to" value="${esc(state.historyTo)}"></label><label>Status<select name="status">${options}</select></label><button class="primary">Filtrar</button></form>
    <section class="surface">${dataTable(['Data', 'Status', 'Total Cartões', 'Total Dinheiro', 'Posto', 'Loja Conveniência', ''], rows, 'Nenhum fechamento encontrado.')}<div class="table-footer">Mostrando ${rows.length} fechamentos</div></section>`;
}

function renderHistoryDetail() {
  const data = state.detailData;
  if (!data) return detailMissing();
  const item = data.fechamento;
  const cashDiff = Number(item.valor_dinheiro_declarado || 0) - Number(item.valor_dinheiro_esperado || 0);
  const actions = item.status === 'arquivado' ? '' : '<button class="secondary" data-page="closing-edit">✎ Editar</button><button class="danger-outline" data-action="archive-closing">Arquivar</button>';
  const companies = data.empresas.map((company) => `<article class="metric-card ${Number(company.diferenca) < 0 ? 'negative' : 'positive'}"><div class="metric-label">${esc(company.nome)} (${company.tipo === 'combustivel' ? 'Posto' : 'Loja'})${differencePill(company.diferenca)}</div><strong>${signedMoney(company.diferenca)}</strong><small>Esperado ${money(company.valor_esperado)} · Recebido ${money(company.valor_recebido)}</small></article>`).join('');
  const machineRows = data.maquinas.map((row) => `<tr><td>${esc(row.maquina_nome)}</td><td>${esc(row.empresa_nome)}</td><td>${esc(row.operador_nome || '—')}</td><td>${money(row.valor_esperado)}</td><td>${money(row.valor_recebido)}</td><td class="${differenceClass(row.diferenca)}">${signedMoney(row.diferenca)}</td></tr>`);
  const notes = data.observacoes.slice(-3).map(noteCard).join('');
  return `${shell(`Fechamento — ${formatDate(item.data_referencia)}`, `Fechado por ${esc(item.usuario_nome)} · ${closingPill(item.status)}`, actions, 'Histórico › Detalhes do Fechamento')}
    <div class="summary-by-company">${companies || '<p class="helper">Sem totais por empresa.</p>'}</div>
    <section class="surface"><h2>Máquinas de Cartão</h2>${dataTable(['Identificação', 'Empresa', 'Operador', 'Valor Esperado (Sist.)', 'Valor Recebido (Máq.)', 'Diferença'], machineRows, 'Sem lançamentos de máquinas.')}
      <h2 class="section-title">Fluxo de Dinheiro em Espécie</h2><div class="cash-summary"><span><small>Esperado em Caixa</small><strong>${money(item.valor_dinheiro_esperado)}</strong></span><span><small>Contado (Físico)</small><strong>${money(item.valor_dinheiro_declarado)}</strong></span><span><small>Diferença</small><strong class="${differenceClass(cashDiff)}">${signedMoney(cashDiff)}</strong></span></div></section>
    <div class="link-cards">
      <button class="surface link-card" data-page="closing-divergences"><span><strong>Divergências</strong><small>${data.divergencias.length} registrada(s) · ${data.divergencias.filter((d) => d.status !== 'resolvida').length} em aberto</small></span><b>Gerenciar →</b></button>
      <button class="surface link-card" data-page="closing-notes"><span><strong>Observações</strong><small>${data.observacoes.length} registrada(s)</small></span><b>Gerenciar →</b></button>
    </div>
    <section class="surface"><div class="surface-heading"><h2>Observações recentes</h2><button class="text-button" data-page="closing-notes">Ver todas</button></div>${notes || '<p class="helper">Nenhuma observação registrada.</p>'}</section>
    <div class="form-actions"><button class="secondary" data-page="history">← Voltar ao Histórico</button></div>`;
}

function renderClosingEdit() {
  const data = state.detailData;
  if (!data) return detailMissing();
  const item = data.fechamento;
  const rows = data.maquinas.map((row) => `<div class="value-row"><strong>${esc(row.maquina_nome)}<small>${esc(row.empresa_nome)}</small></strong><input name="esperado-${row.fechamento_maquina_id}" type="number" min="0" step="0.01" required value="${esc(row.valor_esperado)}" aria-label="Valor esperado de ${esc(row.maquina_nome)}"><input name="recebido-${row.fechamento_maquina_id}" type="number" min="0" step="0.01" required value="${esc(row.valor_recebido)}" aria-label="Valor recebido de ${esc(row.maquina_nome)}"><span class="difference">${signedMoney(row.diferenca)}</span></div>`).join('');
  return `${shell(`Editar Fechamento — ${formatDate(item.data_referencia)}`, 'Toda alteração fica registrada no log de auditoria.', '', 'Histórico › Detalhes do Fechamento › Editar')}
    <form id="closing-edit-form" class="surface closing-work"><h2>Cartões por máquina</h2><div class="value-table"><div class="value-head"><span>Máquina</span><span>Valor Esperado</span><span>Valor Recebido</span><span>Diferença atual</span></div>${rows || '<p class="helper">Sem lançamentos de máquinas.</p>'}</div>
      <h3>Dinheiro em Caixa</h3><div class="cash-grid"><label>Valor Declarado (contagem física)<input name="valor_dinheiro_declarado" type="number" min="0" step="0.01" required value="${esc(item.valor_dinheiro_declarado)}"></label><label>Valor Esperado (Sistema)<input name="valor_dinheiro_esperado" type="number" min="0" step="0.01" required value="${esc(item.valor_dinheiro_esperado)}"></label></div>
      <div class="form-actions spread"><button type="button" class="secondary" data-page="history-detail">Cancelar</button><button class="success">Salvar Alterações</button></div></form>`;
}

export default {
  pages: {
    history: { render: renderHistory, load: async () => { if (state.postId) state.historyData = await loadHistory(); } },
    'history-detail': { render: renderHistoryDetail, load: loadClosingDetail, nav: 'history', fallback: 'history', enter: (id) => { if (id) state.detailId = Number(id); } },
    'closing-edit': { render: renderClosingEdit, load: loadClosingDetail, nav: 'history', fallback: 'history' },
  },
  actions: {
    'archive-closing': async () => {
      const ok = await confirmAction({ title: 'Arquivar fechamento?', message: 'O fechamento deixa de ser editável, mas continua disponível no histórico. Fechamentos nunca são apagados.', confirmLabel: 'Arquivar' });
      if (!ok) return;
      await api(endpoints.closing(state.postId, state.detailId), { method: 'DELETE' });
      toast('Fechamento arquivado.');
      await go('history');
    },
  },
  forms: {
    'history-filter': async (data) => {
      state.historyFilter = data.get('status');
      state.historyFrom = data.get('from') || '';
      state.historyTo = data.get('to') || '';
      state.historyData = await loadHistory();
      render();
    },
    'closing-edit-form': async (data) => {
      const maquinas = state.detailData.maquinas.map((row) => ({
        fechamento_maquina_id: row.fechamento_maquina_id,
        valor_esperado: Number(data.get(`esperado-${row.fechamento_maquina_id}`)),
        valor_recebido: Number(data.get(`recebido-${row.fechamento_maquina_id}`)),
      }));
      await api(endpoints.closing(state.postId, state.detailId), json('PUT', {
        valor_dinheiro_esperado: Number(data.get('valor_dinheiro_esperado')),
        valor_dinheiro_declarado: Number(data.get('valor_dinheiro_declarado')),
        maquinas,
      }));
      toast('Fechamento atualizado e registrado no log.');
      await go('history-detail');
    },
  },
};
