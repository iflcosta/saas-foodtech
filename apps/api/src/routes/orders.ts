/**
 * Pedidos — `api-contracts.md` §6.
 *
 * Fatia 4b.2:
 *   POST /v1/menu/:slug/orders — criação pública, rate-limited (RF-1 + RNF §12)
 *   POST /v1/orders            — criação manual pelo operador
 *   GET  /v1/orders            — triagem (operator+)
 *   GET  /v1/orders/:id        — detalhe com itens e modificadores
 *
 * Regras críticas:
 *  - Preços NUNCA vêm do cliente; servidor recalcula tudo (RNF §12).
 *  - tenant_id vem do JWT nas rotas auth; do banco via slug nas públicas.
 *  - daily_sequence atribuído pelo servidor dentro da transação (ADR-Q10);
 *    retry automático em conflito de unicidade (máx 3 tentativas).
 *  - Frações de pizza: ratios devem somar 1,0 ± 0,001 (ADR-Q9).
 *  - Modificador rejeitado se o grupo não estiver vinculado ao produto.
 *  - UUIDv4 do pedido serve como chave de idempotência (RF-4.4).
 */
import type { DbClient } from '@saas-foodtech/db';
import {
  modifiers,
  orderItemModifiers,
  orderItems,
  orders,
  products,
  productModifierGroups,
  tenants,
} from '@saas-foodtech/db';
import {
  createOrderManualSchema,
  createOrderPublicSchema,
  type OrderItemInput,
  uuidSchema,
} from '@saas-foodtech/shared';
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sendError, sendValidationError } from '../lib/http.js';

export interface OrdersRoutesOpts {
  db: DbClient;
}

const slugParamSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/, 'slug inválido'),
});

const idParamSchema = z.object({ id: uuidSchema });

const listQuerySchema = z.object({
  status: z
    .enum([
      'pending',
      'confirmed',
      'preparing',
      'ready',
      'dispatched',
      'delivered',
      'cancelled',
    ])
    .optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'formato YYYY-MM-DD')
    .optional(),
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});

// ---------------------------------------------------------------------------
// Price resolution
// ---------------------------------------------------------------------------

interface ResolvedModifier {
  modifierId: string;
  modifierName: string;
  priceDeltaCents: number;
  isExclusion: boolean;
}

interface ResolvedItem {
  productId: string;
  productName: string;
  unitPriceCents: number;
  quantity: number;
  subtotalCents: number;
  notes?: string;
  pizzaFractions?: Array<{ product_id: string; ratio: number }>;
  modifiers: ResolvedModifier[];
}

interface BuildOk {
  ok: true;
  totalCents: number;
  items: ResolvedItem[];
}

interface BuildErr {
  ok: false;
  message: string;
  field: string;
}

function validateRatios(fractions: Array<{ ratio: number }>): boolean {
  const sum = fractions.reduce((acc, f) => acc + f.ratio, 0);
  return Math.abs(sum - 1.0) < 0.001;
}

/**
 * Valida os itens, busca produtos/modificadores no banco e calcula preços.
 * Executado antes da transação de escrita para reduzir hold de lock.
 */
