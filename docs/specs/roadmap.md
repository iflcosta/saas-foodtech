# Roadmap & Estado do Projeto — SaaS Foodtech POS & Delivery

- **Status:** Documento vivo — atualizado a cada avanço
- **Última atualização:** 2026-05-24
- **Função:** Rastrear *onde o projeto está agora* e *o que ainda falta produzir*.
  Complementa o `spec.md`, que descreve o destino (visão, ADRs, requisitos), mas não a
  posição atual.

> **Para qualquer sessão ou agente:** leia este arquivo primeiro. Ele informa a fase atual,
> o próximo passo e as decisões já tomadas. Ao concluir uma tarefa, **atualize este
> documento no mesmo commit** — progresso ou decisão não escrita é contexto perdido.

---

## 1. Fase Atual

**Fase 4 em andamento — fundação aplicada.** `docker-compose.yml` (Postgres 16) +
`db:push` aplicando as 17 tabelas no DB real + auth JWT + middleware de tenant
(plugin Fastify decora `req.auth = { userId, tenantId, role }`) + RBAC por papel +
`POST /v1/auth/login` com bcryptjs. Validado com 18 testes verdes (12 unit + 6
integração contra Postgres real) e smoke test HTTP. CI ganhou serviço Postgres para
rodar a suíte de integração. Próximo: **fatia 4b.1** — cardápio admin + leitura pública
(ver §4.1 para a sequência completa).

| # | Fase | Status |
|---|---|---|
| 1 | Especificação fundacional (`spec.md`) | Concluída |
| 2 | Especificação técnica detalhada | Concluída |
| 3 | Scaffolding & infraestrutura | Concluída |
| 4 | Implementação da V1.0 | Em andamento — fundação aplicada |
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

Fundação da Fase 4 entregue. Próxima frente: RF-1 (ingestão de pedidos).

| Área | Componente | Status |
|---|---|---|
| Fundação | Monorepo + npm workspaces + TS estrito + CI | Esqueleto validado; CI agora levanta Postgres como serviço e roda integração |
| Fundação | Schema Drizzle (`packages/db` — 17 tabelas) | Aplicado em Postgres real via `db:push` |
| Fundação | Validadores Zod (`packages/shared`) | Esqueleto escrito |
| Fundação | Auth JWT + middleware de tenant | Implementado — `POST /v1/auth/login` + `app.authenticate` + `app.requireRole` (18 testes verdes) |
| RF-1 | Ingestão de pedidos (cardápio, WhatsApp, triagem) | Não iniciado (api/pos em esqueleto) |
| RF-2 | Motor ESC/POS + ponte de impressão Go | Casca WS no `apps/bridge` (`/health` + ack), sem ESC/POS real |
| RF-3 | Cardápio & onboarding | Não iniciado |
| RF-4 | Pagamento Pix dinâmico (Asaas) | Não iniciado |
| RF-5 | Ledger & fechamento de caixa | Não iniciado |
| RF-6 | Resiliência & diagnóstico (PWA) | `diagnostics:local` em stub; PWA do `apps/pos` em casca |

---

## 4. Próximos Passos

### 4.1 Sequência da Fase 4

Espinha do MVP do menor risco ao maior, cada fatia entrega valor demonstrável sem
depender da seguinte. Detalhamento (rotas exatas, schemas Zod, testes) é escrito **no
início de cada fatia**, não aqui — este §4.1 é apenas o mapa.

