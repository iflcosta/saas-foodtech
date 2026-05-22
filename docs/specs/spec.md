# Especificação Principal — SaaS Foodtech POS & Delivery

- **Status:** Escopo da V1.0 fechado — pronto para o detalhamento técnico
- **Metodologia:** Spec-Driven Development (SDD)
- **Versão-alvo deste documento:** V1.0 (MVP)
- **Última atualização:** 2026-05-22
- **Origem:** Entrevista técnica spec-first (decisões Q1–Q10) + pesquisas de inteligência de
  mercado (gargalos operacionais e modelo/arquitetura).

---

## 1. Visão & Contexto de Mercado

### 1.1 Problema

Micro e pequenos restaurantes de delivery no Brasil operam com sistemas legados que falham
justamente nos momentos de maior faturamento (sexta a domingo, 19h–22h30). As pesquisas
mapearam **7 gargalos operacionais críticos**:

1. **Redigitação manual de pedidos** — ~150s por pedido via WhatsApp, taxa de erro de 14,2%,
   14–18 trocas de tela por pedido.
2. **Falhas de impressão térmica** — modificadores (exclusões/adicionais) impressos sem
   destaque visual; retrabalho consome parcela relevante do faturamento bruto.
3. **Queda de conectividade** — sistemas cloud-only paralisam; o roteamento 4G quebra a
   sub-rede e torna as impressoras IP invisíveis.
4. **Atrito com concorrentes** — instabilidade no pico (Saipos), loops de chatbot (Anota AI),
   cobrança modular (Consumer), conflitos de sincronização (GrandChef).
5. **Onboarding de cardápio** — 72% de abandono ao configurar pizza meio a meio; baixa
   literacia digital do operador.
6. **Suporte no fim de semana** — SLA real de 2,4–4,8h; chatbots de autoatendimento ineficazes.
7. **Fechamento de caixa e fraude** — ~42 min/dia de acerto manual com motoboys; golpe do
   "Pix agendado".

### 1.2 Público-alvo & Modelo de Negócio

- Micro e pequenos restaurantes (hamburguerias e pizzarias de bairro), enquadrados como
  **MEI** e microempresas.
- Cidades de pequeno e médio porte no interior do Brasil.
- Operação **bootstrap**, desenvolvedor solo, infraestrutura de baixo custo.
- Precificação **flat de R$ 99,00 a R$ 149,90/mês**, sem comissão sobre o faturamento do lojista.

### 1.3 Pilares Estratégicos

1. **Estabilidade Local-First** — continuidade operacional sob rede instável.
2. **Roteamento & Legibilidade ESC/POS** — comandas setoriais com destaque físico de
   modificadores.
3. **Onboarding Autônomo e Fluido** — cadastro guiado para usuários de baixa literacia digital.
4. **Conciliação Segura de Recebíveis** — Pix dinâmico + Ledger de dupla entrada.

---

## 2. Roadmap de Versões

| Versão | Escopo |
|---|---|
| **V1.0 (MVP)** | Web PWA de Alta Disponibilidade (Service Workers + Cache API + IndexedDB). Canal direto: cardápio digital + redirecionamento WhatsApp. Ponte de impressão Go (porta :9100, USB + Ethernet). Pix dinâmico via Asaas. Ledger de dupla entrada + fechamento de caixa cego. PostgreSQL único multi-tenant. |
| **V1.1** | Integração oficial com a iFood Developer API (Webhook + polling de contingência de 5 min). |
| **V1.5** | Local-First pleno: SQLite embarcado + sincronização bidirecional (CRDT / Last-Write-Wins). |
| **V2.0** | Emissão fiscal eletrônica (NFC-e / SAT). |

---

## 3. Decisões de Arquitetura (Q1–Q10)

Registro resumido das decisões da entrevista spec-first. Todas são **vinculantes para a V1.0**.

### ADR-Q1 — Estratégia de entrega: Web de Alta Disponibilidade no MVP

A V1.0 adota uma **Arquitetura Web de Alta Disponibilidade com Caching Inteligente**, e não o
Local-First pleno. O PDV é um PWA que usa Service Workers + Cache API para carregamento
instantâneo de UI, imagens e sons de alerta de novos pedidos. Os pedidos em aberto e os buffers
de impressão da sessão atual ficam no **IndexedDB**. SQLite embarcado com sincronização
bidirecional é adiado para a **V1.5**. A ponte de impressão Go opera desde a V1.0.

