---
summary: "Solucione problemas de inicio de CDP de Chrome/Brave/Edge/Chromium para el control del navegador de OpenClaw en Linux"
read_when: "El control del navegador falla en Linux, especialmente con Chromium instalado mediante snap"
title: "Solucion de problemas del navegador"
x-i18n:
  source_path: tools/browser-linux-troubleshooting.md
  source_hash: bac2301022511a0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:07Z
---

# Solucion de problemas del navegador (Linux)

## Problema: "Failed to start Chrome CDP on port 18800"

El servidor de control del navegador de OpenClaw no logra iniciar Chrome/Brave/Edge/Chromium y muestra el error:

```
{"error":"Error: Failed to start Chrome CDP on port 18800 for profile \"openclaw\"."}
```

### Causa raiz

En Ubuntu (y muchas distribuciones de Linux), la instalacion predeterminada de Chromium es un **paquete snap**. El confinamiento de AppArmor de snap interfiere con la forma en que OpenClaw crea y supervisa el proceso del navegador.

El comando `apt install chromium` instala un paquete stub que redirige a snap:

```
Note, selecting 'chromium-browser' instead of 'chromium'
chromium-browser is already the newest version (2:1snap1-0ubuntu2).
```

Esto NO es un navegador real; es solo un contenedor.

### Solucion 1: Instalar Google Chrome (Recomendado)

Instale el paquete oficial de Google Chrome `.deb`, que no esta en sandbox por snap:

```bash
wget https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo dpkg -i google-chrome-stable_current_amd64.deb
sudo apt --fix-broken install -y  # if there are dependency errors
```

Luego actualice su configuracion de OpenClaw (`~/.openclaw/openclaw.json`):

```json
{
  "browser": {
    "enabled": true,
    "executablePath": "/usr/bin/google-chrome-stable",
    "headless": true,
    "noSandbox": true
  }
}
```

### Solucion 2: Usar Chromium snap con modo de solo adjuncion

Si debe usar Chromium snap, configure OpenClaw para adjuntarse a un navegador iniciado manualmente:

1. Actualice la configuracion:

```json
{
  "browser": {
    "enabled": true,
    "attachOnly": true,
    "headless": true,
    "noSandbox": true
  }
}
```

2. Inicie Chromium manualmente:

```bash
chromium-browser --headless --no-sandbox --disable-gpu \
  --remote-debugging-port=18800 \
  --user-data-dir=$HOME/.openclaw/browser/openclaw/user-data \
  about:blank &
```

3. Opcionalmente cree un servicio de usuario systemd para iniciar Chrome automaticamente:

```ini
# ~/.config/systemd/user/openclaw-browser.service
[Unit]
Description=OpenClaw Browser (Chrome CDP)
After=network.target

[Service]
ExecStart=/snap/bin/chromium --headless --no-sandbox --disable-gpu --remote-debugging-port=18800 --user-data-dir=%h/.openclaw/browser/openclaw/user-data about:blank
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
```

Habilite con: `systemctl --user enable --now openclaw-browser.service`

### Verificar que el navegador funciona

Verifique el estado:

```bash
curl -s http://127.0.0.1:18791/ | jq '{running, pid, chosenBrowser}'
```

Pruebe la navegacion:

```bash
curl -s -X POST http://127.0.0.1:18791/start
curl -s http://127.0.0.1:18791/tabs
```

### Referencia de configuracion

| Opcion                   | Descripcion                                                                         | Predeterminado                                                                     |
| ------------------------ | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `browser.enabled`        | Habilitar el control del navegador                                                  | `true`                                                                             |
| `browser.executablePath` | Ruta al binario de un navegador basado en Chromium (Chrome/Brave/Edge/Chromium)     | auto-detectado (prefiere el navegador predeterminado cuando es basado en Chromium) |
| `browser.headless`       | Ejecutar sin interfaz grafica                                                       | `false`                                                                            |
| `browser.noSandbox`      | Agregar la bandera `--no-sandbox` (necesaria para algunas configuraciones de Linux) | `false`                                                                            |
| `browser.attachOnly`     | No iniciar el navegador; solo adjuntarse a uno existente                            | `false`                                                                            |
| `browser.cdpPort`        | Puerto del Protocolo Chrome DevTools                                                | `18800`                                                                            |

### Problema: "Chrome extension relay is running, but no tab is connected"

Esta usando el perfil `chrome` (rele de extension). Este espera que la extension del navegador de OpenClaw este adjunta a una pestaña activa.

Opciones para solucionarlo:

1. **Use el navegador administrado:** `openclaw browser start --browser-profile openclaw`
   (o establezca `browser.defaultProfile: "openclaw"`).
2. **Use el rele de extension:** instale la extension, abra una pestaña y haga clic en el icono de la extension de OpenClaw para adjuntarla.

Notas:

- El perfil `chrome` usa el **navegador Chromium predeterminado del sistema** cuando es posible.
- Los perfiles locales `openclaw` asignan automaticamente `cdpPort`/`cdpUrl`; configure esos solo para CDP remoto.
