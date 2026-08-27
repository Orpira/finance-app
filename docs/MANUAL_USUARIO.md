# Manual de Usuario

## Introducción

Finance App es una herramienta para llevar el control de tus finanzas personales o de tu negocio. Permite registrar ingresos, gastos y citas, visualizar resúmenes y exportar reportes desde tu dispositivo.

## 1. Inicio de la aplicación

En el primer inicio, el asistente solicita el tipo de uso. En modo Profesional
también permite elegir directamente el **Método de cálculo del ingreso**:
`Servicio por tiempo` o `Jornada por horas`. Esta elección determina qué
formulario se muestra al registrar nuevos ingresos; no se deduce de una unidad
de minutos u horas. Si eliges `Jornada por horas`, el asistente solicita también
un **Valor por hora** mayor que cero. Este importe se aplicará en la moneda
principal seleccionada más adelante en el mismo asistente.

En modo Profesional, el asistente también configura la primera temporada: nombre,
fecha de inicio, finalización prevista, meta económica y porcentaje de ganancia.
La finalización prevista es informativa y nunca cierra la temporada de forma
automática. La opción **No aplica porcentaje, usar 100 %** equivale a guardar
100 %, no a dejar el porcentaje vacío. El porcentaje representa la parte del
importe del servicio que te corresponde: por ejemplo, un servicio de 100 con
30 % registra 30 como ingreso neto. Configurar 0 % registra un neto de 0. El
modo Personal omite estos pasos.

Si interrumpes la configuración, la aplicación conserva localmente el paso y
permite continuar desde allí. Los usuarios que ya tenían datos locales antes de
esta versión no son obligados a repetir el asistente.

Después de completar la configuración, verás la pantalla principal con las
secciones:

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
- `Más → Consulta de divisas`: convertir un importe de referencia entre la
  moneda base y cuatro monedas frecuentes sin alterar ningún registro financiero.
- `Ingresos`: registrar servicios realizados y ver resultados de conversión de moneda.
- `Gastos`: registrar gastos operativos diarios.
- `Agenda`: programar citas y convertirlas en ingresos al completarlas.
- `Reportes`: generar y exportar reportes por período.
- `Configuración`: definir moneda, país, PIN y preferencias.

### 2.1. Consulta de divisas

Abre `Más → Consulta de divisas`, escribe un importe y elige la moneda base. La
pantalla muestra el equivalente en cuatro monedas, priorizando la moneda secundaria configurada.
Cada resultado identifica si procede de Frankfurter, del caché local, de una
tasa manual o de una referencia local.

Con la tasa automática activa, la aplicación reutiliza la cotización API del
día y solo consulta de nuevo cuando hace falta. Con la tasa manual, la tarjeta
no consulta la red al abrirse; pulsa el icono de actualización para hacerlo de
forma explícita. Sin conexión conserva las últimas cotizaciones disponibles y
muestra `No disponible` para cualquier par que no pueda resolver. La consulta
es informativa: no guarda el importe escrito ni modifica balances o registros.

### 2.2. Meta de la temporada

En modo Profesional, la tarjeta **Meta de la temporada** usa únicamente
movimientos realizados de esa temporada. Presenta este desglose:

- **Ingresos netos**: importes guardados después de aplicar el porcentaje, más
  los Adicionales del balance agregado.
- **Egresos**: gastos realizados de la temporada.
- **Resultado**: ingresos netos menos egresos.
- **Progreso**: resultado dividido entre la meta económica.

Los ajustes se muestran por separado y no alteran la Meta. Un resultado negativo
se conserva y puede producir progreso negativo. Si el resultado supera la meta,
el porcentaje visible puede superar el 100 %, aunque la barra queda llena al
100 %. Editar o eliminar un ingreso o egreso recalcula la tarjeta desde los
registros locales; no modifica los movimientos históricos.

## 3. Registrar ingresos

El formulario de `Ingresos` se adapta automáticamente según el **Método de cálculo del ingreso** elegido en el asistente inicial o actualizado después en `Configuración → Datos generales`. Hay dos métodos disponibles:

