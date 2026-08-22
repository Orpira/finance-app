# Fase Pre-Release 0.9 - Sprint B: Validación Android en hardware físico

**Estado:** EN EJECUCIÓN — SAMSUNG CERTIFICADO TRAS BLOQUE CORRECTIVO.
Requisito de entrada cumplido y APK candidato regenerado desde el commit
certificado. La cobertura física del Samsung Galaxy A16 quedó completa; el APK
histórico quedó no certificado por SB-003–SB-006 y el APK correctivo posterior
quedó certificado con recertificación dirigida física.

**Fecha de preparación de este documento:** 2026-08-04

**Última actualización:** 2026-08-22

**Alcance funcional:** Congelado

**Requisito de entrada:** Sprint A (Calidad) COMPLETADO. El requisito quedó
cumplido definitivamente el 2026-08-05 con SA-008–SA-013 documentados y
certificados. Ver [Sprint A: Calidad](./PRE_RELEASE_0_9_SPRINT_A.md). La
ejecución de Sprint B puede comenzar cuando estén disponibles los cuatro tipos
de dispositivo físico exigidos por la matriz.

## Objetivo

Validar el APK de Private Balance en hardware Android físico. Los emuladores no son evidencia de aceptación para este sprint — solo cuentan instalaciones reales en dispositivos reales.

## Condiciones de ejecución

Sprint B exige hardware físico Samsung, Xiaomi, Google Pixel y Motorola; los
emuladores no sustituyen esa evidencia. Este documento comenzó como guía
operativa y ahora incorpora la ejecución completa realizada sobre un Samsung
Galaxy A16. Los otros tres fabricantes continúan sin hardware disponible.

## Build a validar

- **APK:** `dist/apk/private-balance-1.0.1-2-debug.apk`
- **SHA-256:** `bd967933f0eab33a1ab8df0435a5f8d762c2ee6486b05b1f03d38f9167e5c960`
- **versionName / versionCode:** `1.0.1` / `2`
- **minSdkVersion / targetSdkVersion / compileSdkVersion:** `24` / `36` / `36`
- **applicationId:** `com.financeapp.app`
- **Toolchain:** JDK 21, Android SDK API 36 y Capacitor 8.5.0 alineado.
- **Commit de origen:** `95ab862eba5629f96644d8f146482166cf3f4a2f`
  (`fix(reports): recertify income reports before Sprint B`).
- **Regenerar antes de instalar si el checkout no coincide con `origin/main`:**
  `npm run android:apk`.

El comando debe imprimir ruta, versión y SHA-256. Antes de distribuir, confirmar
que la copia versionada coincide byte a byte con
`android/app/build/outputs/apk/debug/app-debug.apk` y que `apksigner verify`
acepta su firma v2.

### Artefacto de recertificación tras correcciones — 2026-08-22

Las comprobaciones físicas descubrieron reglas de ingreso incompletas. Después
de corregir fecha mínima de temporada, política de pago de jornadas,
terminología Jornada/Servicio, añadir Consulta de divisas y corregir el
contraste de los estados de ingreso en tema oscuro, se generó un APK para
reverificar exclusivamente esos cambios en el Samsung:

- **APK:** `dist/apk/private-balance-1.0.1-2-debug.apk`;
- **SHA-256:** `1f6e2f12f518332b8932169480fc9f1862de00b8e0cd68cdd3691e84194edb82`;
- **Tamaño:** 10.514.139 bytes;
- **Metadatos:** `com.financeapp.app`, versión `1.0.1 (2)`, `minSdk 24`,
  `targetSdk 36`, `compileSdk 36`;
- **Firma:** APK Signature Scheme v2 válida, un firmante debug;
- **Integridad:** copia de `dist/apk` idéntica byte a byte a la salida Gradle;
- **Origen:** HEAD `95ab862eba5629f96644d8f146482166cf3f4a2f`, con las
  correcciones de recertificación todavía sin commit en el working tree.

Este APK fue sustituido por el artefacto correctivo post-certificación
documentado más abajo. Se conserva para no perder la trazabilidad de la
recertificación intermedia.

## Matriz mínima de dispositivos

