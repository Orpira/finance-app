# ADR-015 — AI Conversation Message

**Estado:** Accepted  
**Versión:** 1.0  
**Fecha:** 2026-07-22  
**Relacionado:** ADR-010, ADR-011, ADR-012, ADR-013, ADR-014, Milestone 9F

## Problema

Conversation y Session ya existen como contratos y agregado, pero aún no había un modelo de dominio independiente para representar mensajes individuales con identidad, orden, estado, metadata y trazabilidad.

Sin un contrato formal de Message, cada consumidor podría modelar el historial conversacional de forma distinta y el dominio quedaría expuesto a formatos de UI o proveedor.

## Contexto

Message debe ser provider-neutral, inmutable y fail-closed. Debe reutilizar `AIConversationRole` y referenciar Conversation y Session de forma tipada, sin anidar agregados completos.

La sesión administrará colecciones de mensajes, pero Message sigue siendo un contrato de dominio separado.

## Decision

Introducir `src/intelligence/ai-conversation/message` con:

- `AIConversationMessage` como contrato inmutable;
- `AIConversationMessageId` tipado;
- contenido textual restringido a `TEXT` con formato explícito `PLAIN_TEXT`;
- estado propio de mensaje (`CREATED`, `READY`, `COMPLETED`, `FAILED`, `CANCELLED`);
- sequence entero base cero;
- metadata limitada y serializable;
- referencia tipada a Conversation y Session;
- correlación opcional con AI Interaction;
- validadores deterministas fail-closed;
- factory con congelación profunda para inmutabilidad observable.

## Consecuencias

- Conversation Session puede conservar un historial tipado y estable.
- La futura UI no necesita inventar contratos propios para mensajes.
- Memory, Prompt Builder y Context Builder obtienen una entrada de dominio consistente para PB-IS-009G y posteriores.

## Alternativas descartadas

1. Reutilizar string crudo para el contenido: descartado por perder invariantes de dominio.
2. Crear un rol de mensaje nuevo: descartado porque `AIConversationRole` ya representa correctamente la autoría.
3. Anidar Conversation, Session o AI Interaction completos dentro del mensaje: descartado por acoplamiento y complejidad innecesaria.
