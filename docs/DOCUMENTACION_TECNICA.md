# Documentación Técnica

## 1. Introducción

Finance App es una aplicación web móvil diseñada para el seguimiento privado de ingresos, gastos, agenda y reportes financieros. Está construida con React, TypeScript y Vite, y puede ejecutarse en navegador o en Android mediante Capacitor.

## 2. Objetivo

Ofrecer una solución ligera para profesionales autónomos o pequeños negocios que necesitan:

- Registrar ingresos por servicios en varias monedas.
- Controlar gastos operativos.
- Planificar citas y convertirlas en servicios completados.
- Visualizar reportes con exportación a PDF, XLSX y CSV.
- Mantener los datos localmente en el dispositivo con seguridad por PIN.

## 3. Arquitectura general

### 3.1. Tecnologías principales

- React + TypeScript
- Vite
- Capacitor (Android)
- Tailwind CSS
- Dexie + IndexedDB para persistencia local
- localStorage para caché de configuración
- React Router Dom para enrutamiento
- lucide-react para iconografía

### 3.2. Estructura de carpetas relevante

- `src/` — código fuente principal
  - `app/` — layout y estructura global
  - `components/` — componentes reutilizables (`PinGate`, `ServiceTimeAlert`)
  - `pages/` — páginas de UI principales
  - `routes/` — configuración de rutas
  - `services/` — lógica de acceso a datos y procesos principales
  - `database/` — motor Dexie y definición de base de datos
  - `types/` — tipos TypeScript
  - `utils/` — utilidades de moneda, fecha y validación

## 4. Navegación y flujos

### 4.1. Rutas principales

- `/` — `HomePage` (Inicio simplificado)
- `/resumen-completo` — `FullSummaryPage` (todas las métricas; `/dashboard` redirige por compatibilidad)
- `/income` — `IncomePage`
- `/expenses` — `ExpensesPage`
- `/agenda` — `AgendaPage`
- `/reports` — `ReportsPage`
- `/settings` — `SettingsPage`
- `/debug` — `DebugPage`

La navegación está envuelta en `PinGate` (`src/components/PinGate.tsx`) que bloquea el acceso cuando el PIN está habilitado.

En Android se usa Capacitor 8. La navegación inferior se prioriza en móvil y la web de escritorio usa barra lateral. `PinGate` escucha el ciclo de vida nativo mediante `@capacitor/app`; en web usa actividad y visibilidad. Android se bloquea al pasar a segundo plano y web después de 2 minutos sin actividad.

### 4.2. Privacidad de importes

La preferencia local `finance-app:sensitive-values-hidden` oculta ingresos y ganancias como `****` en Inicio, Resumen completo, listados de ingresos y resúmenes de cortes. No altera ni elimina los datos persistidos.

### 4.3. Alarmas de Agenda

Cada cita admite hasta dos alarmas sonoras independientes. La usuaria parametriza la cantidad y la unidad (minutos, horas o días) de cada alarma antes de la hora de inicio. Android usa `@capacitor/local-notifications`, el sonido propio `appointment_alarm.ogg`, canal de importancia máxima, vibración, alarmas exactas y acciones Detener/Posponer. Requiere aceptar notificaciones en Android 13+ y permitir alarmas exactas en Android 12+ cuando el sistema lo solicite. Android no permite que una app ignore el volumen, No molestar o la configuración manual del canal del dispositivo. En web se usa Notification API más alarma audible en primer plano; un navegador no garantiza sonido ni ejecución con la PWA completamente cerrada. Sin backend push no existe entrega web fiable con la app cerrada.

La recuperación del PIN no revela ni descifra el PIN. Al no existir backend o identidad verificable, ofrece únicamente un reinicio local destructivo confirmado con `BORRAR`. Restaurar datos después requiere un backup cifrado creado previamente.

### 4.4. Pruebas por plataforma

- Web escritorio: `npm run dev`, abrir la URL local y comprobar barra lateral, Inicio, Resumen completo, ocultación y bloqueo tras 2 minutos.
- Móvil/PWA: abrir la URL desde un dispositivo o modo responsive, instalar desde el navegador y comprobar navegación inferior. Las notificaciones web requieren permiso y solo se garantiza sonido con la app activa.
- APK Android: `npm run android:apk`, instalar `dist/apk/finance-app-debug.apk`, aceptar notificaciones/alarmas exactas, crear una cita próxima con recordatorio local y probar segundo plano, Detener y Posponer.

## 5. Modelo de datos

### 5.1. `AppSettings`

Propiedades principales:

- `businessName`: nombre del negocio.
- `country`: código ISO del país.
- `defaultCurrency`: moneda base.
- `secondaryCurrency`: moneda secundaria.
- `incomePercentage`: porcentaje de ingresos para cálculo de ganancia real.
- `rateMode`: modo de tasa de cambio (`manual` o `automatic`).
- `theme`: modo visual (`system`, `light`, `dark`).
- `pinEnabled`: habilita bloqueo por PIN.
- `pinHash`: derivación PBKDF2-SHA-256 con sal aleatoria del PIN cuando está activado. Se conserva verificación de hashes heredados para no bloquear instalaciones existentes.

### 5.2. `ServiceIncome`

Campos clave:

- `date`, `duration`, `totalAmount`, `currency`, `percentage`
- `realGain`, `eurValue`, `copValue`
- `exchangeRateUsed`, `baseCurrency`, `secondaryCurrency`
- `baseCurrencyValue`, `secondaryCurrencyValue`
- `timerStartedAt`, `timerStoppedAt`, `actualDuration`
- `country`

