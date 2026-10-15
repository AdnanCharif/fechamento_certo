// Tela: Dashboard do posto (saldos do mês e últimos fechamentos).
import { formatDate, money, signedMoney, todayPt } from '../utils.js';
import { api, endpoints } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, differencePill, differenceClass, closingPill } from '../components.js';

function historyRow(item) {
  return `<button class="recent-row" data-page="history-detail" data-id="${item.fechamento_id}"><span><strong>${formatDate(item.data)}</strong><small>Total em cartões</small></span><strong>${money(item.total_cartoes)}</strong>${closingPill(item.status)}</button>`;
}

function renderDashboard() {
  const data = state.dashboardData || { totals: {}, daily: [], recent: [] };
  const totals = data.totals || {};
  const dailyRows = (data.daily || []).map((row) => `<tr><td>${formatDate(row.data)}</td><td class="${differenceClass(row.diferenca)}">${signedMoney(row.diferenca)}</td></tr>`);
  return `${shell('Dashboard', `Hoje, ${todayPt()}`, '<button class="primary" data-page="closing">⊕ &nbsp;Novo Fechamento</button>')}
    <section class="metric-grid">
      <article class="metric-card ${Number(totals.posto) < 0 ? 'negative' : 'positive'}"><div class="metric-label">Saldo do Posto neste mês${differencePill(totals.posto)}</div><strong>${signedMoney(totals.posto)}</strong><small>Soma das diferenças da empresa de combustível</small></article>
      <article class="metric-card ${Number(totals.loja) < 0 ? 'negative' : 'positive'}"><div class="metric-label">Saldo da Loja neste mês${differencePill(totals.loja)}</div><strong>${signedMoney(totals.loja)}</strong><small>Soma das diferenças da conveniência</small></article>
      <article class="metric-card"><div class="metric-label">Fechamentos no mês<span class="pill gray">PROGRESSO</span></div><strong class="dark-value">${Number(totals.quantidade || 0)}</strong><small>Fechamentos registrados no mês atual</small></article>
    </section>
    <section class="dashboard-grid"><article class="surface chart-card"><h2>Evolução diária</h2>${dataTable(['Data', 'Diferença total'], dailyRows, 'Nenhum fechamento neste mês.')}</article>
      <article class="surface recent-card"><div class="surface-heading"><h2>Últimos fechamentos</h2><button class="text-button" data-page="history">Ver histórico</button></div>${(data.recent || []).map(historyRow).join('') || '<p class="helper">Ainda não há fechamentos.</p>'}</article></section>`;
}

export default {
  pages: {
    dashboard: {
      render: renderDashboard,
      load: async () => { if (state.postId) state.dashboardData = await api(endpoints.closingDashboard(state.postId)); },
    },
  },
};
