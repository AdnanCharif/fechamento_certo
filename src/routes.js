import express from 'express';
import bcrypt from 'bcrypt';
import { JwtTokenService } from './patterns/singleton/JwtTokenService.js';
import { CadastroEmpresa, CadastroMaquina, CadastroOperador } from './patterns/template/Cadastros.js';
import { productVariability } from './config/productVariability.js';

const router = express.Router();
const tokenService = JwtTokenService.getInstance();
const cadastroEmpresa = new CadastroEmpresa();
const cadastroMaquina = new CadastroMaquina();
const cadastroOperador = new CadastroOperador();

function autenticar(req, res, next) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token de acesso obrigatório' });
  try {
    req.usuarioAutenticado = tokenService.verify(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' });
  }
}

function featureGestaoOperadores(req, res, next) {
    if (productVariability.operatorManagement) return next();
    return res.status(404).json({ error: 'A gestão de operadores está desativada nesta versão' });
}

router.get('/', (req, res) => {
  res.send('API rodando');
});

router.get('/config/variabilidade', (req, res) => {
    res.json(productVariability.toJSON());
});

//Login

router.post('/auth/login', async (req,res) => {
  const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    const pool = req.app.get('db');

    try {
        const sql = `
            SELECT usuario_id, nome, email, senha, ativo
            FROM usuarios
            WHERE email = $1;
        `;
        const result = await pool.query(sql, [email]);

        // Usuário não encontrado
        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        const usuario = result.rows[0];

        // Usuário existe mas foi desativado (soft delete)
        if (!usuario.ativo) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        // Compara a senha enviada com o hash guardado no banco
        const senhaConfere = await bcrypt.compare(senha, usuario.senha);

        if (!senhaConfere) {
            return res.status(401).json({ error: 'Email ou senha inválidos' });
        }

        // Gera o token de sessão
        const token = tokenService.sign({ usuario_id: usuario.usuario_id, nome: usuario.nome, email: usuario.email });

        res.json({
            token,
            usuario: {
                usuario_id: usuario.usuario_id,
                nome: usuario.nome,
                email: usuario.email
            }
        });
    } catch (err) {
        console.error('Erro ao fazer login:', err);
        res.status(500).json({ error: 'Erro ao fazer login' });
    }
});

router.post('/auth/logout', (req,res) => {
    res.json({ message: 'Sessão encerrada. Remova o token armazenado no cliente.' });
});

// As rotas de dados exigem um JWT emitido pelo endpoint de login.
router.use(autenticar);
router.use('/operadores', featureGestaoOperadores);

//Postos

router.get('/postos/:usuarioid', (req,res) => {
    let usuarioId = req.params.usuarioid;
    const sql = `select p.posto_id as posto_id, p.nome as nome_posto, u.nome as nome_usuario
                  from postos_usuarios pu
                  inner join postos p
                  on pu.posto_id = p.posto_id
                  inner join usuarios u
                  on pu.usuario_id = u.usuario_id
                  where u.usuario_id = $1;`;
   const values = [usuarioId];
   
   const pool = req.app.get('db');
   pool.query(sql, values)
       .then(result => {
           res.json(result.rows);
       })
       .catch(err => {
           console.error('Erro ao buscar postos do usuário:', err);
           res.status(500).json({ error: 'Erro ao buscar postos do usuário' });
       });            
}); 

//Usuários

router.get('/postos/:id/usuarios', (req, res) => {
  let postoId = req.params.id;
  const sql = `select u.usuario_id, u.nome, u.email, u.created_at
              from postos_usuarios pu
              inner join postos p
              on pu.posto_id = p.posto_id
              inner join usuarios u
              on pu.usuario_id = u.usuario_id
              where p.posto_id = $1;`;
  const values = [postoId];

  const pool = req.app.get('db');
  pool.query(sql, values)
      .then(result => {
          res.json(result.rows);
      })
      .catch(err => {
          console.error('Erro ao buscar usuários do posto:', err);
          res.status(500).json({ error: 'Erro ao buscar usuários do posto' });
      });

});

