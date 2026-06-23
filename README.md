# Finance App

Finance App es una aplicación de finanzas personales y administración de servicios diseñada para funcionar en navegador y en Android mediante Capacitor.

## 📌 Descripción

La aplicación permite a autónomos y pequeños negocios manejar:

- Registro de ingresos por servicios y cálculo de ganancia real.
- Control de gastos operativos.
- Agenda de citas convertibles en ingresos.
- Generación de reportes exportables en PDF, XLSX y CSV.
- Respaldo e importación de datos.
- Bloqueo de acceso con PIN.

## 🚀 Tecnologías

- React
- TypeScript
- Vite
- Tailwind CSS
- Capacitor
- React Router
- Dexie / IndexedDB
- ExcelJS, jsPDF
- Frankfurter API para tasas de cambio

## 🗂️ Estructura principal

- `src/app/` — Layout y estructura de la app.
- `src/components/` — Componentes reutilizables.
- `src/pages/` — Pantallas principales.
- `src/routes/` — Enrutamiento.
- `src/services/` — Lógica de acceso a datos.
- `src/database/` — Configuración Dexie e import/export.
- `src/types/` — Tipos de datos.
- `src/utils/` — Funciones utilitarias.

## 📁 Documentación adicional

- `DOCUMENTACION_TECNICA.md` — Detalles del diseño, arquitectura, modelo de datos y servicios.
- `MANUAL_USUARIO.md` — Guía de uso paso a paso para la aplicación.

## 🧪 Instalación y ejecución

```bash
npm install
npm run dev
```

Accede a la aplicación en el navegador en `http://localhost:5173`.

## 📦 Compilación

```bash
npm run build
```

## 📱 Android

```bash
npm run android:add
npm run android:sync
npm run android:open
npm run android:apk
```

## Generar iconos de la aplicación

El icono base de la aplicación está en:

```bash
resources/icon.png
```

Para cambiar el icono:

1. Reemplaza `resources/icon.png` por un PNG de `1024x1024 px`, sin texto y con el diseño centrado.
2. Genera los assets de Capacitor:

```bash
npm run generate:assets
```

3. Sincroniza Android:

```bash
npx cap sync android
```

Los iconos Android se generan en `android/app/src/main/res/`.

## ✅ Funcionalidades principales

- `Inicio`: resumen mensual simplificado de ingresos, egresos y ganancia.
- `Resumen completo`: indicadores, filtros y métricas financieras detalladas.
- `Income`: registro de servicios con conversión de monedas.
- `Expenses`: registro de gastos por categoría.
- `Agenda`: gestión de citas y cronometrado.
- `Reports`: visualización y exportación de reportes.
- `Settings`: configuración del negocio, moneda, tema y PIN.
- `Debug`: herramientas internas para migraciones y mantenimiento.

## 💾 Persistencia

Los datos se almacenan localmente usando IndexedDB con Dexie. La configuración también mantiene un respaldo en `localStorage` para recuperación rápida.

## 🔐 Seguridad

La función de PIN protege el ingreso a la aplicación, bloquea al pasar Android a segundo plano y tras 2 minutos de inactividad en web. El PIN se guarda como hash con sal aleatoria, nunca en texto plano. Como no existe autenticación remota, la recuperación segura exige borrar los datos locales; conviene mantener un backup cifrado actualizado.

## Licencias firmadas offline V2

Private Balance utiliza una licencia local vinculada a cada dispositivo. Antes
del PIN y de las rutas principales, `LicenseGuard` comprueba en IndexedDB que la
licencia esté activa, corresponda al código del dispositivo y no haya expirado.
La comprobación funciona sin servidor y sin conexión.

La versión V2 reemplaza el checksum local por firma digital asimétrica:

- El desarrollador conserva una clave privada fuera de la app.
- La app incluye únicamente la clave pública en
  `src/services/signedLicenseService.ts`.
- La licencia se firma fuera del frontend y del APK.
- La app valida la firma offline con Web Crypto API usando ECDSA P-256 y
  SHA-256.

El formato de licencia V2 es:

```text
PB-LIC-V2.<payloadBase64Url>.<signatureBase64Url>
```

El payload firmado incluye la aplicación, versión, código de dispositivo, tipo
de licencia, fecha de emisión, expiración y funcionalidades habilitadas.

### Código del dispositivo

