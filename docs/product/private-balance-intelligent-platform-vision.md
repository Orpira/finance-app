# Private Balance — Evaluación de producto y mapa funcional (plataforma inteligente)

Ver [ADR-030](../adr/ADR-030-Intelligent-Assistant-Platform.md) para la decisión y el contexto completo. Este documento cubre las entregas 1 (evaluación completa del producto) y 2 (nuevo mapa funcional) de esa iteración.

## 1. Evaluación completa del producto

### Metodología

Se revisó cada pantalla bajo `src/pages/**` respondiendo cuatro preguntas: ¿por qué existe?, ¿qué aporta?, ¿qué podría simplificarse?, ¿qué podría automatizar la IA? La revisión es de auditoría — no se ha tocado ninguna pantalla en esta iteración.

### Flujo del usuario, de principio a fin

1. **Apertura** → `LicenseGuard` (comprobación/activación de licencia) → `OnboardingGate` (configuración inicial local y versionada) → `PinGate` (bloqueo local) → `HomePage`.
2. **Inicio** → resumen del mes, ingresos sin reportar, acciones rápidas, agenda próxima, resumen inteligente (ad-hoc, ver hallazgo en ADR-030 §2), actividad reciente.
3. **Movimientos** (o Agenda, o Copiloto, o Más) según la necesidad puntual.
4. **Cierre**: no hay una acción explícita de "salir"; la app se bloquea sola por PIN tras inactividad.

Este flujo ya es razonablemente corto. El problema no es la profundidad de navegación — es que **registrar información sigue requiriendo abrir un formulario específico** (Ingreso, Gasto, Cita) incluso cuando el usuario ya sabe exactamente qué quiere decir en una frase.

### Pantallas: qué aportan y qué podría simplificarse o automatizarse

| Pantalla | Por qué existe | Candidata a... |
| --- | --- | --- |
| `IncomeDetailPage` (`/income/:id`) | Vista de solo lectura de un ingreso | Fusionarse con `IncomePage` (modo lectura/edición del mismo componente) o resolverse como panel inline desde `MovementsPage` |
| `IncomePendingReportPage` (`/income/pendientes`) | Ingresos sin reportar agrupados por fecha | Es un filtro de `IncomeListPage` (de hecho ya existe el alias `/incomes?reportStatus=pending`); candidata a desaparecer como ruta propia y resolverse como consulta del asistente + filtro en Movimientos |
| `MovementsPage` + `IncomeListPage` + `ExpenseListPage` | Tres formas de ver esencialmente los mismos datos | Ya identificado en la iteración 1; consolidar de verdad en una sola vista con filtros, no en 3 pantallas que se importan entre sí |
| `ReportPreviewPage` (`/reports/preview`) | Vista de impresión de un reporte | Depende de `sessionStorage` como canal frágil entre pantallas; candidata a integrarse en `ReportsPage` o resolverse vía asistente ("genera y comparte el reporte de julio") |
| `SeasonsPage` + `SeasonFormPage` + `SeasonDetailPage` | CRUD de temporadas en 3 pantallas | "Crear/cerrar temporada" es una acción de una frase; candidata a resolverse conversacionalmente, dejando solo el detalle visual |
| `BestDaysHistoryPage` | Historial de "mejor día" por temporada | Dato ya presente en `SeasonStatistics`; candidata a integrarse como sección de `SeasonDetailPage`/`FullSummaryPage` en lugar de ruta independiente |
| `MorePage` vs `SettingsPage` | Dos "índices" de navegación secundaria | Se solapan conceptualmente; unificar en un solo índice de "Más" |
| `DebugPage` + `AIExecutionInspectorPage` + `AIDeveloperPlaygroundPage` | Herramientas internas de desarrollo | Ya corregido en esta sesión (`DevOnlyGuard`, commit `2df85c7`): no eran alcanzables desde la navegación, pero sí desde URL directa en producción |

### Qué podría automatizar la IA (sin sustituir el motor determinista)

Basado en lo anterior, los candidatos de mayor impacto para el modelo conversacional son, en orden de valor:

1. Registrar ingreso / gasto / cita en una frase (elimina 3 formularios como paso obligatorio, no como opción).
2. Marcar ingresos como reportados ("marca como reportado el ingreso del 3 de julio").
3. Generar y compartir un reporte de un periodo.
4. Crear o cerrar una temporada.
5. Responder preguntas de comparación/tendencia que hoy exigen navegar a `FullSummaryPage`, `Reports` o `Seasons` para armar mentalmente la respuesta.

### Fatiga de formularios

`IncomePage` y `ExpensesPage` combinan varios conceptos en un único formulario largo (moneda, tasa de cambio, porcentaje, adicionales, ajustes). No se propone rediseñar estos formularios en esta iteración (riesgo alto sobre reglas financieras ya certificadas) — la vía de simplificación recomendada es **ofrecer la ruta conversacional como alternativa**, no reemplazar el formulario, que sigue siendo necesario para casos complejos o para editar.

## 2. Nuevo mapa funcional

```text
Private Balance
│
├── Inicio                     — panorama y punto de entrada a todo lo demás
│
├── Movimientos                — única fuente de verdad visual de ingresos/egresos
│   ├── Todos / Ingresos / Egresos (ya existente)
│   └── (propuesto) creación conversacional como alternativa al formulario
│
├── Agenda                     — citas, recordatorios, cierre de cita → ingreso
│
├── Copiloto                   — centro de interacción en lenguaje natural
│   ├── Consulta (ya implementado): balance, transacciones, presupuesto
│   │   reconstruido, metas reconstruidas, reportes, insights, RAG documental
│   └── Acción (propuesto, no implementado): registrar ingreso/gasto/cita,
│       marcar reportado, generar reporte, crear/cerrar temporada
│       — siempre vía propuesta → confirmación (ver documento de arquitectura)
│
└── Más
    ├── Negocio (Temporadas, Reportes)
    ├── Inteligencia (Análisis inteligente — Insight Engine real)
    ├── Configuración (negocio, seguridad, licencia, canales, backup)
    └── Ayuda
```

Cambios respecto al mapa de la iteración 1 (`docs/architecture/16_CORE_AND_INTEGRATIONS.md`): el Copiloto dejó de ser solo un ítem de navegación — pasa a tener dos modos funcionales explícitos (Consulta y Acción), y Movimientos se reafirma como destino único de fusión (en la iteración 1 se creó la pestaña, pero `IncomeListPage`/`ExpenseListPage` siguen siendo rutas propias independientes; unificarlas de verdad es trabajo de implementación futura, no de esta iteración de diseño).