async function resolveAndPrice(
  db: DbClient,
  tenantId: string,
  pizzaRule: 'most_expensive' | 'average',
  inputItems: OrderItemInput[],
): Promise<BuildOk | BuildErr> {
  // Collect all product IDs (outer + fraction flavours)
  const allProductIds = new Set<string>();
  for (const item of inputItems) {
    allProductIds.add(item.product_id);
    for (const frac of item.pizza_fractions ?? []) {
      allProductIds.add(frac.product_id);
    }
  }

  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      basePriceCents: products.basePriceCents,
      isPizza: products.isPizza,
    })
    .from(products)
    .where(
      and(
        eq(products.tenantId, tenantId),
        inArray(products.id, [...allProductIds]),
        isNull(products.deletedAt),
      ),
    );

  const productMap = new Map(productRows.map((p) => [p.id, p]));
  for (const id of allProductIds) {
    if (!productMap.has(id)) {
      return { ok: false, message: `Produto ${id} não encontrado`, field: 'items' };
    }
  }

  // Validate is_pizza when fractions are provided
  for (const item of inputItems) {
    const fracs = item.pizza_fractions;
    if (fracs && fracs.length > 0) {
      const base = productMap.get(item.product_id)!;
      if (!base.isPizza) {
        return {
          ok: false,
          message: `Produto ${item.product_id} não é uma pizza — frações não permitidas`,
          field: 'items',
        };
      }
    }
  }

  // Collect modifier IDs
  const allModifierIds = new Set<string>();
  for (const item of inputItems) {
    for (const modId of item.modifiers ?? []) {
      allModifierIds.add(modId);
    }
  }

  type ModInfo = {
    id: string;
    name: string;
    priceDeltaCents: number;
    isExclusion: boolean;
    modifierGroupId: string;
  };
  const modifierMap = new Map<string, ModInfo>();

  if (allModifierIds.size > 0) {
    const modifierRows = await db
      .select({
        id: modifiers.id,
        name: modifiers.name,
        priceDeltaCents: modifiers.priceDeltaCents,
        isExclusion: modifiers.isExclusion,
        modifierGroupId: modifiers.modifierGroupId,
      })
      .from(modifiers)
      .where(
        and(
          eq(modifiers.tenantId, tenantId),
          inArray(modifiers.id, [...allModifierIds]),
          isNull(modifiers.deletedAt),
        ),
      );
    for (const m of modifierRows) modifierMap.set(m.id, m);
    for (const id of allModifierIds) {
      if (!modifierMap.has(id)) {
        return { ok: false, message: `Modificador ${id} não encontrado`, field: 'items' };
      }
    }
  }

  // Fetch product → modifier-group links for validation
  const mainProductIds = [...new Set(inputItems.map((i) => i.product_id))];
  const productGroupMap = new Map<string, Set<string>>();
  if (allModifierIds.size > 0) {
    const linkRows = await db
      .select({
        productId: productModifierGroups.productId,
        modifierGroupId: productModifierGroups.modifierGroupId,
      })
      .from(productModifierGroups)
      .where(inArray(productModifierGroups.productId, mainProductIds));
    for (const link of linkRows) {
      if (!productGroupMap.has(link.productId)) {
        productGroupMap.set(link.productId, new Set());
      }
      productGroupMap.get(link.productId)!.add(link.modifierGroupId);
    }
  }

  // Build resolved items
  let totalCents = 0;
  const resolvedItems: ResolvedItem[] = [];

  for (const item of inputItems) {
    const fracs = item.pizza_fractions;

    // Validate fraction ratios
    if (fracs && fracs.length > 0 && !validateRatios(fracs)) {
      return {
        ok: false,
        message: 'Ratios das frações de pizza devem somar 1,0',
        field: 'items',
      };
    }

    // Validate each modifier belongs to a group linked to this product
    const resolvedMods: ResolvedModifier[] = [];
    for (const modId of item.modifiers ?? []) {
      const mod = modifierMap.get(modId)!;
      const linkedGroups = productGroupMap.get(item.product_id);
      if (!linkedGroups?.has(mod.modifierGroupId)) {
        return {
          ok: false,
          message: `Modificador ${modId} não pertence a nenhum grupo do produto ${item.product_id}`,
          field: 'items',
        };
      }
      resolvedMods.push({
        modifierId: mod.id,
        modifierName: mod.name,
        priceDeltaCents: mod.priceDeltaCents,
        isExclusion: mod.isExclusion,
      });
    }

    // Compute base unit price
    let unitPriceCents: number;
    if (fracs && fracs.length > 0) {
      const fracPrices = fracs.map((f) => ({
        price: productMap.get(f.product_id)!.basePriceCents,
        ratio: f.ratio,
      }));
      unitPriceCents =
        pizzaRule === 'most_expensive'
          ? Math.max(...fracPrices.map((fp) => fp.price))
          : Math.round(fracPrices.reduce((sum, fp) => sum + fp.price * fp.ratio, 0));
    } else {
      unitPriceCents = productMap.get(item.product_id)!.basePriceCents;
    }

    const modDelta = resolvedMods.reduce((s, m) => s + m.priceDeltaCents, 0);
    const subtotalCents = (unitPriceCents + modDelta) * item.quantity;

    if (subtotalCents < 0) {
      return {
        ok: false,
        message: `Subtotal negativo para produto ${item.product_id}`,
        field: 'items',
      };
    }

    totalCents += subtotalCents;
    resolvedItems.push({
      productId: item.product_id,
      productName: productMap.get(item.product_id)!.name,
      unitPriceCents,
      quantity: item.quantity,
      subtotalCents,
      notes: item.notes,
      pizzaFractions: fracs ?? undefined,
      modifiers: resolvedMods,
    });
  }

  return { ok: true, totalCents, items: resolvedItems };
}

