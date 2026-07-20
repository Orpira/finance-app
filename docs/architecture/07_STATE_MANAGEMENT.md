# 07 - State Management

## 1) Estrategia general de estado

El proyecto usa un modelo híbrido:

- estado local por pantalla con hooks React (`useState`, `useEffect`, `useMemo`);
- estado persistente en Dexie para datos de negocio;
- estado de configuración global desacoplado vía eventos (`finance-app:settings-changed`);
- estado transitorio de ejecución en servicios (deduplicación/in-flight).

## 2) Estado de acceso y navegación

- `LicenseGuard` controla estado de licencia (`loading`, `active`, `expired`, `clock-tampered`, `error`).
- `PinGate` controla bloqueo por inactividad/segundo plano (`loading`, `locked`, `unlocked`).
- `UsageModeGuard` filtra rutas según modo de uso.

## 3) Estado del shell de aplicación

`AppLayout` coordina:

- tema visual (`light/dark/system`);
- modo de uso (`basic/professional`);
- inicialización de backups, reminders, outbox, identidad y checks de integridad.

## 4) Estado financiero operativo

- fuente primaria: tablas Dexie (`services`, `expenses`, `appointments`, etc.);
- proyecciones de UI calculadas con `useMemo` + servicios;
- cambios persistidos mediante servicios de aplicación.

## 5) Estado de AI Foundation

### Home

- summary oficial con fallback legacy;
- promociones snapshot/knowledge condicionadas por flags;
- request de promoción asociado a instant/ciclo para evitar reemplazos obsoletos.

### Dashboard Insights

Estado discriminado explícito:

- `idle`
- `loading`
- `success`
- `empty`
- `rejected`
- `error`

Controlador evita:

- doble ejecución simultánea;
- actualización de estado tras unmount;
- aceptación de respuestas obsoletas.

## 6) Estado asíncrono y resiliencia

- Outbox mantiene eventos pendientes y política de reintento.
- Shadow pipelines capturan errores sin afectar resultado oficial.
- Gateway remoto usa JWT temporal en memoria (no persistente).

## 7) Principios de diseño de estado

- fail-closed en validación y transiciones inválidas;
- degradación segura (fallback) ante error;
- separación entre estado de negocio y estado de presentación;
- evitar stores globales no necesarios.

## 8) Riesgos y mitigaciones

Riesgo: divergencia de estados por listeners/eventos.
Mitigación: fuente canónica en `settingsService` y refresco por evento único.

Riesgo: fugas de actualización asíncrona.
Mitigación: flags de montaje y control de secuencia en controllers.

Riesgo: complejidad en flags de promoción/shadow.
Mitigación: validación estricta de valores y fallback por defecto.
