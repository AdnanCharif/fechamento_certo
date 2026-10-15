# Compactação de código focada em reuso

**Técnica:** identificar trechos repetidos no backend e trocá-los por abstrações reutilizáveis (funções de ordem superior, fábricas de handlers e métodos de domínio). Cada rota passa a escrever só o que tem de específico. O comportamento da API não muda.

**Alvo:** `src/routes.js`, que concentrava as 43 rotas da API e repetia em quase todas o mesmo tratamento de erros, o mesmo controle de transação e o mesmo formato de consulta.

## Antes e depois no git

| Commit | Passo | `routes.js` | Backend total* | try/catch | `console.error` | blocos BEGIN/ROLLBACK |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| `fb95645` | **Antes** (todas as rotas prontas) | 1028 | 1056 | 36 | 38 | 7 |
| `7f66944` | 1. `rota()` + `ErroHttp` | 744 | 795 | 9 | 1 | 7 |
| `a388409` | 2. `transacao()` | 698 | 754 | 3 | 1 | 1 |
| `a5c49f4` | 3. Fábricas de rotas | 599 | 688 | 3 | 1 | 1 |
| `6e34ef4` | 4. Regras na classe `Fechamento` | **597** | **686** | **3** | **1** | **1** |

\* Backend total = `routes.js` + `CadastroTemplate.js` + `src/lib/*.js`. As três últimas colunas também contam esse conjunto. A redução é de **35%** (1056 → 686 linhas), com as mesmas 43 rotas. Os 3 try/catch que sobraram são o `autenticar`, o `rota()` e o `transacao()`, e cada um é escrito uma vez só.

Para ver o antes e o depois:

```bash
git diff fb95645 6e34ef4 -- src/routes.js   # antes x depois completo
git show 7f66944                            # um passo de cada vez
git show fb95645:src/routes.js              # o arquivo como era antes
```

## Passo 1: tratamento de erros (`src/lib/http.js`)

Antes, cada rota tinha o próprio `try/catch`, com `console.error` e `res.status(500)`:

```js
router.get('/postos/:id/usuarios', (req, res) => {
  ...
  pool.query(sql, values)
      .then(result => { res.json(result.rows); })
      .catch(err => {
          console.error('Erro ao buscar usuários do posto:', err);
          res.status(500).json({ error: 'Erro ao buscar usuários do posto' });
      });
});
```

Depois, `rota(mensagem, handler, errosDoBanco)` envolve o handler. Erros esperados são lançados como `ErroHttp(status, mensagem)`, e códigos do PostgreSQL (`23505`, `23503`) viram respostas 409 ou 400 declaradas na própria rota:

```js
router.post('/postos/:postoId/fechamentos', validarAcessoPosto, rota('Erro ao salvar fechamento', async (req, res) => {
    if (!dadosValidos) throw new ErroHttp(400, 'Informe data, valores não negativos ...');
    ...
}, { '23505': new ErroHttp(409, 'Já existe um fechamento para este posto e data') }));
```

Também é reutilizado nos middlewares (`validarAcessoPosto`, `validarFechamentoEditavel`, `validarDivergencia`) e no `CadastroTemplate`.

## Passo 2: transações (`src/lib/transacao.js`)

O bloco `connect → BEGIN → COMMIT / ROLLBACK → release` estava copiado em 6 rotas e no `CadastroTemplate`. Agora `transacao(pool, fn)` é o único lugar que abre e fecha transações:

```js
// antes (repetido 7 vezes)
const client = await pool.connect();
try {
    await client.query('BEGIN');
    ...
    await client.query('COMMIT');
} catch (err) {
    await client.query('ROLLBACK');
    ...
} finally {
    client.release();
}

// depois
const criado = await transacao(req.app.get('db'), async (client) => { ... });
```

O Template Method `CadastroTemplate.execute()` passou de 16 para 3 linhas e mantém a mesma sequência (validar → transação → `persist`).

## Passo 3: fábricas de rotas (`src/lib/fabricasDeRotas.js`)

Várias rotas tinham o mesmo corpo e mudavam só o SQL, a tabela ou as mensagens. Cada fábrica recebe apenas o que varia:

| Fábrica | Rotas que usam |
| --- | --- |
| `listar(mensagem, sql, parametros)` | 8 GETs de consulta |
| `cadastrar(cadastro, mensagem, dados?, errosDoBanco?)` | POST de empresa, máquina, operador e posto (Template Method) |
| `alterarAtivo(tabela, chave, naoEncontrado, ativoFixo?)` | PATCH e DELETE lógico de usuários, máquinas e operadores |
| `excluirDoFechamento(tabela, chave, naoEncontrado, sucesso)` | DELETE de divergência e de observação |

```js
// antes: 2 rotas com ~20 linhas cada, iguais exceto pela tabela
router.patch('/maquinas/:id', async (req, res) => { ... });
router.patch('/operadores/:id', async (req, res) => { ... });

// depois
router.patch('/maquinas/:id', alterarAtivo('maquinas', 'maquina_id', 'Máquina não encontrada'));
router.patch('/operadores/:id', alterarAtivo('operadores', 'operador_id', 'Operador não encontrado'));
```

Ainda neste passo: a cadeia `fechamentoEditavel = [validarAcessoPosto, validarFechamentoEditavel]` é reaproveitada pelas 8 rotas que alteram um fechamento, e o mesmo SELECT de máquinas serve à listagem e à busca por id.

## Passo 4: regras do fechamento na classe de domínio

Criar e editar fechamento repetiam a validação dos valores e a regra de status. As duas rotas passaram a usar a classe `Fechamento` (`src/domain/entities.js`):

- `Fechamento.valoresValidos(dados)`: dinheiro e máquinas precisam ser números não negativos;
- `fechamento.definirStatus(empresaDivergente)`: `ok` ou `com_divergencia`, usando o `calcularDiferencaDinheiro()` que já existia na classe.

## Como garantimos que nada quebrou

Antes de cada commit, as rotas foram exercitadas por um script de requisições HTTP contra um banco de teste recriado do zero. O script confere status HTTP e efeitos no banco: logs de auditoria, rollback, arquivamento, inativação e vínculos. As 90 verificações passaram após cada passo. A versão final, com 94, passou tanto no commit de antes (`fb95645`) quanto no de depois (`6e34ef4`).