// ---------------------------------------------------------------------------
// Order persistence
// ---------------------------------------------------------------------------

interface CreateOrderInput {
  id: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress?: string;
  paymentMethod: 'pix' | 'cash' | 'card_external';
}

interface CreateOrderResult {
  order: typeof orders.$inferSelect;
  created: boolean;
}

async function persistOrder(
  db: DbClient,
  tenantId: string,
  input: CreateOrderInput,
  contents: BuildOk,
): Promise<CreateOrderResult> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await db.transaction(async (tx) => {
        // Idempotency — same UUID from same tenant
        const existing = await tx
          .select()
          .from(orders)
          .where(and(eq(orders.id, input.id), eq(orders.tenantId, tenantId)))
          .limit(1);
        if (existing.length > 0) return { order: existing[0]!, created: false };

        // Assign daily_sequence — COALESCE(MAX, 100) + 1 means first order = 101
        const [seqRow] = await tx
          .select({
            maxSeq: sql<number>`COALESCE(MAX(${orders.dailySequence}), 100)`,
          })
          .from(orders)
          .where(
            and(
              eq(orders.tenantId, tenantId),
              sql`(${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date
                  = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date`,
            ),
          );
        const dailySequence = (seqRow?.maxSeq ?? 100) + 1;

        const [order] = await tx
          .insert(orders)
          .values({
            id: input.id,
            tenantId,
            dailySequence,
            status: 'pending',
            customerName: input.customerName,
            customerPhone: input.customerPhone,
            deliveryAddress: input.deliveryAddress,
            paymentMethod: input.paymentMethod,
            totalCents: contents.totalCents,
            deliveryFeeCents: 0,
          })
          .returning();

        for (const lineItem of contents.items) {
          const itemId = crypto.randomUUID();
          await tx.insert(orderItems).values({
            id: itemId,
            tenantId,
            orderId: input.id,
            productId: lineItem.productId,
            productName: lineItem.productName,
            unitPriceCents: lineItem.unitPriceCents,
            quantity: lineItem.quantity,
            subtotalCents: lineItem.subtotalCents,
            notes: lineItem.notes,
            pizzaFractions: lineItem.pizzaFractions ?? null,
          });

          for (const mod of lineItem.modifiers) {
            await tx.insert(orderItemModifiers).values({
              tenantId,
              orderItemId: itemId,
              modifierId: mod.modifierId,
              modifierName: mod.modifierName,
              priceDeltaCents: mod.priceDeltaCents,
              isExclusion: mod.isExclusion,
            });
          }
        }

        return { order: order!, created: true };
      });

      return result;
    } catch (err: unknown) {
      const pgErr = err as { code?: string; constraint?: string };
      // Retry only on daily_sequence unique conflict
      if (
        pgErr?.code === '23505' &&
        pgErr?.constraint === 'idx_orders_daily_seq' &&
        attempt < 2
      ) {
        continue;
      }
      throw err;
    }
  }

  throw new Error('Falha ao atribuir daily_sequence após 3 tentativas');
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

