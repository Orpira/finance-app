# Current State

AI Foundation 8A-8F esta completa. La arquitectura documental y los milestones 9A-11B estan implementados y alineados con contract-first y fail-closed.

9H incorpora el primer vertical slice conversacional visible para usuario con:

- pantalla dedicada de conversacion en UI;
- creacion de sesion al abrir;
- envio de mensaje y respuesta del asistente;
- historial renderizado;
- estados de carga/envio/error;
- consumo exclusivo de AIConversationService desde React.

El flujo conversacional usa Policy Engine y Lifecycle de AI Interaction dentro del servicio de dominio, sin acceso directo desde la UI a Session, Message o reglas internas.

10A incorpora el dominio Prompt Builder provider-neutral con contratos canonicos de prompt y segmento, factory inmutable, validador fail-closed y builder estructurado que devuelve `AIPrompt` validado.

El dominio Prompt Builder define roles propios (`SYSTEM`, `USER`, `ASSISTANT`, `CONTEXT`, `CONSTRAINT`) para separar semantica de prompt y semantica conversacional.

10B incorpora el dominio Context Builder provider-neutral con contratos canonicos de contexto y seccion, factory inmutable, validador fail-closed y builder estructurado que devuelve `AIContext` validado.

El dominio Context Builder define sources explicitos (`CONVERSATION`, `SESSION`, `USER_PROFILE`, `APPLICATION`, `FINANCIAL_DATA`, `CONFIGURATION`) para separar origen de informacion y representacion de prompt.

10C incorpora el dominio Context Resolution provider-neutral con estrategias deterministas (`DEFAULT`, `MINIMAL`, `CONVERSATION_ONLY`, `APPLICATION_ONLY`, `FINANCIAL_ONLY`) para resolver `AIContext` en `AIResolvedContext` inmutable sin mutar el contexto base.

La resolucion centraliza inclusion, exclusion y priorizacion de secciones en un resolver unico y fail-closed.

10D incorpora el dominio Provider Adapter provider-neutral con interfaz estable `AIProvider`, contratos `AIProviderRequest` y `AIProviderResponse`, capacidades tipadas, factory centralizada y adaptador OpenAI desacoplado que traduce exclusivamente `AIPrompt` hacia un payload externo y normaliza la respuesta al dominio.

10E incorpora el dominio Execution Pipeline como orquestador puro con una única operación `execute()` que coordina Context Builder, Context Resolution, Prompt Builder, AIProvider y Conversation Service mediante puertos explícitos e inyectables.

10F incorpora el dominio Execution Inspector como observador pasivo y opcional del pipeline, con trazas exportables, stages ordenados, snapshots de contratos públicos y una pantalla Debug de solo lectura para inspección de ejecución.

11A incorpora `AIConversationApplicationService` como capa de aplicación entre React y el motor de IA. La conversación visible usa ya `AIExecutionPipeline`, mantiene a Conversation como fuente canónica y expone la última traza real al inspector sin acoplar la UI principal a la observabilidad.

11B activa el proveedor remoto real reutilizando exclusivamente `OpenAIProviderAdapter` de 10D mediante la composition root `src/application/ai-conversation/aiConversationApplicationComposition.ts` y el proxy autorizado `api/ai-provider-openai.ts`.

El proveedor de respuesta utilizado en 9H fue reemplazado en la experiencia visible por un flujo basado en `AIConversationApplicationService` + `AIExecutionPipeline`. 10D define la frontera formal de proveedor, 10E centraliza la coordinación, 10F añade observabilidad pasiva, 11A conecta todo eso con la UI y 11B activa la composición de producción sin exponer la API key al cliente.

El lint global mantiene deuda historica conocida fuera del alcance del milestone 11B.
