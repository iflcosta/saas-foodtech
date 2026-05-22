/**
 * Validação de Caixa / Ledger — `api-contracts.md` §9.
 *
 *  - Fechamento de caixa é CEGO (RF-5.4): operador informa apenas
 *    `declared_cents`; o servidor calcula `expected_cents` via Ledger.
 *  - Pagamento manual (RF-5.2) gera o par débito/crédito automaticamente.
 *  - Ledger é append-only: estorno entra como NOVO lançamento (RF-5.5).
 */
import { z } from 'zod';
import { paymentRegistrationMethodSchema } from './enums.js';
import {
  moneyCentsSchema,
  positiveMoneyCentsSchema,
  uuidSchema,
} from './primitives.js';

/** Abertura de sessão de caixa (`POST /v1/cash-sessions`). */
export const openCashSessionSchema = z
  .object({
    notes: z.string().max(500).optional(),
  })
  .strict();
export type OpenCashSessionInput = z.infer<typeof openCashSessionSchema>;

/**
 * Fechamento CEGO (`POST /v1/cash-sessions/:id/close`).
 * O operador NÃO vê o `expected_cents` antes de declarar (RF-5.4).
 */
export const closeCashSessionSchema = z
  .object({
    declared_cents: moneyCentsSchema,
    notes: z.string().max(500).optional(),
  })
  .strict();
export type CloseCashSessionInput = z.infer<typeof closeCashSessionSchema>;

/**
 * Registro de pagamento manual (`POST /v1/payments`).
 * Gera o par de lançamentos: débito em Caixa_Lojista, crédito em Caixa_Canal.
 */
export const registerPaymentSchema = z
  .object({
    order_id: uuidSchema,
    method: paymentRegistrationMethodSchema,
    amount_cents: positiveMoneyCentsSchema,
    cash_session_id: uuidSchema.optional(),
  })
  .strict();
export type RegisterPaymentInput = z.infer<typeof registerPaymentSchema>;

/**
 * Estorno de lançamento do Ledger (`POST /v1/ledger/entries/:id/reverse`).
 * Cria um NOVO par com `reversal_of` apontando para o original (RF-5.5).
 */
export const reverseLedgerEntrySchema = z
  .object({
    description: z.string().min(1).max(280),
  })
  .strict();
export type ReverseLedgerEntryInput = z.infer<typeof reverseLedgerEntrySchema>;
