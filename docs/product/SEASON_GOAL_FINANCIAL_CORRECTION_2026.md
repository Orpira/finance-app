# Corrección financiera de Meta de temporada

**Estado:** implementación y validación automatizada completadas; validación física pendiente  
**Fecha:** 2026-08-27  
**Alcance autorizado:** PB-META-001 a PB-META-006  
**Decisión normativa:** [ADR-032](../adr/ADR-032-SEASON-GOAL-REALIZED-NET-RESULT.md), con la regla de Adicionales sustituida por [ADR-033](../adr/ADR-033-ADDITIONALS-INCOME-NOT-PROFIT.md)

## Veredicto

La corrección queda implementada hasta PB-META-006. El cálculo financiero, las
superficies de consulta, la persistencia real y los estados visuales superan los
gates automatizados. No se autoriza todavía la validación con usuarios externos:
falta instalar el APK en un dispositivo con datos reales y retomar A03, A04,
D04, E01 y META-VAL-01 a META-VAL-06.

## Regla aprobada

Para ingresos `service_duration`, el porcentaje de temporada representa la
participación que corresponde a la profesional y se aplica exactamente una vez:

```text
ingreso neto = importe bruto × porcentaje / 100
resultado de temporada = ingresos netos realizados - egresos realizados
progreso de Meta = resultado de temporada / meta económica × 100
```

Un importe bruto de 100 con 30 % produce un neto de 30. Un porcentaje de 0 %
produce 0; la opción "No aplica porcentaje" persiste 100 %. El método
`hourly_workday` conserva su regla independiente y no aplica porcentaje de
temporada.

Los Adicionales se incorporan al agregado de Ingresos mediante el valor
almacenado, pero desde ADR-033 se excluyen del resultado de Meta y de toda
métrica de Ganancia. Los ajustes de ingreso y egreso permanecen separados y no
forman parte del resultado de Meta. El porcentaje matemático puede ser negativo
o superior a 100 %; sólo la barra visual se limita a 0–100 %.

## Causas raíz

- Agenda persistía un neto correcto, pero invocaba el cálculo directamente en vez
  del Strategy común usado por el alta manual.
- Movimientos presentaba `totalAmount` bruto, aunque Inicio agregaba el snapshot
  neto. Un servicio de 100 al 30 % podía verse como 100 en una superficie y 30
  en otra.
- La Meta recibía sólo ingresos, ignoraba egresos y normalizaba resultados
  negativos a cero.
- Temporadas y Reportes reconstruían el progreso por caminos distintos y parte
  de la consulta histórica sólo consideraba `earningPeriodId`.

## Implementación PB-META

| ID | Estado | Resolución y evidencia |
| --- | --- | --- |
| PB-META-001 | Implementado | Agenda usa `runIncomeCalculation('service_duration', ...)`, comparte Strategy con el alta manual y conserva una sola aplicación del porcentaje. |
| PB-META-002 | Implementado | Inicio mantiene su agregado canónico sobre snapshots netos; el recorrido real confirma que el ingreso creado desde Agenda aporta 30, no el bruto 100. Movimientos usa el valor neto almacenado. |
| PB-META-003 | Implementado | Los gastos de la temporada reducen el resultado; editar y eliminar un gasto recalcula el derivado sin guardar un acumulado paralelo. |
| PB-META-004 | Implementado | `calculateSeasonFinancialResult` produce `{ netIncome, expenses, result }` y `getSeasonGoalProgress` aplica una única fórmula de progreso. |
| PB-META-005 | Implementado | Pruebas de contrato comparan alta manual y Agenda para 0 % y 30 %; IndexedDB real verifica idempotencia y snapshots. |
| PB-META-006 | Implementado | Sin meta, cero, parcial, exacta, superior al 100 % y negativa tienen cobertura de dominio y presentación. |

Superficies conectadas: [Inicio](../../src/pages/Home/HomePage.tsx),
[Movimientos](../../src/pages/Movements/MovementsPage.tsx),
[Reportes](../../src/pages/Reports/ReportsPage.tsx),
[Temporadas](../../src/pages/Seasons/SeasonDetailPage.tsx) y
[tarjeta de Meta](../../src/components/seasons/SeasonGoalCard.tsx).