> **Nota de constituição:** o `CLAUDE.md` foi alinhado a este escopo de MVP — a regra vigente é
> "High-Availability Priority". A evolução para SQLite embarcado com sincronização bidirecional
> permanece planejada para a V1.5.

### ADR-Q2 — PSP e Pix dinâmico

**PSP definido: Asaas.** A integração de pagamento cobre exclusivamente o **Fluxo B** — o
cliente final do restaurante pagando o pedido, com o valor liquidado na conta do **dono do
restaurante**. O **Fluxo A** (cobrança da assinatura mensal do SaaS aos lojistas) está **fora do
escopo da V1.0** (ver §7).

Cada restaurante (tenant) possui uma conta de recebimento própria no Asaas. O Asaas gera o QR
Code **Pix dinâmico por pedido** e emite webhooks de liquidação assinados, que sustentam o
bloqueio antifraude do despacho (RF-4.3). Como o Pix é um arranjo interoperável do Banco
Central, o cliente paga o QR Code usando **qualquer banco ou carteira** — apenas o restaurante
(recebedor) precisa de conta no PSP.

O **split do motoboy é lógico/interno ao Ledger** — sem split no nível do gateway. O valor entra
integral na conta do restaurante; o Ledger de dupla entrada calcula o saldo devedor do motoboy.

**Provisionamento da conta — modelo de conta conectada:** cada restaurante cria a própria conta
Asaas (com apoio durante o onboarding presencial) e conecta as credenciais de API ao SaaS. O
SaaS não cria nem custodia contas — a relação de KYC e regulatória fica diretamente entre o
lojista e o Asaas, reduzindo a responsabilidade do SaaS. A subconta white-label (criação de
contas via API pelo próprio SaaS) é reavaliada como otimização de onboarding em versão futura.

### ADR-Q3 — Reconciliação de caixa

Reconciliação **mista com fechamento de caixa cego**. Pagamentos sem webhook (dinheiro e
maquininha de cartão externa) são registrados manualmente pelo operador, gerando um lançamento
de **débito em `Caixa_Lojista`** e **crédito em `Caixa_Canal`**. As taxas de entrega do motoboy
acumulam dinamicamente no Ledger por rota, em tempo real; a **liquidação física do saldo ocorre
de forma unificada no encerramento do turno**, com relatório detalhado de divergências.

### ADR-Q4 — Conectividade de impressão

O MVP homologa **apenas USB e Ethernet (TCP)** via ponte Go local na porta **:9100**.
**Bluetooth não entra no MVP** — o pareamento via Web Bluetooth API é instável entre modelos de
smartphone/impressora e geraria carga insustentável de suporte técnico para um time bootstrap.

### ADR-Q5 — Ingestão de pedidos via WhatsApp

**Link de cardápio digital compartilhável.** O cliente monta o carrinho numa interface web leve;
ao finalizar, a aplicação formata o pedido em um bloco de texto estruturado e redireciona o
usuário para o WhatsApp do restaurante via `api.whatsapp.com/send` (gratuito). O texto inclui um
link exclusivo de checkout/acompanhamento. Elimina loops de chatbot e zera o custo de
licenciamento da WhatsApp Cloud API no MVP.

### ADR-Q6 — Escopo de canais

O MVP é lançado **100% no canal direto** (cardápio digital / WhatsApp). A integração oficial com
o iFood entra na **V1.1**. O schema da V1.0 já prevê campos de mapeamento de canais externos
(ex.: `external_channel`, `external_order_id`) para evitar retrabalho estrutural posterior.

### ADR-Q7 — Multitenancy

**PostgreSQL único compartilhado** com isolamento lógico por **`tenant_id`** indexado em todas
as tabelas críticas. Um middleware de requisição intercepta as chamadas de API e força o filtro
por `tenant_id` extraído do token JWT, blindando contra vazamentos horizontais. Hospedagem em
VPS de 1 core / 1 GB RAM; auto-scaling horizontal adiado.

### ADR-Q8 — Emissão fiscal

O MVP sai **sem emissão fiscal síncrona**; foco comercial em MEI/microempresa. As tabelas
`products` e `orders` incluem um campo **JSONB de metadados fiscais** (capaz de armazenar NCM,
CFOP, CEST e alíquota de ICMS) para que a integração de e-docs na V2.0 não exija migração
destrutiva de dados.

### ADR-Q9 — Precificação de cardápio

**Pizza fracionada:** duas regras suportadas — cobrança pelo **sabor mais caro** (padrão de
mercado) ou **média aritmética simples** dos sabores — configuráveis por categoria/produto pelo
próprio tenant. **Combos dinâmicos:** validação rígida por **schema Zod no backend**, que
recalcula o preço base + adicionais obrigatórios e **rejeita qualquer payload financeiramente
inconsistente** (combo de valor zerado).

