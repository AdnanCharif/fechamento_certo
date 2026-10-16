// Tela (Admin): Gerentes — CRUD dos gerentes, vínculos com estabelecimentos e histórico de ações.
import { $, esc, formatDate, sameId, isMobilePhone, shortDateTime } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, field, searchBox, toast, confirmAction, registrationPill, showFieldError, paginate, pager, initial } from '../components.js';
import { go, render, rerenderKeepingFocus } from '../router.js';
import { loadEstablishments } from './estabelecimentos.js';

const loadManagers = async () => { state.managers = await api(endpoints.adminManagers); };

function renderManagers() {
  const term = state.managerSearch.trim().toLowerCase();
  const list = state.managers.filter((manager) => !term || `${manager.nome} ${manager.email}`.toLowerCase().includes(term));
  const page = paginate(list, state.managerPage);
  const rows = page.items.map((manager) => `<tr><td><strong>${esc(manager.nome)}</strong></td><td>${esc(manager.email)}</td><td>${esc(manager.telefone || '—')}</td>
    <td><div class="tag-list">${manager.postos.map((post) => `<span class="pill ${post.ativo ? 'green' : 'gray'}">${esc(post.nome)}</span>`).join('') || '<span class="helper">Nenhum</span>'}</div></td><td>${registrationPill(manager.status)}</td>
    <td class="row-actions end"><button class="icon-button" data-page="manager-form" data-id="${manager.usuario_id}" title="Editar" aria-label="Editar ${esc(manager.nome)}">✎</button><button class="icon-button accent" data-page="manager-detail" data-id="${manager.usuario_id}" title="Ver perfil" aria-label="Ver perfil de ${esc(manager.nome)}">›</button></td></tr>`);
  return `${shell('Gerenciamento de Clientes (Gerentes)', 'Controle de acessos e proprietários vinculados aos estabelecimentos', '<button class="success" data-page="manager-form">＋ &nbsp;Novo Gerente</button>', 'Administração › Gerentes')}
    ${searchBox('manager-search', state.managerSearch, 'Filtrar gerentes por nome ou email...')}
    <section class="surface">${dataTable(['Nome', 'Email', 'Telefone', 'Estabelecimentos Vinculados', 'Status', '<span class="sr-only">Ações</span>'], rows, 'Nenhum gerente encontrado.')}
      <div class="table-footer">Mostrando ${page.items.length} de ${list.length} gerentes${pager('managers-page', page)}</div></section>`;
}

// Só confere o formato (celular com DDD); não há envio de mensagem para confirmar o número.
function phoneStatus(value) {
  if (!String(value ?? '').replace(/\D/g, '')) return '<span class="phone-status">Informe DDD + número</span>';
  return isMobilePhone(value)
    ? '<span class="phone-status valid">✓ Celular válido para WhatsApp</span>'
    : '<span class="phone-status">Número fixo ou incompleto: alertas por WhatsApp exigem celular</span>';
}

function renderManagerForm() {
  const editing = state.managers.find((manager) => sameId(manager.usuario_id, state.managerEditId));
  const postOptions = state.establishments.filter((post) => post.ativo).map((post) => `<option value="${post.posto_id}">${esc(post.nome)}</option>`).join('');
  return `${shell(editing ? 'Editar Gerente' : 'Cadastrar Gerente', editing ? 'Atualize os dados de acesso do gerente' : 'Adicione um novo gerente e vincule ao estabelecimento', '', `Administração › Gerentes › ${editing ? `${esc(editing.nome)} › Editar` : 'Novo'}`)}
    <form id="manager-form" class="surface wide-form" novalidate><h2>Dados do Gerente</h2><div class="profile-grid">
      ${field('Nome Completo *', `<input name="nome" required value="${esc(editing?.nome || '')}" placeholder="Nome completo">`)}
      ${field('E-mail *', `<input name="email" type="email" required value="${esc(editing?.email || '')}" placeholder="gerente@posto.com">`)}
      <label>Telefone / WhatsApp *<input id="manager-phone" name="telefone" data-mask="phone" required value="${esc(editing?.telefone || '')}" placeholder="(11) 98765-4321"><span id="phone-status">${phoneStatus(editing?.telefone)}</span></label>
      ${editing ? '' : field('Estabelecimento vinculado', `<select name="posto_id"><option value="">Vincular depois</option>${postOptions}</select>`)}
      ${field(editing ? 'Nova senha' : 'Senha temporária *', `<input name="senha" type="password" minlength="8" ${editing ? 'placeholder="Deixe em branco para manter"' : 'required placeholder="Mínimo de 8 caracteres"'} autocomplete="new-password">`, editing ? '' : 'Informe a senha ao gerente; ele pode trocá-la depois em Informações Pessoais.')}
    </div><div class="form-actions end"><button type="button" class="secondary" data-page="${editing ? 'manager-detail' : 'managers'}" ${editing ? `data-id="${editing.usuario_id}"` : ''}>Cancelar</button><button class="success">${editing ? 'Salvar Alterações' : 'Salvar Gerente'}</button></div></form>`;
}

