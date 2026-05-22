# Especificação Técnica — Contratos de API (V1.0)

- **Status:** Em detalhamento técnico
- **Documento mestre:** `docs/specs/spec.md`
- **Schema referenciado:** `docs/specs/data-schema.md`
- **Escopo:** V1.0 (MVP)
- **Última atualização:** 2026-05-22

Define os contratos da API HTTP/WebSocket do backend Fastify. O protocolo do WebSocket
local de impressão (`ws://127.0.0.1:9100`) é uma fronteira distinta e será especificado no
documento do motor ESC/POS.

---

## 1. Convenções

- **Versionamento:** todas as rotas sob o prefixo `/v1`. Base URL definida no deploy.
- **Formato:** JSON em requisição e resposta; `Content-Type: application/json`.
- **Datas:** ISO 8601 em UTC (`2026-05-22T19:30:00Z`).
- **Valores monetários:** sempre inteiros em centavos (`*_cents`), nunca float.
- **Autenticação:** header `Authorization: Bearer <JWT>` (ver §2).
- **Isolamento de tenant:** o `tenant_id` é extraído **exclusivamente do JWT** por um
  middleware; nunca é aceito do corpo, query ou path. Toda query é escopada por ele (RNF-1).
- **Paginação:** `?limit=` (padrão 50, máx 100) e `?offset=` nas rotas de listagem.
- **Idempotência:** rotas `POST` com efeito financeiro (criação de pedido, cobrança Pix,
  pagamento manual) exigem o header `Idempotency-Key: <uuid>`. Uma repetição com a mesma
  chave devolve a resposta original, sem reexecutar (RF-4.4).
- **Validação:** todo corpo de entrada é validado por schema Zod na fronteira; falhas
  retornam `422 validation_error` com a lista de campos (RNF-6).

### Envelope de erro

