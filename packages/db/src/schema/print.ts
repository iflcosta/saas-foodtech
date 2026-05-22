/**
 * Schema §7 — Fila de Impressão (RF-2.4).
 *
 * Espelha exatamente o DDL de `docs/specs/data-schema.md` §7.
 * Buffer persistente de comandos ESC/POS pendentes; a ponte Go consome
 * via WebSocket e marca cada job como `sent` ou `failed` (ADR-Q4).
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
import { tenants } from './tenants.js';
import { orders } from './orders.js';

export const printJobs = pgTable(
  'print_jobs',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderId: uuid('order_id').references(() => orders.id),
    // RF-2.2 — fila setorial herdada da categoria do produto
    queue: text('queue').notNull(),
    // Buffer ESC/POS codificado em Base64 (RF-2.1)
    payloadB64: text('payload_b64').notNull(),
    status: text('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_print_jobs_tenant').on(table.tenantId),
    index('idx_print_jobs_tenant_status').on(table.tenantId, table.status),
    check(
      'print_jobs_queue_check',
      sql`${table.queue} IN ('kitchen', 'bar', 'dispatch')`,
    ),
    check(
      'print_jobs_status_check',
      sql`${table.status} IN ('pending', 'sent', 'failed')`,
    ),
  ],
);
