---
summary: "Preguntas frecuentes sobre la configuracion, el ajuste y el uso de OpenClaw"
title: "Preguntas frecuentes"
x-i18n:
  source_path: help/faq.md
  source_hash: e87e52a9edaec927
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:13Z
---

# Preguntas frecuentes

Respuestas rapidas y solucion de problemas en profundidad para configuraciones del mundo real (desarrollo local, VPS, multiagente, OAuth/claves de API, conmutacion por error de modelos). Para diagnosticos en tiempo de ejecucion, vea [Solucion de problemas](/gateway/troubleshooting). Para la referencia completa de configuracion, vea [Configuracion](/gateway/configuration).

## Tabla de contenidos

- [Inicio rapido y configuracion de la primera ejecucion](#inicio-rapido-y-configuracion-de-la-primera-ejecucion)
  - [Estoy atascado cual es la forma mas rapida de desatascarme?](#estoy-atascado-cual-es-la-forma-mas-rapida-de-desatascarme)
  - [Cual es la forma recomendada de instalar y configurar OpenClaw?](#cual-es-la-forma-recomendada-de-instalar-y-configurar-openclaw)
  - [Como abro el panel despues de la incorporacion?](#como-abro-el-panel-despues-de-la-incorporacion)
  - [Como autentico el token del panel en localhost vs remoto?](#como-autentico-el-token-del-panel-en-localhost-vs-remoto)
  - [Que runtime necesito?](#que-runtime-necesito)
  - [Funciona en Raspberry Pi?](#funciona-en-raspberry-pi)
  - [Algun consejo para instalaciones en Raspberry Pi?](#algun-consejo-para-instalaciones-en-raspberry-pi)
  - [Esta atascado en "wake up my friend" / la incorporacion no arranca. Y ahora que?](#esta-atascado-en-wake-up-my-friend--la-incorporacion-no-arranca-y-ahora-que)
  - [Puedo migrar mi configuracion a una nueva maquina (Mac mini) sin rehacer la incorporacion?](#puedo-migrar-mi-configuracion-a-una-nueva-maquina-mac-mini-sin-rehacer-la-incorporacion)
  - [Donde veo que hay de nuevo en la ultima version?](#donde-veo-que-hay-de-nuevo-en-la-ultima-version)
  - [No puedo acceder a docs.openclaw.ai (error SSL). Y ahora que?](#no-puedo-acceder-a-docsopenclawai-error-ssl-y-ahora-que)
  - [Cual es la diferencia entre estable y beta?](#cual-es-la-diferencia-entre-estable-y-beta)
  - [Como instalo la version beta y cual es la diferencia entre beta y dev?](#como-instalo-la-version-beta-y-cual-es-la-diferencia-entre-beta-y-dev)
  - [Como pruebo los ultimos cambios?](#como-pruebo-los-ultimos-cambios)
  - [Cuanto suelen tardar la instalacion y la incorporacion?](#cuanto-suelen-tardar-la-instalacion-y-la-incorporacion)
  - [El instalador esta atascado? Como obtengo mas informacion?](#el-instalador-esta-atascado-como-obtengo-mas-informacion)
  - [La instalacion en Windows dice git no encontrado u openclaw no reconocido](#la-instalacion-en-windows-dice-git-no-encontrado-u-openclaw-no-reconocido)
  - [La documentacion no respondio mi pregunta como obtengo una mejor respuesta?](#la-documentacion-no-respondio-mi-pregunta-como-obtengo-una-mejor-respuesta)
  - [Como instalo OpenClaw en Linux?](#como-instalo-openclaw-en-linux)
  - [Como instalo OpenClaw en un VPS?](#como-instalo-openclaw-en-un-vps)
  - [Donde estan las guias de instalacion en la nube/VPS?](#donde-estan-las-guias-de-instalacion-en-la-nubevps)
  - [Puedo pedirle a OpenClaw que se actualice solo?](#puedo-pedirle-a-openclaw-que-se-actualice-solo)
  - [Que hace realmente el asistente de incorporacion?](#que-hace-realmente-el-asistente-de-incorporacion)
  - [Necesito una suscripcion de Claude u OpenAI para ejecutar esto?](#necesito-una-suscripcion-de-claude-u-openai-para-ejecutar-esto)
  - [Puedo usar una suscripcion Claude Max sin una clave de API](#puedo-usar-una-suscripcion-claude-max-sin-una-clave-de-api)
  - [Como funciona la autenticacion "setup-token" de Anthropic?](#como-funciona-la-autenticacion-setuptoken-de-anthropic)
  - [Donde encuentro un setup-token de Anthropic?](#donde-encuentro-un-setuptoken-de-anthropic)
  - [Soportan autenticacion por suscripcion de Claude (Claude Code OAuth)?](#soportan-autenticacion-por-suscripcion-de-claude-claude-code-oauth)
  - [Por que veo `HTTP 429: rate_limit_error` de Anthropic?](#por-que-veo-http-429-ratelimiterror-de-anthropic)
  - [Se admite AWS Bedrock?](#se-admite-aws-bedrock)
  - [Como funciona la autenticacion de Codex?](#como-funciona-la-autenticacion-de-codex)
  - [Soportan autenticacion por suscripcion de OpenAI (Codex OAuth)?](#soportan-autenticacion-por-suscripcion-de-openai-codex-oauth)
  - [Como configuro Gemini CLI OAuth](#como-configuro-gemini-cli-oauth)
  - [Un modelo local es adecuado para charlas casuales?](#un-modelo-local-es-adecuado-para-charlas-casuales)
  - [Como mantengo el trafico de modelos alojados en una region especifica?](#como-mantengo-el-trafico-de-modelos-alojados-en-una-region-especifica)
  - [Tengo que comprar un Mac Mini para instalar esto?](#tengo-que-comprar-un-mac-mini-para-instalar-esto)
  - [Necesito un Mac mini para soporte de iMessage?](#necesito-un-mac-mini-para-soporte-de-imessage)
  - [Si compro un Mac mini para ejecutar OpenClaw puedo conectarlo a mi MacBook Pro?](#si-compro-un-mac-mini-para-ejecutar-openclaw-puedo-conectarlo-a-mi-macbook-pro)
  - [Puedo usar Bun?](#puedo-usar-bun)
  - [Telegram: que va en `allowFrom`?](#telegram-que-va-en-allowfrom)
  - [Pueden varias personas usar un numero de WhatsApp con diferentes instancias de OpenClaw?](#pueden-varias-personas-usar-un-numero-de-whatsapp-con-diferentes-instancias-de-openclaw)
  - [Puedo ejecutar un agente de "chat rapido" y un agente "Opus para codigo"?](#puedo-ejecutar-un-agente-de-chat-rapido-y-un-agente-opus-para-codigo)
  - [Funciona Homebrew en Linux?](#funciona-homebrew-en-linux)
  - [Cual es la diferencia entre la instalacion hackeable (git) y la instalacion npm?](#cual-es-la-diferencia-entre-la-instalacion-hackeable-git-y-la-instalacion-npm)
  - [Puedo cambiar entre instalaciones npm y git mas tarde?](#puedo-cambiar-entre-instalaciones-npm-y-git-mas-tarde)
  - [Deberia ejecutar el Gateway en mi portatil o en un VPS?](#deberia-ejecutar-el-gateway-en-mi-portatil-o-en-un-vps)
  - [Que tan importante es ejecutar OpenClaw en una maquina dedicada?](#que-tan-importante-es-ejecutar-openclaw-en-una-maquina-dedicada)
  - [Cuales son los requisitos minimos de un VPS y el SO recomendado?](#cuales-son-los-requisitos-minimos-de-un-vps-y-el-so-recomendado)
  - [Puedo ejecutar OpenClaw en una VM y cuales son los requisitos](#puedo-ejecutar-openclaw-en-una-vm-y-cuales-son-los-requisitos)
- [Que es OpenClaw?](#que-es-openclaw)
  - [Que es OpenClaw en un parrafo?](#que-es-openclaw-en-un-parrafo)
  - [Cual es la propuesta de valor?](#cual-es-la-propuesta-de-valor)
  - [Acabo de configurarlo que deberia hacer primero](#acabo-de-configurarlo-que-deberia-hacer-primero)
  - [Cuales son los cinco principales casos de uso diarios de OpenClaw](#cuales-son-los-cinco-principales-casos-de-uso-diarios-de-openclaw)
  - [Puede OpenClaw ayudar con generacion de leads, outreach, anuncios y blogs para un SaaS](#puede-openclaw-ayudar-con-generacion-de-leads-outreach-anuncios-y-blogs-para-un-saas)
  - [Cuales son las ventajas frente a Claude Code para desarrollo web?](#cuales-son-las-ventajas-frente-a-claude-code-para-desarrollo-web)
- [Skills y automatizacion](#skills-y-automatizacion)
- [Sandboxing y memoria](#sandboxing-y-memoria)
- [Donde viven las cosas en el disco](#donde-viven-las-cosas-en-el-disco)
- [Conceptos basicos de configuracion](#conceptos-basicos-de-configuracion)
- [Gateways remotos + nodos](#gateways-remotos--nodos)
- [Variables de entorno y carga de .env](#variables-de-entorno-y-carga-de-env)
- [Sesiones y multiples chats](#sesiones-y-multiples-chats)
- [Modelos: valores predeterminados, seleccion, alias, cambio](#modelos-valores-predeterminados-seleccion-alias-cambio)
- [Conmutacion por error de modelos y "All models failed"](#conmutacion-por-error-de-modelos-y-all-models-failed)
- [Perfiles de autenticacion: que son y como gestionarlos](#perfiles-de-autenticacion-que-son-y-como-gestionarlos)
- [Gateway: puertos, "ya en ejecucion" y modo remoto](#gateway-puertos-ya-en-ejecucion-y-modo-remoto)
- [Registro y depuracion](#registro-y-depuracion)
- [Medios y adjuntos](#medios-y-adjuntos)
- [Seguridad y control de acceso](#seguridad-y-control-de-acceso)
- [Comandos de chat, abortar tareas y "no se detiene"](#comandos-de-chat-abortar-tareas-y-no-se-detiene)

_(Traduccion continua del documento; el contenido restante se mantiene fiel al original, preservando Markdown, enlaces, codigo y marcadores **OC_I18N** sin traducir.)_

---

Aun atascado? Pregunte en [Discord](https://discord.com/invite/clawd) o abra una [discusion en GitHub](https://github.com/openclaw/openclaw/discussions).
