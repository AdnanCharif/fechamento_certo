// Tela: Dashboard do posto (saldos do mês e últimos fechamentos). Com o módulo Multi-unidade,
// ganha no topo os indicadores consolidados da rede.
import { esc, formatDate, money, signedMoney, todayPt, sameId } from '../utils.js';
import { api, endpoints } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, differencePill, differenceClass, closingPill, infoNotice, metricCard } from '../components.js';
import { loadNetworkSummary } from './rede.js';

const hasNetwork = () => state.modules.includes('multi_unidade');

function historyRow(item) {
  return `<button class="recent-row" data-page="history-detail" data-id="${item.fechamento_id}"><span><strong>${formatDate(item.data)}</strong><small>Total em cartões</small></span><strong>${money(item.total_cartoes)}</strong>${closingPill(item.status)}</button>`;
}

function networkSection() {
  const summary = state.networkSummary;
  if (!summary) return `${infoNotice('Menu expandido — rede com módulo Multi-unidade ativado')}<section class="surface empty-state">Não foi possível carregar os indicadores da rede.</section>`;
  const cohesion = summary.cohesion * 100;
  const [cohesionLabel, cohesionColor] = cohesion >= 98 ? ['EXCELENTE', 'green'] : cohesion >= 95 ? ['BOA', 'blue'] : ['BAIXA', 'red'];
  return `${infoNotice('Menu expandido — rede com módulo Multi-unidade ativado')}
    <section class="metric-grid">
      ${metricCard({ label: 'Faturamento Consolidado', badge: 'REDE', value: money(summary.total), tone: 'green', hint: `Cartões + dinheiro das ${summary.units} unidades nos últimos 30 dias`, border: 'positive' })}
      <button class="metric-link" data-page="network-alerts">${metricCard({ label: 'Alertas de Divergência', badge: summary.alerts ? 'REQUER ATENÇÃO' : 'SEM ALERTAS', badgeColor: summary.alerts ? 'yellow' : 'green', value: `${summary.alerts} Alerta${summary.alerts === 1 ? '' : 's'} Ativo${summary.alerts === 1 ? '' : 's'}`, tone: summary.critical ? 'red' : summary.alerts ? 'amber' : 'green', hint: 'Ver alertas no comparativo', border: summary.alerts ? 'warning' : '' })}</button>
      ${metricCard({ label: 'Taxa de Coesão Física', badge: cohesionLabel, badgeColor: cohesionColor, value: `${cohesion.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, tone: 'blue', hint: 'Quanto o físico bate com o sistema (100% = nenhuma diferença)' })}
    </section>`;
}

function renderDashboard() {
  const data = state.dashboardData || { totals: {}, daily: [], recent: [] };
  const totals = data.totals || {};
  const post = state.posts.find((item) => sameId(item.posto_id, state.postId));
  const dailyRows = (data.daily || []).map((row) => `<tr><td>${formatDate(row.data)}</td><td class="${differenceClass(row.diferenca)}">${signedMoney(row.diferenca)}</td></tr>`);
  const network = hasNetwork();
  const heading = network
    ? shell('Dashboard Consolidado', `Administrando ${state.networkSummary?.units ?? '—'} unidades da rede · Hoje, ${todayPt()}`, '<button class="primary" data-page="closing">⊕ &nbsp;Novo Fechamento</button>')
    : shell(`Painel: ${esc(post?.nome_posto || 'Posto')}`, `Hoje, ${todayPt()}`, '<button class="primary" data-page="closing">⊕ &nbsp;Novo Fechamento</button>');
  return `${heading}
    ${network ? `${networkSection()}<h2 class="section-title">Posto atual: ${esc(post?.nome_posto || '')}</h2>` : infoNotice('Menu padrão — posto único (sem módulo Multi-unidade)')}
    <section class="metric-grid">
      <article class="metric-card ${Number(totals.posto) < 0 ? 'negative' : 'positive'}"><div class="metric-label">Saldo do Posto neste mês${differencePill(totals.posto)}</div><strong>${signedMoney(totals.posto)}</strong><small>Soma das diferenças da empresa de combustível</small></article>
      <article class="metric-card ${Number(totals.loja) < 0 ? 'negative' : 'positive'}"><div class="metric-label">Saldo da Loja neste mês${differencePill(totals.loja)}</div><strong>${signedMoney(totals.loja)}</strong><small>Soma das diferenças da conveniência</small></article>
      <article class="metric-card"><div class="metric-label">Fechamentos no mês<span class="pill gray">PROGRESSO</span></div><strong class="dark-value">${Number(totals.quantidade || 0)}</strong><small>Fechamentos registrados no mês atual</small></article>
    </section>
    <section class="dashboard-grid"><article class="surface chart-card"><h2>Evolução diária</h2>${dataTable(['Data', 'Diferença total'], dailyRows, 'Nenhum fechamento neste mês.')}</article>
      <article class="surface recent-card"><div class="surface-heading"><h2>Últimos fechamentos</h2><button class="text-button" data-page="history">Ver histórico</button></div>${(data.recent || []).map(historyRow).join('') || '<p class="helper">Ainda não há fechamentos.</p>'}</article></section>
    ${network ? '' : '<section class="surface module-off">O módulo comparativo entre múltiplos postos está inativo para este posto, ocultando automaticamente a opção do menu lateral.</section>'}`;
}

export default {
  pages: {
    dashboard: {
      render: renderDashboard,
      load: async () => {
        if (!state.postId) return;
        const [dashboard, network] = await Promise.all([
          api(endpoints.closingDashboard(state.postId)),
          hasNetwork() ? loadNetworkSummary().catch(() => null) : null,
        ]);
        state.dashboardData = dashboard;
        state.networkSummary = network;
      },
    },
  },
};