| Fatia | Status | Escopo | RFs cobertos | Encerra em |
|---|---|---|---|---|
| 4a — Fundação | Concluída | Auth JWT + middleware de tenant + Postgres + `db:push` | RNF-1, RNF-5 | "Login devolve token escopado por tenant" |
| 4b.1 — Cardápio admin + leitura pública | **Próxima** | CRUD autenticado de `categories` / `products` / `modifier_groups` / `modifiers` + attach grupos a produto + `GET /v1/menu/:slug` público | RF-3.1, RF-3.2 (rotas) | "Lojista monta cardápio; link público renderiza" |
| 4b.2 — Ingestão de pedido | Pendente | `POST /v1/menu/:slug/orders` (público) + `POST /v1/orders` (manual, operator) + recálculo autoritativo de `unit_price` / `subtotal` / `total` no servidor (RNF §12) + pizza fracionada (ADR-Q9) + combos rejeitados se preço zerar | RF-1 ingestão, RF-3.3 | "Pedido aparece em `orders` com status `pending`" |
| 4c — Triage + WS + PWA panel | Pendente | `GET /v1/orders` (filtro por status/data) + `POST /accept` + `POST /transition` + `POST /cancel` + WS `/v1/ws` (`order.new`, `order.status_changed`) + tela de triagem + alerta sonoro repetido (RF-1.5) | RF-1.1 a RF-1.5 | "Operador aceita pedido com 1 toque na tela" |
| 4d — Motor ESC/POS | Pendente | Geração de buffers ESC/POS em `apps/api` + bridge Go consumindo via WS local (porta 9100) + roteamento setorial (`kitchen`/`bar`/`dispatch`) + `print_jobs` + ACK | RF-2 completo | "Aceitar pedido imprime comanda na térmica" |
| 4e — Pix dinâmico (Asaas) | Pendente | `POST /v1/orders/:id/pix-charge` (resolver body em `api-contracts.md §8` antes — pendência aberta) + webhook Asaas assinado + bloqueio de despacho até liquidação (409 `payment_required`) | RF-4 | "Cliente paga Pix; despacho desbloqueia automaticamente" |
| 4f — Ledger + fechamento de caixa | Pendente | Lançamentos de dupla entrada append-only + conta por motoboy (RF-5.3) + acerto em tempo real + fechamento de caixa cego (RF-5.4) | RF-5 | "Lojista fecha o dia com Ledger íntegro" |
| 4g — Resiliência PWA | Pendente | Service Worker + Cache API + IndexedDB para pedidos em aberto e buffers de impressão + `npm run diagnostics:local` real | RF-6, RNF-3 | "PDV opera com Wi-Fi piscando; recupera no reconnect" |

> **Regra:** ao fechar cada fatia, atualizar §1 (fase atual), §3 (status), §6 (decisão
> corrida) e bumpar a data do cabeçalho — no mesmo commit da entrega.

### 4.2 Pendências de spec/schema/auth em aberto

1. **`api-contracts.md §8` — body do `POST /v1/orders/:id/pix-charge`** sem definição.
   Resolver junto da 4e. Já modelado em `packages/shared` com `expires_in_seconds` opcional.
2. **Schema — TZ por tenant.** Índice `idx_orders_daily_seq` usa `'America/Sao_Paulo'`
   hardcoded (coerente com "pt-BR + BRL apenas"). Revisar para `tenants.timezone` em
   V1.1+ se expandir região.
3. **Auth — colisão de email entre tenants.** Schema permite email duplicado em tenants
   distintos; login global trata como "credencial inválida" (sem adivinhar tenant). UX
   final (workspace selector / email globalmente único) revisita pós-MVP.

### 4.3 Hardening pré-MVP

