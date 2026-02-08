---
summary: "Espacio de trabajo del agente: ubicación, diseño y estrategia de respaldo"
read_when:
  - Necesita explicar el espacio de trabajo del agente o su diseño de archivos
  - Quiere respaldar o migrar un espacio de trabajo del agente
title: "Espacio de trabajo del agente"
x-i18n:
  source_path: concepts/agent-workspace.md
  source_hash: 84c550fd89b5f247
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:36Z
---

# Espacio de trabajo del agente

El espacio de trabajo es el hogar del agente. Es el único directorio de trabajo utilizado para
las herramientas de archivos y para el contexto del espacio de trabajo. Manténgalo privado y trátelo como memoria.

Esto es independiente de `~/.openclaw/`, que almacena configuración, credenciales y
sesiones.

**Importante:** el espacio de trabajo es el **cwd predeterminado**, no un sandbox rígido. Las herramientas
resuelven rutas relativas contra el espacio de trabajo, pero las rutas absolutas aún pueden
alcanzar otros lugares del host a menos que el sandboxing esté habilitado. Si necesita aislamiento, use
[`agents.defaults.sandbox`](/gateway/sandboxing) (y/o configuración de sandbox por agente).
Cuando el sandboxing está habilitado y `workspaceAccess` no es `"rw"`, las herramientas operan
dentro de un espacio de trabajo en sandbox bajo `~/.openclaw/sandboxes`, no en su espacio de trabajo del host.

## Ubicación predeterminada

- Predeterminado: `~/.openclaw/workspace`
- Si `OPENCLAW_PROFILE` está establecido y no es `"default"`, el valor predeterminado pasa a ser
  `~/.openclaw/workspace-<profile>`.
- Anule en `~/.openclaw/openclaw.json`:

```json5
{
  agent: {
    workspace: "~/.openclaw/workspace",
  },
}
```

`openclaw onboard`, `openclaw configure` o `openclaw setup` crearán el
espacio de trabajo y sembrarán los archivos de arranque si faltan.

Si ya administra los archivos del espacio de trabajo por su cuenta, puede deshabilitar la creación de archivos de arranque:

```json5
{ agent: { skipBootstrap: true } }
```

## Carpetas adicionales del espacio de trabajo

Las instalaciones antiguas pueden haber creado `~/openclaw`. Mantener múltiples
directorios de espacio de trabajo puede causar confusión de autenticación o deriva de estado, porque solo un
espacio de trabajo está activo a la vez.

**Recomendación:** mantenga un único espacio de trabajo activo. Si ya no usa las
carpetas adicionales, archívelas o muévalas a la Papelera (por ejemplo `trash ~/openclaw`).
Si intencionalmente mantiene múltiples espacios de trabajo, asegúrese de que
`agents.defaults.workspace` apunte al activo.

`openclaw doctor` advierte cuando detecta directorios adicionales del espacio de trabajo.

## Mapa de archivos del espacio de trabajo (qué significa cada archivo)

Estos son los archivos estándar que OpenClaw espera dentro del espacio de trabajo:

- `AGENTS.md`
  - Instrucciones operativas para el agente y cómo debe usar la memoria.
  - Cargado al inicio de cada sesión.
  - Buen lugar para reglas, prioridades y detalles de “cómo comportarse”.

- `SOUL.md`
  - Persona, tono y límites.
  - Cargado en cada sesión.

- `USER.md`
  - Quién es el usuario y cómo dirigirse a él.
  - Cargado en cada sesión.

- `IDENTITY.md`
  - El nombre del agente, su vibra y emoji.
  - Creado/actualizado durante el ritual de arranque.

- `TOOLS.md`
  - Notas sobre sus herramientas locales y convenciones.
  - No controla la disponibilidad de herramientas; es solo orientación.

- `HEARTBEAT.md`
  - Lista de verificación pequeña opcional para ejecuciones de latido.
  - Manténgala corta para evitar el consumo de tokens.

- `BOOT.md`
  - Lista de verificación de inicio opcional ejecutada al reiniciar el Gateway cuando los ganchos internos están habilitados.
  - Manténgala corta; use la herramienta de mensajes para envíos salientes.

- `BOOTSTRAP.md`
  - Ritual único de primera ejecución.
  - Solo se crea para un espacio de trabajo completamente nuevo.
  - Elimínelo después de que el ritual esté completo.

- `memory/YYYY-MM-DD.md`
  - Registro diario de memoria (un archivo por día).
  - Se recomienda leer hoy + ayer al iniciar la sesión.

