import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const router = express.Router();

router.get('/', (req, res) => {
  res.send('API rodando');
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
        const token = jwt.sign(
            { usuario_id: usuario.usuario_id, nome: usuario.nome, email: usuario.email },
            process.env.JWT_SECRET,
            { expiresIn: '8h' }
        );

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
    
});

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


//Máquinas

router.get('/postos/:id/maquinas', async (req, res) => {
    const postoId = req.params.id;

    let sql = `select m.maquina_id, m.nome as nome_maquina, e.nome as           nome_empresa, m.ativo, m.created_at
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
    const {empresa_id, nome} = req.body;

    const sql = `insert into maquinas(empresa_id, nome) 
                values ($1, $2)`;

    let values = [empresa_id, nome];

    const pool = req.app.get('db');

    try {
        await pool.query(sql,values);
        res.json({ message: 'Máquina adicionada com sucesso'});
    }catch(err) {
        console.error('Erro ao adicionar máquina:', err);
        res.status(500).json({ error: 'Erro ao adicionar máquina'});
    };
});

router.get('/maquinas/:id', async (req, res) => {
    const maquinaId = req.params.id

    let sql = `select m.maquina_id, m.nome as nome_maquina, e.nome as           nome_empresa, m.ativo, m.created_at
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

router.put('/maquinas', async (req, res) => {
    const {maquina_id, empresa_id, nome, ativo} = req.body;

    let sql = `update maquinas set 
    empresa_id = $2, 
    nome = $3, 
    ativo = $4 
    where maquina_id = $1`;

    let values = [maquina_id, empresa_id, nome, ativo];

    const pool = req.app.get('db');

    try {
        await pool.query(sql, values);
        res.json({"message": "Máquina alterada com sucesso"});
    }catch(err) {
        console.error('Erro ao editar maquina:',err);
        res.status(500).json({error: 'Erro ao editar maquina'});
    };
});

router.delete('/maquinas/:id', async (req, res) => {
    const maquinaId = req.params.id;

    let sql = `delete from maquinas where maquina_id = $1`;

    let values = [maquinaId];

    const pool = req.app.get('db');

    try{
        await pool.query(sql, values);
        res.json({"message": "Maquina excluida com sucesso"});
    }catch(err){
        console.error("Erro ao excluir a maquina:",err);
        res.status(500).json({erroe: 'Erro ao excluir a maquina'});
    };
});

router.patch('/maquinas/:id', async (req, res) => {
    const maquinaId = req.params.id;
    const { ativo } = req.body;

    const sql = `UPDATE maquinas SET ativo = $1 WHERE maquina_id = $2`;
    const values = [ativo, maquinaId];

    const pool = req.app.get('db');

    try {
        await pool.query(sql, values);
        res.json({ message: 'Status da máquina atualizado com sucesso' });
    } catch (err) {
        console.error('Erro ao atualizar status da máquina:', err);
        res.status(500).json({ error: 'Erro ao atualizar status da máquina' });
    }
});


//Operadores
router.get('/operadores/posto/:id', async (req, res) => {
    const postoId = req.params.id;

    let sql = `select o.operador_id, o.nome as nome_operador, e.nome as nome_empresa, o.ativo, o.created_at
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
    const { empresa_id, nome } = req.body;

    let sql = `insert into operadores (empresa_id, nome) values
                ($1, $2)`;

    let values = [empresa_id, nome];

    const pool = req.app.get('db');
    try {
        await pool.query(sql,values);
        res.json({message: 'Operador adicionado com sucesso'});
    }catch(err) { 
        console.error('Erro ao adicionar operador à empresa:', err);
        res.status(500).json({ error: 'Erro ao adicionar operador ao posto'});
    };
    
});

router.get('/operadores/nome', async (req, res) => {
    const { nome } = req.body;
    
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

//desativar operador
router.patch('/operador/:id', async (req, res) => {
    const operadorId = req.params.id;
    const { ativo }  = req.body;

    let sql = `update operadores set ativo = $1 where $2`;

    let values = [ativo, operadorId];

    const pool = await req.app.get('db');
    try{
        await pool.query(sql, values);
        res.json({message: 'Status do operador alterado com sucesso'});
    } catch(err) {
        console.error('Erro ao mudar o status operador', err);
        res.status(500).json({error:'Erro ao mudar o status do operador'})
    }
})

//Fechamentos


//Fechamentos x máquinas


//Fechamentos x empresas


//Divergências


//Observações


//Logs de auditoria


//Dashboard



export default router;