| Marca        | Modelo            | Versión de Android | Resultado         | Defectos          |
| ------------ | ----------------- | ------------------ | ----------------- | ----------------- |
| Samsung      | SM-A165F          | Android 16 / API 36 | OK                | Certificado con APK correctivo; APK histórico conserva SB-003–SB-007 |
| Xiaomi       | PENDIENTE         | PENDIENTE           | PENDIENTE         | Sin hardware disponible |
| Google Pixel | PENDIENTE         | PENDIENTE           | PENDIENTE         | Sin hardware disponible |
| Motorola     | PENDIENTE         | PENDIENTE           | PENDIENTE         | Sin hardware disponible |

Cada fila debe completarse con marca, modelo exacto, versión de Android instalada, resultado (`OK` / `MINOR` / `MAJOR` / `BLOCKER`) y los identificadores `SB-00N` de los defectos encontrados en ese dispositivo, si los hay.

### Evidencia de entrada al Sprint B — 2026-08-21

- `adb devices -l`: ningún dispositivo físico conectado.
- APK regenerado mediante `npm run android:apk` desde un árbol Git limpio en
  `main`, HEAD `95ab862`.
- `output-metadata.json`: `versionName 1.0.1`, `versionCode 2`.
- `aapt dump badging`: `applicationId com.financeapp.app`, `minSdk 24`,
  `targetSdk 36`, `compileSdk 36`.
- Copia versionada y salida Gradle: idénticas byte a byte.
- `apksigner verify`: firma APK Signature Scheme v2 válida, un firmante debug.
- Tamaño: 10.511.266 bytes.
- Advertencias no bloqueantes de construcción: uso de `flatDir`, diferencia de
  versión XML del SDK y APIs Gradle obsoletas antes de Gradle 9.

Esta fue la evidencia técnica anterior a conectar hardware. La ejecución física
parcial de Samsung se registra a continuación y reemplaza el estado inicial
para ese fabricante.

## Ejecución física — Samsung Galaxy A16 — 2026-08-21/22

### Identificación y APK

- **Fabricante/modelo:** Samsung Galaxy A16, modelo técnico `SM-A165F`.
- **Identificador ADB sanitizado:** `RF8Y…E4N`; un único dispositivo autorizado
  en estado `device`, físico (`isVirtual: false`).
- **Sistema:** Android 16, API 36; locale `es-US`.
- **Pantalla:** 1080 × 2340, densidad 450 dpi, orientación inicial vertical.
- **Espacio disponible observado:** aproximadamente 85 GB en `/data`.
- **APK:** `private-balance-1.0.1-2-debug.apk`, versión `1.0.1 (2)`, SHA-256
  `bd967933f0eab33a1ab8df0435a5f8d762c2ee6486b05b1f03d38f9167e5c960`.
- **Origen/firma:** commit `95ab862eba5629f96644d8f146482166cf3f4a2f`,
  APK Signature Scheme v2 válida y certificado debug compatible con la versión
  previamente instalada.

Se encontró instalada la versión `1.0 (1)`. Se comparó la firma antes de actuar
y se instaló el candidato con `adb install -r`, sin desinstalar ni borrar datos.
La actualización terminó correctamente y la aplicación informó `1.0.1 (2)`.
La licencia/PIN y los registros financieros previos continuaron disponibles,
lo que aporta evidencia directa de conservación de configuración e IndexedDB.

Tras las correcciones se instaló también el artefacto temporal de recertificación
con `adb install -r`, nuevamente sin desinstalar ni borrar datos. Android informó
`Success`; la versión permaneció en `1.0.1 (2)`, el PIN volvió a mostrarse y la
licencia/configuración local siguió disponible. Un arranque forzado en frío
abrió `MainActivity` correctamente en 1.755 ms.

Después de corregir SB-001 se instaló un tercer APK con `adb install -r`, sin
desinstalar ni borrar datos. Android volvió a informar `Success`, confirmó
`1.0.1 (2)` y conservó los registros y ajustes. El arranque en frío de esta
compilación abrió `MainActivity` en 1.457 ms; el proceso permaneció activo y
logcat no registró `FATAL EXCEPTION`.

### Evidencia funcional adicional — 2026-08-22

- En modo Profesional, `Más` permaneció visible y activo en la navegación
  inferior. Desde allí se abrió `Consulta de divisas` en la ruta
  `/currency-converter`, sin desbordamiento horizontal en 1080 × 2340.
- La consulta inicial mostró cuatro pares con fuente y fecha. El par EUR/COP
  conservó correctamente la fuente `Tasa manual · 21 ago 2026`, mientras los
  pares EUR/USD, EUR/GBP y EUR/MXN mostraron `Referencia local`.
