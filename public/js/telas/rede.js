// Telas do módulo Multi-unidade: comparativo entre postos, alertas da rede e detalhamento de um posto.
// Só existem no menu quando o administrador liga o módulo para o posto (ver menu.js e modulos.js).
import { esc, money, signedMoney, longDate, sameId, timeAgo } from '../utils.js';
import { api, endpoints } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, metricCard, balancePill, columnChart, differenceClass, closingPill } from '../components.js';
import { render } from '../router.js';

const hasNetwork = () => state.modules.includes('multi_unidade');
const sum = (list, read) => list.reduce((total, item) => total + Number(read(item)), 0);

// Totais da rede a partir do comparativo; usado aqui e no dashboard consolidado.
export function summarizeNetwork(network, alerts) {
  const posts = network?.postos ?? [];
  const total = sum(posts, (post) => post.total);
  const divergence = sum(posts, (post) => Number(post.sobra) - Number(post.falta)); // soma das diferenças em módulo
  const best = posts.reduce((top, post) => (Number(post.sobra) > Number(top?.sobra ?? 0) ? post : top), null);
  const worst = posts.reduce((low, post) => (Number(post.falta) < Number(low?.falta ?? 0) ? post : low), null);
  return { units: posts.length, total, cohesion: total ? 1 - divergence / total : 1, alerts: alerts.length, critical: alerts.filter((alert) => alert.gravidade === 'critico').length, best, worst };
}

export async function loadNetworkSummary(days = 30) {
  const [network, alerts] = await Promise.all([api(endpoints.network(days)), api(endpoints.networkAlerts)]);
  return { network, alerts, ...summarizeNetwork(network, alerts) };
}

async function loadNetwork() {
  [state.network, state.networkAlerts] = await Promise.all([api(endpoints.network(state.networkDays)), api(endpoints.networkAlerts)]);
}

function renderNetwork() {
  const data = state.network;
  if (!data) return `${shell('Comparativo entre Postos')}<section class="surface empty-state">Não foi possível carregar a rede.</section>`;
  const summary = summarizeNetwork(data, state.networkAlerts);
  const days = [7, 30, 90].map((value) => `<option value="${value}" ${value === data.dias ? 'selected' : ''}>Últimos ${value} dias</option>`).join('');
  const actions = `<select id="network-days" aria-label="Período">${days}</select><button class="${summary.critical ? 'danger-outline' : 'secondary'}" data-page="network-alerts">⚠ Alertas da Rede (${summary.alerts})</button>`;
  const rows = data.postos.map((post, index) => `<tr><td><strong>#${index + 1}</strong></td><td><button class="text-button strong" data-page="network-detail" data-id="${post.posto_id}">${esc(post.nome)}</button></td><td>${esc([post.cidade, post.uf].filter(Boolean).join('/') || '—')}</td>
    <td>${post.fechamentos} / ${data.dias}</td><td class="${differenceClass(post.sobra)}">${signedMoney(post.sobra)}</td><td class="${differenceClass(post.falta)}">${signedMoney(post.falta)}</td><td class="${differenceClass(post.saldo)}"><strong>${signedMoney(post.saldo)}</strong></td><td>${balancePill(post.status)}</td></tr>`);
  return `${shell('Comparativo entre Postos', 'Visão consolidada da rede', actions)}
    <section class="metric-grid">
      ${metricCard({ label: 'Total Rede (Cartões + Dinheiro)', badge: 'SOMA', value: money(summary.total), tone: 'blue', hint: 'Consolidado das unidades com o módulo ativo' })}
      ${metricCard({ label: 'Maior Sobra Acumulada', badge: summary.best?.nome || '—', badgeColor: 'green', value: signedMoney(summary.best?.sobra ?? 0), tone: 'green', hint: 'Melhor resultado de fechamento físico', border: 'positive' })}
      ${metricCard({ label: 'Maior Falta Acumulada', badge: summary.worst?.nome || '—', badgeColor: 'red', value: signedMoney(summary.worst?.falta ?? 0), tone: summary.worst ? 'red' : 'dark', hint: summary.worst ? 'Requer auditoria manual' : 'Nenhuma falta no período', border: summary.worst ? 'negative' : '' })}
    </section>
    <section class="surface">${dataTable(['Posição', 'Unidade', 'Cidade/UF', 'Fechamentos', 'Total Sobra', 'Total Falta', 'Saldo Líquido', 'Status'], rows, 'Nenhum posto na rede.')}
      <p class="helper">Status pelo limite de alerta configurado (${money(data.limite)}): saldo abaixo de ${signedMoney(-data.limite)} pede atenção; abaixo de ${signedMoney(-data.limite * 10)} é crítico.</p></section>`;
}

const severity = { critico: ['Crítico', 'red', '⊗'], atencao: ['Atenção', 'yellow', '!'] };

