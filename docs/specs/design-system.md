# Especificação Técnica — Design System & Handoff Visual (V1.0)

- **Status:** Estável (V1.0)
- **Documento mestre:** `docs/specs/spec.md` (RF-1, RF-2.3, RF-3, RF-5.4, RNF-3, RNF-7)
- **Schema referenciado:** `docs/specs/data-schema.md`
- **Contratos referenciados:** `docs/specs/api-contracts.md`
- **Escopo:** V1.0 (MVP)
- **Última atualização:** 2026-05-22

Define o design system do PWA do PDV e do cardápio digital — princípios de UX, tokens
visuais, componentes-chave, telas principais e estados do sistema. Serve também de **design
brief versionado**: é a fonte verificável que alimenta o Claude Design (§7) e mantém os
artefatos visuais sincronizados com a spec.

O documento descreve **intenção de design**, não implementação React. Os nomes de token
(`color.*`, `space.*`) são o contrato compartilhado entre esta spec, o Claude Design e o
código do PWA.

---

## 1. Princípios de UX

O PDV é operado por atendentes de **baixa literacia digital**, sob pressão de pico (sexta a
domingo, 19h–22h30 — `spec.md` §1.1). O cardápio digital é usado por clientes finais em
celular, sem treino. Toda decisão visual responde a cinco princípios, em ordem de prioridade:

| # | Princípio | Implicação de design |
|---|---|---|
| P1 | **Clareza acima de densidade** | Uma ação primária por tela; o que não decide a próxima ação do operador é secundário ou removido. |
| P2 | **Ação em segundos** | Alvos de toque grandes (§2.4), fluxos de clique único (RF-1.4), sem navegação aninhada no caminho crítico. |
| P3 | **Reconhecer, não ler** | Cor, ícone e forma comunicam estado antes do texto; texto curto, concreto, em pt-BR coloquial. Sem jargão técnico. |
| P4 | **Estado sempre visível** | Conexão, sincronização e fila de impressão (RNF-3) têm presença visual permanente — o operador nunca precisa adivinhar se o sistema está são. |
| P5 | **Resiliência percebida** | Sob rede instável, a UI continua respondendo a partir do cache local (ADR-Q1); a interface comunica "funcionando offline", nunca "quebrado". |

**Não-metas (V1.0):** modo escuro, temas por tenant, animações decorativas, densidade
configurável. O acabamento vem da consistência dos tokens, não de customização.

---

## 2. Tokens de Design

Os tokens são a unidade atômica do design system. Toda cor, medida e fonte do PWA referencia
um token desta seção — nenhum valor literal em componente. Esta tabela é o que o Claude
Design recebe como paleta de marca (§7).

### 2.1 Cores — base e neutros

| Token | Valor | Uso |
|---|---|---|
| `color.bg.base` | `#0F1115` | Fundo da aplicação (PDV — escuro reduz fadiga no turno noturno) |
| `color.bg.surface` | `#1B1E26` | Cards, painéis, barras |
| `color.bg.surface-raised` | `#262A35` | Elementos elevados (modais, item em foco) |
| `color.bg.canvas-light` | `#FFFFFF` | Fundo do cardápio digital e do wizard de onboarding |
| `color.text.primary` | `#F4F5F7` | Texto principal sobre fundo escuro |
| `color.text.secondary` | `#A2A8B4` | Texto de apoio, rótulos |
| `color.text.on-light` | `#1B1E26` | Texto sobre fundo claro |
| `color.border.subtle` | `#333845` | Divisórias, contornos de card |
| `color.brand.primary` | `#2563EB` | Cor de marca; ação primária neutra (botões de avanço) |
| `color.brand.on-primary` | `#FFFFFF` | Texto/ícone sobre a cor de marca |

### 2.2 Cores — estados semânticos

Cada estado tem um par `*/surface` (preenchimento de destaque suave) e um tom sólido. Cor
**nunca** é o único canal: acompanha sempre ícone e/ou texto (P3, acessibilidade — §2.6).

