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
- JDK 21 y Android SDK API 36.
- Capacitor `core`, `android`, `ios` y `cli` alineados en 8.5.0.

`scripts/build-apk.sh` localiza Java 21 en el toolchain local o del sistema. Si
`ANDROID_HOME` no está definido, busca Android SDK API 36 en
`ANDROID_SDK_ROOT`, `.android-sdk` y `$HOME/Android/Sdk`, en ese orden. Si no
encuentra un SDK compatible, falla antes de compilar y no publica un artefacto
ambiguo.

**Importante — VITE_API_BASE_URL debe existir antes de generar el APK.** El
WebView nativo de Capacitor no tiene origin propio con backend: todas las
llamadas de licencia/trial (`/api/trial-start`, `/api/license-activate`, ver
`src/services/apiBaseUrl.ts`) dependen de `VITE_API_BASE_URL` embebida en
tiempo de build. `vercel env pull` **no** escribe esta variable en
`.env.local` (no está configurada en el proyecto de Vercel, porque la web de
producción no la necesita — usa same-origin). Si el APK se genera con
`npm run android:apk`/`android:sync` sin esta variable presente, el resultado
es un APK que abre y muestra "licencia no válida" de forma consistente,
aunque `vercel dev` funcione bien (porque ahí sirve `/api/*` en el mismo
localhost).

Antes de generar un APK, asegúrate de que exista un `.env.production.local`
(gitignored, no lo toca `vercel env pull`) con:

```bash
VITE_API_BASE_URL=https://private-balance.orpira.es
```

Vite lo carga automáticamente en builds de producción sin afectar a
`vercel dev` ni al despliegue web.

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

1. Incrementar `versionCode` en `android/app/build.gradle` para cada APK que se
   vaya a distribuir y actualizar `versionName` con la versión visible.
2. Ejecutar `npm run android:apk`; el script compila la web, sincroniza
   Capacitor, ejecuta `assembleDebug`, lee la metadata producida por Gradle y
   genera
   `dist/apk/private-balance-<versionName>-<versionCode>-debug.apk`.
3. Registrar el nombre, la versión y el SHA-256 que imprime el script.
4. Instalar ese archivo exacto sin desinstalar la aplicación anterior, para
   conservar IndexedDB y validar la actualización sobre datos reales.
5. Abrir Configuración > Diagnóstico local y comprobar que la versión mostrada
   coincide con `versionName (versionCode)`.
6. Verificar permisos de notificaciones, identidad, licencia y restauración de
   backup en el dispositivo.

La línea base Android vigente es `versionName 1.0.1` y `versionCode 2`. El APK
de debug solo puede actualizar una instalación existente cuando conserva el
mismo `applicationId` (`com.financeapp.app`) y el mismo certificado de firma.
Una compilación de debug generada en otra máquina puede usar otra clave; no se
debe desinstalar la aplicación para resolver ese conflicto mientras existan
datos locales sin un backup comprobado.

El script elimina el alias histórico `dist/apk/finance-app-debug.apk` para
evitar que se distribuya por error un build indistinguible. El archivo fuente
de Gradle permanece en `android/app/build/outputs/apk/debug/app-debug.apk` y la
copia versionada debe ser idéntica byte a byte.

### Verificación mínima del APK

- `output-metadata.json` debe declarar el `versionName` y `versionCode`
  esperados.
- `aapt dump badging` debe mostrar `com.financeapp.app` y la versión prevista.
- `apksigner verify` debe confirmar una firma válida.
- Los assets de `dist` y `assets/public` dentro del APK deben corresponder al
  mismo build.
- Configuración > Diagnóstico local debe mostrar la versión nativa instalada,
  no una versión de entorno web.

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
