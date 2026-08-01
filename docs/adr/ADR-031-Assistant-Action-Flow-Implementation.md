# ADR-031 - Assistant Action Flow Implementation

Estado: Accepted
Version: 1.0
Fecha: 2026-08-02
Relacionado: ADR-030, ADR-026, `docs/26_AI_FOUNDATION_PRIVACY_BOUNDARY.md`

## Problema

ADR-030 diseñó el flujo de acción del Asistente (registrar ingreso/gasto, crear cita) asumiendo que se implementaría extendiendo `AIToolRegistry` con tools de permiso `write`, resueltas por el mismo pipeline LLM que resuelve las tools de consulta hoy (`financial_balance`, etc.), a través de `src/intelligence/execution-pipeline/aiExecutionPipeline.ts`.

Al empezar la implementación se descubrió que esa asunción era incorrecta: `aiExecutionPipeline.ts` **no es el pipeline real** que usa `/conversation`. `ConversationPage.tsx` se compone en `src/pages/Conversation/conversationComposition.ts`, que usa una arquitectura distinta y mucho más grande — `activationEngine`, `skillResolver`, `conversationMemory`, `financialInsightEngine`, `financialPlanningEngine`, `goalManager`, `coachingModule` (`src/intelligence/ai-conversation/provider-orchestration/*`) — con su propia resolución de intención y ejecución de tools (`copilotAwareToolExecutor`). `aiExecutionPipeline.ts` solo lo usa `src/application/ai-conversation/aiConversationApplicationService.ts` (el "composition root" que ADR-025/CHANGELOG documentan como activado en producción, pero que **ningún componente de la aplicación importa**) y una página de debug.

## Decisión

Implementar la interpretación de los tres intents de acción (`register_income`, `register_expense`, `create_appointment`) como un **parser determinista y 100% local** (`src/intelligence/assistant/assistantIntentParser.ts`), que se ejecuta *antes* de llamar al pipeline conversacional existente y lo cortocircuita solo cuando reconoce uno de los tres patrones. Cualquier otro mensaje sigue exactamente el camino de consulta existente, sin ningún cambio.

Razones:

1. **Riesgo**: enhebrar un payload estructurado nuevo (la propuesta) a través del `activationEngine`/`goalManager`/`coachingModule` — un sistema grande, ya certificado y con muchos ADRs propios — para solo tres intents muy acotados, es una modificación de alto riesgo para un beneficio marginal.
2. **Privacidad**: los tres ejemplos del producto ("Hoy recibí 120 euros por un servicio", "Gasté 35 euros en transporte", "Mañana tengo una cita a las 18:30") son patrones regulares. Un parser determinista los resuelve con fiabilidad total sin enviar el mensaje del usuario a un proveedor de IA externo — mejor privacidad que la alternativa, no peor.
3. **"Tres flujos impecables"**: el objetivo explícito de esta iteración no era ampliar cobertura de lenguaje natural, sino que los tres flujos fueran perfectos. La extracción determinista es más predecible y más fácil de cubrir con tests exhaustivos que la extracción vía LLM.
4. **No se tocó el pipeline conversacional certificado**: cero cambios en `activationEngine`, `goalManager`, `coachingModule`, `financialInsightEngine`, `financialPlanningEngine` ni en sus tests.

## Consecuencias

- El Asistente ahora entiende estos tres intents incluso sin proveedor de IA configurado (`VITE_AI_PROVIDER=mock`), porque no depende de él.
- La cobertura de lenguaji natural para estos tres intents es más limitada que lo que un LLM permitiría (frases muy fuera de los patrones reconocidos no se detectan y el mensaje cae al camino de consulta, que no sabrá qué responder). Ver `docs/architecture/19_ASSISTANT_ACTION_FLOW.md` §6 para el catálogo exacto de patrones y la recomendación de evolución futura (LLM como interpretación de respaldo cuando el parser determinista no reconoce nada, nunca reemplazándolo).
- ADR-030 y `docs/architecture/17_INTELLIGENT_ASSISTANT_DEFINITIVE_ARCHITECTURE.md` (iteración 2) describían el diseño basado en `AIToolRegistry`/`aiExecutionPipeline.ts`; ese diseño queda superado por este ADR para los tres intents de acción. Los documentos de iteración 2 se mantienen como registro histórico de la evaluación (siguen siendo correctos sobre el estado del *resto* de la arquitectura: Insight Engine, memoria, 8A), con una nota que apunta aquí.
- Un hallazgo colateral de esta investigación (`aiConversationApplicationComposition.ts`/`api/ai-provider-openai.ts` no están conectados a la app real, y el composition root que sí está conectado llama a OpenAI con la API key en el cliente si `VITE_OPENAI_API_KEY` está configurada) se corrigió por separado a nivel de bloqueo de build (commit `bca00bb`) pero la corrección arquitectónica de fondo — cuál composition root debería ser el real — queda pendiente y documentada en `docs/architecture/18_AI_MEMORY_AND_PRIVACY_MODEL.md`.

## Alternativas descartadas

1. **Enhebrar la propuesta a través de `copilotAwareToolExecutor`/`activationEngine`** tal como asumía ADR-030. Descartado por riesgo (ver Decisión, punto 1) y porque no era necesario para cumplir el objetivo de esta iteración.
2. **Migrar `ConversationPage` a `aiConversationApplicationComposition.ts`** para unificar en un solo pipeline. Descartado: es un cambio arquitectónico mayor, no relacionado con el objetivo de esta iteración ("no implementar toda la inteligencia financiera avanzada en un solo cambio"), y arriesgaría perder funcionalidad ya construida (goals, coaching, planning) que solo existe en el pipeline actual.