| Token | Valor | Significado |
|---|---|---|
| `color.success` | `#16A34A` | Pedido aceito, Pix liquidado, caixa conferido |
| `color.success.surface` | `#16341F` | Fundo de destaque de sucesso |
| `color.warning` | `#D97706` | Sincronizando, aguardando liquidação, atenção não-bloqueante |
| `color.warning.surface` | `#3A2A0E` | Fundo de destaque de atenção |
| `color.danger` | `#DC2626` | Erro de impressão, falha de pagamento, cancelamento |
| `color.danger.surface` | `#3A1518` | Fundo de destaque de erro |
| `color.offline` | `#64748B` | Modo offline / sem conexão (cinza-azulado, distinto de erro) |
| `color.offline.surface` | `#222730` | Fundo de destaque de offline |
| `color.accent.new-order` | `#FACC15` | Realce de pedido novo não-triado (pulso no card e na barra) |

> **Decisão de cor:** offline é **cinza**, não vermelho. Rede instável é o estado normal de
> operação esperado pela arquitetura (ADR-Q1 / RNF-3) — sinalizá-la como erro treinaria o
> operador a entrar em pânico no fluxo mais comum. Vermelho fica reservado a falhas que
> exigem ação corretiva (impressão, pagamento).

### 2.3 Tipografia

Fonte única, sem-serifa, alta legibilidade em tela de baixo custo: **Inter** (fallback
`system-ui, sans-serif`). Escala curta — quatro tamanhos de corpo bastam para o MVP.

