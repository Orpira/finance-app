# 10 - Coding Rules

## 1) Regla de prioridad

Las reglas de este documento complementan la Constitución técnica. En conflicto, prevalece `docs/PRIVATE_BALANCE_CONSTITUTION.md`.

## 2) Tipado y contratos

- Usar TypeScript estricto para contratos de frontera.
- Evitar `any` en servicios, repositorios y APIs.
- Definir DTOs explícitos para entrada/salida de capas.

## 3) Límites por capa

- `pages/components`: presentación y estado de vista.
- `services`: orquestación de aplicación.
- `intelligence/insight`: dominio y reglas deterministas.
- `api/server`: seguridad, validación y bridging remoto.

No mezclar responsabilidades entre capas sin ADR.

## 4) Reglas de persistencia

- Cambios Dexie siempre con migración versionada.
- No romper tablas operativas por features derivadas.
- Respetar append-only en snapshots/knowledge.

## 5) Reglas de seguridad en código

- No incluir secretos en cliente.
- No registrar tokens/licencias completas en logs.
- Validar métodos, content-type, tamaño y origen en API.
- Mantener verificación criptográfica de licencias V2.

## 6) Reglas de automatización

- Toda integración webhook debe tener respuesta explícita.
- `eventId` e idempotencia son obligatorios.
- Resolver canal por contexto, nunca global recency-only.

## 7) Reglas de fail-safe

- Ante error de frontera, devolver fallback seguro.
- No inventar datos si falta trazabilidad requerida.
- Mantener errores codificados en servicios críticos.

## 8) Reglas de testing

- Toda lógica de dominio nueva debe tener pruebas unitarias.
- Cambios en integración remota requieren pruebas de contrato.
- Cambios de persistencia requieren validación Dexie/IndexedDB.

## 9) Reglas de documentación

- Actualizar docs en el mismo hito lógico del cambio.
- Diferenciar siempre: implementado vs objetivo.
- Registrar decisiones estructurales en ADR/changelog.

## 10) Prohibiciones explícitas

- modificar fórmulas financieras por conveniencia de UI;
- usar feature flags ambiguos o con parsing permisivo;
- mezclar commit de refactor con cambio funcional crítico;
- introducir dependencia externa sin justificación y validación.
