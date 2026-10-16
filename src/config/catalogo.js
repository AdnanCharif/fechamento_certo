// Catálogo da linha de produto: planos comerciais e módulos que o administrador
// liga ou desliga por cliente (posto). O banco guarda só as escolhas de cada posto.

export const planos = {
  basico: { nome: 'Básico', precoMensal: 199 },
  pro_premium: { nome: 'Pro Premium', precoMensal: 399 },
  apenas_loja: { nome: 'Apenas Loja', precoMensal: 149 },
};

export const modulos = {
  fechamento_padrao: {
    nome: 'Fechamento de Caixa Padrão',
    descricao: 'Módulo principal para conciliação física de caixa por operadores de pista e conveniência.',
    obrigatorio: true,
  },
  multi_unidade: {
    nome: 'Painel Multi-unidade',
    descricao: 'Permite visualizar múltiplos postos consolidados no mesmo painel. Recomendado para redes ou grupos de postos.',
  },
  relatorios_avancados: {
    nome: 'Relatórios & Gráficos Avançados',
    descricao: 'Acesso a gráficos de evolução histórica, balanços mensais comparativos e detecção de perdas.',
  },
  exportacao_contabil: {
    nome: 'Exportação para Contabilidade',
    descricao: 'Geração de planilhas formatadas para sistemas contábeis.',
  },
  alertas_whatsapp: {
    nome: 'Alertas Instantâneos por WhatsApp',
    descricao: 'Notifica o celular do gerente assim que uma divergência crítica (falta de caixa) é registrada.',
  },
};

export const modulosObrigatorios = Object.keys(modulos).filter((chave) => modulos[chave].obrigatorio);

// Módulos ativos de um posto: os obrigatórios mais os ligados pelo administrador.
export async function modulosAtivos(pool, postoId) {
  const result = await pool.query('SELECT modulo FROM postos_modulos WHERE posto_id = $1 AND ativo', [postoId]);
  return [...new Set([...modulosObrigatorios, ...result.rows.map((row) => row.modulo).filter((chave) => modulos[chave])])];
}
