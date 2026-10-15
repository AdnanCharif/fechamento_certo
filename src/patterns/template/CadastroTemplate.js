import { ErroHttp } from '../../lib/http.js';
import { transacao } from '../../lib/transacao.js';

// Template Method: execute fixa a sequência transacional; subclasses definem
// a validação e a gravação específicas de cada cadastro.
export class CadastroTemplate {
  constructor(validationStrategy) { this.validationStrategy = validationStrategy; }

  async execute(pool, data) {
    if (!this.validationStrategy.validate(data)) throw new ErroHttp(400, 'Dados obrigatórios ou inválidos');
    return transacao(pool, (client) => this.persist(client, data));
  }

  async persist() { throw new Error('Subclasse deve implementar persist()'); }
}