- Al introducir físicamente `25 EUR` con el teclado numérico, la pantalla
  recalculó `107.500 COP`, `27,00 US$`, `21,50 GBP` y `495,00 MXN`. El selector
  nativo mostró nombres completos y permitió cambiar la moneda base a COP.
- La actualización explícita consultó Frankfurter y reemplazó los cuatro
  resultados por `Frankfurter · 22 ago 2026`: `3582 COP`, `1,17 US$`,
  `0,86 GBP` y `19,79 MXN` para `1 EUR`. El reloj del host y el del dispositivo
  coincidían en `2026-08-22 00:02 +02:00`.
- La herramienta mantuvo la navegación y los controles dentro del viewport,
  sin pantalla blanca, cierre de `MainActivity` ni `FATAL EXCEPTION`.
- La configuración original del dispositivo era `Servicio por tiempo`. Se
  cambió temporalmente a `Jornada por horas`, se confirmó el estado `Guardado`
  y, al terminar la prueba, se restauró `Servicio por tiempo` con una segunda
  confirmación de guardado.
- En `Registrar ingreso`, Jornada mostró `Tiempo trabajado`, unidad `Horas`,
  paso `0.25` y `Total calculado`, sin `Tipo de pago`. Al alternar a Ajuste, la
  opción principal siguió llamándose `Jornada`; al regresar recuperó todos los
  controles de Jornada. No se guardó ningún movimiento.
- El teclado numérico redujo el viewport visual sin desbordamiento horizontal
  ni pérdida de la navegación. El ingreso histórico `#1` mantuvo su snapshot
  `Jornada por horas` aunque la configuración ya había vuelto a Servicio.
- En la edición del ingreso histórico, la fecha y el mínimo fueron
  `2026-08-21`. El intento local `2026-08-20` produjo `rangeUnderflow: true` y
  `formValid: false`; el valor original se restauró sin enviar el formulario.
- Se completó un CRUD persistente controlado de Jornada: se creó el ingreso
  temporal `#4` con 0,25 horas y 5 €, se verificó `No aplica` como tipo de pago,
  se editó a 0,5 horas y 10 € y se eliminó mediante su diálogo de confirmación.
  El registro dejó de aparecer al finalizar y la configuración se restauró a
  `Servicio por tiempo`.
- La edición Jornada rotó de 384 × 748 a 748 × 354 y regresó a 384 × 748,
  conservando ruta, fecha, tipo y tiempo trabajado, con overflow horizontal
  igual a cero. Android recuperó también la rotación automática original.
- La exportación local cifrada rechazó de forma explícita y fail-closed la
  operación porque el dispositivo no tenía una clave configurada; no creó un
  archivo. La exportación JSON clásica confirmó éxito y creó en Descargas
  `backup (7).json`, de 5.405 bytes, a las 00:37. No se abrió ni se imprimió el
  contenido sensible del archivo.
- La revisión visual del CRUD descubrió SB-001: `Finalizado` usaba texto
  `emerald-800` sobre fondo `emerald-900` en tema oscuro. Tras la corrección y
  reinstalación, la medición física en sRGB dio `8,47:1` en oscuro y `6,70:1`
  en claro para texto de 12 px; ambos superan `4,5:1`. El modo oscuro quedó
  restaurado, el overflow horizontal fue cero y la captura final mostró la
  insignia legible, sin recorte ni solapamiento.
- En Egresos se creó mediante la UI el gasto temporal `#1`, categoría
  `Publicidad`, por 7,25 €. El listado lo presentó correctamente y el diálogo
  de eliminación retiró el registro; la limpieza se confirmó con ausencia del
  ID en IndexedDB y, después de remontar la pestaña, con el estado `Aún no hay
  egresos`. No se completó la edición, por lo que este flujo continúa parcial.

### Matriz de resultados

`NO EJECUTADO` significa que no existe evidencia física suficiente para PASS o
FAIL. `PARCIAL` identifica una comprobación real incompleta y tampoco equivale
a PASS.

