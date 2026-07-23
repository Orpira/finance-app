# ADR-026 - AI Conversation Long-Term Memory

Estado: Accepted  
Version: 1.0  
Fecha: 2026-07-23  
Relacionado: ADR-024, ADR-025, Milestone 11C

## Problema

La conversacion integrada en 11A y activada con provider real en 11B no conservaba estado entre reinicios de aplicacion.

Sin persistencia local, la UX se reinicia en cada apertura y no existe continuidad conversacional para el usuario.

## Contexto

La arquitectura certificada exige:

- Conversation como unica fuente de verdad del historial.
- UI desacoplada de Dexie/IndexedDB.
- Provider y pipeline desacoplados de persistencia.
- Persistencia local-first y fail-closed.
- Sin introducir RAG, embeddings, tools ni sincronizacion remota.

## Decision

Se introduce una frontera de memoria en capa de aplicacion:

ConversationPage -> ConversationController -> AIConversationApplicationService -> AIConversationMemoryPort -> LocalConversationRepository -> Dexie.

Se crean contratos readonly y JSON-safe para memoria conversacional:

- AIConversationMemoryPort
- AIConversationMemoryRecord
- AIConversationMemoryMetadata
- AIConversationMemoryResult
- AIConversationMemoryFailure
- AIConversationMemoryFailureCode
- AIConversationRetentionPolicy

`LocalConversationRepository` persiste y recupera exclusivamente `AIConversationSessionSnapshot` validado por el contrato canonico de Session.

Se agregan operaciones publicas en `AIConversationApplicationService`:

- saveSession
- loadSession
- listSessions
- deleteSession
- clearMemory

La UI consume solo estas operaciones del Application Service y nunca accede directamente a Dexie/IndexedDB.

## Consecuencias

- La conversacion sobrevive cierre y reapertura de app.
- Conversation sigue siendo el modelo canonico del historial.
- Provider, Prompt Builder, Context Builder, Context Resolution y Execution Pipeline no se acoplan a persistencia.
- La persistencia es local-first, aditiva (Dexie v25) y fail-closed.

## Alternativas descartadas

1. Persistir desde React directamente en Dexie: descartado por romper Clean Architecture.
2. Persistir payloads de provider/pipeline: descartado por privacidad y acoplamiento.
3. Crear un modelo paralelo de conversacion para storage: descartado porque Conversation debe seguir siendo la fuente de verdad.
