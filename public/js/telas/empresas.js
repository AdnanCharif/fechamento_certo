// Tela: Configurações do Posto — CRUD das empresas (CNPJs) do posto atual.
import { esc, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, sideForm, field, toast, confirmAction, companyType } from '../components.js';
import { render } from '../router.js';
import { refreshContext } from '../context.js';

function renderSettings() {
  const post = state.posts.find((item) => sameId(item.posto_id, state.postId));
  const editing = state.companies.find((company) => sameId(company.empresa_id, state.companyEditId));
  const rows = state.companies.map((company) => `<tr><td>${esc(company.nome)}</td><td>${esc(company.cnpj)}</td><td>${companyType(company.tipo)}</td><td class="row-actions"><button class="text-button" data-action="edit-company" data-id="${company.empresa_id}">Editar</button><button class="text-button danger-text" data-action="delete-company" data-id="${company.empresa_id}">Excluir</button></td></tr>`);
  const form = sideForm({
    id: 'company-form', title: editing ? 'Editar Empresa' : 'Adicionar Empresa', cancelAction: 'cancel-company',
    body: field('Razão Social *', `<input name="nome" required placeholder="Ex.: Posto Max" value="${esc(editing?.nome || '')}">`)
      + field('CNPJ *', `<input name="cnpj" required maxlength="18" placeholder="00.000.000/0000-00" data-mask="cnpj" value="${esc(editing?.cnpj || '')}">`)
      + field('Tipo *', `<select name="tipo" required><option value="combustivel" ${editing?.tipo === 'combustivel' ? 'selected' : ''}>Posto de Combustível</option><option value="conveniencia" ${editing?.tipo === 'conveniencia' ? 'selected' : ''}>Loja de Conveniência</option></select>`),
  });
  return `${shell('Configurações do Posto', 'Visualize os dados do posto e gerencie as empresas (CNPJs) vinculadas.', '<button class="success" data-action="new-company">⊕ &nbsp;Nova Empresa</button>')}
    <section class="surface"><h2>Dados do Posto</h2><div class="profile-grid">${field('Nome do Posto', `<input value="${esc(post?.nome_posto)}" disabled>`)}${field('Gerente logado', `<input value="${esc(state.user?.nome)}" disabled>`)}</div><p class="helper">Nome, endereço, plano e módulos do posto são mantidos pelo suporte (área administrativa).</p></section>
    <h2 class="section-title">Empresas Vinculadas</h2>
    <div class="split-layout"><section class="surface">${dataTable(['Razão Social', 'CNPJ', 'Tipo', 'Ações'], rows, 'Nenhuma empresa cadastrada.')}</section>${form}</div>`;
}

export default {
  pages: {
    settings: { render: renderSettings },
  },
  actions: {
    'new-company': () => { state.companyEditId = null; render(); },
    'cancel-company': () => { state.companyEditId = null; render(); },
    'edit-company': (id) => { state.companyEditId = id; render(); },
    'delete-company': async (id) => {
      const company = state.companies.find((item) => sameId(item.empresa_id, id));
      if (!await confirmAction({ title: `Excluir ${company?.nome}?`, message: 'A empresa só pode ser excluída se não tiver máquinas ou operadores vinculados.', confirmLabel: 'Excluir' })) return;
      await api(endpoints.company(id), { method: 'DELETE' });
      state.companyEditId = null;
      await refreshContext();
      render();
      toast('Empresa excluída.');
    },
  },
  forms: {
    'company-form': async (data) => {
      const payload = { nome: data.get('nome').trim(), cnpj: data.get('cnpj').trim(), tipo: data.get('tipo') };
      if (state.companyEditId) await api(endpoints.company(state.companyEditId), json('PUT', payload));
      else await api(endpoints.companyCreate, json('POST', { ...payload, posto_id: state.postId }));
      await refreshContext();
      state.companyEditId = null;
      render();
      toast('Empresa salva com sucesso.');
    },
  },
};
