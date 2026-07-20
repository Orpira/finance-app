# 11 - Security

## 1) Objetivos de seguridad

- proteger datos financieros locales;
- evitar exposición de secretos operativos;
- garantizar autenticación/autorización de automatización;
- preservar integridad de licencias y vínculo por dispositivo.

## 2) Activos críticos

- datos financieros en Dexie (`services`, `expenses`, `appointments`);
- licencias activas locales;
- identidad de dispositivo (`deviceCode`, `userCode`);
- secretos de servidor (`N8N_INTERNAL_TOKEN`, `AUTOMATION_JWT_SECRET`, `DATABASE_URL`);
- estado de canales de comunicación.

## 3) Superficie de ataque principal

### Cliente (web/PWA/APK)

- manipulación de almacenamiento local;
- retroceso de reloj para evadir expiración;
- intento de extracción de secretos por bundle.

### API serverless

- requests sin autorización o payload malicioso;
- abuso de tamaño/método/content-type;
- replay de eventos sin idempotencia.

### Workflows/Neon

- SQL no contextual en selección de canal;
- ramas sin respuesta de webhook;
- desalineación entre tablas modernas y legadas.

## 4) Controles implementados

### Frontend

- bloqueo de secretos `VITE_*` sensibles en build (`vite.config.ts`).
- PIN hash + bloqueo por inactividad/segundo plano.
- licencias V2 verificadas con firma ECDSA P-256.

### API

- validación Zod de contrato de entrada.
- CORS estricto, cabeceras defensivas y `no-store`.
- límite de tamaño de request.
- JWT HS256 de vida corta para gateway.
- verificación de claims y firma con `timingSafeEqual`.

### Automatización

- `Idempotency-Key` + `eventId` en gateway.
- barrera `processed_events` en workflows.
- resolución contextual de canal por device/user.

### Datos

- append-only en snapshots/knowledge.
- transacciones para persistencia crítica local.
- control de política de dispositivos en licencias (`single`/`multi`).

## 5) Gestión de secretos

Permitido:

- secretos en variables de entorno de servidor y credenciales n8n.

No permitido:

- secretos en frontend, APK, repositorio o documentación pública.
- variables server-only con prefijo `VITE_`.

## 6) Riesgos de seguridad abiertos

- dependencia de higiene operacional en workflows n8n;
- coexistencia de SQL legacy en flujos antiguos;
- posibilidad de logs excesivos en rutas de debugging si no se depura antes de release.

## 7) Checklist de seguridad para cambios

1. Verificar que no se expongan secretos cliente.
2. Confirmar validación de input en frontera API.
3. Confirmar comportamiento fail-closed ante error.
4. Verificar idempotencia para eventos mutables.
5. Validar resolución contextual de canal.
6. Revisar impacto de migraciones SQL.

## 8) Recomendaciones siguientes

- hardening adicional de auditoría de workflows (linters/validadores).
- definición de política de rotación periódica de secretos.
- checklist formal de release security gate con evidencias.
