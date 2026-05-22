/**
 * Schema §6 — Sessões de Caixa & Pagamentos Manuais.
 *
 * Espelha exatamente o DDL de `docs/specs/data-schema.md` §6.
 *  - `cash_sessions`: base do fechamento cego (RF-5.4).
 *  - `payments`: recebimentos não-Pix (dinheiro, cartão externo) — RF-5.2.
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants, users } from './tenants.js';
import { orders } from './orders.js';

// Turno de operação — base para o fechamento de caixa cego (RF-5.4)
export const cashSessions = pgTable(
  'cash_sessions',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    openedBy: uuid('opened_by')
      .notNull()
      .references(() => users.id),
    closedBy: uuid('closed_by').references(() => users.id),
    openedAt: timestamp('opened_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    // Calculado pelo sistema (Ledger)
    expectedCents: integer('expected_cents'),
    // Informado pelo operador no fechamento cego
    declaredCents: integer('declared_cents'),
    // expected - declared (calculado ao fechar)
    differenceCents: integer('difference_cents'),
    status: text('status').notNull().default('open'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_cash_sessions_tenant').on(table.tenantId),
    check(
      'cash_sessions_status_check',
      sql`${table.status} IN ('open', 'closed')`,
    ),
  ],
);

// Registro de pagamentos não-Pix (dinheiro, maquininha externa) — RF-5.2
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    cashSessionId: uuid('cash_session_id').references(() => cashSessions.id),
    method: text('method').notNull(),
    amountCents: integer('amount_cents').notNull(),
    registeredBy: uuid('registered_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_payments_tenant').on(table.tenantId),
    index('idx_payments_order').on(table.orderId),
    index('idx_payments_session').on(table.cashSessionId),
    check(
      'payments_method_check',
      sql`${table.method} IN ('cash', 'card_external', 'pix')`,
    ),
    check('payments_amount_cents_check', sql`${table.amountCents} > 0`),
  ],
);
