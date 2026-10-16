# Padrões aplicados no código

## Singleton — 2 exemplos

1. `DatabasePool`: mantém uma instância compartilhada do pool PostgreSQL. É exportada por `src/config/db.js` e entregue ao Express.
2. `JwtTokenService`: centraliza assinatura e verificação dos JWTs. As rotas reutilizam a instância obtida por `getInstance()`.

## Template Method — 4 exemplos

`CadastroTemplate.execute()` define a sequência fixa: validar os dados, abrir transação, persistir, confirmar ou desfazer a transação e liberar a conexão. As subclasses implementam a persistência específica:

1. `CadastroEmpresa`;
2. `CadastroMaquina`;
3. `CadastroOperador`;
4. `CadastroPosto` (grava o posto, as duas empresas e o gerente responsável na mesma transação).

Os quatro fluxos são chamados pelas rotas POST correspondentes; o de posto fica na área admin (`POST /admin/estabelecimentos`).

## Strategy — 7 exemplos

**Validação.** O contrato `validate(data)` é implementado por estratégias específicas e injetado nos fluxos Template Method:

1. `EmpresaValidationStrategy`;
2. `MaquinaValidationStrategy`;
3. `OperadorValidationStrategy`;
4. `PostoValidationStrategy` (também usada na edição do posto, fora do Template Method).

**Alertas da rede** (`src/patterns/strategy/RegrasDeAlerta.js`). O contrato `avaliar(fechamentos, contexto)` devolve um alerta ou `null`; `gerarAlertas` aplica a lista de regras a cada posto sem conhecer nenhuma delas, então incluir uma regra é só acrescentar uma classe à lista:

5. `FaltaAcumuladaRule`: falta somada nos últimos 7 dias maior que 10× o limite de alerta (crítico);
6. `DivergenciasRecorrentesRule`: os últimos 3 fechamentos com diferença maior que o limite (atenção);
7. `FechamentoPendenteRule`: o fechamento de ontem ainda não foi registrado (atenção).

## Classes de domínio

`src/domain/entities.js` declara 12 classes com atributos e métodos: `Usuario`, `Posto`, `Empresa`, `Maquina`, `Operador`, `Fechamento`, `FechamentoMaquina`, `FechamentoEmpresa`, `Divergencia`, `Observacao`, `LogAuditoria` e `DashboardResumo`.
