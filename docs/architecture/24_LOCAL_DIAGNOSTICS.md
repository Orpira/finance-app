# Diagnóstico Local Seguro

## Propósito

`localDiagnosticService` reúne información técnica útil para soporte sin enviar datos fuera del dispositivo. La pantalla vive en `/settings/diagnostics` y funciona en web y Android.

## Contenido

- versión de aplicación y plataforma;
- versión del esquema Dexie;
- integridad de lectura de tablas;
- uso y cuota estimada del almacenamiento;
- conteo de registros por tabla;
- último backup y última restauración observados localmente;
- códigos técnicos de error sin mensajes ni payloads.

## Privacidad

El recolector usa `count()` y nunca `toArray()`. El exportable no incluye movimientos, importes, fechas financieras, categorías, descripciones, prompts, claves, licencias ni contenido de errores. `buildSafeDiagnosticExport` añade una declaración explícita de privacidad.

## Exportación

En web se descarga JSON. En Android se escribe temporalmente en la caché de Capacitor y se abre el selector nativo para compartir. No existe subida automática ni endpoint remoto.

## Actividad de backup

Las marcas de último backup/restauración se guardan como timestamps técnicos en `localStorage`; no requieren migración Dexie y no contienen contenido del respaldo.
