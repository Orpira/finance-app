# 14 - Decisions (Operational Consolidation)

## 1) Decisiones aceptadas vigentes

### D-001 Neon como base principal de backend

- Estado: aceptada.
- Resultado: licencias/dispositivos/canales se resuelven sobre Neon.

### D-002 n8n como motor de automatización

- Estado: aceptada.
- Resultado: workflows orquestan eventos y delivery externo.

### D-003 Evolution API encapsulada

- Estado: aceptada.
- Resultado: WhatsApp no se consume directo desde cliente.

### D-004 MCP/IA como herramienta de desarrollo, no runtime

- Estado: aceptada.
- Resultado: no dependencia operacional productiva de agentes.

### D-005 Resolución contextual obligatoria de canal

- Estado: aceptada.
- Resultado: `deviceCode -> userCode -> communication_channels`.

### D-006 Constitución técnica como fuente canónica

- Estado: aceptada.
- Resultado: jerarquía documental explícita.

## 2) Decisiones de implementación AI Foundation

### D-007 Legacy continúa oficial por defecto

- Estado: aceptada para fase actual.
- Resultado: adapters/pipelines no sustituyen globalmente la fuente financiera.

### D-008 Feature flags exactos para pilotos

- Estado: aceptada.
- Resultado: rollback por rebuild/redeploy sin mutación de datos históricos.

### D-009 Snapshots/Knowledge append-only

- Estado: aceptada.
- Resultado: trazabilidad por revisiones y prohibición de sobrescritura.

### D-010 Dashboard Insights desacoplado

- Estado: aceptada.
- Resultado: UI consume 7D/7E sin acoplar runtime interno.

## 3) Decisiones pendientes (requieren ADR futura)

1. Definición normativa oficial del milestone 8A con criterios medibles.
2. Política de retención/archivado de snapshots y knowledge.
3. Estrategia formal de convergencia total de workflows legacy.
4. Nivel de adopción global futura de Financial Engine como fuente oficial.

## 4) Criterio para introducir nuevas decisiones

- debe existir problema técnico explícito;
- debe evaluarse impacto en invariantes financieros/seguridad;
- debe incluir plan de rollback;
- debe registrar consecuencias operativas y de testing.
