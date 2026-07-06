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

## Fuera de alcance confirmado

- Multiusuario en tiempo real con backend transaccional para toda la operativa financiera.
- Dependencia obligatoria de red para registrar ingresos o egresos.
- Uso de Supabase como base principal.

## Pendiente de validar

- Estrategia futura de IA aplicada a resúmenes, auditoría y asistencia operativa.
- Estandarización final de todos los workflows legacy de n8n sobre communication_channels y license_devices.

