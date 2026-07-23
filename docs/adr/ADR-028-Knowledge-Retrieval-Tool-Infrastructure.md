# ADR-028 - Knowledge Retrieval Tool Infrastructure

Estado: Accepted  
Version: 1.0  
Fecha: 2026-07-23  
Relacionado: ADR-027, Milestone 11E

## Problema

La infraestructura de Tool Calling de 11D estaba lista, pero aun no existia una herramienta real para recuperar conocimiento documental local de manera segura y desacoplada.

## Contexto

La arquitectura certificada exige:

- extender capacidades mediante tools registradas;
- no acoplar retrieval al pipeline ni al provider;
- mantener documentos en almacenamiento local;
- enviar al modelo solo fragmentos seleccionados y relevantes;
- fail-closed ante contratos invalidos, indexacion o busquedas fallidas.

## Decision

Se implementa un modulo dedicado `src/application/knowledge` con separacion explicita de responsabilidades:

- contratos canonicamente tipados (`KnowledgeDocument`, `KnowledgeChunk`, `KnowledgeRepository`, `KnowledgeIndexer`, `KnowledgeSearchQuery`, `KnowledgeSearchResult`, `KnowledgeSearchFailure`, `KnowledgeSearchFailureCode`, `KnowledgeSearchTool`);
- chunking configurable (`createFixedWindowChunkingStrategy`);
- indexacion desacoplada (`createKnowledgeIndexer`);
- busqueda determinista intercambiable (`createDeterministicKnowledgeSearchEngine`);
- herramienta `knowledge_search` registrada via `AIToolRegistry`.

Se implementa `LocalKnowledgeRepository` sobre Dexie con migracion aditiva v26 y tablas:

- `knowledgeDocuments`;
- `knowledgeChunks`.

`KnowledgeSearchTool` coordina la ejecucion de busqueda a traves del repositorio y retorna unicamente chunks relevantes; el provider nunca consulta almacenamiento documental.

## Decisiones arquitectonicas aplicadas

- DA-028-01: RAG se implementa como tool registrada, no como logica del pipeline.
- DA-028-02: `KnowledgeSearchTool` coordina, no indexa ni persiste.
- DA-028-03: El motor de busqueda es reemplazable por estrategia.
- DA-028-04: El repositorio documental no conoce Tool Calling.
- DA-028-05: Retrieval local-first con salida minimizada a fragmentos.

## Consecuencias

- Se habilita retrieval documental real sin modificar provider ni pipeline.
- Se preserva privacidad by design y principio fail-closed.
- La plataforma queda preparada para 12A combinando herramientas de conocimiento y dominio.

## Alternativas descartadas

1. Incrustar RAG en `AIExecutionPipeline`: descartado por romper separacion y Open/Closed.
2. Permitir acceso directo del provider al repositorio: descartado por acoplamiento y privacidad.
3. Implementar busqueda dentro de la tool sin repositorio/indexador: descartado por violar SRP y Strategy Pattern.
