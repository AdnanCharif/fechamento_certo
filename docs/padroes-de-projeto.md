# Padrões aplicados no código

## Singleton — 2 exemplos

1. `DatabasePool`: mantém uma instância compartilhada do pool PostgreSQL. É exportada por `src/config/db.js` e entregue ao Express.
2. `JwtTokenService`: centraliza assinatura e verificação dos JWTs. As rotas reutilizam a instância obtida por `getInstance()`.

## Template Method — 3 exemplos

`CadastroTemplate.execute()` define a sequência fixa: validar os dados, abrir transação, persistir, confirmar ou desfazer a transação e liberar a conexão. As subclasses implementam a persistência específica:

1. `CadastroEmpresa`;
2. `CadastroMaquina`;
3. `CadastroOperador`.

Os três fluxos são chamados pelas rotas POST correspondentes.

## Strategy — 3 exemplos

O contrato `validate(data)` é implementado por estratégias específicas e injetado nos fluxos Template Method:

1. `EmpresaValidationStrategy`;
2. `MaquinaValidationStrategy`;
3. `OperadorValidationStrategy`.

## Classes de domínio

`src/domain/entities.js` declara 12 classes com atributos e métodos: `Usuario`, `Posto`, `Empresa`, `Maquina`, `Operador`, `Fechamento`, `FechamentoMaquina`, `FechamentoEmpresa`, `Divergencia`, `Observacao`, `LogAuditoria` e `DashboardResumo`.
