/**
 * Envelope de erro — `api-contracts.md` §1.
 *
 * Toda resposta de erro do backend Fastify deve seguir este formato.
 * Os códigos canônicos vivem em `./enums.ts` (`errorCodeSchema`).
 */
import { z } from 'zod';
import { errorCodeSchema } from './enums.js';

/** Item da lista `details[]` — descreve o campo que falhou e a mensagem. */
export const errorDetailSchema = z.object({
  field: z.string().min(1),
  issue: z.string().min(1),
});
export type ErrorDetail = z.infer<typeof errorDetailSchema>;

/** Corpo `error.*` do envelope. */
export const errorBodySchema = z.object({
  code: errorCodeSchema,
  message: z.string().min(1),
  details: z.array(errorDetailSchema).optional(),
});
export type ErrorBody = z.infer<typeof errorBodySchema>;

/** Envelope completo `{ error: { ... } }`. */
export const errorEnvelopeSchema = z.object({
  error: errorBodySchema,
});
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
