import { CadastroTemplate } from './CadastroTemplate.js';
import { Posto } from '../../domain/entities.js';
import { ErroHttp } from '../../lib/http.js';
import { EmpresaValidationStrategy, MaquinaValidationStrategy, OperadorValidationStrategy, PostoValidationStrategy } from '../strategy/EntityValidationStrategies.js';

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
       RETURNING maquina_id, empresa_id, nome, ativo, created_at,
         (SELECT posto_id FROM empresas WHERE empresa_id = $1) AS posto_id`,
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
       RETURNING operador_id, empresa_id, nome, ativo, created_at,
         (SELECT posto_id FROM empresas WHERE empresa_id = $1) AS posto_id`,
      [data.empresa_id, data.nome.trim()],
    );
  }
}

// Campos do posto na ordem das colunas usadas no INSERT e no UPDATE (o endereço completo é derivado).
export const camposPosto = ['nome', 'telefone', 'cep', 'logradouro', 'numero', 'bairro', 'cidade', 'uf', 'complemento'];
export const valoresPosto = (data) => [
  ...camposPosto.map((campo) => (typeof data[campo] === 'string' ? data[campo].trim() : data[campo]) || null),
  new Posto(data).enderecoCompleto(),
];

// Template Method 4: cadastro de posto (estabelecimento) com as empresas e os gerentes vinculados.
export class CadastroPosto extends CadastroTemplate {
  constructor() { super(new PostoValidationStrategy()); }
  async persist(client, data) {
    const result = await client.query(
      `INSERT INTO postos (${camposPosto.join(', ')}, endereco, plano)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE($11, 'basico'))
       RETURNING posto_id, nome, endereco, plano, ativo, created_at`,
      [...valoresPosto(data), data.plano || null],
    );
    await salvarEmpresas(client, result.rows[0].posto_id, data.empresas);
    await vincularGerentes(client, result.rows[0].posto_id, data.usuarios);
    return result;
  }
}

// Empresas com empresa_id são atualizadas; as demais são criadas. Usada no cadastro e na edição do posto.
export async function salvarEmpresas(client, postoId, empresas = []) {
  for (const empresa of empresas) {
    const valores = [empresa.nome.trim(), empresa.cnpj.trim(), empresa.tipo, empresa.inscricao_estadual?.trim() || null, postoId];
    if (!empresa.empresa_id) {
      await client.query('INSERT INTO empresas (nome, cnpj, tipo, inscricao_estadual, posto_id) VALUES ($1, $2, $3, $4, $5)', valores);
      continue;
    }
    const result = await client.query(
      'UPDATE empresas SET nome = $1, cnpj = $2, tipo = $3, inscricao_estadual = $4 WHERE posto_id = $5 AND empresa_id = $6',
      [...valores, empresa.empresa_id],
    );
    if (!result.rowCount) throw new ErroHttp(400, 'Empresa não pertence a este estabelecimento');
  }
}

export function vincularGerentes(client, postoId, usuarios = []) {
  return client.query(
    `INSERT INTO postos_usuarios (posto_id, usuario_id)
     SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING`,
    [postoId, usuarios],
  );
}
