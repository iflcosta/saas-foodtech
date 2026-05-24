# Especificação Técnica — Schema de Dados (PostgreSQL V1.0)

- **Status:** Estável (V1.0)
- **Documento mestre:** `docs/specs/spec.md` (§6)
- **Escopo:** V1.0 (MVP)
- **Última atualização:** 2026-05-24

Detalha o schema PostgreSQL da V1.0 referenciado em §6 do documento mestre. Cobre todas as
tabelas, índices, constraints e invariantes do MVP.

---

## Convenções Globais

Todas as tabelas críticas carregam `tenant_id UUID NOT NULL` com índice dedicado. Um middleware
de requisição extrai o `tenant_id` do JWT e força o filtro em toda consulta, bloqueando
vazamentos horizontais (RNF-1 / ADR-Q7).

- Chaves primárias: `UUID DEFAULT gen_random_uuid()` (exceto `ledger_entries`, que usa `BIGSERIAL`
  para ordenação determinística).
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` em todas as tabelas.
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` onde o registro é mutável; trigger de
  atualização automática.
- Soft-delete via `deleted_at TIMESTAMPTZ` nas entidades de cardápio (produto pode ser
  desativado sem perder histórico de pedidos).
- Campos reservados para fases futuras são marcados com comentário `-- V1.1` ou `-- V2.0`.

---

## 1. Tenants, Usuários & Motoboys

```sql
-- Conta principal do restaurante (um registro por lojista)
CREATE TABLE tenants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  slug                TEXT NOT NULL UNIQUE,           -- subdomínio do cardápio digital
  phone_whatsapp      TEXT NOT NULL,                  -- destino do redirecionamento WhatsApp
  asaas_account_id    TEXT,                           -- ID da conta conectada no Asaas (ADR-Q2)
  asaas_api_key       TEXT,                           -- chave de API criptografada em repouso
  pizza_price_rule    TEXT NOT NULL DEFAULT 'most_expensive'
                        CHECK (pizza_price_rule IN ('most_expensive', 'average')), -- ADR-Q9
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Operadores humanos do restaurante (cozinheiro, atendente, dono)
CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'operator'
                  CHECK (role IN ('owner', 'manager', 'operator')), -- RBAC (RNF-5)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, email)
);
CREATE INDEX idx_users_tenant ON users(tenant_id);

-- Motoboys de entrega — base do acerto de taxa por rota (RF-5.3 / ADR-Q3)
CREATE TABLE couriers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  phone       TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_couriers_tenant ON couriers(tenant_id);
```

---

## 2. Cardápio

```sql
-- Categorias de produto (ex.: Hambúrgueres, Pizzas, Bebidas)
CREATE TABLE categories (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  print_queue  TEXT NOT NULL DEFAULT 'kitchen'
                 CHECK (print_queue IN ('kitchen', 'bar')), -- fila setorial dos itens (RF-2.2)
  sort_order   INT NOT NULL DEFAULT 0,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_tenant ON categories(tenant_id);

-- Produtos (hambúrgueres, pizzas inteiras, bebidas, etc.)
CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  category_id      UUID NOT NULL REFERENCES categories(id),
  name             TEXT NOT NULL,
  description      TEXT,
  base_price_cents INT NOT NULL CHECK (base_price_cents >= 0),
  is_pizza         BOOLEAN NOT NULL DEFAULT false,  -- habilita lógica de frações (ADR-Q9)
  fiscal_metadata  JSONB,                            -- NCM, CFOP, CEST, ICMS — reservado V2.0
  sort_order       INT NOT NULL DEFAULT 0,
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_products_tenant    ON products(tenant_id);
CREATE INDEX idx_products_category  ON products(category_id);

-- Grupos de modificadores (ex.: "Ponto da carne", "Adicionais pagos")
CREATE TABLE modifier_groups (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  min_choices  INT NOT NULL DEFAULT 0,
  max_choices  INT NOT NULL DEFAULT 1,
  is_required  BOOLEAN NOT NULL DEFAULT false,
  deleted_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_modifier_groups_tenant ON modifier_groups(tenant_id);

-- Opções individuais dentro de um grupo (ex.: "Sem cebola", "Bacon +R$3")
CREATE TABLE modifiers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  modifier_group_id   UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  price_delta_cents   INT NOT NULL DEFAULT 0,  -- negativo para desconto, positivo para adicional
  is_exclusion        BOOLEAN NOT NULL DEFAULT false, -- imprime em reverso (RF-2.3)
  sort_order          INT NOT NULL DEFAULT 0,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_modifiers_tenant ON modifiers(tenant_id);
CREATE INDEX idx_modifiers_group  ON modifiers(modifier_group_id);

-- Relacionamento N:N entre produtos e grupos de modificadores
CREATE TABLE product_modifier_groups (
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  modifier_group_id UUID NOT NULL REFERENCES modifier_groups(id) ON DELETE CASCADE,
  sort_order        INT NOT NULL DEFAULT 0,
  PRIMARY KEY (product_id, modifier_group_id)
);
```

