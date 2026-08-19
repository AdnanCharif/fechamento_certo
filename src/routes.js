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

router.delete('/postos/:id/usuarios/:usuarioId', (req, res) => {

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