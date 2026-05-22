import { describe, expect, it } from 'vitest';
import { build } from './server.js';

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = await build();
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ status: 'ok', service: 'api' });
    await app.close();
  });
});