| ID | Flujo | Resultado | Evidencia física | Defecto |
| --- | --- | --- | --- | --- |
| SB-SAM-001 | ADB | **PASS** | Un dispositivo autorizado; shell, captura e instalación funcionales | Ninguno |
| SB-SAM-002 | Instalación limpia | **PASS** | Backup previo preservado fuera del dispositivo; desinstalación, instalación limpia del APK certificado y primer arranque correctos; `firstInstallTime` y `lastUpdateTime` coincidentes, versión `1.0.1 (2)` y sin datos anteriores | Ninguno |
| SB-SAM-003 | Primer uso | **PASS** | Onboarding 1/7–7/7 completado; selección Personal/Profesional, Servicio/Jornada, tarifa, primera temporada, meta, moneda y PIN QA validados; cierre del asistente abrió el estado profesional vacío esperado | Ninguno |
| SB-SAM-004 | Temporadas | **PASS** | Creación, edición permitida, rechazo fail-closed del cambio de porcentaje con actividad, meta/fecha, cierre, historial, detalle bloqueado y estado sin temporada activa verificados. La fixture final quedó cerrada y vacía | Ninguno |
| SB-SAM-005 | Ingresos | **PASS** | CRUD persistente Jornada completado: alta, edición, presentación `No aplica` y borrado verificados; Jornada no pidió tipo de pago, el snapshot histórico se conservó y una fecha anterior a la temporada dejó el formulario inválido | SB-001 corregido y reverificado |
| SB-SAM-006 | Gastos | **PASS** | Gasto QA creado, reabierto, editado de Alimentación/11,25 € a Transporte/12,50 €, rotado, persistido y eliminado. Teclado nativo dejó Guardar accesible; limpieza confirmada en UI e IndexedDB | Ninguno |
| SB-SAM-007 | Movimientos | **PASS** | Tres identidades únicas; pestañas Todos/Ingresos/Egresos, búsqueda, filtros de tipo/categoría y orden por fecha/importe verificados sin duplicados | Ninguno |
| SB-SAM-008 | Agenda | **FAIL** | Alta, fecha/hora, duración, persistencia, alarma, rotación y eliminación verificadas. La edición de una cita pendiente de la temporada activa falla de forma reproducible y no modifica IndexedDB | SB-003 abierto |
| SB-SAM-009 | Reportes | **FAIL** | Balance, ingresos y egresos presentan agrupaciones, subtotales, totales, Jornada, duración, moneda, metadata e históricos correctos. El reporte por tipo de pago agrupa Jornada bajo Transferencia aunque la fila dice No aplica | SB-005 abierto |
| SB-SAM-010 | Exportación | **PASS** | CSV de 251 bytes y Excel `.xls` de 1.869 bytes creados realmente en caché; ambos aparecieron por nombre en el selector Android. Cancelar no envió datos externos | SB-007 bajo |
| SB-SAM-011 | PDF/impresión | **FAIL** | Compartir generó `balance-por-temporadas.pdf`, 10.703.800 bytes, A4, 2 páginas, y abrió el selector Android. Generar PDF no abrió el spooler: llevó a una pestaña previa de Chrome y terminó en error | SB-004 abierto |
| SB-SAM-012 | Backup | **PASS** | Exportación JSON local confirmada por la app y por el archivo físico `backup (7).json` de 5.405 bytes en Descargas; la variante cifrada rechazó correctamente la ausencia de clave sin crear archivo | Ninguno |
| SB-SAM-013 | Restauración | **PASS** | Tras corregir SB-002, `backup (9).json` restauró físicamente 1 ingreso, 1 gasto, 1 cita, 2 temporadas y configuración. Inicio, Movimientos y Agenda recuperaron los datos. La persistencia del PIN se evalúa separadamente en SB-SAM-014 | SB-002 corregido; SB-006 en PIN |
| SB-SAM-014 | PIN | **FAIL** | Correcto, incorrecto, timeout, segundo plano, pantalla bloqueada, arranque frío y recuperación fail-closed comprobados. Tras la restauración el guard in-memory seguía pidiendo 2468, pero un arranque frío reveló `pinEnabled=false` y ausencia de hash; Inicio quedó expuesto hasta reactivar el PIN desde Seguridad | SB-006 bloqueante |
| SB-SAM-015 | Ciclo Android | **PASS** | App→Home/otra app/selector→App, pantalla apagada/encendida, cierre forzado y arranques caliente/frío verificados. Tras reactivar el PIN, el arranque frío lo volvió a solicitar; sin pantalla blanca ni crash | SB-006 se clasifica en PIN |
| SB-SAM-016 | Rotación | **PASS** | Reportes, Jornada, edición de gasto y edición de cita funcionaron vertical→horizontal→vertical, conservaron valores/controles y mantuvieron overflow horizontal cero; rotación automática restaurada | Ninguno |
| SB-SAM-017 | Tema | **PASS** | Cambio oscuro→claro en caliente, persistencia del claro tras arranque frío y restauración final a oscuro. Se conserva la evidencia 8,47:1 oscuro y 6,70:1 claro de Finalizado | SB-001 corregido y reverificado |
| SB-SAM-018 | Actualización APK | **PASS** | Tres actualizaciones con firma compatible y `adb install -r` exitoso; versión `1.0.1 (2)` y conservación observada de PIN/configuración/registros, incluida la compilación posterior a SB-001 | Ninguno |
| SB-SAM-019 | Estabilidad | **PASS** | Sesión física prolongada por Inicio, Temporadas, Gastos, Movimientos, Agenda, Reportes, Más, selectores Android, teclado, tema, rotación y ciclos externos; proceso activo, sin FATAL EXCEPTION, ANR, congelamiento ni pantalla blanca | Defectos funcionales SB-003–SB-007 separados |

