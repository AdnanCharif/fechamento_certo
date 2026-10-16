// Dados de contexto do usuário logado: postos, empresas, máquinas, operadores e módulos do posto.
import { $, esc, sameId } from './utils.js';
import { api, endpoints } from './api.js';
import { state } from './state.js';
import { toast } from './components.js';
import { isAdmin, renderMenu } from './menu.js';

export async function loadContext() {
  const variation = await api(endpoints.variability);
  state.operatorsEnabled = Boolean(variation?.pontosDeVariacao?.gestaoDeOperadores?.habilitado);
  const [posts, user] = await Promise.all([api(endpoints.userPosts(state.user.usuario_id)), api(endpoints.user(state.user.usuario_id))]);
  state.posts = posts;
  state.user = { ...state.user, ...user };
  updateAccount();
  if (!state.posts.some((post) => sameId(post.posto_id, state.postId))) state.postId = state.posts[0]?.posto_id || null;
  renderPostSwitcher();
  if (!state.postId) toast('Este usuário ainda não está vinculado a um posto.', true);
  await refreshContext();
}

// Recarrega o que depende do posto atual; os módulos dele decidem os itens do menu.
export async function refreshContext() {
  if (!state.postId) { state.modules = []; renderMenu(); return; }
  const [companies, machines, operators, modules] = await Promise.all([
    api(endpoints.companies(state.postId)), api(endpoints.machines(state.postId)),
    state.operatorsEnabled ? api(endpoints.operators(state.postId)) : Promise.resolve([]),
    api(endpoints.postModules(state.postId)),
  ]);
  state.companies = companies; state.machines = machines; state.operators = operators; state.modules = modules;
  renderMenu();
}

export function updateAccount() {
  $('#account-name').textContent = state.user.nome;
  $('#account-role').textContent = isAdmin() ? 'Administrador do sistema' : 'Gerente Geral';
  $('#account-avatar').textContent = state.user.nome?.trim()?.[0]?.toUpperCase() || 'G';
}

export function renderPostSwitcher() {
  $('#post-select').innerHTML = state.posts.map((post) => `<option value="${post.posto_id}" ${sameId(post.posto_id, state.postId) ? 'selected' : ''}>${esc(post.nome_posto)}</option>`).join('');
}
