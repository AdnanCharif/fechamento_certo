// Tela (Administração): Estabelecimentos — CRUD de postos com as duas empresas (posto e loja).
import { $, esc, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, field, searchBox, toast, confirmAction, activePill } from '../components.js';
import { go, rerenderKeepingFocus } from '../router.js';
import { loadContext, loadManagers } from '../context.js';

async function loadEstablishments() {
  state.establishments = await Promise.all(state.posts.map(async (post) => ({ ...post, empresas: await api(endpoints.companies(post.posto_id)) })));
}

function renderEstablishments() {
  const term = state.establishmentSearch.trim().toLowerCase();
  const list = state.establishments.filter((item) => !term || [item.nome_posto, ...item.empresas.map((company) => company.cnpj)].some((value) => value?.toLowerCase().includes(term)));
  const cnpjOf = (item, type) => esc(item.empresas.find((company) => company.tipo === type)?.cnpj || 'N/D');
  const rows = list.map((item) => `<tr><td><strong>${esc(item.nome_posto)}</strong></td><td>${cnpjOf(item, 'combustivel')}</td><td>${cnpjOf(item, 'conveniencia')}</td><td>${item.empresas.length}</td><td class="row-actions"><button class="text-button" data-page="establishment-form" data-id="${item.posto_id}">Editar</button><button class="text-button danger-text" data-action="delete-establishment" data-id="${item.posto_id}">Inativar</button></td></tr>`);
  return `${shell('Estabelecimentos Cadastrados', 'Controle e acompanhamento de postos e lojas homologadas.', '<button class="success" data-page="establishment-form">⊕ &nbsp;Novo Estabelecimento</button>', 'Administração › Clientes')}
    ${searchBox('establishment-search', state.establishmentSearch, 'Buscar por nome ou CNPJ...')}
    <section class="surface">${dataTable(['Nome do Estabelecimento', 'CNPJ Posto', 'CNPJ Loja', 'Empresas', 'Ações'], rows, 'Nenhum estabelecimento encontrado.')}<div class="table-footer">Mostrando ${list.length} de ${state.establishments.length} estabelecimentos<span>Lista dos postos vinculados ao seu usuário</span></div></section>`;
}

function renderEstablishmentForm() {
  const editing = state.establishments.find((item) => sameId(item.posto_id, state.establishmentEditId));
  const company = (type) => editing?.empresas.find((item) => item.tipo === type) || {};
  const companyBlock = (type, title, label) => `<fieldset class="company-block"><legend>${title}</legend>${field(`CNPJ ${label}`, `<input name="cnpj_${type}" maxlength="18" placeholder="00.000.000/0000-00" data-mask="cnpj" value="${esc(company(type).cnpj || '')}">`)}${field('Razão Social', `<input name="nome_${type}" placeholder="Razão social" value="${esc(company(type).nome || '')}">`)}</fieldset>`;
  const managerOptions = state.managers.length ? state.managers : [{ usuario_id: state.user.usuario_id, nome: state.user.nome, email: state.user.email }];
  return `${shell(editing ? 'Editar Estabelecimento' : 'Cadastrar Estabelecimento', editing ? 'Atualize os dados do estabelecimento e das empresas vinculadas.' : 'Adicione um novo cliente e defina suas empresas vinculadas.', editing ? activePill(true) : '', `Administração › Clientes › ${editing ? `${esc(editing.nome_posto)} › Editar` : 'Novo'}`)}
    <form id="establishment-form" class="surface wide-form">
      <h2>Dados Gerais do Estabelecimento</h2>
      <div class="form-grid">
        <div class="span-4">${field('Nome do Estabelecimento *', `<input name="nome" required placeholder="Ex.: Auto Posto Central LTDA" value="${esc(editing?.nome_posto || '')}">`)}</div>
        ${field('CEP', '<input name="cep" placeholder="00000-000" maxlength="9">')}
        <div class="span-2">${field('Logradouro (rua/avenida)', '<input name="logradouro" placeholder="Av. Brasil">')}</div>
        ${field('Número', '<input name="numero" placeholder="1500">')}
        ${field('Bairro', '<input name="bairro" placeholder="Centro">')}
        ${field('Cidade', '<input name="cidade" placeholder="São Paulo">')}
        ${field('Estado (UF)', '<input name="uf" maxlength="2" placeholder="SP">')}
        ${field('Complemento', '<input name="complemento" placeholder="Sala, bloco...">')}
      </div>
      ${editing ? '<p class="helper">O endereço atual não é retornado pela API; preencha apenas se quiser substituí-lo.</p>' : ''}
      <div class="company-grid">${companyBlock('combustivel', 'Empresa 1 — Posto de Combustível', 'do Posto')}${companyBlock('conveniencia', 'Empresa 2 — Loja de Conveniência', 'da Loja')}</div>
      ${editing ? '' : `<h2>Definir Gerente Responsável</h2>${field('Gerente Criado / Associado', `<select name="usuario_id">${managerOptions.map((manager) => `<option value="${manager.usuario_id}" ${sameId(manager.usuario_id, state.user.usuario_id) ? 'selected' : ''}>${esc(manager.nome)} (${esc(manager.email)})</option>`).join('')}</select>`)}`}
      <div class="form-actions end"><button type="button" class="secondary" data-page="establishments">Cancelar</button><button class="success">${editing ? 'Salvar Alterações' : 'Salvar Estabelecimento'}</button></div>
    </form>
    ${editing ? `<section class="surface danger-zone"><h2>Zona de risco</h2><p>Ao inativar, o estabelecimento deixa de aparecer para novos fechamentos e os gerentes vinculados perdem o acesso. O histórico é mantido.</p><div class="form-actions end"><button class="danger-outline" data-action="delete-establishment" data-id="${editing.posto_id}">Inativar Estabelecimento</button></div></section>` : ''}`;
}