### ADR-Q10 — Numeração de pedidos e resolução de conflitos

O identificador global de cada pedido é um **UUIDv4 gerado no cliente**. Para a cozinha e a
comunicação humana, usa-se um **número sequencial legível diário** (ex.: #101, #102),
reiniciado a cada ciclo de 24h por loja, **gerado de forma autoritativa pelo servidor** no
momento do sync. Política de conflito: **Last-Write-Wins (LWW)** para cardápio e configurações;
**Append-Only estrito** para o Ledger financeiro — registros nunca são atualizados ou
sobrescritos; correções ocorrem exclusivamente por novos lançamentos de estorno.

---

## 4. Requisitos Funcionais (V1.0)

### RF-1 — Ingestão de Pedidos (Canal Direto)

- RF-1.1 Cardápio digital web público por tenant, com carrinho de compras.
- RF-1.2 Geração do pedido como texto estruturado + redirecionamento para o WhatsApp do lojista.
- RF-1.3 Painel do operador com tela de triagem única, atualizada em tempo real via WebSocket.
- RF-1.4 Aceite e impressão do pedido em clique único (Single-Click Acceptance).

### RF-2 — Motor de Impressão ESC/POS

- RF-2.1 Geração de payload ESC/POS, codificado em Base64, enviado via WebSocket local
  (`ws://127.0.0.1:9100`), sem qualquer diálogo de impressão nativo.
- RF-2.2 Roteamento setorial: segmentar um pedido em filas lógicas (`Fila_Cozinha`,
  `Fila_Bar`, `Fila_Despacho`).
- RF-2.3 Destaque físico: modificadores de exclusão em modo reverso (fundo preto/texto branco);
  adicionais pagos em fonte de tamanho dobrado.
- RF-2.4 Fila de impressão persistente — comandos pendentes são disparados ao restabelecer
  a conexão.

### RF-3 — Cardápio & Onboarding

- RF-3.1 Modelagem de categorias, produtos, grupos de modificadores e modificadores.
- RF-3.2 Setup wizard visual guiado, com validação client-side em tempo real.
- RF-3.3 Pizza fracionada com regra de preço configurável (ADR-Q9).
- RF-3.4 Combos dinâmicos com validação que impossibilita o salvamento de valor zerado.

### RF-4 — Pagamento Pix Dinâmico

- RF-4.1 Geração de QR Code Pix dinâmico por pedido via Asaas, liquidado na conta de
  recebimento do próprio restaurante (tenant).
- RF-4.2 Recebimento e verificação de webhook de liquidação assinado emitido pelo Asaas.
- RF-4.3 Bloqueio do avanço do pedido para a etapa "Despacho" até a confirmação de liquidação.
- RF-4.4 Middleware de idempotência por identificador único de evento.

### RF-5 — Ledger & Fechamento de Caixa

- RF-5.1 Ledger de dupla entrada com contas virtuais (`Caixa_Lojista`, `Caixa_Motoboy`,
  `Caixa_Canal`).
- RF-5.2 Lançamento manual de recebimentos em dinheiro e maquininha externa.
- RF-5.3 Acúmulo em tempo real das taxas de entrega por motoboy.
- RF-5.4 Fechamento de caixa cego, com relatório de divergências.
- RF-5.5 Ledger append-only — estornos feitos por novo lançamento, nunca por sobrescrita.

### RF-6 — Resiliência & Diagnóstico

- RF-6.1 Service Worker com cache de assets estáticos e sons de alerta de novos pedidos.
- RF-6.2 Persistência de sessão (pedidos em aberto e buffers de impressão) em IndexedDB.
- RF-6.3 Módulo de diagnóstico local (`npm run diagnostics:local`): checagem de rede, validação
  de tokens de API e status das portas de impressora.

---

## 5. Requisitos Não-Funcionais

- RNF-1 **Multitenancy** — isolamento lógico por `tenant_id`; nenhum vazamento horizontal de dados.
- RNF-2 **Desempenho** — operação viável em VPS de 1 core / 1 GB RAM; tarefas pesadas (IA,
  integrações) processadas de forma assíncrona fora do ciclo de requisição.
- RNF-3 **Resiliência de rede** — UI acessível mesmo com queda de internet (Service Worker);
  impressão local independente da topologia TCP/IP do estabelecimento.
- RNF-4 **Segurança financeira** — despacho bloqueado até liquidação Pix assinada; Ledger imutável.
- RNF-5 **Segurança de acesso** — autenticação via JWT; controle de acesso por papéis (RBAC)
  segmentado por camada de assinatura.
- RNF-6 **Qualidade de código** — TypeScript estrito; validação de schema com Zod em todas as
  fronteiras de entrada de dados.

---

## 6. Schema de Dados — PostgreSQL V1.0

Todas as tabelas críticas carregam `tenant_id UUID NOT NULL` com índice dedicado. Um middleware
de requisição extrai o `tenant_id` do JWT e força o filtro em toda consulta, bloqueando
vazamentos horizontais (RNF-1 / ADR-Q7).

Convenções globais:
- Chaves primárias: `UUID DEFAULT gen_random_uuid()` (exceto `ledger_entries`, que usa `BIGSERIAL`
  para ordenação determinística).
- `created_at TIMESTAMPTZ NOT NULL DEFAULT now()` em todas as tabelas.
- `updated_at TIMESTAMPTZ NOT NULL DEFAULT now()` onde o registro é mutável; trigger de
  atualização automática.
- Soft-delete via `deleted_at TIMESTAMPTZ` nas entidades de cardápio (produto pode ser
  desativado sem perder histórico de pedidos).
- Campos reservados para fases futuras são marcados com comentário `-- V1.1` ou `-- V2.0`.

---

### 6.1 Tenants & Autenticação

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
```

---

### 6.2 Cardápio

```sql
-- Categorias de produto (ex.: Hambúrgueres, Pizzas, Bebidas)
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  deleted_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
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

### 6.3 Pedidos

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
-- Unicidade do sequencial diário por loja
CREATE UNIQUE INDEX idx_orders_daily_seq
  ON orders(tenant_id, daily_sequence, (created_at::date));

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

### 6.4 Cobranças Pix (Asaas)

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

### 6.5 Ledger de Dupla Entrada (ADR-Q3 / RF-5)

```sql
-- Contas virtuais do Ledger por tenant
-- Contas padrão provisionadas no onboarding: Caixa_Lojista, Caixa_Motoboy, Caixa_Canal
CREATE TABLE ledger_accounts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,   -- 'Caixa_Lojista' | 'Caixa_Motoboy' | 'Caixa_Canal'
  type        TEXT NOT NULL CHECK (type IN ('asset', 'liability', 'equity')),
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

### 6.6 Sessões de Caixa & Pagamentos Manuais

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

### 6.7 Fila de Impressão (RF-2.4)

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

### 6.8 Resumo de Relações & Invariantes

| Invariante | Onde é aplicado |
|---|---|
| `tenant_id` obrigatório em todas as tabelas críticas | DDL `NOT NULL` + índice |
| UUIDv4 gerado no cliente para `orders.id` | Aplicação; sem `DEFAULT gen_random_uuid()` |
| `daily_sequence` gerado autoritativamente pelo servidor | Lógica de negócio no sync |
| Ledger append-only — sem `UPDATE`/`DELETE` | Permissão de banco + checagem de aplicação |
| Despacho bloqueado até `pix_charges.status = 'paid'` | Middleware de transição de estado (RF-4.3) |
| Combo de valor zerado rejeitado | Validação Zod no backend (ADR-Q9) |
| Estorno = novo lançamento com `reversal_of` preenchido | Convenção do Ledger (RF-5.5) |

---

## 7. Fora de Escopo (V1.0) & Pendências em Aberto

### Fora de escopo da V1.0

- Emissão fiscal NFC-e / SAT (V2.0).
- Integração com iFood e outros marketplaces (V1.1).
- SQLite embarcado e sincronização bidirecional (V1.5).
- Impressão térmica via Bluetooth.
- WhatsApp Cloud API conversacional (bot).
- Onboarding de cardápio assistido por IA (extração via Gemini) — a reavaliar após o MVP.
- **Cobrança da assinatura do SaaS (Fluxo A)** — o recebimento da mensalidade dos lojistas
  pelo operador do SaaS será especificado em etapa posterior.
- **Pagamento com cartão no checkout digital** — o RF-4 do MVP processa apenas Pix dinâmico via
  Asaas; cartão de crédito online é expansão pós-MVP, na mesma conta Asaas. O cartão presencial
  na entrega permanece suportado por lançamento manual no Ledger (ADR-Q3).

### Pendências em aberto

- Nenhuma pendência de arquitetura em aberto — o escopo da V1.0 está fechado e o documento está
  pronto para o detalhamento técnico (schema de dados e contratos de API).
