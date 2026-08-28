import pool from './src/config/db.js'; // ajuste o caminho conforme a localização do arquivo
import bcrypt from 'bcrypt';

async function criarUsuario(nome, email, senhaPlana) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(senhaPlana, saltRounds);

  const sql = `
    INSERT INTO usuarios (nome, email, senha, ativo)
    VALUES ($1, $2, $3, true)
    RETURNING usuario_id, nome, email;
  `;

  const result = await pool.query(sql, [nome, email, hash]);
  console.log('Usuário criado:', result.rows[0]);
  await pool.end();
}


// Ajuste os dados aqui
criarUsuario('Teste', 'teste@email.com', 'teste');