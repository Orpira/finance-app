# Next Task

## 1) Objetivo inmediato recomendado

Cerrar brechas operativas críticas detectadas en workflows y formalizar criterios de certificación técnica para la siguiente fase.

## 2) Secuencia propuesta

1. Definir ADR de criterio formal de cierre 8A/8B con métricas verificables.
2. Auditar y corregir ramas de n8n sin respuesta final en flujo `Private Balance - Nuevo Ingreso`.
3. Completar convergencia de referencias legacy a modelo moderno (`communication_channels`, `license_devices`).
4. Ejecutar gate técnico integral (`test`, `build`, `indexeddb`, `lint-scope`).
5. Actualizar changelog y docs de operación post-cambio.

## 3) Entregables mínimos de la siguiente iteración

- ADR nueva de certificación.
- evidencia de workflows corregidos (sin ramas huérfanas).
- evidencia de compatibilidad de contratos API.
- reporte de validación técnica final.

## 4) Criterio de done sugerido

- cero ramas críticas sin `Respond to Webhook`;
- resolución de canal 100% contextual en eventos de negocio;
- sin regresión en tests críticos de AI Foundation;
- documentación actualizada y coherente con implementación.
