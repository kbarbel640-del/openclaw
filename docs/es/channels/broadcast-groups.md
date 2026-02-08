---
summary: "Difunda un mensaje de WhatsApp a multiples agentes"
read_when:
  - Configuracion de grupos de difusion
  - Depuracion de respuestas multiagente en WhatsApp
status: experimental
title: "Grupos de Difusion"
x-i18n:
  source_path: channels/broadcast-groups.md
  source_hash: 25866bc0d519552d
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T08:15:34Z
---

# Grupos de Difusion

**Estado:** Experimental  
**Version:** Agregado en 2026.1.9

## Descripcion general

Los Grupos de Difusion permiten que multiples agentes procesen y respondan al mismo mensaje de forma simultanea. Esto le permite crear equipos de agentes especializados que trabajan juntos en un solo grupo de WhatsApp o Mensaje directo — todo usando un unico numero de telefono.

Alcance actual: **solo WhatsApp** (canal web).

Los grupos de difusion se evalúan despues de las allowlists del canal y las reglas de activacion de grupos. En grupos de WhatsApp, esto significa que las difusiones ocurren cuando OpenClaw normalmente responderia (por ejemplo: al ser mencionado, segun la configuracion de su grupo).

## Casos de uso

### 1. Equipos de agentes especializados

Despliegue multiples agentes con responsabilidades atomicas y enfocadas:

```
Group: "Development Team"
Agents:
  - CodeReviewer (reviews code snippets)
  - DocumentationBot (generates docs)
  - SecurityAuditor (checks for vulnerabilities)
  - TestGenerator (suggests test cases)
```

Cada agente procesa el mismo mensaje y proporciona su perspectiva especializada.

### 2. Soporte multilenguaje

```
Group: "International Support"
Agents:
  - Agent_EN (responds in English)
  - Agent_DE (responds in German)
  - Agent_ES (responds in Spanish)
```

### 3. Flujos de trabajo de aseguramiento de calidad

```
Group: "Customer Support"
Agents:
  - SupportAgent (provides answer)
  - QAAgent (reviews quality, only responds if issues found)
```

### 4. Automatizacion de tareas

```
Group: "Project Management"
Agents:
  - TaskTracker (updates task database)
  - TimeLogger (logs time spent)
  - ReportGenerator (creates summaries)
```

## Configuracion

### Configuracion basica

Agregue una seccion de nivel superior `broadcast` (junto a `bindings`). Las claves son IDs de pares de WhatsApp:

- chats grupales: JID del grupo (por ejemplo, `120363403215116621@g.us`)
- Mensajes directos: numero telefonico E.164 (por ejemplo, `+15551234567`)

```json
{
  "broadcast": {
    "120363403215116621@g.us": ["alfred", "baerbel", "assistant3"]
  }
}
```

**Resultado:** Cuando OpenClaw responderia en este chat, ejecutara los tres agentes.

### Estrategia de procesamiento

Controle como los agentes procesan los mensajes:

#### Paralelo (Predeterminado)

Todos los agentes procesan simultaneamente:

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

#### Secuencial

Los agentes procesan en orden (uno espera a que el anterior termine):

```json
{
  "broadcast": {
    "strategy": "sequential",
    "120363403215116621@g.us": ["alfred", "baerbel"]
  }
}
```

### Ejemplo completo

```json
{
  "agents": {
    "list": [
      {
        "id": "code-reviewer",
        "name": "Code Reviewer",
        "workspace": "/path/to/code-reviewer",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "security-auditor",
        "name": "Security Auditor",
        "workspace": "/path/to/security-auditor",
        "sandbox": { "mode": "all" }
      },
      {
        "id": "docs-generator",
        "name": "Documentation Generator",
        "workspace": "/path/to/docs-generator",
        "sandbox": { "mode": "all" }
      }
    ]
  },
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": ["code-reviewer", "security-auditor", "docs-generator"],
    "120363424282127706@g.us": ["support-en", "support-de"],
    "+15555550123": ["assistant", "logger"]
  }
}
```

## Como funciona

### Flujo de mensajes

1. **Mensaje entrante** llega a un grupo de WhatsApp
2. **Verificacion de difusion**: el sistema verifica si el ID del par esta en `broadcast`
3. **Si esta en la lista de difusion**:
   - Todos los agentes listados procesan el mensaje
   - Cada agente tiene su propia clave de sesion y contexto aislado
   - Los agentes procesan en paralelo (predeterminado) o secuencialmente
