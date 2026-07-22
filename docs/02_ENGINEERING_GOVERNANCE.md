# Engineering Governance

**Estado:** Active  
**Versión:** 1.0.0  
**Responsable:** Architecture Review Board  
**Última actualización:** 2026-07-22

## Propósito

Define el proceso obligatorio para diseñar, implementar, verificar y entregar cambios en Private Balance.

## Orden de autoridad

1. Constitución.
2. Architecture Master y ADR aceptados.
3. Contratos públicos del dominio.
4. Roadmap vigente.
5. Implementación.

## Ciclo oficial

Idea → revisión arquitectónica → decisión → diseño → implementación → pruebas → documentación → certificación → integración.

## Niveles de cambio

- **A — Local:** corrección interna sin modificar contratos públicos.
- **B — Funcional:** capacidad nueva dentro de una frontera existente.
- **C — Arquitectónico:** nueva frontera, dependencia, persistencia, proveedor o contrato público. Requiere ADR.

## Definition of Ready

Un cambio está listo cuando dispone de objetivo, alcance, exclusiones, contratos afectados, riesgos, criterios de aceptación, plan de pruebas y documento de diseño.

## Definition of Done

Un cambio queda terminado cuando el código compila, las pruebas relevantes pasan, no introduce secretos, respeta dependencias, actualiza documentación y roadmap, registra deuda explícita y deja el proyecto igual o mejor que antes.

## Project Constitution Compliance

Toda revisión debe comprobar Local First, Offline First, Privacy by Design, default deny, fail closed, determinismo, neutralidad de proveedor, compatibilidad contractual y ausencia de efectos laterales no autorizados.

## Colaboración con IA

La IA debe inspeccionar primero el repositorio real, cambiar el menor conjunto cohesivo, evitar inventar APIs, ejecutar gates, informar límites y entregar un handoff reproducible. Nunca debe exponer secretos, alterar Git destructivamente ni ocultar fallos.
