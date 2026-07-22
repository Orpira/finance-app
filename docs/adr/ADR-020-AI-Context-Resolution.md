# ADR-020 — AI Context Resolution

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-019, Milestone 10C

## Problema

`AIContext` (10B) representa el conjunto completo de informacion disponible, pero una interaccion no debe consumir automaticamente todo ese contenido.

Falta una capa de dominio que resuelva relevancia, inclusion, exclusion y orden antes de cualquier construccion de prompt.

## Contexto

La arquitectura necesita separar claramente:

- disponibilidad de informacion (`AIContext`);
- resolucion de informacion relevante (`AIResolvedContext`);
- construccion de prompt;
- adaptacion a proveedor.

## Decision

Implementar el dominio `src/intelligence/context-resolution` con:

- contrato `AIResolvedContext` inmutable;
- contrato `AIResolvedSection` inmutable;
- estrategias tipadas (`DEFAULT`, `MINIMAL`, `CONVERSATION_ONLY`, `APPLICATION_ONLY`, `FINANCIAL_ONLY`);
- resolver centralizado con operaciones `resolve`, `resolveByStrategy`, `includeSection`, `excludeSection`, `prioritizeSections`;
- factory inmutable y validator fail-closed.

La logica de estrategia se centraliza en un catalogo interno (`STRATEGY_RULES`) para evitar if/else dispersos.

## Decisiones arquitectonicas aplicadas

- DA-020-01: `AIContext` permanece completo e inmutable.
- DA-020-02: `AIResolvedContext` siempre es una nueva instancia.
- DA-020-03: Prompt Builder consumira `AIResolvedContext`, no `AIContext`.

## Consecuencias

- Prompt Builder queda desacoplado de decisiones de relevancia.
- Resolution permanece deterministico y extensible para estrategias futuras.
- Se habilita 10D sin acoplar UI, HTTP o provider.
- No se introducen dependencias de memoria, RAG o embeddings en esta fase.

## Alternativas descartadas

1. Resolver dentro de Prompt Builder: descartado por violar SRP y acoplar dominios.
2. Resolver con mutaciones sobre `AIContext`: descartado por romper inmutabilidad.
3. Resolver directo por proveedor: descartado por romper provider-neutrality.
