/**
 * Cardápio admin — grupos de modificadores e modificadores (`api-contracts.md` §4).
 *
 * O grupo agrupa opções (modifiers) com regras de min/max escolhas.
 * Soft-delete do grupo torna invisível, mas preserva snapshots históricos em
 * `order_item_modifiers.modifier_name`.
 *
 * Modificador individual também soft-deleta — assim a remoção via
 * `DELETE /v1/modifier-groups/:id/modifiers/:modifierId` mantém o histórico.
 */
import type { DbClient } from '@saas-foodtech/db';
import { modifierGroups, modifiers } from '@saas-foodtech/db';
import {
  createModifierGroupSchema,
  createModifierSchema,
  updateModifierGroupSchema,
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

interface ModifierGroupsRoutesOpts {
  db: DbClient;
}

const idParamSchema = z.object({ id: uuidSchema });
const groupAndModifierParamsSchema = z.object({
  id: uuidSchema,
  modifierId: uuidSchema,
});

const groupColumns = {
  id: modifierGroups.id,
  name: modifierGroups.name,
  min_choices: modifierGroups.minChoices,
  max_choices: modifierGroups.maxChoices,
  is_required: modifierGroups.isRequired,
  created_at: modifierGroups.createdAt,
  updated_at: modifierGroups.updatedAt,
} as const;

const modifierColumns = {
  id: modifiers.id,
  modifier_group_id: modifiers.modifierGroupId,
  name: modifiers.name,
  price_delta_cents: modifiers.priceDeltaCents,
  is_exclusion: modifiers.isExclusion,
  sort_order: modifiers.sortOrder,
  created_at: modifiers.createdAt,
  updated_at: modifiers.updatedAt,
} as const;

async function groupBelongsToTenant(
  db: DbClient,
  groupId: string,
  tenantId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: modifierGroups.id })
    .from(modifierGroups)
    .where(
      and(
        eq(modifierGroups.id, groupId),
        eq(modifierGroups.tenantId, tenantId),
        isNull(modifierGroups.deletedAt),
      ),
    )
    .limit(1);
  return Boolean(row);
}

export const modifierGroupsRoutes: FastifyPluginAsync<
  ModifierGroupsRoutesOpts
