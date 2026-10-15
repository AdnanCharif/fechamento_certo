// Executa fn(client) numa transação: COMMIT se tudo der certo, ROLLBACK se der erro
// e a conexão sempre volta para o pool. Reutilizada pelas rotas e pelo CadastroTemplate.
export async function transacao(pool, fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resultado = await fn(client);
    await client.query('COMMIT');
    return resultado;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
