# Refinamiento UX 2026

**Estado:** implementación completada; validación E2E licenciada y física pendiente  
**Fecha:** 2026-08-27  
**Alcance:** UX-01 a UX-10, sin cambios de modelo financiero ni de esquema

## Convención de medición

Las métricas cuentan activaciones de navegación, acciones principales y
confirmaciones. No cuentan cada campo rellenado dentro de un formulario porque
su número depende del modo, del método de cálculo y de los datos ya conocidos.
Cuando una capacidad no existe por decisión de producto, se indica como no
aplicable en lugar de inventar una ruta.

## UX-01 AUDIT

### F01 - Registrar ingreso

**Estado actual:** Inicio ofrece `Registrar ingreso` y abre el formulario
canónico `/income/nuevo`. El guardado usa el servicio existente y, en modo
Profesional, exige una temporada activa.  
**Número de interacciones:** 2 comandos, más completar los campos requeridos:
`Registrar ingreso` y `Guardar`.  
**Problema:** ninguno en el acceso principal; la configuración profesional
relacionada requiere salir hacia Más > Configuración > Datos generales.  
**Componente/ruta implicada:** `HomePage`, `IncomePage`, `/income/nuevo`.  
**Cambio recomendado:** conservar el formulario y acercar un acceso a su
configuración profesional sin duplicar preferencias.  
**Riesgo:** alto si se altera cálculo, temporada o conversión; no se modificarán.

### F02 - Registrar gasto

**Estado actual:** Inicio ofrece `Registrar gasto` y abre el formulario
canónico `/expenses/nuevo`.  
**Número de interacciones:** 2 comandos, más completar los campos requeridos:
`Registrar gasto` y `Guardar`.  
**Problema:** ninguno en el acceso principal.  
**Componente/ruta implicada:** `HomePage`, `ExpensesPage`, `/expenses/nuevo`.  
**Cambio recomendado:** conservar.  
**Riesgo:** alto si se altera la clasificación gasto/ajuste; no se modificará.

### F03 - Encontrar movimientos de un período

**Estado actual:** desde Inicio se entra en Movimientos y, en la pestaña Todos,
se elige entre todo el historial o mes actual. Ingresos y Egresos mantienen
filtros de fecha propios.  
**Número de interacciones:** 3 desde Inicio para mes actual: `Movimientos`,
abrir `Período` y elegir `Mes actual`.  
**Problema:** no existen Hoy, Semana, Personalizado ni desplazamiento al período
anterior/siguiente; los seis selectores ocupan espacio permanente en móvil.  
**Componente/ruta implicada:** `MovementsPage`, `movementFilters`, `/movements`.  
**Cambio recomendado:** hoja inferior accesible, períodos completos y navegación
temporal sobre la misma consulta local.  
**Riesgo:** medio; debe conservar deep links, aislamiento por modo y fechas locales.

### F04 - Filtrar movimientos

**Estado actual:** búsqueda y seis selectores visibles permiten período, tipo,
categoría, moneda, estado de reporte y orden. Los filtros viven en la URL y la
lista se limita al modo de uso activo antes de filtrar.  
**Número de interacciones:** 2 por selector en móvil (abrir y elegir), sin contar
la escritura de búsqueda.  
**Problema:** saturación visual, ausencia de `Aplicar`, contador activo y
restablecimiento visible cuando sí hay resultados. La URL no restaura filtros
al volver mediante la barra principal.  
**Componente/ruta implicada:** `MovementsPage`, `movementFilters`.  
**Cambio recomendado:** editar un borrador en modal, aplicar en bloque, mostrar
contador y conservarlo solo en `sessionStorage`.  
**Riesgo:** medio; una restauración opaca podría ocultar datos, por lo que el
contador y `Restablecer` deben permanecer visibles.

### F05 - Crear cita

**Estado actual:** Agenda ofrece `Nueva cita`, precarga el día seleccionado y
guarda con el formulario canónico. Valida pasado, solapamientos, temporada y
recordatorios.  
**Número de interacciones:** 2 comandos, más completar campos: `Nueva cita` y
`Guardar`.  
**Problema:** ninguno crítico.  
**Componente/ruta implicada:** `AgendaPage`, `AppointmentFormPage`,
`/agenda/nueva`.  
**Cambio recomendado:** conservar.  
**Riesgo:** alto por agenda/temporadas; ya está cubierto en servicio.

### F06 - Cita, servicio e ingreso

