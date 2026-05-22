/**
 * Validação de Motoboys — `api-contracts.md` §10.
 *
 * Motoboys não são excluídos: `PATCH { is_active: false }` os aposenta
 * (RF-5.6). O cadastro provisiona automaticamente a conta de Ledger do
 * motoboy no backend (RF-5.3).
 */
import { z } from 'zod';

export const createCourierSchema = z
  .object({
    name: z.string().min(1).max(120),
    phone: z.string().max(40).optional(),
  })
  .strict();
export type CreateCourierInput = z.infer<typeof createCourierSchema>;

export const updateCourierSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    phone: z.string().max(40).optional(),
    is_active: z.boolean().optional(),
  })
  .strict();
export type UpdateCourierInput = z.infer<typeof updateCourierSchema>;
