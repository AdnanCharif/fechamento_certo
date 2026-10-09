# Exemplo de planejamento de variabilidade (LPS)

O Une Caixas possui uma linha de produto para gerentes de postos. O fluxo principal de fechamento é comum; algumas capacidades podem variar conforme a versão contratada.

| Ponto de variação | Opções | Padrão atual | Regra de configuração |
| --- | --- | --- | --- |
| Gestão de operadores | Disponível / indisponível | Disponível | `FEATURE_OPERATOR_MANAGEMENT=true` |
| Alerta de divergência | Desligado / limite configurável | Limite de R$ 100 | `DIVERGENCE_ALERT_LIMIT=100`; zero desliga o alerta |

`src/config/productVariability.js` representa essa configuração em JavaScript e a API `/config/variabilidade` permite consultar a variante carregada. A opção de gestão de operadores controla a tela e os endpoints dessa funcionalidade. O limite pode ser consultado pelo cálculo de criticidade quando a equipe desenvolver o fluxo de divergências. As opções deixam o fluxo base de autenticação e cadastro de máquinas comum entre variantes.

Para cada implantação, a equipe decide quais recursos serão incluídos e define os valores das variáveis de ambiente. A restrição é que um limite de alerta deve ser finito e não negativo; zero significa que o alerta está desativado.
