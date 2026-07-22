# Next Task

## 1) Objetivo inmediato recomendado

Iniciar Milestone 11C sobre la base conversacional 9H, Prompt Builder 10A, Context Builder 10B, Context Resolution 10C, AI Provider Adapter 10D, AI Execution Pipeline 10E, AI Execution Inspector 10F, AI Conversation Integration 11A y AI Provider Production Activation 11B ya integrados y validados.

## 2) Secuencia propuesta

1. Extender el siguiente hito sobre `AIConversationApplicationService`, `AIExecutionPipeline`, `AIExecutionInspector` y la composición segura del provider real como fronteras estables.
2. Mantener `AIProvider` como unica frontera hacia proveedores externos y evitar payloads de proveedor fuera de 10D.
3. Integrar el siguiente consumidor sin mover lógica de dominio a React y preservando observabilidad read-only.
4. Ejecutar gate tecnico integral (`npm test`, `npm run build`, `npm run lint`).
5. Actualizar ADR, changelog y handoff del milestone siguiente.

## 3) Entregables mínimos de la siguiente iteración

- ADR del milestone 11C.
- contrato publico del siguiente consumidor sobre la conversación ya activada con proveedor real.
- evidencia de integracion con 10A–11B sin romper límites de dominio.
- reporte tecnico final de certificacion 11C.

## 4) Criterio de done sugerido

- conversación integrada sobre `AIConversationApplicationService` con provider remoto real activado sin romper limites UI-dominio;
- sin regresion en tests de 9A-11B;
- build y lint de alcance en verde;
- documentacion de arquitectura y handoff coherente.
