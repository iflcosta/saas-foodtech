/**
 * Cardápio público — `api-contracts.md` §5.
 *
 * Rota não autenticada, identificada pelo `slug` do tenant. Devolve a árvore
 * completa: tenant → categories → products → modifier_groups → modifiers,
 * já filtrada por `deleted_at IS NULL` em todos os níveis. Não vaza dados
 * fiscais nem identificadores internos sensíveis (`fiscal_metadata` fica fora).
 *
 * Rate-limit por IP fica para depois (rota lê-only contra índices; baixo risco
 * no MVP). Pendência registrada em `roadmap.md` §4.
 */
import type { DbClient } from '@saas-foodtech/db';
import {
  categories,
  modifierGroups,
  modifiers,
  productModifierGroups,
  products,
  tenants,
} from '@saas-foodtech/db';
import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { sendError, sendValidationError } from '../lib/http.js';

interface MenuRoutesOpts {
  db: DbClient;
}

const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, 'slug usa apenas a-z, 0-9 e hifens'),
});

interface MenuProduct {
  id: string;
  name: string;
  description: string | null;
  base_price_cents: number;
  is_pizza: boolean;
  sort_order: number;
  modifier_groups: MenuModifierGroup[];
}

interface MenuModifierGroup {
  id: string;
  name: string;
  min_choices: number;
  max_choices: number;
  is_required: boolean;
  modifiers: MenuModifier[];
}

interface MenuModifier {
  id: string;
  name: string;
  price_delta_cents: number;
  is_exclusion: boolean;
  sort_order: number;
}

export const menuRoutes: FastifyPluginAsync<MenuRoutesOpts> = async (
  app,
  opts,
) => {
  // GET /v1/menu/:slug  (público)
  app.get('/v1/menu/:slug', async (req, reply) => {
    const parsed = slugParamSchema.safeParse(req.params);
    if (!parsed.success) return sendValidationError(reply, parsed.error);

    // 1) tenant por slug
    const [tenant] = await opts.db
      .select({
        id: tenants.id,
        name: tenants.name,
        pizza_price_rule: tenants.pizzaPriceRule,
      })
      .from(tenants)
      .where(eq(tenants.slug, parsed.data.slug))
      .limit(1);
    if (!tenant) {
      return sendError(reply, 404, 'not_found', 'Cardápio não encontrado.');
    }

    // 2) categorias ativas
    const tenantId = tenant.id;
    const tenantCategories = await opts.db
      .select({
        id: categories.id,
        name: categories.name,
        print_queue: categories.printQueue,
        sort_order: categories.sortOrder,
      })
      .from(categories)
      .where(
        and(eq(categories.tenantId, tenantId), isNull(categories.deletedAt)),
      )
      .orderBy(asc(categories.sortOrder), asc(categories.name));

    if (tenantCategories.length === 0) {
      return {
        tenant: { name: tenant.name, pizza_price_rule: tenant.pizza_price_rule },
        categories: [],
      };
    }

    // 3) produtos ativos
    const categoryIds = tenantCategories.map((c) => c.id);
    const tenantProducts = await opts.db
      .select({
        id: products.id,
        category_id: products.categoryId,
        name: products.name,
        description: products.description,
        base_price_cents: products.basePriceCents,
        is_pizza: products.isPizza,
        sort_order: products.sortOrder,
      })
      .from(products)
      .where(
        and(
          eq(products.tenantId, tenantId),
          inArray(products.categoryId, categoryIds),
          isNull(products.deletedAt),
        ),
      )
      .orderBy(asc(products.sortOrder), asc(products.name));

    // 4) N:N product↔group
    const productIds = tenantProducts.map((p) => p.id);
    const productGroupLinks = productIds.length
      ? await opts.db
          .select({
            product_id: productModifierGroups.productId,
            modifier_group_id: productModifierGroups.modifierGroupId,
            sort_order: productModifierGroups.sortOrder,
          })
          .from(productModifierGroups)
          .where(inArray(productModifierGroups.productId, productIds))
          .orderBy(asc(productModifierGroups.sortOrder))
      : [];

    // 5) grupos ativos
    const groupIds = Array.from(
      new Set(productGroupLinks.map((l) => l.modifier_group_id)),
    );
    const tenantGroups = groupIds.length
      ? await opts.db
          .select({
            id: modifierGroups.id,
            name: modifierGroups.name,
            min_choices: modifierGroups.minChoices,
            max_choices: modifierGroups.maxChoices,
            is_required: modifierGroups.isRequired,
          })
          .from(modifierGroups)
          .where(
            and(
              inArray(modifierGroups.id, groupIds),
              eq(modifierGroups.tenantId, tenantId),
              isNull(modifierGroups.deletedAt),
            ),
          )
      : [];

    // 6) modificadores ativos
    const aliveGroupIds = tenantGroups.map((g) => g.id);
    const tenantModifiers = aliveGroupIds.length
      ? await opts.db
          .select({
            id: modifiers.id,
            modifier_group_id: modifiers.modifierGroupId,
            name: modifiers.name,
            price_delta_cents: modifiers.priceDeltaCents,
            is_exclusion: modifiers.isExclusion,
            sort_order: modifiers.sortOrder,
          })
          .from(modifiers)
          .where(
            and(
              inArray(modifiers.modifierGroupId, aliveGroupIds),
              eq(modifiers.tenantId, tenantId),
              isNull(modifiers.deletedAt),
            ),
          )
          .orderBy(asc(modifiers.sortOrder), asc(modifiers.name))
      : [];

    // --- stitch em memória ---
    const modifiersByGroup = new Map<string, MenuModifier[]>();
    for (const m of tenantModifiers) {
      const list = modifiersByGroup.get(m.modifier_group_id) ?? [];
      list.push({
        id: m.id,
        name: m.name,
        price_delta_cents: m.price_delta_cents,
        is_exclusion: m.is_exclusion,
        sort_order: m.sort_order,
      });
      modifiersByGroup.set(m.modifier_group_id, list);
    }

    const groupById = new Map<string, MenuModifierGroup>();
    for (const g of tenantGroups) {
      groupById.set(g.id, {
        id: g.id,
        name: g.name,
        min_choices: g.min_choices,
        max_choices: g.max_choices,
        is_required: g.is_required,
        modifiers: modifiersByGroup.get(g.id) ?? [],
      });
    }

    const groupsByProduct = new Map<string, MenuModifierGroup[]>();
    for (const link of productGroupLinks) {
      const g = groupById.get(link.modifier_group_id);
      if (!g) continue; // grupo deletado, ignora
      const list = groupsByProduct.get(link.product_id) ?? [];
      list.push(g);
      groupsByProduct.set(link.product_id, list);
    }

    const productsByCategory = new Map<string, MenuProduct[]>();
    for (const p of tenantProducts) {
      const list = productsByCategory.get(p.category_id) ?? [];
      list.push({
        id: p.id,
        name: p.name,
        description: p.description,
        base_price_cents: p.base_price_cents,
        is_pizza: p.is_pizza,
        sort_order: p.sort_order,
        modifier_groups: groupsByProduct.get(p.id) ?? [],
      });
      productsByCategory.set(p.category_id, list);
    }

    return {
      tenant: {
        name: tenant.name,
        pizza_price_rule: tenant.pizza_price_rule,
      },
      categories: tenantCategories.map((c) => ({
        id: c.id,
        name: c.name,
        print_queue: c.print_queue,
        sort_order: c.sort_order,
        products: productsByCategory.get(c.id) ?? [],
      })),
    };
  });
};
