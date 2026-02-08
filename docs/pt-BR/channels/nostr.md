---
summary: "Canal de DM do Nostr via mensagens criptografadas NIP-04"
read_when:
  - Voce quer que o OpenClaw receba DMs via Nostr
  - Voce esta configurando mensagens descentralizadas
title: "Nostr"
x-i18n:
  source_path: channels/nostr.md
  source_hash: 6b9fe4c74bf5e7c0
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:55:27Z
---

# Nostr

**Status:** Plugin opcional (desativado por padrao).

Nostr e um protocolo descentralizado para redes sociais. Este canal permite que o OpenClaw receba e responda a mensagens diretas (DMs) criptografadas via NIP-04.

## Instalar (sob demanda)

### Integracao Inicial (recomendado)

- O assistente de integracao inicial (`openclaw onboard`) e `openclaw channels add` listam plugins de canal opcionais.
- Selecionar Nostr solicita a instalacao do plugin sob demanda.

Padroes de instalacao:

- **Canal Dev + git checkout disponivel:** usa o caminho local do plugin.
- **Stable/Beta:** baixa do npm.

Voce sempre pode substituir a escolha no prompt.

### Instalacao manual

```bash
openclaw plugins install @openclaw/nostr
```

Usar um checkout local (fluxos de trabalho dev):

```bash
openclaw plugins install --link <path-to-openclaw>/extensions/nostr
```

Reinicie o Gateway apos instalar ou habilitar plugins.

## Configuracao rapida

1. Gere um par de chaves Nostr (se necessario):

```bash
# Using nak
nak key generate
```

2. Adicione a configuracao:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}"
    }
  }
}
```

3. Exporte a chave:

```bash
export NOSTR_PRIVATE_KEY="nsec1..."
```

4. Reinicie o Gateway.

## Referencia de configuracao

| Key          | Type     | Default                                     | Description                            |
| ------------ | -------- | ------------------------------------------- | -------------------------------------- |
| `privateKey` | string   | required                                    | Chave privada no formato `nsec` ou hex |
| `relays`     | string[] | `['wss://relay.damus.io', 'wss://nos.lol']` | URLs de relay (WebSocket)              |
| `dmPolicy`   | string   | `pairing`                                   | Politica de acesso a DM                |
| `allowFrom`  | string[] | `[]`                                        | Pubkeys de remetentes permitidos       |
| `enabled`    | boolean  | `true`                                      | Habilitar/desabilitar canal            |
| `name`       | string   | -                                           | Nome de exibicao                       |
| `profile`    | object   | -                                           | Metadados de perfil NIP-01             |

## Metadados de perfil

Os dados de perfil sao publicados como um evento NIP-01 `kind:0`. Voce pode gerencia-los pela UI de Controle (Channels -> Nostr -> Profile) ou defini-los diretamente na configuracao.

Exemplo:

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "profile": {
        "name": "openclaw",
        "displayName": "OpenClaw",
        "about": "Personal assistant DM bot",
        "picture": "https://example.com/avatar.png",
        "banner": "https://example.com/banner.png",
        "website": "https://example.com",
        "nip05": "openclaw@example.com",
        "lud16": "openclaw@example.com"
      }
    }
  }
}
```

Notas:

- URLs de perfil devem usar `https://`.
- Importar de relays mescla campos e preserva substituicoes locais.

## Controle de acesso

### Politicas de DM

- **pairing** (padrao): remetentes desconhecidos recebem um codigo de pareamento.
- **allowlist**: apenas pubkeys em `allowFrom` podem enviar DM.
- **open**: DMs publicas de entrada (requer `allowFrom: ["*"]`).
- **disabled**: ignorar DMs de entrada.

### Exemplo de allowlist

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "dmPolicy": "allowlist",
      "allowFrom": ["npub1abc...", "npub1xyz..."]
    }
  }
}
```

## Formatos de chave

Formatos aceitos:

- **Chave privada:** `nsec...` ou hex de 64 caracteres
- **Pubkeys (`allowFrom`):** `npub...` ou hex

## Relays

Padroes: `relay.damus.io` e `nos.lol`.

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["wss://relay.damus.io", "wss://relay.primal.net", "wss://nostr.wine"]
    }
  }
}
```

Dicas:

- Use 2-3 relays para redundancia.
- Evite muitos relays (latencia, duplicacao).
- Relays pagos podem melhorar a confiabilidade.
- Relays locais sao adequados para testes (`ws://localhost:7777`).

## Suporte ao protocolo

| NIP    | Status    | Description                                    |
| ------ | --------- | ---------------------------------------------- |
| NIP-01 | Supported | Formato basico de evento + metadados de perfil |
| NIP-04 | Supported | DMs criptografadas (`kind:4`)                  |
| NIP-17 | Planned   | DMs com gift-wrap                              |
| NIP-44 | Planned   | Criptografia versionada                        |

## Testes

### Relay local

```bash
# Start strfry
docker run -p 7777:7777 ghcr.io/hoytech/strfry
```

```json
{
  "channels": {
    "nostr": {
      "privateKey": "${NOSTR_PRIVATE_KEY}",
      "relays": ["ws://localhost:7777"]
    }
  }
}
```

### Teste manual

1. Anote a pubkey do bot (npub) a partir dos logs.
2. Abra um cliente Nostr (Damus, Amethyst, etc.).
3. Envie uma DM para a pubkey do bot.
4. Verifique a resposta.

## Solucao de problemas

### Nao recebendo mensagens

- Verifique se a chave privada e valida.
- Garanta que as URLs de relay estejam acessiveis e usem `wss://` (ou `ws://` para local).
- Confirme que `enabled` nao esta `false`.
- Verifique os logs do Gateway para erros de conexao com relays.

### Nao enviando respostas

- Verifique se o relay aceita escrita.
- Verifique a conectividade de saida.
- Observe limites de taxa do relay.

### Respostas duplicadas

- Esperado ao usar varios relays.
- As mensagens sao deduplicadas pelo ID do evento; apenas a primeira entrega aciona uma resposta.

## Seguranca

- Nunca faça commit de chaves privadas.
- Use variaveis de ambiente para chaves.
- Considere `allowlist` para bots em producao.

## Limitacoes (MVP)

- Apenas mensagens diretas (sem chats em grupo).
- Sem anexos de midia.
- Apenas NIP-04 (gift-wrap NIP-17 planejado).
