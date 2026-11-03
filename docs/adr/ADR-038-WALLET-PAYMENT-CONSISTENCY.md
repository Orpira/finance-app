# ADR-038 — Validación transaccional de fondos en wallets personales

- Estado: aceptada por solicitud del propietario del 2026-11-03.
- Alcance: operaciones individuales en modo Personal ligadas a wallets.

## Problema

Las transferencias comprobaban fondos al crear y editar, pero un egreso podía
crearse o aumentarse por encima del disponible. Reducir, reasignar o eliminar
un ingreso, eliminar una transferencia recibida o reducir adicionales usados
por una wallet también podía dejar movimientos posteriores sin financiación.
Filtrar el selector por saldo positivo no garantiza fondos suficientes.

## Decisión

`assertWalletMutationAllowed` valida el efecto neto de reemplazar el registro
original por la propuesta. Se ejecuta dentro de la misma transacción `rw` que
persiste la operación, con servicios, egresos, wallets y transferencias incluidas
en su ámbito. Si modifica adicionales, también incluye su tabla. Se reutilizan
los valores monetarios almacenados y se comparan los resultados a céntimos.

Se rechaza cualquier operación que cree un déficit o aumente uno existente en
cualquiera de las wallets debitadas. El mensaje identifica las wallets, saldo
actual, saldo resultante y fondos faltantes para llegar a cero. No persiste el
movimiento rechazado. Los déficits previos se pueden mejorar parcialmente;
editar notas, marcar pagos y operar con otras wallets sigue siendo posible.

Cobertura: alta, edición y eliminación de ingresos, egresos y transferencias;
recalcular adicionales también valida el saldo antes de actualizar el ingreso.
Las transferencias mantienen validación de versión al editar. La eliminación
comprueba el registro actual dentro de su transacción.

No se interpretan las fechas como saldos bancarios históricos: esta regla valida
el saldo acumulado actual tras la operación. Si hay transferencias de otra moneda
sin valoración histórica en una wallet debitada, se rechaza por imposibilidad de
validar en vez de inventar una conversión.

## Consecuencias y límites

- No cambia el esquema ni reescribe datos históricos o el backup del usuario.
- El indicador de pago físico sigue siendo metadato y no descuenta dos veces.
- Los registros sin wallet conservan su comportamiento. Profesional conserva
  sus reglas de temporadas; no adquiere dependencia de wallets personales.
- Restaurar backups es una operación de restauración y conserva datos históricos,
  incluso déficits. No se aplica esta regla para borrar/normalizar un respaldo.
- No se implementa un historial de versiones: no es posible reconstruir ediciones
  anteriores que nunca se guardaron. Un extracto por fecha no equivale a auditoría.
- Las transacciones incorporan más tablas para serializar escrituras relacionadas.
  La cobertura automatizada incluye escenarios de regresión y rollback simulado;
  IndexedDB y dispositivos físicos requieren su comprobación en un entorno con navegador.
