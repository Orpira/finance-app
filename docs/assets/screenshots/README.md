# Capturas de pantalla

Este directorio está reservado para capturas reales y representativas de Private Balance. Actualmente no contiene ninguna captura. Esta guía define cómo generarlas cuando se necesiten.

## Cómo tomar las capturas

1. Ejecuta la app en local (`npm run dev`) o el APK de desarrollo.
2. Crea una temporada/negocio de prueba dedicado exclusivamente a capturas, nunca reutilices datos de un negocio real.
3. Registra ingresos, gastos, citas y reportes con datos ficticios (ver más abajo).
4. Usa el tema (claro/oscuro) y el idioma en el que quieras mostrar la app de forma consistente en todas las capturas.
5. Recorta la captura al contenido relevante; evita capturar notificaciones del sistema operativo u otras apps.

## Cómo usar datos ficticios

- Nombres de clientes/servicios genéricos: "Servicio A", "Cliente Demo", nunca nombres reales.
- Montos redondos y no correlacionados con cifras reales del negocio del propietario.
- Fechas dentro de un rango de ejemplo, no el mes en curso, para que la captura no quede desactualizada de inmediato.
- Un dispositivo o licencia de demostración, nunca el código de dispositivo o licencia real.

## Cómo ocultar información sensible

- Verifica que la barra de estado (hora, batería, notificaciones) no muestre información personal antes de recortar.
- Si compartes una captura del flujo de licencia, oculta o sustituye el código de dispositivo/licencia completo.
- Revisa cualquier campo de texto libre (notas, referencias de reporte) antes de guardar la captura.

## Resoluciones recomendadas

- Web/escritorio: 1440×900 px o 1280×800 px.
- Móvil/Android: resolución nativa del dispositivo usado, recortada a la pantalla de la app (sin barras del launcher).

## Capturas mínimas necesarias

- Inicio / resumen mensual.
- Registro de ingresos.
- Agenda.
- Reportes/exportación.
- Pantalla de seguridad (PIN o activación de licencia), con datos sensibles ocultos.

## Convención de archivos

`screenshot-<area>-<variante>.png`, por ejemplo:

- `screenshot-home-light.png`
- `screenshot-income-dark.png`
- `screenshot-agenda-light.png`

## Estado actual

No hay capturas reales en este directorio todavía. No se deben referenciar imágenes de esta carpeta desde el README ni desde otra documentación hasta que existan realmente, para evitar enlaces rotos.
