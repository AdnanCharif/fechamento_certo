// Navegação entre telas. Cada tela (js/telas/*.js) exporta um objeto com:
//   pages:   { nome: { render, load?, enter?(id), afterRender?, nav?, guard?, standalone?, fallback?, perfil? } }
//   actions: { 'data-action': (id, botao) => ... }   cliques em [data-action]
//   forms:   { 'id-do-form': (formData, form) => ... } envio de formulários
//   inputs:  { 'id-do-campo' ou data-input: (campo) => ... } digitação e mudança em campos
// perfil: 'admin' (área administrativa), 'todos' ou, se omitido, gerente.
import { $, $$, masks } from './utils.js';
import { state } from './state.js';
import { shell, toast } from './components.js';
import { homePage, isAdmin } from './menu.js';

const pages = {};
const actions = {};
const forms = {};
const inputs = {};

export function registerScreens(...screens) {
  for (const screen of screens) {
    Object.assign(pages, screen.pages);
    Object.assign(actions, screen.actions);
    Object.assign(forms, screen.forms);
    Object.assign(inputs, screen.inputs);
  }
}

export const getPage = (name) => pages[name];

const allowed = (page) => page && (page.perfil === 'todos' || (page.perfil || 'gerente') === (isAdmin() ? 'admin' : 'gerente'));

export async function go(name) {
  if (!allowed(pages[name])) name = homePage();
  const page = pages[name];
  if (page.guard && !page.guard()) return go(homePage());
  state.page = name;
  $$('.nav-link').forEach((item) => item.classList.toggle('active', item.dataset.page === (page.nav || state.page)));
  try { await page.load?.(); } catch (error) { toast(error.message, true); }
  render();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Navega passando o id do botão (ex.: data-id do registro a editar).
export function enterPage(name, id) {
  pages[name]?.enter?.(id);
  return go(name);
}

export function render() {
  const page = pages[state.page] || pages[homePage()];
  $('#page-root').innerHTML = state.postId || page.standalone
    ? page.render()
    : `${shell('Nenhum posto vinculado')}<section class="surface empty-state">Peça ao suporte para vincular seu usuário a um posto.</section>`;
  page.afterRender?.();
}

// Re-renderiza a tela sem perder o foco do campo de busca.
export function rerenderKeepingFocus(target) {
  const position = target.selectionStart;
  render();
  const input = $(`#${target.id}`);
  input.focus();
  input.setSelectionRange(position, position);
}

export function bindPageEvents(root) {
  root.addEventListener('click', async (event) => {
    const pageButton = event.target.closest('[data-page]');
    if (pageButton) { enterPage(pageButton.dataset.page, pageButton.dataset.id); return; }
    const button = event.target.closest('[data-action]');
    if (!button || !actions[button.dataset.action]) return;
    try { await actions[button.dataset.action](button.dataset.id, button); } catch (error) { toast(error.message, true); }
  });
  root.addEventListener('submit', async (event) => {
    event.preventDefault();
    const handler = forms[event.target.id];
    if (!handler) return;
    try { await handler(new FormData(event.target), event.target); } catch (error) { toast(error.message, true); }
  });
  root.addEventListener('input', async (event) => {
    const mask = masks[event.target.dataset.mask];
    if (mask) event.target.value = mask(event.target.value);
    try { await (inputs[event.target.id] || inputs[event.target.dataset.input])?.(event.target); } catch (error) { toast(error.message, true); }
  });
}