// O banco guarda o endereço numa coluna só; os campos do formulário são unidos aqui.
function composeAddress(data) {
  const street = [data.get('logradouro'), data.get('numero')].map((value) => value?.trim()).filter(Boolean).join(', ');
  const city = [data.get('cidade')?.trim(), data.get('uf')?.trim().toUpperCase()].filter(Boolean).join('/');
  return [street, data.get('complemento')?.trim(), data.get('bairro')?.trim(), city, data.get('cep')?.trim()].filter(Boolean).join(' - ');
}

async function saveEstablishment(data) {
  const editing = state.establishments.find((item) => sameId(item.posto_id, state.establishmentEditId));
  const companies = ['combustivel', 'conveniencia'].map((tipo) => ({ tipo, cnpj: data.get(`cnpj_${tipo}`).trim(), nome: data.get(`nome_${tipo}`).trim() })).filter((company) => company.cnpj || company.nome);
  if (companies.some((company) => !company.cnpj || !company.nome)) { toast('Preencha CNPJ e razão social de cada empresa informada.', true); return; }
  const usedElsewhere = companies.find((company) => state.establishments.some((post) => !sameId(post.posto_id, editing?.posto_id) && post.empresas.some((other) => other.cnpj === company.cnpj)));
  if (usedElsewhere) {
    const input = $(`[name="cnpj_${usedElsewhere.tipo}"]`);
    input.setCustomValidity('CNPJ já cadastrado em outro estabelecimento');
    input.reportValidity();
    input.addEventListener('input', () => input.setCustomValidity(''), { once: true });
    return;
  }
  const endereco = composeAddress(data);
  let postId = editing?.posto_id;
  if (editing) await api(endpoints.post(postId), json('PUT', { nome: data.get('nome').trim(), ...(endereco ? { endereco } : {}) }));
  else postId = (await api(endpoints.posts, json('POST', { nome: data.get('nome').trim(), endereco, usuario_id: Number(data.get('usuario_id')) }))).posto_id;
  for (const company of companies) {
    const existing = editing?.empresas.find((item) => item.tipo === company.tipo);
    if (existing) await api(endpoints.company(existing.empresa_id), json('PUT', company));
    else await api(endpoints.companyCreate, json('POST', { ...company, posto_id: postId }));
  }
  toast(editing ? 'Estabelecimento atualizado.' : 'Estabelecimento cadastrado.');
  await loadContext();
  await go('establishments');
}

export default {
  pages: {
    establishments: { render: renderEstablishments, load: loadEstablishments, standalone: true },
    'establishment-form': {
      render: renderEstablishmentForm, nav: 'establishments', standalone: true,
      load: () => Promise.all([loadEstablishments(), loadManagers()]),
      enter: (id) => { state.establishmentEditId = id ? Number(id) : null; },
    },
  },
  actions: {
    'delete-establishment': async (id) => {
      const item = state.establishments.find((post) => sameId(post.posto_id, id));
      if (!await confirmAction({ title: `Inativar ${item?.nome_posto}?`, message: 'Os gerentes vinculados perderão o acesso e o estabelecimento não poderá receber novos fechamentos. O histórico de fechamentos será preservado e a ação pode ser revertida por um administrador.', confirmLabel: 'Confirmar Inativação' })) return;
      await api(endpoints.post(id), { method: 'DELETE' });
      toast('Estabelecimento inativado.');
      await loadContext();
      await go('establishments');
    },
  },
  forms: {
    'establishment-form': saveEstablishment,
  },
  inputs: {
    'establishment-search': (target) => { state.establishmentSearch = target.value; rerenderKeepingFocus(target); },
  },
};