- `MEMORY.md` (opcional)
  - Memoria curada a largo plazo.
  - Cárguela solo en la sesión principal y privada (no en contextos compartidos/grupales).

Vea [Memory](/concepts/memory) para el flujo de trabajo y el vaciado automático de memoria.

- `skills/` (opcional)
  - Skills específicos del espacio de trabajo.
  - Anulan las skills administradas/paquetizadas cuando los nombres colisionan.

- `canvas/` (opcional)
  - Archivos de UI de Canvas para visualizaciones de nodos (por ejemplo `canvas/index.html`).

Si falta algún archivo de arranque, OpenClaw inyecta un marcador de “archivo faltante” en
la sesión y continúa. Los archivos de arranque grandes se truncan cuando se inyectan;
ajuste el límite con `agents.defaults.bootstrapMaxChars` (predeterminado: 20000).
`openclaw setup` puede recrear los valores predeterminados faltantes sin sobrescribir
archivos existentes.

## Qué NO está en el espacio de trabajo

Estos viven bajo `~/.openclaw/` y NO deben confirmarse en el repositorio del espacio de trabajo:

- `~/.openclaw/openclaw.json` (configuración)
- `~/.openclaw/credentials/` (tokens OAuth, claves API)
- `~/.openclaw/agents/<agentId>/sessions/` (transcripciones de sesiones + metadatos)
- `~/.openclaw/skills/` (skills administradas)

Si necesita migrar sesiones o configuración, cópielas por separado y manténgalas
fuera del control de versiones.

## Respaldo con Git (recomendado, privado)

Trate el espacio de trabajo como memoria privada. Colóquelo en un repositorio git **privado** para que esté
respaldado y sea recuperable.

Ejecute estos pasos en la máquina donde se ejecuta el Gateway (ahí es donde vive el
espacio de trabajo).

### 1) Inicializar el repositorio

Si git está instalado, los espacios de trabajo completamente nuevos se inicializan automáticamente. Si este
espacio de trabajo aún no es un repositorio, ejecute:

```bash
cd ~/.openclaw/workspace
git init
git add AGENTS.md SOUL.md TOOLS.md IDENTITY.md USER.md HEARTBEAT.md memory/
git commit -m "Add agent workspace"
```

### 2) Agregar un remoto privado (opciones amigables para principiantes)

Opción A: UI web de GitHub

1. Cree un nuevo repositorio **privado** en GitHub.
2. No inicialice con un README (evita conflictos de fusión).
3. Copie la URL HTTPS del remoto.
4. Agregue el remoto y haga push:

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

Opción B: GitHub CLI (`gh`)

```bash
gh auth login
gh repo create openclaw-workspace --private --source . --remote origin --push
```

Opción C: UI web de GitLab

1. Cree un nuevo repositorio **privado** en GitLab.
2. No inicialice con un README (evita conflictos de fusión).
3. Copie la URL HTTPS del remoto.
4. Agregue el remoto y haga push:

```bash
git branch -M main
git remote add origin <https-url>
git push -u origin main
```

### 3) Actualizaciones continuas

```bash
git status
git add .
git commit -m "Update memory"
git push
```

## No confirme secretos

Incluso en un repositorio privado, evite almacenar secretos en el espacio de trabajo:

- Claves API, tokens OAuth, contraseñas o credenciales privadas.
- Cualquier cosa bajo `~/.openclaw/`.
- Volcados en bruto de chats o adjuntos sensibles.

Si debe almacenar referencias sensibles, use marcadores de posición y mantenga el secreto real en otro lugar
(gestor de contraseñas, variables de entorno o `~/.openclaw/`).

Sugerencia de inicio para `.gitignore`:

```gitignore
.DS_Store
.env
**/*.key
**/*.pem
**/secrets*
```

## Mover el espacio de trabajo a una nueva máquina

1. Clone el repositorio en la ruta deseada (predeterminado `~/.openclaw/workspace`).
2. Establezca `agents.defaults.workspace` en esa ruta en `~/.openclaw/openclaw.json`.
3. Ejecute `openclaw setup --workspace <path>` para sembrar cualquier archivo faltante.
4. Si necesita sesiones, copie `~/.openclaw/agents/<agentId>/sessions/` desde la
   máquina anterior por separado.

## Notas avanzadas

- El enrutamiento multiagente puede usar diferentes espacios de trabajo por agente. Vea
  [Channel routing](/concepts/channel-routing) para la configuración de enrutamiento.
- Si `agents.defaults.sandbox` está habilitado, las sesiones que no son principales pueden usar espacios de trabajo en sandbox por sesión bajo `agents.defaults.sandbox.workspaceRoot`.
