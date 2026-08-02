# Roadmap

## Criterio de alcance hasta la versión 1.0

Toda funcionalidad nueva debe demostrar un beneficio claro para el usuario o para la calidad del sistema. Para entrar en el alcance de la versión 1.0, una propuesta debe mejorar de forma verificable al menos uno de estos aspectos:

- comprensión;
- privacidad;
- velocidad;
- utilidad.

Una idea que aumente la complejidad sin aportar una mejora clara en alguno de esos aspectos queda fuera de la versión 1.0. Este criterio debe aplicarse antes de planificar una iteración y durante su revisión de alcance, preservando la simplicidad como parte del valor diferencial de Private Balance.

## Fase P0 - Private Balance Core Redesign (completada para su alcance, ver ADR-029)

Objetivo: núcleo (finanzas, agenda, reportes, asistente) operativo sin WhatsApp/Evolution/n8n, con esas integraciones conservadas pero opcionales.

Entregables de la primera iteración:

- n8n desactivable sin errores para eventos financieros/agenda (hecho);
- navegación consolidada Inicio/Movimientos/Agenda/Copiloto/Más (hecho);
- Inicio con ingresos sin reportar, acciones rápidas, agenda próxima, resumen inteligente (ad-hoc, ver corrección en P1) y actividad reciente (hecho);
- Copiloto promovido a experiencia principal, con la *nota* de propuesta→confirmación visible en la UI (hecho) — esa garantía ya es real desde la Fase P2 (el flujo de propuesta→confirmación no existía en la Fase P0, se implementó en P2);
- vista "Todos" de Movimientos con filtros compartidos y deep links contextuales (hecho en Iteración 5);
- pendiente: verificación visual en navegador (bloqueada en este entorno por el backend de licencias, ver informe de la iteración).

## Fase P1 - Intelligent Assistant Platform, diseño (completada, ver ADR-030)

Objetivo: diseñar cómo el asistente pasa de solo-consulta a poder proponer acciones (con confirmación obligatoria), y cómo se conecta la frontera de privacidad 8A. Solo documentación — sin código de producto (aparte de un fix de seguridad puntual: ocultar `/debug` de producción, commit `2df85c7`).

## Fase P2 - Intelligent Assistant Platform, implementación (completada para su alcance, ver ADR-031)

Objetivo: implementar el primer flujo completo Usuario → Interpretación → Propuesta → Edición → Confirmación → Validación → Persistencia → Resultado, para registrar ingreso/gasto y crear cita. Ver `docs/architecture/19_ASSISTANT_ACTION_FLOW.md` para la arquitectura tal como quedó construida (distinta a la planeada en P1 — ver ADR-031) y `docs/roadmap/private-balance-intelligent-platform-roadmap.md` §2 para lo pendiente (iteraciones 4 a 7): resto de acciones, conectar 8A al camino de consulta, consolidar Movimientos, limpieza de pantallas.

Entregables: los tres flujos de acción funcionando end-to-end con tests; frontera 8A conectada para ese flujo (modo local); "Canales de comunicación" oculto de la experiencia de usuario (código conservado); corrección de un hallazgo de seguridad real (`VITE_OPENAI_API_KEY` sin bloquear en `vite.config.ts`, commit `bca00bb`).

## Fase P3 - Primer Copiloto Financiero (completada)

Objetivo: ayudar a decidir y actuar con los datos existentes, sin IA ni pantallas nuevas.

Entregables: motor determinista compartido; prioridades de hoy; salud financiera por estados; insights y explicaciones; resumen natural; acciones sugeridas; seis consultas locales; memoria efímera de sesión. Arquitectura: [20_DETERMINISTIC_FINANCIAL_COPILOT.md](../architecture/20_DETERMINISTIC_FINANCIAL_COPILOT.md).

## Experiencia gratuita del Copiloto (completada)

El bloqueo total de `/conversation` para `trial` fue reemplazado por un sandbox guiado. Permite escribir frases y recibir propuestas o consultas simuladas con datos ficticios, sin IA, red, Dexie ni persistencia. Arquitectura: [21_FREE_ASSISTANT_GUIDED_SANDBOX.md](../architecture/21_FREE_ASSISTANT_GUIDED_SANDBOX.md).

## Fase P4 - Inteligencia explicable y continuidad contextual (completada)

Entregables: evidencia estructurada, nueve read models comunes, memoria RAM ampliada y eliminable, seguimientos locales, propuestas confirmables para un ingreso/reporte/objetivo, objetivos Dexie v30, salud explicable, Home limitado y Movimientos con filtros compartidos. No incluye acciones masivas, agentes autónomos ni predicción generativa.

## Fase P5 - Experiencia unificada y soporte local (completada)

Objetivo: hacer natural y coherente la inteligencia ya implementada, sin ampliar su alcance.

Entregables: lenguaje visible unificado bajo `Copiloto`; respuestas y sandbox con jerarquía común; Inicio ordenado como centro de control; reportes configurables con vista previa y confirmación; objetivos con tiempo, estado y recomendación; diagnóstico local exportable sin datos personales; foco visible y reducción de movimiento. DT-001, Service Worker y certificación completa de DT-003 permanecen fuera de esta fase.

## Fase R1 - Robustez operativa (corto plazo)

Objetivo: cerrar riesgos críticos de automatización y gobernanza.

Entregables:

- workflows críticos sin ramas huérfanas;
- ADR formal de certificación;
- checklist release security+quality gate.

## Fase R2 - Consolidación técnica (mediano plazo)

Objetivo: estabilizar mantenimiento y trazabilidad.

Entregables:

- convergencia de legado n8n -> modelo moderno;
- política de retención de snapshots/knowledge;
- CI/CD con gates automáticos.

## Fase R3 - Evolución AI Foundation controlada

Objetivo: ampliar adopción sin romper fuente oficial legacy.

Entregables:

- nuevos consumidores de read models bajo flags controlados;
- validación de paridad ampliada;
- reportes de salud técnica por módulo.
- consolidacion de memoria conversacional local y politicas de retencion fail-closed.
- consolidacion de infraestructura de tool calling provider-neutral con registro dinamico y permisos declarativos.
- consolidacion de retrieval documental local-first via `KnowledgeSearchTool` con ranking determinista y chunks autorizados.

## Fase R4 - Decisiones estructurales mayores

Objetivo: decidir si Financial Engine puede convertirse en fuente oficial global.

Precondiciones:

- paridad validada de forma sostenida;
- deuda P0/P1 cerrada;
- ADRs de corte aprobadas;
- plan de rollback documentado.