4. **Si no esta en la lista de difusion**:
   - Se aplica el enrutamiento normal (primer binding que coincide)

Nota: los grupos de difusion no evitan las allowlists del canal ni las reglas de activacion de grupos (menciones/comandos/etc). Solo cambian _que agentes se ejecutan_ cuando un mensaje es elegible para procesamiento.

### Aislamiento de sesiones

Cada agente en un grupo de difusion mantiene completamente separados:

- **Claves de sesion** (`agent:alfred:whatsapp:group:120363...` vs `agent:baerbel:whatsapp:group:120363...`)
- **Historial de conversacion** (el agente no ve los mensajes de otros agentes)
- **Espacio de trabajo** (sandboxes separados si estan configurados)
- **Acceso a herramientas** (listas de permitir/denegar diferentes)
- **Memoria/contexto** (IDENTITY.md, SOUL.md, etc., separados)
- **Buffer de contexto del grupo** (mensajes recientes del grupo usados para contexto) se comparte por par, por lo que todos los agentes de difusion ven el mismo contexto cuando se activan

Esto permite que cada agente tenga:

- Personalidades diferentes
- Acceso a herramientas diferente (por ejemplo, solo lectura vs. lectura-escritura)
- Modelos diferentes (por ejemplo, opus vs. sonnet)
- Skills diferentes instaladas

### Ejemplo: sesiones aisladas

En el grupo `120363403215116621@g.us` con agentes `["alfred", "baerbel"]`:

**Contexto de Alfred:**

```
Session: agent:alfred:whatsapp:group:120363403215116621@g.us
History: [user message, alfred's previous responses]
Workspace: /Users/pascal/openclaw-alfred/
Tools: read, write, exec
```

**Contexto de Bärbel:**

```
Session: agent:baerbel:whatsapp:group:120363403215116621@g.us
History: [user message, baerbel's previous responses]
Workspace: /Users/pascal/openclaw-baerbel/
Tools: read only
```

## Buenas practicas

### 1. Mantenga a los agentes enfocados

Disene cada agente con una responsabilidad unica y clara:

```json
{
  "broadcast": {
    "DEV_GROUP": ["formatter", "linter", "tester"]
  }
}
```

✅ **Bien:** Cada agente tiene un solo trabajo  
❌ **Mal:** Un agente generico "dev-helper"

### 2. Use nombres descriptivos

Haga claro que hace cada agente:

```json
{
  "agents": {
    "security-scanner": { "name": "Security Scanner" },
    "code-formatter": { "name": "Code Formatter" },
    "test-generator": { "name": "Test Generator" }
  }
}
```

### 3. Configure acceso a herramientas diferente

Otorgue a los agentes solo las herramientas que necesitan:

```json
{
  "agents": {
    "reviewer": {
      "tools": { "allow": ["read", "exec"] } // Read-only
    },
    "fixer": {
      "tools": { "allow": ["read", "write", "edit", "exec"] } // Read-write
    }
  }
}
```

### 4. Monitoree el rendimiento

Con muchos agentes, considere:

- Usar `"strategy": "parallel"` (predeterminado) para mayor velocidad
- Limitar los grupos de difusion a 5–10 agentes
- Usar modelos mas rapidos para agentes mas simples

### 5. Maneje fallas de forma adecuada

Los agentes fallan de manera independiente. El error de un agente no bloquea a los demas:

```
Message → [Agent A ✓, Agent B ✗ error, Agent C ✓]
Result: Agent A and C respond, Agent B logs error
```

## Compatibilidad

### Proveedores

Los grupos de difusion actualmente funcionan con:

- ✅ WhatsApp (implementado)
- 🚧 Telegram (planificado)
- 🚧 Discord (planificado)
- 🚧 Slack (planificado)

### Enrutamiento

Los grupos de difusion funcionan junto con el enrutamiento existente:

```json
{
  "bindings": [
    {
      "match": { "channel": "whatsapp", "peer": { "kind": "group", "id": "GROUP_A" } },
      "agentId": "alfred"
    }
  ],
  "broadcast": {
    "GROUP_B": ["agent1", "agent2"]
  }
}
```

