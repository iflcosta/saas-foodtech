/**
 * Teste de integração — CRUD de modifier-groups + modifiers aninhados.
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

describe.skipIf(!run)('/v1/modifier-groups', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext(DATABASE_URL!);
  });
  afterAll(async () => {
    await destroyTestContext(ctx);
  });

  it('roundtrip de grupo + modifier aninhado', async () => {
    const createGroup = await ctx.app.inject({
      method: 'POST',
      url: '/v1/modifier-groups',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Adicionais', min_choices: 0, max_choices: 5 },
    });
    expect(createGroup.statusCode).toBe(201);
    const groupId = createGroup.json().id;

    const addMod = await ctx.app.inject({
      method: 'POST',
      url: `/v1/modifier-groups/${groupId}/modifiers`,
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Bacon', price_delta_cents: 300 },
    });
    expect(addMod.statusCode).toBe(201);
    const modId = addMod.json().id;

    const getGroup = await ctx.app.inject({
      method: 'GET',
      url: `/v1/modifier-groups/${groupId}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(getGroup.statusCode).toBe(200);
    const body = getGroup.json();
    expect(body.modifiers).toHaveLength(1);
    expect(body.modifiers[0]).toMatchObject({
      id: modId,
      name: 'Bacon',
      price_delta_cents: 300,
    });

    // remove modifier (soft delete)
    const removeMod = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/modifier-groups/${groupId}/modifiers/${modId}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(removeMod.statusCode).toBe(204);

    const afterRemove = await ctx.app.inject({
      method: 'GET',
      url: `/v1/modifier-groups/${groupId}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(afterRemove.json().modifiers).toHaveLength(0);
  });

  it('422 quando min_choices > max_choices na criação', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/modifier-groups',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Inválido', min_choices: 3, max_choices: 1 },
    });
    expect(res.statusCode).toBe(422);
  });

  it('422 quando PATCH viola min/max', async () => {
    const create = await ctx.app.inject({
      method: 'POST',
      url: '/v1/modifier-groups',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'OK', min_choices: 0, max_choices: 1 },
    });
    const id = create.json().id;

    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: `/v1/modifier-groups/${id}`,
      headers: authHeaders(ctx.managerToken),
      payload: { min_choices: 5, max_choices: 2 },
    });
    expect(patch.statusCode).toBe(422);
  });

  it('soft-delete do grupo torna invisível em GET e LIST', async () => {
    const create = await ctx.app.inject({
      method: 'POST',
      url: '/v1/modifier-groups',
      headers: authHeaders(ctx.managerToken),
      payload: { name: 'Para deletar' },
    });
    const id = create.json().id;

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: `/v1/modifier-groups/${id}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(del.statusCode).toBe(204);

    const get = await ctx.app.inject({
      method: 'GET',
      url: `/v1/modifier-groups/${id}`,
      headers: authHeaders(ctx.managerToken),
    });
    expect(get.statusCode).toBe(404);

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/v1/modifier-groups',
      headers: authHeaders(ctx.managerToken),
    });
    const ids = list.json().modifier_groups.map((g: { id: string }) => g.id);
    expect(ids).not.toContain(id);
  });

  it('404 ao adicionar modifier em grupo de outro tenant', async () => {
    const ctxB = await createTestContext(DATABASE_URL!);
    try {
      const create = await ctxB.app.inject({
        method: 'POST',
        url: '/v1/modifier-groups',
        headers: authHeaders(ctxB.managerToken),
        payload: { name: 'só do B' },
      });
      const idB = create.json().id;

      const res = await ctx.app.inject({
        method: 'POST',
        url: `/v1/modifier-groups/${idB}/modifiers`,
        headers: authHeaders(ctx.managerToken),
        payload: { name: 'tentativa' },
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await destroyTestContext(ctxB);
    }
  });
});
