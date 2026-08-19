import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
  res.send('API rodando');
});

//Login

router.post('/auth/login', (req,res) => {

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
      await client.query('BEGIN');

      // 1. Cria o usuário e já pega o id gerado com RETURNING
      const insertUsuario = `
          INSERT INTO usuarios (nome, email, senha)
          VALUES ($1, $2, $3)
          RETURNING usuario_id;
      `;
      const usuarioResult = await client.query(insertUsuario, [nome, email, senha]);
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

  try {
      const deleteVinculo = `
          DELETE FROM postos_usuarios
          WHERE posto_id = $1 AND usuario_id = $2;
      `;

      await pool.query(deleteVinculo, [postoId, usuarioId]);

      res.json({
          message: 'Usuário removido do posto com sucesso',
      });
  } catch (err) {
      console.error('Erro ao remover usuário do posto:', err);
      res.status(500).json({ error: 'Erro ao remover usuário do posto' });
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