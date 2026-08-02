# Copiloto Financiero Determinista

**Estado:** implementado en Iteración 4  
**Fecha:** 2026-08-02

## Objetivo

El Copiloto Financiero convierte datos locales ya calculados en ayuda breve y accionable sin crear nuevas pantallas, llamar a un modelo de IA ni modificar registros. Sus consumidores actuales son Inicio y el Asistente licenciado.

## Arquitectura

```text
Servicios financieros existentes (solo lectura)
  incomeService / expenseService / appointmentService / incomeReportService
                              |
                              v
financialCopilotService -> FinancialCopilotSnapshot
                              |
                              v
financialCopilotEngine (reglas puras y deterministas)
             |                                  |
             v                                  v
 Inicio: prioridades, salud,             Asistente: consultas
 insights, resumen, acciones             naturales y explicación
```

- `src/intelligence/deterministic-copilot/financialCopilotEngine.ts`: reglas puras, contratos y resolución de consultas.
- `src/intelligence/deterministic-copilot/financialCopilotSessionMemory.ts`: periodo, moneda, última consulta y última categoría únicamente en RAM.
- `src/services/financialCopilotService.ts`: adapta servicios locales al snapshot común respetando modo y temporada activa.
- `src/pages/Home/HomePage.tsx`: proyección no invasiva del resultado.
- `src/pages/Conversation/conversationController.ts`: resuelve consultas conocidas localmente antes del pipeline de proveedor.

## Reglas implementadas

- Tendencias mensuales cuando la variación absoluta es al menos 10 % y existe periodo comparable.
- Categoría principal cuando reúne al menos dos gastos y el 40 % del gasto mensual.
- Ingresos sin reportar y pendientes con más de siete días.
- Prioridades limitadas a citas de hoy y pendientes vencidos.
- Salud `Muy estable`, `Estable` o `Necesita atención`; no existe puntuación.
- Resumen natural con conteos, tendencia de ingresos y pendientes.
- Acciones sugeridas como enlaces; ninguna acción se ejecuta automáticamente.

No se evalúan objetivos mensuales porque Private Balance no tiene una entidad local de objetivo configurado. El motor no inventa uno a partir de temporadas o presupuestos reconstruidos.

## Consultas locales

El Asistente reconoce cuánto se ingresó este mes, cuánto se gastó, la categoría con más gastos, ingresos sin reportar, última cita e ingresos de ayer. Cada respuesta incluye una explicación basada en conteos, periodo o agrupación. Si una consulta no coincide con una regla, devuelve `null`; no fabrica una respuesta.

## Privacidad y memoria

- No hay `fetch`, adaptador LLM ni telemetría en esta ruta.
- Los datos permanecen en el dispositivo y se leen mediante servicios existentes.
- No se guardan prompts ni respuestas del copiloto determinista.
- La memoria se crea por instancia de la pantalla y se descarta al desmontarla.
- Un error de lectura local termina en un mensaje seguro y no deriva la consulta al proveedor.

## Relación con Insight Engine

El Insight Engine canónico (`src/insight`) conserva sus contratos, evidencia y snapshots trazables. El copiloto no lo reemplaza: es una capa de producto inmediata sobre agregados certificados. Una futura consolidación puede adaptar sus read models al `FinancialCopilotSnapshot` sin cambiar consumidores.

## Límites

- No escribe ingresos, gastos, citas ni estados de reporte.
- No cambia fórmulas ni recalcula registros históricos.
- No persiste conversaciones ni añade migraciones Dexie.
- No depende de red; funciona en web, PWA y APK con los mismos servicios locales.
