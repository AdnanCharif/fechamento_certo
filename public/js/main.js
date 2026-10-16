// Ponto de entrada do front: registra as telas e liga login, menu e seletor de posto.
import { $ } from './utils.js';
import { api, endpoints, json, setToken } from './api.js';
import { state, emptyClosing } from './state.js';
import { toast } from './components.js';
import { registerScreens, bindPageEvents, enterPage, go, getPage } from './router.js';
import { loadContext, refreshContext, updateAccount } from './context.js';
import { homePage, isAdmin, renderMenu } from './menu.js';

import dashboard from './telas/dashboard.js';
import fechamentoNovo from './telas/fechamento-novo.js';
import fechamentos from './telas/fechamentos.js';
import divergencias from './telas/divergencias.js';
import observacoes from './telas/observacoes.js';
import rede from './telas/rede.js';
import maquinas from './telas/maquinas.js';
import operadores from './telas/operadores.js';
import empresas from './telas/empresas.js';
import perfil from './telas/perfil.js';
import adminDashboard from './telas/admin-dashboard.js';
import estabelecimentos from './telas/estabelecimentos.js';
import gerentes from './telas/gerentes.js';
import modulos from './telas/modulos.js';

registerScreens(
  dashboard, fechamentoNovo, fechamentos, divergencias, observacoes, rede, maquinas, operadores, empresas, perfil,
  adminDashboard, estabelecimentos, gerentes, modulos,
);
bindPageEvents($('#page-root'));

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  $('#login-error').textContent = '';
  try {
    const result = await api(endpoints.login, json('POST', { email: $('#login-email').value, senha: $('#login-senha').value }));
    setToken(result.token);
    state.user = result.usuario;
    $('#login-screen').hidden = true;
    $('#application').hidden = false;
    // O administrador não opera postos: vai direto para a área administrativa.
    if (isAdmin()) { updateAccount(); renderMenu(); } else await loadContext();
    go(homePage());
  } catch (error) { $('#login-error').textContent = error.message; }
});

$('#post-select').addEventListener('change', async (event) => {
  state.postId = Number(event.target.value);
  state.closing = emptyClosing();
  state.machineEditId = state.operatorEditId = state.companyEditId = state.detailId = null;
  try { await refreshContext(); } catch (error) { toast(error.message, true); }
  go(getPage(state.page)?.fallback || state.page);
});

$('#main-nav').addEventListener('click', (event) => {
  const button = event.target.closest('[data-page]');
  if (button) enterPage(button.dataset.page);
});
$('.brand').addEventListener('click', (event) => { event.preventDefault(); go(homePage()); });
$('.account-card').addEventListener('click', () => go('profile'));

$('#logout-button').addEventListener('click', async () => {
  try { await api(endpoints.logout, { method: 'POST' }); } catch { /* A sessão local também precisa ser encerrada. */ }
  setToken(null);
  Object.assign(state, {
    user: null, posts: [], postId: null, companies: [], machines: [], operators: [], modules: [], detailData: null, closing: emptyClosing(),
    adminSummary: null, establishments: [], managers: [], managerDetail: null, moduleData: null, network: null, networkAlerts: [], networkPost: null, networkSummary: null,
  });
  $('#application').hidden = true;
  $('#login-screen').hidden = false;
  $('#login-form').reset();
});
