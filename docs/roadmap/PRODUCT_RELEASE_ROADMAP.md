# Fase Pre-Release 0.9 de Private Balance

## Cambio de etapa

La Iteración 6 cierra oficialmente la construcción funcional previa a 1.0. Desde el 2026-08-02, Private Balance entra en la **Fase Pre-Release 0.9**: el objetivo ya no es construir capacidades, sino demostrar con evidencia que el producto existente funciona de forma estable, coherente, privada y rápida en condiciones reales.

No se abrirán nuevas iteraciones funcionales antes de 1.0. La salida de esta fase será **Private Balance 0.9 RC**, una candidata de lanzamiento validada antes de preparar la publicación de 1.0.

## Congelación funcional

Una función nueva solo podrá admitirse si cumple simultáneamente estas tres condiciones:

1. Resuelve un problema real detectado durante las pruebas de pre-release.
2. No aumenta la complejidad del producto.
3. No retrasa el lanzamiento de la versión 1.0.

El problema y el cumplimiento de las tres condiciones deben quedar documentados antes de implementar la excepción. Las mejoras no indispensables se aplazan al backlog posterior a 1.0.

## Principios de ejecución

- no añadir funciones, entidades, integraciones ni capacidades de inteligencia;
- no modificar fórmulas financieras ni garantías local-first;
- corregir únicamente defectos observados o riesgos demostrados;
- aplicar TDD a cada corrección de comportamiento: prueba que reproduce el defecto, corrección mínima y regresión en verde;
- conservar evidencia reproducible de cada auditoría y prueba manual;
- no declarar un sprint cerrado con validaciones parciales o solo simuladas.

## Sprint A - Calidad

**Objetivo:** eliminar defectos pequeños y fricciones del producto existente.

**Estado:** en progreso, reabierto el 2026-08-04 tras un cierre breve el mismo día. SA-008 (Movimientos "Todos" sin filtro de modo de uso) ya está corregido y verificado. Pendiente: SA-009–SA-012 (ampliación UX en Temporadas y estados vacíos, sujeta a excepción de congelación funcional documentada antes de implementarse — sin cambios de código todavía). Detalle completo en [Sprint A: Calidad](../product/PRE_RELEASE_0_9_SPRINT_A.md).

Alcance:

- corregir defectos funcionales menores;
- revisar UX, textos, iconografía y consistencia visual;
- comprobar coherencia entre modos Básico/Profesional, web y Android;
- registrar cada hallazgo, decisión y validación.

Criterio de salida: incidencias clasificadas, correcciones cubiertas por regresión cuando afecten comportamiento y revisión visual de los flujos modificados completada.

## Sprint B - Android real

**Estado:** documento operativo preparado ([Sprint B: Android real](../product/PRE_RELEASE_0_9_SPRINT_B.md)), pero la ejecución en hardware físico espera al recierre del Sprint A (reabierto el 2026-08-04).

**Objetivo:** validar el APK en hardware físico, sin usar emuladores como evidencia de aceptación.

Matriz mínima:

- Samsung;
- Xiaomi;
- Google Pixel;
- Motorola.

En cada dispositivo se probarán instalación y actualización del APK, arranque, rotación, modo oscuro, notificaciones, teclado, safe areas y flujos críticos. La evidencia debe registrar marca, modelo, versión de Android, versión del APK, resultado y defectos encontrados.

Criterio de salida: matriz física completa, sin defectos bloqueantes abiertos y con los defectos corregidos nuevamente verificados en los dispositivos afectados.

## Sprint C - PWA

**Objetivo:** cerrar DT-002 y certificar la experiencia PWA.

Alcance:

- definir y activar el Service Worker;
- probar instalación y desinstalación;
- certificar arranque y flujos críticos completamente offline;
- validar actualización de versión, invalidación de caché y recuperación ante una actualización fallida;
- preservar IndexedDB como fuente de verdad local y evitar cachés con datos financieros sensibles.

Criterio de salida: DT-002 cerrada con pruebas reproducibles de instalación, actualización y funcionamiento offline.

## Sprint D - Accesibilidad

**Objetivo:** cerrar DT-003 completamente.

Alcance:

- navegación integral con teclado;
- foco visible y orden lógico;
- lector de pantalla;
- nombres, estados y mensajes accesibles;
- contraste en modos claro y oscuro;
- movimiento reducido;
- validación en escritorio, móvil, PWA y APK.

Criterio de salida: auditoría WCAG documentada, defectos relevantes corregidos y DT-003 cerrada, no marcada como mejora parcial.

## Sprint E - Rendimiento

**Objetivo:** cerrar DT-001 sin modificar el comportamiento funcional.

Alcance:

- establecer una línea base de bundle y tiempos de arranque;
- aplicar lazy loading, code splitting y tree shaking donde la arquitectura lo permita;
- revisar imports, código muerto, dependencias duplicadas y módulos pesados;
- ejecutar bundle analyzer, Lighthouse y Core Web Vitals;
- medir arranque web/PWA y APK en dispositivos representativos.

Criterio de salida: DT-001 cerrada con comparación reproducible antes/después, regresión completa en verde y compatibilidad offline preservada.

## Sprint F - Privacidad

**Objetivo:** demostrar que los datos y la información diagnóstica respetan las garantías del producto.

La auditoría cubrirá logs, IndexedDB, backups, restauración, exportaciones, diagnósticos, Copiloto y memoria conversacional. También verificará consentimiento, destinos de red, redacción de información sensible, borrado y ausencia de secretos en cliente, bundle y APK.

Criterio de salida: informe de privacidad con flujo de datos actualizado, cero hallazgos bloqueantes abiertos, tratamiento explícito de los hallazgos no bloqueantes y documentación alineada con el comportamiento real.

## Sprint G - Estabilidad

**Objetivo:** observar el producto bajo uso cotidiano real.

Alcance:

- instalar la APK en dispositivos físicos;
- usarla durante varios días con los flujos normales;
- registrar errores, bloqueos, degradaciones, consumo anómalo y problemas de actualización;
- reproducir y corregir los defectos reales mediante TDD cuando sean automatizables;
- repetir los escenarios afectados después de cada corrección.

Criterio de salida: periodo de uso documentado, cero defectos bloqueantes abiertos y registro de incidencias con resolución o decisión explícita.

## Private Balance 0.9 RC

La candidata se puede declarar únicamente cuando los sprints A-G estén cerrados y exista evidencia de sus criterios de salida. La RC congela código y contenido salvo para:

- defectos pequeños;
- ajustes de textos o traducciones;
- correcciones de iconografía;
- preparación de publicación.

Cualquier cambio obliga a repetir las validaciones afectadas. Una corrección que incumpla la congelación funcional devuelve el producto a la fase de pre-release.

## Private Balance 1.0

Después de certificar la RC se realizará la regresión final, se prepararán los artefactos reproducibles de distribución, firma y publicación, y se alinearán manual, notas de versión, soporte, privacidad y procedimientos de rollback.

La versión 1.0 se publica con cero defectos bloqueantes conocidos y sin incorporar nuevas funciones durante la fase de candidata.

## Trabajo posterior a 1.0

Las ideas funcionales no necesarias para resolver defectos de pre-release se conservan como oportunidades, no como compromisos. Solo se priorizarán después del lanzamiento con evidencia de beneficio para usuarios y una evaluación explícita de coste, privacidad y complejidad.
