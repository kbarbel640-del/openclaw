---
summary: "Skills: administradas vs espacio de trabajo, reglas de compuerta y cableado de config/env"
read_when:
  - Agregar o modificar skills
  - Cambiar la compuerta de skills o las reglas de carga
title: "Skills"
x-i18n:
  source_path: tools/skills.md
  source_hash: 54685da5885600b3
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T07:00:36Z
---

# Skills (OpenClaw)

OpenClaw usa carpetas de skills **compatibles con [AgentSkills](https://agentskills.io)** para enseñar al agente a usar herramientas. Cada skill es un directorio que contiene un `SKILL.md` con frontmatter YAML e instrucciones. OpenClaw carga **skills incluidas** más anulaciones locales opcionales, y las filtra en tiempo de carga según el entorno, la configuracion y la presencia de binarios.

## Ubicaciones y precedencia

Las skills se cargan desde **tres** lugares:

1. **Skills incluidas**: enviadas con la instalación (paquete npm u OpenClaw.app)
2. **Skills administradas/locales**: `~/.openclaw/skills`
3. **Skills del espacio de trabajo**: `<workspace>/skills`

Si un nombre de skill entra en conflicto, la precedencia es:

`<workspace>/skills` (más alta) → `~/.openclaw/skills` → skills incluidas (más baja)

Además, puede configurar carpetas de skills adicionales (precedencia más baja) mediante
`skills.load.extraDirs` en `~/.openclaw/openclaw.json`.

## Skills por agente vs compartidas

En configuraciones **multiagente**, cada agente tiene su propio espacio de trabajo. Eso significa:

- Las **skills por agente** viven en `<workspace>/skills` solo para ese agente.
- Las **skills compartidas** viven en `~/.openclaw/skills` (administradas/locales) y son visibles
  para **todos los agentes** en la misma máquina.
- También se pueden agregar **carpetas compartidas** mediante `skills.load.extraDirs` (precedencia más baja)
  si desea un paquete común de skills usado por múltiples agentes.

Si el mismo nombre de skill existe en más de un lugar, aplica la precedencia habitual:
gana el espacio de trabajo, luego administradas/locales y luego incluidas.

## Plugins + skills

Los plugins pueden incluir sus propias skills enumerando directorios `skills` en
`openclaw.plugin.json` (rutas relativas a la raíz del plugin). Las skills del plugin se cargan
cuando el plugin está habilitado y participan en las reglas normales de precedencia.
Puede ponerles compuerta mediante `metadata.openclaw.requires.config` en la entrada de configuración del plugin.
Vea [Plugins](/plugin) para descubrimiento/configuración y [Tools](/tools) para la
superficie de herramientas que enseñan esas skills.

## ClawHub (instalación + sincronización)

ClawHub es el registro público de skills para OpenClaw. Explore en
https://clawhub.com. Úselo para descubrir, instalar, actualizar y respaldar skills.
Guía completa: [ClawHub](/tools/clawhub).

Flujos comunes:

- Instalar una skill en su espacio de trabajo:
  - `clawhub install <skill-slug>`
- Actualizar todas las skills instaladas:
  - `clawhub update --all`
- Sincronizar (escaneo + publicación de actualizaciones):
  - `clawhub sync --all`

De forma predeterminada, `clawhub` instala en `./skills` bajo su directorio de trabajo
actual (o vuelve al espacio de trabajo de OpenClaw configurado). OpenClaw lo recoge
como `<workspace>/skills` en la siguiente sesión.

## Notas de seguridad

- Trate las skills de terceros como **código no confiable**. Léalas antes de habilitarlas.
- Prefiera ejecuciones en sandbox para entradas no confiables y herramientas riesgosas. Vea [Sandboxing](/gateway/sandboxing).
- `skills.entries.*.env` y `skills.entries.*.apiKey` inyectan secretos en el proceso **host**
  para ese turno del agente (no en el sandbox). Mantenga los secretos fuera de prompts y registros.
- Para un modelo de amenazas más amplio y listas de verificación, vea [Security](/gateway/security).

## Formato (AgentSkills + compatible con Pi)

`SKILL.md` debe incluir al menos:

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
---
```

Notas:

- Seguimos la especificación de AgentSkills para el diseño/intención.
- El analizador usado por el agente integrado admite solo claves de frontmatter **de una sola línea**.
- `metadata` debe ser un **objeto JSON de una sola línea**.
- Use `{baseDir}` en las instrucciones para referenciar la ruta de la carpeta de la skill.
- Claves de frontmatter opcionales:
  - `homepage` — URL mostrada como “Website” en la UI de Skills de macOS (también compatible vía `metadata.openclaw.homepage`).
  - `user-invocable` — `true|false` (predeterminado: `true`). Cuando `true`, la skill se expone como un comando de barra del usuario.
  - `disable-model-invocation` — `true|false` (predeterminado: `false`). Cuando `true`, la skill se excluye del prompt del modelo (sigue disponible vía invocación del usuario).
  - `command-dispatch` — `tool` (opcional). Cuando se establece en `tool`, el comando de barra omite el modelo y despacha directamente a una herramienta.
  - `command-tool` — nombre de la herramienta a invocar cuando `command-dispatch: tool` está establecido.
  - `command-arg-mode` — `raw` (predeterminado). Para el despacho de herramientas, reenvía la cadena de argumentos sin procesar a la herramienta (sin análisis del núcleo).

    La herramienta se invoca con parámetros:
    `{ command: "<raw args>", commandName: "<slash command>", skillName: "<skill name>" }`.

## Compuerta (filtros en tiempo de carga)

OpenClaw **filtra las skills en tiempo de carga** usando `metadata` (JSON de una sola línea):

```markdown
---
name: nano-banana-pro
description: Generate or edit images via Gemini 3 Pro Image
metadata:
  {
    "openclaw":
      {
        "requires": { "bins": ["uv"], "env": ["GEMINI_API_KEY"], "config": ["browser.enabled"] },
        "primaryEnv": "GEMINI_API_KEY",
      },
  }
---
```

Campos bajo `metadata.openclaw`:

- `always: true` — incluir siempre la skill (omitir otras compuertas).
- `emoji` — emoji opcional usado por la UI de Skills de macOS.
- `homepage` — URL opcional mostrada como “Website” en la UI de Skills de macOS.
- `os` — lista opcional de plataformas (`darwin`, `linux`, `win32`). Si se establece, la skill solo es elegible en esos sistemas operativos.
- `requires.bins` — lista; cada uno debe existir en `PATH`.
- `requires.anyBins` — lista; al menos uno debe existir en `PATH`.
- `requires.env` — lista; la variable de entorno debe existir **o** proporcionarse en la configuración.
- `requires.config` — lista de rutas `openclaw.json` que deben ser verdaderas.
- `primaryEnv` — nombre de variable de entorno asociada con `skills.entries.<name>.apiKey`.
- `install` — arreglo opcional de especificaciones de instalador usadas por la UI de Skills de macOS (brew/node/go/uv/download).

Nota sobre sandboxing:

- `requires.bins` se verifica en el **host** en el momento de carga de la skill.
- Si un agente está en sandbox, el binario también debe existir **dentro del contenedor**.
  Instálelo mediante `agents.defaults.sandbox.docker.setupCommand` (o una imagen personalizada).
  `setupCommand` se ejecuta una vez después de que se crea el contenedor.
  Las instalaciones de paquetes también requieren salida de red, un FS raíz escribible y un usuario root en el sandbox.
  Ejemplo: la skill `summarize` (`skills/summarize/SKILL.md`) necesita el CLI `summarize`
  en el contenedor del sandbox para ejecutarse allí.

Ejemplo de instalador:

```markdown
---
name: gemini
description: Use Gemini CLI for coding assistance and Google search lookups.
metadata:
  {
    "openclaw":
      {
        "emoji": "♊️",
        "requires": { "bins": ["gemini"] },
        "install":
          [
            {
              "id": "brew",
              "kind": "brew",
              "formula": "gemini-cli",
              "bins": ["gemini"],
              "label": "Install Gemini CLI (brew)",
            },
          ],
      },
  }
---
```

Notas:

- Si se enumeran múltiples instaladores, el gateway elige una **única** opción preferida (brew cuando está disponible; de lo contrario, node).
- Si todos los instaladores son `download`, OpenClaw enumera cada entrada para que pueda ver los artefactos disponibles.
- Las especificaciones de instalador pueden incluir `os: ["darwin"|"linux"|"win32"]` para filtrar opciones por plataforma.
- Las instalaciones de Node respetan `skills.install.nodeManager` en `openclaw.json` (predeterminado: npm; opciones: npm/pnpm/yarn/bun).
  Esto solo afecta a las **instalaciones de skills**; el runtime del Gateway debe seguir siendo Node
  (Bun no se recomienda para WhatsApp/Telegram).
- Instalaciones de Go: si `go` falta y `brew` está disponible, el gateway instala Go mediante Homebrew primero y establece `GOBIN` en el `bin` de Homebrew cuando es posible.
- Instalaciones por descarga: `url` (requerido), `archive` (`tar.gz` | `tar.bz2` | `zip`), `extract` (predeterminado: auto cuando se detecta un archivo), `stripComponents`, `targetDir` (predeterminado: `~/.openclaw/tools/<skillKey>`).

Si no hay `metadata.openclaw`, la skill siempre es elegible (a menos que
esté deshabilitada en la configuración o bloqueada por `skills.allowBundled` para skills incluidas).

## Anulaciones de configuración (`~/.openclaw/openclaw.json`)

Las skills incluidas/administradas se pueden alternar y recibir valores de entorno:

```json5
{
  skills: {
    entries: {
      "nano-banana-pro": {
        enabled: true,
        apiKey: "GEMINI_KEY_HERE",
        env: {
          GEMINI_API_KEY: "GEMINI_KEY_HERE",
        },
        config: {
          endpoint: "https://example.invalid",
          model: "nano-pro",
        },
      },
      peekaboo: { enabled: true },
      sag: { enabled: false },
    },
  },
}
```

Nota: si el nombre de la skill contiene guiones, ponga la clave entre comillas (JSON5 permite claves entre comillas).

Las claves de configuración coinciden con el **nombre de la skill** de forma predeterminada. Si una skill define
`metadata.openclaw.skillKey`, use esa clave bajo `skills.entries`.

Reglas:

- `enabled: false` deshabilita la skill incluso si está incluida/instalada.
- `env`: se inyecta **solo si** la variable no está ya establecida en el proceso.
- `apiKey`: conveniencia para skills que declaran `metadata.openclaw.primaryEnv`.
- `config`: bolsa opcional para campos personalizados por skill; las claves personalizadas deben vivir aquí.
- `allowBundled`: lista blanca opcional solo para skills **incluidas**. Si se establece, solo
  las skills incluidas en la lista son elegibles (las administradas/del espacio de trabajo no se ven afectadas).

## Inyección de entorno (por ejecución del agente)

Cuando comienza una ejecución del agente, OpenClaw:

1. Lee los metadatos de la skill.
2. Aplica cualquier `skills.entries.<key>.env` o `skills.entries.<key>.apiKey` a
   `process.env`.
3. Construye el prompt del sistema con skills **elegibles**.
4. Restaura el entorno original después de que termina la ejecución.

Esto está **acotado a la ejecución del agente**, no a un entorno de shell global.

## Instantánea de sesión (rendimiento)

OpenClaw toma una instantánea de las skills elegibles **cuando comienza una sesión** y reutiliza esa lista para los turnos posteriores en la misma sesión. Los cambios en skills o configuración surten efecto en la siguiente sesión nueva.

Las skills también pueden actualizarse a mitad de sesión cuando el observador de skills está habilitado o cuando aparece un nuevo nodo remoto elegible (ver abajo). Piense en esto como una **recarga en caliente**: la lista actualizada se recoge en el siguiente turno del agente.

## Nodos macOS remotos (Gateway en Linux)

Si el Gateway se ejecuta en Linux pero hay un **nodo macOS** conectado **con `system.run` permitido** (las aprobaciones de Exec de seguridad no están establecidas en `deny`), OpenClaw puede tratar las skills solo de macOS como elegibles cuando los binarios requeridos están presentes en ese nodo. El agente debería ejecutar esas skills mediante la herramienta `nodes` (típicamente `nodes.run`).

Esto depende de que el nodo informe su soporte de comandos y de una sonda de binarios vía `system.run`. Si el nodo macOS se desconecta más tarde, las skills permanecen visibles; las invocaciones pueden fallar hasta que el nodo se reconecte.

## Observador de skills (actualización automática)

De forma predeterminada, OpenClaw observa las carpetas de skills y incrementa la instantánea de skills cuando cambian los archivos `SKILL.md`. Configure esto en `skills.load`:

```json5
{
  skills: {
    load: {
      watch: true,
      watchDebounceMs: 250,
    },
  },
}
```

## Impacto en tokens (lista de skills)

Cuando las skills son elegibles, OpenClaw inyecta una lista XML compacta de skills disponibles en el prompt del sistema (vía `formatSkillsForPrompt` en `pi-coding-agent`). El costo es determinístico:

- **Sobrecarga base (solo cuando ≥1 skill):** 195 caracteres.
- **Por skill:** 97 caracteres + la longitud de los valores `<name>`, `<description>` y `<location>` con escape XML.

Fórmula (caracteres):

```
total = 195 + Σ (97 + len(name_escaped) + len(description_escaped) + len(location_escaped))
```

Notas:

- El escape XML expande `& < > " '` en entidades (`&amp;`, `&lt;`, etc.), aumentando la longitud.
- Los recuentos de tokens varían según el tokenizador del modelo. Una estimación aproximada al estilo OpenAI es ~4 caracteres/token, por lo que **97 caracteres ≈ 24 tokens** por skill más las longitudes reales de sus campos.

## Ciclo de vida de skills administradas

OpenClaw envía un conjunto base de skills como **skills incluidas** como parte de la
instalación (paquete npm u OpenClaw.app). `~/.openclaw/skills` existe para anulaciones locales
(por ejemplo, fijar/parchear una skill sin cambiar la copia incluida).
Las skills del espacio de trabajo son propiedad del usuario y anulan a ambas en conflictos de nombre.

## Referencia de configuración

Vea [Skills config](/tools/skills-config) para el esquema completo de configuración.

## ¿Busca más skills?

Explore https://clawhub.com.

---
