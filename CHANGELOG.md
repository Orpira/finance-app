# Changelog

Este archivo es un puntero breve. El changelog técnico detallado y mantenido por milestone es [docs/CHANGELOG.md](docs/CHANGELOG.md), que sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

Para el historial completo de commits, usa `git log`. No se reconstruye aquí un historial retroactivo.

## [Unreleased]

### Added

- Reestructuración de la presentación y documentación pública del repositorio: README principal, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md` (raíz), `docs/PRIVACY.md`, plantillas de GitHub y guía de recursos visuales. No introduce cambios funcionales en la aplicación.

### Fixed

- Sprint B Samsung post-certificación: se corrigen los defectos SB-003–SB-007
  con TDD focal. La edición de citas persiste y los fallos de recordatorios no
  se presentan como fallo de guardado; `Generar PDF` en APK usa el flujo nativo
  de compartir en vez de `window.open`/Chrome; Jornada se agrupa como `No
  aplica`; PIN restaurado conserva `pinEnabled` solo con hash válido; cancelar
  el chooser Android vuelve como cancelación, no error. APK correctivo:
  `private-balance-1.0.1-2-debug.apk`, SHA-256
  `6800160c7b82e63aaf887e02b39f5b130e03405c48884e11731de580818021b6`.
- Los reportes de ingresos agrupan los registros por fecha sin perder identidad,
  tipo, método de pago, ubicación, moneda original, importe convertido, notas ni
  trazabilidad. Los subtotales profesionales reutilizan la duración efectiva
  canónica, por lo que `hourly_workday` respeta `workedTime/workedTimeUnit` y
  presenta combinaciones normalizadas como `2 h 30 min` en HTML, impresión, PDF
  y texto compartido.
- La restauración JSON reconoce backups actuales e históricos, valida antes de
  reemplazar IndexedDB y ofrece feedback contextual tras importar.
- El pipeline Android genera APK identificable por versión/código, imprime su
  SHA-256, detecta el SDK local y muestra `versionName (versionCode)` en el
  diagnóstico. Línea base actual: `1.0.1 (2)` con Capacitor 8.5.0 alineado.

### Changed

- Sprint B Android queda `EN EJECUCIÓN — SAMSUNG CERTIFICADO TRAS BLOQUE
  CORRECTIVO`. La matriz física Samsung histórica está completa: 15 PASS y
  4 FAIL en el APK defectuoso. El APK correctivo post-certificación corrige
  SB-003–SB-007 y fue validado físicamente en instalación, PIN, PDF Android,
  cancelación del chooser, force-stop, reboot y Logcat.
- El favicon principal usa fondo transparente y se reutiliza como logotipo del paso de bienvenida del onboarding.
- El listado de ingresos en modo Personal deja de mostrar Adicionales y estado operativo; el modo Profesional conserva ambas capacidades.
- Los manifiestos históricos 9A/9B y las notas de release de WhatsApp Cloud se trasladan desde la raíz a sus dominios bajo `docs/handoff/` y `docs/whatsapp/`. La raíz conserva únicamente los puntos de entrada documentales estándar.

Para el detalle funcional de cada milestone técnico, consulta [docs/CHANGELOG.md](docs/CHANGELOG.md).
