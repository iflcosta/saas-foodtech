/**
 * Schema §4 — Cobranças Pix (Asaas).
 *
 * Espelha exatamente o DDL de `docs/specs/data-schema.md` §4.
 * `webhook_event_id` é UNIQUE para garantir idempotência de webhook (RF-4.4).
 */
import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { orders } from './orders.js';

// Registro de cada cobrança Pix dinâmica emitida via Asaas (RF-4)
export const pixCharges = pgTable(
  'pix_charges',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id),
    // ID retornado pelo Asaas
    asaasChargeId: text('asaas_charge_id').notNull(),
    amountCents: integer('amount_cents').notNull(),
    // Copia-e-cola Pix
    qrCodePayload: text('qr_code_payload').notNull(),
    qrCodeImageUrl: text('qr_code_image_url'),
    status: text('status').notNull().default('pending'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    // Idempotência de webhook (RF-4.4)
    webhookEventId: text('webhook_event_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_pix_charges_tenant').on(table.tenantId),
    index('idx_pix_charges_order').on(table.orderId),
    uniqueIndex('pix_charges_asaas_charge_id_key').on(table.asaasChargeId),
    uniqueIndex('pix_charges_webhook_event_id_key').on(table.webhookEventId),
    check(
      'pix_charges_status_check',
      sql`${table.status} IN ('pending', 'paid', 'expired', 'cancelled')`,
    ),
  ],
);