function renderManagerDetail() {
  const manager = state.managerDetail;
  if (!manager) return `${shell('Gerente')}<section class="surface empty-state">Gerente não encontrado. <button class="text-button" data-page="managers">Voltar</button></section>`;
  const linkable = state.establishments.filter((post) => post.ativo && !manager.postos.some((linked) => sameId(linked.posto_id, post.posto_id)));
  const links = manager.postos.map((post) => `<div class="link-row"><div><strong>${esc(post.nome)}${post.ativo ? '' : ' <span class="pill gray">Inativo</span>'}</strong><small>${esc([post.cidade, post.uf].filter(Boolean).join(' - ') || 'Cidade não informada')} • CNPJ Posto: ${esc(post.cnpj_posto || 'N/D')}</small></div><span class="linked-at"><small>Vinculado em:</small>${formatDate(post.vinculado_em)}</span><button class="danger-soft" data-action="unlink-manager" data-id="${post.posto_id}">Remover</button></div>`).join('');
  const history = manager.historico.map((item) => `<div class="history-item"><div><strong>${esc(item.descricao)}${item.posto_nome ? ` <span class="muted">(${esc(item.posto_nome)})</span>` : ''}</strong><small>${shortDateTime(item.created_at)}</small></div></div>`).join('');
  const linkForm = state.managerLinking
    ? (linkable.length ? `<form id="link-manager-form" class="inline-form">${field('Estabelecimento', `<select name="posto_id">${linkable.map((post) => `<option value="${post.posto_id}">${esc(post.nome)}</option>`).join('')}</select>`)}<button class="success">Vincular</button><button type="button" class="secondary" data-action="cancel-link">Cancelar</button></form>` : '<p class="helper">Todos os estabelecimentos ativos já estão vinculados a este gerente.</p>')
    : '';
  return `${shell(`Perfil do Gerente: ${esc(manager.nome)}`, 'Consulte dados cadastrais, histórico de ações e estabelecimentos associados', '', 'Administração › Gerentes › Detalhe')}
    <section class="surface profile-header"><span class="avatar large">${initial(manager.nome)}</span><div><h2>${esc(manager.nome)} ${registrationPill(manager.status)}</h2>
      <p>Email: <b>${esc(manager.email)}</b> · Telefone: <b>${esc(manager.telefone || '—')}</b> · Cadastrado em: <b>${formatDate(manager.created_at)}</b> · Último acesso: <b>${manager.ultimo_acesso ? shortDateTime(manager.ultimo_acesso) : 'nunca entrou'}</b></p></div>
      <div class="heading-actions"><button class="secondary" data-page="manager-form" data-id="${manager.usuario_id}">Editar Perfil</button><button class="${manager.ativo ? 'danger-outline' : 'success'}" data-action="toggle-manager">${manager.ativo ? 'Inativar acesso' : 'Reativar acesso'}</button></div></section>
    <div class="detail-columns">
      <section class="surface"><div class="surface-heading"><h2>Estabelecimentos Vinculados</h2>${state.managerLinking ? '' : '<button class="success" data-action="start-link">＋ Vincular Novo Posto</button>'}</div>${linkForm}${links || '<p class="helper">Nenhum vínculo. Sem vínculos o gerente fica sem acesso.</p>'}</section>
      <section class="surface"><h2>Histórico de Ações do Gerente</h2>${history || '<p class="helper">Nenhuma ação registrada.</p>'}</section>
    </div>`;
}

