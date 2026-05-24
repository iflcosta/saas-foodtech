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
import { categoriesRoutes } from './routes/categories.js';
import { menuRoutes } from './routes/menu.js';
import { modifierGroupsRoutes } from './routes/modifier-groups.js';
import { productsRoutes } from './routes/products.js';

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

  // Admin do cardápio (autenticado, manager+)
  await app.register(categoriesRoutes, { db: opts.db });
  await app.register(productsRoutes, { db: opts.db });
  await app.register(modifierGroupsRoutes, { db: opts.db });

  // Cardápio público (sem auth)
  await app.register(menuRoutes, { db: opts.db });

  return app;
}