Toda resposta de erro segue o formato:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Descrição legível do erro.",
    "details": [{ "field": "items[0].quantity", "issue": "deve ser > 0" }]
  }
}
```

| Código | HTTP | Quando |
|---|---|---|
| `unauthenticated` | 401 | Token ausente, inválido ou expirado |
| `forbidden` | 403 | Papel (RBAC) sem permissão para a rota |
| `not_found` | 404 | Recurso inexistente no tenant |
| `validation_error` | 422 | Falha de schema Zod |
| `invalid_transition` | 409 | Transição de estado de pedido não permitida |
| `payment_required` | 409 | Despacho bloqueado — Pix não liquidado (RF-4.3) |
| `idempotency_conflict` | 409 | `Idempotency-Key` reutilizada com corpo diferente |
| `rate_limited` | 429 | Limite de requisições excedido (rotas públicas) |
| `internal_error` | 500 | Falha não tratada |

---

## 2. Autenticação & Contexto de Tenant

JWT assinado, com prazo de validade curto. Claims: `sub` (user_id), `tenant_id`, `role`
(`owner` | `manager` | `operator`), `exp`.

### POST /v1/auth/login

Autentica um operador e devolve o token.

**Auth:** pública
**Corpo:** `{ "email": "...", "password": "..." }`
**Resposta 200:**
```json
{
  "token": "<jwt>",
  "user": { "id": "...", "name": "...", "role": "operator", "tenant_id": "..." }
}
```
**Erros:** `401 unauthenticated` para credenciais inválidas.

> **RBAC:** `owner` e `manager` acessam cardápio, Ledger e configuração; `operator` acessa
> triagem de pedidos, impressão e lançamentos de caixa. Cada rota indica o papel mínimo.

---

## 3. Onboarding & Tenant

O cadastro de um restaurante é operação do operador do SaaS (sem signup público no MVP —
ADR-Q2). O setup wizard (RF-3.2) do lojista consome as rotas de tenant + cardápio (§4).

| Método | Rota | Descrição | Papel |
|---|---|---|---|
| POST | `/v1/tenants` | Cria um restaurante (operação interna do SaaS) | — |
| GET | `/v1/tenant` | Dados do tenant atual | operator |
| PATCH | `/v1/tenant` | Atualiza nome, WhatsApp, `pizza_price_rule` | manager |
| PATCH | `/v1/tenant/asaas` | Conecta/atualiza credenciais Asaas | owner |

`PATCH /v1/tenant/asaas` recebe `{ "asaas_account_id": "...", "asaas_api_key": "..." }`;
a chave é armazenada criptografada em repouso e nunca retornada em respostas.

---

## 4. Cardápio — Administração

Todas as rotas exigem papel `manager`+. `DELETE` é soft-delete (`deleted_at`); pedidos
históricos preservam o snapshot do item.

| Método | Rota | Descrição |
|---|---|---|
| GET / POST | `/v1/categories` | Lista / cria categoria |
| GET / PATCH / DELETE | `/v1/categories/:id` | Lê / atualiza / desativa |
| GET / POST | `/v1/products` | Lista / cria produto |
| GET / PATCH / DELETE | `/v1/products/:id` | Lê / atualiza / desativa |
| GET / POST | `/v1/modifier-groups` | Lista / cria grupo de modificadores |
| GET / PATCH / DELETE | `/v1/modifier-groups/:id` | Lê / atualiza / desativa |
| POST / DELETE | `/v1/modifier-groups/:id/modifiers` | Adiciona / remove modificador |
| PUT | `/v1/products/:id/modifier-groups` | Define os grupos vinculados ao produto |

Validação de produto: `base_price_cents >= 0`. Um produto combo (composto por grupos de
modificadores obrigatórios) tem o preço efetivo recalculado e **rejeitado se resultar em
zero** (`422 validation_error`) — ADR-Q9.

A categoria carrega `print_queue` (`kitchen` | `bar`), que define a fila de impressão dos
itens dela no aceite do pedido (RF-2.2).

---

## 5. Cardápio — Público

Rotas sem autenticação, identificadas pelo `slug` do tenant. Rate-limit por IP.

### GET /v1/menu/:slug

Árvore completa do cardápio digital: categorias ativas → produtos → grupos de
modificadores → modificadores. Inclui a `pizza_price_rule` do tenant para o cálculo de
pizza fracionada no cliente.

**Auth:** pública
**Resposta 200:** dados do tenant (nome) + array `categories` aninhado.

---

## 6. Pedidos

Ciclo de vida (ADR-Q10): `pending → confirmed → preparing → ready → dispatched → delivered`;
`cancelled` a partir de qualquer estado não-final.

O `id` do pedido é um **UUIDv4 gerado no cliente**; o servidor atribui o `daily_sequence`
(sequencial legível diário por loja) no momento da criação.

### POST /v1/menu/:slug/orders

Criação do pedido pelo cliente final, a partir do cardápio digital. Pública, rate-limited.

**Corpo:**
```json
{
  "id": "<uuidv4-do-cliente>",
  "customer_name": "Maria",
  "customer_phone": "+55...",
  "delivery_address": "Rua ...",
  "payment_method": "pix",
  "items": [
    {
      "product_id": "...",
      "quantity": 1,
      "pizza_fractions": [
        { "product_id": "...", "ratio": 0.5 },
        { "product_id": "...", "ratio": 0.5 }
      ],
      "modifiers": ["<modifier_id>", "..."],
      "notes": "..."
    }
  ]
}
```

O servidor **recalcula todos os valores** (`unit_price_cents`, `subtotal_cents`,
`total_cents`, frações de pizza pela `pizza_price_rule`) — o total enviado pelo cliente é
ignorado. Payload financeiramente inconsistente é rejeitado (`422`).

**Resposta 201:**
```json
{
  "order": { "id": "...", "daily_sequence": 102, "status": "pending", "total_cents": 4500 },
  "tracking_token": "<token-opaco>"
}
```

O `tracking_token` alimenta o link de acompanhamento incluído no texto do WhatsApp (ADR-Q5).

### Demais rotas

| Método | Rota | Descrição | Papel |
|---|---|---|---|
| POST | `/v1/orders` | Criação manual pelo operador (pedido por telefone) | operator |
| GET | `/v1/orders` | Triagem — lista por `?status=`, `?date=` | operator |
| GET | `/v1/orders/:id` | Detalhe do pedido | operator |
| POST | `/v1/orders/:id/accept` | Aceite em clique único | operator |
| POST | `/v1/orders/:id/transition` | Avança o estado | operator |
| POST | `/v1/orders/:id/cancel` | Cancela o pedido | operator |
| GET | `/v1/orders/track/:token` | Acompanhamento público pelo cliente | pública |

### POST /v1/orders/:id/accept

Aceite em clique único (RF-1.4): `pending → confirmed` e enfileira os `print_jobs`
setoriais — o roteamento de cada item para `kitchen` ou `bar` segue o `print_queue` da
categoria do produto (§11) e a comanda `dispatch` é gerada uma vez por pedido. Idempotente;
`409 invalid_transition` se o pedido não estiver em `pending`.

### POST /v1/orders/:id/transition

Corpo `{ "to": "dispatched" }`. **Regra crítica (RF-4.3):** a transição para `dispatched`
é bloqueada com `409 payment_required` enquanto `payment_method = 'pix'` e a cobrança não
estiver liquidada. Dinheiro e cartão presencial não bloqueiam o despacho.

---

## 7. WebSocket — Painel do Operador

Atualiza a tela de triagem em tempo real (RF-1.3).

**Conexão:** `wss://<base>/v1/ws?token=<JWT>` — o token é validado no handshake; a conexão
é escopada ao `tenant_id` do token.

