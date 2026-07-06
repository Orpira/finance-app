# Private Balance Constitution

## 1. Propósito del proyecto

Private Balance es una plataforma privada de finanzas personales y administración de servicios para profesionales independientes y pequeños negocios. Su misión es registrar ingresos, egresos, agenda, temporadas, licencias, dispositivos y automatizaciones sin perder control local sobre los datos financieros.

Esta Constitución Técnica es la fuente principal de verdad para Codex, ChatGPT, MCP y cualquier futuro colaborador. Si un archivo, workflow o decisión contradice este documento, esta Constitución prevalece hasta que exista una ADR nueva.

## 2. Visión de producto

Private Balance debe funcionar como una app local-first, confiable y reproducible, con experiencia consistente en navegador, PWA y APK Android. El núcleo financiero permanece en el dispositivo; la red y los servicios externos se usan solo para automatización, licencias, WhatsApp y sincronización de contexto.

La plataforma debe permitir:

- registrar ingresos y egresos con trazabilidad;
- operar en modo Básico y modo Profesional sin mezclar reglas;
- gestionar temporadas, agenda y reportes;
- mantener licencias vinculadas a dispositivos;
- resolver canales de comunicación de forma contextual;
- automatizar eventos con n8n sin exponer secretos en cliente.

## 3. Stack tecnológico oficial

Stack confirmado por package.json, código fuente y documentación vigente:

- React 19.
- TypeScript 6.
- Vite 8.
- Tailwind CSS 4.
- Capacitor 8.
- React Router 7.
- Dexie 4 + IndexedDB.
- Zustand.
- Zod.
- Neon Serverless Postgres.
- n8n.
- Evolution API.
- Vercel Functions.
- jsPDF y jspdf-autotable.
- Vitest.
- ESLint.

## 4. Arquitectura general

```text
React + Capacitor + IndexedDB/Dexie
        |
        | outbox de automatización
        v
Vercel Functions (/api/*)
        |
        | JWT temporal, validación de licencia, proxy de eventos
        v
n8n
        |
        +--> Neon PostgreSQL
        +--> Evolution API
        +--> WhatsApp
```

### Capas

- Cliente: UI, persistencia local, reglas de negocio locales y exportación.
- Servidor ligero: validación de licencia, despacho de automatización y resolución segura de canales.
- Automatización: orquestación de workflows, persistencia remota y puente hacia Evolution API.
- Base remota: Neon PostgreSQL para licencias, dispositivos y canales.

## 5. Principios técnicos

- Local-first por defecto.
- No romper balances históricos.
- Reproducibilidad de cálculos.
- Separación estricta de responsabilidades.
- Seguridad por diseño: secretos fuera del frontend.
- Automatización idempotente y trazable.
- n8n como motor, no como lógica de negocio primaria.
- MCP como herramienta de auditoría y desarrollo, no runtime de producción.
- Neon como base principal, no Supabase.

## 6. Reglas inmutables

Estas reglas no deben violarse sin una ADR explícita aprobada:

- Nunca modificar cálculos financieros sin autorización.
- Nunca alterar balances históricos.
- Nunca usar Supabase como referencia principal salvo decisión futura explícita.
- Nunca enviar WhatsApp usando un canal global.
- Nunca usar ORDER BY updated_at DESC LIMIT 1 sin filtro por user_code o device_code.
- Nunca hardcodear API keys en workflows o frontend.
- Nunca crear instancias Evolution desde el flujo de licencia.
- Nunca permitir que MCP modifique producción sin autorización explícita.
- Nunca dejar un webhook n8n sin Respond to Webhook.
- Nunca permitir que la IA modifique datos financieros automáticamente.

## 7. Reglas de negocio financiero

### 7.1 Regla general

Los cálculos financieros son sagrados. Ingresos, egresos, ajustes, reportes y balances deben permanecer reproducibles y auditables.

### 7.2 Ingresos