### 5.3. `Expense`

Campos clave:

- `date`, `category`, `amount`, `currency`
- `eurValue`, `copValue`
- `baseCurrency`, `secondaryCurrency`
- `baseCurrencyValue`, `secondaryCurrencyValue`
- `exchangeRateBaseToSecondary`
- `country`

### 5.4. `Appointment`

Campos clave:

- `dateTime`, `clientName`, `duration`, `expectedAmount`, `currency`
- `notes`, `completed`, `timerMode`
- `timerStartedAt`, `timerStoppedAt`, `actualDuration`

### 5.5. `ExchangeRate`

Campos clave:

- `baseCurrency`, `targetCurrency`, `rate`, `date`, `source`, `createdAt`

## 6. Persistencia

### 6.1. Base de datos Dexie / IndexedDB

`src/database/db.ts` define la base de datos `FinanceDB` con las tablas:

- `services`
- `expenses`
- `appointments`
- `settings`
- `exchangeRates`
- `cutoffReports`
- `earningPeriods`
- `licenses`
- `automationOutbox`
- `communicationChannels`

### 6.2. sincronización de configuración

`src/services/settingsService.ts` guarda la configuración en IndexedDB y replica valores clave en `localStorage` para permitir recuperación rápida y restauración ante datos corruptos.

## 7. Servicios clave

### 7.1. `settingsService`

- `getSettings()` — carga o crea la configuración inicial.
- `updateSettings()` — persiste cambios de usuario.
- `applyTheme()` — aplica tema al documento.
- `enablePin()` / `disablePin()` — activa o desactiva el PIN de acceso.

### 7.2. `incomeService`

- `createServiceIncome()` — agrega un ingreso.
- `listServiceIncomes()` — lista ingresos con opciones de rango y filtro por país.
- `updateServiceIncome()`, `deleteServiceIncome()` — mantenimiento.

### 7.3. `expenseService`

- `createExpense()` — agrega un gasto.
- `listExpenses()` — lista gastos con rango, categoría y país.
- `updateExpense()`, `deleteExpense()` — mantenimiento.

### 7.4. `currencyConversionService`

Responsable de resolver tasas de cambio y convertir valores:

- `resolveExchangeRate()` — consulta API Frankfurter cuando hay conexión y modo automático.
- `getOfflineExchangeRate()` — cálculo interno basado en tabla local.
- `convertCurrency()` / `convertCurrencyPair()` / `convertCurrencyToEurCop()`.

### 7.5. `exchangeRateService`

- `saveExchangeRate()` — guarda tasa calculada o recuperada.
- `getLatestExchangeRate()` — obtiene la tasa más reciente para fallback offline.

### 7.6. `appointmentService` y `appointmentCompletionService`

- `createAppointment()`, `updateAppointment()`, `listAppointments()`, `deleteAppointment()`.
- `completeAppointmentAsIncome()` — convierte una cita completada en un ingreso, calcula duración real y realiza conversiones monetarias.

### 7.7. `reportExportService`

Genera reportes en:

- PDF: `exportReportPdf()`
- XLSX: `exportReportXlsx()`
- CSV: `exportReportCsv()`

### 7.8. `backupService`

- `exportBackup()` — descarga `backup.json` con snapshot completo.
- `importBackup()` — importa datos desde un archivo JSON.

### 7.9. `communicationChannelService`

Mantiene localmente el canal WhatsApp y sus preferencias, y envía a n8n las
solicitudes de QR, estado, desconexión, prueba y actualización de preferencias.
La PWA nunca llama directamente a Evolution API ni almacena su API Key.

## 8. Flujo de conversión de moneda

### 8.1. Modo manual vs automático

- `manual`: el usuario puede ingresar una tasa de cambio personalizada.
- `automatic`: se intenta consultar la API `Frankfurter`. Si falla, se usa la última tasa guardada o el valor offline.

### 8.2. Valores calculados

Para ingresos y gastos, la aplicación calcula:

- `baseCurrencyValue`
- `secondaryCurrencyValue`
- `eurValue`
- `copValue`

Estas conversiones alimentan la visualización de reportes y los totales.

## 9. Seguridad y permiso de acceso

El acceso general está protegido con PIN si el usuario lo habilita en configuración. El componente `PinGate` bloquea toda la aplicación hasta que el PIN ingresado sea correcto.

## 10. Instalación y despliegue

### 10.1. Requisitos

- Node.js compatible con Vite
- npm
- Android SDK para compilación móvil

### 10.2. Comandos principales

- `npm install` — instalar dependencias
- `npm run dev` — iniciar servidor de desarrollo
- `npm run build` — compilar la aplicación
- `npm run preview` — vista previa de la app compilada
- `npm run android:add` — agregar plataforma Android
- `npm run android:sync` — sincronizar cambios con Android
- `npm run android:open` — abrir proyecto Android en Android Studio
- `npm run android:apk` — construir APK de debug

## 11. Consideraciones de mantenimiento

### 11.1. Migraciones

El proyecto maneja versiones de base de datos en `src/database/db.ts` y puede ejecutar migraciones en `src/database/migrations/backfillCountry.ts`.

### 11.2. Página de depuración

`/debug` ofrece herramientas internas para mantenimiento y migración de datos en desarrollo.

### 11.3. Temas

El tema visual se aplica dinámicamente con `data-theme` en el elemento raíz y `classList.toggle('dark', ...)`.

## 12. Notas finales

El diseño está orientado a un uso privado local. No hay backend externo obligatorio; la sincronización y exportación se realiza desde el dispositivo.
