/**
 * Validação da Fila de Impressão — `api-contracts.md` §11.
 *
 * Endpoints consumidos pela ponte Go: a ponte busca jobs `pending` e devolve
 * o status via `POST /v1/print-jobs/:id/ack`. Em falha, `attempts++` e o job
 * continua elegível para reenvio (RF-2.4).
 */
import { z } from 'zod';

/**
 * ACK da ponte Go — `{ status: 'sent' }` em sucesso, ou
 * `{ status: 'failed', error: '...' }` em falha (RF-2.4).
 *
 * Usamos discriminated union para impor que `error` exista apenas no caminho
 * de falha — assim o servidor não precisa validar combinações inválidas.
 */
export const ackPrintJobSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('sent'),
  }),
  z.object({
    status: z.literal('failed'),
    error: z.string().min(1).max(500),
  }),
]);
export type AckPrintJobInput = z.infer<typeof ackPrintJobSchema>;
