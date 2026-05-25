/**
 * Teste de integração — fatia 4b.2 Ingestão de pedido.
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

// ---------------------------------------------------------------------------
// Helpers de seed
// ---------------------------------------------------------------------------

async function seedCategory(ctx: TestContext, name = 'Hamburgueres') {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/categories',
    headers: authHeaders(ctx.managerToken),
    payload: { name },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

async function seedProduct(
  ctx: TestContext,
  categoryId: string,
  opts: { name?: string; base_price_cents?: number; is_pizza?: boolean } = {},
) {
  const res = await ctx.app.inject({
    method: 'POST',
    url: '/v1/products',
    headers: authHeaders(ctx.managerToken),
    payload: {
      category_id: categoryId,
      name: opts.name ?? 'Produto',
      base_price_cents: opts.base_price_cents ?? 2000,
      is_pizza: opts.is_pizza ?? false,
    },
  });
  expect(res.statusCode).toBe(201);
  return res.json().id as string;
}

async function seedGroupWithModifier(
  ctx: TestContext,
  productId: string,
  modName = 'Bacon',
  priceDelta = 300,
) {
  const grpRes = await ctx.app.inject({
    method: 'POST',
    url: '/v1/modifier-groups',
    headers: authHeaders(ctx.managerToken),
    payload: { name: 'Adicionais', min_choices: 0, max_choices: 3 },
  });
  expect(grpRes.statusCode).toBe(201);
  const groupId = grpRes.json().id as string;

  const modRes = await ctx.app.inject({
    method: 'POST',
    url: `/v1/modifier-groups/${groupId}/modifiers`,
    headers: authHeaders(ctx.managerToken),
    payload: { name: modName, price_delta_cents: priceDelta },
  });
  expect(modRes.statusCode).toBe(201);
  const modifierId = modRes.json().id as string;

  await ctx.app.inject({
    method: 'PUT',
    url: `/v1/products/${productId}/modifier-groups`,
    headers: authHeaders(ctx.managerToken),
    payload: { modifier_group_ids: [groupId] },
  });

  return { groupId, modifierId };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe.skipIf(!run)('POST /v1/menu/:slug/orders — criação pública', () => {
  let ctx: TestContext;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await createTestContext(DATABASE_URL!);
    categoryId = await seedCategory(ctx);
    productId = await seedProduct(ctx, categoryId, {
      name: 'X-Burguer',
      base_price_cents: 2500,
    });
  });
  afterAll(() => destroyTestContext(ctx));

  it('404 para slug inexistente', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/menu/nao-existe-xyz/orders',
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'Teste',
        customer_phone: '+5511999999999',
        payment_method: 'pix',
        items: [{ product_id: productId, quantity: 1 }],
      },
    });
    expect(res.statusCode).toBe(404);
  });

  it('422 para slug inválido', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/menu/Slug%20Inválido/orders',
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'Teste',
        customer_phone: '+5511999999999',
        payment_method: 'pix',
        items: [{ product_id: productId, quantity: 1 }],
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it('cria pedido simples — preços recalculados, status pending', async () => {
    const orderId = crypto.randomUUID();
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: orderId,
        customer_name: 'Maria',
        customer_phone: '+5511999990001',
        payment_method: 'pix',
        items: [{ product_id: productId, quantity: 2 }],
      },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.order).toMatchObject({
      id: orderId,
      status: 'pending',
      total_cents: 5000, // 2500 * 2
    });
    expect(body.order.daily_sequence).toBeGreaterThanOrEqual(101);
    expect(body.tracking_token).toBe(orderId);
  });

  it('daily_sequence incrementa sequencialmente', async () => {
    const r1 = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'A',
        customer_phone: '+5511000000001',
        payment_method: 'cash',
        items: [{ product_id: productId, quantity: 1 }],
      },
    });
    const r2 = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'B',
        customer_phone: '+5511000000002',
        payment_method: 'cash',
        items: [{ product_id: productId, quantity: 1 }],
      },
    });
    expect(r1.statusCode).toBe(201);
    expect(r2.statusCode).toBe(201);
    expect(r2.json().order.daily_sequence).toBe(
      r1.json().order.daily_sequence + 1,
    );
  });

  it('idempotência — UUID repetido retorna 200 com mesmo pedido', async () => {
    const orderId = crypto.randomUUID();
    const payload = {
      id: orderId,
      customer_name: 'Idempotente',
      customer_phone: '+5511000000003',
      payment_method: 'pix',
      items: [{ product_id: productId, quantity: 1 }],
    };
    const first = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload,
    });
    expect(first.statusCode).toBe(201);
    const second = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload,
    });
    expect(second.statusCode).toBe(200);
    expect(second.json().order.id).toBe(orderId);
  });

  it('cria pedido com modificador — subtotal inclui delta', async () => {
    const { modifierId } = await seedGroupWithModifier(ctx, productId, 'Bacon', 300);

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'Com Bacon',
        customer_phone: '+5511000000004',
        payment_method: 'pix',
        items: [{ product_id: productId, quantity: 1, modifiers: [modifierId] }],
      },
    });
    expect(res.statusCode).toBe(201);
    // 2500 (base) + 300 (bacon) = 2800
    expect(res.json().order.total_cents).toBe(2800);
  });

  it('422 se produto pertence a outro tenant', async () => {
    const ctxB = await createTestContext(DATABASE_URL!);
    try {
      const catB = await seedCategory(ctxB);
      const prodB = await seedProduct(ctxB, catB, { base_price_cents: 1000 });
      const res = await ctx.app.inject({
        method: 'POST',
        url: `/v1/menu/${ctx.tenantSlug}/orders`,
        payload: {
          id: crypto.randomUUID(),
          customer_name: 'Hacker',
          customer_phone: '+5500000000000',
          payment_method: 'pix',
          items: [{ product_id: prodB, quantity: 1 }],
        },
      });
      expect(res.statusCode).toBe(422);
    } finally {
      await destroyTestContext(ctxB);
    }
  });

  it('422 se modificador não pertence ao grupo do produto', async () => {
    // Create another product with its own modifier group
    const catB = await seedCategory(ctx, 'Categoria B');
    const prodB = await seedProduct(ctx, catB, {
      name: 'Produto B',
      base_price_cents: 1500,
    });
    const { modifierId: otherModId } = await seedGroupWithModifier(
      ctx,
      prodB,
      'Queijo',
      200,
    );

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'Mod errado',
        customer_phone: '+5511000000005',
        payment_method: 'pix',
        // productId (X-Burguer) + modifier from prodB's group → invalid
        items: [
          { product_id: productId, quantity: 1, modifiers: [otherModId] },
        ],
      },
    });
    expect(res.statusCode).toBe(422);
  });
});

describe.skipIf(!run)('POST /v1/menu/:slug/orders — pizza fracionada', () => {
  let ctx: TestContext;
  let categoryId: string;
  let pizzaId1: string;
  let pizzaId2: string;

  beforeAll(async () => {
    ctx = await createTestContext(DATABASE_URL!);
    categoryId = await seedCategory(ctx, 'Pizzas');
    pizzaId1 = await seedProduct(ctx, categoryId, {
      name: 'Calabresa',
      base_price_cents: 3000,
      is_pizza: true,
    });
    pizzaId2 = await seedProduct(ctx, categoryId, {
      name: 'Mussarela',
      base_price_cents: 2800,
      is_pizza: true,
    });
  });
  afterAll(() => destroyTestContext(ctx));

  it('422 para frações que não somam 1,0', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'Fração errada',
        customer_phone: '+5511000000006',
        payment_method: 'pix',
        items: [
          {
            product_id: pizzaId1,
            quantity: 1,
            pizza_fractions: [
              { product_id: pizzaId1, ratio: 0.4 },
              { product_id: pizzaId2, ratio: 0.4 },
            ],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it('422 para produto não-pizza com frações', async () => {
    const catNormal = await seedCategory(ctx, 'Normal');
    const prodNormal = await seedProduct(ctx, catNormal, {
      name: 'Hambúrguer',
      base_price_cents: 2000,
      is_pizza: false,
    });

    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'Teste',
        customer_phone: '+5511000000007',
        payment_method: 'pix',
        items: [
          {
            product_id: prodNormal,
            quantity: 1,
            pizza_fractions: [
              { product_id: pizzaId1, ratio: 0.5 },
              { product_id: pizzaId2, ratio: 0.5 },
            ],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(422);
  });

  it('pizza most_expensive (padrão) — preço = sabor mais caro', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'Pizza cara',
        customer_phone: '+5511000000008',
        payment_method: 'pix',
        items: [
          {
            product_id: pizzaId1,
            quantity: 1,
            pizza_fractions: [
              { product_id: pizzaId1, ratio: 0.5 },
              { product_id: pizzaId2, ratio: 0.5 },
            ],
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    // most_expensive: max(3000, 2800) = 3000
    expect(res.json().order.total_cents).toBe(3000);
  });
});

describe.skipIf(!run)('POST /v1/orders — criação manual (operator)', () => {
  let ctx: TestContext;
  let categoryId: string;
  let productId: string;

  beforeAll(async () => {
    ctx = await createTestContext(DATABASE_URL!);
    categoryId = await seedCategory(ctx);
    productId = await seedProduct(ctx, categoryId, { base_price_cents: 1500 });
  });
  afterAll(() => destroyTestContext(ctx));

  it('401 sem autenticação', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/orders',
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'X',
        customer_phone: '+5511999999999',
        payment_method: 'cash',
        items: [{ product_id: productId, quantity: 1 }],
      },
    });
    expect(res.statusCode).toBe(401);
  });

  it('cria pedido manual com token de operator', async () => {
    const orderId = crypto.randomUUID();
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/v1/orders',
      headers: authHeaders(ctx.operatorToken),
      payload: {
        id: orderId,
        customer_name: 'João',
        customer_phone: '+5511999999999',
        payment_method: 'cash',
        items: [{ product_id: productId, quantity: 3 }],
      },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().order).toMatchObject({
      id: orderId,
      status: 'pending',
      total_cents: 4500, // 1500 * 3
    });
  });
});

describe.skipIf(!run)('GET /v1/orders — triagem e detalhe', () => {
  let ctx: TestContext;
  let categoryId: string;
  let productId: string;
  let modifierId: string;
  let createdOrderId: string;

  beforeAll(async () => {
    ctx = await createTestContext(DATABASE_URL!);
    categoryId = await seedCategory(ctx);
    productId = await seedProduct(ctx, categoryId, {
      name: 'Frango Grelhado',
      base_price_cents: 1800,
    });
    const grp = await seedGroupWithModifier(ctx, productId, 'Sem cebola', -100);
    modifierId = grp.modifierId;

    // Create one order for subsequent tests
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/v1/menu/${ctx.tenantSlug}/orders`,
      payload: {
        id: crypto.randomUUID(),
        customer_name: 'Ana',
        customer_phone: '+5511100000000',
        payment_method: 'pix',
        items: [
          {
            product_id: productId,
            quantity: 2,
            modifiers: [modifierId],
            notes: 'sem alho',
          },
        ],
      },
    });
    expect(res.statusCode).toBe(201);
    createdOrderId = res.json().order.id;
  });
  afterAll(() => destroyTestContext(ctx));

  it('GET /v1/orders lista pedidos do tenant', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/orders',
      headers: authHeaders(ctx.operatorToken),
    });
    expect(res.statusCode).toBe(200);
    const ids = res.json().orders.map((o: { id: string }) => o.id);
    expect(ids).toContain(createdOrderId);
  });

  it('GET /v1/orders?status=pending filtra por estado', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: '/v1/orders?status=pending',
      headers: authHeaders(ctx.operatorToken),
    });
    expect(res.statusCode).toBe(200);
    const statuses = res
      .json()
      .orders.map((o: { status: string }) => o.status);
    expect(statuses.every((s: string) => s === 'pending')).toBe(true);
  });

  it('GET /v1/orders/:id retorna detalhe com itens e modificadores', async () => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/v1/orders/${createdOrderId}`,
      headers: authHeaders(ctx.operatorToken),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    // total = (1800 - 100) * 2 = 3400
    expect(body.total_cents).toBe(3400);
    expect(body.items).toHaveLength(1);

    const item = body.items[0];
    expect(item.product_name).toBe('Frango Grelhado');
    expect(item.quantity).toBe(2);
    expect(item.unit_price_cents).toBe(1800);
    // subtotal = (1800 - 100) * 2 = 3400
    expect(item.subtotal_cents).toBe(3400);
    expect(item.notes).toBe('sem alho');

    expect(item.modifiers).toHaveLength(1);
    expect(item.modifiers[0]).toMatchObject({
      price_delta_cents: -100,
      is_exclusion: false,
    });
  });

  it('GET /v1/orders/:id retorna 404 para pedido de outro tenant', async () => {
    const ctxB = await createTestContext(DATABASE_URL!);
    try {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/v1/orders/${createdOrderId}`,
        headers: authHeaders(ctxB.operatorToken),
      });
      expect(res.statusCode).toBe(404);
    } finally {
      await destroyTestContext(ctxB);
    }
  });
});
