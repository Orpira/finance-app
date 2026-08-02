# Fase Pre-Release 0.9 - Sprint A: Calidad

**Estado:** En progreso

**Fecha de inicio:** 2026-08-02

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
