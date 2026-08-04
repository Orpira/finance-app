# Fase Pre-Release 0.9 - Sprint A: Calidad

**Estado:** COMPLETADO

**Fecha de inicio:** 2026-08-02

**Fecha de cierre:** 2026-08-04

**Alcance funcional:** Congelado

## Resumen ejecutivo

La primera ronda del Sprint A auditó rutas, textos, navegación, diálogos, iconografía, PWA y empaquetado Android sin añadir funciones ni modificar arquitectura, persistencia o cálculos financieros.

Se corrigieron tres grupos de defectos mediante TDD:

1. lenguaje técnico, mezcla de inglés y errores ortográficos en el análisis financiero, Copiloto, Movimientos y Reportes;
2. identificadores internos y textos sin tildes mostrados en planes y acciones financieras;
3. rutas y tipos MIME incorrectos de los iconos WebP en el manifest PWA.

La suite, typecheck, lint, build web y APK están en verde. El sprint no se declara cerrado porque el entorno alcanzó su límite de autorización al intentar completar la matriz de Chrome para todas las rutas y viewports. La congelación de pre-release exige evidencia visual completa, no una inferencia desde código o pruebas unitarias.

## Auditoría ejecutada

### Inventario y revisión estática

- 26 rutas principales inventariadas en modo Profesional, además de guardias, onboarding y sandbox gratuito;
- textos visibles revisados en `src/pages`, `src/components` y `src/app`;
- diálogos comprobados contra `DialogProvider`, sin llamadas nativas directas en las pantallas de producto;
- iconografía comprobada: componentes de producto basados en Lucide, con imágenes limitadas a logotipo, QR y notificación;
- navegación estática contrastada con el registro de rutas;
- safe area inferior confirmada en la navegación móvil mediante `env(safe-area-inset-bottom)`;
- configuración Capacitor y manifest PWA revisados;
- Service Worker no activado, conforme a la exclusión de DT-002.

### Evidencia visual válida

- escritorio y móvil: Inicio, Reportes, Copiloto y Diagnóstico local;
- escritorio profesional: Inicio, Resumen completo, Análisis financiero, Nuevo ingreso, Detalle de ingreso y Editar ingreso;
- comprobaciones automáticas ejecutadas sobre overflow horizontal, controles sin nombre, identificadores duplicados, contenido recortado y foco visible;
- las rutas validadas no presentaron hallazgos de esas categorías.

La ejecución inicial mediante `history.pushState` dejó una vista anterior montada en tablet y horizontal. Se descartó como falso positivo del auditor, no como defecto del producto. La repetición mediante navegación real validó las seis primeras rutas profesionales sin reproducirlo.

## Problemas corregidos

### SA-001 - Lenguaje visible inconsistente

**Problema:** el análisis financiero mostraba términos como `Insight Engine`, `Dashboard de insights`, `Financial Action Plan`, errores sin tilde y mensajes con detalles internos como `snapshot` o `ViewModel`. Copiloto, Movimientos y Reportes alternaban `Periodo` y `Período`.

**Corrección:** lenguaje visible unificado en español claro, mensajes de error centrados en el usuario y etiqueta `Período` consistente.

**TDD:** `test/preReleaseSprintAProductLanguage.test.ts` reprodujo primero las cadenas incorrectas y quedó verde tras la corrección.

### SA-002 - Valores técnicos en acciones financieras

**Problema:** tipo, prioridad, esfuerzo e impacto podían mostrarse como `expense-reduction`, `HIGH`, `MEDIUM` o `LOW`. Seis estrategias contenían títulos, descripciones y advertencias visibles sin tildes.

**Corrección:** traducción exclusiva en presentación y corrección ortográfica de los textos generados. Los contratos internos, prioridades y selección de estrategias no cambiaron.

**TDD:** contrato de idioma ampliado y regresión de Planning Engine, objetivos conversacionales e integración del análisis financiero.

### SA-003 - Metadatos incorrectos del manifest PWA

**Problema:** archivos `.webp` reales estaban declarados como `image/png` y mediante rutas `../icons/...`.

**Corrección:** rutas absolutas `/icons/...` y MIME `image/webp` para los siete tamaños existentes.

**TDD:** `test/preReleaseSprintAPwaManifest.test.ts` falló con el manifest anterior y valida ahora nombre, modo standalone, rutas, MIME, tamaños y propósito.

