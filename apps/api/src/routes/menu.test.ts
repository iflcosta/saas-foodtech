/**
 * Teste de integração — cardápio público.
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

describe.skipIf(!run)('GET /v1/menu/:slug', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext(DATABASE_URL!);
  });
  afterAll(async () => {
    await destroyTestContext(ctx);
  });

  it('404 para slug inexistente', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/menu/nao-existe-mesmo-xyz123',
    });
    expect(res.statusCode).toBe(404);
  });

  it('422 para slug com caracteres inválidos', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/menu/Slug%20Com%20Espa%C3%A7o',
    });
    expect(res.statusCode).toBe(422);
  });

  it('cardápio vazio: devolve tenant + categories: []', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/menu/${ctx.tenantSlug}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      tenant: { pizza_price_rule: 'most_expensive' },
      categories: [],
    });
  });

  it('cardápio cheio: tenant → categories → products → modifier_groups → modifiers', async () => {
    // seed
    const catRes = await ctx.app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Lanches', sort_order: 1 },
    });
    const catId = catRes.json().id;

    const groupRes = await ctx.app.inject({
      method: 'POST',
      url: '/v1/modifier-groups',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Adicionais', min_choices: 0, max_choices: 3 },
    });
    const groupId = groupRes.json().id;

    await ctx.app.inject({
      method: 'POST',
      url: `/v1/modifier-groups/${groupId}/modifiers`,
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Bacon', price_delta_cents: 300 },
    });

    const prodRes = await ctx.app.inject({
      method: 'POST',
      url: '/v1/products',
      headers: authHeaders(ctx.managerToken),
      payload: {
        category_id: catId,
        name: 'X-Burguer',
        base_price_cents: 2500,
      },
    });
    const prodId = prodRes.json().id;

    await ctx.app.inject({
      method: 'PUT',
      url: `/v1/products/${prodId}/modifier-groups`,
      headers: authHeaders(ctx.managerToken),
      payload: { modifier_group_ids: [groupId] },
    });

    // leitura pública
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/menu/${ctx.tenantSlug}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.categories).toHaveLength(1);
    const cat = body.categories[0];
    expect(cat.name).toBe('Lanches');
    expect(cat.products).toHaveLength(1);
    const prod = cat.products[0];
    expect(prod).toMatchObject({
      id: prodId,
      name: 'X-Burguer',
      base_price_cents: 2500,
    });
    expect(prod.modifier_groups).toHaveLength(1);
    const group = prod.modifier_groups[0];
    expect(group.id).toBe(groupId);
    expect(group.modifiers).toHaveLength(1);
    expect(group.modifiers[0].name).toBe('Bacon');
  });

  it('itens deletados não aparecem no cardápio público', async () => {
    const catRes = await ctx.app.inject({
      method: 'POST',
      url: '/v1/categories',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Será deletada' },
    });
    const catId = catRes.json().id;

    await ctx.app.inject({
      method: 'POST',
      url: '/v1/products',
      headers: authHeaders(ctx.managerToken),
      payload: {
        category_id: catId,
        name: 'Não pode aparecer (categoria deletada)',
        base_price_cents: 100,
      },
    });

    await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/categories/${catId}`,
      headers: authHeaders(ctx.managerToken),
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/menu/${ctx.tenantSlug}`,
    });
    expect(res.statusCode).toBe(200);
    const names = res
      .json()
      .categories.map((c: { name: string }) => c.name);
    expect(names).not.toContain('Será deletada');
  });
});
