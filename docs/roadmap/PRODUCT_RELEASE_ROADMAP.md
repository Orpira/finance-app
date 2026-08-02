# Roadmap de versiones hacia Private Balance 1.0

## Cambio de modelo de planificación

La Iteración 6 cierra el ciclo de grandes iteraciones funcionales previo a 1.0. Desde este punto, Private Balance se planifica por versiones de producto con alcance congelado, criterios de salida verificables y prioridad sobre calidad, estabilidad y experiencia de usuario.

No se abrirán nuevas iteraciones numeradas antes de 1.0. Una propuesta que cree una entidad, flujo, integración o capacidad de inteligencia nueva se aplaza al backlog posterior a 1.0, salvo que sea imprescindible para corregir un defecto bloqueante de seguridad, privacidad, integridad financiera o uso básico.

## Regla de admisión

Todo trabajo previo a 1.0 debe demostrar una mejora verificable en al menos uno de estos aspectos:

- comprensión;
- privacidad;
- velocidad;
- utilidad;
- estabilidad o accesibilidad del sistema existente.

La mejora debe poder validarse con pruebas, mediciones, auditorías o evidencia de uso. Añadir complejidad sin ese beneficio queda fuera del alcance.

## v0.9 - Experiencia unificada

**Estado:** alcance funcional completado el 2026-08-02.

Esta versión reúne el resultado funcional de las Iteraciones 1 a 6:

- navegación y lenguaje coherentes bajo el concepto visible `Copiloto`;
- Inicio como centro de control;
- movimientos, agenda, reportes y objetivos conectados mediante flujos consistentes;
- inteligencia local explicable y acciones con confirmación;
- sandbox guiado, local y ficticio para licencias gratuitas;
- diagnóstico local exportable sin contenido financiero;
- compatibilidad validada mediante suite automatizada, build web y APK de desarrollo.

Después de este hito, el alcance funcional queda congelado para la preparación de 1.0. Los defectos encontrados se corrigen dentro de la versión correspondiente sin ampliar el producto.

## v0.95 - Rendimiento y calidad

**Estado:** planificada.

**Naturaleza:** versión de estabilización, no iteración funcional.

Alcance obligatorio:

- DT-001: optimización medida del bundle, lazy loading, code splitting, dependencias pesadas y carga inicial de web/PWA/APK;
- DT-002: decisión e implementación probada de la estrategia de Service Worker y caché de assets, preservando el funcionamiento local-first;
- DT-003: certificación completa de accesibilidad con teclado, lector de pantalla, contraste, movimiento reducido, móvil y escritorio;
- auditorías de Lighthouse, Core Web Vitals, dependencias, privacidad y seguridad;
- pruebas de regresión, corrección de defectos y eliminación justificada de código muerto o duplicación;
- validación de instalación, actualización, backup, restauración y arranque en web, PWA y Android.

Criterios de salida:

- mejoras de rendimiento comparadas contra una línea base reproducible;
- DT-001, DT-002 y DT-003 cerradas o con una excepción explícita, justificada y aceptada;
- suite, lint y build sin errores;
- flujos críticos certificados en web y Android sin regresiones funcionales;
- privacidad, funcionamiento local y cálculos financieros preservados;
- lista de incidencias bloqueantes para 1.0 vacía.

## v1.0 - Lanzamiento oficial

**Estado:** planificada tras certificar v0.95.

Alcance:

- congelación de la candidata de lanzamiento;
- regresión final de los flujos críticos y modos Básico/Profesional;
- revisión final de seguridad, privacidad, licencias y recuperación de datos;
- preparación de artefactos de distribución, firma y proceso de publicación;
- manual, notas de versión, soporte y documentación operativa alineados con el producto publicado.

Criterios de salida:

- cero defectos bloqueantes conocidos;
- artefactos web/PWA/Android reproducibles y certificados;
- checklist de lanzamiento, rollback y soporte aprobado;
- documentación pública y técnica consistente con el comportamiento real;
- versión 1.0 publicada sin incorporar nuevas funciones durante la fase de candidata.

## Trabajo posterior a 1.0

Las ideas funcionales no necesarias para estos criterios se conservan como oportunidades, no como compromisos. Solo se priorizarán después del lanzamiento con evidencia de beneficio para usuarios y una evaluación explícita de coste, privacidad y complejidad.
