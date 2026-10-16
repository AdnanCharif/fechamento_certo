// Exemplo de variabilidade da LPS: o produto pode ativar/desativar recursos e
// ajustar o limite financeiro sem alterar o fluxo principal da aplicação.
export class ProductVariability {
  constructor(options = {}) {
    this.operatorManagement = options.operatorManagement ?? (process.env.FEATURE_OPERATOR_MANAGEMENT !== 'false');
    this.divergenceAlertLimit = Number(options.divergenceAlertLimit ?? process.env.DIVERGENCE_ALERT_LIMIT ?? 100);
    if (!Number.isFinite(this.divergenceAlertLimit) || this.divergenceAlertLimit < 0) {
      throw new Error('DIVERGENCE_ALERT_LIMIT precisa ser um número maior ou igual a zero');
    }
  }

  isDivergenceCritical(value) { return this.divergenceAlertLimit > 0 && Math.abs(Number(value)) >= this.divergenceAlertLimit; }

  // Saldo de um posto no período: falta maior que o limite pede atenção; maior que 10x o limite é crítica.
  classificarSaldo(saldo) {
    if (!this.divergenceAlertLimit || Number(saldo) >= -this.divergenceAlertLimit) return 'ok';
    return Number(saldo) <= -this.divergenceAlertLimit * 10 ? 'critico' : 'atencao';
  }

  toJSON() {
    return {
      pontosDeVariacao: {
        gestaoDeOperadores: { habilitado: this.operatorManagement },
        alertaDeDivergencia: { habilitado: this.divergenceAlertLimit > 0, limite: this.divergenceAlertLimit },
      },
    };
  }
}

export const productVariability = new ProductVariability();
