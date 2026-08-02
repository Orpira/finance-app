# Memoria Contextual del Copiloto

**Estado:** implementado en Iteración 5  
**Fecha:** 2026-08-02

## Alcance

`financialCopilotSessionMemory` vive en una instancia JavaScript y conserva moneda, periodo, última consulta, categoría, métrica, resultado resumido, filtro, entidad, propuesta pendiente y reporte solicitado. No conserva la conversación completa.

No usa Dexie, `localStorage`, sincronización, telemetría ni proveedor externo. Se pierde al desmontar/reiniciar la sesión.

## Seguimientos locales

Reconoce mes anterior, explicación, categoría principal, conteo, fechas, pendientes, semana anterior, acciones posibles, creación de acción y filtros de categoría. Si falta una consulta anterior compatible responde que no tiene contexto suficiente. Una frase reconocida nunca cae al pipeline externo.

## Control del usuario

El Copiloto muestra chips de periodo, moneda y categoría. Cada chip puede retirarse; `Limpiar contexto` restablece toda la memoria efímera. Una nueva respuesta local reactiva únicamente los filtros que realmente utilizó.

## Limitaciones

- una sesión no comparte contexto con otra;
- no se resuelve una referencia ambigua por aproximación;
- retirar moneda mantiene la moneda predeterminada para cálculos, pero deja de tratarla como filtro contextual visible;
- esta memoria no modifica la infraestructura conversacional histórica del proyecto.
