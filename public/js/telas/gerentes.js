// Tela (Administração): Gerentes — CRUD de usuários gerentes e seus vínculos com postos.
import { esc, formatDate, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, field, searchBox, toast, confirmAction } from '../components.js';
import { go, rerenderKeepingFocus } from '../router.js';
import { loadManagers, updateAccount } from '../context.js';

function renderManagers() {
  const term = state.managerSearch.trim().toLowerCase();
  const list = state.managers.filter((manager) => !term || `${manager.nome} ${manager.email}`.toLowerCase().includes(term));
  const rows = list.map((manager) => {
    const isSelf = sameId(manager.usuario_id, state.user.usuario_id);
    return `<tr><td><strong>${esc(manager.nome)}</strong>${isSelf ? ' <span class="pill blue">Você</span>' : ''}</td><td>${esc(manager.email)}</td><td><div class="tag-list">${manager.postos.map((post) => `<span class="pill green">${esc(post.nome)}</span>`).join('')}</div></td><td>${formatDate(manager.created_at)}</td><td class="row-actions"><button class="text-button" data-page="manager-detail" data-id="${manager.usuario_id}">Ver</button><button class="text-button" data-page="manager-form" data-id="${manager.usuario_id}">Editar</button>${isSelf ? '' : `<button class="text-button danger-text" data-action="delete-manager" data-id="${manager.usuario_id}">Excluir</button>`}</td></tr>`;
  });
  return `${shell('Gerenciamento de Clientes (Gerentes)', 'Controle de acessos e proprietários vinculados aos estabelecimentos.', '<button class="success" data-page="manager-form">⊕ &nbsp;Novo Gerente</button>', 'Administração › Gerentes')}
    ${searchBox('manager-search', state.managerSearch, 'Filtrar gerentes por nome ou email...')}
    <section class="surface">${dataTable(['Nome', 'Email', 'Estabelecimentos Vinculados', 'Cadastrado em', 'Ações'], rows, 'Nenhum gerente encontrado.')}<div class="table-footer">Mostrando ${list.length} de ${state.managers.length} gerentes</div></section>`;
}

function renderManagerForm() {
  const editing = state.managers.find((manager) => sameId(manager.usuario_id, state.managerEditId));
  const postOptions = state.posts.map((post) => `<option value="${post.posto_id}" ${sameId(post.posto_id, state.postId) ? 'selected' : ''}>${esc(post.nome_posto)}</option>`).join('');
  return `${shell(editing ? 'Editar Gerente' : 'Cadastrar Gerente', editing ? 'Atualize os dados de acesso do gerente.' : 'Adicione um novo gerente e vincule ao estabelecimento.', '', `Administração › Gerentes › ${editing ? 'Editar' : 'Novo'}`)}
    <form id="manager-form" class="surface wide-form"><h2>Dados do Gerente</h2><div class="profile-grid">
      ${field('Nome Completo *', `<input name="nome" required value="${esc(editing?.nome || '')}" placeholder="Nome completo">`)}
      ${field('E-mail *', `<input name="email" type="email" required value="${esc(editing?.email || '')}" placeholder="gerente@posto.com">`)}
      ${editing ? '' : field('Estabelecimento vinculado *', `<select name="posto_id" required>${postOptions}</select>`)}
      ${field(editing ? 'Nova senha' : 'Senha temporária *', `<input name="senha" type="password" minlength="8" ${editing ? 'placeholder="Deixe em branco para manter"' : 'required placeholder="Mínimo de 8 caracteres"'} autocomplete="new-password">`, editing ? '' : 'Informe a senha ao gerente; ele pode trocá-la depois em Informações Pessoais.')}
    </div><div class="form-actions end"><button type="button" class="secondary" data-page="managers">Cancelar</button><button class="success">${editing ? 'Salvar Alterações' : 'Salvar Gerente'}</button></div></form>`;
}

