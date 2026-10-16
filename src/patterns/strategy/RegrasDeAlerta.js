// Strategy: cada regra avalia os fechamentos de um posto e devolve um alerta ou null.
// gerarAlertas não conhece as regras; só aplica a lista recebida a cada posto.
// Os fechamentos chegam do mais recente para o mais antigo, com data em 'AAAA-MM-DD'.

const moeda = (valor) => Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const diaMes = (data) => data.split('-').reverse().slice(0, 2).join('/');

export class FaltaAcumuladaRule {
  avaliar(fechamentos, { limite, inicioSemana }) {
    const semana = fechamentos.filter((f) => f.data > inicioSemana);
    const falta = semana.reduce((soma, f) => soma + Math.min(Number(f.diferenca), 0), 0);
    if (!limite || !semana.length || falta > -limite * 10) return null;
    return {
      gravidade: 'critico',
      titulo: 'Falta crítica acumulada',
      descricao: `Falta total de ${moeda(-falta)} nos últimos 7 dias. Necessário revisão de caixa física.`,
      desde: semana[0].created_at,
    };
  }
}

export class DivergenciasRecorrentesRule {
  constructor(quantidade = 3) { this.quantidade = quantidade; }
  avaliar(fechamentos, { limite }) {
    const ultimos = fechamentos.slice(0, this.quantidade);
    if (!limite || ultimos.length < this.quantidade || !ultimos.every((f) => Math.abs(Number(f.diferenca)) > limite)) return null;
    return {
      gravidade: 'atencao',
      titulo: 'Divergências recorrentes',
      descricao: `${this.quantidade} fechamentos consecutivos com divergência de caixa maior que ${moeda(limite)}.`,
      desde: ultimos[0].created_at,
    };
  }
}

export class FechamentoPendenteRule {
  avaliar(fechamentos, { ontem, hoje }) {
    if (fechamentos.some((f) => f.data === ontem)) return null;
    return {
      gravidade: 'atencao',
      titulo: 'Fechamento pendente',
      descricao: `O fechamento do dia ${diaMes(ontem)} ainda não foi registrado.`,
      desde: `${hoje}T00:00:00`,
    };
  }
}

export const regrasDeAlerta = [new FaltaAcumuladaRule(), new DivergenciasRecorrentesRule(), new FechamentoPendenteRule()];

// Aplica as regras a cada posto; críticos primeiro e, dentro da gravidade, os mais recentes.
export function gerarAlertas(postos, fechamentosPorPosto, contexto, regras = regrasDeAlerta) {
  return postos
    .flatMap((posto) => regras
      .map((regra) => regra.avaliar(fechamentosPorPosto.get(posto.posto_id) ?? [], contexto))
      .filter(Boolean)
      .map((alerta) => ({ ...alerta, posto_id: posto.posto_id, posto_nome: posto.nome })))
    .sort((a, b) => (a.gravidade === b.gravidade ? new Date(b.desde) - new Date(a.desde) : a.gravidade === 'critico' ? -1 : 1));
}
