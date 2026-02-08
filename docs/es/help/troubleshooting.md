---
summary: "Centro de solucion de problemas: sintomas → comprobaciones → correcciones"
read_when:
  - Ve un error y quiere la ruta de solucion
  - El instalador dice “success” pero la CLI no funciona
title: "Solucion de problemas"
x-i18n:
  source_path: help/troubleshooting.md
  source_hash: 00ba2a20732fa22c
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:04Z
---

# Solucion de problemas

## Primeros 60 segundos

Ejecute estos en orden:

```bash
openclaw status
openclaw status --all
openclaw gateway probe
openclaw logs --follow
openclaw doctor
```

Si el Gateway es accesible, pruebas profundas:

```bash
openclaw status --deep
```

## Casos comunes de “se rompio”

### `openclaw: command not found`

Casi siempre es un problema de PATH de Node/npm. Empiece aqui:

- [Instalacion (verificacion de PATH de Node/npm)](/install#nodejs--npm-path-sanity)

### El instalador falla (o necesita registros completos)

Vuelva a ejecutar el instalador en modo detallado para ver el rastro completo y la salida de npm:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --verbose
```

Para instalaciones beta:

```bash
curl -fsSL https://openclaw.ai/install.sh | bash -s -- --beta --verbose
```

Tambien puede establecer `OPENCLAW_VERBOSE=1` en lugar de la bandera.

### Gateway “unauthorized”, no puede conectarse o se reconecta constantemente

- [Solucion de problemas del Gateway](/gateway/troubleshooting)
- [Autenticacion del Gateway](/gateway/authentication)

### La UI de Control falla en HTTP (se requiere identidad del dispositivo)

- [Solucion de problemas del Gateway](/gateway/troubleshooting)
- [UI de Control](/web/control-ui#insecure-http)

### `docs.openclaw.ai` muestra un error SSL (Comcast/Xfinity)

Algunas conexiones de Comcast/Xfinity bloquean `docs.openclaw.ai` mediante Xfinity Advanced Security.
Desactive Advanced Security o agregue `docs.openclaw.ai` a la lista de permitidos y vuelva a intentar.

- Ayuda de Xfinity Advanced Security: https://www.xfinity.com/support/articles/using-xfinity-xfi-advanced-security
- Comprobaciones rapidas: pruebe un hotspot movil o una VPN para confirmar que es filtrado a nivel del ISP

### El servicio dice que esta en ejecucion, pero la prueba RPC falla

- [Solucion de problemas del Gateway](/gateway/troubleshooting)
- [Proceso en segundo plano / servicio](/gateway/background-process)

### Fallos de modelo/autenticacion (limite de tasa, facturacion, “all models failed”)

- [Modelos](/cli/models)
- [Conceptos de OAuth / autenticacion](/concepts/oauth)

### `/model` dice `model not allowed`

Esto normalmente significa que `agents.defaults.models` esta configurado como una lista de permitidos. Cuando no esta vacia,
solo se pueden seleccionar esas claves de proveedor/modelo.

- Verifique la lista de permitidos: `openclaw config get agents.defaults.models`
- Agregue el modelo que desea (o limpie la lista de permitidos) y vuelva a intentar `/model`
- Use `/models` para explorar los proveedores/modelos permitidos

### Al presentar un problema

Pegue un informe seguro:

```bash
openclaw status --all
```

Si puede, incluya la cola de registros relevante de `openclaw logs --follow`.
