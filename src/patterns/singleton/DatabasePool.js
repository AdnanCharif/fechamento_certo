import pg from 'pg';

// Singleton 1: uma instância compartilhada do pool PostgreSQL por processo.
export class DatabasePool {
  static #instance;

  constructor(config = {}) {
    if (DatabasePool.#instance) return DatabasePool.#instance;
    const { Pool } = pg;
    this.pool = new Pool({
      host: config.host ?? process.env.DB_HOST,
      port: config.port ?? process.env.DB_PORT,
      user: config.user ?? process.env.DB_USER,
      password: config.password ?? process.env.DB_PASSWORD,
      database: config.database ?? process.env.DB_NAME,
    });
    DatabasePool.#instance = this;
  }

  static getInstance(config) { return DatabasePool.#instance ?? new DatabasePool(config); }
  query(...args) { return this.pool.query(...args); }
  connect() { return this.pool.connect(); }
  end() { return this.pool.end(); }
}
