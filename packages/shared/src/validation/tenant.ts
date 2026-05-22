/**
 * Validação de Tenant / Onboarding — `api-contracts.md` §3.
 *
 * `POST /v1/tenants` é operação interna do SaaS — sem signup público no MVP
 * (ADR-Q2). `PATCH /v1/tenant/asaas` armazena a chave criptografada e nunca
 * a retorna em respostas.
 */
import { z } from 'zod';
import { pizzaPriceRuleSchema } from './enums.js';

/** Criação de tenant (operação interna). */
export const createTenantSchema = z
  .object({
    name: z.string().min(1).max(120),
    slug: z
      .string()
      .min(2)
      .max(64)
      .regex(/^[a-z0-9-]+$/, 'slug deve ser kebab-case alfanumérico'),
    phone_whatsapp: z.string().min(8).max(40),
    pizza_price_rule: pizzaPriceRuleSchema.default('most_expensive'),
  })
  .strict();
export type CreateTenantInput = z.infer<typeof createTenantSchema>;

/** PATCH /v1/tenant (dados gerais). */
export const updateTenantSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    phone_whatsapp: z.string().min(8).max(40).optional(),
    pizza_price_rule: pizzaPriceRuleSchema.optional(),
  })
  .strict();
export type UpdateTenantInput = z.infer<typeof updateTenantSchema>;

/** PATCH /v1/tenant/asaas — credenciais sensíveis (chave criptografada). */
export const updateTenantAsaasSchema = z
  .object({
    asaas_account_id: z.string().min(1).max(120),
    asaas_api_key: z.string().min(1),
  })
  .strict();
export type UpdateTenantAsaasInput = z.infer<typeof updateTenantAsaasSchema>;
