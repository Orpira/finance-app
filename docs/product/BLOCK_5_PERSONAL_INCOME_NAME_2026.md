# Bloque 5 — Nombre libre para ingresos personales

Fecha de cierre técnico: 2026-09-05

## Veredicto

Implementado y certificado en código, pruebas automatizadas, build web, IndexedDB real y APK Android físico. No se introdujeron categorías ni se modificaron fórmulas financieras.

## Auditoría previa de campos

| Campo existente | Uso vigente | ¿Reutilizable? | Decisión |
| --- | --- | --- | --- |
| `notes` | Observaciones y metadatos descriptivos | No | Mantener su semántica; reutilizarlo mezclaría observación e identidad. |
| `type` | Tipo financiero (`ingreso`/`ajuste`) | No | Es parte del dominio financiero y no admite texto libre. |
| `paymentType` | Medio de pago de Profesional | No | No pertenece a Personal y mantiene su contrato actual. |
| Etiqueta `Servicio #ID` | Fallback de presentación | Sí, como fallback | Conservar para registros históricos sin nombre. |

Se añadió `personalName?: string` a `ServiceIncome`. Es opcional, exclusivo del contexto Personal (`basic`), no indexado y por ello no requiere migración Dexie.

## Contrato final

- Normalización central: recorte exterior y colapso de espacios internos.
- Cadena vacía o formada solo por espacios: ausencia de nombre.
- Longitud máxima: 80 caracteres; no se trunca silenciosamente.
- Tipo distinto de texto o longitud excesiva: rechazo fail-closed.
- Creación y edición conservan ID, importe y contexto financiero.
- Profesional ignora nombres nuevos desde el servicio y rechaza backups manipulados que intenten inyectarlos.
- Híbrido aplica el contrato según su contexto activo.

## Presentación e integraciones

- Formulario Personal: campo opcional accesible, ayuda y contador; oculto en Profesional.
- Inicio, movimientos, detalle, pendientes de reportar e informes usan el nombre; los históricos mantienen `Servicio #ID`.
- La búsqueda de movimientos incorpora nombre y observaciones.
- Copiloto identifica los ingresos Personal por nombre y conserva la etiqueta anterior de Profesional.
- CSV/Excel Personal usa la columna `Nombre`; los informes PDF/HTML y texto muestran el nombre con escape HTML. Profesional conserva su estructura.
- Backup conserva el campo. La restauración admite su ausencia, normaliza valores válidos y valida todo antes de limpiar datos locales.

## Pruebas y validación

- `npm run typecheck`: correcto.
- `npx eslint src/ test/`: correcto.
- `npx vitest run`: 239 archivos; 2.555 pruebas superadas y 1 `todo` preexistente.
- `npm run build`: correcto (advertencia no bloqueante de tamaño de chunk).
- `npm run test:indexeddb`: correcto en Headless Chrome; incluye rechazo previo a limpieza para nombre excesivo y nombre inyectado en Profesional.
- `npm run android:apk`: correcto. APK `private-balance-1.0.6-7-debug.apk`, SHA-256 `9986516603d71fb60896181e132d398e496773939f516d79c0d33a4b8a50372e`.
- Android físico Samsung SM-A165F: instalación incremental correcta, `1.0.6 (7)`, apertura correcta y formulario Personal comprobado con `Nombre del ingreso`, ayuda y acción `Guardar ingreso`. No se guardó ningún registro de prueba para no alterar los datos reales del dispositivo.

## Hallazgos y riesgos residuales

No quedan hallazgos PIN abiertos. La validación visual automatizada cubre contenido y seguridad; queda como comprobación de aceptación humana la matriz estética completa de 320/375/tablet/escritorio, temas claro/oscuro, PWA y el flujo destructivo de restaurar un backup real. El build mantiene la advertencia conocida por chunks superiores a 500 kB, ajena a este bloque.

## Puerta de aceptación

Puerta técnica: abierta. Puerta visual/operativa final: pendiente únicamente de la matriz manual humana indicada arriba. El siguiente bloque debe ser autorizado expresamente; este cierre no inicia categorías personalizadas.
