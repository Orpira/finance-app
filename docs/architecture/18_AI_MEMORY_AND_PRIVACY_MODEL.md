# 18 AI Memory and Privacy Model — evaluación y extensión

Ver [ADR-030](../adr/ADR-030-Intelligent-Assistant-Platform.md), [ADR-026](../adr/ADR-026-AI-Conversation-Long-Term-Memory.md) (memoria, ya implementada) y [26_AI_FOUNDATION_PRIVACY_BOUNDARY.md](../26_AI_FOUNDATION_PRIVACY_BOUNDARY.md) (frontera de privacidad 8A, ya implementada como contrato). Cubre las entregas 8 (modelo de privacidad) y 9 (modelo de memoria).

## 1. Modelo de memoria: lo que ya existe es correcto, se documenta qué recordar/olvidar/reutilizar

ADR-026 ya resuelve la arquitectura de persistencia (`ConversationPage → ConversationController → AIConversationApplicationService → AIConversationMemoryPort → LocalConversationRepository → Dexie`, local-first, fail-closed). Lo que faltaba — y que esta iteración de diseño fija — es la **política de contenido**, no de transporte:

| Debe recordarse | Debe olvidarse / no persistirse | Puede reutilizarse |
|---|---|---|
| Historial de mensajes de la sesión activa (ya implementado) | Resultados completos de tool-calls de consulta una vez respondidos (no re-persistir el `financial_transactions` completo dentro del historial de mensajes) | El período/moneda/preferencias seleccionados en la sesión, para no repreguntarlos en el mismo turno |
| Referencia (`proposalId`) a una propuesta de acción pendiente, mientras no se confirme/cancele | El contenido íntegro de una propuesta ya confirmada o cancelada, más allá de un resumen de una línea ("Registraste 120 EUR el 01/08") | El resumen de qué se confirmó, como parte del historial conversacional normal (no como "memoria" adicional) |
| Consentimiento de IA externa (`AIConsentRecord`, ya modelado en 8A) | Cualquier dato que hoy vive en `AIConsentRecord`/`AIPrivacyPolicy` no debe duplicarse en la memoria conversacional | — |

Regla general: la memoria conversacional es historial de **conversación**, no una caché paralela del dominio financiero. Todo dato financiero mostrado en un mensaje pasado debe poder re-obtenerse desde los servicios reales si hace falta — no confiar en lo guardado en el mensaje como fuente de verdad.

## 2. Hallazgo crítico: la frontera de privacidad (8A) no está conectada

`docs/26_AI_FOUNDATION_PRIVACY_BOUNDARY.md` describe una frontera `AIPrivacyBoundaryPort.authorize()` madura: default-deny, clasificación de datos (`PUBLIC` → `CREDENTIAL_OR_SECRET`), propósitos permitidos/prohibidos, modos `LOCAL_ONLY`/`EXTERNAL_PROVIDER`, consentimiento versionado. **Verificado en esta auditoría: ningún archivo fuera de `src/intelligence/ai-foundation/` la importa o invoca.** El pipeline real (`aiExecutionPipeline.ts`) construye el contexto y llama al proveedor sin pasar por `authorize()`.

Esto no significa que hoy se esté filtrando información masivamente: el diseño de tools acota lo que puede llegar a un prompt a lo que una tool de solo lectura devuelve explícitamente (balance agregado, lista de transacciones, etc.), no un volcado de IndexedDB. Pero significa que **ninguna de las garantías de 8A (minimización, redacción, límites de clasificación, consentimiento) se aplica hoy en la práctica** cuando `VITE_AI_PROVIDER=openai` está activo. El propio documento 8A ya lo advertía como alcance ("8A no implementa ejecución de IA"), pero esta auditoría confirma que la fase de conexión nunca llegó a construirse.

### Recomendación (para implementación futura, no de esta iteración)

Insertar `AIPrivacyBoundaryPort.authorize()` entre el Context Builder y el paso al Provider Adapter (`aiExecutionPipeline.ts`), con esta regla fail-closed: si `authorize()` deniega, el turno responde con un mensaje de error de privacidad explícito al usuario (nunca un fallback silencioso a "enviar de todos modos"). Esto es puramente aditivo sobre el pipeline existente — no cambia contratos de `AIProvider`, `AIToolRegistry` ni `ConversationPage`.

## 3. Modelo de privacidad extendido para el nuevo modo de Acción

8A ya prohíbe explícitamente los propósitos `EXECUTE_TRANSACTION` y `MODIFY_FINANCIAL_DATA` para cualquier autorización hacia un proveedor externo — lo cual es exactamente correcto y no debe relajarse: **la propuesta de acción (§4 del documento de arquitectura) se construye a partir de lo que el modelo interpretó, pero el propio acto de guardar ocurre en el dispositivo, invocando servicios locales, nunca como una "transacción autorizada" hacia el proveedor de IA.** El proveedor externo solo participa en la interpretación (qué quiso decir el usuario), nunca en la ejecución. Esto ya es coherente con el catálogo de propósitos de 8A tal como está definido — no requiere una categoría nueva, solo la conexión descrita en §2.

## 4. Qué debe saber el usuario (transparencia, sección 10 del encargo)

En la pantalla del Asistente (o en un enlace desde ella) debe quedar accesible, en lenguaje llano:

- Qué información se usa para responder (el mensaje escrito + los datos agregados que la tool de consulta específica devuelve — nunca "toda tu base de datos").
- Qué nunca sale del dispositivo si no se activa un proveedor externo (todo, en modo `mock`/`LOCAL_ONLY`).
- Qué podría enviarse a un proveedor externo si se activa (el contenido descrito en el punto anterior, sujeto a 8A una vez conectado según §2).
- Cómo desactivar la IA (volver a `VITE_AI_PROVIDER=mock`, o — recomendado para el usuario final, no solo para quien despliega — un toggle en Configuración que no requiera tocar variables de entorno).
- Cómo borrar el historial (ya existe `clearMemory` en `AIConversationApplicationService`, ADR-026; falta exponerlo como botón visible en la UI del Asistente — ver roadmap).

Ninguno de estos cuatro puntos requiere invención de mecanismo nuevo: los tres primeros son documentación de lo que 8A y el diseño de tools ya garantizan (una vez conectado según §2); los dos últimos son UI sobre funciones ya existentes en el backend de la aplicación.
