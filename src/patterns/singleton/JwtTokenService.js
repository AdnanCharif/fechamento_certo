import 'dotenv/config';
import jwt from 'jsonwebtoken';

// Singleton 2: serviço central de criação e verificação dos tokens da aplicação.
export class JwtTokenService {
  static #instance;

  constructor(secret = process.env.JWT_SECRET) {
    if (JwtTokenService.#instance) return JwtTokenService.#instance;
    this.secret = secret;
    JwtTokenService.#instance = this;
  }

  static getInstance() { return JwtTokenService.#instance ?? new JwtTokenService(); }
  sign(payload) {
    if (!this.secret) throw new Error('JWT_SECRET não configurado');
    return jwt.sign(payload, this.secret, { expiresIn: '8h' });
  }
  verify(token) {
    if (!this.secret) throw new Error('JWT_SECRET não configurado');
    return jwt.verify(token, this.secret);
  }
}
