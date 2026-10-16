// Tela (Admin): Módulos & Planos — liga e desliga os módulos de cada cliente e troca o plano.
// É aqui que a variabilidade por cliente é decidida: o menu do gerente segue estas escolhas.
import { esc, money, sameId } from '../utils.js';
import { api, endpoints, json } from '../api.js';
import { state } from '../state.js';
import { shell, toast } from '../components.js';
import { render } from '../router.js';
import { loadEstablishments } from './estabelecimentos.js';

async function loadModuleData() {
  if (!state.establishments.some((post) => sameId(post.posto_id, state.moduleEstablishmentId))) state.moduleEstablishmentId = state.establishments[0]?.posto_id ?? null;
  state.moduleData = state.moduleEstablishmentId ? await api(endpoints.adminModules(state.moduleEstablishmentId)) : null;
}

async function loadModules() {
  await loadEstablishments();
  await loadModuleData();
}

function moduleRow(module) {
  return `<div class="module-row"><div><strong>${esc(module.nome)}${module.obrigatorio ? ' <span class="pill gray">OBRIGATÓRIO / CORE</span>' : ''}</strong><p>${esc(module.descricao)}</p></div>
    <label class="switch"><input type="checkbox" role="switch" data-input="module-toggle" data-module="${module.chave}" ${module.ativo ? 'checked' : ''} ${module.obrigatorio ? 'disabled' : ''} aria-label="${esc(module.nome)}"><span aria-hidden="true"></span></label></div>`;
}

function renderModules() {
  const data = state.moduleData;
  if (!data) return `${shell('Módulos & Planos', '', '', 'Administração › Clientes › Módulos')}<section class="surface empty-state">Cadastre um estabelecimento para configurar módulos.</section>`;
  const clients = state.establishments.map((post) => `<option value="${post.posto_id}" ${sameId(post.posto_id, data.posto.posto_id) ? 'selected' : ''}>${esc(post.nome)}</option>`).join('');
  const plans = data.planos.map((plan) => `<option value="${plan.chave}" ${plan.chave === data.posto.plano ? 'selected' : ''}>${esc(plan.nome)} (${money(plan.precoMensal)}/mês)</option>`).join('');
  return `${shell(`Painel de Módulos: ${esc(data.posto.nome)}`, 'Gerencie quais recursos extras estão ativos no painel deste cliente', '', 'Administração › Clientes › Módulos')}
    <section class="surface client-card">
      <label>Cliente selecionado<select id="module-client" aria-label="Cliente selecionado">${clients}</select></label>
      <label class="plan-select">Plano atual<select id="module-plan" aria-label="Plano atual">${plans}</select></label>
    </section>
    <section class="surface modules-card"><h2>Módulos Disponíveis & Recursos Extras</h2>${data.modulos.map(moduleRow).join('')}
      <p class="helper module-note">ⓘ Módulos ativos são cobrados conforme o plano contratado. O Painel Multi-unidade muda o menu do gerente na hora: liga o Comparativo de Postos e o dashboard consolidado.</p></section>`;
}

export default {
  pages: {
    modules: {
      render: renderModules, load: loadModules, nav: 'modules', standalone: true, perfil: 'admin',
      enter: (id) => { if (id) state.moduleEstablishmentId = Number(id); },
    },
  },
  inputs: {
    'module-client': async (target) => { state.moduleEstablishmentId = Number(target.value); await loadModuleData(); render(); },
    'module-plan': async (target) => {
      await api(endpoints.adminPlan(state.moduleData.posto.posto_id), json('PUT', { plano: target.value }));
      state.moduleData.posto.plano = target.value;
      toast(`Plano alterado para ${target.selectedOptions[0].textContent}.`);
    },
    'module-toggle': async (target) => {
      const module = state.moduleData.modulos.find((item) => item.chave === target.dataset.module);
      try {
        await api(endpoints.adminModule(state.moduleData.posto.posto_id, module.chave), json('PUT', { ativo: target.checked }));
      } catch (error) {
        target.checked = !target.checked; // volta o interruptor se o servidor recusar
        throw error;
      }
      module.ativo = target.checked;
      toast(`${module.nome} ${module.ativo ? 'ativado' : 'desativado'} para ${state.moduleData.posto.nome}.`);
    },
  },
};
