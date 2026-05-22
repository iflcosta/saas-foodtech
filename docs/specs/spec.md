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

- RF-5.1 Ledger de dupla entrada com contas virtuais: `Caixa_Lojista`, `Caixa_Canal` e uma
  conta dedicada por motoboy cadastrado.
- RF-5.2 Lançamento manual de recebimentos em dinheiro e maquininha externa.
- RF-5.3 Acúmulo em tempo real das taxas de entrega por motoboy.
- RF-5.4 Fechamento de caixa cego, com relatório de divergências.
- RF-5.5 Ledger append-only — estornos feitos por novo lançamento, nunca por sobrescrita.
- RF-5.6 Cadastro de motoboys (nome, telefone, status ativo), base do acerto individual de
  taxas de entrega.

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

## 6. Schema de Dados

O schema PostgreSQL completo da V1.0 — DDL de todas as tabelas, índices, constraints e
invariantes — está detalhado em **`docs/specs/data-schema.md`**.

Diretrizes que regem o modelo:

- Toda tabela crítica carrega `tenant_id` (UUID, indexado); um middleware de requisição força o
  filtro a partir do JWT, bloqueando vazamento horizontal (ADR-Q7).
- `orders.id` e `products.id` são UUIDv4; `orders.daily_sequence` é o inteiro sequencial diário
  por loja, gerado de forma autoritativa pelo servidor (ADR-Q10).
- `orders` e `products` incluem `fiscal_metadata` (JSONB) — reservado para a V2.0.
- `orders` inclui `external_channel` e `external_order_id` — reservados para a V1.1 (iFood).
- O cardápio usa estruturas flexíveis (JSONB) para agrupamentos dinâmicos de modificadores.
- O Ledger é uma tabela append-only de lançamentos; cada transação registra um par
  débito/crédito correspondente; correções ocorrem apenas por estorno (RF-5.5).

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
