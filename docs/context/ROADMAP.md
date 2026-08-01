# Roadmap

## Fase P0 - Private Balance Core Redesign (en curso, ver ADR-029)

Objetivo: núcleo (finanzas, agenda, reportes, asistente) operativo sin WhatsApp/Evolution/n8n, con esas integraciones conservadas pero opcionales.

Entregables de la primera iteración:

- n8n desactivable sin errores para eventos financieros/agenda (hecho);
- navegación consolidada Inicio/Movimientos/Agenda/Asistente/Más (hecho);
- Inicio con ingresos sin reportar, acciones rápidas, agenda próxima, resumen inteligente y actividad reciente (hecho);
- Asistente promovido a experiencia principal, con flujo propuesta→confirmación visible (hecho);
- pendiente: vista "Todos" de Movimientos con filtros avanzados equivalentes a Ingresos/Egresos;
- pendiente: verificación visual en navegador (bloqueada en este entorno por el backend de licencias, ver informe de la iteración).

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
