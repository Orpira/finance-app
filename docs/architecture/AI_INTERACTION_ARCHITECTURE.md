# AI Interaction Platform Architecture

**Estado:** Active  
**Versión:** 1.0.0  
**Relacionado:** ADR-010, `docs/domains/ai-interaction/README.md`

## Decisión

Private Balance modela la inteligencia desde las necesidades del producto, no desde un chat ni desde las capacidades particulares de OpenAI, Gemini, Ollama u otro proveedor.

## Flujo

Application Use Case → AI Interaction Domain → Interaction Policy → AI Privacy Boundary → Authorized Context Builder → Provider Registry → LLM Adapter → Typed Interaction Result.

## Responsabilidades

El dominio de interacción define identidad, intención, capacidades, política, estados, resultados y fallos. No conoce UI, red, SDKs, persistencia, prompts concretos ni modelos.

Conversation será un consumidor que añade mensajes, orden, sesión e historial, sin duplicar privacidad, selección de proveedor o ciclo de vida.

## Invariantes

- Cada interacción posee un identificador estable y una intención explícita.
- Las capacidades requeridas son provider-neutral.
- El estado solo avanza por transiciones permitidas.
- Un resultado exitoso referencia la interacción y la política aplicada.
- Los fallos son tipados y no contienen material financiero sensible.
- La interacción no autoriza datos; la autorización pertenece a AI Foundation.