function renderAlerts() {
  const units = [...new Map(state.networkAlerts.map((alert) => [alert.posto_id, alert.posto_nome])).entries()];
  const list = state.networkAlerts.filter((alert) => (!state.networkUnit || sameId(alert.posto_id, state.networkUnit)) && (!state.networkSeverity || alert.gravidade === state.networkSeverity));
  const filters = `<select id="network-unit" aria-label="Unidade"><option value="">Todas as Unidades</option>${units.map(([id, name]) => `<option value="${id}" ${sameId(id, state.networkUnit) ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>
    <select id="network-severity" aria-label="Gravidade"><option value="">Gravidade: Todos</option>${Object.entries(severity).map(([key, [label]]) => `<option value="${key}" ${state.networkSeverity === key ? 'selected' : ''}>Gravidade: ${label}</option>`).join('')}</select>`;
  const cards = list.map((alert) => {
    const [label, color, icon] = severity[alert.gravidade];
    return `<article class="alert-card ${alert.gravidade}"><span class="alert-icon" aria-hidden="true">${icon}</span><div><strong>${esc(alert.posto_nome)}: ${esc(alert.titulo)}</strong><p>${esc(alert.descricao)}</p></div>
      <small>${timeAgo(alert.desde)}</small><span class="pill ${color}">${label}</span><button class="text-button" data-page="network-detail" data-id="${alert.posto_id}">Ver Detalhes</button></article>`;
  }).join('');
  return `${shell('Alertas da Rede', 'Divergências críticas e notificações de auditoria', filters, '<button class="text-button crumb" data-page="network">Comparativo entre Postos</button> › Alertas')}
    ${cards || '<section class="surface empty-state">Nenhum alerta para os filtros escolhidos.</section>'}`;
}

function renderNetworkPost() {
  const data = state.networkPost;
  if (!data) return `${shell('Detalhamento')}<section class="surface empty-state">Posto não encontrado na rede. <button class="text-button" data-page="network">Voltar ao comparativo</button></section>`;
  const chart = columnChart({
    caption: 'Sobra ou falta de cada fechamento nos últimos 30 dias',
    items: data.diario.map((day) => ({ label: longDate(day.data), shortLabel: day.data.slice(8, 10), value: day.diferenca })),
    format: signedMoney,
    height: 170,
  });
  const latest = data.ultimos.map((item) => `<tr><td><strong>${longDate(item.data)}</strong></td><td>${money(item.total)}</td><td class="${differenceClass(item.diferenca)}"><strong>${signedMoney(item.diferenca)}</strong></td><td>${closingPill(Number(item.diferenca) === 0 ? 'ok' : 'com_divergencia')}</td></tr>`);
  return `${shell(`Detalhamento: ${esc(data.posto.nome)}`, 'Métricas de auditoria interna', '', `<button class="text-button crumb" data-page="network">Comparativo entre Postos</button> › ${esc(data.posto.nome)}`)}
    <section class="surface post-header"><div><h2>${esc(data.posto.nome)}</h2><p>${esc(data.posto.endereco || 'Endereço não informado')}</p></div>
      <div class="post-header-meta"><span><small>GERENTE RESPONSÁVEL</small><strong>${esc(data.posto.gerente || '—')}</strong></span>${balancePill(data.status, 'Status: ')}</div></section>
    <div class="detail-columns">
      <section class="surface"><div class="surface-heading"><h2>Histórico Sobra/Falta (30 dias)</h2><span class="legend"><i class="dot sobra-dot"></i>Sobra<i class="dot falta-dot"></i>Falta</span></div>
        <p class="chart-caption">Oscilação acumulada: <strong class="${differenceClass(data.saldo)}">${signedMoney(data.saldo)}</strong> em ${data.fechamentos} fechamento${data.fechamentos === 1 ? '' : 's'}</p>${chart}</section>
      <section class="surface"><h2>Últimos ${data.ultimos.length} Fechamentos</h2>${dataTable(['Data', 'Total', 'Diferença', 'Status'], latest, 'Sem fechamentos no período.')}</section>
    </div>
    <div class="form-actions"><button class="success" data-page="network">Voltar ao Comparativo</button></div>`;
}

export default {
  pages: {
    network: { render: renderNetwork, load: loadNetwork, guard: hasNetwork },
    'network-alerts': { render: renderAlerts, load: async () => { state.networkAlerts = await api(endpoints.networkAlerts); }, guard: hasNetwork, nav: 'network', fallback: 'network' },
    'network-detail': {
      render: renderNetworkPost, guard: hasNetwork, nav: 'network', fallback: 'network',
      load: async () => { state.networkPost = await api(endpoints.networkPost(state.networkPostId)); },
      enter: (id) => { if (id) state.networkPostId = Number(id); state.networkPost = null; },
    },
  },
  inputs: {
    'network-days': async (target) => { state.networkDays = Number(target.value); await loadNetwork(); render(); },
    'network-unit': (target) => { state.networkUnit = target.value; render(); },
    'network-severity': (target) => { state.networkSeverity = target.value; render(); },
  },
};
