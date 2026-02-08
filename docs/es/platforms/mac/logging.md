---
summary: "Registro de OpenClaw: archivo de diagnosticos rotativo + indicadores de privacidad del registro unificado"
read_when:
  - Captura de registros de macOS o investigacion de registro de datos privados
  - Depuracion de problemas del ciclo de vida de activacion por voz/sesion
title: "Registro en macOS"
x-i18n:
  source_path: platforms/mac/logging.md
  source_hash: c4c201d154915e0e
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:30Z
---

# Registro (macOS)

## Archivo de diagnosticos rotativo (panel de Depuracion)

OpenClaw enruta los registros de la app de macOS a traves de swift-log (registro unificado de forma predeterminada) y puede escribir un archivo de registro local y rotativo en disco cuando necesite una captura duradera.

- Verborrea: **Panel de Depuracion → Registros → Registro de la app → Verborrea**
- Habilitar: **Panel de Depuracion → Registros → Registro de la app → “Escribir registro de diagnosticos rotativo (JSONL)”**
- Ubicacion: `~/Library/Logs/OpenClaw/diagnostics.jsonl` (rota automaticamente; los archivos antiguos se sufijan con `.1`, `.2`, …)
- Borrar: **Panel de Depuracion → Registros → Registro de la app → “Borrar”**

Notas:

- Esto esta **desactivado de forma predeterminada**. Habilitelo solo mientras este depurando activamente.
- Trate el archivo como sensible; no lo comparta sin revision.

## Datos privados del registro unificado en macOS

El registro unificado oculta la mayoria de las cargas utiles a menos que un subsistema opte por `privacy -off`. Segun el articulo de Peter sobre las [travesuras de privacidad del registro en macOS](https://steipete.me/posts/2025/logging-privacy-shenanigans) (2025), esto se controla mediante un plist en `/Library/Preferences/Logging/Subsystems/` con clave por nombre del subsistema. Solo las nuevas entradas de registro adoptan el indicador, asi que habilitelo antes de reproducir un problema.

## Habilitar para OpenClaw (`bot.molt`)

- Escriba primero el plist en un archivo temporal y luego instálelo de forma atomica como root:

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

- No se requiere reinicio; logd detecta el archivo rapidamente, pero solo las nuevas lineas de registro incluiran cargas utiles privadas.
- Vea la salida mas completa con el ayudante existente, por ejemplo `./scripts/clawlog.sh --category WebChat --last 5m`.

## Deshabilitar despues de depurar

- Elimine la anulacion: `sudo rm /Library/Preferences/Logging/Subsystems/bot.molt.plist`.
- De forma opcional, ejecute `sudo log config --reload` para forzar a logd a eliminar la anulacion de inmediato.
- Recuerde que esta superficie puede incluir numeros de telefono y cuerpos de mensajes; mantenga el plist en su lugar solo mientras necesite activamente el detalle adicional.
