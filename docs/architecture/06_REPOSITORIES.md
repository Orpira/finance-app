# 06 - Repositories

## 1) Objetivo de la capa de repositorio

Aislar persistencia y consultas de artefactos de dominio, preservando contratos deterministas y evitando que UI/servicios dependan de detalles de almacenamiento.

## 2) Repositorios principales implementados

### `FinancialSnapshotRepository`

Ubicación: `src/intelligence/financial-snapshot/financialSnapshotRepository.ts`

Responsabilidades:

- persistencia append-only de snapshots sellados;
- idempotencia por `snapshotId`/fingerprint;
- gestión de revisión por `snapshotKey` dentro de transacción;
- consultas por clave, revisión e identidad.

Invariantes:

- no `update` ni `delete`;
- cadena de revisión continua (`supersedesSnapshotId` coherente);
- validación de integridad al persistir.

### `KnowledgeSnapshotRepository`

Ubicación: `src/intelligence/knowledge-layer/knowledgeSnapshotRepository.ts`

Responsabilidades:

- persistencia append-only de knowledge snapshots sellados;
- idempotencia por identidad de snapshot;
- validación de cadena `supersedes` y revisión secuencial;
- recuperación de última revisión por key.

Invariantes:

- transacciones `rw` en Dexie;
- rechazo de huecos de revisión;
- no reescritura de snapshots previos.

### `InsightRepository`

Ubicación: `src/insight/insightRepository.ts`

Responsabilidades:

- almacenamiento en memoria de `InsightCollection`;
- consultas puras por id/categoría/severidad/estado/scope;
- estadísticas deterministas.

Invariantes:

- fail-closed ante entradas inválidas;
- operaciones sin IO;
- reemplazo controlado de colección.

## 3) Patrón de uso desde servicios

- servicios de aplicación consumen puertos públicos de repositorio;
- repositorios no exponen detalles Dexie/estructura interna a UI;
- orquestadores (snapshot/knowledge/insight) delegan persistencia en puertos.

## 4) Contratos de consistencia

- identidad opaca de snapshots (`snapshotId`, `knowledgeSnapshotId`);
- versionado explícito (snapshot, canonicalización, ruleset, engine);
- evidencia material trazable en documentos canónicos;
- comportamiento idempotente ante reintentos.

## 5) Riesgos actuales de repositorio

- incremento de tamaño de IndexedDB por retención append-only;
- necesidad de estrategia explícita de retención/archivado futura;
- dependencia de rigor en validaciones de sellado/canonicalización.

## 6) Recomendaciones de evolución

- introducir política de retención no destructiva (archivado exportable);
- añadir métricas de crecimiento de snapshots por período;
- mantener compatibilidad de lectura entre versiones de canonicalización.
