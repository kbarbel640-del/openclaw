---
summary: "Flujo de incorporacion en la primera ejecucion para OpenClaw (app de macOS)"
read_when:
  - Diseño del asistente de incorporacion de macOS
  - Implementacion de autenticacion o configuracion de identidad
title: "Incorporacion (App de macOS)"
sidebarTitle: "Onboarding: macOS App"
x-i18n:
  source_path: start/onboarding.md
  source_hash: 45f912067527158f
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:00Z
---

# Incorporacion (App de macOS)

Este documento describe el flujo **actual** de incorporacion en la primera ejecucion. El objetivo es una experiencia fluida desde el “dia 0”: elegir donde se ejecuta el Gateway, conectar la autenticacion, ejecutar el asistente y permitir que el agente se inicialice por si mismo.

<Steps>
<Step title="Aprobar advertencia de macOS">
<Frame>
<img src="/assets/macos-onboarding/01-macos-warning.jpeg" alt="" />
</Frame>
</Step>
<Step title="Aprobar busqueda de redes locales">
<Frame>
<img src="/assets/macos-onboarding/02-local-networks.jpeg" alt="" />
</Frame>
</Step>
<Step title="Bienvenida y aviso de seguridad">
<Frame caption="Lea el aviso de seguridad mostrado y decida en consecuencia">
<img src="/assets/macos-onboarding/03-security-notice.png" alt="" />
</Frame>
</Step>
<Step title="Local vs Remoto">
<Frame>
<img src="/assets/macos-onboarding/04-choose-gateway.png" alt="" />
</Frame>

¿Donde se ejecuta el **Gateway**?

- **Esta Mac (solo local):** la incorporacion puede ejecutar flujos OAuth y escribir credenciales
  localmente.
- **Remoto (sobre SSH/Tailnet):** la incorporacion **no** ejecuta OAuth localmente;
  las credenciales deben existir en el host del gateway.
- **Configurar mas tarde:** omitir la configuracion y dejar la app sin configurar.

<Tip>
**Consejo de autenticacion del Gateway:**
- El asistente ahora genera un **token** incluso para loopback, por lo que los clientes WS locales deben autenticarse.
- Si deshabilita la autenticacion, cualquier proceso local puede conectarse; use esto solo en maquinas totalmente confiables.
- Use un **token** para acceso en multiples maquinas o enlaces no loopback.
</Tip>
</Step>
<Step title="Permisos">
<Frame caption="Elija que permisos desea otorgar a OpenClaw">
<img src="/assets/macos-onboarding/05-permissions.png" alt="" />
</Frame>

La incorporacion solicita permisos TCC necesarios para:

- Automatizacion (AppleScript)
- Notificaciones
- Accesibilidad
- Grabacion de pantalla
- Microfono
- Reconocimiento de voz
- Camara
- Ubicacion

</Step>
<Step title="CLI">
  <Info>Este paso es opcional</Info>
  La app puede instalar el CLI global `openclaw` mediante npm/pnpm para que los
  flujos de trabajo de terminal y las tareas de launchd funcionen desde el primer momento.
</Step>
<Step title="Chat de incorporacion (sesion dedicada)">
  Despues de la configuracion, la app abre una sesion de chat de incorporacion dedicada para que el agente pueda
  presentarse y guiar los siguientes pasos. Esto mantiene la orientacion de la primera ejecucion separada
  de su conversacion normal. Consulte [Bootstrapping](/start/bootstrapping) para conocer
  lo que sucede en el host del gateway durante la primera ejecucion del agente.
</Step>
</Steps>