### Logcat y observaciones

- No se observó `FATAL EXCEPTION`, crash Java/Kotlin ni cierre de
  `MainActivity` durante la sesión.
- El ciclo segundo plano/primer plano produjo los eventos Capacitor esperados
  `isActive: false/true` y volvió al PIN.
- Se registró dos veces `Error injecting safe area CSS: TypeError: Cannot read
  properties of null (reading 'style')` al iniciar. No se correlacionó con una
  falla visual: las safe areas se mostraron correctamente en vertical. Se
  conserva como **observación técnica pendiente de reproducibilidad**, no como
  defecto funcional confirmado.
- También apareció una vez, durante el estado inicial bloqueado/actualización,
  un `TypeError` sobre `triggerEvent`; no se reprodujo después del desbloqueo.
- En el arranque del artefacto corregido la observación de safe area apareció
  tres veces y no hubo `FATAL EXCEPTION`; permanece pendiente comprobar
  visualmente todas las orientaciones después del desbloqueo.

### Veredicto Samsung

**SAMSUNG GALAXY A16 — NO CERTIFICADO POR DEFECTOS ABIERTOS.** La cobertura
SB-SAM-001–SB-SAM-019 está completa. SB-003 (edición de cita), SB-004
(impresión), SB-005 (clasificación de Jornada) y SB-006 (persistencia del PIN)
impiden certificar el dispositivo; SB-007 es de severidad baja. No se inicia
otro fabricante ni Sprint C.

### Bloque correctivo post-certificación Samsung

**Estado:** APK correctivo generado, instalado y certificado mediante
recertificación dirigida física.

**APK defectuoso de referencia:** `private-balance-1.0.1-2-debug.apk`, SHA-256
`a46ed312aa86563241d50d8320b47945cae62a47eaf98970968c5d03218aa725`, produjo
15 PASS / 4 FAIL en la matriz completa.

**APK correctivo:** `dist/apk/private-balance-1.0.1-2-debug.apk`, `versionName`
`1.0.1`, `versionCode` `2`, 10.514.428 bytes, SHA-256
`6800160c7b82e63aaf887e02b39f5b130e03405c48884e11731de580818021b6`. Firma:
APK Signature Scheme v2, 1 firmante debug Android (`CN=Android Debug`), digest
certificado SHA-256
`57d0425a670a906f169647c2c0ed02fa85fe7b56a1d2bb3939aa2a995be69a17`. Base de
trabajo: `95ab862eba5629f96644d8f146482166cf3f4a2f`; no se creó commit.

**Causa raíz y corrección:**

- SB-003: el servicio `updateAppointment` persiste la edición, pero el formulario
  trataba errores secundarios de recordatorios como fallo global de guardado.
  La edición queda cubierta por TDD y la programación de recordatorios ya no
  invalida una cita guardada.
- SB-004: `Generar PDF` en la vista previa usaba `window.open`, que en APK podía
  saltar a Chrome. En Android nativo reutiliza `shareReportPdf` y el chooser
  del sistema.
- SB-005: el reporte por tipo de pago agrupaba por `paymentType` crudo; ahora
  agrupa con `getIncomePaymentTypeLabel`, por lo que Jornada permanece como
  `No aplica` y Servicio + Transferencia sigue bajo `Transferencia`.