---

## 3. Pedidos

```sql
-- Máquina de estados do pedido (ADR-Q10)
-- Estados: pending → confirmed → preparing → ready → dispatched → delivered | cancelled
CREATE TABLE orders (
  id               UUID PRIMARY KEY,                -- UUIDv4 gerado no cliente (ADR-Q10)
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  daily_sequence   INT,                             -- #101, #102… gerado pelo servidor no sync
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN (
                       'pending', 'confirmed', 'preparing',
                       'ready', 'dispatched', 'delivered', 'cancelled'
                     )),
  customer_name    TEXT,
  customer_phone   TEXT,
  delivery_address TEXT,
  courier_id         UUID REFERENCES couriers(id),  -- motoboy designado no despacho (RF-5.3)
  delivery_fee_cents INT NOT NULL DEFAULT 0,         -- taxa de entrega; base do acerto do motoboy
  notes            TEXT,
  total_cents      INT NOT NULL CHECK (total_cents >= 0),
  payment_method   TEXT NOT NULL DEFAULT 'pix'
                     CHECK (payment_method IN ('pix', 'cash', 'card_external')),
  -- Pix dinâmico (RF-4): preenchido após geração da cobrança Asaas
  pix_charge_id    TEXT,
  pix_paid_at      TIMESTAMPTZ,
  -- Canal de origem (ADR-Q6): canal direto no MVP; iFood na V1.1
  external_channel  TEXT,          -- ex.: 'ifood' — V1.1
  external_order_id TEXT,          -- ID do pedido no canal externo — V1.1
  -- Metadados fiscais — V2.0
  fiscal_metadata  JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_orders_tenant        ON orders(tenant_id);
CREATE INDEX idx_orders_tenant_status ON orders(tenant_id, status);
CREATE INDEX idx_orders_tenant_date   ON orders(tenant_id, created_at);
CREATE INDEX idx_orders_courier       ON orders(courier_id);
-- Unicidade do sequencial diário por loja.
-- A "data do pedido" é o dia civil em `America/Sao_Paulo` — coerente com a decisão
-- "i18n fora de escopo / pt-BR + BRL apenas" (spec.md §7). O cast direto
-- `(created_at::date)` não pode ir em índice btree: para `timestamptz` o resultado
-- depende do timezone da sessão (STABLE), Postgres exige IMMUTABLE.
-- `(... AT TIME ZONE 'America/Sao_Paulo')::date` fixa a conversão e é aceito.
CREATE UNIQUE INDEX idx_orders_daily_seq
  ON orders(tenant_id, daily_sequence, ((created_at AT TIME ZONE 'America/Sao_Paulo')::date));

-- Itens de um pedido (linha de produto)
CREATE TABLE order_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  order_id      UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id    UUID NOT NULL REFERENCES products(id),
  product_name  TEXT NOT NULL,          -- snapshot em tempo de criação
  unit_price_cents INT NOT NULL,        -- snapshot do preço no momento do pedido
  quantity      INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
  subtotal_cents INT NOT NULL,
  notes         TEXT,
  -- Metadados de pizza fracionada (ADR-Q9)
  pizza_fractions JSONB,               -- ex.: [{"product_id":"…","name":"Calabresa","ratio":0.5}]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_items_tenant ON order_items(tenant_id);
CREATE INDEX idx_order_items_order  ON order_items(order_id);

-- Modificadores aplicados a cada item de pedido
CREATE TABLE order_item_modifiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  order_item_id     UUID NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  modifier_id       UUID NOT NULL REFERENCES modifiers(id),
  modifier_name     TEXT NOT NULL,       -- snapshot
  price_delta_cents INT NOT NULL DEFAULT 0,
  is_exclusion      BOOLEAN NOT NULL DEFAULT false,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_order_item_mods_tenant ON order_item_modifiers(tenant_id);
CREATE INDEX idx_order_item_mods_item   ON order_item_modifiers(order_item_id);
```

---

## 4. Cobranças Pix (Asaas)

```sql
-- Registro de cada cobrança Pix dinâmica emitida via Asaas (RF-4)
CREATE TABLE pix_charges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id),
  order_id           UUID NOT NULL REFERENCES orders(id),
  asaas_charge_id    TEXT NOT NULL UNIQUE,    -- ID retornado pelo Asaas
  amount_cents       INT NOT NULL,
  qr_code_payload    TEXT NOT NULL,           -- copia-e-cola Pix
  qr_code_image_url  TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'paid', 'expired', 'cancelled')),
  paid_at            TIMESTAMPTZ,
  webhook_event_id   TEXT UNIQUE,             -- idempotência de webhook (RF-4.4)
  expires_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pix_charges_tenant   ON pix_charges(tenant_id);
CREATE INDEX idx_pix_charges_order    ON pix_charges(order_id);
```

---

## 5. Ledger de Dupla Entrada (ADR-Q3 / RF-5)

