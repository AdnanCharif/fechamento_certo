import { Empresa, Maquina, Operador, Posto } from '../../domain/entities.js';

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

export class PostoValidationStrategy {
  validate(data) { return new Posto(data).validar(); }
}
