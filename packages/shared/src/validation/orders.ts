/**
 * Validação de pedidos — `api-contracts.md` §6 e §12.
 *
 * Pontos críticos:
 *  - `orders.id` é UUIDv4 gerado no cliente (ADR-Q10).
 *  - Nenhum valor monetário do payload é confiado: o servidor recalcula
 *    `unit_price_cents`, `subtotal_cents` e `total_cents`.
 *  - Pizza fracionada: ratios devem somar 1.0 (validado pelo backend).
 *  - Transição inválida → 409 `invalid_transition`; despacho de pedido
 *    Pix pendente → 409 `payment_required` (RF-4.3).
 */
import { z } from 'zod';
import {
  orderStatusSchema,
  paymentMethodSchema,
} from './enums.js';
import { quantitySchema, uuidSchema } from './primitives.js';

/** Item de pizza fracionada (ADR-Q9). */
export const pizzaFractionInputSchema = z.object({
  product_id: uuidSchema,
  ratio: z
    .number()
    .positive('ratio deve ser positivo')
    .max(1, 'ratio não pode exceder 1'),
});
export type PizzaFractionInput = z.infer<typeof pizzaFractionInputSchema>;

/** Linha de item enviada pelo cliente — preço é recalculado no servidor. */
export const orderItemInputSchema = z.object({
  product_id: uuidSchema,
  quantity: quantitySchema,
  modifiers: z.array(uuidSchema).optional().default([]),
  pizza_fractions: z.array(pizzaFractionInputSchema).optional(),
  notes: z.string().max(500).optional(),
});
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;

/**
 * Criação do pedido pelo cardápio público (`POST /v1/menu/:slug/orders`).
 * O cliente envia o `id` UUIDv4; o servidor atribui `daily_sequence`.
 * Valores monetários NÃO entram aqui — são recalculados (RNF §12).
 */
export const createOrderPublicSchema = z.object({
  id: uuidSchema,
  customer_name: z.string().min(1).max(120),
  customer_phone: z.string().min(1).max(40),
  delivery_address: z.string().max(500).optional(),
  payment_method: paymentMethodSchema,
  items: z
    .array(orderItemInputSchema)
    .min(1, 'pedido precisa de ao menos um item'),
});
export type CreateOrderPublicInput = z.infer<typeof createOrderPublicSchema>;

/**
 * Criação manual pelo operador (`POST /v1/orders`) — pedido por telefone.
 * Mesma forma do payload público; `id` pode ser gerado pelo PWA offline.
 */
export const createOrderManualSchema = createOrderPublicSchema;
export type CreateOrderManualInput = z.infer<typeof createOrderManualSchema>;

/**
 * Transição de estado (`POST /v1/orders/:id/transition`).
 * Estados terminais (`delivered`, `cancelled`) não podem ser origem de uma
 * nova transição — validação adicional pertence à app, não ao Zod.
 */
export const transitionOrderSchema = z.object({
  to: orderStatusSchema,
});
export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>;

/** Cancelamento (`POST /v1/orders/:id/cancel`). */
export const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500).optional(),
});
export type CancelOrderInput = z.infer<typeof cancelOrderSchema>;
