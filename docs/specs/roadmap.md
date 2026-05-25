# Roadmap & Estado do Projeto — SaaS Foodtech POS & Delivery

- **Status:** Documento vivo — atualizado a cada avanço
- **Última atualização:** 2026-05-25
- **Função:** Rastrear *onde o projeto está agora* e *o que ainda falta produzir*.
  Complementa o `spec.md`, que descreve o destino (visão, ADRs, requisitos), mas não a
  posição atual.

> **Para qualquer sessão ou agente:** leia este arquivo primeiro. Ele informa a fase atual,
> o próximo passo e as decisões já tomadas. Ao concluir uma tarefa, **atualize este
> documento no mesmo commit** — progresso ou decisão não escrita é contexto perdido.

---

## 1. Fase Atual

**Fase 4 em andamento — fatia 4b.2 entregue.** Acumulado: fundação (auth + tenant +
Postgres), cardápio admin completo, cardápio público (`GET /v1/menu/:slug`) e
**ingestão de pedido com recálculo autoritativo no servidor** — `POST
/v1/menu/:slug/orders` (público, rate-limited) + `POST /v1/orders` (manual,
operator) + `GET /v1/orders` (triagem) + `GET /v1/orders/:id` (detalhe). Preços,
pizza fracionada (ADR-Q9 — `most_expensive` / `average`), modificadores e
`daily_sequence` (#101…) são todos resolvidos pelo servidor; payload do cliente é
ignorado em qualquer campo monetário (RNF §12). Idempotência via UUIDv4 do pedido.
**57 testes verdes** (12 unit + 45 integração contra Postgres real). Próximo:
**fatia 4c** — triagem + WS + painel PWA (`POST /accept`, `POST /transition`,
`POST /cancel`, WS `/v1/ws`). Ver §4.1.

| # | Fase | Status |
|---|---|---|
| 1 | Especificação fundacional (`spec.md`) | Concluída |
| 2 | Especificação técnica detalhada | Concluída |
| 3 | Scaffolding & infraestrutura | Concluída |
| 4 | Implementação da V1.0 | Em andamento — 4a + 4b.1 + 4b.2 entregues |
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

Fatia 4b.2 (ingestão de pedido) entregue. Próxima frente: 4c — triagem + WS + PWA.

| Área | Componente | Status |
|---|---|---|
| Fundação | Monorepo + npm workspaces + TS estrito + CI | Esqueleto validado; CI levanta Postgres como serviço e roda integração |
| Fundação | Schema Drizzle (`packages/db` — 17 tabelas) | Aplicado em Postgres real via `db:push`. Cascade `tenant_id → tenants` aplicado em `orders`/`order_items`/`order_item_modifiers` (4b.2); demais tabelas sem cascade ficam como pendência (§4.2 item 5) |
| Fundação | Validadores Zod (`packages/shared`) | 11 domínios — cardápio + orders cobrem 4b.1/4b.2 |
| Fundação | Auth JWT + middleware de tenant | Implementado (`POST /v1/auth/login`, `app.authenticate`, `app.requireRole`) |
| Fundação | Rate-limit por IP | `@fastify/rate-limit` v10 registrado globalmente (200 req/min); rota pública de criação de pedido tem override mais apertado (20 req/min/IP). Desativado em testes via `rateLimitDisabled: true` |
| RF-1 | Ingestão de pedidos | **Criação entregue** — `POST /v1/menu/:slug/orders` (público + rate-limited), `POST /v1/orders` (manual operator), `GET /v1/orders` (lista com filtro `?status=`/`?date=`), `GET /v1/orders/:id` (detalhe com items+modifiers). Recálculo autoritativo, pizza fracionada, idempotência. Triagem (`/accept`, `/transition`, `/cancel`, WS) na 4c |
| RF-2 | Motor ESC/POS + ponte de impressão Go | Casca WS no `apps/bridge`; ESC/POS para 4d |
| RF-3 | Cardápio & onboarding | **CRUD entregue** (categorias / produtos / grupos / modificadores / attach N:N) + cardápio público `GET /v1/menu/:slug`; onboarding wizard pendente |
| RF-4 | Pagamento Pix dinâmico (Asaas) | Não iniciado (fatia 4e) |
| RF-5 | Ledger & fechamento de caixa | Não iniciado (fatia 4f) |
| RF-6 | Resiliência & diagnóstico (PWA) | `diagnostics:local` em stub; PWA em casca (fatia 4g) |

---

## 4. Próximos Passos

### 4.1 Sequência da Fase 4

Espinha do MVP do menor risco ao maior, cada fatia entrega valor demonstrável sem
depender da seguinte. Detalhamento (rotas exatas, schemas Zod, testes) é escrito **no
início de cada fatia**, não aqui — este §4.1 é apenas o mapa.

| Fatia | Status | Escopo | RFs cobertos | Encerra em |
|---|---|---|---|---|
| 4a — Fundação | Concluída | Auth JWT + middleware de tenant + Postgres + `db:push` | RNF-1, RNF-5 | "Login devolve token escopado por tenant" |
| 4b.1 — Cardápio admin + leitura pública | Concluída | CRUD autenticado de `categories` / `products` / `modifier_groups` / `modifiers` + attach grupos a produto + `GET /v1/menu/:slug` público | RF-3.1, RF-3.2 (rotas) | "Lojista monta cardápio; link público renderiza" |
| 4b.2 — Ingestão de pedido | Concluída | `POST /v1/menu/:slug/orders` (público, rate-limited) + `POST /v1/orders` (manual, operator) + `GET /v1/orders` + `GET /v1/orders/:id` + recálculo autoritativo de `unit_price` / `subtotal` / `total` no servidor (RNF §12) + pizza fracionada (ADR-Q9) + idempotência por UUIDv4 do pedido | RF-1 ingestão, RF-3.3 | "Pedido aparece em `orders` com status `pending`" |
| 4c — Triage + WS + PWA panel | **Próxima** | `POST /v1/orders/:id/accept` + `POST /v1/orders/:id/transition` + `POST /v1/orders/:id/cancel` + WS `/v1/ws?token=` (`order.created`, `order.updated`, `order.accepted`) + tela de triagem no PWA + alerta sonoro repetido (RF-1.5). Atenção: `transition → dispatched` deve devolver 409 `payment_required` quando `payment_method='pix'` e cobrança não liquidada (RF-4.3) — a checagem existe mas Pix ainda não está implementado (4e); manter o gate desligado por flag até 4e, ou implementar como bypass quando `pix_paid_at IS NULL AND payment_method != 'pix'`. Decidir no início da fatia | RF-1.1 a RF-1.5 | "Operador aceita pedido com 1 toque na tela" |
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
4. **Rate-limit por IP — parcialmente resolvido na 4b.2.** `@fastify/rate-limit` v10
   registrado globalmente (200 req/min) + override apertado (20/min) na rota pública
   `POST /v1/menu/:slug/orders`. `GET /v1/menu/:slug` ainda usa apenas o limite global —
   considerar override próprio se sob ataque (lê-only contra índices, baixo risco no MVP).
5. **Schema — cascade `tenant_id → tenants` incompleto.** Aplicado nas 3 tabelas de
   `orders` na 4b.2 (era necessário para tear down dos testes). Tabelas com FK sem cascade
   ainda: `pix_charges`, `cash_sessions`, `payments`, `ledger_entries`, `print_jobs`.
   Bug dormente: bloqueia `DELETE FROM tenants` apenas quando essas tabelas têm dados —
   atualmente nenhuma rota escreve nelas. Fixar JUNTO da fatia que ativa cada uma
   (4d print, 4e pix, 4f cash+ledger) na primeira passada de schema, antes de escrever
   os testes; usar `db:push --force` para refazer constraints.
6. **`api-contracts.md §6` — `tracking_token`.** Spec define `GET /v1/orders/track/:token`
   (4c) e o response da criação inclui `tracking_token`. Na 4b.2 estamos devolvendo o
   próprio `order.id` como token (UUID já é opaco para o cliente). Decidir na 4c: manter
   ou adicionar coluna `tracking_token` independente (privacy: não revela ID interno).

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
| 2026-05-25 | **Fatia 4b.2 entregue — ingestão de pedido com recálculo autoritativo.** (a) 4 endpoints novos em `apps/api/src/routes/orders.ts` (~580 linhas): `POST /v1/menu/:slug/orders` (público, rate-limited), `POST /v1/orders` (manual operator), `GET /v1/orders` (lista com `?status=`/`?date=`), `GET /v1/orders/:id` (detalhe com items+modifiers). (b) Pipeline em duas fases: `resolveAndPrice()` faz validação + cálculo de preço (3 queries em batch: produtos via `inArray`, modifiers via `inArray`, `productModifierGroups` para validar que cada modifier pertence a um grupo vinculado ao produto) — roda FORA da transação para reduzir hold de lock; `persistOrder()` faz INSERT atômico em transação com retry (máx 3 tentativas no conflito de unicidade `idx_orders_daily_seq`). (c) `daily_sequence` (#101, #102…) é gerado por `COALESCE(MAX(daily_sequence), 100) + 1` filtrando `(created_at AT TIME ZONE 'America/Sao_Paulo')::date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date` — fixa o reset diário no fuso BRT (coerente com a decisão "pt-BR + BRL apenas"). (d) Pizza fracionada (ADR-Q9): valida `is_pizza=true` no produto base + ratios das frações somam 1,0 ± 0,001; calcula `unit_price` por `most_expensive` (`Math.max(price)`) ou `average` (soma ponderada `price * ratio` arredondada) conforme `tenants.pizza_price_rule`. (e) Idempotência: SELECT por `(id, tenant_id)` dentro da transação; se já existe → retorna 200 com o pedido original (vs. 201 na criação). UUIDv4 do pedido É a chave de idempotência (RF-4.4, alinhado com ADR-Q10 "ID gerado no cliente"). (f) `@fastify/rate-limit` v10 (NOT v9 — v9 espera Fastify 4.x e quebrou o `server.test.ts` no primeiro install; bumpar foi instantâneo) registrado globalmente com 200 req/min, override por rota de 20 req/min na criação pública; `BuildOptions.rateLimitDisabled` desliga o limit em testes. (g) **Schema bug fix** descoberto durante teardown dos testes: `orders`/`order_items`/`order_item_modifiers` referenciavam `tenants(id)` sem cascade, bloqueando `DELETE FROM tenants` quando havia pedidos. Adicionado `onDelete: 'cascade'` nas 3 tabelas + atualizado `data-schema.md` §3 + `db:push --force` aplicou via `DROP/ADD CONSTRAINT`. As demais tabelas (pix/cash/ledger_entries/print) têm o mesmo bug dormente — anotado em §4.2 item 5 para fix junto da fatia que ativá-las. (h) `tracking_token` no response é por enquanto o próprio `order.id` (UUID já é opaco para cliente final); decidir na 4c se precisa coluna separada (anotado em §4.2 item 6). (i) **17 testes novos** = 57 total — POST público (7: 404 slug, 422 slug, criação simples, `daily_sequence` incremental, idempotência, com modificador, 422 modifier de outro tenant, 422 modifier não vinculado ao produto), pizza (3: 422 ratios !=1.0, 422 produto não-pizza, `most_expensive` correto), POST manual (2: 401 sem auth, 201 com operator), GET (5: lista, filtro status, detalhe com items+mods, 404 cross-tenant, etc.). Demais cenários (`average` rule, retry de `daily_sequence` race) deixados como cobertura futura. |
| 2026-05-24 | **Fatia 4b.1 entregue — cardápio admin + leitura pública.** (a) 4 arquivos de rota novos (`categories.ts`, `products.ts`, `modifier-groups.ts`, `menu.ts`) cobrindo 18 endpoints contra os 18 listados em `api-contracts.md` §4 e §5. Helpers comuns em `apps/api/src/lib/http.ts` (envelope de erro padronizado + `paginationSchema` `?limit=`/`?offset=`); o gabarito de cada rota replica o mesmo padrão (Zod `.safeParse` → `sendValidationError` em 422 → query escopada por `req.auth.tenantId` → soft-delete via `deleted_at`). (b) `categoryColumns` / `productColumns` / `groupColumns` / `modifierColumns` aliasam colunas Drizzle camelCase para `snake_case` no response, garantindo a convenção do §1 de `api-contracts.md`. (c) `PUT /v1/products/:id/modifier-groups` é replace transacional (DELETE + INSERT dentro de `db.transaction`) com validação prévia que todos os grupos sejam do mesmo tenant. (d) `GET /v1/menu/:slug` faz 6 queries por nível (tenant → categorias → produtos → links N:N → grupos → modificadores) e costura em memória — não usa relations API do Drizzle (não vale a boilerplate para um endpoint cacheável). Filtra `deleted_at IS NULL` em todos os nós; categorias deletadas levam seus produtos junto. (e) `apps/api/src/test-utils/seed.ts` virou setup compartilhado: cria tenant + manager + operator, assina tokens com `expiresIn: '8h'` (CRUCIAL — sem `expiresIn`, o `exp` claim não vai no JWT e o `jwtClaimsSchema` rejeita; descoberto durante o primeiro `npm test` que veio todo 401), retorna `{ app, db, tenantId, tenantSlug, managerToken, operatorToken, tag }` e tem `destroyTestContext` para `DELETE FROM tenants` (cascade limpa tudo). (f) **40 testes verdes** — 18 anteriores + 6 categories (incl. cross-tenant) + 6 products (incl. category de outro tenant rejeitada, PUT replace transacional, attach com grupo cross-tenant) + 5 modifier-groups (incl. PATCH min>max, soft-delete invisibiliza) + 5 menu público (incl. 404 slug, vazio, tree completo, deletados ocultos). (g) Rate-limit por IP da rota pública pendente — anotado em `roadmap.md` §4.2 (baixo risco no MVP: rota lê-only contra índices). |
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
