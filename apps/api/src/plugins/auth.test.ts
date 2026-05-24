/**
 * Testes do plugin de autenticação — sem DB.
 * Cobre a fronteira de segurança: token ausente/expirado/inválido, escopo de papel.
 */
import type { UserRole } from '@saas-foodtech/shared';
import Fastify, { type FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { authPlugin } from './auth.js';

const JWT_SECRET = 'unit-test-secret-with-at-least-32-chars!!';

const buildApp = async () => {
  const app = Fastify({ logger: false });
  await app.register(authPlugin, { jwtSecret: JWT_SECRET });

  app.get(
    '/protected',
    { preHandler: app.authenticate },
    async (req) => ({ auth: req.auth }),
  );

  app.get(
    '/manager-only',
    { preHandler: [app.authenticate, app.requireRole('manager')] },
    async () => ({ ok: true }),
  );

  return app;
};

const signToken = (
  app: FastifyInstance,
  claims: { sub: string; tenant_id: string; role: UserRole },
  expiresIn = '8h',
) => app.jwt.sign(claims, { expiresIn });

const SAMPLE = {
  sub: '11111111-1111-4111-8111-111111111111',
  tenant_id: '22222222-2222-4222-8222-222222222222',
};

describe('authPlugin — authenticate', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('401 sem token', async () => {
    const res = await app.inject({ method: 'GET', url: '/protected' });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthenticated');
  });

  it('401 com token mal-assinado', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: 'Bearer not-a-real-jwt' },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthenticated');
  });

  it('401 com token expirado', async () => {
    const token = signToken(app, { ...SAMPLE, role: 'operator' }, '-1s');
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthenticated');
  });

  it('401 quando claims não batem com jwtClaimsSchema', async () => {
    // sub não é UUID válido → falha no parse Zod
    const token = signToken(app, {
      sub: 'not-a-uuid',
      tenant_id: SAMPLE.tenant_id,
      role: 'operator',
    });
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe('unauthenticated');
  });

  it('200 com token válido e popula req.auth', async () => {
    const token = signToken(app, { ...SAMPLE, role: 'operator' });
    const res = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      auth: {
        userId: SAMPLE.sub,
        tenantId: SAMPLE.tenant_id,
        role: 'operator',
      },
    });
  });
});

describe('authPlugin — requireRole (RBAC)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });
  afterEach(async () => {
    await app.close();
  });

  it('403 quando operator tenta rota manager', async () => {
    const token = signToken(app, { ...SAMPLE, role: 'operator' });
    const res = await app.inject({
      method: 'GET',
      url: '/manager-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe('forbidden');
  });

  it('200 quando manager acessa rota manager', async () => {
    const token = signToken(app, { ...SAMPLE, role: 'manager' });
    const res = await app.inject({
      method: 'GET',
      url: '/manager-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it('200 quando owner acessa rota manager (hierarquia owner > manager)', async () => {
    const token = signToken(app, { ...SAMPLE, role: 'owner' });
    const res = await app.inject({
      method: 'GET',
      url: '/manager-only',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
  });
});