| Token | Tamanho / Peso / Entrelinha | Uso |
|---|---|---|
| `font.display` | 32px / 700 / 1.2 | Número do pedido (#102), total no fechamento de caixa |
| `font.title` | 24px / 600 / 1.3 | Títulos de tela, nome do cliente no card |
| `font.body-lg` | 18px / 500 / 1.4 | Texto padrão do PDV — **piso de tamanho na área operacional** |
| `font.body` | 16px / 400 / 1.5 | Texto do cardápio digital, formulários do wizard |
| `font.caption` | 13px / 500 / 1.4 | Rótulos, metadados, hora do pedido |
| `font.numpad` | 28px / 600 / 1.0 | Dígitos do teclado numérico do caixa |

Regras: nenhum texto operacional abaixo de `font.body-lg` (16px é o mínimo absoluto, só em
metadado de apoio); números monetários e de pedido sempre tabulares (`font-variant-numeric:
tabular-nums`) para não "dançar" ao atualizar.

### 2.4 Espaçamento

Escala base 4px. Espaçamento generoso é funcional — separa alvos de toque e evita o toque
errado sob pressão (P2).

| Token | Valor | Uso típico |
|---|---|---|
| `space.xs` | 4px | Separação interna mínima (ícone↔texto) |
| `space.sm` | 8px | Padding interno de chips e rótulos |
| `space.md` | 16px | Padding padrão de card, gap entre campos |
| `space.lg` | 24px | Gap entre cards na grade de triagem |
| `space.xl` | 32px | Margens de seção, respiro de modal |
| `space.2xl` | 48px | Separação de blocos em telas de foco único |

**Alvos de toque (regra dura):** todo elemento tocável tem **mínimo 48×48px**; ações
primárias do caminho crítico (aceite, confirmar caixa) ocupam **mínimo 64px de altura** e
largura confortável. Espaçamento mínimo de 8px entre alvos adjacentes.

### 2.5 Raios de borda, elevação e movimento

| Token | Valor | Uso |
|---|---|---|
| `radius.sm` | 6px | Chips, badges, campos de input |
| `radius.md` | 12px | Cards, botões |
| `radius.lg` | 20px | Modais, folhas de ação |
| `radius.full` | 9999px | Indicadores de estado circulares, avatar |
| `elevation.card` | sombra suave (y2, blur8, 25% preto) | Cards sobre o fundo |
| `elevation.modal` | sombra forte (y8, blur24, 40% preto) | Modais e folhas |
| `motion.fast` | 120ms ease-out | Feedback de toque, mudança de estado de botão |
| `motion.base` | 200ms ease-out | Transições de painel, entrada de card |
| `motion.pulse` | 1.4s ease-in-out (loop) | Pulso de pedido novo e de "sincronizando" |

Movimento é funcional: confirma toque e chama atenção para pedido novo. Sem animação
puramente decorativa (não-meta §1). `motion.pulse` é a única animação contínua e respeita
`prefers-reduced-motion` (degrada para destaque estático de cor).

### 2.6 Acessibilidade — invariantes de token (RNF-7)

- Contraste mínimo **4.5:1** para texto e **3:1** para ícones/bordas de estado (WCAG AA);
  os pares de cor desta seção já satisfazem o limite.
- Cor **nunca** é o único portador de significado (P3): todo estado semântico combina cor +
  ícone + texto. Garante leitura por operador daltônico e sob brilho de tela ruim.
- Foco visível em todo elemento interativo (anel de 2px em `color.brand.primary`), para
  operação por teclado/leitor onde houver.

---

## 3. Componentes-Chave

Cada componente declara propósito, estados e a justificativa de dimensionamento. Esta lista
é o inventário mínimo da V1.0 — o Claude Design produz os artefatos visuais a partir dela.

### 3.1 Botão de Aceite em Clique Único (`AcceptButton`)

- **Propósito:** materializa o RF-1.4 — aceitar o pedido e enfileirar a impressão setorial
  (RF-2.2) em **um único toque**. É o componente mais crítico do PDV.
- **Onde:** card de pedido na triagem e topo do detalhe do pedido.
- **Dimensionamento:** altura mínima **64px**, largura plena do card; é o maior alvo da
  tela. Justificativa: é a ação de pico, repetida dezenas de vezes/hora sob pressão — erro
  de toque aqui custa um pedido. Rótulo curto e literal ("ACEITAR E IMPRIMIR"), ícone à
  esquerda, sem ícone ambíguo.
- **Estados:**

| Estado | Visual | Gatilho |
|---|---|---|
| `default` | Preenchido `color.success`, texto `on-primary` | Pedido em `pending` |
| `pressed` | Escurece 8%, `motion.fast` | Toque |
| `loading` | Spinner inline, rótulo "Aceitando…", botão travado | Chamada a `POST /v1/orders/:id/accept` em curso |
| `done` | Vira chip estático "Aceito ✓" em `color.success.surface` | Resposta de sucesso / evento `order.accepted` |
| `disabled` | Opacidade 40%, sem toque | Pedido fora de `pending` |

- **Resiliência:** offline, o toque é aceito localmente e o card marca "Aceito · aguardando
  sincronizar" (estado de §5.1); o componente **não** bloqueia esperando rede — a fila é
  responsabilidade da camada Local-First, não do botão.

### 3.2 Card de Pedido na Triagem (`OrderCard`)

- **Propósito:** unidade da tela de triagem (RF-1.3). Mostra, em uma olhada, tudo que decide
  a próxima ação: número, cliente, itens, valor, forma de pagamento, estado.
- **Dimensionamento:** largura mínima ~320px; número do pedido em `font.display`, legível a
  distância da cozinha. Conteúdo respira com `space.md`; cards separados por `space.lg`.
- **Anatomia (topo → base):** faixa de número `#102` + hora · nome e telefone do cliente ·
  lista de itens com modificadores · linha de total + ícone de forma de pagamento · ação
  primária no rodapé (`AcceptButton` ou botão de transição conforme o estado).
- **Estados (por `orders.status`):**

| Estado | Sinal visual |
|---|---|
| `pending` (novo) | Borda e badge `color.accent.new-order`, pulso `motion.pulse` até o operador interagir |
| `confirmed` / `preparing` | Borda `color.border.subtle`; badge de estágio neutro |
| `ready` / `dispatched` | Badge `color.success`; ação primária = próxima transição |
| aguardando Pix | Cadeado + badge `color.warning` "Aguardando Pix"; ação de despacho desabilitada (RF-4.3) |
| `cancelled` | Card esmaecido, badge `color.danger` |
| erro de impressão | Faixa `color.danger.surface` + botão "Reimprimir" (§5.3) |

- **Modificadores no card:** exclusões em texto `color.danger` prefixado "SEM"; adicionais
  pagos em peso 600. É o eco em tela do destaque físico impresso (RF-2.3) — operador e
  comanda contam a mesma história.

### 3.3 Teclado Numérico do Caixa (`NumPad`)

- **Propósito:** entrada de valores monetários sem teclado de sistema — fechamento de caixa
  cego (RF-5.4), pagamento manual (RF-5.2), valor de troco.
- **Dimensionamento:** grade 3×4, **cada tecla mínimo 72×72px** com gap `space.sm`; dígitos
  em `font.numpad` (28px). Justificativa: digitação de dinheiro não admite erro de toque, e
  o teclado nativo do celular é pequeno, inconsistente entre aparelhos e pode revelar o
  valor esperado por autopreenchimento — o que quebraria a regra do fechamento cego.
- **Layout das teclas:** `1–9`, `0`, `00` (acelera valores em reais) e `←` (apaga).
- **Estados:** `default`, `pressed` (`motion.fast`), display de valor em `font.display` com
  máscara de moeda (`R$ 0,00`) acima da grade. Sem estado de erro no teclado em si — a
  validação acontece na ação de confirmar.

### 3.4 Indicador de Estado de Conexão (`ConnectionStatus`)

- **Propósito:** tornar o estado de resiliência (RNF-3) permanentemente visível (P4). Reflete
  conexão de rede, sincronização e saúde da fila de impressão consumindo o estado publicado
  pela camada Local-First — **não** detecta nem gerencia conectividade por conta própria.
- **Onde:** fixo na barra superior do PDV, sempre visível, nunca rolando para fora.
- **Dimensionamento:** chip compacto com ícone `radius.full` + rótulo curto; toque abre um
  painel com detalhe (itens na fila de sincronização, último sync, status das portas de
  impressão — alimentado por `npm run diagnostics:local`, RF-6.3).
- **Estados:**

| Estado | Visual | Significado |
|---|---|---|
| `online` | Ponto `color.success`, rótulo "Online" | Conectado e sincronizado |
| `syncing` | Ponto `color.warning` com `motion.pulse`, rótulo "Sincronizando…" | Sincronização em curso |
| `offline` | Ponto `color.offline`, rótulo "Offline · operando local" | Sem rede; PWA segue funcional pelo cache (ADR-Q1) |
| `print-issue` | Ícone de impressora `color.danger`, contador de jobs presos | Há `print_jobs` em `failed` (§5.3) |

- **Tom da mensagem:** offline diz "operando local", não "sem conexão" — comunica
  continuidade (P5), reduz pânico do operador.

### 3.5 Componentes de apoio

Reutilizados nas telas; mesmos tokens, sem variação por contexto.

| Componente | Propósito | Nota de dimensionamento |
|---|---|---|
| `PrimaryButton` | Ação de avanço genérica (transições, "Salvar e continuar") | Altura mín. 56px |
| `StatusBadge` | Rótulo de estado (pedido, Pix, caixa) | Cor semântica + ícone + texto |
| `StepHeader` | Cabeçalho de passo do wizard com progresso | Mostra "Passo X de Y" |
| `QuantityStepper` | Mais/menos de quantidade no cardápio | Botões `48×48px` |
| `Toast` | Confirmação efêmera não-bloqueante | Aparece 4s; cor semântica |
| `BlockingModal` | Confirmação de ação crítica (cancelar pedido, fechar caixa) | `radius.lg`, `elevation.modal` |

---

## 4. Telas Principais

Cada tela declara objetivo, layout e **ação primária** — a única coisa que o operador/cliente
deveria conseguir fazer sem pensar (P1).

### 4.1 Triagem do PDV (RF-1.3)

- **Objetivo:** ver todos os pedidos abertos e despachá-los pelo ciclo de estados.
- **Layout:** barra superior fixa (logo, `ConnectionStatus`, sessão de caixa) + grade
  responsiva de `OrderCard`. Pedidos novos (`pending`) entram no topo, ordenados por chegada,
  com destaque `color.accent.new-order`. Filtro por estado opcional, escondido por padrão —
  a tela única é o padrão (RF-1.3). Em telefone, a grade vira coluna única.
- **Tela única, sem abas:** combate diretamente o gargalo de "14–18 trocas de tela por
  pedido" (`spec.md` §1.1). Todo o ciclo de vida do pedido acontece nesta tela.
- **Ação primária:** o `AcceptButton` no card do pedido novo (RF-1.4).
- **Tempo real:** atualiza por WebSocket (`order.created`, `order.updated` — `api-contracts.md`
  §7); `order.created` dispara o alerta sonoro (§5.2).
- **Estado vazio:** sem pedidos abertos (início de turno, hora morta), a tela exibe um bloco
  centralizado — ícone neutro + mensagem curta ("Nenhum pedido aberto. Tudo certo por aqui.")
  — e o `ConnectionStatus` permanece visível na barra superior. Comunica calma, não ausência
  de função (reforça P5).

### 4.2 Cardápio Digital — Cliente (RF-1.1)

- **Objetivo:** o cliente final monta o carrinho e é redirecionado ao WhatsApp do lojista
  (RF-1.2 / ADR-Q5). Fundo claro (`color.bg.canvas-light`), uso em celular sem treino.
- **Layout:** cabeçalho do restaurante · navegação por categorias · lista de produtos com
  foto, nome, preço · detalhe do produto com grupos de modificadores. Carrinho fixo no
  rodapé com total corrente.
- **Pizza meio a meio:** fluxo dedicado e guiado — o cliente escolhe "2 sabores" e seleciona
  cada metade em passos separados e rotulados ("Sabor 1", "Sabor 2"), com o preço resultante
  exibido **antes** de adicionar (regra `pizza_price_rule` do tenant — ADR-Q9). Ataca o
  gargalo de **72% de abandono na pizza fracionada** (`spec.md` §1.1): nada de configuração
  livre, sempre o próximo passo claro.
- **Ação primária:** botão "Enviar pedido pelo WhatsApp" no carrinho — gera o texto
  estruturado e abre `api.whatsapp.com/send`.
- **Acompanhamento:** após o envio, tela pública de status via `tracking_token`
  (`api-contracts.md` §6), incluindo o QR Code Pix quando aplicável (RF-4).

### 4.3 Wizard de Onboarding (RF-3)

- **Objetivo:** o lojista de baixa literacia digital configura o cardápio **sozinho**,
  sem abandono — ataca o gargalo de onboarding (`spec.md` §1.1).
- **Layout:** assistente passo a passo, **um conceito por tela**, com `StepHeader` mostrando
  progresso. Sequência: dados do restaurante → categorias → produtos → grupos de
  modificadores → pizza/combos → conexão Asaas. Validação client-side em tempo real (RF-3.2):
  o erro aparece junto do campo, em linguagem concreta ("Falta o preço"), nunca um código.
- **Salvamento:** progresso salvo a cada passo (consome rotas de tenant + cardápio,
  `api-contracts.md` §3–4); o lojista pode sair e voltar sem perder trabalho.
- **Combos e pizza:** o passo de combo recalcula o preço ao vivo e **impede avançar** com
  valor zerado (RF-3.4 / ADR-Q9) — o erro é mostrado de forma amigável, não como rejeição
  crua de payload.
- **Ação primária:** botão "Salvar e continuar" (`PrimaryButton`), idêntico em todos os
  passos — previsibilidade reduz a carga cognitiva.

### 4.4 Fechamento de Caixa Cego (RF-5.4)

- **Objetivo:** o operador declara o valor contado **sem ver o valor esperado** pelo sistema
  — controle antifraude (`spec.md` §1.1 gargalo 7 / ADR-Q3).
- **Layout:** tela de foco único. Instrução curta ("Conte o dinheiro na gaveta e digite o
  total") + `NumPad` (§3.3) + valor declarado em `font.display`. **Nenhum valor esperado,
  saldo de Ledger ou dica numérica em tela** antes do envio — invariante de design da tela.
- **Ação primária:** botão "Confirmar fechamento" — chama `POST /v1/cash-sessions/:id/close`
  com `declared_cents`.
- **Pós-envio:** só então a tela revela o relatório de divergências — `expected_cents`,
  `difference_cents` e o acerto acumulado por motoboy no turno (RF-5.3). Divergência dentro
  da tolerância em `color.success`; fora, em `color.warning` com o valor em destaque.

---

## 5. Estados do Sistema

Como cada estado de resiliência (RNF-3) é comunicado — visual e/ou sonoramente. A detecção e
o gerenciamento desses estados pertencem à camada Local-First; esta seção define apenas a
**representação na interface**.

### 5.1 Offline / Sincronizando

- **Offline:** `ConnectionStatus` (§3.4) em `color.offline`, rótulo "Offline · operando
  local". A UI permanece **totalmente interativa** a partir do cache (Service Worker +
  IndexedDB — ADR-Q1 / RF-6.1/6.2). Ações que dependem de rede (aceitar, registrar
  pagamento) são aceitas localmente; o item afetado ganha o microtexto "aguardando
  sincronizar" em `color.warning`. **Nada é bloqueado, nada some.**
- **Sincronizando:** `ConnectionStatus` em `color.warning` com `motion.pulse`, rótulo
  "Sincronizando…"; ao concluir, transita para `online` e os microtextos de pendência
  desaparecem. Um `Toast` de sucesso confirma quando uma fila relevante esvazia.
- **Princípio:** offline é estado normal, comunicado com calma (P5) — cinza, nunca vermelho.

### 5.2 Alerta Sonoro de Novo Pedido (RF-1.5)

- **Gatilho:** evento WebSocket `order.created` (`api-contracts.md` §7).
- **Som:** toque de alerta curto e distinto, servido do cache do Service Worker (RF-6.1) —
  **toca mesmo offline/sob rede instável**, requisito explícito da constituição.
- **Reforço visual (som nunca é o único canal — P3):** o novo `OrderCard` entra no topo com
  destaque `color.accent.new-order` e pulso `motion.pulse`; um contador na barra superior
  incrementa. O destaque persiste até o operador interagir com o card.
- **Repetição:** se um pedido novo segue não-triado, o som se repete em intervalo definido
  até o aceite — em cozinha barulhenta, um toque único passa despercebido.
- **Controle:** botão de silenciar/testar som nas configurações do PDV; o volume é do
  dispositivo. Mudo do sistema é respeitado, mas o reforço visual permanece.

### 5.3 Erro de Impressão

- **Gatilho:** `print_job` em `failed` (`data-schema.md` §7) ou evento WebSocket
  `print_job.failed`.
- **Exibição:** o `OrderCard` afetado ganha faixa `color.danger.surface` com ícone de
  impressora e ação "Reimprimir"; `ConnectionStatus` entra no estado `print-issue` com o
  contador de jobs presos. Um `Toast` de erro aparece na primeira falha.
- **Mensagem:** concreta e acionável — "Impressora da cozinha não respondeu. Toque para
  tentar de novo." Sem código de erro cru na tela do operador.
- **Recuperação:** a fila de impressão é persistente (RF-2.4) — "Reimprimir" reenfileira o
  job; ao restabelecer a conexão, a ponte Go reprocessa os pendentes automaticamente. A UI
  reflete `attempts` e `last_error` no painel de detalhe do `ConnectionStatus`.

---

## 6. Mapa de Cobertura

Rastreabilidade entre requisitos de UI e os artefatos deste documento.

| Requisito | Coberto por |
|---|---|
| RF-1.1 Cardápio digital | §4.2 |
| RF-1.3 Triagem em tempo real | §3.2, §4.1, §5.2 |
| RF-1.4 Aceite em clique único | §3.1 |
| RF-1.5 Alerta sonoro repetido | §5.2 |
| RF-2.2 Roteamento setorial | §3.1 (enfileiramento no aceite) |
| RF-2.3 Destaque de modificadores | §3.2 (eco em tela do impresso) |
| RF-2.4 Fila de impressão persistente | §5.3 |
| RF-3.2/3.4 Wizard + combos | §4.3 |
| RF-3.3 Pizza fracionada | §4.2 |
| RF-4.3 Bloqueio de despacho por Pix | §3.2 (estado "Aguardando Pix") |
| RF-5.2 Pagamento manual | §3.3 |
| RF-5.4 Fechamento de caixa cego | §3.3, §4.4 |
| RF-6.1/6.2 Resiliência PWA | §3.4, §5.1, §5.2 |
| RNF-3 Resiliência de rede (UI) | §3.4, §5 |
| RNF-7 Acessibilidade | §2.6 |

---

## 7. Handoff com o Claude Design

O Claude Design é a ferramenta de design visual que produz os artefatos de alta fidelidade
(telas, protótipos, especificação de componentes). Este documento é o **brief de entrada** e
o **contrato de verdade** dessa colaboração.

### 7.1 O que este brief entrega ao Claude Design

- **Tokens de marca** (§2) — paleta, tipografia, espaçamento, raios: a base visual literal.
- **Inventário de componentes** (§3) — propósito, estados e dimensionamento de cada peça.
- **Telas-chave** (§4) — objetivo, layout e ação primária de cada tela a desenhar.
- **Estados de borda** (§5) — offline, sincronizando, alerta sonoro, erro de impressão: os
  estados que protótipos costumam esquecer e que aqui são requisito explícito.

### 7.2 Fluxo de handoff

1. **Brief → Design.** Este documento, na versão de "Última atualização" do cabeçalho,
   alimenta o Claude Design. Os nomes de token são citados literalmente — o Claude Design
   não inventa cor nem medida fora de §2.
2. **Design → artefatos.** O Claude Design devolve um *handoff bundle*: telas de alta
   fidelidade, estados de componente e refinamentos visuais.
3. **Bundle → PWA.** O agente Frontend/UX integra o bundle ao PWA React (Vite), traduzindo
   os tokens em variáveis de tema e os componentes em React.
4. **Loop de revisão.** Divergência entre o artefato visual e este documento é resolvida
   **atualizando primeiro este documento**; o Claude Design re-roda a partir da versão nova.

### 7.3 Regra de sincronia

Este brief é a **fonte única de verdade** do design system. Vale a precedência:

> Token, componente ou estado **não descrito aqui não existe** no produto. Se o Claude
> Design propõe algo novo e a equipe aceita, o item é **primeiro escrito nesta spec** (com
> bump da data de "Última atualização") e só então entra no PWA.

Isso mantém o documento versionado, o artefato visual e o código convergentes — o Claude
Design é re-executável de forma determinística a partir desta spec, sem deriva.

### 7.4 Itens fora do handoff (V1.0)

- Ilustrações e fotografia de produto — responsabilidade de conteúdo de cada tenant.
- Identidade visual por tenant — não-meta da V1.0 (§1); o PWA usa um único tema.
- Telas de impressão de navegador — **não existem**: toda impressão é ESC/POS via WebSocket
  local, sem diálogo nativo (CLAUDE.md, "Zero Raw Printing Dialogs").