- `GROUP_A`: Solo alfred responde (enrutamiento normal)
- `GROUP_B`: agent1 Y agent2 responden (difusion)

**Precedencia:** `broadcast` tiene prioridad sobre `bindings`.

## Solucion de problemas

### Los agentes no responden

**Verifique:**

1. Los IDs de los agentes existen en `agents.list`
2. El formato del ID del par es correcto (por ejemplo, `120363403215116621@g.us`)
3. Los agentes no estan en listas de denegacion

**Depurar:**

```bash
tail -f ~/.openclaw/logs/gateway.log | grep broadcast
```

### Solo un agente responde

**Causa:** El ID del par podria estar en `bindings` pero no en `broadcast`.

**Solucion:** Agreguelo a la configuracion de difusion o elimínelo de los bindings.

### Problemas de rendimiento

**Si es lento con muchos agentes:**

- Reduzca la cantidad de agentes por grupo
- Use modelos mas ligeros (sonnet en lugar de opus)
- Verifique el tiempo de inicio del sandbox

## Ejemplos

### Ejemplo 1: Equipo de revision de codigo

```json
{
  "broadcast": {
    "strategy": "parallel",
    "120363403215116621@g.us": [
      "code-formatter",
      "security-scanner",
      "test-coverage",
      "docs-checker"
    ]
  },
  "agents": {
    "list": [
      {
        "id": "code-formatter",
        "workspace": "~/agents/formatter",
        "tools": { "allow": ["read", "write"] }
      },
      {
        "id": "security-scanner",
        "workspace": "~/agents/security",
        "tools": { "allow": ["read", "exec"] }
      },
      {
        "id": "test-coverage",
        "workspace": "~/agents/testing",
        "tools": { "allow": ["read", "exec"] }
      },
      { "id": "docs-checker", "workspace": "~/agents/docs", "tools": { "allow": ["read"] } }
    ]
  }
}
```

**El usuario envia:** Fragmento de codigo  
**Respuestas:**

- code-formatter: "Arregle la sangria y agregue sugerencias de tipos"
- security-scanner: "⚠️ Vulnerabilidad de inyeccion SQL en la linea 12"
- test-coverage: "La cobertura es del 45%, faltan pruebas para casos de error"
- docs-checker: "Falta docstring para la funcion `process_data`"

### Ejemplo 2: Soporte multilenguaje

```json
{
  "broadcast": {
    "strategy": "sequential",
    "+15555550123": ["detect-language", "translator-en", "translator-de"]
  },
  "agents": {
    "list": [
      { "id": "detect-language", "workspace": "~/agents/lang-detect" },
      { "id": "translator-en", "workspace": "~/agents/translate-en" },
      { "id": "translator-de", "workspace": "~/agents/translate-de" }
    ]
  }
}
```

## Referencia de la API

### Esquema de configuracion

```typescript
interface OpenClawConfig {
  broadcast?: {
    strategy?: "parallel" | "sequential";
    [peerId: string]: string[];
  };
}
```

### Campos

- `strategy` (opcional): Como procesar los agentes
  - `"parallel"` (predeterminado): Todos los agentes procesan simultaneamente
  - `"sequential"`: Los agentes procesan en el orden del arreglo
- `[peerId]`: JID de grupo de WhatsApp, numero E.164 u otro ID de par
  - Valor: Arreglo de IDs de agentes que deben procesar mensajes

## Limitaciones

1. **Maximo de agentes:** No hay un limite estricto, pero 10+ agentes pueden ser lentos
2. **Contexto compartido:** Los agentes no ven las respuestas de otros (por diseno)
3. **Orden de mensajes:** Las respuestas en paralelo pueden llegar en cualquier orden
4. **Limites de tasa:** Todos los agentes cuentan para los limites de tasa de WhatsApp

## Mejoras futuras

Funciones planificadas:

- [ ] Modo de contexto compartido (los agentes ven las respuestas de otros)
- [ ] Coordinacion de agentes (los agentes pueden senalizarse entre si)
- [ ] Seleccion dinamica de agentes (elegir agentes segun el contenido del mensaje)
- [ ] Prioridades de agentes (algunos agentes responden antes que otros)

## Ver tambien

- [Configuracion multiagente](/tools/multi-agent-sandbox-tools)
- [Configuracion de enrutamiento](/channels/channel-routing)
- [Gestion de sesiones](/concepts/sessions)