**Estado actual:** al llegar la hora, `Iniciar servicio` persiste una única hora
de inicio. `Servicio realizado` reclama atómicamente la finalización y crea como
máximo un ingreso reutilizando fecha, duración real, tarifa, moneda y temporada.
La cita futura no puede iniciarse ni desde UI ni desde el servicio.  
**Número de interacciones:** 2 desde la cita disponible: `Iniciar servicio` y
`Servicio realizado`; el ingreso no requiere reintroducción.  
**Problema:** existe un riesgo residual ya documentado si falla la creación del
ingreso después de reclamar la cita como completada.  
**Componente/ruta implicada:** `AgendaPage`, `appointmentService`,
`appointmentCompletionService`.  
**Cambio recomendado:** no reescribir; verificar suites y flujo real.  
**Riesgo:** crítico; cualquier cambio exige mantener idempotencia y reglas de hora.

### F07 - Cambiar configuración relacionada con Agenda

**Estado actual:** no hay preferencias globales de Agenda. Los recordatorios son
parte de cada cita y se editan en el mismo formulario. El cronómetro fue retirado
deliberadamente de Agenda.  
**Número de interacciones:** 2 comandos para una cita existente: `Editar` y
`Guardar`, más el cambio del recordatorio.  
**Problema:** ninguno que justifique crear configuración global.  
**Componente/ruta implicada:** `AppointmentFormPage`.  
**Cambio recomendado:** no añadir un engranaje vacío ni reintroducir cronómetro.  
**Riesgo:** crear preferencias sin fuente real duplicaría estado.

### F08 - Cambiar configuración Profesional

**Estado actual:** Inicio/Agenda > Más > Configuración > Datos generales expone
método de ingreso y tarifa solo en Profesional. Usa `settingsService`, la misma
fuente que onboarding y formularios. El modo de uso solo se elige durante el
primer inicio.  
**Número de interacciones:** 3 para abrir desde Inicio y 1 para guardar, más el
cambio del control.  
**Problema:** la preferencia está alejada del flujo de ingresos.  
**Componente/ruta implicada:** `SettingsBusinessPage`, `settingsService`,
`/settings/business`.  
**Cambio recomendado:** enlace contextual desde el contexto Profesional a la
misma ruta; no crear otro estado.  
**Riesgo:** bajo si solo se enlaza; alto si se permite reinterpretar históricos.

## Navegación y pantallas

| Pantalla | Ruta principal | CTA principal | Tiempo/filtros | Modo |
| --- | --- | --- | --- | --- |
| Inicio | `/` | Registrar ingreso/gasto; cita en Profesional | Mes actual fijo | Ambos, contenido progresivo |
| Movimientos | `/movements` | Pestañas Todos/Ingresos/Egresos | URL; parcial | Ambos, aislado antes de filtrar |
| Ingresos | `/income` | Nuevo ingreso | Rango y filtros colapsables | Ambos, campos progresivos |
| Gastos | `/expenses` | Nuevo egreso | Rango y filtros colapsables | Ambos, aislado |
| Agenda | `/agenda` | Nueva cita | Calendario por día/mes | Solo Profesional |
| Reportes | `/reports` | Confirmar y generar | Semana/mes/año y rango | Ambos; temporada se conserva |
| Más | `/more` | Accesos secundarios | No aplica | Oculta Temporadas/Análisis en Básico |
| Configuración | `/settings` | Entrar en sección | No aplica | Opciones profesionales dentro de Datos generales |

## Resultado UX-02 a UX-10

| ID | Estado | Evidencia / decisión |
| --- | --- | --- |
| UX-02 | Implementado | Movimientos usa una hoja accesible con borrador, Aplicar, Restablecer, contador, URL y restauración limitada a `sessionStorage` |
| UX-03 | Implementado / validado | Inicio Profesional enlaza a la misma configuración de negocio; no se añadieron engranajes sin preferencias reales en Agenda o Movimientos |
| UX-04 | Implementado | Movimientos y Reportes comparten anterior/etiqueta/siguiente; Agenda conserva su calendario y temporadas conserva su semántica |
| UX-05 | Implementado / validado | Movimientos incorpora `+` hacia los formularios canónicos; se preserva el ciclo idempotente Agenda > Servicio > Ingreso |
| UX-06 | Ya implementado / validado | Inicio conserva balance, movimientos, pendientes y próxima cita por modo, sin sistema de widgets |
| UX-07 | Implementado / validado | Movimientos distingue ausencia de datos y filtros sin resultados; la agenda próxima vacía ofrece `Crear cita` |
| UX-08 | Ya implementado / validado | Onboarding configura el modo y trabajo profesional; Básico mantiene ocultas las opciones profesionales |
| UX-09 | Parcial | Hoja validada en 320x568, 390x844, 844x390 y 1280x800, claro/oscuro; la navegación PWA completa quedó bloqueada por `LicenseGuard` y no hubo dispositivo físico |
| UX-10 | Parcial | Todos los gates automatizados pasan; faltan los recorridos manuales completos bajo una licencia válida y la instalación física del APK |

