---
summary: "Logs do OpenClaw: arquivo de diagnostico rotativo + flags de privacidade do unified log"
read_when:
  - Capturando logs do macOS ou investigando registro de dados privados
  - Depurando problemas do ciclo de vida de ativacao de voz/sessao
title: "Logs no macOS"
x-i18n:
  source_path: platforms/mac/logging.md
  source_hash: c4c201d154915e0e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:56:54Z
---

# Logging (macOS)

## Arquivo de diagnostico rotativo (Painel de Debug)

O OpenClaw encaminha os logs do app no macOS por meio do swift-log (unified logging por padrao) e pode gravar um arquivo de log local e rotativo em disco quando voce precisa de uma captura duravel.

- Verbosidade: **Painel de Debug → Logs → App logging → Verbosity**
- Ativar: **Painel de Debug → Logs → App logging → “Write rolling diagnostics log (JSONL)”**
- Localizacao: `~/Library/Logs/OpenClaw/diagnostics.jsonl` (rotaciona automaticamente; arquivos antigos recebem o sufixo `.1`, `.2`, …)
- Limpar: **Painel de Debug → Logs → App logging → “Clear”**

Notas:

- Isso vem **desativado por padrao**. Ative apenas enquanto estiver depurando ativamente.
- Trate o arquivo como sensivel; nao o compartilhe sem revisao.

## Dados privados do unified logging no macOS

O unified logging mascara a maioria das cargas uteis, a menos que um subsistema opte por `privacy -off`. Conforme o texto do Peter sobre as [logging privacy shenanigans](https://steipete.me/posts/2025/logging-privacy-shenanigans) no macOS (2025), isso e controlado por um plist em `/Library/Preferences/Logging/Subsystems/`, indexado pelo nome do subsistema. Apenas novas entradas de log capturam a flag; portanto, ative antes de reproduzir um problema.

## Ativar para o OpenClaw (`bot.molt`)

- Escreva o plist primeiro em um arquivo temporario e, em seguida, instale-o atomicamente como root:

```bash
cat <<'EOF' >/tmp/bot.molt.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>DEFAULT-OPTIONS</key>
    <dict>
        <key>Enable-Private-Data</key>
        <true/>
    </dict>
</dict>
</plist>
EOF
sudo install -m 644 -o root -g wheel /tmp/bot.molt.plist /Library/Preferences/Logging/Subsystems/bot.molt.plist
```

- Nao e necessario reiniciar; o logd percebe o arquivo rapidamente, mas apenas novas linhas de log incluirao cargas uteis privadas.
- Visualize a saida mais rica com o helper existente, por exemplo, `./scripts/clawlog.sh --category WebChat --last 5m`.

## Desativar apos a depuracao

- Remova a sobrescrita: `sudo rm /Library/Preferences/Logging/Subsystems/bot.molt.plist`.
- Opcionalmente execute `sudo log config --reload` para forcar o logd a remover a sobrescrita imediatamente.
- Lembre-se de que essa superficie pode incluir numeros de telefone e corpos de mensagens; mantenha o plist no lugar apenas enquanto voce precisar ativamente do detalhe extra.
