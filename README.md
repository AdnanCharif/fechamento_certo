# Projeto: Ferramenta de Conferência de Caixa para o Gerente (Posto + Loja de Conveniência)

## 1. Área de atuação (Design Thinking)

**Domínio:** Varejo / Retail Tech — ferramenta de apoio à gestão financeira, para uso **exclusivo do gerente**.

**Importante — o que essa ferramenta NÃO é:**
Não é um sistema de PDV/frente de caixa. Frentistas e operadores de caixa continuam usando o sistema que o posto já tem hoje. Essa ferramenta não se conecta ao fluxo de venda e não é operada por eles — para evitar exatamente o problema de "mais um sistema para confundir a equipe".

**O que essa ferramenta É:**
Uma ferramenta de **conferência/conciliação de caixa**, usada apenas pelo gerente, no dia seguinte (ou no fechamento do dia), para substituir o trabalho manual de "fazer conta na mão".

**Problema central (dor real, validada por experiência própria):**
O posto e a loja de conveniência são CNPJs diferentes. Quando o cliente abastece e compra algo na loja em uma única passada de cartão (ex: R$100 de gasolina + R$10 de salgado), o sistema atual lança tudo junto no CNPJ do posto. Resultado: sobra dinheiro no caixa do posto e falta no caixa da loja (ou vice-versa). Isso é assumido como uma característica do processo (não dá pra evitar sem confundir o cliente/operador). O problema real é que, hoje, **o gerente precisa somar manualmente, à mão, os valores de cada máquina de cartão e de cada empresa** para achar as diferenças — um trabalho lento, repetitivo e sujeito a erro de conta, que resulta numa diferença que gira em torno de **R$3.000+/dia** e pode levar horas para ser rastreada até o funcionário/máquina de origem.

**Como Design Thinking se aplica:**
- **Empatizar:** entender a rotina do gerente na hora da conferência — de onde ele tira os números (relatórios do sistema de vendas, comprovantes de máquina de cartão, dinheiro físico) e como ele hoje faz essa conta.
- **Definir:** o problema não é "o sistema de vendas está errado", é **"a conferência manual das duas empresas é lenta e propensa a erro"**.
- **Idear/Prototipar/Testar:** uma ferramenta em que o gerente digita os valores (de cada máquina, cada CNPJ, cada forma de pagamento) e ela calcula automaticamente sobra/falta, aponta divergências e sugere onde pode estar o erro (ex: operador X, máquina Y, turno Z).

**Proposta de valor:** trocar horas de conta manual, todo santo dia, por uma entrada de dados rápida e um resultado automático — reduzindo tempo de conferência e erro humano no cálculo (não no lançamento da venda, que continua sendo feito no sistema atual).

---

## 2. Público-alvo

- Gerentes de postos de combustível com loja de conveniência associada em CNPJ separado.
- Donos de postos pequenos/médios que fazem essa conferência pessoalmente ou pedem para o gerente/financeiro fazer.
- Redes pequenas de postos, onde cada unidade tem um responsável pelo fechamento diário.

**Usuário do sistema:** apenas o gerente (ou quem faz o fechamento). Frentistas, operadores de caixa e clientes **não interagem com a ferramenta** — são apenas mencionados como contexto do problema.

---

## 3. Personas (6)

*(Apenas a Persona 1 é usuária direta da ferramenta. As demais são "personas de contexto" — pessoas cuja rotina gera os dados que o gerente vai conferir, ou que são impactadas pelo resultado. Isso é comum e válido em Design Thinking: ajuda a entender todo o ecossistema do problema.)*

### Persona 1 — Gerente (usuária principal da ferramenta) ⭐
- **Nome:** Marisa, 38 anos
- **Rotina:** Todo dia (ou toda manhã seguinte) pega os relatórios de vendas do sistema do posto, os comprovantes/relatórios das máquinas de cartão e o dinheiro físico contado, e faz a conta na mão pra saber se bateu com os dois CNPJs.
- **Dor:** Perde 1-2h por dia fazendo somas manuais; quando não bate, tem que abrir caixa por caixa e máquina por máquina até achar o erro.
- **Objetivo:** Digitar os valores uma vez e deixar a ferramenta calcular sobra/falta e apontar onde está a diferença.

### Persona 2 — Frentista/Operador de caixa (contexto)
- **Nome:** Carlos, 24 anos
- **Rotina:** Lança as vendas no sistema atual do posto (que ele já conhece), inclusive vendas mistas (combustível + loja).
- **Relação com a ferramenta:** Nenhuma direta — mas é frequentemente o "suspeito" quando a conferência da Marisa não bate, por lançamento errado.

