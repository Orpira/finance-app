# 15 - Technical Timeline (Consolidated)

## 1) Propósito

Esta línea de tiempo resume hitos técnicos relevantes para lectura rápida de evolución, sin reemplazar `docs/CHANGELOG.md`.

## 2) Línea base histórica

- Consolidación documental canónica y constitución técnica.
- Confirmación de stack local-first y separación cliente/server/automatización.

## 3) Evolución AI Foundation y derivados

### Bloque Financial Snapshot

- canonicalización versionada;
- fingerprint determinista con domain separation;
- sealer y repositorio append-only;
- shadow mode observacional;
- promoción controlada por policy + executor.

### Bloque Knowledge Layer

- builder determinista desde snapshot sellado;
- validator fail-closed;
- canonicalizer + fingerprint + sealer;
- repositorio append-only;
- shadow y promoción controlados.

### Bloque Insight Engine

- modelo de regla;
- builder/validator;
- repositorio en memoria;
- engine orquestador;
- runtime público;
- adapters de integración;
- execution service + read models;
- dashboard integration (7F).

## 4) Evolución de integración y seguridad

- licencias V2 firmadas offline;
- JWT temporal para gateway;
- validaciones de request y CORS/headers defensivos;
- contrato de automatización con idempotencia explícita.

## 5) Estado actual consolidado

- app productiva local-first estable;
- automatización remota operativa con riesgos acotados y documentados;
- AI Foundation disponible en modo controlado/no global;
- documentación de handoff y arquitectura consolidada para certificación.

## 6) Próxima ventana de evolución recomendada

1. cierre de deuda P0 en workflows y definición formal 8A;
2. refuerzo de gates CI/CD;
3. convergencia completa de legacy remoto;
4. estrategia de retención de artefactos append-only.
