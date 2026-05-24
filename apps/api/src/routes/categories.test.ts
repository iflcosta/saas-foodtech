/**
 * Teste de integração — CRUD de categorias.
 * Skipped sem `INTEGRATION_DATABASE_URL`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createTestContext,
  destroyTestContext,
  type TestContext,
} from '../test-utils/seed.js';

const DATABASE_URL = process.env.INTEGRATION_DATABASE_URL;
const run = Boolean(DATABASE_URL);

describe.skipIf(!run)('/v1/categories', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext(DATABASE_URL!);
  });
  afterAll(async () => {
    await destroyTestContext(ctx);
  });

  it('401 sem token', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/categories',
    });
    expect(res.statusCode).toBe(401);
  });

  it('403 quando operator tenta criar (manager+)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: authHeaders(ctx.operatorToken),
      payload: { name: 'Bebidas' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('roundtrip: cria, lê, lista, atualiza, soft-deleta', async () => {
    const create = await ctx.app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Bebidas', print_queue: 'bar', sort_order: 1 },
    });
    expect(create.statusCode).toBe(201);
    const created = create.json();
    expect(created).toMatchObject({
      name: 'Bebidas',
      print_queue: 'bar',
      sort_order: 1,
    });

    const get = await ctx.app.inject({
      method: 'GET',
      url: `/v1/categories/${created.id}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(get.statusCode).toBe(200);
    expect(get.json().id).toBe(created.id);

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/v1/categories',
      headers: authHeaders(ctx.managerToken),
    });
    expect(list.statusCode).toBe(200);
    const body = list.json();
    expect(body.categories.map((c: { id: string }) => c.id)).toContain(
      created.id,
    );

    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/categories/${created.id}`,
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Refrigerantes' },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().name).toBe('Refrigerantes');

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/categories/${created.id}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(del.statusCode).toBe(204);

    const afterDel = await ctx.app.inject({
      method: 'GET',
      url: `/v1/categories/${created.id}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(afterDel.statusCode).toBe(404);
  });

  it('422 com print_queue inválido', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'X', print_queue: 'kitchenz' },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_error');
  });

  it('422 com campo extra (schema strict)', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'X', tenant_id: 'tentativa-injecao' },
    });
    expect(res.statusCode).toBe(422);
  });

  it('isolamento cross-tenant: A não enxerga categorias de B', async () => {
    const ctxB = await createTestContext(DATABASE_URL!);
    try {
      const create = await ctxB.app.inject({
        method: 'POST',
        url: '/v1/categories',
        headers: authHeaders(ctxB.managerToken),
        payload: { name: 'Só do B' },
      });
      expect(create.statusCode).toBe(201);
      const bId = create.json().id;

      // Tenant A tenta GET pelo id → 404
      const getFromA = await ctx.app.inject({
        method: 'GET',
        url: `/v1/categories/${bId}`,
        headers: authHeaders(ctx.managerToken),
      });
      expect(getFromA.statusCode).toBe(404);

      // Tenant A lista → não inclui id de B
      const listFromA = await ctx.app.inject({
        method: 'GET',
        url: '/v1/categories',
        headers: authHeaders(ctx.managerToken),
      });
      const ids = listFromA.json().categories.map((c: { id: string }) => c.id);
      expect(ids).not.toContain(bId);
    } finally {
      await destroyTestContext(ctxB);
    }
  });
});