El selector se llama **Tipo de registro**. Muestra `Servicio` cuando el método
es Servicio por tiempo y `Jornada` cuando es Jornada por horas; los listados,
detalles, movimientos, reportes y exportaciones muestran el nombre completo
`Jornada por horas`.

### 3.1. Servicio por tiempo (método por defecto)

1. Ve a `Ingresos`.
2. Selecciona la fecha del servicio.
3. Indica la duración (activa el cronómetro del servicio).
4. Ingresa el importe total y la moneda.
5. Selecciona el tipo de pago.
6. Ajusta el porcentaje de ganancia real si es necesario.
7. Selecciona la tasa de cambio manual o usa la automática.
8. Opcionalmente, indicá si el ingreso tiene un **Adicional** (ver 3.3).
9. Presiona `Guardar` para registrar el ingreso.

### 3.2. Jornada por horas

Si en Configuración elegiste "Jornada por horas", el formulario ya no pide duración ni activa ningún cronómetro. En su lugar:

1. Ve a `Ingresos`.
2. Selecciona la fecha.
3. Ingresa el **Tiempo trabajado** en horas, con incrementos de 0,25 horas.
4. El cálculo usa el **Valor por hora** indicado en el asistente inicial o actualizado después en Configuración. El formulario del ingreso no modifica ese valor; cada ingreso conserva una copia de la tarifa aplicada.
5. El sistema calcula automáticamente el **Total calculado** (tiempo trabajado × valor por hora). No hay cronómetro ni importe manual en este método.
6. No se solicita tipo de pago al registrar la jornada, ya que puede liquidarse al final de la temporada o en una fecha posterior.
7. Opcionalmente, indicá si el ingreso tiene un **Adicional** (ver 3.3).
8. Presiona `Guardar`.

Cambiar el método en Configuración nunca modifica ingresos ya registrados: cada ingreso conserva el método y los parámetros con los que fue creado.

En modo Profesional, la fecha del ingreso debe coincidir con el inicio de la
temporada activa o ser posterior. La aplicación rechaza tanto el alta como la
edición si la fecha es anterior al inicio de la temporada.

### 3.3. Adicionales

Un Adicional es un importe positivo que complementa el ingreso principal (por ejemplo, una propina).

**Importante**: el Adicional siempre se muestra y se calcula **aparte** del total del ingreso. El total que ves en la tarjeta de cada ingreso (y el "Total calculado" del formulario) es siempre y únicamente el trabajo realizado (servicio o tiempo trabajado × valor por hora) — nunca incluye los Adicionales, ni al crear el ingreso ni después de agregarlos o quitarlos.

- Al **registrar** un ingreso nuevo, marcá "Sí" en "¿Este ingreso tiene un adicional?" para que aparezca el formulario de Importe/Descripción antes de guardar.
- Al **editar** un ingreso ya guardado, la sección "Adicionales" siempre está disponible: podés añadir o eliminar adicionales en cualquier momento (mientras el ingreso no esté reportado ni pertenezca a una temporada cerrada). También hay un acceso directo "Adicional" en el listado de `Ingresos`.
- Al abrir el **detalle** de un ingreso profesional, incluso desde `Actividad reciente` de Inicio, se muestran por separado la descripción y el importe de cada Adicional existente.
- El total de Adicionales de cada ingreso se muestra por separado en su tarjeta del listado. El balance de `Inicio` sí suma los Adicionales al calcular `Ganancia` (la tarjeta "Ingresos" los descuenta para no contarlos dos veces, y hay una tarjeta "Adicionales" propia con el total del mes).

El sistema calculará automáticamente:

- ganancia real del trabajo realizado (sin Adicionales)
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
- Cada cita nueva incluye una alarma editable 5 minutos antes. Puedes configurar
  hasta dos alarmas; ambas suenan antes de la hora de inicio.
- La app impide guardar citas que coincidan total o parcialmente con la duración
  prevista de otra cita. Sí puedes comenzar una nueva exactamente cuando termina
  la anterior.
