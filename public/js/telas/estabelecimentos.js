// Tela (Admin): Estabelecimentos — CRUD dos clientes (postos) com as duas empresas e o gerente responsável.
import { esc, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, dataTable, field, searchBox, toast, confirmAction, registrationPill, showFieldError, paginate, pager } from '../components.js';
import { go, render, rerenderKeepingFocus } from '../router.js';

export async function loadEstablishments() {
  state.establishments = await api(endpoints.adminEstablishments);
}

const cnpjOf = (item, type) => item.empresas.find((company) => company.tipo === type)?.cnpj;
const cityOf = (item) => [item.cidade, item.uf].filter(Boolean).join('/') || '—';

function renderEstablishments() {
  const term = state.establishmentSearch.trim().toLowerCase();
  const list = state.establishments.filter((item) => !term || [item.nome, item.cidade, ...item.empresas.map((company) => company.cnpj)].some((value) => value?.toLowerCase().includes(term)));
  const page = paginate(list, state.establishmentPage);
  const rows = page.items.map((item) => `<tr><td><strong>${esc(item.nome)}</strong></td><td>${esc(cityOf(item))}</td><td class="muted-cell">${esc(cnpjOf(item, 'combustivel') || 'N/D')}</td><td class="muted-cell">${esc(cnpjOf(item, 'conveniencia') || 'N/D')}</td><td>${registrationPill(item.status)}</td><td>${esc(item.plano_nome)}</td>
    <td class="row-actions end"><button class="icon-button" data-page="establishment-form" data-id="${item.posto_id}" title="Editar" aria-label="Editar ${esc(item.nome)}">✎</button><button class="icon-button accent" data-page="modules" data-id="${item.posto_id}" title="Módulos e plano" aria-label="Módulos e plano de ${esc(item.nome)}">›</button></td></tr>`);
  return `${shell('Estabelecimentos Cadastrados', 'Controle e acompanhamento de postos e lojas homologadas', '<button class="success" data-page="establishment-form">＋ &nbsp;Novo Estabelecimento</button>', 'Administração › Clientes')}
    ${searchBox('establishment-search', state.establishmentSearch, 'Buscar por nome, CNPJ ou cidade...')}
    <section class="surface">${dataTable(['Nome do Estabelecimento', 'Cidade/UF', 'CNPJ Posto', 'CNPJ Loja', 'Status', 'Plano', '<span class="sr-only">Ações</span>'], rows, 'Nenhum estabelecimento encontrado.')}
      <div class="table-footer">Mostrando ${page.items.length} de ${list.length} estabelecimentos${pager('establishments-page', page)}</div></section>`;
}

function renderEstablishmentForm() {
  const editing = state.establishments.find((item) => sameId(item.posto_id, state.establishmentEditId));
  const value = (name) => esc(editing?.[name] || '');
  const company = (type) => editing?.empresas.find((item) => item.tipo === type) || {};
  const companyBlock = (type, title, label) => `<fieldset class="company-block"><legend>${title}</legend>
    <input type="hidden" name="id_${type}" value="${company(type).empresa_id || ''}">
    ${field(`CNPJ ${label}`, `<input name="cnpj_${type}" maxlength="18" placeholder="00.000.000/0000-00" data-mask="cnpj" value="${esc(company(type).cnpj || '')}">`)}
    ${field('Razão Social', `<input name="nome_${type}" placeholder="Razão social" value="${esc(company(type).nome || '')}">`)}
    ${field('Inscrição Estadual', `<input name="ie_${type}" maxlength="20" placeholder="000.000.000.000" value="${esc(company(type).inscricao_estadual || '')}">`)}</fieldset>`;
  const managers = state.managers.filter((manager) => manager.ativo);
  const current = editing?.gerentes[0]?.usuario_id;
  const managerSelect = `<select name="usuario_id"><option value="">${editing ? 'Manter os gerentes atuais' : 'Definir depois (fica pendente)'}</option>${managers.map((manager) => `<option value="${manager.usuario_id}" ${sameId(manager.usuario_id, current) ? 'selected' : ''}>${esc(manager.nome)} (${esc(manager.email)})</option>`).join('')}</select>`;
  const riskZone = !editing ? '' : editing.ativo
    ? `<section class="surface danger-zone"><h2>Zona de risco</h2><p>Ao inativar, o estabelecimento deixa de aparecer para novos fechamentos e os gerentes vinculados perdem o acesso. O histórico é mantido.</p><div class="form-actions end"><button class="danger-outline" data-action="toggle-establishment" data-id="${editing.posto_id}">Inativar Estabelecimento</button></div></section>`
    : `<section class="surface danger-zone"><h2>Estabelecimento inativo</h2><p>Os gerentes vinculados não acessam este posto. Ao reativar, o acesso e os novos fechamentos voltam a funcionar.</p><div class="form-actions end"><button class="success" data-action="toggle-establishment" data-id="${editing.posto_id}">Reativar Estabelecimento</button></div></section>`;
  return `${shell(editing ? `Editar Estabelecimento ${registrationPill(editing.status)}` : 'Cadastrar Estabelecimento', editing ? 'Atualize os dados do estabelecimento e das empresas vinculadas' : 'Adicione um novo cliente e defina suas empresas vinculadas', '', `Administração › Clientes › ${editing ? `${esc(editing.nome)} › Editar` : 'Novo'}`)}
    <form id="establishment-form" class="surface wide-form" novalidate>
      <h2>Dados Gerais do Estabelecimento</h2>
      <div class="form-grid">
        <div class="span-3">${field('Nome do Estabelecimento *', `<input name="nome" required placeholder="Ex.: Auto Posto Central LTDA" value="${value('nome')}">`)}</div>
        ${field('Telefone de Contato', `<input name="telefone" data-mask="phone" placeholder="(11) 3456-7890" value="${value('telefone')}">`)}
        ${field('CEP', `<input name="cep" data-mask="cep" placeholder="00000-000" value="${value('cep')}">`)}
        <div class="span-2">${field('Logradouro (rua/avenida)', `<input name="logradouro" placeholder="Av. Brasil" value="${value('logradouro')}">`)}</div>
        ${field('Número', `<input name="numero" placeholder="1500" value="${value('numero')}">`)}
        ${field('Bairro', `<input name="bairro" placeholder="Centro" value="${value('bairro')}">`)}
        ${field('Cidade', `<input name="cidade" placeholder="São Paulo" value="${value('cidade')}">`)}
        ${field('Estado (UF)', `<input name="uf" maxlength="2" placeholder="SP" value="${value('uf')}">`)}
        ${field('Complemento', `<input name="complemento" placeholder="Sala, bloco..." value="${value('complemento')}">`)}
      </div>
      <div class="company-grid">${companyBlock('combustivel', 'Empresa 1 — Posto de Combustível', 'do Posto')}${companyBlock('conveniencia', 'Empresa 2 — Loja de Conveniência', 'da Loja')}</div>
      <div class="form-section"><h2>${editing ? 'Gerente Responsável' : 'Definir Gerente Responsável'}</h2><div class="half">${field('Gerente Criado / Associado', managerSelect, editing ? 'Escolher um gerente aqui vincula-o ao posto; para remover vínculos, use a tela do gerente.' : 'Sem gerente, o estabelecimento fica pendente de ativação.')}</div></div>
      <div class="form-actions end"><button type="button" class="secondary" data-page="establishments">Cancelar</button><button class="success">${editing ? 'Salvar Alterações' : 'Salvar Estabelecimento'}</button></div>
    </form>${riskZone}`;
}

