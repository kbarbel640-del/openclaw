---
summary: "Refatoracao do Clawnet: unificar protocolo de rede, papeis, autenticacao, aprovacoes e identidade"
read_when:
  - Planejando um protocolo de rede unificado para nos + clientes operadores
  - Retrabalhando aprovacoes, pareamento, TLS e presenca entre dispositivos
title: "Refatoracao do Clawnet"
x-i18n:
  source_path: refactor/clawnet.md
  source_hash: 719b219c3b326479
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:39Z
---

# Refatoracao do Clawnet (unificacao de protocolo + autenticacao)

## Oi

Oi Peter — excelente direcao; isso desbloqueia uma UX mais simples + seguranca mais forte.

## Proposito

Documento unico e rigoroso para:

- Estado atual: protocolos, fluxos, limites de confianca.
- Pontos de dor: aprovacoes, roteamento multi‑hop, duplicacao de UI.
- Novo estado proposto: um protocolo, papeis com escopo, autenticacao/pareamento unificados, pinagem de TLS.
- Modelo de identidade: IDs estaveis + slugs fofos.
- Plano de migracao, riscos, questoes em aberto.

## Objetivos (da discussao)

- Um protocolo para todos os clientes (app mac, CLI, iOS, Android, no headless).
- Todo participante da rede autenticado + pareado.
- Clareza de papeis: nos vs operadores.
- Aprovacoes centrais roteadas para onde o usuario esta.
- Criptografia TLS + pinagem opcional para todo trafego remoto.
- Minima duplicacao de codigo.
- Uma unica maquina deve aparecer uma vez (sem entrada duplicada de UI/no).

## Nao‑objetivos (explicitos)

- Remover separacao de capacidades (ainda precisa de menor privilegio).
- Expor o plano de controle completo do gateway sem verificacoes de escopo.
- Fazer a autenticacao depender de rotulos humanos (slugs continuam nao sendo de seguranca).

---

# Estado atual (como esta)

## Dois protocolos

### 1) Gateway WebSocket (plano de controle)

- Superficie completa de API: configuracao, canais, modelos, sessoes, execucoes de agente, logs, nos, etc.
- Bind padrao: loopback. Acesso remoto via SSH/Tailscale.
- Autenticacao: token/senha via `connect`.
- Sem pinagem de TLS (depende de loopback/tunel).
- Codigo:
  - `src/gateway/server/ws-connection/message-handler.ts`
  - `src/gateway/client.ts`
  - `docs/gateway/protocol.md`

### 2) Bridge (transporte de no)

- Superficie com allowlist restrita, identidade de no + pareamento.
- JSONL sobre TCP; TLS opcional + pinagem de fingerprint de certificado.
- TLS anuncia fingerprint na descoberta TXT.
- Codigo:
  - `src/infra/bridge/server/connection.ts`
  - `src/gateway/server-bridge.ts`
  - `src/node-host/bridge-client.ts`
  - `docs/gateway/bridge-protocol.md`

## Clientes do plano de controle hoje

- CLI → Gateway WS via `callGateway` (`src/gateway/call.ts`).
- UI do app macOS → Gateway WS (`GatewayConnection`).
- Web Control UI → Gateway WS.
- ACP → Gateway WS.
- O controle no navegador usa seu proprio servidor HTTP de controle.

## Nos hoje

- App macOS em modo no conecta ao bridge do Gateway (`MacNodeBridgeSession`).
- Apps iOS/Android conectam ao bridge do Gateway.
- Pareamento + token por no armazenados no gateway.

## Fluxo atual de aprovacao (execucao)

- Agente usa `system.run` via Gateway.
- Gateway invoca o no via bridge.
- Runtime do no decide a aprovacao.
- Prompt de UI exibido pelo app mac (quando no == app mac).
- No retorna `invoke-res` ao Gateway.
- Multi‑hop, UI vinculada ao host do no.

## Presenca + identidade hoje

- Entradas de presenca no Gateway vindas de clientes WS.
- Entradas de presenca de nos vindas do bridge.
- App mac pode mostrar duas entradas para a mesma maquina (UI + no).
- Identidade do no armazenada no armazenamento de pareamento; identidade da UI separada.

---

# Problemas / pontos de dor

- Duas pilhas de protocolo para manter (WS + Bridge).
- Aprovacoes em nos remotos: o prompt aparece no host do no, nao onde o usuario esta.
- Pinagem de TLS existe apenas para o bridge; WS depende de SSH/Tailscale.
- Duplicacao de identidade: a mesma maquina aparece como multiplas instancias.
- Papeis ambiguos: capacidades de UI + no + CLI nao claramente separadas.

---

# Novo estado proposto (Clawnet)

## Um protocolo, dois papeis

Protocolo WS unico com papel + escopo.

- **Papel: no** (host de capacidades)
- **Papel: operador** (plano de controle)
- **Escopo** opcional para operador:
  - `operator.read` (status + visualizacao)
  - `operator.write` (execucao de agente, envios)
  - `operator.admin` (configuracao, canais, modelos)

### Comportamentos por papel

**No**

