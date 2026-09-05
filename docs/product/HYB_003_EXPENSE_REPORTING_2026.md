# HYB-003 — Estado de reporte visible en Egresos

**Fecha:** 2026-09-04  
**Área:** Movimientos / estado de reporte  
**Severidad confirmada:** Alta  
**Estado:** corregido automáticamente; aceptación manual pendiente.

## Veredicto y causa raíz

El defecto era real y permitía persistir gastos como reportados. La condición central estaba invertida: en Profesional autorizaba ingresos de servicio, pero en Personal autorizaba gastos normales. `ExpenseListPage` reutilizaba esa condición para mostrar y ejecutar la acción y `expenseService` aceptaba los campos de reporte.

La regla vigente es ahora: solo un registro discriminado como ingreso ordinario, perteneciente al contexto activo y con la experiencia de reporte habilitada puede marcarse como reportado. El modo nunca convierte un gasto en reportable.

## Auditoría

| Referencia | Archivo | Ingresos | Afectaba egresos | Corrección |
| --- | --- | ---: | ---: | --- |
| `canMarkAsReported` / `toggleReportStatus` | `src/utils/reportStatus.ts` | Sí | Sí | Regla única por tipo real; gastos y citas siempre rechazados |
| Acción, badge y metadatos individuales | `src/pages/Expenses/ExpenseListPage.tsx` | No | Sí | Eliminados completamente de Egresos |
| Bloqueo de edición “Egreso reportado” | `src/pages/Expenses/ExpensesPage.tsx` | No | Sí | Eliminado; campos históricos ya no bloquean el gasto |
| Escritura y lectura de gastos | `src/services/expenseService.ts` | No | Sí | Crear/actualizar rechazan campos de reporte; lecturas los descartan; borrar no consulta estado de reporte |
| Listado y selección masiva | `src/pages/Income/IncomeListPage.tsx` | Sí | No | Ya opera exclusivamente con `ServiceIncome`; conserva selección separada |
| Servicio individual y masivo | `src/services/incomeReport.service.ts` | Sí | No directamente | Exige configuración activa y prevalida el lote completo antes de escribir |
| “Todos” | `src/pages/Movements/movementPresentation.ts` | Sí | Campos históricos | Los gastos se proyectan sin `reportBadge` ni `reported` |
| Filtro reportado en “Todos” | `src/pages/Movements/movementFilters.ts` | Sí | No | Ya discrimina `movement.kind === 'income'` |
| Tablas/texto de reportes | `src/pages/Reports/ReportsPage.tsx` | Sí | Sí | Estado y filtro de reporte retirados de gastos |
| Herramienta financiera IA | `src/intelligence/ai-tools/financial/transactionsTool.ts` | Sí | Sí | Los gastos usan estado neutral `cleared`; nunca derivan `reported` de campos históricos |
| Propuesta/ejecución del Copiloto | `copilotActionProposalService.ts`, `assistantExecutionService.ts` | Sí | No | Contrato `mark_income_reported` y consulta exclusiva de `db.services` |
| Backup/restauración | `src/database/db.ts` | Sí | Sí | Importación elimina los cinco campos equivalentes de reporte en gastos |
| Contador de pendientes | `incomeReport.service.ts` | Sí | No | Solo recorre `db.services`; devuelve vacío si la configuración está desactivada |

## Comportamiento

- Antes: un gasto Personal normal podía mostrar “Marcar como reportado”, persistir `reportStatusCode/reportedAt`, quedar bloqueado y reaparecer como reportado.
- Ahora: ningún gasto Personal, Profesional o Híbrido muestra estados o acciones de reporte, participa en selección de reporte, altera contadores ni puede recibir esos campos mediante los servicios públicos.
- Ingresos: conservan marcado individual y masivo en ambos contextos cuando `showUnreportedIncome` está habilitado. Al deshabilitarlo no se muestran ni ejecutan funciones de reporte ni se calculan pendientes.
- Lotes: todos los IDs se validan antes de la primera escritura; un ID inexistente o no reportable aborta el lote sin modificación parcial.

## Datos históricos y migración

El esquema histórico añadió campos/índice de reporte también a gastos y citas, por lo que pueden existir gastos antiguos con esos campos. Ya no tienen efecto funcional: las lecturas del servicio los descartan y una restauración los elimina antes de persistir.

No se añadió una versión Dexie. Una limpieza física no aporta beneficio funcional suficiente para justificar una migración: tocaría registros históricos solo para retirar propiedades ignoradas. Si se desea compactación física en el futuro, requiere autorización explícita y una migración aditiva nueva.

## Validación

Cobertura focalizada:

- ingresos reportables y gastos rechazados en `basic` y `professional`;
- Híbrido queda cubierto mediante la resolución a esos dos contextos activos;
- gastos históricos no cuentan como reportados ni proyectan badge en “Todos”;
- lista de Egresos sin textos, helpers ni mutaciones de reporte;
- filtro de “Todos” aplica reporte exclusivamente a ingresos;
- configuración desactivada rechaza escritura y devuelve cero pendientes;
- lote mixto/inválido no realiza escrituras parciales;
- herramienta del Copiloto no presenta gastos como reportados.

## Validación Android física

El 2026-09-05 se actualizó físicamente un Samsung SM-A165F, Android 16/API 36, mediante `adb install -r`, sin desinstalar ni borrar datos:

- APK: `private-balance-1.0.6-7-debug.apk`.
- SHA-256: `2232f9db5701bb442ce1819967a540c10daffe8cfd79847612bf7ee1783bbcca`.
- Instalación: `Success`.
- `firstInstallTime`: `2026-09-03 16:00:34`, conservado.
- `lastUpdateTime`: `2026-09-05 00:25:50`, actualizado.
- Arranque en frío: correcto, actividad `com.financeapp.app/.MainActivity`, 1.920 ms.
- Versión runtime: `1.0.6 (7)`; WebView `151.0.7922.200`.
- Perfil observado: Personal existente, con ingresos y gastos preservados.
- `Movimientos → Egresos`: los gastos muestran únicamente `Modificar` y `Eliminar`; no aparecen estados, checkbox ni acciones de reporte.
- `Movimientos → Todos`: el gasto aparece sin badge de reporte.
- AndroidRuntime: sin excepciones ni cierres.

Logcat registró tres mensajes al inicio de `Capacitor/Console` sobre inyección de CSS de safe-area contra un nodo nulo. La aplicación continuó funcionando y el mensaje no guarda relación aparente con HYB-003; queda como riesgo técnico separado.

La validación manual en navegador y los recorridos físicos Profesional/Híbrido —incluidos cinco cambios de contexto— siguen pendientes. Por ello HYB-003 no se declara aceptado definitivamente, aunque la corrección, el perfil Android Personal y sus defensas automáticas están validados.

## Riesgos residuales

- Las propiedades históricas pueden permanecer físicamente en IndexedDB hasta que el registro se reescriba o se restaure un backup; son inertes.
- La inspección visual manual en navegador continúa siendo obligatoria para cerrar el criterio 13.
