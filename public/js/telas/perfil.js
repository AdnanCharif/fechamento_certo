// Tela: Informações Pessoais do usuário logado.
import { esc } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, field, toast } from '../components.js';
import { go, render } from '../router.js';
import { homePage } from '../menu.js';
import { updateAccount } from '../context.js';

function renderProfile() {
  return `${shell('Informações Pessoais', 'Edite suas informações pessoais e credenciais de acesso.')}
    <form id="profile-form"><section class="surface"><h2>Dados Pessoais</h2><div class="profile-grid">${field('Nome Completo', `<input name="nome" required value="${esc(state.user?.nome)}">`)}${field('E-mail', `<input name="email" type="email" required value="${esc(state.user?.email)}">`)}</div></section><section class="surface"><h2>Segurança</h2><div class="profile-grid">${field('Nova Senha', '<input name="senha" type="password" minlength="8" placeholder="Deixe em branco para manter" autocomplete="new-password">')}${field('Confirmar Nova Senha', '<input name="confirmar" type="password" placeholder="Confirme a nova senha" autocomplete="new-password">')}</div></section><div class="form-actions end"><button class="secondary" type="button" data-action="profile-cancel">Cancelar</button><button class="success">Salvar Alterações</button></div></form>`;
}

export default {
  pages: {
    profile: { render: renderProfile, standalone: true, perfil: 'todos' },
  },
  actions: {
    'profile-cancel': () => go(homePage()),
  },
  forms: {
    'profile-form': async (data) => {
      if (data.get('senha') && data.get('senha') !== data.get('confirmar')) { toast('As senhas não conferem.', true); return; }
      await api(endpoints.user(state.user.usuario_id), json('PUT', { nome: data.get('nome'), email: data.get('email'), senha: data.get('senha') }));
      Object.assign(state.user, { nome: data.get('nome'), email: data.get('email') });
      updateAccount();
      toast('Perfil atualizado.');
      render();
    },
  },
};
