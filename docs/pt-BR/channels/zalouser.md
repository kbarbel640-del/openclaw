---
summary: "Suporte a conta pessoal do Zalo via zca-cli (login por QR), capacidades e configuracao"
read_when:
  - Configurando Zalo Pessoal para o OpenClaw
  - Depurando login ou fluxo de mensagens do Zalo Pessoal
title: "Zalo Pessoal"
x-i18n:
  source_path: channels/zalouser.md
  source_hash: 2a249728d556e5cc
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:29Z
---

# Zalo Pessoal (nao oficial)

Status: experimental. Esta integracao automatiza uma **conta pessoal do Zalo** via `zca-cli`.

> **Aviso:** Esta e uma integracao nao oficial e pode resultar em suspensao/banimento da conta. Use por sua conta e risco.

## Plugin necessario

O Zalo Pessoal e entregue como um plugin e nao vem incluido na instalacao principal.

- Instale via CLI: `openclaw plugins install @openclaw/zalouser`
- Ou a partir de um checkout do codigo-fonte: `openclaw plugins install ./extensions/zalouser`
- Detalhes: [Plugins](/plugin)

## Pre-requisito: zca-cli

A maquina do Gateway deve ter o binario `zca` disponivel em `PATH`.

- Verifique: `zca --version`
- Se estiver ausente, instale o zca-cli (veja `extensions/zalouser/README.md` ou a documentacao upstream do zca-cli).

## Configuracao rapida (iniciante)

1. Instale o plugin (veja acima).
2. Faça login (QR, na maquina do Gateway):
   - `openclaw channels login --channel zalouser`
   - Escaneie o codigo QR no terminal com o aplicativo movel do Zalo.
3. Habilite o canal:

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      dmPolicy: "pairing",
    },
  },
}
```

4. Reinicie o Gateway (ou finalize a integracao inicial).
5. O acesso por Mensagem direta (DM) padrao e por pareamento; aprove o codigo de pareamento no primeiro contato.

## O que e

- Usa `zca listen` para receber mensagens de entrada.
- Usa `zca msg ...` para enviar respostas (texto/midia/link).
- Projetado para casos de uso de “conta pessoal” onde a Zalo Bot API nao esta disponivel.

## Nomeacao

O id do canal e `zalouser` para deixar explicito que isto automatiza uma **conta pessoal de usuario do Zalo** (nao oficial). Mantemos `zalo` reservado para uma possivel futura integracao oficial com a API do Zalo.

## Encontrando IDs (diretorio)

Use a CLI de diretorio para descobrir contatos/grupos e seus IDs:

```bash
openclaw directory self --channel zalouser
openclaw directory peers list --channel zalouser --query "name"
openclaw directory groups list --channel zalouser --query "work"
```

## Limites

- Texto de saida e dividido em blocos de ~2000 caracteres (limites do cliente do Zalo).
- Streaming e bloqueado por padrao.

## Controle de acesso (DMs)

`channels.zalouser.dmPolicy` suporta: `pairing | allowlist | open | disabled` (padrao: `pairing`).
`channels.zalouser.allowFrom` aceita IDs de usuario ou nomes. O assistente resolve nomes para IDs via `zca friend find` quando disponivel.

Aprove via:

- `openclaw pairing list zalouser`
- `openclaw pairing approve zalouser <code>`

## Acesso a grupos (opcional)

- Padrao: `channels.zalouser.groupPolicy = "open"` (grupos permitidos). Use `channels.defaults.groupPolicy` para sobrescrever o padrao quando nao definido.
- Restrinja a uma lista de permissao com:
  - `channels.zalouser.groupPolicy = "allowlist"`
  - `channels.zalouser.groups` (as chaves sao IDs ou nomes de grupos)
- Bloqueie todos os grupos: `channels.zalouser.groupPolicy = "disabled"`.
- O assistente de configuracao pode solicitar listas de permissao de grupos.
- Na inicializacao, o OpenClaw resolve nomes de grupos/usuarios nas listas de permissao para IDs e registra o mapeamento; entradas nao resolvidas sao mantidas como digitadas.

Exemplo:

```json5
{
  channels: {
    zalouser: {
      groupPolicy: "allowlist",
      groups: {
        "123456789": { allow: true },
        "Work Chat": { allow: true },
      },
    },
  },
}
```

## Multiplas contas

As contas mapeiam para perfis do zca. Exemplo:

```json5
{
  channels: {
    zalouser: {
      enabled: true,
      defaultAccount: "default",
      accounts: {
        work: { enabled: true, profile: "work" },
      },
    },
  },
}
```

## Solucao de problemas

**`zca` nao encontrado:**

- Instale o zca-cli e garanta que ele esteja no `PATH` para o processo do Gateway.

**O login nao persiste:**

- `openclaw channels status --probe`
- Refaça o login: `openclaw channels logout --channel zalouser && openclaw channels login --channel zalouser`
