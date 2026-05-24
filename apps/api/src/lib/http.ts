/**
 * Helpers de resposta — envelope de erro padronizado (`api-contracts.md` §1)
 * e parser de paginação por query string (`?limit=&offset=`).
 */
import type { ErrorCode } from '@saas-foodtech/shared';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

interface ErrorDetail {
  field: string;
  issue: string;
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: ErrorDetail[],
): FastifyReply {
  return reply
    .code(statusCode)
    .send({ error: { code, message, ...(details && { details }) } });
}

export function sendValidationError(
  reply: FastifyReply,
  zodError: z.ZodError,
): FastifyReply {
  return sendError(
    reply,
    422,
    'validation_error',
    'Payload inválido.',
    zodError.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      issue: issue.message,
    })),
  );
}

/** `?limit=`/`?offset=` — defaults conforme `api-contracts.md` §1. */
export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type Pagination = z.infer<typeof paginationSchema>;