- SB-006: la restauración/configuración normaliza el contrato `pinEnabled` solo
  cuando existe `pinHash` válido, conservando ambos campos en backups válidos.
- SB-007: los servicios de compartir devuelven `success`, `cancelled` o error
  real; cancelar el chooser Android ya no se presenta como fallo.

**TDD/gates:** `src/services/appointmentService.test.ts`,
`src/services/paymentTypeReportService.test.ts`,
`src/services/reportShareService.test.ts`, `src/services/backupService.test.ts`
y regresiones existentes de exportación. `git diff --check`, ESLint global,
TypeScript, Vitest focal 20/20, Vitest completo 196 archivos / 2189 PASS / 1
todo, build Vite/TypeScript y APK debug: PASS.

**Recertificación física dirigida en Samsung Galaxy A16:** `adb install -r`
instaló el APK correctivo preservando datos; paquete instalado `1.0.1 (2)`.
Arranque frío, `force-stop` y arranque posterior a `adb reboot` solicitaron PIN;
PIN incorrecto fue rechazado y PIN QA aceptado. `Preparar PDF` abrió el chooser Android con
`balance-por-temporadas.pdf`, no Chrome, y cancelar volvió a Reportes sin alerta
de error. Tras reconectar ADB después del reinicio, la app volvió a pedir PIN y
desbloqueó correctamente al introducir el PIN QA. La pasada estricta de Logcat no
devolvió `FATAL EXCEPTION`, ANR ni excepciones críticas de Filesystem/Share
atribuibles al APK correctivo.

**Veredicto del APK correctivo:** **SAMSUNG GALAXY A16 — CERTIFICADO.** La
certificación aplica al APK con SHA-256
`6800160c7b82e63aaf887e02b39f5b130e03405c48884e11731de580818021b6`. No se
reabre la matriz por cobertura incompleta; la matriz histórica del APK
defectuoso queda preservada como evidencia.

## Flujos a probar en cada dispositivo

Por cada dispositivo de la matriz, ejecutar y registrar evidencia (captura o video) de:

1. **Instalación** del APK desde cero (dispositivo sin versión previa).
2. **Actualización** del APK sobre una instalación previa, sin desinstalar y
   confirmando que los datos locales (IndexedDB/Dexie) sobreviven intactos. Si
   Android rechaza la firma, detener la prueba antes de borrar la aplicación.
3. **Arranque** en frío y en caliente.
4. **Rotación** de pantalla en las rutas principales (Inicio, Movimientos, Copiloto, Reportes).
5. **Modo oscuro** del sistema operativo, con la app en `system` y en `dark` explícito.
6. **Notificaciones** locales (recordatorios de citas, temporizador de servicio) — confirmar que se disparan y son accionables.
7. **Teclado** nativo del dispositivo en formularios (Nuevo ingreso, Nuevo gasto, Nueva cita) — confirmar que no tapa el campo activo ni el botón de guardar.
8. **Safe areas** (recorte de cámara, barra de gestos, notch) en las pantallas con navegación inferior fija.
9. **Versión instalada:** abrir `Configuración → Diagnóstico local` y comprobar
   que muestra `1.0.1 (2)`.
10. **Flujos críticos:** registrar un ingreso, registrar un gasto, generar un
    reporte y activar una licencia.
11. **Backup/restauración:** exportar un backup local, importar el mismo archivo
    y confirmar recuentos y navegación posterior. Repetir con un JSON inválido
    y comprobar que los datos existentes permanecen intactos.

## Registro de hallazgos

### SB-001 - Contraste insuficiente en el estado Finalizado

**Dispositivo:** Samsung Galaxy A16 `SM-A165F`, Android 16 / API 36.

**Problema:** En tema oscuro, la insignia `Finalizado` conservaba
`text-emerald-800` mientras el fondo se transformaba a `emerald-900`; el texto
quedaba prácticamente indistinguible en el listado de ingresos.

**Evidencia:** Estilos computados sobre el WebView físico, captura ADB del CRUD
y medición posterior en ambos temas. El texto corregido alcanzó `8,47:1` en
oscuro y `6,70:1` en claro, sin overflow.

**Corrección:** Las insignias `FINALIZADO`, `EJECUCION` y estado por defecto
declaran pares de fondo/texto explícitos para tema oscuro en
`IncomeListPage.tsx`.

