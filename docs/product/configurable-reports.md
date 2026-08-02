# Reportes Configurables

La pantalla de Reportes mantiene los servicios y cálculos existentes y los organiza como un único flujo: configurar, previsualizar, preparar, confirmar y generar.

## Configuración

- periodo rápido o fechas explícitas;
- tipo de reporte;
- país, ciudad, temporada, categoría y forma de pago cuando aplican;
- moneda de presentación;
- estado reportado/sin reportar;
- PDF y, para ingresos, CSV o Excel.

`validateReportConfiguration` rechaza periodos invertidos y formatos desconocidos. La generación PDF continúa bajo importación dinámica para no empeorar DT-001. Ninguna exportación modifica el dato fuente.
