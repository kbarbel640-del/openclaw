---
summary: "Instale OpenClaw y ejecute su primer chat en minutos."
read_when:
  - Configuracion inicial por primera vez desde cero
  - Quiere la ruta mas rapida hacia un chat funcional
title: "Primeros Pasos"
x-i18n:
  source_path: start/getting-started.md
  source_hash: 27aeeb3d18c49538
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:59Z
---

# Primeros Pasos

Objetivo: pasar de cero a un primer chat funcional con una configuracion minima.

<Info>
Chat mas rapido: abra la UI de Control (no se requiere configuracion de canal). Ejecute `openclaw dashboard`
y chatee en el navegador, o abra `http://127.0.0.1:18789/` en el
<Tooltip headline="Gateway host" tip="La maquina que ejecuta el servicio Gateway de OpenClaw.">host del Gateway</Tooltip>.
Docs: [Dashboard](/web/dashboard) y [UI de Control](/web/control-ui).
</Info>

## Requisitos previos

- Node 22 o mas reciente

<Tip>
Verifique su version de Node con `node --version` si no esta seguro.
</Tip>

## Inicio rapido (CLI)

<Steps>
  <Step title="Instalar OpenClaw (recomendado)">
    <Tabs>
      <Tab title="macOS/Linux">
        ```bash
        curl -fsSL https://openclaw.ai/install.sh | bash
        ```
      </Tab>
      <Tab title="Windows (PowerShell)">
        ```powershell
        iwr -useb https://openclaw.ai/install.ps1 | iex
        ```
      </Tab>
    </Tabs>

    <Note>
    Otros metodos de instalacion y requisitos: [Instalacion](/install).
    </Note>

  </Step>
  <Step title="Ejecutar el asistente de incorporacion">
    ```bash
    openclaw onboard --install-daemon
    ```

    El asistente configura la autenticacion, la configuracion del Gateway y canales opcionales.
    Consulte [Asistente de Incorporacion](/start/wizard) para mas detalles.

  </Step>
  <Step title="Verificar el Gateway">
    Si instalo el servicio, ya deberia estar en ejecucion:

    ```bash
    openclaw gateway status
    ```

  </Step>
  <Step title="Abrir la UI de Control">
    ```bash
    openclaw dashboard
    ```
  </Step>
</Steps>

<Check>
Si la UI de Control carga, su Gateway esta listo para usarse.
</Check>

## Comprobaciones opcionales y extras

<AccordionGroup>
  <Accordion title="Ejecutar el Gateway en primer plano">
    Util para pruebas rapidas o solucion de problemas.

    ```bash
    openclaw gateway --port 18789
    ```

  </Accordion>
  <Accordion title="Enviar un mensaje de prueba">
    Requiere un canal configurado.

    ```bash
    openclaw message send --target +15555550123 --message "Hello from OpenClaw"
    ```

  </Accordion>
</AccordionGroup>

## Profundice

<Columns>
  <Card title="Asistente de Incorporacion (detalles)" href="/start/wizard">
    Referencia completa del asistente CLI y opciones avanzadas.
  </Card>
  <Card title="Incorporacion de la app macOS" href="/start/onboarding">
    Flujo de primera ejecucion para la app de macOS.
  </Card>
</Columns>

## Lo que tendra

- Un Gateway en ejecucion
- Autenticacion configurada
- Acceso a la UI de Control o un canal conectado

## Siguientes pasos

- Seguridad y aprobaciones de Mensajes directos: [Emparejamiento](/start/pairing)
- Conectar mas canales: [Canales](/channels)
- Flujos avanzados y desde el codigo fuente: [Configuracion](/start/setup)