### Persona 3 — Contador / Financeiro (contexto/consumidor do resultado)
- **Nome:** Roberto, 45 anos
- **Rotina:** Recebe o resultado do fechamento já pronto (feito pela Marisa) para lançar na contabilidade dos dois CNPJs.
- **Dor:** Recebe números que às vezes não fecham, sem explicação clara da origem.
- **Objetivo:** Receber relatórios já conferidos e com a divergência explicada, quando houver.

### Persona 4 — Dono/Sócio do posto (contexto/interessado no resultado)
- **Nome:** Antônio, 52 anos
- **Rotina:** Confia no fechamento que a Marisa entrega; não participa da conta.
- **Dor:** Não sabe se a diferença de caixa é fraude, erro humano ou o próprio processo de venda mista.
- **Objetivo:** Ter confiança nos números com menos tempo gasto pela equipe.

### Persona 5 — Cliente do posto (contexto, gera o "problema de origem")
- **Nome:** Juliana, 30 anos
- **Rotina:** Abastece e aproveita para comprar algo na loja, pagando tudo numa única passada de cartão.
- **Relação com a ferramenta:** Nenhuma — é a origem indireta da divergência entre os CNPJs, mas nunca vê ou usa o sistema.

### Persona 6 — Auditor interno / Financeiro da matriz (usuária potencial futura)
- **Nome:** Fernanda, 41 anos
- **Rotina:** Se a ferramenta crescer para uma rede de postos, ela poderia comparar fechamentos entre unidades.
- **Objetivo:** Painel comparativo entre postos (fora do escopo do MVP, mas bom para "visão de futuro" do projeto).

---

## 4. Mapa de empatia (persona foco: Gerente – Marisa, única usuária real)

- **O que ela PENSA e SENTE:** Cansaço de refazer a mesma conta manual todo dia; ansiedade quando o valor não bate; frustração de "perder a manhã inteira" nisso.
- **O que ela VÊ:** Relatórios de vendas no sistema do posto, comprovantes de várias máquinas de cartão diferentes, dinheiro físico contado, planilhas soltas ou papel/caderno de anotação.
- **O que ela FALA e FAZ:** Reclama do retrabalho diário; liga pro dono explicando a diferença quando não consegue achar a causa; pede pro frentista confirmar se lançou certo.
- **O que ela OUVE:** Cobrança do dono sobre a diferença de caixa; frentista dizendo "lancei certo, não sei o que houve".
- **Dores:** Tempo perdido todos os dias, estresse mental de fazer conta manual, risco de errar a própria conferência por cansaço.
- **Ganhos desejados:** Digitar os valores rapidamente, ver o resultado calculado na hora, saber exatamente em qual máquina/turno está a diferença sem precisar caçar manualmente.

---

## 5. Storyboard (12 quadros — rotina real da Marisa com a ferramenta)

| # | Cena | Interface envolvida |
|---|------|---------------------|
| 1 | Marisa chega e abre o sistema atual do posto para tirar o relatório de vendas do dia anterior | (sistema externo, fora do escopo) |
| 2 | Ela também separa os comprovantes/relatórios de cada máquina de cartão | (papel/relatório externo) |
| 3 | Marisa abre a ferramenta (login) | Tela de Login |
| 4 | Ela cria um novo fechamento para a data de ontem | Tela "Novo Fechamento" |
| 5 | Ela seleciona a máquina 1 e digita: valor esperado (do sistema) x valor recebido (da máquina) | Tela de Input por Máquina |
| 6 | Repete para a máquina 2, 3, etc, e para o dinheiro físico | Tela de Input por Máquina (loop) |
| 7 | Ela informa os valores separados por CNPJ (posto x loja) | Tela de Input por CNPJ |
| 8 | Ela clica em "Calcular Fechamento" | Botão de ação |
| 9 | A ferramenta mostra o resumo: total esperado, total recebido, sobra/falta por CNPJ | Tela de Resultado |
| 10 | Se houver divergência, a ferramenta aponta em qual máquina/turno está a diferença | Tela de Divergência Detalhada |
| 11 | Marisa adiciona uma observação (ex: "conferido com o Carlos, foi engano no troco") | Tela de Observações |
| 12 | Ela salva o fechamento, que fica no histórico para consulta futura e para envio ao contador | Tela de Histórico / Exportar |

---

## 6. Requisitos Funcionais (17)