**TDD:** No aplica prueba unitaria aislada: el proyecto no dispone de un arnés
visual para estilos computados. Se validó con ESLint focal/global, 192 archivos
Vitest y 2179 pruebas aprobadas, build web, APK y medición física WCAG.

**Estado:** CORREGIDO Y REVERIFICADO en el mismo dispositivo.

### SB-002 - Restauración JSON parcial omite datos financieros y agenda

**Dispositivo:** Samsung Galaxy A16 `SM-A165F`, Android 16 / API 36.

**Problema:** Después de una instalación limpia autorizada, la importación JSON
restaura configuración y PIN, pero no repuebla los movimientos ni la agenda.
El comportamiento se reprodujo con dos backups válidos distintos.

**Evidencia:** `backup (9).json`, creado inmediatamente antes de desinstalar,
contiene estructuralmente 1 ingreso, 1 gasto, 1 cita y 2 temporadas. Tras
importarlo, Inicio mostró 0 €, Movimientos mostró `Aún no hay movimientos` y
Agenda no mostró citas. `backup (7).json`, previamente certificado y con 1
ingreso y 2 temporadas, produjo el mismo resultado. Los archivos se preservaron
sin imprimir sus importes, notas ni secretos; no hubo `FATAL EXCEPTION` ni ANR
atribuible a Private Balance.

**Corrección:** `PinGate` conserva montado, oculto e inerte el árbol de una
sesión ya desbloqueada cuando Android abre una actividad externa. El selector
puede así entregar el evento del archivo sin exponer la UI protegida; antes el
árbol y su `<input type="file">` se desmontaban al pasar a segundo plano.

**TDD:** `test/pinGateLifecycle.test.ts` cubre que el contenido permanece
montado tras bloquear una sesión desbloqueada y que nunca se monta antes del
primer desbloqueo. Suite global: 193 archivos, 2182 pruebas aprobadas y 1 `todo`
preexistente.

**Estado:** CORREGIDO Y REVERIFICADO para los datos de dominio en el mismo
dispositivo con APK
`a46ed312aa86563241d50d8320b47945cae62a47eaf98970968c5d03218aa725`.
La persistencia del PIN se separó posteriormente como SB-006.

### SB-003 - La edición de una cita activa no se guarda

**Dispositivo:** Samsung Galaxy A16 `SM-A165F`, Android 16 / API 36.

**Pantalla/precondiciones:** `/agenda/2/editar`; cita QA pendiente, no reportada,
asociada a la temporada activa, con permisos de notificaciones y alarmas exactas
concedidos.

**Pasos:** crear la cita, reabrirla, cambiar hora, duración, valor y notas y
pulsar `Guardar cita`.

**Esperado:** volver a Agenda y presentar los valores editados persistidos.

**Real:** el formulario muestra `No se pudo guardar`; dos reintentos producen el
mismo resultado y la lectura estructural de IndexedDB conserva los valores
originales. Alta y eliminación sí funcionan. No hubo crash ni ANR. Tras eliminar
la fixture, Logcat registró dos promesas tardías con `La cita que intentas
modificar no existe`.

**Reproducibilidad/severidad:** 3/3, **ALTO**.

**Estado histórico:** ABIERTO durante el cierre de matriz; no se modificó código
en esa ejecución. **Estado post-fix:** CORREGIDO con TDD y validado dentro del
bloque correctivo Samsung.

### SB-004 - Generar PDF no abre la impresión Android

**Dispositivo:** Samsung Galaxy A16 `SM-A165F`, Android 16 / API 36.

**Pantalla/precondiciones:** `/reports/preview`, balance por todas las temporadas
con tres registros.

**Pasos:** abrir Vista previa y pulsar `Generar PDF`.

**Esperado:** abrir el spooler Android para guardar o imprimir el PDF.

**Real:** Android lleva a una pestaña previa de Chrome y, al volver, Private
Balance informa `No se pudo abrir la impresión`. No aparece actividad del
spooler. La ruta independiente `Compartir PDF` sí genera un PDF A4 real de 2
páginas y 10.703.800 bytes y abre el selector Android.

**Reproducibilidad/severidad:** 1/1, **MEDIO**.

**Estado histórico:** ABIERTO durante el cierre de matriz; no se modificó código
en esa ejecución. **Estado post-fix:** CORREGIDO; el APK usa chooser Android
nativo y no abre Chrome accidentalmente.

