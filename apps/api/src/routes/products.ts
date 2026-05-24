/**
 * Cardápio admin — produtos (`api-contracts.md` §4).
 *
 * `category_id` é validado contra o mesmo tenant (`req.auth.tenantId`) e exige
 * categoria ativa (`deleted_at IS NULL`). Apontamento para categoria órfã ou de
 * outro tenant retorna 422 `validation_error`. Soft-delete preserva snapshots
 * históricos em `order_items.product_name` / `order_items.unit_price_cents`.
 */
import type { DbClient } from '@saas-foodtech/db';
import {
  categories,
  modifierGroups,
  productModifierGroups,
  products,
} from '@saas-foodtech/db';
import {
  createProductSchema,
  setProductModifierGroupsSchema,
  updateProductSchema,
  uuidSchema,
} from '@saas-foodtech/shared';
import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  paginationSchema,
  sendError,
  sendValidationError,
} from '../lib/http.js';

interface ProductsRoutesOpts {
  db: DbClient;
}

const idParamSchema = z.object({ id: uuidSchema });

const productColumns = {
  id: products.id,
  category_id: products.categoryId,
  name: products.name,
  description: products.description,
  base_price_cents: products.basePriceCents,
  is_pizza: products.isPizza,
  sort_order: products.sortOrder,
  created_at: products.createdAt,
  updated_at: products.updatedAt,
} as const;

