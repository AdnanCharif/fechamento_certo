// Tela (Admin): Overview de Administração — indicadores de todos os clientes, atividades e novos cadastros.
import { esc, money, monthShort, shortDateTime } from '../utils.js';
import { api, endpoints } from '../api.js';
import { state } from '../state.js';
import { shell, metricCard, columnChart } from '../components.js';

// Média do crescimento mês a mês, só entre meses com base para comparar.
function averageGrowth(months) {
  const rates = months.slice(1).map((month, i) => (months[i].total ? (month.total - months[i].total) / months[i].total : null)).filter((rate) => rate !== null);
  if (!rates.length) return null;
  return rates.reduce((sum, rate) => sum + rate, 0) / rates.length;
}

function activityRow(item) {
  const who = `${item.usuario_nome} (${item.perfil === 'admin' ? 'Suporte' : 'Gerente'})`;
  return `<tr><td><strong>${shortDateTime(item.created_at)}</strong><small class="block">${esc(who)}</small></td><td>${esc(item.posto_nome || '—')}</td><td class="wrap">${esc(item.descricao)}</td></tr>`;
}

function renderAdminDashboard() {
  const data = state.adminSummary || { estabelecimentos_ativos: 0, total_gerentes: 0, ativacoes_pendentes: 0, mrr: 0, atividades: [], cadastros_por_mes: [] };
  const growth = averageGrowth(data.cadastros_por_mes);
  const chart = columnChart({
    caption: 'Novos estabelecimentos cadastrados por mês',
    items: data.cadastros_por_mes.map((month) => ({ label: `${monthShort(month.mes)}/${month.mes.slice(0, 4)}`, shortLabel: monthShort(month.mes), value: month.total })),
    format: (value) => `${value} cadastro${value === 1 ? '' : 's'}`,
    showValues: true,
  });
  return `${shell('Overview de Administração', 'Métricas consolidadas de todos os estabelecimentos integrados', '', 'Painel de Controle')}
    <section class="metric-grid four">
      ${metricCard({ label: 'Estabelecimentos Ativos', badge: 'ATIVOS', badgeColor: 'green', value: data.estabelecimentos_ativos, tone: 'green', hint: 'Postos e lojas homologados na plataforma', border: 'positive' })}
      ${metricCard({ label: 'Total de Gerentes', badge: 'USUÁRIOS', value: data.total_gerentes, tone: 'dark', hint: 'Gerentes com acesso ativo' })}
      ${metricCard({ label: 'Ativações Pendentes', badge: 'ATENÇÃO', badgeColor: 'yellow', value: data.ativacoes_pendentes, tone: 'amber', hint: 'Sem empresa ou sem gerente vinculado', border: 'warning' })}
      ${metricCard({ label: 'MRR Estimado', badge: 'SAÚDE FINANCEIRA', badgeColor: 'green', value: money(data.mrr).replace(',00', ''), tone: 'green', hint: 'Soma mensal dos planos dos ativos', border: 'positive' })}
    </section>
    <section class="dashboard-grid admin-grid">
      <article class="surface"><h2>Log de Atividades Recentes</h2>
        <div class="table-wrap activity-table"><table><tbody>${data.atividades.map(activityRow).join('') || '<tr><td class="empty-cell">Nenhuma atividade registrada.</td></tr>'}</tbody></table></div></article>
      <article class="surface"><h2>Novos Cadastros (Últimos 6 meses)</h2>${chart}
        <div class="chart-footer"><span>Crescimento médio</span><strong class="${growth > 0 ? 'positive-text' : growth < 0 ? 'negative-text' : ''}">${growth === null ? '—' : `${growth > 0 ? '+' : ''}${Math.round(growth * 100)}% / mês`}</strong></div></article>
    </section>`;
}

export default {
  pages: {
    'admin-dashboard': { render: renderAdminDashboard, load: async () => { state.adminSummary = await api(endpoints.adminSummary); }, standalone: true, perfil: 'admin' },
  },
};
