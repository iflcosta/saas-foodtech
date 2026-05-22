# 🚀 SaaS Foodtech POS & Delivery - Project Constitution

> Escopo vigente: **V1.0 (MVP)**. Roadmap completo, ADRs e requisitos em `docs/specs/spec.md`.

## Tech Stack & Architecture

- **Backend Engine:** Node.js (Fastify) com TypeScript estrito.
- **Frontend POS:** React (Vite) empacotado como PWA de Alta Disponibilidade (Service Workers + Cache API); estado de sessão e buffers de impressão persistidos em IndexedDB.
- **Local Print Bridge:** Proxy TCP/WebSocket embarcado escrito em Go (porta 9100; impressoras USB e Ethernet).
- **Data Layer:** PostgreSQL (Cloud) multi-tenant, isolado logicamente por `tenant_id`; IndexedDB no cliente. SQLite embarcado e sincronização bidirecional planejados para a V1.5.
- **Reconciliação:** Pix dinâmico por pedido via Asaas, com Webhooks de liquidação assinados.

## Architectural Rules (CRITICAL)

- **High-Availability Priority:** O POS é um PWA resiliente — UI, sons de alerta e pedidos em aberto operam a partir de cache local (Service Worker + IndexedDB), mantendo o caixa funcional sob rede instável.
- **Zero Raw Printing Dialogs:** Toda impressão térmica deve ignorar a janela de impressão nativa e enviar buffers ESC/POS em Base64 via WebSocket local.
- **Double-Entry Bookkeeping:** O ledger financeiro do caixa deve usar partidas dobradas de débito/crédito, em modo append-only (estornos por novo lançamento).
- **Simplest Solution:** Priorize código limpo, evite abstrações prematuras e use validações estritas de schema com Zod.

## Build & Test Commands

- **Install:** `npm install`
- **Dev Mode:** `npm run dev`
- **Run Tests:** `npm run test` (Vitest)
- **Sync Database:** `npm run db:push`
- **Diagnostics:** `npm run diagnostics:local`

## Subagent Delegation Map

- Persistência local (IndexedDB), cache offline, sincronização e workers: use **💾 Local-First**.
- Interface React PWA, design system e usabilidade do PDV, cardápio e onboarding: use **🎨 Frontend/UX**.
- Impressão térmica nativa, comandos de escape ESC/POS e WebSocket bridge: use **🖨️ ESC-POS**.
- Webhooks do iFood, fila assíncrona, rate-limits e APIs externas: use **🔌 Integration**.
- Ledger transacional contábil, segurança do Pix e regras de repasse: use **💰 Ledger**.
- Geração de specs, validação de segurança e análise de edge cases: use **🔍 QA Tester**.
