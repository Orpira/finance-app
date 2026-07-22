# 25. Insight Dashboard Integration

## Proposito

Milestone 7F integra por primera vez el Insight Engine en UI sin acoplar React al nucleo interno.

La pantalla consume exclusivamente la frontera publica de 7D (Execution Service) y 7E (Read Models), y expone estados explicitos para rendering seguro.

## Descubrimiento Previo

Hallazgos de arquitectura UI actual:

- enrutado central en `src/routes/index.tsx`
- shell principal en `src/app/AppLayout.tsx`
- paginas con estado local usando `useState` + `useEffect`
- manejo de loading/error con vistas inline por pagina
- componentes de cabecera reutilizables via `PageHeader`
- no existe sistema i18n formal centralizado (ni `react-i18next`)
- estilos con Tailwind utilitario y semantica HTML explicita

Decision de integracion minima:

- reutilizar la ruta existente `/dashboard` (antes redireccionada)
- crear una frontera de estado y controlador para dashboard
- mantener componentes presentacionales desacoplados de servicios y dominio

## Arquitectura Aplicada

Financial/Application Trigger

-> Insight Execution Service (7D)

-> Insight Read Models (7E)

-> Insight Dashboard Controller + Hook (7F)

-> Componentes presentacionales React (7F)

La dependencia es unidireccional y fail-closed.

## Frontera Entre 7D, 7E Y 7F

- 7D ejecuta pipeline Snapshot -> Knowledge -> Runtime y retorna resultado publico.
- 7E proyecta `runtimeResponse` a DTOs de lectura readonly.
- 7F orquesta estado de UI, mapea fallos a estados renderizables y entrega solo Read Models a componentes.

7F no reimplementa pipeline de 7D ni proyeccion de 7E.

## Modelo De Estado

`InsightDashboardState` como union discriminada readonly:

- `idle`
- `loading`
- `success`
- `empty`
- `rejected`
- `error`

Reglas:

- `success` y `empty` contienen solo `InsightReadModelProjection`
- `rejected` contiene codigo conocido + mensaje seguro + `executionId`
- `error` contiene codigo de error controlado + mensaje seguro
- no se guardan `Error` nativos ni stack traces

## Controlador Y Hook

Componentes creados de frontera de aplicacion:

- `createInsightDashboardController`
- `useInsightDashboard`

Responsabilidades:

- exponer estado discriminado
- ejecutar carga explicita (`load` / `reload`)
- bloquear ejecucion duplicada durante `loading`
- soportar anulacion por `dispose` (unmount)
- ignorar resultados obsoletos por secuencia de request
- convertir failures y excepciones en estados explicitos

## Composicion De Dependencias

Se implemento una composition root minima fuera de componentes presentacionales:

- `createInsightDashboardDependencies`

Ensamblado:

- `SnapshotKnowledgeIntegration` (7B)
- `KnowledgeIntegration` (7C)
- `InsightExecutionService` (7D)
- `InsightReadModels` (7E)
- trigger de request desde snapshot sellado persistido

Nota:

- el acceso a repositorio de snapshot se mantiene fuera de JSX y fuera de componentes de presentacion
- no se usa Service Locator ni estado global mutable

## Loading, Empty, Rejected Y Error

- `loading`: estado accesible con `role="status"` y `aria-live="polite"`
- `empty`: ejecucion valida sin insights
- `rejected`: rechazo conocido de integracion/dominio, visible y reintentable
- `error`: excepcion o inconsistencia no mapeada a rechazo de dominio

## Fail-Closed En UI

- nunca se transforma `failure` de 7D en `success`
- no se renderizan datos como validos si 7E rechaza proyeccion
- no hay exito parcial
- no se fabrican datos faltantes
- ante inconsistencia, estado `error` explicito

## Componentes 7F

- `InsightDashboardPage`
- `InsightDashboard`
- `InsightStateViews`
- `InsightSummary`
- `InsightList`

Todos reciben props readonly y no invocan el motor.

## Accesibilidad

Implementado:

- regiones semanticas (`section`, `header`, `article`, `ul`, `li`, `dl`)
- estados con `role="status"` y `role="alert"`
- `aria-live` para feedback de estado
- boton de reintento accesible
- severidad y estado expresados por texto, no solo color

## Internacionalizacion

El repositorio no usa una capa i18n centralizada actualmente.

Por consistencia con la app existente, 7F mantiene textos visibles en espanol local de componente y no agrega claves nuevas de traduccion.

## Trazabilidad Minima

La UI consume desde Read Models:

- `executionId`
- `insightId`
- `ruleId` / `ruleVersion`
- `sourceSnapshotKey` / `sourceSnapshotId` / `sourceSnapshotRevision`

Sin exponer estructuras internas del Runtime.

## Pruebas

Cobertura 7F incluida:

- estado inicial
- transicion `idle -> loading`
- exito y exito proyectado via 7E
- estado `empty`
- `rejected` por fallo de 7D
- `error` por excepcion o proyeccion inconsistente
- no ejecucion duplicada durante `loading`
- no updates tras dispose/unmount
- descarte de resultados obsoletos
- chequeos estaticos de frontera UI y accesibilidad

## Dependencias Permitidas

- contratos publicos de 7D y 7E
- fronteras certificadas 7B/7C para composicion
- `PageHeader` y routing existente

## Dependencias Prohibidas

- acceso directo a Runtime/Repository/Builder/Validator/Orchestrator desde componentes
- acceso directo a Dexie/IndexedDB desde JSX
- persistencia de insights en UI
- IA/LLM
- polling/WebSockets/scheduler

## Limites Del Milestone

- no se modifica el nucleo del Insight Engine
- no se cambian contratos certificados de 7D/7E
- no se agrega arquitectura global de estado
- no se introducen librerias nuevas

## Riesgos

- si no existe snapshot sellado del contexto actual, el dashboard queda en `rejected`
- actualmente se usa catalogo de reglas vacio para primera integracion UI
- mensajes visibles dependen de strings locales por ausencia de i18n central

## Proximos Pasos

- incorporar catalogo de reglas productivo cuando se habilite oficialmente
- integrar etiqueta de ultima actualizacion funcional en UI
- conectar filtros de visualizacion sobre Read Models sin ampliar alcance de dominio
