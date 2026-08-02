# Experiencia Unificada de Private Balance

## Criterio de producto

Hasta la versión 1.0, una funcionalidad solo entra si mejora de forma comprobable la comprensión, privacidad, velocidad, utilidad o experiencia. La Iteración 6 consolida capacidades existentes y no añade inteligencia predictiva, agentes ni integraciones externas.

## Lenguaje canónico

El concepto visible para el usuario es **Copiloto**. `Asistente`, `Asistente IA`, `Asistente Inteligente` e `Inteligencia` pueden permanecer en nombres técnicos históricos o contratos internos, pero no deben aparecer como nombres alternativos del producto.

## Respuestas del Copiloto

Las respuestas reales y el sandbox gratuito comparten `CopilotResponseLayout`:

1. Respuesta.
2. Explicación.
3. Evidencias.
4. Acción recomendada.

Una propuesta mantiene edición, cancelación y confirmación obligatoria. Esta composición no cambia el motor, sus cálculos ni la frontera de privacidad.

## Inicio

El orden visual contractual es: prioridad principal, resumen financiero, salud financiera, objetivos, agenda, actividad reciente y acciones sugeridas. Se muestra una sola prioridad principal y se conservan enlaces contextuales a Movimientos, Agenda, Reportes, Objetivos y Copiloto.

## Accesibilidad

Se añadió foco visible global, soporte de `prefers-reduced-motion`, regiones vivas para estados asíncronos, encabezados y controles con nombre accesible. La auditoría manual completa con lectores de pantalla y dispositivos físicos sigue registrada en DT-003.

## Cierre del modelo de iteraciones

La Iteración 6 es la última gran iteración funcional previa a 1.0. El trabajo siguiente es la Fase Pre-Release 0.9: siete sprints de calidad, Android real, PWA, accesibilidad, rendimiento, privacidad y estabilidad deben demostrar el producto existente antes de declarar `Private Balance 0.9 RC`. No se abrirá una Iteración 7 antes de 1.0.

El alcance y los criterios de salida se mantienen en el [roadmap de pre-release](../roadmap/PRODUCT_RELEASE_ROADMAP.md).
