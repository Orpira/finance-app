# Bloque 4.2 — Acta de validación técnica y pendientes manuales

**Fecha:** 2026-09-04  
**Estado:** preparación técnica completada; aceptación manual navegador/PWA y actualización física APK pendientes.

## Resultado ejecutivo

La implementación compila y supera typecheck, ESLint, 2.537 pruebas Vitest y la suite IndexedDB en Chrome real. Se añadió cobertura física de la migración de un perfil Personal v32 a v33 y se corrigió el único incumplimiento confirmado durante esta ejecución: el selector de espacio Híbrido ya no aparece en las rutas de creación/edición, evitando abandonar formularios con datos sin guardar.

No se declara completada ninguna prueba manual que no se haya realizado. Este entorno no ofrece una sesión gráfica interactiva para instalar/reabrir una PWA ni un dispositivo Android conectado. Tampoco se usaron licencias, datos personales, tokens o bases IndexedDB reales.

## Evidencia

| Perfil | Flujo | Esperado | Resultado | Evidencia |
| --- | --- | --- | --- | --- |
| A — Personal v32 | Migración a v33 | Quitar `paymentType`, clasificar meta como `basic`, conservar ID e importe | **Validado automáticamente** | `npm run test:indexeddb`, Chrome 152 real: cuatro checks específicos v32→v33 aprobados |
| A — Personal | Activación Híbrida y aislamiento | Mantener Personal activo y Profesional vacío | **Validado automáticamente** | `test/settingsUsageModeActivation.test.ts`, `test/hybridActivationDataIsolation.test.ts` |
| B — Profesional | Activación Híbrida y aislamiento | Mantener Profesional activo y Personal vacío | **Validado automáticamente** | mismas suites focalizadas; no equivale a recorrido manual |
| A/B | Cinco cambios consecutivos y reapertura | Sin datos residuales; persistencia del último contexto | **Validado automáticamente en lógica; manual pendiente** | suite Híbrido y persistencia de ajustes; falta recorrido UI con ambos perfiles |
| A/B | Rutas profesionales desde Personal | Redirección segura sin cambiar contexto | **Validado automáticamente** | `UsageModeGuard` y suite completa; falta comprobación visual manual |
| A/B | Formularios con datos sin guardar | No permitir cambio global de espacio | **Corregido y validado automáticamente** | `src/utils/formRoutes.ts`, 15 casos en `test/formRoutes.test.ts`; selector oculto en crear/editar ingreso, gasto, cita y crear temporada |
| A/B | Backup/restauración válida | Recuperar datos y contextos | **Validado automáticamente; manual pendiente** | tests de backup/importación y suite IndexedDB; falta descarga/selección desde UI |
| A/B | Backup con meta `usageMode: hybrid` | Rechazo previo al borrado | **Validado automáticamente; manual pendiente** | validación fail-closed en importación y suites focalizadas; falta diálogo real de UI |
| A/B | PDF y CSV | Contenido aislado y totales consistentes | **Validado automáticamente; revisión visual pendiente** | tests de exportación/presentación; Chrome real produjo PDF no vacío de 52.599 bytes |
| A/B | Copiloto | Lecturas/escrituras limitadas al contexto; agenda rechazada en Personal | **Validado automáticamente; manual pendiente** | suites de confirmación, controlador y servicios |
| B | Notificaciones | Ocultar en Personal, reaparecer sin borrar/duplicar | **Validado automáticamente; manual pendiente** | tests de servicio y centro de notificaciones |
| PWA | Manifest e iconos | Manifest válido, `display: standalone`, iconos disponibles | **Validado automáticamente** | `public/manifest.webmanifest` y build Vite |
| PWA | Instalar, cerrar y reabrir | Persistencia y ventana standalone | **Pendiente externo** | requiere Chrome gráfico e interacción de instalación |
| PWA | Offline descriptivo | Documentar navegación y recarga sin declarar offline completo | **Pendiente externo — PWA-001** | no existe service worker activo; corresponde al Sprint C |
| Android | Sync y APK | Artefacto reproducible | **Validado automáticamente** | `npm run android:sync` y `npm run android:apk`, Gradle `BUILD SUCCESSFUL` |
| Android | Actualización conservando IndexedDB | `adb install -r`, sin desinstalar | **Pendiente externo** | `adb devices` no devolvió dispositivos |

## Validación automática ejecutada

- `npm run typecheck`: correcto.
- `npx eslint src/ test/`: correcto.
- `npx vitest run`: 237 archivos, 2.537 pruebas aprobadas y 1 `todo`.
- `npm run build`: correcto; conserva un aviso no bloqueante por chunks mayores de 500 kB.
- `npm run test:indexeddb`: correcto en `HeadlessChrome/152.0.0.0`, incluida migración física v32→v33 y generación PDF real.
- `npm run android:sync`: correcto.
- `npm run android:apk`: correcto.
- `git diff --check`: correcto.

## PWA

Origen previsto para la prueba manual: `http://localhost:<puerto>` o HTTPS autorizado. El manifest declara `start_url: /`, `scope: /`, `display: standalone`, colores y tamaños de icono de 48 a 512 px.

`PWA-001` permanece abierto: no hay service worker activo. En consecuencia, solo debe comprobarse de forma descriptiva qué navegación continúa funcionando sin recargar y que la recarga sin red no dispone de una garantía de caché offline. No se implementó service worker en este bloque.

## APK preparado

- Paquete / `applicationId`: `com.financeapp.app`.
- Versión: `1.0.6 (7)`.
- `minSdkVersion`: 24.
- Artefacto: `dist/apk/private-balance-1.0.6-7-debug.apk`.
- SHA-256: `a8398e43e5a0d9c9f28498e3f52a0f07af1716465f106c545c311d63930bb7a4`.
- Versión mínima anterior prevista para la actualización: `1.0.5 (6)`.

Instalación/actualización sin borrar IndexedDB:

```bash
adb install -r dist/apk/private-balance-1.0.6-7-debug.apk
```

Comprobación de paquete y captura de Logcat:

```bash
adb shell dumpsys package com.financeapp.app
adb logcat -s AndroidRuntime Capacitor/Console chromium
```

Checklist físico pendiente:

1. Confirmar que está instalada `1.0.5 (6)` con datos de prueba v32.
2. Exportar un backup válido y conservarlo fuera de la aplicación.
3. Ejecutar `adb install -r` (nunca `adb uninstall`).
4. Confirmar versión `1.0.6 (7)`, arranque, migración v33, IDs, fechas, importes y totales.
5. Confirmar contexto activo, cinco cambios consecutivos y persistencia tras arranque en frío.
6. Repetir backup/restauración, PDF/CSV, Copiloto y notificaciones.
7. Guardar capturas y Logcat; registrar cualquier error con hora y flujo.

## Cierre

No se aprueba aún la parte navegador/PWA conforme a los criterios del bloque, porque los recorridos manuales de los perfiles A/B, la instalación PWA y la inspección visual de exportables siguen pendientes. La APK está preparada, pero su aceptación permanece pendiente de actualización en un dispositivo físico preservando IndexedDB.