async function categoryBelongsToTenant(
  db: DbClient,
  categoryId: string,
  tenantId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        eq(categories.tenantId, tenantId),
        isNull(categories.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export const productsRoutes: FastifyPluginAsync<ProductsRoutesOpts> = async (
  app,
  opts,
) => {
  const guard = [app.authenticate, app.requireRole('manager')];

  // GET /v1/products  (lista; aceita ?category_id= opcional)
  app.get('/v1/products', { preHandler: guard }, async (req, reply) => {
    const filterSchema = paginationSchema.extend({
      category_id: uuidSchema.optional(),
    });
    const queryParsed = filterSchema.safeParse(req.query);
    if (!queryParsed.success) return sendValidationError(reply, queryParsed.error);

    const tenantId = req.auth!.tenantId;
    const { limit, offset, category_id } = queryParsed.data;

    const conditions = [
      eq(products.tenantId, tenantId),
      isNull(products.deletedAt),
    ];
    if (category_id) conditions.push(eq(products.categoryId, category_id));

    const rows = await opts.db
      .select(productColumns)
      .from(products)
      .where(and(...conditions))
      .orderBy(asc(products.sortOrder), asc(products.name))
      .limit(limit)
      .offset(offset);

    return { products: rows, pagination: { limit, offset } };
  });

  // POST /v1/products
  app.post('/v1/products', { preHandler: guard }, async (req, reply) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const tenantId = req.auth!.tenantId;
    const belongs = await categoryBelongsToTenant(
      opts.db,
      parsed.data.category_id,
      tenantId,
    );
    if (!belongs) {
      return sendError(
        reply,
        422,
        'validation_error',
        'Categoria inválida para este tenant.',
        [{ field: 'category_id', issue: 'categoria inexistente ou de outro tenant' }],
      );
    }

    const [row] = await opts.db
      .insert(products)
      .values({
        tenantId,
        categoryId: parsed.data.category_id,
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        basePriceCents: parsed.data.base_price_cents,
        isPizza: parsed.data.is_pizza,
        sortOrder: parsed.data.sort_order,
      })
      .returning(productColumns);

    return reply.code(201).send(row);
  });

  // GET /v1/products/:id
  app.get('/v1/products/:id', { preHandler: guard }, async (req, reply) => {
    const idParsed = idParamSchema.safeParse(req.params);
    if (!idParsed.success) return sendValidationError(reply, idParsed.error);

    const tenantId = req.auth!.tenantId;
    const [row] = await opts.db
      .select(productColumns)
      .from(products)
      .where(
        and(
          eq(products.id, idParsed.data.id),
          eq(products.tenantId, tenantId),
          isNull(products.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      return sendError(reply, 404, 'not_found', 'Produto não encontrado.');
    }
    return row;
  });

  // PATCH /v1/products/:id
  app.patch('/v1/products/:id', { preHandler: guard }, async (req, reply) => {
    const idParsed = idParamSchema.safeParse(req.params);
    if (!idParsed.success) return sendValidationError(reply, idParsed.error);

    const bodyParsed = updateProductSchema.safeParse(req.body);
    if (!bodyParsed.success) return sendValidationError(reply, bodyParsed.error);

    const tenantId = req.auth!.tenantId;

    if (bodyParsed.data.category_id !== undefined) {
      const belongs = await categoryBelongsToTenant(
        opts.db,
        bodyParsed.data.category_id,
        tenantId,
      );
      if (!belongs) {
        return sendError(
          reply,
          422,
          'validation_error',
          'Categoria inválida para este tenant.',
          [
            {
              field: 'category_id',
              issue: 'categoria inexistente ou de outro tenant',
            },
          ],
        );
      }
    }

    const updates: Record<string, unknown> = { updatedAt: sql`now()` };
    if (bodyParsed.data.category_id !== undefined)
      updates.categoryId = bodyParsed.data.category_id;
    if (bodyParsed.data.name !== undefined) updates.name = bodyParsed.data.name;
    if (bodyParsed.data.description !== undefined)
      updates.description = bodyParsed.data.description ?? null;
    if (bodyParsed.data.base_price_cents !== undefined)
      updates.basePriceCents = bodyParsed.data.base_price_cents;
    if (bodyParsed.data.is_pizza !== undefined)
      updates.isPizza = bodyParsed.data.is_pizza;
    if (bodyParsed.data.sort_order !== undefined)
      updates.sortOrder = bodyParsed.data.sort_order;

    const [row] = await opts.db
      .update(products)
      .set(updates)
      .where(
        and(
          eq(products.id, idParsed.data.id),
          eq(products.tenantId, tenantId),
          isNull(products.deletedAt),
        ),
      )
      .returning(productColumns);

    if (!row) {
      return sendError(reply, 404, 'not_found', 'Produto não encontrado.');
    }
    return row;
  });

  // PUT /v1/products/:id/modifier-groups  (replace o conjunto vinculado)
  app.put(
    '/v1/products/:id/modifier-groups',
    { preHandler: guard },
    async (req, reply) => {
      const idParsed = idParamSchema.safeParse(req.params);
      if (!idParsed.success) return sendValidationError(reply, idParsed.error);

      const bodyParsed = setProductModifierGroupsSchema.safeParse(req.body);
      if (!bodyParsed.success)
        return sendValidationError(reply, bodyParsed.error);

      const tenantId = req.auth!.tenantId;
      const productId = idParsed.data.id;

      // 1) produto precisa existir no tenant e estar ativo
      const [product] = await opts.db
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.id, productId),
            eq(products.tenantId, tenantId),
            isNull(products.deletedAt),
          ),
        )
        .limit(1);
      if (!product) {
        return sendError(reply, 404, 'not_found', 'Produto não encontrado.');
      }

      const ids = bodyParsed.data.modifier_group_ids;

      // 2) todos os grupos têm que ser do mesmo tenant e ativos
      if (ids.length > 0) {
        const owned = await opts.db
          .select({ id: modifierGroups.id })
          .from(modifierGroups)
          .where(
            and(
              inArray(modifierGroups.id, ids),
              eq(modifierGroups.tenantId, tenantId),
              isNull(modifierGroups.deletedAt),
            ),
          );
        if (owned.length !== new Set(ids).size) {
          return sendError(
            reply,
            422,
            'validation_error',
            'Um ou mais grupos de modificadores são inválidos para este tenant.',
            [
              {
                field: 'modifier_group_ids',
                issue: 'grupo inexistente, deletado ou de outro tenant',
              },
            ],
          );
        }
      }

      // 3) replace transacional
      await opts.db.transaction(async (tx) => {
        await tx
          .delete(productModifierGroups)
          .where(eq(productModifierGroups.productId, productId));
        if (ids.length > 0) {
          await tx.insert(productModifierGroups).values(
            ids.map((modifierGroupId, idx) => ({
              productId,
              modifierGroupId,
              sortOrder: idx,
            })),
          );
        }
      });

      return { product_id: productId, modifier_group_ids: ids };
    },
  );

  // DELETE /v1/products/:id  (soft delete)
  app.delete('/v1/products/:id', { preHandler: guard }, async (req, reply) => {
    const idParsed = idParamSchema.safeParse(req.params);
    if (!idParsed.success) return sendValidationError(reply, idParsed.error);

    const tenantId = req.auth!.tenantId;
    const [row] = await opts.db
      .update(products)
      .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
      .where(
        and(
          eq(products.id, idParsed.data.id),
          eq(products.tenantId, tenantId),
          isNull(products.deletedAt),
        ),
      )
      .returning({ id: products.id });

    if (!row) {
      return sendError(reply, 404, 'not_found', 'Produto não encontrado.');
    }
    return reply.code(204).send();
  });
};
