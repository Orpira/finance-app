# Fase Pre-Release 0.9 - Sprint B: Validación Android en hardware físico

**Estado:** Listo para ejecutar — requisito de entrada cumplido y APK técnico
designado; pendiente de acceso a hardware físico.

**Fecha de preparación de este documento:** 2026-08-04

**Última actualización:** 2026-08-09

**Alcance funcional:** Congelado

**Requisito de entrada:** Sprint A (Calidad) COMPLETADO. El requisito quedó
cumplido definitivamente el 2026-08-05 con SA-008–SA-013 documentados y
certificados. Ver [Sprint A: Calidad](./PRE_RELEASE_0_9_SPRINT_A.md). La
ejecución de Sprint B puede comenzar cuando estén disponibles los cuatro tipos
de dispositivo físico exigidos por la matriz.

## Objetivo

Validar el APK de Private Balance en hardware Android físico. Los emuladores no son evidencia de aceptación para este sprint — solo cuentan instalaciones reales en dispositivos reales.

## Por qué este documento no reporta ejecución

Sprint A pudo ejecutarse íntegramente porque cada verificación corría contra un navegador real controlado por automatización (Chrome headless vía CDP). Sprint B exige exactamente lo contrario: hardware físico Samsung, Xiaomi, Google Pixel y Motorola con acceso táctil real, que no existe en este entorno de ejecución. Este documento es la guía operativa que debe seguir quien tenga acceso a esos dispositivos; no contiene evidencia de pruebas ya realizadas.

## Build a validar

- **APK:** `dist/apk/private-balance-1.0.1-2-debug.apk`
- **SHA-256:** `8ba20250787bb35dc48d2f9e24ff7a46539bfefd3f2937956cfb37c0166c7d63`
- **versionName / versionCode:** `1.0.1` / `2`
- **minSdkVersion / targetSdkVersion / compileSdkVersion:** `24` / `36` / `36`
- **applicationId:** `com.financeapp.app`
- **Toolchain:** JDK 21, Android SDK API 36 y Capacitor 8.5.0 alineado.
- **Commit de origen:** `HEAD` de `main` que incorpora esta actualización de
  restauración y empaquetado Android.
- **Regenerar antes de instalar si el checkout no coincide con `origin/main`:**
  `npm run android:apk`.

El comando debe imprimir ruta, versión y SHA-256. Antes de distribuir, confirmar
que la copia versionada coincide byte a byte con
`android/app/build/outputs/apk/debug/app-debug.apk` y que `apksigner verify`
acepta su firma v2.

## Matriz mínima de dispositivos

| Marca        | Modelo            | Versión de Android | Resultado         | Defectos          |
| ------------ | ----------------- | ------------------ | ----------------- | ----------------- |
| Samsung      | _(por completar)_ | _(por completar)_  | _(por completar)_ | _(por completar)_ |
| Xiaomi       | _(por completar)_ | _(por completar)_  | _(por completar)_ | _(por completar)_ |
| Google Pixel | _(por completar)_ | _(por completar)_  | _(por completar)_ | _(por completar)_ |
| Motorola     | _(por completar)_ | _(por completar)_  | _(por completar)_ | _(por completar)_ |

Cada fila debe completarse con marca, modelo exacto, versión de Android instalada, resultado (`OK` / `MINOR` / `MAJOR` / `BLOCKER`) y los identificadores `SB-00N` de los defectos encontrados en ese dispositivo, si los hay.

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

Cada defecto encontrado se documenta con el siguiente identificador y formato, continuando la numeración donde la dejó Sprint A (que cerró sin necesidad de abrir `SA-008`):

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
