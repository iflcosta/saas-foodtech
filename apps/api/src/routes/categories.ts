/**
 * Cardápio admin — categorias (`api-contracts.md` §4).
 *
 * Todas as rotas exigem `manager`+. Toda query é escopada por `req.auth.tenantId`
 * — RNF-1. `DELETE` é soft-delete (`deleted_at = now()`) para preservar
 * snapshots históricos em `order_items.product_name`.
 *
 * As respostas usam `snake_case` (convenção de `api-contracts.md` §1).
 */
import type { DbClient } from '@saas-foodtech/db';
import { categories } from '@saas-foodtech/db';
import {
  createCategorySchema,
  updateCategorySchema,
  uuidSchema,
} from '@saas-foodtech/shared';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import {
  paginationSchema,
  sendError,
  sendValidationError,
} from '../lib/http.js';

interface CategoriesRoutesOpts {
  db: DbClient;
}

const idParamSchema = z.object({ id: uuidSchema });

const categoryColumns = {
  id: categories.id,
  name: categories.name,
  print_queue: categories.printQueue,
  sort_order: categories.sortOrder,
  created_at: categories.createdAt,
  updated_at: categories.updatedAt,
} as const;

export const categoriesRoutes: FastifyPluginAsync<
  CategoriesRoutesOpts
> = async (app, opts) => {
  const guard = [app.authenticate, app.requireRole('manager')];

  // GET /v1/categories
  app.get('/v1/categories', { preHandler: guard }, async (req, reply) => {
    const pageParsed = paginationSchema.safeParse(req.query);
    if (!pageParsed.success) return sendValidationError(reply, pageParsed.error);

    const { limit, offset } = pageParsed.data;
    const tenantId = req.auth!.tenantId;

    const rows = await opts.db
      .select(categoryColumns)
      .from(categories)
      .where(
        and(eq(categories.tenantId, tenantId), isNull(categories.deletedAt)),
      )
      .orderBy(asc(categories.sortOrder), asc(categories.name))
      .limit(limit)
      .offset(offset);

    return { categories: rows, pagination: { limit, offset } };
  });

  // POST /v1/categories
  app.post('/v1/categories', { preHandler: guard }, async (req, reply) => {
    const parsed = createCategorySchema.safeParse(req.body);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    const tenantId = req.auth!.tenantId;
    const [row] = await opts.db
      .insert(categories)
      .values({
        tenantId,
        name: parsed.data.name,
        printQueue: parsed.data.print_queue,
        sortOrder: parsed.data.sort_order,
      })
      .returning(categoryColumns);

    return reply.code(201).send(row);
  });

  // GET /v1/categories/:id
  app.get('/v1/categories/:id', { preHandler: guard }, async (req, reply) => {
    const idParsed = idParamSchema.safeParse(req.params);
    if (!idParsed.success) return sendValidationError(reply, idParsed.error);

    const tenantId = req.auth!.tenantId;
    const [row] = await opts.db
      .select(categoryColumns)
      .from(categories)
      .where(
        and(
          eq(categories.id, idParsed.data.id),
          eq(categories.tenantId, tenantId),
          isNull(categories.deletedAt),
        ),
      )
      .limit(1);

    if (!row) {
      return sendError(reply, 404, 'not_found', 'Categoria não encontrada.');
    }
    return row;
  });

  // PATCH /v1/categories/:id
  app.patch('/v1/categories/:id', { preHandler: guard }, async (req, reply) => {
    const idParsed = idParamSchema.safeParse(req.params);
    if (!idParsed.success) return sendValidationError(reply, idParsed.error);

    const bodyParsed = updateCategorySchema.safeParse(req.body);
    if (!bodyParsed.success) return sendValidationError(reply, bodyParsed.error);

    const updates: Record<string, unknown> = { updatedAt: sql`now()` };
    if (bodyParsed.data.name !== undefined) updates.name = bodyParsed.data.name;
    if (bodyParsed.data.print_queue !== undefined)
      updates.printQueue = bodyParsed.data.print_queue;
    if (bodyParsed.data.sort_order !== undefined)
      updates.sortOrder = bodyParsed.data.sort_order;

    const tenantId = req.auth!.tenantId;
    const [row] = await opts.db
      .update(categories)
      .set(updates)
      .where(
        and(
          eq(categories.id, idParsed.data.id),
          eq(categories.tenantId, tenantId),
          isNull(categories.deletedAt),
        ),
      )
      .returning(categoryColumns);

    if (!row) {
      return sendError(reply, 404, 'not_found', 'Categoria não encontrada.');
    }
    return row;
  });

  // DELETE /v1/categories/:id  (soft delete)
  app.delete(
    '/v1/categories/:id',
    { preHandler: guard },
    async (req, reply) => {
      const idParsed = idParamSchema.safeParse(req.params);
      if (!idParsed.success) return sendValidationError(reply, idParsed.error);

      const tenantId = req.auth!.tenantId;
      const [row] = await opts.db
        .update(categories)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            eq(categories.id, idParsed.data.id),
            eq(categories.tenantId, tenantId),
            isNull(categories.deletedAt),
          ),
        )
        .returning({ id: categories.id });

      if (!row) {
        return sendError(reply, 404, 'not_found', 'Categoria não encontrada.');
      }
      return reply.code(204).send();
    },
  );
};
