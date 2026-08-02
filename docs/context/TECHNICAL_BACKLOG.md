# Backlog Técnico

| ID | Deuda | Estado | Prioridad | Pre-release | Criterio de cierre |
| --- | --- | --- | --- | --- | --- |
| DT-001 | Bundle principal superior a 500 kB | Pendiente | Alta antes de v1.0 | Sprint E | División medida del bundle sin regresiones funcionales |
| DT-002 | Service Worker PWA no registrado | Pendiente | Alta antes de v1.0 | Sprint C | Estrategia offline de assets implementada y probada en web/Android |
| DT-003 | Auditoría completa de accesibilidad | Mejora parcial | Alta antes de v1.0 | Sprint D | Auditoría WCAG completa con teclado, lector, contraste y móvil |
| DT-004 | Rollback físico descendente de Dexie no soportado | Aceptada | Media | No asignada | Runbook automatizado no destructivo o política permanente de compatibilidad de esquema |

Iteración 6 añade foco global visible, reducción de movimiento, regiones vivas y una revisión de los flujos modificados. No se declara DT-003 cerrada: falta certificar lectores de pantalla, contraste completo y dispositivos físicos.

DT-002, DT-003 y DT-001 deben cerrarse, respectivamente, en los sprints C, D y E de la [Fase Pre-Release 0.9](../roadmap/PRODUCT_RELEASE_ROADMAP.md). No deben mezclarse con nuevas funciones.

## DT-001 - Optimización de rendimiento y tamaño del bundle

**Estado:** Pendiente  
**Prioridad:** Alta, antes de v1.0  
**Origen:** advertencia de Vite/Rollup porque el chunk principal supera 500 kB.

No es un error funcional y no debe abordarse durante trabajo funcional. Se ejecutará en el Sprint E de la Fase Pre-Release 0.9 como un frente exclusivo y medible.

### Objetivos

- reducir carga inicial y tamaño del bundle principal;
- mejorar apertura de web/PWA y APK;
- mantener comportamiento, compatibilidad offline y cálculos sin cambios;
- cargar inicialmente solo Inicio, Movimientos y Agenda siempre que la arquitectura lo permita.

### Alcance en el Sprint E

- auditar lazy loading, code splitting, `React.lazy`, `Suspense`, tree shaking, imports, código muerto, iconografía y dependencias duplicadas;
- separar módulos pesados y revisar específicamente jsPDF, XLSX, html2canvas, Recharts, Chart.js y OpenAI;
- generar bundle analyzer y medir Lighthouse/Core Web Vitals;
- medir tiempo de apertura de PWA y APK;
- revisar caché PWA después de definir DT-002, ya que hoy no hay Service Worker activo.

### Criterios de aceptación

- reducción medida del bundle inicial, idealmente por debajo del umbral recomendado por Vite;
- mejora medida de carga inicial, Lighthouse, PWA y APK;
- suite funcional sin regresiones;
- compatibilidad offline preservada.