- Antes de la fecha y hora programadas, `Iniciar servicio` permanece
  deshabilitado. Al llegar la hora, pulsa el botón para comenzar; la cita no se
  inicia automáticamente.
- Durante el servicio se muestra la hora real de inicio, no un reloj ascendente.
- Pulsa `Servicio realizado` para finalizar. La app fija la duración real y
  registra el ingreso una sola vez, aunque el botón se pulse repetidamente.
- La alarma `Tiempo previsto cumplido` conserva las opciones `Continuar` y
  `Finalizar servicio`; aparece después de iniciar, cuando se cumple la duración
  prevista, y permanece separada de los recordatorios anteriores a la cita.

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
- **método de cálculo del ingreso** (`Servicio por tiempo` o `Jornada por horas`) — ver sección 3
- si el método es `Jornada por horas`: **valor por hora** y **unidad de tiempo** (`Horas` o `Minutos`)
- modo de tasa de cambio (`Automático` o `Manual`)
- mostrar u ocultar en Inicio y Movimientos los avisos y controles de ingresos
  sin reportar; desactivarlos no cambia registros, estados ni cálculos
- tema visual (`Sistema`, `Claro`, `Oscuro`)
- activar, cambiar o desactivar el PIN de acceso
- consultar y actualizar la licencia del dispositivo
- exportar, importar y cifrar respaldos en `Configuración → Respaldo`
- consultar la versión instalada y el estado local en
  `Configuración → Diagnóstico local`

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

Ve a `Configuración → Respaldo`. Desde esta pantalla puedes:

- exportar `backup.json` como snapshot local sin cifrar;
- configurar una clave y exportar un backup cifrado `.json.enc`;
- conectar Google Drive App Folder y subir un backup cifrado manualmente o de
  forma automática.

El JSON sin cifrar contiene datos financieros y debe guardarse en un lugar
seguro. La clave del backup cifrado no se incluye en el archivo; sin esa clave
no es posible restaurarlo.

### 9.2. Importar respaldo

En `Configuración → Respaldo` puedes importar un `backup.json`, un backup
cifrado con su clave o el último backup disponible en Google Drive App Folder.
La restauración reemplaza los datos locales actuales, por lo que conviene
exportar primero un respaldo nuevo.

La importación JSON acepta snapshots actuales y backups históricos de Private
Balance. Antes de reemplazar IndexedDB, la aplicación comprueba que el archivo
sea JSON válido, que corresponda a un formato reconocido y que sus relaciones
financieras sean consistentes. Si la validación falla, los datos locales
existentes permanecen intactos.

Al finalizar una importación sin cifrar se muestran los recuentos restaurados.
Si el backup solo contiene temporadas cerradas, la acción posterior abre el
historial de temporadas; si contiene una temporada activa, abre Ingresos.

## 10. Consejos prácticos

- Mantén actualizados el país y la moneda base para que las conversiones sean correctas.
- Si trabajas con divisas distintas, usa el modo de tasa automática para obtener valores más precisos.
- Registra los gastos al inicio del día para tener un control diario más confiable.
- Usa el Dashboard todos los días para identificar tendencias y mejorar la gestión.

## 11. Solución de problemas

- Si la aplicación no carga datos, recarga la página y verifica que el navegador permita `IndexedDB`.
- Si el PIN no funciona, revisa que estés usando el código correcto y que el modo correcto esté activo en `Configuración`.
- Si la exportación de reportes falla, intenta usar un navegador diferente o reiniciar la app.
- Si Android no muestra un archivo JSON en el selector, confirma que el nombre
  termine en `.json`; la app también acepta proveedores que lo identifican
  como texto u octet-stream.
- Si después de instalar un APK no aparecen los cambios esperados, abre
  `Configuración → Diagnóstico local` y comprueba la versión y el código de
  compilación instalados.

## 12. Soporte básico

- Para respaldo seguro de datos, guarda el archivo y, si está cifrado, su clave
  en ubicaciones separadas y confiables.
- Si necesitas reinstalar, importa el respaldo desde
  `Configuración → Respaldo`.
