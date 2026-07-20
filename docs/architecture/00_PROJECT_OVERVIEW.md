# 00 - Project Overview

## 1) Propósito

Private Balance es una plataforma financiera local-first orientada a profesionales independientes y pequeños negocios. Su valor central es mantener el control de datos financieros en dispositivo, usando servicios externos solo para automatización, licencias y mensajería.

## 2) Qué resuelve el producto

- Registro de ingresos, egresos y ajustes con trazabilidad.
- Agenda de citas con transición a eventos financieros.
- Reportes por rango y contexto operativo.
- Operación dual por modo de uso (Básico/Profesional).
- Licenciamiento ligado a dispositivo.
- Automatización de eventos sin exponer secretos de backend.
- Integración de capa de insights de forma desacoplada.

## 3) Alcance funcional actual (implementado)

### Núcleo financiero

- Persistencia local en Dexie/IndexedDB (`services`, `expenses`, `appointments`, etc.).
- Conversión de moneda y cálculo financiero determinista.
- Flujos de backup/import/export para tablas operativas.

### Seguridad de acceso

- `LicenseGuard` para validez de licencia por dispositivo.
- `PinGate` para bloqueo por inactividad y segundo plano.
- `UsageModeGuard` para acceso por modo de operación.

### Automatización

- Outbox local transaccional desacoplado de red.
- Gateway serverless en `api/automation-token` y `api/automation`.
- n8n como motor de workflows y Evolution API para WhatsApp.

### AI Foundation (parcial)

- Adapter financiero determinista de solo lectura.
- Shadow modes controlados por feature flags.
- Snapshot/Knowledge append-only local.
- Dashboard Insights profesional (7F) sobre fronteras certificadas.

## 4) Fuera de alcance actual

- IA generativa con autoridad de escritura sobre finanzas.
- Event sourcing financiero completo de toda la app.
- Sustitución global de legacy por AI Core.
- Dependencia online para operar el libro financiero local.

## 5) Superficies de ejecución

- Web/PWA en Vite + React.
- APK Android con Capacitor.
- Backend serverless con Vercel Functions.
- Backend de soporte en Neon.
- Orquestación externa en n8n.

## 6) Modo de operación

### Modo Básico

- Flujo simplificado.
- Sin dependencia funcional de temporadas.
- Mantiene trazabilidad de ingresos/egresos/reportes.

### Modo Profesional

- Soporte de temporadas/períodos.
- Rutas y pantallas de agenda/temporadas/reportes avanzados.
- Restricciones de mutabilidad por contexto de temporada.

## 7) Principios rectores

- Local-first por diseño.
- Fail-closed ante inconsistencias.
- Append-only para artefactos derivados (snapshots/knowledge).
- Separación estricta de fronteras entre UI, servicios, repositorios y automatización.
- Seguridad de secretos exclusivamente en servidor.

## 8) Artefactos canónicos de referencia

- Constitución técnica: `docs/PRIVATE_BALANCE_CONSTITUTION.md`
- ADRs: `docs/DECISIONS.md`
- Historial: `docs/CHANGELOG.md`
- Automatización: `docs/AUTOMATION_HUB.md`
- Base de datos: `docs/03_DATABASE.md`

## 9) Criterio de continuidad técnica

Ninguna evolución futura debe:

- romper reproducibilidad financiera histórica;
- mover secretos al cliente;
- convertir componentes objetivo en implementados sin evidencia;
- degradar la resolución contextual de canales de comunicación.
