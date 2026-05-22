/**
 * Ponto de entrada de `@saas-foodtech/db`.
 *
 * Exporta:
 *  - `createClient(databaseUrl)` — fábrica de cliente Drizzle conectado a um pool `pg`.
 *  - `schema` — namespace com todas as tabelas (útil para `drizzle({ schema })`).
 *  - Re-exporta as tabelas individualmente para uso direto.
 */
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema/index.js';

const { Pool } = pg;

export type DbClient = NodePgDatabase<typeof schema>;

/**
 * Cria um cliente Drizzle ligado a um Pool `pg` apontando para `databaseUrl`.
 *
 * Esta é apenas a fábrica de conexão — não executa migrações nem queries.
 * A responsabilidade de fechar o pool é do chamador (`pool.end()`).
 */
export function createClient(databaseUrl: string): DbClient {
  const pool = new Pool({ connectionString: databaseUrl });
  return drizzle(pool, { schema });
}

export { schema };
export * from './schema/index.js';