5 vulnerabilidades moderadas restantes na cadeia `esbuild → vite / vitest / drizzle-kit`.
Fix exige subir Vite 5 → 8 (3 majors, quebraria `vite-plugin-pwa` e a integração com
`vitest 2.x`). Risco é apenas dev/CI; não bloqueia a Fase 4. Tratar antes do lançamento.

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
| 2026-05-24 | **Sequência da Fase 4 mapeada** (§4.1): 4a fundação → 4b.1 cardápio admin + leitura pública → 4b.2 ingestão de pedido → 4c triage + WS + PWA → 4d ESC/POS → 4e Pix → 4f Ledger → 4g resiliência PWA. Espinha vertical: cada fatia entrega valor demonstrável sem depender da seguinte. Optou-se por iniciar pela 4b.1 (cardápio antes da ingestão) para evitar seed throwaway e exercitar o `requireRole('manager')` em rotas reais. Detalhamento por fatia (rotas, schemas Zod, testes) é escrito no início de cada — este §4.1 é apenas o mapa. Auditoria do estado pré-fatia: branch limpa, 17 tabelas no Drizzle ✓, 18 testes verdes, sem TODOs/órfãos, datas dos specs coerentes (apenas `data-schema.md` e `roadmap.md` em 2026-05-24, os demais em 2026-05-22 — corretos pois não foram tocados). |
| 2026-05-24 | **Fundação da Fase 4 entregue.** (a) `docker-compose.yml` (Postgres 16-alpine, volume persistente, healthcheck) na raiz; `.env.example` já apontava para a mesma URL. (b) `db:push` aplicou as 17 tabelas — `drizzle-orm` precisou ser declarado como devDep da raiz para o npm hoistar e o `drizzle-kit` (root) resolver o ORM (sintoma "Error please install required packages: 'drizzle-orm'" típico de monorepo). (c) Bug do schema corrigido: o índice `idx_orders_daily_seq` usava `(created_at::date)`, mas para `timestamptz` o cast é STABLE e Postgres exige IMMUTABLE em btree; trocado por `((created_at AT TIME ZONE 'America/Sao_Paulo')::date)` — fixado e refletido em `data-schema.md` §3 e `packages/db/src/schema/orders.ts`. O TZ está hardcoded coerente com a decisão "pt-BR + BRL apenas" do MVP; per-tenant TZ entra no §4. (d) `apps/api` ganhou `config.ts` (Zod valida `DATABASE_URL`, `JWT_SECRET ≥ 32`, `PORT`, `HOST`, `NODE_ENV`), `lib/password.ts` (`bcryptjs` puro JS — sem node-gyp, OWASP 10 rounds), `plugins/auth.ts` (registra `@fastify/jwt`, decora `app.authenticate` e `app.requireRole` via `fastify-plugin`; popula `req.auth = { userId, tenantId, role }` exclusivamente do JWT — RNF-1) e `routes/auth.ts` (`POST /v1/auth/login` com `loginInputSchema` strict, resposta uniforme em todos os 401 para evitar enumeração, refusa colisão de email entre tenants). (e) `server.ts` recebe `{ db, jwtSecret }` para injeção em testes; `main.ts` carrega `loadConfig()` + `createClient()`. (f) **18 testes verdes** — 3 password, 8 plugin de auth (401 sem token / mal-assinado / expirado / claims inválidos; 200 popula auth; 403 RBAC operator → manager; 200 manager e owner), 6 integração rota de login (200 + token verificável, 401 senha errada, 401 email inexistente, 401 colisão multi-tenant, 422 corpo mal-formado, 422 campo extra rejeitado pelo `.strict()`) — mais `/health` e 1 PWA antigo. Smoke test HTTP confirmou login → JWT com `sub`/`tenant_id`/`role`/`exp`. (g) CI agora levanta `postgres:16-alpine` como serviço e exporta `INTEGRATION_DATABASE_URL` antes do `npm run test`, então a suíte de integração roda no PR. (h) Deps novas em `apps/api`: `@fastify/jwt ^10.1`, `bcryptjs ^3`, `fastify-plugin`, `@saas-foodtech/db`, `@saas-foodtech/shared`. CVEs moderadas caíram de 8 → 5 com o install. |
| 2026-05-22 | **Drizzle ORM bumpado** para `^0.45.2` (+ `drizzle-kit ^0.31.10`), fechando a CVE alta de SQL injection por identificadores mal escapados (GHSA-gpj5-g38j-94v9). Schema DSL é estável entre versões — typecheck e testes seguem verdes; a quebra de API da 0.45 é só na camada de queries, ainda não escrita. As 8 CVEs moderadas restantes ficam na cadeia `esbuild → vite / vitest / drizzle-kit` (dev/CI apenas): fix passa por subir Vite 5 → 8 (3 majors), risco contido em desenvolvimento. Adiado para hardening pré-MVP — registrado no §4. |
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
