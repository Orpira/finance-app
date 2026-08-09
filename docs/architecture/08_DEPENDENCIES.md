# 08 - Dependencies

## 1) Dependencias runtime clave

### Frontend y plataforma

- `react`, `react-dom`, `react-router-dom`
- `vite` (build/runtime dev)
- `tailwindcss`, `@tailwindcss/vite`
- `lucide-react`

### Persistencia y validación

- `dexie`
- `zod`

### Capacitor / móvil

- `@capacitor/core`, `@capacitor/android`, `@capacitor/ios` y
  `@capacitor/cli` están fijados y alineados en `8.5.0`.
- `@capacitor/app`, `@capacitor/device`
- plugins: filesystem, notifications, preferences, share

### Exportación y utilidades

- `jspdf`

### Backend remoto

- `@neondatabase/serverless`

## 2) Dependencias de desarrollo

- `typescript`
- `eslint`, `typescript-eslint`, `@eslint/js`
- `vitest`
- `@vitejs/plugin-react`
- `@types/*`

## 3) Dependencias externas de infraestructura

- Vercel Functions.
- Neon PostgreSQL.
- n8n.
- Evolution API.

Estas dependencias no están en `package.json` como librerías runtime del frontend, pero son esenciales para operación integral.

## 4) Criterios actuales de aceptación de dependencias

- debe existir justificación funcional explícita;
- no exponer secretos ni obligar lógica server en cliente;
- no romper compatibilidad de build web + APK;
- no duplicar capacidades ya cubiertas en stack actual.

## 5) Riesgos de dependencia

- cambios de API en Evolution/n8n impactan workflows críticos;
- cambios en @neondatabase/serverless impactan tipado y ejecución SQL;
- debt de lint/test puede bloquear upgrades de toolchain.
- mezclar versiones menores distintas de `@capacitor/core`, Android, iOS y CLI
  produce advertencias en `cap sync` y deja el empaquetado sin una línea base
  reproducible.

## 6) Política recomendada de upgrades

1. actualizar en ramas controladas por lote temático;
2. mantener alineados los paquetes base de Capacitor;
3. correr `npm test`, `npm run build` y `npm run test:indexeddb` cuando el
   cambio afecte persistencia;
4. validar contratos API/gateway y workflows n8n;
5. documentar impacto en changelog técnico.

## 7) Dependencias prohibidas implícitas

- SDKs que requieran secretos embebidos en cliente.
- librerías que alteren cálculos financieros sin trazabilidad.
- adopciones de estado global invasivo sin necesidad real.