- Un ingreso representa un servicio o una entrada financiera reconocida por la app.
- Puede incluir duración, porcentaje, moneda, país, ciudad y tipo de pago.
- Su cálculo no se cambia sin autorización explícita.

### 7.3 Egresos

- Un egreso representa un gasto operativo o un ajuste.
- Debe mostrarse con su naturaleza real: gasto o ajuste.
- Su categoría y relación con ingresos, si existe, deben conservarse.

### 7.4 Ajustes

- Los ajustes positivos suman al balance.
- Los ajustes negativos restan al balance.
- Deben mostrarse de forma clara y no confundirse con ingresos o gastos normales.

### 7.5 Reportes

- Todo reporte debe ser consistente entre pantallas, exportaciones y cálculos.
- El estado de reporte debe preservarse.
- Las exportaciones no pueden alterar el dato fuente.

### 7.6 Temporizadores

- El tiempo registrado en servicios y citas debe ser trazable.
- Los temporizadores no deben reescribir información histórica sin justificación.

## 8. Reglas de modo Básico

- El modo Básico no usa temporadas.
- No debe depender de periodos cerrados.
- Debe seguir funcionando sin lógica profesional.
- No debe mezclar reglas del modo Profesional.

## 9. Reglas de modo Profesional

- El modo Profesional usa temporadas o periodos.
- Los cierres y reaperturas afectan la mutabilidad de registros según reglas de negocio.
- Los reportes deben validar el contexto de temporada activa.
- La navegación y persistencia deben mantenerse estables al cambiar de modo.

## 10. Reglas de temporadas

- Una temporada representa un contexto operativo acotado.
- Los registros pueden quedar vinculados a una temporada.
- No se deben modificar temporadas sin validar el impacto sobre modo Profesional.
- El modo Básico no debe crear dependencia funcional sobre temporadas.

## 11. Reglas de ingresos

- Cada ingreso debe mantener sus datos funcionales principales.
- La conversión de moneda debe ser reproducible.
- La ganancia real no se altera arbitrariamente.
- Los campos derivados deben conservar coherencia con el ingreso original.

## 12. Reglas de egresos

- Cada egreso debe conservar fecha, categoría, tipo, moneda y monto.
- Los egresos relacionados con ingresos deben mantener esa referencia.
- Un egreso no debe convertirse en ingreso por accidente de UI o workflow.

## 13. Reglas de ajustes

- Un ajuste debe seguir siendo ajuste en UI, reportes y exportaciones.
- No debe perder su clasificación.
- Los ajustes no pueden colapsarse con egresos normales en los modelos de negocio.

## 14. Reglas de reportes

- Los reportes deben funcionar en ambos modos.
- Los estados de reporte deben normalizarse y persistirse.
- Los exportables no pueden introducir cálculos nuevos sin validación.

## 15. Reglas de temporizadores

- El temporizador debe registrar inicio, fin y duración real cuando aplique.
- La hora mostrada debe derivarse del dato persistido.
- Los temporizadores no deben afectar balances sin un flujo de negocio explícito.

## 16. Reglas de n8n

Los workflows de n8n son parte del sistema, pero no son la fuente principal de negocio. Deben cumplir estas reglas:

- Todo webhook debe terminar en Respond to Webhook.
- No deben existir ramas sin respuesta.
- No deben existir nodos huérfanos dentro de flujos críticos.
- No deben existir nodos desactivados en producción crítica.
- Todo error debe responder JSON válido.
- No usar consultas globales para canales de comunicación.
- No usar ORDER BY updated_at DESC LIMIT 1 sin filtro contextual.
- No hardcodear API keys en workflows.
- Si hay más de un canal posible, resolver por contexto del evento y no por recencia global.

### Inventario de workflows inspeccionados en solo lectura

#### Private Balance - 01 Device Provisioning

- Propósito: provisionamiento inicial de usuario, dispositivo y canal.
- Evento principal: device.provision.requested.
- Respuesta final: sí, termina en Respond to Webhook.
- Riesgo conocido: usa tablas legacy app_user, device y whatsapp_channel; pendiente de convergencia.

