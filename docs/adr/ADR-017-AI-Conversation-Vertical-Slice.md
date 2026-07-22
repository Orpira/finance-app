# ADR-017 — AI Conversation Vertical Slice

**Estado:** Accepted  
**Version:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-013, ADR-014, ADR-015, ADR-016, Milestone 9H

## Problema

El dominio conversacional 9D-9G ya existe y esta certificado, pero no habia una experiencia visible para validar la integracion end-to-end desde UI sin romper la separacion de responsabilidades.

## Contexto

La aplicacion necesitaba una pantalla funcional para:

- crear una sesion;
- enviar mensajes;
- renderizar historial;
- recibir respuesta del asistente;
- exponer estados de carga y error.

Todo el flujo debia consumir exclusivamente AIConversationService y reutilizar Policy Engine + Lifecycle sin crear logica de dominio en React.

## Decision

Implementar Milestone 9H como Vertical Slice con:

- ruta dedicada `/conversation` y acceso desde modulo Mas;
- pagina `ConversationPage` en `src/pages/Conversation`;
- componentes minimos `ConversationHeader`, `MessageList`, `MessageBubble`, `MessageComposer`;
- controlador `conversationController` como capa de orquestacion UI;
- hook `useConversation` para suscripcion/estado;
- composition root `conversationComposition` que crea AIConversationService con policy `conversation-preview` y proveedor mock por defecto del dominio.

## Consecuencias

- La UI queda limitada a estado y render, sin construir Session/Message directamente.
- Session y Message permanecen administrados por AIConversationService.
- El flujo valida integracion real con Policy Engine y Lifecycle antes de recibir respuesta.
- Se habilita 10A (Prompt Builder) sobre una base conversacional visible y ya verificada.

## Alternativas descartadas

1. Crear mensajes/sesion en React: descartado por romper limites del dominio.
2. Llamar proveedor IA directo desde UI: descartado por acoplamiento y fuga de reglas.
3. Introducir store global nuevo para 9H: descartado por alcance y complejidad innecesaria.