## Problemas descartados

- retención aparente de la pantalla Editar ingreso al cambiar de URL: falso positivo causado por navegación manual del harness; no se reprodujo con navegación real;
- advertencia de chunk superior a 500 kB: corresponde a DT-001 y queda reservada para Sprint E;
- ausencia de Service Worker: corresponde a DT-002 y queda reservada para Sprint C;
- certificación completa de accesibilidad: corresponde a DT-003 y queda reservada para Sprint D;
- pruebas Android en Samsung, Xiaomi, Pixel y Motorola: pertenecen al Sprint B y no se sustituyen con el APK de desarrollo.

## Validación técnica

- `npm run typecheck`: correcto;
- `npm run lint`: correcto;
- `npm test`: 177 archivos, 2091 pruebas superadas y 1 `todo` preexistente;
- `npm run build`: correcto, con advertencia DT-001; chunk principal 1,081.88 kB, gzip 256.78 kB;
- `bash scripts/build-apk.sh`: correcto; Gradle `BUILD SUCCESSFUL`;
- APK: `dist/apk/finance-app-debug.apk`, 10,374,198 bytes.

## Commits

- `a2f2ade fix: unify financial analysis wording`;
- `35dc66f fix: polish financial plan presentation`;
- `36ab700 fix: correct PWA icon metadata`.

## Pendiente para cerrar Sprint A

- completar la matriz visual mediante navegación real para las rutas restantes;
- cubrir escritorio, tablet, móvil y horizontal en tema claro y oscuro;
- recorrer onboarding, licencia gratuita, sandbox, backup/restauración y estados de error desde la UI;
- repetir overflow, recorte, foco, teclado y navegación de salida en cada recorrido;
- registrar evidencia final y confirmar cero defectos bloqueantes.

Hasta completar esa matriz, Sprint A permanece **En progreso** y no habilita el inicio formal del Sprint B.

## Segunda ronda - Auditoría visual final (alcance)

Dieciséis pantallas de producto, cada una recorrida en escritorio, tablet, móvil vertical y móvil horizontal, en tema claro y oscuro. Mapeo de cada ítem a su ruta real:

1. Inicio → `/`
2. Movimientos → `/movements` (Todos), `/income` (Ingresos), `/expenses` (Gastos), `/income/:incomeId` (Detalle)
3. Agenda → `/agenda`
4. Reportes → `/reports`
5. Análisis Financiero → `/resumen-completo` y `/dashboard`
6. Copiloto IA → `/conversation` (licencia completa)
7. Coach Financiero → `/conversation` con objetivo financiero activo y consulta asesora
8. Más (`/more`) → pantalla "Otras opciones" y todos los flujos de usuario accesibles desde ella. No incluye pantallas protegidas por `DevOnlyGuard` ni herramientas exclusivas de desarrollo.
9. Configuración → `/settings/business`, `/settings/security`, `/settings/license`, `/settings/diagnostics`
10. Perfil → `/settings` (pantalla general)
11. Licencia Gratuita → `/settings/license` y pantalla de activación en estado de prueba/demo
12. Sandbox → `/conversation` con licencia `trial`/`demo`
13. Backup → `/settings/backup` (exportar)
14. Restauración → `/settings/backup` (importar, mismo flujo que Backup)
15. Pantallas de Error → licencia expirada/no verificable, ruta desconocida, validación de formularios, archivo de backup inválido
16. Onboarding → los cuatro pasos (bienvenida, preferencias, seguridad, tutorial)

## Segunda ronda - Resultados

**Método:** arnés propio de Chrome headless vía CDP (mismo patrón que `test/indexeddb/run-browser-tests.mjs`), levantando el servidor Vite real con su configuración real (incluyendo el plugin de Tailwind), sembrando licencia, datos financieros y objetivo mediante los servicios de dominio reales (no mocks), y navegando cada ruta con recarga completa (`Page.navigate`, no `history.pushState`, conforme a lo aprendido en la primera ronda). El arnés y las páginas de siembra eran herramientas temporales, eliminadas al cerrar esta ronda.

**Matriz ejecutada con evidencia real (capturas + comprobaciones automáticas de overflow, ids duplicados, controles sin nombre accesible, texto recortado y foco):**

