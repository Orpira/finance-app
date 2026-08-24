# Validación UI de Quick Actions del Copiloto

## Estado

**VALIDACIÓN UI APROBADA**

La certificación se ejecutó el 2026-08-22 sobre la PWA/web real de desarrollo y
quedó cerrada en el commit
`b300f89fb9664a746dad3cc1ae2530b7b2d520be` (`fix(copilot): corrige quick
actions y routing conversacional`).

## Alcance y entorno

- Rama: `main`.
- HEAD previo: `7b3510cd07704aa218429df4ede748e99ff0c74c`.
- HEAD certificado: `b300f89fb9664a746dad3cc1ae2530b7b2d520be`.
- URL: `http://127.0.0.1:4173/conversation`.
- Navegador: Google Chrome `151.0.7922.173`, motor real en modo headless.
- Viewport: `1440x1200`.
- Datos: perfil Chrome temporal y aislado, eliminado al finalizar.
- Licencia: registro sintético activo limitado al perfil temporal; no se leyó
  ni modificó ninguna licencia real ni material de firma.

La validación no modificó código. El automatizador y sus logs se mantuvieron
fuera del repositorio y se eliminaron al terminar.

## Matriz funcional

| Caso | Resultado observado | Estado |
| --- | --- | --- |
| `Registrar un ingreso` | Propuesta `register_income`, importe obligatorio vacío y confirmación deshabilitada | PASS |
| `Registrar un gasto` | Propuesta `register_expense`, importe y categoría obligatorios vacíos y confirmación deshabilitada | PASS |
| `Crear una cita` | Propuesta `create_appointment`, fecha por defecto, hora e importe esperado pendientes | PASS |
| `Ver resumen semanal` | Ingresos, gastos y balance de la semana actual, de lunes a hoy | PASS |
| `Ingresos sin reportar` | Conteo local coherente con los registros Profesionales `type: otro` creados en la prueba | PASS |
| `Comparar este mes con el anterior` | Ingresos, gastos y balance de ambos meses, incluidas sus variaciones | PASS |
| `¿Cómo registro un ingreso?` | Respuesta de consulta, sin propuesta ni escritura | PASS |
| `¿Cómo puedo añadir un gasto?` | Respuesta de consulta, sin propuesta ni escritura | PASS |
| `Hoy recibí 120 euros` | Propuesta `register_income` con el importe interpretado | PASS |
| `Gasté 35 euros en transporte` | Propuesta `register_expense` | PASS |
| Confirmación con faltantes | `Confirmar` permaneció deshabilitado | PASS |
| Cancelación | Estado cancelado y cero persistencia | PASS |
| Singular `1 transacción` | La ruta UI activa presenta totales y no expone el copy del mock renderer; la regresión automatizada específica pasó | NO EXPUESTO EN UI |

También pasaron individualmente estas variantes, sin caer en
`financial_transactions`:

- Ingreso: `Registrar`, `Agregar`, `Añadir`, `Anotar`, `Crear` y `Nuevo`.
- Gasto: `Registrar`, `Agregar`, `Añadir`, `Anotar`, `Crear` y `Nuevo`.

## Datos controlados y persistencia

Para contrastar la UI con valores conocidos se crearon mediante el flujo real:

- ingreso de 1 EUR el 2026-08-22;
- ingreso de 3 EUR el 2026-07-15;
- gasto de 2 EUR, categoría `Transporte UI`, el 2026-08-22;
- gasto de 4 EUR, categoría `Material UI`, el 2026-07-15.

Los registros aparecieron en las listas reales de Ingresos y Egresos. La
respuesta semanal fue 1 EUR de ingresos, 2 EUR de gastos y -1 EUR de balance.
La comparación mensual mostró agosto `1/2/-1 EUR` frente a julio `3/4/-1 EUR`,
con variaciones `-2/-2/0 EUR`.

El perfil temporal completo se eliminó después de la prueba; no quedan datos de
validación en el entorno del usuario.

## Confirmación y seguridad

La escritura observada mantuvo el contrato:

```text
Proposal
→ Confirmation
→ Execution Guard
→ Domain Service
→ IndexedDB
```

- Ninguna propuesta incompleta pudo ejecutarse.
- Cancelar no persistió datos.
- No hubo escrituras automáticas ni fallback de escritura.
- No aparecieron excepciones de React, parsing, Dexie o IndexedDB.

## Consola y red

Las tres consultas deterministas (`weekly-summary`, `pending-income-count` y
`monthly-comparison`) no realizaron llamadas externas. No hubo tráfico hacia
OpenAI, Ollama, Qwen ni otro servicio de IA.

Hallazgos clasificados:

- dos respuestas `404` de `/api/trial-start`, limitadas al bootstrap del perfil
  vacío bajo Vite y anteriores a la validación funcional; no bloqueantes;
- llamadas a Frankfurter únicamente durante las escrituras controladas para la
  conversión EUR/COP; ninguna durante las consultas deterministas;
- cero excepciones JavaScript y cero errores nuevos de persistencia.

## Regresión final

| Verificación | Resultado |
| --- | --- |
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `npm run build` | PASS; conserva el aviso informativo de chunks mayores de 500 kB |
| `npm test` | 198 suites, 2226 PASS, 0 FAIL, 1 TODO preexistente |
| `git diff --check` | PASS |

## Riesgos residuales

La paridad completa del registro Profesional mediante Copiloto continúa fuera
de alcance. El alta conserva los valores conservadores observados:

```text
type: otro
duration: 0
percentage: 0
```

Como consecuencia, estos ingresos no entran en el flujo de ingresos
Profesionales reportables. Esta limitación debe resolverse en una evolución
posterior explícita, no como parte de la corrección de Quick Actions.
