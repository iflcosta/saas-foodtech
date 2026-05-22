import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export async function build(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({
    status: 'ok',
    service: 'api',
    version: '0.0.0',
  }));

  return app;
}
