# Exemplo de planejamento de variabilidade (LPS)

O Une Caixas possui uma linha de produto para gerentes de postos. O fluxo principal de fechamento é comum; algumas capacidades podem variar conforme a versão contratada.

| Ponto de variação | Opções | Padrão atual | Quando é decidido | Regra de configuração |
| --- | --- | --- | --- | --- |
| Gestão de operadores | Disponível / indisponível | Disponível | Na implantação | `FEATURE_OPERATOR_MANAGEMENT=true` |
| Alerta de divergência | Desligado / limite configurável | Limite de R$ 100 | Na implantação | `DIVERGENCE_ALERT_LIMIT=100`; zero desliga o alerta |
| Módulos por cliente | Multi-unidade, Relatórios avançados, Exportação contábil, Alertas por WhatsApp (o Fechamento padrão é obrigatório) | Nenhum extra | Em execução, pelo administrador | Tela Módulos & Planos (`postos_modulos`) |
| Plano comercial | Básico, Pro Premium, Apenas Loja | Básico | Em execução, pelo administrador | Tela Módulos & Planos (`postos.plano`) |

## Variabilidade na implantação

`src/config/productVariability.js` representa essa configuração em JavaScript e a API `/config/variabilidade` permite consultar a variante carregada. A opção de gestão de operadores controla a tela e os endpoints dessa funcionalidade. O limite de alerta é usado no comparativo da rede (`classificarSaldo`: saldo abaixo de −limite pede atenção, abaixo de −10× o limite é crítico) e nas regras de alerta. As opções deixam o fluxo base de autenticação e cadastro de máquinas comum entre variantes.

Para cada implantação, a equipe decide quais recursos serão incluídos e define os valores das variáveis de ambiente. A restrição é que um limite de alerta deve ser finito e não negativo; zero significa que o alerta está desativado.

## Variabilidade por cliente, em execução

O catálogo de módulos e planos fica em `src/config/catalogo.js`; o banco guarda só a escolha de cada posto. O administrador liga ou desliga um módulo na tela **Módulos & Planos** e a mudança vale no próximo carregamento do gerente, sem reiniciar o servidor:

- **Painel Multi-unidade** ligado: o menu do gerente ganha **Comparativo de Postos** (com alertas e detalhamento) e o dashboard vira **Dashboard Consolidado**. Desligado, o item some do menu (`public/js/menu.js`) e as rotas `/rede/*` deixam de considerar o posto.
- Os demais módulos ficam registrados por cliente e aparecem no painel; o comportamento de cada um ainda será implementado.
- O plano define o valor mensal usado no MRR estimado do painel administrativo.

A restrição é que o módulo **Fechamento de Caixa Padrão** é obrigatório: está sempre ativo e a API recusa desligá-lo.