- Pode registrar capacidades (`caps`, `commands`, permissoes).
- Pode receber comandos `invoke` (`system.run`, `camera.*`, `canvas.*`, `screen.record`, etc).
- Pode enviar eventos: `voice.transcript`, `agent.request`, `chat.subscribe`.
- Nao pode chamar APIs do plano de controle de configuracao/modelos/canais/sessoes/agente.

**Operador**

- API completa do plano de controle, protegida por escopo.
- Recebe todas as aprovacoes.
- Nao executa diretamente acoes de SO; roteia para os nos.

### Regra chave

O papel e por conexao, nao por dispositivo. Um dispositivo pode abrir ambos os papeis, separadamente.

---

# Autenticacao + pareamento unificados

## Identidade do cliente

Todo cliente fornece:

- `deviceId` (estavel, derivado da chave do dispositivo).
- `displayName` (nome humano).
- `role` + `scope` + `caps` + `commands`.

## Fluxo de pareamento (unificado)

- Cliente conecta sem autenticacao.
- Gateway cria uma **solicitacao de pareamento** para esse `deviceId`.
- Operador recebe o prompt; aprova/nega.
- Gateway emite credenciais vinculadas a:
  - chave publica do dispositivo
  - papel(is)
  - escopo(s)
  - capacidades/comandos
- Cliente persiste o token e reconecta autenticado.

## Autenticacao vinculada ao dispositivo (evitar replay de bearer token)

Preferencial: pares de chaves do dispositivo.

- Dispositivo gera um par de chaves uma vez.
- `deviceId = fingerprint(publicKey)`.
- Gateway envia um nonce; o dispositivo assina; o gateway verifica.
- Tokens sao emitidos para uma chave publica (prova de posse), nao para uma string.

Alternativas:

- mTLS (certificados de cliente): mais forte, mais complexidade operacional.
- Bearer tokens de curta duracao apenas como fase temporaria (rotacionar + revogar cedo).

## Aprovacao silenciosa (heuristica SSH)

Definir com precisao para evitar um elo fraco. Prefira uma:

- **Somente local**: auto‑parear quando o cliente conecta via loopback/socket Unix.
- **Desafio via SSH**: gateway emite nonce; cliente prova SSH ao busca‑lo.
- **Janela de presenca fisica**: apos uma aprovacao local na UI do host do gateway, permitir auto‑pareamento por uma janela curta (ex.: 10 minutos).

Sempre registrar + gravar auto‑aprovacoes.

---

# TLS em todo lugar (dev + prod)

## Reutilizar o TLS existente do bridge

Usar o runtime TLS atual + pinagem de fingerprint:

- `src/infra/bridge/server/tls.ts`
- logica de verificacao de fingerprint em `src/node-host/bridge-client.ts`

## Aplicar ao WS

- Servidor WS suporta TLS com o mesmo cert/chave + fingerprint.
- Clientes WS podem fixar a fingerprint (opcional).
- A descoberta anuncia TLS + fingerprint para todos os endpoints.
  - Descoberta e apenas dicas de localizacao; nunca uma ancora de confianca.

## Por que

- Reduzir dependencia de SSH/Tailscale para confidencialidade.
- Tornar conexoes remotas moveis seguras por padrao.

---

# Redesign de aprovacoes (centralizado)

## Atual

A aprovacao acontece no host do no (runtime do no no app mac). O prompt aparece onde o no roda.

## Proposto

A aprovacao e **hospedada no gateway**, com UI entregue aos clientes operadores.

### Novo fluxo

1. Gateway recebe a intencao `system.run` (agente).
2. Gateway cria um registro de aprovacao: `approval.requested`.
3. UI(s) do operador exibem o prompt.
4. Decisao de aprovacao enviada ao gateway: `approval.resolve`.
5. Gateway invoca o comando do no se aprovado.
6. No executa e retorna `invoke-res`.

### Semantica de aprovacao (endurecimento)

- Broadcast para todos os operadores; apenas a UI ativa mostra um modal (as outras recebem um toast).
- A primeira resolucao vence; o gateway rejeita resolucoes subsequentes como ja resolvidas.
- Timeout padrao: negar apos N segundos (ex.: 60s), registrar motivo.
- A resolucao requer escopo `operator.approvals`.

## Beneficios

- O prompt aparece onde o usuario esta (mac/celular).
- Aprovacoes consistentes para nos remotos.
- Runtime do no permanece headless; sem dependencia de UI.

---

# Exemplos de clareza de papeis

## App iPhone

- **Papel de no** para: microfone, camera, chat de voz, localizacao, push‑to‑talk.
- **operator.read** opcional para status e visualizacao de chat.
- **operator.write/admin** opcional apenas quando explicitamente habilitado.

## App macOS

- Papel de operador por padrao (UI de controle).
- Papel de no quando “Mac node” habilitado (system.run, tela, camera).
- Mesmo deviceId para ambas as conexoes → entrada de UI mesclada.

## CLI

- Papel de operador sempre.
- Escopo derivado pelo subcomando:
  - `status`, `logs` → leitura
  - `agent`, `message` → escrita
  - `config`, `channels` → admin
  - aprovacoes + pareamento → `operator.approvals` / `operator.pairing`

