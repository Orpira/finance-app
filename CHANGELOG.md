# Changelog

Este archivo es un puntero breve. El changelog técnico detallado y mantenido por milestone es [docs/CHANGELOG.md](docs/CHANGELOG.md), que sigue el formato [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

Para el historial completo de commits, usa `git log`. No se reconstruye aquí un historial retroactivo.

## [Unreleased]

### Added

- `Más` incorpora la opción `Consulta de divisas`, con importe y moneda base
  editables, cuatro conversiones, caché diario, actualización explícita, fuente
  visible y fallback local/offline. No modifica balances ni registros.
- Reestructuración de la presentación y documentación pública del repositorio: README principal, `AGENTS.md`, `CONTRIBUTING.md`, `SECURITY.md` (raíz), `docs/PRIVACY.md`, plantillas de GitHub y guía de recursos visuales. No introduce cambios funcionales en la aplicación.

### Fixed

- El detalle abierto desde `Actividad reciente` de Inicio muestra ahora los
  Adicionales del ingreso profesional, con descripción, importe y protección de
  valores sensibles, sin alterar cálculos ni balances.
- Agenda impide iniciar una cita antes de su fecha/hora y evita ingresos
  duplicados ante pulsaciones repetidas mediante inicio y finalización
  idempotentes por cita. Se eliminaron los cronómetros ascendentes y el
  auto-inicio silencioso de Agenda, preservando recordatorios y la alarma de
  tiempo previsto. El ingreso creado al finalizar conserva inicio, fin y
  duración real, pero no inicia un segundo cronómetro. La validación UI real y
  la recuperación ante un fallo de creación del ingreso posterior a la
  reclamación permanecen pendientes.
- Las citas nuevas incluyen una alarma editable 5 minutos antes. Las dos alarmas
  configurables son siempre previas al inicio; la alerta de duración prevista
  solo se activa después de comenzar el servicio.
- Agenda rechaza citas cuyos intervalos se solapen al crear o cambiar horario o
  duración, incluso ante guardados concurrentes, y permite citas consecutivas.
- Las seis Quick Actions del Copiloto cumplen ahora su texto: registrar ingreso,
  gasto o cita prepara una propuesta confirmable; el resumen usa la semana
  actual; los pendientes continúan siendo locales; y la comparación enfrenta
  ingresos, gastos y balance del mes actual con el anterior. Los comandos de
  escritura ya no pueden caer en `financial_transactions`, y el renderizador
  distingue `1 transacción` de cantidades plurales. La paridad completa del
  registro Profesional mediante Copiloto sigue pendiente. La validación UI real
  de las seis acciones, confirmación, cancelación, persistencia y ausencia de
  tráfico de IA en consultas deterministas quedó aprobada sobre el commit
  `b300f89` y está documentada en
  `docs/product/COPILOT_QUICK_ACTIONS_UI_VALIDATION.md`.
- Sprint B Samsung post-certificación: se corrigen los defectos SB-003–SB-007
  con TDD focal. La edición de citas persiste y los fallos de recordatorios no
  se presentan como fallo de guardado; `Generar PDF` en APK usa el flujo nativo
  de compartir en vez de `window.open`/Chrome; Jornada se agrupa como `No
  aplica`; PIN restaurado conserva `pinEnabled` solo con hash válido; cancelar
  el chooser Android vuelve como cancelación, no error. APK correctivo:
  `private-balance-1.0.1-2-debug.apk`, SHA-256
  `6800160c7b82e63aaf887e02b39f5b130e03405c48884e11731de580818021b6`.
- SB-002 corrige la restauración JSON en Android: `PinGate` mantiene montado,
  oculto e inerte el contenido de una sesión ya desbloqueada mientras el selector
  de archivos está abierto. El Galaxy A16 recuperó ingreso, gasto, cita,
  temporadas y configuración; SB-006 separa la pérdida del PIN detectada después
  en un arranque frío.
- La insignia de estado `Finalizado` recupera contraste en tema oscuro mediante
  colores explícitos de fondo y texto; la recertificación física en el Galaxy
  A16 midió `8,47:1` en oscuro y `6,70:1` en claro, sin overflow.
- El registro de ingresos por Jornada por horas deja de solicitar y persistir
  tipo de pago. Servicio por tiempo conserva el selector, y editar una jornada
  antigua no elimina ni reescribe un valor histórico existente.
- Los ingresos del modo Profesional ya no pueden crearse ni editarse con una
  fecha anterior al inicio de su temporada. La validación se aplica antes de
  persistir en IndexedDB y el selector de edición limita la fecha mínima.
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

- Refinamiento UX-01 a UX-10: Movimientos agrupa sus filtros en una hoja
  accesible con contador, sesión y navegación temporal, Reportes adopta el mismo
  patrón anterior/siguiente e Inicio acerca la configuración Profesional y los
  estados vacíos accionables. No cambia cálculos, persistencia ni aislamiento
  entre modos. La validación automatizada está aprobada; la pasada E2E licenciada
  y física queda documentada como pendiente.
- El formulario usa "Tipo de registro" y distingue `Servicio` de `Jornada`;
  las superficies de consulta, reportes y exportaciones presentan
  "Jornada por horas" sin añadir un tipo de pago que no aplica.
- Sprint B Android queda `EN EJECUCIÓN — SAMSUNG CERTIFICADO TRAS BLOQUE
  CORRECTIVO`. La matriz física Samsung histórica está completa: 15 PASS y
  4 FAIL en el APK defectuoso. El APK correctivo post-certificación corrige
  SB-003–SB-007 y fue validado físicamente en instalación, PIN, PDF Android,
  cancelación del chooser, force-stop, reboot y Logcat.
- El favicon principal usa fondo transparente y se reutiliza como logotipo del paso de bienvenida del onboarding.
- El listado de ingresos en modo Personal deja de mostrar Adicionales y estado operativo; el modo Profesional conserva ambas capacidades.
- Los manifiestos históricos 9A/9B y las notas de release de WhatsApp Cloud se trasladan desde la raíz a sus dominios bajo `docs/handoff/` y `docs/whatsapp/`. La raíz conserva únicamente los puntos de entrada documentales estándar.

Para el detalle funcional de cada milestone técnico, consulta [docs/CHANGELOG.md](docs/CHANGELOG.md).
