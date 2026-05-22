/**
 * Validação de autenticação — `api-contracts.md` §2.
 *
 * `tenant_id` jamais entra pelo payload — é derivado do JWT pelo middleware
 * de tenant (RNF-1 / ADR-Q7).
 */
import { z } from 'zod';
import { userRoleSchema } from './enums.js';
import { uuidSchema } from './primitives.js';

export const loginInputSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1, 'senha obrigatória'),
  })
  .strict();
export type LoginInput = z.infer<typeof loginInputSchema>;

/** Claims do JWT — emitido pelo backend, consumido pelo middleware. */
export const jwtClaimsSchema = z.object({
  sub: uuidSchema, // user_id
  tenant_id: uuidSchema,
  role: userRoleSchema,
  exp: z.number().int().positive(),
});
export type JwtClaims = z.infer<typeof jwtClaimsSchema>;
