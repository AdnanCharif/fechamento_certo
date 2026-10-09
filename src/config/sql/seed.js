import 'dotenv/config';
import bcrypt from 'bcrypt';
import pool from '../db.js';

const postos = [
  { nome: 'Meu Posto - Matriz', endereco: 'Av. das Torres, 1200, Curitiba/PR' },
  { nome: 'Posto Bela Vista', endereco: 'Rua Getúlio Vargas, 450, Curitiba/PR' },
  { nome: 'Posto Rodovia Sul', endereco: 'BR-116, Km 32, Curitiba/PR' },
];

const empresasPorPosto = [
  [
    { nome: 'Posto Max', cnpj: '12.345.678/0001-01', tipo: 'combustivel' },
    { nome: 'Dia a Dia', cnpj: '12.345.678/0002-02', tipo: 'conveniencia' },
  ],
  [
    { nome: 'Bela Vista Fuel', cnpj: '23.456.789/0001-03', tipo: 'combustivel' },
    { nome: 'Mercadinho BV', cnpj: '23.456.789/0002-04', tipo: 'conveniencia' },
  ],
  [
    { nome: 'Rodovia Combustíveis', cnpj: '34.567.890/0001-05', tipo: 'combustivel' },
    { nome: 'Parada Sul Conveniência', cnpj: '34.567.890/0002-06', tipo: 'conveniencia' },
  ],
];

const maquinasPorEmpresa = [
  ['Stone POS 1', 'Cielo Máq 1', 'Rede Máq 1', 'Stone POS 2', 'GetNet Máq 1'],
  ['Stone POS 3', 'Cielo Máq 2', 'Rede Máq 2', 'Vero Máq 1', 'GetNet Máq 2'],
  ['Stone POS 4', 'Cielo Máq 3', 'Rede Máq 3', 'PagSeguro Máq 1', 'GetNet Máq 3'],
  ['Stone POS 5', 'Cielo Máq 4', 'Rede Máq 4', 'Vero Máq 2', 'PagSeguro Máq 2'],
  ['Stone POS 6', 'Cielo Máq 5', 'Rede Máq 5', 'GetNet Máq 4', 'PagSeguro Máq 3'],
  ['Stone POS 7', 'Cielo Máq 6', 'Rede Máq 6', 'Vero Máq 3', 'GetNet Máq 5'],
];
const nomesOperadores = [
  'João Silva', 'Carlos Souza', 'Pedro Almeida', 'Lucas Ferreira', 'Rafael Costa',
  'Mariana Lima', 'Fernanda Rocha', 'Juliana Ribeiro', 'Camila Santos', 'Beatriz Martins',
  'Gabriel Oliveira', 'Thiago Pereira', 'Bruno Carvalho', 'Diego Nascimento', 'Felipe Barros',
  'Aline Cardoso', 'Patrícia Gomes', 'Larissa Teixeira', 'Vanessa Correia', 'Débora Araújo',
  'Marcos Vinícius', 'André Luiz', 'Rodrigo Alves', 'Eduardo Ramos', 'Gustavo Pinto',
  'Renata Moreira', 'Simone Dias', 'Tatiane Freitas', 'Priscila Nunes', 'Amanda Duarte',
];

const datasFechamentoDemo = ['2026-10-01', '2026-10-02', '2026-10-03'];

