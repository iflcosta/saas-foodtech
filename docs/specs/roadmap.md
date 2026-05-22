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

**Fase 2 — Especificação técnica detalhada.** A spec fundacional está fechada; estamos
detalhando os contratos por camada antes de escrever código de aplicação.

| # | Fase | Status |
|---|---|---|
| 1 | Especificação fundacional (`spec.md`) | Concluída |
| 2 | Especificação técnica detalhada | Em andamento |
| 3 | Scaffolding & infraestrutura | Pendente |
| 4 | Implementação da V1.0 | Pendente |
| 5 | Lançamento do MVP | Pendente |

---

## 2. Status das Specs

| Documento | Conteúdo | Status |
|---|---|---|
| `spec.md` | Master: visão, roadmap, ADRs Q1–Q10, RF/RNF | Estável |
| `data-schema.md` | Schema PostgreSQL — 17 tabelas | Escrito — revisão pendente |
| `api-contracts.md` | Endpoints REST + WebSocket + schemas Zod | Escrito — revisão pendente |
| `design-system.md` | Design brief para o Claude Design | Planejado |

---

## 3. Status de Implementação

Nada implementado — a Fase 4 ainda não começou.

| Área | Componente | Status |
|---|---|---|
| Fundação | Monorepo, scaffolding, CI | Não iniciado |
| Fundação | Migrations PostgreSQL | Não iniciado |
| Fundação | Auth JWT + middleware de tenant | Não iniciado |
| RF-1 | Ingestão de pedidos (cardápio, WhatsApp, triagem) | Não iniciado |
| RF-2 | Motor ESC/POS + ponte de impressão Go | Não iniciado |
| RF-3 | Cardápio & onboarding | Não iniciado |
| RF-4 | Pagamento Pix dinâmico (Asaas) | Não iniciado |
| RF-5 | Ledger & fechamento de caixa | Não iniciado |
| RF-6 | Resiliência & diagnóstico (PWA) | Não iniciado |

---

## 4. Próximos Passos

1. Escrever `design-system.md` com o agente Frontend/UX.
2. Revisar e fechar todas as specs da Fase 2 em conjunto.
3. Iniciar a Fase 3 — scaffolding do monorepo.

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
| 2026-05-22 | Roteamento setorial de impressão (RF-2.2): adicionado `categories.print_queue` (`kitchen` / `bar`); o item herda a fila da categoria e a comanda `dispatch` é gerada por pedido. Nível de categoria escolhido pelo menor atrito de onboarding. Lacuna encontrada ao escrever `api-contracts.md`. |
| 2026-05-22 | Escopo do `api-contracts.md` confirmado: auth, onboarding, cardápio (admin + público), pedidos, WebSocket do PDV, Pix + webhook, Ledger/caixa, motoboys, fila de impressão, validação Zod. O protocolo do WebSocket local ESC/POS fica para um doc próprio. |
| 2026-05-22 | Criada a tabela `couriers` (+ `orders.courier_id` / `delivery_fee_cents` + conta de Ledger por motoboy), fechando lacuna de RF-5.3 — o schema não rastreava a taxa por motoboy. Adicionado RF-5.6. |
| 2026-05-22 | Specs detalhadas organizadas **por camada** (`data-schema.md`, `api-contracts.md`, `design-system.md`), não por feature; cada uma planejada e fechada individualmente. |
| 2026-05-22 | Schema de dados extraído de `spec.md` §6 para `data-schema.md`; §6 reduzido a ponteiro, mantendo o `spec.md` enxuto como master. |
| 2026-05-22 | Agente **Frontend/UX** adicionado ao roster; atua como ponte para o Claude Design — redige o `design-system.md` e integra o handoff bundle ao PWA. |