function renderManagerDetail() {
  const manager = state.managers.find((item) => sameId(item.usuario_id, state.managerDetailId));
  if (!manager) return `${shell('Gerente')}<section class="surface empty-state">Gerente não encontrado. <button class="text-button" data-page="managers">Voltar</button></section>`;
  const isSelf = sameId(manager.usuario_id, state.user.usuario_id);
  const linkable = state.posts.filter((post) => !manager.postos.some((linked) => sameId(linked.posto_id, post.posto_id)));
  const links = manager.postos.map((post) => `<div class="history-item"><div><strong>${esc(post.nome)}</strong></div>${isSelf ? '' : `<button class="danger-soft" data-action="unlink-manager" data-id="${post.posto_id}">Remover</button>`}</div>`).join('');
  return `${shell(`Perfil do Gerente: ${esc(manager.nome)}`, 'Consulte dados cadastrais e estabelecimentos associados.', `<button class="secondary" data-page="manager-form" data-id="${manager.usuario_id}">Editar Perfil</button>`, 'Administração › Gerentes › Detalhe')}
    <section class="surface profile-header"><span class="avatar large">${esc(manager.nome.trim()[0]?.toUpperCase() || 'G')}</span><div><h2>${esc(manager.nome)} <span class="pill green">Ativo</span></h2><p>Email: <b>${esc(manager.email)}</b> · Cadastrado em: <b>${formatDate(manager.created_at)}</b></p></div></section>
    <section class="surface"><div class="surface-heading"><h2>Estabelecimentos Vinculados</h2></div>${links || '<p class="helper">Nenhum vínculo.</p>'}
      ${!isSelf && linkable.length ? `<form id="link-manager-form" class="inline-form">${field('Vincular novo posto', `<select name="posto_id">${linkable.map((post) => `<option value="${post.posto_id}">${esc(post.nome_posto)}</option>`).join('')}</select>`)}<button class="success">+ Vincular</button></form><p class="helper">Vincular gerente já cadastrado depende da rota <code>POST /postos/:id/usuarios/:usuarioId</code>, ainda pendente no backend.</p>` : ''}
      ${isSelf ? '<p class="helper">Você não pode remover os próprios vínculos.</p>' : ''}</section>
    <div class="form-actions"><button class="secondary" data-page="managers">← Voltar</button></div>`;
}

export default {
  pages: {
    managers: { render: renderManagers, load: loadManagers, standalone: true },
    'manager-form': { render: renderManagerForm, load: loadManagers, nav: 'managers', standalone: true, enter: (id) => { state.managerEditId = id ? Number(id) : null; } },
    'manager-detail': { render: renderManagerDetail, load: loadManagers, nav: 'managers', standalone: true, enter: (id) => { if (id) state.managerDetailId = Number(id); } },
  },
  actions: {
    // "Excluir" remove todos os vínculos; o backend inativa o usuário quando não sobra nenhum.
    'delete-manager': async (id) => {
      const manager = state.managers.find((item) => sameId(item.usuario_id, id));
      if (!await confirmAction({ title: `Excluir ${manager?.nome}?`, message: 'O gerente será removido de todos os estabelecimentos e perderá o acesso ao sistema. O histórico de fechamentos feitos por ele é mantido.', confirmLabel: 'Excluir' })) return;
      for (const post of manager.postos) await api(endpoints.postUser(post.posto_id, id), { method: 'DELETE' });
      toast('Gerente excluído e acesso inativado.');
      await go('managers');
    },
    'unlink-manager': async (id) => {
      const manager = state.managers.find((item) => sameId(item.usuario_id, state.managerDetailId));
      const post = manager.postos.find((item) => sameId(item.posto_id, id));
      const last = manager.postos.length === 1;
      if (!await confirmAction({ title: `Remover vínculo com ${post.nome}?`, message: last ? 'Este é o último estabelecimento do gerente: ao remover, o acesso dele será inativado.' : 'O gerente deixa de acessar este estabelecimento.', confirmLabel: 'Remover' })) return;
      await api(endpoints.postUser(id, manager.usuario_id), { method: 'DELETE' });
      toast('Vínculo removido.');
      await go(last ? 'managers' : 'manager-detail');
    },
  },
  forms: {
    'manager-form': async (data) => {
      const payload = { nome: data.get('nome').trim(), email: data.get('email').trim(), senha: data.get('senha') };
      if (state.managerEditId) {
        await api(endpoints.user(state.managerEditId), json('PUT', payload));
        if (sameId(state.managerEditId, state.user.usuario_id)) { Object.assign(state.user, { nome: payload.nome, email: payload.email }); updateAccount(); }
        toast('Gerente atualizado.');
      } else {
        await api(endpoints.postUsers(data.get('posto_id')), json('POST', payload));
        toast('Gerente cadastrado.');
      }
      state.managerEditId = null;
      await go('managers');
    },
    'link-manager-form': async (data) => {
      await api(endpoints.postUser(data.get('posto_id'), state.managerDetailId), { method: 'POST' });
      toast('Gerente vinculado ao estabelecimento.');
      await go('manager-detail');
    },
  },
  inputs: {
    'manager-search': (target) => { state.managerSearch = target.value; rerenderKeepingFocus(target); },
  },
};
