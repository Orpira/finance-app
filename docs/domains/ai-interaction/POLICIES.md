# AI Interaction Policies

**Estado:** Active  
**Milestone:** 9B  
**Última actualización:** 2026-07-22

## Propósito

Definir la autorización previa de una `AIInteraction` sin ejecutar red, proveedores, persistencia ni efectos secundarios.

## Flujo

1. Validar el contrato 9A.
2. Resolver la política por `policyId` y `policyVersion`.
3. Comprobar intención, propósito, modo de procesamiento y capacidades.
4. Exigir contexto autorizado, confirmación o redacción cuando corresponda.
5. Emitir una decisión tipada.

## Garantías

- Default deny y fail-closed.
- Evaluación determinista y provider-neutral.
- Sin contenido financiero en trazas o mensajes de error.
- Registro inmutable por combinación de ID y versión durante la ejecución.

## Políticas iniciales

- `financial-explanation@1.0.0`: explicación, resumen y orientación financiera; requiere contexto autorizado y redacción para datos sensibles.
- `query-classification@1.0.0`: clasificación estructurada; no requiere contexto financiero por defecto.
- `unavailable-feature@1.0.0`: representa capacidades futuras y devuelve `UNSUPPORTED`.

## Fuera de alcance

Conversation, Memory, Tools, Sync, persistencia, construcción de contexto y ejecución de modelos.
