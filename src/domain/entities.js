// Entidades do domínio Une Caixas. Mantêm os dados e regras básicas de cada conceito.
export class Usuario {
  constructor({ usuario_id = null, nome, email, senha = null, ativo = true, created_at = null } = {}) {
    Object.assign(this, { usuario_id, nome, email, senha, ativo, created_at });
  }
  validar() { return Boolean(this.nome?.trim() && this.email?.trim()); }
  desativar() { this.ativo = false; }
}

export class Posto {
  constructor({ posto_id = null, nome, endereco = null, ativo = true, created_at = null } = {}) { Object.assign(this, { posto_id, nome, endereco, ativo, created_at }); }
  validar() { return Boolean(this.nome?.trim()); }
  inativar() { this.ativo = false; }
}

export class Empresa {
  constructor({ empresa_id = null, posto_id, nome, cnpj, tipo, created_at = null } = {}) { Object.assign(this, { empresa_id, posto_id, nome, cnpj, tipo, created_at }); }
  validar() { return Boolean(this.posto_id && this.nome?.trim() && this.cnpj?.trim() && ['combustivel', 'conveniencia'].includes(this.tipo)); }
}

export class Maquina {
  constructor({ maquina_id = null, empresa_id, nome, ativo = true, created_at = null } = {}) { Object.assign(this, { maquina_id, empresa_id, nome, ativo, created_at }); }
  validar() { return Boolean(this.empresa_id && this.nome?.trim()); }
  alterarStatus(ativo) { this.ativo = Boolean(ativo); }
}

export class Operador {
  constructor({ operador_id = null, empresa_id, nome, ativo = true, created_at = null } = {}) { Object.assign(this, { operador_id, empresa_id, nome, ativo, created_at }); }
  validar() { return Boolean(this.empresa_id && this.nome?.trim()); }
  alterarStatus(ativo) { this.ativo = Boolean(ativo); }
}

export class Fechamento {
  constructor({ fechamento_id = null, posto_id, usuario_id, data_referencia, valor_dinheiro_declarado = 0, valor_dinheiro_esperado = 0, status = 'em_analise' } = {}) {
    Object.assign(this, { fechamento_id, posto_id, usuario_id, data_referencia, valor_dinheiro_declarado, valor_dinheiro_esperado, status });
  }
  validar() { return Boolean(this.posto_id && this.usuario_id && this.data_referencia); }
  calcularDiferencaDinheiro() { return Number(this.valor_dinheiro_declarado || 0) - Number(this.valor_dinheiro_esperado || 0); }
}

export class FechamentoMaquina {
  constructor({ fechamento_maquina_id = null, fechamento_id, maquina_id, operador_id = null, turno = null, valor_esperado = 0, valor_recebido = 0 } = {}) {
    Object.assign(this, { fechamento_maquina_id, fechamento_id, maquina_id, operador_id, turno, valor_esperado, valor_recebido });
  }
  calcularDiferenca() { return Number(this.valor_recebido || 0) - Number(this.valor_esperado || 0); }
}

export class FechamentoEmpresa {
  constructor({ fechamento_empresa_id = null, fechamento_id, empresa_id, valor_esperado = 0, valor_recebido = 0 } = {}) {
    Object.assign(this, { fechamento_empresa_id, fechamento_id, empresa_id, valor_esperado, valor_recebido });
  }
  calcularDiferenca() { return Number(this.valor_recebido || 0) - Number(this.valor_esperado || 0); }
}

export class Divergencia {
  constructor({ divergencia_id = null, fechamento_id, fechamento_maquina_id = null, operador_id = null, valor_diferenca = 0, status = 'pendente' } = {}) {
    Object.assign(this, { divergencia_id, fechamento_id, fechamento_maquina_id, operador_id, valor_diferenca, status });
  }
  resolver() { this.status = 'resolvida'; }
}

export class Observacao {
  constructor({ observacao_id = null, fechamento_id, divergencia_id = null, usuario_id, texto, created_at = null } = {}) { Object.assign(this, { observacao_id, fechamento_id, divergencia_id, usuario_id, texto, created_at }); }
  validar() { return Boolean(this.fechamento_id && this.usuario_id && this.texto?.trim()); }
}

export class LogAuditoria {
  constructor({ log_id = null, fechamento_id, usuario_id, acao, campo_alterado = null, valor_anterior = null, valor_novo = null } = {}) { Object.assign(this, { log_id, fechamento_id, usuario_id, acao, campo_alterado, valor_anterior, valor_novo }); }
  descrever() { return `${this.acao}${this.campo_alterado ? `: ${this.campo_alterado}` : ''}`; }
}

export class DashboardResumo {
  constructor({ total_esperado = 0, total_recebido = 0, total_diferenca = 0, quantidade_fechamentos = 0 } = {}) { Object.assign(this, { total_esperado, total_recebido, total_diferenca, quantidade_fechamentos }); }
  estaConciliado() { return Number(this.total_diferenca) === 0; }
}
