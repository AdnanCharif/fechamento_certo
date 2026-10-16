// Entidades do domínio Une Caixas. Mantêm os dados e regras básicas de cada conceito.
export class Usuario {
  constructor({ usuario_id = null, nome, email, senha = null, telefone = null, perfil = 'gerente', ativo = true, ultimo_acesso = null, created_at = null } = {}) {
    Object.assign(this, { usuario_id, nome, email, senha, telefone, perfil, ativo, ultimo_acesso, created_at });
  }
  validar() { return Boolean(this.nome?.trim() && this.email?.trim()); }
  desativar() { this.ativo = false; }
  ehAdmin() { return this.perfil === 'admin'; }
}

export class Posto {
  constructor({ posto_id = null, nome, endereco = null, telefone = null, cep = null, logradouro = null, numero = null, bairro = null, cidade = null, uf = null, complemento = null, plano = 'basico', ativo = true, created_at = null } = {}) {
    Object.assign(this, { posto_id, nome, endereco, telefone, cep, logradouro, numero, bairro, cidade, uf, complemento, plano, ativo, created_at });
  }
  validar() { return Boolean(this.nome?.trim()); }
  inativar() { this.ativo = false; }
  // Junta os campos do endereço numa linha ("Av. Brasil, 1500 - Sala 2 - Centro - São Paulo/SP - 01000-000").
  enderecoCompleto() {
    const rua = [this.logradouro, this.numero].map((parte) => parte?.trim()).filter(Boolean).join(', ');
    const cidade = [this.cidade?.trim(), this.uf?.trim().toUpperCase()].filter(Boolean).join('/');
    return [rua, this.complemento?.trim(), this.bairro?.trim(), cidade, this.cep?.trim()].filter(Boolean).join(' - ') || null;
  }
}

export class Empresa {
  constructor({ empresa_id = null, posto_id, nome, cnpj, tipo, inscricao_estadual = null, created_at = null } = {}) { Object.assign(this, { empresa_id, posto_id, nome, cnpj, tipo, inscricao_estadual, created_at }); }
  validar() { return Boolean(this.posto_id) && this.dadosValidos(); }
  // Validação sem o posto, usada quando a empresa é cadastrada junto com um posto novo.
  dadosValidos() { return Boolean(this.nome?.trim() && this.cnpj?.trim() && ['combustivel', 'conveniencia'].includes(this.tipo)); }
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
  // Com divergência quando o dinheiro não bate ou alguma empresa tem diferença nos cartões.
  definirStatus(empresaDivergente) {
    this.status = empresaDivergente || this.calcularDiferencaDinheiro() !== 0 ? 'com_divergencia' : 'ok';
    return this.status;
  }
  // Dinheiro e lançamentos de máquinas precisam ser números não negativos (na criação e na edição).
  static valoresValidos({ valor_dinheiro_esperado, valor_dinheiro_declarado, maquinas }) {
    return Array.isArray(maquinas) && [valor_dinheiro_esperado, valor_dinheiro_declarado, ...maquinas.flatMap((m) => [m.valor_esperado, m.valor_recebido])]
      .every((valor) => Number.isFinite(Number(valor)) && Number(valor) >= 0);
  }
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