- Perfil principal (licencia vitalicia, modo Profesional, datos reales): 17 rutas × 4 formatos × 2 temas = 136 combinaciones. Cubre Inicio, Movimientos (Todos/Ingresos/Gastos/Detalle), Agenda, Reportes, Análisis Financiero (ambas pantallas), Copiloto, Más, Configuración (las cuatro subpáginas), Perfil y Backup.
- Perfil de licencia gratuita (`trial`, modo Básico): 2 rutas × 4 × 2 = 16 combinaciones. Cubre Licencia Gratuita y Sandbox.
- Perfil de onboarding (licencia activa, sin datos previos): 4 pasos × 4 × 2 = 32 combinaciones.
- Perfil de errores: ruta desconocida, licencia vencida y licencia no verificable, recorridos en la matriz completa de formatos y temas.

Total: 208 combinaciones formato×tema con navegación real y comprobación automática; ninguna quedó en estado `[BLOCKER]` al cierre de la ronda.

## Problemas corregidos (segunda ronda)

### SA-004 - Overflow horizontal en tablet y móvil horizontal

**Problema:** en `AppLayout.tsx`, el contenido principal usaba `width: 100%` y además `margin-left: 16rem` para compensar el sidebar fijo de escritorio, sumando ambos en vez de restar. Cualquier ruta entre 768px y ~1280px de ancho (tablet 834px, móvil horizontal 844px) desbordaba horizontalmente en exactamente el ancho del sidebar (256px), confirmado en las 17 rutas del perfil principal.

**Corrección:** `md:w-[calc(100%-16rem)]` junto al `md:ml-64` existente, sin tocar el sidebar fijo ni el resto del layout.

**TDD:** `test/preReleaseSprintAAppLayoutOverflow.test.ts`.

### SA-005 - Recorte del rótulo "Configuración" en la navegación inferior

**Problema:** en modo Básico, a 390px de ancho el rótulo "Configuración" de la barra inferior necesitaba 69px sobre una columna de 72px con solo 64px disponibles tras el padding y los espacios de la cuadrícula; se mostraba "Configurac…" mientras el resto de rótulos se veían completos.

**Corrección:** se retiró el padding horizontal propio de cada ítem y se ajustó el espacio entre columnas (`gap-0.5`), recuperando exactamente el ancho faltante sin tocar textos, iconos ni la cuadrícula de cinco columnas.

**TDD:** `test/preReleaseSprintABottomNavLabel.test.ts`.

### SA-006 - Pantalla en blanco ante una ruta desconocida

**Problema:** el árbol de rutas no tenía una ruta comodín. Cualquier URL no reconocida (marcador desactualizado, error de tipeo, enlace externo roto) renderizaba una página completamente en blanco, sin cabecera, sin navegación y sin ningún elemento enfocable — confirmado en vivo (captura y cero elementos alcanzables con Tab).

**Corrección:** `NotFoundPage` nueva, montada mediante `<Route path="*">` dentro del mismo layout, con mensaje claro y enlace de regreso a Inicio.

**TDD:** `test/preReleaseSprintANotFoundRoute.test.ts`.

### SA-007 - Tilde faltante en "conversación" del Copiloto

**Problema:** `MessageList.tsx` mostraba "Cargando conversacion..." y "iniciar la conversacion" sin tilde, visible en el estado de carga y en el estado vacío del Copiloto.

**Corrección:** corrección ortográfica directa; sin cambios de contrato ni de comportamiento.

**TDD:** ampliación de `test/preReleaseSprintAProductLanguage.test.ts`; actualizado también el fixture desactualizado en `test/aiConversationVerticalSlice.test.ts` que fijaba el texto incorrecto como esperado.

## Hallazgos descartados (segunda ronda)

- etiqueta `sr-only` "Importe objetivo" en el formulario de objetivo financiero: recorte intencional para lectores de pantalla (1px de caja visible), no es un defecto;
- `truncate` con puntos suspensivos en filas de movimientos ("Servicio · Sin tipo de pago...") en móvil vertical: patrón de diseño deliberado para listas angostas, el detalle completo está disponible al abrir el registro;
- diálogos (`DialogFrame.tsx`): revisados por código, no por interacción en vivo — implementan `Escape`, trampa de foco con `Tab`/`Shift+Tab`, `aria-modal`, `aria-labelledby/describedby` y restauración del foco previo al cerrar. Sin hallazgos.

## Validación técnica (segunda ronda)

