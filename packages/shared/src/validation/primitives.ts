/**
 * Primitivas Zod compartilhadas — `api-contracts.md` §1 e §12.
 *
 * Princípios transversais:
 *  - Valores monetários sempre como inteiros em centavos (`*_cents`).
 *  - Datas em ISO 8601 UTC.
 *  - `tenant_id` jamais entra pelo payload (vem só do JWT).
 */
import { z } from 'zod';

/** UUID v4 — formato exigido em IDs vindos do cliente (ADR-Q10). */
export const uuidSchema = z.string().uuid();

/** Inteiro em centavos, não-negativo (subtotal, total, etc.). */
export const moneyCentsSchema = z
  .number()
  .int('valor monetário deve ser inteiro em centavos')
  .nonnegative('valor monetário não pode ser negativo');

/** Inteiro em centavos estritamente positivo (lançamento Ledger, pagamento). */
export const positiveMoneyCentsSchema = z
  .number()
  .int('valor monetário deve ser inteiro em centavos')
  .positive('valor monetário deve ser positivo');

/** Inteiro em centavos com sinal (delta de modificador, pode ser desconto). */
export const signedMoneyCentsSchema = z
  .number()
  .int('valor monetário deve ser inteiro em centavos');

/** Data-hora ISO 8601 em UTC (`2026-05-22T19:30:00Z`). */
export const isoDateTimeSchema = z.string().datetime({ offset: true });

/** Quantidade unitária de item de pedido — `quantity > 0` (CHECK do schema). */
export const quantitySchema = z
  .number()
  .int('quantidade deve ser inteira')
  .positive('quantidade deve ser maior que zero');

/** Header `Idempotency-Key` — UUID v4 por exigência do §1. */
export const idempotencyKeySchema = uuidSchema;
