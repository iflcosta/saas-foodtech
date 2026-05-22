/**
 * Enumerações canônicas — espelham os CHECK constraints de
 * `docs/specs/data-schema.md` e a tabela de erros de `api-contracts.md` §1.
 *
 * Manter sincronizado com o DDL: qualquer alteração no CHECK do schema
 * exige atualização aqui (e vice-versa).
 */
import { z } from 'zod';

// §1 — users.role
export const userRoleSchema = z.enum(['owner', 'manager', 'operator']);
export type UserRole = z.infer<typeof userRoleSchema>;

// §1 — tenants.pizza_price_rule (ADR-Q9)
export const pizzaPriceRuleSchema = z.enum(['most_expensive', 'average']);
export type PizzaPriceRule = z.infer<typeof pizzaPriceRuleSchema>;

// §2 — categories.print_queue (RF-2.2)
export const categoryPrintQueueSchema = z.enum(['kitchen', 'bar']);
export type CategoryPrintQueue = z.infer<typeof categoryPrintQueueSchema>;

// §3 — orders.status (ADR-Q10)
export const orderStatusSchema = z.enum([
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'dispatched',
  'delivered',
  'cancelled',
]);
export type OrderStatus = z.infer<typeof orderStatusSchema>;

// §3 — orders.payment_method
export const paymentMethodSchema = z.enum(['pix', 'cash', 'card_external']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// §4 — pix_charges.status
export const pixChargeStatusSchema = z.enum([
  'pending',
  'paid',
  'expired',
  'cancelled',
]);
export type PixChargeStatus = z.infer<typeof pixChargeStatusSchema>;

// §5 — ledger_accounts.type
export const ledgerAccountTypeSchema = z.enum(['asset', 'liability', 'equity']);
export type LedgerAccountType = z.infer<typeof ledgerAccountTypeSchema>;

// §5 — ledger_entries.entry_type
export const ledgerEntryTypeSchema = z.enum(['debit', 'credit']);
export type LedgerEntryType = z.infer<typeof ledgerEntryTypeSchema>;

// §6 — cash_sessions.status
export const cashSessionStatusSchema = z.enum(['open', 'closed']);
export type CashSessionStatus = z.infer<typeof cashSessionStatusSchema>;

// §6 — payments.method (RF-5.2 inclui Pix manual como espelho do recebimento)
export const paymentRegistrationMethodSchema = z.enum([
  'cash',
  'card_external',
  'pix',
]);
export type PaymentRegistrationMethod = z.infer<
  typeof paymentRegistrationMethodSchema
>;

// §7 — print_jobs.queue (RF-2.2)
export const printJobQueueSchema = z.enum(['kitchen', 'bar', 'dispatch']);
export type PrintJobQueue = z.infer<typeof printJobQueueSchema>;

// §7 — print_jobs.status (RF-2.4)
export const printJobStatusSchema = z.enum(['pending', 'sent', 'failed']);
export type PrintJobStatus = z.infer<typeof printJobStatusSchema>;

// api-contracts.md §1 — códigos de erro do envelope
export const errorCodeSchema = z.enum([
  'unauthenticated',
  'forbidden',
  'not_found',
  'validation_error',
  'invalid_transition',
  'payment_required',
  'idempotency_conflict',
  'rate_limited',
  'internal_error',
]);
export type ErrorCode = z.infer<typeof errorCodeSchema>;