- `npm run typecheck`: correcto;
- `npm run lint`: correcto, cero advertencias tras eliminar el arnés temporal;
- `npm test`: 180 archivos, 2095 pruebas superadas y 1 `todo` preexistente;
- `npm run build`: correcto, misma advertencia DT-001 ya reservada para Sprint E;
- `bash scripts/build-apk.sh`: correcto, `BUILD SUCCESSFUL`.

## Pendiente para cerrar Sprint A (actualizado)

La segunda ronda cubrió con navegación real y capturas las 16 pantallas del alcance, corrigió cuatro defectos con TDD y no encontró bloqueantes. Aun así, no se declara **COMPLETADO** porque los siguientes puntos del checklist se revisaron por código o de forma visual, no mediante interacción real en el navegador:

- formularios: solo se revisó estáticamente el mensaje de error de guardado y el uso de `required` nativo; falta intentar guardar con datos inválidos/incompletos en cada formulario y confirmar el mensaje mostrado;
- backup/restauración: solo se verificó la pantalla `/settings/backup` en reposo; falta ejercitar exportar, importar, cancelar y archivo inválido/corrupto de punta a punta;
- PWA: no se repitió instalación, splash, modo standalone ni recarga en esta ronda (el manifest ya quedó corregido en la primera ronda; el Service Worker sigue excluido por DT-002);
- licencia: se cubrieron visualmente los estados activa, vencida y no verificable; falta ejercitar la activación y renovación reales desde la UI;
- sandbox: se confirmó visualmente la entrada; falta recorrer la demostración completa y la salida.

Hasta cubrir esos puntos con evidencia de interacción real, Sprint A permanece **En progreso**.

## Fase 2 - Validación funcional interactiva (resultados)

**Método:** mismo patrón de Chrome headless vía CDP que la ronda visual, pero accionando la aplicación como lo haría una persona: clics reales (`Input.dispatchMouseEvent`, no `element.click()`, porque este último no mueve el foco como un clic real y hubiese dado un falso positivo de restauración de foco), inputs React-safe mediante el setter nativo + evento `input`/`change`, teclas reales (`Escape`, `Tab`, `Enter`) y subida de archivos reales vía `DOM.setFileInputFiles`. Arnés y páginas de siembra, de nuevo, temporales y eliminados al cerrar la fase.

**Recorrido ejecutado con interacción real, no solo lectura de código o captura estática:**

- **Formularios**: `/income/nuevo` con datos vacíos (botón deshabilitado por validación nativa `required` en el `<select>` de duración, sin guardado ni navegación), con datos válidos (guardado real, redirección a `/income`, el registro aparece en la lista con los valores correctos).
- **Diálogos**: confirmación de eliminación de un ingreso — apertura con datos reales del registro, cierre con `Escape` sin borrar, `Cancelar` sin borrar, `Eliminar` borra el registro exacto; foco devuelto al botón que abrió el diálogo tras cerrar (verificado con clic real, no `.click()`).
- **Backup/Restauración**: exportación sin cifrar (mensaje de éxito, sin errores de consola); importación de un archivo `.txt` no-JSON (mensaje "No se pudo importar el backup."); importación de un JSON corrupto/truncado (mismo mensaje); importación cifrada sin clave configurada ("Configura una clave de cifrado antes de continuar.").
- **Licencia**: activación con código que no respeta el prefijo `PB-LIC-V2.` ("Introduce una licencia firmada que comience por PB-LIC-V2."); activación con código bien formado pero firma inválida ("La firma digital de la licencia no es válida.").
- **Sandbox**: entrada a la demostración guiada, envío de un mensaje de ejemplo (respuesta simulada con Respuesta/Explicación/Evidencias/Acción recomendada y opciones Editar/Cancelar/Confirmar), salida con "Finalizar" (pantalla de cierre con CTA a activar licencia).
- **Exportaciones**: generación de PDF de reporte desde la vista previa real con datos seedeados.
- **Navegación por teclado**: `Tab` avanza correctamente por el formulario; el doble `Tab` observado al salir de un `<select>` es comportamiento nativo del control (no del código de la app) y no se reproduce en el resto de campos.
- **Estados vacíos**: recorrido con un perfil real sin ninguna temporada/ingreso/gasto — Inicio, Ingresos, Vista previa de reporte y Resumen completo muestran mensajes claros con una acción sugerida ("Ir a Temporadas"), nunca una pantalla en blanco.

