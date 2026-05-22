# Roadmap & Estado do Projeto — SaaS Foodtech POS & Delivery

- **Status:** Documento vivo — atualizado a cada avanço
- **Última atualização:** 2026-05-22
- **Função:** Rastrear *onde o projeto está agora* e *o que ainda falta produzir*.
  Complementa o `spec.md`, que descreve o destino (visão, ADRs, requisitos), mas não a
  posição atual.

> **Para qualquer sessão ou agente:** leia este arquivo primeiro. Ele informa a fase atual,
> o próximo passo e as decisões já tomadas. Ao concluir uma tarefa, **atualize este
> documento no mesmo commit** — progresso ou decisão não escrita é contexto perdido.

---

## 1. Fase Atual

**Fase 3 concluída.** Esqueleto do monorepo escrito e validado localmente
(`npm install`, `npm run typecheck`, `npm run lint`, `npm run test` — 3 testes verdes).
Próximo: iniciar a Fase 4 — implementação da V1.0.

| # | Fase | Status |
|---|---|---|
| 1 | Especificação fundacional (`spec.md`) | Concluída |
| 2 | Especificação técnica detalhada | Concluída |
| 3 | Scaffolding & infraestrutura | Concluída |
| 4 | Implementação da V1.0 | Pendente |
| 5 | Lançamento do MVP | Pendente |

---

## 2. Status das Specs

| Documento | Conteúdo | Status |
|---|---|---|
| `spec.md` | Master: visão, roadmap, ADRs Q1–Q10, RF/RNF | Estável (V1.0) |
| `data-schema.md` | Schema PostgreSQL — 17 tabelas | Estável (V1.0) |
| `api-contracts.md` | Endpoints REST + WebSocket + schemas Zod | Estável (V1.0) |
| `design-system.md` | Design brief para o Claude Design | Estável (V1.0) |

---

## 3. Status de Implementação

Esqueleto da Fase 3 escrito; nenhum requisito funcional implementado ainda.

| Área | Componente | Status |
|---|---|---|
| Fundação | Monorepo + npm workspaces + TS estrito + CI | Esqueleto validado (install/typecheck/lint/test ok) |
| Fundação | Schema Drizzle (`packages/db` — 17 tabelas) | Modelado — `db:push` ainda não executado |
| Fundação | Validadores Zod (`packages/shared`) | Esqueleto escrito |
| Fundação | Auth JWT + middleware de tenant | Não iniciado |
| RF-1 | Ingestão de pedidos (cardápio, WhatsApp, triagem) | Não iniciado (api/pos em esqueleto) |
| RF-2 | Motor ESC/POS + ponte de impressão Go | Casca WS no `apps/bridge` (`/health` + ack), sem ESC/POS real |
| RF-3 | Cardápio & onboarding | Não iniciado |
| RF-4 | Pagamento Pix dinâmico (Asaas) | Não iniciado |
| RF-5 | Ledger & fechamento de caixa | Não iniciado |
| RF-6 | Resiliência & diagnóstico (PWA) | `diagnostics:local` em stub; PWA do `apps/pos` em casca |

---

## 4. Próximos Passos

1. Iniciar a Fase 4 — implementação da V1.0, começando pela fundação (auth JWT + middleware de
   tenant + `db:push` contra um Postgres real) e por RF-1 (ingestão de pedidos).
2. Revisar as 9 vulnerabilidades transitivas (8 moderadas, 1 alta) reportadas no `npm install`
   antes de avançar muito na Fase 4.

---

## 5. Backlog Pós-MVP

Origem: `spec.md` §2 (roadmap de versões) e §7 (fora de escopo). Registrado aqui para não
se perder após o lançamento do MVP:

- **V1.1** — Integração com a iFood Developer API (Webhook + polling de contingência 5 min).
- **V1.5** — Local-First pleno: SQLite embarcado + sincronização bidirecional (CRDT / LWW).
- **V2.0** — Emissão fiscal eletrônica (NFC-e / SAT).
- **A reavaliar após o MVP** — cobrança da assinatura do SaaS (Fluxo A); pagamento com
  cartão no checkout digital; onboarding de cardápio assistido por IA; subconta
  white-label no Asaas; impressão térmica via Bluetooth.

---

## 6. Log de Decisões Corridas

Decisões tomadas durante o desenvolvimento que **não** são ADRs da entrevista spec-first
(Q1–Q10, registradas em `spec.md` §3). Entrada mais recente no topo.