#### Private Balance - 02 WhatsApp Management

- Propósito: gestión de canal WhatsApp, conexión, desconexión, prueba y preferencias.
- Evento principal: device.whatsapp.connect.requested y eventos communication.whatsapp.*.
- Respuesta final: sí, todas las ramas observadas terminan en Respond to Webhook.
- Riesgo conocido: SQL dinámico en algunos nodos; requiere vigilancia.

#### Private Balance - 03 WhatsApp Status

- Propósito: persistir estados emitidos por Evolution.
- Evento principal: callbacks de estado de Evolution API.
- Respuesta final: sí, termina en Respond to Webhook.
- Riesgo conocido: referencia legacy a whatsapp_channel; pendiente de alineación.

#### Private Balance - Nuevo Ingreso

- Propósito: registrar income.created, expense.created y otros eventos de automatización.
- Respuesta final: parcial; income.created y expense.created responden, pero hay ramas sin respuesta final para calendar.created y Create Instance.
- Riesgo crítico: selección global de canal WhatsApp sin filtro por user_code o device_code.
- Riesgo crítico: uso observado de ORDER BY updated_at DESC LIMIT 1 sin contexto seguro.

## 17. Reglas de Neon

- Neon es la base principal del backend de licencias, dispositivos y canales.
- No asumir Supabase salvo decisión futura explícita.
- Las tablas y consultas deben respetar el modelo de resolución deviceCode -> userCode -> communication_channels.
- La resolución de canales debe apoyarse en communication_channels y license_devices.
- No documentar ni depender de tablas legacy como fuente principal del sistema.

## 18. Reglas de Evolution API

- Evolution API gestiona la infraestructura WhatsApp.
- No debe consumirse directamente desde el frontend ni el APK.
- Las credenciales de Evolution no deben exponerse en cliente.
- Las respuestas de Evolution deben normalizarse antes de persistirlas.
- La conexión inicial de WhatsApp se gestiona desde Canales de comunicación, no desde Licencia.

## 19. Reglas de WhatsApp

- Nunca enviar WhatsApp usando un canal global.
- El canal debe resolverse siguiendo:
  Evento -> deviceCode -> license_devices -> user_code -> communication_channels.
- El código de vinculación debe priorizarse sobre QR si Evolution lo soporta.
- QR solo debe usarse como fallback.
- El canal activo debe corresponder al usuario y dispositivo del evento.

## 20. Reglas de PWA/APK

- La app debe funcionar como PWA y APK mediante Capacitor.
- El acceso puede estar protegido por PIN.
- Android puede bloquearse al ir a segundo plano según la lógica local.
- El almacenamiento local es parte del diseño; no debe asumirse conectividad permanente.

## 21. Reglas de seguridad

- No almacenar secretos en frontend, APK o documentación operativa.
- No hardcodear claves API en workflows.
- Las licencias deben validarse firmadas y vinculadas al dispositivo.
- La recuperación segura exige preservar la trazabilidad local y no exponer datos sensibles.
- Las automatizaciones deben preservar idempotencia cuando aplique.

## 22. Reglas de IA

- La IA no debe modificar datos financieros automáticamente.
- La IA puede asistir en análisis, documentación y auditoría.
- La IA no sustituye validaciones financieras ni de seguridad.
- La IA debe tratar a esta Constitución como fuente principal de verdad.
- El roadmap de IA debe mantenerse separado de la lógica de negocio actual.

## 23. Reglas de MCP

- MCP se usa como herramienta de auditoría y desarrollo.
- MCP no es runtime de producción.
- MCP no debe modificar producción sin autorización explícita.
- MCP debe respetar esta Constitución y el resumen operativo MCP_RULES.md.
- Si existe contradicción entre un hallazgo de MCP y la Constitución, prevalece la Constitución.

## 24. Convenciones de código

