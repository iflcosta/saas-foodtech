/**
 * Fábrica do servidor Fastify.
 *
 * `build()` aceita injeção de `db`, `jwtSecret` e `logger` para que os testes
 * possam substituir dependências sem subir um processo Node real.
 */
import type { DbClient } from '@saas-foodtech/db';
import cors from '@fastify/cors';
import Fastify, { type FastifyInstance } from 'fastify';
import { authPlugin } from './plugins/auth.js';
import { authRoutes } from './routes/auth.js';

export interface BuildOptions {
  db: DbClient;
  jwtSecret: string;
  logger?: boolean;
  tokenExpiresIn?: string;
}

export async function build(opts: BuildOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: opts.logger ?? true });

  await app.register(cors, { origin: true });
  await app.register(authPlugin, { jwtSecret: opts.jwtSecret });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
    version: '0.0.0',
  }));

  await app.register(authRoutes, {
    db: opts.db,
    tokenExpiresIn: opts.tokenExpiresIn,
  });

  return app;
}