router.post('/postos/:id/usuarios', async (req, res) => {
  const postoId = req.params.id;
  const { nome, email, senha } = req.body;

  const pool = req.app.get('db');
  const client = await pool.connect();

  try {
      const senhaHash = await bcrypt.hash(senha, 10);

      await client.query('BEGIN');

      // 1. Cria o usuário e já pega o id gerado com RETURNING
      const insertUsuario = `
          INSERT INTO usuarios (nome, email, senha)
          VALUES ($1, $2, $3)
          RETURNING usuario_id;
      `;
      const usuarioResult = await client.query(insertUsuario, [nome, email, senhaHash]);
      const usuarioId = usuarioResult.rows[0].usuario_id;

      // 2. Vincula esse usuário ao posto na tabela associativa
      const insertVinculo = `
          INSERT INTO postos_usuarios (posto_id, usuario_id)
          VALUES ($1, $2);
      `;
      await client.query(insertVinculo, [postoId, usuarioId]);

      await client.query('COMMIT');

      res.status(201).json({ usuario_id: usuarioId, posto_id: postoId });
  } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao adicionar usuário ao posto:', err);
      res.status(500).json({ error: 'Erro ao adicionar usuário ao posto' });
  } finally {
      client.release();
  }
});

router.delete('/postos/:id/usuarios/:usuarioId', async (req, res) => {
  const postoId = req.params.id;
  const usuarioId = req.params.usuarioId;

  const pool = req.app.get('db');
  const client = await pool.connect();

  try {
      await client.query('BEGIN');

      // 1. Remove o vínculo entre o usuário e esse posto
      const deleteVinculo = `
          DELETE FROM postos_usuarios
          WHERE posto_id = $1 AND usuario_id = $2;
      `;
      await client.query(deleteVinculo, [postoId, usuarioId]);

      // 2. Verifica se o usuário ainda está vinculado a algum outro posto
      const checkVinculos = `
          SELECT COUNT(*) AS total
          FROM postos_usuarios
          WHERE usuario_id = $1;
      `;
      const checkResult = await client.query(checkVinculos, [usuarioId]);
      const totalVinculos = parseInt(checkResult.rows[0].total, 10);

      // 3. Se não sobrou nenhum vínculo, inativa o usuário
      if (totalVinculos === 0) {
          await client.query(
              `UPDATE usuarios SET ativo = false WHERE usuario_id = $1;`,
              [usuarioId]
          );
      }

      await client.query('COMMIT');

      res.json({
          message: 'Usuário removido do posto com sucesso',
          usuario_inativado: totalVinculos === 0
      });
  } catch (err) {
      await client.query('ROLLBACK');
      console.error('Erro ao remover usuário do posto:', err);
      res.status(500).json({ error: 'Erro ao remover usuário do posto' });
  } finally {
      client.release();
  }
});

router.get('/usuarios/:id', (req, res) => {
    let userId = req.params.id;
    const sql = `SELECT usuario_id, nome, email, created_at
                 FROM usuarios
                 WHERE usuario_id = $1;`;
    const values = [userId];

    const pool = req.app.get('db');
    pool.query(sql, values)
        .then(result => {
            if (!result.rows[0]) return res.status(404).json({ error: 'Usuário não encontrado' });
            res.json(result.rows[0]);
        })
        .catch(err => {
            console.error('Erro ao buscar usuário:', err);
            res.status(500).json({ error: 'Erro ao buscar usuário' });
        });
});

router.put('/usuarios/:id', async (req, res) => {
    const userId = req.params.id;
    const { nome, email, senha } = req.body;
    if (!nome?.trim() || !email?.trim()) return res.status(400).json({ error: 'Nome e email são obrigatórios' });

    const pool = req.app.get('db');
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        // Atualiza nome e email
        const updateUsuario = `
            UPDATE usuarios
            SET nome = $1, email = $2
            WHERE usuario_id = $3;
        `;
        await client.query(updateUsuario, [nome, email, userId]);
        
        // Se a senha foi fornecida, atualiza também
        if (senha) {
            const senhaHash = await bcrypt.hash(senha, 10);
            const updateSenha = `
                UPDATE usuarios
                SET senha = $1
                WHERE usuario_id = $2;
            `;
            await client.query(updateSenha, [senhaHash, userId]);
        }

        await client.query('COMMIT');

        res.json({
            message: 'Usuário editado com sucesso',
        });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erro ao editar usuário:', err);
        res.status(500).json({ error: 'Erro ao editar usuário' });
    } finally {
        client.release();
    }
});