**Eventos enviados pelo servidor:**
```json
{ "type": "order.created", "data": { "order": { } } }
```
Tipos: `order.created` (dispara o som de alerta de novo pedido), `order.updated`,
`order.accepted`, `pix.liquidated`, `print_job.failed`.

O canal é unidirecional (servidor → painel) — todas as mutações usam as rotas HTTP.

---

## 8. Pagamento Pix (Asaas)

| Método | Rota | Descrição | Papel |
|---|---|---|---|
| POST | `/v1/orders/:id/pix-charge` | Gera a cobrança Pix dinâmica via Asaas | operator |
| GET | `/v1/orders/:id/pix-charge` | Status da cobrança (poll do acompanhamento) | pública¹ |
| POST | `/v1/webhooks/asaas` | Recebe o webhook de liquidação do Asaas | pública² |

¹ Acessível pelo `tracking_token`. ² Autenticada por assinatura, não por JWT.

### POST /v1/orders/:id/pix-charge

Cria a cobrança Pix dinâmica na conta Asaas do tenant. A resposta inclui `qr_code_payload`
(copia-e-cola), `qr_code_image_url` e o `asaas_charge_id`. Idempotente por pedido — uma
segunda chamada devolve a cobrança existente enquanto `pending`.

### POST /v1/webhooks/asaas

Recebe os eventos de liquidação. O corpo **não é confiável** até a verificação:

1. **Verificação de assinatura** do header do Asaas; falha → `401`.
2. **Idempotência:** o `event.id` é gravado em `pix_charges.webhook_event_id` (UNIQUE);
   evento repetido → `200` sem reprocessar (RF-4.4).
3. Em `PAYMENT_RECEIVED` / `PAYMENT_CONFIRMED`: marca `pix_charges.status = 'paid'`,
   preenche `orders.pix_paid_at` e libera a transição de despacho (RF-4.3). Emite o evento
   WebSocket `pix.liquidated`.

Sempre responde `200` rapidamente; o processamento pesado roda de forma assíncrona (RNF-2).

---

## 9. Ledger & Fechamento de Caixa

O Ledger é **append-only** — não há `PATCH`/`DELETE` de lançamentos. Correções entram como
novos lançamentos de estorno (RF-5.5).

