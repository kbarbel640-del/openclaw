---
summary: "Use a assinatura Claude Max/Pro como um endpoint de API compatível com OpenAI"
read_when:
  - Voce quer usar a assinatura Claude Max com ferramentas compatíveis com OpenAI
  - Voce quer um servidor de API local que encapsula o Claude Code CLI
  - Voce quer economizar usando assinatura em vez de chaves de API
title: "Proxy de API do Claude Max"
x-i18n:
  source_path: providers/claude-max-api-proxy.md
  source_hash: 63b61096b96b720c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:57:03Z
---

# Proxy de API do Claude Max

**claude-max-api-proxy** é uma ferramenta da comunidade que expõe sua assinatura Claude Max/Pro como um endpoint de API compatível com OpenAI. Isso permite que voce use sua assinatura com qualquer ferramenta que suporte o formato da API OpenAI.

## Por que usar isso?

| Abordagem             | Custo                                                         | Melhor para                                 |
| --------------------- | ------------------------------------------------------------- | ------------------------------------------- |
| API da Anthropic      | Pague por token (~US$ 15/M entrada, US$ 75/M saida para Opus) | Apps em producao, alto volume               |
| Assinatura Claude Max | US$ 200/mes fixo                                              | Uso pessoal, desenvolvimento, uso ilimitado |

Se voce tem uma assinatura Claude Max e quer usá-la com ferramentas compatíveis com OpenAI, este proxy pode economizar um valor significativo.

## Como funciona

```
Your App → claude-max-api-proxy → Claude Code CLI → Anthropic (via subscription)
     (OpenAI format)              (converts format)      (uses your login)
```

O proxy:

1. Aceita requisicoes no formato OpenAI em `http://localhost:3456/v1/chat/completions`
2. Converte para comandos do Claude Code CLI
3. Retorna respostas no formato OpenAI (streaming suportado)

## Instalacao

```bash
# Requires Node.js 20+ and Claude Code CLI
npm install -g claude-max-api-proxy

# Verify Claude CLI is authenticated
claude --version
```

## Uso

### Iniciar o servidor

```bash
claude-max-api
# Server runs at http://localhost:3456
```

### Testar

```bash
# Health check
curl http://localhost:3456/health

# List models
curl http://localhost:3456/v1/models

# Chat completion
curl http://localhost:3456/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-opus-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Com OpenClaw

Voce pode apontar o OpenClaw para o proxy como um endpoint personalizado compatível com OpenAI:

```json5
{
  env: {
    OPENAI_API_KEY: "not-needed",
    OPENAI_BASE_URL: "http://localhost:3456/v1",
  },
  agents: {
    defaults: {
      model: { primary: "openai/claude-opus-4" },
    },
  },
}
```

## Modelos disponiveis

| ID do modelo      | Mapeia para     |
| ----------------- | --------------- |
| `claude-opus-4`   | Claude Opus 4   |
| `claude-sonnet-4` | Claude Sonnet 4 |
| `claude-haiku-4`  | Claude Haiku 4  |

## Inicializacao automatica no macOS

Crie um LaunchAgent para executar o proxy automaticamente:

```bash
cat > ~/Library/LaunchAgents/com.claude-max-api.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.claude-max-api</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/local/bin/node</string>
    <string>/usr/local/lib/node_modules/claude-max-api-proxy/dist/server/standalone.js</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:~/.local/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>
EOF

launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.claude-max-api.plist
```

## Links

- **npm:** https://www.npmjs.com/package/claude-max-api-proxy
- **GitHub:** https://github.com/atalovesyou/claude-max-api-proxy
- **Issues:** https://github.com/atalovesyou/claude-max-api-proxy/issues

## Notas

- Esta e uma **ferramenta da comunidade**, nao oficialmente suportada pela Anthropic ou pelo OpenClaw
- Requer uma assinatura ativa Claude Max/Pro com o Claude Code CLI autenticado
- O proxy roda localmente e nao envia dados para servidores de terceiros
- Respostas em streaming sao totalmente suportadas

## Veja tambem

- [Provedor Anthropic](/providers/anthropic) - Integracao nativa do OpenClaw com Claude usando setup-token ou chaves de API
- [Provedor OpenAI](/providers/openai) - Para assinaturas OpenAI/Codex
