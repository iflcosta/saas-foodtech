/**
 * Schema §1 — Tenants, Usuários & Motoboys.
 *
 * Espelha exatamente o DDL de `docs/specs/data-schema.md` §1.
 * Cada tabela carrega `tenant_id` (NOT NULL) com índice dedicado para
 * forçar o isolamento horizontal por loja (RNF-1 / ADR-Q7).
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// Conta principal do restaurante (um registro por lojista)
export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    name: text('name').notNull(),
    // Subdomínio do cardápio digital
    slug: text('slug').notNull(),
    // Destino do redirecionamento WhatsApp
    phoneWhatsapp: text('phone_whatsapp').notNull(),
    // ID da conta conectada no Asaas (ADR-Q2)
    asaasAccountId: text('asaas_account_id'),
    // Chave de API criptografada em repouso
    asaasApiKey: text('asaas_api_key'),
    // ADR-Q9: regra de preço para pizzas fracionadas
    pizzaPriceRule: text('pizza_price_rule').notNull().default('most_expensive'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('tenants_slug_key').on(table.slug),
    check(
      'tenants_pizza_price_rule_check',
      sql`${table.pizzaPriceRule} IN ('most_expensive', 'average')`,
    ),
  ],
);

// Operadores humanos do restaurante (cozinheiro, atendente, dono)
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    // RBAC (RNF-5)
    role: text('role').notNull().default('operator'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_users_tenant').on(table.tenantId),
    uniqueIndex('users_tenant_email_key').on(table.tenantId, table.email),
    check(
      'users_role_check',
      sql`${table.role} IN ('owner', 'manager', 'operator')`,
    ),
  ],
);

// Motoboys de entrega — base do acerto de taxa por rota (RF-5.3 / ADR-Q3)
export const couriers = pgTable(
  'couriers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index('idx_couriers_tenant').on(table.tenantId)],
);