async function executarSeed() {
  const senha = process.env.SEED_MANAGER_PASSWORD;
  if (!senha || senha.length < 8) {
    throw new Error('Defina SEED_MANAGER_PASSWORD com pelo menos 8 caracteres antes de executar a seed.');
  }

  const email = process.env.SEED_MANAGER_EMAIL || 'gerente.demo@unecaixas.local';
  const nome = process.env.SEED_MANAGER_NAME || 'Gerente de Demonstração';
  const hashSenha = await bcrypt.hash(senha, 10);
  const client = await pool.connect();
  let etapa = 'iniciar transação';

  try {
    await client.query('BEGIN');
    const postoIds = [];

    for (const posto of postos) {
      etapa = `inserir/consultar posto ${posto.nome}`;
      const insert = await client.query(
        `INSERT INTO postos (nome, endereco)
         SELECT $1::varchar, $2::varchar
         WHERE NOT EXISTS (SELECT 1 FROM postos WHERE nome = $1::varchar)
         RETURNING posto_id`,
        [posto.nome, posto.endereco],
      );
      let postoId = insert.rows[0]?.posto_id;
      if (!postoId) {
        const existing = await client.query('SELECT posto_id FROM postos WHERE nome = $1 ORDER BY posto_id LIMIT 1', [posto.nome]);
        postoId = existing.rows[0]?.posto_id;
      }
      if (!postoId) throw new Error(`Não foi possível obter o posto: ${posto.nome}`);
      postoIds.push(postoId);
    }

    etapa = 'criar usuário gerente';
    const managerResult = await client.query(
      `INSERT INTO usuarios (nome, email, senha, ativo)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (email) DO UPDATE SET nome = EXCLUDED.nome, senha = EXCLUDED.senha, ativo = true
       RETURNING usuario_id`,
      [nome, email, hashSenha],
    );
    const usuarioId = managerResult.rows[0].usuario_id;

    for (const postoId of postoIds) {
      etapa = `vincular gerente ao posto ${postoId}`;
      await client.query(
        `INSERT INTO postos_usuarios (posto_id, usuario_id) VALUES ($1::integer, $2::integer)
         ON CONFLICT (posto_id, usuario_id) DO NOTHING`,
        [postoId, usuarioId],
      );
    }

    let empresaIndex = 0;
    for (let postoIndex = 0; postoIndex < postos.length; postoIndex += 1) {
      for (const empresa of empresasPorPosto[postoIndex]) {
        etapa = `inserir/consultar empresa ${empresa.nome}`;
        const empresaResult = await client.query(
          `INSERT INTO empresas (posto_id, nome, cnpj, tipo)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (cnpj) DO UPDATE SET posto_id = EXCLUDED.posto_id, nome = EXCLUDED.nome, tipo = EXCLUDED.tipo
           RETURNING empresa_id`,
          [postoIds[postoIndex], empresa.nome, empresa.cnpj, empresa.tipo],
        );
        const empresaId = empresaResult.rows[0].empresa_id;

        for (const nomeMaquina of maquinasPorEmpresa[empresaIndex]) {
          etapa = `inserir/consultar máquina ${nomeMaquina}`;
          await client.query(
            `INSERT INTO maquinas (empresa_id, nome)
             SELECT $1::integer, $2::varchar
             WHERE NOT EXISTS (SELECT 1 FROM maquinas WHERE empresa_id = $1::integer AND nome = $2::varchar)`,
            [empresaId, nomeMaquina],
          );
        }

        for (const nomeOperador of nomesOperadores.slice(empresaIndex * 5, empresaIndex * 5 + 5)) {
          etapa = `inserir/consultar operador ${nomeOperador}`;
          await client.query(
            `INSERT INTO operadores (empresa_id, nome)
             SELECT $1::integer, $2::varchar
             WHERE NOT EXISTS (SELECT 1 FROM operadores WHERE empresa_id = $1::integer AND nome = $2::varchar)`,
            [empresaId, nomeOperador],
          );
        }
        empresaIndex += 1;
      }
    }

    // Exemplos para as tabelas operacionais do fechamento. Datas fixas e a
    // chave UNIQUE (posto_id, data_referencia) tornam esta parte idempotente.
    for (let postoIndex = 0; postoIndex < postoIds.length; postoIndex += 1) {
      const postoId = postoIds[postoIndex];
      const empresasResult = await client.query(
        'SELECT empresa_id, nome, tipo FROM empresas WHERE posto_id = $1 ORDER BY empresa_id',
        [postoId],
      );

      for (let diaIndex = 0; diaIndex < datasFechamentoDemo.length; diaIndex += 1) {
        const dataReferencia = datasFechamentoDemo[diaIndex];
        const dinheiroEsperado = 1200 + postoIndex * 100;
        const dinheiroDeclarado = diaIndex === 1 ? dinheiroEsperado - 150 : dinheiroEsperado;
        const status = diaIndex === 1 ? 'com_divergencia' : 'ok';
        etapa = `criar fechamento de demonstração do posto ${postoId} em ${dataReferencia}`;
        const fechamentoInsert = await client.query(
          `INSERT INTO fechamentos
             (posto_id, usuario_id, data_referencia, valor_dinheiro_declarado, valor_dinheiro_esperado, status)
           VALUES ($1::integer, $2::integer, $3::date, $4::numeric, $5::numeric, $6::varchar)
           ON CONFLICT (posto_id, data_referencia) DO NOTHING
           RETURNING fechamento_id`,
          [postoId, usuarioId, dataReferencia, dinheiroDeclarado, dinheiroEsperado, status],
        );

        // Não altera fechamento que já existia antes da seed.
        if (!fechamentoInsert.rowCount) continue;
        const fechamentoId = fechamentoInsert.rows[0].fechamento_id;
        const totaisEmpresa = new Map();

        for (let empresaIndexLocal = 0; empresaIndexLocal < empresasResult.rows.length; empresaIndexLocal += 1) {
          const empresa = empresasResult.rows[empresaIndexLocal];
          const maquinasResult = await client.query(
            `SELECT m.maquina_id, o.operador_id
             FROM maquinas m
             LEFT JOIN LATERAL (
               SELECT operador_id FROM operadores
               WHERE empresa_id = m.empresa_id AND ativo = true
               ORDER BY operador_id LIMIT 1
             ) o ON true
             WHERE m.empresa_id = $1 AND m.ativo = true
             ORDER BY m.maquina_id`,
            [empresa.empresa_id],
          );

          let totalEsperado = 0;
          let totalRecebido = 0;
          for (let maquinaIndex = 0; maquinaIndex < maquinasResult.rows.length; maquinaIndex += 1) {
            const maquina = maquinasResult.rows[maquinaIndex];
            const valorEsperado = 900 + empresaIndexLocal * 300 + maquinaIndex * 125;
            let valorRecebido = valorEsperado;
            if (diaIndex === 1 && empresaIndexLocal === 1 && maquinaIndex === 1) valorRecebido -= 250;
            if (diaIndex === 1 && empresaIndexLocal === 0 && maquinaIndex === 3) valorRecebido += 80;

            etapa = `registrar máquina ${maquina.maquina_id} no fechamento ${fechamentoId}`;
            const detalheResult = await client.query(
              `INSERT INTO fechamento_maquinas
                 (fechamento_id, maquina_id, operador_id, turno, valor_esperado, valor_recebido)
               VALUES ($1::integer, $2::integer, $3::integer, $4::varchar, $5::numeric, $6::numeric)
               RETURNING fechamento_maquina_id, diferenca`,
              [fechamentoId, maquina.maquina_id, maquina.operador_id, maquinaIndex % 2 === 0 ? 'manha' : 'tarde', valorEsperado, valorRecebido],
            );
            const detalhe = detalheResult.rows[0];
            totalEsperado += valorEsperado;
            totalRecebido += valorRecebido;

            if (Number(detalhe.diferenca) !== 0) {
              etapa = `registrar divergência da máquina ${maquina.maquina_id}`;
              const divergenciaResult = await client.query(
                `INSERT INTO divergencias
                   (fechamento_id, fechamento_maquina_id, operador_id, valor_diferenca, status)
                 VALUES ($1::integer, $2::integer, $3::integer, $4::numeric, 'investigada')
                 RETURNING divergencia_id`,
                [fechamentoId, detalhe.fechamento_maquina_id, maquina.operador_id, detalhe.diferenca],
              );
              await client.query(
                `INSERT INTO observacoes (fechamento_id, divergencia_id, usuario_id, texto)
                 VALUES ($1::integer, $2::integer, $3::integer, $4::text)`,
                [fechamentoId, divergenciaResult.rows[0].divergencia_id, usuarioId, 'Divergência de demonstração identificada na conferência da máquina.'],
              );
            }
          }

          totaisEmpresa.set(empresa.empresa_id, { esperado: totalEsperado, recebido: totalRecebido });
          await client.query(
            `INSERT INTO fechamento_empresa (fechamento_id, empresa_id, valor_esperado, valor_recebido)
             VALUES ($1::integer, $2::integer, $3::numeric, $4::numeric)
             ON CONFLICT (fechamento_id, empresa_id) DO NOTHING`,
            [fechamentoId, empresa.empresa_id, totalEsperado, totalRecebido],
          );
        }

        const diferencaDinheiro = dinheiroDeclarado - dinheiroEsperado;
        if (diferencaDinheiro !== 0) {
          etapa = `registrar divergência de dinheiro do fechamento ${fechamentoId}`;
          const divergenciaResult = await client.query(
            `INSERT INTO divergencias (fechamento_id, valor_diferenca, status)
             VALUES ($1::integer, $2::numeric, 'investigada')
             RETURNING divergencia_id`,
            [fechamentoId, diferencaDinheiro],
          );
          await client.query(
            `INSERT INTO observacoes (fechamento_id, divergencia_id, usuario_id, texto)
             VALUES ($1::integer, $2::integer, $3::integer, $4::text)`,
            [fechamentoId, divergenciaResult.rows[0].divergencia_id, usuarioId, 'Diferença de demonstração encontrada na contagem do dinheiro em caixa.'],
          );
        }

        await client.query(
          `INSERT INTO observacoes (fechamento_id, usuario_id, texto)
           VALUES ($1::integer, $2::integer, $3::text)`,
          [fechamentoId, usuarioId, `Fechamento de demonstração do posto ${postoId}.`],
        );
        await client.query(
          `INSERT INTO logs_auditoria (fechamento_id, usuario_id, acao, campo_alterado, valor_anterior, valor_novo)
           VALUES ($1::integer, $2::integer, $3::varchar, $4::varchar, $5::varchar, $6::varchar)`,
          [fechamentoId, usuarioId, 'Criação do fechamento de demonstração', 'status', 'em_analise', status],
        );
      }
    }

    await client.query('COMMIT');
    console.log('Seed concluída. Dados-base e fechamentos de demonstração inseridos sem duplicar datas existentes.');
    console.log(`Usuário de acesso: ${email}`);
    console.log('A senha usada foi lida de SEED_MANAGER_PASSWORD e não é exibida.');
  } catch (error) {
    await client.query('ROLLBACK');
    throw new Error(`${etapa}: ${error.message}`, { cause: error });
  } finally {
    client.release();
  }
}

try {
  await executarSeed();
} catch (error) {
  console.error(`Seed não executada: ${error.message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}