---

# Identidade + slugs

## ID estavel

Obrigatorio para autenticacao; nunca muda.
Preferencial:

- Fingerprint do par de chaves (hash da chave publica).

## Slug fofo (tema de lagosta)

Apenas rotulo humano.

- Exemplo: `scarlet-claw`, `saltwave`, `mantis-pinch`.
- Armazenado no registro do gateway, editavel.
- Tratamento de colisoes: `-2`, `-3`.

## Agrupamento de UI

Mesmo `deviceId` entre papeis → uma unica linha de “Instancia”:

- Badge: `operator`, `node`.
- Mostra capacidades + visto por ultimo.

---

# Estrategia de migracao

## Fase 0: Documentar + alinhar

- Publicar este doc.
- Inventariar todas as chamadas de protocolo + fluxos de aprovacao.

## Fase 1: Adicionar papeis/escopos ao WS

- Estender params de `connect` com `role`, `scope`, `deviceId`.
- Adicionar bloqueio por allowlist para papel de no.

## Fase 2: Compatibilidade com bridge

- Manter o bridge rodando.
- Adicionar suporte a no via WS em paralelo.
- Bloquear recursos atras de flag de configuracao.

## Fase 3: Aprovacoes centrais

- Adicionar eventos de solicitacao + resolucao de aprovacao no WS.
- Atualizar UI do app mac para solicitar + responder.
- Runtime do no para de solicitar UI.

## Fase 4: Unificacao de TLS

- Adicionar configuracao TLS para WS usando o runtime TLS do bridge.
- Adicionar pinagem aos clientes.

## Fase 5: Descontinuar bridge

- Migrar no de iOS/Android/mac para WS.
- Manter bridge como fallback; remover quando estavel.

## Fase 6: Autenticacao vinculada ao dispositivo

- Exigir identidade baseada em chave para todas as conexoes nao locais.
- Adicionar UI de revogacao + rotacao.

---

# Notas de seguranca

- Papel/allowlist aplicados no limite do gateway.
- Nenhum cliente recebe API “completa” sem escopo de operador.
- Pareamento exigido para _todas_ as conexoes.
- TLS + pinagem reduzem risco de MITM para mobile.
- Aprovacao silenciosa via SSH e uma conveniencia; ainda registrada + revogavel.
- Descoberta nunca e uma ancora de confianca.
- Claims de capacidades sao verificadas contra allowlists do servidor por plataforma/tipo.

# Streaming + payloads grandes (midia de no)

O plano de controle WS e adequado para mensagens pequenas, mas os nos tambem fazem:

- clipes de camera
- gravacoes de tela
- streams de audio

Opcoes:

1. Frames binarios WS + chunking + regras de backpressure.
2. Endpoint de streaming separado (ainda TLS + autenticacao).
3. Manter o bridge por mais tempo para comandos pesados de midia, migrar por ultimo.

Escolha uma antes da implementacao para evitar divergencia.

# Politica de capacidade + comandos

- Caps/comandos reportados pelo no sao tratados como **claims**.
- O gateway aplica allowlists por plataforma.
- Qualquer novo comando requer aprovacao do operador ou mudanca explicita de allowlist.
- Auditar mudancas com timestamps.

# Auditoria + limitacao de taxa

- Logar: solicitacoes de pareamento, aprovacoes/negacoes, emissao/rotacao/revogacao de tokens.
- Limitar taxa de spam de pareamento e prompts de aprovacao.

# Higiene de protocolo

- Versao explicita de protocolo + codigos de erro.
- Regras de reconexao + politica de heartbeat.
- TTL de presenca e semantica de visto por ultimo.

---

# Questoes em aberto

1. Dispositivo unico executando ambos os papeis: modelo de token
   - Recomendar tokens separados por papel (no vs operador).
   - Mesmo deviceId; escopos diferentes; revogacao mais clara.

2. Granularidade de escopo do operador
   - leitura/escrita/admin + aprovacoes + pareamento (minimo viavel).
   - Considerar escopos por recurso depois.

3. UX de rotacao + revogacao de token
   - Auto‑rotacionar na mudanca de papel.
   - UI para revogar por deviceId + papel.

4. Descoberta
   - Estender o TXT Bonjour atual para incluir fingerprint TLS do WS + dicas de papel.
   - Tratar apenas como dicas de localizacao.

5. Aprovacao entre redes
   - Broadcast para todos os clientes operadores; UI ativa mostra modal.
   - Primeira resposta vence; gateway garante atomicidade.

---

# Resumo (TL;DR)

- Hoje: plano de controle WS + transporte de no Bridge.
- Dor: aprovacoes + duplicacao + duas pilhas.
- Proposta: um protocolo WS com papeis + escopos explicitos, pareamento unificado + pinagem TLS, aprovacoes hospedadas no gateway, IDs de dispositivo estaveis + slugs fofos.
- Resultado: UX mais simples, seguranca mais forte, menos duplicacao, melhor roteamento mobile.
