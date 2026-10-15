import { ErroHttp } from '../../lib/http.js';

// Template Method: execute fixa a sequência transacional; subclasses definem
// a validação e a gravação específicas de cada cadastro.
export class CadastroTemplate {
  constructor(validationStrategy) { this.validationStrategy = validationStrategy; }

  async execute(pool, data) {
    if (!this.validationStrategy.validate(data)) throw new ErroHttp(400, 'Dados obrigatórios ou inválidos');

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
