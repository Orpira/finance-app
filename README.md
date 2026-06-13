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

## ✅ Funcionalidades principales

- `Home`: selector de módulos y bienvenida.
- `Dashboard`: resumen mensual de ingresos, gastos y métricas.
- `Income`: registro de servicios con conversión de monedas.
- `Expenses`: registro de gastos por categoría.
- `Agenda`: gestión de citas y cronometrado.
- `Reports`: visualización y exportación de reportes.
- `Settings`: configuración del negocio, moneda, tema y PIN.
- `Debug`: herramientas internas para migraciones y mantenimiento.

## 💾 Persistencia

Los datos se almacenan localmente usando IndexedDB con Dexie. La configuración también mantiene un respaldo en `localStorage` para recuperación rápida.

## 🔐 Seguridad

La función de PIN protege el ingreso a la aplicación. Se habilita o deshabilita desde `Settings`.

## 🛠️ Mantenimiento

Para restaurar o respaldar datos, usa las funciones de exportación e importación en la sección de reportes.

## 📍 Notas

La aplicación está orientada a uso offline y local. No requiere backend propio para el funcionamiento básico.
