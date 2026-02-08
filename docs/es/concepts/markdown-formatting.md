---
summary: "Canal de formato Markdown para canales de salida"
read_when:
  - Usted está cambiando el formato Markdown o la fragmentación para canales de salida
  - Usted está agregando un nuevo formateador de canal o un mapeo de estilos
  - Usted está depurando regresiones de formato entre canales
title: "Formato Markdown"
x-i18n:
  source_path: concepts/markdown-formatting.md
  source_hash: f9cbf9b744f9a218
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:58:35Z
---

# Formato Markdown

OpenClaw da formato al Markdown de salida convirtiéndolo en una representación
intermedia compartida (IR) antes de renderizar la salida específica de cada canal.
La IR mantiene intacto el texto de origen mientras transporta rangos de estilo/enlace,
de modo que la fragmentación y el renderizado puedan mantenerse consistentes entre canales.

## Objetivos

- **Consistencia:** un paso de parseo, múltiples renderizadores.
- **Fragmentación segura:** dividir el texto antes del renderizado para que el formato en línea
  nunca se rompa entre fragmentos.
- **Adecuación al canal:** mapear la misma IR a Slack mrkdwn, Telegram HTML y rangos de estilo de Signal
  sin volver a parsear Markdown.

## Canalización

1. **Parsear Markdown -> IR**
   - La IR es texto plano más rangos de estilo (negrita/cursiva/tachado/código/spoiler) y rangos de enlace.
   - Los desplazamientos usan unidades de código UTF-16 para que los rangos de estilo de Signal se alineen con su API.
   - Las tablas se parsean solo cuando un canal opta por la conversión de tablas.
2. **Fragmentar la IR (primero formato)**
   - La fragmentación ocurre sobre el texto de la IR antes del renderizado.
   - El formato en línea no se divide entre fragmentos; los rangos se recortan por fragmento.
3. **Renderizar por canal**
   - **Slack:** tokens mrkdwn (negrita/cursiva/tachado/código), enlaces como `<url|label>`.
   - **Telegram:** etiquetas HTML (`<b>`, `<i>`, `<s>`, `<code>`, `<pre><code>`, `<a href>`).
   - **Signal:** texto plano + rangos `text-style`; los enlaces se convierten en `label (url)` cuando la etiqueta difiere.

## Ejemplo de IR

Markdown de entrada:

```markdown
Hello **world** — see [docs](https://docs.openclaw.ai).
```

IR (esquemático):

```json
{
  "text": "Hello world — see docs.",
  "styles": [{ "start": 6, "end": 11, "style": "bold" }],
  "links": [{ "start": 19, "end": 23, "href": "https://docs.openclaw.ai" }]
}
```

## Dónde se utiliza

- Los adaptadores de salida de Slack, Telegram y Signal renderizan desde la IR.
- Otros canales (WhatsApp, iMessage, MS Teams, Discord) aún usan texto plano o
  sus propias reglas de formato, con la conversión de tablas Markdown aplicada antes
  de la fragmentación cuando está habilitada.

## Manejo de tablas

Las tablas Markdown no son compatibles de forma consistente entre clientes de chat. Use
`markdown.tables` para controlar la conversión por canal (y por cuenta).

- `code`: renderizar tablas como bloques de código (predeterminado para la mayoría de los canales).
- `bullets`: convertir cada fila en viñetas (predeterminado para Signal + WhatsApp).
- `off`: deshabilitar el parseo y la conversión de tablas; el texto de la tabla sin procesar se transmite.

Claves de configuración:

```yaml
channels:
  discord:
    markdown:
      tables: code
    accounts:
      work:
        markdown:
          tables: off
```

## Reglas de fragmentación

- Los límites de fragmentación provienen de los adaptadores/configuración del canal y se aplican al texto de la IR.
- Los cercos de código se preservan como un solo bloque con una nueva línea final para que los canales
  los rendericen correctamente.
- Los prefijos de listas y de citas en bloque forman parte del texto de la IR, por lo que la fragmentación
  no se divide a mitad de prefijo.
- Los estilos en línea (negrita/cursiva/tachado/código en línea/spoiler) nunca se dividen entre fragmentos;
  el renderizador reabre los estilos dentro de cada fragmento.

Si necesita más información sobre el comportamiento de fragmentación entre canales, consulte
[Streaming + chunking](/concepts/streaming).

## Política de enlaces

- **Slack:** `[label](url)` -> `<url|label>`; las URL desnudas permanecen desnudas. El autolink
  se deshabilita durante el parseo para evitar enlaces dobles.
- **Telegram:** `[label](url)` -> `<a href="url">label</a>` (modo de parseo HTML).
- **Signal:** `[label](url)` -> `label (url)` a menos que la etiqueta coincida con la URL.

## Spoilers

Los marcadores de spoiler (`||spoiler||`) se parsean solo para Signal, donde se mapean a
rangos de estilo SPOILER. Otros canales los tratan como texto plano.

## Cómo agregar o actualizar un formateador de canal

1. **Parsear una vez:** use el helper compartido `markdownToIR(...)` con opciones apropiadas al canal
   (autolink, estilo de encabezados, prefijo de citas en bloque).
2. **Renderizar:** implemente un renderizador con `renderMarkdownWithMarkers(...)` y un
   mapa de marcadores de estilo (o rangos de estilo de Signal).
3. **Fragmentar:** llame a `chunkMarkdownIR(...)` antes de renderizar; renderice cada fragmento.
4. **Conectar el adaptador:** actualice el adaptador de salida del canal para usar el nuevo fragmentador
   y renderizador.
5. **Probar:** agregue o actualice pruebas de formato y una prueba de entrega de salida si el
   canal usa fragmentación.

## Errores comunes

- Los tokens de corchetes angulares de Slack (`<@U123>`, `<#C123>`, `<https://...>`) deben
  preservarse; escape HTML sin procesar de forma segura.
- El HTML de Telegram requiere escapar el texto fuera de las etiquetas para evitar marcado roto.
- Los rangos de estilo de Signal dependen de desplazamientos UTF-16; no use desplazamientos de puntos de código.
- Preserve las nuevas líneas finales para los bloques de código con cercos para que los marcadores de cierre
  queden en su propia línea.
