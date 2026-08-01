# 00 Project Vision

Complementa la [PRIVATE_BALANCE_CONSTITUTION.md](PRIVATE_BALANCE_CONSTITUTION.md) con una visión ejecutiva del producto.

## Resumen

Private Balance es una PWA con empaquetado Android orientada a profesionales independientes o pequeños negocios que necesitan registrar ingresos, egresos, agenda, reportes y automatizaciones sin depender de un backend transaccional para la operativa diaria.

La aplicación prioriza:

- persistencia local en el dispositivo;
- funcionamiento offline para el núcleo financiero;
- licencias vinculadas al dispositivo;
- automatización desacoplada mediante outbox + Vercel + n8n;
- integración de WhatsApp a través de Evolution API sin exponer secretos en cliente.

## Problemas que resuelve

- Registro de ingresos por servicio con cálculo de ganancia real.
- Registro de egresos operativos y ajustes.
- Gestión de agenda y conversión de citas en ingresos.
- Reportes exportables y estados de reporte.
- Gestión local de identidad de dispositivo, licencia y canal de comunicación.
- Automatización de eventos de negocio hacia n8n.

## Alcance actual confirmado

### Frontend/PWA

- React 19 + TypeScript + Vite.
- Navegación móvil/escritorio con React Router.
- Persistencia local con Dexie/IndexedDB.
- APK Android mediante Capacitor 8.

### Backend ligero / integración

- Vercel Functions en la carpeta api.
- Neon PostgreSQL para licencias, dispositivos y canales.
- n8n como motor de automatización.
- Evolution API para WhatsApp.

## Módulos principales

- Ingresos.
- Egresos.
- Agenda.
- Reportes.
- Temporadas.
- Licencias.
- Dispositivos.
- Canales de comunicación.
- WhatsApp.
- Automatizaciones.

## Principios del proyecto

- No romper balances históricos.
- Mantener reproducibilidad de cálculos.
- Separar modo Básico y modo Profesional.
- Evitar secretos en frontend o APK.
- Resolver automatizaciones críticas del lado servidor.
- Mantener trazabilidad de eventos y documentación de decisiones.
- **Inteligencia, simplificación o automatización antes que interfaz nueva**: antes de añadir una pantalla, un paso de formulario o una opción de configuración, evaluar si el Asistente, una simplificación o una automatización ya resuelven la necesidad. Ver [ADR-030](adr/ADR-030-Intelligent-Assistant-Platform.md).

## Fuera de alcance confirmado

- Multiusuario en tiempo real con backend transaccional para toda la operativa financiera.
- Dependencia obligatoria de red para registrar ingresos o egresos.
- Uso de Supabase como base principal.

## Pendiente de validar

- Estrategia futura de IA aplicada a resúmenes, auditoría y asistencia operativa.
- Estandarización final de todos los workflows legacy de n8n sobre communication_channels y license_devices.

## Evolución 2026 — plataforma privada e inteligente (ADR-029)

A partir de 2026-08-01, Private Balance evoluciona hacia: *"Una plataforma privada e inteligente para gestionar finanzas personales, agenda y decisiones económicas, manteniendo al usuario en control de sus datos y de todas las acciones realizadas."* Mensaje central: **"Tus finanzas. Tu agenda. Tus datos. Bajo tu control."**

Esto reordena las prioridades del resumen anterior sin invalidarlo:

- El **núcleo** (finanzas, agenda, reportes, seguridad, asistente) debe funcionar íntegramente sin WhatsApp, Evolution API ni n8n configurados — ver [docs/architecture/16_CORE_AND_INTEGRATIONS.md](architecture/16_CORE_AND_INTEGRATIONS.md).
- WhatsApp, Evolution y n8n **se conservan** en el repositorio, con sus tests, pero pasan a ser integraciones opcionales, aisladas y desactivadas por defecto — nunca se borran ni se consideran fuera de alcance del proyecto, solo fuera de la experiencia principal.
- El **asistente inteligente** deja de ser una funcionalidad secundaria ("Más → Inteligencia") para convertirse en un pilar de producto con acceso principal en la navegación, sin depender de WhatsApp.
- Los cálculos financieros siguen siendo deterministas; la IA explica y propone, nunca calcula saldos oficiales ni actúa sin confirmación explícita del usuario.

Ver [ADR-029](adr/ADR-029-Private-Balance-Core-Redesign.md) para el detalle de la decisión y su alcance.
