# Known Issues

## 1) Críticos

### KI-001: ramas de workflow sin respuesta final

- Área: n8n (`Private Balance - Nuevo Ingreso`).
- Impacto: posibles timeouts y manejo ambiguo del resultado en cliente.
- Estado: abierto.
- Mitigación temporal: fallback y control de idempotencia; no resuelve completitud de respuesta.

### KI-002: definición formal de milestone 8A no canónica

- Área: gobernanza documental.
- Impacto: ambigüedad de certificación futura.
- Estado: abierto.
- Mitigación temporal: criterio operativo documentado en handoff actual.

## 2) Altos

### KI-003: coexistencia de tablas/consultas legacy en workflows

- Área: n8n SQL.
- Impacto: riesgo de deriva respecto al backend moderno.
- Estado: abierto.
- Mitigación temporal: arquitectura principal mantiene resolución moderna en server.

### KI-004: deuda de lint global en áreas fuera de hitos recientes

- Área: calidad estática.
- Impacto: fricción para gates de release completos.
- Estado: abierto.

## 3) Medios

### KI-005: estrategia de retención de snapshots/knowledge no formalizada

- Área: persistencia local.
- Impacto: crecimiento acumulativo de almacenamiento.
- Estado: abierto.

### KI-006: cobertura contractual n8n no completamente automatizada

- Área: testing de integración.
- Impacto: riesgo de regresión en cambios de workflows.
- Estado: abierto.
