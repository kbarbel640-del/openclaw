---
summary: "Skriptgestuetzte Einfuehrung und Agenten-Einrichtung fuer die OpenClaw CLI"
read_when:
  - Sie automatisieren die Einfuehrung in Skripten oder CI
  - Sie benoetigen nicht-interaktive Beispiele fuer bestimmte Anbieter
title: "CLI-Automatisierung"
sidebarTitle: "CLI automation"
x-i18n:
  source_path: start/wizard-cli-automation.md
  source_hash: 5b5463359a87cfe6
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:05:33Z
---

# CLI-Automatisierung

Verwenden Sie `--non-interactive`, um `openclaw onboard` zu automatisieren.

<Note>
`--json` bedeutet nicht den nicht-interaktiven Modus. Verwenden Sie `--non-interactive` (und `--workspace`) fuer Skripte.
</Note>

## Basisbeispiel ohne Interaktion

```bash
openclaw onboard --non-interactive \
  --mode local \
  --auth-choice apiKey \
  --anthropic-api-key "$ANTHROPIC_API_KEY" \
  --gateway-port 18789 \
  --gateway-bind loopback \
  --install-daemon \
  --daemon-runtime node \
  --skip-skills
```

Fuegen Sie `--json` hinzu, um eine maschinenlesbare Zusammenfassung zu erhalten.

## Anbieterspezifische Beispiele

<AccordionGroup>
  <Accordion title="Gemini-Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice gemini-api-key \
      --gemini-api-key "$GEMINI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Z.AI-Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice zai-api-key \
      --zai-api-key "$ZAI_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Vercel AI Gateway-Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice ai-gateway-api-key \
      --ai-gateway-api-key "$AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Cloudflare AI Gateway-Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice cloudflare-ai-gateway-api-key \
      --cloudflare-ai-gateway-account-id "your-account-id" \
      --cloudflare-ai-gateway-gateway-id "your-gateway-id" \
      --cloudflare-ai-gateway-api-key "$CLOUDFLARE_AI_GATEWAY_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Moonshot-Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice moonshot-api-key \
      --moonshot-api-key "$MOONSHOT_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="Synthetisches Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice synthetic-api-key \
      --synthetic-api-key "$SYNTHETIC_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
  <Accordion title="OpenCode Zen-Beispiel">
    ```bash
    openclaw onboard --non-interactive \
      --mode local \
      --auth-choice opencode-zen \
      --opencode-zen-api-key "$OPENCODE_API_KEY" \
      --gateway-port 18789 \
      --gateway-bind loopback
    ```
  </Accordion>
</AccordionGroup>

## Weiteren Agenten hinzufuegen

Verwenden Sie `openclaw agents add <name>`, um einen separaten Agenten mit eigenem Workspace,
Sitzungen und Auth-Profilen zu erstellen. Die Ausfuehrung ohne `--workspace` startet den Assistenten.

```bash
openclaw agents add work \
  --workspace ~/.openclaw/workspace-work \
  --model openai/gpt-5.2 \
  --bind whatsapp:biz \
  --non-interactive \
  --json
```

Was eingerichtet wird:

- `agents.list[].name`
- `agents.list[].workspace`
- `agents.list[].agentDir`

Hinweise:

- Standard-Workspaces folgen `~/.openclaw/workspace-<agentId>`.
- Fuegen Sie `bindings` hinzu, um eingehende Nachrichten weiterzuleiten (der Assistent kann dies erledigen).
- Nicht-interaktive Flags: `--model`, `--agent-dir`, `--bind`, `--non-interactive`.

## Verwandte Dokumente

- Einfuehrungs-Hub: [Onboarding Wizard (CLI)](/start/wizard)
- Vollstaendige Referenz: [CLI Onboarding Reference](/start/wizard-cli-reference)
- Befehlsreferenz: [`openclaw onboard`](/cli/onboard)
