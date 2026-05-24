/**
 * Teste de integração — CRUD de produtos + PUT modifier-groups.
 * Skipped sem `INTEGRATION_DATABASE_URL`.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { LightMyRequestResponse } from 'fastify';
import {
  authHeaders,
  createTestContext,
  destroyTestContext,
  type TestContext,
} from '../test-utils/seed.js';

const DATABASE_URL = process.env.INTEGRATION_DATABASE_URL;
const run = Boolean(DATABASE_URL);

const createCategory = async (
  ctx: TestContext,
  payload: { name: string; print_queue?: 'kitchen' | 'bar' },
): Promise<string> => {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/categories',
    headers: authHeaders(ctx.managerToken),
    payload,
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
};

const createGroup = async (
  ctx: TestContext,
  name: string,
): Promise<string> => {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/modifier-groups',
    headers: authHeaders(ctx.managerToken),
    payload: { name },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
};

describe.skipIf(!run)('/v1/products', () => {
  let ctx: TestContext;
  let categoryId: string;

  beforeAll(async () => {
    ctx = await createTestContext(DATABASE_URL!);
    categoryId = await createCategory(ctx, { name: 'Hambúrgueres' });
  });
  afterAll(async () => {
    await destroyTestContext(ctx);
  });

  it('roundtrip CRUD', async () => {
    const created: LightMyRequestResponse = await ctx.app.inject({
      method: 'POST',
      url: '/v1/products',
      headers: authHeaders(ctx.managerToken),
      payload: {
        category_id: categoryId,
        name: 'Cheeseburger',
        base_price_cents: 2500,
        description: 'Carne + queijo + alface',
      },
    });
    expect(created.statusCode).toBe(201);
    const p = created.json();
    expect(p).toMatchObject({
      category_id: categoryId,
      name: 'Cheeseburger',
      base_price_cents: 2500,
    });

    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/products/${p.id}`,
      headers: authHeaders(ctx.managerToken),
      payload: { base_price_cents: 2700 },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().base_price_cents).toBe(2700);

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/products/${p.id}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(del.statusCode).toBe(204);

    const after = await ctx.app.inject({
      method: 'GET',
      url: `/v1/products/${p.id}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(after.statusCode).toBe(404);
  });

  it('422 quando base_price_cents é negativo', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/products',
      headers: authHeaders(ctx.managerToken),
      payload: {
        category_id: categoryId,
        name: 'Negativo',
        base_price_cents: -100,
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it('422 quando category_id é de outro tenant', async () => {
    const ctxB = await createTestContext(DATABASE_URL!);
    try {
      const otherCat = await createCategory(ctxB, { name: 'Outro tenant' });
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/v1/products',
        headers: authHeaders(ctx.managerToken),
        payload: {
          category_id: otherCat,
          name: 'X',
          base_price_cents: 1000,
        },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json().error.details[0].field).toBe('category_id');
    } finally {
      await destroyTestContext(ctxB);
    }
  });

  it('filtra ?category_id=', async () => {
    const cat2 = await createCategory(ctx, { name: 'Bebidas' });
    await ctx.app.inject({
      method: 'POST',
      url: '/v1/products',
      headers: authHeaders(ctx.managerToken),
      payload: { category_id: cat2, name: 'Coca', base_price_cents: 700 },
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/products?category_id=${cat2}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(res.statusCode).toBe(200);
    const list = res.json().products as Array<{ category_id: string }>;
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((p) => p.category_id === cat2)).toBe(true);
  });

  describe('PUT /v1/products/:id/modifier-groups', () => {
    let productId: string;

    beforeAll(async () => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/v1/products',
        headers: authHeaders(ctx.managerToken),
        payload: {
          category_id: categoryId,
          name: 'Para attach',
          base_price_cents: 1500,
        },
      });
      productId = res.json().id;
    });

    it('attach + replace + clear', async () => {
      const g1 = await createGroup(ctx, 'Ponto da carne');
      const g2 = await createGroup(ctx, 'Adicionais');

      // attach
      let res = await ctx.app.inject({
        method: 'PUT',
        url: `/v1/products/${productId}/modifier-groups`,
        headers: authHeaders(ctx.managerToken),
        payload: { modifier_group_ids: [g1, g2] },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().modifier_group_ids).toEqual([g1, g2]);

      // replace
      res = await ctx.app.inject({
        method: 'PUT',
        url: `/v1/products/${productId}/modifier-groups`,
        headers: authHeaders(ctx.managerToken),
        payload: { modifier_group_ids: [g2] },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().modifier_group_ids).toEqual([g2]);

      // clear
      res = await ctx.app.inject({
        method: 'PUT',
        url: `/v1/products/${productId}/modifier-groups`,
        headers: authHeaders(ctx.managerToken),
        payload: { modifier_group_ids: [] },
      });
      expect(res.statusCode).toBe(200);
      expect(res.json().modifier_group_ids).toEqual([]);
    });

    it('422 se algum group_id for de outro tenant', async () => {
      const ctxB = await createTestContext(DATABASE_URL!);
      try {
        const otherGroup = await createGroup(ctxB, 'Outro tenant');
        const res = await ctx.app.inject({
          method: 'PUT',
          url: `/v1/products/${productId}/modifier-groups`,
          headers: authHeaders(ctx.managerToken),
          payload: { modifier_group_ids: [otherGroup] },
        });
        expect(res.statusCode).toBe(422);
      } finally {
        await destroyTestContext(ctxB);
      }
    });
  });
});