async function loadManagerDetail() {
  [state.managerDetail, state.establishments] = await Promise.all([api(endpoints.adminManager(state.managerDetailId)), api(endpoints.adminEstablishments)]);
}

export default {
  pages: {
    managers: { render: renderManagers, load: loadManagers, standalone: true, perfil: 'admin' },
    'manager-form': {
      render: renderManagerForm, nav: 'managers', standalone: true, perfil: 'admin',
      load: () => Promise.all([loadManagers(), loadEstablishments()]),
      enter: (id) => { state.managerEditId = id ? Number(id) : null; },
    },
    'manager-detail': {
      render: renderManagerDetail, load: loadManagerDetail, nav: 'managers', standalone: true, perfil: 'admin',
      enter: (id) => { if (id) state.managerDetailId = Number(id); state.managerLinking = false; },
    },
  },
  actions: {
    'managers-page': (page) => { state.managerPage = Number(page); render(); },
    'start-link': () => { state.managerLinking = true; render(); },
    'cancel-link': () => { state.managerLinking = false; render(); },
    'unlink-manager': async (postId) => {
      const manager = state.managerDetail;
      const post = manager.postos.find((item) => sameId(item.posto_id, postId));
      const last = manager.postos.length === 1;
      if (!await confirmAction({ title: `Remover vínculo com ${post.nome}?`, message: last ? 'Este é o último estabelecimento do gerente: ao remover, o acesso dele será inativado.' : 'O gerente deixa de acessar este estabelecimento.', confirmLabel: 'Remover' })) return;
      await api(endpoints.adminManagerPost(manager.usuario_id, postId), { method: 'DELETE' });
      toast(last ? 'Vínculo removido e acesso inativado.' : 'Vínculo removido.');
      await go('manager-detail');
    },
    'toggle-manager': async () => {
      const manager = state.managerDetail;
      if (manager.ativo && !await confirmAction({ title: `Inativar o acesso de ${manager.nome}?`, message: 'O gerente não conseguirá mais entrar no sistema. Os vínculos e o histórico de fechamentos são mantidos.', confirmLabel: 'Inativar acesso' })) return;
      await api(endpoints.adminManager(manager.usuario_id), json('PATCH', { ativo: !manager.ativo }));
      toast(manager.ativo ? 'Acesso inativado.' : 'Acesso reativado.');
      await go('manager-detail');
    },
  },
  forms: {
    'manager-form': async (data, form) => {
      const payload = { nome: data.get('nome').trim(), email: data.get('email').trim(), telefone: data.get('telefone').trim(), senha: data.get('senha') };
      for (const name of ['nome', 'email', 'telefone']) if (!payload[name]) { showFieldError(form.elements[name], 'Campo obrigatório'); return; }
      if ((!state.managerEditId || payload.senha) && payload.senha.length < 8) { showFieldError(form.elements.senha, 'A senha precisa ter pelo menos 8 caracteres'); return; }
      if (state.managerEditId) {
        await api(endpoints.adminManager(state.managerEditId), json('PUT', payload));
        toast('Gerente atualizado.');
        state.managerDetailId = state.managerEditId;
        await go('manager-detail');
        return;
      }
      const created = await api(endpoints.adminManagers, json('POST', { ...payload, posto_id: Number(data.get('posto_id')) || undefined }));
      toast('Gerente cadastrado. Ele aparece como pendente até o primeiro acesso.');
      state.managerDetailId = created.usuario_id;
      await go('manager-detail');
    },
    'link-manager-form': async (data) => {
      await api(endpoints.adminManagerPost(state.managerDetailId, data.get('posto_id')), { method: 'POST' });
      toast('Gerente vinculado ao estabelecimento.');
      state.managerLinking = false;
      await go('manager-detail');
    },
  },
  inputs: {
    'manager-search': (target) => { state.managerSearch = target.value; state.managerPage = 1; rerenderKeepingFocus(target); },
    'manager-phone': (target) => { $('#phone-status').innerHTML = phoneStatus(target.value); },
  },
};
