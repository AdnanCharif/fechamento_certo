// Menu lateral montado por perfil. Um item pode depender de uma variação do produto:
// o comparativo só aparece com o módulo Multi-unidade ativo no posto, e operadores
// só com a gestão de operadores ligada (FEATURE_OPERATOR_MANAGEMENT).
import { $, esc } from './utils.js';
import { state } from './state.js';

const menus = {
  gerente: [
    { page: 'dashboard', icon: '▦', label: 'Dashboard' },
    { page: 'closing', icon: '⊕', label: 'Novo Fechamento' },
    { page: 'history', icon: '◴', label: 'Histórico' },
    { page: 'network', icon: '⇅', label: 'Comparativo de Postos', badge: 'NOVO', visible: () => state.modules.includes('multi_unidade') },
    { page: 'machines', icon: '▤', label: 'Máquinas' },
    { page: 'operators', icon: '☺', label: 'Operadores', visible: () => state.operatorsEnabled },
    { page: 'settings', icon: '⚙', label: 'Configurações' },
  ],
  admin: [
    { page: 'admin-dashboard', icon: '▦', label: 'Dashboard' },
    { page: 'establishments', icon: '⌂', label: 'Estabelecimentos' },
    { page: 'managers', icon: '♟', label: 'Gerentes' },
    { page: 'modules', icon: '✣', label: 'Módulos & Planos' },
  ],
};

export const isAdmin = () => state.user?.perfil === 'admin';
export const homePage = () => (isAdmin() ? 'admin-dashboard' : 'dashboard');

export function renderMenu() {
  const items = menus[isAdmin() ? 'admin' : 'gerente'].filter((item) => !item.visible || item.visible());
  $('#main-nav').innerHTML = items.map((item) => `<button data-page="${item.page}" class="nav-link"><span>${item.icon}</span><em>${esc(item.label)}</em>${item.badge ? `<b class="nav-badge">${item.badge}</b>` : ''}</button>`).join('');
  $('#application').dataset.perfil = isAdmin() ? 'admin' : 'gerente';
  $('#brand-subtitle').textContent = isAdmin() ? 'INTERNAL ADMIN' : state.modules.includes('multi_unidade') ? 'REDE MULTI-UNIDADE' : 'POSTO ÚNICO';
  $('.post-switcher').hidden = isAdmin() || state.posts.length < 2;
}
