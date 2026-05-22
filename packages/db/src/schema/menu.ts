/**
 * Schema §2 — Cardápio.
 *
 * Espelha exatamente o DDL de `docs/specs/data-schema.md` §2.
 * Inclui `categories.print_queue` para roteamento setorial de impressão (RF-2.2)
 * e o N:N `product_modifier_groups` com PK composta.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

// Categorias de produto (ex.: Hambúrgueres, Pizzas, Bebidas)
export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Fila setorial dos itens (RF-2.2) — herdada por todos os produtos da categoria
    printQueue: text('print_queue').notNull().default('kitchen'),
    sortOrder: integer('sort_order').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_categories_tenant').on(table.tenantId),
    check(
      'categories_print_queue_check',
      sql`${table.printQueue} IN ('kitchen', 'bar')`,
    ),
  ],
);

// Produtos (hambúrgueres, pizzas inteiras, bebidas, etc.)
export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id),
    name: text('name').notNull(),
    description: text('description'),
    basePriceCents: integer('base_price_cents').notNull(),
    // Habilita lógica de frações de pizza (ADR-Q9)
    isPizza: boolean('is_pizza').notNull().default(false),
    // NCM, CFOP, CEST, ICMS — reservado V2.0
    fiscalMetadata: jsonb('fiscal_metadata'),
    sortOrder: integer('sort_order').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_products_tenant').on(table.tenantId),
    index('idx_products_category').on(table.categoryId),
    check('products_base_price_cents_check', sql`${table.basePriceCents} >= 0`),
  ],
);

// Grupos de modificadores (ex.: "Ponto da carne", "Adicionais pagos")
export const modifierGroups = pgTable(
  'modifier_groups',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    minChoices: integer('min_choices').notNull().default(0),
    maxChoices: integer('max_choices').notNull().default(1),
    isRequired: boolean('is_required').notNull().default(false),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_modifier_groups_tenant').on(table.tenantId)],
);

// Opções individuais dentro de um grupo (ex.: "Sem cebola", "Bacon +R$3")
export const modifiers = pgTable(
  'modifiers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    modifierGroupId: uuid('modifier_group_id')
      .notNull()
      .references(() => modifierGroups.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    // Negativo para desconto, positivo para adicional
    priceDeltaCents: integer('price_delta_cents').notNull().default(0),
    // Imprime em reverso (RF-2.3)
    isExclusion: boolean('is_exclusion').notNull().default(false),
    sortOrder: integer('sort_order').notNull().default(0),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_modifiers_tenant').on(table.tenantId),
    index('idx_modifiers_group').on(table.modifierGroupId),
  ],
);

// Relacionamento N:N entre produtos e grupos de modificadores
export const productModifierGroups = pgTable(
  'product_modifier_groups',
  {
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    modifierGroupId: uuid('modifier_group_id')
      .notNull()
      .references(() => modifierGroups.id, { onDelete: 'cascade' }),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (table) => [
    primaryKey({
      name: 'product_modifier_groups_pkey',
      columns: [table.productId, table.modifierGroupId],
    }),
  ],
);
