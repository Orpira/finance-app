# Sandbox Guiado del Asistente para Licencias Gratuitas

**Estado:** implementado  
**Fecha:** 2026-08-02

## Objetivo

El Asistente permanece visible para usuarios con licencia gratuita activa (`trial` o `demo`), pero sus capacidades reales quedan bloqueadas. En su lugar, la pantalla ofrece un sandbox guiado que comunica el valor del producto mediante una conversación simulada, local y segura.

La demostración no es un recorrido fijo de botones "Siguiente": permite escribir frases o elegir ejemplos y devuelve respuestas predefinidas mediante reglas deterministas.

## Resolución por licencia

```text
/conversation
      |
      v
getCurrentLicense()
      |
      +-- trial / demo ------> FreeAssistantExperience
      |                          -> AssistantInteractiveDemo
      |
      +-- licencia completa -> LicensedConversationPage
                                 -> conversación y propuestas reales
```

La ruta `/conversation` deja de estar bloqueada por `LicenseTypeGuard` para `trial`. El `LicenseGuard` general continúa protegiendo licencias inexistentes, inactivas o expiradas; esta entrega no elimina la validación global de licencia.

## Implementación

- `src/pages/Conversation/ConversationPage.tsx`: consulta la licencia y selecciona la experiencia gratuita o licenciada.
- `src/pages/Conversation/AssistantInteractiveDemo.tsx`: estados `intro`, `sandbox` y `complete`; historial temporal, sugerencias, formulario y acciones simuladas.
- `src/pages/Conversation/assistantInteractiveDemoSandbox.ts`: normalización y reglas puras para respuestas ficticias.
- `src/routes/index.tsx`: mantiene `/conversation` visible para `trial`.
- `test/assistantInteractiveDemo.test.ts`: contrato de contenido, escenarios, privacidad y navegación.

## Escenarios simulados

El sandbox reconoce variantes locales de:

- registrar un ingreso;
- registrar un gasto;
- crear una cita;
- consultar el resumen del mes;
- consultar ingresos pendientes de reportar.

Las propuestas permiten simular `Editar`, `Cancelar` o `Confirmar`. Estas acciones solo actualizan el estado React de la demostración; nunca llaman a servicios financieros ni persisten registros.

Cuando una frase no coincide con una regla, se muestra una respuesta guiada que explica las capacidades disponibles. No se inventa una operación ni se deriva la frase a un proveedor.

## Privacidad

- No usa IA, OpenAI ni otro proveedor.
- No consume tokens.
- No usa `fetch` ni realiza llamadas de red.
- No consulta Dexie, servicios financieros ni datos reales del usuario.
- No persiste mensajes, prompts o respuestas.
- Todo el historial desaparece al salir o reiniciar la demostración.
- Todos los importes, balances, categorías y citas mostrados son ficticios.

## Experiencia

La introducción explica claramente el carácter local y ficticio de la experiencia. El usuario puede probar frases sugeridas o escribir una variante propia. Al finalizar se muestra:

> El Asistente IA está listo para ayudarte.

Las acciones finales son `Activar licencia`, que reutiliza `/settings/license`, y `Volver`, que regresa a Inicio.

## Límites

- El sandbox no representa disponibilidad de IA real para la licencia gratuita.
- No comparte memoria ni datos con el Copiloto Financiero Determinista.
- Solo cubre un catálogo cerrado de frases y variantes.
- Una licencia expirada o ausente sigue el flujo global de activación; no entra automáticamente en el sandbox.
