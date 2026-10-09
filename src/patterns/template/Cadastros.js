import { CadastroTemplate } from './CadastroTemplate.js';
import { EmpresaValidationStrategy, MaquinaValidationStrategy, OperadorValidationStrategy } from '../strategy/EntityValidationStrategies.js';

// Template Method 1: cadastro de empresa.
export class CadastroEmpresa extends CadastroTemplate {
  constructor() { super(new EmpresaValidationStrategy()); }
  persist(client, data) {
    return client.query(
      `INSERT INTO empresas (posto_id, nome, cnpj, tipo)
       VALUES ($1, $2, $3, $4)
       RETURNING empresa_id, posto_id, nome, cnpj, tipo, created_at`,
      [data.posto_id, data.nome.trim(), data.cnpj.trim(), data.tipo],
    );
  }
}

// Template Method 2: cadastro de máquina.
export class CadastroMaquina extends CadastroTemplate {
  constructor() { super(new MaquinaValidationStrategy()); }
  persist(client, data) {
    return client.query(
      `INSERT INTO maquinas (empresa_id, nome) VALUES ($1, $2)
       RETURNING maquina_id, empresa_id, nome, ativo, created_at`,
      [data.empresa_id, data.nome.trim()],
    );
  }
}

// Template Method 3: cadastro de operador.
export class CadastroOperador extends CadastroTemplate {
  constructor() { super(new OperadorValidationStrategy()); }
  persist(client, data) {
    return client.query(
      `INSERT INTO operadores (empresa_id, nome) VALUES ($1, $2)
       RETURNING operador_id, empresa_id, nome, ativo, created_at`,
      [data.empresa_id, data.nome.trim()],
    );
  }
}
