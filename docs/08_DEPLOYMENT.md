# 08 Deployment

## Entornos confirmados

### Desarrollo local

- npm run dev para Vite.
- vercel dev para probar endpoints api localmente.
- npm test para validación funcional.
- npm run build para build web.

### Web pública

- Despliegue en Vercel.
- Variables sensibles solo en entorno servidor.

### Android

- npm run android:sync.
- npm run android:open.
- npm run android:apk.

## Variables relevantes

### Cliente

- VITE_API_BASE_URL.

### Servidor

- N8N_AUTOMATION_WEBHOOK_URL.
- N8N_DEVICE_PROVISIONING_WEBHOOK_URL.
- N8N_WHATSAPP_WEBHOOK_URL.
- N8N_INTERNAL_TOKEN.
- AUTOMATION_JWT_SECRET.
- DATABASE_URL.
- MAX_DEVICES_PER_LICENSE.

No se deben documentar valores reales de estas variables.

## Flujo de despliegue web

1. Configurar variables en Vercel.
2. Ejecutar build.
3. Desplegar la aplicación y las Functions api.
4. Verificar licencias, automation-token y webhook proxy.
5. Validar integración con n8n en entorno objetivo.

## Flujo de despliegue Android

1. Ejecutar build web.
2. Sincronizar Capacitor con android.
3. Generar APK.
4. Verificar permisos de notificaciones, identidad y licencia en dispositivo.

## Dependencias externas a coordinar

- Vercel.
- n8n.
- Neon PostgreSQL.
- Evolution API.

## Riesgos operativos conocidos

- Cambios en variables de servidor requieren nuevo despliegue.
- Si un workflow n8n cambia contrato de respuesta, la PWA puede romper flujos síncronos de WhatsApp.
- Existen workflows legacy que deben auditarse antes de cambios de infraestructura.

## Pendiente de validar

- Estrategia documentada de Docker/VPS para dependencias externas; el repositorio actual no incluye Dockerfile propio de la app.
- Pipeline CI/CD formal fuera del despliegue actual con Vercel y scripts manuales.

