# 🚀 SaaS Foodtech POS & Delivery - Project Constitution

## Tech Stack & Architecture

- **Backend Engine:** Node.js (Fastify) com TypeScript estrito.
- **Frontend POS:** React (Vite) empacotado como PWA com armazenamento transacional SQLite embarcado.
- **Local Print Bridge:** Proxy TCP/WebSocket embarcado escrito em Go (escutando na porta 9100).
- **Data Layer:** PostgreSQL (Cloud), SQLite (Local Client) e sincronização bidirecional assíncrona.
- **Reconciliação:** Banco Central Open Finance Pix API (Webhooks transacionais assinados).

## Architectural Rules (CRITICAL)

- **Local-First Priority:** Mutações de estado de vendas no POS devem ser salvas de forma síncrona no SQLite antes de subir para a nuvem.
- **Zero Raw Printing Dialogs:** Toda impressão térmica deve ignorar a janela de impressão nativa e enviar buffers ESC/POS em Base64 via WebSocket local.
- **Double-Entry Bookkeeping:** O ledger financeiro do caixa deve usar partidas dobradas de débito/crédito.
- **Simplest Solution:** Priorize código limpo, evite abstrações prematuras e use validações estritas de schema com Zod.

## Build & Test Commands

- **Install:** `npm install`
- **Dev Mode:** `npm run dev`
- **Run Tests:** `npm run test` (Vitest)
- **Sync Database:** `npm run db:push`
- **Diagnostics:** `npm run diagnostics:local`

## Subagent Delegation Map

- Banco de dados local, SQLite, IndexedDB, sincronização e workers offline: use **💾 Local-First**.
- Impressão térmica nativa, comandos de escape ESC/POS e WebSocket bridge: use **🖨️ ESC-POS**.
- Webhooks do iFood, fila assíncrona, rate-limits e APIs externas: use **🔌 Integration**.
- Ledger transacional contábil, segurança do Pix e regras de repasse: use **💰 Ledger**.
- Geração de specs, validação de segurança e análise de edge cases: use **🔍 QA Tester**.