## Límites confirmados

- No se añade un modelo de cuenta o medio de pago: Movimientos conserva Moneda,
  el concepto transversal disponible en ambos tipos de registro.
- No se ofrece un filtro Básico/Profesional que permita cruzar datos. La lista
  se limita primero al modo activo, como exige el aislamiento vigente.
- No se añade configuración global de Agenda porque no existe una preferencia
  aprobada que pueda reutilizarse.
- No se modifican fórmulas, temporadas, esquema Dexie, backups, licencias,
  automatización ni integraciones externas.

## Resultado final

### Veredicto

`PARCIAL`: el paquete de código está implementado y los gates automatizados son
verdes. No se eleva a `IMPLEMENTADO` porque Vite sin backend no pudo completar
la comprobación de licencia y no se instaló el APK en un dispositivo físico.

### Métricas

| Flujo | Antes | Después | Resultado |
| --- | ---: | ---: | --- |
| M01 Registrar ingreso desde Inicio | 2 | 2 | Se conserva el acceso directo y el formulario canónico |
| M02 Registrar gasto desde Inicio | 2 | 2 | Se conserva el acceso directo y el formulario canónico |
| M03 Elegir un mes en Movimientos | 2 | 3 | `Aplicar` añade una confirmación explícita, pero seis controles permanentes pasan a una sola acción y los cambios combinados se aplican en bloque |
| M04 Crear cita | 2 | 2 | Se conserva `Nueva cita` y su formulario canónico |
| M05 Cita disponible > servicio > ingreso | 2 | 2 | Inicio y finalización siguen reutilizando fecha, duración y tarifa |
| M06 Configuración de Agenda | N/A | N/A | No existe una preferencia global aprobada; no se inventó configuración |
| Configuración Profesional desde Inicio | 3 | 1 | El engranaje abre la misma fuente de verdad y vuelve directamente a Inicio |

Las cifras cuentan comandos y confirmaciones, no los campos variables de cada
formulario.

### Evidencia automatizada

- `npm run lint`: aprobado.
- `npm run typecheck`: aprobado.
- `npm run test`: 204 archivos, 2284 pruebas aprobadas y 1 `todo` preexistente.
- `npm run build`: aprobado; permanece el aviso conocido del chunk principal de
  1,13 MB.
- `npm run test:indexeddb`: aprobado en HeadlessChrome 152, incluidas
  migraciones, reapertura, exportación/restauración y generación PDF real.
- `git diff --check`: aprobado.

### Evidencia móvil y Android

- Playwright sobre el componente real y el CSS de Vite: panel y acciones dentro
  del viewport, sin overflow horizontal, foco inicial, trap de Tab/Shift+Tab,
  Escape y retorno de foco.
- Viewports comprobados: 320x568, 390x844, 844x390 y 1280x800. Se revisaron
  orientación horizontal, texto largo y temas claro/oscuro.
- No se probaron teclado virtual real, navegación atrás de la PWA completa,
  valores monetarios grandes ni instalación física, porque el flujo real quedó
  en `LicenseGuard` al no disponer Vite de los endpoints de licencia.
- APK técnico generado: `private-balance-1.0.4-5-debug.apk`, 10.526.416 bytes,
  SHA-256 `e81fc16a791dd1490bda967cd5a96322ae98868b1fb9429977bfd4141c6156ef`,
  firma debug APK Signature Scheme v2 válida con un firmante.

### Regresiones y riesgos pendientes

- Regresiones detectadas en gates automatizados: 0.
- No se declara `0` absoluto E2E hasta ejecutar los recorridos licenciados en
  PWA y una instalación física del APK.
- Permanece el riesgo previo del ciclo de Agenda si la creación del ingreso
  falla después de reclamar atómicamente una cita como completada.
- El bundle principal continúa por encima del umbral de aviso de Vite.

### UX-FUTURE-001

**Descripción:** disponer de un entorno de previsualización local con endpoints
de licencia de desarrollo y datos sintéticos.  
**Problema que resuelve:** permite ejecutar la matriz PWA completa sin desactivar
ni sortear `LicenseGuard`.  
**Impacto:** alto para QA, nulo para el dominio financiero.  
**Esfuerzo:** medio.  
**Dependencias:** backend de desarrollo y política explícita de licencias.  
**Motivo para no incluir ahora:** afecta infraestructura y seguridad, fuera del
alcance UX-01 a UX-10.

### Recomendación

El código está preparado para `VALIDACIÓN CON USUARIOS` en un entorno licenciado
y controlado. Antes de una certificación de release se debe ejecutar la matriz
manual PWA y física con el APK identificado arriba.