```sql
-- Contas virtuais do Ledger por tenant
-- Contas fixas provisionadas no onboarding: Caixa_Lojista, Caixa_Canal.
-- Cada motoboy cadastrado recebe uma conta própria (courier_id preenchido) — RF-5.3.
CREATE TABLE ledger_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,   -- 'Caixa_Lojista' | 'Caixa_Canal' | 'Caixa_Motoboy:<nome>'
  type        TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity')),
  courier_id  UUID REFERENCES couriers(id),  -- preenchido apenas nas contas de motoboy
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX idx_ledger_accounts_tenant ON ledger_accounts(tenant_id);

-- Lançamentos append-only — NUNCA atualizar ou deletar (RF-5.5 / ADR-Q10)
-- Cada transação econômica gera exatamente 2 linhas: débito e crédito
CREATE TABLE ledger_entries (
  id                BIGSERIAL PRIMARY KEY,  -- ordenação determinística
  tenant_id         UUID NOT NULL REFERENCES tenants(id),
  transaction_ref   UUID NOT NULL,          -- agrupa o par débito/crédito da mesma transação
  account_id        UUID NOT NULL REFERENCES ledger_accounts(id),
  entry_type        TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  amount_cents      INT NOT NULL CHECK (amount_cents > 0),
  description       TEXT NOT NULL,
  order_id          UUID REFERENCES orders(id),
  reversal_of       BIGINT REFERENCES ledger_entries(id), -- estornos apontam para o lançamento original
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
  -- Sem updated_at: imutável por definição
);
CREATE INDEX idx_ledger_entries_tenant      ON ledger_entries(tenant_id);
CREATE INDEX idx_ledger_entries_account     ON ledger_entries(account_id);
CREATE INDEX idx_ledger_entries_txn_ref     ON ledger_entries(transaction_ref);
CREATE INDEX idx_ledger_entries_order       ON ledger_entries(order_id);
```

---

## 6. Sessões de Caixa & Pagamentos Manuais

```sql
-- Turno de operação — base para o fechamento de caixa cego (RF-5.4)
CREATE TABLE cash_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  opened_by       UUID NOT NULL REFERENCES users(id),
  closed_by       UUID REFERENCES users(id),
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  expected_cents  INT,    -- calculado pelo sistema (Ledger)
  declared_cents  INT,    -- informado pelo operador no fechamento cego
  difference_cents INT,   -- expected - declared (calculado ao fechar)
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cash_sessions_tenant ON cash_sessions(tenant_id);

-- Registro de pagamentos não-Pix (dinheiro, maquininha externa) — RF-5.2
CREATE TABLE payments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id),
  order_id        UUID NOT NULL REFERENCES orders(id),
  cash_session_id UUID REFERENCES cash_sessions(id),
  method          TEXT NOT NULL CHECK (method IN ('cash', 'card_external', 'pix')),
  amount_cents    INT NOT NULL CHECK (amount_cents > 0),
  registered_by   UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_payments_tenant  ON payments(tenant_id);
CREATE INDEX idx_payments_order   ON payments(order_id);
CREATE INDEX idx_payments_session ON payments(cash_session_id);
```

---

## 7. Fila de Impressão (RF-2.4)

```sql
-- Buffer persistente de comandos ESC/POS pendentes (RF-2.4 / ADR-Q4)
-- A ponte Go consome esta fila via WebSocket; itens são marcados como sent/failed.
CREATE TABLE print_jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES tenants(id),
  order_id      UUID REFERENCES orders(id),
  queue         TEXT NOT NULL CHECK (queue IN ('kitchen', 'bar', 'dispatch')), -- RF-2.2
  payload_b64   TEXT NOT NULL,   -- buffer ESC/POS codificado em Base64 (RF-2.1)
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'sent', 'failed')),
  attempts      INT NOT NULL DEFAULT 0,
  last_error    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_print_jobs_tenant        ON print_jobs(tenant_id);
CREATE INDEX idx_print_jobs_tenant_status ON print_jobs(tenant_id, status);
```

---

## 8. Resumo de Relações & Invariantes

| Invariante | Onde é aplicado |
|---|---|
| `tenant_id` obrigatório em todas as tabelas críticas | DDL `NOT NULL` + índice |
| UUIDv4 gerado no cliente para `orders.id` | Aplicação; sem `DEFAULT gen_random_uuid()` |
| `daily_sequence` gerado autoritativamente pelo servidor | Lógica de negócio no sync |
| Ledger append-only — sem `UPDATE`/`DELETE` | Permissão de banco + checagem de aplicação |
| Despacho bloqueado até `pix_charges.status = 'paid'` | Middleware de transição de estado (RF-4.3) |
| Combo de valor zerado rejeitado | Validação Zod no backend (ADR-Q9) |
| Estorno = novo lançamento com `reversal_of` preenchido | Convenção do Ledger (RF-5.5) |
| Taxa de entrega creditada à conta de Ledger do motoboy | Lançamento ao confirmar entrega (RF-5.3) |
| Item roteado para a fila de cozinha/bar pela categoria | `categories.print_queue` no aceite (RF-2.2) |