> = async (app, opts) => {
  const guard = [app.authenticate, app.requireRole('manager')];

  // GET /v1/modifier-groups
  app.get('/v1/modifier-groups', { preHandler: guard }, async (req, reply) => {
    const pageParsed = paginationSchema.safeParse(req.query);
    if (!pageParsed.success) return sendValidationError(reply, pageParsed.error);

    const tenantId = req.auth!.tenantId;
    const { limit, offset } = pageParsed.data;

    const rows = await opts.db
      .select(groupColumns)
      .from(modifierGroups)
      .where(
        and(
          eq(modifierGroups.tenantId, tenantId),
          isNull(modifierGroups.deletedAt),
        ),
      )
      .orderBy(asc(modifierGroups.name))
      .limit(limit)
      .offset(offset);

    return { modifier_groups: rows, pagination: { limit, offset } };
  });

  // POST /v1/modifier-groups
  app.post(
    '/v1/modifier-groups',
    { preHandler: guard },
    async (req, reply) => {
      const parsed = createModifierGroupSchema.safeParse(req.body);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const tenantId = req.auth!.tenantId;
      const [row] = await opts.db
        .insert(modifierGroups)
        .values({
          tenantId,
          name: parsed.data.name,
          minChoices: parsed.data.min_choices,
          maxChoices: parsed.data.max_choices,
          isRequired: parsed.data.is_required,
        })
        .returning(groupColumns);

      return reply.code(201).send(row);
    },
  );

  // GET /v1/modifier-groups/:id  (com modificadores aninhados)
  app.get(
    '/v1/modifier-groups/:id',
    { preHandler: guard },
    async (req, reply) => {
      const idParsed = idParamSchema.safeParse(req.params);
      if (!idParsed.success) return sendValidationError(reply, idParsed.error);

      const tenantId = req.auth!.tenantId;
      const [group] = await opts.db
        .select(groupColumns)
        .from(modifierGroups)
        .where(
          and(
            eq(modifierGroups.id, idParsed.data.id),
            eq(modifierGroups.tenantId, tenantId),
            isNull(modifierGroups.deletedAt),
          ),
        )
        .limit(1);

      if (!group) {
        return sendError(
          reply,
          404,
          'not_found',
          'Grupo de modificadores não encontrado.',
        );
      }

      const groupModifiers = await opts.db
        .select(modifierColumns)
        .from(modifiers)
        .where(
          and(
            eq(modifiers.modifierGroupId, idParsed.data.id),
            eq(modifiers.tenantId, tenantId),
            isNull(modifiers.deletedAt),
          ),
        )
        .orderBy(asc(modifiers.sortOrder), asc(modifiers.name));

      return { ...group, modifiers: groupModifiers };
    },
  );

  // PATCH /v1/modifier-groups/:id
  app.patch(
    '/v1/modifier-groups/:id',
    { preHandler: guard },
    async (req, reply) => {
      const idParsed = idParamSchema.safeParse(req.params);
      if (!idParsed.success) return sendValidationError(reply, idParsed.error);

      const bodyParsed = updateModifierGroupSchema.safeParse(req.body);
      if (!bodyParsed.success)
        return sendValidationError(reply, bodyParsed.error);

      const min = bodyParsed.data.min_choices;
      const max = bodyParsed.data.max_choices;
      if (min !== undefined && max !== undefined && max < min) {
        return sendError(
          reply,
          422,
          'validation_error',
          'max_choices não pode ser menor que min_choices.',
          [{ field: 'max_choices', issue: 'menor que min_choices' }],
        );
      }

      const updates: Record<string, unknown> = { updatedAt: sql`now()` };
      if (bodyParsed.data.name !== undefined) updates.name = bodyParsed.data.name;
      if (bodyParsed.data.min_choices !== undefined)
        updates.minChoices = bodyParsed.data.min_choices;
      if (bodyParsed.data.max_choices !== undefined)
        updates.maxChoices = bodyParsed.data.max_choices;
      if (bodyParsed.data.is_required !== undefined)
        updates.isRequired = bodyParsed.data.is_required;

      const tenantId = req.auth!.tenantId;
      const [row] = await opts.db
        .update(modifierGroups)
        .set(updates)
        .where(
          and(
            eq(modifierGroups.id, idParsed.data.id),
            eq(modifierGroups.tenantId, tenantId),
            isNull(modifierGroups.deletedAt),
          ),
        )
        .returning(groupColumns);

      if (!row) {
        return sendError(
          reply,
          404,
          'not_found',
          'Grupo de modificadores não encontrado.',
        );
      }
      return row;
    },
  );

  // DELETE /v1/modifier-groups/:id  (soft delete)
  app.delete(
    '/v1/modifier-groups/:id',
    { preHandler: guard },
    async (req, reply) => {
      const idParsed = idParamSchema.safeParse(req.params);
      if (!idParsed.success) return sendValidationError(reply, idParsed.error);

      const tenantId = req.auth!.tenantId;
      const [row] = await opts.db
        .update(modifierGroups)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            eq(modifierGroups.id, idParsed.data.id),
            eq(modifierGroups.tenantId, tenantId),
            isNull(modifierGroups.deletedAt),
          ),
        )
        .returning({ id: modifierGroups.id });

      if (!row) {
        return sendError(
          reply,
          404,
          'not_found',
          'Grupo de modificadores não encontrado.',
        );
      }
      return reply.code(204).send();
    },
  );

  // POST /v1/modifier-groups/:id/modifiers
  app.post(
    '/v1/modifier-groups/:id/modifiers',
    { preHandler: guard },
    async (req, reply) => {
      const idParsed = idParamSchema.safeParse(req.params);
      if (!idParsed.success) return sendValidationError(reply, idParsed.error);

      const bodyParsed = createModifierSchema.safeParse(req.body);
      if (!bodyParsed.success)
        return sendValidationError(reply, bodyParsed.error);

      const tenantId = req.auth!.tenantId;
      const belongs = await groupBelongsToTenant(
        opts.db,
        idParsed.data.id,
        tenantId,
      );
      if (!belongs) {
        return sendError(
          reply,
          404,
          'not_found',
          'Grupo de modificadores não encontrado.',
        );
      }

      const [row] = await opts.db
        .insert(modifiers)
        .values({
          tenantId,
          modifierGroupId: idParsed.data.id,
          name: bodyParsed.data.name,
          priceDeltaCents: bodyParsed.data.price_delta_cents,
          isExclusion: bodyParsed.data.is_exclusion,
          sortOrder: bodyParsed.data.sort_order,
        })
        .returning(modifierColumns);

      return reply.code(201).send(row);
    },
  );

  // DELETE /v1/modifier-groups/:id/modifiers/:modifierId  (soft delete)
  app.delete(
    '/v1/modifier-groups/:id/modifiers/:modifierId',
    { preHandler: guard },
    async (req, reply) => {
      const parsed = groupAndModifierParamsSchema.safeParse(req.params);
      if (!parsed.success) return sendValidationError(reply, parsed.error);

      const tenantId = req.auth!.tenantId;
      const [row] = await opts.db
        .update(modifiers)
        .set({ deletedAt: sql`now()`, updatedAt: sql`now()` })
        .where(
          and(
            eq(modifiers.id, parsed.data.modifierId),
            eq(modifiers.modifierGroupId, parsed.data.id),
            eq(modifiers.tenantId, tenantId),
            isNull(modifiers.deletedAt),
          ),
        )
        .returning({ id: modifiers.id });

      if (!row) {
        return sendError(reply, 404, 'not_found', 'Modificador não encontrado.');
      }
      return reply.code(204).send();
    },
  );
};
