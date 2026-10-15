let token = null;
export const setToken = (value) => { token = value; };

// Contrato de rotas usado pelo front (implementadas em src/routes.js).
export const endpoints = {
  login: '/auth/login',
  logout: '/auth/logout',
  variability: '/config/variabilidade',
  userPosts: (userId) => `/postos/${userId}`,
  posts: '/postos', // POST { nome, endereco, usuario_id } → { posto_id }
  post: (postId) => `/postos/${postId}`, // PUT { nome, endereco } · DELETE (inativar estabelecimento)
  postUsers: (postId) => `/postos/${postId}/usuarios`,
  postUser: (postId, userId) => `/postos/${postId}/usuarios/${userId}`, // POST (vincular gerente já cadastrado) · DELETE (desvincular)
  user: (userId) => `/usuarios/${userId}`,
  companies: (postId) => `/postos/empresas/${postId}`,
  companyCreate: '/empresas',
  company: (companyId) => `/empresas/${companyId}`,
  machines: (postId) => `/postos/${postId}/maquinas`,
  machineCreate: '/maquinas',
  machine: (machineId) => `/maquinas/${machineId}`,
  operators: (postId) => `/operadores/posto/${postId}`,
  operatorCreate: '/operadores',
  operator: (operatorId) => `/operadores/${operatorId}`,
  closings: (postId) => `/postos/${postId}/fechamentos`,
  closingDashboard: (postId) => `/postos/${postId}/fechamentos/dashboard`,
  // GET · PUT { valor_dinheiro_esperado, valor_dinheiro_declarado, maquinas: [{ fechamento_maquina_id, valor_esperado, valor_recebido }] } com log em logs_auditoria
  // DELETE = arquivar (status 'arquivado'; fechamento nunca é apagado)
  closing: (postId, closingId) => `/postos/${postId}/fechamentos/${closingId}`,
  divergences: (postId, closingId) => `/postos/${postId}/fechamentos/${closingId}/divergencias`, // POST { fechamento_maquina_id, operador_id, valor_diferenca, status }
  divergence: (postId, closingId, id) => `/postos/${postId}/fechamentos/${closingId}/divergencias/${id}`, // PUT { operador_id, valor_diferenca, status } · DELETE
  notes: (postId, closingId) => `/postos/${postId}/fechamentos/${closingId}/observacoes`, // POST { texto, divergencia_id }
  note: (postId, closingId, id) => `/postos/${postId}/fechamentos/${closingId}/observacoes/${id}`, // PUT { texto } · DELETE
};

export const json = (method, body) => ({ method, body: JSON.stringify(body) });

export async function api(url, options = {}) {
  const headers = { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const response = await fetch(url, { ...options, headers });
  let data = null;
  try { data = await response.json(); } catch { /* Respostas sem JSON serão tratadas pelo status HTTP. */ }
  if (response.status === 404 && !data) throw new Error(`Rota ainda não disponível no backend: ${options.method || 'GET'} ${url}`);
  if (!response.ok) throw new Error(data?.error || `Falha na requisição (${response.status})`);
  return data;
}