| Método | Rota | Descrição | Papel |
|---|---|---|---|
| GET | `/v1/ledger/accounts` | Contas virtuais + saldo atual | manager |
| GET | `/v1/ledger/entries` | Lançamentos por `?account_id=`, `?date=` | manager |
| POST | `/v1/ledger/entries/:id/reverse` | Lança o estorno de um lançamento | manager |
| POST | `/v1/payments` | Registra recebimento manual (dinheiro / cartão externo) | operator |
| POST | `/v1/cash-sessions` | Abre o turno de caixa | operator |
| POST | `/v1/cash-sessions/:id/close` | Fechamento de caixa cego | operator |
| GET | `/v1/cash-sessions/:id/report` | Relatório de divergências | manager |

### POST /v1/payments

Registra um recebimento sem webhook (RF-5.2). Gera o par de lançamentos no Ledger:
**débito em `Caixa_Lojista`**, **crédito em `Caixa_Canal`** (ADR-Q3). Corpo:
`{ "order_id": "...", "method": "cash" | "card_external", "amount_cents": 4500 }`.

### POST /v1/cash-sessions/:id/close

Fechamento **cego** (RF-5.4): o operador informa apenas o valor contado; o sistema não
revela o esperado antes do envio. Corpo: `{ "declared_cents": 38000 }`.

O servidor calcula o `expected_cents` a partir do Ledger, grava o `difference_cents` e
devolve o relatório de divergências — incluindo o acerto acumulado por motoboy no turno
(RF-5.3).

---

## 10. Motoboys

| Método | Rota | Descrição | Papel |
|---|---|---|---|
| GET / POST | `/v1/couriers` | Lista / cadastra motoboy (RF-5.6) | manager |
| GET / PATCH | `/v1/couriers/:id` | Lê / atualiza (inclui `is_active`) | manager |
| GET | `/v1/couriers/:id/balance` | Saldo de taxas de entrega acumulado | manager |

Motoboys não são excluídos — `PATCH` com `is_active: false` os aposenta. Ao cadastrar um
motoboy, o sistema provisiona automaticamente a conta dele no Ledger (RF-5.3).

---

## 11. Fila de Impressão

Endpoints do backend consumidos pela ponte de impressão Go. A ponte busca os jobs
pendentes e os envia às impressoras pelo WebSocket local — protocolo no documento ESC/POS.

| Método | Rota | Descrição |
|---|---|---|
| GET | `/v1/print-jobs?status=pending` | Lista os jobs pendentes do tenant |
| POST | `/v1/print-jobs/:id/ack` | Marca o job como `sent` ou `failed` |

`POST /v1/print-jobs/:id/ack` recebe `{ "status": "sent" }` ou
`{ "status": "failed", "error": "..." }`; em falha, incrementa `attempts` e mantém o job
elegível para reenvio quando a conexão se restabelecer (RF-2.4).

**Roteamento setorial (RF-2.2):** cada item vai para a fila `kitchen` ou `bar` conforme o
`print_queue` da categoria do produto; a comanda `dispatch` é gerada uma vez por pedido. O
aceite (§6) agrupa os itens por fila e emite um `print_job` para cada fila com conteúdo.

---

## 12. Validação — Regras Transversais (Zod)

Todo corpo de entrada passa por um schema Zod antes de qualquer lógica de negócio (RNF-6).
Regras que valem em todas as rotas:

- Nenhum valor monetário é confiado ao cliente — `total_cents` e subtotais são sempre
  recalculados no servidor.
- Combos e pizzas fracionadas têm o preço recomposto a partir do cardápio; resultado
  inconsistente ou zerado é rejeitado (ADR-Q9).
- `tenant_id` jamais é lido do payload — somente do JWT.
- Transições de estado de pedido inválidas retornam `409 invalid_transition`.
- O Ledger nunca é alterado por `UPDATE`/`DELETE` — apenas novos lançamentos.
