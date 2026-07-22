# Dominio AI Conversation

**Estado:** Active — Milestones 9D-9G

## Objetivo

Representar una conversación de IA como agregado de dominio independiente de UI, persistencia, proveedor y framework.

## Incluido en 9D

- Contratos tipados e inmutables de conversación.
- Identificador tipado (`AIConversationId`).
- Estado de conversación (`AIConversationStatus`) separado del lifecycle de interacción.
- Participantes y roles (`USER`, `ASSISTANT`, `SYSTEM`).
- Metadatos conversacionales.
- Validadores fail-closed.
- Factory de creación inmutable.

## Incluido en 9E

- Agregado raiz `AIConversationSession` para administrar la sesion operativa.
- Estados de sesion independientes de Conversation y de Interaction Lifecycle.
- Eventos y transiciones de sesion deterministas.
- Validacion fail-closed de sesion, metadata, identificador y transiciones.
- Coordinacion explicita con Policy Engine 9B y Lifecycle 9C sin duplicar reglas.
- Factory de sesion inmutable.

## Incluido en 9F

- Contratos tipados e inmutables de mensaje conversacional.
- Identificador tipado de mensaje (`AIConversationMessageId`).
- Contenido textual tipado con formato explícito (`TEXT` / `PLAIN_TEXT`).
- Estado propio de mensaje y sequence base cero.
- Metadata mínima y provider-neutral con correlación opcional a AI Interaction.
- Validadores fail-closed y factory de creación inmutable.
- Colección de mensajes tipada dentro de Session sin anidar agregados completos.

## Incluido en 9G

- Domain Service `AIConversationService` como punto de entrada único de coordinación.
- Orquestación de Session (`create/activate/pause/resume/complete/cancel`) reutilizando validadores y transiciones existentes.
- Creación de mensajes por rol (`USER`, `ASSISTANT`, `SYSTEM`) sobre Message 9F.
- Incorporación ordenada de mensajes a Session con validación fail-closed de pertenencia, secuencia y duplicados.
- Consultas inmutables de mensajes, participantes y estados conversacionales.
- Integración explícita con Policy Engine y AI Interaction Lifecycle sin lógica de proveedor.

## Excluido

Chat UI, streaming, persistencia, memoria, prompt builder y context builder.

## Integración conceptual

Conversation consume AI Interaction (9A), Policy Engine (9B) y Lifecycle (9C), pero no redefine sus reglas ni su ownership.

La sesion conversacional 9E coordina esas dependencias para mantener el estado operativo de la conversacion sin ejecutar interacciones ni invadir responsabilidades de AI Interaction.

Message 9F representa cada entrada del historial conversacional, manteniendo identidad, autoría, orden y trazabilidad sin almacenar objetos completos de Conversation, Session o AI Interaction.

Service 9G coordina Conversation, Session, Message e Interaction para resolver casos de uso del dominio sin trasladar reglas a la UI.

## API pública

`src/intelligence/ai-conversation/index.ts`.

## Ejemplo mínimo

```ts
const message = createAIConversationMessage({
	id: 'message:main:001',
	conversationId: 'conversation:main:001',
	sessionId: 'session:main:001',
	role: 'USER',
	content: { value: 'Hola, necesito revisar mi balance.' },
	sequence: 0,
	createdAt: '2026-07-22T00:00:00.000Z',
	metadata: {
		contractVersion: 1,
		generatedLocally: true,
	},
})
```

## Dependencias permitidas

Solo TypeScript y contratos de dominio internos. Sin React, sin Capacitor, sin SDKs de proveedor, sin almacenamiento.
