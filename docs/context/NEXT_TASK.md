# Next Task

## 1) Objetivo inmediato recomendado

Iniciar Milestone 12A sobre la base conversacional 9H, Prompt Builder 10A, Context Builder 10B, Context Resolution 10C, AI Provider Adapter 10D, AI Execution Pipeline 10E, AI Execution Inspector 10F, AI Conversation Integration 11A, AI Provider Production Activation 11B, AI Long-Term Conversation Memory 11C, AI Tool Calling Infrastructure 11D y Knowledge Retrieval Tooling 11E ya integrados y validados.

## 2) Secuencia propuesta

1. Extender el siguiente hito sobre `AIConversationApplicationService`, `AIExecutionPipeline`, `AIToolExecutor`, `AIExecutionInspector` y la composicion segura del provider real como fronteras estables.
2. Mantener `AIProvider` como unica frontera hacia proveedores externos y evitar payloads de proveedor fuera de 10D.
3. Reutilizar `KnowledgeSearchTool` y `AIToolRegistry` para extender capacidades sin acoplar UI a persistencia ni provider a herramientas concretas.
4. Ejecutar gate tecnico integral (`npm test`, `npm run build`, `npm run lint`).
5. Actualizar ADR, changelog y handoff del milestone siguiente.

## 3) Entregables mínimos de la siguiente iteración

- ADR del milestone 12A.
- contrato publico del siguiente consumidor sobre herramientas de conocimiento + dominio financiero.
- evidencia de integracion con 10A-11E sin romper limites de dominio.
- reporte tecnico final de certificacion 12A.

## 4) Criterio de done sugerido

- conversacion integrada sobre `AIConversationApplicationService` con provider remoto real, memoria local persistente e infraestructura de herramientas desacoplada;
- sin regresion en tests de 9A-11E;
- build y lint de alcance en verde;
- documentacion de arquitectura y handoff coherente.