- En Android se obtiene un identificador estable mediante `@capacitor/device`.
- En navegador/PWA se genera un UUID y se conserva en `localStorage`.
- El identificador se transforma en un código legible como
  `PB-8F3A-91BC-22DA`; el identificador nativo sin procesar no se muestra.

La licencia se guarda en la tabla Dexie `licenses`. No se incluye en los
backups financieros, para evitar transferir una activación entre dispositivos.

### Generar claves V2

Genera un par de claves ECDSA P-256:

```bash
node scripts/generate-license-keys.mjs
```

Por defecto se generan:

- `license-private-key.json`: clave privada local, ignorada por Git.
- `license-public-key.json`: clave pública para copiar en la app.

La clave privada también puede guardarse fuera del repositorio:

```bash
node scripts/generate-license-keys.mjs /ruta/segura/license-private-key.json license-public-key.json
```

Nunca subas la clave privada al repositorio, no la incluyas en el frontend y no
la empaquetes en Android. Los archivos `license-private-key.json`,
`license-private-key.pem` y `.env.license` están ignorados por Git.

Si generas una nueva clave para producción, copia la clave pública resultante en
`publicLicenseKeyJwk` dentro de `src/services/signedLicenseService.ts` y firma
las licencias con la clave privada correspondiente.

### Generar licencias V2

El generador lee la clave privada desde:

1. `LICENSE_PRIVATE_KEY_JWK`, con el JWK completo en una variable de entorno.
2. `LICENSE_PRIVATE_KEY_PATH`, apuntando a un archivo JSON.
3. `./license-private-key.json`, por defecto.

Licencia demo con expiración:

```bash
node scripts/generate-signed-license.mjs PB-F78A-870C-3216 demo 2026-07-31
```

Licencia lifetime:

```bash
node scripts/generate-signed-license.mjs PB-F78A-870C-3216 lifetime
```

Tipos disponibles:

- `demo`: acceso temporal de demostración.
- `monthly`: licencia mensual; requiere fecha de expiración.
- `annual`: licencia anual; requiere fecha de expiración.
- `lifetime`: acceso sin expiración, con `expiresAt: null`.

### Validación en la app

`src/services/signedLicenseService.ts` valida:

- Formato `PB-LIC-V2.<payload>.<firma>`.
- Firma digital ECDSA P-256/SHA-256 con la clave pública.
- `app === "private-balance"`.
- `version === 2`.
- `deviceCode` igual al dispositivo actual.
- `licenseType` dentro de `demo`, `monthly`, `annual` o `lifetime`.
- Expiración futura para licencias temporales.
- `expiresAt: null` para licencias lifetime.
- Protección básica contra retroceso de fecha mediante `lastValidAccessDate`.

La activación sigue entrando por la pantalla de licencia. Si el código empieza
por `PB-LIC-V2`, se valida como licencia firmada; los códigos antiguos V1 se
mantienen solo para transición.

### Compatibilidad temporal V1

Las licencias V1 activas siguen funcionando durante la transición y se marcan
internamente con `licenseVersion: 1`. Las nuevas activaciones deben generarse en
V2 y se guardan con `licenseVersion: 2`.

El formato antiguo `PB-TIPO-YYYYMMDD-HASHDISPOSITIVO-CHECKSUM` sigue disponible
para instalaciones ya activadas o pruebas puntuales, pero no debe usarse para
licencias nuevas.

### Generar un código V1 manualmente

Con el servidor de desarrollo activo (`npm run dev`), abre la consola del
navegador y ejecuta:

```js
const { generateActivationCode } = await import('/src/utils/licenseCodeGenerator.ts')

generateActivationCode('PB-8F3A-91BC-22DA', 'demo', '2026-07-31')
generateActivationCode('PB-8F3A-91BC-22DA', 'monthly', '2026-08-31')
generateActivationCode('PB-8F3A-91BC-22DA', 'annual', '2027-07-31')
generateActivationCode('PB-8F3A-91BC-22DA', 'lifetime', '')
```

El resultado tiene el formato
`PB-TIPO-YYYYMMDD-HASHDISPOSITIVO-CHECKSUM`. Las licencias `lifetime` utilizan
`00000000` como fecha interna y no expiran.

Tipos disponibles:

- `demo`: acceso temporal de demostración.
- `monthly`: licencia mensual; la fecha exacta la decide el desarrollador.
- `annual`: licencia anual; la fecha exacta la decide el desarrollador.
- `lifetime`: acceso sin expiración.

