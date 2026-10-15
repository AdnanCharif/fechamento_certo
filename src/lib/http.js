// Tratamento de erros HTTP reutilizado por todas as rotas e middlewares.

// Erro esperado (validação, não encontrado, conflito): a mensagem vai para o cliente.
export class ErroHttp extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Envolve um handler async. ErroHttp vira resposta com o próprio status; erros do
// PostgreSQL listados em errosDoBanco (por código) viram o ErroHttp correspondente;
// qualquer outro erro é logado e respondido com 500 e a mensagem genérica da rota.
export function rota(mensagemErro, handler, errosDoBanco = {}) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (err) {
      const erro = err instanceof ErroHttp ? err : errosDoBanco[err.code];
      if (erro) return res.status(erro.status).json({ error: erro.message });
      console.error(`${mensagemErro}:`, err);
      res.status(500).json({ error: mensagemErro });
    }
  };
}
