/**
 * Schema §3 — Pedidos.
 *
 * Espelha exatamente o DDL de `docs/specs/data-schema.md` §3.
 * Pontos críticos:
 *  - `orders.id` é UUIDv4 gerado no cliente (ADR-Q10) — sem default no DB.
 *  - `daily_sequence` é atribuído pelo servidor; unicidade composta com o dia.
 *  - Máquina de estados (ADR-Q10) controlada por CHECK.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { couriers, tenants } from './tenants.js';
import { modifiers, products } from './menu.js';

// Máquina de estados do pedido (ADR-Q10)
// pending → confirmed → preparing → ready → dispatched → delivered | cancelled
export const orders = pgTable(
  'orders',
  {
    // UUIDv4 gerado no cliente (ADR-Q10) — sem DEFAULT gen_random_uuid()
    id: uuid('id').primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    // #101, #102… atribuído pelo servidor no momento do sync
    dailySequence: integer('daily_sequence'),
    status: text('status').notNull().default('pending'),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    deliveryAddress: text('delivery_address'),
    // Motoboy designado no despacho (RF-5.3)
    courierId: uuid('courier_id').references(() => couriers.id),
    // Taxa de entrega; base do acerto do motoboy
    deliveryFeeCents: integer('delivery_fee_cents').notNull().default(0),
    notes: text('notes'),
    totalCents: integer('total_cents').notNull(),
    paymentMethod: text('payment_method').notNull().default('pix'),
    // Pix dinâmico (RF-4): preenchido após geração da cobrança Asaas
    pixChargeId: text('pix_charge_id'),
    pixPaidAt: timestamp('pix_paid_at', { withTimezone: true }),
    // Canal de origem (ADR-Q6): canal direto no MVP; iFood na V1.1
    externalChannel: text('external_channel'),
    externalOrderId: text('external_order_id'),
    // Metadados fiscais — V2.0
    fiscalMetadata: jsonb('fiscal_metadata'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_orders_tenant').on(table.tenantId),
    index('idx_orders_tenant_status').on(table.tenantId, table.status),
    index('idx_orders_tenant_date').on(table.tenantId, table.createdAt),
    index('idx_orders_courier').on(table.courierId),
    // Unicidade do sequencial diário por loja
    uniqueIndex('idx_orders_daily_seq').on(
      table.tenantId,
      table.dailySequence,
      sql`(${table.createdAt}::date)`,
    ),
    check(
      'orders_status_check',
      sql`${table.status} IN ('pending', 'confirmed', 'preparing', 'ready', 'dispatched', 'delivered', 'cancelled')`,
    ),
    check('orders_total_cents_check', sql`${table.totalCents} >= 0`),
    check(
      'orders_payment_method_check',
      sql`${table.paymentMethod} IN ('pix', 'cash', 'card_external')`,
    ),
  ],
);

// Itens de um pedido (linha de produto)
export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderId: uuid('order_id')
      .notNull()
      .references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id),
    // Snapshot em tempo de criação
    productName: text('product_name').notNull(),
    // Snapshot do preço no momento do pedido
    unitPriceCents: integer('unit_price_cents').notNull(),
    quantity: integer('quantity').notNull().default(1),
    subtotalCents: integer('subtotal_cents').notNull(),
    notes: text('notes'),
    // Metadados de pizza fracionada (ADR-Q9)
    // ex.: [{"product_id":"…","name":"Calabresa","ratio":0.5}]
    pizzaFractions: jsonb('pizza_fractions'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_order_items_tenant').on(table.tenantId),
    index('idx_order_items_order').on(table.orderId),
    check('order_items_quantity_check', sql`${table.quantity} > 0`),
  ],
);

// Modificadores aplicados a cada item de pedido
export const orderItemModifiers = pgTable(
  'order_item_modifiers',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    orderItemId: uuid('order_item_id')
      .notNull()
      .references(() => orderItems.id, { onDelete: 'cascade' }),
    modifierId: uuid('modifier_id')
      .notNull()
      .references(() => modifiers.id),
    modifierName: text('modifier_name').notNull(),
    priceDeltaCents: integer('price_delta_cents').notNull().default(0),
    isExclusion: boolean('is_exclusion').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_order_item_mods_tenant').on(table.tenantId),
    index('idx_order_item_mods_item').on(table.orderItemId),
  ],
);