| Data | Decisão |
|---|---|
| 2026-05-22 | **Fase 3 concluída.** Esqueleto validado localmente: `npm install` (632 pacotes, 54s), `npm run typecheck`, `npm run lint`, `npm run test` (3 verdes — `apps/api` `/health`, `apps/pos` `ConnectionStatus`, `apps/bridge` `go test`). Correções no caminho: (1) `packages/db/tsconfig.json` deixou de incluir `drizzle.config.ts` (conflitava com `rootDir: "./src"`); (2) `packages/db/src/schema/ledger.ts` agora importa `AnyPgColumn` de `drizzle-orm/pg-core` (mudou de pacote na 0.36); (3) script `test` da raiz passa a delegar para os workspaces (`--workspaces --if-present`) para cada um carregar sua própria config do Vitest (apps/pos precisa de jsdom). Anotado: 9 vulnerabilidades transitivas (8 mod, 1 alta) — listadas no §4 para revisar antes da Fase 4. |
| 2026-05-22 | **Fase 3 iniciada.** Esqueleto do monorepo escrito (root config + `apps/{api,pos,bridge}` + `packages/{db,shared}` + GitHub Actions). Stack escolhida: npm workspaces + TypeScript estrito + Fastify v5 + React 18/Vite 5/`vite-plugin-pwa` + Go 1.22 com `github.com/coder/websocket` + Drizzle ORM/PostgreSQL + Zod + Vitest + ESLint flat + Prettier. **Drizzle** sobre Prisma pelo footprint baixo em VPS 1c/1GB (RNF-2) e schema TS espelho do `data-schema.md`; **npm workspaces** sobre pnpm por alinhamento com `CLAUDE.md`. |
| 2026-05-22 | Lacuna de spec encontrada no scaffolding: `POST /v1/orders/:id/pix-charge` em `api-contracts.md §8` não define corpo de requisição. Modelado em `packages/shared` com `expires_in_seconds` opcional (`createPixChargeSchema`) — resolver junto da implementação real do Pix (Fase 4) ou voltar para a `api-contracts.md` antes. |
| 2026-05-22 | **Fase 2 fechada.** Revisão conjunta das três specs detalhadas; as 4 lacunas do `design-system.md` §8 foram resolvidas: (1) acessibilidade promovida a **RNF-7** no `spec.md`; (2) repetição do alerta sonoro elevada a **RF-1.5**; (3) i18n declarada fora de escopo da V1.0 (`spec.md` §7); (4) estado vazio da triagem descrito no `design-system.md` §4.1. §8 do `design-system.md` removido. As três specs ficam em **Estável (V1.0)**. |
| 2026-05-22 | `design-system.md` escrito — design brief versionado (tokens, componentes-chave, telas, estados de resiliência, handoff com o Claude Design). 4 lacunas de UI sem requisito (acessibilidade, i18n, repetição do alerta sonoro, estado vazio da triagem) registradas no §8 do doc para decisão na revisão da Fase 2, sem criar RF novo. |
| 2026-05-22 | Roteamento setorial de impressão (RF-2.2): adicionado `categories.print_queue` (`kitchen` / `bar`); o item herda a fila da categoria e a comanda `dispatch` é gerada por pedido. Nível de categoria escolhido pelo menor atrito de onboarding. Lacuna encontrada ao escrever `api-contracts.md`. |
| 2026-05-22 | Escopo do `api-contracts.md` confirmado: auth, onboarding, cardápio (admin + público), pedidos, WebSocket do PDV, Pix + webhook, Ledger/caixa, motoboys, fila de impressão, validação Zod. O protocolo do WebSocket local ESC/POS fica para um doc próprio. |
| 2026-05-22 | Criada a tabela `couriers` (+ `orders.courier_id` / `delivery_fee_cents` + conta de Ledger por motoboy), fechando lacuna de RF-5.3 — o schema não rastreava a taxa por motoboy. Adicionado RF-5.6. |
| 2026-05-22 | Specs detalhadas organizadas **por camada** (`data-schema.md`, `api-contracts.md`, `design-system.md`), não por feature; cada uma planejada e fechada individualmente. |
| 2026-05-22 | Schema de dados extraído de `spec.md` §6 para `data-schema.md`; §6 reduzido a ponteiro, mantendo o `spec.md` enxuto como master. |
| 2026-05-22 | Agente **Frontend/UX** adicionado ao roster; atua como ponte para o Claude Design — redige o `design-system.md` e integra o handoff bundle ao PWA. |