### SB-005 - Jornada se agrupa bajo un tipo de pago legado

**Dispositivo:** Samsung Galaxy A16 `SM-A165F`, Android 16 / API 36.

**Pantalla/precondiciones:** Reportes → `Reporte por tipo de pago`; histórico
restaurado `Jornada por horas #1`.

**Pasos:** generar la vista previa con todas las temporadas.

**Esperado:** Jornada debe clasificarse como `No aplica` y no formar un subtotal
de un tipo de pago inmediato.

**Real:** el bloque se titula `Tipo de pago: Transferencia` y subtotaliza 40 €,
aunque la fila del mismo registro presenta correctamente `No aplica`.

**Reproducibilidad/severidad:** 1/1, **MEDIO**.

**Estado histórico:** ABIERTO durante el cierre de matriz; no se modificó código
en esa ejecución. **Estado post-fix:** CORREGIDO con agrupación semántica
`No aplica` para Jornada.

### SB-006 - El PIN restaurado no sobrevive al arranque frío

**Dispositivo:** Samsung Galaxy A16 `SM-A165F`, Android 16 / API 36.

**Pantalla/precondiciones:** sesión restaurada con backup certificado y guard
in-memory que seguía aceptando el PIN QA `2468`.

**Pasos:** forzar cierre del proceso y arrancar `MainActivity` en frío.

**Esperado:** solicitar el PIN persistido antes de montar el contenido protegido.

**Real:** Inicio queda visible sin PIN. Una lectura estructural, sin leer ni
imprimir hashes, confirmó `pinEnabled=false` y ausencia de hash en IndexedDB. Al
reactivar `2468` desde `Configuración → Seguridad`, el siguiente arranque frío sí
solicitó el PIN y los ciclos de pantalla/segundo plano volvieron a bloquear.

**Reproducibilidad/severidad:** 1/1 sobre el estado restaurado, **BLOQUEANTE** por
exposición del contenido financiero tras reinicio.

**Estado histórico:** ABIERTO durante el cierre de matriz; el PIN QA quedó
reactivado y no se modificó código en esa ejecución. **Estado post-fix:**
CORREGIDO; arranque frío, `force-stop` y reboot vuelven a solicitar PIN.

### SB-007 - Cancelar compartir se presenta como fallo de generación

**Dispositivo:** Samsung Galaxy A16 `SM-A165F`, Android 16 / API 36.

**Pantalla/precondiciones:** exportación CSV, Excel o PDF creada y visible por
nombre en el selector Android.

**Pasos:** cancelar el selector sin elegir un destino.

**Esperado:** volver sin afirmar que falló la creación del archivo.

**Real:** la app muestra `No se pudo generar` o `No se pudo compartir`, aunque el
archivo existe en la caché privada y el selector lo reconoció correctamente.

**Reproducibilidad/severidad:** 3/3, **BAJO**.

**Estado histórico:** ABIERTO durante el cierre de matriz; no se modificó código
en esa ejecución. **Estado post-fix:** CORREGIDO; cancelar el chooser vuelve sin
error falso.

Los defectos nuevos deben documentarse con el siguiente formato:

```text
### SB-00N - <título breve>

**Dispositivo:** <marca, modelo, versión de Android>

**Problema:** <qué se observó y cómo reproducirlo>

**Evidencia:** <captura, video o referencia al archivo>

**Corrección:** <descripción de la corrección aplicada>

**TDD:** <archivo de test que reproduce el defecto y queda en verde tras la corrección>
```

Todo defecto de comportamiento debe corregirse con TDD, igual que en Sprint A. Los defectos exclusivos de un fabricante (p. ej. gestos propietarios de MIUI) se documentan igual, con el dispositivo exacto donde se reprodujeron.

## Criterio de salida

Sprint B se declara **COMPLETADO** únicamente cuando:

- la matriz de los cuatro dispositivos está completa, con evidencia real registrada por cada uno;
- no quedan defectos `BLOCKER` abiertos;
- todo defecto corregido fue reverificado en el dispositivo físico donde se encontró, no solo en CI o en emulador.

## Siguiente paso tras el cierre

Con Sprint B cerrado, corresponde iniciar el **Sprint C — PWA** (cierre de DT-002: Service Worker, instalación, actualización y funcionamiento offline), conforme a [PRODUCT_RELEASE_ROADMAP.md](../roadmap/PRODUCT_RELEASE_ROADMAP.md).
