/**
 * Validação Pix — `api-contracts.md` §8.
 *
 *  - `POST /v1/orders/:id/pix-charge` não tem corpo significativo (id vem do path);
 *    expomos um schema vazio para uniformidade do pipeline de validação.
 *  - Webhook Asaas: o corpo NÃO é confiável até verificação de assinatura.
 *    A idempotência é garantida por `event.id` (RF-4.4) — gravado em
 *    `pix_charges.webhook_event_id` (UNIQUE).
 */
import { z } from 'zod';
import { pixChargeStatusSchema } from './enums.js';
import {
  isoDateTimeSchema,
  positiveMoneyCentsSchema,
  uuidSchema,
} from './primitives.js';

/**
 * Corpo opcional ao gerar a cobrança Pix dinâmica (idempotente por pedido).
 * O `amount_cents` é recalculado pelo servidor a partir do pedido — quando
 * presente, deve coincidir com o `total_cents` recomposto (validado fora do Zod).
 */
export const createPixChargeSchema = z
  .object({
    expires_in_seconds: z
      .number()
      .int()
      .positive()
      .max(60 * 60 * 24, 'expiração máxima de 24h')
      .optional(),
  })
  .strict();
export type CreatePixChargeInput = z.infer<typeof createPixChargeSchema>;

/**
 * Payload retornado pelo servidor ao gerar / consultar a cobrança Pix.
 * Útil para tipar respostas no PWA e na rota pública de tracking.
 */
export const pixChargePayloadSchema = z.object({
  id: uuidSchema,
  order_id: uuidSchema,
  asaas_charge_id: z.string().min(1),
  amount_cents: positiveMoneyCentsSchema,
  qr_code_payload: z.string().min(1),
  qr_code_image_url: z.string().url().nullable().optional(),
  status: pixChargeStatusSchema,
  paid_at: isoDateTimeSchema.nullable().optional(),
  expires_at: isoDateTimeSchema.nullable().optional(),
});
export type PixChargePayload = z.infer<typeof pixChargePayloadSchema>;

/**
 * Webhook Asaas — eventos de liquidação (§8.3).
 *
 * Tipos relevantes para o MVP:
 *   `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED` → marca cobrança como paga.
 *
 * IMPORTANTE: este schema valida apenas o formato; a assinatura do header
 * deve ser verificada ANTES de invocar o Zod (RF-4.4).
 */
export const asaasWebhookEventTypeSchema = z.enum([
  'PAYMENT_CREATED',
  'PAYMENT_AWAITING_RISK_ANALYSIS',
  'PAYMENT_APPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_REPROVED_BY_RISK_ANALYSIS',
  'PAYMENT_RECEIVED',
  'PAYMENT_CONFIRMED',
  'PAYMENT_OVERDUE',
  'PAYMENT_DELETED',
  'PAYMENT_REFUNDED',
  'PAYMENT_CHARGEBACK_REQUESTED',
]);
export type AsaasWebhookEventType = z.infer<typeof asaasWebhookEventTypeSchema>;

export const asaasWebhookPaymentSchema = z.object({
  id: z.string().min(1), // asaas_charge_id
  status: z.string().min(1), // ex.: 'RECEIVED', 'CONFIRMED'
  value: z.number().positive().optional(),
  netValue: z.number().positive().optional(),
  paymentDate: z.string().optional(),
  externalReference: z.string().optional(),
});

export const asaasWebhookSchema = z.object({
  id: z.string().min(1), // event.id — chave de idempotência
  event: asaasWebhookEventTypeSchema,
  dateCreated: z.string().optional(),
  payment: asaasWebhookPaymentSchema,
});
export type AsaasWebhookPayload = z.infer<typeof asaasWebhookSchema>;
