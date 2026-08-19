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
    const sql = `select  u.nome as nome_usuario
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
  const sql = `select u.nome, u.email, u.created_at
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

router.get('/usuarios/me', (req, res) => {

});

router.put('/usuarios/me', (req, res) => {

});


//Empresas

router.get('/postos/empresas/me', (req, res) => {

});

router.put('/empresas/:id', (req, res) => {

});


//Máquinas

router.get('/postos/:id/maquinas', (req, res) => {

});

router.post('/maquinas', (req, res) => {

});

router.get('/maquinas/:id', (req, res) => {

});


//Operadores


//Fechamentos


//Fechamentos x máquinas


//Fechamentos x empresas


//Divergências


//Observações


//Logs de auditoria


//Dashboard



export default router;