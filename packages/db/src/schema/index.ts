/**
 * Barrel de re-exportações do schema Drizzle.
 *
 * Cada arquivo deste diretório corresponde a uma seção de
 * `docs/specs/data-schema.md`. Mantenha o mapa abaixo em sincronia:
 *
 *   §1 Tenants, Usuários & Motoboys      → ./tenants.js
 *   §2 Cardápio                          → ./menu.js
 *   §3 Pedidos                           → ./orders.js
 *   §4 Cobranças Pix (Asaas)             → ./pix.js
 *   §5 Ledger de Dupla Entrada           → ./ledger.js
 *   §6 Sessões de Caixa & Pagamentos     → ./cash.js
 *   §7 Fila de Impressão                 → ./print.js
 */
export * from './tenants.js';
export * from './menu.js';
export * from './orders.js';
export * from './pix.js';
export * from './ledger.js';
export * from './cash.js';
export * from './print.js';
