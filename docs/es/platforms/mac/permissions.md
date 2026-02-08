---
summary: "Persistencia de permisos de macOS (TCC) y requisitos de firma"
read_when:
  - Depurar avisos de permisos de macOS faltantes o atascados
  - Empaquetar o firmar la app de macOS
  - Cambiar IDs de bundle o rutas de instalación de la app
title: "Permisos de macOS"
x-i18n:
  source_path: platforms/mac/permissions.md
  source_hash: d012589c0583dd0b
  provider: openai
  model: gpt-5.2-chat-latest
  workflow: v1
  generated_at: 2026-02-08T06:59:28Z
---

# permisos de macOS (TCC)

Las concesiones de permisos de macOS son frágiles. TCC asocia una concesión de permiso con la
firma de código de la app, el identificador de bundle y la ruta en disco. Si cualquiera de estos cambia,
macOS trata la app como nueva y puede descartar u ocultar los avisos.

## Requisitos para permisos estables

- Misma ruta: ejecute la app desde una ubicación fija (para OpenClaw, `dist/OpenClaw.app`).
- Mismo identificador de bundle: cambiar el ID de bundle crea una nueva identidad de permisos.
- App firmada: las compilaciones sin firmar o con firma ad-hoc no conservan los permisos.
- Firma consistente: use un certificado real de Apple Development o Developer ID
  para que la firma se mantenga estable entre recompilaciones.

Las firmas ad-hoc generan una identidad nueva en cada compilación. macOS olvidará concesiones anteriores,
y los avisos pueden desaparecer por completo hasta que se limpien las entradas obsoletas.

## Lista de recuperación cuando desaparecen los avisos

1. Cierre la app.
2. Elimine la entrada de la app en Configuración del Sistema -> Privacidad y seguridad.
3. Vuelva a iniciar la app desde la misma ruta y vuelva a conceder los permisos.
4. Si el aviso aún no aparece, restablezca las entradas de TCC con `tccutil` y vuelva a intentarlo.
5. Algunos permisos solo reaparecen después de un reinicio completo de macOS.

Ejemplos de restablecimiento (reemplace el ID de bundle según sea necesario):

```bash
sudo tccutil reset Accessibility bot.molt.mac
sudo tccutil reset ScreenCapture bot.molt.mac
sudo tccutil reset AppleEvents
```

Si está probando permisos, firme siempre con un certificado real. Las compilaciones ad-hoc
solo son aceptables para ejecuciones locales rápidas donde los permisos no importan.