### Expiración y protección del reloj

En cada inicio, al volver a primer plano y periódicamente mientras está abierta,
la app comprueba la expiración. También guarda `lastValidAccessDate`; si el reloj
del dispositivo retrocede, bloquea el acceso hasta que se corrijan la fecha y la
hora.

Para probar una licencia expirada durante desarrollo, abre IndexedDB en las
herramientas del navegador, tabla `licenses`, establece `expirationDate` en una
fecha pasada y `status` en `active`, y recarga la página.

Para limpiar solo la licencia durante desarrollo:

```js
const { db } = await import('/src/database/db.ts')
await db.licenses.clear()
location.reload()
```

En Android también se puede limpiar borrando los datos de la aplicación desde
los ajustes del sistema. El restablecimiento seguro por pérdida del PIN elimina
toda la base local, incluida la licencia.

### Limitaciones de seguridad

Una app offline nunca es 100% inviolable: una persona con control total del
dispositivo puede inspeccionar o modificar el APK. La firma asimétrica mejora
mucho la seguridad porque la clave privada no está dentro de la app y el
checksum ya no puede replicarse desde el bundle, pero no sustituye una
validación remota para escenarios de máximo riesgo.

## Backup cifrado con Google Drive App Folder

La app puede generar backups cifrados de IndexedDB/Dexie y guardarlos en el espacio privado de aplicación de Google Drive. Usa únicamente el scope limitado:

```text
https://www.googleapis.com/auth/drive.appdata
```

Ese permiso no da acceso al Drive completo de la usuaria. La app solo puede crear, listar y leer archivos dentro de `appDataFolder`, el espacio privado asociado a la aplicación.

El JSON plano nunca se sube a Google Drive: antes de salir del dispositivo, la app cifra el backup con Web Crypto API usando AES-GCM y una clave local configurada por el usuario.

El backup incluye:

```json
{
  "version": "2",
  "generatedAt": "2026-06-15T10:00:00.000Z",
  "appName": "Private Balance",
  "services": [],
  "expenses": [],
  "appointments": [],
  "settings": {},
  "exchangeRates": []
}
```

Desde `Configuración > Backup` se pueden configurar:

- Google OAuth Client ID.
- Conectar o desconectar Google Drive.
- Estado de conexión.
- Activar backup automático.
- Frecuencia diaria.
- Último backup realizado y último estado.
- Subir backup ahora.
- Restaurar último backup.
- Exportar backup cifrado local.
- Importar backup cifrado local con la misma clave.
- Exportar backup JSON sin cifrar solo para migraciones controladas.

Al abrir la app, si Google Drive está conectado, el backup automático está activo y pasaron 24 horas desde el último envío, la app intenta generar un backup cifrado y subirlo a `appDataFolder`. También intenta ejecutarlo cuando la app pasa a segundo plano mediante `visibilitychange`; Android puede limitar este comportamiento si el proceso se suspende.

La subida usa Drive API v3 con carga multipart:

```text
POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart
```

Metadata:

```json
{
  "name": "private-balance-backup-YYYY-MM-DD-HH-mm.json.enc",
  "parents": ["appDataFolder"]
}
```

Para listar backups se usa:

```text
GET https://www.googleapis.com/drive/v3/files?spaces=appDataFolder
```

Para configurar credenciales OAuth en Google Cloud Console:

1. Crea o selecciona un proyecto.
2. Habilita Google Drive API.
3. Configura la pantalla de consentimiento OAuth.
4. Crea un Client ID OAuth compatible con el flujo que uses para la app.
5. Añade el Client ID en `Configuración > Backup`.
6. Verifica que solo se solicite el scope `drive.appdata`.

Para probar en Android:

```bash
npm run build
npx cap sync android
```

La restauración desde Google Drive descarga el último `.json.enc`, solicita confirmación destructiva, descifra con la clave local y reemplaza IndexedDB/Dexie si el backup es válido.

Para restaurar un backup local cifrado, ve a `Configuración > Backup`, introduce la misma clave de cifrado usada al exportar y selecciona `Importar backup cifrado`. Si la clave no coincide, el descifrado fallará y los datos no se restaurarán.

## 🛠️ Mantenimiento

Para restaurar o respaldar datos, usa las funciones de exportación e importación en la sección de reportes.

## 📍 Notas

La aplicación está orientada a uso offline y local. No requiere backend propio para el funcionamiento básico.
