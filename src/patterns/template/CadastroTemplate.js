// Template Method: execute fixa a sequência transacional; subclasses definem
// a validação e a gravação específicas de cada cadastro.
export class CadastroTemplate {
  constructor(validationStrategy) { this.validationStrategy = validationStrategy; }

  async execute(pool, data) {
    if (!this.validationStrategy.validate(data)) {
      const error = new Error('Dados obrigatórios ou inválidos');
      error.status = 400;
      throw error;
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await this.persist(client, data);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async persist() { throw new Error('Subclasse deve implementar persist()'); }
}
