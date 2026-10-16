import { ErroHttp, rota } from './http.js';

// Fábricas de rotas: várias rotas tinham o mesmo corpo e mudavam só o SQL, a tabela
// ou as mensagens. Cada fábrica recebe apenas o que varia e devolve o handler pronto.

// GET que executa um SELECT com parâmetros tirados da requisição e devolve as linhas.
export const listar = (mensagemErro, sql, parametros) => rota(mensagemErro, async (req, res) => {
  const result = await req.app.get('db').query(sql, parametros(req));
  res.json(result.rows);
});

// POST que delega a um cadastro (Template Method) e responde 201 com o registro criado.
export const cadastrar = (cadastro, mensagemErro, dados = (req) => req.body, errosDoBanco) => rota(mensagemErro, async (req, res) => {
  const result = await cadastro.execute(req.app.get('db'), dados(req));
  res.status(201).json(result.rows[0]);
}, errosDoBanco);

// PATCH { ativo } ou, com ativoFixo = false, DELETE lógico de tabelas que têm coluna ativo.
// Tabela e chave vêm do código, nunca da requisição.
export const alterarAtivo = (tabela, chave, naoEncontrado, ativoFixo) => rota(`Erro ao alterar status em ${tabela}`, async (req, res) => {
  const ativo = ativoFixo ?? req.body.ativo;
  if (typeof ativo !== 'boolean') throw new ErroHttp(400, 'Informe ativo como booleano');
  const result = await req.app.get('db').query(`UPDATE ${tabela} SET ativo = $1 WHERE ${chave} = $2 RETURNING ${chave}, ativo`, [ativo, req.params.id]);
  if (!result.rowCount) throw new ErroHttp(404, naoEncontrado);
  res.json(result.rows[0]);
});

// DELETE de um registro que pertence a um fechamento (divergência, observação).
export const excluirDoFechamento = (tabela, chave, naoEncontrado, mensagemSucesso) => rota(`Erro ao excluir de ${tabela}`, async (req, res) => {
  const result = await req.app.get('db').query(`DELETE FROM ${tabela} WHERE ${chave} = $1 AND fechamento_id = $2 RETURNING ${chave}`, [req.params.id, req.params.fechamentoId]);
  if (!result.rowCount) throw new ErroHttp(404, naoEncontrado);
  res.json({ message: mensagemSucesso });
});
