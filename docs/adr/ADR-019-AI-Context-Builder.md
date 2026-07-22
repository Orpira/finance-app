# ADR-019 — AI Context Builder

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-018, Milestone 10B

## Problema

Prompt Builder 10A ya permite ensamblar segmentos de prompt, pero no existe un dominio que decida y estructure la informacion de contexto previa al prompt.

Sin esa capa, Prompt Builder terminaria absorbiendo responsabilidades de recoleccion de datos y acoplandose a fuentes heterogeneas.

## Contexto

La arquitectura AI Core requiere separar claramente:

- seleccion de informacion relevante;
- representacion de contexto;
- construccion de prompt;
- adaptacion a proveedor.

10B cubre solo la primera y segunda parte sin invadir prompt rendering ni ejecucion de modelos.

## Decision

Implementar el dominio `src/intelligence/context-builder` con:

- contrato canónico `AIContext` compuesto por `AIContextSection`;
- modelo de origen `AIContextSource` y prioridad `AIContextPriority`;
- metadata determinista fail-closed;
- factory inmutable para ids, secciones y contexto;
- validator fail-closed para contexto, seccion, source, prioridad, metadata y orden;
- builder con operaciones `createContext`, `addSection`, `removeSection`, `sortSections`, `build`.

`build()` retorna exclusivamente `AIContext` validado.

No retorna prompt ni string.

## Consecuencias

- Prompt Builder 10A permanece desacoplado de fuentes de contexto.
- Se habilita 10C sobre contrato estable sin dependencia de proveedor ni UI.
- Conversation, Session y Message pueden aportar secciones sin romper encapsulacion de dominio.
- Se mantiene compatibilidad con futuras fuentes (Memory, RAG, OCR, etc.) por extension de `AIContextSource` y nuevos mapeadores.

## Alternativas descartadas

1. Incluir contexto dentro de Prompt Builder: descartado por acoplamiento y violacion de SRP.
2. Construir contexto como texto plano: descartado por perdida de estructura y trazabilidad.
3. Ejecutar resolucion remota en 10B: descartado por alcance y por romper local-first/offline-first.
