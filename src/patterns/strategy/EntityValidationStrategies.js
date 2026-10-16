import { Empresa, Maquina, Operador, Posto } from '../../domain/entities.js';
import { planos } from '../../config/catalogo.js';

// Strategy: cada entidade aplica sua própria regra de validação substituível.
export class EmpresaValidationStrategy {
  validate(data) { return new Empresa(data).validar(); }
}

export class MaquinaValidationStrategy {
  validate(data) { return new Maquina(data).validar(); }
}

export class OperadorValidationStrategy {
  validate(data) { return new Operador(data).validar(); }
}

// O posto pode vir com plano e empresas; o plano precisa existir no catálogo e cada empresa precisa de nome, CNPJ e tipo.
export class PostoValidationStrategy {
  validate(data) {
    const empresas = data.empresas ?? [];
    return new Posto(data).validar() && (!data.plano || Boolean(planos[data.plano]))
      && Array.isArray(empresas) && empresas.every((empresa) => new Empresa(empresa).dadosValidos());
  }
}
