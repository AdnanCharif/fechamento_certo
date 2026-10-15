// Dados de contexto do usuário logado: postos, empresas, máquinas, operadores e gerentes.
import { $, esc, sameId } from './utils.js';
import { api, endpoints } from './api.js';
import { state } from './state.js';
import { toast } from './components.js';

export async function loadContext() {
  const variation = await api(endpoints.variability);
  state.operatorsEnabled = Boolean(variation?.pontosDeVariacao?.gestaoDeOperadores?.habilitado);
  $('#operators-nav').hidden = !state.operatorsEnabled;
  const [posts, user] = await Promise.all([api(endpoints.userPosts(state.user.usuario_id)), api(endpoints.user(state.user.usuario_id))]);
  state.posts = posts;
  state.user = { ...state.user, ...user };
  updateAccount();
  if (!state.posts.some((post) => sameId(post.posto_id, state.postId))) state.postId = state.posts[0]?.posto_id || null;
  renderPostSwitcher();
  if (!state.postId) { toast('Este usuário ainda não está vinculado a um posto.', true); return; }
  await refreshContext();
}

export async function refreshContext() {
  if (!state.postId) return;
  const [companies, machines, operators] = await Promise.all([
    api(endpoints.companies(state.postId)), api(endpoints.machines(state.postId)),
    state.operatorsEnabled ? api(endpoints.operators(state.postId)) : Promise.resolve([]),
  ]);
  state.companies = companies; state.machines = machines; state.operators = operators;
}

export function updateAccount() {
  $('#account-name').textContent = state.user.nome;
  $('#account-avatar').textContent = state.user.nome?.trim()?.[0]?.toUpperCase() || 'G';
}

export function renderPostSwitcher() {
  $('#post-select').innerHTML = state.posts.map((post) => `<option value="${post.posto_id}" ${sameId(post.posto_id, state.postId) ? 'selected' : ''}>${esc(post.nome_posto)}</option>`).join('');
  $('.post-switcher').hidden = state.posts.length < 2;
}

// Junta os gerentes de todos os postos do usuário, com a lista de postos de cada um.
export async function loadManagers() {
  const byUser = new Map();
  const lists = await Promise.all(state.posts.map(async (post) => ({ post, users: await api(endpoints.postUsers(post.posto_id)) })));
  for (const { post, users } of lists) {
    for (const user of users) {
      const manager = byUser.get(user.usuario_id) || { ...user, postos: [] };
      manager.postos.push({ posto_id: post.posto_id, nome: post.nome_posto });
      byUser.set(user.usuario_id, manager);
    }
  }
  state.managers = [...byUser.values()].sort((a, b) => a.nome.localeCompare(b.nome));
}
