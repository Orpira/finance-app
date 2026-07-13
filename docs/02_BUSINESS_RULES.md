# 02 Business Rules

## Reglas financieras confirmadas

- Los ingresos y egresos no deben alterarse sin autorización explícita.
- Los balances históricos deben ser reproducibles.
- Los porcentajes de ganancia no se modifican de forma automática fuera de la configuración o del flujo previsto.
- Los ajustes deben quedar visibles como ajustes.
- Los ajustes positivos suman al balance y los negativos restan.

## Modos de uso

### Modo Básico

- No usa temporadas.
- Debe seguir funcionando sin la lógica avanzada del modo Profesional.

### Modo Profesional

- Usa temporadas o periodos.
- Los registros pueden quedar vinculados a temporada activa.
- Los cierres de temporada afectan mutabilidad y reportes.

## Ingresos

- Se registran como servicios o variantes derivadas según utilidades de tipo.
- Pueden incluir duración, porcentaje y tipo de pago.
- Se calculan valores base, secundarios y equivalentes agregados para reportes.

## Egresos

- Se clasifican por categoría.
- Pueden relacionarse con un ingreso.
- Admiten tipo gasto o ajuste.

## Agenda

- Una cita puede convertirse en ingreso completado.
- La duración real puede venir del temporizador o del dato manual.
- Las alarmas y recordatorios son parte del módulo, no de la contabilidad principal.

## Reportes

- Deben contemplar ambos modos de uso.
- El estado de reporte forma parte del dato persistido.
- Exportaciones disponibles: PDF, CSV y tablas formateadas; XLSX aparece documentado a nivel de servicio y debe validarse operativamente en cada release.

## Autoridad de cálculo durante AI Foundation

- Las reglas legacy vigentes siguen siendo la fuente oficial por defecto y el Financial Engine debe reutilizarlas sin reinterpretarlas.
- Reports permanece en shadow mode: una divergencia se observa, pero nunca sustituye el resultado legacy.
- Solo el resumen de balance de Home puede usar el resultado del Financial Engine, y únicamente cuando el build contiene el texto exacto `VITE_FINANCIAL_ENGINE_HOME_ENABLED=true`.
- Ausencia, `false`, diferencias de mayúsculas, espacios u otros valores conservan legacy. No existe override programático del flag.
- Desactivar el piloto requiere rebuild y redeploy. No hay migración de datos ni limpieza asociada al rollback.
- Financial Engine no es todavía fuente global; Financial Snapshot, Rule Registry, Knowledge Layer e Insight Engine no existen como componentes implementados.

## Licencias y dispositivo

- La licencia está vinculada al dispositivo.
- La app valida formato, firma, dispositivo y expiración antes de autorizar automatizaciones.
- La identidad de dispositivo no debe clonarse mediante backup ordinario.

## Automatización y WhatsApp

- El registro local se confirma primero; la automatización sale por outbox.
- El canal de comunicación debe resolverse por deviceCode -> userCode -> communication_channels.
- No debe usarse un canal global por recencia para notificaciones.

## Pendiente de validar

- Regla final de negocio para fallback cuando un usuario tenga más de un canal WhatsApp activo por combinación de userCode y deviceCode.
- Cobertura total de service.completed en documentación funcional pública.
