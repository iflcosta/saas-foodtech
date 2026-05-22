/**
 * Schema §5 — Ledger de Dupla Entrada (ADR-Q3 / RF-5).
 *
 * Espelha exatamente o DDL de `docs/specs/data-schema.md` §5.
 *
 *  - `ledger_entries.id` é BIGSERIAL para ordenação determinística.
 *  - Append-only é responsabilidade da aplicação nesta fase (sem trigger no DB).
 *  - `reversal_of` é auto-referência: estornos apontam para o lançamento original.
 *  - Sem `updated_at`: lançamentos são imutáveis por definição.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  bigserial,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core';
import { couriers, tenants } from './tenants.js';
import { orders } from './orders.js';

// Contas virtuais do Ledger por tenant
// Contas fixas no onboarding: Caixa_Lojista, Caixa_Canal.
// Cada motoboy cadastrado recebe uma conta própria (RF-5.3).
export const ledgerAccounts = pgTable(
  'ledger_accounts',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    // 'Caixa_Lojista' | 'Caixa_Canal' | 'Caixa_Motoboy:<nome>'
    name: text('name').notNull(),
    type: text('type').notNull(),
    // Preenchido apenas nas contas de motoboy
    courierId: uuid('courier_id').references(() => couriers.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('idx_ledger_accounts_tenant').on(table.tenantId),
    uniqueIndex('ledger_accounts_tenant_name_key').on(
      table.tenantId,
      table.name,
    ),
    check(
      'ledger_accounts_type_check',
      sql`${table.type} IN ('asset', 'liability', 'equity')`,
    ),
  ],
);

// Lançamentos append-only — NUNCA atualizar ou deletar (RF-5.5 / ADR-Q10)
// Cada transação econômica gera exatamente 2 linhas: débito e crédito.
export const ledgerEntries = pgTable(
  'ledger_entries',
  {
    // BIGSERIAL para ordenação determinística
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id),
    // Agrupa o par débito/crédito da mesma transação
    transactionRef: uuid('transaction_ref').notNull(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => ledgerAccounts.id),
    entryType: text('entry_type').notNull(),
    amountCents: integer('amount_cents').notNull(),
    description: text('description').notNull(),
    orderId: uuid('order_id').references(() => orders.id),
    // Estornos apontam para o lançamento original
    reversalOf: bigint('reversal_of', { mode: 'bigint' }).references(
      (): AnyPgColumn => ledgerEntries.id,
    ),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Sem updated_at: imutável por definição.
  },
  (table) => [
    index('idx_ledger_entries_tenant').on(table.tenantId),
    index('idx_ledger_entries_account').on(table.accountId),
    index('idx_ledger_entries_txn_ref').on(table.transactionRef),
    index('idx_ledger_entries_order').on(table.orderId),
    check(
      'ledger_entries_entry_type_check',
      sql`${table.entryType} IN ('debit', 'credit')`,
    ),
    check('ledger_entries_amount_cents_check', sql`${table.amountCents} > 0`),
  ],
);
