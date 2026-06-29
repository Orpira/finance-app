# Manual de Usuario

## Introducción

Finance App es una herramienta para llevar el control de tus finanzas personales o de tu negocio. Permite registrar ingresos, gastos y citas, visualizar resúmenes y exportar reportes desde tu dispositivo.

## 1. Inicio de la aplicación

Al abrir la aplicación, verás la pantalla de bienvenida con las principales secciones:

- Dashboard
- Ingresos
- Gastos
- Agenda
- Reportes
- Configuración

Si tienes PIN habilitado, el primer paso será desbloquear la aplicación ingresando el código en la pantalla de seguridad.

## 2. Pantalla principal

La pantalla principal ofrece accesos rápidos a las funciones clave:

- `Dashboard`: vista general de ingresos, gastos, ganancias y métricas del mes.
- `Ingresos`: registrar servicios realizados y ver resultados de conversión de moneda.
- `Gastos`: registrar gastos operativos diarios.
- `Agenda`: programar citas y convertirlas en ingresos al completarlas.
- `Reportes`: generar y exportar reportes por período.
- `Configuración`: definir moneda, país, PIN y preferencias.

## 3. Registrar ingresos

1. Ve a `Ingresos`.
2. Selecciona la fecha del servicio.
3. Indica la duración en minutos.
4. Ingresa el importe total y la moneda.
5. Ajusta el porcentaje de ganancia real si es necesario.
6. Selecciona la tasa de cambio manual o usa la automática.
7. Presiona `Guardar` para registrar el ingreso.

El sistema calculará automáticamente:

- ganancia real
- valor convertido a la moneda secundaria
- valor en EUR y COP

## 4. Registrar gastos

1. Ve a `Gastos`.
2. Selecciona la fecha.
3. Elige la categoría del gasto.
4. Ingresa el monto y la moneda.
5. Ajusta la tasa de cambio si usas modo manual.
6. Presiona `Guardar` para registrar el gasto.

El gasto se convierte automáticamente a la moneda secundaria y también a EUR/COP.

## 5. Agenda de citas

La agenda permite administrar servicios futuros y convertir citas en ingresos:

- Crear una cita con nombre del cliente, fecha, hora, duración, importe esperado, moneda y notas.
- Ver las citas programadas en el calendario.
- Iniciar o detener el cronómetro de una cita.
- Marcar una cita como completada; al hacerlo, se registra un ingreso con duración real y conversión de moneda.

## 6. Dashboard

El `Dashboard` muestra un resumen mensual con:

- ingresos totales
- gastos totales
- ganancia neta
- número de servicios
- minutos trabajados

También puedes filtrar por país para ver datos específicos de cada región.

## 7. Reportes

En `Reportes` puedes:

- seleccionar periodos (`Semana`, `Mes`, `Año`)
- filtrar por país
- descargar reportes en PDF, XLSX o CSV
- importar y exportar respaldo de datos

## 8. Configuración

En `Configuración` puedes ajustar:

- nombre del negocio
- país y moneda base
- moneda secundaria
- porcentaje de ganancia
- modo de tasa de cambio (`Automático` o `Manual`)
- tema visual (`Sistema`, `Claro`, `Oscuro`)
- activar, cambiar o desactivar el PIN de acceso
- consultar y actualizar la licencia del dispositivo

### 8.1. Gestión de PIN

- Para activar el PIN, ingresa un código de 4 a 6 dígitos y confírmalo.
- Para cambiar el PIN, ingresa el PIN actual y el nuevo código.
- Para desactivar el PIN, ingresa el PIN actual y selecciona `Desactivar`.

### 8.2. Gestión de licencia

En `Configuración → Licencia` puedes consultar el tipo, versión y vencimiento,
copiar el código del dispositivo y actualizar una licencia V1 a una licencia
firmada V2. La aplicación valida la firma, el dispositivo y la vigencia antes
de reemplazar la activación. Este proceso no modifica ingresos, egresos, citas,
temporadas ni configuraciones financieras.

Las automatizaciones y los canales de comunicación requieren una licencia V2.
El código firmado distingue mayúsculas y minúsculas y debe comenzar por
`PB-LIC-V2.`.

## 9. Exportar e importar datos

### 9.1. Exportar respaldo

Ve a `Reportes` y selecciona `Exportar backup` para descargar un archivo `backup.json` con todos los datos.

### 9.2. Importar respaldo

En la misma sección puedes cargar un archivo `backup.json` para restaurar el estado completo de la aplicación.

## 10. Consejos prácticos

- Mantén actualizados el país y la moneda base para que las conversiones sean correctas.
- Si trabajas con divisas distintas, usa el modo de tasa automática para obtener valores más precisos.
- Registra los gastos al inicio del día para tener un control diario más confiable.
- Usa el Dashboard todos los días para identificar tendencias y mejorar la gestión.

## 11. Solución de problemas

- Si la aplicación no carga datos, recarga la página y verifica que el navegador permita `IndexedDB`.
- Si el PIN no funciona, revisa que estés usando el código correcto y que el modo correcto esté activo en `Configuración`.
- Si la exportación de reportes falla, intenta usar un navegador diferente o reiniciar la app.

## 12. Soporte básico

- Para respaldo seguro de datos, guarda el archivo `backup.json` en un lugar confiable.
- Si necesitas reinstalar, importa tu respaldo desde `Reportes`.