## Persistencia y compatibilidad

- No cambia el esquema Dexie y no existe migración asociada.
- No se reescriben ingresos, egresos, tasas ni balances históricos.
- Los agregados consumen `baseCurrencyValue`, `secondaryCurrencyValue`,
  `eurValue` y `copValue` almacenados; para otras monedas se usa el valor original
  sólo cuando coincide la moneda solicitada.
- El alias histórico `seasonPeriodId` sigue siendo consultable mediante sus
  índices existentes. Si un registro contiene dos identificadores de temporada
  incompatibles, el derivado financiero lo rechaza de forma fail-closed.
- Modo Personal y modo Profesional se aíslan antes de agregar.

## Evidencia automatizada

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- Pruebas focales de dominio, Agenda, Inicio, Movimientos, Meta y snapshots:
  aprobadas.
- `npm run test`: 207 archivos, 2.302 pruebas aprobadas, 1 `todo` preexistente y
  0 fallos.
- `npm run build`: aprobado; permanece el aviso conocido del chunk principal de
  aproximadamente 1,13 MB.
- `npm run test:indexeddb`: aprobado en HeadlessChrome 152. El recorrido añade 16
  comprobaciones financieras: cita finalizada una sola vez; bruto 100;
  porcentaje 30; neto y snapshot 30; paridad en Inicio, Reportes y Temporadas;
  gasto realizado; y recálculo tras editar o eliminar ingreso y egreso.
- Generación PDF real dentro del harness: 52.584 bytes.
- `git diff --check`: aprobado.

## APK

- Archivo: `dist/apk/private-balance-1.0.5-6-debug.apk`.
- Versión: `1.0.5 (6)`; paquete `com.financeapp.app`; compile SDK 36.
- Tamaño: 10.842.686 bytes.
- SHA-256:
  `97cdab9996f9ce62452afe503b377c80958244d336ddad847871671debae2458`.
- El archivo distribuible es idéntico byte a byte a
  `android/app/build/outputs/apk/debug/app-debug.apk`.
- `apksigner`: APK Signature Scheme v2 válido, un firmante debug; SHA-256 del
  certificado
  `57d0425a670a906f169647c2c0ed02fa85fe7b56a1d2bb3939aa2a995be69a17`.

Ninguna compilación anterior representa PB-META-001 a PB-META-006.

## Validación física pendiente

Se debe instalar el APK exacto como actualización, sin desinstalar la aplicación,
para conservar IndexedDB. La siguiente pasada debe retomar A03, A04, D04, E01 y
META-VAL-01 a META-VAL-06, comprobar datos históricos y nuevos, revisar Inicio,
Movimientos, Temporadas y Reportes, y confirmar que no hay excepciones críticas
en Logcat.

Hasta completar esa matriz:

- no se declara certificación física;
- no se autoriza el APK para usuarios externos;
- no se afirma regresión cero absoluta en PWA o Android real.

## Backlog excluido

Los siguientes elementos sólo quedan registrados; no se implementan en este
alcance:

| ID | Idea futura | Motivo de exclusión |
| --- | --- | --- |
| PB-META-FUTURE-001 | Ritmo realizado de la Meta | Requiere una nueva regla temporal y no corrige el resultado actual. |
| PB-META-FUTURE-002 | Importe necesario por día | Depende de calendario, días disponibles y decisiones de producto aún no aprobadas. |
| PB-META-FUTURE-003 | Proyección del resultado al cierre | Introduce estimación y supuestos ajenos al cálculo realizado. |
| PB-META-FUTURE-004 | Incorporar Agenda prevista a proyecciones | Mezclaría actividad futura con movimientos realizados y requiere un contrato separado. |

## Límites

No se implementaron ritmo, necesidad diaria, proyección ni Agenda prevista. No
se modificaron Constitución, licencias, automatización, integraciones externas,
esquema Dexie ni material histórico.
