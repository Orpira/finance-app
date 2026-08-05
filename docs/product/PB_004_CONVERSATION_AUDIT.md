# PB-004 - Auditoría de conversación, privacidad y robustez

**Estado de la auditoría:** Completada
**Estado de remediación:** Pendiente
**Fecha:** 2026-08-04
**Código auditado:** `470f64b493aa7eab5b4b85d6b523a0ae79eb4e66`

## Alcance

La auditoría revisó la ruta visible `/conversation` y su cadena de dependencias:

```text
ConversationPage
  -> ConversationController
  -> conversationComposition
  -> provider-orchestration
  -> Financial Tools / proveedor configurado
```

También contrastó este flujo con la capa paralela de aplicación que contiene el
repositorio local de conversaciones, las políticas de retención y parte de la
frontera de privacidad.

Este documento registra riesgos y defectos observados. No afirma que estén
corregidos ni autoriza cambios en fórmulas financieras, persistencia o envío de
datos a proveedores externos.

## Dictamen

No se demostró una vulnerabilidad crítica explotada ni una clave expuesta. Se
confirmaron tres defectos de severidad alta y varios problemas de privacidad,
integración, rendimiento y accesibilidad. La causa transversal es que la UI
visible y el servicio de aplicación con persistencia/retención siguen caminos
de composición distintos.

## Hallazgos

### PB-004-01 - Consentimiento y minimización externos incompletos

**Severidad:** Alta
**Estado:** Abierto; riesgo condicionado a habilitar un proveedor externo.

La ruta visible puede construir un payload con mensaje y contexto financiero
sin pasar de extremo a extremo por la frontera de consentimiento y minimización
de 8A. Antes de habilitar generación externa, el flujo debe verificar
consentimiento, minimizar el contexto y usar exclusivamente el proxy servidor.

Superficies: `src/pages/Conversation/conversationComposition.ts`,
`src/intelligence/ai-provider/openAIProvider.ts` y
`src/intelligence/ai-provider/openAIAdapter.ts`.

### PB-004-02 - Historial visible no persistido

**Severidad:** Alta
**Estado:** Abierto.

El controlador visible crea una sesión nueva y conserva sus mensajes en RAM;
un remount, una recarga o el cierre de la PWA pierde el historial. El repositorio
Dexie existente está conectado a otro composition root y no es consumido por la
página visible.

Superficies: `src/pages/Conversation/ConversationPage.tsx`,
`src/pages/Conversation/conversationController.ts` y
`src/application/ai-conversation/aiConversationApplicationComposition.ts`.

### PB-004-03 - Alcance profesional entre temporadas

**Severidad:** Alta
**Estado:** Abierto.

Las Financial Tools filtran por modo Personal/Profesional, pero no aplican por
defecto el identificador de la temporada activa. Una consulta profesional puede
mezclar movimientos de temporadas distintas. La remediación debe usar el
alcance canónico por `seasonPeriodId`, permitir histórico global solo ante una
petición explícita y fallar cerrado si el contexto profesional requerido falta.

Superficies: `src/intelligence/ai-tools/financial/balanceTool.ts` y
`src/intelligence/ai-tools/financial/transactionsTool.ts`.

### PB-004-04 - Configuración segura del proveedor real

**Severidad:** Media-alta
**Estado:** Abierto.

El adaptador contempla ejecución en navegador y una variable de clave cliente
que el guard de secretos prohíbe en cualquier build válido. No se encontró una
clave desplegada. El proveedor real debe operar mediante un adaptador cliente
al endpoint servidor, con el secreto únicamente en server-side.

Superficies: `src/intelligence/ai-provider/openAIAdapter.ts`,
`src/intelligence/ai-provider/openAIConfiguration.ts` y
`src/config/forbiddenClientSecrets.ts`.

### PB-004-05 - Timeout sin cancelación de la solicitud

**Severidad:** Media
**Estado:** Abierto.

El timeout usa una carrera de promesas, pero no cancela la solicitud subyacente.
Un reintento puede coexistir con una solicitud tardía y aumentar latencia o
coste. Se requiere `AbortController` por intento y un deadline único por turno.

### PB-004-06 - Auditoría con contenido financiero o textual

**Severidad:** Media
**Estado:** Abierto.

La instrumentación puede conservar muestras serializadas de transacciones y
previews de respuestas en memoria o consola de desarrollo. La auditoría debe
limitarse a identificador de herramienta, conteo, duración, estado y código de
error, sin registros, importes, notas ni texto conversacional.

Superficies: `src/intelligence/ai-tools/financial/transactionsTool.ts` y
`src/intelligence/ai-conversation/provider-orchestration/runtimeConversationAudit.ts`.

### PB-004-07 - Límites de entrada, historial y desplazamiento

**Severidad:** Media
**Estado:** Abierto.

La UI visible no impone el límite contractual de 4000 caracteres, el historial
DOM puede crecer sin ventana y no existe desplazamiento controlado al último
mensaje. Deben alinearse composer, controlador y validador, además de acotar la
representación visible.

### PB-004-08 - Semántica accesible y contraste

**Severidad:** Media
**Estado:** Abierto.

El historial no se expone como log vivo único, los errores de campos de una
propuesta no quedan asociados completamente y un texto auxiliar incumple el
contraste AA calculado en los temas revisados. Se requiere validar la solución
con navegador, zoom y tecnología de asistencia.

### PB-004-09 - Arranque offline de la PWA

**Severidad:** Baja
**Estado:** Limitación conocida.

La app conserva datos en IndexedDB, pero no registra un service worker propio.
Por ello una carga fría sin red no tiene garantía de abrir los assets de la
aplicación. Esta limitación coincide con la arquitectura vigente y no se corrige
como parte de PB-004.

## Controles verificados

- Las escrituras financieras requieren propuesta y confirmación explícita.
- No se encontró una escritura financiera autónoma desde la conversación.
- Memoria, objetivos y coaching en RAM están aislados por sesión y expiran.
- El modo Personal/Profesional sí se filtra; la brecha confirmada está entre
  temporadas del modo Profesional.
- El guard de secretos bloquea claves de proveedor dentro del cliente.
- El repositorio de conversación Dexie funciona de forma aislada, aunque no
  está integrado en la página visible.

## Pruebas ejecutadas

Se ejecutaron 13 suites focales: 141 pruebas aprobadas. Cubren controlador,
memoria de sesión, propuestas, servicio de aplicación, repositorio Dexie,
proveedor, frontera 8A, transacciones y guard de secretos.

Quedaron sin evidencia automatizada suficiente:

- persistencia desde la página real;
- consultas con dos temporadas profesionales;
- consentimiento externo end-to-end;
- aborto efectivo de requests;
- crecimiento prolongado del DOM;
- componentes con axe o lector de pantalla;
- arranque frío PWA offline.

## Siguientes cortes TDD

1. Añadir semántica de log y auto-scroll con una prueba de componente.
2. Rechazar 4001 caracteres en el controlador sin invocar el pipeline y alinear
   el `maxLength` del composer.
3. Probar con valores centinela que auditoría, exportación y consola no retienen
   texto, notas ni importes.
4. Reproducir una consulta con dos temporadas profesionales antes de aplicar el
   filtro canónico por temporada activa.
5. Conectar consentimiento y minimización al flujo visible antes de cualquier
   activación de proveedor externo.

## Relación con la entrega

PB-001 a PB-003 están documentados en
[PB_ONBOARDING_SEASON_PLANNING.md](PB_ONBOARDING_SEASON_PLANNING.md). PB-004 fue
una auditoría de solo lectura: no modificó código, datos ni reglas financieras.