async function saveEstablishment(data, form) {
  const editing = state.establishments.find((item) => sameId(item.posto_id, state.establishmentEditId));
  if (!data.get('nome').trim()) { showFieldError(form.elements.nome, 'Informe o nome do estabelecimento'); return; }
  const companies = ['combustivel', 'conveniencia']
    .map((tipo) => ({ empresa_id: Number(data.get(`id_${tipo}`)) || undefined, tipo, cnpj: data.get(`cnpj_${tipo}`).trim(), nome: data.get(`nome_${tipo}`).trim(), inscricao_estadual: data.get(`ie_${tipo}`).trim() }))
    .filter((company) => company.empresa_id || company.cnpj || company.nome);
  const incomplete = companies.find((company) => !company.cnpj || !company.nome);
  if (incomplete) { showFieldError(form.elements[`${incomplete.cnpj ? 'nome' : 'cnpj'}_${incomplete.tipo}`], 'Preencha CNPJ e razão social da empresa'); return; }
  const usedElsewhere = companies.find((company) => state.establishments.some((post) => !sameId(post.posto_id, editing?.posto_id) && post.empresas.some((other) => other.cnpj === company.cnpj)));
  if (usedElsewhere) { showFieldError(form.elements[`cnpj_${usedElsewhere.tipo}`], 'CNPJ já cadastrado em outro estabelecimento'); return; }
  const payload = Object.fromEntries(['nome', 'telefone', 'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf', 'complemento'].map((name) => [name, data.get(name).trim()]));
  payload.uf = payload.uf.toUpperCase();
  payload.empresas = companies;
  payload.usuario_id = Number(data.get('usuario_id')) || undefined;
  if (editing) await api(endpoints.adminEstablishment(editing.posto_id), json('PUT', payload));
  else await api(endpoints.adminEstablishments, json('POST', payload));
  toast(editing ? 'Estabelecimento atualizado.' : 'Estabelecimento cadastrado.');
  await go('establishments');
}

export default {
  pages: {
    establishments: { render: renderEstablishments, load: loadEstablishments, standalone: true, perfil: 'admin' },
    'establishment-form': {
      render: renderEstablishmentForm, nav: 'establishments', standalone: true, perfil: 'admin',
      load: async () => { [state.establishments, state.managers] = await Promise.all([api(endpoints.adminEstablishments), api(endpoints.adminManagers)]); },
      enter: (id) => { state.establishmentEditId = id ? Number(id) : null; },
    },
  },
  actions: {
    'establishments-page': (page) => { state.establishmentPage = Number(page); render(); },
    'toggle-establishment': async (id) => {
      const item = state.establishments.find((post) => sameId(post.posto_id, id));
      if (item.ativo && !await confirmAction({ title: `Inativar ${item.nome}?`, message: 'Os gerentes vinculados perderão o acesso e o estabelecimento não poderá receber novos fechamentos. O histórico de fechamentos será preservado e a ação pode ser revertida por um administrador.', confirmLabel: 'Confirmar Inativação' })) return;
      await api(endpoints.adminEstablishment(id), json('PATCH', { ativo: !item.ativo }));
      toast(item.ativo ? 'Estabelecimento inativado.' : 'Estabelecimento reativado.');
      await go('establishment-form');
    },
  },
  forms: {
    'establishment-form': saveEstablishment,
  },
  inputs: {
    'establishment-search': (target) => { state.establishmentSearch = target.value; state.establishmentPage = 1; rerenderKeepingFocus(target); },
  },
};
