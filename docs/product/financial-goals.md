# Objetivos Financieros

## Modelo

La tabla Dexie `financialGoals` se añadió en la versión 30. Admite ahorro, límite mensual de gasto y objetivo mensual de ingreso, con estados `active`, `completed`, `paused` y `cancelled`.

Campos: identificador local, tipo, nombre, importe, moneda, periodo mensual, inicio, fin opcional, estado y timestamps. La migración es aditiva y no altera registros financieros existentes.

## Progreso determinista

- ahorro: `max(ingresos - gastos, 0)`;
- objetivo de ingreso: ingresos del periodo;
- límite de gasto: gastos consumidos del periodo.

Los objetivos de ingreso/ahorro limitan la visualización al 100 % una vez alcanzados. El límite de gasto conserva porcentajes superiores al 100 % para declarar `limit_exceeded`. Los movimientos nunca se modifican.

## Operaciones

`financialGoalService` valida y permite crear, editar, pausar, reanudar, completar y cancelar. Inicio permite consultar progreso y gestionar importe/estado. El Copiloto crea mediante propuesta editable y confirmación obligatoria.

## Migración y rollback

La v30 crea una tabla vacía y participa en backup, restauración y reset. Las migraciones físicas descendentes no son seguras en IndexedDB. Un rollback de aplicación debe conservar la declaración v30, ocultar/desactivar la función y mantener los datos; solo una acción explícita posterior puede exportarlos o borrarlos.

