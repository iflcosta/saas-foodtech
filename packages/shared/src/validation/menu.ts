/**
 * Validação de Cardápio — `api-contracts.md` §4 e §12.
 *
 * Regras-chave:
 *  - `base_price_cents >= 0` (CHECK do DDL).
 *  - Combo com preço efetivo zerado é rejeitado (ADR-Q9) — validação adicional
 *    feita pela camada de negócio (não cobre Zod, depende do cardápio carregado).
 *  - `categories.print_queue` define o roteamento setorial (RF-2.2).
 */
import { z } from 'zod';
import { categoryPrintQueueSchema } from './enums.js';
import {
  moneyCentsSchema,
  signedMoneyCentsSchema,
  uuidSchema,
} from './primitives.js';

// --- Categories -----------------------------------------------------------

export const createCategorySchema = z
  .object({
    name: z.string().min(1).max(120),
    print_queue: categoryPrintQueueSchema.default('kitchen'),
    sort_order: z.number().int().nonnegative().default(0),
  })
  .strict();
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// --- Products -------------------------------------------------------------

export const createProductSchema = z
  .object({
    category_id: uuidSchema,
    name: z.string().min(1).max(120),
    description: z.string().max(2000).optional(),
    base_price_cents: moneyCentsSchema,
    is_pizza: z.boolean().default(false),
    sort_order: z.number().int().nonnegative().default(0),
  })
  .strict();
export type CreateProductInput = z.infer<typeof createProductSchema>;

export const updateProductSchema = createProductSchema.partial();
export type UpdateProductInput = z.infer<typeof updateProductSchema>;

// --- Modifier Groups ------------------------------------------------------

export const createModifierGroupSchema = z
  .object({
    name: z.string().min(1).max(120),
    min_choices: z.number().int().nonnegative().default(0),
    max_choices: z.number().int().positive().default(1),
    is_required: z.boolean().default(false),
  })
  .strict()
  .refine((g) => g.max_choices >= g.min_choices, {
    message: 'max_choices não pode ser menor que min_choices',
    path: ['max_choices'],
  });
export type CreateModifierGroupInput = z.infer<typeof createModifierGroupSchema>;

export const updateModifierGroupSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    min_choices: z.number().int().nonnegative().optional(),
    max_choices: z.number().int().positive().optional(),
    is_required: z.boolean().optional(),
  })
  .strict();
export type UpdateModifierGroupInput = z.infer<typeof updateModifierGroupSchema>;

// --- Modifiers ------------------------------------------------------------

export const createModifierSchema = z
  .object({
    name: z.string().min(1).max(120),
    price_delta_cents: signedMoneyCentsSchema.default(0),
    is_exclusion: z.boolean().default(false),
    sort_order: z.number().int().nonnegative().default(0),
  })
  .strict();
export type CreateModifierInput = z.infer<typeof createModifierSchema>;

// --- Product ↔ Modifier Groups (N:N) -------------------------------------

export const setProductModifierGroupsSchema = z
  .object({
    modifier_group_ids: z.array(uuidSchema),
  })
  .strict();
export type SetProductModifierGroupsInput = z.infer<
  typeof setProductModifierGroupsSchema
>;
