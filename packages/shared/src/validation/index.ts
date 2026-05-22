/**
 * Barrel de re-exportações dos validadores Zod.
 *
 * Um arquivo por domínio, espelhando `api-contracts.md`:
 *
 *   primitives.ts  — UUID, money cents, datas, quantidades
 *   enums.ts       — enums espelhando CHECK constraints do DDL
 *   errors.ts      — envelope de erro (§1)
 *   auth.ts        — login + claims JWT (§2)
 *   tenant.ts      — onboarding e configuração de tenant (§3)
 *   menu.ts        — cardápio admin (§4)
 *   orders.ts      — criação, transição, cancelamento (§6)
 *   pix.ts         — cobrança e webhook Asaas (§8)
 *   cash.ts        — caixa, pagamentos manuais, estornos (§9)
 *   couriers.ts    — motoboys (§10)
 *   print.ts       — ACK de print job (§11)
 */
export * from './primitives.js';
export * from './enums.js';
export * from './errors.js';
export * from './auth.js';
export * from './tenant.js';
export * from './menu.js';
export * from './orders.js';
export * from './pix.js';
export * from './cash.js';
export * from './couriers.js';
export * from './print.js';