export const ordersRoutes: FastifyPluginAsync<OrdersRoutesOpts> = async (
  app,
  opts,
) => {
  const { db } = opts;
  const guard = [app.authenticate, app.requireRole('operator')];

  // POST /v1/menu/:slug/orders — public, rate-limited
  app.post<{ Params: { slug: string } }>(
    '/v1/menu/:slug/orders',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
    },
    async (req, reply) => {
      const paramParsed = slugParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return sendValidationError(reply, paramParsed.error);
      }

      const bodyParsed = createOrderPublicSchema.safeParse(req.body);
      if (!bodyParsed.success) {
        return sendValidationError(reply, bodyParsed.error);
      }

      // Resolve tenant by slug
      const [tenant] = await db
        .select({
          id: tenants.id,
          pizzaPriceRule: tenants.pizzaPriceRule,
        })
        .from(tenants)
        .where(eq(tenants.slug, paramParsed.data.slug))
        .limit(1);

      if (!tenant) {
        return sendError(reply, 404, 'not_found', 'Tenant não encontrado');
      }

      const input = bodyParsed.data;
      const pizzaRule = tenant.pizzaPriceRule as 'most_expensive' | 'average';

      const resolution = await resolveAndPrice(db, tenant.id, pizzaRule, input.items);
      if (!resolution.ok) {
        return reply.code(422).send({
          error: { code: 'validation_error', message: resolution.message, details: [{ field: resolution.field, issue: resolution.message }] },
        });
      }

      const { order, created } = await persistOrder(
        db,
        tenant.id,
        {
          id: input.id,
          customerName: input.customer_name,
          customerPhone: input.customer_phone,
          deliveryAddress: input.delivery_address,
          paymentMethod: input.payment_method,
        },
        resolution,
      );

      return reply.code(created ? 201 : 200).send({
        order: {
          id: order.id,
          daily_sequence: order.dailySequence,
          status: order.status,
          total_cents: order.totalCents,
        },
        tracking_token: order.id,
      });
    },
  );

  // POST /v1/orders — manual creation by operator
  app.post('/v1/orders', { preHandler: guard }, async (req, reply) => {
    const bodyParsed = createOrderManualSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return sendValidationError(reply, bodyParsed.error);
    }

    const tenantId = req.auth!.tenantId;

    // Fetch pizza_price_rule for this tenant
    const [tenant] = await db
      .select({ pizzaPriceRule: tenants.pizzaPriceRule })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    const pizzaRule = (tenant?.pizzaPriceRule ?? 'most_expensive') as
      | 'most_expensive'
      | 'average';

    const input = bodyParsed.data;

    const resolution = await resolveAndPrice(db, tenantId, pizzaRule, input.items);
    if (!resolution.ok) {
      return reply.code(422).send({
        error: { code: 'validation_error', message: resolution.message, details: [{ field: resolution.field, issue: resolution.message }] },
      });
    }

    const { order, created } = await persistOrder(
      db,
      tenantId,
      {
        id: input.id,
        customerName: input.customer_name,
        customerPhone: input.customer_phone,
        deliveryAddress: input.delivery_address,
        paymentMethod: input.payment_method,
      },
      resolution,
    );

    return reply.code(created ? 201 : 200).send({
      order: {
        id: order.id,
        daily_sequence: order.dailySequence,
        status: order.status,
        total_cents: order.totalCents,
      },
      tracking_token: order.id,
    });
  });

  // GET /v1/orders — list (operator+)
  app.get('/v1/orders', { preHandler: guard }, async (req, reply) => {
    const queryParsed = listQuerySchema.safeParse(req.query);
    if (!queryParsed.success) {
      return sendValidationError(reply, queryParsed.error);
    }

    const { status, date, limit, offset } = queryParsed.data;
    const tenantId = req.auth!.tenantId;

    const conditions = [eq(orders.tenantId, tenantId)];
    if (status) conditions.push(eq(orders.status, status));
    if (date) {
      conditions.push(
        sql`(${orders.createdAt} AT TIME ZONE 'America/Sao_Paulo')::date = ${date}::date`,
      );
    }

    const rows = await db
      .select({
        id: orders.id,
        daily_sequence: orders.dailySequence,
        status: orders.status,
        customer_name: orders.customerName,
        customer_phone: orders.customerPhone,
        payment_method: orders.paymentMethod,
        total_cents: orders.totalCents,
        delivery_fee_cents: orders.deliveryFeeCents,
        created_at: orders.createdAt,
        updated_at: orders.updatedAt,
      })
      .from(orders)
      .where(and(...conditions))
      .orderBy(desc(orders.createdAt))
      .limit(limit)
      .offset(offset);

    return reply.send({ orders: rows, limit, offset });
  });

  // GET /v1/orders/:id — detail with items + modifiers
  app.get<{ Params: { id: string } }>(
    '/v1/orders/:id',
    { preHandler: guard },
    async (req, reply) => {
      const paramParsed = idParamSchema.safeParse(req.params);
      if (!paramParsed.success) {
        return sendValidationError(reply, paramParsed.error);
      }

      const tenantId = req.auth!.tenantId;

      const [order] = await db
        .select({
          id: orders.id,
          daily_sequence: orders.dailySequence,
          status: orders.status,
          customer_name: orders.customerName,
          customer_phone: orders.customerPhone,
          delivery_address: orders.deliveryAddress,
          payment_method: orders.paymentMethod,
          total_cents: orders.totalCents,
          delivery_fee_cents: orders.deliveryFeeCents,
          notes: orders.notes,
          created_at: orders.createdAt,
          updated_at: orders.updatedAt,
        })
        .from(orders)
        .where(and(eq(orders.id, paramParsed.data.id), eq(orders.tenantId, tenantId)))
        .limit(1);

      if (!order) {
        return sendError(reply, 404, 'not_found', 'Pedido não encontrado');
      }

      const itemRows = await db
        .select({
          id: orderItems.id,
          product_id: orderItems.productId,
          product_name: orderItems.productName,
          unit_price_cents: orderItems.unitPriceCents,
          quantity: orderItems.quantity,
          subtotal_cents: orderItems.subtotalCents,
          notes: orderItems.notes,
          pizza_fractions: orderItems.pizzaFractions,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.createdAt));

      const modRows = await db
        .select({
          order_item_id: orderItemModifiers.orderItemId,
          modifier_id: orderItemModifiers.modifierId,
          modifier_name: orderItemModifiers.modifierName,
          price_delta_cents: orderItemModifiers.priceDeltaCents,
          is_exclusion: orderItemModifiers.isExclusion,
        })
        .from(orderItemModifiers)
        .where(
          inArray(
            orderItemModifiers.orderItemId,
            itemRows.map((i) => i.id),
          ),
        );

      const modsByItem = new Map<string, typeof modRows>();
      for (const m of modRows) {
        const list = modsByItem.get(m.order_item_id) ?? [];
        list.push(m);
        modsByItem.set(m.order_item_id, list);
      }

      const items = itemRows.map((item) => ({
        ...item,
        modifiers: (modsByItem.get(item.id) ?? []).map((m) => ({
          modifier_id: m.modifier_id,
          modifier_name: m.modifier_name,
          price_delta_cents: m.price_delta_cents,
          is_exclusion: m.is_exclusion,
        })),
      }));

      return reply.send({ ...order, items });
    },
  );
};