router.patch('/usuarios/:id', async (req, res) => {
    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') return res.status(400).json({ error: 'Informe ativo como booleano' });
    try {
        const result = await req.app.get('db').query(
            'UPDATE usuarios SET ativo = $1 WHERE usuario_id = $2 RETURNING usuario_id, nome, email, ativo',
            [ativo, req.params.id],
        );
        if (!result.rowCount) return res.status(404).json({ error: 'Usuário não encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao alterar status do usuário:', err);
        res.status(500).json({ error: 'Erro ao alterar status do usuário' });
    }
});


//Empresas

router.get('/postos/empresas/:posto_id', async (req, res) => {
    const postoId = req.params.posto_id;
    let sql = `select e.empresa_id, e.nome, e.cnpj, e.tipo, e.created_at
                from postos p
                inner join empresas e
                on p.posto_id = e.posto_id
                where p.posto_id = $1`;
    let values = [postoId];

    const pool = req.app.get('db');
    try {
        const result = await pool.query(sql, values);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao buscar empresas do posto:', err);
        res.status(500).json({ error: 'Erro ao buscar empresas do posto' });
    }
});

router.put('/empresas/:id', async (req, res) => {
    const empresaId = req.params.id;
    const { nome, cnpj, tipo } = req.body;
    
    const pool = req.app.get('db');
    const sql = `
        UPDATE empresas
        SET nome = $1, cnpj = $2, tipo = $3
        WHERE empresa_id = $4;
    `;
    const values = [nome, cnpj, tipo, empresaId];
    try {
        await pool.query(sql, values);
        res.json({ message: 'Empresa editada com sucesso' });
    } catch (err) {
        console.error('Erro ao editar empresa:', err);
        res.status(500).json({ error: 'Erro ao editar empresa' });
    }
});

router.post('/empresas', async (req, res) => {
    try {
        const result = await cadastroEmpresa.execute(req.app.get('db'), req.body);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Erro ao cadastrar empresa' });
    }
});

router.delete('/empresas/:id', async (req, res) => {
    try {
        const result = await req.app.get('db').query('DELETE FROM empresas WHERE empresa_id = $1 RETURNING empresa_id', [req.params.id]);
        if (!result.rowCount) return res.status(404).json({ error: 'Empresa não encontrada' });
        res.json({ message: 'Empresa removida com sucesso' });
    } catch (err) {
        console.error('Erro ao remover empresa:', err);
        res.status(500).json({ error: 'Não foi possível remover a empresa; confira se ela possui máquinas ou operadores vinculados' });
    }
});


//Máquinas

router.get('/postos/:id/maquinas', async (req, res) => {
    const postoId = req.params.id;

    let sql = `select m.maquina_id, m.empresa_id, m.nome as nome_maquina, e.nome as nome_empresa, m.ativo, m.created_at
    from empresas e 
    inner join maquinas m
    on e.empresa_id = m.empresa_id
    inner join postos p
    on e.posto_id = p.posto_id
    where p.posto_id = $1;`;

    let values = [postoId];

    const pool = req.app.get('db');

    try {
        const result = await pool.query(sql, values);
        res.json(result.rows);
    }catch(err){
        console.error('Erro ao buscar empresas do posto:', err);
        res.status(500).json({ error: 'Erro ao buscar empresas do posto' });
    }
});

router.post('/maquinas', async (req, res) => {
    try {
        const result = await cadastroMaquina.execute(req.app.get('db'), req.body);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Erro ao cadastrar máquina' });
    }
});

router.get('/maquinas/:id', async (req, res) => {
    const maquinaId = req.params.id

    let sql = `select m.maquina_id, m.empresa_id, m.nome as nome_maquina, e.nome as nome_empresa, m.ativo, m.created_at
                from empresas e
                inner join maquinas m
                on m.empresa_id = e.empresa_id
                where m.maquina_id = $1`;
    
    let values = [maquinaId];

    const pool = req.app.get('db');

    try {
        const result = await pool.query(sql, values);
        res.json(result.rows);
    }catch(err) {
        console.error('Erro ao listar máquina:', err);
        res.status(500).json({ error: 'Erro ao listar máquina'});
    };
});

router.put('/maquinas/:id', async (req, res) => {
    const { empresa_id, nome, ativo } = req.body;
    if (!empresa_id || !nome?.trim() || typeof ativo !== 'boolean') {
        return res.status(400).json({ error: 'Empresa, nome e status válido são obrigatórios' });
    }

    let sql = `update maquinas set 
    empresa_id = $2, 
    nome = $3, 
    ativo = $4 
    where maquina_id = $1`;

    let values = [req.params.id, empresa_id, nome, ativo];

    const pool = req.app.get('db');

    try {
        const result = await pool.query(`${sql} RETURNING maquina_id`, values);
        if (!result.rowCount) return res.status(404).json({ error: 'Máquina não encontrada' });
        res.json({"message": "Máquina alterada com sucesso"});
    }catch(err) {
        console.error('Erro ao editar maquina:',err);
        res.status(500).json({error: 'Erro ao editar maquina'});
    };
});

router.delete('/maquinas/:id', async (req, res) => {
    const maquinaId = req.params.id;

    let sql = `update maquinas set ativo = false where maquina_id = $1 RETURNING maquina_id`;

    let values = [maquinaId];

    const pool = req.app.get('db');

    try{
        const result = await pool.query(sql, values);
        if (!result.rowCount) return res.status(404).json({ error: 'Máquina não encontrada' });
        res.json({"message": "Maquina excluida com sucesso"});
    }catch(err){
        console.error("Erro ao excluir a maquina:",err);
        res.status(500).json({error: 'Erro ao excluir a maquina'});
    };
});

router.patch('/maquinas/:id', async (req, res) => {
    const maquinaId = req.params.id;
    const { ativo } = req.body;
    if (typeof ativo !== 'boolean') return res.status(400).json({ error: 'Informe ativo como booleano' });

    const sql = `UPDATE maquinas SET ativo = $1 WHERE maquina_id = $2`;
    const values = [ativo, maquinaId];

    const pool = req.app.get('db');

    try {
        const result = await pool.query(`${sql} RETURNING maquina_id, ativo`, values);
        if (!result.rowCount) return res.status(404).json({ error: 'Máquina não encontrada' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao atualizar status da máquina:', err);
        res.status(500).json({ error: 'Erro ao atualizar status da máquina' });
    }
});


//Operadores
router.get('/operadores/posto/:id', async (req, res) => {
    const postoId = req.params.id;

    let sql = `select o.operador_id, o.empresa_id, o.nome as nome_operador, e.nome as nome_empresa, o.ativo, o.created_at
                from empresas e
                inner join operadores o
                on e.empresa_id = o.empresa_id
                inner join postos p
                on p.posto_id = e.posto_id
                where p.posto_id = $1;`;

    let values = [postoId];

    const pool = req.app.get('db');

    try {
        const result = await pool.query(sql, values);
        res.json(result.rows);
    }catch(err) {
        console.error('Erro ao listar operadores do posto:', err);
        res.status(500).json({ error: 'Erro ao listar operadores do posto'});
    };
});

router.post('/operadores', async (req,res) => {
    try {
        const result = await cadastroOperador.execute(req.app.get('db'), req.body);
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Erro ao cadastrar operador' });
    }
});

router.get('/operadores/nome', async (req, res) => {
    const { nome } = req.query;
    
    let sql = `select * from operadores where nome = $1`;

    let values = [nome];

    const pool = req.app.get('db');

    try{ 
        const result = await pool.query(sql, values);
        res.json(result.rows);
    } catch(err) {
        console.error('Erro ao buscar operador', err);
        res.status(500).json({error: 'Erro ao buscar operador'});
    };
});

router.put('/operadores/:id', async (req, res) => {
    const operadorId = req.params.id;
    const {empresa_id, nome} = req.body;
    if (!empresa_id || !nome?.trim()) return res.status(400).json({ error: 'Empresa e nome são obrigatórios' });
    
    let sql = `update operadores set 
                empresa_id = $1, 
                nome = $2 
                where operador_id = $3`;

    let values = [empresa_id, nome, operadorId];

    const pool = await req.app.get('db');
    try{
        await pool.query(sql, values);
        res.json({message: 'Operador editado com sucesso'});
    } catch(err) {
        console.error('Erro ao editar operador', err);
        res.status(500).json({error:'Erro ao editar operador'});
    };
});

router.delete('/operadores/:id', async (req, res) => {
    try {
        const result = await req.app.get('db').query(
            'UPDATE operadores SET ativo = false WHERE operador_id = $1 RETURNING operador_id, nome, ativo',
            [req.params.id],
        );
        if (!result.rowCount) return res.status(404).json({ error: 'Operador não encontrado' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error('Erro ao inativar operador:', err);
        res.status(500).json({ error: 'Erro ao inativar operador' });
    }
});

//desativar operador
router.patch('/operadores/:id', async (req, res) => {
    const operadorId = req.params.id;
    const { ativo }  = req.body;
    if (typeof ativo !== 'boolean') return res.status(400).json({ error: 'Informe ativo como booleano' });

    let sql = `update operadores set ativo = $1 where operador_id = $2`;

    let values = [ativo, operadorId];

    const pool = await req.app.get('db');
    try{
        const result = await pool.query(`${sql} RETURNING operador_id, ativo`, values);
        if (!result.rowCount) return res.status(404).json({ error: 'Operador não encontrado' });
        res.json(result.rows[0]);
    } catch(err) {
        console.error('Erro ao mudar o status operador', err);
        res.status(500).json({error:'Erro ao mudar o status do operador'})
    }
})

// Fechamentos
async function validarAcessoPosto(req, res, next) {
    const postoId = req.params.postoId || req.body.posto_id;
    try {
        const result = await req.app.get('db').query(
            'SELECT 1 FROM postos_usuarios WHERE posto_id = $1 AND usuario_id = $2',
            [postoId, req.usuarioAutenticado.usuario_id],
        );
        if (!result.rowCount) return res.status(403).json({ error: 'Usuário sem acesso a este posto' });
        next();
    } catch (err) {
        console.error('Erro ao validar acesso ao posto:', err);
        res.status(500).json({ error: 'Erro ao validar acesso ao posto' });
    }
}

router.get('/postos/:postoId/fechamentos/dashboard', validarAcessoPosto, async (req, res) => {
    const pool = req.app.get('db');
    try {
        const [summary, daily, recent] = await Promise.all([
            pool.query(`SELECT COUNT(DISTINCT f.fechamento_id)::int AS quantidade,
                COALESCE(SUM(CASE WHEN e.tipo = 'combustivel' THEN fe.diferenca ELSE 0 END), 0) AS posto,
                COALESCE(SUM(CASE WHEN e.tipo = 'conveniencia' THEN fe.diferenca ELSE 0 END), 0) AS loja
                FROM fechamentos f LEFT JOIN fechamento_empresa fe USING (fechamento_id)
                LEFT JOIN empresas e USING (empresa_id)
                WHERE f.posto_id = $1 AND date_trunc('month', f.data_referencia) = date_trunc('month', CURRENT_DATE)`, [req.params.postoId]),
            pool.query(`SELECT f.data_referencia::text AS data,
                COALESCE((SELECT SUM(fe.diferenca) FROM fechamento_empresa fe WHERE fe.fechamento_id = f.fechamento_id), 0)
                + COALESCE(f.valor_dinheiro_declarado - f.valor_dinheiro_esperado, 0) AS diferenca
                FROM fechamentos f
                WHERE f.posto_id = $1 AND date_trunc('month', f.data_referencia) = date_trunc('month', CURRENT_DATE)
                ORDER BY f.data_referencia`, [req.params.postoId]),
            pool.query(`SELECT f.fechamento_id, f.data_referencia::text AS data, f.status,
                COALESCE(SUM(fe.valor_recebido), 0) AS total_cartoes
                FROM fechamentos f LEFT JOIN fechamento_empresa fe USING (fechamento_id)
                WHERE f.posto_id = $1 GROUP BY f.fechamento_id ORDER BY f.data_referencia DESC LIMIT 5`, [req.params.postoId]),
        ]);
        res.json({ totals: summary.rows[0], daily: daily.rows, recent: recent.rows });
    } catch (err) {
        console.error('Erro ao carregar dashboard de fechamentos:', err);
        res.status(500).json({ error: 'Erro ao carregar dashboard' });
    }
});

router.get('/postos/:postoId/fechamentos', validarAcessoPosto, async (req, res) => {
    const { from, to, status } = req.query;
    try {
        const result = await req.app.get('db').query(`SELECT f.fechamento_id, f.data_referencia::text AS data,
            f.status, f.valor_dinheiro_declarado AS dinheiro_declarado, f.valor_dinheiro_esperado AS dinheiro_esperado,
            COALESCE(SUM(fe.valor_esperado), 0) AS total_esperado,
            COALESCE(SUM(fe.valor_recebido), 0) AS total_cartoes,
            COALESCE(SUM(CASE WHEN e.tipo = 'combustivel' THEN fe.diferenca ELSE 0 END), 0) AS posto,
            COALESCE(SUM(CASE WHEN e.tipo = 'conveniencia' THEN fe.diferenca ELSE 0 END), 0) AS loja
            FROM fechamentos f LEFT JOIN fechamento_empresa fe USING (fechamento_id)
            LEFT JOIN empresas e USING (empresa_id)
            WHERE f.posto_id = $1 AND ($2::date IS NULL OR f.data_referencia >= $2::date)
              AND ($3::date IS NULL OR f.data_referencia <= $3::date)
              AND ($4::varchar IS NULL OR f.status = $4::varchar)
            GROUP BY f.fechamento_id ORDER BY f.data_referencia DESC`,
        [req.params.postoId, from || null, to || null, status && status !== 'Todos' ? status : null]);
        res.json(result.rows);
    } catch (err) {
        console.error('Erro ao listar fechamentos:', err);
        res.status(500).json({ error: 'Erro ao listar fechamentos' });
    }
});

router.post('/postos/:postoId/fechamentos', validarAcessoPosto, async (req, res) => {
    const { data_referencia, valor_dinheiro_esperado, valor_dinheiro_declarado, maquinas } = req.body;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data_referencia || '') || !Array.isArray(maquinas)
        || ![valor_dinheiro_esperado, valor_dinheiro_declarado, ...maquinas.flatMap((m) => [m.valor_esperado, m.valor_recebido])]
            .every((value) => Number.isFinite(Number(value)) && Number(value) >= 0)) {
        return res.status(400).json({ error: 'Informe data, valores não negativos e lançamentos de máquinas válidos' });
    }
    const client = await req.app.get('db').connect();
    try {
        await client.query('BEGIN');
        const fechamento = await client.query(`INSERT INTO fechamentos
            (posto_id, usuario_id, data_referencia, valor_dinheiro_esperado, valor_dinheiro_declarado, status)
            VALUES ($1, $2, $3::date, $4, $5, 'em_analise') RETURNING fechamento_id`,
        [req.params.postoId, req.usuarioAutenticado.usuario_id, data_referencia, valor_dinheiro_esperado, valor_dinheiro_declarado]);
        const fechamentoId = fechamento.rows[0].fechamento_id;
        const totals = new Map();
        for (const item of maquinas) {
            const machine = await client.query(`SELECT m.maquina_id, m.empresa_id FROM maquinas m
                JOIN empresas e USING (empresa_id) WHERE m.maquina_id = $1 AND e.posto_id = $2 AND m.ativo`,
            [item.maquina_id, req.params.postoId]);
            if (!machine.rowCount) throw Object.assign(new Error('Uma máquina não pertence a este posto ou está inativa'), { status: 400 });
            if (item.operador_id) {
                const operator = await client.query('SELECT 1 FROM operadores WHERE operador_id = $1 AND empresa_id = $2 AND ativo', [item.operador_id, machine.rows[0].empresa_id]);
                if (!operator.rowCount) throw Object.assign(new Error('Operador inválido para a empresa da máquina'), { status: 400 });
            }
            const detail = await client.query(`INSERT INTO fechamento_maquinas
                (fechamento_id, maquina_id, operador_id, turno, valor_esperado, valor_recebido)
                VALUES ($1, $2, $3, $4, $5, $6) RETURNING fechamento_maquina_id, diferenca`,
            [fechamentoId, item.maquina_id, item.operador_id || null, item.turno || null, item.valor_esperado, item.valor_recebido]);
            const companyId = machine.rows[0].empresa_id;
            const current = totals.get(companyId) || { esperado: 0, recebido: 0 };
            current.esperado += Number(item.valor_esperado); current.recebido += Number(item.valor_recebido); totals.set(companyId, current);
            const difference = Number(detail.rows[0].diferenca);
            if (difference !== 0) {
                const div = await client.query(`INSERT INTO divergencias (fechamento_id, fechamento_maquina_id, operador_id, valor_diferenca)
                    VALUES ($1, $2, $3, $4) RETURNING divergencia_id`, [fechamentoId, detail.rows[0].fechamento_maquina_id, item.operador_id || null, difference]);
                if (item.observacao?.trim()) await client.query('INSERT INTO observacoes (fechamento_id, divergencia_id, usuario_id, texto) VALUES ($1, $2, $3, $4)', [fechamentoId, div.rows[0].divergencia_id, req.usuarioAutenticado.usuario_id, item.observacao.trim()]);
            }
        }
        for (const [empresaId, total] of totals) await client.query(`INSERT INTO fechamento_empresa (fechamento_id, empresa_id, valor_esperado, valor_recebido) VALUES ($1, $2, $3, $4)`, [fechamentoId, empresaId, total.esperado, total.recebido]);
        const cashDiff = Number(valor_dinheiro_declarado) - Number(valor_dinheiro_esperado);
        if (cashDiff !== 0) await client.query('INSERT INTO divergencias (fechamento_id, valor_diferenca) VALUES ($1, $2)', [fechamentoId, cashDiff]);
        const status = cashDiff !== 0 || [...totals.values()].some((t) => t.esperado !== t.recebido) ? 'com_divergencia' : 'ok';
        await client.query('UPDATE fechamentos SET status = $1, updated_at = now() WHERE fechamento_id = $2', [status, fechamentoId]);
        await client.query('INSERT INTO logs_auditoria (fechamento_id, usuario_id, acao, campo_alterado, valor_novo) VALUES ($1, $2, $3, $4, $5)', [fechamentoId, req.usuarioAutenticado.usuario_id, 'Criação de fechamento', 'status', status]);
        await client.query('COMMIT');
        res.status(201).json({ fechamento_id: fechamentoId, status });
    } catch (err) {
        await client.query('ROLLBACK');
        if (err.code === '23505') return res.status(409).json({ error: 'Já existe um fechamento para este posto e data' });
        console.error('Erro ao salvar fechamento:', err);
        res.status(err.status || 500).json({ error: err.status ? err.message : 'Erro ao salvar fechamento' });
    } finally { client.release(); }
});

router.get('/postos/:postoId/fechamentos/:fechamentoId', validarAcessoPosto, async (req, res) => {
    try {
        const pool = req.app.get('db');
        const header = await pool.query(`SELECT f.*, u.nome AS usuario_nome FROM fechamentos f JOIN usuarios u USING (usuario_id)
            WHERE f.fechamento_id = $1 AND f.posto_id = $2`, [req.params.fechamentoId, req.params.postoId]);
        if (!header.rowCount) return res.status(404).json({ error: 'Fechamento não encontrado' });
        const [companies, machines, observations, divergences] = await Promise.all([
            pool.query(`SELECT e.empresa_id, e.nome, e.tipo, fe.valor_esperado, fe.valor_recebido, fe.diferenca
                FROM fechamento_empresa fe JOIN empresas e USING (empresa_id) WHERE fe.fechamento_id = $1 ORDER BY e.empresa_id`, [req.params.fechamentoId]),
            pool.query(`SELECT fm.fechamento_maquina_id, m.maquina_id, m.nome AS maquina_nome, e.nome AS empresa_nome,
                e.tipo, fm.turno, fm.valor_esperado, fm.valor_recebido, fm.diferenca, o.nome AS operador_nome
                FROM fechamento_maquinas fm JOIN maquinas m USING (maquina_id) JOIN empresas e USING (empresa_id)
                LEFT JOIN operadores o USING (operador_id) WHERE fm.fechamento_id = $1 ORDER BY m.nome`, [req.params.fechamentoId]),
            pool.query(`SELECT ob.observacao_id, ob.texto, ob.created_at, u.nome AS usuario_nome FROM observacoes ob
                JOIN usuarios u USING (usuario_id) WHERE ob.fechamento_id = $1 ORDER BY ob.created_at`, [req.params.fechamentoId]),
            pool.query(`SELECT d.divergencia_id, d.valor_diferenca, d.status, fm.maquina_id, m.nome AS maquina_nome
                FROM divergencias d LEFT JOIN fechamento_maquinas fm USING (fechamento_maquina_id)
                LEFT JOIN maquinas m USING (maquina_id) WHERE d.fechamento_id = $1`, [req.params.fechamentoId]),
        ]);
        res.json({ fechamento: header.rows[0], empresas: companies.rows, maquinas: machines.rows, observacoes: observations.rows, divergencias: divergences.rows });
    } catch (err) {
        console.error('Erro ao carregar detalhe do fechamento:', err);
        res.status(500).json({ error: 'Erro ao carregar detalhe do fechamento' });
    }
});



export default router;