- TypeScript estricto y módulos ES.
- Mantener estilos existentes antes de refactorizar.
- No introducir dependencias sin justificación.
- No reescribir lógica de negocio por estilo.
- Mantener nombres de dominio claros: income, expense, appointment, license, communication channel.
- Preferir helpers explícitos y trazabilidad de datos.
- Evitar cambios masivos que mezclen UI, persistencia y reglas de negocio.

## 25. Checklist obligatorio antes de cualquier cambio

1. Leer esta Constitución.
2. Leer el archivo afectado.
3. Identificar el impacto funcional real.
4. Determinar si el cambio afecta ingresos, egresos, licencias, temporadas o canales.
5. Comprobar si hay workflows n8n asociados.
6. Verificar si hay rutas de WhatsApp o Evolution implicadas.
7. Confirmar que no se modifica la base de datos sin autorización.
8. Confirmar que no se altera un cálculo histórico.
9. Confirmar que no se usa Supabase como referencia principal.
10. Confirmar que no se exponen secretos.
11. Definir el plan mínimo reversible.
12. Validar el cambio después de aplicarlo.

## 26. ADR / Architecture Decision Records

### ADR-001 — Neon confirmado como base principal

- Estado: aceptada.
- Decisión: Neon PostgreSQL es la base principal del backend de licencias, dispositivos y canales.
- Consecuencia: Supabase no se toma como referencia principal salvo decisión futura explícita.

### ADR-002 — n8n confirmado como motor de automatización

- Estado: aceptada.
- Decisión: n8n orquesta automatizaciones, webhooks y flujos externos.
- Consecuencia: los webhooks críticos deben terminar siempre en Respond to Webhook.

### ADR-003 — Evolution API confirmado como proveedor WhatsApp

- Estado: aceptada.
- Decisión: Evolution API gestiona WhatsApp.
- Consecuencia: la API no se expone al frontend y sus credenciales se mantienen fuera del cliente.

### ADR-004 — MCP confirmado como herramienta de auditoría/desarrollo

- Estado: aceptada.
- Decisión: MCP se usa para auditoría, inspección y asistencia de desarrollo.
- Consecuencia: MCP no modifica producción sin autorización explícita.

### ADR-005 — Resolución contextual obligatoria de canales

- Estado: aceptada.
- Decisión: el canal se resuelve por evento, deviceCode, license_devices, user_code y communication_channels.
- Consecuencia: las búsquedas globales por recencia quedan desaconsejadas.

### ADR-006 — Constitución Técnica como fuente principal de verdad

- Estado: aceptada.
- Decisión: docs/PRIVATE_BALANCE_CONSTITUTION.md se convierte en el documento maestro del proyecto.
- Consecuencia: docs/MCP_RULES.md pasa a resumen operativo y 06_MCP_RULES.md queda obsoleto o eliminado.

## 27. Glosario técnico

- Constitución Técnica: documento maestro que define reglas, principios y decisiones base.
- ADR: decisión arquitectónica registrada.
- Canonical source: fuente principal de verdad.
- DeviceCode: identidad técnica del dispositivo.
- UserCode: identidad lógica del usuario/dispositivo en el backend de automatización.
- Communication channel: registro del canal WhatsApp o equivalente vinculado al contexto correcto.
- Outbox: cola local de eventos pendiente de despacho.
- Webhook: endpoint receptor de eventos externos.
- Respond to Webhook: nodo final de respuesta en n8n.
- Neon: base de datos principal del backend de soporte.
- Evolution API: proveedor de infraestructura WhatsApp.
- MCP: herramienta de auditoría y desarrollo asistido.
- PWA: aplicación web instalable.
- APK: paquete Android compilado con Capacitor.
- Temporada: periodo operativo del modo Profesional.
- Ajuste: corrección de balance visible y explícita.

## 28. Prioridad documental

Orden de interpretación en caso de duda:

1. docs/PRIVATE_BALANCE_CONSTITUTION.md.
2. ADRs de docs/DECISIONS.md.
3. docs/MCP_RULES.md como resumen operativo.
4. Documentación adicional de apoyo.
