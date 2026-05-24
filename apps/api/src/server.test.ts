import type { DbClient } from '@saas-foodtech/db';
import { describe, expect, it } from 'vitest';
import { build } from './server.js';

const FAKE_DB = {} as DbClient;

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = await build({
      db: FAKE_DB,
      jwtSecret: 'test-secret-with-at-least-32-characters!!',
      logger: false,
    });
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'api' });
    await app.close();
  });
});
