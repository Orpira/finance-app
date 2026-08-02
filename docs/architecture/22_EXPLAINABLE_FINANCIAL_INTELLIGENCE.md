# Inteligencia Financiera Explicable

**Estado:** implementado en Iteración 5  
**Fecha:** 2026-08-02

## Propósito

El Copiloto responde qué ocurrió, por qué ocurrió y qué puede hacer el usuario usando exclusivamente cálculos locales. No utiliza un proveedor de IA para sumar, comparar, clasificar ni explicar resultados financieros.

## Read models comunes

`FinancialCopilotSnapshot` es la entrada calculada por `financialCopilotService`. `buildFinancialCopilot` proyecta nueve read models: resumen del periodo, comparación, categorías, ingresos sin reportar, agenda, prioridades, salud, actividad reciente y objetivos.

Todos contienen:

- periodo y moneda;
- fuente `local-financial-domain`;
- `calculatedAt`;
- métricas;
- limitaciones explícitas.

Inicio y Asistente consumen el mismo snapshot. La exportación confirmable de PDF reutiliza `buildFinancialCopilotSnapshot` y `reportShareService`; no introduce fórmulas financieras alternativas.

## Explicaciones y evidencia

Cada `FinancialCopilotInsight` contiene evidencia estructurada con métrica, valor actual, valor anterior y delta cuando existe, periodo y fuente. Los textos se generan a partir de esos valores. No se admiten inferencias vagas ni causalidad no demostrada.

Las acciones sugeridas incluyen `evidenceId` y abren el contexto relevante, por ejemplo Movimientos con categoría o estado ya filtrado.

## Salud financiera

Los estados siguen siendo `Muy estable`, `Estable` y `Necesita atención`; no existe puntuación oculta. Las reglas, motivos, evidencia, limitaciones y fecha se documentan en [explainable-financial-health.md](../product/explainable-financial-health.md).

## Privacidad y límites

- cálculo y memoria contextual locales;
- sin `fetch` en la ruta determinista;
- sin prompts, respuestas completas o read models en logs;
- ninguna escritura sin propuesta y confirmación;
- sin predicciones, fiscalidad personalizada ni recomendaciones de inversión.