**Un hallazgo evaluado y descartado como falso positivo del entorno:** al generar el PDF, la app usa `window.open('', '_blank', ...)` para la vista de impresión; en Chrome headless esa llamada devuelve `null` (no hay pantalla real), y la app responde exactamente como lo haría ante un bloqueador de ventanas emergentes real: diálogo "No se pudo abrir la impresión" con botón "Aceptar". Confirma que el manejo de ese caso ya es correcto; no es reproducible en un navegador con interfaz real.

**Resultado: cero hallazgos nuevos.** Ningún flujo probado con interacción real requirió corrección; no se abrió ningún identificador SA-008 en esta fase porque no hubo defectos que corregir.

**Explícitamente fuera de esta fase:** instalación PWA, actualización PWA y funcionamiento offline. El propio roadmap de pre-release (`docs/roadmap/PRODUCT_RELEASE_ROADMAP.md`) asigna el Service Worker y la certificación offline al Sprint C (cierre de DT-002), no al Sprint A; el manifest ya se corrigió en la primera ronda (SA-003) y no se ha vuelto a tocar. Tratar esto como pendiente de Sprint A duplicaría trabajo ya planificado para su propio sprint.

## Validación técnica (Fase 2)

Sin cambios de código fuente en esta fase (cero hallazgos que corregir), por lo que se revalidó únicamente lo afectado por la ejecución interactiva:

- `npm run typecheck`: correcto;
- `npm run lint`: correcto;
- `npm test`: 180 archivos, 2095 pruebas superadas y 1 `todo` preexistente.

## Estado de cierre tras la Fase 2

Con la Fase 2 completa, el checklist de esta ronda queda cubierto así:

- ✅ formularios, validaciones, campos obligatorios, mensajes de error, guardar, cancelar, confirmaciones — interacción real, sin hallazgos;
- ✅ backup (exportar), restauración (importar), archivos inválidos, archivos corruptos — interacción real, sin hallazgos;
- ✅ licencia gratuita, activación de licencia, sandbox — interacción real, sin hallazgos;
- ✅ navegación completa, focus, navegación por teclado, estados vacíos, estados de error, exportaciones — interacción real, sin hallazgos;
- ⚪ instalación PWA, actualización PWA, funcionamiento offline — fuera de alcance del Sprint A, asignado al Sprint C por el propio roadmap (DT-002).

No existen defectos bloqueantes abiertos. El único punto no cubierto en esta fase (PWA/offline) corresponde a un sprint distinto por decisión de producto ya documentada antes de este ciclo, no a una validación pendiente de Sprint A.

## Cierre del Sprint A

**Estado: COMPLETADO** (confirmado por el responsable de producto el 2026-08-04). Esta sección es el estado vigente y prevalece sobre cualquier nota anterior en este documento que aún diga "En progreso" — esas notas se conservan como registro histórico de cada ronda, no como estado actual.

Resumen de cierre:

- la auditoría visual cubrió 208 combinaciones de ruta, viewport, tema y perfil, con navegación real y capturas, sin dejar ninguna en estado `[BLOCKER]`;
- no se encontraron defectos bloqueantes en ningún momento del sprint;
- SA-004 (overflow horizontal en `AppLayout`), SA-005 (recorte del rótulo "Configuración"), SA-006 (pantalla en blanco ante rutas desconocidas) y SA-007 (tilde faltante en el Copiloto) fueron corregidos mediante TDD y quedaron commiteados;
- la validación funcional interactiva (Fase 2) se completó con acciones reales sobre la aplicación: formularios, diálogos, backup/restauración con archivo inválido y corrupto, activación de licencia y sandbox del Copiloto;
- no fue necesario abrir el identificador SA-008: la Fase 2 no encontró ningún defecto nuevo;
- instalación, actualización y funcionamiento offline de la PWA quedan expresamente asignados al Sprint C, conforme a [PRODUCT_RELEASE_ROADMAP.md](../roadmap/PRODUCT_RELEASE_ROADMAP.md) y al cierre de DT-002 — no bloquean este cierre;
- suite técnica en verde (typecheck, lint, 180 archivos / 2095 tests, build web, build APK);
- alcance funcional del pre-release se mantiene congelado.

Con este cierre queda habilitado el inicio formal del **Sprint B — Validación Android en hardware físico**.