1. O sistema deve permitir login exclusivo do gerente (usuário único por posto, ou múltiplos gerentes por posto).
2. O sistema deve permitir cadastrar, editar e inativar as máquinas de cartão existentes no posto (CRUD).
3. O sistema deve permitir cadastrar, editar e inativar operadores/frentistas apenas para fins de identificação de turno (não fazem login).
4. O sistema deve permitir criar um novo fechamento de caixa vinculado a uma data.
5. O sistema deve permitir ao gerente inserir manualmente, por máquina, o valor esperado (do sistema de vendas) e o valor recebido (do extrato/comprovante da máquina).
6. O sistema deve permitir inserir manualmente o valor em dinheiro físico contado.
7. O sistema deve permitir separar os valores inseridos entre os dois CNPJs (posto e loja).
8. O sistema deve calcular automaticamente a diferença (sobra/falta) por máquina.
9. O sistema deve calcular automaticamente a diferença (sobra/falta) consolidada por CNPJ.
10. O sistema deve destacar visualmente quando uma divergência ultrapassa um valor limite configurável.
11. O sistema deve permitir ao gerente associar uma divergência a um operador/turno específico, para registro de causa.
12. O sistema deve permitir adicionar observações/anotações a cada fechamento ou divergência.
13. O sistema deve manter histórico de fechamentos consultável por data/período.
14. O sistema deve permitir editar um fechamento já salvo, mantendo registro (log) da alteração.
15. O sistema deve permitir exportar o fechamento (relatório) em PDF e/ou Excel para envio ao contador/dono.
16. O sistema deve apresentar um painel (dashboard) com o total de sobra/falta acumulada no mês, por CNPJ.
17. O sistema deve permitir duplicar/reaproveitar a estrutura de máquinas do fechamento anterior, para agilizar a entrada de dados do dia seguinte.

---

## 7. Requisitos Não Funcionais (10)

1. O sistema deve responder às ações do usuário em até 2 segundos em condições normais de uso.
2. O sistema deve ter disponibilidade mínima de 99% durante o horário comercial.
3. Os dados devem ser criptografados em trânsito (HTTPS) e em repouso.
4. A interface deve ser responsiva, priorizando uso em desktop/notebook (rotina de escritório do gerente), com suporte a tablet.
5. O tempo de preenchimento de um fechamento completo deve ser inferior a 10 minutos para um gerente já habituado.
6. O sistema deve ser intuitivo o suficiente para que um novo gerente aprenda a usar em menos de 20 minutos, sem necessidade de treinamento formal.
7. O sistema deve realizar backup automático diário dos fechamentos registrados.
8. O sistema deve manter log de alterações em fechamentos já salvos (imutável, apenas leitura para consulta futura).
9. O sistema deve estar em conformidade com a LGPD quanto a dados de funcionários mencionados nos fechamentos.
10. O sistema deve ser escalável para permitir, futuramente, o cadastro de mais de um posto pelo mesmo usuário (visão multi-unidade).

---

## 8. Escopo do CRUD (mínimo)

| Entidade | Create | Read | Update | Delete |
|---|---|---|---|---|
| Gerente/Usuário | ✅ | ✅ | ✅ | ✅ (inativação) |
| Máquinas de cartão | ✅ | ✅ | ✅ | ✅ (inativação) |
| Operadores/Frentistas (apenas cadastro p/ identificação) | ✅ | ✅ | ✅ | ✅ (inativação) |
| Fechamento de caixa | ✅ | ✅ | ✅ (com log) | ❌ (não se apaga, só arquiva) |
| Divergências/Observações | ✅ | ✅ | ✅ | ✅ |

---

## 9. Sugestão de telas para o protótipo (13 telas)

1. Login
2. Dashboard (visão geral do mês: sobra/falta acumulada por CNPJ)
3. Novo Fechamento (seleção de data)
4. Input de valores por máquina (esperado x recebido)
5. Input de dinheiro físico
6. Input de separação por CNPJ (posto x loja)
7. Tela de cálculo/resumo do fechamento (totais)
8. Tela de divergência detalhada (por máquina/turno)
9. Tela de associação de divergência a operador
10. Tela de observações/anotações
11. Histórico de fechamentos (lista por data)
12. Detalhe de um fechamento salvo (consulta)
13. Cadastro de máquinas e operadores (tela de configuração)

---

## Próximos passos sugeridos para a equipe
- Validar com a Marisa (persona real, sua própria vivência) exatamente quais números ela hoje precisa somar na mão — isso define os campos de input da tela 4/5/6.
- Levar o storyboard para o Figma/Balsamiq e desenhar as 13 telas.
- Priorizar no protótipo o fluxo de **input rápido de valores + cálculo automático de sobra/falta** — é o coração da solução.

# une-caixas